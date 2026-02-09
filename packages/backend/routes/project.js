const express = require('express')
const { query } = require('../database')
const router = express.Router()
const path = require('path')
const fs = require('fs')
const os = require('os')
const fsp = fs.promises
const multer = require('multer')
const JSZip = require('jszip')
const ExcelJS = require('exceljs')
const { execFile } = require('child_process')
const { promisify } = require('util')
const { parseMouldTransferPdf, parseMouldTransferFromTokens } = require('../utils/pdf/mouldTransferPdfParser')
const { pdfFirstPageToPngBuffer } = require('../utils/pdf/pdfToImage')
const { ocrMouldTransferPng } = require('../utils/ocr/mouldTransferOcrClient')

const execFileAsync = promisify(execFile)

// 项目管理附件存储配置
// 使用与销售订单相同的路径配置
// 附件存储根目录：建议使用 JIUHUAN_FILES_ROOT（兼容旧变量 SALES_ORDER_FILES_ROOT）
const FILE_ROOT =
  process.env.JIUHUAN_FILES_ROOT ||
  process.env.SALES_ORDER_FILES_ROOT ||
  path.resolve(__dirname, '../uploads')
const MAX_ATTACHMENT_SIZE_BYTES = parseInt(
  process.env.PROJECT_ATTACHMENT_MAX_SIZE || String(200 * 1024 * 1024),
  10
)

const TRIPARTITE_TEMPLATE_PATH = path.join(
  __dirname,
  '..',
  'templates',
  'project-management',
  '三方协议模板.docx'
)

const TRIAL_FORM_TEMPLATE_PATH = path.join(
  __dirname,
  '..',
  'templates',
  'project-management',
  '试模单.xlsx'
)

const SEAL_SAMPLE_TEMPLATE_PATH = path.join(
  __dirname,
  '..',
  'templates',
  'project-management',
  '封样单.xlsx'
)

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
    } catch (e) { /* ignore */ }
    return fallback
  }
}

const rmDirRecursive = async (dir) => {
  if (!dir) return
  try {
    await fs.promises.rm(dir, { recursive: true, force: true })
  } catch (e) { /* ignore */ }
}

// 处理上传文件名中的中文乱码
const normalizeAttachmentFileName = (name) => {
  if (!name) return name
  try {
    return Buffer.from(name, 'latin1').toString('utf8')
  } catch {
    return name
  }
}

