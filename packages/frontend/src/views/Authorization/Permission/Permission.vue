<script setup lang="tsx">
import { ref, onMounted, computed } from 'vue'
import { ContentWrap } from '@/components/ContentWrap'
import {
  ElTabs,
  ElTabPane,
  ElInput,
  ElCheckbox,
  ElMessage,
  ElLoading,
  ElTable,
  ElTableColumn,
  ElPagination,
  ElDivider,
  ElEmpty
} from 'element-plus'
import { BaseButton } from '@/components/Button'
import {
  getPermissionListApi,
  getUserPermissionsApi,
  assignUserPermissionsApi,
  removeUserPermissionsApi,
  getGroupPermissionsApi,
  assignGroupPermissionsApi,
  removeGroupPermissionsApi,
  getAdUsersApi,
  getAdGroupsApi,
  getUserGroupsApi,
  syncRoutesApi,
  type PermissionItem,
  type AdUserItem,
  type AdGroupItem
} from '@/api/permission'
import {
  assignGroupReviewAclApi,
  assignUserReviewAclApi,
  getGroupReviewAclApi,
  getReviewAclActionsApi,
  getUserReviewAclApi,
  removeGroupReviewAclApi,
  removeUserReviewAclApi,
  type ReviewAclActionItem
} from '@/api/reviewAcl'
import {
  assignUserCapabilitiesApi,
  getCapabilityActionsApi,
  getUserCapabilitiesApi,
  removeUserCapabilitiesApi,
  type CapabilityActionItem
} from '@/api/capability'

// ========================
// 通用状态
// ========================

const activeTab = ref('user')

// 权限列表
const permissionList = ref<PermissionItem[]>([])
const loadingPermissions = ref(false)

// 加载权限列表
const loadPermissionList = async () => {
  loadingPermissions.value = true
  try {
    const res = await getPermissionListApi()
    permissionList.value = res.data || []
  } catch (error: any) {
    ElMessage.error('加载权限列表失败: ' + (error.message || '未知错误'))
  } finally {
    loadingPermissions.value = false
  }
}

const permissionTreeData = computed(() => {
  if (!permissionList.value.length) return []

  const grouped = permissionList.value.reduce(
    (acc, perm) => {
      const parent = perm.parent_route || '其他'
      if (!acc[parent]) {
        acc[parent] = []
      }
      acc[parent].push({
        id: perm.id,
        route_name: perm.route_name,
        label: `${perm.page_title || perm.route_name} (${perm.route_name})`
      })
      return acc
    },
    {} as Record<string, { id: number; route_name: string; label: string }[]>
  )

  return Object.keys(grouped).map((parent) => ({
    key: parent,
    label: parent,
    children: grouped[parent]
  }))
})

const permissionMapByRouteName = computed(() => {
  const map = new Map<string, PermissionItem>()
  permissionList.value.forEach((item) => {
    map.set(item.route_name, item)
  })
  return map
})

// ========================
// 用户权限
// ========================

const userSearchKeyword = ref('')
const adUsers = ref<AdUserItem[]>([])
const loadingUsers = ref(false)
const selectedUser = ref<AdUserItem | null>(null)
const selectedUserGroups = ref<AdGroupItem[]>([])
const loadingUserGroups = ref(false)
const userOriginalRouteNames = ref<string[]>([])
const userCheckedRouteNames = ref<string[]>([])
const userPermissionFilter = ref('')
const userOriginalCapabilityKeys = ref<string[]>([])
const userCheckedCapabilityKeys = ref<string[]>([])
const userCapabilityFilter = ref('')
const savingUserPermissions = ref(false)

const userPagination = ref({
  page: 1,
  pageSize: 10,
  total: 0
})

const filteredUserPermissionTree = computed(() => {
  const keyword = userPermissionFilter.value.trim().toLowerCase()
  if (!keyword) return permissionTreeData.value

  return permissionTreeData.value
    .map((group) => {
      const children = group.children.filter((perm) => {
        return (
          perm.label.toLowerCase().includes(keyword) ||
          perm.route_name.toLowerCase().includes(keyword)
        )
      })
      if (!children.length) return null
      return {
        ...group,
        children
      }
    })
    .filter(Boolean) as typeof permissionTreeData.value
})

// 加载 AD 用户列表
const loadAdUsers = async () => {
  loadingUsers.value = true
  try {
    const res = await getAdUsersApi({
      keyword: userSearchKeyword.value || undefined,
      page: userPagination.value.page,
      pageSize: userPagination.value.pageSize
    })
    const data = (res.data as any) || {}
    adUsers.value = data.list || []
    userPagination.value.total = data.total || 0
  } catch (error: any) {
    ElMessage.error('加载用户列表失败: ' + (error.message || '未知错误'))
  } finally {
    loadingUsers.value = false
  }
}

const loadUserGroups = async (username: string) => {
  loadingUserGroups.value = true
  try {
    const res = await getUserGroupsApi(username)
    selectedUserGroups.value = res.data || []
  } catch (error: any) {
    selectedUserGroups.value = []
    ElMessage.error('加载用户所属组失败: ' + (error.message || '未知错误'))
  } finally {
    loadingUserGroups.value = false
  }
}

const resetUserPermissionSelection = () => {
  userPermissionFilter.value = ''
  userCapabilityFilter.value = ''
  userCheckedRouteNames.value = [...userOriginalRouteNames.value]
  userCheckedCapabilityKeys.value = [...userOriginalCapabilityKeys.value]
}

// 选择用户并加载权限
const selectUser = async (user: AdUserItem) => {
  selectedUser.value = user
  loadingUserPermissions.value = true
  try {
    const [permissionRes, capabilityRes] = await Promise.all([
      getUserPermissionsApi(user.username),
      getUserCapabilitiesApi(user.username)
    ])
    const permissions = (permissionRes.data as any[]) || []
    const capabilities = ((capabilityRes.data as string[]) || []).map((x) =>
      String(x || '')
        .trim()
        .toUpperCase()
    )
    userOriginalRouteNames.value = permissions
    userCheckedRouteNames.value = [...permissions]
    userOriginalCapabilityKeys.value = capabilities
    userCheckedCapabilityKeys.value = [...capabilities]
    await loadUserGroups(user.username)
  } catch (error: any) {
    ElMessage.error('加载用户权限失败: ' + (error.message || '未知错误'))
  } finally {
    loadingUserPermissions.value = false
  }
}

const loadingUserPermissions = ref(false)

