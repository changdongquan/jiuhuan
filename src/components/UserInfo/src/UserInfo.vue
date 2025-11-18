<script setup lang="ts">
import { ElDropdown, ElDropdownMenu, ElDropdownItem } from 'element-plus'
import { useI18n } from '@/hooks/web/useI18n'
import { useDesign } from '@/hooks/web/useDesign'
import LockDialog from './components/LockDialog.vue'
import { ref, computed, onMounted } from 'vue'
import LockPage from './components/LockPage.vue'
import { useLockStore } from '@/store/modules/lock'
import { useUserStore } from '@/store/modules/user'
import { useRouter } from 'vue-router'
import { getAdUsersApi } from '@/api/permission'

const { push } = useRouter()

const userStore = useUserStore()

const lockStore = useLockStore()

const getIsLock = computed(() => lockStore.getLockInfo?.isLock ?? false)

const { getPrefixCls } = useDesign()

const prefixCls = getPrefixCls('user-info')

const { t } = useI18n()

const loginOut = () => {
  userStore.logoutConfirm()
}

const dialogVisible = ref<boolean>(false)

// 锁定屏幕
const lockScreen = () => {
  dialogVisible.value = true
}

const toDocument = () => {
  window.open('https://element-plus-admin-doc.cn/')
}

const toPage = (path: string) => {
  push(path)
}

onMounted(async () => {
  const info = userStore.getUserInfo as any
  if (!info || !info.username) return

  // 提取纯用户名（去掉域名前缀和 @ 域名）
  const rawUsername = String(info.username || '')
  const shortUsername = rawUsername.split('\\').pop()?.split('@')[0] || rawUsername

  const normalizedShort = shortUsername.toLowerCase()

  // 如果 realName 已经不是“纯用户名”（例如已经是中文显示名），就不再请求
  if (info.realName && String(info.realName).toLowerCase() !== normalizedShort) return

  try {
    const res = await getAdUsersApi({
      keyword: shortUsername,
      page: 1,
      pageSize: 10
    })
    const data = (res.data as any) || {}
    const list = data.list || []
    const matched = list.find(
      (u: any) => String(u.username || '').toLowerCase() === normalizedShort
    )
    if (
      matched &&
      matched.displayName &&
      String(matched.displayName).toLowerCase() !== normalizedShort
    ) {
      userStore.setUserInfo({
        ...info,
        realName: matched.displayName
      } as any)
    }
  } catch {
    // 静默失败，不影响页面
  }
})

const headerName = computed(() => {
  const info = userStore.getUserInfo as any
  return info?.realName || info?.displayName || info?.username || ''
})
</script>

<template>
  <ElDropdown class="custom-hover" :class="prefixCls" trigger="click">
    <div class="flex items-center">
      <img
        src="@/assets/imgs/avatar.jpg"
        alt=""
        class="w-[calc(var(--logo-height)-25px)] rounded-[50%]"
      />
      <span class="<lg:hidden text-14px pl-[5px] text-[var(--top-header-text-color)]">
        {{ headerName }}
      </span>
    </div>
    <template #dropdown>
      <ElDropdownMenu>
        <ElDropdownItem>
          <div @click="toPage('/personal/personal-center')">
            {{ t('router.personalCenter') }}
          </div>
        </ElDropdownItem>
        <ElDropdownItem>
          <div @click="toDocument">{{ t('common.document') }}</div>
        </ElDropdownItem>
        <ElDropdownItem divided>
          <div @click="lockScreen">{{ t('lock.lockScreen') }}</div>
        </ElDropdownItem>
        <ElDropdownItem>
          <div @click="loginOut">{{ t('common.loginOut') }}</div>
        </ElDropdownItem>
      </ElDropdownMenu>
    </template>
  </ElDropdown>

  <LockDialog v-if="dialogVisible" v-model="dialogVisible" />
  <teleport to="body">
    <transition name="fade-bottom" mode="out-in">
      <LockPage v-if="getIsLock" />
    </transition>
  </teleport>
</template>

<style scoped lang="less">
.fade-bottom-enter-active,
.fade-bottom-leave-active {
  transition:
    opacity 0.25s,
    transform 0.3s;
}

.fade-bottom-enter-from {
  opacity: 0;
  transform: translateY(-10%);
}

.fade-bottom-leave-to {
  opacity: 0;
  transform: translateY(10%);
}
</style>
