const sql = require('mssql')
const { getPool } = require('../database')
const { normalizeUsername, isAdmin } = require('./permissionAccess')

let ldap = null
try {
  ldap = require('ldapjs')
} catch (_e) {
  ldap = null
}

const LDAP_CONFIG = {
  url: process.env.LDAP_URL || 'ldap://AD2016-1.jiuhuan.local:389',
  baseDN: process.env.LDAP_BASE_DN || 'DC=JIUHUAN,DC=LOCAL',
  bindDN: process.env.LDAP_BIND_DN,
  bindPassword: process.env.LDAP_BIND_PASSWORD
}

const TABLES = {
  capabilities: 'capabilities',
  userBindings: 'user_capabilities',
  groupBindings: 'group_capabilities',
  migrationState: 'capability_migration_state'
}

const DEFAULT_MODULE_DEFS = [
  ['SALES_ORDERS', '销售订单', 'SalesOrdersIndex'],
  ['PROJECT_MANAGEMENT', '项目管理', 'ProjectManagementIndex'],
  ['OUTBOUND_DOCUMENT', '出库单据', 'OutboundDocumentIndex'],
  ['PRODUCTION_TASKS', '生产任务', 'ProductionTasksIndex'],
  ['CUSTOMER_INFO', '客户信息', 'CustomerInfoIndex'],
  ['SUPPLIER_INFO', '供方信息', 'SupplierInfoIndex'],
  ['EMPLOYEE_INFO', '员工信息', 'EmployeeInfoIndex'],
  ['QUOTATION', '报价单', 'QuotationIndex'],
  ['BILLING_DOCUMENTS', '开票单据', 'BillingDocuments'],
  ['RECEIVABLE_DOCUMENTS', '回款单据', 'ReceivableDocuments'],
  ['COMPREHENSIVE_QUERY', '综合查询', 'ComprehensiveQuery'],
  ['ATTENDANCE', '考勤管理', 'AttendanceIndex'],
  ['SALARY', '工资管理', 'Salary'],
  ['ANALYSIS', '分析报表', 'Analysis'],
  ['BMO_SYNC', 'BMO采集', 'BmoSync'],
  ['BMO_RELAY_MANAGE', 'BMO中转管理', 'BmoRelayManage'],
  ['BREAK_SNAKE_GAME', '贪吃蛇游戏', 'BreakSnakeGame']
]

const DEFAULT_ACTION_DEFS = [
  ['READ', '查看'],
  ['CREATE', '新建'],
  ['UPDATE', '编辑'],
  ['DELETE', '删除'],
  ['UPLOAD', '上传'],
  ['EXPORT', '导出'],
  ['APPROVE', '审核']
]

const ROUTE_TO_MODULE_CODE = Object.fromEntries(
  DEFAULT_MODULE_DEFS.flatMap(([moduleCode, _moduleName, routeName]) => {
    const pairs = [[routeName, moduleCode]]
    if (routeName === 'CustomerInfoIndex') pairs.push(['CustomerInfo', moduleCode])
    if (routeName === 'SupplierInfoIndex') pairs.push(['SupplierInfo', moduleCode])
    if (routeName === 'EmployeeInfoIndex') pairs.push(['EmployeeInfo', moduleCode])
    if (routeName === 'ProjectManagementIndex') pairs.push(['ProjectInfoIndex', moduleCode], ['ProjectInfo', moduleCode])
    return pairs
  })
)

const DEFAULT_CAPABILITIES = DEFAULT_MODULE_DEFS.flatMap(([moduleCode, moduleName, routeName]) =>
  DEFAULT_ACTION_DEFS.map(([actionCode, actionName]) => ({
    capabilityKey: `${moduleCode}.${actionCode}`,
    moduleCode,
    moduleName,
    actionCode,
    actionName,
    capabilityName: `${moduleName}${actionName}`,
    routeName
  }))
)

