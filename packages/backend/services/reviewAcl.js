const sql = require('mssql')
const { getPool } = require('../database')

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
  actions: 'review_actions',
  userBindings: 'review_action_user_bindings',
  groupBindings: 'review_action_group_bindings'
}

const DEFAULT_REVIEW_ACTIONS = [
  {
    actionKey: 'BMO_INITIATION.REVIEW',
    actionName: 'BMO立项审核',
    moduleCode: 'BMO_INITIATION'
  },
  {
    actionKey: 'HARD_DELETE.REVIEW',
    actionName: '硬删除审核',
    moduleCode: 'HARD_DELETE'
  }
]

const normalizeText = (value) => String(value || '').trim()
const normalizePrincipal = (value) => normalizeText(value).toLowerCase()
const isDevEnv =
  process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'dev' || !process.env.NODE_ENV

const extractSamCandidates = (rawUsername) => {
  const raw = normalizeText(rawUsername)
  if (!raw) return []
  const candidates = [raw]
  if (raw.includes('\\')) {
    candidates.push(raw.slice(raw.lastIndexOf('\\') + 1))
  }
  if (raw.includes('@')) {
    candidates.push(raw.split('@')[0])
  }
  return Array.from(new Set(candidates.map(normalizePrincipal).filter(Boolean)))
}

const getReqUsernameCandidates = (req) => {
  const usernameRaw = req?.headers?.['x-username']
  const username = Array.isArray(usernameRaw) ? usernameRaw[0] : usernameRaw
  return extractSamCandidates(username)
}

const parseLegacyWhitelist = (envName) => {
  const raw = normalizeText(process.env[envName] || '')
  if (!raw) return []
  return raw
    .split(',')
    .map((x) => normalizePrincipal(x))
    .filter(Boolean)
}

const ensureTables = async (poolOrTx) => {
  const req = new sql.Request(poolOrTx)
  await req.batch(`
    IF OBJECT_ID(N'dbo.${TABLES.actions}', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.${TABLES.actions} (
        action_key NVARCHAR(120) NOT NULL PRIMARY KEY,
        action_name NVARCHAR(200) NOT NULL,
        module_code NVARCHAR(80) NOT NULL,
        enabled BIT NOT NULL CONSTRAINT DF_review_actions_enabled DEFAULT (1),
        created_at DATETIME2 NOT NULL CONSTRAINT DF_review_actions_created_at DEFAULT (SYSDATETIME()),
        updated_at DATETIME2 NOT NULL CONSTRAINT DF_review_actions_updated_at DEFAULT (SYSDATETIME())
      );
      CREATE INDEX IX_review_actions_module_code ON dbo.${TABLES.actions}(module_code);
    END

    IF OBJECT_ID(N'dbo.${TABLES.userBindings}', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.${TABLES.userBindings} (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        action_key NVARCHAR(120) NOT NULL,
        username NVARCHAR(120) NOT NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_review_action_user_bindings_created_at DEFAULT (SYSDATETIME()),
        CONSTRAINT FK_review_action_user_bindings_action
          FOREIGN KEY (action_key) REFERENCES dbo.${TABLES.actions}(action_key) ON DELETE CASCADE,
        CONSTRAINT UQ_review_action_user_bindings UNIQUE(action_key, username)
      );
      CREATE INDEX IX_review_action_user_bindings_username
        ON dbo.${TABLES.userBindings}(username);
    END

    IF OBJECT_ID(N'dbo.${TABLES.groupBindings}', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.${TABLES.groupBindings} (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        action_key NVARCHAR(120) NOT NULL,
        group_dn NVARCHAR(500) NOT NULL,
        group_name NVARCHAR(200) NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_review_action_group_bindings_created_at DEFAULT (SYSDATETIME()),
        CONSTRAINT FK_review_action_group_bindings_action
          FOREIGN KEY (action_key) REFERENCES dbo.${TABLES.actions}(action_key) ON DELETE CASCADE,
        CONSTRAINT UQ_review_action_group_bindings UNIQUE(action_key, group_dn)
      );
      CREATE INDEX IX_review_action_group_bindings_group_dn
        ON dbo.${TABLES.groupBindings}(group_dn);
    END
  `)
}

