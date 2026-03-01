import type { RouteMeta } from 'vue-router'
import { ElBadge } from 'element-plus'
import { Icon } from '@/components/Icon'
import { useI18n } from '@/hooks/web/useI18n'
import { useAppStore } from '@/store/modules/app'
import { computed, unref } from 'vue'

export const useRenderMenuTitle = () => {
  const { t } = useI18n()
  const appStore = useAppStore()
  const collapse = computed(() => appStore.getCollapse)

  const renderMenuTitle = (meta: RouteMeta, routeName?: string) => {
    const { title = 'Please set title', icon } = meta
    const pendingInitiationCount = appStore.getBmoPendingInitiationCount
    const pendingReviewCount = appStore.getBmoPendingReviewCount
    const showBmoPendingBadge = routeName === 'BmoSync' && pendingInitiationCount > 0
    const showReviewPendingBadge =
      (routeName === 'ReviewCenter' || routeName === 'ReviewCenterMenu') && pendingReviewCount > 0

    const titleText = (
      <span class="v-menu__title overflow-hidden overflow-ellipsis whitespace-nowrap">
        {t(title as string)}
      </span>
    )

    const titleNode = (
      <>
        {icon ? <Icon icon={meta.icon}></Icon> : null}
        {titleText}
      </>
    )

    if (!showBmoPendingBadge && !showReviewPendingBadge) {
      return titleNode
    }

    if (unref(collapse)) {
      return titleNode
    }

    const badgeCount = showReviewPendingBadge ? pendingReviewCount : pendingInitiationCount

    return (
      <>
        {icon ? <Icon icon={meta.icon}></Icon> : null}
        <ElBadge value={badgeCount} max={99} class="v-menu__badge">
          {titleText}
        </ElBadge>
      </>
    )
  }

  return {
    renderMenuTitle
  }
}
