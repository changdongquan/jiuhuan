<script lang="tsx">
import { computed, defineComponent, unref, ref } from 'vue'
import { useAppStore } from '@/store/modules/app'
import { Backtop } from '@/components/Backtop'
import { Setting } from '@/components/Setting'
import { useRenderLayout } from './components/useRenderLayout'
import { useDesign } from '@/hooks/web/useDesign'

const { getPrefixCls } = useDesign()

const prefixCls = getPrefixCls('layout')

const appStore = useAppStore()

// 是否是移动端
const mobile = computed(() => appStore.getMobile)

// 菜单折叠
const collapse = computed(() => appStore.getCollapse)

const layout = computed(() => appStore.getLayout)

const hideSetting = computed(() => import.meta.env.VITE_HIDE_GLOBAL_SETTING === 'true')

const handleClickOutside = () => {
  appStore.setCollapse(true)
}

const renderLayout = (options?: { openSetting?: () => void; showSetting?: boolean }) => {
  const { renderClassic, renderTopLeft, renderTop, renderCutMenu } = useRenderLayout()
  switch (unref(layout)) {
    case 'classic':
      return renderClassic(options)
    case 'topLeft':
      return renderTopLeft(options)
    case 'top':
      return renderTop(options)
    case 'cutMenu':
      return renderCutMenu(options)
    default:
      break
  }
}

export default defineComponent({
  name: 'Layout',
  setup() {
    const settingRef = ref<InstanceType<typeof Setting> | null>(null)
    const openSetting = () => {
      settingRef.value?.open?.()
    }

    return () => (
      <section class={[prefixCls, `${prefixCls}__${layout.value}`, 'w-[100%] h-[100%] relative']}>
        {mobile.value && !collapse.value ? (
          <div
            class="absolute top-0 left-0 w-full h-full opacity-30 z-99 bg-[var(--el-color-black)]"
            onClick={handleClickOutside}
          ></div>
        ) : undefined}

        {renderLayout({ openSetting, showSetting: !unref(hideSetting) })}

        <Backtop></Backtop>

        {!unref(hideSetting) && <Setting ref={settingRef}></Setting>}
      </section>
    )
  }
})
</script>

<style lang="less" scoped>
@prefix-cls: ~'@{adminNamespace}-layout';

.@{prefix-cls} {
  background-color: var(--app-content-bg-color);
}
</style>