const ensureDefaultActions = async (poolOrTx) => {
  await Promise.all(
    DEFAULT_REVIEW_ACTIONS.map(async (item) => {
      const req = new sql.Request(poolOrTx)
      req.input('actionKey', sql.NVarChar(120), item.actionKey)
      req.input('actionName', sql.NVarChar(200), item.actionName)
      req.input('moduleCode', sql.NVarChar(80), item.moduleCode)
      await req.query(`
        MERGE dbo.${TABLES.actions} AS target
        USING (SELECT @actionKey AS action_key) AS src
        ON target.action_key = src.action_key
        WHEN MATCHED THEN
          UPDATE SET
            action_name = COALESCE(NULLIF(target.action_name, N''), @actionName),
            module_code = COALESCE(NULLIF(target.module_code, N''), @moduleCode),
            updated_at = SYSDATETIME()
        WHEN NOT MATCHED THEN
          INSERT (action_key, action_name, module_code, enabled)
          VALUES (@actionKey, @actionName, @moduleCode, 1);
      `)
    })
  )
}

const ensureReviewAclSchema = async (poolOrTx) => {
  await ensureTables(poolOrTx)
  await ensureDefaultActions(poolOrTx)
}

const listReviewActions = async ({ includeDisabled = true } = {}) => {
  const pool = await getPool()
  await ensureReviewAclSchema(pool)
  const req = new sql.Request(pool)
  const whereSql = includeDisabled ? '' : 'WHERE a.enabled = 1'
  const rows = await req.query(`
    SELECT
      a.action_key AS actionKey,
      a.action_name AS actionName,
      a.module_code AS moduleCode,
      a.enabled AS enabled,
      a.created_at AS createdAt,
      a.updated_at AS updatedAt,
      ISNULL(u.user_count, 0) AS userCount,
      ISNULL(g.group_count, 0) AS groupCount
    FROM dbo.${TABLES.actions} a
    OUTER APPLY (
      SELECT COUNT(1) AS user_count
      FROM dbo.${TABLES.userBindings} ub
      WHERE ub.action_key = a.action_key
    ) u
    OUTER APPLY (
      SELECT COUNT(1) AS group_count
      FROM dbo.${TABLES.groupBindings} gb
      WHERE gb.action_key = a.action_key
    ) g
    ${whereSql}
    ORDER BY a.module_code ASC, a.action_name ASC
  `)
  return rows.recordset || []
}

const upsertReviewAction = async ({ actionKey, actionName, moduleCode, enabled = true }) => {
  const key = normalizeText(actionKey).toUpperCase()
  const name = normalizeText(actionName)
  const module = normalizeText(moduleCode).toUpperCase()
  if (!key || !name || !module) {
    throw new Error('actionKey/actionName/moduleCode 不能为空')
  }
  const pool = await getPool()
  await ensureReviewAclSchema(pool)
  const req = new sql.Request(pool)
  req.input('actionKey', sql.NVarChar(120), key)
  req.input('actionName', sql.NVarChar(200), name)
  req.input('moduleCode', sql.NVarChar(80), module)
  req.input('enabled', sql.Bit, enabled ? 1 : 0)
  await req.query(`
    MERGE dbo.${TABLES.actions} AS target
    USING (SELECT @actionKey AS action_key) AS src
    ON target.action_key = src.action_key
    WHEN MATCHED THEN
      UPDATE SET
        action_name = @actionName,
        module_code = @moduleCode,
        enabled = @enabled,
        updated_at = SYSDATETIME()
    WHEN NOT MATCHED THEN
      INSERT (action_key, action_name, module_code, enabled)
      VALUES (@actionKey, @actionName, @moduleCode, @enabled);
  `)
}

const getUserActionKeys = async (username) => {
  const normalizedUsername = normalizePrincipal(username)
  if (!normalizedUsername) return []
  const pool = await getPool()
  await ensureReviewAclSchema(pool)
  const req = new sql.Request(pool)
  req.input('username', sql.NVarChar(120), normalizedUsername)
  const rows = await req.query(`
    SELECT ub.action_key AS actionKey
    FROM dbo.${TABLES.userBindings} ub
    WHERE ub.username = @username
    ORDER BY ub.action_key ASC
  `)
  return (rows.recordset || []).map((r) => r.actionKey)
}

