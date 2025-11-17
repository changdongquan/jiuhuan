import router from './router'
import { useAppStoreWithOut } from '@/store/modules/app'
import type { RouteRecordRaw } from 'vue-router'
import { useTitle } from '@/hooks/web/useTitle'
import { useNProgress } from '@/hooks/web/useNProgress'
import { usePermissionStoreWithOut } from '@/store/modules/permission'
import { usePageLoading } from '@/hooks/web/usePageLoading'
import { NO_REDIRECT_WHITE_LIST } from '@/constants'
import { useUserStoreWithOut } from '@/store/modules/user'

const { start, done } = useNProgress()

const { loadStart, loadDone } = usePageLoading()

// 开发模式下保持“权限为空时放行”，方便调试；
// 生产构建（如 pro 模式）启用严格权限控制。
const isDev = import.meta.env.DEV

interface AutoLoginResponseData {
  username: string
  displayName: string
  domain?: string | null
  roles: string[]
  role: string
  roleId: string
}

interface AutoLoginResponse {
  code: number
  success: boolean
  data?: AutoLoginResponseData
  token?: string
  ssoFailed?: boolean
}

const autoLoginByIframe = (timeoutMs = 5000): Promise<AutoLoginResponse | null> => {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve(null)
      return
    }

    const iframe = document.createElement('iframe')
    iframe.style.display = 'none'
    iframe.src = '/api/auth/auto-login'

    let finished = false

    const cleanup = () => {
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe)
      }
    }

    const finish = (res: AutoLoginResponse | null) => {
      if (finished) return
      finished = true
      cleanup()
      resolve(res)
    }

    const timer = window.setTimeout(() => {
      finish(null)
    }, timeoutMs)

    iframe.onload = () => {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document || null
        const body = doc?.body
        const text = body?.innerText || body?.textContent || ''
        if (!text) {
          window.clearTimeout(timer)
          finish(null)
          return
        }
        const parsed = JSON.parse(text) as AutoLoginResponse
        window.clearTimeout(timer)
        finish(parsed)
      } catch {
        window.clearTimeout(timer)
        finish(null)
      }
    }

    iframe.onerror = () => {
      window.clearTimeout(timer)
      finish(null)
    }

    document.body.appendChild(iframe)
  })
}

