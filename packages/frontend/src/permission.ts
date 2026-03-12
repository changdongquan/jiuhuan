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
const DEV_AUTO_LOGIN_USERNAME = 'dev-user'

const NO_AUTH_ROUTE_NAMES = [
  '404',
  '403',
  'NoFind',
  'PersonalCenter',
  'Redirect',
  'Root',
  'RedirectWrap'
]

const HOME_ROUTE_CANDIDATES = [
  'SalesOrdersIndex',
  'ProjectManagementIndex',
  'OutboundDocumentIndex',
  'ProductionTasksIndex',
  'BillingDocuments',
  'ReceivableDocuments',
  'AttendanceIndex',
  'CustomerInfoIndex',
  'SupplierInfoIndex',
  'EmployeeInfoIndex',
  'Analysis',
  'Workplace'
]

const pickFirstAccessibleRoute = (permissionNames: string[]) => {
  const normalized = Array.from(
    new Set(
      (permissionNames || [])
        .map((name) => String(name || '').trim())
        .filter((name) => !!name && name !== 'Dashboard')
    )
  )
  if (!normalized.length) return null

  const candidates = [
    ...HOME_ROUTE_CANDIDATES.filter((name) => normalized.includes(name)),
    ...normalized
  ]

  const routeList = router.getRoutes()
  for (const routeName of candidates) {
    const target = routeList.find((route) => String(route.name || '') === routeName)
    if (!target) continue
    // 需要路径参数的页面（如打印页）不适合作为登录后的默认落点。
    if (/\:[^/]+/.test(String(target.path || ''))) continue
    return { name: routeName }
  }

  return null
}

interface AutoLoginResponseData {
  username: string
  displayName: string
  domain?: string | null
  roles: string[]
  role: string
  roleId: string
  capabilities?: string[]
  permissions?: string[]
}

interface AutoLoginResponse {
  code: number
  success: boolean
  data?: AutoLoginResponseData
  token?: string
  ssoFailed?: boolean
}

const applyAutoLoginUser = (
  userStore: ReturnType<typeof useUserStoreWithOut>,
  res: AutoLoginResponse
) => {
  if (!res?.data) return
  userStore.setUserInfo({
    username: res.data.username as any,
    realName: res.data.displayName as any,
    role: res.data.role as any,
    roleId: res.data.roleId as any,
    password: '',
    roles: res.data.roles || ([] as any),
    permissions: (res.data as any).permissions || [],
    capabilities: (res.data as any).capabilities || []
  } as any)
  userStore.setToken(res.token || 'SSO_AUTO_LOGIN')
}

const applyUserRoutes = async (
  permissionStore: ReturnType<typeof usePermissionStoreWithOut>,
  appStore: ReturnType<typeof useAppStoreWithOut>,
  userStore: ReturnType<typeof useUserStoreWithOut>
) => {
  permissionStore.setIsAddRouters(false)
  const userInfo = userStore.getUserInfo as any
  const userPermissions = (userInfo?.permissions || []) as string[]
  const isAdmin = userInfo?.username === 'admin'
  const roleRouters = userStore.getRoleRouters || []

  if (appStore.getDynamicRouter && roleRouters.length > 0) {
    appStore.serverDynamicRouter
      ? await permissionStore.generateRoutes('server', roleRouters as AppCustomRouteRecordRaw[])
      : await permissionStore.generateRoutes('frontEnd', roleRouters as string[])
  } else if (isAdmin) {
    await permissionStore.generateRoutes('static')
  } else if (userPermissions.length > 0) {
    await permissionStore.generateRoutes('frontEnd', userPermissions as string[])
  } else if (isDev) {
    console.warn('[权限][DEV] 用户权限列表为空，使用静态路由生成菜单')
    await permissionStore.generateRoutes('static')
  } else {
    await permissionStore.generateRoutes('frontEnd', [])
  }

  permissionStore.getAddRouters.forEach((route) => {
    router.addRoute(route as unknown as RouteRecordRaw)
  })
  permissionStore.setIsAddRouters(true)
}

