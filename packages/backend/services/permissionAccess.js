const { query } = require('../database')
const { resolvePermissionCandidates, expandPermissionNames } = require('./permission-aliases')

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

const normalizeUsername = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  return raw.split('\\').pop().split('@')[0].trim()
}

const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'dev' || !process.env.NODE_ENV

const isAdmin = (username) => {
  const normalized = normalizeUsername(username).toLowerCase()
  if (normalized === 'admin') return true
  if (isDev && normalized === 'dev-user') return true
  return false
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

const loadUserGroupDns = async (pureUsername) => {
  if (!ldap || !pureUsername) return []

  const client = ldap.createClient({ url: LDAP_CONFIG.url })
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
    return Array.from(new Set(list.map((x) => String(x || '').trim()).filter(Boolean)))
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

const getAllPermissionNames = async () => {
  const rows = await query('SELECT route_name FROM permissions')
  return (rows || []).map((x) => x.route_name).filter(Boolean)
}

const getUserDirectPermissionNames = async (pureUsername) => {
  const rows = await query(
    `
      SELECT DISTINCT p.route_name
      FROM permissions p
      INNER JOIN user_permissions up ON p.id = up.permission_id
      WHERE up.username = @username
    `,
    { username: pureUsername }
  )
  return (rows || []).map((x) => x.route_name).filter(Boolean)
}

const getUserGroupPermissionNames = async (pureUsername) => {
  const groupDns = await loadUserGroupDns(pureUsername)
  if (!groupDns.length) return []

  const params = {}
  const placeholders = groupDns
    .map((dn, i) => {
      const key = `groupDn${i}`
      params[key] = dn
      return `@${key}`
    })
    .join(',')

  const rows = await query(
    `
      SELECT DISTINCT p.route_name
      FROM permissions p
      INNER JOIN group_permissions gp ON p.id = gp.permission_id
      WHERE gp.group_dn IN (${placeholders})
    `,
    params
  )
  return (rows || []).map((x) => x.route_name).filter(Boolean)
}

const getEffectivePermissions = async (username) => {
  const pureUsername = normalizeUsername(username)
  if (!pureUsername) return []
  if (isAdmin(pureUsername)) {
    const all = await getAllPermissionNames()
    return expandPermissionNames(all)
  }

  const direct = await getUserDirectPermissionNames(pureUsername)
  const group = await getUserGroupPermissionNames(pureUsername)
  return expandPermissionNames([...direct, ...group])
}

const hasRoutePermission = async (username, routeName) => {
  const pureUsername = normalizeUsername(username)
  const target = String(routeName || '').trim()
  if (!pureUsername || !target) return false
  if (isAdmin(pureUsername)) return true

  const candidates = resolvePermissionCandidates(target)
  const params = {}
  const placeholders = candidates
    .map((name, i) => {
      const key = `routeName${i}`
      params[key] = name
      return `@${key}`
    })
    .join(',')
  const rows = await query(
    `SELECT TOP 1 id FROM permissions WHERE route_name IN (${placeholders})`,
    params
  )
  if (!rows?.length) return false

  const permissionSet = new Set(await getEffectivePermissions(pureUsername))
  return candidates.some((name) => permissionSet.has(name))
}

module.exports = {
  normalizeUsername,
  isAdmin,
  getEffectivePermissions,
  hasRoutePermission
}
