const express = require('express')
const path = require('path')
const fs = require('fs')
const os = require('os')
const { execFile } = require('child_process')
const { promisify } = require('util')
const ExcelJS = require('exceljs')
const multer = require('multer')
const { query, getPool } = require('../database')
const sql = require('mssql')

const execFileAsync = promisify(execFile)
const router = express.Router()

// 文件存储根目录：建议使用 JIUHUAN_FILES_ROOT（兼容旧变量 SALES_ORDER_FILES_ROOT）
const FILE_ROOT =
  process.env.JIUHUAN_FILES_ROOT ||
  process.env.SALES_ORDER_FILES_ROOT ||
  path.resolve(__dirname, '../uploads')
const QUOTATION_BASE_DIR = path.join(FILE_ROOT, '报价单')
const QUOTATION_IMAGE_SUBDIR = '报价单图示'
const QUOTATION_TEMP_DIR_ROOT = path.join(FILE_ROOT, '_temp', 'quotation-images')
const QUOTATION_TEMP_URL_PREFIX = '/uploads/_temp/quotation-images/'
// 兼容旧版：/uploads/quotation-images/*
const QUOTATION_IMAGES_DIR = path.join(FILE_ROOT, 'quotation-images')
const QUOTATION_IMAGE_MAX_SIZE_BYTES = parseInt(
  process.env.QUOTATION_IMAGE_MAX_SIZE || String(5 * 1024 * 1024),
  10
)

const ensureDirSync = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

const moveFileWithFallback = async (fromPath, toPath) => {
  try {
    await fs.promises.rename(fromPath, toPath)
  } catch (err) {
    if (err && err.code === 'EXDEV') {
      await fs.promises.copyFile(fromPath, toPath)
      await fs.promises.unlink(fromPath)
      return
    }
    throw err
  }
}

