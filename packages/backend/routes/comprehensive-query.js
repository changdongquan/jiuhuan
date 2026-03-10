const express = require('express')
const ExcelJS = require('exceljs')
const { query } = require('../database')

const router = express.Router()

const ANOMALY_TYPES = ['uninvoiced', 'unreceived', 'unshipped', 'overdue']

const safeNumber = (value) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

const pad2 = (n) => String(n).padStart(2, '0')

const formatLocalDate = (date) => {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

const toDateString = (value) => {
  if (!value) return ''
  if (typeof value === 'string') {
    const m = value.match(/^(\d{4}-\d{2}-\d{2})/)
    return m ? m[1] : value.slice(0, 10)
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatLocalDate(value)
  }
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return formatLocalDate(d)
}

const toTime = (value) => {
  const s = toDateString(value)
  if (!s) return 0
  const t = new Date(`${s}T00:00:00`).getTime()
  return Number.isFinite(t) ? t : 0
}

const pushEvent = (events, payload) => {
  if (!payload?.date) return
  events.push(payload)
}

const normalizeStageStatus = (value) => {
  const v = String(value || '').trim()
  if (!v) return 'pending'
  return v
}

const getMaxDate = (list, key) => {
  return toDateString(
    list
      .map((row) => row[key])
      .filter(Boolean)
      .sort((a, b) => toTime(b) - toTime(a))[0]
  )
}

const parseCsvValues = (raw) => {
  return String(raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

const parseAnomalyTypes = (raw) => {
  const list = parseCsvValues(raw)
  return list.filter((item) => ANOMALY_TYPES.includes(item))
}

const PROGRESS_COLUMN_MAP = {
  production: 'base.productionProgress',
  invoice: 'base.invoiceProgress',
  receipt: 'base.receiptProgress',
  receipt_invoice: 'base.receiptInvoiceProgress',
  outbound: 'base.outboundProgress'
}

const buildProgressRangeSql = (column, rangeKey) => {
  if (rangeKey === '0') return `${column} <= 0`
  if (rangeKey === '0_30') return `${column} > 0 AND ${column} < 30`
  if (rangeKey === '30_60') return `${column} >= 30 AND ${column} < 60`
  if (rangeKey === '60_90') return `${column} >= 60 AND ${column} < 90`
  if (rangeKey === '90_100') return `${column} >= 90 AND ${column} < 100`
  if (rangeKey === '100') return `${column} >= 100`
  return ''
}

const parseProgressFilters = (raw) => {
  return String(raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((item) => {
      const parts = item.split(':')
      if (parts.length < 2) return null
      const type = String(parts[0] || '').trim()
      const range = String(parts[1] || '').trim()
      if (!type || !range) return null
      return { type, range }
    })
    .filter(Boolean)
}

const sanitizeFilenamePart = (value) => {
  return String(value || '')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '')
    .replace(/-+/g, '-')
    .trim()
}

const buildExportQueryMethodLabel = (inputQuery = {}) => {
  const parts = []
  const settlementStatus = String(inputQuery.settlementStatus || '').trim()
  const anomalyType = parseAnomalyTypes(inputQuery.anomalyType)
  const progressFilters = parseProgressFilters(inputQuery.progressFilters)
  const progressType = String(inputQuery.progressType || '').trim()
  const progressRange = String(inputQuery.progressRange || '').trim()

  const progressTypeLabelMap = {
    production: '生产',
    invoice: '开票',
    receipt: '回款对销售',
    receipt_invoice: '回款对开票',
    outbound: '出货'
  }
  const progressRangeLabelMap = {
    0: '0%',
    '0_30': '0-30%',
    '30_60': '30-60%',
    '60_90': '60-90%',
    '90_100': '90-100%',
    100: '100%'
  }
  const anomalyLabelMap = {
    uninvoiced: '已销售未开票',
    unreceived: '已开票未回款',
    unshipped: '生产完成未出货',
    overdue: '订单超期未回款'
  }

  if (settlementStatus) parts.push(`状态${settlementStatus}`)
  if (anomalyType.length > 0) {
    parts.push(`异常${anomalyType.map((item) => anomalyLabelMap[item] || item).join('+')}`)
  }

  const progressItems = progressFilters.length
    ? progressFilters
    : progressType && progressRange
      ? [{ type: progressType, range: progressRange }]
      : []

  if (progressItems.length > 0) {
    const progressText = progressItems
      .map(({ type, range }) => `${progressTypeLabelMap[type] || type}${progressRangeLabelMap[range] || range}`)
      .join('+')
    parts.push(`进度${progressText}`)
  }

  if (String(inputQuery.customerName || '').trim()) parts.push('按客户')
  if (String(inputQuery.keyword || '').trim()) parts.push('按关键词')
  if (String(inputQuery.startDate || '').trim() || String(inputQuery.endDate || '').trim()) parts.push('按订单日期')

  const raw = parts.length > 0 ? parts.join('_') : '全部'
  const safe = sanitizeFilenamePart(raw)
  return safe.length > 48 ? safe.slice(0, 48) : safe
}

const getCellTextLength = (value) => {
  if (value === null || value === undefined) return 0
  const text = String(value)
  let width = 0
  for (const ch of Array.from(text)) {
    width += /[\u4e00-\u9fff\u3400-\u4dbf\uff00-\uffef]/.test(ch) ? 2 : 1
  }
  return width
}

const applyExcelColumnWidth = (worksheet, keys, rows, options = {}) => {
  const minWidth = Number(options.minWidth || 10)
  const maxWidth = Number(options.maxWidth || 60)
  const extraPadding = Number(options.extraPadding || 3)
  const minWidthMap = options.minWidthMap || {}
  if (!worksheet || !Array.isArray(keys) || keys.length <= 0) return

  keys.forEach((key, index) => {
    const headerCell = worksheet.getCell(1, index + 1)
    const keyMinWidth = Number(minWidthMap[key] || minWidth)
    let width = Math.max(keyMinWidth, getCellTextLength(headerCell.value))
    rows.forEach((row) => {
      const textLength = getCellTextLength(row?.[key])
      width = Math.max(width, Math.min(maxWidth, textLength + extraPadding))
    })
    width = Math.max(width, keyMinWidth)
    worksheet.getColumn(index + 1).width = Math.min(maxWidth, width)
  })
}

const applyExcelDataBorders = (worksheet, rowStart, rowEnd, colStart, colEnd) => {
  for (let r = rowStart; r <= rowEnd; r += 1) {
    for (let c = colStart; c <= colEnd; c += 1) {
      const cell = worksheet.getCell(r, c)
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF9CA3AF' } },
        left: { style: 'thin', color: { argb: 'FF9CA3AF' } },
        bottom: { style: 'thin', color: { argb: 'FF9CA3AF' } },
        right: { style: 'thin', color: { argb: 'FF9CA3AF' } }
      }
    }
  }
}

const applyExcelAccountingFormat = (worksheet, key, rowStart = 2) => {
  const accountingNumFmt = '_-* #,##0.00_-;_-* (#,##0.00)_-;_-* "-"??_-;_-@_-'
  const col = worksheet.getColumn(key)
  col.eachCell((cell, rowNumber) => {
    if (rowNumber < rowStart) return
    cell.numFmt = accountingNumFmt
    cell.alignment = { ...(cell.alignment || {}), horizontal: 'right' }
  })
}

const applyExcelHeaderStyle = (worksheet, colStart, colEnd) => {
  for (let c = colStart; c <= colEnd; c += 1) {
    const cell = worksheet.getCell(1, c)
    cell.font = { bold: true, color: { argb: 'FF243447' } }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF4F7FC' }
    }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
  }
}

const applyExcelDataAreaStyle = (worksheet, keys, rows) => {
  const colCount = keys.length
  if (colCount <= 0) return
  const rowStart = 1
  const rowEnd = Math.max(rows.length + 1, 2)
  applyExcelHeaderStyle(worksheet, 1, colCount)
  applyExcelDataBorders(worksheet, rowStart, rowEnd, 1, colCount)
  if (!rows.length) return
  ;['salesAmount', 'invoiceAmount', 'receiptAmount', 'discountAmount', 'uninvoicedAmount', 'unreceivedAmount'].forEach(
    (key) => applyExcelAccountingFormat(worksheet, key, 2)
  )
  worksheet.views = [{ state: 'frozen', ySplit: 1 }]
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: colCount }
  }
}