const formatDateYYYYMMDD = (val) => {
  if (!val) return ''
  try {
    if (val instanceof Date && Number.isFinite(val.getTime())) {
      const y = val.getFullYear()
      const m = String(val.getMonth() + 1).padStart(2, '0')
      const d = String(val.getDate()).padStart(2, '0')
      return `${y}-${m}-${d}`
    }
    const s = String(val).trim()
    if (!s) return ''
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
    if (s.includes('T')) return s.split('T')[0]
    const d = new Date(s)
    if (!Number.isNaN(d.getTime())) {
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${dd}`
    }
    return s
  } catch {
    return ''
  }
}

const toNumber = (val) => {
  const n = typeof val === 'number' ? val : Number(val)
  return Number.isFinite(n) ? n : null
}

const splitCsv = (val) =>
  String(val || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)

const hasCsvItem = (val, item) => splitCsv(val).includes(item)

const mark = (checked) => (checked ? '■' : '□')

/** 从产品重量列表中取第一个有效数值；若无则回退到单个产品重量 */
const resolveFirstProductWeight = (row) => {
  const listRaw = row?.产品重量列表
  if (listRaw !== null && listRaw !== undefined && String(listRaw).trim() !== '') {
    let list = []
    if (Array.isArray(listRaw)) {
      list = listRaw
    } else if (typeof listRaw === 'string') {
      try {
        const parsed = JSON.parse(listRaw)
        if (Array.isArray(parsed)) list = parsed
      } catch (e) {
        /* ignore */
      }
    }
    const first = list
      .map((v) => (typeof v === 'number' ? v : Number(String(v ?? '').trim())))
      .find((v) => Number.isFinite(v))
    if (first !== undefined) return first
  }
  return toNumber(row?.产品重量)
}

const buildTripartiteAgreementContext = (row) => {
  const runnerType = String(row?.流道类型 || '').trim()
  const gateType = String(row?.浇口类型 || '').trim()

  const productWeight = resolveFirstProductWeight(row)
  const sprueWeight = toNumber(row?.料柄重量)
  const density =
    productWeight && productWeight > 0 && sprueWeight !== null
      ? `${((sprueWeight / productWeight) * 100).toFixed(1)}%`
      : ''

  const runnerQty =
    row?.流道数量 === null || row?.流道数量 === undefined ? '' : String(row.流道数量)

  let corePullMap = {}
  try {
    const raw = row?.抽芯明细
    if (raw) {
      const parsed = JSON.parse(String(raw))
      if (Array.isArray(parsed)) {
        corePullMap = parsed.reduce((acc, item) => {
          if (!item || typeof item !== 'object') return acc
          const key = String(item.方式 || '').trim()
          if (!key) return acc
          acc[key] = item.数量
          return acc
        }, {})
      }
    }
  } catch (e) { /* ignore */ }

  const corePullMarkQty = (methodLabel) => {
    const qty = corePullMap[methodLabel]
    const hasQty = qty !== null && qty !== undefined && String(qty).trim() !== ''
    return { mark: mark(hasQty), qty: hasQty ? String(qty) : '' }
  }

  const pin = corePullMarkQty('斜导柱')
  const slider = corePullMarkQty('斜滑块')
  const cyl = corePullMarkQty('油缸')

  return {
    // 2.1
    mould_no: row?.客户模号 ? String(row.客户模号) : '',
    part_drawing: row?.productDrawing
      ? String(row.productDrawing)
      : row?.产品图号
        ? String(row.产品图号)
        : '',
    part_name: row?.productName
      ? String(row.productName)
      : row?.产品名称
        ? String(row.产品名称)
        : '',
    part_material: row?.产品材质 ? String(row.产品材质) : '',
    cavity_material: row?.前模材质 ? String(row.前模材质) : '',
    core_material: row?.后模材质 ? String(row.后模材质) : '',
    slider_material: row?.滑块材质 ? String(row.滑块材质) : '',
    cavity_count: row?.模具穴数 ? String(row.模具穴数) : '',
    first_sample_date: formatDateYYYYMMDD(row?.首次送样日期),

    // 3.1.1 runner marks + per-row count
    runner_common_mark: mark(runnerType === '冷流道'),
    runner_open_hot_mark: mark(runnerType === '开放式热流道'),
    runner_point_hot_mark: mark(runnerType === '点浇口热流道'),
    runner_pin_hot_mark: mark(runnerType === '针阀式热流道'),
    runner_common_count: runnerType === '冷流道' ? runnerQty : '',
    runner_open_hot_count: runnerType === '开放式热流道' ? runnerQty : '',
    runner_point_hot_count: runnerType === '点浇口热流道' ? runnerQty : '',
    runner_pin_hot_count: runnerType === '针阀式热流道' ? runnerQty : '',
    runner_brand: '',

    // 3.1.1 gate marks + count
    gate_direct_mark: mark(gateType === '直接浇口'),
    gate_point_mark: mark(gateType === '点浇口'),
    gate_side_mark: mark(gateType === '侧浇口'),
    gate_sub_mark: mark(gateType === '潜伏浇口'),
    gate_count: row?.浇口数量 === null || row?.浇口数量 === undefined ? '' : String(row.浇口数量),

    // weights/cycle（产品重量：取产品列表中第一个有效值）
    part_weight_g:
      productWeight === null || productWeight === undefined ? '' : String(productWeight),
    sprue_weight_g:
      row?.料柄重量 === null || row?.料柄重量 === undefined ? '' : String(row.料柄重量),
    density,
    cycle_s: row?.成型周期 === null || row?.成型周期 === undefined ? '' : String(row.成型周期),

    // 3.1.2 core pull / eject / reset
    core_pull_pin_mark: pin.mark,
    core_pull_pin_qty: pin.qty,
    core_pull_slider_mark: slider.mark,
    core_pull_slider_qty: slider.qty,
    core_pull_cyl_mark: cyl.mark,
    core_pull_cyl_qty: cyl.qty,

    eject_round_mark: mark(hasCsvItem(row?.顶出类型, '圆顶')),
    eject_square_mark: mark(hasCsvItem(row?.顶出类型, '方顶')),
    eject_plate_mark: mark(hasCsvItem(row?.顶出类型, '顶片')),
    eject_mech_mark: mark(hasCsvItem(row?.顶出方式, '机械顶出')),
    eject_oil_mark: mark(hasCsvItem(row?.顶出方式, '油缸顶出')),
    reset_spring_mark: mark(hasCsvItem(row?.复位方式, '弹簧复位')),
    reset_nitrogen_mark: mark(hasCsvItem(row?.复位方式, '氮气弹簧复位')),
    reset_forced_mark: mark(hasCsvItem(row?.复位方式, '强制复位')),
    reset_oil_mark: mark(hasCsvItem(row?.复位方式, '油缸复位')),

    // 3.2
    mould_size_mm: row?.模具尺寸 ? String(row.模具尺寸) : '',
    mould_weight_t:
      row?.模具重量 === null || row?.模具重量 === undefined ? '' : String(row.模具重量),
    lock_force_t: row?.锁模力 === null || row?.锁模力 === undefined ? '' : String(row.锁模力),
    locating_ring_mm: row?.定位圈 === null || row?.定位圈 === undefined ? '' : String(row.定位圈),
    mold_capacity_mm: row?.容模量 ? String(row.容模量) : '',
    tiebar_spacing_mm:
      row?.拉杆间距 === null || row?.拉杆间距 === undefined ? '' : String(row.拉杆间距)
  }
}

const loadProjectRowForTripartiteAgreement = async (code) => {
  const queryString = `
      SELECT 
        p.*,
        (SELECT TOP 1 g1.产品名称 
         FROM 货物信息 g1 
         WHERE g1.项目编号 = p.项目编号 
           AND CAST(g1.IsNew AS INT) != 1
         ORDER BY g1.货物ID) as productName,
        (SELECT TOP 1 g1.产品图号 
         FROM 货物信息 g1 
         WHERE g1.项目编号 = p.项目编号 
           AND CAST(g1.IsNew AS INT) != 1
         ORDER BY g1.货物ID) as productDrawing
      FROM 项目管理 p 
      WHERE p.项目编号 = @projectCode
    `
  const result = await query(queryString, { projectCode: code })
  return Array.isArray(result) && result.length ? result[0] : null
}

const loadProjectRowForSealSample = async (code) => {
  const queryString = `
      SELECT p.*,
        (SELECT TOP 1 g1.产品图号 FROM 货物信息 g1
         WHERE g1.项目编号 = p.项目编号 AND CAST(g1.IsNew AS INT) != 1
         ORDER BY g1.货物ID) as fallbackProductDrawing,
        (SELECT TOP 1 g1.产品名称 FROM 货物信息 g1
         WHERE g1.项目编号 = p.项目编号 AND CAST(g1.IsNew AS INT) != 1
         ORDER BY g1.货物ID) as fallbackProductName
      FROM 项目管理 p
      WHERE p.项目编号 = @projectCode
    `
  const result = await query(queryString, { projectCode: code })
  return Array.isArray(result) && result.length ? result[0] : null
}

const parseJsonArray = (val, defaultValue = []) => {
  if (!val) return defaultValue
  if (Array.isArray(val)) return val
  try {
    const p = typeof val === 'string' ? JSON.parse(val) : val
    return Array.isArray(p) ? p : defaultValue
  } catch {
    return defaultValue
  }
}

const buildSealSampleProducts = (row) => {
  const drawings = parseJsonArray(row?.产品列表, []).map((d) => String(d ?? '').trim()).filter(Boolean)
  const names = parseJsonArray(row?.产品名称列表, []).map((n) => String(n ?? '').trim())
  const qtys = parseJsonArray(row?.产品数量列表, []).map((q) => {
    const n = typeof q === 'number' ? q : Number(String(q || '').trim())
    return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 1
  })
  if (drawings.length > 0) {
    const maxLen = drawings.length
    while (names.length < maxLen) names.push('')
    while (qtys.length < maxLen) qtys.push(1)
    return drawings.map((d, i) => ({
      productDrawing: d,
      productName: names[i] || '',
      productQty: qtys[i] ?? 1
    }))
  }
  const fallbackDrawing = String(row?.fallbackProductDrawing || row?.产品图号 || '').trim()
  const fallbackName = String(row?.fallbackProductName || row?.产品名称 || '').trim()
  if (fallbackDrawing || fallbackName) {
    return [{ productDrawing: fallbackDrawing, productName: fallbackName, productQty: 1 }]
  }
  return []
}

const formatDateForSealSample = (date) => {
  if (!date) return ''
  const d = date instanceof Date ? date : new Date(date)
  if (!Number.isFinite(d.getTime())) return ''
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const day = d.getDate()
  return `${y}.${m}.${day}`
}

// 封样单图片位置常量（需结合模板实测微调）
const SEAL_SAMPLE_IMAGE_CONFIG = {
  left: {
    // 检验报告 - 左侧区域 (约 A6)，尺寸在原基础上放大 30%
    tl: { col: 0, row: 5 },
    ext: { width: 832, height: 1248 }  // 640*1.3, 960*1.3
  },
  right: {
    // 零件图纸 - 右侧区域 G6，尺寸在原基础上放大 30%
    tl: { col: 6, row: 5 },  // G6
    ext: { width: 1040, height: 1248 }  // 800*1.3, 960*1.3
  }
}

// 查询封样单用的检验报告 PDF（绑定产品图号，按上传时间取最新）
const querySealSampleInspectionReportPdf = async (projectCode, productDrawing) => {
  if (!projectCode || !productDrawing) return null
  const rows = await query(
    `
    SELECT TOP 1 附件ID as id, 存储文件名 as storedFileName, 相对路径 as relativePath, 原始文件名 as originalName
    FROM 项目管理附件
    WHERE 项目编号 = @projectCode
      AND 附件类型 = N'inspection-report'
      AND 绑定产品图号 = @productDrawing
      AND (原始文件名 LIKE N'%.pdf' OR 内容类型 LIKE N'%pdf%')
    ORDER BY 上传时间 DESC, 附件ID DESC
    `,
    { projectCode, productDrawing }
  )
  return rows.length > 0 ? rows[0] : null
}

// 查询封样单用的零件图纸 PDF（绑定产品图号，按上传时间取最新）
const querySealSamplePartDrawingPdf = async (projectCode, productDrawing) => {
  if (!projectCode || !productDrawing) return null
  const rows = await query(
    `
    SELECT TOP 1 附件ID as id, 存储文件名 as storedFileName, 相对路径 as relativePath, 原始文件名 as originalName
    FROM 项目管理附件
    WHERE 项目编号 = @projectCode
      AND 附件类型 = N'part-drawing'
      AND 绑定产品图号 = @productDrawing
      AND (原始文件名 LIKE N'%.pdf' OR 内容类型 LIKE N'%pdf%')
    ORDER BY 上传时间 DESC, 附件ID DESC
    `,
    { projectCode, productDrawing }
  )
  return rows.length > 0 ? rows[0] : null
}

// 尝试将 PDF 附件转为 PNG buffer（出错时返回 null，不中断流程）
const tryConvertPdfAttachmentToPng = async (attachment) => {
  if (!attachment) return null
  try {
    const fullPath = getFileFullPath(attachment.relativePath, attachment.storedFileName)
    if (!fs.existsSync(fullPath)) {
      console.warn('[封样单] PDF 文件不存在:', fullPath)
      return null
    }
    const pdfBuffer = await fsp.readFile(fullPath)
    const pngBuffer = await pdfFirstPageToPngBuffer(pdfBuffer)
    return pngBuffer
  } catch (e) {
    console.warn('[封样单] PDF 转图失败:', attachment.originalName, e?.message || e)
    return null
  }
}

const normalizeTrialCount = (val) => {
  const raw = String(val || '')
    .trim()
    .replace(/\s+/g, '')
  if (!raw) return null

  let n = null
  if (/^\d+$/.test(raw)) {
    n = parseInt(raw, 10)
  } else if (/^第\d+次$/.test(raw)) {
    n = parseInt(raw.slice(1, -1), 10)
  } else {
    return null
  }

  if (!Number.isInteger(n) || n <= 0) return null
  return `第${n}次`
}

const validateTrialFormRow = (row) => {
  const errors = []
  const add = (label, message) => errors.push(`${label}${message ? `：${message}` : ''}`)
  const isEmpty = (v) => v === null || v === undefined || String(v).trim() === ''

  const productName = row?.productName || row?.产品名称

  if (isEmpty(row?.项目编号)) add('项目编号', '不能为空')
  if (isEmpty(productName)) add('产品名称', '不能为空')
  if (isEmpty(row?.模具穴数)) add('模具穴数', '不能为空')
  if (isEmpty(row?.模具尺寸)) add('模具尺寸', '不能为空')
  if (toNumber(row?.模具重量) === null) add('模具重量', '必须为数值')
  if (toNumber(row?.产品重量) === null) add('产品重量', '必须为数值')
  if (isEmpty(row?.产品材质)) add('产品材质', '不能为空')
  if (isEmpty(row?.产品颜色)) add('产品颜色', '不能为空')

  return errors
}

const generateTripartiteAgreementDocxBuffer = async (row) => {
  const ctx = buildTripartiteAgreementContext(row)
  const tplBuffer = await fsp.readFile(TRIPARTITE_TEMPLATE_PATH)
  const zip = await JSZip.loadAsync(tplBuffer)
  const docXml = await zip.file('word/document.xml').async('string')
  const filled = docXml.replace(/\{\{\s*([a-zA-Z0-9_]{1,80})\s*\}\}/g, (_m, key) => {
    const v = ctx[key]
    return v === null || v === undefined ? '' : String(v)
  })
  zip.file('word/document.xml', filled)
  return await zip.generateAsync({ type: 'nodebuffer' })
}

const validateTripartiteAgreementRow = (row) => {
  const errors = []
  const add = (field, label, message) => {
    errors.push({ field, label, message })
  }
  const isEmpty = (v) => v === null || v === undefined || String(v).trim() === ''

  const productName = row?.productName || row?.产品名称
  const productDrawing = row?.productDrawing || row?.产品图号

  // 2.1 必填
  if (isEmpty(row?.客户模号)) add('mould_no', '客户模号', '不能为空')
  if (isEmpty(productDrawing)) add('part_drawing', '产品图号', '不能为空')
  if (isEmpty(productName)) add('part_name', '产品名称', '不能为空')
  if (isEmpty(row?.产品材质)) add('part_material', '产品材质', '不能为空')
  if (isEmpty(row?.前模材质)) add('cavity_material', '前模材质', '不能为空')
  if (isEmpty(row?.后模材质)) add('core_material', '后模材质', '不能为空')
  if (isEmpty(row?.滑块材质)) add('slider_material', '滑块材质', '不能为空')
  if (isEmpty(row?.模具穴数)) add('cavity_count', '模具穴数', '不能为空')
  if (isEmpty(row?.首次送样日期)) add('first_sample_date', '首次送样日期', '不能为空')

  // 3.1.1 流道/浇口：唯一且数量为正整数
  const runnerType = String(row?.流道类型 || '').trim()
  const runnerTypeAllowed = ['冷流道', '开放式热流道', '点浇口热流道', '针阀式热流道']
  if (!runnerType || !runnerTypeAllowed.includes(runnerType)) {
    add('runner_type', '流道及类型', '必须且只能选择一项')
  }

  const runnerQty = row?.流道数量
  const runnerQtyNum = typeof runnerQty === 'number' ? runnerQty : Number(runnerQty)
  if (!Number.isInteger(runnerQtyNum) || runnerQtyNum <= 0) {
    add('runner_count', '流道数量', '必须为正整数（不能为 0，也不能为小数）')
  }

  const gateType = String(row?.浇口类型 || '').trim()
  const gateTypeAllowed = ['直接浇口', '点浇口', '侧浇口', '潜伏浇口']
  if (!gateType || !gateTypeAllowed.includes(gateType)) {
    add('gate_type', '浇口类型', '必须且只能选择一项')
  }

  const gateQty = row?.浇口数量
  const gateQtyNum = typeof gateQty === 'number' ? gateQty : Number(gateQty)
  if (!Number.isInteger(gateQtyNum) || gateQtyNum <= 0) {
    add('gate_count', '浇口数量', '必须为正整数（不能为 0，也不能为小数）')
  }

  // 3.1.1 产品重量/成型周期 必填数值；料柄重量可空（产品重量取自产品列表中第一个有效值）
  const partWeight = resolveFirstProductWeight(row)
  const partWeightNum = partWeight === null ? NaN : partWeight
  if (!Number.isFinite(partWeightNum)) add('part_weight_g', '产品重量', '产品列表中至少需有一项有效重量')

  const cycle = row?.成型周期
  const cycleNum = typeof cycle === 'number' ? cycle : Number(cycle)
  if (!Number.isFinite(cycleNum)) add('cycle_s', '成型周期', '必须有数值')

  const sprueWeightRaw = row?.料柄重量
  const sprueWeightEmpty =
    sprueWeightRaw === null || sprueWeightRaw === undefined || String(sprueWeightRaw).trim() === ''
  if (sprueWeightEmpty) {
    if (runnerType && runnerType !== '针阀式热流道') {
      add('sprue_weight_g', '料柄重量', '为空时流道类型必须为“针阀式热流道”')
    }
  } else {
    const sprueWeightNum =
      typeof sprueWeightRaw === 'number' ? sprueWeightRaw : Number(sprueWeightRaw)
    if (!Number.isFinite(sprueWeightNum)) add('sprue_weight_g', '料柄重量', '必须为数值或为空')
  }

  // 3.1.2 联动必选：顶出类型/顶出方式/复位方式，要么全空，要么各至少一项
  const ejectTypeSelected = splitCsv(row?.顶出类型).length > 0
  const ejectWaySelected = splitCsv(row?.顶出方式).length > 0
  const resetWaySelected = splitCsv(row?.复位方式).length > 0
  const anySelected = ejectTypeSelected || ejectWaySelected || resetWaySelected
  if (anySelected && !(ejectTypeSelected && ejectWaySelected && resetWaySelected)) {
    add(
      'eject_reset',
      '顶出/复位',
      '顶出类型、顶出方式、复位方式需同时至少选择一项（或三项都不选）'
    )
  }

  // 3.2 必填
  if (isEmpty(row?.模具尺寸)) add('mould_size_mm', '模具尺寸', '不能为空')
  if (isEmpty(row?.模具重量)) add('mould_weight_t', '模具重量', '不能为空')
  if (isEmpty(row?.锁模力)) add('lock_force_t', '锁模力', '不能为空')
  if (isEmpty(row?.定位圈)) add('locating_ring_mm', '定位圈', '不能为空')
  if (isEmpty(row?.容模量)) add('mold_capacity_mm', '容模量', '不能为空')
  if (isEmpty(row?.拉杆间距)) add('tiebar_spacing_mm', '拉杆间距', '不能为空')

  return errors
}

// 根据项目编号获取分类名称
const getCategoryFromProjectCode = (projectCode) => {
  if (!projectCode) return '其他'
  const code = String(projectCode).trim().toUpperCase()
  if (code.startsWith('JH01')) return '塑胶模具'
  if (code.startsWith('JH03')) return '零件加工'
  if (code.startsWith('JH05')) return '修改模具'
  return '其他'
}

// 安全化项目编号，用于路径
const safeProjectCodeForPath = (projectCode) => {
  if (!projectCode) return 'UNKNOWN'
  return String(projectCode)
    .trim()
    .replace(/[/\\?%*:|"<>]/g, '_')
}

// 零件图示存储配置
const PROJECT_PART_IMAGE_TEMP_DIR_ROOT = path.join(FILE_ROOT, '_temp', 'project-images')
const PROJECT_PART_IMAGE_TEMP_URL_PREFIX = '/uploads/_temp/project-images/'
const PROJECT_PART_IMAGE_SUBDIR = '零件图示'
const PROJECT_PART_IMAGE_MAX_SIZE_BYTES = parseInt(
  process.env.PROJECT_PART_IMAGE_MAX_SIZE || String(5 * 1024 * 1024),
  10
)

// 解析临时图片路径
const resolveTempPartImagePath = (imageUrl) => {
  const url = String(imageUrl || '')
  if (!url.startsWith(PROJECT_PART_IMAGE_TEMP_URL_PREFIX)) return null
  const rel = url.slice(PROJECT_PART_IMAGE_TEMP_URL_PREFIX.length)
  const parts = rel
    .split('/')
    .filter(Boolean)
    .map((p) => decodeURIComponent(p))
  if (!parts.length) return null
  const resolved = path.resolve(PROJECT_PART_IMAGE_TEMP_DIR_ROOT, ...parts)
  const rootResolved = path.resolve(PROJECT_PART_IMAGE_TEMP_DIR_ROOT)
  if (!resolved.startsWith(rootResolved + path.sep) && resolved !== rootResolved) return null
  return resolved
}

// 解析正式图片路径
const resolveStoredPartImagePath = (imageUrl) => {
  const url = String(imageUrl || '').trim()
  if (!url) return null

  // 相对路径格式：{分类}/{项目编号}/项目管理/零件图示/{文件名}
  const parts = url.split('/').filter(Boolean)
  if (parts.length < 4) return null
  if (parts[2] !== '项目管理' || parts[3] !== PROJECT_PART_IMAGE_SUBDIR) return null

  return path.join(FILE_ROOT, ...parts)
}

// 解析任意图片路径（临时或正式）
const resolveAnyPartImagePath = (imageUrl) => {
  const url = String(imageUrl || '')
  if (url.startsWith(PROJECT_PART_IMAGE_TEMP_URL_PREFIX)) {
    return resolveTempPartImagePath(url)
  }
  return resolveStoredPartImagePath(url)
}

// 清理空目录
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

// 移动临时图片到正式目录
const finalizePartImage = async (projectCode, imageUrl, isUpdate = false) => {
  const url = String(imageUrl || '').trim()
  if (!url) return null
  if (!url.startsWith(PROJECT_PART_IMAGE_TEMP_URL_PREFIX)) {
    // 已经是正式路径，直接返回
    return url
  }

  const fromPath = resolveTempPartImagePath(url)
  if (!fromPath || !fs.existsSync(fromPath)) {
    return null
  }

  const category = getCategoryFromProjectCode(projectCode)
  const safeProjectCode = safeProjectCodeForPath(projectCode)
  const finalRelativeDir = path.posix.join(
    category,
    safeProjectCode,
    '项目管理',
    PROJECT_PART_IMAGE_SUBDIR
  )
  const finalFullDir = path.join(FILE_ROOT, finalRelativeDir)
  ensureDirSync(finalFullDir)

  // 生成文件名：{项目编号}_图示.{扩展名}
  const originalExt = path.extname(fromPath) || '.jpg'
  const storedFileName = `${projectCode}_图示${originalExt}`
  const safeStoredFileName = safeFileName(storedFileName)
  const toPath = path.join(finalFullDir, safeStoredFileName)

  try {
    // 如果是更新操作，先查询并删除旧的正式图片文件（可能扩展名不同）
    if (isUpdate) {
      try {
        const oldImageQuery = `SELECT TOP 1 [零件图示URL] FROM 项目管理 WHERE 项目编号 = @projectCode`
        const oldImageResult = await query(oldImageQuery, { projectCode })
        if (oldImageResult && oldImageResult.length > 0 && oldImageResult[0].零件图示URL) {
          const oldImageUrl = String(oldImageResult[0].零件图示URL || '').trim()
          // 如果旧图片是正式路径（不是临时路径），删除旧文件
          if (oldImageUrl && !oldImageUrl.startsWith(PROJECT_PART_IMAGE_TEMP_URL_PREFIX)) {
            const oldImagePath = resolveStoredPartImagePath(oldImageUrl)
            if (oldImagePath && fs.existsSync(oldImagePath)) {
              try {
                await fsp.unlink(oldImagePath)
                console.log('[归档零件图示] 已删除旧正式图片:', oldImagePath)
                // 清理空目录
                await cleanupEmptyParents(oldImagePath, FILE_ROOT)
              } catch (e) {
                console.warn('[归档零件图示] 删除旧正式图片失败（忽略）:', e)
              }
            }
          }
        }
      } catch (e) {
        console.warn('[归档零件图示] 查询旧图片失败（忽略）:', e)
      }
    }

    // 如果目标文件已存在，先删除（同名文件）
    if (fs.existsSync(toPath)) {
      await fsp.unlink(toPath)
    }
    // 移动文件
    await fsp.rename(fromPath, toPath)
    // 清理空目录
    await cleanupEmptyParents(fromPath, PROJECT_PART_IMAGE_TEMP_DIR_ROOT)
    // 返回相对路径
    return path.posix.join(finalRelativeDir, safeStoredFileName)
  } catch (e) {
    console.error('归档零件图示失败:', e)
    return null
  }
}

// 安全化文件名
const safeFileName = (fileName) => {
  if (!fileName) return fileName
  return String(fileName).replace(/[/\\?%*:|"<>]/g, '_')
}

const ensureUniqueFileName = (dirPath, fileName) => {
  const parsed = path.parse(String(fileName || ''))
  const base = parsed.name || '附件'
  const ext = parsed.ext || ''
  let candidate = `${base}${ext}`
  let i = 2
  while (fs.existsSync(path.join(dirPath, candidate))) {
    candidate = `${base}_${i}${ext}`
    i += 1
  }
  return candidate
}

const ensureDirSync = (dirPath) => {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true })
    }
  } catch (e) {
    // 目录创建失败时不抛出异常，避免服务启动失败
    // 在实际使用时再尝试创建，或记录警告日志
    console.warn(`[项目路由] 无法创建目录 ${dirPath}:`, e.message)
  }
}

// 确保零件图示临时目录存在（必须在ensureDirSync定义之后调用）
// 注意：如果挂载点未就绪，这里可能失败，但不影响服务启动
ensureDirSync(PROJECT_PART_IMAGE_TEMP_DIR_ROOT)

const moveFileWithFallback = async (fromPath, toPath) => {
  try {
    await fsp.rename(fromPath, toPath)
  } catch (err) {
    if (err && err.code === 'EXDEV') {
      await fsp.copyFile(fromPath, toPath)
      await fsp.unlink(fromPath)
      return
    }
    throw err
  }
}

const attachmentStorage = multer.diskStorage({
  destination(req, file, cb) {
    try {
      const projectCode = String(req.params.projectCode || '').trim()
      if (!projectCode) {
        return cb(new Error('缺少项目编号'))
      }

      // 使用临时目录，在路由处理中查询后再移动文件到正确位置
      const tempRelativeDir = path.posix.join(
        '_temp',
        'project-management',
        String(Date.now()),
        String(Math.random().toString(36).slice(2, 8))
      )
      const fullDir = path.join(FILE_ROOT, tempRelativeDir)
      ensureDirSync(fullDir)

      req._tempAttachmentDir = tempRelativeDir
      req._tempAttachmentFullDir = fullDir

      cb(null, fullDir)
    } catch (err) {
      cb(err)
    }
  },
  filename(req, file, cb) {
    // 生成临时唯一文件名
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
    const ext = path.extname(file.originalname)
    const baseName = path.basename(file.originalname, ext)
    const normalizedBaseName = normalizeAttachmentFileName(baseName)
    const safeBaseName = safeFileName(normalizedBaseName)
    req._attachmentStoredFileName = `${safeBaseName}-${uniqueSuffix}${ext}`
    cb(null, req._attachmentStoredFileName)
  }
})

const uploadAttachment = multer({
  storage: attachmentStorage,
  limits: {
    fileSize: MAX_ATTACHMENT_SIZE_BYTES
  }
})

const uploadSingleAttachment = (req, res, next) => {
  uploadAttachment.single('file')(req, res, (err) => {
    if (!err) return next()
    const message =
      err?.code === 'LIMIT_FILE_SIZE'
        ? `上传失败：单个附件不能超过 ${Math.round(MAX_ATTACHMENT_SIZE_BYTES / 1024 / 1024)}MB`
        : err?.message || '上传失败'
    res.status(400).json({ code: 400, success: false, message })
  })
}

// 零件图示上传配置
const uploadPartImage = multer({
  storage: multer.diskStorage({
    destination(req, file, cb) {
      try {
        const tempDir = path.join(
          PROJECT_PART_IMAGE_TEMP_DIR_ROOT,
          String(Date.now()),
          String(Math.random().toString(36).slice(2, 8))
        )
        ensureDirSync(tempDir)
        req._partImageTempDir = tempDir
        cb(null, tempDir)
      } catch (err) {
        cb(err, '')
      }
    },
    filename(req, file, cb) {
      const ext = path.extname(file.originalname) || '.jpg'
      const safeName = safeFileName(path.basename(file.originalname, ext))
      const storedFileName = `${safeName}_${Date.now()}${ext}`
      req._partImageStoredFileName = storedFileName
      cb(null, storedFileName)
    }
  }),
  limits: { fileSize: PROJECT_PART_IMAGE_MAX_SIZE_BYTES }
})

const getFileFullPath = (relativePath, storedFileName) => {
  return path.join(FILE_ROOT, relativePath, storedFileName)
}

// 根据项目编号查询客户模号
const getCustomerModelNo = async (projectCode) => {
  const rows = await query(
    `SELECT TOP 1 客户模号 as customerModelNo FROM 项目管理 WHERE 项目编号 = @projectCode`,
    { projectCode }
  )
  return rows.length > 0 ? rows[0].customerModelNo || null : null
}

// 生成附件文件名
const generateAttachmentFileName = (projectCode, customerModelNo, type, originalFileName) => {
  // 获取文件扩展名
  const ext = originalFileName.split('.').pop()?.toLowerCase() || ''
  const safeExt = ext ? `.${ext}` : ''

  // 根据类型生成文件名
  let fileName = ''
  if (type === 'relocation-process') {
    // 移模流程单：项目编号_移模流程单.{扩展名}
    fileName = `${projectCode}_移模流程单${safeExt}`
  } else if (type === 'trial-record') {
    // 试模记录表：客户模号_试模记录表.{扩展名}
    const safeCustomerModelNo = customerModelNo || 'UNKNOWN'
    fileName = `${safeCustomerModelNo}_试模记录表${safeExt}`
  } else if (type === 'tripartite-agreement') {
    // 三方协议：客户模号_三方协议.{扩展名}
    const safeCustomerModelNo = customerModelNo || 'UNKNOWN'
    fileName = `${safeCustomerModelNo}_三方协议${safeExt}`
  } else if (type === 'trial-form') {
    // 试模单：项目编号_试模单_序号.{扩展名}，序号从01开始
    // 这个会在上传时动态计算序号
    fileName = `${projectCode}_试模单_序号${safeExt}`
  } else if (type === 'technical-spec') {
    // 技术规格表：项目编号_技术规格表.{扩展名}
    fileName = `${projectCode}_技术规格表${safeExt}`
  } else if (type === 'drawing') {
    // 图档：根据扩展名决定命名规则
    // .pdf  => 项目编号_2D.pdf
    // .dwg  => 项目编号_2D_CAD.dwg
    // 3D（.prt .x_t .stp 等）=> 项目编号_3D.{扩展名}
    const extLower = ext.toLowerCase()
    const threeDExts = new Set([
      'prt',
      'x_t',
      'x_b',
      'stp',
      'step',
      'igs',
      'iges',
      'sldprt',
      'sldasm',
      'asm',
      'par',
      'psm',
      'catpart',
      'catproduct'
    ])
    if (extLower === 'pdf') {
      fileName = `${projectCode}_2D${safeExt}`
    } else if (extLower === 'dwg') {
      fileName = `${projectCode}_2D_CAD${safeExt}`
    } else if (threeDExts.has(extLower)) {
      fileName = `${projectCode}_3D${safeExt}`
    } else {
      fileName = originalFileName
    }
  } else if (type === 'seal-sample') {
    // 封样单：封样单.{扩展名}（多产品时由生成逻辑命名）
    fileName = `封样单${safeExt}`
  } else {
    // 默认使用原始文件名
    fileName = originalFileName
  }

  return fileName
}

// 获取试模单的下一个序号（从01开始）
const getNextTrialFormSequence = async (projectCode) => {
  // 查询该目录下已有的试模单文件，找出最大序号
  const existingRows = await query(
    `
    SELECT TOP 100
      存储文件名 as storedFileName
    FROM 项目管理附件
    WHERE 项目编号 = @projectCode
      AND 附件类型 = 'trial-form'
    ORDER BY 上传时间 DESC, 附件ID DESC
    `,
    { projectCode }
  )

  let maxSeq = 0
  // 匹配模式：项目编号_试模单_序号.扩展名，例如：JH24-01-001_试模单_01.pdf
  const seqPattern = /_试模单_(\d{2})\./

  for (const row of existingRows) {
    const fileName = String(row.storedFileName || '')
    const match = seqPattern.exec(fileName)
    if (match && match[1]) {
      const seq = parseInt(match[1], 10)
      if (!Number.isNaN(seq) && seq > maxSeq) {
        maxSeq = seq
      }
    }
  }

  // 返回下一个序号（从01开始，所以最大序号+1）
  const nextSeq = maxSeq + 1
  return String(nextSeq).padStart(2, '0')
}

// 确保项目管理附件表存在
const ensureProjectAttachmentsTable = async () => {
  await query(`
    IF OBJECT_ID(N'dbo.项目管理附件', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.项目管理附件 (
        附件ID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        项目编号 NVARCHAR(50) NOT NULL,
        附件类型 NVARCHAR(50) NOT NULL,
        原始文件名 NVARCHAR(255) NOT NULL,
        存储文件名 NVARCHAR(255) NOT NULL,
        相对路径 NVARCHAR(255) NOT NULL,
        文件大小 BIGINT NOT NULL,
        内容类型 NVARCHAR(100) NULL,
        上传时间 DATETIME2 NOT NULL CONSTRAINT DF_项目管理附件_上传时间 DEFAULT (SYSDATETIME()),
        上传人 NVARCHAR(100) NULL,
        绑定产品图号 NVARCHAR(150) NULL,
        绑定行序号 INT NULL,
        是否孤儿 BIT NOT NULL CONSTRAINT DF_项目管理附件_是否孤儿 DEFAULT (0),
        孤儿原因 NVARCHAR(50) NULL,
        孤儿行序号 INT NULL
      );

      CREATE INDEX IX_项目管理附件_项目编号 ON dbo.项目管理附件 (项目编号);
      CREATE INDEX IX_项目管理附件_项目编号_类型 ON dbo.项目管理附件 (项目编号, 附件类型, 上传时间 DESC, 附件ID DESC);
      CREATE INDEX IX_项目管理附件_检验报告_绑定 ON dbo.项目管理附件 (项目编号, 附件类型, 绑定产品图号, 绑定行序号, 是否孤儿, 上传时间 DESC, 附件ID DESC);
    END
  `)

  // 兼容旧表：按需补列（避免线上已有表但缺少新字段）
  await query(`
    IF COL_LENGTH(N'dbo.项目管理附件', N'绑定产品图号') IS NULL
      ALTER TABLE dbo.项目管理附件 ADD 绑定产品图号 NVARCHAR(150) NULL;
    IF COL_LENGTH(N'dbo.项目管理附件', N'绑定行序号') IS NULL
      ALTER TABLE dbo.项目管理附件 ADD 绑定行序号 INT NULL;
    IF COL_LENGTH(N'dbo.项目管理附件', N'是否孤儿') IS NULL
      ALTER TABLE dbo.项目管理附件 ADD 是否孤儿 BIT NOT NULL CONSTRAINT DF_项目管理附件_是否孤儿 DEFAULT (0);
    IF COL_LENGTH(N'dbo.项目管理附件', N'孤儿原因') IS NULL
      ALTER TABLE dbo.项目管理附件 ADD 孤儿原因 NVARCHAR(50) NULL;
    IF COL_LENGTH(N'dbo.项目管理附件', N'孤儿行序号') IS NULL
      ALTER TABLE dbo.项目管理附件 ADD 孤儿行序号 INT NULL;

    IF NOT EXISTS (
      SELECT 1
      FROM sys.indexes
      WHERE name = N'IX_项目管理附件_检验报告_绑定'
        AND object_id = OBJECT_ID(N'dbo.项目管理附件')
    )
    BEGIN
      CREATE INDEX IX_项目管理附件_检验报告_绑定
      ON dbo.项目管理附件 (项目编号, 附件类型, 绑定产品图号, 绑定行序号, 是否孤儿, 上传时间 DESC, 附件ID DESC);
    END
  `)
}

// === 试模过程（多次记录） ===

const TRIAL_PROCESS_ALLOWED_CATEGORIES = ['T0', '工程变更', '细节优化', '客户更改', '封样']

const resolveUsernameFromReq = (req) => {
  const displayNameRaw = req?.headers?.['x-display-name']
  const displayName = Array.isArray(displayNameRaw) ? displayNameRaw[0] : displayNameRaw
  const displayNameStr = String(displayName || '').trim()
  if (displayNameStr) {
    try {
      const decoded = decodeURIComponent(displayNameStr).trim()
      if (decoded) return decoded
    } catch (_e) {
      if (displayNameStr) return displayNameStr
    }
  }

  const raw = req?.headers?.['x-username']
  const username = Array.isArray(raw) ? raw[0] : raw
  const s = String(username || '').trim()
  return s || null
}

const normalizeTrialCategory = (isFirstActiveRecord, input) => {
  const raw = String(input || '').trim()
  if (isFirstActiveRecord) return 'T0'
  if (!raw) return null
  return TRIAL_PROCESS_ALLOWED_CATEGORIES.includes(raw) && raw !== 'T0' ? raw : null
}

const parsePositiveInt = (val) => {
  const n = parseInt(String(val ?? ''), 10)
  return Number.isInteger(n) && n > 0 ? n : null
}

const parseOptionalDecimal = (val) => {
  if (val === null || val === undefined || String(val).trim() === '') return null
  const n = Number(val)
  return Number.isFinite(n) ? n : null
}

const resolveProductWeightFromProjectRow = (projectRow) => {
  const listRaw = projectRow?.产品重量列表
  if (listRaw !== null && listRaw !== undefined && String(listRaw).trim() !== '') {
    let list = []
    if (Array.isArray(listRaw)) {
      list = listRaw
    } else if (typeof listRaw === 'string') {
      try {
        const parsed = JSON.parse(listRaw)
        if (Array.isArray(parsed)) list = parsed
      } catch (_e) {
        list = []
      }
    }
    const numbers = list
      .map((v) => (typeof v === 'number' ? v : Number(String(v ?? '').trim())))
      .filter((v) => Number.isFinite(v))
    if (numbers.length > 0) {
      return numbers.reduce((sum, n) => sum + n, 0)
    }
  }
  const single = projectRow?.产品重量
  if (single === null || single === undefined || String(single).trim() === '') return null
  const n = typeof single === 'number' ? single : Number(String(single).trim())
  return Number.isFinite(n) ? n : null
}

const ensureTrialProcessTables = async () => {
  await query(`
    IF OBJECT_ID(N'dbo.试模过程', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.试模过程 (
        试模过程ID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        项目编号 NVARCHAR(50) NOT NULL,
        试模次数 INT NOT NULL,
        试模日期 DATE NULL,
        试模类别 NVARCHAR(50) NOT NULL,
        -- 兼容历史：产品颜色不在业务中维护（以项目管理表为准）
        产品颜色 NVARCHAR(100) NULL,
        -- 兼容历史：产品数量不在业务中展示，写入时与“试模产品数量”一致
        产品数量 INT NOT NULL,
        试模产品数量 INT NOT NULL,
        注塑机吨位 INT NULL,
        -- 兼容历史：成型周期不在业务中维护
        成型周期 DECIMAL(10,2) NULL,
        色母型号 NVARCHAR(100) NULL,
        试模单位 NVARCHAR(100) NULL,
        试模时长 DECIMAL(10,2) NULL,
        外协试模 BIT NOT NULL CONSTRAINT DF_试模过程_外协试模 DEFAULT (0),
        备注 NVARCHAR(1000) NULL,
        是否作废 BIT NOT NULL CONSTRAINT DF_试模过程_是否作废 DEFAULT (0),
        创建时间 DATETIME2 NOT NULL CONSTRAINT DF_试模过程_创建时间 DEFAULT (SYSDATETIME()),
        创建人 NVARCHAR(100) NULL,
        更新时间 DATETIME2 NULL,
        更新人 NVARCHAR(100) NULL
      );

      CREATE UNIQUE INDEX UX_试模过程_项目_次数_有效
      ON dbo.试模过程 (项目编号, 试模次数)
      WHERE 是否作废 = 0;
      CREATE INDEX IX_试模过程_项目 ON dbo.试模过程 (项目编号, 是否作废, 试模次数 DESC, 试模过程ID DESC);
    END
  `)

  await query(`
    IF EXISTS (
      SELECT 1
      FROM sys.indexes
      WHERE name = N'UX_试模过程_项目_次数'
        AND object_id = OBJECT_ID(N'dbo.试模过程')
    )
    BEGIN
      DROP INDEX UX_试模过程_项目_次数 ON dbo.试模过程;
    END

    IF NOT EXISTS (
      SELECT 1
      FROM sys.indexes
      WHERE name = N'UX_试模过程_项目_次数_有效'
        AND object_id = OBJECT_ID(N'dbo.试模过程')
    )
    BEGIN
      CREATE UNIQUE INDEX UX_试模过程_项目_次数_有效
      ON dbo.试模过程 (项目编号, 试模次数)
      WHERE 是否作废 = 0;
    END
  `)

  await query(`
    IF OBJECT_ID(N'dbo.试模过程附件', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.试模过程附件 (
        附件ID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        试模过程ID INT NOT NULL,
        项目编号 NVARCHAR(50) NOT NULL,
        原始文件名 NVARCHAR(255) NOT NULL,
        存储文件名 NVARCHAR(255) NOT NULL,
        相对路径 NVARCHAR(255) NOT NULL,
        文件大小 BIGINT NOT NULL,
        内容类型 NVARCHAR(100) NULL,
        上传时间 DATETIME2 NOT NULL CONSTRAINT DF_试模过程附件_上传时间 DEFAULT (SYSDATETIME()),
        上传人 NVARCHAR(100) NULL,
        排序 INT NULL
      );

      CREATE INDEX IX_试模过程附件_过程 ON dbo.试模过程附件 (试模过程ID, 上传时间 DESC, 附件ID DESC);
      CREATE INDEX IX_试模过程附件_项目 ON dbo.试模过程附件 (项目编号, 上传时间 DESC, 附件ID DESC);

      BEGIN TRY
        ALTER TABLE dbo.试模过程附件
          ADD CONSTRAINT FK_试模过程附件_试模过程
          FOREIGN KEY (试模过程ID) REFERENCES dbo.试模过程(试模过程ID);
      END TRY
      BEGIN CATCH
        -- ignore
      END CATCH
    END
  `)
}

// 获取项目统计信息（需要在其他路由之前定义）
router.get('/statistics', async (req, res) => {
  try {
    const queryString = `
      WITH proj AS (
        SELECT 项目编号, 项目状态
        FROM 项目管理
      ),
      goods AS (
        SELECT DISTINCT 项目编号, 分类
        FROM 货物信息
        WHERE CAST(IsNew AS INT) != 1
      )
      SELECT 
        COUNT(
          DISTINCT CASE 
            WHEN proj.项目状态 IS NULL OR proj.项目状态 <> N'已经移模'
            THEN proj.项目编号 
          END
        ) as totalProjects,
        COUNT(DISTINCT CASE WHEN proj.项目状态 = 'T0' THEN proj.项目编号 END) as t0Projects,
        COUNT(DISTINCT CASE WHEN proj.项目状态 = '设计中' THEN proj.项目编号 END) as designingProjects,
        COUNT(DISTINCT CASE WHEN proj.项目状态 = '加工中' THEN proj.项目编号 END) as processingProjects,
        COUNT(DISTINCT CASE WHEN proj.项目状态 = '表面处理' THEN proj.项目编号 END) as surfaceTreatingProjects,
        COUNT(DISTINCT CASE WHEN proj.项目状态 = '已经移模' THEN proj.项目编号 END) as completedProjects,
        COUNT(
          DISTINCT CASE 
            WHEN (proj.项目状态 IS NULL OR proj.项目状态 <> N'已经移模')
              AND goods.分类 = N'塑胶模具'
            THEN proj.项目编号
          END
        ) as plasticMould,
        COUNT(
          DISTINCT CASE 
            WHEN (proj.项目状态 IS NULL OR proj.项目状态 <> N'已经移模')
              AND goods.分类 = N'修改模具'
            THEN proj.项目编号
          END
        ) as modifyMould,
        COUNT(
          DISTINCT CASE 
            WHEN (proj.项目状态 IS NULL OR proj.项目状态 <> N'已经移模')
              AND goods.分类 = N'零件加工'
            THEN proj.项目编号
          END
        ) as partsProcessing
      FROM proj
      LEFT JOIN goods ON goods.项目编号 = proj.项目编号
    `

    const result = await query(queryString)

    res.json({
      code: 0,
      success: true,
      data: result[0]
    })
  } catch (error) {
    console.error('获取项目统计信息失败:', error)
    console.error('错误堆栈:', error.stack)
    res.status(500).json({
      success: false,
      message: '获取项目统计信息失败',
      error: error.message
    })
  }
})

// 获取项目信息列表
router.get('/list', async (req, res) => {
  try {
    const { keyword, status, category, page = 1, pageSize = 10, sortField, sortOrder } = req.query

    let whereConditions = []
    let params = {}

    // 构建查询条件
    if (keyword) {
      // 关键词搜索：仍然以「货物信息」表为入口，只在存在对应货物记录的项目中查询
      // 支持字段：
      // - 项目编号（货物信息表 g_kw.项目编号）
      // - 产品名称（货物信息表 g_kw.产品名称）
      // - 产品图号（货物信息表 g_kw.产品图号）
      // - 客户模号（项目管理表 p_kw.客户模号，经由 货物信息 关联）
      whereConditions.push(`
        EXISTS (
          SELECT 1
          FROM 货物信息 g_kw
          LEFT JOIN 项目管理 p_kw ON g_kw.项目编号 = p_kw.项目编号
          WHERE g_kw.项目编号 = p.项目编号
            AND (
              g_kw.项目编号 LIKE @keyword
              OR g_kw.产品名称 LIKE @keyword
              OR g_kw.产品图号 LIKE @keyword
              OR p_kw.客户模号 LIKE @keyword
            )
        )
      `)
      params.keyword = `%${keyword}%`
    }

    // 分类条件：在货物信息表中按分类筛选（例如：塑胶模具）
    if (category) {
      whereConditions.push(`
        EXISTS (
          SELECT 1
          FROM 货物信息 g_cat
          WHERE g_cat.项目编号 = p.项目编号
            AND g_cat.分类 = @category
        )
      `)
      params.category = category
    }

    // 项目状态条件：
    // - 默认不显示“已经移模”记录（未传 status 时）
    // - 如显式传入 status，则按指定状态精确筛选（允许查询“已经移模”）
    if (status) {
      whereConditions.push(`p.项目状态 = @status`)
      params.status = status
    } else if (!keyword) {
      whereConditions.push(`(p.项目状态 IS NULL OR p.项目状态 <> N'已经移模')`)
    }

    // 构建完整的 WHERE 子句
    const finalWhereClause =
      whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

    // 计算分页
    const pageNum = parseInt(page)
    const pageSizeNum = parseInt(pageSize)
    const offset = (pageNum - 1) * pageSizeNum

    // 排序字段白名单映射（仅用于前端点击表头时）
    const sortableFields = {
      项目编号: 'p.项目编号',
      项目状态: 'p.项目状态',
      计划首样日期: 'p.计划首样日期',
      移模日期: 'p.移模日期'
    }

    let orderByClause = ''
    const mappedField = sortField && sortableFields[sortField]
    const sortDir = (sortOrder || '').toString().toLowerCase()
    if (mappedField && (sortDir === 'asc' || sortDir === 'desc')) {
      orderByClause = `ORDER BY ${mappedField} ${sortDir.toUpperCase()}`
    }

    // 如果没有任何排序参数，则使用默认排序规则
    if (!orderByClause) {
      // 默认排序规则：
      // 1. 计划首样日期在【今天前后 7 天之内】且“尚未送样”的项目排在最前面
      //    （尚未送样：首次送样日期为空）
      //    （即：|计划首样日期 - 今天| <= 7 天）
      // 2. 这组内部按计划首样日期从早到晚排序
      // 3. 其他项目按项目编号倒序（近似数据库倒序）
      orderByClause = `
        ORDER BY 
          CASE 
            WHEN p.计划首样日期 IS NOT NULL 
                 AND p.首次送样日期 IS NULL
                 AND ABS(DATEDIFF(DAY, CAST(GETDATE() AS date), p.计划首样日期)) <= 7
          THEN 0
          ELSE 1
          END ASC,
          CASE 
            WHEN p.计划首样日期 IS NOT NULL 
                 AND p.首次送样日期 IS NULL
                 AND ABS(DATEDIFF(DAY, CAST(GETDATE() AS date), p.计划首样日期)) <= 7
            THEN p.计划首样日期
            ELSE NULL
          END ASC,
          p.项目编号 DESC
      `
    }

    // 查询总数（需要排除 IsNew = 1 的项目）
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM 项目管理 p
      ${finalWhereClause}
    `
    const countResult = await query(countQuery, params)
    const total = countResult[0].total

    // 查询数据（需要排除 IsNew = 1 的项目）
    // 使用 TOP 1 获取每个项目的第一条货物信息（排除 IsNew = 1 的记录）
    const dataQuery = `
      SELECT 
        p.*,
        CONVERT(varchar(10), p.图纸下发日期, 23) as 图纸下发日期_fmt,
        (SELECT TOP 1 g1.产品名称 
         FROM 货物信息 g1 
         WHERE g1.项目编号 = p.项目编号 
           AND CAST(g1.IsNew AS INT) != 1
         ORDER BY g1.货物ID) as productName,
        (SELECT TOP 1 g1.产品图号 
         FROM 货物信息 g1 
         WHERE g1.项目编号 = p.项目编号 
           AND CAST(g1.IsNew AS INT) != 1
         ORDER BY g1.货物ID) as productDrawing
      FROM 项目管理 p
      ${finalWhereClause}
      ${orderByClause}
      OFFSET ${offset} ROWS
      FETCH NEXT ${pageSizeNum} ROWS ONLY
    `

    const data = await query(dataQuery, params)
    // 解决 p.* 与格式化列重名导致的数组问题：用格式化后的值覆盖
    const mapped = (data || []).map((row) => {
      if (row && row['图纸下发日期_fmt'] !== undefined) {
        row['图纸下发日期'] = row['图纸下发日期_fmt']
        delete row['图纸下发日期_fmt']
      }
      return row
    })

    res.json({
      code: 0,
      success: true,
      data: {
        list: mapped,
        total: total,
        page: pageNum,
        pageSize: pageSizeNum
      }
    })
  } catch (error) {
    console.error('获取项目信息列表失败:', error)
    console.error('错误堆栈:', error.stack)
    res.status(500).json({
      success: false,
      message: '获取项目信息列表失败',
      error: error.message
    })
  }
})

// 根据项目编号获取货物信息（产品名称、产品图号、客户模号）
// 使用 query 参数，避免项目编号包含斜杠的问题
router.get('/goods', async (req, res) => {
  try {
    const { projectCode } = req.query

    if (!projectCode) {
      return res.status(400).json({
        success: false,
        message: '项目编号不能为空'
      })
    }

    const queryString = `
      SELECT TOP 1
        g.产品图号 as productDrawing,
        g.产品名称 as productName,
        g.分类 as category,
        p.客户模号 as customerModelNo
      FROM 货物信息 g
      LEFT JOIN 项目管理 p ON g.项目编号 = p.项目编号
      WHERE g.项目编号 = @projectCode
        AND (g.IsNew IS NULL OR CAST(g.IsNew AS INT) != 1)
      ORDER BY g.货物ID
    `

    const result = await query(queryString, { projectCode })

    if (result.length === 0) {
      return res.json({
        code: 0,
        success: true,
        data: null
      })
    }

    res.json({
      code: 0,
      success: true,
      data: result[0]
    })
  } catch (error) {
    console.error('获取货物信息失败:', error)
    res.status(500).json({
      success: false,
      message: '获取货物信息失败',
      error: error.message
    })
  }
})

// 获取单个项目信息（使用 query 参数，避免项目编号包含斜杠的问题）
router.get('/detail', async (req, res) => {
  try {
    const { projectCode } = req.query

    if (!projectCode) {
      return res.status(400).json({
        success: false,
        message: '项目编号不能为空'
      })
    }

    const queryString = `
      SELECT 
        p.*,
        CONVERT(varchar(10), p.图纸下发日期, 23) as 图纸下发日期_fmt,
        (SELECT TOP 1 g1.产品名称 
         FROM 货物信息 g1 
         WHERE g1.项目编号 = p.项目编号 
           AND CAST(g1.IsNew AS INT) != 1
         ORDER BY g1.货物ID) as productName,
        (SELECT TOP 1 g1.产品图号 
         FROM 货物信息 g1 
         WHERE g1.项目编号 = p.项目编号 
           AND CAST(g1.IsNew AS INT) != 1
         ORDER BY g1.货物ID) as productDrawing
      FROM 项目管理 p 
      WHERE p.项目编号 = @projectCode
    `

    const result = await query(queryString, { projectCode })
    if (result && result[0] && result[0]['图纸下发日期_fmt'] !== undefined) {
      result[0]['图纸下发日期'] = result[0]['图纸下发日期_fmt']
      delete result[0]['图纸下发日期_fmt']
    }

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: '项目信息不存在'
      })
    }

    const detail = result[0]

    res.json({
      code: 0,
      success: true,
      data: detail
    })
  } catch (error) {
    console.error('获取项目信息失败:', error)
    res.status(500).json({
      success: false,
      message: '获取项目信息失败',
      error: error.message
    })
  }
})

