const sql = require('mssql')

const HARD_DELETE_AUDIT_TABLE = 'project_hard_delete_audit'
const SOFT_DELETED = '已删除'

const DELETE_PLAN = [
  { table: 'dbo.试模过程附件', whereSql: '项目编号 = @projectCode' },
  { table: 'dbo.试模过程', whereSql: '项目编号 = @projectCode' },
  { table: '销售订单附件', whereSql: '项目编号 = @projectCode' },
  { table: '出库单附件', whereSql: '项目编号 = @projectCode' },
  { table: '项目管理附件', whereSql: '项目编号 = @projectCode' },
  { table: '生产任务附件', whereSql: '项目编号 = @projectCode' },
  { table: '出库单明细', whereSql: '项目编号 = @projectCode' },
  { table: '销售订单', whereSql: '项目编号 = @projectCode' },
  { table: '生产任务', whereSql: '项目编号 = @projectCode' },
  { table: '货物信息', whereSql: '项目编号 = @projectCode' },
  { table: '项目管理', whereSql: '项目编号 = @projectCode' }
]

const ensureHardDeleteAuditTable = async (poolOrTx) => {
  const req = new sql.Request(poolOrTx)
  await req.batch(`
    IF OBJECT_ID(N'dbo.${HARD_DELETE_AUDIT_TABLE}', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.${HARD_DELETE_AUDIT_TABLE} (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        project_code NVARCHAR(100) NOT NULL,
        operator_name NVARCHAR(200) NULL,
        request_id NVARCHAR(120) NULL,
        status NVARCHAR(20) NOT NULL,
        before_snapshot NVARCHAR(MAX) NULL,
        cascade_plan NVARCHAR(MAX) NULL,
        cascade_result NVARCHAR(MAX) NULL,
        error_message NVARCHAR(1000) NULL,
        started_at DATETIME2 NOT NULL CONSTRAINT DF_project_hard_delete_audit_started_at DEFAULT (SYSDATETIME()),
        finished_at DATETIME2 NULL
      );
      CREATE INDEX IX_project_hard_delete_audit_project_code
        ON dbo.${HARD_DELETE_AUDIT_TABLE}(project_code, started_at DESC);
    END
  `)
}

const createHardDeleteAuditStarted = async ({
  pool,
  projectCode,
  actor,
  requestId,
  beforeSnapshot,
  cascadePlan
}) => {
  await ensureHardDeleteAuditTable(pool)
  const req = new sql.Request(pool)
  req.input('projectCode', sql.NVarChar(100), projectCode)
  req.input('operatorName', sql.NVarChar(200), actor || null)
  req.input('requestId', sql.NVarChar(120), requestId || null)
  req.input('status', sql.NVarChar(20), 'started')
  req.input('beforeSnapshot', sql.NVarChar(sql.MAX), beforeSnapshot ? JSON.stringify(beforeSnapshot) : null)
  req.input('cascadePlan', sql.NVarChar(sql.MAX), JSON.stringify(cascadePlan || []))
  const result = await req.query(`
    INSERT INTO dbo.${HARD_DELETE_AUDIT_TABLE} (
      project_code, operator_name, request_id, status, before_snapshot, cascade_plan
    )
    VALUES (@projectCode, @operatorName, @requestId, @status, @beforeSnapshot, @cascadePlan);
    SELECT CAST(SCOPE_IDENTITY() AS BIGINT) AS auditId;
  `)
  return result?.recordset?.[0]?.auditId || null
}

const markHardDeleteAuditFinished = async ({ pool, auditId, success, cascadeResult, errorMessage }) => {
  if (!auditId) return
  await ensureHardDeleteAuditTable(pool)
  const req = new sql.Request(pool)
  req.input('auditId', sql.BigInt, auditId)
  req.input('status', sql.NVarChar(20), success ? 'succeeded' : 'failed')
  req.input('cascadeResult', sql.NVarChar(sql.MAX), cascadeResult ? JSON.stringify(cascadeResult) : null)
  req.input('errorMessage', sql.NVarChar(1000), errorMessage || null)
  await req.query(`
    UPDATE dbo.${HARD_DELETE_AUDIT_TABLE}
    SET
      status = @status,
      cascade_result = @cascadeResult,
      error_message = @errorMessage,
      finished_at = SYSDATETIME()
    WHERE id = @auditId;
  `)
}

const hardDeleteByProjectCode = async ({ tx, projectCode }) => {
  const summary = {}
  for (const item of DELETE_PLAN) {
    const req = new sql.Request(tx)
    req.input('projectCode', sql.NVarChar(100), projectCode)
    const result = await req.query(`
      IF OBJECT_ID(N'${item.table}', N'U') IS NULL
      BEGIN
        SELECT CAST(0 AS INT) AS affected;
      END
      ELSE
      BEGIN
        DELETE FROM ${item.table}
        WHERE ${item.whereSql};
        SELECT CAST(@@ROWCOUNT AS INT) AS affected;
      END
    `)
    const affected = Number(result?.recordset?.[0]?.affected || 0)
    summary[item.table] = affected
  }
  return summary
}

module.exports = {
  SOFT_DELETED,
  DELETE_PLAN,
  createHardDeleteAuditStarted,
  markHardDeleteAuditFinished,
  hardDeleteByProjectCode
}
