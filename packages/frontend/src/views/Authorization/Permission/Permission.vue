<script setup lang="tsx">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { ContentWrap } from '@/components/ContentWrap'
import {
  ElTabs,
  ElTabPane,
  ElInput,
  ElCheckbox,
  ElMessage,
  ElTag,
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
  getDirectUserPermissionsApi,
  getEffectiveUserPermissionsApi,
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
  assignGroupCapabilitiesApi,
  assignUserCapabilitiesApi,
  getCapabilityActionsApi,
  getEffectiveUserCapabilitiesApi,
  getGroupCapabilitiesApi,
  getUserCapabilitiesApi,
  removeGroupCapabilitiesApi,
  removeUserCapabilitiesApi,
  type CapabilityActionItem
} from '@/api/capability'

// ========================
// 通用状态
// ========================

const activeTab = ref('user')
const isMobile = ref(false)

const updateIsMobile = () => {
  if (typeof window === 'undefined') return
  isMobile.value = window.innerWidth <= 900
}

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
const userEffectiveRouteNames = ref<string[]>([])
const userPermissionFilter = ref('')
const userOriginalCapabilityKeys = ref<string[]>([])
const userCheckedCapabilityKeys = ref<string[]>([])
const userEffectiveCapabilityKeys = ref<string[]>([])
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
    const [directPermissionRes, effectivePermissionRes, capabilityRes, effectiveCapabilityRes] =
      await Promise.all([
        getDirectUserPermissionsApi(user.username),
        getEffectiveUserPermissionsApi(user.username),
        getUserCapabilitiesApi(user.username),
        getEffectiveUserCapabilitiesApi(user.username)
      ])
    const directPermissions = (directPermissionRes.data as any[]) || []
    const effectivePermissions = (effectivePermissionRes.data as any[]) || []
    const capabilities = ((capabilityRes.data as string[]) || []).map((x) =>
      String(x || '')
        .trim()
        .toUpperCase()
    )
    const effectiveCapabilities = ((effectiveCapabilityRes.data as string[]) || []).map((x) =>
      String(x || '')
        .trim()
        .toUpperCase()
    )
    userOriginalRouteNames.value = directPermissions
    userCheckedRouteNames.value = [...directPermissions]
    userEffectiveRouteNames.value = effectivePermissions
    userOriginalCapabilityKeys.value = capabilities
    userCheckedCapabilityKeys.value = [...capabilities]
    userEffectiveCapabilityKeys.value = effectiveCapabilities
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
  }
  userCheckedRouteNames.value = Array.from(current)
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

  if (
    toAddRouteNames.length !== toAddIds.length ||
    toRemoveRouteNames.length !== toRemoveIds.length
  ) {
    ElMessage.warning('页面权限映射不完整，请先同步菜单权限后再保存')
    return
  }

  if (!validateUserPermissionSelection(toAddCapabilityKeys)) {
    return
  }

  savingUserPermissions.value = true
  const loading = ElLoading.service({ target: '.user-permission-panel' })
  try {
    const expectedRouteNames = [...userCheckedRouteNames.value]
    const expectedCapabilityKeys = [...userCheckedCapabilityKeys.value]

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

    await selectUser(selectedUser.value)
    if (
      !arraysEqual(userOriginalRouteNames.value, expectedRouteNames) ||
      !arraysEqual(userOriginalCapabilityKeys.value, expectedCapabilityKeys)
    ) {
      ElMessage.warning('保存已完成，但服务端回读结果与本次勾选不完全一致，请立即复核')
      return
    }
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
  updateIsMobile()
  window.addEventListener('resize', updateIsMobile)
  loadPermissionList()
  loadAdUsers()
  loadReviewActions()
  loadCapabilityActions()
})

