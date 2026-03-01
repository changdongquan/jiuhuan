const express = require('express')
const { query } = require('../database')

const router = express.Router()

const safeNumber = (value) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

const toDateString = (value) => {
  if (!value) return ''
  if (typeof value === 'string') return value.slice(0, 10)
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

const toTime = (value) => {
  if (!value) return 0
  const t = new Date(value).getTime()
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
  const shippedOrderCount = salesRows.filter((row) => Number(row.isShipped) === 1).length

  const outboundQty = outboundRows.reduce((sum, row) => sum + safeNumber(row.quantity), 0)
  const completedQty = safeNumber(taskRow?.completedQty)

  const invoiceCount = invoiceRows.length
  const invoiceAmount = invoiceRows.reduce((sum, row) => sum + safeNumber(row.amount), 0)

  const receiptCount = receiptRows.length
  const receivedAmount = receiptRows.reduce((sum, row) => sum + safeNumber(row.receivedAmount), 0)

  let salesStatus = 'pending'
  if (salesCount > 0) {
    salesStatus = shippedOrderCount >= salesCount ? 'completed' : 'in_progress'
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
    if (invoiceAmount > 0 && receivedAmount >= invoiceAmount) {
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
        completedQty: completedQty
      },
      dates: {
        issuedDate: toDateString(taskRow?.issuedDate),
        startDate: toDateString(taskRow?.startDate),
        endDate: toDateString(taskRow?.endDate)
      }
    },
    {
      key: 'outbound',
      name: '出货',
      status: normalizeStageStatus(outboundStatus),
      summary: outboundRows.length > 0 ? `出库 ${outboundRows.length} 单` : '暂无出货单据',
      metrics: {
        documentCount: outboundRows.length,
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
        amount: receivedAmount
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
    pushEvent(events, {
      stage: 'receipt',
      title: `回款单 ${String(row.documentNo || '-').trim() || '-'}`,
      date: toDateString(row.receiptDate),
      detail: `实收 ¥${safeNumber(row.receivedAmount).toLocaleString()}`
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
      receiptCount
    }
  }
}

router.get('/list', async (req, res) => {
  try {
    const {
      keyword = '',
      customerName = '',
      owner = '',
      startDate = '',
      endDate = '',
      page = 1,
      pageSize = 20
    } = req.query

    const pageNum = Math.max(parseInt(String(page), 10) || 1, 1)
    const sizeNum = Math.max(parseInt(String(pageSize), 10) || 20, 1)
    const offset = (pageNum - 1) * sizeNum

    const params = {}
    const where = [`(p.状态 IS NULL OR p.状态 <> N'已删除')`]

    if (keyword) {
      params.keyword = `%${String(keyword).trim()}%`
      where.push(`(
        p.项目编号 LIKE @keyword
        OR g.productName LIKE @keyword
        OR g.productDrawing LIKE @keyword
      )`)
    }

    if (customerName) {
      params.customerName = `%${String(customerName).trim()}%`
      where.push(`c.customerName LIKE @customerName`)
    }

    if (owner) {
      params.owner = `%${String(owner).trim()}%`
      where.push(`(
        pt.owner LIKE @owner
        OR s.owner LIKE @owner
      )`)
    }

    if (startDate) {
      params.startDate = String(startDate).trim()
      where.push(`(s.latestOrderDate IS NULL OR s.latestOrderDate >= @startDate)`)
    }

    if (endDate) {
      params.endDate = String(endDate).trim()
      where.push(`(s.latestOrderDate IS NULL OR s.latestOrderDate <= @endDate)`)
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

    const baseSql = `
      FROM 项目管理 p
      OUTER APPLY (
        SELECT TOP 1
          g1.产品名称 as productName,
          g1.产品图号 as productDrawing
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
          MAX(so.订单日期) as latestOrderDate,
          MAX(so.经办人) as owner
        FROM 销售订单 so
        WHERE so.项目编号 = p.项目编号
          AND (so.状态 IS NULL OR so.状态 <> N'已删除')
      ) s
      OUTER APPLY (
        SELECT TOP 1
          pt1.生产状态 as productionStatus,
          pt1.负责人 as owner,
          ISNULL(pt1.已完成数量, 0) as completedQty
        FROM 生产任务 pt1
        WHERE pt1.项目编号 = p.项目编号
          AND (pt1.状态 IS NULL OR pt1.状态 <> N'已删除')
        ORDER BY pt1.下达日期 DESC, pt1.项目编号 DESC
      ) pt
      OUTER APPLY (
        SELECT
          COUNT(DISTINCT od.出库单号) as outboundDocCount,
          ISNULL(SUM(ISNULL(od.出库数量, 0)), 0) as outboundQty,
          MAX(od.出库日期) as latestOutboundDate
        FROM 出库单明细 od
        WHERE od.项目编号 = p.项目编号
          AND (od.状态 IS NULL OR od.状态 <> N'已删除')
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
          MAX(COALESCE(r.回款日期, r.单据日期)) as latestReceiptDate
        FROM 回款单据 r
        WHERE r.项目编号 = p.项目编号
          AND ISNULL(r.是否删除, 0) = 0
      ) fr
      ${whereSql}
    `

    const countRows = await query(`SELECT COUNT(1) as total ${baseSql}`, params)
    const total = safeNumber(countRows?.[0]?.total)

    const listSql = `
      SELECT
        p.项目编号 as projectCode,
        ISNULL(c.customerName, N'') as customerName,
        ISNULL(g.productName, N'') as productName,
        ISNULL(g.productDrawing, N'') as productDrawing,
        ISNULL(s.owner, pt.owner) as owner,
        ISNULL(s.orderCount, 0) as salesOrderCount,
        ISNULL(s.salesAmount, 0) as salesAmount,
        p.项目状态 as projectStatus,
        pt.productionStatus as productionStatus,
        ISNULL(pt.completedQty, 0) as completedQty,
        ISNULL(od.outboundDocCount, 0) as outboundDocCount,
        ISNULL(od.outboundQty, 0) as outboundQty,
        ISNULL(fi.invoiceCount, 0) as invoiceCount,
        ISNULL(fi.invoiceAmount, 0) as invoiceAmount,
        ISNULL(fr.receiptCount, 0) as receiptCount,
        ISNULL(fr.receiptAmount, 0) as receiptAmount,
        CONVERT(varchar(10), s.latestOrderDate, 23) as latestOrderDate,
        CONVERT(varchar(10), od.latestOutboundDate, 23) as latestOutboundDate,
        CONVERT(varchar(10), fi.latestInvoiceDate, 23) as latestInvoiceDate,
        CONVERT(varchar(10), fr.latestReceiptDate, 23) as latestReceiptDate
      ${baseSql}
      ORDER BY p.项目编号 DESC
      OFFSET ${offset} ROWS FETCH NEXT ${sizeNum} ROWS ONLY
    `

    const rows = await query(listSql, params)

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
              r.实收金额 as receivedAmount
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