const buildExportRows = (rows) => {
  const anomalyLabelMap = {
    uninvoiced: '已销售未开票',
    unreceived: '已开票未回款',
    unshipped: '生产完成未出货',
    overdue: '订单超期未回款'
  }
  const amount = (v) => Number(safeNumber(v).toFixed(2))
  return (rows || []).map((row) => ({
    projectCode: row.projectCode || '',
    customerName: row.customerName || '',
    productName: row.productName || '',
    productDrawing: row.productDrawing || '',
    customerModelNo: row.customerModelNo || '',
    category: row.category || '',
    owner: row.owner || '',
    salesAmount: amount(row.salesAmount),
    projectStatus: row.projectStatus || '',
    productionStatus: row.productionStatus || '',
    invoiceAmount: amount(row.invoiceAmount),
    receiptAmount: amount(row.receiptAmount),
    discountAmount: amount(row.discountAmount),
    uninvoicedAmount: amount(row.uninvoicedAmount),
    unreceivedAmount: amount(row.unreceivedAmount),
    settlementStatus: row.settlementStatus || '',
    settlementSource: row.settlementSource || '',
    anomalyType: anomalyLabelMap[row.anomalyType] || '',
    latestOrderDate: row.latestOrderDate || '',
    latestInvoiceDate: row.latestInvoiceDate || '',
    latestReceiptDate: row.latestReceiptDate || '',
    outboundQty: safeNumber(row.outboundQty),
    latestOutboundDate: row.latestOutboundDate || ''
  }))
}

const getExportColumns = () => {
  return [
    { header: '项目编号', key: 'projectCode' },
    { header: '客户名称', key: 'customerName' },
    { header: '产品名称', key: 'productName' },
    { header: '产品图号', key: 'productDrawing' },
    { header: '客户模号', key: 'customerModelNo' },
    { header: '分类', key: 'category' },
    { header: '负责人', key: 'owner' },
    { header: '销售金额', key: 'salesAmount' },
    { header: '项目状态', key: 'projectStatus' },
    { header: '生产状态', key: 'productionStatus' },
    { header: '开票金额', key: 'invoiceAmount' },
    { header: '回款金额', key: 'receiptAmount' },
    { header: '贴息金额', key: 'discountAmount' },
    { header: '未开票金额', key: 'uninvoicedAmount' },
    { header: '未回款金额', key: 'unreceivedAmount' },
    { header: '状态', key: 'settlementStatus' },
    { header: '状态来源', key: 'settlementSource' },
    { header: '异常', key: 'anomalyType' },
    { header: '最近订单', key: 'latestOrderDate' },
    { header: '最近开票', key: 'latestInvoiceDate' },
    { header: '最近回款', key: 'latestReceiptDate' },
    { header: '出货数量', key: 'outboundQty' },
    { header: '最近出货', key: 'latestOutboundDate' }
  ]
}

const buildExportWorkbookBuffer = async (rows) => {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('综合查询')
  const columns = getExportColumns()
  const exportRows = buildExportRows(rows)
  worksheet.columns = columns.map((item) => ({ header: item.header, key: item.key }))
  worksheet.addRows(exportRows)
  applyExcelColumnWidth(
    worksheet,
    columns.map((item) => item.key),
    exportRows,
    {
      minWidth: 12,
      maxWidth: 72,
      extraPadding: 4,
      minWidthMap: {
        salesAmount: 20,
        invoiceAmount: 20,
        receiptAmount: 20,
        discountAmount: 20,
        uninvoicedAmount: 20,
        unreceivedAmount: 20
      }
    }
  )
  applyExcelDataAreaStyle(
    worksheet,
    columns.map((item) => item.key),
    exportRows
  )
  return workbook.xlsx.writeBuffer()
}