// 生成试模单（xlsx）：基于模板单元格填充，直接下载（不保存附件）
router.post('/trial-form-xlsx', async (req, res) => {
  try {
    const { projectCode, trialCount } = req.body || {}
    const code = String(projectCode || '').trim()
    if (!code) {
      return res.status(400).json({ code: 400, success: false, message: '项目编号不能为空' })
    }

    const normalizedTrialCount = normalizeTrialCount(trialCount)
    if (!normalizedTrialCount) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '试模次数格式不正确（仅支持“第N次”或数字 N，且 N 为正整数）'
      })
    }

    if (!fs.existsSync(TRIAL_FORM_TEMPLATE_PATH)) {
      return res.status(500).json({
        code: 500,
        success: false,
        message: '试模单模板不存在，请联系管理员'
      })
    }

    const row = await loadProjectRowForTripartiteAgreement(code)
    if (!row) {
      return res.status(404).json({ code: 404, success: false, message: '项目信息不存在' })
    }

    const validateErrors = validateTrialFormRow(row)
    if (validateErrors.length) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '试模单数据不完整，请先补齐后再生成',
        errors: validateErrors
      })
    }

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(TRIAL_FORM_TEMPLATE_PATH)
    const sheet = workbook.getWorksheet('试模单') || workbook.worksheets[0]
    if (!sheet) {
      return res.status(500).json({ code: 500, success: false, message: '试模单模板格式异常' })
    }

    sheet.getCell('C2').value = code
    sheet.getCell('H2').value = row.productName || row.产品名称 || ''
    sheet.getCell('L2').value = row.模具穴数 ? String(row.模具穴数) : ''
    sheet.getCell('D3').value = row.模具尺寸 ? String(row.模具尺寸) : ''
    sheet.getCell('H3').value =
      row.模具重量 === null || row.模具重量 === undefined ? '' : String(row.模具重量)
    sheet.getCell('L3').value =
      row.产品重量 === null || row.产品重量 === undefined ? '' : String(row.产品重量)
    sheet.getCell('D4').value = row.产品材质 ? String(row.产品材质) : ''
    sheet.getCell('H4').value = row.产品颜色 ? String(row.产品颜色) : ''
    sheet.getCell('D5').value = normalizedTrialCount

    const today = formatDateYYYYMMDD(new Date())
    const headerText = `&R${normalizedTrialCount} | 生成日期：${today}`
    sheet.headerFooter = {
      oddHeader: headerText,
      evenHeader: headerText
    }

    const buffer = await workbook.xlsx.writeBuffer()
    const encodedFilename = encodeURIComponent(`${code}_${normalizedTrialCount}.xlsx`)
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFilename}`)
    return res.send(Buffer.from(buffer))
  } catch (error) {
    console.error('生成试模单 xlsx 失败:', error)
    return res.status(500).json({
      code: 500,
      success: false,
      message: '生成试模单失败',
      error: error.message
    })
  }
})

// 校验试模单数据完整性：用于打印预览等场景（不生成文件）
router.post('/trial-form-validate', async (req, res) => {
  try {
    const { projectCode } = req.body || {}
    const code = String(projectCode || '').trim()
    if (!code) {
      return res.status(400).json({ code: 400, success: false, message: '项目编号不能为空' })
    }

    const row = await loadProjectRowForTripartiteAgreement(code)
    if (!row) {
      return res.status(404).json({ code: 404, success: false, message: '项目信息不存在' })
    }

    const validateErrors = validateTrialFormRow(row)
    if (validateErrors.length) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '试模单数据不完整，请先补齐后再生成',
        errors: validateErrors
      })
    }

    return res.json({ code: 0, success: true })
  } catch (error) {
    console.error('校验试模单失败:', error)
    return res.status(500).json({
      code: 500,
      success: false,
      message: '校验试模单失败',
      error: error.message
    })
  }
})

// 校验封样单数据完整性：用于生成前检查（不生成文件、不改附件）
router.post('/seal-sample-validate', async (req, res) => {
  try {
    await ensureProjectAttachmentsTable()

    const { projectCode } = req.body || {}
    const code = String(projectCode || '').trim()
    if (!code) {
      return res.status(400).json({ code: 400, success: false, message: '项目编号不能为空' })
    }

    if (!fs.existsSync(SEAL_SAMPLE_TEMPLATE_PATH)) {
      return res.status(500).json({
        code: 500,
        success: false,
        message: '封样单模板不存在，请联系管理员'
      })
    }

    const row = await loadProjectRowForSealSample(code)
    if (!row) {
      return res.status(404).json({ code: 404, success: false, message: '项目信息不存在' })
    }

    const products = buildSealSampleProducts(row)
    if (products.length === 0) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '请先填写产品列表',
        missing: ['产品列表']
      })
    }

    const productMaterial = String(row?.产品材质 || '').trim()
    const customerModelNo = String(row?.客户模号 || '').trim()
    const mouldCavity = String(row?.模具穴数 || '').trim()
    const designer = String(row?.设计师 || '').trim()

    const missing = []
    if (!productMaterial) missing.push('项目信息：产品材质')
    if (!customerModelNo) missing.push('项目信息：客户模号')
    if (!mouldCavity) missing.push('项目信息：模具穴数')
    if (!designer) missing.push('项目信息：设计师')

    for (const prod of products) {
      const inspectionPdf = await querySealSampleInspectionReportPdf(code, prod.productDrawing)
      if (!inspectionPdf) {
        missing.push(`产品 ${prod.productDrawing}：检验报告 PDF`)
      }
      const partDrawingPdf = await querySealSamplePartDrawingPdf(code, prod.productDrawing)
      if (!partDrawingPdf) {
        missing.push(`产品 ${prod.productDrawing}：零件图纸 PDF`)
      }
    }

    if (missing.length > 0) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '缺少以下信息，请补充后再生成封样单',
        missing
      })
    }

    return res.json({ code: 0, success: true })
  } catch (error) {
    console.error('校验封样单失败:', error)
    return res.status(500).json({
      code: 500,
      success: false,
      message: '校验封样单失败',
      error: error.message
    })
  }
})

// 生成三方协议（docx）：基于模板占位符填充，返回 docx 文件
router.get('/tripartite-agreement-docx', async (req, res) => {
  try {
    const { projectCode } = req.query
    const code = String(projectCode || '').trim()
    if (!code) {
      return res.status(400).json({ code: 400, success: false, message: '项目编号不能为空' })
    }

    if (!fs.existsSync(TRIPARTITE_TEMPLATE_PATH)) {
      return res.status(500).json({
        code: 500,
        success: false,
        message: '三方协议模板不存在，请联系管理员'
      })
    }

    const row = await loadProjectRowForTripartiteAgreement(code)
    if (!row) {
      return res.status(404).json({ code: 404, success: false, message: '项目信息不存在' })
    }

    const outBuffer = await generateTripartiteAgreementDocxBuffer(row)

    const filenameBase = row.项目编号 ? String(row.项目编号) : code
    const encodedFilename = encodeURIComponent(`${filenameBase}_三方协议.docx`)
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFilename}`)
    return res.send(outBuffer)
  } catch (error) {
    console.error('生成三方协议 docx 失败:', error)
    return res.status(500).json({
      code: 500,
      success: false,
      message: '生成三方协议失败',
      error: error.message
    })
  }
})