const safeQuotationNoForPath = (quotationNo) => {
  if (!quotationNo) return 'UNKNOWN'
  return String(quotationNo)
    .trim()
    .replace(/[\s/\\?%*:|"<>]+/g, '_')
}

const resolveTempQuotationImagePath = (imageUrl) => {
  const url = String(imageUrl || '')
  if (!url.startsWith(QUOTATION_TEMP_URL_PREFIX)) return null
  const rel = url.slice(QUOTATION_TEMP_URL_PREFIX.length)
  const parts = rel
    .split('/')
    .filter(Boolean)
    .map((p) => decodeURIComponent(p))
  if (!parts.length) return null
  const resolved = path.resolve(QUOTATION_TEMP_DIR_ROOT, ...parts)
  const rootResolved = path.resolve(QUOTATION_TEMP_DIR_ROOT)
  if (!resolved.startsWith(rootResolved + path.sep) && resolved !== rootResolved) return null
  return resolved
}

const resolveStoredQuotationImagePath = (imageUrl) => {
  const url = String(imageUrl || '')
  const oldPrefix = '/uploads/quotation-images/'
  if (url.startsWith(oldPrefix)) {
    const name = decodeURIComponent(url.slice(oldPrefix.length))
    const safeName = path.basename(name)
    if (!safeName) return null
    return path.join(QUOTATION_IMAGES_DIR, safeName)
  }

  const newPrefix = '/uploads/报价单/'
  if (url.startsWith(newPrefix)) {
    const parts = url.split('/').filter(Boolean)
    // /uploads/报价单/<quotationNo>/报价单图示/<filename>
    if (parts.length < 5) return null
    if (parts[0] !== 'uploads') return null
    if (parts[1] !== '报价单') return null
    if (parts[3] !== QUOTATION_IMAGE_SUBDIR) return null
    const quotationNo = decodeURIComponent(parts[2] || '')
    const safeQuotationNo = safeQuotationNoForPath(quotationNo)
    const fileName = decodeURIComponent(parts[4] || '')
    const safeFileName = path.basename(fileName)
    if (!safeQuotationNo || !safeFileName) return null
    return path.join(FILE_ROOT, '报价单', safeQuotationNo, QUOTATION_IMAGE_SUBDIR, safeFileName)
  }

  return null
}

const resolveAnyQuotationImagePath = (imageUrl) => {
  const url = String(imageUrl || '')
  if (url.startsWith(QUOTATION_TEMP_URL_PREFIX)) return resolveTempQuotationImagePath(url)
  return resolveStoredQuotationImagePath(url)
}

const cleanupEmptyParents = async (startPath, stopDir) => {
  const stop = path.resolve(stopDir)
  let current = path.dirname(path.resolve(startPath))
  while (current.startsWith(stop + path.sep) && current !== stop) {
    try {
      const entries = await fs.promises.readdir(current)
      if (entries.length > 0) break
      await fs.promises.rmdir(current)
    } catch {
      break
    }
    current = path.dirname(current)
  }
}

const finalizePartItemImages = async (quotationNo, partItems) => {
  const safeQuotationNo = safeQuotationNoForPath(quotationNo)
  const moved = {}
  const items = Array.isArray(partItems) ? partItems : []
  for (const item of items) {
    const imageUrl = String(item?.imageUrl || '').trim()
    if (!imageUrl) continue
    if (!imageUrl.startsWith(QUOTATION_TEMP_URL_PREFIX)) continue

    const fromPath = resolveTempQuotationImagePath(imageUrl)
    if (!fromPath) continue

    const fileName = path.basename(fromPath)
    if (!fileName) continue

    const finalDir = path.join(QUOTATION_BASE_DIR, safeQuotationNo, QUOTATION_IMAGE_SUBDIR)
    ensureDirSync(finalDir)
    const toPath = path.join(finalDir, fileName)

    try {
      await moveFileWithFallback(fromPath, toPath)
      await cleanupEmptyParents(fromPath, QUOTATION_TEMP_DIR_ROOT)
      const finalUrl = `/uploads/报价单/${safeQuotationNo}/${QUOTATION_IMAGE_SUBDIR}/${fileName}`
      item.imageUrl = finalUrl
      moved[imageUrl] = finalUrl
    } catch (e) {
      console.error('归档报价单图示失败:', e)
    }
  }
  return { partItems: items, movedImages: moved }
}

ensureDirSync(QUOTATION_BASE_DIR)
ensureDirSync(QUOTATION_TEMP_DIR_ROOT)
ensureDirSync(QUOTATION_IMAGES_DIR)

const uploadPartItemImage = multer({
  storage: multer.diskStorage({
    destination(req, file, cb) {
      try {
        const tempDir = path.join(
          QUOTATION_TEMP_DIR_ROOT,
          String(Date.now()),
          String(Math.random().toString(36).slice(2, 8))
        )
        ensureDirSync(tempDir)
        req._quotationImageTempDir = tempDir
        cb(null, tempDir)
      } catch (err) {
        cb(err)
      }
    },
    filename(req, file, cb) {
      const mime = String(file.mimetype || '').toLowerCase()
      const extFromMime =
        mime === 'image/png'
          ? '.png'
          : mime === 'image/jpeg' || mime === 'image/jpg'
            ? '.jpg'
            : mime === 'image/webp'
              ? '.webp'
              : ''
      const ext = extFromMime || path.extname(file.originalname || '') || '.png'
      const rand = String(Math.floor(Math.random() * 1e9)).padStart(9, '0')
      const timestamp = Date.now()
      const storedFileName = `qt-${timestamp}-${rand}${ext}`
      req._quotationImageStoredFileName = storedFileName
      cb(null, storedFileName)
    }
  }),
  limits: { fileSize: QUOTATION_IMAGE_MAX_SIZE_BYTES }
})

let quotationRemarkColumnEnsured = false
const ensureQuotationRemarkColumn = async () => {
  if (quotationRemarkColumnEnsured) return

  const rows = await query(`SELECT COL_LENGTH(N'报价单', N'备注') as len`)
  const exists = rows?.[0]?.len !== null && rows?.[0]?.len !== undefined

  if (!exists) {
    await query(`ALTER TABLE 报价单 ADD 备注 NVARCHAR(MAX) NULL`)
  }

  quotationRemarkColumnEnsured = true
}

let quotationEnableImageColumnEnsured = false
const ensureQuotationEnableImageColumn = async () => {
  if (quotationEnableImageColumnEnsured) return

  const rows = await query(`SELECT COL_LENGTH(N'报价单', N'启用图示') as len`)
  const exists = rows?.[0]?.len !== null && rows?.[0]?.len !== undefined

  if (!exists) {
    await query(
      `ALTER TABLE 报价单 ADD 启用图示 BIT NOT NULL CONSTRAINT DF_报价单_启用图示 DEFAULT (1)`
    )
  }

  quotationEnableImageColumnEnsured = true
}

const toDateString = (value) => {
  if (!value) return ''
  try {
    return String(value).split('T')[0]
  } catch {
    return ''
  }
}

const buildPartQuotationWorkbook = ({ row, partItems, enableImage }) => {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('零件报价单', {
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.3,
        right: 0.3,
        top: 0.5,
        bottom: 0.5,
        header: 0.2,
        footer: 0.2
      }
    }
  })

  const borderThin = { style: 'thin', color: { argb: 'FF000000' } }
  const colorTextMuted = { argb: 'FF606266' }
  const fillHeader = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F3F5' } }
  const fillStripe = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCFCFD' } }
  const fillSuccess = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } }
  const setBorderAll = (cell) => {
    cell.border = {
      top: borderThin,
      left: borderThin,
      bottom: borderThin,
      right: borderThin
    }
  }

  const excelColumnWidthToPixels = (width) => {
    const w = Number(width)
    if (!Number.isFinite(w) || w <= 0) return 64
    return Math.floor(w * 7 + 5)
  }

  const excelRowHeightPointsToPixels = (points) => {
    const p = Number(points)
    if (!Number.isFinite(p) || p <= 0) return 64
    return Math.floor((p * 4) / 3)
  }

  const getImageDimensions = (buffer) => {
    if (!buffer || buffer.length < 24) return null

    // PNG: IHDR width/height at offset 16
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      const width = buffer.readUInt32BE(16)
      const height = buffer.readUInt32BE(20)
      return { width, height, extension: 'png' }
    }

    // JPEG: scan for SOF0/SOF2
    if (buffer[0] === 0xff && buffer[1] === 0xd8) {
      let offset = 2
      while (offset + 9 < buffer.length) {
        if (buffer[offset] !== 0xff) break
        const marker = buffer[offset + 1]
        const size = buffer.readUInt16BE(offset + 2)
        if (marker === 0xc0 || marker === 0xc2) {
          const height = buffer.readUInt16BE(offset + 5)
          const width = buffer.readUInt16BE(offset + 7)
          return { width, height, extension: 'jpeg' }
        }
        offset += 2 + size
      }
    }

    return null
  }

  const unwrapPartItemImageUrl = (imageUrl) => {
    const raw = String(imageUrl || '').trim()
    if (!raw) return ''
    const apiPrefix = '/api/quotation/part-item-image?'
    if (!raw.startsWith(apiPrefix)) return raw
    try {
      const query = raw.slice(apiPrefix.length)
      const params = new URLSearchParams(query)
      const inner = params.get('url')
      return inner ? String(inner) : raw
    } catch {
      return raw
    }
  }

  const isEnabled = enableImage !== undefined ? !!enableImage : Number(row?.enableImage ?? 1) !== 0

  const columns = isEnabled
    ? [
        { key: 'seq', width: 6 },
        { key: 'name', width: 22 },
        { key: 'drawing', width: 18 },
        { key: 'material', width: 14 },
        { key: 'process', width: 14 },
        { key: 'image', width: 12 },
        { key: 'qty', width: 10 },
        { key: 'unitPrice', width: 12 },
        { key: 'amount', width: 12 }
      ]
    : [
        { key: 'seq', width: 6 },
        { key: 'name', width: 26 },
        { key: 'drawing', width: 18 },
        { key: 'material', width: 14 },
        { key: 'process', width: 14 },
        { key: 'qty', width: 10 },
        { key: 'unitPrice', width: 12 },
        { key: 'amount', width: 12 }
      ]
  sheet.columns = columns

  const colCount = columns.length
  const colLetter = (idx) => String.fromCharCode('A'.charCodeAt(0) + idx - 1)
  const lastCol = colLetter(colCount)

  // Header
  sheet.mergeCells(`A1:${lastCol}1`)
  sheet.getCell('A1').value = '零件报价单'
  sheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' }
  sheet.getCell('A1').font = { bold: true, size: 18, name: '微软雅黑' }
  sheet.getRow(1).height = 26

  // Meta block (3 lines)
  const metaStartRow = 2
  const customerRow = metaStartRow
  sheet.mergeCells(`A${customerRow}:${lastCol}${customerRow}`)
  sheet.getCell(`A${customerRow}`).value = `客户名称：${row.customerName || ''}`
  sheet.getCell(`A${customerRow}`).alignment = { horizontal: 'left', vertical: 'middle' }
  sheet.getCell(`A${customerRow}`).font = { size: 11, name: '微软雅黑' }
  sheet.getRow(customerRow).height = 18

  const rowNoDate = metaStartRow + 1
  sheet.mergeCells(`A${rowNoDate}:D${rowNoDate}`)
  sheet.getCell(`A${rowNoDate}`).value = `报价单号：${row.quotationNo || ''}`
  sheet.getCell(`A${rowNoDate}`).alignment = { horizontal: 'left', vertical: 'middle' }
  sheet.getCell(`A${rowNoDate}`).font = { size: 11, name: '微软雅黑' }

  sheet.mergeCells(`E${rowNoDate}:${lastCol}${rowNoDate}`)
  sheet.getCell(`E${rowNoDate}`).value = `报价日期：${toDateString(row.quotationDate)}`
  sheet.getCell(`E${rowNoDate}`).alignment = { horizontal: 'left', vertical: 'middle' }
  sheet.getCell(`E${rowNoDate}`).font = { size: 11, name: '微软雅黑' }
  sheet.getRow(rowNoDate).height = 18

  const rowContact = metaStartRow + 2
  sheet.mergeCells(`A${rowContact}:D${rowContact}`)
  sheet.getCell(`A${rowContact}`).value = `联系人：${row.contactName || '-'}`
  sheet.getCell(`A${rowContact}`).alignment = { horizontal: 'left', vertical: 'middle' }
  sheet.getCell(`A${rowContact}`).font = { size: 11, name: '微软雅黑' }

  sheet.mergeCells(`E${rowContact}:${lastCol}${rowContact}`)
  sheet.getCell(`E${rowContact}`).value = `联系电话：${row.contactPhone || '-'}`
  sheet.getCell(`E${rowContact}`).alignment = { horizontal: 'left', vertical: 'middle' }
  sheet.getCell(`E${rowContact}`).font = { size: 11, name: '微软雅黑' }
  sheet.getRow(rowContact).height = 18

  // subtle separator under meta
  sheet.getCell(`A${rowContact}`).border = { bottom: borderThin }
  sheet.getCell(`E${rowContact}`).border = { bottom: borderThin }
  sheet.getCell(`A${rowNoDate}`).font = { size: 11, name: '微软雅黑', color: colorTextMuted }
  sheet.getCell(`E${rowNoDate}`).font = { size: 11, name: '微软雅黑', color: colorTextMuted }

  // Table header
  const headerRowIndex = metaStartRow + 4
  const header = isEnabled
    ? ['序号', '产品名称', '产品图号', '材质', '工序', '图示', '数量', '单价(元)', '金额(元)']
    : ['序号', '产品名称', '产品图号', '材质', '工序', '数量', '单价(元)', '金额(元)']
  // 注意：ExcelJS row.values 的数组是从第 1 列开始写入；如果前面塞一个 null，会导致整表右移一列（出现“空列”）
  sheet.getRow(headerRowIndex).values = header
  sheet.getRow(headerRowIndex).font = { bold: true, size: 11, name: '微软雅黑' }
  sheet.getRow(headerRowIndex).alignment = {
    horizontal: 'center',
    vertical: 'middle',
    wrapText: true
  }
  sheet.getRow(headerRowIndex).height = 24
  for (let c = 1; c <= colCount; c += 1) {
    const cell = sheet.getRow(headerRowIndex).getCell(c)
    setBorderAll(cell)
    cell.fill = fillHeader
  }

  // Lines
  const lineStart = headerRowIndex + 1
  partItems.forEach((item, idx) => {
    const qty = Number(item?.quantity) || 0
    const unitPrice = Number(item?.unitPrice)
    const amount = qty * (Number.isFinite(unitPrice) ? unitPrice : 0)
    const rowIdx = lineStart + idx
    const rowObj = sheet.getRow(rowIdx)
    rowObj.height = isEnabled ? 48 : 20
    const baseCells = [
      idx + 1,
      item?.partName || '',
      item?.drawingNo || '',
      item?.material || '',
      item?.process || ''
    ]
    const lineCells = isEnabled
      ? [
          ...baseCells,
          '',
          qty || '',
          Number.isFinite(unitPrice) ? unitPrice : '',
          Number.isFinite(unitPrice) && qty ? amount : ''
        ]
      : [
          ...baseCells,
          qty || '',
          Number.isFinite(unitPrice) ? unitPrice : '',
          Number.isFinite(unitPrice) && qty ? amount : ''
        ]
    rowObj.values = lineCells
    rowObj.font = { size: 11, name: '微软雅黑' }
    rowObj.alignment = { vertical: 'top', wrapText: true }
    rowObj.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }

    const qtyCol = isEnabled ? 7 : 6
    const unitPriceCol = isEnabled ? 8 : 7
    const amountCol = isEnabled ? 9 : 8

    rowObj.getCell(qtyCol).alignment = { horizontal: 'right', vertical: 'middle' }
    rowObj.getCell(unitPriceCol).alignment = { horizontal: 'right', vertical: 'middle' }
    rowObj.getCell(amountCol).alignment = { horizontal: 'right', vertical: 'middle' }
    rowObj.getCell(qtyCol).numFmt = '#,##0'
    rowObj.getCell(unitPriceCol).numFmt = '#,##0.00'
    rowObj.getCell(amountCol).numFmt = '#,##0.00'
    for (let c = 1; c <= colCount; c += 1) {
      const cell = rowObj.getCell(c)
      setBorderAll(cell)
      if (idx % 2 === 0) cell.fill = fillStripe
    }

    if (isEnabled) {
      const imageUrl = item?.imageUrl
      if (imageUrl) {
        const normalizedImageUrl = unwrapPartItemImageUrl(imageUrl)
        const imagePath = resolveAnyQuotationImagePath(normalizedImageUrl)
        if (imagePath && fs.existsSync(imagePath)) {
          try {
            const buffer = fs.readFileSync(imagePath)
            const info = getImageDimensions(buffer)
            if (info?.width && info?.height) {
              const imageId = workbook.addImage({ buffer, extension: info.extension })
              const imageCol = 6 // 图示列
              const cellPxW = excelColumnWidthToPixels(sheet.getColumn(imageCol).width)
              const cellPxH = excelRowHeightPointsToPixels(rowObj.height)
              const scalePref = Number(item?.imageScale)
              const userScale =
                scalePref === 0.5 || scalePref === 0.75 || scalePref === 1 ? scalePref : 1
              const maxPx = Math.max(1, Math.floor(Math.min(cellPxW, cellPxH) * userScale))
              const fitScale = Math.min(maxPx / info.width, maxPx / info.height, 1)
              const imgW = Math.max(1, Math.round(info.width * fitScale))
              const imgH = Math.max(1, Math.round(info.height * fitScale))
              const offsetCol = (cellPxW - imgW) / cellPxW / 2
              const offsetRow = (cellPxH - imgH) / cellPxH / 2
              sheet.addImage(imageId, {
                tl: { col: imageCol - 1 + offsetCol, row: rowIdx - 1 + offsetRow },
                ext: { width: imgW, height: imgH }
              })
            }
          } catch (e) {
            console.error('插入图示失败:', e)
          }
        }
      }
    }
  })

  const totalRowIndex = lineStart + partItems.length
  const totalAmount = partItems.reduce(
    (sum, item) => sum + (Number(item?.unitPrice) || 0) * (Number(item?.quantity) || 0),
    0
  )
  sheet.mergeCells(`A${totalRowIndex}:${colLetter(colCount - 1)}${totalRowIndex}`)
  sheet.getCell(`A${totalRowIndex}`).value = '合计'
  sheet.getCell(`A${totalRowIndex}`).alignment = { horizontal: 'center', vertical: 'middle' }
  sheet.getCell(`${lastCol}${totalRowIndex}`).value = totalAmount || ''
  sheet.getCell(`${lastCol}${totalRowIndex}`).alignment = {
    horizontal: 'right',
    vertical: 'middle'
  }
  sheet.getCell(`${lastCol}${totalRowIndex}`).numFmt = '#,##0.00'
  sheet.getRow(totalRowIndex).font = { bold: true, size: 11, name: '微软雅黑' }
  sheet.getRow(totalRowIndex).height = 22
  for (let c = 1; c <= colCount; c += 1) {
    const cell = sheet.getRow(totalRowIndex).getCell(c)
    setBorderAll(cell)
    cell.fill = fillHeader
  }

  // Summary block (right side)
  const summaryStart = totalRowIndex + 2
  const summaryLabelCol = colCount - 2
  const summaryValueCol = colCount - 1
  const sumLabelLetter = colLetter(summaryLabelCol)
  const sumValueLetter = colLetter(summaryValueCol)
  ;[
    { label: '其它费用', value: row.otherFee, fmt: '#,##0.00' },
    { label: '运输费用', value: row.transportFee, fmt: '#,##0.00' },
    { label: '含税价格', value: row.taxIncludedPrice, fmt: '#,##0.00', isTotal: true }
  ].forEach((it, i) => {
    const r = summaryStart + i
    sheet.getCell(`${sumLabelLetter}${r}`).value = it.label
    sheet.getCell(`${sumLabelLetter}${r}`).alignment = { horizontal: 'center', vertical: 'middle' }
    sheet.getCell(`${sumLabelLetter}${r}`).font = {
      size: 11,
      name: '微软雅黑',
      color: colorTextMuted
    }
    sheet.getCell(`${sumLabelLetter}${r}`).fill = fillHeader

    sheet.mergeCells(`${sumValueLetter}${r}:${lastCol}${r}`)
    sheet.getCell(`${sumValueLetter}${r}`).value =
      it.value === null || it.value === undefined || Number(it.value) === 0 ? '' : Number(it.value)
    sheet.getCell(`${sumValueLetter}${r}`).numFmt = it.fmt
    sheet.getCell(`${sumValueLetter}${r}`).alignment = { horizontal: 'right', vertical: 'middle' }
    sheet.getCell(`${sumValueLetter}${r}`).font = it.isTotal
      ? { bold: true, size: 13, name: '微软雅黑' }
      : { size: 11, name: '微软雅黑' }
    if (it.isTotal) sheet.getCell(`${sumValueLetter}${r}`).fill = fillSuccess
    for (let c = summaryLabelCol; c <= colCount; c += 1) setBorderAll(sheet.getRow(r).getCell(c))
    sheet.getRow(r).height = it.isTotal ? 24 : 20
  })

  // Notes / Remark box
  const notesTitleRow = summaryStart + 4
  sheet.mergeCells(`A${notesTitleRow}:${lastCol}${notesTitleRow}`)
  sheet.getCell(`A${notesTitleRow}`).value = '备注'
  sheet.getCell(`A${notesTitleRow}`).font = { bold: true, size: 11, name: '微软雅黑' }
  sheet.getCell(`A${notesTitleRow}`).alignment = { horizontal: 'left', vertical: 'middle' }
  for (let c = 1; c <= colCount; c += 1) setBorderAll(sheet.getRow(notesTitleRow).getCell(c))

  const notesBodyRow = notesTitleRow + 1
  sheet.mergeCells(`A${notesBodyRow}:${lastCol}${notesBodyRow}`)
  sheet.getCell(`A${notesBodyRow}`).value = row.remark || ''
  sheet.getCell(`A${notesBodyRow}`).alignment = {
    horizontal: 'left',
    vertical: 'top',
    wrapText: true
  }
  sheet.getRow(notesBodyRow).height = 60
  for (let c = 1; c <= colCount; c += 1) setBorderAll(sheet.getRow(notesBodyRow).getCell(c))

  // Print helpers
  sheet.views = [{ state: 'frozen', ySplit: headerRowIndex }]
  sheet.pageSetup.printArea = `A1:${lastCol}${notesBodyRow}`
  sheet.headerFooter.oddFooter = `&L零件报价单&R第 &P 页 / 共 &N 页`

  return workbook
}