const toggleUserPermission = (routeName: string, checked: boolean) => {
  const current = new Set(userCheckedRouteNames.value)
  if (checked) {
    current.add(routeName)
  } else {
    current.delete(routeName)
    const routeKeys = getCapabilityKeysByRouteName(routeName)
    if (routeKeys.length) {
      const capabilitySet = new Set(userCheckedCapabilityKeys.value)
      routeKeys.forEach((k) => capabilitySet.delete(k))
      userCheckedCapabilityKeys.value = Array.from(capabilitySet)
    }
  }
  userCheckedRouteNames.value = Array.from(current)
  if (checked) {
    const routeKeys = getCapabilityKeysByRouteName(routeName)
    if (routeKeys.length) {
      const capabilitySet = new Set(userCheckedCapabilityKeys.value)
      routeKeys.forEach((k) => capabilitySet.add(k))
      userCheckedCapabilityKeys.value = Array.from(capabilitySet)
    }
  }
}

const toggleUserGroupPermissions = (groupKey: string, checked: boolean) => {
  const group = filteredUserPermissionTree.value.find((g) => g.key === groupKey)
  if (!group) return

  const current = new Set(userCheckedRouteNames.value)
  const routeNames = group.children.map((perm) => perm.route_name)

  if (checked) {
    routeNames.forEach((name) => current.add(name))
  } else {
    routeNames.forEach((name) => current.delete(name))
  }

  userCheckedRouteNames.value = Array.from(current)
}

const isUserGroupChecked = (groupKey: string) => {
  const group = filteredUserPermissionTree.value.find((g) => g.key === groupKey)
  if (!group || !group.children.length) return false
  const current = new Set(userCheckedRouteNames.value)
  return group.children.every((perm) => current.has(perm.route_name))
}

const isUserGroupIndeterminate = (groupKey: string) => {
  const group = filteredUserPermissionTree.value.find((g) => g.key === groupKey)
  if (!group || !group.children.length) return false
  const current = new Set(userCheckedRouteNames.value)
  const checkedCount = group.children.filter((perm) => current.has(perm.route_name)).length
  return checkedCount > 0 && checkedCount < group.children.length
}

const saveUserPermissions = async () => {
  if (!selectedUser.value) return
  if (!permissionList.value.length) {
    ElMessage.warning('权限列表为空，无法保存')
    return
  }

  const username = selectedUser.value.username
  const originalSet = new Set(userOriginalRouteNames.value)
  const currentSet = new Set(userCheckedRouteNames.value)

  const toAddRouteNames: string[] = []
  const toRemoveRouteNames: string[] = []

  currentSet.forEach((name) => {
    if (!originalSet.has(name)) {
      toAddRouteNames.push(name)
    }
  })

  originalSet.forEach((name) => {
    if (!currentSet.has(name)) {
      toRemoveRouteNames.push(name)
    }
  })

  const map = permissionMapByRouteName.value
  const toAddIds = toAddRouteNames
    .map((name) => {
      const raw = map.get(name)?.id as any
      const num = raw != null ? Number(raw) : NaN
      return Number.isFinite(num) ? num : NaN
    })
    .filter((id) => Number.isFinite(id))
  const toRemoveIds = toRemoveRouteNames
    .map((name) => {
      const raw = map.get(name)?.id as any
      const num = raw != null ? Number(raw) : NaN
      return Number.isFinite(num) ? num : NaN
    })
    .filter((id) => Number.isFinite(id))

  const originalCapabilitySet = new Set(userOriginalCapabilityKeys.value)
  const currentCapabilitySet = new Set(userCheckedCapabilityKeys.value)
  const toAddCapabilityKeys = Array.from(currentCapabilitySet).filter(
    (x) => !originalCapabilitySet.has(x)
  )
  const toRemoveCapabilityKeys = Array.from(originalCapabilitySet).filter(
    (x) => !currentCapabilitySet.has(x)
  )

  if (
    !toAddIds.length &&
    !toRemoveIds.length &&
    !toAddCapabilityKeys.length &&
    !toRemoveCapabilityKeys.length
  ) {
    ElMessage.info('权限未变化，无需保存')
    return
  }

  savingUserPermissions.value = true
  const loading = ElLoading.service({ target: '.user-permission-panel' })
  try {
    if (toAddIds.length) {
      await assignUserPermissionsApi(username, toAddIds)
    }

    if (toRemoveIds.length) {
      await removeUserPermissionsApi(username, toRemoveIds)
    }

    if (toAddCapabilityKeys.length) {
      await assignUserCapabilitiesApi(username, toAddCapabilityKeys)
    }

    if (toRemoveCapabilityKeys.length) {
      await removeUserCapabilitiesApi(username, toRemoveCapabilityKeys)
    }

    userOriginalRouteNames.value = [...userCheckedRouteNames.value]
    userOriginalCapabilityKeys.value = [...userCheckedCapabilityKeys.value]
    ElMessage.success('用户权限保存成功（页面权限 + 模块能力权限）')
  } catch (error: any) {
    ElMessage.error('保存用户权限失败: ' + (error.message || '未知错误'))
  } finally {
    savingUserPermissions.value = false
    loading.close()
  }
}

const searchUsers = () => {
  userPagination.value.page = 1
  loadAdUsers()
}

const handleUserPageChange = (page: number) => {
  userPagination.value.page = page
  loadAdUsers()
}

const handleUserPageSizeChange = (size: number) => {
  userPagination.value.pageSize = size
  userPagination.value.page = 1
  loadAdUsers()
}

const totalUserPermissions = computed(() => permissionList.value.length)
const checkedUserPermissionsCount = computed(() => userCheckedRouteNames.value.length)
const checkedUserCapabilityCount = computed(() => userCheckedCapabilityKeys.value.length)

const switchCenter = (tab: string) => {
  activeTab.value = tab
  handleTabChange(tab)
}

// 初始加载
onMounted(() => {
  loadPermissionList()
  loadAdUsers()
  loadReviewActions()
  loadCapabilityActions()
})

// ========================
// 组权限
// ========================

const groupSearchKeyword = ref('')
const adGroups = ref<AdGroupItem[]>([])
const loadingGroups = ref(false)
const selectedGroup = ref<AdGroupItem | null>(null)
const groupOriginalRouteNames = ref<string[]>([])
const groupCheckedRouteNames = ref<string[]>([])
const savingGroupPermissions = ref(false)
const groupPermissionFilter = ref('')

const groupPagination = ref({
  page: 1,
  pageSize: 10,
  total: 0
})

// 加载 AD 组列表
const loadAdGroups = async () => {
  loadingGroups.value = true
  try {
    const res = await getAdGroupsApi({
      keyword: groupSearchKeyword.value || undefined,
      page: groupPagination.value.page,
      pageSize: groupPagination.value.pageSize
    })
    const data = (res.data as any) || {}
    adGroups.value = data.list || []
    groupPagination.value.total = data.total || 0
  } catch (error: any) {
    ElMessage.error('加载组列表失败: ' + (error.message || '未知错误'))
  } finally {
    loadingGroups.value = false
  }
}