const tryRestoreDevSession = async (
  permissionStore: ReturnType<typeof usePermissionStoreWithOut>,
  appStore: ReturnType<typeof useAppStoreWithOut>,
  userStore: ReturnType<typeof useUserStoreWithOut>
) => {
  if (!isDev) return false
  try {
    const res = await autoLoginByIframe()
    if (!res?.success || !res?.data) return false
    applyAutoLoginUser(userStore, res)
    userStore.setAutoTried(false)
    await applyUserRoutes(permissionStore, appStore, userStore)
    return true
  } catch (error: any) {
    console.warn('[权限][DEV] 自动恢复 dev-user 会话失败:', error?.message || error)
    return false
  }
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
    if (
      isDev &&
      to.path !== '/login' &&
      String((userStore.getUserInfo as any)?.username || '').trim() !== DEV_AUTO_LOGIN_USERNAME
    ) {
      const restored = await tryRestoreDevSession(permissionStore, appStore, userStore)
      if (restored) {
        next({ path: to.fullPath, replace: true })
        return
      }
    }

    if (to.path === '/login') {
      next({ path: '/' })
    } else {
      // 权限验证：检查用户是否有权限访问目标页面
      let userInfo = userStore.getUserInfo as any
      let userPermissions = (userInfo as any).permissions || []
      let isAdmin = userInfo?.username === 'admin'

      if (!isAdmin && to.name === 'Analysis' && !userPermissions.includes('Analysis')) {
        const restored = await tryRestoreDevSession(permissionStore, appStore, userStore)
        if (restored) {
          next({ path: to.fullPath, replace: true })
          return
        }
        const fallback = pickFirstAccessibleRoute(userPermissions)
        if (fallback) {
          next({ ...fallback, replace: true })
          return
        }
        next('/403')
        return
      }

      // 排除不需要权限验证的路由（如 404、403、个人中心、首页重定向等）
      // admin 拥有所有权限，直接通过；白名单路由直接通过
      if (isAdmin || NO_AUTH_ROUTE_NAMES.includes(to.name as string)) {
        // 允许访问，继续后续流程
      } else if (to.name) {
        // 其他用户需要检查权限
        if (userPermissions.length === 0) {
          if (isDev) {
            const restored = await tryRestoreDevSession(permissionStore, appStore, userStore)
            if (restored) {
              next({ path: to.fullPath, replace: true })
              return
            }
            userInfo = userStore.getUserInfo as any
            userPermissions = (userInfo?.permissions || []) as string[]
            isAdmin = userInfo?.username === 'admin'
            if (!isAdmin && userPermissions.length === 0) {
              console.warn('[权限][DEV] 用户权限列表为空，允许访问:', to.name)
            }
          } else {
            // 生产严格模式：权限列表为空视为无任何权限，除白名单外全部拒绝
            console.warn('[权限] 用户无任何页面权限，拒绝访问:', to.name)
            next('/403')
            return
          }
        } else if (!userPermissions.includes(to.name)) {
          if (isDev) {
            const restored = await tryRestoreDevSession(permissionStore, appStore, userStore)
            if (restored) {
              next({ path: to.fullPath, replace: true })
              return
            }
            userInfo = userStore.getUserInfo as any
            userPermissions = (userInfo?.permissions || []) as string[]
            isAdmin = userInfo?.username === 'admin'
            if (isAdmin || userPermissions.includes(to.name as string)) {
              // 会话恢复成功后已具备权限，继续后续流程
            } else {
              console.warn('[权限] 用户无权限访问:', {
                route: to.name,
                permissions: userPermissions
              })
              next('/403')
              return
            }
          } else {
            // 有权限列表，但当前路由不在权限列表中，拒绝访问
            console.warn('[权限] 用户无权限访问:', { route: to.name, permissions: userPermissions })
            next('/403')
            return
          }
        }
      }

      if (permissionStore.getIsAddRouters) {
        next()
        return
      }

      await applyUserRoutes(permissionStore, appStore, userStore)
      const redirectPath = from.query.redirect || to.path
      const redirect = decodeURIComponent(redirectPath as string)
      const nextData = to.path === redirect ? { ...to, replace: true } : { path: redirect }
      next(nextData)
    }
  } else {
    // 开发模式下，每次进入都重新尝试自动登录，避免之前失败时 autoTried 被持久化导致后续不再尝试
    if (isDev) {
      userStore.setAutoTried(false)
    }

    const inWhiteList = NO_REDIRECT_WHITE_LIST.indexOf(to.path) !== -1
    // 开发环境下，对 /login 也尝试自动登录，方便本地免登录
    if (inWhiteList && !(isDev && to.path === '/login')) {
      next()
    } else {
      // 未登录时，优先尝试一次 Windows 域自动登录（仅尝试一次）
      if (!userStore.getAutoTried) {
        // 标记已尝试，避免重复请求
        userStore.setAutoTried(true)

        try {
          const res = await autoLoginByIframe()

          if (res?.success && res?.data) {
            applyAutoLoginUser(userStore, res)
            // 重置标记，允许后续正常流程
            userStore.setAutoTried(false)
            await applyUserRoutes(permissionStore, appStore, userStore)

            // 使用 next 导航到目标页面，避免在导航守卫中直接调用 router.replace 触发
            // “Invalid navigation guard / next callback was never called” 警告
            next({ path: to.fullPath, replace: true })
            return
          } else {
            // 自动登录失败（可能不在域环境中或未配置 SSO），静默跳转到登录页
            // 不显示错误提示，因为不在域环境中是正常情况
            if (isDev && to.path === '/login') {
              // 本地开发环境下，自动登录失败时直接停留在登录页
              next()
            } else {
              next(`/login?redirect=${to.path}`)
            }
            return
          }
        } catch (error: any) {
          // 自动登录失败（可能不在域环境中或未配置 SSO），静默跳转到登录页
          // 不显示错误提示，因为不在域环境中是正常情况
          // 只有真正的网络错误才记录日志
          if (error?.code !== 'ERR_NETWORK' && error?.response?.status !== 401) {
            console.warn('[SSO] 自动登录失败（可能不在域环境中）:', error?.message || error)
          }
          if (isDev && to.path === '/login') {
            next()
          } else {
            next(`/login?redirect=${to.path}`)
          }
          return
        }
      }

      // 已经尝试过自动登录，直接跳转到登录页
      if (isDev && to.path === '/login') {
        next()
      } else {
        next(`/login?redirect=${to.path}`)
      }
    }
  }
})

router.afterEach((to) => {
  useTitle(to?.meta?.title as string)
  done() // 结束Progress
  loadDone()
})