// 上传零件报价单明细截图（返回匿名静态资源 URL）
router.post('/upload-part-item-image', (req, res) => {
  uploadPartItemImage.single('file')(req, res, (err) => {
    if (err) {
      const message =
        err?.code === 'LIMIT_FILE_SIZE'
          ? `上传失败：图片不能超过 ${Math.round(QUOTATION_IMAGE_MAX_SIZE_BYTES / 1024 / 1024)}MB`
          : err?.message || '上传失败'
      return res.status(400).json({ code: 400, success: false, message })
    }

    const file = req.file
    if (!file) {
      return res.status(400).json({ code: 400, success: false, message: '未找到上传文件' })
    }

    const mime = String(file.mimetype || '').toLowerCase()
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
    if (!allowed.includes(mime)) {
      try {
        fs.unlinkSync(file.path)
      } catch {}
      return res
        .status(400)
        .json({ code: 400, success: false, message: '仅支持 png/jpg/webp 图片' })
    }

    try {
      const rel = path.relative(QUOTATION_TEMP_DIR_ROOT, file.path)
      const safeRel = String(rel || '').replace(/\\/g, '/')
      if (!safeRel || safeRel.startsWith('..')) {
        try {
          fs.unlinkSync(file.path)
        } catch {}
        return res.status(500).json({ code: 500, success: false, message: '生成临时预览地址失败' })
      }
      const parts = safeRel.split('/').filter(Boolean)
      const urlPath = `${QUOTATION_TEMP_URL_PREFIX}${parts.map((p) => encodeURIComponent(p)).join('/')}`
      return res.json({ code: 0, success: true, data: { url: urlPath } })
    } catch (e) {
      try {
        fs.unlinkSync(file.path)
      } catch {}
      console.error('生成临时图示URL失败:', e)
      return res.status(500).json({ code: 500, success: false, message: '保存图片失败' })
    }
  })
})

// 删除临时图示（取消/关闭弹窗时调用）
router.post('/delete-temp-part-item-image', async (req, res) => {
  try {
    const url = String(req.body?.url || '').trim()
    if (!url) {
      return res.status(400).json({ code: 400, success: false, message: '缺少 url' })
    }
    const filePath = resolveTempQuotationImagePath(url)
    if (!filePath) {
      return res.status(400).json({ code: 400, success: false, message: '不是合法的临时图示地址' })
    }

    try {
      await fs.promises.unlink(filePath)
    } catch (e) {
      // 文件不存在也视为成功，避免重复清理导致报错
      if (e && e.code !== 'ENOENT') throw e
    }
    await cleanupEmptyParents(filePath, QUOTATION_TEMP_DIR_ROOT)
    return res.json({ code: 0, success: true })
  } catch (e) {
    console.error('删除临时图示失败:', e)
    return res.status(500).json({ code: 500, success: false, message: '删除临时图示失败' })
  }
})

// 通过 API 预览零件报价单图示（兼容临时/最终/历史路径，只依赖 /api，不依赖 /uploads 静态映射）
router.get('/part-item-image', async (req, res) => {
  try {
    const url = String(req.query?.url || '').trim()
    if (!url) {
      return res.status(400).json({ code: 400, success: false, message: '缺少 url' })
    }

    const filePath = resolveAnyQuotationImagePath(url)
    if (!filePath) {
      return res.status(404).json({ code: 404, success: false, message: '图片不存在' })
    }

    try {
      await fs.promises.access(filePath, fs.constants.R_OK)
    } catch {
      return res.status(404).json({ code: 404, success: false, message: '图片不存在' })
    }

    // 临时图片不缓存，避免“删除后仍显示”
    if (url.startsWith(QUOTATION_TEMP_URL_PREFIX)) {
      res.setHeader('Cache-Control', 'no-store')
    } else {
      res.setHeader('Cache-Control', 'private, max-age=60')
    }

    return res.sendFile(filePath)
  } catch (e) {
    console.error('读取图示失败:', e)
    return res.status(500).json({ code: 500, success: false, message: '读取图片失败' })
  }
})