router.beforeEach(async (to, from, next) => {
  start()
  loadStart()
  const permissionStore = usePermissionStoreWithOut()
  const appStore = useAppStoreWithOut()
  const userStore = useUserStoreWithOut()
  if (userStore.getUserInfo) {
    if (to.path === '/login') {
      next({ path: '/' })
    } else {
      // 权限验证：检查用户是否有权限访问目标页面
      const userInfo = userStore.getUserInfo
      const userPermissions = (userInfo as any).permissions || []
      const isAdmin = userInfo?.username === 'admin'

      // 排除不需要权限验证的路由（如 404、403、个人中心、首页重定向等）
      const noAuthRoutes = [
        '404',
        '403',
        'NoFind',
        'PersonalCenter',
        'Redirect',
        'Root', // 首页路由
        'RedirectWrap', // 重定向包装路由
        'Analysis', // 仪表盘分析页（首页默认跳转）
        'Workplace', // 仪表盘工作台
        'Dashboard' // 仪表盘父路由
      ]

      // admin 拥有所有权限，直接通过；白名单路由直接通过
      if (isAdmin || noAuthRoutes.includes(to.name as string)) {
        // 允许访问，继续后续流程
      } else if (to.name) {
        // 其他用户需要检查权限
        if (userPermissions.length === 0) {
          if (isDev) {
            // 开发模式：为方便调试，权限列表为空时暂时放行
            console.warn('[权限][DEV] 用户权限列表为空，允许访问:', to.name)
          } else {
            // 生产严格模式：权限列表为空视为无任何权限，除白名单外全部拒绝
            console.warn('[权限] 用户无任何页面权限，拒绝访问:', to.name)
            next('/403')
            return
          }
        } else if (!userPermissions.includes(to.name)) {
          // 有权限列表，但当前路由不在权限列表中，拒绝访问
          console.warn('[权限] 用户无权限访问:', { route: to.name, permissions: userPermissions })
          next('/403')
          return
        }
      }

      if (permissionStore.getIsAddRouters) {
        next()
        return
      }

      // 根据用户权限生成可访问的菜单/路由
      const roleRouters = userStore.getRoleRouters || []

      if (appStore.getDynamicRouter && roleRouters.length > 0) {
        // 动态路由模式（目前未启用），保留原有逻辑
        appStore.serverDynamicRouter
          ? await permissionStore.generateRoutes('server', roleRouters as AppCustomRouteRecordRaw[])
          : await permissionStore.generateRoutes('frontEnd', roleRouters as string[])
      } else {
        // 静态路由模式：admin 使用完整路由；普通用户按权限过滤菜单
        if (isAdmin) {
          await permissionStore.generateRoutes('static')
        } else {
          await permissionStore.generateRoutes('frontEnd', userPermissions as string[])
        }
      }

      permissionStore.getAddRouters.forEach((route) => {
        router.addRoute(route as unknown as RouteRecordRaw) // 动态添加可访问路由表
      })
      const redirectPath = from.query.redirect || to.path
      const redirect = decodeURIComponent(redirectPath as string)
      const nextData = to.path === redirect ? { ...to, replace: true } : { path: redirect }
      permissionStore.setIsAddRouters(true)
      next(nextData)
    }
  } else {
    if (NO_REDIRECT_WHITE_LIST.indexOf(to.path) !== -1) {
      next()
    } else {
      // 未登录时，优先尝试一次 Windows 域自动登录（仅尝试一次）
      if (!userStore.getAutoTried) {
        // 标记已尝试，避免重复请求
        userStore.setAutoTried(true)

        try {
          // 优先通过 iframe 方式尝试自动登录（页面级请求更容易触发 Kerberos 协商）
          // 若 iframe 未返回有效结果，则认为当前环境不可用 SSO，不再额外通过 XHR 重试
          const res = await autoLoginByIframe()

          if (res?.success && res?.data) {
            // 自动登录成功，设置用户信息
            userStore.setUserInfo({
              username: res.data.username as any,
              realName: res.data.displayName as any,
              role: res.data.role as any,
              roleId: res.data.roleId as any,
              password: '',
              roles: res.data.roles || ([] as any),
              permissions: (res.data as any).permissions || [] // 添加权限列表
            } as any)
            userStore.setToken(res.token || 'SSO_AUTO_LOGIN')

            // 重置标记，允许后续正常流程
            userStore.setAutoTried(false)

            // 加载路由（复用登录成功后的逻辑）
            // 自动登录时，如果没有 roleRouters，使用静态路由
            const roleRouters = userStore.getRoleRouters || []

            if (appStore.getDynamicRouter && roleRouters.length > 0) {
              appStore.serverDynamicRouter
                ? await permissionStore.generateRoutes(
                    'server',
                    roleRouters as AppCustomRouteRecordRaw[]
                  )
                : await permissionStore.generateRoutes('frontEnd', roleRouters as string[])
            } else {
              // 使用静态路由（自动登录或动态路由为空时）
              await permissionStore.generateRoutes('static')
            }

            permissionStore.getAddRouters.forEach((route) => {
              router.addRoute(route as unknown as RouteRecordRaw)
            })
            permissionStore.setIsAddRouters(true)

            // 重新触发路由守卫，导航到目标页面
            router.replace(to.fullPath)
            return
          } else {
            // 自动登录失败（可能不在域环境中或未配置 SSO），静默跳转到登录页
            // 不显示错误提示，因为不在域环境中是正常情况
            next(`/login?redirect=${to.path}`)
            return
          }
        } catch (error: any) {
          // 自动登录失败（可能不在域环境中或未配置 SSO），静默跳转到登录页
          // 不显示错误提示，因为不在域环境中是正常情况
          // 只有真正的网络错误才记录日志
          if (error?.code !== 'ERR_NETWORK' && error?.response?.status !== 401) {
            console.warn('[SSO] 自动登录失败（可能不在域环境中）:', error?.message || error)
          }
          next(`/login?redirect=${to.path}`)
          return
        }
      }

      // 已经尝试过自动登录，直接跳转到登录页
      next(`/login?redirect=${to.path}`)
    }
  }
})

router.afterEach((to) => {
  useTitle(to?.meta?.title as string)
  done() // 结束Progress
  loadDone()
})
