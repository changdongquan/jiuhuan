const crypto = require('crypto')

const TOKEN_SECRET =
  process.env.AUTH_TOKEN_SECRET || process.env.JWT_SECRET || 'jiuhuan-dev-insecure-secret-change-me'

const DEFAULT_EXPIRES_IN_SECONDS = Number.parseInt(
  process.env.AUTH_TOKEN_EXPIRES_IN_SECONDS || '0',
  10
)

const toBase64Url = (input) => Buffer.from(input).toString('base64url')
const fromBase64Url = (input) => Buffer.from(String(input || ''), 'base64url').toString('utf8')

const sign = (payloadBase64) => {
  return crypto.createHmac('sha256', TOKEN_SECRET).update(payloadBase64).digest('base64url')
}

const normalizeUsername = (value) => {
  const s = String(value || '').trim()
  if (!s) return ''
  return s
}

const issueAuthToken = ({ username, displayName, role, roleId, domain }) => {
  const now = Math.floor(Date.now() / 1000)
  const expiresIn = Number.isFinite(DEFAULT_EXPIRES_IN_SECONDS) ? DEFAULT_EXPIRES_IN_SECONDS : 0
  const payload = {
    sub: normalizeUsername(username),
    displayName: String(displayName || '').trim(),
    role: String(role || '').trim(),
    roleId: String(roleId || '').trim(),
    domain: domain ? String(domain).trim() : null,
    iat: now
  }
  if (expiresIn > 0) {
    payload.exp = now + expiresIn
  }

  const payloadBase64 = toBase64Url(JSON.stringify(payload))
  const signature = sign(payloadBase64)
  return `JH.${payloadBase64}.${signature}`
}

const parseAuthorization = (headerValue) => {
  const raw = String(headerValue || '').trim()
  if (!raw) return ''
  if (/^Bearer\s+/i.test(raw)) {
    return raw.replace(/^Bearer\s+/i, '').trim()
  }
  return raw
}

const verifyAuthToken = (tokenLike) => {
  const token = parseAuthorization(tokenLike)
  if (!token) {
    const e = new Error('缺少认证凭据')
    e.statusCode = 401
    throw e
  }

  const parts = token.split('.')
  if (parts.length !== 3 || parts[0] !== 'JH') {
    const e = new Error('认证凭据格式无效')
    e.statusCode = 401
    throw e
  }

  const payloadBase64 = parts[1]
  const signature = parts[2]
  const expected = sign(payloadBase64)

  if (signature !== expected) {
    const e = new Error('认证凭据签名无效')
    e.statusCode = 401
    throw e
  }

  let payload = null
  try {
    payload = JSON.parse(fromBase64Url(payloadBase64))
  } catch (_e) {
    const e = new Error('认证凭据解析失败')
    e.statusCode = 401
    throw e
  }

  const now = Math.floor(Date.now() / 1000)
  if (!payload?.sub || typeof payload.sub !== 'string') {
    const e = new Error('认证凭据缺少用户信息')
    e.statusCode = 401
    throw e
  }
  if (Number(payload.exp || 0) > 0 && Number(payload.exp || 0) <= now) {
    const e = new Error('登录已过期，请重新登录')
    e.statusCode = 401
    throw e
  }

  return {
    username: normalizeUsername(payload.sub),
    displayName: String(payload.displayName || '').trim(),
    role: String(payload.role || '').trim(),
    roleId: String(payload.roleId || '').trim(),
    domain: payload.domain ? String(payload.domain).trim() : null,
    exp: Number(payload.exp || 0),
    iat: Number(payload.iat || 0),
    rawToken: token
  }
}

module.exports = {
  issueAuthToken,
  verifyAuthToken,
  parseAuthorization
}
