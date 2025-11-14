import request from '@/axios'
import type { UserType } from './types'

interface RoleParams {
  role: string
}

export const loginApi = (data: UserType): Promise<IResponse<UserType>> => {
  // 强制使用真实后端接口（域登录功能需要）
  return request.post({
    url: '/api/auth/login',
    data
  })
}

export const loginOutApi = (): Promise<IResponse> => {
  return request.get({ url: '/mock/user/loginOut' })
}

export const getUserListApi = ({ params }: AxiosConfig) => {
  return request.get<{
    code: string
    data: {
      list: UserType[]
      total: number
    }
  }>({ url: '/mock/user/list', params })
}

export const getAdminRoleApi = (
  params: RoleParams
): Promise<IResponse<AppCustomRouteRecordRaw[]>> => {
  return request.get({ url: '/mock/role/routes', params })
}

export const getTestRoleApi = (
  params: RoleParams
): Promise<IResponse<AppCustomRouteRecordRaw[]>> => {
  return request.get({ url: '/mock/role/routes', params })
}

// Windows 域自动登录接口
export const autoLoginApi = (): Promise<
  IResponse<{
    username: string
    displayName: string
    domain?: string
    roles: string[]
    role: string
    roleId: string
  }>
> => {
  return request.get({
    // 固定走当前站点根路径，避免受全局 baseURL 或 VITE_API_BASE_PATH 影响
    baseURL: '/',
    url: '/api/auth/auto-login',
    // 重要：需要携带凭据以触发 Kerberos 认证（如果配置了）
    // withCredentials: true 允许浏览器发送 Kerberos 票据
    withCredentials: true,
    headers: {
      'X-Requested-With': 'XMLHttpRequest'
    }
  })
}