const addUserActionKeys = async (username, actionKeys) => {
  const normalizedUsername = normalizePrincipal(username)
  const normalizedKeys = Array.from(
    new Set((actionKeys || []).map((x) => normalizeText(x).toUpperCase()).filter(Boolean))
  )
  if (!normalizedUsername || !normalizedKeys.length) return
  const pool = await getPool()
  await ensureReviewAclSchema(pool)
  await Promise.all(
    normalizedKeys.map(async (actionKey) => {
      const req = new sql.Request(pool)
      req.input('actionKey', sql.NVarChar(120), actionKey)
      req.input('username', sql.NVarChar(120), normalizedUsername)
      await req.query(`
        IF EXISTS (SELECT 1 FROM dbo.${TABLES.actions} WHERE action_key = @actionKey)
        AND NOT EXISTS (
          SELECT 1
          FROM dbo.${TABLES.userBindings}
          WHERE action_key = @actionKey AND username = @username
        )
        BEGIN
          INSERT INTO dbo.${TABLES.userBindings} (action_key, username)
          VALUES (@actionKey, @username)
        END
      `)
    })
  )
}

const removeUserActionKeys = async (username, actionKeys) => {
  const normalizedUsername = normalizePrincipal(username)
  const normalizedKeys = Array.from(
    new Set((actionKeys || []).map((x) => normalizeText(x).toUpperCase()).filter(Boolean))
  )
  if (!normalizedUsername || !normalizedKeys.length) return
  const pool = await getPool()
  await ensureReviewAclSchema(pool)
  const req = new sql.Request(pool)
  req.input('username', sql.NVarChar(120), normalizedUsername)
  normalizedKeys.forEach((key, idx) => {
    req.input(`actionKey${idx}`, sql.NVarChar(120), key)
  })
  const placeholders = normalizedKeys.map((_, idx) => `@actionKey${idx}`).join(',')
  await req.query(`
    DELETE FROM dbo.${TABLES.userBindings}
    WHERE username = @username
      AND action_key IN (${placeholders})
  `)
}

const getGroupActionKeys = async (groupDn) => {
  const normalizedGroupDn = normalizeText(groupDn)
  if (!normalizedGroupDn) return []
  const pool = await getPool()
  await ensureReviewAclSchema(pool)
  const req = new sql.Request(pool)
  req.input('groupDn', sql.NVarChar(500), normalizedGroupDn)
  const rows = await req.query(`
    SELECT gb.action_key AS actionKey
    FROM dbo.${TABLES.groupBindings} gb
    WHERE gb.group_dn = @groupDn
    ORDER BY gb.action_key ASC
  `)
  return (rows.recordset || []).map((r) => r.actionKey)
}

const addGroupActionKeys = async (groupDn, groupName, actionKeys) => {
  const normalizedGroupDn = normalizeText(groupDn)
  const normalizedGroupName = normalizeText(groupName)
  const normalizedKeys = Array.from(
    new Set((actionKeys || []).map((x) => normalizeText(x).toUpperCase()).filter(Boolean))
  )
  if (!normalizedGroupDn || !normalizedKeys.length) return
  const pool = await getPool()
  await ensureReviewAclSchema(pool)
  await Promise.all(
    normalizedKeys.map(async (actionKey) => {
      const req = new sql.Request(pool)
      req.input('actionKey', sql.NVarChar(120), actionKey)
      req.input('groupDn', sql.NVarChar(500), normalizedGroupDn)
      req.input('groupName', sql.NVarChar(200), normalizedGroupName || null)
      await req.query(`
        IF EXISTS (SELECT 1 FROM dbo.${TABLES.actions} WHERE action_key = @actionKey)
        AND NOT EXISTS (
          SELECT 1
          FROM dbo.${TABLES.groupBindings}
          WHERE action_key = @actionKey AND group_dn = @groupDn
        )
        BEGIN
          INSERT INTO dbo.${TABLES.groupBindings} (action_key, group_dn, group_name)
          VALUES (@actionKey, @groupDn, @groupName)
        END
      `)
    })
  )
}

