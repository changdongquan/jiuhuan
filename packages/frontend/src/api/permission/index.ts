import request from '@/axios'

/**
 * 权限管理 API
 */

// 权限信息类型
export interface PermissionItem {
  id: number
  route_name: string
  route_path: string
  page_title: string
  parent_route: string | null
  created_at: string
  updated_at: string
}

// AD 用户信息类型
export interface AdUserItem {
  username: string
  displayName: string
  email?: string
  dn?: string
}

// AD 组信息类型
export interface AdGroupItem {
  group_dn: string
  group_name: string
  description?: string
}

// 权限列表
export const getPermissionListApi = () => {
  return request.get<PermissionItem[]>({
    url: '/api/permission/list'
  })
}

// 获取用户权限
export const getUserPermissionsApi = (username: string) => {
  return request.get<string[]>({
    url: `/api/permission/user/${username}`
  })
}

// 分配用户权限
export const assignUserPermissionsApi = (username: string, permissionIds: number[]) => {
  return request.post({
    url: `/api/permission/user/${username}/assign`,
    data: { permissionIds }
  })
}

// 移除用户权限
export const removeUserPermissionsApi = (username: string, permissionIds: number[]) => {
  return request.delete({
    url: `/api/permission/user/${username}/remove`,
    data: { permissionIds }
  })
}

// 获取组权限
export const getGroupPermissionsApi = (groupDn: string) => {
  return request.get<string[]>({
    url: `/api/permission/group/${encodeURIComponent(groupDn)}`
  })
}

// 分配组权限
export const assignGroupPermissionsApi = (groupDn: string, permissionIds: number[]) => {
  return request.post({
    url: `/api/permission/group/${encodeURIComponent(groupDn)}/assign`,
    data: { permissionIds, groupDn }
  })
}

// 移除组权限
export const removeGroupPermissionsApi = (groupDn: string, permissionIds: number[]) => {
  return request.delete({
    url: `/api/permission/group/${encodeURIComponent(groupDn)}/remove`,
    data: { permissionIds, groupDn }
  })
}

interface PagedResult<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

// 获取 AD 用户列表
export const getAdUsersApi = (params?: { keyword?: string; page?: number; pageSize?: number }) => {
  return request.get<PagedResult<AdUserItem>>({
    url: '/api/permission/ad/users',
    params
  })
}

// 获取 AD 组列表
export const getAdGroupsApi = (params?: { keyword?: string; page?: number; pageSize?: number }) => {
  return request.get<PagedResult<AdGroupItem>>({
    url: '/api/permission/ad/groups',
    params
  })
}

// 获取用户所属的组
export const getUserGroupsApi = (username: string) => {
  return request.get<AdGroupItem[]>({
    url: `/api/permission/ad/user/${username}/groups`
  })
}

// 同步路由到权限表
export const syncRoutesApi = () => {
  return request.post({
    url: '/api/permission/sync-routes'
  })
}