// 获取报价单列表
router.get('/list', async (req, res) => {
  try {
    await ensureQuotationRemarkColumn()
    await ensureQuotationEnableImageColumn()
    const { keyword, processingDate, page = 1, pageSize = 20 } = req.query

    // 构建查询条件
    const whereConditions = []
    const params = {}

    // 关键词搜索：报价单号、客户名称、更改通知单号、模具编号、加工零件名称
    if (keyword) {
      whereConditions.push(
        `(报价单号 LIKE @keyword OR 客户名称 LIKE @keyword OR 更改通知单号 LIKE @keyword OR 模具编号 LIKE @keyword OR 加工零件名称 LIKE @keyword)`
      )
      params.keyword = `%${keyword}%`
    }

    // 加工日期筛选
    if (processingDate) {
      whereConditions.push('加工日期 = @processingDate')
      params.processingDate = processingDate
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

    // 计算总数
    const countQuery = `
      SELECT COUNT(*) as total
      FROM 报价单
      ${whereClause}
    `
    const countResult = await query(countQuery, params)
    const total = countResult[0]?.total || 0

    // 计算分页
    const pageNum = parseInt(page, 10) || 1
    const pageSizeNum = parseInt(pageSize, 10) || 20
    const offset = (pageNum - 1) * pageSizeNum

    // 查询数据
    const dataQuery = `
      SELECT 
        报价单ID as id,
        报价单号 as quotationNo,
        报价日期 as quotationDate,
        客户名称 as customerName,
        报价类型 as quotationType,
        加工日期 as processingDate,
        更改通知单号 as changeOrderNo,
        加工零件名称 as partName,
        模具编号 as moldNo,
        申请更改部门 as department,
        申请更改人 as applicant,
	        联系人 as contactName,
	        联系电话 as contactPhone,
	        交货方式 as deliveryTerms,
	        付款方式 as paymentTerms,
	        报价有效期天数 as validityDays,
	        备注 as remark,
	        启用图示 as enableImage,
	        材料明细 as materialsJson,
	        加工费用明细 as processesJson,
	        零件明细 as partItemsJson,
	        其他费用 as otherFee,
        运输费用 as transportFee,
        加工数量 as quantity,
        含税价格 as taxIncludedPrice,
        创建时间 as createTime,
        更新时间 as updateTime
      FROM 报价单
      ${whereClause}
      ORDER BY 创建时间 DESC, 报价单ID DESC
      OFFSET ${offset} ROWS
      FETCH NEXT ${pageSizeNum} ROWS ONLY
    `

    const data = await query(dataQuery, params)

    // 解析JSON字段
    const quotations = data.map((row) => {
      let materials = []
      let processes = []
      let partItems = []
      try {
        materials = JSON.parse(row.materialsJson || '[]')
      } catch (e) {
        console.error('解析材料明细JSON失败:', e)
        materials = []
      }
      try {
        processes = JSON.parse(row.processesJson || '[]')
      } catch (e) {
        console.error('解析加工费用明细JSON失败:', e)
        processes = []
      }
      try {
        partItems = JSON.parse(row.partItemsJson || '[]')
      } catch (e) {
        console.error('解析零件明细JSON失败:', e)
        partItems = []
      }

      return {
        ...row,
        materials,
        processes,
        partItems
      }
    })

    res.json({
      code: 0,
      success: true,
      data: {
        list: quotations,
        total: total,
        page: pageNum,
        pageSize: pageSizeNum
      }
    })
  } catch (error) {
    console.error('获取报价单列表失败:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: '获取报价单列表失败',
      error: error.message
    })
  }
})

// 生成新的报价单编号
router.get('/generate-no', async (req, res) => {
  try {
    const quotationPrefix = 'BJ' // 报价的拼音首字母
    // 使用东八区（UTC+8）时间获取当前日期
    // 无论服务器在什么时区，都统一使用东八区时间
    const now = new Date()
    // getTime() 返回的是UTC时间戳（毫秒）
    // 直接加上8小时（东八区偏移）得到东八区时间戳
    const chinaTimestamp = now.getTime() + 8 * 60 * 60 * 1000
    // 创建东八区时间对象
    const chinaTime = new Date(chinaTimestamp)
    // 使用UTC方法获取年月日（因为时间戳已经加上了8小时偏移）
    const year = chinaTime.getUTCFullYear()
    const month = String(chinaTime.getUTCMonth() + 1).padStart(2, '0')
    const day = String(chinaTime.getUTCDate()).padStart(2, '0')
    const quotationDate = `${year}${month}${day}` // YYYYMMDD

    // 查询最新的报价单编号
    // 注意：这里假设报价单表名为"报价单"，报价单号字段为"报价单号"
    // 如果表名或字段名不同，需要相应调整
    let serialNumber = 1

    try {
      const queryString = `
        SELECT TOP 1 报价单号 as quotationNo
        FROM 报价单
        WHERE 报价单号 LIKE 'BJ-%'
        ORDER BY 报价单号 DESC
      `

      const result = await query(queryString)

      if (result.length > 0 && result[0].quotationNo) {
        const lastQuotationNo = result[0].quotationNo
        // 解析报价单编号：BJ-YYYYMMDD-XXX
        const match = lastQuotationNo.match(/^BJ-(\d{8})-(\d{3})$/)

        if (match) {
          const lastDate = match[1]
          const lastSerial = parseInt(match[2], 10)

          // 如果是同一天，序列号递增；否则重置为1
          if (lastDate === quotationDate) {
            serialNumber = lastSerial + 1
          } else {
            serialNumber = 1
          }
        }
      }
    } catch (tableError) {
      // 如果表不存在或其他错误，记录日志但继续生成新编号（从001开始）
      console.warn('查询报价单表失败（可能是表不存在），将生成新的编号:', tableError.message)
      serialNumber = 1
    }

    // 格式化序列号为三位数
    const formattedSerial = String(serialNumber).padStart(3, '0')

    // 生成新报价单编号：BJ-YYYYMMDD-XXX
    const newQuotationNo = `${quotationPrefix}-${quotationDate}-${formattedSerial}`

    res.json({
      code: 0,
      success: true,
      data: { quotationNo: newQuotationNo }
    })
  } catch (error) {
    console.error('生成报价单编号失败:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: '生成报价单编号失败',
      error: error.message
    })
  }
})