const buildSettlementStatusSql = (alias = 'base') => {
  const manualStatus = `NULLIF(LTRIM(RTRIM(${alias}.manualSettlementStatus)), N'')`
  return `CASE
    WHEN ${manualStatus} IN (N'销售已结清', N'开票已结清', N'未结清') THEN ${manualStatus}
    WHEN ${alias}.salesAmount > 0
      AND ${alias}.receiptAmount + ${alias}.discountAmount >= ${alias}.salesAmount
    THEN N'销售已结清'
    WHEN ${alias}.invoiceAmount > 0
      AND ${alias}.receiptAmount + ${alias}.discountAmount >= ${alias}.invoiceAmount
    THEN N'开票已结清'
    ELSE N'未结清'
  END`
}

const buildSettlementSourceSql = (alias = 'base') => {
  const manualStatus = `NULLIF(LTRIM(RTRIM(${alias}.manualSettlementStatus)), N'')`
  return `CASE
    WHEN ${manualStatus} IN (N'销售已结清', N'开票已结清', N'未结清') THEN N'人工认定'
    ELSE N'系统计算'
  END`
}

const buildAnomalyTypeSql = (alias = 'base') => {
  const settlementStatusSql = buildSettlementStatusSql(alias)
  return `CASE
    WHEN (${settlementStatusSql}) IN (N'销售已结清', N'开票已结清') THEN ''
    WHEN ${alias}.salesAmount > 0 AND ${alias}.invoiceAmount <= 0 THEN 'uninvoiced'
    WHEN ${alias}.invoiceAmount > ${alias}.receiptAmount + ${alias}.discountAmount THEN 'unreceived'
    WHEN ${alias}.completedQty > ${alias}.outboundQty THEN 'unshipped'
    WHEN ${alias}.latestOrderDate IS NOT NULL
      AND DATEDIFF(day, ${alias}.latestOrderDate, GETDATE()) > 30
      AND ${alias}.receiptAmount + ${alias}.discountAmount < ${alias}.salesAmount
    THEN 'overdue'
    ELSE ''
  END`
}

router.get('/customer-options', async (req, res) => {
  try {
    const keyword = String(req.query.keyword || '').trim()
    const params = {}
    const where = ["c.客户名称 IS NOT NULL", "LTRIM(RTRIM(c.客户名称)) <> ''"]

    if (keyword) {
      where.push('c.客户名称 LIKE @keyword')
      params.keyword = `%${keyword}%`
    }

    const rows = await query(
      `
        SELECT DISTINCT
          LTRIM(RTRIM(c.客户名称)) as customerName
        FROM 项目管理 p
        LEFT JOIN 客户信息 c ON c.客户ID = p.客户ID
        WHERE ${where.join(' AND ')}
        ORDER BY LTRIM(RTRIM(c.客户名称)) ASC
      `,
      params
    )

    return res.json({
      code: 0,
      success: true,
      data: { list: rows || [] }
    })
  } catch (error) {
    console.error('获取综合查询客户选项失败:', error)
    return res.status(500).json({
      code: 500,
      success: false,
      message: '获取综合查询客户选项失败: ' + (error?.message || '未知错误')
    })
  }
})

const buildListFilters = (inputQuery) => {
  const params = {}
  const sourceWhere = [`(p.状态 IS NULL OR p.状态 <> N'已删除')`]
  const baseWhere = []

  const keyword = String(inputQuery.keyword || '').trim()
  const customerName = String(inputQuery.customerName || '').trim()
  const owner = String(inputQuery.owner || '').trim()
  const category = String(inputQuery.category || '').trim()
  const settlementStatus = String(inputQuery.settlementStatus || '').trim()
  const startDate = String(inputQuery.startDate || '').trim()
  const endDate = String(inputQuery.endDate || '').trim()
  const projectStatus = String(inputQuery.projectStatus || '').trim()
  const productionStatus = String(inputQuery.productionStatus || '').trim()
  const progressType = String(inputQuery.progressType || '').trim()
  const progressRange = String(inputQuery.progressRange || '').trim()
  const progressFilters = parseProgressFilters(inputQuery.progressFilters)
  const anomalyTypes = parseAnomalyTypes(inputQuery.anomalyType)
  const settlementStatusSql = buildSettlementStatusSql('base')
  const anomalyTypeSql = buildAnomalyTypeSql('base')

  if (keyword) {
    params.keyword = `%${keyword}%`
    sourceWhere.push(`(
      p.项目编号 LIKE @keyword
      OR g.productName LIKE @keyword
      OR g.productDrawing LIKE @keyword
    )`)
  }

  if (customerName) {
    params.customerName = customerName
    sourceWhere.push(`LTRIM(RTRIM(c.customerName)) = @customerName`)
  }

  if (owner) {
    params.owner = `%${owner}%`
    sourceWhere.push(`(
      EXISTS (
        SELECT 1
        FROM 生产任务 ptFilter
        WHERE ptFilter.项目编号 = p.项目编号
          AND (ptFilter.状态 IS NULL OR ptFilter.状态 <> N'已删除')
          AND ptFilter.负责人 LIKE @owner
      )
      OR EXISTS (
        SELECT 1
        FROM 销售订单 soFilter
        WHERE soFilter.项目编号 = p.项目编号
          AND (soFilter.状态 IS NULL OR soFilter.状态 <> N'已删除')
          AND soFilter.经办人 LIKE @owner
      )
    )`)
  }

  if (category) {
    params.category = category
    sourceWhere.push(`EXISTS (
      SELECT 1
      FROM 货物信息 gCat
      WHERE gCat.项目编号 = p.项目编号
        AND (gCat.状态 IS NULL OR gCat.状态 <> N'已删除')
        AND (gCat.IsNew IS NULL OR CAST(gCat.IsNew AS INT) != 1)
        AND gCat.分类 = @category
    )`)
  }

  if (startDate) {
    params.startDate = startDate
    sourceWhere.push(`(s.latestOrderDate IS NULL OR s.latestOrderDate >= @startDate)`)
  }

  if (endDate) {
    params.endDate = endDate
    sourceWhere.push(`(s.latestOrderDate IS NULL OR s.latestOrderDate <= @endDate)`)
  }

  if (projectStatus) {
    params.projectStatus = `%${projectStatus}%`
    sourceWhere.push(`p.项目状态 LIKE @projectStatus`)
  }

  if (productionStatus) {
    params.productionStatus = `%${productionStatus}%`
    sourceWhere.push(`pt.productionStatus LIKE @productionStatus`)
  }

  if (settlementStatus === '销售已结清') {
    baseWhere.push(`(${settlementStatusSql} = N'销售已结清')`)
  } else if (settlementStatus === '开票已结清') {
    baseWhere.push(`(${settlementStatusSql} = N'开票已结清')`)
  } else if (settlementStatus === '未结清') {
    baseWhere.push(`(${settlementStatusSql} = N'未结清')`)
  }

  if (anomalyTypes.length > 0) {
    const checks = anomalyTypes.map((type) => `(${anomalyTypeSql} = '${type}')`)

    if (checks.length > 0) {
      baseWhere.push(`(${checks.join(' OR ')})`)
    }
  }

  const progressChecks = []
  if (progressFilters.length > 0) {
    progressFilters.forEach(({ type, range }) => {
      const progressColumn = PROGRESS_COLUMN_MAP[type]
      if (!progressColumn) return
      const progressRangeSql = buildProgressRangeSql(progressColumn, range)
      if (progressRangeSql) progressChecks.push(`(${progressRangeSql})`)
    })
  } else {
    const progressColumn = PROGRESS_COLUMN_MAP[progressType]
    if (progressColumn && progressRange) {
      const progressRangeSql = buildProgressRangeSql(progressColumn, progressRange)
      if (progressRangeSql) progressChecks.push(`(${progressRangeSql})`)
    }
  }
  if (progressChecks.length > 0) {
    baseWhere.push(`(${progressChecks.join(' AND ')})`)
  }

  return {
    params,
    sourceWhereSql: sourceWhere.length ? `WHERE ${sourceWhere.join(' AND ')}` : '',
    baseWhereSql: baseWhere.length ? `WHERE ${baseWhere.join(' AND ')}` : ''
  }
}