// 选择组
const selectGroup = async (group: AdGroupItem) => {
  selectedGroup.value = group
  loadingGroupPermissions.value = true
  try {
    const res = await getGroupPermissionsApi(group.group_dn)
    const permissions = (res.data as any[]) || []
    groupOriginalRouteNames.value = permissions
    groupCheckedRouteNames.value = [...permissions]
  } catch (error: any) {
    ElMessage.error('加载组权限失败: ' + (error.message || '未知错误'))
  } finally {
    loadingGroupPermissions.value = false
  }
}

const loadingGroupPermissions = ref(false)

const filteredGroupPermissionTree = computed(() => {
  const keyword = groupPermissionFilter.value.trim().toLowerCase()
  if (!keyword) return permissionTreeData.value

  return permissionTreeData.value
    .map((group) => {
      const children = group.children.filter((perm) => {
        return (
          perm.label.toLowerCase().includes(keyword) ||
          perm.route_name.toLowerCase().includes(keyword)
        )
      })
      if (!children.length) return null
      return {
        ...group,
        children
      }
    })
    .filter(Boolean) as typeof permissionTreeData.value
})

const toggleGroupPermission = (routeName: string, checked: boolean) => {
  const current = new Set(groupCheckedRouteNames.value)
  if (checked) {
    current.add(routeName)
  } else {
    current.delete(routeName)
  }
  groupCheckedRouteNames.value = Array.from(current)
}

const toggleGroupGroupPermissions = (groupKey: string, checked: boolean) => {
  const group = filteredGroupPermissionTree.value.find((g) => g.key === groupKey)
  if (!group) return

  const current = new Set(groupCheckedRouteNames.value)
  const routeNames = group.children.map((perm) => perm.route_name)

  if (checked) {
    routeNames.forEach((name) => current.add(name))
  } else {
    routeNames.forEach((name) => current.delete(name))
  }

  groupCheckedRouteNames.value = Array.from(current)
}

const isGroupGroupChecked = (groupKey: string) => {
  const group = filteredGroupPermissionTree.value.find((g) => g.key === groupKey)
  if (!group || !group.children.length) return false
  const current = new Set(groupCheckedRouteNames.value)
  return group.children.every((perm) => current.has(perm.route_name))
}

const isGroupGroupIndeterminate = (groupKey: string) => {
  const group = filteredGroupPermissionTree.value.find((g) => g.key === groupKey)
  if (!group || !group.children.length) return false
  const current = new Set(groupCheckedRouteNames.value)
  const checkedCount = group.children.filter((perm) => current.has(perm.route_name)).length
  return checkedCount > 0 && checkedCount < group.children.length
}

const resetGroupPermissionSelection = () => {
  groupPermissionFilter.value = ''
  groupCheckedRouteNames.value = [...groupOriginalRouteNames.value]
}

const saveGroupPermissions = async () => {
  if (!selectedGroup.value) return
  if (!permissionList.value.length) {
    ElMessage.warning('权限列表为空，无法保存')
    return
  }

  const groupDn = selectedGroup.value.group_dn
  const originalSet = new Set(groupOriginalRouteNames.value)
  const currentSet = new Set(groupCheckedRouteNames.value)

  const toAddRouteNames: string[] = []
  const toRemoveRouteNames: string[] = []

  currentSet.forEach((name) => {
    if (!originalSet.has(name)) {
      toAddRouteNames.push(name)
    }
  })

  originalSet.forEach((name) => {
    if (!currentSet.has(name)) {
      toRemoveRouteNames.push(name)
    }
  })

  if (!toAddRouteNames.length && !toRemoveRouteNames.length) {
    ElMessage.info('权限未变化，无需保存')
    return
  }

  const map = permissionMapByRouteName.value
  const toAddIds = toAddRouteNames
    .map((name) => {
      const raw = map.get(name)?.id as any
      const num = raw != null ? Number(raw) : NaN
      return Number.isFinite(num) ? num : NaN
    })
    .filter((id) => Number.isFinite(id))
  const toRemoveIds = toRemoveRouteNames
    .map((name) => {
      const raw = map.get(name)?.id as any
      const num = raw != null ? Number(raw) : NaN
      return Number.isFinite(num) ? num : NaN
    })
    .filter((id) => Number.isFinite(id))

  savingGroupPermissions.value = true
  const loading = ElLoading.service({ target: '.group-permission-panel' })
  try {
    if (toAddIds.length) {
      await assignGroupPermissionsApi(groupDn, toAddIds, selectedGroup.value?.group_name || '')
    }

    if (toRemoveIds.length) {
      await removeGroupPermissionsApi(groupDn, toRemoveIds)
    }

    groupOriginalRouteNames.value = [...groupCheckedRouteNames.value]
    ElMessage.success('组权限保存成功')
  } catch (error: any) {
    ElMessage.error('保存组权限失败: ' + (error.message || '未知错误'))
  } finally {
    savingGroupPermissions.value = false
    loading.close()
  }
}

const searchGroups = () => {
  groupPagination.value.page = 1
  loadAdGroups()
}

const handleGroupPageChange = (page: number) => {
  groupPagination.value.page = page
  loadAdGroups()
}

const handleGroupPageSizeChange = (size: number) => {
  groupPagination.value.pageSize = size
  groupPagination.value.page = 1
  loadAdGroups()
}

const totalGroupPermissions = computed(() => permissionList.value.length)
const checkedGroupPermissionsCount = computed(() => groupCheckedRouteNames.value.length)

// ========================
// 接口审核权限（Review ACL）
// ========================

const reviewActions = ref<ReviewAclActionItem[]>([])
const loadingReviewActions = ref(false)
const reviewAclTab = ref<'user' | 'group'>('user')

const reviewActionTreeData = computed(() => {
  const grouped = reviewActions.value.reduce(
    (acc, item) => {
      const key = item.moduleCode || 'OTHER'
      if (!acc[key]) acc[key] = []
      acc[key].push(item)
      return acc
    },
    {} as Record<string, ReviewAclActionItem[]>
  )
  return Object.keys(grouped).map((key) => ({
    key,
    label: key,
    children: grouped[key]
  }))
})

const loadReviewActions = async () => {
  loadingReviewActions.value = true
  try {
    const res = await getReviewAclActionsApi({ includeDisabled: 1 })
    reviewActions.value = (res.data as ReviewAclActionItem[]) || []
  } catch (error: any) {
    ElMessage.error('加载接口审核动作失败: ' + (error?.message || '未知错误'))
  } finally {
    loadingReviewActions.value = false
  }
}

