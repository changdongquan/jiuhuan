<script lang="tsx">
import { defineComponent, computed, type PropType } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElRadioButton, ElRadioGroup } from 'element-plus'
import { Collapse } from '@/components/Collapse'
import { LocaleDropdown } from '@/components/LocaleDropdown'
import { SizeDropdown } from '@/components/SizeDropdown'
import { UserInfo } from '@/components/UserInfo'
import { Screenfull } from '@/components/Screenfull'
import { Breadcrumb } from '@/components/Breadcrumb'
import { Icon } from '@/components/Icon'
import { useAppStore } from '@/store/modules/app'
import { useDesign } from '@/hooks/web/useDesign'

const { getPrefixCls, variables } = useDesign()

const prefixCls = getPrefixCls('tool-header')

const appStore = useAppStore()

// 面包屑
const breadcrumb = computed(() => appStore.getBreadcrumb)

// 折叠图标
const hamburger = computed(() => appStore.getHamburger)

// 全屏图标
const screenfull = computed(() => appStore.getScreenfull)

// 尺寸图标
const size = computed(() => appStore.getSize)

// 布局
const layout = computed(() => appStore.getLayout)

// 多语言图标
const locale = computed(() => appStore.getLocale)

export default defineComponent({
  name: 'ToolHeader',
  props: {
    showSetting: {
      type: Boolean,
      default: true
    },
    openSetting: {
      type: Function as PropType<() => void>,
      required: false
    }
  },
  setup(props) {
    const route = useRoute()
    const router = useRouter()

    const isMobile = computed(() => appStore.getMobile)
    const isSalesOrdersPage = computed(() => route.name === 'SalesOrdersIndex')

    type SalesOrdersViewMode = 'table' | 'timeline'

    const salesOrdersViewMode = computed<SalesOrdersViewMode>({
      get() {
        const v = route.query.view
        if (v === 'table' || v === 'timeline') return v as SalesOrdersViewMode
        return 'timeline'
      },
      set(val) {
        if (route.name !== 'SalesOrdersIndex') return
        const query = { ...route.query, view: val }
        router.replace({ path: route.path, query })
      }
    })

    return () => (
      <div
        id={`${variables.namespace}-tool-header`}
        class={[
          prefixCls,
          'h-[var(--top-tool-height)] relative px-[var(--top-tool-p-x)] flex items-center justify-between'
        ]}
      >
        {layout.value !== 'top' ? (
          <div class="h-full flex items-center">
            {hamburger.value && layout.value !== 'cutMenu' ? (
              <Collapse class="custom-hover" color="var(--top-header-text-color)"></Collapse>
            ) : undefined}
            {breadcrumb.value ? <Breadcrumb class="<md:hidden"></Breadcrumb> : undefined}
          </div>
        ) : undefined}
        <div class="h-full flex items-center">
          {isSalesOrdersPage.value && !isMobile.value ? (
            <div class="flex items-center mr-1">
              <span class="mr-1 text-[12px]" style="color: var(--top-header-text-color);">
                视图
              </span>
              <ElRadioGroup
                size="small"
                modelValue={salesOrdersViewMode.value}
                onUpdate:modelValue={(val) =>
                  (salesOrdersViewMode.value = val as SalesOrdersViewMode)
                }
              >
                <ElRadioButton label="table">表格</ElRadioButton>
                <ElRadioButton label="timeline">时间轴</ElRadioButton>
              </ElRadioGroup>
            </div>
          ) : null}
          {props.showSetting ? (
            <div
              class="custom-hover mr-1 flex items-center justify-center"
              style="height: 100%;"
              onClick={props.openSetting}
            >
              <Icon icon="vi-ep:setting" color="var(--top-header-text-color)" size={18} />
            </div>
          ) : undefined}
          {screenfull.value ? (
            <Screenfull class="custom-hover" color="var(--top-header-text-color)"></Screenfull>
          ) : undefined}
          {size.value ? (
            <SizeDropdown class="custom-hover" color="var(--top-header-text-color)"></SizeDropdown>
          ) : undefined}
          {locale.value ? (
            <LocaleDropdown
              class="custom-hover"
              color="var(--top-header-text-color)"
            ></LocaleDropdown>
          ) : undefined}
          <UserInfo></UserInfo>
        </div>
      </div>
    )
  }
})
</script>

<style lang="less" scoped>
@prefix-cls: ~'@{adminNamespace}-tool-header';

.@{prefix-cls} {
  transition: left var(--transition-time-02);
}
</style>
