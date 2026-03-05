const express = require('express')
const { query, getPool } = require('../database')
const sql = require('mssql')
const { resolveActorFromReq } = require('../utils/actor')
const { softDeleteByProjectCode, restoreByProjectCode, SOFT_DELETED } = require('../services/projectSoftDelete')
const {
  DELETE_PLAN,
  createHardDeleteAuditStarted,
  markHardDeleteAuditFinished,
  hardDeleteByProjectCode
} = require('../services/projectHardDelete')
const {
  HARD_DELETE_REVIEW_STATUS,
  ensureHardDeleteReviewTable,
  ensurePendingHardDeleteReviewRequest,
  cancelPendingHardDeleteReviewRequest,
  assertHardDeleteReviewerPermission,
  toHardDeleteReviewTaskData
} = require('../services/projectHardDeleteReview')
const router = express.Router()

const resolveRequestId = (req) =>
  String(req.headers['x-request-id'] || req.headers['x-correlation-id'] || '').trim() || null

const executeHardDeleteByGoodsId = async ({
  pool,
  goodsId,
  actor,
  requestId,
  requireApprovedReviewRequest = false
}) => {
  const parsedId = parseInt(goodsId, 10)
  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    const err = new Error('无效的ID')
    err.httpStatus = 400
    throw err
  }

  const beforeReq = pool.request()
  beforeReq.input('id', sql.Int, parsedId)
  const beforeResult = await beforeReq.query(`
    SELECT TOP 1
      货物ID AS id,
      项目编号 AS projectCode,
      状态 AS status,
      产品名称 AS productName,
      产品图号 AS productDrawing,
      分类 AS category
    FROM 货物信息
    WHERE 货物ID = @id
  `)
  const beforeRow = beforeResult.recordset?.[0]
  if (!beforeRow) {
    const err = new Error('货物信息不存在')
    err.httpStatus = 404
    throw err
  }

  const projectCode = String(beforeRow.projectCode || '').trim()
  if (!projectCode) {
    const err = new Error('记录缺少项目编号，无法硬删除')
    err.httpStatus = 400
    throw err
  }
  if (String(beforeRow.status || '').trim() !== SOFT_DELETED) {
    const err = new Error('仅允许对“已删除”状态记录执行硬删除')
    err.httpStatus = 409
    throw err
  }

  if (requireApprovedReviewRequest) {
    const reviewReq = pool.request()
    reviewReq.input('projectCode', sql.NVarChar(100), projectCode)
    reviewReq.input('statusApproved', sql.NVarChar(20), HARD_DELETE_REVIEW_STATUS.APPROVED)
    const reviewResult = await reviewReq.query(`
      SELECT TOP 1 id, executed_at
      FROM dbo.project_hard_delete_review_requests
      WHERE project_code = @projectCode
        AND status = @statusApproved
      ORDER BY approved_at DESC, id DESC
    `)
    const approvedRow = reviewResult.recordset?.[0]
    if (!approvedRow) {
      const err = new Error('未找到已审批通过的硬删除申请')
      err.httpStatus = 409
      throw err
    }
    if (approvedRow.executed_at) {
      const err = new Error('该硬删除申请已执行，请勿重复操作')
      err.httpStatus = 409
      throw err
    }
  }

  let auditId = await createHardDeleteAuditStarted({
    pool,
    projectCode,
    actor,
    requestId,
    beforeSnapshot: beforeRow,
    cascadePlan: DELETE_PLAN
  })

  let cascadeSummary = null
  const tx = new sql.Transaction(pool)
  try {
    await tx.begin()
    const guardReq = new sql.Request(tx)
    guardReq.input('id', sql.Int, parsedId)
    const guardResult = await guardReq.query(`
      SELECT TOP 1 项目编号 AS projectCode, 状态 AS status
      FROM 货物信息 WITH (UPDLOCK, HOLDLOCK)
      WHERE 货物ID = @id
    `)
    const guardRow = guardResult.recordset?.[0]
    if (!guardRow) {
      const err = new Error('目标记录不存在，可能已被其他操作删除')
      err.httpStatus = 404
      throw err
    }
    const guardStatus = String(guardRow.status || '').trim()
    if (guardStatus !== SOFT_DELETED) {
      const err = new Error('记录状态已变化，仅允许硬删除“已删除”状态记录')
      err.httpStatus = 409
      throw err
    }

    cascadeSummary = await hardDeleteByProjectCode({ tx, projectCode })
    await tx.commit()
  } catch (e) {
    try {
      await tx.rollback()
    } catch {}
    try {
      await markHardDeleteAuditFinished({
        pool,
        auditId,
        success: false,
        errorMessage: e?.message || '未知错误'
      })
    } catch {}
    throw e
  }

  await markHardDeleteAuditFinished({
    pool,
    auditId,
    success: true,
    cascadeResult: cascadeSummary
  })

  return {
    auditId,
    projectCode,
    cascadeSummary
  }
}

const normalizeModuleCode = (row) => String(row?.moduleCode || 'GOODS').trim().toUpperCase()
const normalizeEntityKey = (row) =>
  String(row?.entityKey || row?.projectCode || '')
    .trim()

