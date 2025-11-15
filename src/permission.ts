import router from './router'
import { useAppStoreWithOut } from '@/store/modules/app'
import type { RouteRecordRaw } from 'vue-router'
import { useTitle } from '@/hooks/web/useTitle'
import { useNProgress } from '@/hooks/web/useNProgress'
import { usePermissionStoreWithOut } from '@/store/modules/permission'
import { usePageLoading } from '@/hooks/web/usePageLoading'
import { NO_REDIRECT_WHITE_LIST } from '@/constants'
import { useUserStoreWithOut } from '@/store/modules/user'
import { autoLoginApi } from '@/api/login'

const { start, done } = useNProgress()

const { loadStart, loadDone } = usePageLoading()

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

      // admin 拥有所有权限，直接通过
      // 或者白名单路由，直接通过
      // 或者权限列表为空（兼容性处理）
      if (isAdmin || noAuthRoutes.includes(to.name as string)) {
        // admin 或白名单路由，允许访问，继续后续流程
      } else if (to.name) {
        // 其他用户需要检查权限
        if (userPermissions.length === 0) {
          // 如果用户权限列表为空，说明权限系统可能未启用或用户未分配权限
          // 暂时允许访问（兼容性处理）
          console.warn('[权限] 用户权限列表为空，允许访问:', to.name)
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

      // 开发者可根据实际情况进行修改
      const roleRouters = userStore.getRoleRouters || []

      // 是否使用动态路由
      // 如果动态路由为空，强制使用静态路由
      if (appStore.getDynamicRouter && roleRouters.length > 0) {
        appStore.serverDynamicRouter
          ? await permissionStore.generateRoutes('server', roleRouters as AppCustomRouteRecordRaw[])
          : await permissionStore.generateRoutes('frontEnd', roleRouters as string[])
      } else {
        // 使用静态路由（未启用动态路由，或动态路由列表为空）
        await permissionStore.generateRoutes('static')
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
          let res = await autoLoginByIframe()

          // 如果 iframe 方式未能返回有效结果，再回退到 XHR 方式（兼容非 Kerberos 场景）
          if (!res) {
            // 尝试自动登录
            res = (await autoLoginApi()) as unknown as AutoLoginResponse
          }

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