const removeGroupActionKeys = async (groupDn, actionKeys) => {
  const normalizedGroupDn = normalizeText(groupDn)
  const normalizedKeys = Array.from(
    new Set((actionKeys || []).map((x) => normalizeText(x).toUpperCase()).filter(Boolean))
  )
  if (!normalizedGroupDn || !normalizedKeys.length) return
  const pool = await getPool()
  await ensureReviewAclSchema(pool)
  const req = new sql.Request(pool)
  req.input('groupDn', sql.NVarChar(500), normalizedGroupDn)
  normalizedKeys.forEach((key, idx) => {
    req.input(`actionKey${idx}`, sql.NVarChar(120), key)
  })
  const placeholders = normalizedKeys.map((_, idx) => `@actionKey${idx}`).join(',')
  await req.query(`
    DELETE FROM dbo.${TABLES.groupBindings}
    WHERE group_dn = @groupDn
      AND action_key IN (${placeholders})
  `)
}

function ldapSearch(client, baseDN, filter, attributes = []) {
  return new Promise((resolve, reject) => {
    const entries = []
    client.search(
      baseDN,
      { filter, scope: 'sub', attributes, sizeLimit: 200, timeLimit: 8 },
      (err, resp) => {
        if (err) return reject(err)
        resp.on('searchEntry', (entry) => {
          const obj = entry?.object || {}
          entries.push(obj)
        })
        resp.on('error', reject)
        resp.on('end', () => resolve(entries))
      }
    )
  })
}

async function createLdapClient() {
  if (!ldap) return null
  const client = ldap.createClient({ url: LDAP_CONFIG.url })
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
  return client
}

const loadGroupDnsByReq = async (req) => {
  const usernameCandidates = getReqUsernameCandidates(req)
  if (!usernameCandidates.length) return []
  if (!ldap) return []

  let client = null
  try {
    client = await createLdapClient()
    if (!client) return []
    const escapedUsername = usernameCandidates[0].replace(/[\\()*\0/]/g, '')
    const userEntries = await ldapSearch(
      client,
      LDAP_CONFIG.baseDN,
      `(sAMAccountName=${escapedUsername})`,
      ['memberOf']
    )
    const memberOf = userEntries?.[0]?.memberOf
    const list = Array.isArray(memberOf) ? memberOf : memberOf ? [memberOf] : []
    return Array.from(new Set(list.map((x) => normalizeText(x)).filter(Boolean)))
  } catch (_e) {
    return []
  } finally {
    if (client) {
      try {
        client.unbind(() => {})
      } catch (_e) {}
    }
  }
}