const selectedReviewUser = ref<AdUserItem | null>(null)
const reviewUserOriginalActionKeys = ref<string[]>([])
const reviewUserCheckedActionKeys = ref<string[]>([])
const savingReviewUserAcl = ref(false)
const reviewUserFilter = ref('')

const filteredReviewActionTreeByUser = computed(() => {
  const keyword = reviewUserFilter.value.trim().toLowerCase()
  if (!keyword) return reviewActionTreeData.value
  return reviewActionTreeData.value
    .map((group) => {
      const children = group.children.filter((item) => {
        return (
          item.actionKey.toLowerCase().includes(keyword) ||
          item.actionName.toLowerCase().includes(keyword)
        )
      })
      if (!children.length) return null
      return { ...group, children }
    })
    .filter(Boolean) as typeof reviewActionTreeData.value
})

const selectReviewUser = async (user: AdUserItem) => {
  selectedReviewUser.value = user
  try {
    const res = await getUserReviewAclApi(user.username)
    const keys = ((res.data as string[]) || []).map((x) =>
      String(x || '')
        .trim()
        .toUpperCase()
    )
    reviewUserOriginalActionKeys.value = keys
    reviewUserCheckedActionKeys.value = [...keys]
  } catch (error: any) {
    reviewUserOriginalActionKeys.value = []
    reviewUserCheckedActionKeys.value = []
    ElMessage.error('加载用户接口审核权限失败: ' + (error?.message || '未知错误'))
  }
}

const toggleReviewUserAction = (actionKey: string, checked: boolean) => {
  const current = new Set(reviewUserCheckedActionKeys.value)
  if (checked) current.add(actionKey)
  else current.delete(actionKey)
  reviewUserCheckedActionKeys.value = Array.from(current)
}

const resetReviewUserSelection = () => {
  reviewUserFilter.value = ''
  reviewUserCheckedActionKeys.value = [...reviewUserOriginalActionKeys.value]
}

const saveReviewUserAcl = async () => {
  const user = selectedReviewUser.value
  if (!user) return
  const originalSet = new Set(reviewUserOriginalActionKeys.value)
  const currentSet = new Set(reviewUserCheckedActionKeys.value)
  const toAdd = Array.from(currentSet).filter((x) => !originalSet.has(x))
  const toRemove = Array.from(originalSet).filter((x) => !currentSet.has(x))
  if (!toAdd.length && !toRemove.length) {
    ElMessage.info('接口审核权限未变化，无需保存')
    return
  }
  savingReviewUserAcl.value = true
  try {
    if (toAdd.length) await assignUserReviewAclApi(user.username, toAdd)
    if (toRemove.length) await removeUserReviewAclApi(user.username, toRemove)
    reviewUserOriginalActionKeys.value = [...reviewUserCheckedActionKeys.value]
    ElMessage.success('用户接口审核权限保存成功')
  } catch (error: any) {
    ElMessage.error('保存用户接口审核权限失败: ' + (error?.message || '未知错误'))
  } finally {
    savingReviewUserAcl.value = false
  }
}

const selectedReviewGroup = ref<AdGroupItem | null>(null)
const reviewGroupOriginalActionKeys = ref<string[]>([])
const reviewGroupCheckedActionKeys = ref<string[]>([])
const savingReviewGroupAcl = ref(false)
const reviewGroupFilter = ref('')

const filteredReviewActionTreeByGroup = computed(() => {
  const keyword = reviewGroupFilter.value.trim().toLowerCase()
  if (!keyword) return reviewActionTreeData.value
  return reviewActionTreeData.value
    .map((group) => {
      const children = group.children.filter((item) => {
        return (
          item.actionKey.toLowerCase().includes(keyword) ||
          item.actionName.toLowerCase().includes(keyword)
        )
      })
      if (!children.length) return null
      return { ...group, children }
    })
    .filter(Boolean) as typeof reviewActionTreeData.value
})

const selectReviewGroup = async (group: AdGroupItem) => {
  selectedReviewGroup.value = group
  try {
    const res = await getGroupReviewAclApi(group.group_dn)
    const keys = ((res.data as string[]) || []).map((x) =>
      String(x || '')
        .trim()
        .toUpperCase()
    )
    reviewGroupOriginalActionKeys.value = keys
    reviewGroupCheckedActionKeys.value = [...keys]
  } catch (error: any) {
    reviewGroupOriginalActionKeys.value = []
    reviewGroupCheckedActionKeys.value = []
    ElMessage.error('加载组接口审核权限失败: ' + (error?.message || '未知错误'))
  }
}

const toggleReviewGroupAction = (actionKey: string, checked: boolean) => {
  const current = new Set(reviewGroupCheckedActionKeys.value)
  if (checked) current.add(actionKey)
  else current.delete(actionKey)
  reviewGroupCheckedActionKeys.value = Array.from(current)
}

const resetReviewGroupSelection = () => {
  reviewGroupFilter.value = ''
  reviewGroupCheckedActionKeys.value = [...reviewGroupOriginalActionKeys.value]
}

const saveReviewGroupAcl = async () => {
  const group = selectedReviewGroup.value
  if (!group) return
  const originalSet = new Set(reviewGroupOriginalActionKeys.value)
  const currentSet = new Set(reviewGroupCheckedActionKeys.value)
  const toAdd = Array.from(currentSet).filter((x) => !originalSet.has(x))
  const toRemove = Array.from(originalSet).filter((x) => !currentSet.has(x))
  if (!toAdd.length && !toRemove.length) {
    ElMessage.info('接口审核权限未变化，无需保存')
    return
  }
  savingReviewGroupAcl.value = true
  try {
    if (toAdd.length) await assignGroupReviewAclApi(group.group_dn, group.group_name, toAdd)
    if (toRemove.length) await removeGroupReviewAclApi(group.group_dn, toRemove)
    reviewGroupOriginalActionKeys.value = [...reviewGroupCheckedActionKeys.value]
    ElMessage.success('组接口审核权限保存成功')
  } catch (error: any) {
    ElMessage.error('保存组接口审核权限失败: ' + (error?.message || '未知错误'))
  } finally {
    savingReviewGroupAcl.value = false
  }
}

const totalReviewActions = computed(() => reviewActions.value.length)
const checkedReviewUserActions = computed(() => reviewUserCheckedActionKeys.value.length)
const checkedReviewGroupActions = computed(() => reviewGroupCheckedActionKeys.value.length)

// ========================
// 模块能力权限（Capability）
// ========================

const capabilityActions = ref<CapabilityActionItem[]>([])
const loadingCapabilityActions = ref(false)

const capabilityActionColumns = [
  { code: 'READ', label: '读' },
  { code: 'CREATE', label: '增' },
  { code: 'UPDATE', label: '改' },
  { code: 'DELETE', label: '删' },
  { code: 'UPLOAD', label: '传' },
  { code: 'EXPORT', label: '导' },
  { code: 'APPROVE', label: '审' }
]