const buildBaseCteSql = (sourceWhereSql) => {
  return `
    WITH base AS (
      SELECT
        p.项目编号 as projectCode,
        ISNULL(c.customerName, N'') as customerName,
        ISNULL(g.productName, N'') as productName,
        ISNULL(g.productDrawing, N'') as productDrawing,
        ISNULL(p.客户模号, N'') as customerModelNo,
        ISNULL(g.category, N'') as category,
        ISNULL(pt.owner, ISNULL(soOwner.owner, N'')) as owner,
        ISNULL(s.orderCount, 0) as salesOrderCount,
        ISNULL(s.salesAmount, 0) as salesAmount,
        p.项目状态 as projectStatus,
        pt.productionStatus as productionStatus,
        ISNULL(pt.plannedQty, 0) as plannedQty,
        ISNULL(pt.completedQty, 0) as completedQty,
        ISNULL(od.outboundDocCount, 0) as outboundDocCount,
        ISNULL(od.outboundQty, 0) as outboundQty,
        ISNULL(fi.invoiceCount, 0) as invoiceCount,
        ISNULL(fi.invoiceAmount, 0) as invoiceAmount,
        ISNULL(fr.receiptCount, 0) as receiptCount,
        ISNULL(fr.receiptAmount, 0) as receiptAmount,
        ISNULL(fr.discountAmount, 0) as discountAmount,
        msl.manualSettlementStatus as manualSettlementStatus,
        s.latestOrderDate as latestOrderDate,
        od.latestOutboundDate as latestOutboundDate,
        fi.latestInvoiceDate as latestInvoiceDate,
        fr.latestReceiptDate as latestReceiptDate,
        CASE
          WHEN ISNULL(s.salesAmount, 0) > ISNULL(fi.invoiceAmount, 0)
          THEN ISNULL(s.salesAmount, 0) - ISNULL(fi.invoiceAmount, 0)
          ELSE 0
        END as uninvoicedAmount,
        CASE
          WHEN ISNULL(fi.invoiceAmount, 0) > ISNULL(fr.receiptAmount, 0) + ISNULL(fr.discountAmount, 0)
          THEN ISNULL(fi.invoiceAmount, 0) - ISNULL(fr.receiptAmount, 0) - ISNULL(fr.discountAmount, 0)
          ELSE 0
        END as unreceivedAmount,
        CASE
          WHEN ISNULL(pt.plannedQty, 0) <= 0 THEN 0
          WHEN ISNULL(pt.completedQty, 0) * 100.0 / ISNULL(pt.plannedQty, 0) >= 100 THEN 100
          ELSE ISNULL(pt.completedQty, 0) * 100.0 / ISNULL(pt.plannedQty, 0)
        END as productionProgress,
        CASE
          WHEN ISNULL(s.salesAmount, 0) <= 0 THEN 0
          WHEN ISNULL(fi.invoiceAmount, 0) * 100.0 / ISNULL(s.salesAmount, 0) >= 100 THEN 100
          ELSE ISNULL(fi.invoiceAmount, 0) * 100.0 / ISNULL(s.salesAmount, 0)
        END as invoiceProgress,
        CASE
          WHEN ISNULL(s.salesAmount, 0) <= 0 THEN 0
          WHEN (ISNULL(fr.receiptAmount, 0) + ISNULL(fr.discountAmount, 0)) * 100.0 / ISNULL(s.salesAmount, 0) >= 100
          THEN 100
          ELSE (ISNULL(fr.receiptAmount, 0) + ISNULL(fr.discountAmount, 0)) * 100.0 / ISNULL(s.salesAmount, 0)
        END as receiptProgress,
        CASE
          WHEN ISNULL(fi.invoiceAmount, 0) <= 0 THEN 0
          WHEN (ISNULL(fr.receiptAmount, 0) + ISNULL(fr.discountAmount, 0)) * 100.0 / ISNULL(fi.invoiceAmount, 0) >= 100
          THEN 100
          ELSE (ISNULL(fr.receiptAmount, 0) + ISNULL(fr.discountAmount, 0)) * 100.0 / ISNULL(fi.invoiceAmount, 0)
        END as receiptInvoiceProgress,
        CASE
          WHEN ISNULL(pt.completedQty, 0) <= 0 THEN 0
          WHEN ISNULL(od.outboundQty, 0) * 100.0 / ISNULL(pt.completedQty, 0) >= 100 THEN 100
          ELSE ISNULL(od.outboundQty, 0) * 100.0 / ISNULL(pt.completedQty, 0)
        END as outboundProgress
      FROM 项目管理 p
      OUTER APPLY (
        SELECT TOP 1
          g1.产品名称 as productName,
          g1.产品图号 as productDrawing,
          g1.分类 as category
        FROM 货物信息 g1
        WHERE g1.项目编号 = p.项目编号
          AND (g1.状态 IS NULL OR g1.状态 <> N'已删除')
          AND (g1.IsNew IS NULL OR CAST(g1.IsNew AS INT) != 1)
        ORDER BY g1.货物ID ASC
      ) g
      OUTER APPLY (
        SELECT TOP 1 c1.客户名称 as customerName
        FROM 客户信息 c1
        WHERE c1.客户ID = p.客户ID
      ) c
      OUTER APPLY (
        SELECT
          COUNT(1) as orderCount,
          ISNULL(SUM(ISNULL(so.总金额, 0)), 0) as salesAmount,
          MAX(so.订单日期) as latestOrderDate
        FROM 销售订单 so
        WHERE so.项目编号 = p.项目编号
          AND (so.状态 IS NULL OR so.状态 <> N'已删除')
      ) s
      OUTER APPLY (
        SELECT TOP 1
          so2.经办人 as owner
        FROM 销售订单 so2
        WHERE so2.项目编号 = p.项目编号
          AND (so2.状态 IS NULL OR so2.状态 <> N'已删除')
        ORDER BY so2.订单日期 DESC, so2.订单ID DESC
      ) soOwner
      OUTER APPLY (
        SELECT TOP 1
          pt1.生产状态 as productionStatus,
          pt1.负责人 as owner,
          ISNULL(pt1.投产数量, 0) as plannedQty,
          ISNULL(pt1.已完成数量, 0) as completedQty
        FROM 生产任务 pt1
        WHERE pt1.项目编号 = p.项目编号
          AND (pt1.状态 IS NULL OR pt1.状态 <> N'已删除')
        ORDER BY pt1.下达日期 DESC, pt1.项目编号 DESC
      ) pt
      OUTER APPLY (
        SELECT
          COUNT(DISTINCT od1.出库单号) as outboundDocCount,
          ISNULL(SUM(ISNULL(od1.出库数量, 0)), 0) as outboundQty,
          MAX(od1.出库日期) as latestOutboundDate
        FROM 出库单明细 od1
        WHERE od1.项目编号 = p.项目编号
          AND (od1.状态 IS NULL OR od1.状态 <> N'已删除')
      ) od
      OUTER APPLY (
        SELECT
          COUNT(DISTINCT inv.发票ID) as invoiceCount,
          ISNULL(SUM(ISNULL(fd.金额, 0)), 0) as invoiceAmount,
          MAX(COALESCE(inv.开票日期, inv.单据日期)) as latestInvoiceDate
        FROM 发票明细 fd
        INNER JOIN 开票单据 inv ON inv.发票ID = fd.发票ID
        WHERE fd.项目编号 = p.项目编号
          AND ISNULL(inv.是否删除, 0) = 0
      ) fi
      OUTER APPLY (
        SELECT
          COUNT(DISTINCT r.单据编号) as receiptCount,
          ISNULL(SUM(ISNULL(r.实收金额, 0)), 0) as receiptAmount,
          ISNULL(SUM(ISNULL(r.贴息金额, 0)), 0) as discountAmount,
          MAX(COALESCE(r.回款日期, r.单据日期)) as latestReceiptDate
        FROM 回款单据 r
        WHERE r.项目编号 = p.项目编号
          AND ISNULL(r.是否删除, 0) = 0
      ) fr
      OUTER APPLY (
        SELECT TOP 1
          l.settlement_status as manualSettlementStatus
        FROM dbo.comprehensive_query_settlement_ledger l
        WHERE l.project_code = p.项目编号
          AND ISNULL(l.enabled, 0) = 1
        ORDER BY l.updated_at DESC, l.id DESC
      ) msl
      ${sourceWhereSql}
    )
  `
}