const decideReviewAccess = async ({ req, actionKey, resolveActorFromReq }) => {
  const normalizedActionKey = normalizeText(actionKey).toUpperCase()
  if (!normalizedActionKey) return { mode: 'allow', allowed: true }

  const pool = await getPool()
  await ensureReviewAclSchema(pool)

  const actionReq = new sql.Request(pool)
  actionReq.input('actionKey', sql.NVarChar(120), normalizedActionKey)
  const actionResult = await actionReq.query(`
    SELECT TOP 1 action_key AS actionKey, enabled
    FROM dbo.${TABLES.actions}
    WHERE action_key = @actionKey
  `)
  const actionRow = actionResult.recordset?.[0]
  if (!actionRow || actionRow.enabled === false || actionRow.enabled === 0) {
    return { mode: 'fallback', allowed: false }
  }

  const countReq = new sql.Request(pool)
  countReq.input('actionKey', sql.NVarChar(120), normalizedActionKey)
  const countResult = await countReq.query(`
    SELECT
      (SELECT COUNT(1) FROM dbo.${TABLES.userBindings} WHERE action_key = @actionKey) AS userCount,
      (SELECT COUNT(1) FROM dbo.${TABLES.groupBindings} WHERE action_key = @actionKey) AS groupCount
  `)
  const userCount = Number(countResult.recordset?.[0]?.userCount || 0)
  const groupCount = Number(countResult.recordset?.[0]?.groupCount || 0)
  if (!userCount && !groupCount) {
    return { mode: 'fallback', allowed: false }
  }

  const actor = normalizePrincipal(resolveActorFromReq(req))
  const usernameCandidates = getReqUsernameCandidates(req)
  const principalCandidates = Array.from(new Set([actor, ...usernameCandidates].filter(Boolean)))
  if (!principalCandidates.length) return { mode: 'db', allowed: false }

  if (userCount > 0) {
    const userReq = new sql.Request(pool)
    userReq.input('actionKey', sql.NVarChar(120), normalizedActionKey)
    principalCandidates.forEach((name, idx) => userReq.input(`name${idx}`, sql.NVarChar(120), name))
    const placeholders = principalCandidates.map((_, idx) => `@name${idx}`).join(',')
    const userMatch = await userReq.query(`
      SELECT TOP 1 1 AS ok
      FROM dbo.${TABLES.userBindings}
      WHERE action_key = @actionKey
        AND username IN (${placeholders})
    `)
    if (userMatch.recordset?.[0]?.ok) return { mode: 'db', allowed: true }
  }

  if (groupCount > 0) {
    const groups = await loadGroupDnsByReq(req)
    if (groups.length) {
      const groupReq = new sql.Request(pool)
      groupReq.input('actionKey', sql.NVarChar(120), normalizedActionKey)
      groups.forEach((dn, idx) => groupReq.input(`groupDn${idx}`, sql.NVarChar(500), dn))
      const placeholders = groups.map((_, idx) => `@groupDn${idx}`).join(',')
      const groupMatch = await groupReq.query(`
        SELECT TOP 1 1 AS ok
        FROM dbo.${TABLES.groupBindings}
        WHERE action_key = @actionKey
          AND group_dn IN (${placeholders})
      `)
      if (groupMatch.recordset?.[0]?.ok) return { mode: 'db', allowed: true }
    }
  }

  return { mode: 'db', allowed: false }
}

const assertReviewPermission = async ({
  req,
  actionKey,
  resolveActorFromReq,
  legacyEnvName = '',
  legacyAllowWhenEmpty = true
}) => {
  // 超级管理员兜底：admin 账号始终允许审核。
  const actor = normalizePrincipal(resolveActorFromReq(req))
  const usernameCandidates = getReqUsernameCandidates(req)
  if (actor === 'admin' || usernameCandidates.includes('admin')) return
  // 开发环境兜底：dev-user 默认允许审核，避免本机调试被 ACL 阻塞。
  if (isDevEnv && (actor === 'dev-user' || usernameCandidates.includes('dev-user'))) return

  let dbDecision = null
  try {
    dbDecision = await decideReviewAccess({ req, actionKey, resolveActorFromReq })
  } catch (_e) {
    dbDecision = { mode: 'fallback', allowed: false }
  }

  if (dbDecision?.mode === 'db') {
    if (dbDecision.allowed) return
    const e = new Error('当前用户没有审核权限')
    e.statusCode = 403
    throw e
  }

  if (!legacyEnvName) {
    if (legacyAllowWhenEmpty) return
    const e = new Error('当前用户没有审核权限')
    e.statusCode = 403
    throw e
  }

  const whitelist = parseLegacyWhitelist(legacyEnvName)
  if (!whitelist.length && legacyAllowWhenEmpty) return

  const principals = Array.from(new Set([actor, ...usernameCandidates].filter(Boolean)))
  if (principals.some((x) => whitelist.includes(x))) return

  const e = new Error('当前用户没有审核权限')
  e.statusCode = 403
  throw e
}

module.exports = {
  DEFAULT_REVIEW_ACTIONS,
  ensureReviewAclSchema,
  listReviewActions,
  upsertReviewAction,
  getUserActionKeys,
  addUserActionKeys,
  removeUserActionKeys,
  getGroupActionKeys,
  addGroupActionKeys,
  removeGroupActionKeys,
  assertReviewPermission
}