// 创建报价单
router.post('/create', async (req, res) => {
  try {
    await ensureQuotationRemarkColumn()
    await ensureQuotationEnableImageColumn()
    console.log('收到创建报价单请求，请求体:', JSON.stringify(req.body, null, 2))

    const {
      quotationNo,
      quotationDate,
      customerName,
      quotationType = 'mold',
      enableImage,
      processingDate,
      changeOrderNo,
      partName,
      moldNo,
      department,
      applicant,
      contactName,
      contactPhone,
      remark,
      deliveryTerms,
      paymentTerms,
      validityDays,
      materials,
      processes,
      partItems,
      otherFee,
      transportFee,
      quantity
    } = req.body

    const normalizedType = quotationType === 'part' ? 'part' : 'mold'
    const effectiveEnableImage =
      normalizedType === 'part' ? (enableImage === undefined ? 1 : enableImage ? 1 : 0) : 0

    // 验证必填字段
    if (!quotationNo) {
      console.log('验证失败: 报价单号为空')
      return res.status(400).json({
        code: 400,
        success: false,
        message: '报价单号不能为空'
      })
    }

    if (!quotationDate) {
      console.log('验证失败: 报价日期为空')
      return res.status(400).json({
        code: 400,
        success: false,
        message: '报价日期不能为空'
      })
    }

    if (!customerName) {
      console.log('验证失败: 客户名称为空')
      return res.status(400).json({
        code: 400,
        success: false,
        message: '客户名称不能为空'
      })
    }

    if (normalizedType === 'mold') {
      if (!partName) {
        console.log('验证失败: 加工零件名称为空')
        return res.status(400).json({
          code: 400,
          success: false,
          message: '加工零件名称不能为空'
        })
      }
      if (!moldNo) {
        return res.status(400).json({
          code: 400,
          success: false,
          message: '模具编号不能为空'
        })
      }
      if (!department) {
        return res.status(400).json({
          code: 400,
          success: false,
          message: '申请更改部门不能为空'
        })
      }
      if (!applicant) {
        return res.status(400).json({
          code: 400,
          success: false,
          message: '申请更改人不能为空'
        })
      }
    } else {
      const items = Array.isArray(partItems) ? partItems : []
      if (!items.length) {
        return res.status(400).json({
          code: 400,
          success: false,
          message: '零件明细不能为空'
        })
      }
      const badLine = items.find(
        (x) =>
          !String(x?.partName || '').trim() ||
          !Number.isFinite(Number(x?.quantity)) ||
          Number(x?.quantity) <= 0 ||
          !Number.isFinite(Number(x?.unitPrice)) ||
          Number(x?.unitPrice) < 0
      )
      if (badLine) {
        return res.status(400).json({
          code: 400,
          success: false,
          message: '零件明细中存在不完整的行（名称/数量/单价）'
        })
      }
    }

    // 加工日期如果未提供，则默认使用报价日期，确保数据库非空
    const effectiveProcessingDate = processingDate || quotationDate

    // 检查报价单号是否已存在
    const checkQuery = `
      SELECT COUNT(*) as count 
      FROM 报价单 
      WHERE 报价单号 = @quotationNo
    `
    const checkResult = await query(checkQuery, { quotationNo })
    if (checkResult[0].count > 0) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '报价单号已存在'
      })
    }

    // 计算含税价格
    const materialsTotal = (materials || []).reduce(
      (sum, item) => sum + (item.unitPrice || 0) * (item.quantity || 0),
      0
    )
    const processingTotal = (processes || []).reduce(
      (sum, item) => sum + (item.unitPrice || 0) * (item.hours || 0),
      0
    )
    const partItemsTotal = (Array.isArray(partItems) ? partItems : []).reduce(
      (sum, item) => sum + (Number(item?.unitPrice) || 0) * (Number(item?.quantity) || 0),
      0
    )
    const baseTotal = normalizedType === 'part' ? partItemsTotal : materialsTotal + processingTotal
    const taxIncludedPrice = baseTotal + (otherFee || 0) + (transportFee || 0)

    let finalPartItems = partItems || []
    let movedImages = {}
    if (normalizedType === 'part') {
      const finalized = await finalizePartItemImages(
        quotationNo,
        Array.isArray(partItems) ? partItems : []
      )
      finalPartItems = finalized.partItems
      movedImages = finalized.movedImages
    }

    // 将材料明细和加工费用明细转换为JSON字符串
    const materialsJson = JSON.stringify(materials || [])
    const processesJson = JSON.stringify(processes || [])
    const partItemsJson = JSON.stringify(finalPartItems || [])

    console.log('材料明细JSON:', materialsJson)
    console.log('加工费用明细JSON:', processesJson)
    console.log('零件明细JSON:', partItemsJson)

    // 使用 getPool 直接执行，以便正确处理 NVARCHAR(MAX) 类型
    const pool = await getPool()
    const request = pool.request()

    // 绑定参数
    request.input('quotationNo', sql.NVarChar(50), quotationNo)
    request.input('quotationDate', sql.Date, quotationDate)
    request.input('customerName', sql.NVarChar(200), customerName)
    request.input('quotationType', sql.NVarChar(20), normalizedType)
    request.input('processingDate', sql.Date, effectiveProcessingDate)
    request.input('changeOrderNo', sql.NVarChar(50), changeOrderNo || null)
    request.input('partName', sql.NVarChar(200), partName || null)
    request.input('moldNo', sql.NVarChar(100), moldNo || null)
    request.input('department', sql.NVarChar(100), department || null)
    request.input('applicant', sql.NVarChar(50), applicant || null)
    request.input('contactName', sql.NVarChar(50), contactName || null)
    request.input('contactPhone', sql.NVarChar(50), contactPhone || null)
    request.input('remark', sql.NVarChar, remark || null)
    request.input('enableImage', sql.Bit, effectiveEnableImage)
    request.input('deliveryTerms', sql.NVarChar(100), deliveryTerms || null)
    request.input('paymentTerms', sql.NVarChar(100), paymentTerms || null)
    request.input('validityDays', sql.Int, validityDays ?? null)
    request.input('materialsJson', sql.NVarChar, materialsJson)
    request.input('processesJson', sql.NVarChar, processesJson)
    request.input('partItemsJson', sql.NVarChar, partItemsJson)
    request.input('otherFee', sql.Decimal(18, 2), otherFee || 0)
    request.input('transportFee', sql.Decimal(18, 2), transportFee || 0)
    request.input('quantity', sql.Int, quantity || 1)
    request.input('taxIncludedPrice', sql.Decimal(18, 2), taxIncludedPrice)

    // 插入报价单
    const insertQuery = `
	      INSERT INTO 报价单 (
	        报价单号, 报价日期, 客户名称, 报价类型,
	        加工日期, 更改通知单号,
	        加工零件名称, 模具编号, 申请更改部门, 申请更改人,
	        联系人, 联系电话, 备注, 交货方式, 付款方式, 报价有效期天数,
	        启用图示,
	        材料明细, 加工费用明细, 零件明细,
	        其他费用, 运输费用, 加工数量, 含税价格
	      ) VALUES (
	        @quotationNo, @quotationDate, @customerName, @quotationType,
	        @processingDate, @changeOrderNo,
	        @partName, @moldNo, @department, @applicant,
	        @contactName, @contactPhone, @remark, @deliveryTerms, @paymentTerms, @validityDays,
	        @enableImage,
	        @materialsJson, @processesJson, @partItemsJson,
	        @otherFee, @transportFee, @quantity, @taxIncludedPrice
	      )
	      SELECT SCOPE_IDENTITY() as id
	    `

    const result = await request.query(insertQuery)

    const newId = result.recordset[0]?.id || result.rowsAffected[0]

    console.log('报价单创建成功，ID:', newId)

    res.json({
      code: 0,
      success: true,
      data: { id: newId, movedImages },
      message: '创建报价单成功'
    })
  } catch (error) {
    console.error('创建报价单失败:', error)
    console.error('错误详情:', error)
    if (error.originalError) {
      console.error('原始错误:', error.originalError)
    }
    res.status(500).json({
      code: 500,
      success: false,
      message: '创建报价单失败',
      error: error.message || error.originalError?.message || '未知错误'
    })
  }
})

// 更新报价单
router.put('/:id', async (req, res) => {
  try {
    await ensureQuotationRemarkColumn()
    await ensureQuotationEnableImageColumn()
    const { id } = req.params
    const {
      quotationNo,
      quotationDate,
      customerName,
      quotationType = 'mold',
      enableImage,
      processingDate,
      changeOrderNo,
      partName,
      moldNo,
      department,
      applicant,
      contactName,
      contactPhone,
      remark,
      deliveryTerms,
      paymentTerms,
      validityDays,
      materials,
      processes,
      partItems,
      otherFee,
      transportFee,
      quantity
    } = req.body

    const normalizedType = quotationType === 'part' ? 'part' : 'mold'
    const effectiveEnableImage =
      normalizedType === 'part' ? (enableImage === undefined ? 1 : enableImage ? 1 : 0) : 0

    // 验证必填字段
    if (!quotationNo) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '报价单号不能为空'
      })
    }

    if (normalizedType === 'mold') {
      if (!partName) {
        return res.status(400).json({
          code: 400,
          success: false,
          message: '加工零件名称不能为空'
        })
      }
      if (!moldNo) {
        return res.status(400).json({
          code: 400,
          success: false,
          message: '模具编号不能为空'
        })
      }
      if (!department) {
        return res.status(400).json({
          code: 400,
          success: false,
          message: '申请更改部门不能为空'
        })
      }
      if (!applicant) {
        return res.status(400).json({
          code: 400,
          success: false,
          message: '申请更改人不能为空'
        })
      }
    } else {
      const items = Array.isArray(partItems) ? partItems : []
      if (!items.length) {
        return res.status(400).json({
          code: 400,
          success: false,
          message: '零件明细不能为空'
        })
      }
    }

    // 检查报价单是否存在
    const checkQuery = `
      SELECT COUNT(*) as count 
      FROM 报价单 
      WHERE 报价单ID = @id
    `
    const checkResult = await query(checkQuery, { id: parseInt(id) })
    if (checkResult[0].count === 0) {
      return res.status(404).json({
        code: 404,
        success: false,
        message: '报价单不存在'
      })
    }

    // 检查报价单号是否被其他记录使用
    const checkNoQuery = `
      SELECT COUNT(*) as count 
      FROM 报价单 
      WHERE 报价单号 = @quotationNo AND 报价单ID != @id
    `
    const checkNoResult = await query(checkNoQuery, { quotationNo, id: parseInt(id) })
    if (checkNoResult[0].count > 0) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '报价单号已被其他记录使用'
      })
    }

    // 加工日期如果未提供，则默认使用报价日期，确保数据库非空
    const effectiveProcessingDate = processingDate || quotationDate

    // 计算含税价格
    const materialsTotal = (materials || []).reduce(
      (sum, item) => sum + (item.unitPrice || 0) * (item.quantity || 0),
      0
    )
    const processingTotal = (processes || []).reduce(
      (sum, item) => sum + (item.unitPrice || 0) * (item.hours || 0),
      0
    )
    const partItemsTotal = (Array.isArray(partItems) ? partItems : []).reduce(
      (sum, item) => sum + (Number(item?.unitPrice) || 0) * (Number(item?.quantity) || 0),
      0
    )
    const baseTotal = normalizedType === 'part' ? partItemsTotal : materialsTotal + processingTotal
    const taxIncludedPrice = baseTotal + (otherFee || 0) + (transportFee || 0)

    let finalPartItems = partItems || []
    let movedImages = {}
    if (normalizedType === 'part') {
      const finalized = await finalizePartItemImages(
        quotationNo,
        Array.isArray(partItems) ? partItems : []
      )
      finalPartItems = finalized.partItems
      movedImages = finalized.movedImages
    }

    // 将材料明细和加工费用明细转换为JSON字符串
    const materialsJson = JSON.stringify(materials || [])
    const processesJson = JSON.stringify(processes || [])
    const partItemsJson = JSON.stringify(finalPartItems || [])

    // 使用 getPool 直接执行，以便正确处理 NVARCHAR(MAX) 类型
    const pool = await getPool()
    const request = pool.request()

    // 绑定参数
    request.input('id', sql.Int, parseInt(id))
    request.input('quotationNo', sql.NVarChar(50), quotationNo)
    request.input('quotationDate', sql.Date, quotationDate)
    request.input('customerName', sql.NVarChar(200), customerName)
    request.input('quotationType', sql.NVarChar(20), normalizedType)
    request.input('processingDate', sql.Date, effectiveProcessingDate)
    request.input('changeOrderNo', sql.NVarChar(50), changeOrderNo || null)
    request.input('partName', sql.NVarChar(200), partName || null)
    request.input('moldNo', sql.NVarChar(100), moldNo || null)
    request.input('department', sql.NVarChar(100), department || null)
    request.input('applicant', sql.NVarChar(50), applicant || null)
    request.input('contactName', sql.NVarChar(50), contactName || null)
    request.input('contactPhone', sql.NVarChar(50), contactPhone || null)
    request.input('remark', sql.NVarChar, remark || null)
    request.input('enableImage', sql.Bit, effectiveEnableImage)
    request.input('deliveryTerms', sql.NVarChar(100), deliveryTerms || null)
    request.input('paymentTerms', sql.NVarChar(100), paymentTerms || null)
    request.input('validityDays', sql.Int, validityDays ?? null)
    request.input('materialsJson', sql.NVarChar, materialsJson)
    request.input('processesJson', sql.NVarChar, processesJson)
    request.input('partItemsJson', sql.NVarChar, partItemsJson)
    request.input('otherFee', sql.Decimal(18, 2), otherFee || 0)
    request.input('transportFee', sql.Decimal(18, 2), transportFee || 0)
    request.input('quantity', sql.Int, quantity || 1)
    request.input('taxIncludedPrice', sql.Decimal(18, 2), taxIncludedPrice)

    // 更新报价单
    const updateQuery = `
	      UPDATE 报价单 SET
	        报价单号 = @quotationNo,
	        报价日期 = @quotationDate,
	        客户名称 = @customerName,
	        报价类型 = @quotationType,
	        加工日期 = @processingDate,
	        更改通知单号 = @changeOrderNo,
	        加工零件名称 = @partName,
	        模具编号 = @moldNo,
	        申请更改部门 = @department,
	        申请更改人 = @applicant,
	        联系人 = @contactName,
	        联系电话 = @contactPhone,
	        备注 = @remark,
	        启用图示 = @enableImage,
	        交货方式 = @deliveryTerms,
	        付款方式 = @paymentTerms,
	        报价有效期天数 = @validityDays,
	        材料明细 = @materialsJson,
	        加工费用明细 = @processesJson,
	        零件明细 = @partItemsJson,
        其他费用 = @otherFee,
        运输费用 = @transportFee,
        加工数量 = @quantity,
        含税价格 = @taxIncludedPrice,
        更新时间 = GETDATE()
      WHERE 报价单ID = @id
    `

    await request.query(updateQuery)

    res.json({
      code: 0,
      success: true,
      data: { movedImages },
      message: '更新报价单成功'
    })
  } catch (error) {
    console.error('更新报价单失败:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: '更新报价单失败',
      error: error.message
    })
  }
})

