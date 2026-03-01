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
        module_code NVARCHAR(40) NULL,
        entity_key NVARCHAR(200) NULL,
        display_code NVARCHAR(200) NULL,
        display_name NVARCHAR(300) NULL,
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

    IF COL_LENGTH(N'dbo.${HARD_DELETE_REVIEW_TABLE}', N'module_code') IS NULL
      ALTER TABLE dbo.${HARD_DELETE_REVIEW_TABLE} ADD module_code NVARCHAR(40) NULL;
    IF COL_LENGTH(N'dbo.${HARD_DELETE_REVIEW_TABLE}', N'entity_key') IS NULL
      ALTER TABLE dbo.${HARD_DELETE_REVIEW_TABLE} ADD entity_key NVARCHAR(200) NULL;
    IF COL_LENGTH(N'dbo.${HARD_DELETE_REVIEW_TABLE}', N'display_code') IS NULL
      ALTER TABLE dbo.${HARD_DELETE_REVIEW_TABLE} ADD display_code NVARCHAR(200) NULL;
    IF COL_LENGTH(N'dbo.${HARD_DELETE_REVIEW_TABLE}', N'display_name') IS NULL
      ALTER TABLE dbo.${HARD_DELETE_REVIEW_TABLE} ADD display_name NVARCHAR(300) NULL;
  `)
}

const ensurePendingHardDeleteReviewRequest = async ({
  tx,
  projectCode,
  goodsId,
  requesterName,
  requestSource = 'SOFT_DELETE_AUTO',
  requestReason = null,
  moduleCode = 'GOODS',
  entityKey = null,
  displayCode = null,
  displayName = null
}) => {
  if (!tx || !projectCode) return null
  await ensureHardDeleteReviewTable(tx)

  const effectiveEntityKey = String(entityKey || projectCode || '').trim()
  if (!effectiveEntityKey) return null

  const lockReq = new sql.Request(tx)
  lockReq.input('projectCode', sql.NVarChar(100), projectCode)
  lockReq.input('moduleCode', sql.NVarChar(40), moduleCode)
  lockReq.input('entityKey', sql.NVarChar(200), effectiveEntityKey)
  lockReq.input('statusPending', sql.NVarChar(20), HARD_DELETE_REVIEW_STATUS.PENDING)
  const existsResult = await lockReq.query(`
    SELECT TOP 1 id
    FROM dbo.${HARD_DELETE_REVIEW_TABLE} WITH (UPDLOCK, HOLDLOCK)
    WHERE status = @statusPending
      AND (
        (ISNULL(module_code, N'GOODS') = @moduleCode AND ISNULL(entity_key, project_code) = @entityKey)
        OR (project_code = @projectCode AND @moduleCode = N'GOODS')
      )
    ORDER BY id DESC
  `)
  const pendingId = Number(existsResult.recordset?.[0]?.id || 0)
  if (pendingId > 0) return pendingId

  const insertReq = new sql.Request(tx)
  insertReq.input('projectCode', sql.NVarChar(100), projectCode)
  insertReq.input('goodsId', sql.Int, Number.isInteger(goodsId) && goodsId > 0 ? goodsId : null)
  insertReq.input('moduleCode', sql.NVarChar(40), moduleCode)
  insertReq.input('entityKey', sql.NVarChar(200), effectiveEntityKey)
  insertReq.input('displayCode', sql.NVarChar(200), displayCode || projectCode)
  insertReq.input('displayName', sql.NVarChar(300), displayName || null)
  insertReq.input('requestSource', sql.NVarChar(40), requestSource)
  insertReq.input('requestReason', sql.NVarChar(1000), requestReason || null)
  insertReq.input('status', sql.NVarChar(20), HARD_DELETE_REVIEW_STATUS.PENDING)
  insertReq.input('requesterName', sql.NVarChar(200), requesterName || null)
  const insertResult = await insertReq.query(`
    INSERT INTO dbo.${HARD_DELETE_REVIEW_TABLE} (
      project_code,
      goods_id,
      module_code,
      entity_key,
      display_code,
      display_name,
      request_source,
      request_reason,
      status,
      requester_name
    )
    VALUES (
      @projectCode,
      @goodsId,
      @moduleCode,
      @entityKey,
      @displayCode,
      @displayName,
      @requestSource,
      @requestReason,
      @status,
      @requesterName
    );
    SELECT CAST(SCOPE_IDENTITY() AS BIGINT) AS requestId;
  `)
  return Number(insertResult.recordset?.[0]?.requestId || 0) || null
}

const cancelPendingHardDeleteReviewRequest = async ({
  tx,
  moduleCode = 'GOODS',
  entityKey,
  reviewerName,
  comment
}) => {
  if (!tx || !entityKey) return
  await ensureHardDeleteReviewTable(tx)
  const req = new sql.Request(tx)
  req.input('moduleCode', sql.NVarChar(40), moduleCode)
  req.input('entityKey', sql.NVarChar(200), String(entityKey).trim())
  req.input('statusPending', sql.NVarChar(20), HARD_DELETE_REVIEW_STATUS.PENDING)
  req.input('statusCanceled', sql.NVarChar(20), HARD_DELETE_REVIEW_STATUS.CANCELED)
  req.input('reviewerName', sql.NVarChar(200), reviewerName || null)
  req.input('reviewComment', sql.NVarChar(1000), comment || '记录已恢复，系统自动取消硬删除申请')
  await req.query(`
    UPDATE dbo.${HARD_DELETE_REVIEW_TABLE}
    SET
      status = @statusCanceled,
      reviewer_name = COALESCE(reviewer_name, @reviewerName),
      review_comment = @reviewComment,
      canceled_at = SYSDATETIME(),
      updated_at = SYSDATETIME()
    WHERE status = @statusPending
      AND ISNULL(module_code, N'GOODS') = @moduleCode
      AND ISNULL(entity_key, project_code) = @entityKey
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
    productName: row.productName || row.displayName || null,
    productDrawing: row.productDrawing || row.displayCode || null,
    category: row.category || row.moduleCode || null,
    moduleCode: row.moduleCode || 'GOODS',
    entityKey: row.entityKey || row.projectCode || null,
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
  ensurePendingHardDeleteReviewRequest,
  cancelPendingHardDeleteReviewRequest,
  getHardDeleteReviewStatusText,
  assertHardDeleteReviewerPermission,
  toHardDeleteReviewTaskData
}
