const { query } = require('../database')

let ensured = false

const ensurePermissionAuditTable = async () => {
  if (ensured) return
  await query(`
    IF OBJECT_ID(N'dbo.permission_change_audits', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.permission_change_audits (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        action_type NVARCHAR(80) NOT NULL,
        module_code NVARCHAR(80) NOT NULL,
        target_type NVARCHAR(40) NOT NULL,
        target_key NVARCHAR(500) NOT NULL,
        change_detail_json NVARCHAR(MAX) NULL,
        operator_username NVARCHAR(120) NULL,
        operator_display_name NVARCHAR(200) NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_permission_change_audits_created_at DEFAULT (SYSDATETIME())
      );
      CREATE INDEX IX_permission_change_audits_created_at ON dbo.permission_change_audits(created_at DESC);
      CREATE INDEX IX_permission_change_audits_module_target ON dbo.permission_change_audits(module_code, target_type, target_key);
    END
  `)
  ensured = true
}

const stringifyDetail = (value) => {
  try {
    return JSON.stringify(value || {})
  } catch (_e) {
    return JSON.stringify({ raw: String(value || '') })
  }
}

const recordPermissionAudit = async ({
  actionType,
  moduleCode,
  targetType,
  targetKey,
  detail,
  operatorUsername,
  operatorDisplayName
}) => {
  const action = String(actionType || '').trim()
  const module = String(moduleCode || '').trim()
  const tType = String(targetType || '').trim()
  const tKey = String(targetKey || '').trim()

  if (!action || !module || !tType || !tKey) return

  await ensurePermissionAuditTable()
  await query(
    `
      INSERT INTO dbo.permission_change_audits (
        action_type,
        module_code,
        target_type,
        target_key,
        change_detail_json,
        operator_username,
        operator_display_name
      )
      VALUES (
        @actionType,
        @moduleCode,
        @targetType,
        @targetKey,
        @changeDetailJson,
        @operatorUsername,
        @operatorDisplayName
      )
    `,
    {
      actionType: action,
      moduleCode: module,
      targetType: tType,
      targetKey: tKey,
      changeDetailJson: stringifyDetail(detail),
      operatorUsername: String(operatorUsername || '').trim() || null,
      operatorDisplayName: String(operatorDisplayName || '').trim() || null
    }
  )
}

module.exports = {
  ensurePermissionAuditTable,
  recordPermissionAudit
}
