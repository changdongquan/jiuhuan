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

let quotationOperatorColumnEnsured = false
const ensureQuotationOperatorColumn = async () => {
  if (quotationOperatorColumnEnsured) return

  const rows = await query(`SELECT COL_LENGTH(N'报价单', N'经办人') as len`)
  const exists = rows?.[0]?.len !== null && rows?.[0]?.len !== undefined

  if (!exists) {
    await query(`ALTER TABLE 报价单 ADD 经办人 NVARCHAR(50) NULL`)
  }

  quotationOperatorColumnEnsured = true
}

const toDateString = (value) => {
  if (!value) return ''
  try {
    const pad2 = (n) => String(n).padStart(2, '0')
    if (value instanceof Date && Number.isFinite(value.getTime())) {
      return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`
    }
    if (typeof value === 'string') {
      const s = value.trim()
      if (!s) return ''
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
      if (/^\d{4}\/\d{1,2}\/\d{1,2}/.test(s)) {
        const [y, m, d] = s.split(/[\/\s]/).filter(Boolean)
        return `${y}-${pad2(m)}-${pad2(d)}`
      }
      const d = new Date(s)
      if (!Number.isNaN(d.getTime()))
        return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
      return String(value).split('T')[0]
    }
    const d = new Date(value)
    if (!Number.isNaN(d.getTime()))
      return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
    return String(value).split('T')[0]
  } catch {
    return ''
  }
}

const buildPartQuotationWorkbook = ({ row, partItems, enableImage }) => {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'CraftSys'
  workbook.created = new Date()

  const colorTextMuted = { argb: 'FF606266' }
  const colorHeaderBg = { argb: 'FFF3F4F6' }
  const colorStripeBg = { argb: 'FFFAFAFB' }
  const colorTotalBg = { argb: 'FFE8F5E9' }
  const borderThin = { style: 'thin', color: { argb: 'FF000000' } }

  const sheet = workbook.addWorksheet('零件报价单', {
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      verticalCentered: false,
      margins: { left: 0.35, right: 0.35, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 }
    }
  })

  const isEnabled = enableImage !== undefined ? !!enableImage : Number(row?.enableImage ?? 1) !== 0

  const pxToExcelWidth = (px) => {
    const n = Number(px)
    if (!Number.isFinite(n) || n <= 0) return 10
    return Math.max(4, Math.round(((n - 5) / 7) * 100) / 100)
  }

  const setBorderAll = (cell) => {
    cell.border = { top: borderThin, left: borderThin, bottom: borderThin, right: borderThin }
  }

  const fillSolid = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } })

  // Column widths（近似像素 -> Excel 宽度），打印会按 fitToWidth 缩放
  const cols = isEnabled
    ? [
        { header: '序号', key: 'seq', width: pxToExcelWidth(60) },
        { header: '产品名称', key: 'name', width: pxToExcelWidth(140) },
        { header: '产品图号', key: 'drawing', width: pxToExcelWidth(120) },
        { header: '材质', key: 'material', width: pxToExcelWidth(100) },
        { header: '加工内容', key: 'process', width: pxToExcelWidth(100) },
        { header: '图示', key: 'image', width: pxToExcelWidth(140) },
        { header: '数量', key: 'qty', width: pxToExcelWidth(90) },
        { header: '单价(元)', key: 'unitPrice', width: pxToExcelWidth(100) },
        { header: '金额(元)', key: 'amount', width: pxToExcelWidth(105) }
      ]
    : [
        { header: '序号', key: 'seq', width: pxToExcelWidth(60) },
        { header: '产品名称', key: 'name', width: pxToExcelWidth(160) },
        { header: '产品图号', key: 'drawing', width: pxToExcelWidth(130) },
        { header: '材质', key: 'material', width: pxToExcelWidth(110) },
        { header: '加工内容', key: 'process', width: pxToExcelWidth(110) },
        { header: '数量', key: 'qty', width: pxToExcelWidth(90) },
        { header: '单价(元)', key: 'unitPrice', width: pxToExcelWidth(100) },
        { header: '金额(元)', key: 'amount', width: pxToExcelWidth(105) }
      ]
  sheet.columns = cols

  const colCount = cols.length
  const colLetter = (idx) => String.fromCharCode('A'.charCodeAt(0) + idx - 1)
  const lastCol = colLetter(colCount)

  // A 列宽度由表格列定义自动设置（序号列宽度）

  // ===== Title =====
  sheet.mergeCells(`A1:${lastCol}1`)
  sheet.getCell('A1').value = '零件报价单'
  sheet.getCell('A1').font = { bold: true, size: 18 }
  sheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' }
  sheet.getRow(1).height = 28

  // ===== Meta (manufacturing standard) =====
  // 增加标题与客户名称之间的垂直间距：插入一行空行
  const gapRow = 2
  sheet.getRow(gapRow).height = 14

  // 头部信息使用"标签 + 值"布局：
  // - 冒号对齐（标签右对齐）
  // - 下划线缩短（仅值区域带下划线）
  // - 联系人/联系电话整体下移一行
  const metaRow1 = 3
  const metaRow2 = 4
  const metaRow3 = 5
  const metaLabelFont = { size: 11, color: colorTextMuted }
  const metaValueFont = { size: 11 }
  const metaValueMutedFont = { size: 11, color: colorTextMuted }

  // 左侧字段从 A 列开始，与表格第一列对齐
  const leftStartCol = 1 // A
  const leftEndCol = Math.min(4, colCount) // D（客户名称、报价单号、报价日期共用 A-D 列）

  // 右侧字段：横线最右侧对齐表格最右侧
  // 表格最右侧列是 colCount（lastCol）
  // 标签列放在倒数第3列，值区域从倒数第2列开始，延伸到最右侧列
  const rightValueEndCol = colCount // 值区域结束列 = 表格最右侧列
  const rightLabelCol = Math.max(5, colCount - 2) // 标签列：至少是 E 列，或倒数第3列
  const rightValueStartCol = Math.min(rightLabelCol + 1, colCount) // 值区域开始列 = 标签列 + 1

  const applyBottomBorderForRange = (rowNo, startCol, endCol) => {
    for (let c = startCol; c <= endCol; c += 1) {
      sheet.getRow(rowNo).getCell(c).border = { bottom: borderThin }
    }
  }

  const setMetaField = ({
    rowNo,
    startCol,
    endCol,
    label,
    value,
    mutedValue,
    underline = true
  }) => {
    // 将标签和值合并为一个字符串，放在同一单元格中
    const fullText = label ? `${label}：${value || ''}` : value || ''
    if (startCol <= endCol) {
      sheet.mergeCells(`${colLetter(startCol)}${rowNo}:${colLetter(endCol)}${rowNo}`)
      const cell = sheet.getCell(`${colLetter(startCol)}${rowNo}`)
      cell.value = fullText
      // 标签部分使用 muted 字体，值部分使用正常字体（通过整体设置，实际显示时会有差异）
      cell.font = mutedValue ? metaValueMutedFont : metaValueFont
      cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }
      if (underline) applyBottomBorderForRange(rowNo, startCol, endCol)
    }
  }

  const setMetaFieldRight = ({
    rowNo,
    labelCol,
    valueStartCol,
    valueEndCol,
    label,
    value,
    mutedValue,
    underline = true
  }) => {
    const labelCell = sheet.getRow(rowNo).getCell(labelCol)
    labelCell.value = label ? `${label}：` : ''
    labelCell.font = metaLabelFont
    labelCell.alignment = { horizontal: 'right', vertical: 'middle' }

    if (valueStartCol <= valueEndCol) {
      sheet.mergeCells(`${colLetter(valueStartCol)}${rowNo}:${colLetter(valueEndCol)}${rowNo}`)
      const valueCell = sheet.getCell(`${colLetter(valueStartCol)}${rowNo}`)
      valueCell.value = value
      valueCell.font = mutedValue ? metaValueMutedFont : metaValueFont
      valueCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }
      if (underline) applyBottomBorderForRange(rowNo, valueStartCol, valueEndCol)
    }
  }

  ;[metaRow1, metaRow2, metaRow3].forEach((r) => {
    sheet.getRow(r).height = 18
  })

  // 左侧：客户名称 / 报价单号 / 报价日期（从 A 列开始，与表格对齐）
  setMetaField({
    rowNo: metaRow1,
    startCol: leftStartCol,
    endCol: leftEndCol,
    label: '客户名称',
    value: row.customerName || '',
    mutedValue: false
  })
  setMetaField({
    rowNo: metaRow2,
    startCol: leftStartCol,
    endCol: leftEndCol,
    label: '报价单号',
    value: row.quotationNo || '',
    mutedValue: true
  })
  setMetaField({
    rowNo: metaRow3,
    startCol: leftStartCol,
    endCol: leftEndCol,
    label: '报价日期',
    value: toDateString(row.quotationDate) || '-',
    mutedValue: true
  })

  // 右侧：留空 / 联系人 / 联系电话（下移一行）
  setMetaFieldRight({
    rowNo: metaRow1,
    labelCol: rightLabelCol,
    valueStartCol: rightValueStartCol,
    valueEndCol: rightValueEndCol,
    label: '',
    value: '',
    mutedValue: true,
    underline: false
  })
  setMetaFieldRight({
    rowNo: metaRow2,
    labelCol: rightLabelCol,
    valueStartCol: rightValueStartCol,
    valueEndCol: rightValueEndCol,
    label: '联系人',
    value: row.contactName || '-',
    mutedValue: false
  })
  setMetaFieldRight({
    rowNo: metaRow3,
    labelCol: rightLabelCol,
    valueStartCol: rightValueStartCol,
    valueEndCol: rightValueEndCol,
    label: '联系电话',
    value: row.contactPhone || '-',
    mutedValue: false
  })

  // ===== Table header =====
  const headerRow = 7
  const headerTitles = cols.map((c) => c.header)
  sheet.getRow(headerRow).values = headerTitles
  sheet.getRow(headerRow).height = 24
  sheet.getRow(headerRow).font = { bold: true, size: 11 }
  sheet.getRow(headerRow).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  for (let c = 1; c <= colCount; c += 1) {
    const cell = sheet.getRow(headerRow).getCell(c)
    setBorderAll(cell)
    cell.fill = fillSolid(colorHeaderBg.argb)
  }

  // ===== Detail rows =====
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
      return { width, height, extension: 'png', orientation: 1 }
    }
    if (buffer[0] === 0xff && buffer[1] === 0xd8) {
      let offset = 2
      let orientation = 1
      while (offset + 9 < buffer.length) {
        if (buffer[offset] !== 0xff) break
        const marker = buffer[offset + 1]
        if (marker === 0xda) break // Start Of Scan
        const size = buffer.readUInt16BE(offset + 2)
        if (marker === 0xe1) {
          try {
            const exifStart = offset + 4
            const exifEnd = exifStart + Math.max(0, size - 2)
            if (exifEnd <= buffer.length) {
              const signature = buffer.toString('ascii', exifStart, exifStart + 6)
              if (signature === 'Exif\0\0') {
                const tiffStart = exifStart + 6
                const endian = buffer.toString('ascii', tiffStart, tiffStart + 2)
                const littleEndian = endian === 'II'
                const readU16 = littleEndian
                  ? (pos) => buffer.readUInt16LE(pos)
                  : (pos) => buffer.readUInt16BE(pos)
                const readU32 = littleEndian
                  ? (pos) => buffer.readUInt32LE(pos)
                  : (pos) => buffer.readUInt32BE(pos)
                const magic = readU16(tiffStart + 2)
                if (magic === 0x002a) {
                  const ifd0Offset = readU32(tiffStart + 4)
                  const ifd0 = tiffStart + ifd0Offset
                  if (ifd0 + 2 <= exifEnd) {
                    const count = readU16(ifd0)
                    for (let i = 0; i < count; i += 1) {
                      const entry = ifd0 + 2 + i * 12
                      if (entry + 12 > exifEnd) break
                      const tag = readU16(entry)
                      if (tag !== 0x0112) continue
                      const type = readU16(entry + 2)
                      const valueCount = readU32(entry + 4)
                      if (type === 3 && valueCount === 1) {
                        orientation = readU16(entry + 8)
                      } else {
                        const valueOffset = readU32(entry + 8)
                        const valuePos = tiffStart + valueOffset
                        if (valuePos + 2 <= exifEnd) orientation = readU16(valuePos)
                      }
                      break
                    }
                  }
                }
              }
            }
          } catch {}
        }
        if (marker === 0xc0 || marker === 0xc2) {
          const height = buffer.readUInt16BE(offset + 5)
          const width = buffer.readUInt16BE(offset + 7)
          return { width, height, extension: 'jpeg', orientation }
        }
        offset += 2 + size
      }
    }
    // WebP (only for dimension probing; ExcelJS image embed may still require conversion)
    if (
      buffer.length >= 30 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP'
    ) {
      const chunk = buffer.toString('ascii', 12, 16)
      if (chunk === 'VP8X' && buffer.length >= 30) {
        const width = 1 + (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16))
        const height = 1 + (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16))
        return { width, height, extension: 'webp', orientation: 1 }
      }
    }
    return null
  }

  const imageColIndex = isEnabled ? 6 : -1
  const qtyColIndex = isEnabled ? 7 : 6
  const unitPriceColIndex = isEnabled ? 8 : 7
  const amountColIndex = isEnabled ? 9 : 8

  const firstDetailRow = headerRow + 1
  // 启用图示：提高行高，避免 PDF 转换后图示过小
  const detailRowHeight = isEnabled ? 60 : 22

  partItems.forEach((item, idx) => {
    const r = firstDetailRow + idx
    const rowObj = sheet.getRow(r)
    rowObj.height = detailRowHeight
    rowObj.font = { size: 11 }
    rowObj.alignment = { vertical: 'middle', wrapText: true }

    const qty = Number(item?.quantity)
    const unitPrice = Number(item?.unitPrice)
    const safeQty = Number.isFinite(qty) ? qty : null
    const safeUnitPrice = Number.isFinite(unitPrice) ? unitPrice : null
    const amount =
      safeQty !== null && safeUnitPrice !== null ? Number(safeQty) * Number(safeUnitPrice) : null

    const base = [
      idx + 1,
      item?.partName || '',
      item?.drawingNo || '',
      item?.material || '',
      item?.process || ''
    ]
    const values = isEnabled
      ? [...base, '', safeQty ?? '', safeUnitPrice ?? '', amount ?? '']
      : [...base, safeQty ?? '', safeUnitPrice ?? '', amount ?? '']
    rowObj.values = values

    // Alignments
    rowObj.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
    rowObj.getCell(qtyColIndex).alignment = { horizontal: 'center', vertical: 'middle' } // 数量列居中
    rowObj.getCell(unitPriceColIndex).alignment = { horizontal: 'right', vertical: 'middle' }
    rowObj.getCell(amountColIndex).alignment = { horizontal: 'right', vertical: 'middle' }
    rowObj.getCell(qtyColIndex).numFmt = '#,##0'
    rowObj.getCell(unitPriceColIndex).numFmt = '#,##0.00'
    rowObj.getCell(amountColIndex).numFmt = '#,##0.00'

    for (let c = 1; c <= colCount; c += 1) {
      const cell = rowObj.getCell(c)
      setBorderAll(cell)
      if (idx % 2 === 1) cell.fill = fillSolid(colorStripeBg.argb)
    }

    // Image embed (LibreOffice-friendly twoCell anchor)
    if (isEnabled) {
      const imageUrl = String(item?.imageUrl || '').trim()
      if (imageUrl) {
        const imagePath = resolveAnyQuotationImagePath(imageUrl)
        if (imagePath && fs.existsSync(imagePath)) {
          try {
            const buffer = fs.readFileSync(imagePath)
            const info = getImageDimensions(buffer)
            if (info?.width && info?.height) {
              if (info.extension === 'webp') return
              const imageId = workbook.addImage({ buffer, extension: info.extension })
              const cellPxW = excelColumnWidthToPixels(sheet.getColumn(imageColIndex).width)
              const cellPxH = excelRowHeightPointsToPixels(rowObj.height)
              const scalePref = Number(item?.imageScale)
              const userScale =
                Number.isFinite(scalePref) && scalePref > 0
                  ? Math.max(0.25, Math.min(scalePref, 2))
                  : 1
              // 允许图片按单元格宽高分别自适应（contain），避免被 min(w,h) 过度限制导致“图示很小”
              const maxW = Math.max(1, Math.floor(cellPxW * userScale))
              const maxH = Math.max(1, Math.floor(cellPxH * userScale))
              const rotated =
                info.orientation === 5 ||
                info.orientation === 6 ||
                info.orientation === 7 ||
                info.orientation === 8
              const displayW = rotated ? info.height : info.width
              const displayH = rotated ? info.width : info.height
              // 允许放大到单元格大小（之前 cap=1 会导致“小图永远很小”）
              const fitScale = Math.min(maxW / displayW, maxH / displayH)
              const imgW = Math.max(1, Math.round(displayW * fitScale))
              const imgH = Math.max(1, Math.round(displayH * fitScale))
              const offsetX = (cellPxW - imgW) / 2
              const offsetY = (cellPxH - imgH) / 2
              const tlCol = imageColIndex - 1 + offsetX / cellPxW
              const tlRow = r - 1 + offsetY / cellPxH
              sheet.addImage(imageId, {
                tl: { col: tlCol, row: tlRow },
                ext: { width: imgW, height: imgH },
                editAs: 'oneCell'
              })
            }
          } catch (e) {
            console.error('插入图示失败:', e)
          }
        }
      }
    }
  })

  // ===== Total row =====
  const totalRow = firstDetailRow + partItems.length
  const totalAmount = partItems.reduce(
    (sum, item) => sum + (Number(item?.unitPrice) || 0) * (Number(item?.quantity) || 0),
    0
  )
  sheet.mergeCells(`A${totalRow}:${colLetter(colCount - 1)}${totalRow}`)
  sheet.getCell(`A${totalRow}`).value = '合计'
  sheet.getCell(`A${totalRow}`).alignment = { horizontal: 'center', vertical: 'middle' }
  sheet.getCell(`${lastCol}${totalRow}`).value = totalAmount || ''
  sheet.getCell(`${lastCol}${totalRow}`).numFmt = '#,##0.00'
  sheet.getCell(`${lastCol}${totalRow}`).alignment = { horizontal: 'right', vertical: 'middle' }
  sheet.getRow(totalRow).height = 24
  sheet.getRow(totalRow).font = { bold: true, size: 11 }
  for (let c = 1; c <= colCount; c += 1) {
    const cell = sheet.getRow(totalRow).getCell(c)
    setBorderAll(cell)
    cell.fill = fillSolid(colorHeaderBg.argb)
  }

  // ===== Summary box (right-bottom, 2 cols label + 1 col value) =====
  const sumBoxStartRow = totalRow + 2
  const sumLabelStartCol = Math.max(1, colCount - 2)
  const sumLabelEndCol = Math.max(1, colCount - 1)
  const sumValueCol = colCount

  const putSummaryRow = (r, label, value, isTotal = false) => {
    sheet.mergeCells(`${colLetter(sumLabelStartCol)}${r}:${colLetter(sumLabelEndCol)}${r}`)
    const labelCell = sheet.getCell(`${colLetter(sumLabelStartCol)}${r}`)
    labelCell.value = label
    labelCell.font = { size: 11, color: colorTextMuted }
    labelCell.alignment = { horizontal: 'center', vertical: 'middle' }
    labelCell.fill = fillSolid(colorHeaderBg.argb)

    const valueCell = sheet.getCell(`${colLetter(sumValueCol)}${r}`)
    valueCell.value =
      value === null || value === undefined || Number(value) === 0 ? '' : Number(value)
    valueCell.numFmt = '#,##0.00'
    valueCell.alignment = { horizontal: 'right', vertical: 'middle' }
    valueCell.font = isTotal ? { bold: true, size: 13 } : { size: 11 }
    if (isTotal) valueCell.fill = fillSolid(colorTotalBg.argb)

    for (let c = sumLabelStartCol; c <= sumValueCol; c += 1)
      setBorderAll(sheet.getRow(r).getCell(c))
    sheet.getRow(r).height = isTotal ? 24 : 20
  }

  const otherFee = Number(row.otherFee || 0)
  const transportFee = Number(row.transportFee || 0)
  const computedTaxIncludedPrice =
    row.taxIncludedPrice !== undefined && row.taxIncludedPrice !== null
      ? Number(row.taxIncludedPrice) || 0
      : totalAmount + otherFee + transportFee

  const summaryLines = []
  if (otherFee) summaryLines.push({ label: '其它费用', value: otherFee })
  if (transportFee) summaryLines.push({ label: '运输费用', value: transportFee })
  summaryLines.push({ label: '含税价格', value: computedTaxIncludedPrice, isTotal: true })

  summaryLines.forEach((line, idx) =>
    putSummaryRow(sumBoxStartRow + idx, line.label, line.value, !!line.isTotal)
  )

  // ===== Remark =====
  const remarkTitleRow = sumBoxStartRow + summaryLines.length + 1
  const remarkBodyRow = remarkTitleRow + 1
  sheet.mergeCells(`A${remarkTitleRow}:${lastCol}${remarkTitleRow}`)
  sheet.getCell(`A${remarkTitleRow}`).value = '备注'
  sheet.getCell(`A${remarkTitleRow}`).font = { bold: true, size: 11 }
  sheet.getCell(`A${remarkTitleRow}`).alignment = { horizontal: 'left', vertical: 'middle' }
  for (let c = 1; c <= colCount; c += 1) {
    const cell = sheet.getRow(remarkTitleRow).getCell(c)
    setBorderAll(cell)
    cell.fill = fillSolid(colorHeaderBg.argb)
  }
  sheet.mergeCells(`A${remarkBodyRow}:${lastCol}${remarkBodyRow}`)

  // 构建备注内容：固定条款 + 用户自定义备注
  const deliveryTerms = String(row.deliveryTerms || '').trim() || '-'
  const paymentTerms = String(row.paymentTerms || '').trim() || '-'
  const validityDays = row.validityDays ? `${row.validityDays}天` : '15天'

  const fixedTerms = [
    '', // 第一条上方增加一行空行
    '1. 以上报价为含税价（默认13%增值税专票），如税率/开票类型不同请提前说明。',
    '2. 交期以双方确认图纸/样件及实际排产为准。',
    '3. 若有特殊检测、包装、表面处理或材质要求，请在下单前明确。',
    '4. 本报价单仅用于报价确认，不作为合同文本；如需合同请另行签署。',
    `5. 交货方式：${deliveryTerms}`,
    `6. 付款方式：${paymentTerms}`,
    `7. 报价有效期：${validityDays}`
  ]

  const customRemark = String(row.remark || '').trim()
  const remarkLines = [...fixedTerms]
  if (customRemark) {
    remarkLines.push('') // 空行分隔
    remarkLines.push(customRemark)
  }

  const remarkText = remarkLines.join('\n')
  sheet.getCell(`A${remarkBodyRow}`).value = remarkText
  sheet.getCell(`A${remarkBodyRow}`).font = { size: 11 }
  sheet.getCell(`A${remarkBodyRow}`).alignment = {
    horizontal: 'left',
    vertical: 'top',
    wrapText: true
  }

  // 计算行高：固定条款7行 + 顶部空行1行 + 空行（如果有自定义备注）+ 自定义备注行数
  const fixedTermsLines = 8 // 7条固定条款 + 1行顶部空行
  const customRemarkLines = customRemark ? Math.max(1, Math.ceil(customRemark.length / 60)) : 0
  const totalLines = fixedTermsLines + (customRemark ? 1 : 0) + customRemarkLines
  sheet.getRow(remarkBodyRow).height = Math.max(48, Math.min(200, totalLines * 18))

  for (let c = 1; c <= colCount; c += 1) setBorderAll(sheet.getRow(remarkBodyRow).getCell(c))

  // ===== Company Info & Signature =====
  // 在备注框和公司信息之间添加空行，保持适当距离
  const gapRows = 2 // 添加2行空行作为间距
  const footerStartRow = remarkBodyRow + gapRows + 1
  const footerRowHeight = 18
  const companyInfoRowHeight = 14 // 公司信息行高（减小行间距）

  // 左侧：公司信息（4行）
  // 公司信息从 A 列开始，延伸到大部分列，留出右侧空间给签名区域
  // 签名区域放在右侧一行内：经办人 + 客户确认
  // 每个签名占用 2 列（标签列 + 值列），从表格最右侧往左占用 4 列
  const operatorLabelCol = Math.max(2, colCount - 3)
  const operatorValueCol = Math.min(colCount, operatorLabelCol + 1)
  const confirmLabelCol = Math.max(3, colCount - 1)
  const confirmValueCol = colCount

  // 公司信息结束列应该在签名区域之前，留出1列作为分隔
  const companyInfoEndCol = Math.max(1, operatorLabelCol - 1) // 公司信息结束列

  const companyInfo = [
    '合肥市久环模具设备制造有限公司',
    '合肥市阜阳北路 966 号',
    '电话:0551-65661406',
    '邮箱:mail@jh-mold.com'
  ]

  companyInfo.forEach((line, idx) => {
    const row = footerStartRow + idx
    sheet.mergeCells(`A${row}:${colLetter(companyInfoEndCol)}${row}`)
    const cell = sheet.getCell(`A${row}`)
    cell.value = line
    cell.font = { size: 11 }
    cell.alignment = { horizontal: 'left', vertical: 'middle' }
    sheet.getRow(row).height = companyInfoRowHeight // 使用较小的行高
  })

  // 右侧：签名区域
  // - 客户确认：保持在公司信息第一行
  // - 经办人：移动到邮箱下一行
  const confirmRowNo = footerStartRow
  const operatorRowNo = footerStartRow + companyInfo.length

  // 经办人（邮箱下方，左侧与邮箱左对齐）
  const operatorLabelCell = sheet.getRow(operatorRowNo).getCell(1) // A
  operatorLabelCell.value = '经办人：'
  operatorLabelCell.font = { size: 11, color: colorTextMuted }
  operatorLabelCell.alignment = { horizontal: 'left', vertical: 'middle' }

  const operatorValueStartCol = 2 // B
  // 下划线缩短：只占用 2 列宽（例如 B-C）
  const operatorValueEndCol = Math.max(
    operatorValueStartCol,
    Math.min(operatorValueStartCol + 1, leftEndCol, companyInfoEndCol)
  )
  if (operatorValueStartCol <= operatorValueEndCol) {
    sheet.mergeCells(
      `${colLetter(operatorValueStartCol)}${operatorRowNo}:${colLetter(operatorValueEndCol)}${operatorRowNo}`
    )
    const operatorValueCell = sheet.getCell(`${colLetter(operatorValueStartCol)}${operatorRowNo}`)
    operatorValueCell.value = row.operator || ''
    operatorValueCell.font = { size: 11 }
    operatorValueCell.alignment = { horizontal: 'left', vertical: 'middle' }
    applyBottomBorderForRange(operatorRowNo, operatorValueStartCol, operatorValueEndCol)
  }

  // 客户确认（保持原位置：公司信息第一行）
  const confirmLabelCell = sheet.getRow(confirmRowNo).getCell(confirmLabelCol)
  confirmLabelCell.value = '客户确认：'
  confirmLabelCell.font = { size: 11, color: colorTextMuted }
  confirmLabelCell.alignment = { horizontal: 'right', vertical: 'middle' }

  const confirmValueCell = sheet.getRow(confirmRowNo).getCell(confirmValueCol)
  confirmValueCell.value = ''
  confirmValueCell.font = { size: 11 }
  confirmValueCell.alignment = { horizontal: 'left', vertical: 'middle' }
  applyBottomBorderForRange(confirmRowNo, confirmValueCol, confirmValueCol)

  if (!sheet.getRow(operatorRowNo).height) sheet.getRow(operatorRowNo).height = footerRowHeight
  if (!sheet.getRow(confirmRowNo).height) sheet.getRow(confirmRowNo).height = footerRowHeight

  // 确保所有行都有相同高度
  const footerEndRow = Math.max(footerStartRow + companyInfo.length - 1, operatorRowNo)
  for (let row = footerStartRow; row <= footerEndRow; row += 1) {
    if (!sheet.getRow(row).height) sheet.getRow(row).height = footerRowHeight
  }

  // ===== 插入印章图片 =====
  const sealImagePath = path.join(__dirname, '../templates/quotation/报价专用章.png')
  console.log('印章图片路径:', sealImagePath)
  console.log('文件是否存在:', fs.existsSync(sealImagePath))
  if (fs.existsSync(sealImagePath)) {
    try {
      const sealBuffer = fs.readFileSync(sealImagePath)
      const sealInfo = getImageDimensions(sealBuffer)
      console.log('印章图片信息:', sealInfo)
      if (sealInfo?.width && sealInfo?.height) {
        const sealImageId = workbook.addImage({ buffer: sealBuffer, extension: 'png' })

        // 4x4 厘米 = 151x151 像素（1 厘米 ≈ 37.8 像素）
        const sealSizePx = 151 // 4 厘米对应的像素数

        // 计算印章位置：覆盖在公司信息上方
        // 公司信息从 A 列开始，到 companyInfoEndCol 列结束
        // 印章放在公司信息区域的中心位置，覆盖在公司信息上方
        const sealStartCol = 1 // A 列
        const sealEndCol = companyInfoEndCol
        const sealStartRow = footerStartRow

        // 计算公司信息区域的总宽度（像素）
        let totalColWidth = 0
        for (let c = sealStartCol; c <= sealEndCol; c += 1) {
          const colWidth = excelColumnWidthToPixels(sheet.getColumn(c).width || 64)
          totalColWidth += colWidth
        }

        // 计算公司信息区域的总高度（像素）
        const sealRowHeight = companyInfoRowHeight * 4 // 4 行的高度

        // 计算偏移量，使图片在区域中心，然后向左移动 130px（300px - 100px - 100px + 30px = 130px）
        const centerOffsetX = (totalColWidth - sealSizePx) / 2
        const offsetX = Math.max(0, centerOffsetX - 130) // 向左移动 130px（相对于中心）
        const offsetY = Math.max(0, (sealRowHeight - sealSizePx) / 2)

        // 计算第一列的宽度，用于计算起始列的小数偏移
        const firstColWidth = excelColumnWidthToPixels(sheet.getColumn(sealStartCol).width || 64)

        // 转换为 Excel 坐标（列和行都是 0-based，可以有小数值）
        // 图片从 A 列开始，加上水平偏移（已减去 300px）
        const tlCol = sealStartCol - 1 + offsetX / firstColWidth
        const tlRow = sealStartRow - 1 + offsetY / sealRowHeight

        console.log('插入印章图片:', {
          sealStartCol,
          sealEndCol,
          sealStartRow,
          tlCol,
          tlRow,
          sealSizePx,
          totalColWidth,
          sealRowHeight,
          offsetX,
          offsetY
        })

        sheet.addImage(sealImageId, {
          tl: { col: tlCol, row: tlRow },
          ext: { width: sealSizePx, height: sealSizePx },
          editAs: 'absolute' // 使用绝对定位，避免被单元格限制
        })
        console.log('印章图片插入成功')
      } else {
        console.error('无法读取印章图片尺寸信息')
      }
    } catch (e) {
      console.error('插入印章图片失败:', e)
      console.error('错误堆栈:', e.stack)
    }
  } else {
    console.error('印章图片文件不存在:', sealImagePath)
  }

  // ===== Print helpers =====
  sheet.views = [{ state: 'frozen', ySplit: headerRow }]
  sheet.pageSetup.printTitlesRow = `${headerRow}:${headerRow}`
  sheet.pageSetup.printArea = `A1:${lastCol}${footerEndRow}`
  sheet.headerFooter.oddFooter = `&L零件报价单&R第 &P 页 / 共 &N 页`

  return workbook
}

const mkLibreOfficeProfileDir = async (tmpDir) => {
  try {
    const prefix = path.join(tmpDir, 'libreoffice-profile-')
    return await fs.promises.mkdtemp(prefix)
  } catch {
    const fallback = path.join(
      tmpDir,
      `libreoffice-profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    )
    try {
      await fs.promises.mkdir(fallback, { recursive: true })
    } catch {}
    return fallback
  }
}

