const { verifyAuthToken } = require('../utils/auth-token')
const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'dev' || !process.env.NODE_ENV

const LEGACY_DEV_TOKENS = new Set([
  'LOCAL_LOGIN',
  'DOMAIN_LOGIN',
  'SSO_AUTO_LOGIN',
  'DEV_AUTO_LOGIN'
])

const INTERNAL_TOKEN_ALLOWLIST = new Set([
  '/api/bmo/relay/persist-mould',
  '/api/bmo/relay/sync-status',
  '/api/bmo/relay/sync/run'
])

const resolveAuthorizationHeader = (req) => {
  const header = req.headers?.authorization
  if (Array.isArray(header)) return header[0]
  return header || ''
}

const resolveDisplayHeader = (value) => {
  const raw = Array.isArray(value) ? value[0] : value
  return String(raw || '').trim()
}

const resolveInternalTokenHeader = (req) => {
  const header = req.headers?.['x-internal-token']
  if (Array.isArray(header)) return header[0]
  return header || ''
}

const shouldAllowInternalToken = (req) => {
  const expected = String(process.env.BMO_RELAY_SYNC_TOKEN || '').trim()
  if (!expected) return false
  const requestPath = String(req.originalUrl || req.path || '').trim()
  if (!INTERNAL_TOKEN_ALLOWLIST.has(requestPath)) return false
  const incoming = String(resolveInternalTokenHeader(req) || '').trim()
  return Boolean(incoming) && incoming === expected
}

const authenticateRequest = (req, res, next) => {
  if (shouldAllowInternalToken(req)) {
    req.auth = {
      username: 'relay-sync',
      displayName: 'relay-sync',
      role: 'system',
      roleId: 'relay-sync',
      domain: 'INTERNAL',
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000)
    }
    req.headers['x-username'] = 'relay-sync'
    req.headers['x-display-name'] = 'relay-sync'
    return next()
  }
  try {
    const authHeader = resolveAuthorizationHeader(req)
    const auth = verifyAuthToken(authHeader)

    req.auth = auth

    // 兼容历史代码：旧逻辑大量依赖 X-Username / X-Display-Name
    req.headers['x-username'] = auth.username
    const incomingDisplay = resolveDisplayHeader(req.headers?.['x-display-name'])
    req.headers['x-display-name'] = incomingDisplay || encodeURIComponent(auth.displayName || auth.username)

    return next()
  } catch (error) {
    // 兼容历史开发 token，避免本地已持久化旧登录态导致全站 401
    if (isDev) {
      const authHeader = String(resolveAuthorizationHeader(req) || '').trim()
      const legacyRaw = authHeader.replace(/^Bearer\s+/i, '').trim()
      const usernameHeader = req.headers?.['x-username']
      const usernameFromHeader = String(
        Array.isArray(usernameHeader) ? usernameHeader[0] : usernameHeader || ''
      ).trim()

      if (LEGACY_DEV_TOKENS.has(legacyRaw) || (!legacyRaw && usernameFromHeader)) {
        const safeUsername = usernameFromHeader || 'dev-user'
        req.auth = {
          username: safeUsername,
          displayName: safeUsername,
          role: safeUsername.toLowerCase() === 'admin' ? 'admin' : 'dev',
          roleId: safeUsername.toLowerCase() === 'admin' ? '1' : '2',
          domain: 'DEV',
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
          rawToken: legacyRaw
        }
        req.headers['x-username'] = safeUsername
        const incomingDisplay = resolveDisplayHeader(req.headers?.['x-display-name'])
        req.headers['x-display-name'] = incomingDisplay || encodeURIComponent(safeUsername)
        return next()
      }
    }

    const statusCode = Number(error?.statusCode || 401)
    return res.status(statusCode).json({
      code: statusCode,
      success: false,
      message: error?.message || '认证失败'
    })
  }
}

const requireAdmin = (req, res, next) => {
  const username = String(req?.auth?.username || req?.headers?.['x-username'] || '')
    .trim()
    .toLowerCase()
  if (username === 'admin' || (isDev && username === 'dev-user')) return next()
  return res.status(403).json({
    code: 403,
    success: false,
    message: '仅管理员可执行该操作'
  })
}

module.exports = {
  authenticateRequest,
  requireAdmin
}