const buildJourney = ({
  projectCode,
  salesRows,
  projectRow,
  taskRow,
  outboundRows,
  invoiceRows,
  receiptRows
}) => {
  const salesCount = salesRows.length
  const salesAmount = salesRows.reduce((sum, row) => sum + safeNumber(row.totalAmount), 0)

  const outboundQty = outboundRows.reduce((sum, row) => sum + safeNumber(row.quantity), 0)
  const outboundDocCount = new Set(
    outboundRows.map((row) => String(row.documentNo || '').trim()).filter(Boolean)
  ).size
  const completedQty = safeNumber(taskRow?.completedQty)
  const totalHours = safeNumber(taskRow?.totalHours)

  const invoiceAmount = invoiceRows.reduce((sum, row) => sum + safeNumber(row.amount), 0)
  const invoiceCount = new Set(
    invoiceRows.map((row) => String(row.documentNo || row.invoiceNo || '').trim()).filter(Boolean)
  ).size

  const receivedAmount = receiptRows.reduce((sum, row) => sum + safeNumber(row.receivedAmount), 0)
  const discountAmount = receiptRows.reduce((sum, row) => sum + safeNumber(row.discountAmount), 0)
  const receivedWithDiscountAmount = receivedAmount + discountAmount
  const receiptCount = new Set(
    receiptRows.map((row) => String(row.documentNo || '').trim()).filter(Boolean)
  ).size

  let salesStatus = 'pending'
  if (salesCount > 0) {
    salesStatus = outboundDocCount > 0 || outboundQty > 0 ? 'completed' : 'in_progress'
  }

  const rawProjectStatus = String(projectRow?.projectStatus || '').trim()
  let projectStatus = 'pending'
  if (projectRow) {
    if (/(完成|移模|结项|结束)/.test(rawProjectStatus)) {
      projectStatus = 'completed'
    } else {
      projectStatus = 'in_progress'
    }
  }

  const rawProductionStatus = String(taskRow?.productionStatus || '').trim()
  let productionStatus = 'pending'
  if (taskRow) {
    if (
      /(已完成|完成)/.test(rawProductionStatus) ||
      (completedQty > 0 && completedQty >= safeNumber(taskRow?.plannedQty))
    ) {
      productionStatus = 'completed'
    } else if (/(待开始|未开始)/.test(rawProductionStatus)) {
      productionStatus = 'pending'
    } else {
      productionStatus = 'in_progress'
    }
  }

  let outboundStatus = 'pending'
  if (outboundRows.length > 0) {
    if (completedQty > 0 && outboundQty >= completedQty) {
      outboundStatus = 'completed'
    } else {
      outboundStatus = 'in_progress'
    }
  }

  let invoiceStatus = 'pending'
  if (invoiceCount > 0) {
    if (salesAmount > 0 && invoiceAmount >= salesAmount) {
      invoiceStatus = 'completed'
    } else {
      invoiceStatus = 'in_progress'
    }
  }

  let receiptStatus = 'pending'
  if (receiptCount > 0) {
    if (invoiceAmount > 0 && receivedWithDiscountAmount >= invoiceAmount) {
      receiptStatus = 'completed'
    } else {
      receiptStatus = 'in_progress'
    }
  }

  const stages = [
    {
      key: 'sales',
      name: '销售',
      status: normalizeStageStatus(salesStatus),
      summary: salesCount > 0 ? `订单 ${salesCount} 单` : '暂无销售订单',
      metrics: {
        orderCount: salesCount,
        amount: salesAmount
      },
      dates: {
        latestOrderDate: getMaxDate(salesRows, 'orderDate')
      }
    },
    {
      key: 'project',
      name: '项目管理',
      status: normalizeStageStatus(projectStatus),
      summary: rawProjectStatus || '暂无项目状态',
      metrics: {
        statusText: rawProjectStatus || '-'
      },
      dates: {
        drawingReleaseDate: toDateString(projectRow?.drawingReleaseDate),
        plannedSampleDate: toDateString(projectRow?.plannedSampleDate),
        firstSampleDate: toDateString(projectRow?.firstSampleDate),
        relocationDate: toDateString(projectRow?.relocationDate)
      }
    },
    {
      key: 'production',
      name: '生产任务',
      status: normalizeStageStatus(productionStatus),
      summary: rawProductionStatus || '暂无生产任务状态',
      metrics: {
        plannedQty: safeNumber(taskRow?.plannedQty),
        completedQty: completedQty,
        totalHours
      },
      dates: {
        issuedDate: toDateString(taskRow?.issuedDate),
        startDate: toDateString(taskRow?.startDate),
        endDate: toDateString(taskRow?.endDate),
        totalHours: totalHours > 0 ? String(totalHours) : ''
      }
    },
    {
      key: 'outbound',
      name: '出货',
      status: normalizeStageStatus(outboundStatus),
      summary: outboundDocCount > 0 ? `出库 ${outboundDocCount} 单` : '暂无出货单据',
      metrics: {
        documentCount: outboundDocCount,
        quantity: outboundQty
      },
      dates: {
        latestOutboundDate: getMaxDate(outboundRows, 'outboundDate')
      }
    },
    {
      key: 'invoice',
      name: '开票',
      status: normalizeStageStatus(invoiceStatus),
      summary: invoiceCount > 0 ? `开票 ${invoiceCount} 单` : '暂无开票单据',
      metrics: {
        documentCount: invoiceCount,
        amount: invoiceAmount
      },
      dates: {
        latestInvoiceDate: getMaxDate(invoiceRows, 'invoiceDate')
      }
    },
    {
      key: 'receipt',
      name: '回款',
      status: normalizeStageStatus(receiptStatus),
      summary: receiptCount > 0 ? `回款 ${receiptCount} 单` : '暂无回款单据',
      metrics: {
        documentCount: receiptCount,
        amount: receivedAmount,
        discountAmount
      },
      dates: {
        latestReceiptDate: getMaxDate(receiptRows, 'receiptDate')
      }
    }
  ]

  const events = []

  salesRows.forEach((row) => {
    const orderNo = String(row.orderNo || '').trim()
    pushEvent(events, {
      stage: 'sales',
      title: `销售订单 ${orderNo || '-'}`,
      date: toDateString(row.orderDate),
      detail: `金额 ¥${safeNumber(row.totalAmount).toLocaleString()}`
    })
    pushEvent(events, {
      stage: 'sales',
      title: `订单交期 ${orderNo || '-'}`,
      date: toDateString(row.deliveryDate),
      detail: '交货日期'
    })
    if (Number(row.isShipped) === 1) {
      pushEvent(events, {
        stage: 'sales',
        title: `订单已出运 ${orderNo || '-'}`,
        date: toDateString(row.shippingDate),
        detail: '销售订单出运完成'
      })
    }
  })

  pushEvent(events, {
    stage: 'project',
    title: '图纸下发',
    date: toDateString(projectRow?.drawingReleaseDate),
    detail: '项目管理节点'
  })
  pushEvent(events, {
    stage: 'project',
    title: '计划首样',
    date: toDateString(projectRow?.plannedSampleDate),
    detail: '项目管理节点'
  })
  pushEvent(events, {
    stage: 'project',
    title: '首次送样',
    date: toDateString(projectRow?.firstSampleDate),
    detail: '项目管理节点'
  })
  pushEvent(events, {
    stage: 'project',
    title: '移模日期',
    date: toDateString(projectRow?.relocationDate),
    detail: '项目管理节点'
  })

  pushEvent(events, {
    stage: 'production',
    title: '生产下达',
    date: toDateString(taskRow?.issuedDate),
    detail: '生产任务节点'
  })
  pushEvent(events, {
    stage: 'production',
    title: '生产开始',
    date: toDateString(taskRow?.startDate),
    detail: '生产任务节点'
  })
  pushEvent(events, {
    stage: 'production',
    title: '生产结束',
    date: toDateString(taskRow?.endDate),
    detail: '生产任务节点'
  })

  outboundRows.forEach((row) => {
    pushEvent(events, {
      stage: 'outbound',
      title: `出库单 ${String(row.documentNo || '').trim() || '-'}`,
      date: toDateString(row.outboundDate),
      detail: `数量 ${safeNumber(row.quantity).toLocaleString()}`
    })
  })

  invoiceRows.forEach((row) => {
    pushEvent(events, {
      stage: 'invoice',
      title: `开票单 ${String(row.documentNo || row.invoiceNo || '-').trim() || '-'}`,
      date: toDateString(row.invoiceDate),
      detail: `金额 ¥${safeNumber(row.amount).toLocaleString()}`
    })
  })

  receiptRows.forEach((row) => {
    const discount = safeNumber(row.discountAmount)
    pushEvent(events, {
      stage: 'receipt',
      title: `回款单 ${String(row.documentNo || '-').trim() || '-'}`,
      date: toDateString(row.receiptDate),
      detail:
        discount > 0
          ? `实收 ¥${safeNumber(row.receivedAmount).toLocaleString()}，贴息 ¥${discount.toLocaleString()}`
          : `实收 ¥${safeNumber(row.receivedAmount).toLocaleString()}`
    })
  })

  events.sort((a, b) => toTime(b.date) - toTime(a.date))

  return {
    projectCode,
    stages,
    events: events.slice(0, 200),
    summary: {
      salesAmount,
      salesCount,
      outboundQty,
      completedQty,
      invoiceAmount,
      invoiceCount,
      receivedAmount,
      discountAmount,
      receiptCount,
      uninvoicedAmount: Math.max(0, salesAmount - invoiceAmount),
      unreceivedAmount: Math.max(0, invoiceAmount - receivedWithDiscountAmount)
    }
  }
}

