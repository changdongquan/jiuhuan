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
          // 尝试自动登录
          const res = await autoLoginApi()

          if (res?.success && res?.data) {
            // 自动登录成功，设置用户信息
            userStore.setUserInfo({
              username: res.data.username as any,
              realName: res.data.displayName as any,
              role: res.data.role as any,
              roleId: res.data.roleId as any,
              password: '',
              roles: res.data.roles || ([] as any)
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