// 生成三方协议（pdf）：先填充 docx 模板，再通过 LibreOffice 转为 PDF
router.get('/tripartite-agreement-pdf', async (req, res) => {
  try {
    const { projectCode } = req.query
    const code = String(projectCode || '').trim()
    if (!code) {
      return res.status(400).json({ code: 400, success: false, message: '项目编号不能为空' })
    }

    if (!fs.existsSync(TRIPARTITE_TEMPLATE_PATH)) {
      return res.status(500).json({
        code: 500,
        success: false,
        message: '三方协议模板不存在，请联系管理员'
      })
    }

    const row = await loadProjectRowForTripartiteAgreement(code)
    if (!row) {
      return res.status(404).json({ code: 404, success: false, message: '项目信息不存在' })
    }

    const validateErrors = validateTripartiteAgreementRow(row)
    if (validateErrors.length) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '三方协议数据不完整，请先补齐后再下载',
        errors: validateErrors
      })
    }

    const docxBuffer = await generateTripartiteAgreementDocxBuffer(row)

    const tmpDir = os.tmpdir()
    const safeBase = `tripartite-${code}-${Date.now()}`
    const docxPath = path.join(tmpDir, `${safeBase}.docx`)
    const pdfPath = path.join(tmpDir, `${safeBase}.pdf`)

    await fsp.writeFile(docxPath, docxBuffer)

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
          docxPath
        ],
        { env, timeout: 120000 }
      )
    } catch (err) {
      console.error('调用 LibreOffice 失败（三方协议）:', err)
      try {
        await fsp.unlink(docxPath)
      } catch (e) { /* ignore */ }
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
      pdfBuffer = await fsp.readFile(pdfPath)
    } catch (err) {
      console.error('读取生成的 PDF 文件失败（三方协议）:', err)
      try {
        await fsp.unlink(docxPath)
      } catch (e) { /* ignore */ }
      return res.status(500).json({
        code: 500,
        success: false,
        message: '生成 PDF 文件失败'
      })
    }

    try {
      await fsp.unlink(docxPath)
    } catch (e) { /* ignore */ }
    try {
      await fsp.unlink(pdfPath)
    } catch (e) { /* ignore */ }

    const filenameBase = row.项目编号 ? String(row.项目编号) : code
    const encodedFilename = encodeURIComponent(`${filenameBase}_三方协议.pdf`)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFilename}`)
    return res.send(pdfBuffer)
  } catch (error) {
    console.error('生成三方协议 pdf 失败:', error)
    return res.status(500).json({
      code: 500,
      success: false,
      message: '生成三方协议失败',
      error: error.message
    })
  }
})

// 生成三方协议（pdf）并保存到“项目管理附件-三方协议”（不直接下载）
router.post('/tripartite-agreement-generate-pdf', async (req, res) => {
  try {
    await ensureProjectAttachmentsTable()

    const { projectCode } = req.body || {}
    const code = String(projectCode || '').trim()
    if (!code) {
      return res.status(400).json({ code: 400, success: false, message: '项目编号不能为空' })
    }

    if (!fs.existsSync(TRIPARTITE_TEMPLATE_PATH)) {
      return res.status(500).json({
        code: 500,
        success: false,
        message: '三方协议模板不存在，请联系管理员'
      })
    }

    const row = await loadProjectRowForTripartiteAgreement(code)
    if (!row) {
      return res.status(404).json({ code: 404, success: false, message: '项目信息不存在' })
    }

    // 客户模号为必填项：缺失则不生成
    const customerModelNo = String(row.客户模号 || '').trim()
    if (!customerModelNo) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '客户模号不能为空，请先补齐后再生成'
      })
    }

    const validateErrors = validateTripartiteAgreementRow(row)
    if (validateErrors.length) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '三方协议数据不完整，请先补齐后再生成',
        errors: validateErrors
      })
    }

    const docxBuffer = await generateTripartiteAgreementDocxBuffer(row)

    const tmpDir = os.tmpdir()
    const safeBase = `tripartite-${code}-${Date.now()}`
    const docxPath = path.join(tmpDir, `${safeBase}.docx`)
    const pdfPath = path.join(tmpDir, `${safeBase}.pdf`)
    await fsp.writeFile(docxPath, docxBuffer)

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
          docxPath
        ],
        { env, timeout: 120000 }
      )
    } catch (err) {
      console.error('调用 LibreOffice 失败（三方协议）:', err)
      try {
        await fsp.unlink(docxPath)
      } catch (e) { /* ignore */ }
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
      pdfBuffer = await fsp.readFile(pdfPath)
    } catch (err) {
      console.error('读取生成的 PDF 文件失败（三方协议）:', err)
      try {
        await fsp.unlink(docxPath)
      } catch (e) { /* ignore */ }
      return res.status(500).json({
        code: 500,
        success: false,
        message: '生成 PDF 文件失败'
      })
    } finally {
      try {
        await fsp.unlink(docxPath)
      } catch (e) { /* ignore */ }
      try {
        await fsp.unlink(pdfPath)
      } catch (e) { /* ignore */ }
    }

    // 单文件覆盖：删除旧文件与记录
    const existingRows = await query(
      `
      SELECT TOP 1
        附件ID as id,
        存储文件名 as storedFileName,
        相对路径 as relativePath
      FROM 项目管理附件
      WHERE 项目编号 = @projectCode
        AND 附件类型 = 'tripartite-agreement'
      ORDER BY 上传时间 DESC, 附件ID DESC
      `,
      { projectCode: code }
    )
    if (existingRows.length > 0) {
      const oldAttachment = existingRows[0]
      const oldFullPath = getFileFullPath(oldAttachment.relativePath, oldAttachment.storedFileName)
      await query(`DELETE FROM 项目管理附件 WHERE 附件ID = @attachmentId`, {
        attachmentId: oldAttachment.id
      })
      try {
        if (fs.existsSync(oldFullPath)) {
          await fsp.unlink(oldFullPath)
        }
      } catch (fileErr) {
        console.warn('删除旧三方协议文件失败:', fileErr)
      }
    }

    const category = getCategoryFromProjectCode(code)
    const safeProjectCode = safeProjectCodeForPath(code)
    const finalRelativeDir = path.posix.join(category, safeProjectCode, '项目管理', '三方协议')
    const finalFullDir = path.join(FILE_ROOT, finalRelativeDir)
    ensureDirSync(finalFullDir)

    const storedFileName = safeFileName(`${customerModelNo}_三方协议.pdf`)
    const finalFile = path.join(finalFullDir, storedFileName)
    await fsp.writeFile(finalFile, pdfBuffer)

    const inserted = await query(
      `
      INSERT INTO 项目管理附件 (
        项目编号,
        附件类型,
        原始文件名,
        存储文件名,
        相对路径,
        文件大小,
        内容类型,
        上传人
      )
      OUTPUT
        INSERTED.附件ID as id,
        INSERTED.上传时间 as uploadedAt
      VALUES (
        @projectCode,
        'tripartite-agreement',
        @originalName,
        @storedFileName,
        @relativePath,
        @fileSize,
        @contentType,
        @uploadedBy
      )
    `,
      {
        projectCode: code,
        originalName: storedFileName,
        storedFileName,
        relativePath: finalRelativeDir,
        fileSize: pdfBuffer.length,
        contentType: 'application/pdf',
        uploadedBy: null
      }
    )

    return res.json({
      code: 0,
      success: true,
      message: '生成三方协议成功',
      data: { id: inserted?.[0]?.id, storedFileName }
    })
  } catch (error) {
    console.error('生成并保存三方协议 pdf 失败:', error)
    return res.status(500).json({
      code: 500,
      success: false,
      message: '生成三方协议失败',
      error: error.message
    })
  }
})

// 生成封样单（xlsx）并保存到“项目管理附件-封样单”（不直接下载）
// 基于模板填充，多产品时每产品一个文件
router.post('/seal-sample-generate-xlsx', async (req, res) => {
  try {
    await ensureProjectAttachmentsTable()

    const { projectCode } = req.body || {}
    const code = String(projectCode || '').trim()
    if (!code) {
      return res.status(400).json({ code: 400, success: false, message: '项目编号不能为空' })
    }

    if (!fs.existsSync(SEAL_SAMPLE_TEMPLATE_PATH)) {
      return res.status(500).json({
        code: 500,
        success: false,
        message: '封样单模板不存在，请联系管理员'
      })
    }

    const row = await loadProjectRowForSealSample(code)
    if (!row) {
      return res.status(404).json({ code: 404, success: false, message: '项目信息不存在' })
    }

    const products = buildSealSampleProducts(row)
    if (products.length === 0) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '请先填写产品列表',
        missing: ['产品列表']
      })
    }

    const productMaterial = String(row?.产品材质 || '').trim()
    const customerModelNo = String(row?.客户模号 || '').trim()
    const mouldCavity = String(row?.模具穴数 || '').trim()
    const designer = String(row?.设计师 || '').trim()
    const todayStr = formatDateForSealSample(new Date())

    // 校验缺少的信息和附件
    const missing = []
    if (!productMaterial) missing.push('项目信息：产品材质')
    if (!customerModelNo) missing.push('项目信息：客户模号')
    if (!mouldCavity) missing.push('项目信息：模具穴数')
    if (!designer) missing.push('项目信息：设计师')

    for (const prod of products) {
      const inspectionPdf = await querySealSampleInspectionReportPdf(code, prod.productDrawing)
      if (!inspectionPdf) {
        missing.push(`产品 ${prod.productDrawing}：检验报告 PDF`)
      }
      const partDrawingPdf = await querySealSamplePartDrawingPdf(code, prod.productDrawing)
      if (!partDrawingPdf) {
        missing.push(`产品 ${prod.productDrawing}：零件图纸 PDF`)
      }
    }

    if (missing.length > 0) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '缺少以下信息，请补充后再生成封样单',
        missing
      })
    }

    // 固定值（按案例文件）
    const FIXED = {
      A2: '/',
      C2: '29256',
      D2: '合肥市久环模具设备制造有限公司',
      E2: '/',
      G2: '注塑模具',
      J2: '美菱',
      N2: '新制模封样'
    }

    // 删除该项目下所有旧封样单附件
    const existingRows = await query(
      `
      SELECT 附件ID as id, 存储文件名 as storedFileName, 相对路径 as relativePath
      FROM 项目管理附件
      WHERE 项目编号 = @projectCode AND 附件类型 = 'seal-sample'
      `,
      { projectCode: code }
    )
    for (const oldAtt of existingRows) {
      await query(`DELETE FROM 项目管理附件 WHERE 附件ID = @attachmentId`, {
        attachmentId: oldAtt.id
      })
      try {
        const oldFullPath = getFileFullPath(oldAtt.relativePath, oldAtt.storedFileName)
        if (fs.existsSync(oldFullPath)) {
          await fsp.unlink(oldFullPath)
        }
      } catch (fileErr) {
        console.warn('删除旧封样单文件失败:', fileErr)
      }
    }

    const category = getCategoryFromProjectCode(code)
    const safeProjectCode = safeProjectCodeForPath(code)
    const finalRelativeDir = path.posix.join(category, safeProjectCode, '项目管理', '封样单')
    const finalFullDir = path.join(FILE_ROOT, finalRelativeDir)
    ensureDirSync(finalFullDir)

    const insertedIds = []
    for (const prod of products) {
      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.readFile(SEAL_SAMPLE_TEMPLATE_PATH)
      const sheet = workbook.worksheets[0]
      if (!sheet) {
        throw new Error('封样单模板格式异常')
      }

      sheet.getCell('A2').value = FIXED.A2
      sheet.getCell('B2').value = `${prod.productDrawing} ${prod.productName}`.trim()
      sheet.getCell('C2').value = FIXED.C2
      sheet.getCell('D2').value = FIXED.D2
      sheet.getCell('E2').value = FIXED.E2
      sheet.getCell('F2').value = productMaterial
      sheet.getCell('G2').value = FIXED.G2
      sheet.getCell('H2').value = prod.productQty
      sheet.getCell('I2').value = customerModelNo
      sheet.getCell('J2').value = FIXED.J2
      sheet.getCell('K2').value = mouldCavity
      sheet.getCell('L2').value = todayStr
      sheet.getCell('M2').value = designer
      sheet.getCell('N2').value = FIXED.N2

      // 插入图片：检验报告（左图）和零件图纸（右图）
      // 仅处理 PDF 格式，其它格式暂不插入
      if (prod.productDrawing) {
        // 左图：检验报告 PDF
        const inspectionReportAtt = await querySealSampleInspectionReportPdf(code, prod.productDrawing)
        const inspectionReportPng = await tryConvertPdfAttachmentToPng(inspectionReportAtt)
        if (inspectionReportPng) {
          const leftImageId = workbook.addImage({
            buffer: inspectionReportPng,
            extension: 'png'
          })
          sheet.addImage(leftImageId, {
            tl: SEAL_SAMPLE_IMAGE_CONFIG.left.tl,
            ext: SEAL_SAMPLE_IMAGE_CONFIG.left.ext
          })
        }

        // 右图：零件图纸 PDF
        const partDrawingAtt = await querySealSamplePartDrawingPdf(code, prod.productDrawing)
        const partDrawingPng = await tryConvertPdfAttachmentToPng(partDrawingAtt)
        if (partDrawingPng) {
          const rightImageId = workbook.addImage({
            buffer: partDrawingPng,
            extension: 'png'
          })
          sheet.addImage(rightImageId, {
            tl: SEAL_SAMPLE_IMAGE_CONFIG.right.tl,
            ext: SEAL_SAMPLE_IMAGE_CONFIG.right.ext
          })
        }
      }

      const xlsxBuffer = await workbook.xlsx.writeBuffer()

      const safeDrawing = safeFileName(prod.productDrawing) || '产品图号'
      const safeName = safeFileName(prod.productName) || '产品名称'
      const baseStoredFileName = safeFileName(`${safeDrawing}_${safeName}_封样单.xlsx`)
      const storedFileName = ensureUniqueFileName(finalFullDir, baseStoredFileName)

      const finalFile = path.join(finalFullDir, storedFileName)
      await fsp.writeFile(finalFile, Buffer.from(xlsxBuffer))

      const inserted = await query(
        `
        INSERT INTO 项目管理附件 (
          项目编号, 附件类型, 原始文件名, 存储文件名, 相对路径,
          文件大小, 内容类型, 上传人, 绑定产品图号, 绑定行序号, 是否孤儿, 孤儿原因, 孤儿行序号
        )
        OUTPUT INSERTED.附件ID as id, INSERTED.上传时间 as uploadedAt
        VALUES (
          @projectCode, 'seal-sample', @originalName, @storedFileName, @relativePath,
          @fileSize, @contentType, @uploadedBy, @bindingDrawing, NULL, 0, NULL, NULL
        )
        `,
        {
          projectCode: code,
          originalName: storedFileName,
          storedFileName,
          relativePath: finalRelativeDir,
          fileSize: Buffer.byteLength(xlsxBuffer),
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          uploadedBy: null,
          bindingDrawing: prod.productDrawing || null
        }
      )
      insertedIds.push(inserted?.[0]?.id)
    }

    return res.json({
      code: 0,
      success: true,
      message: '生成封样单成功',
      data: { ids: insertedIds, count: insertedIds.length }
    })
  } catch (error) {
    console.error('生成并保存封样单 xlsx 失败:', error)
    return res.status(500).json({
      code: 500,
      success: false,
      message: '生成封样单失败',
      error: error.message
    })
  }
})

// 新增项目信息
router.post('/', async (req, res) => {
  try {
    const data = req.body

    // 兼容旧字段：产品图号列表 -> 产品列表
    if (
      data &&
      data.产品列表 === undefined &&
      data.产品图号列表 !== undefined &&
      data.产品图号列表 !== null &&
      data.产品图号列表 !== ''
    ) {
      data.产品列表 = data.产品图号列表
      delete data.产品图号列表
    }

    // 若传入了产品列表/产品名称列表/产品数量列表/产品重量列表，确保数据库字段存在（避免动态 SQL 直接报错）
    if (
      data &&
      (data.产品列表 !== undefined ||
        data.产品名称列表 !== undefined ||
        data.产品数量列表 !== undefined ||
        data.产品重量列表 !== undefined)
    ) {
      const fieldCheck = await query(
        `
          SELECT COLUMN_NAME
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_NAME = '项目管理' AND COLUMN_NAME IN ('产品列表', '产品名称列表', '产品数量列表', '产品重量列表')
        `
      )
      const cols = new Set((fieldCheck || []).map((r) => r.COLUMN_NAME))
      if (data.产品列表 !== undefined && !cols.has('产品列表')) {
        return res.status(500).json({
          code: 500,
          success: false,
          message:
            '数据库表中没有“产品列表”字段，请先执行迁移脚本：backend/migrations/20260125_add_project_management_product_list.sql'
        })
      }
      if (data.产品名称列表 !== undefined && !cols.has('产品名称列表')) {
        return res.status(500).json({
          code: 500,
          success: false,
          message:
            '数据库表中没有“产品名称列表”字段，请先执行迁移脚本：backend/migrations/20260125_add_project_management_product_name_list.sql'
        })
      }
      if (data.产品数量列表 !== undefined && !cols.has('产品数量列表')) {
        return res.status(500).json({
          code: 500,
          success: false,
          message:
            '数据库表中没有“产品数量列表”字段，请先执行迁移脚本：backend/migrations/20260125_add_project_management_product_qty_list.sql'
        })
      }
      if (data.产品重量列表 !== undefined && !cols.has('产品重量列表')) {
        return res.status(500).json({
          code: 500,
          success: false,
          message:
            '数据库表中没有“产品重量列表”字段，请先执行迁移脚本：backend/migrations/20260125_add_project_management_product_weight_list.sql'
        })
      }
    }

    // 构建动态字段
    const fields = []
    const values = []
    const params = {}

    // 处理零件图示：如果是临时图片，移动到正式目录
    // 注意：如果数据库表中还没有此字段，需要先执行迁移脚本
    if (data.零件图示URL && data.项目编号) {
      try {
        const finalUrl = await finalizePartImage(data.项目编号, data.零件图示URL)
        if (finalUrl) {
          data.零件图示URL = finalUrl
        }
      } catch (e) {
        console.warn('处理零件图示失败（可能字段不存在）:', e)
        // 如果字段不存在，忽略此字段，不阻止其他字段的插入
        delete data.零件图示URL
      }
    }

    Object.keys(data).forEach((key) => {
      // 过滤掉 SSMA_TimeStamp 字段（这是数据库迁移字段，不应通过API修改）
      if (
        key !== 'SSMA_TimeStamp' &&
        data[key] !== undefined &&
        data[key] !== null &&
        data[key] !== ''
      ) {
        fields.push(`[${key}]`)
        values.push(`@${key}`)
        params[key] = data[key]
      }
    })

    if (fields.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请至少提供一个字段'
      })
    }

    const queryString = `
      INSERT INTO 项目管理 (${fields.join(', ')})
      VALUES (${values.join(', ')})
    `

    await query(queryString, params)

    res.json({
      code: 0,
      success: true,
      message: '新增项目信息成功'
    })
  } catch (error) {
    console.error('新增项目信息失败:', error)
    res.status(500).json({
      success: false,
      message: '新增项目信息失败',
      error: error.message
    })
  }
})

// 更新项目信息（使用 body 中的 projectCode，避免路径参数包含斜杠的问题）
router.put('/update', async (req, res) => {
  try {
    const { projectCode, ...data } = req.body

    if (!projectCode) {
      return res.status(400).json({
        success: false,
        message: '项目编号不能为空'
      })
    }

    // 兼容旧字段：产品图号列表 -> 产品列表
    if (
      data.产品列表 === undefined &&
      data.产品图号列表 !== undefined &&
      data.产品图号列表 !== null &&
      data.产品图号列表 !== ''
    ) {
      data.产品列表 = data.产品图号列表
      delete data.产品图号列表
    }

    // 若传入了产品列表/产品名称列表/产品数量列表/产品重量列表，确保数据库字段存在（避免动态 SQL 直接报错）
    if (
      data.产品列表 !== undefined ||
      data.产品名称列表 !== undefined ||
      data.产品数量列表 !== undefined ||
      data.产品重量列表 !== undefined
    ) {
      const fieldCheck = await query(
        `
          SELECT COLUMN_NAME
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_NAME = '项目管理' AND COLUMN_NAME IN ('产品列表', '产品名称列表', '产品数量列表', '产品重量列表')
        `
      )
      const cols = new Set((fieldCheck || []).map((r) => r.COLUMN_NAME))
      if (data.产品列表 !== undefined && !cols.has('产品列表')) {
        return res.status(500).json({
          code: 500,
          success: false,
          message:
            '数据库表中没有“产品列表”字段，请先执行迁移脚本：backend/migrations/20260125_add_project_management_product_list.sql'
        })
      }
      if (data.产品名称列表 !== undefined && !cols.has('产品名称列表')) {
        return res.status(500).json({
          code: 500,
          success: false,
          message:
            '数据库表中没有“产品名称列表”字段，请先执行迁移脚本：backend/migrations/20260125_add_project_management_product_name_list.sql'
        })
      }
      if (data.产品数量列表 !== undefined && !cols.has('产品数量列表')) {
        return res.status(500).json({
          code: 500,
          success: false,
          message:
            '数据库表中没有“产品数量列表”字段，请先执行迁移脚本：backend/migrations/20260125_add_project_management_product_qty_list.sql'
        })
      }
      if (data.产品重量列表 !== undefined && !cols.has('产品重量列表')) {
        return res.status(500).json({
          code: 500,
          success: false,
          message:
            '数据库表中没有“产品重量列表”字段，请先执行迁移脚本：backend/migrations/20260125_add_project_management_product_weight_list.sql'
        })
      }
    }

    // 处理零件图示：如果是临时图片，移动到正式目录
    // 注意：如果数据库表中还没有此字段，需要先执行迁移脚本
    if (data.零件图示URL) {
      try {
        // 先检查字段是否存在
        const checkFieldQuery = `
          SELECT COLUMN_NAME 
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_NAME = '项目管理' AND COLUMN_NAME = '零件图示URL'
        `
        const fieldCheck = await query(checkFieldQuery)
        if (!fieldCheck || fieldCheck.length === 0) {
          console.warn(
            '数据库表中没有"零件图示URL"字段，跳过此字段的更新。请执行迁移脚本：backend/migrations/add_part_image_url.sql'
          )
          // 字段不存在，移除该字段，不阻止其他字段的更新
          delete data.零件图示URL
        } else {
          // 字段存在，处理图片移动（更新操作，需要删除旧文件）
          const finalUrl = await finalizePartImage(projectCode, data.零件图示URL, true)
          if (finalUrl) {
            data.零件图示URL = finalUrl
          }
        }
      } catch (e) {
        console.warn('处理零件图示失败:', e)
        // 如果处理失败，移除该字段，不阻止其他字段的更新
        delete data.零件图示URL
      }
    }

    // 构建动态更新字段
    const updates = []
    const params = { projectCode }

    Object.keys(data).forEach((key) => {
      const value = data[key]
      // 过滤掉项目编号字段、SSMA_TimeStamp 字段，以及 undefined（允许显式传 null 来将字段置为 NULL）
      if (key !== '项目编号' && key !== 'SSMA_TimeStamp' && value !== undefined) {
        updates.push(`[${key}] = @${key}`)
        params[key] = value === undefined ? null : value
      }
    })

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请至少提供一个要更新的字段'
      })
    }

    const queryString = `
      UPDATE 项目管理 
      SET ${updates.join(', ')}
      WHERE 项目编号 = @projectCode
    `

    console.log('[更新项目] 执行SQL:', queryString.substring(0, 200))
    console.log('[更新项目] 参数:', Object.keys(params))
    await query(queryString, params)

    res.json({
      code: 0,
      success: true,
      message: '更新项目信息成功'
    })
  } catch (error) {
    console.error('更新项目信息失败:', error)
    console.error('错误堆栈:', error.stack)
    console.error('错误详情:', {
      message: error.message,
      code: error.code,
      number: error.number,
      state: error.state
    })
    res.status(500).json({
      success: false,
      message: '更新项目信息失败',
      error: error.message,
      details:
        process.env.NODE_ENV === 'development'
          ? {
              code: error.code,
              number: error.number,
              state: error.state
            }
          : undefined
    })
  }
})

// 删除项目信息（使用 query 参数，避免路径参数包含斜杠的问题）
router.delete('/delete', async (req, res) => {
  try {
    const { projectCode } = req.query

    if (!projectCode) {
      return res.status(400).json({
        success: false,
        message: '项目编号不能为空'
      })
    }

    const queryString = `DELETE FROM 项目管理 WHERE 项目编号 = @projectCode`

    await query(queryString, { projectCode })

    res.json({
      code: 0,
      success: true,
      message: '删除项目信息成功'
    })
  } catch (error) {
    console.error('删除项目信息失败:', error)
    res.status(500).json({
      success: false,
      message: '删除项目信息失败',
      error: error.message
    })
  }
})

// 批量导入移模单明细：按项目编号写入 制件厂家/移模日期/封样单号（字段级跳过已有或覆盖）
router.post('/relocation-import', async (req, res) => {
  try {
    const { overwriteMode, mouldMoveDate, items } = req.body || {}

    const mode = String(overwriteMode || '').trim()
    if (mode !== 'overwrite' && mode !== 'skipExisting') {
      return res.status(400).json({
        code: 400,
        success: false,
        message: 'overwriteMode 必须为 overwrite 或 skipExisting'
      })
    }

    const globalMoveDate = String(mouldMoveDate || '').trim()

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ code: 400, success: false, message: 'items 不能为空' })
    }

    // 确认封样单号字段存在（避免直接 UPDATE 报错）
    const sealFieldCheck = await query(
      `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = '项目管理' AND COLUMN_NAME = '封样单号'
      `
    )
    if (!sealFieldCheck || sealFieldCheck.length === 0) {
      return res.status(500).json({
        code: 500,
        success: false,
        message:
          '数据库表中没有“封样单号”字段，请先执行迁移脚本：backend/migrations/20260124_add_project_management_seal_sample_no.sql'
      })
    }

    const isEmptyValue = (v) => v === null || v === undefined || String(v).trim() === ''

    const results = []

    for (const it of items) {
      const projectCode = String(it?.projectCode || '').trim()
      const moveTo = String(it?.moveTo || '').trim()
      const sealSampleNo = String(it?.sealSampleNo || '').trim()
      const moveDate = String(it?.mouldMoveDate || globalMoveDate).trim()

      if (!projectCode) {
        results.push({ projectCode: '', ok: false, message: '项目编号不能为空' })
        continue
      }

      if (!moveDate) {
        results.push({ projectCode, ok: false, message: 'mouldMoveDate 不能为空' })
        continue
      }

      // 检查项目是否存在及当前值
      const rows = await query(
        `
        SELECT TOP 1
          项目编号,
          制件厂家,
          移模日期,
          封样单号
        FROM 项目管理
        WHERE 项目编号 = @projectCode
        `,
        { projectCode }
      )

      if (!rows || rows.length === 0) {
        results.push({ projectCode, ok: false, message: '项目不存在' })
        continue
      }

      const current = rows[0] || {}

      const updates = {}
      const skipped = []
      const updated = []

      // 制件厂家 = 移至地方
      if (isEmptyValue(moveTo)) {
        skipped.push('制件厂家')
      } else if (mode === 'overwrite' || isEmptyValue(current.制件厂家)) {
        updates['制件厂家'] = moveTo
      } else {
        skipped.push('制件厂家')
      }

      // 移模日期 = 模具移模时间（公共信息）
      if (mode === 'overwrite' || isEmptyValue(current.移模日期)) {
        updates['移模日期'] = moveDate
      } else {
        skipped.push('移模日期')
      }

      // 封样单号 = 明细封样单号
      if (isEmptyValue(sealSampleNo)) {
        skipped.push('封样单号')
      } else if (mode === 'overwrite' || isEmptyValue(current.封样单号)) {
        updates['封样单号'] = sealSampleNo
      } else {
        skipped.push('封样单号')
      }

      Object.keys(updates).forEach((k) => updated.push(k))

      if (updated.length === 0) {
        results.push({ projectCode, ok: true, updatedFields: [], skippedFields: skipped })
        continue
      }

      const setParts = updated.map((k) => `[${k}] = @${k}`)
      const params = { projectCode }
      for (const k of updated) params[k] = updates[k]

      const updateSql = `
        UPDATE 项目管理
        SET ${setParts.join(', ')}
        WHERE 项目编号 = @projectCode
      `
      await query(updateSql, params)

      results.push({ projectCode, ok: true, updatedFields: updated, skippedFields: skipped })
    }

    return res.json({
      code: 0,
      success: true,
      data: { results }
    })
  } catch (error) {
    console.error('批量导入移模单失败:', error)
    return res.status(500).json({
      code: 500,
      success: false,
      message: '批量导入移模单失败',
      error: error.message
    })
  }
})

// 解析移模通知单（外调）PDF：后端统一解析（比浏览器 pdf.js 更稳定，便于排障/升级为 OCR）
const relocationPdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 }
})

router.post('/relocation-parse-pdf', relocationPdfUpload.single('file'), async (req, res) => {
  try {
    const file = req.file
    if (!file || !file.buffer) {
      return res.status(400).json({ code: 400, success: false, message: '缺少 PDF 文件（file）' })
    }

    try {
      const result = await parseMouldTransferPdf(file.buffer)
      return res.json({ code: 0, success: true, data: result })
    } catch (error) {
      const msg = String(error?.message || '')
      const shouldOcrFallback =
        /需要 OCR/.test(msg) ||
        /未提取到任何文字/.test(msg) ||
        /文字太少/.test(msg) ||
        /未找到明细表表头/.test(msg) ||
        /未识别到明细行/.test(msg)

      const ocrBaseUrl = String(process.env.RELOCATION_OCR_URL || process.env.OCR_SERVICE_URL || '')
        .trim()
        .replace(/\/+$/, '')
      const ocrEnabled = !!ocrBaseUrl && process.env.RELOCATION_OCR_DISABLED !== '1'

      if (!shouldOcrFallback || !ocrEnabled) throw error

      const scale = Number(process.env.RELOCATION_OCR_PDF_SCALE || 3)
      const timeoutMs = Number(process.env.RELOCATION_OCR_TIMEOUT_MS || 20000)

      // 1) PDF -> PNG (first page)
      const pngBuffer = await pdfFirstPageToPngBuffer(file.buffer, { scale, page: 1 })

      // 2) OCR -> tokens
      const ocrData = await ocrMouldTransferPng(pngBuffer, { baseUrl: ocrBaseUrl, timeoutMs })

      // 3) Reuse the same parser on OCR tokens (pixel coordinate system)
      const tokens = Array.isArray(ocrData?.tokens) ? ocrData.tokens : []
      const pageWidth = Number(ocrData?.pageWidth || 0)
      const pageHeight = Number(ocrData?.pageHeight || 0)
      const fullText = String(ocrData?.fullText || '')

      const result = parseMouldTransferFromTokens({ tokens, pageWidth, pageHeight, fullText })
      return res.json({ code: 0, success: true, data: result })
    }
  } catch (error) {
    return res.status(400).json({
      code: 400,
      success: false,
      message: error?.message || '解析 PDF 失败'
    })
  }
})

// === 项目管理附件相关接口 ===

// 上传附件
// 注意：项目编号可能包含斜杠（例如 JH05-25-044/01），Express 会在路由匹配前将 %2F 解码为 /
// 使用 :projectCode(*) 以便参数可跨越多个 path segment
router.post('/:projectCode(*)/attachments/:type', uploadSingleAttachment, async (req, res) => {
  try {
    await ensureProjectAttachmentsTable()
    const projectCode = String(req.params.projectCode || '').trim()
    const type = String(req.params.type || '').trim()

    if (!projectCode) {
      return res.status(400).json({ code: 400, success: false, message: '项目编号不能为空' })
    }

    // 附件类型：移模流程单、试模记录表、三方协议、试模单、技术规格表、图档、封样单、检验报告、零件图纸
    const validTypes = [
      'relocation-process',
      'trial-record',
      'tripartite-agreement',
      'trial-form',
      'technical-spec',
      'drawing',
      'seal-sample',
      'inspection-report',
      'part-drawing'
    ]
    if (!validTypes.includes(type)) {
      return res.status(400).json({ code: 400, success: false, message: '附件类型不合法' })
    }

    // 检查项目是否存在
    const projectRows = await query(
      `SELECT TOP 1 项目编号 FROM 项目管理 WHERE 项目编号 = @projectCode`,
      {
        projectCode
      }
    )
    if (!projectRows.length) {
      return res.status(404).json({ code: 404, success: false, message: '项目不存在' })
    }

    const file = req.file
    if (!file) {
      return res.status(400).json({ code: 400, success: false, message: '未找到上传文件' })
    }

    // 零件图纸需先取 bindingDrawing，用于生成文件名 项目编号_产品图号_产品名称.扩展名
    let partDrawingBinding = null
    if (type === 'part-drawing') {
      partDrawingBinding = String(req.body?.drawing || '').trim() || null
      if (!partDrawingBinding) {
        return res.status(400).json({
          code: 400,
          success: false,
          message: '零件图纸需要提供 drawing（产品图号）进行绑定'
        })
      }
    }

    // 检验报告需先取 drawing/rowIndex，用于生成文件名 项目编号_产品图号_产品名称.扩展名
    let inspectionReportDrawing = null
    let inspectionReportRowIndex = null
    if (type === 'inspection-report') {
      inspectionReportDrawing = String(req.body?.drawing || '').trim() || null
      const rowIndexRaw = req.body?.rowIndex
      inspectionReportRowIndex =
        rowIndexRaw === undefined || rowIndexRaw === null || String(rowIndexRaw).trim() === ''
          ? null
          : parseInt(String(rowIndexRaw), 10)
      if (
        !inspectionReportDrawing &&
        (inspectionReportRowIndex === null || Number.isNaN(inspectionReportRowIndex))
      ) {
        return res.status(400).json({
          code: 400,
          success: false,
          message: '检验报告需要提供 drawing 或 rowIndex 进行绑定'
        })
      }
    }

    // 查询客户模号
    const customerModelNo = await getCustomerModelNo(projectCode)

    // 安全化项目编号（用于路径）
    const category = getCategoryFromProjectCode(projectCode)
    const safeProjectCode = safeProjectCodeForPath(projectCode)

    // 附件类型中文名称映射
    const typeDirMap = {
      'relocation-process': '移模流程单',
      'trial-record': '试模记录表',
      'tripartite-agreement': '三方协议',
      'trial-form': '试模单',
      'technical-spec': '技术规格表',
      drawing: '图档',
      'seal-sample': '封样单',
      'inspection-report': '检验报告',
      'part-drawing': '零件图纸'
    }
    const typeDirName = typeDirMap[type]

    // 计算最终存储路径：{分类}/{项目编号}/项目管理/{附件类型}/
    const finalRelativeDir = path.posix.join(category, safeProjectCode, '项目管理', typeDirName)
    const finalFullDir = path.join(FILE_ROOT, finalRelativeDir)
    ensureDirSync(finalFullDir)

    // 生成存储文件名
    const originalName = normalizeAttachmentFileName(file.originalname)
    let newFileName = ''

    if (type === 'trial-form') {
      // 试模单：需要计算序号
      const sequence = await getNextTrialFormSequence(projectCode)
      const ext = originalName.split('.').pop()?.toLowerCase() || ''
      const safeExt = ext ? `.${ext}` : ''
      newFileName = `${projectCode}_试模单_${sequence}${safeExt}`
    } else if (type === 'technical-spec') {
      newFileName = generateAttachmentFileName(projectCode, customerModelNo, type, originalName)
    } else if (type === 'drawing' || type === 'part-drawing') {
      const ext = originalName.split('.').pop()?.toLowerCase() || ''
      const extLower = ext.toLowerCase()
      const allowed3DExts = new Set([
        'prt',
        'x_t',
        'x_b',
        'stp',
        'step',
        'igs',
        'iges',
        'sldprt',
        'sldasm',
        'asm',
        'par',
        'psm',
        'catpart',
        'catproduct'
      ])
      if (extLower !== 'pdf' && extLower !== 'dwg' && !allowed3DExts.has(extLower)) {
        return res.status(400).json({
          code: 400,
          success: false,
          message:
            type === 'part-drawing'
              ? '零件图纸仅支持 .pdf / .dwg / 常见三维图纸格式（.prt .x_t .stp 等）'
              : '图档仅支持 .pdf / .dwg / 常见三维图纸格式（.prt .x_t .stp 等）'
        })
      }
      if (type === 'part-drawing') {
        // 零件图纸：存储文件名格式 项目编号_产品图号_产品名称.扩展名
        let productName = partDrawingBinding
        try {
          const projRows = await query(
            `SELECT TOP 1 产品列表, 产品名称列表 FROM 项目管理 WHERE 项目编号 = @projectCode`,
            { projectCode }
          )
          if (projRows.length > 0) {
            const drawings = parseJsonArray(projRows[0].产品列表, []).map((d) =>
              String(d ?? '').trim()
            )
            const names = parseJsonArray(projRows[0].产品名称列表, []).map((n) =>
              String(n ?? '').trim()
            )
            const idx = drawings.findIndex((d) => d === partDrawingBinding)
            if (idx >= 0 && names[idx]) {
              productName = names[idx]
            }
          }
        } catch (e) {
          // 查不到时用产品图号作为产品名称
        }
        const safeExt = ext ? `.${ext}` : ''
        const partProject = safeFileName(projectCode) || '项目'
        const partDrawing = safeFileName(partDrawingBinding) || '图号'
        const partName = safeFileName(productName) || '未命名'
        newFileName = `${partProject}_${partDrawing}_${partName}${safeExt}`
      } else {
        newFileName = generateAttachmentFileName(
          projectCode,
          customerModelNo,
          type,
          originalName
        )
      }
    } else if (type === 'inspection-report') {
      // 检验报告：存储文件名格式 项目编号_产品图号_产品名称_检验报告.扩展名
      let productDrawing = inspectionReportDrawing
      let productName = inspectionReportDrawing || '未命名'
      try {
        const projRows = await query(
          `SELECT TOP 1 产品列表, 产品名称列表 FROM 项目管理 WHERE 项目编号 = @projectCode`,
          { projectCode }
        )
        if (projRows.length > 0) {
          const drawings = parseJsonArray(projRows[0].产品列表, []).map((d) =>
            String(d ?? '').trim()
          )
          const names = parseJsonArray(projRows[0].产品名称列表, []).map((n) =>
            String(n ?? '').trim()
          )
          let idx = -1
          if (inspectionReportDrawing) {
            idx = drawings.findIndex((d) => d === inspectionReportDrawing)
            if (idx >= 0 && names[idx]) productName = names[idx]
          } else if (
            inspectionReportRowIndex !== null &&
            !Number.isNaN(inspectionReportRowIndex) &&
            inspectionReportRowIndex >= 0 &&
            inspectionReportRowIndex < drawings.length
          ) {
            idx = inspectionReportRowIndex
            productDrawing = drawings[idx] || '图号'
            productName = names[idx] || productDrawing
          }
        }
      } catch (e) {
        // 查不到时用 drawing 或“未命名”
      }
      const ext = originalName.split('.').pop()?.toLowerCase() || ''
      const safeExt = ext ? `.${ext}` : ''
      const partProject = safeFileName(projectCode) || '项目'
      const partDrawing = safeFileName(productDrawing) || '图号'
      const partName = safeFileName(productName) || '未命名'
      newFileName = `${partProject}_${partDrawing}_${partName}_检验报告${safeExt}`
    } else {
      // 其他类型：使用固定格式
      newFileName = generateAttachmentFileName(projectCode, customerModelNo, type, originalName)
    }

    const safeNewFileName = safeFileName(newFileName)
    const finalStoredFileName = ['drawing', 'inspection-report', 'part-drawing'].includes(type)
      ? ensureUniqueFileName(finalFullDir, safeNewFileName)
      : safeNewFileName

    // 检验报告绑定字段：drawing / rowIndex（0-based）；零件图纸绑定：drawing（产品图号）
    let bindingDrawing = null
    let bindingRowIndex = null
    if (type === 'part-drawing') {
      bindingDrawing = partDrawingBinding
    } else if (type === 'inspection-report') {
      bindingDrawing = inspectionReportDrawing
      bindingRowIndex = inspectionReportRowIndex

      const ext = String(path.extname(originalName || '') || '').toLowerCase().replace('.', '')
      const isPdf = ext === 'pdf'
      const isExcel = ext === 'xls' || ext === 'xlsx'
      const isImage = String(file.mimetype || '').toLowerCase().startsWith('image/')
      if (!isPdf && !isExcel && !isImage) {
        return res.status(400).json({
          code: 400,
          success: false,
          message: '检验报告仅支持 PDF / Excel（.xls .xlsx）/ 图片文件'
        })
      }
    }

    // 单文件类型（移模流程单、试模记录表、三方协议、封样单、技术规格表）：删除旧文件
    const singleFileTypes = [
      'relocation-process',
      'trial-record',
      'tripartite-agreement',
      'seal-sample',
      'technical-spec'
    ]
    if (singleFileTypes.includes(type)) {
      const existingRows = await query(
        `
        SELECT TOP 1
          附件ID as id,
          存储文件名 as storedFileName,
          相对路径 as relativePath
        FROM 项目管理附件
        WHERE 项目编号 = @projectCode
          AND 附件类型 = @type
        ORDER BY 上传时间 DESC, 附件ID DESC
        `,
        { projectCode, type }
      )

      if (existingRows.length > 0) {
        const oldAttachment = existingRows[0]
        const oldFullPath = getFileFullPath(
          oldAttachment.relativePath,
          oldAttachment.storedFileName
        )

        // 删除旧文件的数据库记录
        await query(`DELETE FROM 项目管理附件 WHERE 附件ID = @attachmentId`, {
          attachmentId: oldAttachment.id
        })

        // 删除旧文件的物理文件
        try {
          if (fs.existsSync(oldFullPath)) {
            await fsp.unlink(oldFullPath)
          }
        } catch (fileErr) {
          console.warn('删除旧附件文件失败:', fileErr)
        }
      }
    }

    // 将文件从临时目录移动到最终目录
    const tempFile = path.join(
      req._tempAttachmentFullDir || FILE_ROOT,
      req._attachmentStoredFileName || file.filename
    )
    const finalFile = path.join(finalFullDir, finalStoredFileName)

    await moveFileWithFallback(tempFile, finalFile)

    // 清理空临时目录
    try {
      const tempDir = req._tempAttachmentFullDir
      if (tempDir && fs.existsSync(tempDir)) {
        const files = await fsp.readdir(tempDir)
        if (files.length === 0) {
          await fsp.rmdir(tempDir)
          const parentTempDir = path.dirname(tempDir)
          const parentFiles = await fsp.readdir(parentTempDir).catch(() => [])
          if (parentFiles.length === 0) {
            await fsp.rmdir(parentTempDir).catch(() => {})
          }
        }
      }
    } catch (cleanupErr) {
      console.warn('清理临时目录失败:', cleanupErr)
    }

    // 插入数据库记录
    const inserted = await query(
      `
      INSERT INTO 项目管理附件 (
        项目编号,
        附件类型,
        原始文件名,
        存储文件名,
        相对路径,
        文件大小,
        内容类型,
        上传人,
        绑定产品图号,
        绑定行序号,
        是否孤儿,
        孤儿原因,
        孤儿行序号
      )
      OUTPUT
        INSERTED.附件ID as id,
        INSERTED.上传时间 as uploadedAt
      VALUES (
        @projectCode,
        @type,
        @originalName,
        @storedFileName,
        @relativePath,
        @fileSize,
        @contentType,
        @uploadedBy,
        @bindingDrawing,
        @bindingRowIndex,
        0,
        NULL,
        NULL
      )
    `,
      {
        projectCode,
        type,
        originalName,
        storedFileName: finalStoredFileName,
        relativePath: finalRelativeDir,
        fileSize: file.size,
        contentType: file.mimetype || null,
        uploadedBy: null,
        bindingDrawing,
        bindingRowIndex
      }
    )

    res.json({
      code: 0,
      success: true,
      message: '上传附件成功',
      data: {
        id: inserted?.[0]?.id,
        projectCode,
        type,
        originalName,
        storedFileName: finalStoredFileName,
        relativePath: finalRelativeDir,
        fileSize: file.size,
        contentType: file.mimetype || null,
        uploadedAt: inserted?.[0]?.uploadedAt
      }
    })
  } catch (error) {
    console.error('上传项目管理附件失败:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: '上传项目管理附件失败',
      error: error.message
    })
  }
})

// 获取附件列表
// 注意：项目编号可能包含斜杠（例如 JH05-25-044/01），Express 会在路由匹配前将 %2F 解码为 /
// 使用 :projectCode(*) 以便参数可跨越多个 path segment
router.get('/:projectCode(*)/attachments', async (req, res) => {
  try {
    await ensureProjectAttachmentsTable()
    const projectCode = String(req.params.projectCode || '').trim()
    const type = String(req.query.type || '').trim()

    if (!projectCode) {
      return res.status(400).json({ code: 400, success: false, message: '项目编号不能为空' })
    }

    const params = { projectCode }
    const whereType = type ? 'AND 附件类型 = @type' : ''
    if (type) params.type = type

    const rows = await query(
      `
      SELECT
        附件ID as id,
        项目编号 as projectCode,
        附件类型 as type,
        原始文件名 as originalName,
        存储文件名 as storedFileName,
        相对路径 as relativePath,
        文件大小 as fileSize,
        内容类型 as contentType,
        上传时间 as uploadedAt,
        上传人 as uploadedBy,
        绑定产品图号 as drawing
      FROM 项目管理附件
      WHERE 项目编号 = @projectCode
      ${whereType}
      ORDER BY 上传时间 DESC, 附件ID DESC
    `,
      params
    )

    res.json({ code: 0, success: true, data: rows })
  } catch (error) {
    console.error('获取项目管理附件列表失败:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: '获取项目管理附件列表失败',
      error: error.message
    })
  }
})

// === 试模过程（独立页面）===

const uploadTrialProcessAttachments = (req, res, next) => {
  uploadAttachment.array('file', 20)(req, res, (err) => {
    if (!err) return next()
    const message =
      err?.code === 'LIMIT_FILE_SIZE'
        ? `上传失败：单个附件不能超过 ${Math.round(MAX_ATTACHMENT_SIZE_BYTES / 1024 / 1024)}MB`
        : err?.message || '上传失败'
    res.status(400).json({ code: 400, success: false, message })
  })
}

const getTrialProcessRow = async (projectCode, trialNo) => {
  const rows = await query(
    `
    SELECT TOP 1
      tp.试模过程ID as id,
      tp.项目编号 as projectCode,
      tp.试模次数 as trialNo,
      tp.试模日期 as trialDate,
      tp.试模类别 as trialCategory,
      pm.产品材质 as productMaterial,
      pm.产品颜色 as productColor,
      tp.试模产品数量 as trialProductQty,
      tp.注塑机吨位 as machineTonnage,
      tp.色母型号 as masterbatchModel,
      tp.试模单位 as trialUnit,
      tp.试模时长 as trialDuration,
      tp.外协试模 as isOutsourced,
      tp.备注 as remark,
      tp.是否作废 as isVoid,
      CONVERT(varchar(23), tp.创建时间, 126) + '+08:00' as createdAt,
      tp.创建人 as createdBy,
      CONVERT(varchar(23), tp.更新时间, 126) + '+08:00' as updatedAt,
      tp.更新人 as updatedBy
    FROM 试模过程 tp
    LEFT JOIN 项目管理 pm ON tp.项目编号 = pm.项目编号
    WHERE tp.项目编号 = @projectCode
      AND tp.试模次数 = @trialNo
      AND tp.是否作废 = 0
  `,
    { projectCode, trialNo }
  )
  return rows?.[0] || null
}

// 获取试模过程列表
router.get('/:projectCode(*)/trial-processes', async (req, res) => {
  try {
    await ensureTrialProcessTables()
    const projectCode = String(req.params.projectCode || '').trim()
    if (!projectCode) {
      return res.status(400).json({ code: 400, success: false, message: '项目编号不能为空' })
    }

    const rows = await query(
      `
      SELECT
        tp.试模过程ID as id,
        tp.项目编号 as projectCode,
        tp.试模次数 as trialNo,
        CONVERT(varchar(10), tp.试模日期, 23) as trialDate,
        tp.试模类别 as trialCategory,
        pm.产品材质 as productMaterial,
        pm.产品颜色 as productColor,
        tp.试模产品数量 as trialProductQty,
        tp.注塑机吨位 as machineTonnage,
        tp.色母型号 as masterbatchModel,
        tp.试模单位 as trialUnit,
        tp.试模时长 as trialDuration,
        tp.外协试模 as isOutsourced,
        tp.备注 as remark,
        CONVERT(varchar(23), tp.创建时间, 126) + '+08:00' as createdAt,
        tp.创建人 as createdBy,
        CONVERT(varchar(23), tp.更新时间, 126) + '+08:00' as updatedAt,
        tp.更新人 as updatedBy,
        (SELECT COUNT(1) FROM 试模过程附件 a WHERE a.试模过程ID = tp.试模过程ID) as attachmentCount
      FROM 试模过程 tp
      LEFT JOIN 项目管理 pm ON tp.项目编号 = pm.项目编号
      WHERE tp.项目编号 = @projectCode
        AND tp.是否作废 = 0
      ORDER BY tp.试模次数 ASC, tp.试模过程ID ASC
    `,
      { projectCode }
    )

    return res.json({ code: 0, success: true, data: rows })
  } catch (error) {
    console.error('获取试模过程列表失败:', error)
    return res.status(500).json({
      code: 500,
      success: false,
      message: '获取试模过程列表失败',
      error: error.message
    })
  }
})

// 获取试模过程详情
router.get('/:projectCode(*)/trial-processes/:trialNo', async (req, res) => {
  try {
    await ensureTrialProcessTables()
    const projectCode = String(req.params.projectCode || '').trim()
    const trialNo = parseInt(String(req.params.trialNo || ''), 10)
    if (!projectCode) {
      return res.status(400).json({ code: 400, success: false, message: '项目编号不能为空' })
    }
    if (!Number.isInteger(trialNo) || trialNo <= 0) {
      return res.status(400).json({ code: 400, success: false, message: '试模次数不合法' })
    }

    const row = await getTrialProcessRow(projectCode, trialNo)
    if (!row || row.isVoid) {
      return res.status(404).json({ code: 404, success: false, message: '试模过程不存在' })
    }

    row.trialDate = formatDateYYYYMMDD(row.trialDate)
    return res.json({ code: 0, success: true, data: row })
  } catch (error) {
    console.error('获取试模过程详情失败:', error)
    return res.status(500).json({
      code: 500,
      success: false,
      message: '获取试模过程详情失败',
      error: error.message
    })
  }
})

// 新建试模过程：同一项目内试模次数从 1 递增（并发安全）
router.post('/:projectCode(*)/trial-processes', async (req, res) => {
  try {
    await ensureTrialProcessTables()
    const projectCode = String(req.params.projectCode || '').trim()
    if (!projectCode) {
      return res.status(400).json({ code: 400, success: false, message: '项目编号不能为空' })
    }

    const projectRows = await query(
      `
      SELECT TOP 1
        项目编号,
        模具尺寸,
        模具重量,
        产品重量,
        产品重量列表,
        产品材质,
        产品颜色
      FROM 项目管理
      WHERE 项目编号 = @projectCode
    `,
      { projectCode }
    )
    if (!projectRows.length) {
      return res.status(404).json({ code: 404, success: false, message: '项目不存在' })
    }
    const projectRow = projectRows[0] || {}
    const productWeightSum = resolveProductWeightFromProjectRow(projectRow)
    const requiredChecks = [
      { key: '模具尺寸', label: '模具尺寸' },
      { key: '模具重量', label: '模具重量' },
      { key: '__productWeight', label: '产品重量' },
      { key: '产品材质', label: '产品材质' },
      { key: '产品颜色', label: '产品颜色' }
    ]
    const missingFields = requiredChecks
      .filter((item) => {
        if (item.key === '__productWeight') return productWeightSum === null
        const value = projectRow[item.key]
        if (value === null || value === undefined) return true
        if (typeof value === 'number') return !Number.isFinite(value)
        return String(value).trim().length === 0
      })
      .map((item) => item.label)
    if (missingFields.length > 0) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '新建试模记录前，请先补全项目信息检查清单',
        missing: missingFields
      })
    }

    const body = req.body || {}
    const trialDate = formatDateYYYYMMDD(body.trialDate || body.试模日期 || '')
    if (!trialDate) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '试模日期不能为空'
      })
    }
    const trialProductQty = parsePositiveInt(body.trialProductQty ?? body.试模产品数量)
    if (!trialProductQty) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '试模产品数量不能为空且必须为正整数'
      })
    }

    const machineTonnage = parsePositiveInt(body.machineTonnage ?? body.注塑机吨位)
    const trialDuration = parseOptionalDecimal(body.trialDuration ?? body.试模时长)
    const isOutsourcedRaw = body.isOutsourced ?? body.外协试模
    const isOutsourced =
      isOutsourcedRaw === true ||
      isOutsourcedRaw === 1 ||
      String(isOutsourcedRaw || '').trim() === '1' ||
      String(isOutsourcedRaw || '').trim().toLowerCase() === 'true'

    const createdBy = resolveUsernameFromReq(req)

    const masterbatchModel = String(body.masterbatchModel ?? body.色母型号 ?? '').trim() || null
    const trialUnit = String(body.trialUnit ?? body.试模单位 ?? '').trim() || null
    const remark = String(body.remark ?? body.备注 ?? '').trim() || null

    const requestedCategory = String(body.trialCategory ?? body.试模类别 ?? '').trim()

    const inserted = await query(
      `
      ;WITH activeNo AS (
        SELECT 试模次数 AS n
        FROM dbo.试模过程 WITH (UPDLOCK, HOLDLOCK)
        WHERE 项目编号 = @projectCode
          AND 是否作废 = 0
      ),
      nextNo AS (
        SELECT
          CASE
            WHEN NOT EXISTS (SELECT 1 FROM activeNo WHERE n = 1) THEN 1
            ELSE (
              SELECT TOP 1 a.n + 1
              FROM activeNo a
              LEFT JOIN activeNo b ON b.n = a.n + 1
              WHERE b.n IS NULL
              ORDER BY a.n
            )
          END AS n,
          (SELECT COUNT(1) FROM activeNo) AS activeCount
      ),
      prevNo AS (
        SELECT MAX(n) AS prevTrialNo
        FROM activeNo
        WHERE n < (SELECT n FROM nextNo)
      ),
      prevProcess AS (
        SELECT TOP 1
          p.试模过程ID AS prevProcessId,
          p.试模日期 AS prevTrialDate
        FROM dbo.试模过程 p
        CROSS JOIN prevNo
        WHERE p.项目编号 = @projectCode
          AND p.是否作废 = 0
          AND p.试模次数 = prevNo.prevTrialNo
      ),
      prevAttachment AS (
        SELECT COUNT(1) AS prevAttachmentCount
        FROM dbo.试模过程附件 a
        CROSS JOIN prevProcess
        WHERE a.试模过程ID = prevProcess.prevProcessId
      )
      INSERT INTO dbo.试模过程 (
        项目编号,
        试模次数,
        试模日期,
        试模类别,
        产品数量,
        试模产品数量,
        注塑机吨位,
        成型周期,
        色母型号,
        试模单位,
        试模时长,
        外协试模,
        备注,
        创建人
      )
      OUTPUT
        INSERTED.试模过程ID as id,
        INSERTED.试模次数 as trialNo
      SELECT
        @projectCode,
        n,
        @trialDate,
        CASE
          WHEN activeCount = 0 THEN N'T0'
          WHEN @trialCategory IN (N'工程变更', N'细节优化', N'客户更改', N'封样') THEN @trialCategory
          ELSE NULL
        END,
        @trialProductQty,
        @trialProductQty,
        @machineTonnage,
        NULL,
        @masterbatchModel,
        @trialUnit,
        @trialDuration,
        @isOutsourced,
        @remark,
        @createdBy
      FROM nextNo
      LEFT JOIN prevProcess ON 1 = 1
      LEFT JOIN prevAttachment ON 1 = 1
      WHERE
        nextNo.activeCount = 0
        OR (
          ISNULL(prevAttachment.prevAttachmentCount, 0) > 0
          AND (
            prevProcess.prevTrialDate IS NULL
            OR CONVERT(date, @trialDate) >= CONVERT(date, prevProcess.prevTrialDate)
          )
        )
    `,
      {
        projectCode,
        trialDate: trialDate || null,
        trialCategory: requestedCategory || null,
        trialProductQty,
        machineTonnage: machineTonnage || null,
        masterbatchModel,
        trialUnit,
        trialDuration,
        isOutsourced,
        remark,
        createdBy
      }
    )

    const id = inserted?.[0]?.id
    const trialNo = inserted?.[0]?.trialNo
    if (!id || !trialNo) {
      const checkRows = await query(
        `
        ;WITH activeNo AS (
          SELECT 试模次数 AS n
          FROM dbo.试模过程
          WHERE 项目编号 = @projectCode
            AND 是否作废 = 0
        ),
        nextNo AS (
          SELECT
            CASE
              WHEN NOT EXISTS (SELECT 1 FROM activeNo WHERE n = 1) THEN 1
              ELSE (
                SELECT TOP 1 a.n + 1
                FROM activeNo a
                LEFT JOIN activeNo b ON b.n = a.n + 1
                WHERE b.n IS NULL
                ORDER BY a.n
              )
            END AS n,
            (SELECT COUNT(1) FROM activeNo) AS activeCount
        ),
        prevNo AS (
          SELECT MAX(n) AS prevTrialNo
          FROM activeNo
          WHERE n < (SELECT n FROM nextNo)
        ),
        prevProcess AS (
          SELECT TOP 1
            p.试模过程ID AS prevProcessId,
            CONVERT(varchar(10), p.试模日期, 23) AS prevTrialDate
          FROM dbo.试模过程 p
          CROSS JOIN prevNo
          WHERE p.项目编号 = @projectCode
            AND p.是否作废 = 0
            AND p.试模次数 = prevNo.prevTrialNo
        ),
        prevAttachment AS (
          SELECT COUNT(1) AS prevAttachmentCount
          FROM dbo.试模过程附件 a
          CROSS JOIN prevProcess
          WHERE a.试模过程ID = prevProcess.prevProcessId
        )
        SELECT
          nextNo.activeCount AS activeCount,
          prevNo.prevTrialNo AS prevTrialNo,
          prevProcess.prevTrialDate AS prevTrialDate,
          ISNULL(prevAttachment.prevAttachmentCount, 0) AS prevAttachmentCount
        FROM nextNo
        LEFT JOIN prevNo ON 1 = 1
        LEFT JOIN prevProcess ON 1 = 1
        LEFT JOIN prevAttachment ON 1 = 1
      `,
        { projectCode }
      )
      const check = checkRows?.[0] || null
      if (check?.activeCount > 0 && Number(check?.prevAttachmentCount || 0) <= 0) {
        return res.status(400).json({
          code: 400,
          success: false,
          message: '请先上传本次试模附件后，再新建下一次试模记录'
        })
      }
      if (check?.prevTrialDate && trialDate < String(check.prevTrialDate)) {
        return res.status(400).json({
          code: 400,
          success: false,
          message: `试模日期不能早于上一次试模日期（${check.prevTrialDate}）`
        })
      }
      return res.status(500).json({ code: 500, success: false, message: '创建试模过程失败' })
    }

    const row = await getTrialProcessRow(projectCode, trialNo)
    if (row) row.trialDate = formatDateYYYYMMDD(row.trialDate)
    return res.json({ code: 0, success: true, data: row })
  } catch (error) {
    console.error('创建试模过程失败:', error)
    const msg = String(error?.message || '')
    if (/试模类别/.test(msg) || /cannot insert the value NULL/i.test(msg)) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: `试模类别不合法（首条有效记录固定为 T0；其它仅支持：${TRIAL_PROCESS_ALLOWED_CATEGORIES.filter((c) => c !== 'T0').join('、')}）`
      })
    }
    return res.status(500).json({ code: 500, success: false, message: '创建试模过程失败', error: msg })
  }
})

// 更新试模过程
router.put('/:projectCode(*)/trial-processes/:trialNo', async (req, res) => {
  try {
    await ensureTrialProcessTables()
    const projectCode = String(req.params.projectCode || '').trim()
    const trialNo = parseInt(String(req.params.trialNo || ''), 10)
    if (!projectCode) {
      return res.status(400).json({ code: 400, success: false, message: '项目编号不能为空' })
    }
    if (!Number.isInteger(trialNo) || trialNo <= 0) {
      return res.status(400).json({ code: 400, success: false, message: '试模次数不合法' })
    }

    const existing = await getTrialProcessRow(projectCode, trialNo)
    if (!existing || existing.isVoid) {
      return res.status(404).json({ code: 404, success: false, message: '试模过程不存在' })
    }

    const body = req.body || {}
    const trialDate = formatDateYYYYMMDD(body.trialDate || body.试模日期 || '')
    const trialProductQty = parsePositiveInt(body.trialProductQty ?? body.试模产品数量)
    if (!trialProductQty) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '试模产品数量不能为空且必须为正整数'
      })
    }

    const requestedCategory = String(body.trialCategory ?? body.试模类别 ?? '').trim()
    const earlierActiveRows = await query(
      `
      SELECT TOP 1 1 AS hasEarlier
      FROM dbo.试模过程
      WHERE 项目编号 = @projectCode
        AND 是否作废 = 0
        AND 试模次数 < @trialNo
    `,
      { projectCode, trialNo }
    )
    const isFirstActiveRecord = !earlierActiveRows?.length
    const normalizedCategory = normalizeTrialCategory(isFirstActiveRecord, requestedCategory)
    if (!normalizedCategory) {
      return res.status(400).json({
        code: 400,
        success: false,
        message:
          isFirstActiveRecord
            ? '首条有效试模记录类别固定为 T0'
            : `试模类别不合法（仅支持：${TRIAL_PROCESS_ALLOWED_CATEGORIES.filter((c) => c !== 'T0').join('、')}）`
      })
    }

    const machineTonnage = parsePositiveInt(body.machineTonnage ?? body.注塑机吨位)
    const trialDuration = parseOptionalDecimal(body.trialDuration ?? body.试模时长)
    const isOutsourcedRaw = body.isOutsourced ?? body.外协试模
    const isOutsourced =
      isOutsourcedRaw === true ||
      isOutsourcedRaw === 1 ||
      String(isOutsourcedRaw || '').trim() === '1' ||
      String(isOutsourcedRaw || '').trim().toLowerCase() === 'true'

    const updatedBy = resolveUsernameFromReq(req)

    const masterbatchModel = String(body.masterbatchModel ?? body.色母型号 ?? '').trim() || null
    const trialUnit = String(body.trialUnit ?? body.试模单位 ?? '').trim() || null
    const remark = String(body.remark ?? body.备注 ?? '').trim() || null

    await query(
      `
      UPDATE dbo.试模过程
      SET
        试模日期 = @trialDate,
        试模类别 = @trialCategory,
        产品数量 = @trialProductQty,
        试模产品数量 = @trialProductQty,
        注塑机吨位 = @machineTonnage,
        成型周期 = NULL,
        色母型号 = @masterbatchModel,
        试模单位 = @trialUnit,
        试模时长 = @trialDuration,
        外协试模 = @isOutsourced,
        备注 = @remark,
        更新时间 = SYSDATETIME(),
        更新人 = @updatedBy
      WHERE 项目编号 = @projectCode
        AND 试模次数 = @trialNo
        AND 是否作废 = 0
    `,
      {
        projectCode,
        trialNo,
        trialDate: trialDate || null,
        trialCategory: normalizedCategory,
        trialProductQty,
        machineTonnage: machineTonnage || null,
        masterbatchModel,
        trialUnit,
        trialDuration,
        isOutsourced,
        remark,
        updatedBy
      }
    )

    const row = await getTrialProcessRow(projectCode, trialNo)
    if (row) row.trialDate = formatDateYYYYMMDD(row.trialDate)
    return res.json({ code: 0, success: true, data: row })
  } catch (error) {
    console.error('更新试模过程失败:', error)
    return res.status(500).json({
      code: 500,
      success: false,
      message: '更新试模过程失败',
      error: error.message
    })
  }
})

// 作废试模过程（不物理删除）
router.delete('/:projectCode(*)/trial-processes/:trialNo', async (req, res) => {
  try {
    await ensureTrialProcessTables()
    const projectCode = String(req.params.projectCode || '').trim()
    const trialNo = parseInt(String(req.params.trialNo || ''), 10)
    if (!projectCode) {
      return res.status(400).json({ code: 400, success: false, message: '项目编号不能为空' })
    }
    if (!Number.isInteger(trialNo) || trialNo <= 0) {
      return res.status(400).json({ code: 400, success: false, message: '试模次数不合法' })
    }

    const existing = await getTrialProcessRow(projectCode, trialNo)
    if (!existing || existing.isVoid) {
      return res.status(404).json({ code: 404, success: false, message: '试模过程不存在' })
    }

    const updatedBy = resolveUsernameFromReq(req)
    await query(
      `
      UPDATE dbo.试模过程
      SET 是否作废 = 1, 更新时间 = SYSDATETIME(), 更新人 = @updatedBy
      WHERE 项目编号 = @projectCode AND 试模次数 = @trialNo AND 是否作废 = 0
    `,
      { projectCode, trialNo, updatedBy }
    )

    return res.json({ code: 0, success: true, message: '作废成功' })
  } catch (error) {
    console.error('作废试模过程失败:', error)
    return res.status(500).json({
      code: 500,
      success: false,
      message: '作废试模过程失败',
      error: error.message
    })
  }
})

// 获取某次试模过程附件列表
// 注意：不能使用末尾 '/attachments'，否则会被 '/:projectCode(*)/attachments' 误匹配
router.get('/:projectCode(*)/trial-processes/:trialNo/trial-attachments', async (req, res) => {
  try {
    await ensureTrialProcessTables()
    const projectCode = String(req.params.projectCode || '').trim()
    const trialNo = parseInt(String(req.params.trialNo || ''), 10)
    if (!projectCode) {
      return res.status(400).json({ code: 400, success: false, message: '项目编号不能为空' })
    }
    if (!Number.isInteger(trialNo) || trialNo <= 0) {
      return res.status(400).json({ code: 400, success: false, message: '试模次数不合法' })
    }

    const process = await getTrialProcessRow(projectCode, trialNo)
    if (!process || process.isVoid) {
      return res.status(404).json({ code: 404, success: false, message: '试模过程不存在' })
    }

    const rows = await query(
      `
      SELECT
        附件ID as id,
        试模过程ID as trialProcessId,
        项目编号 as projectCode,
        原始文件名 as originalName,
        存储文件名 as storedFileName,
        相对路径 as relativePath,
        文件大小 as fileSize,
        内容类型 as contentType,
        上传时间 as uploadedAt,
        上传人 as uploadedBy,
        排序 as sortOrder
      FROM 试模过程附件
      WHERE 试模过程ID = @trialProcessId
      ORDER BY ISNULL(排序, 999999) ASC, 上传时间 DESC, 附件ID DESC
    `,
      { trialProcessId: process.id }
    )

    return res.json({ code: 0, success: true, data: rows })
  } catch (error) {
    console.error('获取试模过程附件列表失败:', error)
    return res.status(500).json({
      code: 500,
      success: false,
      message: '获取试模过程附件列表失败',
      error: error.message
    })
  }
})

// 上传试模过程附件（仅 PDF / 图片，支持多文件）
router.post(
  '/:projectCode(*)/trial-processes/:trialNo/trial-attachments',
  uploadTrialProcessAttachments,
  async (req, res) => {
    try {
      await ensureTrialProcessTables()
      const projectCode = String(req.params.projectCode || '').trim()
      const trialNo = parseInt(String(req.params.trialNo || ''), 10)
      if (!projectCode) {
        return res.status(400).json({ code: 400, success: false, message: '项目编号不能为空' })
      }
      if (!Number.isInteger(trialNo) || trialNo <= 0) {
        return res.status(400).json({ code: 400, success: false, message: '试模次数不合法' })
      }

      const process = await getTrialProcessRow(projectCode, trialNo)
      if (!process || process.isVoid) {
        return res.status(404).json({ code: 404, success: false, message: '试模过程不存在' })
      }

      const files = Array.isArray(req.files) ? req.files : []
      if (!files.length) {
        return res.status(400).json({ code: 400, success: false, message: '未找到上传文件' })
      }

      const uploadedBy = resolveUsernameFromReq(req)

      const category = getCategoryFromProjectCode(projectCode)
      const safeProjectCode = safeProjectCodeForPath(projectCode)
      const trialDirName = `第${String(trialNo)}次`
      const finalRelativeDir = path.posix.join(
        category,
        safeProjectCode,
        '项目管理',
        '试模过程',
        trialDirName
      )
      const finalFullDir = path.join(FILE_ROOT, finalRelativeDir)
      ensureDirSync(finalFullDir)

      const insertedRows = []
      const tempDirs = new Set()

      for (const file of files) {
        const originalName = normalizeAttachmentFileName(file.originalname)
        const ext = String(path.extname(originalName || '') || '').toLowerCase()
        const isPdf = ext === '.pdf'
        const isImage = String(file.mimetype || '').toLowerCase().startsWith('image/')
        if (!isPdf && !isImage) {
          return res.status(400).json({
            code: 400,
            success: false,
            message: '试模过程附件仅支持 PDF / 图片文件'
          })
        }

        const seqRows = await query(
          `
          SELECT ISNULL(MAX(ISNULL(排序, 0)), 0) as maxSort
          FROM 试模过程附件
          WHERE 项目编号 = @projectCode
        `,
          { projectCode }
        )
        const nextSort = (seqRows?.[0]?.maxSort || 0) + 1

        const baseName = `${projectCode}_试模过程单_${String(nextSort).padStart(2, '0')}`
        const generatedFileName = safeFileName(`${baseName}${ext}`)
        const storedFileName = ensureUniqueFileName(finalFullDir, generatedFileName)

        const tempFile = file.path
        if (file.destination) tempDirs.add(file.destination)
        const finalFile = path.join(finalFullDir, storedFileName)
        await moveFileWithFallback(tempFile, finalFile)

        const inserted = await query(
          `
          INSERT INTO dbo.试模过程附件 (
            试模过程ID,
            项目编号,
            原始文件名,
            存储文件名,
            相对路径,
            文件大小,
            内容类型,
            上传人,
            排序
          )
          OUTPUT INSERTED.附件ID as id, INSERTED.上传时间 as uploadedAt
          VALUES (
            @trialProcessId,
            @projectCode,
            @originalName,
            @storedFileName,
            @relativePath,
            @fileSize,
            @contentType,
            @uploadedBy,
            @sortOrder
          )
        `,
          {
            trialProcessId: process.id,
            projectCode,
            originalName: generatedFileName,
            storedFileName,
            relativePath: finalRelativeDir,
            fileSize: file.size,
            contentType: file.mimetype || null,
            uploadedBy,
            sortOrder: nextSort
          }
        )

        insertedRows.push({
          id: inserted?.[0]?.id,
          trialProcessId: process.id,
          projectCode,
          originalName,
          storedFileName,
          relativePath: finalRelativeDir,
          fileSize: file.size,
          contentType: file.mimetype || null,
          uploadedAt: inserted?.[0]?.uploadedAt,
          uploadedBy,
          sortOrder: nextSort
        })
      }

      // 清理空临时目录（multer 每个文件可能分配不同的 temp dir）
      for (const dir of tempDirs) {
        try {
          if (dir && fs.existsSync(dir)) {
            const dirFiles = await fsp.readdir(dir)
            if (dirFiles.length === 0) {
              await fsp.rmdir(dir)
              const parentTempDir = path.dirname(dir)
              const parentFiles = await fsp.readdir(parentTempDir).catch(() => [])
              if (parentFiles.length === 0) {
                await fsp.rmdir(parentTempDir).catch(() => {})
              }
            }
          }
        } catch (cleanupErr) {
          console.warn('清理试模过程临时目录失败:', cleanupErr)
        }
      }

      return res.json({ code: 0, success: true, data: insertedRows })
    } catch (error) {
      console.error('上传试模过程附件失败:', error)
      return res.status(500).json({
        code: 500,
        success: false,
        message: '上传试模过程附件失败',
        error: error.message
      })
    }
  }
)

// 下载试模过程附件
router.get('/trial-process-attachments/:attachmentId/download', async (req, res) => {
  try {
    await ensureTrialProcessTables()
    const attachmentId = parseInt(req.params.attachmentId, 10)
    if (!Number.isInteger(attachmentId) || attachmentId <= 0) {
      return res.status(400).json({ code: 400, success: false, message: '附件ID不合法' })
    }

    const rows = await query(
      `
      SELECT TOP 1
        附件ID as id,
        原始文件名 as originalName,
        存储文件名 as storedFileName,
        相对路径 as relativePath
      FROM 试模过程附件
      WHERE 附件ID = @attachmentId
    `,
      { attachmentId }
    )
    if (!rows.length) {
      return res.status(404).json({ code: 404, success: false, message: '附件不存在' })
    }

    const att = rows[0]
    const fullPath = getFileFullPath(att.relativePath, att.storedFileName)
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ code: 404, success: false, message: '附件文件不存在' })
    }

    return res.download(fullPath, att.originalName)
  } catch (error) {
    console.error('下载试模过程附件失败:', error)
    return res.status(500).json({
      code: 500,
      success: false,
      message: '下载试模过程附件失败',
      error: error.message
    })
  }
})

// 预览试模过程附件（inline，便于浏览器直接打开预览）
router.get('/trial-process-attachments/:attachmentId/preview', async (req, res) => {
  try {
    await ensureTrialProcessTables()
    const attachmentId = parseInt(req.params.attachmentId, 10)
    if (!Number.isInteger(attachmentId) || attachmentId <= 0) {
      return res.status(400).json({ code: 400, success: false, message: '附件ID不合法' })
    }

    const rows = await query(
      `
      SELECT TOP 1
        附件ID as id,
        原始文件名 as originalName,
        存储文件名 as storedFileName,
        相对路径 as relativePath,
        内容类型 as contentType
      FROM 试模过程附件
      WHERE 附件ID = @attachmentId
    `,
      { attachmentId }
    )
    if (!rows.length) {
      return res.status(404).json({ code: 404, success: false, message: '附件不存在' })
    }

    const att = rows[0]
    const fullPath = getFileFullPath(att.relativePath, att.storedFileName)
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ code: 404, success: false, message: '附件文件不存在' })
    }

    const encodedFilename = encodeURIComponent(String(att.originalName || att.storedFileName || '附件'))
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodedFilename}`)
    if (att.contentType) res.setHeader('Content-Type', att.contentType)
    return res.sendFile(fullPath)
  } catch (error) {
    console.error('预览试模过程附件失败:', error)
    return res.status(500).json({
      code: 500,
      success: false,
      message: '预览试模过程附件失败',
      error: error.message
    })
  }
})