const normalizeText = (value) => String(value || '').trim()
const normalizePrincipal = (value) => normalizeText(value).toLowerCase()
const normalizeCapabilityKey = (value) => normalizeText(value).toUpperCase()

const routeNamesToCapabilityKeys = (routeNames = [], actionCode = '') => {
  const targetAction = normalizeText(actionCode).toUpperCase()
  const actionCodes = targetAction
    ? DEFAULT_ACTION_DEFS.map((x) => x[0]).filter((x) => x === targetAction)
    : DEFAULT_ACTION_DEFS.map((x) => x[0])
  const keys = []
  ;(routeNames || []).forEach((name) => {
    const routeName = normalizeText(name)
    const moduleCode = ROUTE_TO_MODULE_CODE[routeName]
    if (!moduleCode) return
    actionCodes.forEach((code) => keys.push(`${moduleCode}.${code}`))
  })
  return Array.from(new Set(keys.map((x) => normalizeCapabilityKey(x)).filter(Boolean)))
}

function ldapSearch(client, searchBase, searchFilter, attributes = [], options = {}) {
  return new Promise((resolve, reject) => {
    const entries = []
    client.search(
      searchBase,
      {
        filter: searchFilter,
        scope: options.scope || 'sub',
        attributes,
        sizeLimit: options.sizeLimit || 200,
        timeLimit: options.timeLimit || 8
      },
      (err, res) => {
        if (err) return reject(err)

        res.on('searchEntry', (entry) => {
          const obj = entry?.object || (typeof entry?.toObject === 'function' ? entry.toObject() : null)
          if (obj) entries.push(obj)
        })

        res.on('error', reject)
        res.on('end', () => resolve(entries))
      }
    )
  })
}

