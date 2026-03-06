import request from '@/axios'

export interface CapabilityActionItem {
  capabilityKey: string
  capabilityName: string
  moduleCode: string
  moduleName: string
  actionCode: string
  actionName: string
  routeName?: string
  enabled: boolean
  userCount?: number
  groupCount?: number
  createdAt?: string
  updatedAt?: string
}

export const getCapabilityActionsApi = (params?: { includeDisabled?: number }) => {
  return request.get<CapabilityActionItem[]>({
    url: '/api/capability/actions',
    params
  })
}

export const getUserCapabilitiesApi = (username: string) => {
  return request.get<string[]>({
    url: `/api/capability/user/${username}`
  })
}

export const assignUserCapabilitiesApi = (username: string, capabilityKeys: string[]) => {
  return request.post({
    url: `/api/capability/user/${username}/assign`,
    data: { capabilityKeys }
  })
}

export const removeUserCapabilitiesApi = (username: string, capabilityKeys: string[]) => {
  return request.delete({
    url: `/api/capability/user/${username}/remove`,
    data: { capabilityKeys }
  })
}

export const getGroupCapabilitiesApi = (groupDn: string) => {
  return request.get<string[]>({
    url: `/api/capability/group/${encodeURIComponent(groupDn)}`
  })
}

export const assignGroupCapabilitiesApi = (
  groupDn: string,
  capabilityKeys: string[],
  groupName?: string
) => {
  return request.post({
    url: `/api/capability/group/${encodeURIComponent(groupDn)}/assign`,
    data: { capabilityKeys, groupName }
  })
}

export const removeGroupCapabilitiesApi = (groupDn: string, capabilityKeys: string[]) => {
  return request.delete({
    url: `/api/capability/group/${encodeURIComponent(groupDn)}/remove`,
    data: { capabilityKeys }
  })
}
