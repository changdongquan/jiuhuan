<script setup lang="tsx">
import { ref, onMounted, computed } from 'vue'
import { ContentWrap } from '@/components/ContentWrap'
import { ElTabs, ElTabPane, ElInput, ElCheckbox, ElMessage, ElLoading } from 'element-plus'
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
  type PermissionItem,
  type AdUserItem,
  type AdGroupItem
} from '@/api/permission'

// Tab 切换
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

onMounted(() => {
  loadPermissionList()
})

// ========== 用户权限 ==========
const userSearch = ref('')
const adUsers = ref<AdUserItem[]>([])
const loadingUsers = ref(false)
const selectedUser = ref<AdUserItem | null>(null)
const userPermissions = ref<string[]>([])

// 加载 AD 用户列表
const loadAdUsers = async () => {
  loadingUsers.value = true
  try {
    const res = await getAdUsersApi(userSearch.value || undefined)
    adUsers.value = res.data || []
  } catch (error: any) {
    ElMessage.error('加载用户列表失败: ' + (error.message || '未知错误'))
  } finally {
    loadingUsers.value = false
  }
}

// 选择用户
const selectUser = async (user: AdUserItem) => {
  selectedUser.value = user
  loadingUserPermissions.value = true
  try {
    const res = await getUserPermissionsApi(user.username)
    userPermissions.value = res.data || []
  } catch (error: any) {
    ElMessage.error('加载用户权限失败: ' + (error.message || '未知错误'))
  } finally {
    loadingUserPermissions.value = false
  }
}

// 用户权限树
const loadingUserPermissions = ref(false)
const userPermissionTreeData = computed(() => {
  if (!permissionList.value.length) return []

  const grouped = permissionList.value.reduce(
    (acc, perm) => {
      const parent = perm.parent_route || '其他'
      if (!acc[parent]) {
        acc[parent] = []
      }
      acc[parent].push({
        id: perm.id,
        label: `${perm.page_title || perm.route_name} (${perm.route_name})`,
        route_name: perm.route_name
      })
      return acc
    },
    {} as Record<string, any[]>
  )

  return Object.keys(grouped).map((parent) => ({
    label: parent,
    children: grouped[parent]
  }))
})

// 用户权限复选框状态
const userCheckedPermissions = computed(() => {
  return new Set(userPermissions.value)
})

// 用户权限复选框变化
const handleUserPermissionChange = async (checked: boolean, permission: any) => {
  if (!selectedUser.value) return

  const loading = ElLoading.service({ target: '.user-permission-tree' })
  try {
    if (checked) {
      await assignUserPermissionsApi(selectedUser.value.username, [permission.id])
      userPermissions.value.push(permission.route_name)
    } else {
      await removeUserPermissionsApi(selectedUser.value.username, [permission.id])
      userPermissions.value = userPermissions.value.filter((p) => p !== permission.route_name)
    }
    ElMessage.success(checked ? '权限分配成功' : '权限移除成功')
  } catch (error: any) {
    ElMessage.error('操作失败: ' + (error.message || '未知错误'))
  } finally {
    loading.close()
  }
}

// 搜索用户
const searchUsers = () => {
  loadAdUsers()
}

onMounted(() => {
  if (activeTab.value === 'user') {
    loadAdUsers()
  }
})

// ========== 组权限 ==========
const groupSearch = ref('')
const adGroups = ref<AdGroupItem[]>([])
const loadingGroups = ref(false)
const selectedGroup = ref<AdGroupItem | null>(null)
const groupPermissions = ref<string[]>([])

// 加载 AD 组列表
const loadAdGroups = async () => {
  loadingGroups.value = true
  try {
    const res = await getAdGroupsApi(groupSearch.value || undefined)
    adGroups.value = res.data || []
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
    groupPermissions.value = res.data || []
  } catch (error: any) {
    ElMessage.error('加载组权限失败: ' + (error.message || '未知错误'))
  } finally {
    loadingGroupPermissions.value = false
  }
}

// 组权限树
const loadingGroupPermissions = ref(false)
const groupPermissionTreeData = computed(() => {
  if (!permissionList.value.length) return []

  const grouped = permissionList.value.reduce(
    (acc, perm) => {
      const parent = perm.parent_route || '其他'
      if (!acc[parent]) {
        acc[parent] = []
      }
      acc[parent].push({
        id: perm.id,
        label: `${perm.page_title || perm.route_name} (${perm.route_name})`,
        route_name: perm.route_name
      })
      return acc
    },
    {} as Record<string, any[]>
  )

  return Object.keys(grouped).map((parent) => ({
    label: parent,
    children: grouped[parent]
  }))
})

// 组权限复选框状态
const groupCheckedPermissions = computed(() => {
  return new Set(groupPermissions.value)
})

// 组权限复选框变化
const handleGroupPermissionChange = async (checked: boolean, permission: any) => {
  if (!selectedGroup.value) return

  const loading = ElLoading.service({ target: '.group-permission-tree' })
  try {
    if (checked) {
      await assignGroupPermissionsApi(selectedGroup.value.group_dn, [permission.id])
      groupPermissions.value.push(permission.route_name)
    } else {
      await removeGroupPermissionsApi(selectedGroup.value.group_dn, [permission.id])
      groupPermissions.value = groupPermissions.value.filter((p) => p !== permission.route_name)
    }
    ElMessage.success(checked ? '权限分配成功' : '权限移除成功')
  } catch (error: any) {
    ElMessage.error('操作失败: ' + (error.message || '未知错误'))
  } finally {
    loading.close()
  }
}

