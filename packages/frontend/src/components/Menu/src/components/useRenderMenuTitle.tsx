import type { RouteMeta } from 'vue-router'
import { ElBadge } from 'element-plus'
import { Icon } from '@/components/Icon'
import { useI18n } from '@/hooks/web/useI18n'
import { useAppStore } from '@/store/modules/app'

export const useRenderMenuTitle = () => {
  const { t } = useI18n()
  const appStore = useAppStore()

  const renderMenuTitle = (meta: RouteMeta, routeName?: string) => {
    const { title = 'Please set title', icon } = meta
    const pendingCount = appStore.getBmoPendingInitiationCount
    const showBmoPendingBadge = routeName === 'BmoSync' && pendingCount > 0

    const titleNode = (
      <span class="v-menu__title-wrap inline-flex items-center gap-[6px]">
        {icon ? <Icon icon={meta.icon}></Icon> : null}
        <span class="v-menu__title overflow-hidden overflow-ellipsis whitespace-nowrap">
          {t(title as string)}
        </span>
      </span>
    )

    if (!showBmoPendingBadge) {
      return titleNode
    }

    return (
      <ElBadge value={pendingCount} max={99} class="v-menu__badge">
        {titleNode}
      </ElBadge>
    )
  }

  return {
    renderMenuTitle
  }
}
