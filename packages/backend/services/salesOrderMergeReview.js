const sql = require('mssql')
const { assertReviewPermission } = require('./reviewAcl')

const SALES_ORDER_MERGE_REVIEW_TABLE = 'sales_order_merge_review_requests'

const SALES_ORDER_MERGE_REVIEW_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELED: 'CANCELED'
}

const SALES_ORDER_MERGE_REVIEW_STATUS_TEXT = {
  [SALES_ORDER_MERGE_REVIEW_STATUS.PENDING]: '待审核',
  [SALES_ORDER_MERGE_REVIEW_STATUS.APPROVED]: '已通过',
  [SALES_ORDER_MERGE_REVIEW_STATUS.REJECTED]: '已驳回',
  [SALES_ORDER_MERGE_REVIEW_STATUS.CANCELED]: '已取消'
}

const SALES_ORDER_MERGE_REVIEW_ACTION = 'SALES_ORDER_MERGE.REVIEW'

const ensureSalesOrderMergeReviewTable = async (poolOrTx) => {
  const req = new sql.Request(poolOrTx)
  await req.batch(`
    IF OBJECT_ID(N'dbo.${SALES_ORDER_MERGE_REVIEW_TABLE}', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.${SALES_ORDER_MERGE_REVIEW_TABLE} (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        source_order_no NVARCHAR(100) NOT NULL,
        target_order_no NVARCHAR(100) NOT NULL,
        customer_id INT NULL,
        customer_name NVARCHAR(200) NULL,
        status NVARCHAR(20) NOT NULL,
        request_reason NVARCHAR(1000) NULL,
        requester_name NVARCHAR(200) NULL,
        reviewer_name NVARCHAR(200) NULL,
        review_comment NVARCHAR(1000) NULL,
        source_snapshot_json NVARCHAR(MAX) NULL,
        target_snapshot_json NVARCHAR(MAX) NULL,
        preview_json NVARCHAR(MAX) NULL,
        execution_result NVARCHAR(MAX) NULL,
        execution_error NVARCHAR(1000) NULL,
        approved_at DATETIME2 NULL,
        rejected_at DATETIME2 NULL,
        canceled_at DATETIME2 NULL,
        executed_at DATETIME2 NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_so_merge_review_created_at DEFAULT (SYSDATETIME()),
        updated_at DATETIME2 NOT NULL CONSTRAINT DF_so_merge_review_updated_at DEFAULT (SYSDATETIME())
      );
      CREATE INDEX IX_so_merge_review_status
        ON dbo.${SALES_ORDER_MERGE_REVIEW_TABLE}(status, created_at DESC, id DESC);
      CREATE INDEX IX_so_merge_review_source_order
        ON dbo.${SALES_ORDER_MERGE_REVIEW_TABLE}(source_order_no, created_at DESC, id DESC);
      CREATE INDEX IX_so_merge_review_target_order
        ON dbo.${SALES_ORDER_MERGE_REVIEW_TABLE}(target_order_no, created_at DESC, id DESC);
    END
  `)
}

const getSalesOrderMergeReviewStatusText = (status) => {
  const key = String(status || '').trim().toUpperCase()
  return SALES_ORDER_MERGE_REVIEW_STATUS_TEXT[key] || key || '未知'
}

const assertSalesOrderMergeReviewerPermission = async (req, resolveActorFromReq) => {
  const raw = String(process.env.SALES_ORDER_MERGE_REVIEWERS || '').trim()
  const legacyAllowWhenEmpty = !raw
  await assertReviewPermission({
    req,
    actionKey: SALES_ORDER_MERGE_REVIEW_ACTION,
    resolveActorFromReq,
    legacyEnvName: 'SALES_ORDER_MERGE_REVIEWERS',
    legacyAllowWhenEmpty
  })
}

const parseJsonField = (value) => {
  if (!value) return null
  if (typeof value === 'object') return value
  try {
    return JSON.parse(String(value))
  } catch (_e) {
    return null
  }
}

const toSalesOrderMergeReviewTaskData = (row) => {
  if (!row) return null
  return {
    id: Number(row.id || 0),
    sourceOrderNo: row.sourceOrderNo || null,
    targetOrderNo: row.targetOrderNo || null,
    customerId: row.customerId != null ? Number(row.customerId) : null,
    customerName: row.customerName || null,
    status: row.status || null,
    statusText: getSalesOrderMergeReviewStatusText(row.status),
    requestReason: row.requestReason || null,
    requesterName: row.requesterName || null,
    reviewerName: row.reviewerName || null,
    reviewComment: row.reviewComment || null,
    sourceSnapshot: parseJsonField(row.sourceSnapshotJson),
    targetSnapshot: parseJsonField(row.targetSnapshotJson),
    preview: parseJsonField(row.previewJson),
    executionResult: parseJsonField(row.executionResult),
    executionError: row.executionError || null,
    approvedAt: row.approvedAt || null,
    rejectedAt: row.rejectedAt || null,
    canceledAt: row.canceledAt || null,
    executedAt: row.executedAt || null,
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null
  }
}

module.exports = {
  SALES_ORDER_MERGE_REVIEW_TABLE,
  SALES_ORDER_MERGE_REVIEW_STATUS,
  SALES_ORDER_MERGE_REVIEW_ACTION,
  ensureSalesOrderMergeReviewTable,
  getSalesOrderMergeReviewStatusText,
  assertSalesOrderMergeReviewerPermission,
  toSalesOrderMergeReviewTaskData
}