// 删除试模过程附件
router.delete('/trial-process-attachments/:attachmentId', async (req, res) => {
  try {
    await ensureTrialProcessTables()
    const attachmentId = parseInt(req.params.attachmentId, 10)
    if (!Number.isInteger(attachmentId) || attachmentId <= 0) {
      return res.status(400).json({ code: 400, success: false, message: '附件ID不合法' })
    }

    const rows = await query(
      `
      SELECT TOP 1
        附件ID as id,
        存储文件名 as storedFileName,
        相对路径 as relativePath
      FROM 试模过程附件
      WHERE 附件ID = @attachmentId
    `,
      { attachmentId }
    )
    if (!rows.length) {
      return res.status(404).json({ code: 404, success: false, message: '附件不存在' })
    }

    const att = rows[0]
    await query(`DELETE FROM 试模过程附件 WHERE 附件ID = @attachmentId`, { attachmentId })

    const fullPath = getFileFullPath(att.relativePath, att.storedFileName)
    try {
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath)
      }
    } catch (fileErr) {
      console.warn('删除试模过程附件文件失败（已删除数据库记录）:', fileErr)
    }

    return res.json({ code: 0, success: true, message: '删除成功' })
  } catch (error) {
    console.error('删除试模过程附件失败:', error)
    return res.status(500).json({
      code: 500,
      success: false,
      message: '删除试模过程附件失败',
      error: error.message
    })
  }
})

