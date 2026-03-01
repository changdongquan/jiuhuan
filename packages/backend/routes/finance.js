const express = require('express')
const sql = require('mssql')
const { query, getPool } = require('../database')
const { resolveActorFromReq } = require('../utils/actor')
const { ensurePendingHardDeleteReviewRequest } = require('../services/projectHardDeleteReview')

const router = express.Router()

const toDateText = (value) => {
  if (!value) return ''
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const toNum = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const toDateOrNull = (value) => {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

const ensureFinanceSoftDeleteColumns = async (poolOrTx) => {
  const req = new sql.Request(poolOrTx)
  await req.batch(`
    IF COL_LENGTH(N'开票单据', N'是否删除') IS NULL
      ALTER TABLE 开票单据 ADD 是否删除 BIT NOT NULL CONSTRAINT DF_开票单据_是否删除 DEFAULT(0);
    IF COL_LENGTH(N'开票单据', N'删除时间') IS NULL
      ALTER TABLE 开票单据 ADD 删除时间 DATETIME2 NULL;
    IF COL_LENGTH(N'开票单据', N'删除人') IS NULL
      ALTER TABLE 开票单据 ADD 删除人 NVARCHAR(100) NULL;

    IF COL_LENGTH(N'回款单据', N'是否删除') IS NULL
      ALTER TABLE 回款单据 ADD 是否删除 BIT NOT NULL CONSTRAINT DF_回款单据_是否删除 DEFAULT(0);
    IF COL_LENGTH(N'回款单据', N'删除时间') IS NULL
      ALTER TABLE 回款单据 ADD 删除时间 DATETIME2 NULL;
    IF COL_LENGTH(N'回款单据', N'删除人') IS NULL
      ALTER TABLE 回款单据 ADD 删除人 NVARCHAR(100) NULL;
  `)
}

router.get('/invoices/list', async (req, res) => {
  try {
    const pool = await getPool()
    await ensureFinanceSoftDeleteColumns(pool)

    const {
      page = 1,
      pageSize = 10,
      itemCode,
      customerName,
      status,
      invoiceDateStart,
      invoiceDateEnd
    } = req.query

    const params = {}
    const where = ['ISNULL(i.是否删除, 0) = 0']

    if (itemCode) {
      where.push(`
        (
          i.单据编号 LIKE @itemCode
          OR i.发票号码 LIKE @itemCode
          OR d.项目编号 LIKE @itemCode
          OR d.产品名称 LIKE @itemCode
          OR d.产品图号 LIKE @itemCode
          OR d.客户模号 LIKE @itemCode
        )
      `)
      params.itemCode = `%${String(itemCode).trim()}%`
    }

    if (customerName) {
      where.push('c.客户名称 LIKE @customerName')
      params.customerName = `%${String(customerName).trim()}%`
    }

    if (status === 'normal') {
      where.push('ISNULL(i.是否红冲, 0) = 0')
    } else if (status === 'red') {
      where.push('ISNULL(i.是否红冲, 0) = 1')
    }

    if (invoiceDateStart) {
      where.push('COALESCE(i.开票日期, i.单据日期) >= @invoiceDateStart')
      params.invoiceDateStart = String(invoiceDateStart)
    }

    if (invoiceDateEnd) {
      where.push('COALESCE(i.开票日期, i.单据日期) <= @invoiceDateEnd')
      params.invoiceDateEnd = String(invoiceDateEnd)
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''

    const rows = await query(
      `
      SELECT
        i.发票ID as invoiceId,
        i.单据编号 as documentNo,
        i.发票号码 as invoiceNo,
        i.单据日期 as documentDate,
        i.开票日期 as invoiceDate,
        i.金额 as headerAmount,
        i.是否红冲 as isRed,
        c.客户名称 as customerName,
        d.明细ID as detailId,
        d.项目编号 as itemCode,
        d.产品名称 as productName,
        d.产品图号 as productDrawingNo,
        d.客户模号 as customerPartNo,
        d.合同号 as contractNo,
        d.数量 as quantity,
        d.单价 as unitPrice,
        d.金额 as amount,
        d.备注 as remark,
        d.是否已开全额发票 as fullIssued,
        d.是否已开预付发票 as prepaidIssued,
        d.是否已开验收发票 as acceptanceIssued,
        d.是否已红冲 as detailIsRed,
        d.是否结清 as detailIsSettled,
        d.SSMA_TimeStamp as ssmaTimestamp
      FROM 开票单据 i
      LEFT JOIN 客户信息 c ON c.客户ID = i.客户ID
      LEFT JOIN 发票明细 d ON d.发票ID = i.发票ID
      ${whereClause}
      ORDER BY COALESCE(i.开票日期, i.单据日期) DESC, i.发票ID DESC, d.明细ID ASC
      `,
      params
    )

    const grouped = new Map()

    rows.forEach((row) => {
      const id = Number(row.invoiceId)
      if (!grouped.has(id)) {
        const isRed = Boolean(row.isRed)
        grouped.set(id, {
          id,
          documentNo: String(row.documentNo || row.invoiceNo || ''),
          invoiceNo: String(row.invoiceNo || ''),
          customerName: String(row.customerName || ''),
          contractNo: String(row.contractNo || ''),
          status: isRed ? 'red' : 'normal',
          invoiceDate: toDateText(row.invoiceDate || row.documentDate),
          deliveryDate: toDateText(row.documentDate),
          details: []
        })
      }

      if (row.detailId) {
        const group = grouped.get(id)
        if (!group.contractNo && row.contractNo) group.contractNo = String(row.contractNo)
        group.details.push({
          id: Number(row.detailId),
          invoiceId: id,
          itemCode: String(row.itemCode || ''),
          productName: String(row.productName || ''),
          productDrawingNo: String(row.productDrawingNo || ''),
          customerPartNo: String(row.customerPartNo || ''),
          contractNo: String(row.contractNo || ''),
          quantity: toNum(row.quantity),
          unitPrice: toNum(row.unitPrice),
          amount: toNum(row.amount),
          remark: String(row.remark || ''),
          fullIssued: Boolean(row.fullIssued),
          prepaidIssued: Boolean(row.prepaidIssued),
          acceptanceIssued: Boolean(row.acceptanceIssued),
          detailIsRed: Boolean(row.detailIsRed),
          detailIsSettled: Boolean(row.detailIsSettled),
          ssmaTimestamp: row.ssmaTimestamp
            ? Buffer.from(row.ssmaTimestamp).toString('hex').toUpperCase()
            : ''
        })
      }
    })

    const list = Array.from(grouped.values())
    const pageNum = Math.max(1, parseInt(page, 10) || 1)
    const sizeNum = Math.max(1, parseInt(pageSize, 10) || 10)
    const offset = (pageNum - 1) * sizeNum

    res.json({
      code: 0,
      success: true,
      data: {
        list: list.slice(offset, offset + sizeNum),
        total: list.length,
        page: pageNum,
        pageSize: sizeNum
      }
    })
  } catch (error) {
    console.error('获取开票单据列表失败:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: '获取开票单据列表失败',
      error: error.message
    })
  }
})

router.get('/invoices/candidates', async (req, res) => {
  try {
    const { filterType = 'no_invoice', keyword, customerName, page = 1, pageSize = 50 } = req.query
    const baseParams = {}
    const baseWhere = []
    const pageNum = Math.max(1, parseInt(page, 10) || 1)
    const sizeNum = Math.min(200, Math.max(1, parseInt(pageSize, 10) || 50))
    const offset = (pageNum - 1) * sizeNum

    if (filterType === 'no_invoice') {
      baseWhere.push('f.项目编号 IS NULL')
    } else if (filterType === 'prepaid_pending') {
      baseWhere.push(
        'ISNULL(f.是否已开预付发票, 0) = 1 AND ISNULL(f.是否已开验收发票, 0) = 0 AND ISNULL(f.是否已开全额发票, 0) = 0'
      )
      baseWhere.push(
        's.项目编号 NOT IN (SELECT DISTINCT 项目编号 FROM 发票明细 WHERE ISNULL(是否已开全额发票, 0) = 1)'
      )
    } else if (filterType === 'full') {
      baseWhere.push('ISNULL(f.是否已开全额发票, 0) = 1')
    }

    if (keyword) {
      baseWhere.push(
        '(s.项目编号 LIKE @keyword OR h.产品名称 LIKE @keyword OR h.产品图号 LIKE @keyword OR p.客户模号 LIKE @keyword OR s.合同号 LIKE @keyword)'
      )
      baseParams.keyword = `%${String(keyword).trim()}%`
    }

    const params = { ...baseParams }
    const where = [...baseWhere]
    if (customerName) {
      where.push('c.客户名称 = @customerName')
      params.customerName = String(customerName).trim()
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''
    const baseSql = `
      SELECT DISTINCT
        s.项目编号 as itemCode,
        h.产品名称 as productName,
        h.产品图号 as productDrawingNo,
        p.客户模号 as customerPartNo,
        c.客户名称 as customerName,
        s.单价 as unitPrice,
        s.合同号 as contractNo
      FROM 销售订单 s
      INNER JOIN 项目管理 p ON s.项目编号 = p.项目编号
      INNER JOIN 货物信息 h ON s.项目编号 = h.项目编号
      LEFT JOIN 客户信息 c ON p.客户ID = c.客户ID
      LEFT JOIN 发票明细 f ON s.项目编号 = f.项目编号
      ${whereClause}
    `
    const optionWhere = [
      ...baseWhere,
      "c.客户名称 IS NOT NULL",
      "LTRIM(RTRIM(c.客户名称)) <> ''"
    ]
    const optionWhereClause = optionWhere.length > 0 ? `WHERE ${optionWhere.join(' AND ')}` : ''
    const customerOptionRows = await query(
      `
      SELECT DISTINCT c.客户名称 as customerName
      FROM 销售订单 s
      INNER JOIN 项目管理 p ON s.项目编号 = p.项目编号
      INNER JOIN 货物信息 h ON s.项目编号 = h.项目编号
      LEFT JOIN 客户信息 c ON p.客户ID = c.客户ID
      LEFT JOIN 发票明细 f ON s.项目编号 = f.项目编号
      ${optionWhereClause}
      ORDER BY c.客户名称 ASC
      `,
      baseParams
    )
    const customerOptions = customerOptionRows.map((r) => String(r.customerName || '').trim()).filter(Boolean)

    const countRows = await query(`SELECT COUNT(1) as total FROM (${baseSql}) t`, params)
    const total = Number(countRows?.[0]?.total || 0)

    const rows = await query(
      `
      SELECT *
      FROM (${baseSql}) t
      ORDER BY t.itemCode DESC
      OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
      `,
      { ...params, offset, pageSize: sizeNum }
    )

    res.json({
      code: 0,
      success: true,
      data: {
        list: rows,
        customerOptions,
        total,
        page: pageNum,
        pageSize: sizeNum
      }
    })
  } catch (error) {
    console.error('获取开票候选明细失败:', error)
    res.status(500).json({ code: 500, success: false, message: '获取开票候选明细失败', error: error.message })
  }
})

router.get('/receipts/list', async (req, res) => {
  try {
    const pool = await getPool()
    await ensureFinanceSoftDeleteColumns(pool)

    const {
      page = 1,
      pageSize = 10,
      itemCode,
      customerName,
      status,
      receiptDateStart,
      receiptDateEnd
    } = req.query

    const params = {}
    const where = ['ISNULL(r.是否删除, 0) = 0']

    if (itemCode) {
      where.push(`
        (
          r.单据编号 LIKE @itemCode
          OR r.项目编号 LIKE @itemCode
          OR r.产品名称 LIKE @itemCode
          OR r.产品图号 LIKE @itemCode
          OR r.客户模号 LIKE @itemCode
        )
      `)
      params.itemCode = `%${String(itemCode).trim()}%`
    }

    if (customerName) {
      where.push('r.客户名称 LIKE @customerName')
      params.customerName = `%${String(customerName).trim()}%`
    }

    if (receiptDateStart) {
      where.push('r.单据日期 >= @receiptDateStart')
      params.receiptDateStart = String(receiptDateStart)
    }

    if (receiptDateEnd) {
      where.push('r.单据日期 <= @receiptDateEnd')
      params.receiptDateEnd = String(receiptDateEnd)
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''

    const rows = await query(
      `
      SELECT
        r.回款ID as receiptId,
        r.单据编号 as documentNo,
        r.单据日期 as documentDate,
        r.回款日期 as receiptDate,
        r.客户名称 as customerName,
        r.合同号 as contractNo,
        r.明细ID as detailId,
        r.项目编号 as itemCode,
        r.产品名称 as productName,
        r.产品图号 as productDrawingNo,
        r.客户模号 as customerPartNo,
        r.收款账户 as accountName,
        r.收款进度 as receiptProgress,
        r.回款方式 as receiptMethod,
        r.备注 as remark,
        r.应收金额 as receivableAmount,
        r.实收金额 as amount,
        r.贴息金额 as discountAmount,
        r.是否结清 as isSettled,
        r.合计金额 as totalAmount
      FROM 回款单据 r
      ${whereClause}
      ORDER BY r.单据日期 DESC, r.单据编号 DESC, r.回款ID ASC
      `,
      params
    )

    const grouped = new Map()

    rows.forEach((row) => {
      const no = String(row.documentNo || '')
      if (!grouped.has(no)) {
        grouped.set(no, {
          id: Number(row.receiptId) || 0,
          documentNo: no,
          receiptNo: no,
          customerName: String(row.customerName || ''),
          contractNo: String(row.contractNo || ''),
          status: 'pending',
          receiptDate: toDateText(row.receiptDate || row.documentDate),
          deliveryDate: toDateText(row.documentDate),
          totalAmount: toNum(row.totalAmount),
          details: [],
          __allSettled: true
        })
      }

      const group = grouped.get(no)
      if (Number(row.receiptId) > group.id) group.id = Number(row.receiptId)
      if (!group.contractNo && row.contractNo) group.contractNo = String(row.contractNo)
      group.__allSettled = group.__allSettled && Boolean(row.isSettled)

      group.details.push({
        id: Number(row.receiptId),
        documentNo: no,
        detailId: row.detailId != null ? Number(row.detailId) : null,
        itemCode: String(row.itemCode || ''),
        productName: String(row.productName || ''),
        productDrawingNo: String(row.productDrawingNo || ''),
        customerPartNo: String(row.customerPartNo || ''),
        contractNo: String(row.contractNo || ''),
        receivableAmount: toNum(row.receivableAmount),
        amount: toNum(row.amount),
        discountAmount: toNum(row.discountAmount),
        receiptProgress: String(row.receiptProgress || ''),
        receiptDate: toDateText(row.receiptDate),
        deliveryDate: toDateText(row.documentDate),
        receiptMethod: String(row.receiptMethod || ''),
        accountName: String(row.accountName || ''),
        customerName: String(row.customerName || ''),
        remark: String(row.remark || ''),
        isSettled: Boolean(row.isSettled)
      })
    })

    let list = Array.from(grouped.values()).map((item) => ({
      id: item.id,
      documentNo: item.documentNo,
      receiptNo: item.receiptNo,
      customerName: item.customerName,
      contractNo: item.contractNo,
      status: item.__allSettled ? 'received' : 'pending',
      receiptDate: item.receiptDate,
      deliveryDate: item.deliveryDate,
      totalAmount: item.totalAmount,
      details: item.details
    }))

    if (status === 'received') {
      list = list.filter((item) => item.status === 'received')
    } else if (status === 'pending') {
      list = list.filter((item) => item.status === 'pending')
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1)
    const sizeNum = Math.max(1, parseInt(pageSize, 10) || 10)
    const offset = (pageNum - 1) * sizeNum

    res.json({
      code: 0,
      success: true,
      data: {
        list: list.slice(offset, offset + sizeNum),
        total: list.length,
        page: pageNum,
        pageSize: sizeNum
      }
    })
  } catch (error) {
    console.error('获取回款单据列表失败:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: '获取回款单据列表失败',
      error: error.message
    })
  }
})

router.get('/receipts/candidates', async (req, res) => {
  try {
    const { keyword, customerName, page = 1, pageSize = 50 } = req.query
    const baseParams = {}
    const baseWhere = [
      'ISNULL(f.是否已红冲, 0) = 0',
      'ISNULL(f.金额, 0) - ISNULL(r.totalReceived, 0) - ISNULL(r.totalDiscount, 0) > 0'
    ]
    const pageNum = Math.max(1, parseInt(page, 10) || 1)
    const sizeNum = Math.min(200, Math.max(1, parseInt(pageSize, 10) || 50))
    const offset = (pageNum - 1) * sizeNum

    if (keyword) {
      baseWhere.push(
        '(f.项目编号 LIKE @keyword OR f.产品名称 LIKE @keyword OR f.产品图号 LIKE @keyword OR f.客户模号 LIKE @keyword OR f.合同号 LIKE @keyword OR CONVERT(NVARCHAR(50), f.明细ID) LIKE @keyword)'
      )
      baseParams.keyword = `%${String(keyword).trim()}%`
    }

    const params = { ...baseParams }
    const where = [...baseWhere]
    if (customerName) {
      where.push('c.客户名称 = @customerName')
      params.customerName = String(customerName).trim()
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''
    const baseSql = `
      SELECT
        f.明细ID as detailId,
        f.项目编号 as itemCode,
        f.产品名称 as productName,
        f.产品图号 as productDrawingNo,
        f.客户模号 as customerPartNo,
        f.合同号 as contractNo,
        c.客户名称 as customerName,
        ISNULL(f.金额, 0) as invoiceAmount,
        ISNULL(r.totalReceived, 0) as receivedAmount,
        ISNULL(r.totalDiscount, 0) as discountAmount,
        ISNULL(f.金额, 0) - ISNULL(r.totalReceived, 0) - ISNULL(r.totalDiscount, 0) as receivableAmount
      FROM 发票明细 f
      LEFT JOIN 开票单据 i ON i.发票ID = f.发票ID
      LEFT JOIN 客户信息 c ON c.客户ID = i.客户ID
      LEFT JOIN (
        SELECT
          明细ID,
          SUM(ISNULL(实收金额, 0)) as totalReceived,
          SUM(ISNULL(贴息金额, 0)) as totalDiscount
        FROM 回款单据
        GROUP BY 明细ID
      ) r ON r.明细ID = f.明细ID
      ${whereClause}
    `
    const optionWhere = [
      ...baseWhere,
      "c.客户名称 IS NOT NULL",
      "LTRIM(RTRIM(c.客户名称)) <> ''"
    ]
    const optionWhereClause = optionWhere.length > 0 ? `WHERE ${optionWhere.join(' AND ')}` : ''
    const customerOptionRows = await query(
      `
      SELECT DISTINCT c.客户名称 as customerName
      FROM 发票明细 f
      LEFT JOIN 开票单据 i ON i.发票ID = f.发票ID
      LEFT JOIN 客户信息 c ON c.客户ID = i.客户ID
      LEFT JOIN (
        SELECT
          明细ID,
          SUM(ISNULL(实收金额, 0)) as totalReceived,
          SUM(ISNULL(贴息金额, 0)) as totalDiscount
        FROM 回款单据
        GROUP BY 明细ID
      ) r ON r.明细ID = f.明细ID
      ${optionWhereClause}
      ORDER BY c.客户名称 ASC
      `,
      baseParams
    )
    const customerOptions = customerOptionRows.map((r) => String(r.customerName || '').trim()).filter(Boolean)

    const countRows = await query(`SELECT COUNT(1) as total FROM (${baseSql}) t`, params)
    const total = Number(countRows?.[0]?.total || 0)

    const list = await query(
      `
      SELECT *
      FROM (${baseSql}) t
      ORDER BY t.detailId DESC
      OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
      `,
      { ...params, offset, pageSize: sizeNum }
    )

    res.json({
      code: 0,
      success: true,
      data: {
        list,
        customerOptions,
        total,
        page: pageNum,
        pageSize: sizeNum
      }
    })
  } catch (error) {
    console.error('获取回款候选明细失败:', error)
    res.status(500).json({ code: 500, success: false, message: '获取回款候选明细失败', error: error.message })
  }
})

router.post('/invoices', async (req, res) => {
  const payload = req.body || {}
  let documentNo = String(payload.documentNo || '').trim()
  const invoiceNo = String(payload.invoiceNo || '').trim()
  const customerName = String(payload.customerName || '').trim()
  const contractNo = String(payload.contractNo || '').trim()
  const status = payload.status === 'red' ? 'red' : 'normal'
  const invoiceDate = toDateOrNull(payload.invoiceDate)
  const documentDate = new Date()
  const details = Array.isArray(payload.details) ? payload.details : []

  if (!documentNo) {
    const today = toDateText(documentDate).replace(/-/g, '')
    const prefix = `KP-${today}-`
    const rows = await query(
      `
      SELECT TOP 1 单据编号 as documentNo
      FROM 开票单据
      WHERE 单据编号 LIKE @prefix
      ORDER BY 单据编号 DESC
      `,
      { prefix: `${prefix}%` }
    )
    const lastNo = String(rows?.[0]?.documentNo || '')
    const seq = lastNo.startsWith(prefix) ? Number(lastNo.slice(prefix.length)) : 0
    const nextSeq = Number.isFinite(seq) ? seq + 1 : 1
    documentNo = `${prefix}${String(nextSeq).padStart(3, '0')}`
  }
  if (!details.length) {
    return res.status(400).json({ code: 400, success: false, message: '发票明细不能为空' })
  }

  const normalizedDetails = details.map((d) => {
    const quantity = toNum(d.quantity)
    const unitPrice = toNum(d.unitPrice)
    const amount = toNum(d.amount) || Number((quantity * unitPrice).toFixed(2))
    return {
      itemCode: String(d.itemCode || '').trim(),
      productName: String(d.productName || '').trim(),
      quantity,
      unitPrice,
      amount,
      remark: String(d.remark || ''),
      productDrawingNo: String(d.productDrawingNo || ''),
      customerPartNo: String(d.customerPartNo || ''),
      contractNo: String(d.contractNo || contractNo || ''),
      fullIssued: Boolean(d.fullIssued),
      prepaidIssued: Boolean(d.prepaidIssued),
      acceptanceIssued: Boolean(d.acceptanceIssued),
      detailIsRed: Boolean(d.detailIsRed),
      detailIsSettled: Boolean(d.detailIsSettled)
    }
  })

  const invalidDetail = normalizedDetails.find((d) => !d.productName || d.quantity <= 0)
  if (invalidDetail) {
    return res.status(400).json({
      code: 400,
      success: false,
      message: '发票明细至少需要产品名称且数量大于 0'
    })
  }

  const totalAmount = normalizedDetails.reduce((sum, d) => sum + d.amount, 0)

  let customerId = null
  if (customerName) {
    const customerRows = await query(
      'SELECT TOP 1 客户ID as customerId FROM 客户信息 WHERE 客户名称 = @customerName',
      { customerName }
    )
    customerId = customerRows?.[0]?.customerId ?? null
  }

  const pool = await getPool()
  const tx = new sql.Transaction(pool)
  try {
    await tx.begin()

    const headReq = new sql.Request(tx)
    headReq.input('documentNo', sql.NVarChar, documentNo)
    headReq.input('documentDate', sql.DateTime2, documentDate)
    headReq.input('invoiceNo', sql.NVarChar, invoiceNo || null)
    headReq.input('totalAmount', sql.Money, totalAmount)
    headReq.input('customerId', sql.Int, customerId)
    headReq.input('contractNo', sql.NVarChar, contractNo || null)
    headReq.input('isRed', sql.Bit, status === 'red')
    headReq.input('invoiceDate', sql.DateTime2, invoiceDate)

    const headResult = await headReq.query(`
      INSERT INTO 开票单据 (
        单据编号, 单据日期, 发票号码, 金额, 客户ID, 备注, 是否已红冲, 开票日期, 是否红冲
      )
      OUTPUT INSERTED.发票ID as invoiceId
      VALUES (
        @documentNo, @documentDate, @invoiceNo, @totalAmount, @customerId, @contractNo, @isRed, @invoiceDate, @isRed
      )
    `)

    const invoiceId = headResult.recordset?.[0]?.invoiceId
    if (!invoiceId) {
      throw new Error('写入开票单据失败')
    }

    for (const d of normalizedDetails) {
      const detailReq = new sql.Request(tx)
      detailReq.input('invoiceId', sql.Int, invoiceId)
      detailReq.input('itemCode', sql.NVarChar, d.itemCode)
      detailReq.input('productName', sql.NVarChar, d.productName)
      detailReq.input('quantity', sql.Float, d.quantity)
      detailReq.input('unitPrice', sql.Money, d.unitPrice)
      detailReq.input('amount', sql.Money, d.amount)
      detailReq.input('remark', sql.NVarChar, d.remark || null)
      detailReq.input('fullIssued', sql.Bit, d.fullIssued)
      detailReq.input('productDrawingNo', sql.NVarChar, d.productDrawingNo || null)
      detailReq.input('customerPartNo', sql.NVarChar, d.customerPartNo || null)
      detailReq.input('contractNo', sql.NVarChar, d.contractNo || null)
      detailReq.input('prepaidIssued', sql.Bit, d.prepaidIssued)
      detailReq.input('acceptanceIssued', sql.Bit, d.acceptanceIssued)
      detailReq.input('detailIsRed', sql.Bit, d.detailIsRed)
      detailReq.input('detailIsSettled', sql.Bit, d.detailIsSettled)

      await detailReq.query(`
        INSERT INTO 发票明细 (
          发票ID, 项目编号, 产品名称, 数量, 单价, 金额, 备注,
          是否已开全额发票, 产品图号, 客户模号, 合同号,
          是否已开预付发票, 是否已开验收发票, 是否已红冲, 是否结清
        )
        VALUES (
          @invoiceId, @itemCode, @productName, @quantity, @unitPrice, @amount, @remark,
          @fullIssued, @productDrawingNo, @customerPartNo, @contractNo,
          @prepaidIssued, @acceptanceIssued, @detailIsRed, @detailIsSettled
        )
      `)
    }

    await tx.commit()
    res.json({ code: 0, success: true, data: { invoiceId, documentNo } })
  } catch (error) {
    try {
      await tx.rollback()
    } catch {}
    console.error('新增开票单据失败:', error)
    res.status(500).json({ code: 500, success: false, message: '新增开票单据失败', error: error.message })
  }
})

router.put('/invoices/:invoiceId', async (req, res) => {
  const invoiceId = Number(req.params.invoiceId)
  if (!Number.isFinite(invoiceId) || invoiceId <= 0) {
    return res.status(400).json({ code: 400, success: false, message: '发票ID无效' })
  }

  const payload = req.body || {}
  const documentNo = String(payload.documentNo || '').trim()
  const invoiceNo = String(payload.invoiceNo || '').trim()
  const customerName = String(payload.customerName || '').trim()
  const contractNo = String(payload.contractNo || '').trim()
  const status = payload.status === 'red' ? 'red' : 'normal'
  const invoiceDate = toDateOrNull(payload.invoiceDate)
  const details = Array.isArray(payload.details) ? payload.details : []

  if (!documentNo) {
    return res.status(400).json({ code: 400, success: false, message: '单据编号不能为空' })
  }
  if (!details.length) {
    return res.status(400).json({ code: 400, success: false, message: '发票明细不能为空' })
  }

  const normalizedDetails = details.map((d) => {
    const quantity = toNum(d.quantity)
    const unitPrice = toNum(d.unitPrice)
    const amount = toNum(d.amount) || Number((quantity * unitPrice).toFixed(2))
    return {
      itemCode: String(d.itemCode || '').trim(),
      productName: String(d.productName || '').trim(),
      quantity,
      unitPrice,
      amount,
      remark: String(d.remark || ''),
      productDrawingNo: String(d.productDrawingNo || ''),
      customerPartNo: String(d.customerPartNo || ''),
      contractNo: String(d.contractNo || contractNo || ''),
      fullIssued: Boolean(d.fullIssued),
      prepaidIssued: Boolean(d.prepaidIssued),
      acceptanceIssued: Boolean(d.acceptanceIssued),
      detailIsRed: Boolean(d.detailIsRed),
      detailIsSettled: Boolean(d.detailIsSettled)
    }
  })

  const invalidDetail = normalizedDetails.find((d) => !d.productName || d.quantity <= 0)
  if (invalidDetail) {
    return res.status(400).json({
      code: 400,
      success: false,
      message: '发票明细至少需要产品名称且数量大于 0'
    })
  }

  const totalAmount = normalizedDetails.reduce((sum, d) => sum + d.amount, 0)

  let customerId = null
  if (customerName) {
    const customerRows = await query(
      'SELECT TOP 1 客户ID as customerId FROM 客户信息 WHERE 客户名称 = @customerName',
      { customerName }
    )
    customerId = customerRows?.[0]?.customerId ?? null
  }

  const pool = await getPool()
  const tx = new sql.Transaction(pool)
  try {
    await tx.begin()

    const checkReq = new sql.Request(tx)
    checkReq.input('invoiceId', sql.Int, invoiceId)
    const existsResult = await checkReq.query(
      'SELECT TOP 1 发票ID as invoiceId FROM 开票单据 WHERE 发票ID = @invoiceId'
    )
    if (!existsResult.recordset?.length) {
      await tx.rollback()
      return res.status(404).json({ code: 404, success: false, message: '发票不存在' })
    }

    const headReq = new sql.Request(tx)
    headReq.input('invoiceId', sql.Int, invoiceId)
    headReq.input('documentNo', sql.NVarChar, documentNo)
    headReq.input('invoiceNo', sql.NVarChar, invoiceNo || null)
    headReq.input('totalAmount', sql.Money, totalAmount)
    headReq.input('customerId', sql.Int, customerId)
    headReq.input('contractNo', sql.NVarChar, contractNo || null)
    headReq.input('isRed', sql.Bit, status === 'red')
    headReq.input('invoiceDate', sql.DateTime2, invoiceDate)

    await headReq.query(`
      UPDATE 开票单据
      SET
        单据编号 = @documentNo,
        发票号码 = @invoiceNo,
        金额 = @totalAmount,
        客户ID = @customerId,
        备注 = @contractNo,
        是否已红冲 = @isRed,
        开票日期 = @invoiceDate,
        是否红冲 = @isRed
      WHERE 发票ID = @invoiceId
    `)

    const deleteReq = new sql.Request(tx)
    deleteReq.input('invoiceId', sql.Int, invoiceId)
    await deleteReq.query('DELETE FROM 发票明细 WHERE 发票ID = @invoiceId')

    for (const d of normalizedDetails) {
      const detailReq = new sql.Request(tx)
      detailReq.input('invoiceId', sql.Int, invoiceId)
      detailReq.input('itemCode', sql.NVarChar, d.itemCode)
      detailReq.input('productName', sql.NVarChar, d.productName)
      detailReq.input('quantity', sql.Float, d.quantity)
      detailReq.input('unitPrice', sql.Money, d.unitPrice)
      detailReq.input('amount', sql.Money, d.amount)
      detailReq.input('remark', sql.NVarChar, d.remark || null)
      detailReq.input('fullIssued', sql.Bit, d.fullIssued)
      detailReq.input('productDrawingNo', sql.NVarChar, d.productDrawingNo || null)
      detailReq.input('customerPartNo', sql.NVarChar, d.customerPartNo || null)
      detailReq.input('contractNo', sql.NVarChar, d.contractNo || null)
      detailReq.input('prepaidIssued', sql.Bit, d.prepaidIssued)
      detailReq.input('acceptanceIssued', sql.Bit, d.acceptanceIssued)
      detailReq.input('detailIsRed', sql.Bit, d.detailIsRed)
      detailReq.input('detailIsSettled', sql.Bit, d.detailIsSettled)

      await detailReq.query(`
        INSERT INTO 发票明细 (
          发票ID, 项目编号, 产品名称, 数量, 单价, 金额, 备注,
          是否已开全额发票, 产品图号, 客户模号, 合同号,
          是否已开预付发票, 是否已开验收发票, 是否已红冲, 是否结清
        )
        VALUES (
          @invoiceId, @itemCode, @productName, @quantity, @unitPrice, @amount, @remark,
          @fullIssued, @productDrawingNo, @customerPartNo, @contractNo,
          @prepaidIssued, @acceptanceIssued, @detailIsRed, @detailIsSettled
        )
      `)
    }

    await tx.commit()
    res.json({ code: 0, success: true, data: { invoiceId } })
  } catch (error) {
    try {
      await tx.rollback()
    } catch {}
    console.error('更新开票单据失败:', error)
    res.status(500).json({ code: 500, success: false, message: '更新开票单据失败', error: error.message })
  }
})

router.delete('/invoices/:invoiceId', async (req, res) => {
  const invoiceId = Number(req.params.invoiceId)
  if (!Number.isFinite(invoiceId) || invoiceId <= 0) {
    return res.status(400).json({ code: 400, success: false, message: '发票ID无效' })
  }

  const actor = resolveActorFromReq(req)
  const pool = await getPool()
  const tx = new sql.Transaction(pool)
  try {
    await tx.begin()
    await ensureFinanceSoftDeleteColumns(tx)

    const infoReq = new sql.Request(tx)
    infoReq.input('invoiceId', sql.Int, invoiceId)
    const infoRows = await infoReq.query(`
      SELECT TOP 1 发票ID as invoiceId, 单据编号 as documentNo, 发票号码 as invoiceNo
      FROM 开票单据
      WHERE 发票ID = @invoiceId AND ISNULL(是否删除, 0) = 0
    `)
    const info = infoRows.recordset?.[0]
    if (!info) {
      await tx.rollback()
      return res.status(404).json({ code: 404, success: false, message: '发票不存在' })
    }

    const softReq = new sql.Request(tx)
    softReq.input('invoiceId', sql.Int, invoiceId)
    softReq.input('actor', sql.NVarChar(100), actor || null)
    await softReq.query(`
      UPDATE 开票单据
      SET 是否删除 = 1, 删除时间 = SYSDATETIME(), 删除人 = @actor
      WHERE 发票ID = @invoiceId AND ISNULL(是否删除, 0) = 0
    `)

    await ensurePendingHardDeleteReviewRequest({
      tx,
      projectCode: String(info.documentNo || info.invoiceNo || invoiceId),
      moduleCode: 'FINANCE_INVOICE',
      entityKey: String(invoiceId),
      displayCode: String(info.documentNo || info.invoiceNo || invoiceId),
      displayName: String(info.invoiceNo || info.documentNo || ''),
      requesterName: actor,
      requestSource: 'SOFT_DELETE_AUTO',
      requestReason: '软删除后系统自动发起硬删除审核'
    })

    await tx.commit()
    res.json({ code: 0, success: true, message: '删除成功（已软删除，并已提交硬删除审核）' })
  } catch (error) {
    try {
      await tx.rollback()
    } catch {}
    console.error('删除开票单据失败:', error)
    res.status(500).json({ code: 500, success: false, message: '删除开票单据失败', error: error.message })
  }
})

router.post('/receipts', async (req, res) => {
  const payload = req.body || {}
  let documentNo = String(payload.receiptNo || '').trim()
  const customerName = String(payload.customerName || '').trim()
  const contractNo = String(payload.contractNo || '').trim()
  const status = payload.status === 'received' ? 'received' : 'pending'
  const receiptDate = toDateOrNull(payload.receiptDate)
  const documentDate = new Date()
  const details = Array.isArray(payload.details) ? payload.details : []

  if (!documentNo) {
    const today = toDateText(documentDate).replace(/-/g, '')
    const prefix = `HK-${today}-`
    const rows = await query(
      `
      SELECT TOP 1 单据编号 as documentNo
      FROM 回款单据
      WHERE 单据编号 LIKE @prefix
      ORDER BY 单据编号 DESC
      `,
      { prefix: `${prefix}%` }
    )
    const lastNo = String(rows?.[0]?.documentNo || '')
    const seq = lastNo.startsWith(prefix) ? Number(lastNo.slice(prefix.length)) : 0
    const nextSeq = Number.isFinite(seq) ? seq + 1 : 1
    documentNo = `${prefix}${String(nextSeq).padStart(3, '0')}`
  }
  if (!details.length) {
    return res.status(400).json({ code: 400, success: false, message: '回款明细不能为空' })
  }

  const normalizedDetails = details.map((d) => ({
    detailId: d.detailId != null ? Number(d.detailId) : null,
    itemCode: String(d.itemCode || '').trim(),
    productName: String(d.productName || '').trim(),
    productDrawingNo: String(d.productDrawingNo || ''),
    customerPartNo: String(d.customerPartNo || ''),
    contractNo: String(d.contractNo || contractNo || ''),
    receivableAmount: toNum(d.receivableAmount) || toNum(d.amount),
    amount: toNum(d.amount),
    discountAmount: toNum(d.discountAmount),
    receiptProgress: String(d.receiptProgress || ''),
    receiptMethod: String(d.receiptMethod || d.costSource || ''),
    remark: String(d.remark || ''),
    isSettled: d.isSettled != null ? Boolean(d.isSettled) : status === 'received',
    accountName: String(d.accountName || d.productDrawingNo || ''),
    customerName: String(d.customerName || customerName)
  }))

  const totalAmount = normalizedDetails.reduce((sum, d) => sum + d.amount, 0)
  const pool = await getPool()
  const tx = new sql.Transaction(pool)
  try {
    await tx.begin()
    const insertedIds = []
    for (const d of normalizedDetails) {
      const reqTx = new sql.Request(tx)
      reqTx.input('documentNo', sql.NVarChar, documentNo)
      reqTx.input('documentDate', sql.DateTime2, documentDate)
      reqTx.input('detailId', sql.Int, d.detailId)
      reqTx.input('itemCode', sql.NVarChar, d.itemCode || null)
      reqTx.input('productName', sql.NVarChar, d.productName || null)
      reqTx.input('productDrawingNo', sql.NVarChar, d.productDrawingNo || null)
      reqTx.input('customerPartNo', sql.NVarChar, d.customerPartNo || null)
      reqTx.input('contractNo', sql.NVarChar, d.contractNo || null)
      reqTx.input('receivableAmount', sql.Money, d.receivableAmount)
      reqTx.input('amount', sql.Money, d.amount)
      reqTx.input('discountAmount', sql.Money, d.discountAmount)
      reqTx.input('receiptProgress', sql.NVarChar, d.receiptProgress || null)
      reqTx.input('receiptDate', sql.DateTime2, receiptDate)
      reqTx.input('receiptMethod', sql.NVarChar, d.receiptMethod || null)
      reqTx.input('remark', sql.NVarChar, d.remark || null)
      reqTx.input('isSettled', sql.Bit, d.isSettled)
      reqTx.input('accountName', sql.NVarChar, d.accountName || null)
      reqTx.input('customerName', sql.NVarChar, d.customerName || null)
      reqTx.input('totalAmount', sql.Money, totalAmount)

      const inserted = await reqTx.query(`
        INSERT INTO 回款单据 (
          单据编号, 单据日期, 明细ID, 项目编号, 产品名称, 产品图号, 客户模号, 合同号,
          应收金额, 实收金额, 贴息金额, 收款进度, 回款日期, 回款方式, 备注, 是否结清, 收款账户, 客户名称, 合计金额
        )
        OUTPUT INSERTED.回款ID as receiptId
        VALUES (
          @documentNo, @documentDate, @detailId, @itemCode, @productName, @productDrawingNo, @customerPartNo, @contractNo,
          @receivableAmount, @amount, @discountAmount, @receiptProgress, @receiptDate, @receiptMethod, @remark, @isSettled, @accountName, @customerName, @totalAmount
        )
      `)
      insertedIds.push(inserted.recordset?.[0]?.receiptId)
    }
    await tx.commit()
    res.json({ code: 0, success: true, data: { receiptIds: insertedIds.filter(Boolean), documentNo } })
  } catch (error) {
    try {
      await tx.rollback()
    } catch {}
    console.error('新增回款单据失败:', error)
    res.status(500).json({ code: 500, success: false, message: '新增回款单据失败', error: error.message })
  }
})

router.put('/receipts/:documentNo', async (req, res) => {
  const sourceDocumentNo = String(req.params.documentNo || '').trim()
  if (!sourceDocumentNo) {
    return res.status(400).json({ code: 400, success: false, message: '单据编号不能为空' })
  }

  const payload = req.body || {}
  const documentNo = String(payload.receiptNo || sourceDocumentNo).trim()
  const customerName = String(payload.customerName || '').trim()
  const contractNo = String(payload.contractNo || '').trim()
  const status = payload.status === 'received' ? 'received' : 'pending'
  const receiptDate = toDateOrNull(payload.receiptDate)
  const documentDate = toDateOrNull(payload.deliveryDate) || new Date()
  const details = Array.isArray(payload.details) ? payload.details : []

  if (!details.length) {
    return res.status(400).json({ code: 400, success: false, message: '回款明细不能为空' })
  }

  const normalizedDetails = details.map((d) => ({
    detailId: d.detailId != null ? Number(d.detailId) : null,
    itemCode: String(d.itemCode || '').trim(),
    productName: String(d.productName || '').trim(),
    productDrawingNo: String(d.productDrawingNo || ''),
    customerPartNo: String(d.customerPartNo || ''),
    contractNo: String(d.contractNo || contractNo || ''),
    receivableAmount: toNum(d.receivableAmount) || toNum(d.amount),
    amount: toNum(d.amount),
    discountAmount: toNum(d.discountAmount),
    receiptProgress: String(d.receiptProgress || ''),
    receiptMethod: String(d.receiptMethod || d.costSource || ''),
    remark: String(d.remark || ''),
    isSettled: d.isSettled != null ? Boolean(d.isSettled) : status === 'received',
    accountName: String(d.accountName || d.productDrawingNo || ''),
    customerName: String(d.customerName || customerName)
  }))

  const totalAmount = normalizedDetails.reduce((sum, d) => sum + d.amount, 0)
  const pool = await getPool()
  const tx = new sql.Transaction(pool)
  try {
    await tx.begin()

    const existsReq = new sql.Request(tx)
    existsReq.input('sourceDocumentNo', sql.NVarChar, sourceDocumentNo)
    const existsResult = await existsReq.query(
      'SELECT TOP 1 回款ID FROM 回款单据 WHERE 单据编号 = @sourceDocumentNo'
    )
    if (!existsResult.recordset?.length) {
      await tx.rollback()
      return res.status(404).json({ code: 404, success: false, message: '回款单据不存在' })
    }

    const deleteReq = new sql.Request(tx)
    deleteReq.input('sourceDocumentNo', sql.NVarChar, sourceDocumentNo)
    await deleteReq.query('DELETE FROM 回款单据 WHERE 单据编号 = @sourceDocumentNo')

    const insertedIds = []
    for (const d of normalizedDetails) {
      const reqTx = new sql.Request(tx)
      reqTx.input('documentNo', sql.NVarChar, documentNo)
      reqTx.input('documentDate', sql.DateTime2, documentDate)
      reqTx.input('detailId', sql.Int, d.detailId)
      reqTx.input('itemCode', sql.NVarChar, d.itemCode || null)
      reqTx.input('productName', sql.NVarChar, d.productName || null)
      reqTx.input('productDrawingNo', sql.NVarChar, d.productDrawingNo || null)
      reqTx.input('customerPartNo', sql.NVarChar, d.customerPartNo || null)
      reqTx.input('contractNo', sql.NVarChar, d.contractNo || null)
      reqTx.input('receivableAmount', sql.Money, d.receivableAmount)
      reqTx.input('amount', sql.Money, d.amount)
      reqTx.input('discountAmount', sql.Money, d.discountAmount)
      reqTx.input('receiptProgress', sql.NVarChar, d.receiptProgress || null)
      reqTx.input('receiptDate', sql.DateTime2, receiptDate)
      reqTx.input('receiptMethod', sql.NVarChar, d.receiptMethod || null)
      reqTx.input('remark', sql.NVarChar, d.remark || null)
      reqTx.input('isSettled', sql.Bit, d.isSettled)
      reqTx.input('accountName', sql.NVarChar, d.accountName || null)
      reqTx.input('customerName', sql.NVarChar, d.customerName || null)
      reqTx.input('totalAmount', sql.Money, totalAmount)

      const inserted = await reqTx.query(`
        INSERT INTO 回款单据 (
          单据编号, 单据日期, 明细ID, 项目编号, 产品名称, 产品图号, 客户模号, 合同号,
          应收金额, 实收金额, 贴息金额, 收款进度, 回款日期, 回款方式, 备注, 是否结清, 收款账户, 客户名称, 合计金额
        )
        OUTPUT INSERTED.回款ID as receiptId
        VALUES (
          @documentNo, @documentDate, @detailId, @itemCode, @productName, @productDrawingNo, @customerPartNo, @contractNo,
          @receivableAmount, @amount, @discountAmount, @receiptProgress, @receiptDate, @receiptMethod, @remark, @isSettled, @accountName, @customerName, @totalAmount
        )
      `)
      insertedIds.push(inserted.recordset?.[0]?.receiptId)
    }

    await tx.commit()
    res.json({ code: 0, success: true, data: { receiptIds: insertedIds.filter(Boolean), documentNo } })
  } catch (error) {
    try {
      await tx.rollback()
    } catch {}
    console.error('更新回款单据失败:', error)
    res.status(500).json({ code: 500, success: false, message: '更新回款单据失败', error: error.message })
  }
})

router.delete('/receipts/:documentNo', async (req, res) => {
  const documentNo = String(req.params.documentNo || '').trim()
  if (!documentNo) {
    return res.status(400).json({ code: 400, success: false, message: '单据编号不能为空' })
  }

  const actor = resolveActorFromReq(req)
  try {
    const pool = await getPool()
    const tx = new sql.Transaction(pool)
    await tx.begin()
    try {
      await ensureFinanceSoftDeleteColumns(tx)

      const checkReq = new sql.Request(tx)
      checkReq.input('documentNo', sql.NVarChar(100), documentNo)
      const exists = await checkReq.query(`
        SELECT TOP 1 单据编号 as documentNo
        FROM 回款单据
        WHERE 单据编号 = @documentNo AND ISNULL(是否删除, 0) = 0
      `)
      if (!exists.recordset?.length) {
        await tx.rollback()
        return res.status(404).json({ code: 404, success: false, message: '回款单据不存在' })
      }

      const softReq = new sql.Request(tx)
      softReq.input('documentNo', sql.NVarChar(100), documentNo)
      softReq.input('actor', sql.NVarChar(100), actor || null)
      await softReq.query(`
        UPDATE 回款单据
        SET 是否删除 = 1, 删除时间 = SYSDATETIME(), 删除人 = @actor
        WHERE 单据编号 = @documentNo AND ISNULL(是否删除, 0) = 0
      `)

      await ensurePendingHardDeleteReviewRequest({
        tx,
        projectCode: documentNo,
        moduleCode: 'FINANCE_RECEIPT',
        entityKey: documentNo,
        displayCode: documentNo,
        displayName: documentNo,
        requesterName: actor,
        requestSource: 'SOFT_DELETE_AUTO',
        requestReason: '软删除后系统自动发起硬删除审核'
      })

      await tx.commit()
      res.json({ code: 0, success: true, message: '删除成功（已软删除，并已提交硬删除审核）' })
    } catch (e) {
      try {
        await tx.rollback()
      } catch {}
      throw e
    }
  } catch (error) {
    console.error('删除回款单据失败:', error)
    res.status(500).json({ code: 500, success: false, message: '删除回款单据失败', error: error.message })
  }
})

module.exports = router
