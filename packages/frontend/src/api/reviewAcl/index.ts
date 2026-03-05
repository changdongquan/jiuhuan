import request from '@/axios'

export interface ReviewAclActionItem {
  actionKey: string
  actionName: string
  moduleCode: string
  enabled: boolean
  userCount: number
  groupCount: number
  createdAt?: string
  updatedAt?: string
}

export const getReviewAclActionsApi = (params?: { includeDisabled?: 0 | 1 }) => {
  return request.get<ReviewAclActionItem[]>({
    url: '/api/review-acl/actions',
    params
  })
}

export const getUserReviewAclApi = (username: string) => {
  return request.get<string[]>({
    url: `/api/review-acl/user/${encodeURIComponent(username)}`
  })
}

export const assignUserReviewAclApi = (username: string, actionKeys: string[]) => {
  return request.post({
    url: `/api/review-acl/user/${encodeURIComponent(username)}/assign`,
    data: { actionKeys }
  })
}

export const removeUserReviewAclApi = (username: string, actionKeys: string[]) => {
  return request.delete({
    url: `/api/review-acl/user/${encodeURIComponent(username)}/remove`,
    data: { actionKeys }
  })
}

export const getGroupReviewAclApi = (groupDn: string) => {
  return request.get<string[]>({
    url: `/api/review-acl/group/${encodeURIComponent(groupDn)}`
  })
}

export const assignGroupReviewAclApi = (
  groupDn: string,
  groupName: string,
  actionKeys: string[]
) => {
  return request.post({
    url: `/api/review-acl/group/${encodeURIComponent(groupDn)}/assign`,
    data: { actionKeys, groupName }
  })
}

export const removeGroupReviewAclApi = (groupDn: string, actionKeys: string[]) => {
  return request.delete({
    url: `/api/review-acl/group/${encodeURIComponent(groupDn)}/remove`,
    data: { actionKeys }
  })
}