// === 项目管理：检验报告（项目编号 + 产品图号/行序号 绑定，多文件） ===

// 获取检验报告列表（返回该项目下所有检验报告附件）
router.get('/:projectCode(*)/inspection-reports', async (req, res) => {
  try {
    await ensureProjectAttachmentsTable()
    const projectCode = String(req.params.projectCode || '').trim()
    if (!projectCode) {
      return res.status(400).json({ code: 400, success: false, message: '项目编号不能为空' })
    }

    const rows = await query(
      `
      SELECT
        附件ID as id,
        项目编号 as projectCode,
        附件类型 as type,
        原始文件名 as originalName,
        存储文件名 as storedFileName,
        相对路径 as relativePath,
        文件大小 as fileSize,
        内容类型 as contentType,
        上传时间 as uploadedAt,
        上传人 as uploadedBy,
        绑定产品图号 as drawing,
        绑定行序号 as rowIndex,
        是否孤儿 as isOrphan,
        孤儿原因 as orphanReason,
        孤儿行序号 as orphanRowIndex
      FROM 项目管理附件
      WHERE 项目编号 = @projectCode
        AND 附件类型 = N'inspection-report'
      ORDER BY 上传时间 DESC, 附件ID DESC
    `,
      { projectCode }
    )

    return res.json({ code: 0, success: true, data: rows })
  } catch (error) {
    console.error('获取检验报告列表失败:', error)
    return res.status(500).json({
      code: 500,
      success: false,
      message: '获取检验报告列表失败',
      error: error.message
    })
  }
})