router.get('/list', async (req, res) => {
  try {
    const { page = 1, pageSize = 20 } = req.query

    const pageNum = Math.max(parseInt(String(page), 10) || 1, 1)
    const sizeNum = Math.max(parseInt(String(pageSize), 10) || 20, 1)
    const offset = (pageNum - 1) * sizeNum

    const { params, sourceWhereSql, baseWhereSql } = buildListFilters(req.query)
    const baseCteSql = buildBaseCteSql(sourceWhereSql)
    const settlementStatusSql = buildSettlementStatusSql('base')
    const settlementSourceSql = buildSettlementSourceSql('base')
    const anomalyTypeSql = buildAnomalyTypeSql('base')

    const countRows = await query(
      `${baseCteSql}
      SELECT COUNT(1) as total
      FROM base
      ${baseWhereSql}`,
      params
    )
    const total = safeNumber(countRows?.[0]?.total)

    const rows = await query(
      `${baseCteSql}
      SELECT
        base.projectCode,
        base.customerName,
        base.productName,
        base.productDrawing,
        base.customerModelNo,
        base.category,
        base.owner,
        base.salesOrderCount,
        base.salesAmount,
        base.projectStatus,
        base.productionStatus,
        base.completedQty,
        base.outboundDocCount,
        base.outboundQty,
        base.invoiceCount,
        base.invoiceAmount,
        base.receiptCount,
        base.receiptAmount,
        base.discountAmount,
        ${settlementStatusSql} as settlementStatus,
        ${settlementSourceSql} as settlementSource,
        base.uninvoicedAmount,
        base.unreceivedAmount,
        ${anomalyTypeSql} as anomalyType,
        CONVERT(varchar(10), base.latestOrderDate, 23) as latestOrderDate,
        CONVERT(varchar(10), base.latestOutboundDate, 23) as latestOutboundDate,
        CONVERT(varchar(10), base.latestInvoiceDate, 23) as latestInvoiceDate,
        CONVERT(varchar(10), base.latestReceiptDate, 23) as latestReceiptDate
      FROM base
      ${baseWhereSql}
      ORDER BY base.projectCode DESC
      OFFSET ${offset} ROWS FETCH NEXT ${sizeNum} ROWS ONLY`,
      params
    )

    res.json({
      code: 0,
      success: true,
      data: {
        list: rows || [],
        total,
        page: pageNum,
        pageSize: sizeNum
      }
    })
  } catch (error) {
    console.error('获取综合查询列表失败:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: '获取综合查询列表失败'
    })
  }
})