const restoreSoftDeletedByReviewRow = async ({ tx, row, actor }) => {
  const moduleCode = normalizeModuleCode(row)
  const entityKey = normalizeEntityKey(row)
  if (!entityKey) return

  if (moduleCode === 'GOODS' || moduleCode === 'PROJECT_INFO') {
    await restoreByProjectCode({ tx, projectCode: entityKey })
    return
  }

  if (moduleCode === 'SALES_ORDER') {
    const req = new sql.Request(tx)
    req.input('orderNo', sql.NVarChar(100), entityKey)
    req.input('actor', sql.NVarChar(100), actor || null)
    await req.query(`
      UPDATE 销售订单
      SET 状态 = ISNULL(删除前状态, N''),
          删除前状态 = NULL,
          删除时间 = NULL,
          删除人 = NULL
      WHERE 订单编号 = @orderNo

      UPDATE 销售订单附件
      SET 状态 = ISNULL(删除前状态, N''),
          删除前状态 = NULL,
          删除时间 = NULL,
          删除人 = NULL
      WHERE 订单编号 = @orderNo
    `)
    return
  }

  if (moduleCode === 'OUTBOUND_DOCUMENT') {
    const req = new sql.Request(tx)
    req.input('documentNo', sql.NVarChar(100), entityKey)
    await req.query(`
      UPDATE 出库单明细
      SET 状态 = ISNULL(删除前状态, N''),
          删除前状态 = NULL,
          删除时间 = NULL,
          删除人 = NULL
      WHERE 出库单号 = @documentNo

      UPDATE 出库单附件
      SET 状态 = ISNULL(删除前状态, N''),
          删除前状态 = NULL,
          删除时间 = NULL,
          删除人 = NULL
      WHERE 出库单号 = @documentNo
    `)
    return
  }

  if (moduleCode === 'FINANCE_INVOICE') {
    const req = new sql.Request(tx)
    req.input('invoiceId', sql.Int, parseInt(entityKey, 10))
    await req.batch(`
      IF COL_LENGTH(N'开票单据', N'是否删除') IS NULL
        ALTER TABLE 开票单据 ADD 是否删除 BIT NOT NULL CONSTRAINT DF_开票单据_是否删除 DEFAULT(0);
      IF COL_LENGTH(N'开票单据', N'删除时间') IS NULL
        ALTER TABLE 开票单据 ADD 删除时间 DATETIME2 NULL;
      IF COL_LENGTH(N'开票单据', N'删除人') IS NULL
        ALTER TABLE 开票单据 ADD 删除人 NVARCHAR(100) NULL;

      UPDATE 开票单据
      SET 是否删除 = 0, 删除时间 = NULL, 删除人 = NULL
      WHERE 发票ID = @invoiceId
    `)
    return
  }

  if (moduleCode === 'FINANCE_RECEIPT') {
    const req = new sql.Request(tx)
    req.input('documentNo', sql.NVarChar(100), entityKey)
    await req.batch(`
      IF COL_LENGTH(N'回款单据', N'是否删除') IS NULL
        ALTER TABLE 回款单据 ADD 是否删除 BIT NOT NULL CONSTRAINT DF_回款单据_是否删除 DEFAULT(0);
      IF COL_LENGTH(N'回款单据', N'删除时间') IS NULL
        ALTER TABLE 回款单据 ADD 删除时间 DATETIME2 NULL;
      IF COL_LENGTH(N'回款单据', N'删除人') IS NULL
        ALTER TABLE 回款单据 ADD 删除人 NVARCHAR(100) NULL;

      UPDATE 回款单据
      SET 是否删除 = 0, 删除时间 = NULL, 删除人 = NULL
      WHERE 单据编号 = @documentNo
    `)
    return
  }

  if (moduleCode === 'SALARY') {
    const req = new sql.Request(tx)
    req.input('id', sql.Int, parseInt(entityKey, 10))
    await req.batch(`
      IF COL_LENGTH(N'工资汇总', N'是否删除') IS NULL
        ALTER TABLE 工资汇总 ADD 是否删除 BIT NOT NULL CONSTRAINT DF_工资汇总_是否删除 DEFAULT(0);
      IF COL_LENGTH(N'工资汇总', N'删除时间') IS NULL
        ALTER TABLE 工资汇总 ADD 删除时间 DATETIME2 NULL;
      IF COL_LENGTH(N'工资汇总', N'删除人') IS NULL
        ALTER TABLE 工资汇总 ADD 删除人 NVARCHAR(100) NULL;

      UPDATE 工资汇总
      SET 是否删除 = 0, 删除时间 = NULL, 删除人 = NULL
      WHERE ID = @id
    `)
    return
  }

  if (moduleCode === 'CUSTOMER') {
    const req = new sql.Request(tx)
    req.input('id', sql.Int, parseInt(entityKey, 10))
    await req.batch(`
      IF COL_LENGTH(N'客户信息', N'是否删除') IS NULL
        ALTER TABLE 客户信息 ADD 是否删除 BIT NOT NULL CONSTRAINT DF_客户信息_是否删除 DEFAULT(0);
      IF COL_LENGTH(N'客户信息', N'删除时间') IS NULL
        ALTER TABLE 客户信息 ADD 删除时间 DATETIME2 NULL;
      IF COL_LENGTH(N'客户信息', N'删除人') IS NULL
        ALTER TABLE 客户信息 ADD 删除人 NVARCHAR(100) NULL;

      UPDATE 客户信息
      SET 是否删除 = 0, 删除时间 = NULL, 删除人 = NULL
      WHERE 客户ID = @id
    `)
    return
  }

  if (moduleCode === 'SUPPLIER') {
    const req = new sql.Request(tx)
    req.input('id', sql.BigInt, parseInt(entityKey, 10))
    req.input('actor', sql.NVarChar(100), actor || null)
    await req.query(`
      UPDATE 供方信息
      SET 是否删除 = 0, 更新时间 = GETDATE(), 更新人 = @actor
      WHERE 供方ID = @id
    `)
    return
  }

  if (moduleCode === 'EMPLOYEE') {
    const req = new sql.Request(tx)
    req.input('id', sql.Int, parseInt(entityKey, 10))
    await req.batch(`
      IF COL_LENGTH(N'员工信息', N'是否删除') IS NULL
        ALTER TABLE 员工信息 ADD 是否删除 BIT NOT NULL CONSTRAINT DF_员工信息_是否删除 DEFAULT(0);
      IF COL_LENGTH(N'员工信息', N'删除时间') IS NULL
        ALTER TABLE 员工信息 ADD 删除时间 DATETIME2 NULL;
      IF COL_LENGTH(N'员工信息', N'删除人') IS NULL
        ALTER TABLE 员工信息 ADD 删除人 NVARCHAR(100) NULL;

      UPDATE 员工信息
      SET 是否删除 = 0, 删除时间 = NULL, 删除人 = NULL
      WHERE ID = @id
    `)
  }
}