const rmDirRecursive = async (dir) => {
  if (!dir) return
  try {
    await fs.promises.rm(dir, { recursive: true, force: true })
  } catch {}
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
    await ensureQuotationOperatorColumn()
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
	        经办人 as operator,
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
    await ensureQuotationOperatorColumn()
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
      operator,
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
    request.input('operator', sql.NVarChar(50), operator || null)
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
	        联系人, 联系电话, 经办人, 备注, 交货方式, 付款方式, 报价有效期天数,
	        启用图示,
	        材料明细, 加工费用明细, 零件明细,
	        其他费用, 运输费用, 加工数量, 含税价格
	      ) VALUES (
	        @quotationNo, @quotationDate, @customerName, @quotationType,
	        @processingDate, @changeOrderNo,
	        @partName, @moldNo, @department, @applicant,
	        @contactName, @contactPhone, @operator, @remark, @deliveryTerms, @paymentTerms, @validityDays,
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
    await ensureQuotationOperatorColumn()
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
      operator,
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
    request.input('operator', sql.NVarChar(50), operator || null)
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
	        经办人 = @operator,
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
    await ensureQuotationOperatorColumn()
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
	          经办人 as operator,
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
    await ensureQuotationOperatorColumn()
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
	          经办人 as operator,
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
      let loUserDir
      try {
        loUserDir = await mkLibreOfficeProfileDir(tmpDir)

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
      } finally {
        await rmDirRecursive(loUserDir)
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
    let loUserDir
    try {
      // 为 LibreOffice 单独指定可写的用户配置目录；使用独立目录避免并发转换互相影响
      loUserDir = await mkLibreOfficeProfileDir(tmpDir)

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
    } finally {
      await rmDirRecursive(loUserDir)
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
    let loUserDir
    try {
      loUserDir = await mkLibreOfficeProfileDir(tmpDir)

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
    } finally {
      await rmDirRecursive(loUserDir)
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