// 删除报价单
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params

    if (!id) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '报价单ID不能为空'
      })
    }

    const queryString = `DELETE FROM 报价单 WHERE 报价单ID = @id`
    await query(queryString, { id: parseInt(id, 10) })

    res.json({
      code: 0,
      success: true,
      message: '删除报价单成功'
    })
  } catch (error) {
    console.error('删除报价单失败:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: '删除报价单失败',
      error: error.message
    })
  }
})

// 下载当前报价单对应的 Excel 文件（基于美菱改模报价单模板）
router.get('/:id/export-excel', async (req, res) => {
  try {
    await ensureQuotationRemarkColumn()
    await ensureQuotationEnableImageColumn()
    const { id } = req.params

    // 查询报价单详情
    const rows = await query(
      `
        SELECT 
          报价单ID as id,
          报价单号 as quotationNo,
          报价日期 as quotationDate,
          客户名称 as customerName,
          报价类型 as quotationType,
          加工日期 as processingDate,
          更改通知单号 as changeOrderNo,
          加工零件名称 as partName,
          模具编号 as moldNo,
          申请更改部门 as department,
          申请更改人 as applicant,
	          联系人 as contactName,
	          联系电话 as contactPhone,
	          备注 as remark,
	          启用图示 as enableImage,
	          交货方式 as deliveryTerms,
	          付款方式 as paymentTerms,
	          报价有效期天数 as validityDays,
	          材料明细 as materialsJson,
	          加工费用明细 as processesJson,
          零件明细 as partItemsJson,
          其他费用 as otherFee,
          运输费用 as transportFee,
          加工数量 as quantity,
          含税价格 as taxIncludedPrice
        FROM 报价单
        WHERE 报价单ID = @id
      `,
      { id: parseInt(id, 10) }
    )

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        code: 404,
        success: false,
        message: '报价单不存在'
      })
    }

    const row = rows[0]

    const quotationType = row.quotationType === 'part' ? 'part' : 'mold'

    if (quotationType === 'part') {
      // 零件报价单：用 ExcelJS 直接生成工作簿（样式对齐 demo）
      let partItems = []
      try {
        partItems = JSON.parse(row.partItemsJson || '[]')
      } catch (e) {
        console.error('解析零件明细JSON失败:', e)
        partItems = []
      }

      const workbook = buildPartQuotationWorkbook({ row, partItems, enableImage: row.enableImage })
      const buffer = await workbook.xlsx.writeBuffer()

      const filenameBase = row.quotationNo || '报价单'
      const encodedFilename = encodeURIComponent(`${filenameBase}.xlsx`)

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFilename}`)
      return res.send(buffer)
    }

    // 解析 JSON 字段
    let materials = []
    let processes = []
    try {
      materials = JSON.parse(row.materialsJson || '[]')
    } catch (e) {
      console.error('解析材料明细JSON失败:', e)
      materials = []
    }
    try {
      processes = JSON.parse(row.processesJson || '[]')
    } catch (e) {
      console.error('解析加工费用明细JSON失败:', e)
      processes = []
    }

    // 计算金额（与创建/更新时保持一致），用于填充模板中的合计单元格
    const materialsTotal = (materials || []).reduce(
      (sum, item) => sum + (Number(item.unitPrice) || 0) * (Number(item.quantity) || 0),
      0
    )
    const processingTotal = (processes || []).reduce(
      (sum, item) => sum + (Number(item.unitPrice) || 0) * (Number(item.hours) || 0),
      0
    )
    const otherFee = Number(row.otherFee || 0)
    const transportFee = Number(row.transportFee || 0)
    const quantity = Number(row.quantity || 0) || 1

    const taxIncludedPrice =
      row.taxIncludedPrice !== undefined && row.taxIncludedPrice !== null
        ? Number(row.taxIncludedPrice)
        : materialsTotal + processingTotal + otherFee + transportFee

    // 读取 Excel 模板（美菱改模报价单）
    const templatePath = path.join(__dirname, '..', 'templates', 'quotation', '美菱改模报价单.xlsx')

    const workbook = new ExcelJS.Workbook()
    try {
      await workbook.xlsx.readFile(templatePath)
    } catch (err) {
      console.error('读取报价单模板失败:', err)
      return res.status(500).json({
        code: 500,
        success: false,
        message: '读取报价单模板失败'
      })
    }

    const sheet = workbook.worksheets[0]

    // 工具方法：写入单元格，仅修改单元格数据，不改变样式/格式
    const setCell = (addr, value) => {
      const cell = sheet.getCell(addr)
      if (value === null || value === undefined || value === '') {
        cell.value = ''
      } else if (value instanceof Date || typeof value === 'number') {
        cell.value = value
      } else {
        cell.value = String(value)
      }
    }
    const parseDate = (val) => {
      if (!val) return null
      if (val instanceof Date) return val
      const d = new Date(val)
      if (Number.isNaN(d.getTime())) {
        return null
      }
      return d
    }

    // 一、表头字段
    setCell('C3', parseDate(row.processingDate)) // 加工日期
    setCell('G3', row.changeOrderNo || '') // 更改通知单号
    setCell('C4', row.partName || '') // 加工零件名称
    setCell('G4', row.moldNo || '') // 模具编号
    setCell('C5', row.department || '') // 申请更改部门
    setCell('G5', row.applicant || '') // 申请更改人

    // 二、单位材料费（目前两行：紫铜电极、配件）
    const materialRows = [8, 9]
    materialRows.forEach((rowIndex, i) => {
      const item = materials[i] || {}
      const unitPrice = Number(item.unitPrice) || 0
      const qty = Number(item.quantity) || 0
      const fee = unitPrice * qty
      setCell(`C${rowIndex}`, item.name || '')
      setCell(`E${rowIndex}`, unitPrice)
      setCell(`F${rowIndex}`, qty)
      setCell(`G${rowIndex}`, fee)
    })
    // 单位材料费总价：I8
    setCell('I8', materialsTotal)
    // 三、加工费用（10 行，对应数组顺序）
    const processStartRow = 14
    processes.forEach((item, index) => {
      const rowIndex = processStartRow + index
      const hours = Number(item.hours) || 0
      const unitPrice = Number(item.unitPrice) || 0
      const fee = unitPrice * hours
      setCell(`F${rowIndex}`, hours)
      setCell(`G${rowIndex}`, fee)
    })
    // 加工费总价：I14
    setCell('I14', processingTotal)
    // 四、其他费用 + 运输费用 + 数量 + 含税价格
    setCell('G24', otherFee)
    setCell('G25', transportFee)
    setCell('C26', quantity)
    // 含税价格（程序计算后直接写入 H26，便于模板引用）
    setCell('H26', taxIncludedPrice)

    // 导出为 Excel 文件（不保存到服务器磁盘，直接返回 Buffer）
    const buffer = await workbook.xlsx.writeBuffer()

    const filenameBase = row.quotationNo || '报价单'
    const encodedFilename = encodeURIComponent(`${filenameBase}.xlsx`)

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFilename}`)

    return res.send(buffer)
  } catch (error) {
    console.error('导出报价单 Excel 失败:', error)
    return res.status(500).json({
      code: 500,
      success: false,
      message: '导出报价单 Excel 失败',
      error: error.message
    })
  }
})

