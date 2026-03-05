const { verifyAuthToken } = require('../utils/auth-token')
const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'dev' || !process.env.NODE_ENV

const LEGACY_DEV_TOKENS = new Set([
  'LOCAL_LOGIN',
  'DOMAIN_LOGIN',
  'SSO_AUTO_LOGIN',
  'DEV_AUTO_LOGIN'
])

const resolveAuthorizationHeader = (req) => {
  const header = req.headers?.authorization
  if (Array.isArray(header)) return header[0]
  return header || ''
}

const authenticateRequest = (req, res, next) => {
  try {
    const authHeader = resolveAuthorizationHeader(req)
    const auth = verifyAuthToken(authHeader)

    req.auth = auth

    // 兼容历史代码：旧逻辑大量依赖 X-Username / X-Display-Name
    req.headers['x-username'] = auth.username
    req.headers['x-display-name'] = encodeURIComponent(auth.displayName || auth.username)

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
        req.headers['x-display-name'] = encodeURIComponent(safeUsername)
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