// 迁移检验报告绑定（图号改名 / rowIndex -> drawing）
router.post('/:projectCode(*)/inspection-reports/move', async (req, res) => {
  try {
    await ensureProjectAttachmentsTable()
    const projectCode = String(req.params.projectCode || '').trim()
    if (!projectCode) {
      return res.status(400).json({ code: 400, success: false, message: '项目编号不能为空' })
    }

    const fromDrawing = String(req.body?.fromDrawing || '').trim() || null
    const toDrawing = String(req.body?.toDrawing || '').trim() || null
    const fromRowIndexRaw = req.body?.fromRowIndex
    const toRowIndexRaw = req.body?.toRowIndex
    const fromRowIndex =
      fromRowIndexRaw === undefined || fromRowIndexRaw === null || String(fromRowIndexRaw).trim() === ''
        ? null
        : parseInt(String(fromRowIndexRaw), 10)
    const toRowIndex =
      toRowIndexRaw === undefined || toRowIndexRaw === null || String(toRowIndexRaw).trim() === ''
        ? null
        : parseInt(String(toRowIndexRaw), 10)

    if (!fromDrawing && (fromRowIndex === null || Number.isNaN(fromRowIndex))) {
      return res.status(400).json({ code: 400, success: false, message: '缺少 fromDrawing 或 fromRowIndex' })
    }
    if (!toDrawing && (toRowIndex === null || Number.isNaN(toRowIndex))) {
      return res.status(400).json({ code: 400, success: false, message: '缺少 toDrawing 或 toRowIndex' })
    }

    const whereParts = [`项目编号 = @projectCode`, `附件类型 = N'inspection-report'`, `是否孤儿 = 0`]
    const params = { projectCode }
    if (fromDrawing) {
      whereParts.push(`绑定产品图号 = @fromDrawing`)
      params.fromDrawing = fromDrawing
    } else {
      whereParts.push(`绑定产品图号 IS NULL AND 绑定行序号 = @fromRowIndex`)
      params.fromRowIndex = fromRowIndex
    }

    const setParts = []
    if (toDrawing) {
      setParts.push(`绑定产品图号 = @toDrawing`, `绑定行序号 = NULL`)
      params.toDrawing = toDrawing
    } else {
      setParts.push(`绑定产品图号 = NULL`, `绑定行序号 = @toRowIndex`)
      params.toRowIndex = toRowIndex
    }
    setParts.push(`是否孤儿 = 0`, `孤儿原因 = NULL`, `孤儿行序号 = NULL`)

    const result = await query(
      `
      UPDATE 项目管理附件
      SET ${setParts.join(', ')}
      WHERE ${whereParts.join(' AND ')};
      SELECT @@ROWCOUNT as movedCount;
    `,
      params
    )

    const movedCount = result?.[0]?.movedCount ?? 0
    return res.json({ code: 0, success: true, data: { movedCount } })
  } catch (error) {
    console.error('迁移检验报告失败:', error)
    return res.status(500).json({
      code: 500,
      success: false,
      message: '迁移检验报告失败',
      error: error.message
    })
  }
})