// 下载当前报价单对应的 报价 PDF 文件（先填充 Excel 模板，再通过 LibreOffice 转为 PDF）
router.get('/:id/export-pdf', async (req, res) => {
  try {
    await ensureQuotationRemarkColumn()
    await ensureQuotationEnableImageColumn()
    const { id } = req.params

    // 查询报价单详情
    const rows = await query(
      `
        SELECT 
          报价单ID as id,
          报价单号 as quotationNo,
          报价日期 as quotationDate,
          客户名称 as customerName,
          报价类型 as quotationType,
          加工日期 as processingDate,
          更改通知单号 as changeOrderNo,
          加工零件名称 as partName,
          模具编号 as moldNo,
          申请更改部门 as department,
          申请更改人 as applicant,
	          联系人 as contactName,
	          联系电话 as contactPhone,
	          备注 as remark,
	          启用图示 as enableImage,
	          交货方式 as deliveryTerms,
	          付款方式 as paymentTerms,
	          报价有效期天数 as validityDays,
	          材料明细 as materialsJson,
	          加工费用明细 as processesJson,
          零件明细 as partItemsJson,
          其他费用 as otherFee,
          运输费用 as transportFee,
          加工数量 as quantity,
          含税价格 as taxIncludedPrice
        FROM 报价单
        WHERE 报价单ID = @id
      `,
      { id: parseInt(id, 10) }
    )

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        code: 404,
        success: false,
        message: '报价单不存在'
      })
    }

    const row = rows[0]

    const quotationType = row.quotationType === 'part' ? 'part' : 'mold'

    if (quotationType === 'part') {
      // 零件报价 PDF：先生成工作簿，再通过 LibreOffice 转 PDF
      let partItems = []
      try {
        partItems = JSON.parse(row.partItemsJson || '[]')
      } catch (e) {
        console.error('解析零件明细JSON失败:', e)
        partItems = []
      }

      const workbook = buildPartQuotationWorkbook({ row, partItems, enableImage: row.enableImage })

      const tmpDir = os.tmpdir()
      const safeBase = `quotation-part-${row.id || id}-${Date.now()}`
      const xlsxPath = path.join(tmpDir, `${safeBase}.xlsx`)
      const pdfPath = path.join(tmpDir, `${safeBase}.pdf`)

      await workbook.xlsx.writeFile(xlsxPath)

      const sofficePath = process.env.LIBREOFFICE_PATH || 'soffice'
      try {
        const loUserDir = path.join(tmpDir, 'libreoffice-profile')
        try {
          await fs.promises.mkdir(loUserDir, { recursive: true })
        } catch {}

        const loUserDirUrl = `file://${loUserDir.replace(/\\/g, '/')}`
        const env = { ...process.env, HOME: loUserDir }

        await execFileAsync(
          sofficePath,
          [
            '--headless',
            `-env:UserInstallation=${loUserDirUrl}`,
            '--convert-to',
            'pdf',
            '--outdir',
            tmpDir,
            xlsxPath
          ],
          { env }
        )
      } catch (err) {
        console.error('调用 LibreOffice 失败（零件报价单）:', err)
        try {
          await fs.promises.unlink(xlsxPath)
        } catch {}
        return res.status(500).json({
          code: 500,
          success: false,
          message: '服务器未安装 LibreOffice 或转换 PDF 失败'
        })
      }

      let pdfBuffer
      try {
        pdfBuffer = await fs.promises.readFile(pdfPath)
      } catch (err) {
        console.error('读取生成的 PDF 文件失败（零件报价单）:', err)
        try {
          await fs.promises.unlink(xlsxPath)
        } catch {}
        return res.status(500).json({
          code: 500,
          success: false,
          message: '生成 PDF 文件失败'
        })
      }

      try {
        await fs.promises.unlink(xlsxPath)
      } catch {}
      try {
        await fs.promises.unlink(pdfPath)
      } catch {}

      const filenameBase = row.quotationNo || '报价单'
      const encodedFilename = encodeURIComponent(`${filenameBase}报价.pdf`)
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFilename}`)
      return res.send(pdfBuffer)
    }

    // 解析 JSON 字段
    let materials = []
    let processes = []
    try {
      materials = JSON.parse(row.materialsJson || '[]')
    } catch (e) {
      console.error('解析材料明细JSON失败:', e)
      materials = []
    }
    try {
      processes = JSON.parse(row.processesJson || '[]')
    } catch (e) {
      console.error('解析加工费用明细JSON失败:', e)
      processes = []
    }

    // 计算金额（与创建/更新时保持一致）
    const materialsTotal = (materials || []).reduce(
      (sum, item) => sum + (Number(item.unitPrice) || 0) * (Number(item.quantity) || 0),
      0
    )
    const processingTotal = (processes || []).reduce(
      (sum, item) => sum + (Number(item.unitPrice) || 0) * (Number(item.hours) || 0),
      0
    )
    const otherFee = Number(row.otherFee || 0)
    const transportFee = Number(row.transportFee || 0)
    const quantity = Number(row.quantity || 0) || 1

    const taxIncludedPrice =
      row.taxIncludedPrice !== undefined && row.taxIncludedPrice !== null
        ? Number(row.taxIncludedPrice)
        : materialsTotal + processingTotal + otherFee + transportFee

    // 读取 Excel 模板（美菱改模报价单）
    const templatePath = path.join(__dirname, '..', 'templates', 'quotation', '美菱改模报价单.xlsx')

    const workbook = new ExcelJS.Workbook()
    try {
      await workbook.xlsx.readFile(templatePath)
    } catch (err) {
      console.error('读取报价单模板失败:', err)
      return res.status(500).json({
        code: 500,
        success: false,
        message: '读取报价单模板失败'
      })
    }

    const sheet = workbook.worksheets[0]

    // 工具方法：写入单元格，仅修改单元格数据，不改变样式/格式
    const setCell = (addr, value) => {
      const cell = sheet.getCell(addr)
      if (value === null || value === undefined || value === '') {
        cell.value = ''
      } else if (value instanceof Date || typeof value === 'number') {
        cell.value = value
      } else {
        cell.value = String(value)
      }
    }
    const parseDate = (val) => {
      if (!val) return null
      if (val instanceof Date) return val
      const d = new Date(val)
      if (Number.isNaN(d.getTime())) {
        return null
      }
      return d
    }

    // 一、表头字段
    setCell('C3', parseDate(row.processingDate)) // 加工日期
    setCell('G3', row.changeOrderNo || '') // 更改通知单号
    setCell('C4', row.partName || '') // 加工零件名称
    setCell('G4', row.moldNo || '') // 模具编号
    setCell('C5', row.department || '') // 申请更改部门
    setCell('G5', row.applicant || '') // 申请更改人

    // 二、单位材料费
    const materialRows = [8, 9]
    materialRows.forEach((rowIndex, i) => {
      const item = materials[i] || {}
      const unitPrice = Number(item.unitPrice) || 0
      const qty = Number(item.quantity) || 0
      const fee = unitPrice * qty
      setCell(`C${rowIndex}`, item.name || '')
      setCell(`E${rowIndex}`, unitPrice)
      setCell(`F${rowIndex}`, qty)
      setCell(`G${rowIndex}`, fee)
    })
    // 单位材料费总价：I8
    setCell('I8', materialsTotal)
    // 单位材料费总价：I8
    setCell('I8', materialsTotal)

    // 三、加工费用
    const processStartRow = 14
    processes.forEach((item, index) => {
      const rowIndex = processStartRow + index
      const hours = Number(item.hours) || 0
      const unitPrice = Number(item.unitPrice) || 0
      const fee = unitPrice * hours
      setCell(`F${rowIndex}`, hours)
      setCell(`G${rowIndex}`, fee)
    })
    // 加工费总价：I14
    setCell('I14', processingTotal)
    // 加工费总价：I14
    setCell('I14', processingTotal)

    // 四、其他费用 + 运输费用 + 数量 + 含税价格
    setCell('G24', otherFee)
    setCell('G25', transportFee)
    setCell('C26', quantity)
    // 含税价格（程序计算后直接写入 H26，便于模板引用）
    setCell('H26', taxIncludedPrice)

    // 将填充后的工作簿写入临时 xlsx 文件
    const tmpDir = os.tmpdir()
    const safeBase = `quotation-${row.id || id}-${Date.now()}`
    const xlsxPath = path.join(tmpDir, `${safeBase}.xlsx`)
    const pdfPath = path.join(tmpDir, `${safeBase}.pdf`)

    await workbook.xlsx.writeFile(xlsxPath)

    // 调用 LibreOffice 将 xlsx 转为 pdf
    const sofficePath = process.env.LIBREOFFICE_PATH || 'soffice'
    try {
      // 为 LibreOffice 单独指定可写的用户配置目录，避免使用默认的 /var/www 等只读目录
      const loUserDir = path.join(tmpDir, 'libreoffice-profile')
      try {
        await fs.promises.mkdir(loUserDir, { recursive: true })
      } catch {}

      // LibreOffice 要求 file:// 前缀的 URL 形式
      const loUserDirUrl = `file://${loUserDir.replace(/\\/g, '/')}`

      const env = {
        ...process.env,
        // 确保 HOME 指向一个当前进程可写的目录，避免 dconf 等组件初始化失败
        HOME: loUserDir
      }

      await execFileAsync(
        sofficePath,
        [
          '--headless',
          `-env:UserInstallation=${loUserDirUrl}`,
          '--convert-to',
          'pdf',
          '--outdir',
          tmpDir,
          xlsxPath
        ],
        { env }
      )
    } catch (err) {
      console.error('调用 LibreOffice 失败:', err)
      try {
        await fs.promises.unlink(xlsxPath)
      } catch {}
      return res.status(500).json({
        code: 500,
        success: false,
        message: '服务器未安装 LibreOffice 或转换 PDF 失败'
      })
    }

    // 读取生成的 PDF
    let pdfBuffer
    try {
      pdfBuffer = await fs.promises.readFile(pdfPath)
    } catch (err) {
      console.error('读取生成的 PDF 文件失败:', err)
      try {
        await fs.promises.unlink(xlsxPath)
      } catch {}
      return res.status(500).json({
        code: 500,
        success: false,
        message: '生成 PDF 文件失败'
      })
    }

    // 清理临时文件
    try {
      await fs.promises.unlink(xlsxPath)
    } catch {}
    try {
      await fs.promises.unlink(pdfPath)
    } catch {}

    const filenameBase = row.quotationNo || '报价单'
    const encodedFilename = encodeURIComponent(`${filenameBase}报价.pdf`)

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFilename}`)

    return res.send(pdfBuffer)
  } catch (error) {
    console.error('导出报价单 PDF 失败:', error)
    return res.status(500).json({
      code: 500,
      success: false,
      message: '导出报价单 PDF 失败',
      error: error.message
    })
  }
})

// 下载当前报价单对应的 完工单 PDF 文件（先填充 Excel 模板，再通过 LibreOffice 转为 PDF）
router.get('/:id/export-completion-pdf', async (req, res) => {
  try {
    const { id } = req.params

    // 查询报价单详情
    const rows = await query(
      `
        SELECT 
          报价单ID as id,
          报价单号 as quotationNo,
          报价日期 as quotationDate,
          客户名称 as customerName,
          加工日期 as processingDate,
          更改通知单号 as changeOrderNo,
          加工零件名称 as partName,
          模具编号 as moldNo,
          申请更改部门 as department,
          申请更改人 as applicant,
          材料明细 as materialsJson,
          加工费用明细 as processesJson,
          其他费用 as otherFee,
          运输费用 as transportFee,
          加工数量 as quantity,
          含税价格 as taxIncludedPrice
        FROM 报价单
        WHERE 报价单ID = @id
      `,
      { id: parseInt(id, 10) }
    )

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        code: 404,
        success: false,
        message: '报价单不存在'
      })
    }

    const row = rows[0]

    // 校验完工单必填字段：加工日期、加工零件名称、模具编号、申请更改部门、申请更改人
    const requiredFields = [
      { key: 'processingDate', label: '加工日期' },
      { key: 'partName', label: '加工零件名称' },
      { key: 'moldNo', label: '模具编号' },
      { key: 'department', label: '申请更改部门' },
      { key: 'applicant', label: '申请更改人' }
    ]

    const missing = requiredFields.filter((field) => {
      const value = row[field.key]
      if (value === null || value === undefined) return true
      if (value instanceof Date) return false
      return String(value).trim() === ''
    })

    if (missing.length > 0) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: `完工单下载前请先填写：${missing.map((f) => f.label).join('、')}`
      })
    }

    // 解析 JSON 字段
    let materials = []
    let processes = []
    try {
      materials = JSON.parse(row.materialsJson || '[]')
    } catch (e) {
      console.error('解析材料明细JSON失败:', e)
      materials = []
    }
    try {
      processes = JSON.parse(row.processesJson || '[]')
    } catch (e) {
      console.error('解析加工费用明细JSON失败:', e)
      processes = []
    }

    // 计算金额（与创建/更新时保持一致）
    const materialsTotal = (materials || []).reduce(
      (sum, item) => sum + (Number(item.unitPrice) || 0) * (Number(item.quantity) || 0),
      0
    )
    const processingTotal = (processes || []).reduce(
      (sum, item) => sum + (Number(item.unitPrice) || 0) * (Number(item.hours) || 0),
      0
    )
    const otherFee = Number(row.otherFee || 0)
    const transportFee = Number(row.transportFee || 0)
    const quantity = Number(row.quantity || 0) || 1

    const taxIncludedPrice =
      row.taxIncludedPrice !== undefined && row.taxIncludedPrice !== null
        ? Number(row.taxIncludedPrice)
        : materialsTotal + otherFee + transportFee + processingTotal

    // 读取 Excel 模板（美菱改模完工确认单）
    const templatePath = path.join(
      __dirname,
      '..',
      'templates',
      'quotation',
      '美菱改模完工确认单.xlsx'
    )

    const workbook = new ExcelJS.Workbook()
    try {
      await workbook.xlsx.readFile(templatePath)
    } catch (err) {
      console.error('读取完工单模板失败:', err)
      return res.status(500).json({
        code: 500,
        success: false,
        message: '读取完工单模板失败'
      })
    }

    const sheet = workbook.worksheets[0]

    const setCell = (addr, value) => {
      const cell = sheet.getCell(addr)
      if (value === null || value === undefined || value === '') {
        cell.value = ''
      } else if (value instanceof Date || typeof value === 'number') {
        cell.value = value
      } else {
        cell.value = String(value)
      }
    }
    const parseDate = (val) => {
      if (!val) return null
      if (val instanceof Date) return val
      const d = new Date(val)
      if (Number.isNaN(d.getTime())) {
        return null
      }
      return d
    }

    // 一、表头字段（与报价单模板的单元格布局相同）
    setCell('C3', parseDate(row.processingDate)) // 加工日期
    setCell('G3', row.changeOrderNo || '') // 更改通知单号
    setCell('C4', row.partName || '') // 加工零件名称
    setCell('G4', row.moldNo || '') // 模具编号
    setCell('C5', row.department || '') // 申请更改部门
    setCell('G5', row.applicant || '') // 申请更改人

    // 二、单位材料费
    const materialRows = [8, 9]
    materialRows.forEach((rowIndex, i) => {
      const item = materials[i] || {}
      const unitPrice = Number(item.unitPrice) || 0
      const qty = Number(item.quantity) || 0
      const fee = unitPrice * qty
      setCell(`C${rowIndex}`, item.name || '')
      setCell(`E${rowIndex}`, unitPrice)
      setCell(`F${rowIndex}`, qty)
      setCell(`G${rowIndex}`, fee)
    })

    // 单位材料费总价：I8
    setCell('I8', materialsTotal)

    // 三、加工费用
    const processStartRow = 14
    processes.forEach((item, index) => {
      const rowIndex = processStartRow + index
      const hours = Number(item.hours) || 0
      const unitPrice = Number(item.unitPrice) || 0
      const fee = unitPrice * hours
      setCell(`F${rowIndex}`, hours)
      setCell(`G${rowIndex}`, fee)
    })

    // 加工费总价：I14
    setCell('I14', processingTotal)

    // 四、其他费用 + 运输费用 + 数量 + 含税价格
    setCell('G24', otherFee)
    setCell('G25', transportFee)
    setCell('C26', quantity)
    // 含税价格（程序计算后直接写入 H26，便于模板引用）
    setCell('H26', taxIncludedPrice)

    // 将填充后的工作簿写入临时 xlsx 文件
    const tmpDir = os.tmpdir()
    const safeBase = `quotation-completion-${row.id || id}-${Date.now()}`
    const xlsxPath = path.join(tmpDir, `${safeBase}.xlsx`)
    const pdfPath = path.join(tmpDir, `${safeBase}.pdf`)

    await workbook.xlsx.writeFile(xlsxPath)

    const sofficePath = process.env.LIBREOFFICE_PATH || 'soffice'
    try {
      const loUserDir = path.join(tmpDir, 'libreoffice-profile')
      try {
        await fs.promises.mkdir(loUserDir, { recursive: true })
      } catch {}

      const loUserDirUrl = `file://${loUserDir.replace(/\\/g, '/')}`

      const env = {
        ...process.env,
        HOME: loUserDir
      }

      await execFileAsync(
        sofficePath,
        [
          '--headless',
          `-env:UserInstallation=${loUserDirUrl}`,
          '--convert-to',
          'pdf',
          '--outdir',
          tmpDir,
          xlsxPath
        ],
        { env }
      )
    } catch (err) {
      console.error('调用 LibreOffice 失败（完工单）:', err)
      try {
        await fs.promises.unlink(xlsxPath)
      } catch {}
      return res.status(500).json({
        code: 500,
        success: false,
        message: '服务器未安装 LibreOffice 或转换完工单 PDF 失败'
      })
    }

    let pdfBuffer
    try {
      pdfBuffer = await fs.promises.readFile(pdfPath)
    } catch (err) {
      console.error('读取生成的完工单 PDF 文件失败:', err)
      try {
        await fs.promises.unlink(xlsxPath)
      } catch {}
      return res.status(500).json({
        code: 500,
        success: false,
        message: '生成完工单 PDF 文件失败'
      })
    }

    try {
      await fs.promises.unlink(xlsxPath)
    } catch {}
    try {
      await fs.promises.unlink(pdfPath)
    } catch {}

    const filenameBase = row.quotationNo || '报价单'
    const encodedFilename = encodeURIComponent(`${filenameBase}完工单.pdf`)

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFilename}`)

    return res.send(pdfBuffer)
  } catch (error) {
    console.error('导出完工单 PDF 失败:', error)
    return res.status(500).json({
      code: 500,
      success: false,
      message: '导出完工单 PDF 失败',
      error: error.message
    })
  }
})

module.exports = router