const loadCapabilityActions = async () => {
  loadingCapabilityActions.value = true
  try {
    const res = await getCapabilityActionsApi({ includeDisabled: 1 })
    capabilityActions.value = (res.data as CapabilityActionItem[]) || []
  } catch (error: any) {
    ElMessage.error('加载模块能力动作失败: ' + (error?.message || '未知错误'))
  } finally {
    loadingCapabilityActions.value = false
  }
}

const capabilityRouteActionMap = computed(() => {
  const routeMap = new Map<string, Map<string, string>>()
  capabilityActions.value.forEach((item) => {
    const routeName = String(item.routeName || '').trim()
    const actionCode = String(item.actionCode || '')
      .trim()
      .toUpperCase()
    const key = String(item.capabilityKey || '')
      .trim()
      .toUpperCase()
    if (!routeName || !actionCode || !key) return
    const actionMap = routeMap.get(routeName) || new Map<string, string>()
    actionMap.set(actionCode, key)
    routeMap.set(routeName, actionMap)
  })
  return routeMap
})

const getCapabilityKeyByRouteAction = (routeName: string, actionCode: string) => {
  const actionMap = capabilityRouteActionMap.value.get(String(routeName || '').trim())
  if (!actionMap) return ''
  return (
    actionMap.get(
      String(actionCode || '')
        .trim()
        .toUpperCase()
    ) || ''
  )
}

const getCapabilityKeysByRouteName = (routeName: string) => {
  const actionMap = capabilityRouteActionMap.value.get(String(routeName || '').trim())
  if (!actionMap) return []
  return Array.from(actionMap.values())
}

const userSelectedPageRows = computed(() => {
  const map = permissionMapByRouteName.value
  const keyword = userCapabilityFilter.value.trim().toLowerCase()
  return userCheckedRouteNames.value
    .map((routeName) => map.get(routeName))
    .filter(Boolean)
    .filter((perm) => {
      if (!keyword) return true
      const routeName = String(perm?.route_name || '').toLowerCase()
      const title = String(perm?.page_title || '').toLowerCase()
      return routeName.includes(keyword) || title.includes(keyword)
    }) as PermissionItem[]
})

const toggleUserRouteCapability = (routeName: string, actionCode: string, checked: boolean) => {
  const capKey = getCapabilityKeyByRouteAction(routeName, actionCode)
  if (!capKey) return
  const set = new Set(userCheckedCapabilityKeys.value)
  if (checked) set.add(capKey)
  else set.delete(capKey)
  userCheckedCapabilityKeys.value = Array.from(set)
}

const totalCapabilityActions = computed(() => capabilityActions.value.length)

// ========================
// 路由/权限同步
// ========================

const syncingRoutes = ref(false)

const handleSyncRoutes = async () => {
  if (syncingRoutes.value) return
  syncingRoutes.value = true
  try {
    const res = await syncRoutesApi()
    if ((res as any)?.success) {
      ElMessage.success((res as any).message || '路由权限同步成功')
      await loadPermissionList()
    } else {
      ElMessage.error(((res as any)?.message as string) || '路由权限同步失败')
    }
  } catch (error: any) {
    ElMessage.error('路由权限同步失败: ' + (error.message || '未知错误'))
  } finally {
    syncingRoutes.value = false
  }
}

// Tab 切换
const handleTabChange = (tab: string) => {
  if (tab === 'user' && adUsers.value.length === 0) {
    loadAdUsers()
  } else if (tab === 'group' && adGroups.value.length === 0) {
    loadAdGroups()
  } else if (tab === 'reviewAcl') {
    if (!reviewActions.value.length) loadReviewActions()
    if (!adUsers.value.length) loadAdUsers()
    if (!adGroups.value.length) loadAdGroups()
  }
}
</script>