// 搜索组
const searchGroups = () => {
  loadAdGroups()
}

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
    <ElTabs v-model="activeTab" @tab-change="handleTabChange">
      <!-- 用户权限 -->
      <ElTabPane label="用户权限" name="user">
        <div class="flex w-100% h-600px">
          <!-- 左侧：用户列表 -->
          <div class="w-300px border-r-1px border-r-gray-300 pr-20px">
            <div class="mb-10px">
              <ElInput
                v-model="userSearch"
                placeholder="搜索用户"
                clearable
                @change="searchUsers"
                @clear="searchUsers"
              >
                <template #append>
                  <BaseButton @click="searchUsers">搜索</BaseButton>
                </template>
              </ElInput>
            </div>
            <div v-loading="loadingUsers" class="overflow-auto" style="height: calc(100% - 60px)">
              <div
                v-for="user in adUsers"
                :key="user.username"
                class="p-10px mb-5px cursor-pointer border-1px border-gray-200 rounded hover:bg-gray-100"
                :class="{ 'bg-blue-100 border-blue-500': selectedUser?.username === user.username }"
                @click="selectUser(user)"
              >
                <div class="font-bold">{{ user.displayName || user.username }}</div>
                <div class="text-12px text-gray-500">{{ user.username }}</div>
                <div v-if="user.email" class="text-12px text-gray-400">{{ user.email }}</div>
              </div>
            </div>
          </div>

          <!-- 右侧：权限树 -->
          <div class="flex-1 pl-20px">
            <div v-if="!selectedUser" class="text-center text-gray-400 mt-200px"> 请选择用户 </div>
            <div v-else>
              <div class="mb-10px">
                <span class="font-bold">用户：</span>
                <span>{{ selectedUser.displayName || selectedUser.username }}</span>
                <span class="text-gray-500 ml-10px">({{ selectedUser.username }})</span>
              </div>
              <div
                v-loading="loadingUserPermissions || loadingPermissions"
                class="user-permission-tree overflow-auto"
                style="height: calc(100% - 60px)"
              >
                <div v-for="group in userPermissionTreeData" :key="group.label" class="mb-20px">
                  <div class="font-bold mb-10px pb-5px border-b-1px">{{ group.label }}</div>
                  <div v-for="perm in group.children" :key="perm.route_name" class="mb-8px">
                    <ElCheckbox
                      :model-value="userCheckedPermissions.has(perm.route_name)"
                      @change="(val: boolean | string) => handleUserPermissionChange(!!val, perm)"
                    >
                      {{ perm.label }}
                    </ElCheckbox>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ElTabPane>

      <!-- 组权限 -->
      <ElTabPane label="组权限" name="group">
        <div class="flex w-100% h-600px">
          <!-- 左侧：组列表 -->
          <div class="w-300px border-r-1px border-r-gray-300 pr-20px">
            <div class="mb-10px">
              <ElInput
                v-model="groupSearch"
                placeholder="搜索组"
                clearable
                @change="searchGroups"
                @clear="searchGroups"
              >
                <template #append>
                  <BaseButton @click="searchGroups">搜索</BaseButton>
                </template>
              </ElInput>
            </div>
            <div v-loading="loadingGroups" class="overflow-auto" style="height: calc(100% - 60px)">
              <div
                v-for="group in adGroups"
                :key="group.group_dn"
                class="p-10px mb-5px cursor-pointer border-1px border-gray-200 rounded hover:bg-gray-100"
                :class="{
                  'bg-blue-100 border-blue-500': selectedGroup?.group_dn === group.group_dn
                }"
                @click="selectGroup(group)"
              >
                <div class="font-bold">{{ group.group_name }}</div>
                <div class="text-12px text-gray-500 break-all">{{ group.group_dn }}</div>
              </div>
            </div>
          </div>

          <!-- 右侧：权限树 -->
          <div class="flex-1 pl-20px">
            <div v-if="!selectedGroup" class="text-center text-gray-400 mt-200px"> 请选择组 </div>
            <div v-else>
              <div class="mb-10px">
                <span class="font-bold">组：</span>
                <span>{{ selectedGroup.group_name }}</span>
              </div>
              <div
                v-loading="loadingGroupPermissions || loadingPermissions"
                class="group-permission-tree overflow-auto"
                style="height: calc(100% - 60px)"
              >
                <div v-for="group in groupPermissionTreeData" :key="group.label" class="mb-20px">
                  <div class="font-bold mb-10px pb-5px border-b-1px">{{ group.label }}</div>
                  <div v-for="perm in group.children" :key="perm.route_name" class="mb-8px">
                    <ElCheckbox
                      :model-value="groupCheckedPermissions.has(perm.route_name)"
                      @change="(val: boolean | string) => handleGroupPermissionChange(!!val, perm)"
                    >
                      {{ perm.label }}
                    </ElCheckbox>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ElTabPane>
    </ElTabs>
  </ContentWrap>
</template>

<style scoped></style>