router.get('/export', async (req, res) => {
  try {
    const { params, sourceWhereSql, baseWhereSql } = buildListFilters(req.query)
    const baseCteSql = buildBaseCteSql(sourceWhereSql)
    const settlementStatusSql = buildSettlementStatusSql('base')
    const settlementSourceSql = buildSettlementSourceSql('base')
    const anomalyTypeSql = buildAnomalyTypeSql('base')

    const rows = await query(
      `${baseCteSql}
      SELECT
        base.projectCode,
        base.customerName,
        base.productName,
        base.productDrawing,
        base.customerModelNo,
        base.category,
        base.owner,
        base.salesOrderCount,
        base.salesAmount,
        base.projectStatus,
        base.productionStatus,
        base.completedQty,
        base.outboundDocCount,
        base.outboundQty,
        base.invoiceCount,
        base.invoiceAmount,
        base.receiptCount,
        base.receiptAmount,
        base.discountAmount,
        ${settlementStatusSql} as settlementStatus,
        ${settlementSourceSql} as settlementSource,
        base.uninvoicedAmount,
        base.unreceivedAmount,
        ${anomalyTypeSql} as anomalyType,
        CONVERT(varchar(10), base.latestOrderDate, 23) as latestOrderDate,
        CONVERT(varchar(10), base.latestOutboundDate, 23) as latestOutboundDate,
        CONVERT(varchar(10), base.latestInvoiceDate, 23) as latestInvoiceDate,
        CONVERT(varchar(10), base.latestReceiptDate, 23) as latestReceiptDate
      FROM base
      ${baseWhereSql}
      ORDER BY base.projectCode DESC`,
      params
    )

    const buffer = await buildExportWorkbookBuffer(rows || [])

    const now = new Date()
    const ts = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}_${pad2(
      now.getHours()
    )}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`
    const methodLabel = buildExportQueryMethodLabel(req.query)
    const filename = `综合查询_${methodLabel}_${ts}.xlsx`
    const encodedFilename = encodeURIComponent(filename)
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFilename}`)
    res.send(Buffer.from(buffer))
  } catch (error) {
    console.error('导出综合查询失败:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: '导出综合查询失败'
    })
  }
})