onBeforeUnmount(() => {
  if (typeof window === 'undefined') return
  window.removeEventListener('resize', updateIsMobile)
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
const groupOriginalCapabilityKeys = ref<string[]>([])
const groupCheckedCapabilityKeys = ref<string[]>([])
const savingGroupPermissions = ref(false)
const groupPermissionFilter = ref('')
const groupCapabilityFilter = ref('')

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
    const [permissionRes, capabilityRes] = await Promise.all([
      getGroupPermissionsApi(group.group_dn),
      getGroupCapabilitiesApi(group.group_dn)
    ])
    const permissions = (permissionRes.data as any[]) || []
    const capabilities = ((capabilityRes.data as string[]) || []).map((x) =>
      String(x || '')
        .trim()
        .toUpperCase()
    )
    groupOriginalRouteNames.value = permissions
    groupCheckedRouteNames.value = [...permissions]
    groupOriginalCapabilityKeys.value = capabilities
    groupCheckedCapabilityKeys.value = [...capabilities]
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
  groupCapabilityFilter.value = ''
  groupCheckedRouteNames.value = [...groupOriginalRouteNames.value]
  groupCheckedCapabilityKeys.value = [...groupOriginalCapabilityKeys.value]
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

  const originalCapabilitySet = new Set(groupOriginalCapabilityKeys.value)
  const currentCapabilitySet = new Set(groupCheckedCapabilityKeys.value)
  const toAddCapabilityKeys = Array.from(currentCapabilitySet).filter(
    (x) => !originalCapabilitySet.has(x)
  )
  const toRemoveCapabilityKeys = Array.from(originalCapabilitySet).filter(
    (x) => !currentCapabilitySet.has(x)
  )

  if (
    !toAddRouteNames.length &&
    !toRemoveRouteNames.length &&
    !toAddCapabilityKeys.length &&
    !toRemoveCapabilityKeys.length
  ) {
    ElMessage.info('权限未变化，无需保存')
    return
  }

  savingGroupPermissions.value = true
  const loading = ElLoading.service({ target: '.group-permission-panel' })
  try {
    if (toAddIds.length) {
      await assignGroupPermissionsApi(groupDn, toAddIds, selectedGroup.value?.group_name || '')
    }

    if (toRemoveIds.length) {
      await removeGroupPermissionsApi(groupDn, toRemoveIds)
    }

    if (toAddCapabilityKeys.length) {
      await assignGroupCapabilitiesApi(
        groupDn,
        toAddCapabilityKeys,
        selectedGroup.value?.group_name || ''
      )
    }

    if (toRemoveCapabilityKeys.length) {
      await removeGroupCapabilitiesApi(groupDn, toRemoveCapabilityKeys)
    }

    await selectGroup(selectedGroup.value)
    ElMessage.success('组权限保存成功（页面权限 + 模块能力权限）')
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
const checkedGroupCapabilityCount = computed(() => groupCheckedCapabilityKeys.value.length)

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

const capabilityKeyRouteMap = computed(() => {
  const map = new Map<string, string>()
  capabilityActions.value.forEach((item) => {
    const capabilityKey = String(item.capabilityKey || '')
      .trim()
      .toUpperCase()
    const routeName = String(item.routeName || '').trim()
    if (!capabilityKey || !routeName) return
    map.set(capabilityKey, routeName)
  })
  return map
})

const getRouteNamesByCapabilityKeys = (capabilityKeys: string[]) => {
  const routeNames = new Set<string>()
  capabilityKeys.forEach((key) => {
    const routeName = capabilityKeyRouteMap.value.get(
      String(key || '')
        .trim()
        .toUpperCase()
    )
    if (routeName) routeNames.add(routeName)
  })
  return Array.from(routeNames)
}

const capabilityActionMap = computed(() => {
  const map = new Map<string, CapabilityActionItem>()
  capabilityActions.value.forEach((item) => {
    const key = String(item.capabilityKey || '')
      .trim()
      .toUpperCase()
    if (!key) return
    map.set(key, item)
  })
  return map
})

const summarizeList = (items: string[], limit = 4) => {
  const list = Array.from(new Set(items.filter(Boolean)))
  return {
    items: list.slice(0, limit),
    overflow: Math.max(list.length - limit, 0),
    total: list.length
  }
}

const userSelectedPageRows = computed(() => {
  const map = permissionMapByRouteName.value
  const keyword = userCapabilityFilter.value.trim().toLowerCase()
  const routeNames = Array.from(
    new Set([
      ...userCheckedRouteNames.value,
      ...getRouteNamesByCapabilityKeys(userCheckedCapabilityKeys.value)
    ])
  )
  return routeNames
    .map((routeName) => map.get(routeName))
    .filter(Boolean)
    .filter((perm) => {
      if (!keyword) return true
      const routeName = String(perm?.route_name || '').toLowerCase()
      const title = String(perm?.page_title || '').toLowerCase()
      return routeName.includes(keyword) || title.includes(keyword)
    }) as PermissionItem[]
})

const groupSelectedPageRows = computed(() => {
  const map = permissionMapByRouteName.value
  const keyword = groupCapabilityFilter.value.trim().toLowerCase()
  const routeNames = Array.from(
    new Set([
      ...groupCheckedRouteNames.value,
      ...getRouteNamesByCapabilityKeys(groupCheckedCapabilityKeys.value)
    ])
  )
  return routeNames
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

const toggleGroupRouteCapability = (routeName: string, actionCode: string, checked: boolean) => {
  const capKey = getCapabilityKeyByRouteAction(routeName, actionCode)
  if (!capKey) return
  const set = new Set(groupCheckedCapabilityKeys.value)
  if (checked) set.add(capKey)
  else set.delete(capKey)
  groupCheckedCapabilityKeys.value = Array.from(set)
}

const totalCapabilityActions = computed(() => capabilityActions.value.length)
const userDirectPermissionSet = computed(() => new Set(userCheckedRouteNames.value))
const userEffectivePermissionSet = computed(() => new Set(userEffectiveRouteNames.value))
const userDirectCapabilitySet = computed(() => new Set(userCheckedCapabilityKeys.value))
const userEffectiveCapabilitySet = computed(() => new Set(userEffectiveCapabilityKeys.value))
const userInheritedRouteNames = computed(() =>
  userEffectiveRouteNames.value.filter(
    (routeName) => !userCheckedRouteNames.value.includes(routeName)
  )
)
const userInheritedCapabilityKeys = computed(() =>
  userEffectiveCapabilityKeys.value.filter((key) => !userCheckedCapabilityKeys.value.includes(key))
)
const userCapabilityOnlyRouteNames = computed(() => {
  const routeSet = new Set(getRouteNamesByCapabilityKeys(userCheckedCapabilityKeys.value))
  userCheckedRouteNames.value.forEach((routeName) => routeSet.delete(routeName))
  return Array.from(routeSet)
})
const userUnknownCapabilityKeys = computed(() =>
  userCheckedCapabilityKeys.value.filter((key) => !capabilityActionMap.value.has(key))
)
const userPermissionOverview = computed(() => ({
  direct: userCheckedRouteNames.value.length,
  inherited: userInheritedRouteNames.value.length,
  effective: userEffectiveRouteNames.value.length,
  inheritedSummary: summarizeList(
    userInheritedRouteNames.value.map((routeName) => {
      const item = permissionMapByRouteName.value.get(routeName)
      return item?.page_title || routeName
    })
  )
}))
const userCapabilityOverview = computed(() => ({
  direct: userCheckedCapabilityKeys.value.length,
  inherited: userInheritedCapabilityKeys.value.length,
  effective: userEffectiveCapabilityKeys.value.length,
  inheritedSummary: summarizeList(
    userInheritedCapabilityKeys.value.map(
      (key) => capabilityActionMap.value.get(key)?.capabilityName || key
    )
  )
}))
const userRiskOverview = computed(() => ({
  orphanRoutes: summarizeList(
    userCapabilityOnlyRouteNames.value.map((routeName) => {
      const item = permissionMapByRouteName.value.get(routeName)
      return item?.page_title || routeName
    })
  ),
  unknownCapabilities: summarizeList(userUnknownCapabilityKeys.value)
}))

const isUserInheritedPermission = (routeName: string) => {
  return (
    !userDirectPermissionSet.value.has(routeName) && userEffectivePermissionSet.value.has(routeName)
  )
}

const isUserInheritedCapability = (routeName: string, actionCode: string) => {
  const capKey = getCapabilityKeyByRouteAction(routeName, actionCode)
  if (!capKey) return false
  return !userDirectCapabilitySet.value.has(capKey) && userEffectiveCapabilitySet.value.has(capKey)
}

const arraysEqual = (left: string[], right: string[]) => {
  const a = [...left].sort()
  const b = [...right].sort()
  if (a.length !== b.length) return false
  return a.every((item, index) => item === b[index])
}

const validateUserPermissionSelection = (toAddCapabilityKeys: string[]) => {
  const missingRouteNames = new Set<string>()
  toAddCapabilityKeys.forEach((key) => {
    const routeName = capabilityKeyRouteMap.value.get(
      String(key || '')
        .trim()
        .toUpperCase()
    )
    if (!routeName) return
    const accessible =
      userCheckedRouteNames.value.includes(routeName) ||
      userEffectiveRouteNames.value.includes(routeName)
    if (!accessible) missingRouteNames.add(routeName)
  })

  if (missingRouteNames.size) {
    const labels = Array.from(missingRouteNames).map((routeName) => {
      const item = permissionMapByRouteName.value.get(routeName)
      return item?.page_title || routeName
    })
    ElMessage.warning(
      `以下页面没有可生效的访问权，不能新增模块能力：${labels.slice(0, 4).join('、')}${
        labels.length > 4 ? ' 等' : ''
      }`
    )
    return false
  }

  if (userUnknownCapabilityKeys.value.length) {
    ElMessage.warning('存在未注册的模块能力键，请先清理异常能力后再保存')
    return false
  }

  return true
}

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
    <div class="permission-shell">
      <div class="permission-page-head">
        <div class="permission-page-copy">
          <div class="permission-page-eyebrow">Authorization Workbench</div>
          <h2 class="permission-page-title">权限管理</h2>
          <p class="permission-page-desc">
            用更适合手机端的顺序组织用户、组与审核动作配置，减少横向表格依赖。
          </p>
        </div>
        <BaseButton
          type="primary"
          size="small"
          class="permission-sync-button"
          :loading="syncingRoutes"
          @click="handleSyncRoutes"
        >
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
          <div v-if="selectedUser" class="user-overview-panel">
            <div class="overview-card">
              <div class="overview-card-title">页面权限来源</div>
              <div class="overview-card-stats">
                <div class="overview-stat">
                  <span class="overview-stat-label">直绑</span>
                  <strong>{{ userPermissionOverview.direct }}</strong>
                </div>
                <div class="overview-stat">
                  <span class="overview-stat-label">组继承</span>
                  <strong>{{ userPermissionOverview.inherited }}</strong>
                </div>
                <div class="overview-stat">
                  <span class="overview-stat-label">最终生效</span>
                  <strong>{{ userPermissionOverview.effective }}</strong>
                </div>
              </div>
              <div class="overview-card-subtitle">组继承页面</div>
              <div v-if="userPermissionOverview.inheritedSummary.total" class="overview-tags">
                <ElTag
                  v-for="item in userPermissionOverview.inheritedSummary.items"
                  :key="item"
                  size="small"
                  type="info"
                >
                  {{ item }}
                </ElTag>
                <span v-if="userPermissionOverview.inheritedSummary.overflow" class="overview-more">
                  +{{ userPermissionOverview.inheritedSummary.overflow }}
                </span>
              </div>
              <div v-else class="overview-empty">当前没有组继承页面</div>
            </div>

            <div class="overview-card">
              <div class="overview-card-title">模块能力来源</div>
              <div class="overview-card-stats">
                <div class="overview-stat">
                  <span class="overview-stat-label">直绑</span>
                  <strong>{{ userCapabilityOverview.direct }}</strong>
                </div>
                <div class="overview-stat">
                  <span class="overview-stat-label">组继承</span>
                  <strong>{{ userCapabilityOverview.inherited }}</strong>
                </div>
                <div class="overview-stat">
                  <span class="overview-stat-label">最终生效</span>
                  <strong>{{ userCapabilityOverview.effective }}</strong>
                </div>
              </div>
              <div class="overview-card-subtitle">组继承能力</div>
              <div v-if="userCapabilityOverview.inheritedSummary.total" class="overview-tags">
                <ElTag
                  v-for="item in userCapabilityOverview.inheritedSummary.items"
                  :key="item"
                  size="small"
                  type="success"
                >
                  {{ item }}
                </ElTag>
                <span v-if="userCapabilityOverview.inheritedSummary.overflow" class="overview-more">
                  +{{ userCapabilityOverview.inheritedSummary.overflow }}
                </span>
              </div>
              <div v-else class="overview-empty">当前没有组继承能力</div>
            </div>

            <div class="overview-card risk">
              <div class="overview-card-title">异常与风险</div>
              <div class="overview-card-subtitle">这些状态会影响授权的稳定性和可解释性</div>
              <div class="overview-risk-row">
                <span>能力无页面入口</span>
                <strong>{{ userRiskOverview.orphanRoutes.total }}</strong>
              </div>
              <div v-if="userRiskOverview.orphanRoutes.total" class="overview-tags">
                <ElTag
                  v-for="item in userRiskOverview.orphanRoutes.items"
                  :key="item"
                  size="small"
                  type="warning"
                >
                  {{ item }}
                </ElTag>
                <span v-if="userRiskOverview.orphanRoutes.overflow" class="overview-more">
                  +{{ userRiskOverview.orphanRoutes.overflow }}
                </span>
              </div>
              <div class="overview-risk-row">
                <span>未注册能力键</span>
                <strong>{{ userRiskOverview.unknownCapabilities.total }}</strong>
              </div>
              <div v-if="userRiskOverview.unknownCapabilities.total" class="overview-tags">
                <ElTag
                  v-for="item in userRiskOverview.unknownCapabilities.items"
                  :key="item"
                  size="small"
                  type="danger"
                >
                  {{ item }}
                </ElTag>
                <span v-if="userRiskOverview.unknownCapabilities.overflow" class="overview-more">
                  +{{ userRiskOverview.unknownCapabilities.overflow }}
                </span>
              </div>
              <div
                v-if="
                  !userRiskOverview.orphanRoutes.total &&
                  !userRiskOverview.unknownCapabilities.total
                "
                class="overview-empty"
              >
                当前没有发现明显异常
              </div>
            </div>
          </div>

          <div class="center-column user-list-column permission-panel-card">
            <div class="permission-sidebar-header">
              <div class="permission-sidebar-step">STEP 1</div>
              <div class="permission-sidebar-title">选择用户</div>
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
            <div v-if="selectedUser && isMobile" class="permission-mobile-target">
              <span class="permission-mobile-target__label">当前用户</span>
              <strong>{{ selectedUser.displayName || selectedUser.username }}</strong>
              <span class="permission-mobile-target__meta">{{ selectedUser.username }}</span>
            </div>
            <ElTable
              v-loading="loadingUsers"
              :data="adUsers"
              size="small"
              :height="isMobile ? 300 : 520"
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

          <div
            class="center-column page-permission-column user-permission-panel permission-panel-card"
          >
            <div class="permission-sidebar-header">
              <div class="permission-sidebar-step">STEP 2</div>
              <div class="permission-sidebar-title">分配页面访问权</div>
              <div class="permission-sidebar-subtitle">
                <template v-if="selectedUser">
                  当前用户：{{ selectedUser.displayName || selectedUser.username }}
                </template>
                <template v-else>请先在左侧选择用户</template>
              </div>
              <div v-if="selectedUser" class="permission-sidebar-meta">
                所属组：
                <template v-if="loadingUserGroups">加载中...</template>
                <template v-else-if="selectedUserGroups.length">
                  {{
                    selectedUserGroups.map((item) => item.group_name || item.group_dn).join(' / ')
                  }}
                </template>
                <template v-else>无</template>
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
            <div class="permission-hint">
              这里编辑的是用户直绑页面权限；带“组继承”的页面当前会生效，但需到组授权中心调整。
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
                        <span
                          v-if="isUserInheritedPermission(perm.route_name)"
                          class="permission-tag"
                        >
                          组继承
                        </span>
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

          <div class="center-column capability-column user-permission-panel permission-panel-card">
            <div class="permission-sidebar-header">
              <div class="permission-sidebar-step">STEP 3</div>
              <div class="permission-sidebar-title">分配模块能力权限</div>
              <div class="permission-sidebar-subtitle">
                编辑用户直绑能力；组继承能力只显示标记，不会在这里被移除
              </div>
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
            <div v-if="userCapabilityOnlyRouteNames.length" class="permission-hint warning">
              存在
              {{ userCapabilityOnlyRouteNames.length }}
              个仅保留能力绑定、但未勾选页面访问权的页面，已自动纳入第三步显示以便清理。
            </div>
            <div
              v-loading="loadingUserPermissions || loadingCapabilityActions"
              class="permission-tree capability-matrix"
            >
              <template v-if="selectedUser && userSelectedPageRows.length">
                <div v-if="isMobile" class="capability-mobile-list">
                  <div
                    v-for="perm in userSelectedPageRows"
                    :key="perm.route_name"
                    class="capability-mobile-card"
                  >
                    <div class="capability-mobile-card__header">
                      <div>
                        <div class="capability-mobile-card__title">
                          {{ perm.page_title || perm.route_name }}
                        </div>
                        <div class="capability-mobile-card__route">{{ perm.route_name }}</div>
                      </div>
                      <span
                        v-if="isUserInheritedPermission(perm.route_name)"
                        class="permission-tag inline"
                      >
                        组继承页面
                      </span>
                    </div>
                    <div class="capability-mobile-grid">
                      <div
                        v-for="col in capabilityActionColumns"
                        :key="`${perm.route_name}-${col.code}`"
                        class="capability-mobile-action"
                      >
                        <span class="capability-mobile-action__label">{{ col.label }}</span>
                        <div class="capability-mobile-action__control">
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
                          <span v-else class="capability-mobile-action__empty">未开放</span>
                          <span
                            v-if="isUserInheritedCapability(perm.route_name, col.code)"
                            class="permission-tag inline"
                          >
                            组继承
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <table v-else class="capability-table">
                  <thead>
                    <tr>
                      <th>页面</th>
                      <th v-for="col in capabilityActionColumns" :key="col.code">{{
                        col.label
                      }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="perm in userSelectedPageRows" :key="perm.route_name">
                      <td class="capability-page-cell">
                        {{ perm.page_title || perm.route_name }}
                        <span
                          v-if="isUserInheritedPermission(perm.route_name)"
                          class="permission-tag inline"
                        >
                          组继承页面
                        </span>
                      </td>
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
                        <span
                          v-if="isUserInheritedCapability(perm.route_name, col.code)"
                          class="permission-tag inline"
                        >
                          组继承
                        </span>
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
            <div class="permission-sidebar permission-panel-card">
              <div class="permission-sidebar-header">
                <div class="permission-sidebar-step">STEP 1</div>
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
              <div v-if="selectedGroup && isMobile" class="permission-mobile-target">
                <span class="permission-mobile-target__label">当前组</span>
                <strong>{{ selectedGroup.group_name }}</strong>
                <span class="permission-mobile-target__meta">
                  {{ selectedGroup.description || selectedGroup.group_dn }}
                </span>
              </div>
              <ElTable
                v-loading="loadingGroups"
                :data="adGroups"
                size="small"
                :height="isMobile ? 280 : 380"
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

            <!-- 中间：页面权限面板 -->
            <div class="center-column user-permission-panel permission-panel-card">
              <div v-if="!selectedGroup" class="permission-empty">
                <ElEmpty description="请先在左侧选择一个 AD 组" />
              </div>
              <div v-else class="group-permission-panel">
                <div class="permission-main-header">
                  <div>
                    <div class="permission-sidebar-step">STEP 2</div>
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
                      已选 {{ checkedGroupPermissionsCount }} / 共
                      {{ totalGroupPermissions }} 个权限
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

            <div
              class="center-column capability-column group-permission-panel permission-panel-card"
            >
              <div class="permission-sidebar-header">
                <div class="permission-sidebar-step">STEP 3</div>
                <div class="permission-sidebar-title">模块能力权限</div>
                <div class="permission-sidebar-subtitle">仅对已勾选页面开放能力配置</div>
              </div>
              <div class="permission-toolbar">
                <div class="permission-toolbar-left">
                  <ElInput
                    v-model="groupCapabilityFilter"
                    placeholder="筛选已选页面"
                    clearable
                    style="width: 180px"
                  />
                  <span class="permission-toolbar-summary">
                    已选 {{ checkedGroupCapabilityCount }} / 共 {{ totalCapabilityActions }} 个能力
                  </span>
                </div>
                <div class="permission-toolbar-right">
                  <BaseButton text type="primary" @click="resetGroupPermissionSelection">
                    重置
                  </BaseButton>
                </div>
              </div>
              <div
                v-loading="loadingGroupPermissions || loadingCapabilityActions"
                class="permission-tree capability-matrix"
              >
                <template v-if="selectedGroup && groupSelectedPageRows.length">
                  <div v-if="isMobile" class="capability-mobile-list">
                    <div
                      v-for="perm in groupSelectedPageRows"
                      :key="perm.route_name"
                      class="capability-mobile-card"
                    >
                      <div class="capability-mobile-card__header">
                        <div>
                          <div class="capability-mobile-card__title">
                            {{ perm.page_title || perm.route_name }}
                          </div>
                          <div class="capability-mobile-card__route">{{ perm.route_name }}</div>
                        </div>
                      </div>
                      <div class="capability-mobile-grid">
                        <div
                          v-for="col in capabilityActionColumns"
                          :key="`${perm.route_name}-${col.code}`"
                          class="capability-mobile-action"
                        >
                          <span class="capability-mobile-action__label">{{ col.label }}</span>
                          <div class="capability-mobile-action__control">
                            <ElCheckbox
                              v-if="getCapabilityKeyByRouteAction(perm.route_name, col.code)"
                              :model-value="
                                groupCheckedCapabilityKeys.includes(
                                  getCapabilityKeyByRouteAction(perm.route_name, col.code)
                                )
                              "
                              @change="
                              (val: boolean | string) =>
                                toggleGroupRouteCapability(perm.route_name, col.code, !!val)
                            "
                            />
                            <span v-else class="capability-mobile-action__empty">未开放</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <table v-else class="capability-table">
                    <thead>
                      <tr>
                        <th>页面</th>
                        <th v-for="col in capabilityActionColumns" :key="col.code">{{
                          col.label
                        }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="perm in groupSelectedPageRows" :key="perm.route_name">
                        <td class="capability-page-cell">{{
                          perm.page_title || perm.route_name
                        }}</td>
                        <td
                          v-for="col in capabilityActionColumns"
                          :key="`${perm.route_name}-${col.code}`"
                        >
                          <ElCheckbox
                            v-if="getCapabilityKeyByRouteAction(perm.route_name, col.code)"
                            :model-value="
                              groupCheckedCapabilityKeys.includes(
                                getCapabilityKeyByRouteAction(perm.route_name, col.code)
                              )
                            "
                            @change="
                            (val: boolean | string) =>
                              toggleGroupRouteCapability(perm.route_name, col.code, !!val)
                          "
                          />
                          <span v-else>-</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </template>
                <template v-else-if="selectedGroup">
                  <ElEmpty description="请先勾选页面访问权" />
                </template>
                <template v-else>
                  <ElEmpty description="请先在左侧选择一个 AD 组" />
                </template>
              </div>
            </div>
          </div>
        </div>

        <!-- 接口审核权限 -->
        <div v-else-if="activeTab === 'reviewAcl'">
          <ElTabs v-model="reviewAclTab" class="permission-review-tabs">
            <ElTabPane label="按用户配置" name="user">
              <div class="permission-layout">
                <div class="permission-sidebar permission-panel-card">
                  <div class="permission-sidebar-header">
                    <div class="permission-sidebar-step">STEP 1</div>
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
                  <div v-if="selectedReviewUser && isMobile" class="permission-mobile-target">
                    <span class="permission-mobile-target__label">当前用户</span>
                    <strong>{{
                      selectedReviewUser.displayName || selectedReviewUser.username
                    }}</strong>
                    <span class="permission-mobile-target__meta">{{
                      selectedReviewUser.username
                    }}</span>
                  </div>
                  <ElTable
                    v-loading="loadingUsers"
                    :data="adUsers"
                    size="small"
                    :height="isMobile ? 280 : 380"
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

                <div class="permission-main permission-panel-card">
                  <div v-if="!selectedReviewUser" class="permission-empty">
                    <ElEmpty description="请先在左侧选择一个用户" />
                  </div>
                  <div v-else class="user-permission-panel">
                    <div class="permission-main-header">
                      <div>
                        <div class="permission-sidebar-step">STEP 2</div>
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
                <div class="permission-sidebar permission-panel-card">
                  <div class="permission-sidebar-header">
                    <div class="permission-sidebar-step">STEP 1</div>
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
                  <div v-if="selectedReviewGroup && isMobile" class="permission-mobile-target">
                    <span class="permission-mobile-target__label">当前组</span>
                    <strong>{{ selectedReviewGroup.group_name }}</strong>
                    <span class="permission-mobile-target__meta">{{
                      selectedReviewGroup.group_dn
                    }}</span>
                  </div>
                  <ElTable
                    v-loading="loadingGroups"
                    :data="adGroups"
                    size="small"
                    :height="isMobile ? 280 : 380"
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

                <div class="permission-main permission-panel-card">
                  <div v-if="!selectedReviewGroup" class="permission-empty">
                    <ElEmpty description="请先在左侧选择一个 AD 组" />
                  </div>
                  <div v-else class="group-permission-panel">
                    <div class="permission-main-header">
                      <div>
                        <div class="permission-sidebar-step">STEP 2</div>
                        <div class="permission-main-title">{{
                          selectedReviewGroup.group_name
                        }}</div>
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
    </div>
  </ContentWrap>
</template>

<style scoped>
.permission-shell {
  --pm-bg: linear-gradient(180deg, #f5f8fc 0%, #eef4f6 100%);
  --pm-line: #d6e2ea;
  --pm-card: linear-gradient(180deg, rgb(255 255 255 / 96%) 0%, rgb(244 249 251 / 94%) 100%);
  --pm-shadow: 0 16px 40px rgb(15 23 42 / 6%);
  --pm-strong: #0f172a;
  --pm-soft: #5f6f83;
  --pm-accent: #1f8a70;
}

.permission-page-head {
  position: relative;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 20px;
  margin-bottom: 14px;
  overflow: hidden;
  background: var(--pm-bg);
  border: 1px solid var(--pm-line);
  border-radius: 22px;
  box-shadow: var(--pm-shadow);
}

.permission-page-head::after {
  position: absolute;
  top: -40px;
  right: -20px;
  width: 180px;
  height: 180px;
  pointer-events: none;
  background:
    radial-gradient(circle, rgb(31 138 112 / 15%) 0%, rgb(31 138 112 / 0%) 68%),
    radial-gradient(circle, rgb(59 130 246 / 12%) 0%, rgb(59 130 246 / 0%) 62%);
  content: '';
}

.permission-page-copy {
  position: relative;
  z-index: 1;
  max-width: 620px;
}

.permission-page-eyebrow {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.12em;
  color: var(--pm-accent);
  text-transform: uppercase;
}

.permission-page-title {
  margin: 6px 0 0;
  font-size: 26px;
  font-weight: 700;
  line-height: 1.1;
  color: var(--pm-strong);
}

.permission-page-desc {
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.7;
  color: var(--pm-soft);
}

.permission-sync-button {
  position: relative;
  z-index: 1;
  flex-shrink: 0;
}

.center-nav {
  display: flex;
  padding: 4px;
  margin-bottom: 12px;
  overflow-x: auto;
  background: rgb(244 247 250 / 95%);
  border: 1px solid #dbe4eb;
  border-radius: 16px;
  gap: 8px;
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

.user-overview-panel {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.overview-card {
  padding: 12px;
  background: linear-gradient(180deg, #fff 0%, #f8fbff 100%);
  border: 1px solid #dbe4f0;
  border-radius: 10px;
}

.overview-card.risk {
  background: linear-gradient(180deg, #fffaf5 0%, #fff7ed 100%);
  border-color: #fed7aa;
}

.overview-card-title {
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
}

.overview-card-subtitle {
  margin-top: 6px;
  font-size: 12px;
  color: #64748b;
}

.overview-card-stats {
  display: flex;
  gap: 12px;
  margin-top: 12px;
}

.overview-stat {
  min-width: 76px;
  padding: 8px 10px;
  background: rgb(255 255 255 / 80%);
  border-radius: 8px;
}

.overview-stat-label {
  display: block;
  font-size: 12px;
  color: #64748b;
}

.overview-stat strong {
  display: block;
  margin-top: 4px;
  font-size: 18px;
  line-height: 1;
  color: #0f172a;
}

.overview-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}

.overview-more {
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  color: #64748b;
}

.overview-empty {
  margin-top: 10px;
  font-size: 12px;
  color: #94a3b8;
}

.overview-risk-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
  font-size: 13px;
  color: #7c2d12;
}

.permission-layout {
  display: flex;
  width: 100%;
  min-height: 600px;
  gap: 12px;
}

.permission-sidebar {
  display: flex;
  width: 340px;
  padding-right: 20px;
  flex-direction: column;
}

.center-column {
  display: flex;
  min-height: 620px;
  padding: 14px;
  flex-direction: column;
}

.permission-panel-card {
  background: var(--pm-card);
  border: 1px solid var(--pm-line);
  border-radius: 20px;
  box-shadow: var(--pm-shadow);
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

.permission-sidebar-step {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  margin-bottom: 8px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--pm-accent);
  background: rgb(31 138 112 / 10%);
  border-radius: 999px;
}

.permission-sidebar-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--pm-strong);
}

.permission-sidebar-subtitle {
  font-size: 12px;
  line-height: 1.6;
  color: var(--pm-soft);
}

.permission-sidebar-meta {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.5;
  color: #415163;
}

.permission-mobile-target {
  display: none;
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
  color: var(--pm-strong);
}

.permission-main-subtitle {
  margin-top: 4px;
  font-size: 12px;
  color: var(--pm-soft);
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
  color: var(--pm-soft);
}

.permission-hint {
  padding: 8px 10px;
  margin-bottom: 10px;
  font-size: 12px;
  line-height: 1.5;
  color: #475569;
  background: #f8fafc;
  border-radius: 6px;
}

.permission-hint.warning {
  color: #9a3412;
  background: #fff7ed;
}

.permission-tree {
  max-height: 420px;
  padding: 10px 12px;
  overflow: auto;
  background: rgb(255 255 255 / 82%);
  border: 1px solid #d9e3e9;
  border-radius: 14px;
  flex: 1;
}

.capability-matrix {
  max-height: 500px;
  padding: 0;
}

.capability-mobile-list {
  display: grid;
  gap: 8px;
  padding: 8px;
}

.capability-mobile-card {
  padding: 8px;
  background: linear-gradient(180deg, #fff 0%, #f7fafb 100%);
  border: 1px solid #dce6ea;
  border-radius: 12px;
}

.capability-mobile-card__header {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 6px;
}

.capability-mobile-card__title {
  font-size: 11px;
  font-weight: 600;
  line-height: 1.35;
  color: var(--pm-strong);
}

.capability-mobile-card__route {
  margin-top: 2px;
  font-size: 10px;
  line-height: 1.3;
  color: #7a8a9c;
}

.capability-mobile-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.capability-mobile-action {
  padding: 8px 9px;
  background: #f6faf9;
  border: 1px solid #dde9e4;
  border-radius: 10px;
}

.capability-mobile-action__label {
  display: block;
  font-size: 10px;
  line-height: 1.2;
  color: #678078;
}

.capability-mobile-action__control {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  min-height: 20px;
  margin-top: 6px;
}

.capability-mobile-action__empty {
  font-size: 10px;
  color: #9aa8b6;
}

.capability-table {
  width: 100%;
  font-size: 12px;
  border-collapse: collapse;
}

.capability-table th,
.capability-table td {
  padding: 6px 4px;
  text-align: center;
  border: 1px solid #e5e7eb;
}

.capability-page-cell {
  min-width: 180px;
  text-align: left !important;
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

.permission-tag {
  display: inline-flex;
  padding: 1px 6px;
  margin-left: 8px;
  font-size: 11px;
  line-height: 1.4;
  color: #1d4ed8;
  vertical-align: middle;
  background: #eff6ff;
  border-radius: 999px;
}

.permission-tag.inline {
  margin-left: 6px;
}

.permission-actions {
  display: flex;
  margin-top: 12px;
  gap: 8px;
  justify-content: flex-end;
}

@media (width <= 1280px) {
  .user-center-layout {
    grid-template-columns: 300px 1fr;
  }

  .user-overview-panel {
    grid-template-columns: 1fr;
  }

  .capability-column {
    grid-column: 1 / -1;
  }
}

@media (width <= 900px) {
  .permission-page-head {
    flex-direction: column;
    padding: 16px;
    border-radius: 18px;
  }

  .permission-page-title {
    font-size: 22px;
  }

  .center-nav {
    position: sticky;
    top: 0;
    z-index: 5;
    margin-bottom: 10px;
    backdrop-filter: blur(10px);
  }

  .permission-layout,
  .user-center-layout {
    display: flex;
    min-height: auto;
    flex-direction: column;
  }

  .user-overview-panel {
    order: 2;
    grid-template-columns: 1fr;
  }

  .user-list-column {
    order: 1;
  }

  .page-permission-column {
    order: 3;
  }

  .capability-column {
    order: 4;
  }

  .permission-sidebar,
  .center-column,
  .permission-main {
    width: 100%;
    min-height: auto;
    padding: 14px;
  }

  .permission-sidebar,
  .permission-main {
    padding-left: 14px;
    border-right: 0;
  }

  .permission-mobile-target {
    display: grid;
    gap: 2px;
    padding: 10px 12px;
    margin-top: 8px;
    background: #f5faf8;
    border: 1px solid #d6e6de;
    border-radius: 14px;
  }

  .permission-mobile-target__label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--pm-accent);
    text-transform: uppercase;
  }

  .permission-mobile-target strong {
    font-size: 14px;
    color: var(--pm-strong);
  }

  .permission-mobile-target__meta {
    font-size: 11px;
    color: var(--pm-soft);
  }

  .permission-toolbar,
  .permission-toolbar-left,
  .permission-toolbar-right {
    align-items: stretch;
    flex-direction: column;
  }

  .permission-toolbar-left :deep(.el-input),
  .permission-toolbar-right :deep(.el-button),
  .permission-actions :deep(.el-button),
  .permission-actions :deep(.base-button),
  .permission-sync-button {
    width: 100%;
  }

  .permission-pagination {
    overflow-x: auto;
    text-align: left;
  }

  .permission-tree {
    max-height: none;
  }

  .capability-matrix {
    padding: 0;
  }

  .capability-mobile-list {
    gap: 4px;
    padding: 4px;
  }

  .capability-mobile-card {
    padding: 6px;
    border-radius: 9px;
  }

  .capability-mobile-card__header {
    gap: 6px;
    margin-bottom: 4px;
  }

  .capability-mobile-card__title {
    font-size: 10px;
    line-height: 1.25;
  }

  .capability-mobile-card__route {
    display: none;
  }

  .capability-mobile-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 4px;
  }

  .capability-mobile-action {
    padding: 5px 4px;
    border-radius: 8px;
  }

  .capability-mobile-action__label {
    overflow: hidden;
    font-size: 9px;
    line-height: 1.1;
    text-align: center;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .capability-mobile-action__control {
    justify-content: center;
    gap: 2px;
    min-height: 16px;
    margin-top: 3px;
  }

  .capability-mobile-action__empty {
    font-size: 9px;
    line-height: 1;
  }

  .permission-group-body {
    gap: 8px;
  }

  .permission-item {
    min-width: 100%;
  }

  .capability-mobile-card__header .permission-tag.inline {
    padding: 0 4px;
    margin-left: 0;
    font-size: 8px;
  }

  .capability-mobile-action .permission-tag.inline {
    padding: 0 3px;
    margin-left: 0;
    font-size: 8px;
  }

  .permission-actions {
    justify-content: stretch;
    flex-direction: column;
  }
}

@media (width <= 420px) {
  .capability-mobile-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (width <= 360px) {
  .capability-mobile-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