const escapeLdapFilter = (str) => {
  if (!str) return ''
  return String(str)
    .replace(/\\/g, '\\5c')
    .replace(/\*/g, '\\2a')
    .replace(/\(/g, '\\28')
    .replace(/\)/g, '\\29')
    .replace(/\//g, '\\2f')
    .replace(/\0/g, '\\00')
}

const loadUserGroupDns = async (pureUsername) => {
  if (!ldap || !pureUsername) return []
  const client = ldap.createClient({ url: LDAP_CONFIG.url })
  client.on('error', () => {})
  try {
    if (LDAP_CONFIG.bindDN && LDAP_CONFIG.bindPassword) {
      await new Promise((resolve, reject) => {
        client.bind(LDAP_CONFIG.bindDN, LDAP_CONFIG.bindPassword, (err) => {
          if (err) {
            client.unbind(() => {})
            return reject(err)
          }
          resolve()
        })
      })
    }

    const escapedUsername = escapeLdapFilter(pureUsername)
    const rows = await ldapSearch(client, LDAP_CONFIG.baseDN, `(sAMAccountName=${escapedUsername})`, ['memberOf'])
    const memberOf = rows?.[0]?.memberOf
    const list = Array.isArray(memberOf) ? memberOf : memberOf ? [memberOf] : []
    return Array.from(new Set(list.map((x) => normalizeText(x)).filter(Boolean)))
  } catch (_e) {
    return []
  } finally {
    try {
      client.unbind(() => {})
    } catch (_e) {
      // ignore
    }
  }
}

const ensureCapabilitySchema = async (poolOrTx) => {
  const req = new sql.Request(poolOrTx)
  await req.batch(`
    IF OBJECT_ID(N'dbo.${TABLES.capabilities}', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.${TABLES.capabilities} (
        capability_key NVARCHAR(160) NOT NULL PRIMARY KEY,
        capability_name NVARCHAR(200) NOT NULL,
        module_code NVARCHAR(80) NOT NULL,
        module_name NVARCHAR(120) NOT NULL,
        action_code NVARCHAR(40) NOT NULL,
        action_name NVARCHAR(60) NOT NULL,
        route_name NVARCHAR(120) NULL,
        enabled BIT NOT NULL CONSTRAINT DF_capabilities_enabled DEFAULT (1),
        created_at DATETIME2 NOT NULL CONSTRAINT DF_capabilities_created_at DEFAULT (SYSDATETIME()),
        updated_at DATETIME2 NOT NULL CONSTRAINT DF_capabilities_updated_at DEFAULT (SYSDATETIME())
      );
      CREATE INDEX IX_capabilities_module_action ON dbo.${TABLES.capabilities}(module_code, action_code);
      CREATE INDEX IX_capabilities_route_name ON dbo.${TABLES.capabilities}(route_name);
    END

    IF OBJECT_ID(N'dbo.${TABLES.userBindings}', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.${TABLES.userBindings} (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        capability_key NVARCHAR(160) NOT NULL,
        username NVARCHAR(120) NOT NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_user_capabilities_created_at DEFAULT (SYSDATETIME()),
        CONSTRAINT FK_user_capabilities_capability
          FOREIGN KEY (capability_key) REFERENCES dbo.${TABLES.capabilities}(capability_key) ON DELETE CASCADE,
        CONSTRAINT UQ_user_capabilities UNIQUE(capability_key, username)
      );
      CREATE INDEX IX_user_capabilities_username ON dbo.${TABLES.userBindings}(username);
    END

    IF OBJECT_ID(N'dbo.${TABLES.groupBindings}', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.${TABLES.groupBindings} (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        capability_key NVARCHAR(160) NOT NULL,
        group_dn NVARCHAR(500) NOT NULL,
        group_name NVARCHAR(200) NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_group_capabilities_created_at DEFAULT (SYSDATETIME()),
        CONSTRAINT FK_group_capabilities_capability
          FOREIGN KEY (capability_key) REFERENCES dbo.${TABLES.capabilities}(capability_key) ON DELETE CASCADE,
        CONSTRAINT UQ_group_capabilities UNIQUE(capability_key, group_dn)
      );
      CREATE INDEX IX_group_capabilities_group_dn ON dbo.${TABLES.groupBindings}(group_dn);
    END
  `)
}

const ensureDefaultCapabilities = async (poolOrTx) => {
  await Promise.all(
    DEFAULT_CAPABILITIES.map(async (item) => {
      const req = new sql.Request(poolOrTx)
      req.input('capabilityKey', sql.NVarChar(160), item.capabilityKey)
      req.input('capabilityName', sql.NVarChar(200), item.capabilityName)
      req.input('moduleCode', sql.NVarChar(80), item.moduleCode)
      req.input('moduleName', sql.NVarChar(120), item.moduleName)
      req.input('actionCode', sql.NVarChar(40), item.actionCode)
      req.input('actionName', sql.NVarChar(60), item.actionName)
      req.input('routeName', sql.NVarChar(120), item.routeName)
      await req.query(`
        MERGE dbo.${TABLES.capabilities} AS target
        USING (SELECT @capabilityKey AS capability_key) AS src
        ON target.capability_key = src.capability_key
        WHEN MATCHED THEN
          UPDATE SET
            capability_name = COALESCE(NULLIF(target.capability_name, N''), @capabilityName),
            module_code = COALESCE(NULLIF(target.module_code, N''), @moduleCode),
            module_name = COALESCE(NULLIF(target.module_name, N''), @moduleName),
            action_code = COALESCE(NULLIF(target.action_code, N''), @actionCode),
            action_name = COALESCE(NULLIF(target.action_name, N''), @actionName),
            route_name = COALESCE(NULLIF(target.route_name, N''), @routeName),
            updated_at = SYSDATETIME()
        WHEN NOT MATCHED THEN
          INSERT (
            capability_key, capability_name, module_code, module_name, action_code, action_name, route_name, enabled
          )
          VALUES (
            @capabilityKey, @capabilityName, @moduleCode, @moduleName, @actionCode, @actionName, @routeName, 1
          );
      `)
    })
  )
}

const ensureCapabilityMigrationStateTable = async (poolOrTx) => {
  const req = new sql.Request(poolOrTx)
  await req.batch(`
    IF OBJECT_ID(N'dbo.${TABLES.migrationState}', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.${TABLES.migrationState} (
        migration_key NVARCHAR(120) NOT NULL PRIMARY KEY,
        executed_at DATETIME2 NOT NULL CONSTRAINT DF_capability_migration_state_executed_at DEFAULT (SYSDATETIME())
      );
    END
  `)
}

const insertUserCapabilityKeysWithPool = async (poolOrTx, username, capabilityKeys) => {
  const normalizedUsername = normalizePrincipal(username)
  const normalizedKeys = Array.from(
    new Set((capabilityKeys || []).map((x) => normalizeCapabilityKey(x)).filter(Boolean))
  )
  if (!normalizedUsername || !normalizedKeys.length) return
  await Promise.all(
    normalizedKeys.map(async (capabilityKey) => {
      const req = new sql.Request(poolOrTx)
      req.input('capabilityKey', sql.NVarChar(160), capabilityKey)
      req.input('username', sql.NVarChar(120), normalizedUsername)
      await req.query(`
        IF EXISTS (SELECT 1 FROM dbo.${TABLES.capabilities} WHERE capability_key = @capabilityKey)
        AND NOT EXISTS (
          SELECT 1
          FROM dbo.${TABLES.userBindings}
          WHERE capability_key = @capabilityKey AND username = @username
        )
        BEGIN
          INSERT INTO dbo.${TABLES.userBindings} (capability_key, username)
          VALUES (@capabilityKey, @username)
        END
      `)
    })
  )
}

const insertGroupCapabilityKeysWithPool = async (poolOrTx, groupDn, groupName, capabilityKeys) => {
  const normalizedGroupDn = normalizeText(groupDn)
  const normalizedGroupName = normalizeText(groupName)
  const normalizedKeys = Array.from(
    new Set((capabilityKeys || []).map((x) => normalizeCapabilityKey(x)).filter(Boolean))
  )
  if (!normalizedGroupDn || !normalizedKeys.length) return
  await Promise.all(
    normalizedKeys.map(async (capabilityKey) => {
      const req = new sql.Request(poolOrTx)
      req.input('capabilityKey', sql.NVarChar(160), capabilityKey)
      req.input('groupDn', sql.NVarChar(500), normalizedGroupDn)
      req.input('groupName', sql.NVarChar(200), normalizedGroupName || null)
      await req.query(`
        IF EXISTS (SELECT 1 FROM dbo.${TABLES.capabilities} WHERE capability_key = @capabilityKey)
        AND NOT EXISTS (
          SELECT 1
          FROM dbo.${TABLES.groupBindings}
          WHERE capability_key = @capabilityKey AND group_dn = @groupDn
        )
        BEGIN
          INSERT INTO dbo.${TABLES.groupBindings} (capability_key, group_dn, group_name)
          VALUES (@capabilityKey, @groupDn, @groupName)
        END
      `)
    })
  )
}

const LEGACY_ROUTE_CAPABILITY_BACKFILL_KEY = 'LEGACY_ROUTE_CAPABILITY_BACKFILL_V1'

const ensureLegacyRouteCapabilityBackfill = async (poolOrTx) => {
  await ensureCapabilityMigrationStateTable(poolOrTx)
  const markerReq = new sql.Request(poolOrTx)
  markerReq.input('migrationKey', sql.NVarChar(120), LEGACY_ROUTE_CAPABILITY_BACKFILL_KEY)
  const markerRows = await markerReq.query(`
    SELECT TOP 1 migration_key AS migrationKey
    FROM dbo.${TABLES.migrationState}
    WHERE migration_key = @migrationKey
  `)
  if (markerRows.recordset?.length) return

  const userRouteRows = await new sql.Request(poolOrTx).query(`
    SELECT
      up.username AS username,
      p.route_name AS routeName
    FROM dbo.user_permissions up
    INNER JOIN dbo.permissions p ON p.id = up.permission_id
    WHERE up.username IS NOT NULL
      AND p.route_name IS NOT NULL
  `)
  const userRouteMap = new Map()
  ;(userRouteRows.recordset || []).forEach((row) => {
    const username = normalizePrincipal(row.username)
    const routeName = normalizeText(row.routeName)
    if (!username || !routeName) return
    const set = userRouteMap.get(username) || new Set()
    set.add(routeName)
    userRouteMap.set(username, set)
  })
  for (const [username, routeNames] of userRouteMap.entries()) {
    const capabilityKeys = routeNamesToCapabilityKeys(Array.from(routeNames))
    await insertUserCapabilityKeysWithPool(poolOrTx, username, capabilityKeys)
  }

  const groupRouteRows = await new sql.Request(poolOrTx).query(`
    SELECT
      gp.group_dn AS groupDn,
      gp.group_name AS groupName,
      p.route_name AS routeName
    FROM dbo.group_permissions gp
    INNER JOIN dbo.permissions p ON p.id = gp.permission_id
    WHERE gp.group_dn IS NOT NULL
      AND p.route_name IS NOT NULL
  `)
  const groupRouteMap = new Map()
  ;(groupRouteRows.recordset || []).forEach((row) => {
    const groupDn = normalizeText(row.groupDn)
    const routeName = normalizeText(row.routeName)
    if (!groupDn || !routeName) return
    const current =
      groupRouteMap.get(groupDn) || {
        groupName: normalizeText(row.groupName),
        routeNames: new Set()
      }
    current.routeNames.add(routeName)
    if (!current.groupName) current.groupName = normalizeText(row.groupName)
    groupRouteMap.set(groupDn, current)
  })
  for (const [groupDn, item] of groupRouteMap.entries()) {
    const capabilityKeys = routeNamesToCapabilityKeys(Array.from(item.routeNames))
    await insertGroupCapabilityKeysWithPool(poolOrTx, groupDn, item.groupName, capabilityKeys)
  }

  const insertMarkerReq = new sql.Request(poolOrTx)
  insertMarkerReq.input('migrationKey', sql.NVarChar(120), LEGACY_ROUTE_CAPABILITY_BACKFILL_KEY)
  await insertMarkerReq.query(`
    IF NOT EXISTS (
      SELECT 1 FROM dbo.${TABLES.migrationState} WHERE migration_key = @migrationKey
    )
    BEGIN
      INSERT INTO dbo.${TABLES.migrationState} (migration_key)
      VALUES (@migrationKey)
    END
  `)
}

const ensureCapabilityRuntime = async (poolOrTx) => {
  await ensureCapabilitySchema(poolOrTx)
  await ensureDefaultCapabilities(poolOrTx)
  await ensureLegacyRouteCapabilityBackfill(poolOrTx)
}

const listCapabilities = async ({ includeDisabled = true } = {}) => {
  const pool = await getPool()
  await ensureCapabilityRuntime(pool)
  const req = new sql.Request(pool)
  req.input('includeDisabled', sql.Bit, includeDisabled ? 1 : 0)
  const rows = await req.query(`
    SELECT
      c.capability_key AS capabilityKey,
      c.capability_name AS capabilityName,
      c.module_code AS moduleCode,
      c.module_name AS moduleName,
      c.action_code AS actionCode,
      c.action_name AS actionName,
      c.route_name AS routeName,
      c.enabled AS enabled,
      c.created_at AS createdAt,
      c.updated_at AS updatedAt,
      ISNULL(u.user_count, 0) AS userCount,
      ISNULL(g.group_count, 0) AS groupCount
    FROM dbo.${TABLES.capabilities} c
    OUTER APPLY (
      SELECT COUNT(1) AS user_count
      FROM dbo.${TABLES.userBindings} ub
      WHERE ub.capability_key = c.capability_key
    ) u
    OUTER APPLY (
      SELECT COUNT(1) AS group_count
      FROM dbo.${TABLES.groupBindings} gb
      WHERE gb.capability_key = c.capability_key
    ) g
    WHERE @includeDisabled = 1 OR c.enabled = 1
    ORDER BY c.module_code ASC, c.action_code ASC
  `)
  return rows.recordset || []
}

const getAllCapabilityKeys = async ({ includeDisabled = false } = {}) => {
  const pool = await getPool()
  await ensureCapabilityRuntime(pool)
  const req = new sql.Request(pool)
  req.input('includeDisabled', sql.Bit, includeDisabled ? 1 : 0)
  const rows = await req.query(`
    SELECT capability_key AS capabilityKey
    FROM dbo.${TABLES.capabilities}
    WHERE @includeDisabled = 1 OR enabled = 1
    ORDER BY capability_key ASC
  `)
  return (rows.recordset || []).map((row) => row.capabilityKey)
}

const getUserCapabilityKeys = async (username) => {
  const normalizedUsername = normalizePrincipal(username)
  if (!normalizedUsername) return []
  const pool = await getPool()
  await ensureCapabilityRuntime(pool)
  const req = new sql.Request(pool)
  req.input('username', sql.NVarChar(120), normalizedUsername)
  const rows = await req.query(`
    SELECT ub.capability_key AS capabilityKey
    FROM dbo.${TABLES.userBindings} ub
    INNER JOIN dbo.${TABLES.capabilities} c
      ON c.capability_key = ub.capability_key
    WHERE ub.username = @username
      AND c.enabled = 1
    ORDER BY ub.capability_key ASC
  `)
  return (rows.recordset || []).map((row) => row.capabilityKey)
}

const addUserCapabilityKeys = async (username, capabilityKeys) => {
  const normalizedUsername = normalizePrincipal(username)
  const normalizedKeys = Array.from(
    new Set((capabilityKeys || []).map((x) => normalizeCapabilityKey(x)).filter(Boolean))
  )
  if (!normalizedUsername || !normalizedKeys.length) return
  const pool = await getPool()
  await ensureCapabilityRuntime(pool)
  await insertUserCapabilityKeysWithPool(pool, normalizedUsername, normalizedKeys)
}

const removeUserCapabilityKeys = async (username, capabilityKeys) => {
  const normalizedUsername = normalizePrincipal(username)
  const normalizedKeys = Array.from(
    new Set((capabilityKeys || []).map((x) => normalizeCapabilityKey(x)).filter(Boolean))
  )
  if (!normalizedUsername || !normalizedKeys.length) return
  const pool = await getPool()
  await ensureCapabilityRuntime(pool)
  const req = new sql.Request(pool)
  req.input('username', sql.NVarChar(120), normalizedUsername)
  normalizedKeys.forEach((key, idx) => {
    req.input(`capabilityKey${idx}`, sql.NVarChar(160), key)
  })
  const placeholders = normalizedKeys.map((_, idx) => `@capabilityKey${idx}`).join(',')
  await req.query(`
    DELETE FROM dbo.${TABLES.userBindings}
    WHERE username = @username
      AND capability_key IN (${placeholders})
  `)
}

const getGroupCapabilityKeys = async (groupDn) => {
  const normalizedGroupDn = normalizeText(groupDn)
  if (!normalizedGroupDn) return []
  const pool = await getPool()
  await ensureCapabilityRuntime(pool)
  const req = new sql.Request(pool)
  req.input('groupDn', sql.NVarChar(500), normalizedGroupDn)
  const rows = await req.query(`
    SELECT gb.capability_key AS capabilityKey
    FROM dbo.${TABLES.groupBindings} gb
    INNER JOIN dbo.${TABLES.capabilities} c
      ON c.capability_key = gb.capability_key
    WHERE gb.group_dn = @groupDn
      AND c.enabled = 1
    ORDER BY gb.capability_key ASC
  `)
  return (rows.recordset || []).map((row) => row.capabilityKey)
}

const addGroupCapabilityKeys = async (groupDn, groupName, capabilityKeys) => {
  const normalizedGroupDn = normalizeText(groupDn)
  const normalizedGroupName = normalizeText(groupName)
  const normalizedKeys = Array.from(
    new Set((capabilityKeys || []).map((x) => normalizeCapabilityKey(x)).filter(Boolean))
  )
  if (!normalizedGroupDn || !normalizedKeys.length) return
  const pool = await getPool()
  await ensureCapabilityRuntime(pool)
  await insertGroupCapabilityKeysWithPool(pool, normalizedGroupDn, normalizedGroupName, normalizedKeys)
}

const removeGroupCapabilityKeys = async (groupDn, capabilityKeys) => {
  const normalizedGroupDn = normalizeText(groupDn)
  const normalizedKeys = Array.from(
    new Set((capabilityKeys || []).map((x) => normalizeCapabilityKey(x)).filter(Boolean))
  )
  if (!normalizedGroupDn || !normalizedKeys.length) return
  const pool = await getPool()
  await ensureCapabilityRuntime(pool)
  const req = new sql.Request(pool)
  req.input('groupDn', sql.NVarChar(500), normalizedGroupDn)
  normalizedKeys.forEach((key, idx) => {
    req.input(`capabilityKey${idx}`, sql.NVarChar(160), key)
  })
  const placeholders = normalizedKeys.map((_, idx) => `@capabilityKey${idx}`).join(',')
  await req.query(`
    DELETE FROM dbo.${TABLES.groupBindings}
    WHERE group_dn = @groupDn
      AND capability_key IN (${placeholders})
  `)
}

const getUserGroupCapabilityKeys = async (pureUsername) => {
  const groupDns = await loadUserGroupDns(pureUsername)
  if (!groupDns.length) return []
  const pool = await getPool()
  await ensureCapabilityRuntime(pool)
  const req = new sql.Request(pool)
  groupDns.forEach((dn, idx) => {
    req.input(`groupDn${idx}`, sql.NVarChar(500), dn)
  })
  const placeholders = groupDns.map((_, idx) => `@groupDn${idx}`).join(',')
  const rows = await req.query(`
    SELECT DISTINCT gb.capability_key AS capabilityKey
    FROM dbo.${TABLES.groupBindings} gb
    INNER JOIN dbo.${TABLES.capabilities} c
      ON c.capability_key = gb.capability_key
    WHERE gb.group_dn IN (${placeholders})
      AND c.enabled = 1
  `)
  return (rows.recordset || []).map((row) => row.capabilityKey)
}

const getEffectiveCapabilityKeys = async (username) => {
  const pureUsername = normalizeUsername(username)
  if (!pureUsername) return []
  if (isAdmin(pureUsername)) {
    return getAllCapabilityKeys({ includeDisabled: false })
  }
  const directKeys = await getUserCapabilityKeys(pureUsername)
  const groupKeys = await getUserGroupCapabilityKeys(pureUsername)
  return Array.from(new Set([...directKeys, ...groupKeys]))
}

const hasCapability = async (username, capabilityKey) => {
  const pureUsername = normalizeUsername(username)
  const target = normalizeCapabilityKey(capabilityKey)
  if (!pureUsername || !target) return false
  if (isAdmin(pureUsername)) return true
  const effectiveSet = new Set(await getEffectiveCapabilityKeys(pureUsername))
  return effectiveSet.has(target)
}

module.exports = {
  DEFAULT_CAPABILITIES,
  ensureCapabilitySchema,
  listCapabilities,
  getUserCapabilityKeys,
  addUserCapabilityKeys,
  removeUserCapabilityKeys,
  getGroupCapabilityKeys,
  addGroupCapabilityKeys,
  removeGroupCapabilityKeys,
  getEffectiveCapabilityKeys,
  hasCapability,
  routeNamesToCapabilityKeys
}
