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
  ElTag,
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
  type PermissionItem,
  type AdUserItem,
  type AdGroupItem
} from '@/api/permission'

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
  userCheckedRouteNames.value = [...userOriginalRouteNames.value]
}

// 选择用户并加载权限
const selectUser = async (user: AdUserItem) => {
  selectedUser.value = user
  loadingUserPermissions.value = true
  try {
    const res = await getUserPermissionsApi(user.username)
    const permissions = (res.data as any[]) || []
    userOriginalRouteNames.value = permissions
    userCheckedRouteNames.value = [...permissions]
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

  if (!toAddRouteNames.length && !toRemoveRouteNames.length) {
    ElMessage.info('权限未变化，无需保存')
    return
  }

  const map = permissionMapByRouteName.value
  const toAddIds = toAddRouteNames
    .map((name) => map.get(name)?.id)
    .filter((id): id is number => typeof id === 'number')
  const toRemoveIds = toRemoveRouteNames
    .map((name) => map.get(name)?.id)
    .filter((id): id is number => typeof id === 'number')

  savingUserPermissions.value = true
  const loading = ElLoading.service({ target: '.user-permission-panel' })
  try {
    if (toAddIds.length) {
      await assignUserPermissionsApi(username, toAddIds)
    }

    if (toRemoveIds.length) {
      await removeUserPermissionsApi(username, toRemoveIds)
    }

    userOriginalRouteNames.value = [...userCheckedRouteNames.value]
    ElMessage.success('用户权限保存成功')
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

// 初始加载
onMounted(() => {
  loadPermissionList()
  loadAdUsers()
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
    .map((name) => map.get(name)?.id)
    .filter((id): id is number => typeof id === 'number')
  const toRemoveIds = toRemoveRouteNames
    .map((name) => map.get(name)?.id)
    .filter((id): id is number => typeof id === 'number')

  savingGroupPermissions.value = true
  const loading = ElLoading.service({ target: '.group-permission-panel' })
  try {
    if (toAddIds.length) {
      await assignGroupPermissionsApi(groupDn, toAddIds)
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

// Tab 切换
const handleTabChange = (tab: string) => {
  if (tab === 'user' && adUsers.value.length === 0) {
    loadAdUsers()
  } else if (tab === 'group' && adGroups.value.length === 0) {
    loadAdGroups()
  }
}
</script>

<template>
  <ContentWrap>
    <ElTabs v-model="activeTab" class="permission-tabs" @tab-change="handleTabChange">
      <!-- 用户权限 -->
      <ElTabPane label="按用户分配" name="user">
        <div class="permission-layout">
          <!-- 左侧：用户列表 -->
          <div class="permission-sidebar">
            <div class="permission-sidebar-header">
              <div class="permission-sidebar-title">域用户</div>
              <div class="permission-sidebar-subtitle">从 AD 中选择需要分配权限的用户</div>
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
              @row-click="selectUser"
            >
              <ElTableColumn
                prop="displayName"
                label="姓名"
                min-width="120"
                :formatter="(_, __, row: any) => row.displayName || row.username"
              />
              <ElTableColumn prop="username" label="账号" min-width="120" />
              <ElTableColumn prop="email" label="邮箱" min-width="160" show-overflow-tooltip />
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

          <!-- 右侧：权限面板 -->
          <div class="permission-main">
            <div v-if="!selectedUser" class="permission-empty">
              <ElEmpty description="请先在左侧选择一个用户" />
            </div>
            <div v-else class="user-permission-panel">
              <div class="permission-main-header">
                <div>
                  <div class="permission-main-title">
                    {{ selectedUser.displayName || selectedUser.username }}
                  </div>
                  <div class="permission-main-subtitle">
                    账号：{{ selectedUser.username }}
                    <template v-if="selectedUser.email">
                      <ElDivider direction="vertical" />
                      邮箱：{{ selectedUser.email }}
                    </template>
                  </div>
                </div>
                <div class="permission-main-tags">
                  <template v-if="loadingUserGroups">
                    <span class="text-12px text-gray-500">正在加载所属组...</span>
                  </template>
                  <template v-else-if="selectedUserGroups.length">
                    <span class="text-12px text-gray-500 mr-6px">所属组：</span>
                    <ElTag
                      v-for="group in selectedUserGroups"
                      :key="group.group_dn"
                      size="small"
                      class="mb-4px mr-4px"
                    >
                      {{ group.group_name }}
                    </ElTag>
                  </template>
                  <template v-else>
                    <span class="text-12px text-gray-500"
                      >未查询到所属组（或用户不在任何组中）</span
                    >
                  </template>
                </div>
              </div>

              <ElDivider />

              <div class="permission-toolbar">
                <div class="permission-toolbar-left">
                  <ElInput
                    v-model="userPermissionFilter"
                    placeholder="筛选权限（按页面名称 / 路由名）"
                    clearable
                    style="width: 260px"
                  />
                  <span class="permission-toolbar-summary">
                    已选 {{ checkedUserPermissionsCount }} / 共 {{ totalUserPermissions }} 个权限
                  </span>
                </div>
                <div class="permission-toolbar-right">
                  <BaseButton text type="primary" @click="resetUserPermissionSelection">
                    重置为已保存状态
                  </BaseButton>
                </div>
              </div>

              <div
                v-loading="loadingUserPermissions || loadingPermissions"
                class="permission-tree user-permission-tree"
              >
                <template v-if="filteredUserPermissionTree.length">
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
                <template v-else>
                  <ElEmpty description="未匹配到任何权限，请尝试调整筛选条件" />
                </template>
              </div>

              <div class="permission-actions">
                <BaseButton
                  type="primary"
                  :loading="savingUserPermissions"
                  @click="saveUserPermissions"
                >
                  保存用户权限
                </BaseButton>
                <BaseButton text @click="resetUserPermissionSelection"> 取消修改 </BaseButton>
              </div>
            </div>
          </div>
        </div>
      </ElTabPane>

      <!-- 组权限 -->
      <ElTabPane label="按组分配" name="group">
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
      </ElTabPane>
    </ElTabs>
  </ContentWrap>
</template>

<style scoped>
.permission-tabs {
  width: 100%;
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
