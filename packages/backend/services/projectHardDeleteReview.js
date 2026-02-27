const sql = require('mssql')

const HARD_DELETE_REVIEW_TABLE = 'project_hard_delete_review_requests'

const HARD_DELETE_REVIEW_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELED: 'CANCELED'
}

const HARD_DELETE_REVIEW_STATUS_TEXT = {
  [HARD_DELETE_REVIEW_STATUS.PENDING]: '待审核',
  [HARD_DELETE_REVIEW_STATUS.APPROVED]: '已通过',
  [HARD_DELETE_REVIEW_STATUS.REJECTED]: '已驳回',
  [HARD_DELETE_REVIEW_STATUS.CANCELED]: '已取消'
}

const ensureHardDeleteReviewTable = async (poolOrTx) => {
  const req = new sql.Request(poolOrTx)
  await req.batch(`
    IF OBJECT_ID(N'dbo.${HARD_DELETE_REVIEW_TABLE}', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.${HARD_DELETE_REVIEW_TABLE} (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        project_code NVARCHAR(100) NOT NULL,
        goods_id INT NULL,
        request_source NVARCHAR(40) NOT NULL,
        request_reason NVARCHAR(1000) NULL,
        status NVARCHAR(20) NOT NULL,
        requester_name NVARCHAR(200) NULL,
        reviewer_name NVARCHAR(200) NULL,
        review_comment NVARCHAR(1000) NULL,
        approved_at DATETIME2 NULL,
        rejected_at DATETIME2 NULL,
        canceled_at DATETIME2 NULL,
        execution_audit_id BIGINT NULL,
        execution_result NVARCHAR(MAX) NULL,
        execution_error NVARCHAR(1000) NULL,
        executed_at DATETIME2 NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_project_hard_delete_review_created_at DEFAULT (SYSDATETIME()),
        updated_at DATETIME2 NOT NULL CONSTRAINT DF_project_hard_delete_review_updated_at DEFAULT (SYSDATETIME())
      );
      CREATE INDEX IX_project_hard_delete_review_project_code
        ON dbo.${HARD_DELETE_REVIEW_TABLE}(project_code, created_at DESC);
      CREATE INDEX IX_project_hard_delete_review_status
        ON dbo.${HARD_DELETE_REVIEW_TABLE}(status, created_at DESC);
    END
  `)
}

const getHardDeleteReviewStatusText = (status) => {
  const key = String(status || '').trim().toUpperCase()
  return HARD_DELETE_REVIEW_STATUS_TEXT[key] || key || '未知'
}

const getHardDeleteReviewerWhitelist = () => {
  const raw = String(process.env.HARD_DELETE_REVIEWERS || '').trim()
  if (!raw) return []
  return raw
    .split(',')
    .map((x) => String(x || '').trim().toLowerCase())
    .filter(Boolean)
}

const assertHardDeleteReviewerPermission = (req, resolveActorFromReq) => {
  const whitelist = getHardDeleteReviewerWhitelist()
  if (!whitelist.length) return

  const actor = String(resolveActorFromReq(req) || '')
    .trim()
    .toLowerCase()
  const usernameRaw = req?.headers?.['x-username']
  const username = String(Array.isArray(usernameRaw) ? usernameRaw[0] : usernameRaw || '')
    .trim()
    .toLowerCase()

  if (!actor && !username) {
    const e = new Error('当前用户没有审核权限')
    e.statusCode = 403
    throw e
  }
  if (whitelist.includes(actor) || whitelist.includes(username)) return

  const e = new Error('当前用户没有审核权限')
  e.statusCode = 403
  throw e
}

const toHardDeleteReviewTaskData = (row) => {
  if (!row) return null
  return {
    id: Number(row.id || 0),
    projectCode: row.projectCode || null,
    goodsId: row.goodsId ? Number(row.goodsId) : null,
    productName: row.productName || null,
    productDrawing: row.productDrawing || null,
    category: row.category || null,
    status: row.status || null,
    statusText: getHardDeleteReviewStatusText(row.status),
    requesterName: row.requesterName || null,
    requestSource: row.requestSource || null,
    requestReason: row.requestReason || null,
    reviewerName: row.reviewerName || null,
    reviewComment: row.reviewComment || null,
    approvedAt: row.approvedAt || null,
    rejectedAt: row.rejectedAt || null,
    canceledAt: row.canceledAt || null,
    executedAt: row.executedAt || null,
    executionAuditId: row.executionAuditId ? Number(row.executionAuditId) : null,
    executionError: row.executionError || null,
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null
  }
}

module.exports = {
  HARD_DELETE_REVIEW_TABLE,
  HARD_DELETE_REVIEW_STATUS,
  ensureHardDeleteReviewTable,
  getHardDeleteReviewStatusText,
  assertHardDeleteReviewerPermission,
  toHardDeleteReviewTaskData
}