const executeHardDeleteByReviewRow = async ({ pool, row, actor, requestId }) => {
  const moduleCode = normalizeModuleCode(row)
  const entityKey = normalizeEntityKey(row)

  if (moduleCode === 'GOODS') {
    const goodsId = Number(row?.goodsId || 0)
    if (!Number.isInteger(goodsId) || goodsId <= 0) {
      const err = new Error('申请记录缺少有效 goodsId')
      err.httpStatus = 409
      throw err
    }
    return executeHardDeleteByGoodsId({
      pool,
      goodsId,
      actor,
      requestId,
      requireApprovedReviewRequest: false
    })
  }

  if (!entityKey) {
    const err = new Error('申请记录缺少有效实体标识')
    err.httpStatus = 409
    throw err
  }

  const tx = new sql.Transaction(pool)
  await tx.begin()
  try {
    if (moduleCode === 'PROJECT_INFO') {
      const cascadeSummary = await hardDeleteByProjectCode({ tx, projectCode: entityKey })
      await tx.commit()
      return { projectCode: entityKey, cascadeSummary, auditId: null }
    }

    const req = new sql.Request(tx)
    if (moduleCode === 'SALES_ORDER') {
      req.input('orderNo', sql.NVarChar(100), entityKey)
      await req.query(`
        DELETE FROM 销售订单附件 WHERE 订单编号 = @orderNo;
        DELETE FROM 销售订单 WHERE 订单编号 = @orderNo;
      `)
    } else if (moduleCode === 'OUTBOUND_DOCUMENT') {
      req.input('documentNo', sql.NVarChar(100), entityKey)
      await req.query(`
        DELETE FROM 出库单附件 WHERE 出库单号 = @documentNo;
        DELETE FROM 出库单明细 WHERE 出库单号 = @documentNo;
      `)
    } else if (moduleCode === 'FINANCE_INVOICE') {
      req.input('invoiceId', sql.Int, parseInt(entityKey, 10))
      await req.query(`
        DELETE FROM 发票明细 WHERE 发票ID = @invoiceId;
        DELETE FROM 开票单据 WHERE 发票ID = @invoiceId;
      `)
    } else if (moduleCode === 'FINANCE_RECEIPT') {
      req.input('documentNo', sql.NVarChar(100), entityKey)
      await req.query(`DELETE FROM 回款单据 WHERE 单据编号 = @documentNo;`)
    } else if (moduleCode === 'SALARY') {
      req.input('id', sql.Int, parseInt(entityKey, 10))
      await req.query(`
        DELETE FROM 工资明细 WHERE 汇总ID = @id;
        DELETE FROM 工资汇总 WHERE ID = @id;
      `)
    } else if (moduleCode === 'CUSTOMER') {
      req.input('id', sql.Int, parseInt(entityKey, 10))
      await req.query(`
        DELETE FROM 客户收货地址 WHERE 客户ID = @id;
        DELETE FROM 客户信息 WHERE 客户ID = @id;
      `)
    } else if (moduleCode === 'SUPPLIER') {
      req.input('id', sql.BigInt, parseInt(entityKey, 10))
      await req.query(`DELETE FROM 供方信息 WHERE 供方ID = @id;`)
    } else if (moduleCode === 'EMPLOYEE') {
      req.input('id', sql.Int, parseInt(entityKey, 10))
      await req.query(`DELETE FROM 员工信息 WHERE ID = @id;`)
    } else {
      const err = new Error(`不支持的模块: ${moduleCode}`)
      err.httpStatus = 400
      throw err
    }
    await tx.commit()
    return { auditId: null, projectCode: entityKey, cascadeSummary: { moduleCode, entityKey } }
  } catch (error) {
    try {
      await tx.rollback()
    } catch {}
    throw error
  }
}

// 获取新品货物列表（IsNew=1）
// 只返回在项目管理表中有记录的货物，避免外键约束错误
router.get('/new-products', async (req, res) => {
  try {
    const dataQuery = `
      SELECT 
        g.货物ID as id,
        g.项目编号 as itemCode,
        g.产品图号 as productDrawingNo,
        g.产品名称 as productName,
        g.分类 as category,
        g.备注 as remarks,
        c.客户名称 as customerName,
        p.客户模号 as customerPartNo
      FROM 货物信息 g
      INNER JOIN 项目管理 p ON g.项目编号 = p.项目编号
      LEFT JOIN 客户信息 c ON p.客户ID = c.客户ID
      WHERE g.IsNew = 1
        AND g.项目编号 IS NOT NULL AND g.项目编号 != ''
        AND (g.状态 IS NULL OR g.状态 <> N'${SOFT_DELETED}')
      -- 按项目编号正序排列，确保“从新品中选择”弹窗中项目编号从小到大显示
      ORDER BY g.项目编号 ASC, g.货物ID ASC
    `

    const data = await query(dataQuery)

    res.json({
      code: 0,
      success: true,
      data: {
        list: data
      }
    })
  } catch (error) {
    console.error('获取新品货物列表失败:', error)
    res.status(500).json({
      success: false,
      message: '获取新品货物列表失败',
      error: error.message
    })
  }
})