router.get('/summary', async (req, res) => {
  try {
    const { params, sourceWhereSql, baseWhereSql } = buildListFilters(req.query)
    const baseCteSql = buildBaseCteSql(sourceWhereSql)

    const rows = await query(
      `${baseCteSql}
      SELECT
        COUNT(1) as projectCount,
        ISNULL(SUM(base.salesAmount), 0) as salesAmount,
        ISNULL(SUM(base.invoiceAmount), 0) as invoiceAmount,
        ISNULL(SUM(base.receiptAmount), 0) as receiptAmount,
        ISNULL(SUM(base.discountAmount), 0) as discountAmount,
        ISNULL(SUM(base.completedQty), 0) as completedQty,
        ISNULL(SUM(base.outboundQty), 0) as outboundQty,
        ISNULL(SUM(base.uninvoicedAmount), 0) as uninvoicedAmount,
        ISNULL(SUM(base.unreceivedAmount), 0) as unreceivedAmount
      FROM base
      ${baseWhereSql}`,
      params
    )

    const summary = rows?.[0] || {}

    res.json({
      code: 0,
      success: true,
      data: {
        projectCount: safeNumber(summary.projectCount),
        salesAmount: safeNumber(summary.salesAmount),
        invoiceAmount: safeNumber(summary.invoiceAmount),
        receiptAmount: safeNumber(summary.receiptAmount),
        discountAmount: safeNumber(summary.discountAmount),
        completedQty: safeNumber(summary.completedQty),
        outboundQty: safeNumber(summary.outboundQty),
        uninvoicedAmount: safeNumber(summary.uninvoicedAmount),
        unreceivedAmount: safeNumber(summary.unreceivedAmount)
      }
    })
  } catch (error) {
    console.error('获取综合查询汇总失败:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: '获取综合查询汇总失败'
    })
  }
})

router.get('/project-journey', async (req, res) => {
  try {
    const projectCode = String(req.query.projectCode || '').trim()
    if (!projectCode) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: 'projectCode 不能为空'
      })
    }

    const [salesRows, projectRows, taskRows, outboundRows, invoiceRows, receiptRows] =
      await Promise.all([
        query(
          `
            SELECT
              so.订单编号 as orderNo,
              so.订单日期 as orderDate,
              so.交货日期 as deliveryDate,
              so.总金额 as totalAmount,
              so.是否出运 as isShipped,
              so.出运日期 as shippingDate
            FROM 销售订单 so
            WHERE so.项目编号 = @projectCode
              AND (so.状态 IS NULL OR so.状态 <> N'已删除')
            ORDER BY so.订单日期 DESC, so.订单ID DESC
          `,
          { projectCode }
        ),
        query(
          `
            SELECT TOP 1
              p.项目编号 as projectCode,
              p.项目状态 as projectStatus,
              p.图纸下发日期 as drawingReleaseDate,
              p.计划首样日期 as plannedSampleDate,
              p.首次送样日期 as firstSampleDate,
              p.移模日期 as relocationDate,
              p.客户ID as customerId
            FROM 项目管理 p
            WHERE p.项目编号 = @projectCode
              AND (p.状态 IS NULL OR p.状态 <> N'已删除')
          `,
          { projectCode }
        ),
        query(
          `
            SELECT TOP 1
              pt.项目编号 as projectCode,
              pt.生产状态 as productionStatus,
              pt.投产数量 as plannedQty,
              pt.已完成数量 as completedQty,
              pt.合计工时 as totalHours,
              pt.下达日期 as issuedDate,
              pt.开始日期 as startDate,
              pt.结束日期 as endDate,
              pt.负责人 as owner
            FROM 生产任务 pt
            WHERE pt.项目编号 = @projectCode
              AND (pt.状态 IS NULL OR pt.状态 <> N'已删除')
            ORDER BY pt.下达日期 DESC, pt.项目编号 DESC
          `,
          { projectCode }
        ),
        query(
          `
            SELECT
              od.出库单号 as documentNo,
              od.出库日期 as outboundDate,
              od.出库数量 as quantity
            FROM 出库单明细 od
            WHERE od.项目编号 = @projectCode
              AND (od.状态 IS NULL OR od.状态 <> N'已删除')
            ORDER BY od.出库日期 DESC, od.id DESC
          `,
          { projectCode }
        ),
        query(
          `
            SELECT
              inv.单据编号 as documentNo,
              inv.发票号码 as invoiceNo,
              COALESCE(inv.开票日期, inv.单据日期) as invoiceDate,
              fd.金额 as amount
            FROM 发票明细 fd
            INNER JOIN 开票单据 inv ON inv.发票ID = fd.发票ID
            WHERE fd.项目编号 = @projectCode
              AND ISNULL(inv.是否删除, 0) = 0
            ORDER BY COALESCE(inv.开票日期, inv.单据日期) DESC, inv.发票ID DESC
          `,
          { projectCode }
        ),
        query(
          `
            SELECT
              r.单据编号 as documentNo,
              COALESCE(r.回款日期, r.单据日期) as receiptDate,
              r.实收金额 as receivedAmount,
              r.贴息金额 as discountAmount
            FROM 回款单据 r
            WHERE r.项目编号 = @projectCode
              AND ISNULL(r.是否删除, 0) = 0
            ORDER BY COALESCE(r.回款日期, r.单据日期) DESC, r.回款ID DESC
          `,
          { projectCode }
        )
      ])

    const data = buildJourney({
      projectCode,
      salesRows: salesRows || [],
      projectRow: projectRows?.[0] || null,
      taskRow: taskRows?.[0] || null,
      outboundRows: outboundRows || [],
      invoiceRows: invoiceRows || [],
      receiptRows: receiptRows || []
    })

    res.json({
      code: 0,
      success: true,
      data
    })
  } catch (error) {
    console.error('获取项目洞察失败:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: '获取项目洞察失败'
    })
  }
})

module.exports = router
