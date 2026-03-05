const { hasRoutePermission } = require('../services/permissionAccess')

const requireRoutePermission = (routeName) => {
  const targetRoute = String(routeName || '').trim()

  return async (req, res, next) => {
    try {
      const username = String(req?.auth?.username || req?.headers?.['x-username'] || '').trim()
      if (!username) {
        return res.status(401).json({ code: 401, success: false, message: '缺少认证用户信息' })
      }

      const allowed = await hasRoutePermission(username, targetRoute)
      if (!allowed) {
        return res.status(403).json({
          code: 403,
          success: false,
          message: `当前用户无权访问该模块: ${targetRoute}`
        })
      }

      return next()
    } catch (error) {
      return res.status(500).json({
        code: 500,
        success: false,
        message: '权限校验失败: ' + (error?.message || '未知错误')
      })
    }
  }
}

module.exports = {
  requireRoutePermission
}
