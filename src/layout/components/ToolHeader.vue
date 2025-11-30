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
    const salesSummary = computed(() => appStore.getSalesOrdersSummary)

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

        {/* 顶部居中的销售订单统计卡片 */}
        {isSalesOrdersPage.value && !isMobile.value ? (
          <div class="tool-header-summary-center">
            <div class="tool-header-summary-cards">
              <div class="tool-header-summary-card tool-header-summary-card--year">
                <div class="title">当年金额</div>
                <div class="value">
                  {salesSummary.value.yearTotalAmount?.toLocaleString?.() ?? 0}
                </div>
              </div>
              <div class="tool-header-summary-card tool-header-summary-card--month">
                <div class="title">本月金额</div>
                <div class="value">
                  {salesSummary.value.monthTotalAmount?.toLocaleString?.() ?? 0}
                </div>
              </div>
              <div class="tool-header-summary-card tool-header-summary-card--pending-in">
                <div class="title">待入库</div>
                <div class="value">{salesSummary.value.pendingInStock ?? 0}</div>
              </div>
              <div class="tool-header-summary-card tool-header-summary-card--pending-out">
                <div class="title">待出运</div>
                <div class="value">{salesSummary.value.pendingShipped ?? 0}</div>
              </div>
            </div>
          </div>
        ) : null}

        <div class="h-full flex items-center">
          {isSalesOrdersPage.value && !isMobile.value ? (
            <div class="flex items-center mr-3">
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

  .tool-header-summary-center {
    position: absolute;
    top: 50%;
    left: 50%;
    display: flex;
    pointer-events: none;
    transform: translate(-50%, -50%);
    align-items: center;
    justify-content: center;
  }

  .tool-header-summary-cards {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .tool-header-summary-card {
    min-width: 120px;
    padding: 4px 8px;
    font-size: 12px;
    color: #333;
    pointer-events: auto;
    background: #f5f7fa;
    border-radius: 6px;
  }

  .tool-header-summary-card .title {
    margin-bottom: 2px;
    color: #666;
  }

  .tool-header-summary-card .value {
    font-weight: 600;
  }

  /* 颜色和销售订单页面原 summary-card 保持一致，仅缩小尺寸 */
  .tool-header-summary-card--year {
    background: linear-gradient(145deg, rgb(64 158 255 / 12%), rgb(64 158 255 / 6%));
  }

  .tool-header-summary-card--year .title,
  .tool-header-summary-card--year .value {
    color: #409eff;
  }

  .tool-header-summary-card--month {
    background: linear-gradient(145deg, rgb(103 194 58 / 12%), rgb(103 194 58 / 6%));
  }

  .tool-header-summary-card--month .title,
  .tool-header-summary-card--month .value {
    color: #67c23a;
  }

  .tool-header-summary-card--pending-in {
    background: linear-gradient(145deg, rgb(230 162 60 / 12%), rgb(230 162 60 / 6%));
  }

  .tool-header-summary-card--pending-in .title,
  .tool-header-summary-card--pending-in .value {
    color: #e6a23c;
  }

  .tool-header-summary-card--pending-out {
    background: linear-gradient(145deg, rgb(144 147 153 / 12%), rgb(144 147 153 / 6%));
  }

  .tool-header-summary-card--pending-out .title,
  .tool-header-summary-card--pending-out .value {
    color: #909399;
  }
}
</style>