<template>
  <ContentWrap>
    <div class="flex justify-end mb-10px">
      <BaseButton type="primary" size="small" :loading="syncingRoutes" @click="handleSyncRoutes">
        同步菜单权限
      </BaseButton>
    </div>
    <div class="center-nav">
      <BaseButton
        :type="activeTab === 'user' ? 'primary' : 'default'"
        @click="switchCenter('user')"
      >
        用户授权中心
      </BaseButton>
      <BaseButton
        :type="activeTab === 'group' ? 'primary' : 'default'"
        @click="switchCenter('group')"
      >
        组授权中心
      </BaseButton>
      <BaseButton
        :type="activeTab === 'reviewAcl' ? 'primary' : 'default'"
        @click="switchCenter('reviewAcl')"
      >
        审核权限中心
      </BaseButton>
    </div>

    <div class="center-content">
      <div v-if="activeTab === 'user'" class="user-center-layout">
        <div class="center-column user-list-column">
          <div class="permission-sidebar-header">
            <div class="permission-sidebar-title">第一步：选择用户</div>
            <div class="permission-sidebar-subtitle">选择后即可配置页面访问权与模块能力</div>
          </div>
          <div class="mb-10px">
            <ElInput
              v-model="userSearchKeyword"
              placeholder="按姓名 / 账号 / 邮箱搜索"
              clearable
              @keyup.enter="searchUsers"
              @clear="searchUsers"
            >
              <template #append>
                <BaseButton type="primary" @click="searchUsers">搜索</BaseButton>
              </template>
            </ElInput>
          </div>
          <ElTable
            v-loading="loadingUsers"
            :data="adUsers"
            size="small"
            height="520"
            highlight-current-row
            class="permission-sidebar-table"
            @row-click="selectUser"
          >
            <ElTableColumn
              prop="displayName"
              label="用户名"
              min-width="120"
              :formatter="(row: any) => row.displayName || row.username"
            />
            <ElTableColumn prop="username" label="账号" min-width="120" />
          </ElTable>
          <div class="permission-pagination">
            <ElPagination
              v-model:current-page="userPagination.page"
              v-model:page-size="userPagination.pageSize"
              :total="userPagination.total"
              layout="total, prev, pager, next, sizes"
              :page-sizes="[10, 20, 50]"
              small
              background
              @current-change="handleUserPageChange"
              @size-change="handleUserPageSizeChange"
            />
          </div>
        </div>

        <div class="center-column page-permission-column user-permission-panel">
          <div class="permission-sidebar-header">
            <div class="permission-sidebar-title">第二步：分配页面访问权</div>
            <div class="permission-sidebar-subtitle">
              <template v-if="selectedUser">
                当前用户：{{ selectedUser.displayName || selectedUser.username }}
              </template>
              <template v-else>请先在左侧选择用户</template>
            </div>
          </div>
          <div class="permission-toolbar">
            <div class="permission-toolbar-left">
              <ElInput
                v-model="userPermissionFilter"
                placeholder="筛选页面（按名称 / 路由名）"
                clearable
                style="width: 220px"
              />
              <span class="permission-toolbar-summary">
                已选 {{ checkedUserPermissionsCount }} / 共 {{ totalUserPermissions }} 个页面
              </span>
            </div>
          </div>
          <div
            v-loading="loadingUserPermissions || loadingPermissions"
            class="permission-tree user-permission-tree"
          >
            <template v-if="selectedUser && filteredUserPermissionTree.length">
              <div
                v-for="group in filteredUserPermissionTree"
                :key="group.key"
                class="permission-group"
              >
                <div class="permission-group-header">
                  <ElCheckbox
                    :indeterminate="isUserGroupIndeterminate(group.key)"
                    :model-value="isUserGroupChecked(group.key)"
                    @change="(val: boolean | string) => toggleUserGroupPermissions(group.key, !!val)"
                  >
                    <span class="permission-group-title">{{ group.label }}</span>
                  </ElCheckbox>
                </div>
                <div class="permission-group-body">
                  <div
                    v-for="perm in group.children"
                    :key="perm.route_name"
                    class="permission-item"
                  >
                    <ElCheckbox
                      :model-value="userCheckedRouteNames.includes(perm.route_name)"
                      @change="(val: boolean | string) => toggleUserPermission(perm.route_name, !!val)"
                    >
                      {{ perm.label }}
                    </ElCheckbox>
                  </div>
                </div>
              </div>
            </template>
            <template v-else-if="selectedUser">
              <ElEmpty description="未匹配到任何页面权限" />
            </template>
            <template v-else>
              <ElEmpty description="请先在左侧选择用户" />
            </template>
          </div>
        </div>

        <div class="center-column capability-column user-permission-panel">
          <div class="permission-sidebar-header">
            <div class="permission-sidebar-title">第三步：分配模块能力权限</div>
            <div class="permission-sidebar-subtitle">仅对已勾选页面开放能力配置</div>
          </div>
          <div class="permission-toolbar">
            <div class="permission-toolbar-left">
              <ElInput
                v-model="userCapabilityFilter"
                placeholder="筛选已选页面"
                clearable
                style="width: 180px"
              />
              <span class="permission-toolbar-summary">
                已选 {{ checkedUserCapabilityCount }} / 共 {{ totalCapabilityActions }} 个能力
              </span>
            </div>
            <div class="permission-toolbar-right">
              <BaseButton text type="primary" @click="resetUserPermissionSelection">
                重置
              </BaseButton>
            </div>
          </div>
          <div
            v-loading="loadingUserPermissions || loadingCapabilityActions"
            class="permission-tree capability-matrix"
          >
            <template v-if="selectedUser && userSelectedPageRows.length">
              <table class="capability-table">
                <thead>
                  <tr>
                    <th>页面</th>
                    <th v-for="col in capabilityActionColumns" :key="col.code">{{ col.label }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="perm in userSelectedPageRows" :key="perm.route_name">
                    <td class="capability-page-cell">{{ perm.page_title || perm.route_name }}</td>
                    <td
                      v-for="col in capabilityActionColumns"
                      :key="`${perm.route_name}-${col.code}`"
                    >
                      <ElCheckbox
                        v-if="getCapabilityKeyByRouteAction(perm.route_name, col.code)"
                        :model-value="
                          userCheckedCapabilityKeys.includes(
                            getCapabilityKeyByRouteAction(perm.route_name, col.code)
                          )
                        "
                        @change="
                          (val: boolean | string) =>
                            toggleUserRouteCapability(perm.route_name, col.code, !!val)
                        "
                      />
                      <span v-else>-</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </template>
            <template v-else-if="selectedUser">
              <ElEmpty description="请先在第二步勾选页面访问权" />
            </template>
            <template v-else>
              <ElEmpty description="请先在左侧选择用户" />
            </template>
          </div>

          <div class="permission-actions">
            <BaseButton
              type="primary"
              :loading="savingUserPermissions"
              @click="saveUserPermissions"
            >
              保存全部权限
            </BaseButton>
          </div>
        </div>
      </div>

      <!-- 组权限 -->
      <div v-else-if="activeTab === 'group'">
        <div class="permission-layout">
          <!-- 左侧：组列表 -->
          <div class="permission-sidebar">
            <div class="permission-sidebar-header">
              <div class="permission-sidebar-title">域安全组</div>
              <div class="permission-sidebar-subtitle">按用户组批量分配页面权限</div>
            </div>
            <div class="mb-10px">
              <ElInput
                v-model="groupSearchKeyword"
                placeholder="按组名 / 描述搜索"
                clearable
                @keyup.enter="searchGroups"
                @clear="searchGroups"
              >
                <template #append>
                  <BaseButton type="primary" @click="searchGroups">搜索</BaseButton>
                </template>
              </ElInput>
            </div>
            <ElTable
              v-loading="loadingGroups"
              :data="adGroups"
              size="small"
              height="380"
              highlight-current-row
              class="permission-sidebar-table"
              @row-click="selectGroup"
            >
              <ElTableColumn prop="group_name" label="组名" min-width="150" />
              <ElTableColumn
                prop="description"
                label="说明"
                min-width="160"
                show-overflow-tooltip
              />
              <ElTableColumn
                prop="memberCount"
                label="成员数"
                width="80"
                align="center"
                :formatter="(_, __, row: any) => row.memberCount ?? '-'"
              />
            </ElTable>
            <div class="permission-pagination">
              <ElPagination
                v-model:current-page="groupPagination.page"
                v-model:page-size="groupPagination.pageSize"
                :total="groupPagination.total"
                layout="total, prev, pager, next, sizes"
                :page-sizes="[10, 20, 50]"
                small
                background
                @current-change="handleGroupPageChange"
                @size-change="handleGroupPageSizeChange"
              />
            </div>
          </div>

          <!-- 右侧：权限面板 -->
          <div class="permission-main">
            <div v-if="!selectedGroup" class="permission-empty">
              <ElEmpty description="请先在左侧选择一个 AD 组" />
            </div>
            <div v-else class="group-permission-panel">
              <div class="permission-main-header">
                <div>
                  <div class="permission-main-title">
                    {{ selectedGroup.group_name }}
                  </div>
                  <div class="permission-main-subtitle">
                    DN：{{ selectedGroup.group_dn }}
                    <template v-if="selectedGroup.description">
                      <ElDivider direction="vertical" />
                      {{ selectedGroup.description }}
                    </template>
                  </div>
                </div>
              </div>

              <ElDivider />

              <div class="permission-toolbar">
                <div class="permission-toolbar-left">
                  <ElInput
                    v-model="groupPermissionFilter"
                    placeholder="筛选权限（按页面名称 / 路由名）"
                    clearable
                    style="width: 260px"
                  />
                  <span class="permission-toolbar-summary">
                    已选 {{ checkedGroupPermissionsCount }} / 共 {{ totalGroupPermissions }} 个权限
                  </span>
                </div>
                <div class="permission-toolbar-right">
                  <BaseButton text type="primary" @click="resetGroupPermissionSelection">
                    重置为已保存状态
                  </BaseButton>
                </div>
              </div>

              <div
                v-loading="loadingGroupPermissions || loadingPermissions"
                class="permission-tree group-permission-tree"
              >
                <template v-if="filteredGroupPermissionTree.length">
                  <div
                    v-for="group in filteredGroupPermissionTree"
                    :key="group.key"
                    class="permission-group"
                  >
                    <div class="permission-group-header">
                      <ElCheckbox
                        :indeterminate="isGroupGroupIndeterminate(group.key)"
                        :model-value="isGroupGroupChecked(group.key)"
                        @change="(val: boolean | string) => toggleGroupGroupPermissions(group.key, !!val)"
                      >
                        <span class="permission-group-title">{{ group.label }}</span>
                      </ElCheckbox>
                    </div>
                    <div class="permission-group-body">
                      <div
                        v-for="perm in group.children"
                        :key="perm.route_name"
                        class="permission-item"
                      >
                        <ElCheckbox
                          :model-value="groupCheckedRouteNames.includes(perm.route_name)"
                          @change="(val: boolean | string) => toggleGroupPermission(perm.route_name, !!val)"
                        >
                          {{ perm.label }}
                        </ElCheckbox>
                      </div>
                    </div>
                  </div>
                </template>
                <template v-else>
                  <ElEmpty description="未匹配到任何权限，请尝试调整筛选条件" />
                </template>
              </div>

              <div class="permission-actions">
                <BaseButton
                  type="primary"
                  :loading="savingGroupPermissions"
                  @click="saveGroupPermissions"
                >
                  保存组权限
                </BaseButton>
                <BaseButton text @click="resetGroupPermissionSelection"> 取消修改 </BaseButton>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 接口审核权限 -->
      <div v-else-if="activeTab === 'reviewAcl'">
        <ElTabs v-model="reviewAclTab">
          <ElTabPane label="按用户配置" name="user">
            <div class="permission-layout">
              <div class="permission-sidebar">
                <div class="permission-sidebar-header">
                  <div class="permission-sidebar-title">域用户</div>
                  <div class="permission-sidebar-subtitle">选择用户后配置“可审核动作”</div>
                </div>
                <div class="mb-10px">
                  <ElInput
                    v-model="userSearchKeyword"
                    placeholder="按姓名 / 账号 / 邮箱搜索"
                    clearable
                    @keyup.enter="searchUsers"
                    @clear="searchUsers"
                  >
                    <template #append>
                      <BaseButton type="primary" @click="searchUsers">搜索</BaseButton>
                    </template>
                  </ElInput>
                </div>
                <ElTable
                  v-loading="loadingUsers"
                  :data="adUsers"
                  size="small"
                  height="380"
                  highlight-current-row
                  class="permission-sidebar-table"
                  @row-click="selectReviewUser"
                >
                  <ElTableColumn
                    prop="displayName"
                    label="用户名"
                    min-width="120"
                    :formatter="(row: any) => row.displayName || row.username"
                  />
                  <ElTableColumn prop="username" label="账号" min-width="120" />
                </ElTable>
                <div class="permission-pagination">
                  <ElPagination
                    v-model:current-page="userPagination.page"
                    v-model:page-size="userPagination.pageSize"
                    :total="userPagination.total"
                    layout="total, prev, pager, next, sizes"
                    :page-sizes="[10, 20, 50]"
                    small
                    background
                    @current-change="handleUserPageChange"
                    @size-change="handleUserPageSizeChange"
                  />
                </div>
              </div>

              <div class="permission-main">
                <div v-if="!selectedReviewUser" class="permission-empty">
                  <ElEmpty description="请先在左侧选择一个用户" />
                </div>
                <div v-else class="user-permission-panel">
                  <div class="permission-main-header">
                    <div>
                      <div class="permission-main-title">
                        {{ selectedReviewUser.displayName || selectedReviewUser.username }}
                      </div>
                      <div class="permission-main-subtitle">
                        账号：{{ selectedReviewUser.username }}
                      </div>
                    </div>
                  </div>
                  <ElDivider />
                  <div class="permission-toolbar">
                    <div class="permission-toolbar-left">
                      <ElInput
                        v-model="reviewUserFilter"
                        placeholder="筛选审核动作（按名称/Key）"
                        clearable
                        style="width: 260px"
                      />
                      <span class="permission-toolbar-summary">
                        已选 {{ checkedReviewUserActions }} / 共 {{ totalReviewActions }} 个动作
                      </span>
                    </div>
                    <div class="permission-toolbar-right">
                      <BaseButton text type="primary" @click="resetReviewUserSelection">
                        重置为已保存状态
                      </BaseButton>
                    </div>
                  </div>
                  <div v-loading="loadingReviewActions" class="permission-tree">
                    <template v-if="filteredReviewActionTreeByUser.length">
                      <div
                        v-for="group in filteredReviewActionTreeByUser"
                        :key="group.key"
                        class="permission-group"
                      >
                        <div class="permission-group-header">
                          <span class="permission-group-title">{{ group.label }}</span>
                        </div>
                        <div class="permission-group-body">
                          <div
                            v-for="item in group.children"
                            :key="item.actionKey"
                            class="permission-item"
                          >
                            <ElCheckbox
                              :model-value="reviewUserCheckedActionKeys.includes(item.actionKey)"
                              @change="(val: boolean | string) => toggleReviewUserAction(item.actionKey, !!val)"
                            >
                              {{ item.actionName }} ({{ item.actionKey }})
                            </ElCheckbox>
                          </div>
                        </div>
                      </div>
                    </template>
                    <template v-else>
                      <ElEmpty description="未匹配到任何审核动作" />
                    </template>
                  </div>
                  <div class="permission-actions">
                    <BaseButton
                      type="primary"
                      :loading="savingReviewUserAcl"
                      @click="saveReviewUserAcl"
                    >
                      保存用户接口审核权限
                    </BaseButton>
                    <BaseButton text @click="resetReviewUserSelection">取消修改</BaseButton>
                  </div>
                </div>
              </div>
            </div>
          </ElTabPane>

          <ElTabPane label="按组配置" name="group">
            <div class="permission-layout">
              <div class="permission-sidebar">
                <div class="permission-sidebar-header">
                  <div class="permission-sidebar-title">域安全组</div>
                  <div class="permission-sidebar-subtitle">按组批量配置“可审核动作”</div>
                </div>
                <div class="mb-10px">
                  <ElInput
                    v-model="groupSearchKeyword"
                    placeholder="按组名 / 描述搜索"
                    clearable
                    @keyup.enter="searchGroups"
                    @clear="searchGroups"
                  >
                    <template #append>
                      <BaseButton type="primary" @click="searchGroups">搜索</BaseButton>
                    </template>
                  </ElInput>
                </div>
                <ElTable
                  v-loading="loadingGroups"
                  :data="adGroups"
                  size="small"
                  height="380"
                  highlight-current-row
                  class="permission-sidebar-table"
                  @row-click="selectReviewGroup"
                >
                  <ElTableColumn prop="group_name" label="组名" min-width="150" />
                  <ElTableColumn
                    prop="description"
                    label="说明"
                    min-width="150"
                    show-overflow-tooltip
                  />
                </ElTable>
                <div class="permission-pagination">
                  <ElPagination
                    v-model:current-page="groupPagination.page"
                    v-model:page-size="groupPagination.pageSize"
                    :total="groupPagination.total"
                    layout="total, prev, pager, next, sizes"
                    :page-sizes="[10, 20, 50]"
                    small
                    background
                    @current-change="handleGroupPageChange"
                    @size-change="handleGroupPageSizeChange"
                  />
                </div>
              </div>

              <div class="permission-main">
                <div v-if="!selectedReviewGroup" class="permission-empty">
                  <ElEmpty description="请先在左侧选择一个 AD 组" />
                </div>
                <div v-else class="group-permission-panel">
                  <div class="permission-main-header">
                    <div>
                      <div class="permission-main-title">{{ selectedReviewGroup.group_name }}</div>
                      <div class="permission-main-subtitle"
                        >DN：{{ selectedReviewGroup.group_dn }}</div
                      >
                    </div>
                  </div>
                  <ElDivider />
                  <div class="permission-toolbar">
                    <div class="permission-toolbar-left">
                      <ElInput
                        v-model="reviewGroupFilter"
                        placeholder="筛选审核动作（按名称/Key）"
                        clearable
                        style="width: 260px"
                      />
                      <span class="permission-toolbar-summary">
                        已选 {{ checkedReviewGroupActions }} / 共 {{ totalReviewActions }} 个动作
                      </span>
                    </div>
                    <div class="permission-toolbar-right">
                      <BaseButton text type="primary" @click="resetReviewGroupSelection">
                        重置为已保存状态
                      </BaseButton>
                    </div>
                  </div>
                  <div v-loading="loadingReviewActions" class="permission-tree">
                    <template v-if="filteredReviewActionTreeByGroup.length">
                      <div
                        v-for="group in filteredReviewActionTreeByGroup"
                        :key="group.key"
                        class="permission-group"
                      >
                        <div class="permission-group-header">
                          <span class="permission-group-title">{{ group.label }}</span>
                        </div>
                        <div class="permission-group-body">
                          <div
                            v-for="item in group.children"
                            :key="item.actionKey"
                            class="permission-item"
                          >
                            <ElCheckbox
                              :model-value="reviewGroupCheckedActionKeys.includes(item.actionKey)"
                              @change="(val: boolean | string) => toggleReviewGroupAction(item.actionKey, !!val)"
                            >
                              {{ item.actionName }} ({{ item.actionKey }})
                            </ElCheckbox>
                          </div>
                        </div>
                      </div>
                    </template>
                    <template v-else>
                      <ElEmpty description="未匹配到任何审核动作" />
                    </template>
                  </div>
                  <div class="permission-actions">
                    <BaseButton
                      type="primary"
                      :loading="savingReviewGroupAcl"
                      @click="saveReviewGroupAcl"
                    >
                      保存组接口审核权限
                    </BaseButton>
                    <BaseButton text @click="resetReviewGroupSelection">取消修改</BaseButton>
                  </div>
                </div>
              </div>
            </div>
          </ElTabPane>
        </ElTabs>
      </div>
    </div>
  </ContentWrap>
</template>

<style scoped>
.center-nav {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.center-content {
  min-height: 600px;
}

.user-center-layout {
  display: grid;
  grid-template-columns: 320px 0.85fr 1.35fr;
  gap: 12px;
  align-items: stretch;
  min-height: 620px;
}

.permission-layout {
  display: flex;
  width: 100%;
  min-height: 600px;
}

.permission-sidebar {
  display: flex;
  width: 340px;
  padding-right: 20px;
  border-right: 1px solid #e5e7eb;
  flex-direction: column;
}

.center-column {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px;
  min-height: 620px;
  display: flex;
  flex-direction: column;
}

.user-list-column {
  padding-right: 12px;
}

.capability-column {
  overflow: hidden;
}

.permission-sidebar-header {
  margin-bottom: 8px;
}

.permission-sidebar-title {
  font-size: 14px;
  font-weight: 600;
}

.permission-sidebar-subtitle {
  font-size: 12px;
  color: #6b7280;
}

.permission-sidebar-table {
  margin-top: 6px;
}

.permission-pagination {
  margin-top: 10px;
  text-align: right;
}

.permission-main {
  display: flex;
  padding-left: 20px;
  flex: 1;
  flex-direction: column;
}

.permission-empty {
  margin-top: 120px;
}

.permission-main-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.permission-main-title {
  font-size: 16px;
  font-weight: 600;
}

.permission-main-subtitle {
  margin-top: 4px;
  font-size: 12px;
  color: #6b7280;
}

.permission-main-tags {
  max-width: 420px;
  text-align: right;
}

.permission-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.permission-toolbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.permission-toolbar-right {
  display: flex;
  gap: 8px;
}

.permission-toolbar-summary {
  font-size: 12px;
  color: #6b7280;
}

.permission-tree {
  max-height: 420px;
  padding: 10px 12px;
  overflow: auto;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  flex: 1;
}

.capability-matrix {
  max-height: 500px;
  padding: 0;
}

.capability-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.capability-table th,
.capability-table td {
  border: 1px solid #e5e7eb;
  text-align: center;
  padding: 6px 4px;
}

.capability-page-cell {
  text-align: left !important;
  min-width: 180px;
}

.permission-group {
  margin-bottom: 16px;
}

.permission-group:last-child {
  margin-bottom: 0;
}

.permission-group-header {
  padding-bottom: 6px;
  margin-bottom: 6px;
  border-bottom: 1px solid #e5e7eb;
}

.permission-group-title {
  font-weight: 600;
}

.permission-group-body {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
}

.permission-item {
  min-width: 260px;
}

.permission-actions {
  display: flex;
  margin-top: 12px;
  gap: 8px;
  justify-content: flex-end;
}
</style>