// 标记 rowIndex 绑定的检验报告为孤儿（用于“图号为空的行被删除”）
router.post('/:projectCode(*)/inspection-reports/orphan', async (req, res) => {
  try {
    await ensureProjectAttachmentsTable()
    const projectCode = String(req.params.projectCode || '').trim()
    if (!projectCode) {
      return res.status(400).json({ code: 400, success: false, message: '项目编号不能为空' })
    }

    const rowIndexRaw = req.body?.rowIndex
    const rowIndex =
      rowIndexRaw === undefined || rowIndexRaw === null || String(rowIndexRaw).trim() === ''
        ? null
        : parseInt(String(rowIndexRaw), 10)
    if (rowIndex === null || Number.isNaN(rowIndex)) {
      return res.status(400).json({ code: 400, success: false, message: '缺少 rowIndex' })
    }

    const orphanReason = String(req.body?.reason || 'row_deleted').trim().slice(0, 50)

    const result = await query(
      `
      UPDATE 项目管理附件
      SET 是否孤儿 = 1,
          孤儿原因 = @orphanReason,
          孤儿行序号 = @rowIndex,
          绑定产品图号 = NULL,
          绑定行序号 = NULL
      WHERE 项目编号 = @projectCode
        AND 附件类型 = N'inspection-report'
        AND 是否孤儿 = 0
        AND 绑定产品图号 IS NULL
        AND 绑定行序号 = @rowIndex;
      SELECT @@ROWCOUNT as orphanedCount;
    `,
      { projectCode, rowIndex, orphanReason }
    )

    const orphanedCount = result?.[0]?.orphanedCount ?? 0
    return res.json({ code: 0, success: true, data: { orphanedCount } })
  } catch (error) {
    console.error('标记检验报告孤儿失败:', error)
    return res.status(500).json({
      code: 500,
      success: false,
      message: '标记检验报告孤儿失败',
      error: error.message
    })
  }
})

// 下载检验报告
router.get('/inspection-reports/:attachmentId/download', async (req, res) => {
  try {
    await ensureProjectAttachmentsTable()
    const attachmentId = parseInt(req.params.attachmentId, 10)
    if (!Number.isInteger(attachmentId) || attachmentId <= 0) {
      return res.status(400).json({ code: 400, success: false, message: '附件ID不合法' })
    }

    const rows = await query(
      `
      SELECT TOP 1
        附件ID as id,
        原始文件名 as originalName,
        存储文件名 as storedFileName,
        相对路径 as relativePath
      FROM 项目管理附件
      WHERE 附件ID = @attachmentId
        AND 附件类型 = N'inspection-report'
    `,
      { attachmentId }
    )
    if (!rows.length) {
      return res.status(404).json({ code: 404, success: false, message: '附件不存在' })
    }

    const attachment = rows[0]
    const fullPath = getFileFullPath(attachment.relativePath, attachment.storedFileName)
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ code: 404, success: false, message: '附件文件不存在' })
    }

    return res.download(fullPath, attachment.originalName)
  } catch (error) {
    console.error('下载检验报告失败:', error)
    return res.status(500).json({
      code: 500,
      success: false,
      message: '下载检验报告失败',
      error: error.message
    })
  }
})

// 删除检验报告（仅前端控制入口；如需更严格可在后端加权限校验）
router.delete('/inspection-reports/:attachmentId', async (req, res) => {
  try {
    await ensureProjectAttachmentsTable()
    const attachmentId = parseInt(req.params.attachmentId, 10)
    if (!Number.isInteger(attachmentId) || attachmentId <= 0) {
      return res.status(400).json({ code: 400, success: false, message: '附件ID不合法' })
    }

    const rows = await query(
      `
      SELECT TOP 1
        附件ID as id,
        存储文件名 as storedFileName,
        相对路径 as relativePath
      FROM 项目管理附件
      WHERE 附件ID = @attachmentId
        AND 附件类型 = N'inspection-report'
    `,
      { attachmentId }
    )
    if (!rows.length) {
      return res.status(404).json({ code: 404, success: false, message: '附件不存在' })
    }

    const att = rows[0]
    const fullPath = getFileFullPath(att.relativePath, att.storedFileName)

    await query(`DELETE FROM 项目管理附件 WHERE 附件ID = @attachmentId`, { attachmentId })

    try {
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath)
      }
    } catch (fileErr) {
      console.warn('删除检验报告文件失败（已删除数据库记录）:', fileErr)
    }

    return res.json({ code: 0, success: true, message: '删除成功' })
  } catch (error) {
    console.error('删除检验报告失败:', error)
    return res.status(500).json({
      code: 500,
      success: false,
      message: '删除检验报告失败',
      error: error.message
    })
  }
})

// 下载附件
router.get('/attachments/:attachmentId/download', async (req, res) => {
  try {
    await ensureProjectAttachmentsTable()
    const attachmentId = parseInt(req.params.attachmentId, 10)
    if (!Number.isInteger(attachmentId) || attachmentId <= 0) {
      return res.status(400).json({ code: 400, success: false, message: '附件ID不合法' })
    }

    const rows = await query(
      `
      SELECT TOP 1
        附件ID as id,
        原始文件名 as originalName,
        存储文件名 as storedFileName,
        相对路径 as relativePath
      FROM 项目管理附件
      WHERE 附件ID = @attachmentId
    `,
      { attachmentId }
    )
    if (!rows.length) {
      return res.status(404).json({ code: 404, success: false, message: '附件不存在' })
    }

    const attachment = rows[0]
    const fullPath = getFileFullPath(attachment.relativePath, attachment.storedFileName)
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ code: 404, success: false, message: '附件文件不存在' })
    }

    res.download(fullPath, attachment.originalName)
  } catch (error) {
    console.error('下载项目管理附件失败:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: '下载项目管理附件失败',
      error: error.message
    })
  }
})

// 删除附件
router.delete('/attachments/:attachmentId', async (req, res) => {
  try {
    await ensureProjectAttachmentsTable()
    const attachmentId = parseInt(req.params.attachmentId, 10)
    if (!Number.isInteger(attachmentId) || attachmentId <= 0) {
      return res.status(400).json({ code: 400, success: false, message: '附件ID不合法' })
    }

    const rows = await query(
      `
      SELECT TOP 1
        附件ID as id,
        存储文件名 as storedFileName,
        相对路径 as relativePath
      FROM 项目管理附件
      WHERE 附件ID = @attachmentId
    `,
      { attachmentId }
    )
    if (!rows.length) {
      return res.status(404).json({ code: 404, success: false, message: '附件不存在' })
    }

    const att = rows[0]
    const fullPath = getFileFullPath(att.relativePath, att.storedFileName)

    await query(`DELETE FROM 项目管理附件 WHERE 附件ID = @attachmentId`, { attachmentId })

    try {
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath)
      }
    } catch (fileErr) {
      console.warn('删除附件文件失败（已删除数据库记录）:', fileErr)
    }

    res.json({ code: 0, success: true, message: '删除成功' })
  } catch (error) {
    console.error('删除项目管理附件失败:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: '删除项目管理附件失败',
      error: error.message
    })
  }
})

// === 零件图示相关接口 ===

// 上传零件图示
router.post('/upload-part-image', (req, res) => {
  uploadPartImage.single('file')(req, res, (err) => {
    if (err) {
      const message =
        err?.code === 'LIMIT_FILE_SIZE'
          ? `上传失败：图片不能超过 ${Math.round(PROJECT_PART_IMAGE_MAX_SIZE_BYTES / 1024 / 1024)}MB`
          : err?.message || '上传失败'
      return res.status(400).json({ code: 400, success: false, message })
    }

    const file = req.file
    if (!file) {
      return res.status(400).json({ code: 400, success: false, message: '未找到上传文件' })
    }

    const mime = String(file.mimetype || '').toLowerCase()
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']
    if (!allowed.includes(mime)) {
      try {
        fs.unlinkSync(file.path)
      } catch (e) { /* ignore */ }
      return res
        .status(400)
        .json({ code: 400, success: false, message: '仅支持 png/jpg/gif/webp 图片' })
    }

    try {
      const rel = path.relative(PROJECT_PART_IMAGE_TEMP_DIR_ROOT, file.path)
      const safeRel = String(rel || '').replace(/\\/g, '/')
      if (!safeRel || safeRel.startsWith('..')) {
        try {
          fs.unlinkSync(file.path)
        } catch (e) { /* ignore */ }
        return res.status(500).json({ code: 500, success: false, message: '生成临时预览地址失败' })
      }
      const parts = safeRel.split('/').filter(Boolean)
      const urlPath = `${PROJECT_PART_IMAGE_TEMP_URL_PREFIX}${parts.map((p) => encodeURIComponent(p)).join('/')}`
      return res.json({ code: 0, success: true, data: { url: urlPath } })
    } catch (e) {
      try {
        fs.unlinkSync(file.path)
      } catch (e) { /* ignore */ }
      console.error('生成临时图示URL失败:', e)
      return res.status(500).json({ code: 500, success: false, message: '保存图片失败' })
    }
  })
})

// 删除临时零件图示
router.post('/delete-temp-part-image', async (req, res) => {
  try {
    const url = String(req.body?.url || '').trim()
    if (!url) {
      return res.status(400).json({ code: 400, success: false, message: '缺少 url' })
    }
    const filePath = resolveTempPartImagePath(url)
    if (!filePath) {
      return res.status(400).json({ code: 400, success: false, message: '不是合法的临时图示地址' })
    }

    try {
      await fs.promises.unlink(filePath)
    } catch (e) {
      // 文件不存在也视为成功，避免重复清理导致报错
      if (e && e.code !== 'ENOENT') throw e
    }
    await cleanupEmptyParents(filePath, PROJECT_PART_IMAGE_TEMP_DIR_ROOT)
    return res.json({ code: 0, success: true })
  } catch (e) {
    console.error('删除临时图示失败:', e)
    return res.status(500).json({ code: 500, success: false, message: '删除临时图示失败' })
  }
})

// 通过 API 预览零件图示（兼容临时/最终路径）
router.get('/part-image', async (req, res) => {
  try {
    const url = String(req.query?.url || '').trim()
    if (!url) {
      return res.status(400).json({ code: 400, success: false, message: '缺少 url' })
    }

    console.log('[预览零件图示] URL:', url)
    const filePath = resolveAnyPartImagePath(url)
    console.log('[预览零件图示] 解析后的文件路径:', filePath)

    if (!filePath) {
      console.warn('[预览零件图示] 无法解析路径:', url)
      return res.status(400).json({ code: 400, success: false, message: '不是合法的图示地址' })
    }

    if (!fs.existsSync(filePath)) {
      console.warn('[预览零件图示] 文件不存在:', filePath)
      return res.status(404).json({ code: 404, success: false, message: '图示文件不存在' })
    }

    console.log('[预览零件图示] 文件存在，开始返回:', filePath)

    const stat = await fs.promises.stat(filePath)
    const stream = fs.createReadStream(filePath)
    const ext = path.extname(filePath).toLowerCase()
    const contentTypeMap = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp'
    }
    const contentType = contentTypeMap[ext] || 'image/jpeg'

    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Length', stat.size)
    res.setHeader('Cache-Control', 'public, max-age=31536000')
    stream.pipe(res)
  } catch (e) {
    console.error('预览零件图示失败:', e)
    return res.status(500).json({ code: 500, success: false, message: '预览零件图示失败' })
  }
})

module.exports = router
