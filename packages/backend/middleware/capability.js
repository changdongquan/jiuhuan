const { hasCapability } = require('../services/capabilityAccess')
const { hasRoutePermission } = require('../services/permissionAccess')

const requireCapability = (capabilityKey, options = {}) => {
  const targetCapability = String(capabilityKey || '').trim().toUpperCase()
  const fallbackRoute = String(options.fallbackRoute || '').trim()

  return async (req, res, next) => {
    try {
      const username = String(req?.auth?.username || req?.headers?.['x-username'] || '').trim()
      if (!username) {
        return res.status(401).json({ code: 401, success: false, message: '缺少认证用户信息' })
      }

      if (targetCapability) {
        const allowedByCapability = await hasCapability(username, targetCapability)
        if (allowedByCapability) return next()
      }

      if (fallbackRoute) {
        const allowedByRoute = await hasRoutePermission(username, fallbackRoute)
        if (allowedByRoute) return next()
      }

      return res.status(403).json({
        code: 403,
        success: false,
        message: `当前用户无权访问该能力: ${targetCapability || fallbackRoute || 'UNKNOWN'}`
      })
    } catch (error) {
      return res.status(500).json({
        code: 500,
        success: false,
        message: '能力权限校验失败: ' + (error?.message || '未知错误')
      })
    }
  }
}

module.exports = {
  requireCapability
}

