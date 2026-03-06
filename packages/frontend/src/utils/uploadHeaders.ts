import { computed } from 'vue'
import { useUserStoreWithOut } from '@/store/modules/user'

export const useUploadAuthHeaders = () => {
  const userStore = useUserStoreWithOut()
  return computed(() => {
    const userInfo: any = userStore.getUserInfo || {}
    const displayNameRaw = String(userInfo.realName || userInfo.displayName || '').trim()
    const displayNameHeader = displayNameRaw ? encodeURIComponent(displayNameRaw) : ''
    return {
      [userStore.getTokenKey ?? 'Authorization']: userStore.getToken ?? '',
      'X-Username': userInfo.username || '',
      'X-Display-Name': displayNameHeader
    }
  })
}