// 获取货物信息列表
router.get('/list', async (req, res) => {
  try {
    const {
      keyword,
      customerName,
      category,
      status,
      page = 1,
      pageSize = 10,
      sortField,
      sortOrder
    } = req.query

    const pool = await getPool()
    await ensureHardDeleteReviewTable(pool)

    let whereConditions = []
    let params = {}

    // 构建查询条件
    if (keyword) {
      whereConditions.push(
        `(g.项目编号 LIKE @keyword OR g.产品名称 LIKE @keyword OR g.产品图号 LIKE @keyword OR p.客户模号 LIKE @keyword)`
      )
      params.keyword = `%${keyword}%`
    }

    if (customerName) {
      // 暂时注释掉客户名称查询，因为数据库中可能没有这个字段
      // whereConditions.push(`客户名称 LIKE @customerName`)
      // params.customerName = `%${customerName}%`
    }

    if (category) {
      whereConditions.push(`g.分类 = @category`)
      params.category = category
    }

    // 软删过滤：
    // - 默认不返回已删除
    // - status=已删除 仅返回已删除
    // - status=all 返回全部
    const statusText = String(status || '').trim()
    if (statusText === SOFT_DELETED) {
      whereConditions.push(`g.状态 = @status`)
      params.status = SOFT_DELETED
    } else if (statusText && statusText !== 'all') {
      whereConditions.push(`g.状态 = @status`)
      params.status = statusText
    } else if (statusText !== 'all') {
      whereConditions.push(`(g.状态 IS NULL OR g.状态 <> N'${SOFT_DELETED}')`)
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

    // 排序字段白名单映射，防止 SQL 注入
    const sortableFields = {
      projectCode: 'g.项目编号',
      productName: 'g.产品名称',
      productDrawing: 'g.产品图号',
      customerModelNo: 'p.客户模号',
      customerName: 'c.客户名称'
    }

    let orderByClause = 'ORDER BY g.货物ID DESC'
    const mappedField = sortField && sortableFields[sortField]
    const sortDir = (sortOrder || '').toString().toLowerCase()
    if (mappedField && (sortDir === 'asc' || sortDir === 'desc')) {
      orderByClause = `ORDER BY ${mappedField} ${sortDir.toUpperCase()}, g.货物ID DESC`
    }

    // 计算分页
    const offset = (page - 1) * pageSize

    // 查询总数
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM 货物信息 g
      LEFT JOIN 项目管理 p ON g.项目编号 = p.项目编号
      LEFT JOIN 客户信息 c ON p.客户ID = c.客户ID
      ${whereClause}
    `
    const countResult = await query(countQuery, params)
    const total = countResult[0].total

    // 查询数据
    const dataQuery = `
      SELECT 
        g.货物ID as id,
        g.项目编号 as projectCode,
        g.产品图号 as productDrawing,
        g.产品名称 as productName,
        g.分类 as category,
        g.备注 as remarks,
        g.状态 as status,
        hd.status as hardDeleteReviewStatus,
        hd.review_comment as hardDeleteReviewComment,
        hd.updated_at as hardDeleteReviewUpdatedAt,
        c.客户名称 as customerName,
        p.客户模号 as customerModelNo
      FROM 货物信息 g
      LEFT JOIN 项目管理 p ON g.项目编号 = p.项目编号
      LEFT JOIN 客户信息 c ON p.客户ID = c.客户ID
      OUTER APPLY (
        SELECT TOP 1 status, review_comment, updated_at
        FROM dbo.project_hard_delete_review_requests
        WHERE project_code = g.项目编号
        ORDER BY id DESC
      ) hd
      ${whereClause}
      ${orderByClause}
      OFFSET ${offset} ROWS
      FETCH NEXT ${pageSize} ROWS ONLY
    `

    const data = await query(dataQuery, params)

    res.json({
      code: 0,
      success: true,
      data: {
        list: data,
        total: total,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      }
    })
  } catch (error) {
    console.error('获取货物信息列表失败:', error)
    res.status(500).json({
      success: false,
      message: '获取货物信息列表失败',
      error: error.message
    })
  }
})

// 审核中心：硬删除待审核数量
router.get('/hard-delete-review/pending-count', async (req, res) => {
  try {
    try {
      await assertHardDeleteReviewerPermission(req, resolveActorFromReq)
    } catch (e) {
      if (Number(e?.statusCode || 0) === 403) {
        return res.json({ code: 0, success: true, data: { pendingCount: 0 } })
      }
      throw e
    }
    const pool = await getPool()
    await ensureHardDeleteReviewTable(pool)
    const request = pool.request()
    request.input('statusPending', sql.NVarChar(20), HARD_DELETE_REVIEW_STATUS.PENDING)
    const result = await request.query(`
      SELECT COUNT(1) AS pendingCount
      FROM dbo.project_hard_delete_review_requests
      WHERE status = @statusPending
    `)
    const pendingCount = Number(result.recordset?.[0]?.pendingCount || 0) || 0
    return res.json({ code: 0, success: true, data: { pendingCount } })
  } catch (error) {
    console.error('获取硬删除待审数量失败:', error)
    return res.status(500).json({ code: 500, success: false, message: '获取待审数量失败' })
  }
})

// 审核中心：硬删除任务列表
router.get('/hard-delete-review/tasks', async (req, res) => {
  try {
    await assertHardDeleteReviewerPermission(req, resolveActorFromReq)

    const { status = 'PENDING', keyword = '', page = 1, pageSize = 20 } = req.query
    const statusText = String(status || 'PENDING').trim().toUpperCase()
    const pageNumber = Math.max(parseInt(page, 10) || 1, 1)
    const size = Math.min(Math.max(parseInt(pageSize, 10) || 20, 1), 100)
    const offset = (pageNumber - 1) * size

    const where = []
    const params = {}
    if (statusText && statusText !== 'ALL') {
      where.push('r.status = @status')
      params.status = statusText
    }
    const keywordText = String(keyword || '').trim()
    if (keywordText) {
      where.push(
        `(
          r.project_code LIKE @keyword
          OR ISNULL(r.display_code, N'') LIKE @keyword
          OR ISNULL(r.display_name, N'') LIKE @keyword
          OR ISNULL(r.entity_key, N'') LIKE @keyword
          OR g.产品名称 LIKE @keyword
          OR g.产品图号 LIKE @keyword
          OR r.requester_name LIKE @keyword
        )`
      )
      params.keyword = `%${keywordText}%`
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

    const pool = await getPool()
    await ensureHardDeleteReviewTable(pool)

    const countReq = pool.request()
    if (params.status) countReq.input('status', sql.NVarChar(20), params.status)
    if (params.keyword) countReq.input('keyword', sql.NVarChar(120), params.keyword)
    const countResult = await countReq.query(`
      SELECT COUNT(DISTINCT r.id) AS total
      FROM dbo.project_hard_delete_review_requests r
      OUTER APPLY (
        SELECT TOP 1 g.产品名称, g.产品图号
        FROM 货物信息 g
        WHERE g.项目编号 = r.project_code
        ORDER BY g.货物ID DESC
      ) g
      ${whereSql}
    `)
    const total = Number(countResult.recordset?.[0]?.total || 0) || 0

    const dataReq = pool.request()
    if (params.status) dataReq.input('status', sql.NVarChar(20), params.status)
    if (params.keyword) dataReq.input('keyword', sql.NVarChar(120), params.keyword)
    dataReq.input('offset', sql.Int, offset)
    dataReq.input('pageSize', sql.Int, size)
    const dataResult = await dataReq.query(`
      SELECT
        r.id,
        r.project_code AS projectCode,
        r.goods_id AS goodsId,
        ISNULL(r.module_code, N'GOODS') AS moduleCode,
        ISNULL(r.entity_key, r.project_code) AS entityKey,
        r.display_code AS displayCode,
        r.display_name AS displayName,
        g.产品名称 AS productName,
        g.产品图号 AS productDrawing,
        g.分类 AS category,
        r.status,
        r.request_source AS requestSource,
        r.request_reason AS requestReason,
        r.requester_name AS requesterName,
        r.reviewer_name AS reviewerName,
        r.review_comment AS reviewComment,
        r.approved_at AS approvedAt,
        r.rejected_at AS rejectedAt,
        r.canceled_at AS canceledAt,
        r.executed_at AS executedAt,
        r.execution_audit_id AS executionAuditId,
        r.execution_error AS executionError,
        r.created_at AS createdAt,
        r.updated_at AS updatedAt
      FROM dbo.project_hard_delete_review_requests r
      OUTER APPLY (
        SELECT TOP 1 g.产品名称, g.产品图号, g.分类
        FROM 货物信息 g
        WHERE g.项目编号 = r.project_code
        ORDER BY g.货物ID DESC
      ) g
      ${whereSql}
      ORDER BY
        CASE WHEN r.status = N'${HARD_DELETE_REVIEW_STATUS.PENDING}' THEN 0 ELSE 1 END,
        r.created_at DESC,
        r.id DESC
      OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
    `)

    return res.json({
      code: 0,
      success: true,
      data: {
        list: (dataResult.recordset || []).map((row) => toHardDeleteReviewTaskData(row)),
        total
      }
    })
  } catch (error) {
    const status = Number(error?.statusCode) || 500
    console.error('获取硬删除审核任务失败:', error)
    return res.status(status).json({
      code: status,
      success: false,
      message: status === 403 ? '当前用户没有审核权限' : '获取审核任务失败',
      error: error?.message || '未知错误'
    })
  }
})

// 审核中心：驳回硬删除
router.post('/hard-delete-review/reject', async (req, res) => {
  try {
    await assertHardDeleteReviewerPermission(req, resolveActorFromReq)
    const requestIdValue = parseInt(req.body?.requestId, 10)
    const comment = String(req.body?.reason || '').trim()
    if (!Number.isInteger(requestIdValue) || requestIdValue <= 0) {
      return res.status(400).json({ code: 400, success: false, message: 'requestId 无效' })
    }
    if (!comment) {
      return res.status(400).json({ code: 400, success: false, message: '请填写驳回原因' })
    }

    const reviewer = resolveActorFromReq(req)
    const pool = await getPool()
    await ensureHardDeleteReviewTable(pool)
    const tx = new sql.Transaction(pool)
    await tx.begin()
    try {
      const lockReq = new sql.Request(tx)
      lockReq.input('requestId', sql.BigInt, requestIdValue)
      const rowResult = await lockReq.query(`
        SELECT TOP 1
          id,
          status,
          project_code AS projectCode,
          goods_id AS goodsId,
          ISNULL(module_code, N'GOODS') AS moduleCode,
          ISNULL(entity_key, project_code) AS entityKey
        FROM dbo.project_hard_delete_review_requests WITH (UPDLOCK, HOLDLOCK)
        WHERE id = @requestId
      `)
      const row = rowResult.recordset?.[0]
      if (!row) {
        const err = new Error('审核申请不存在')
        err.httpStatus = 404
        throw err
      }
      if (String(row.status || '').trim() !== HARD_DELETE_REVIEW_STATUS.PENDING) {
        const err = new Error('仅待审核状态可以驳回')
        err.httpStatus = 409
        throw err
      }

      const updateReq = new sql.Request(tx)
      updateReq.input('requestId', sql.BigInt, requestIdValue)
      updateReq.input('statusRejected', sql.NVarChar(20), HARD_DELETE_REVIEW_STATUS.REJECTED)
      updateReq.input('reviewerName', sql.NVarChar(200), reviewer || null)
      updateReq.input('reviewComment', sql.NVarChar(1000), comment)
      await updateReq.query(`
        UPDATE dbo.project_hard_delete_review_requests
        SET
          status = @statusRejected,
          reviewer_name = @reviewerName,
          review_comment = @reviewComment,
          rejected_at = SYSDATETIME(),
          updated_at = SYSDATETIME()
        WHERE id = @requestId
      `)

      await restoreSoftDeletedByReviewRow({ tx, row, actor: reviewer })
      await tx.commit()
    } catch (e) {
      try {
        await tx.rollback()
      } catch {}
      throw e
    }

    return res.json({ code: 0, success: true, message: '已驳回' })
  } catch (error) {
    const status = Number(error?.httpStatus || error?.statusCode) || 500
    console.error('驳回硬删除申请失败:', error)
    return res.status(status).json({
      code: status,
      success: false,
      message: status === 403 ? '当前用户没有审核权限' : status === 409 ? '状态冲突，无法驳回' : '驳回失败',
      error: error?.message || '未知错误'
    })
  }
})

// 审核中心：通过硬删除并执行
router.post('/hard-delete-review/approve', async (req, res) => {
  try {
    await assertHardDeleteReviewerPermission(req, resolveActorFromReq)
    const requestIdValue = parseInt(req.body?.requestId, 10)
    if (!Number.isInteger(requestIdValue) || requestIdValue <= 0) {
      return res.status(400).json({ code: 400, success: false, message: 'requestId 无效' })
    }

    const reviewer = resolveActorFromReq(req)
    const requestId = resolveRequestId(req)
    const pool = await getPool()
    await ensureHardDeleteReviewTable(pool)

    let reviewRow = null
    const lockTx = new sql.Transaction(pool)
    await lockTx.begin()
    try {
      const lockReq = new sql.Request(lockTx)
      lockReq.input('requestId', sql.BigInt, requestIdValue)
      const rowResult = await lockReq.query(`
        SELECT TOP 1
          id,
          goods_id AS goodsId,
          project_code AS projectCode,
          requester_name AS requesterName,
          status,
          ISNULL(module_code, N'GOODS') AS moduleCode,
          ISNULL(entity_key, project_code) AS entityKey
        FROM dbo.project_hard_delete_review_requests WITH (UPDLOCK, HOLDLOCK)
        WHERE id = @requestId
      `)
      reviewRow = rowResult.recordset?.[0]
      if (!reviewRow) {
        const err = new Error('审核申请不存在')
        err.httpStatus = 404
        throw err
      }
      if (String(reviewRow.status || '').trim() !== HARD_DELETE_REVIEW_STATUS.PENDING) {
        const err = new Error('仅待审核状态可以通过')
        err.httpStatus = 409
        throw err
      }
      if (
        reviewRow.requesterName &&
        reviewer &&
        String(reviewRow.requesterName).trim() === String(reviewer).trim()
      ) {
        const err = new Error('不允许申请人与审核人为同一人')
        err.httpStatus = 403
        throw err
      }

      const updateReq = new sql.Request(lockTx)
      updateReq.input('requestId', sql.BigInt, requestIdValue)
      updateReq.input('statusApproved', sql.NVarChar(20), HARD_DELETE_REVIEW_STATUS.APPROVED)
      updateReq.input('reviewerName', sql.NVarChar(200), reviewer || null)
      await updateReq.query(`
        UPDATE dbo.project_hard_delete_review_requests
        SET
          status = @statusApproved,
          reviewer_name = @reviewerName,
          approved_at = SYSDATETIME(),
          updated_at = SYSDATETIME()
        WHERE id = @requestId
      `)
      await lockTx.commit()
    } catch (e) {
      try {
        await lockTx.rollback()
      } catch {}
      throw e
    }

    try {
      const executeResult = await executeHardDeleteByReviewRow({ pool, row: reviewRow, actor: reviewer, requestId })
      const finishReq = pool.request()
      finishReq.input('requestId', sql.BigInt, requestIdValue)
      finishReq.input('executionAuditId', sql.BigInt, executeResult.auditId || null)
      finishReq.input(
        'executionResult',
        sql.NVarChar(sql.MAX),
        JSON.stringify(executeResult.cascadeSummary || {})
      )
      await finishReq.query(`
        UPDATE dbo.project_hard_delete_review_requests
        SET
          execution_audit_id = @executionAuditId,
          execution_result = @executionResult,
          execution_error = NULL,
          executed_at = SYSDATETIME(),
          updated_at = SYSDATETIME()
        WHERE id = @requestId
      `)

      return res.json({
        code: 0,
        success: true,
        message: '审核通过并已执行硬删除',
        data: executeResult
      })
    } catch (executeError) {
      const failReq = pool.request()
      failReq.input('requestId', sql.BigInt, requestIdValue)
      failReq.input('executionError', sql.NVarChar(1000), executeError?.message || '硬删除执行失败')
      await failReq.query(`
        UPDATE dbo.project_hard_delete_review_requests
        SET
          execution_error = @executionError,
          updated_at = SYSDATETIME()
        WHERE id = @requestId
      `)
      throw executeError
    }
  } catch (error) {
    const status = Number(error?.httpStatus || error?.statusCode) || 500
    console.error('审核通过硬删除申请失败:', error)
    return res.status(status).json({
      code: status,
      success: false,
      message:
        status === 403
          ? '当前用户没有审核权限'
          : status === 409
            ? '状态冲突，无法审核通过'
            : status === 404
              ? '审核申请不存在'
              : '审核通过失败',
      error: error?.message || '未知错误'
    })
  }
})

// 获取单个货物信息
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params

    const queryString = `
      SELECT 
        g.货物ID as id,
        g.项目编号 as projectCode,
        g.产品图号 as productDrawing,
        g.产品名称 as productName,
        g.分类 as category,
        g.备注 as remarks,
        g.状态 as status,
        c.客户名称 as customerName,
        p.客户模号 as customerModelNo
      FROM 货物信息 g
      LEFT JOIN 项目管理 p ON g.项目编号 = p.项目编号
      LEFT JOIN 客户信息 c ON p.客户ID = c.客户ID
      WHERE g.货物ID = @id
    `

    const result = await query(queryString, { id: parseInt(id) })

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: '货物信息不存在'
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

// 批量删除货物信息（软删整套项目）
// 注意：必须放在 /:id 之前，否则会被当作 id 路由命中
router.delete('/batch', async (req, res) => {
  try {
    const { ids } = req.body
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ code: 400, success: false, message: '请提供有效的ID列表' })
    }

    const actor = resolveActorFromReq(req)
    const pool = await getPool()
    const tx = new sql.Transaction(pool)
    await tx.begin()
    try {
      const getReq = new sql.Request(tx)
      const placeholders = ids.map((_, i) => `@id${i}`).join(', ')
      ids.forEach((v, i) => getReq.input(`id${i}`, sql.Int, parseInt(v, 10)))
      const rows = await getReq.query(`
        SELECT 项目编号 as projectCode, MIN(货物ID) as goodsId
        FROM 货物信息
        WHERE 货物ID IN (${placeholders})
          AND 项目编号 IS NOT NULL AND 项目编号 <> ''
        GROUP BY 项目编号
      `)
      for (const row of rows.recordset || []) {
        const projectCode = String(row.projectCode || '').trim()
        if (!projectCode) continue
        await softDeleteByProjectCode({ pool, tx, projectCode, actor })
        await ensurePendingHardDeleteReviewRequest({
          tx,
          projectCode,
          goodsId: Number(row.goodsId || 0),
          moduleCode: 'GOODS',
          entityKey: projectCode,
          displayCode: projectCode,
          displayName: null,
          requesterName: actor,
          requestSource: 'SOFT_DELETE_AUTO_BATCH',
          requestReason: '批量软删除后系统自动发起硬删除审核'
        })
      }
      await tx.commit()
    } catch (e) {
      try {
        await tx.rollback()
      } catch {}
      throw e
    }

    res.json({ code: 0, success: true, message: '批量删除成功（已软删除并提交硬删除审核）' })
  } catch (error) {
    console.error('批量删除货物信息失败:', error)
    res.status(500).json({ code: 500, success: false, message: '批量删除失败', error: error.message })
  }
})

// 新增货物信息
router.post('/', async (req, res) => {
  try {
    const {
      projectCode,
      productDrawing,
      productName,
      category,
      remarks,
      customerName,
      customerModelNo
    } = req.body

    // 验证必填字段
    if (!projectCode || !projectCode.trim()) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '项目编号不能为空'
      })
    }

    const pool = await getPool()

    // 检查项目编号是否已在货物信息表中存在
    const checkRequest = pool.request()
    checkRequest.input('projectCode', sql.NVarChar, projectCode)
    const checkResult = await checkRequest.query(`
      SELECT COUNT(*) as count 
      FROM 货物信息 
      WHERE 项目编号 = @projectCode
    `)

    if (checkResult.recordset[0].count > 0) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: `项目编号 "${projectCode}" 已存在，不允许重复`
      })
    }

    // 根据客户名称查找客户ID（如果提供了客户名称）
    let customerId = null
    if (customerName) {
      const customerQuery = pool.request()
      customerQuery.input('customerName', sql.NVarChar, customerName)
      const customerResult = await customerQuery.query(`
        SELECT 客户ID as customerId
        FROM 客户信息
        WHERE 客户名称 = @customerName
      `)

      if (customerResult.recordset.length > 0) {
        customerId = customerResult.recordset[0].customerId
        console.log(`找到客户ID: ${customerId} (客户名称: ${customerName})`)
      } else {
        console.warn(`未找到客户: ${customerName}`)
      }
    }

    // 检查项目编号是否在项目管理表中存在（外键约束要求）
    // 如果不存在，自动创建一条记录以满足外键约束
    // 如果存在，更新客户ID和客户模号
    const checkProjectRequest = pool.request()
    checkProjectRequest.input('projectCode', sql.NVarChar, projectCode)
    const checkProjectResult = await checkProjectRequest.query(`
      SELECT COUNT(*) as count 
      FROM 项目管理 
      WHERE 项目编号 = @projectCode
    `)

    if (checkProjectResult.recordset[0].count === 0) {
      // 如果项目管理表中不存在，创建一条记录
      const createProjectRequest = pool.request()
      createProjectRequest.input('projectCode', sql.NVarChar, projectCode)

      if (customerId) {
        createProjectRequest.input('customerId', sql.Int, customerId)
        createProjectRequest.input('customerModelNo', sql.NVarChar, customerModelNo || null)
        await createProjectRequest.query(`
          INSERT INTO 项目管理 (项目编号, 客户ID, 客户模号)
          VALUES (@projectCode, @customerId, @customerModelNo)
        `)
        console.log(
          `[自动创建] 已在项目管理表中创建项目编号: ${projectCode}, 客户ID: ${customerId}`
        )
      } else {
        await createProjectRequest.query(`
          INSERT INTO 项目管理 (项目编号)
          VALUES (@projectCode)
        `)
        console.log(`[自动创建] 已在项目管理表中创建项目编号: ${projectCode}`)
      }
    } else {
      // 如果项目管理表中已存在，更新客户ID和客户模号（如果提供了）
      if (customerId !== null) {
        const updateProjectRequest = pool.request()
        updateProjectRequest.input('projectCode', sql.NVarChar, projectCode)
        updateProjectRequest.input('customerId', sql.Int, customerId)
        updateProjectRequest.input('customerModelNo', sql.NVarChar, customerModelNo || null)
        await updateProjectRequest.query(`
          UPDATE 项目管理 
          SET 客户ID = @customerId, 客户模号 = @customerModelNo
          WHERE 项目编号 = @projectCode
        `)
        console.log(`[更新] 已更新项目管理记录，项目编号: ${projectCode}, 客户ID: ${customerId}`)
      }
    }

    // 第一步：先插入货物信息（生产任务表的外键引用货物信息表，必须先插入货物信息）
    // 插入数据（不指定 IsNew，允许为 NULL）
    const insertRequest = pool.request()
    insertRequest.input('projectCode', sql.NVarChar, projectCode)
    insertRequest.input('productDrawing', sql.NVarChar, productDrawing || null)
    insertRequest.input('productName', sql.NVarChar, productName || null)
    insertRequest.input('category', sql.NVarChar, category || null)
    insertRequest.input('remarks', sql.NVarChar, remarks || null)

    const insertQuery = `
      INSERT INTO 货物信息 
      (项目编号, 产品图号, 产品名称, 分类, 备注)
      VALUES 
      (@projectCode, @productDrawing, @productName, @category, @remarks)
      SELECT SCOPE_IDENTITY() as id
    `

    const insertResult = await insertRequest.query(insertQuery)
    const newId = insertResult.recordset[0].id

    // 第二步：立即更新 IsNew 为 1（使用 UPDATE，我们知道这个操作是可行的）
    const updateRequest = pool.request()
    updateRequest.input('id', sql.Int, newId)
    const updateQuery = `UPDATE 货物信息 SET IsNew = 1 WHERE 货物ID = @id`
    await updateRequest.query(updateQuery)

    // 验证更新结果
    const verifyRequest = pool.request()
    verifyRequest.input('id', sql.Int, newId)
    const verifyResult = await verifyRequest.query(`
      SELECT IsNew, CAST(IsNew AS INT) as IsNewInt 
      FROM 货物信息 
      WHERE 货物ID = @id
    `)

    if (verifyResult.recordset[0].IsNewInt !== 1) {
      console.error('警告：IsNew 更新失败，值为:', verifyResult.recordset[0].IsNewInt)
    } else {
      console.log('✅ IsNew 已成功设置为 1')
    }

    // 第二步：在货物信息插入成功后，检查并创建生产任务记录（如果不存在）
    // 因为生产任务表的外键引用货物信息表，所以必须先插入货物信息
    try {
      const checkProductionTaskRequest = pool.request()
      checkProductionTaskRequest.input('projectCode', sql.NVarChar, projectCode)
      const checkProductionTaskResult = await checkProductionTaskRequest.query(`
        SELECT COUNT(*) as count 
        FROM 生产任务 
        WHERE 项目编号 = @projectCode
      `)

      if (checkProductionTaskResult.recordset[0].count === 0) {
        // 如果生产任务表中不存在，创建一条记录（只创建项目编号）
        const createProductionTaskRequest = pool.request()
        createProductionTaskRequest.input('projectCode', sql.NVarChar, projectCode)

        await createProductionTaskRequest.query(`
          INSERT INTO 生产任务 (项目编号)
          VALUES (@projectCode)
        `)
        console.log(`[自动创建] 已在生产任务表中创建项目编号: ${projectCode}`)
      } else {
        console.log(`[已存在] 生产任务表中已存在项目编号: ${projectCode}，跳过创建`)
      }
    } catch (productionTaskError) {
      console.error('创建生产任务记录失败:', productionTaskError)
      // 即使创建生产任务失败，也不影响货物信息的创建
      // 只是记录警告，不抛出错误
      console.warn('警告：无法创建生产任务记录，但货物信息已成功创建')
    }

    res.json({
      code: 0,
      success: true,
      data: { id: newId },
      message: '新增货物信息成功'
    })
  } catch (error) {
    console.error('新增货物信息失败:', error)
    console.error('错误详情:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      number: error.number,
      originalError: error.originalError
    })
    res.status(500).json({
      code: 500,
      success: false,
      message: '新增货物信息失败',
      error: error.message || '未知错误',
      details:
        process.env.NODE_ENV === 'development'
          ? {
              code: error.code,
              number: error.number,
              originalError: error.originalError
            }
          : undefined
    })
  }
})

// 更新货物信息
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const {
      projectCode,
      productDrawing,
      productName,
      category,
      remarks,
      customerName,
      customerModelNo
    } = req.body

    const pool = await getPool()

    // 根据客户名称查找客户ID（如果提供了客户名称）
    let customerId = null
    if (customerName) {
      const customerQuery = pool.request()
      customerQuery.input('customerName', sql.NVarChar, customerName)
      const customerResult = await customerQuery.query(`
        SELECT 客户ID as customerId
        FROM 客户信息
        WHERE 客户名称 = @customerName
      `)

      if (customerResult.recordset.length > 0) {
        customerId = customerResult.recordset[0].customerId
        console.log(`[更新] 找到客户ID: ${customerId} (客户名称: ${customerName})`)
      } else {
        console.warn(`[更新] 未找到客户: ${customerName}`)
      }
    }

    // 更新货物信息
    const queryString = `
      UPDATE 货物信息 SET
        项目编号 = @projectCode,
        产品图号 = @productDrawing,
        产品名称 = @productName,
        分类 = @category,
        备注 = @remarks
      WHERE 货物ID = @id
    `

    await query(queryString, {
      id: parseInt(id),
      projectCode,
      productDrawing,
      productName,
      category,
      remarks
    })

    // 更新项目管理表中的客户ID和客户模号
    if (projectCode) {
      const updateProjectRequest = pool.request()
      updateProjectRequest.input('projectCode', sql.NVarChar, projectCode)

      if (customerId !== null) {
        // 如果有客户ID，更新客户ID和客户模号
        updateProjectRequest.input('customerId', sql.Int, customerId)
        updateProjectRequest.input('customerModelNo', sql.NVarChar, customerModelNo || null)
        await updateProjectRequest.query(`
          UPDATE 项目管理 
          SET 客户ID = @customerId, 客户模号 = @customerModelNo
          WHERE 项目编号 = @projectCode
        `)
        console.log(`[更新] 已更新项目管理记录，项目编号: ${projectCode}, 客户ID: ${customerId}`)
      } else if (customerName === '' || customerName === null) {
        // 如果客户名称为空，清除客户ID和客户模号
        await updateProjectRequest.query(`
          UPDATE 项目管理 
          SET 客户ID = NULL, 客户模号 = NULL
          WHERE 项目编号 = @projectCode
        `)
        console.log(`[更新] 已清除项目管理记录中的客户信息，项目编号: ${projectCode}`)
      }
    }

    res.json({
      code: 0,
      success: true,
      message: '更新货物信息成功'
    })
  } catch (error) {
    console.error('更新货物信息失败:', error)
    res.status(500).json({
      success: false,
      message: '更新货物信息失败',
      error: error.message
    })
  }
})

// 删除货物信息（软删整套项目：货物信息 + 项目管理 + 生产任务 + 单据 + 附件）
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const actor = resolveActorFromReq(req)
    const pool = await getPool()

    const tx = new sql.Transaction(pool)
    await tx.begin()
    try {
      const getReq = new sql.Request(tx)
      getReq.input('id', sql.Int, parseInt(id, 10))
      const goodsResult = await getReq.query(`
        SELECT TOP 1 项目编号, 状态
        FROM 货物信息
        WHERE 货物ID = @id
      `)
      if (!goodsResult.recordset || goodsResult.recordset.length === 0) {
        await tx.rollback()
        return res.status(404).json({ code: 404, success: false, message: '货物信息不存在' })
      }

      const projectCode = String(goodsResult.recordset[0].项目编号 || '').trim()
      if (!projectCode) {
        await tx.rollback()
        return res.status(400).json({ code: 400, success: false, message: '记录缺少项目编号，无法删除' })
      }

      await softDeleteByProjectCode({ pool, tx, projectCode, actor })
      await ensurePendingHardDeleteReviewRequest({
        tx,
        projectCode,
        goodsId: parseInt(id, 10),
        moduleCode: 'GOODS',
        entityKey: projectCode,
        displayCode: projectCode,
        displayName: null,
        requesterName: actor,
        requestSource: 'SOFT_DELETE_AUTO',
        requestReason: '软删除后系统自动发起硬删除审核'
      })
      await tx.commit()
    } catch (e) {
      try {
        await tx.rollback()
      } catch {}
      throw e
    }

    res.json({
      code: 0,
      success: true,
      message: '删除成功（已软删除，并已提交硬删除审核）'
    })
  } catch (error) {
    console.error('删除货物信息失败:', error)
    console.error('错误详情:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      number: error.number,
      originalError: error.originalError
    })
    res.status(500).json({
      code: 500,
      success: false,
      message: '删除货物信息失败',
      error: error.message || '未知错误',
      details:
        process.env.NODE_ENV === 'development'
          ? {
              code: error.code,
              number: error.number,
              originalError: error.originalError
            }
          : undefined
    })
  }
})

// 硬删除（仅允许删除“已删除”状态，级联清理关联数据）
router.delete('/permanent/:id', async (req, res) => {
  const actor = resolveActorFromReq(req)
  const requestId = resolveRequestId(req)

  try {
    const pool = await getPool()
    const result = await executeHardDeleteByGoodsId({
      pool,
      goodsId: req.params.id,
      actor,
      requestId,
      requireApprovedReviewRequest: true
    })

    return res.json({
      code: 0,
      success: true,
      message: '硬删除成功',
      data: result
    })
  } catch (error) {
    const status = Number(error?.httpStatus) || 500
    console.error('硬删除货物信息失败:', error)
    return res.status(status).json({
      code: status,
      success: false,
      message:
        status === 409
          ? '未通过审核中心审批，或记录状态冲突，无法硬删除'
          : status === 404
            ? '记录不存在'
            : '硬删除失败',
      error: error?.message || '未知错误'
    })
  }
})

// 恢复整套项目（按项目编号）
router.post('/restore', async (req, res) => {
  try {
    const { projectCode } = req.body || {}
    const code = String(projectCode || '').trim()
    if (!code) return res.status(400).json({ code: 400, success: false, message: '项目编号不能为空' })

    const pool = await getPool()
    const tx = new sql.Transaction(pool)
    await tx.begin()
    try {
      await restoreByProjectCode({ pool, tx, projectCode: code })
      await cancelPendingHardDeleteReviewRequest({
        tx,
        moduleCode: 'GOODS',
        entityKey: code,
        reviewerName: resolveActorFromReq(req),
        comment: '记录已恢复，系统自动取消硬删除申请'
      })
      await tx.commit()
    } catch (e) {
      try {
        await tx.rollback()
      } catch {}
      throw e
    }

    res.json({ code: 0, success: true, message: '恢复成功' })
  } catch (error) {
    console.error('恢复项目失败:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: '恢复失败',
      error: error.message || '未知错误'
    })
  }
})

// 获取指定分类的最大序号
router.get('/max-serial/:category', async (req, res) => {
  try {
    const { category } = req.params

    // Year (YY). Default to current year if not provided.
    const rawYear = String(req.query.year || '').trim()
    const nowYY = String(new Date().getFullYear()).slice(-2)
    const year = /^\d{2}$/.test(rawYear) ? rawYear : nowYY

    const queryString = `
      SELECT ISNULL(MAX(
        CASE 
          WHEN LEN(项目编号) >= 11 AND ISNUMERIC(SUBSTRING(项目编号, 9, 3)) = 1 
          THEN CAST(SUBSTRING(项目编号, 9, 3) AS INT)
          ELSE 0
        END
      ), 0) as maxSerial
      FROM 货物信息 
      WHERE 项目编号 LIKE @pattern
        AND LEN(项目编号) >= 11
        AND ISNUMERIC(SUBSTRING(项目编号, 9, 3)) = 1
    `

    // Pattern: JH{category}-{YY}-XXX (and optionally /NN)
    const pattern = `JH${category}-${year}-%`
    const result = await query(queryString, { pattern })

    res.json({
      code: 0,
      success: true,
      data: {
        maxSerial: result[0].maxSerial,
        nextSerial: result[0].maxSerial + 1
      }
    })
  } catch (error) {
    console.error('获取最大序号失败:', error)
    res.status(500).json({
      success: false,
      message: '获取最大序号失败',
      error: error.message
    })
  }
})

module.exports = router
