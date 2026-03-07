<template>
  <div class="comprehensive-query-page space-y-2 p-3">
    <section class="query-section rounded-lg bg-[var(--el-bg-color-overlay)] p-3 shadow-sm">
      <el-form ref="queryFormRef" :model="queryForm" label-width="60px" class="filter-form">
        <el-row :gutter="10">
          <el-col :xs="24" :sm="12" :lg="3">
            <el-form-item label="关键词" class="query-item-keyword">
              <el-input
                v-model="queryForm.keyword"
                placeholder="项目编号 / 产品名称 / 产品图号"
                clearable
                class="filter-control"
                @keyup.enter="handleSearch"
              />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12" :lg="3">
            <el-form-item label="客户名称" class="query-item-customer">
              <el-select
                v-model="queryForm.customerName"
                filterable
                clearable
                placeholder="请选择客户"
                class="filter-control"
              >
                <el-option
                  v-for="item in customerOptions"
                  :key="item"
                  :label="item"
                  :value="item"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12" :lg="3">
            <el-form-item label="分类" class="query-item-expand">
              <el-select
                v-model="queryForm.category"
                filterable
                clearable
                placeholder="请选择分类"
                class="filter-control"
              >
                <el-option
                  v-for="item in categoryOptions"
                  :key="item"
                  :label="item"
                  :value="item"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12" :lg="2">
            <el-form-item label="状态" class="query-item-expand">
              <el-select
                v-model="queryForm.settlementStatus"
                clearable
                placeholder="全部"
                class="filter-control"
              >
                <el-option label="销售已结清" value="销售已结清" />
                <el-option label="开票已结清" value="开票已结清" />
                <el-option label="未结清" value="未结清" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12" :lg="4">
            <el-form-item label="合并筛选" class="query-item-merged">
              <el-tree-select
                v-model="mergedFilterValues"
                class="filter-control"
                :data="mergedFilterTree"
                multiple
                check-strictly
                filterable
                clearable
                collapse-tags
                collapse-tags-tooltip
                node-key="value"
                placeholder="请选择进度"
                @change="handleMergedFilterChange"
              />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12" :lg="2">
            <el-form-item label="异常类型">
              <el-select
                v-model="queryForm.anomalyType"
                placeholder="全部"
                clearable
                class="filter-control"
              >
                <el-option label="已销售未开票" value="uninvoiced" />
                <el-option label="已开票未回款" value="unreceived" />
                <el-option label="生产完成未出货" value="unshipped" />
                <el-option label="订单超期未回款" value="overdue" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12" :lg="4">
            <el-form-item label="订单日期" class="query-item-order-date">
              <el-date-picker
                v-model="queryForm.dateRange"
                type="daterange"
                value-format="YYYY-MM-DD"
                range-separator="~"
                start-placeholder="开始日期"
                end-placeholder="结束日期"
                clearable
                class="filter-control"
              />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12" :lg="3">
            <el-form-item label=" " class="filter-actions-item">
              <div class="filter-actions">
                <el-button type="primary" :loading="loading" @click="handleSearch">查询</el-button>
                <el-button @click="handleReset">重置</el-button>
              </div>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </section>

    <el-row :gutter="16">
      <el-col :xs="24" :sm="12" :lg="4">
        <el-card shadow="hover" class="summary-card summary-card--c1">
          <div class="summary-card__title">项目数</div>
          <div class="summary-card__value">{{ summaryCards.projectCount.toLocaleString() }}</div>
          <div class="summary-card__meta">筛选范围项目总数</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="4">
        <el-card shadow="hover" class="summary-card summary-card--c2">
          <div class="summary-card__title">销售金额</div>
          <div class="summary-card__value">{{ formatAmount(summaryCards.salesAmount) }}</div>
          <div class="summary-card__meta">筛选范围销售订单汇总</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="4">
        <el-card shadow="hover" class="summary-card summary-card--c3">
          <div class="summary-card__title">开票金额</div>
          <div class="summary-card__value">{{ formatAmount(summaryCards.invoiceAmount) }}</div>
          <div class="summary-card__meta">筛选范围开票汇总</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="4">
        <el-card shadow="hover" class="summary-card summary-card--c4">
          <div class="summary-card__title">回款合计(贴息金额)</div>
          <div class="summary-card__value">
            {{ formatAmountPair(summaryCards.receiptAmount, summaryCards.discountAmount) }}
          </div>
          <div class="summary-card__meta">筛选范围回款(含贴息)汇总</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="4">
        <el-card shadow="hover" class="summary-card summary-card--c5">
          <div class="summary-card__title">未开票金额</div>
          <div class="summary-card__value">{{ formatAmount(summaryCards.uninvoicedAmount) }}</div>
          <div class="summary-card__meta">销售金额减开票金额</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="4">
        <el-card shadow="hover" class="summary-card summary-card--c6">
          <div class="summary-card__title">未回款金额</div>
          <div class="summary-card__value">{{ formatAmount(summaryUnreceivedAmount) }}</div>
          <div class="summary-card__meta">销售金额减回款合计</div>
        </el-card>
      </el-col>
    </el-row>

    <section class="rounded-lg bg-[var(--el-bg-color-overlay)] p-3 shadow-sm">
      <el-tabs v-model="activeView">
        <el-tab-pane label="表格视图" name="table">
          <el-table
            v-loading="loading"
            :data="tableData"
            border
            row-key="projectCode"
            :height="tableHeight"
            @row-click="handleRowClick"
          >
            <el-table-column type="index" width="60" label="序号" align="center" />
            <el-table-column prop="projectCode" label="项目编号" min-width="145" />
            <el-table-column
              prop="customerName"
              label="客户名称"
              min-width="130"
              show-overflow-tooltip
              class-name="col-customer-name"
            />
            <el-table-column
              prop="productName"
              label="产品名称"
              min-width="125"
              show-overflow-tooltip
            >
              <template #header>
                <div class="cq-name-header">
                  <span>产品名称</span>
                  <el-tooltip
                    v-if="!isMobile"
                    content="展开/折叠图号、模号、负责人列"
                    placement="top"
                  >
                    <span
                      class="cq-column-toggle"
                      @click.stop="showExtraColumns = !showExtraColumns"
                    >
                      {{ showExtraColumns ? '▾' : '▸' }}
                    </span>
                  </el-tooltip>
                </div>
              </template>
            </el-table-column>
            <el-table-column
              v-if="!isMobile && showExtraColumns"
              prop="productDrawing"
              label="产品图号"
              min-width="120"
              show-overflow-tooltip
            />
            <el-table-column
              v-if="!isMobile && showExtraColumns"
              prop="customerModelNo"
              label="客户模号"
              min-width="120"
              show-overflow-tooltip
            />
            <el-table-column
              v-if="!isMobile && showExtraColumns"
              prop="owner"
              label="负责人"
              width="88"
              align="center"
            />
            <el-table-column label="项目状态" width="110" align="center" show-overflow-tooltip>
              <template #default="{ row }">
                <el-tag
                  :type="getProjectStatusTagType(row.projectStatus)"
                  class="cq-production-status-tag cq-status-tag--fixed"
                >
                  {{ row.projectStatus || '-' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="生产状态" width="110" align="center" show-overflow-tooltip>
              <template #default="{ row }">
                <el-tag
                  :type="getProductionStatusTagType(row.productionStatus)"
                  class="cq-production-status-tag cq-status-tag--fixed"
                >
                  {{ row.productionStatus || '-' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="销售金额" width="118" align="right">
              <template #default="{ row }">{{ formatAmount(row.salesAmount) }}</template>
            </el-table-column>
            <el-table-column label="开票金额" width="108" align="right">
              <template #default="{ row }">{{ formatAmount(row.invoiceAmount) }}</template>
            </el-table-column>
            <el-table-column label="回款金额" width="108" align="right">
              <template #default="{ row }">{{ formatAmount(row.receiptAmount) }}</template>
            </el-table-column>
            <el-table-column label="贴息金额" width="108" align="right">
              <template #default="{ row }">{{ formatAmount(row.discountAmount) }}</template>
            </el-table-column>
            <el-table-column label="未开票金额" width="108" align="right">
              <template #default="{ row }">{{ formatAmount(row.uninvoicedAmount) }}</template>
            </el-table-column>
            <el-table-column label="未回款金额" width="108" align="right">
              <template #default="{ row }">{{ formatAmount(row.unreceivedAmount) }}</template>
            </el-table-column>
            <el-table-column label="状态" width="120" align="center">
              <template #default="{ row }">
                <el-tag
                  :type="getSettlementStatusTagType(row.settlementStatus)"
                  class="cq-status-tag--fixed"
                >
                  {{ row.settlementStatus || '-' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="异常类型" width="120" align="center" show-overflow-tooltip>
              <template #default="{ row }">
                <el-tag v-if="row.anomalyType" type="danger">
                  {{ anomalyLabelMap[row.anomalyType] || row.anomalyType }}
                </el-tag>
                <span v-else>-</span>
              </template>
            </el-table-column>
            <el-table-column prop="latestOrderDate" label="最近订单" width="110" align="center" />
            <el-table-column prop="latestInvoiceDate" label="最近开票" width="110" align="center" />
            <el-table-column prop="latestReceiptDate" label="最近回款" width="110" align="center" />
            <el-table-column prop="outboundQty" label="出货数量" width="82" align="right" />
            <el-table-column
              prop="latestOutboundDate"
              label="最近出货"
              width="110"
              align="center"
            />
            <el-table-column label="操作" width="66" align="center" fixed="right">
              <template #default="{ row }">
                <el-button type="primary" link @click.stop="handleViewInsight(row)">详情</el-button>
              </template>
            </el-table-column>
            <template #empty>
              <el-empty description="暂无数据" :image-size="120" />
            </template>
          </el-table>

          <div
            v-if="total > 0"
            class="pagination-footer"
            :class="{ 'pagination-footer--mobile': isMobile }"
          >
            <el-pagination
              background
              layout="total, sizes, prev, pager, next, jumper"
              :current-page="pagination.page"
              :page-size="pagination.pageSize"
              :page-sizes="[10, 20, 30, 50]"
              :total="total"
              @size-change="handlePageSizeChange"
              @current-change="handlePageChange"
            />
          </div>
        </el-tab-pane>

        <el-tab-pane label="洞察视图" name="insights">
          <div class="insight-toolbar">
            <el-select
              v-model="selectedProjectCode"
              filterable
              clearable
              placeholder="请选择项目编号"
              style="width: 320px"
            >
              <el-option
                v-for="item in projectOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
            <el-button
              type="primary"
              :disabled="!selectedProjectCode"
              :loading="journeyLoading"
              @click="loadJourney"
            >
              加载洞察
            </el-button>
          </div>

          <div v-if="!selectedProjectCode" class="insight-empty">
            <el-empty description="请先选择一个项目查看洞察" :image-size="120" />
          </div>

          <div v-else-if="journeyLoading" class="insight-empty">
            <el-skeleton :rows="8" animated />
          </div>

          <div v-else-if="journey" class="insight-layout">
            <div class="insight-left">
              <div class="mb-3 text-sm text-[var(--el-text-color-secondary)]">
                项目：<span class="font-semibold text-[var(--el-text-color-primary)]">{{
                  journey.projectCode
                }}</span>
              </div>

              <div class="stage-grid">
                <div v-for="stage in stageCards" :key="stage.key" class="stage-card">
                  <div class="stage-card__head">
                    <div class="stage-card__title">{{ stage.name }}</div>
                    <el-tag :type="resolveStageTag(stage.status)">{{
                      resolveStageText(stage.status)
                    }}</el-tag>
                  </div>
                  <div class="stage-card__summary">{{ stage.summary || '-' }}</div>
                  <div class="stage-card__meta">
                    <template v-for="item in stage.dateItems" :key="`${stage.key}-${item.key}`">
                      <div class="stage-card__meta-row">
                        <span>{{ item.label }}</span>
                        <span>{{ item.value || '-' }}</span>
                      </div>
                    </template>
                  </div>
                </div>

                <div class="stage-card stage-card--reserved">
                  <div class="stage-card__head">
                    <div class="stage-card__title">采购（预留）</div>
                    <el-tag type="info">待接入</el-tag>
                  </div>
                  <div class="stage-card__summary">后续新增采购阶段后将自动接入此处。</div>
                </div>

                <div class="stage-card stage-card--reserved">
                  <div class="stage-card__head">
                    <div class="stage-card__title">入库（预留）</div>
                    <el-tag type="info">待接入</el-tag>
                  </div>
                  <div class="stage-card__summary">后续新增入库阶段后将自动接入此处。</div>
                </div>
              </div>
            </div>

            <div class="insight-right">
              <div class="text-sm font-semibold text-[var(--el-text-color-primary)] mb-2"
                >阶段事件时间线</div
              >
              <el-timeline v-if="journey.events.length">
                <el-timeline-item
                  v-for="(event, idx) in journey.events"
                  :key="`${event.stage}-${event.date}-${idx}`"
                  :type="resolveStageTag(stageStatusMap[event.stage] || 'in_progress')"
                >
                  <div class="timeline-event-title">{{ event.title }}</div>
                  <div class="timeline-event-meta">
                    <span class="timeline-event-date">{{ event.date }}</span>
                    <span class="timeline-event-detail">{{ event.detail }}</span>
                  </div>
                </el-timeline-item>
              </el-timeline>
              <el-empty v-else description="暂无阶段事件" :image-size="100" />
            </div>
          </div>

          <div v-else class="insight-empty">
            <el-empty description="未查询到项目洞察数据" :image-size="120" />
          </div>
        </el-tab-pane>
      </el-tabs>
    </section>
  </div>
</template>

<script setup lang="ts">
import {
  ElButton,
  ElCard,
  ElCol,
  ElDatePicker,
  ElEmpty,
  ElForm,
  ElFormItem,
  ElInput,
  ElOption,
  ElPagination,
  ElRow,
  ElSelect,
  ElSkeleton,
  ElTabPane,
  ElTable,
  ElTableColumn,
  ElTabs,
  ElTag,
  ElTreeSelect,
  ElTimeline,
  ElTimelineItem
} from 'element-plus'
import type { FormInstance } from 'element-plus'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { getSalesOrderCustomerOptionsApi, type SalesOrderCustomerOption } from '@/api/sales-orders'
import type {
  ComprehensiveQueryListParams,
  ComprehensiveQueryRow,
  ComprehensiveQuerySummary,
  ProjectJourney
} from '@/api/comprehensive-query'
import {
  getComprehensiveQueryListApi,
  getComprehensiveQuerySummaryApi,
  getProjectJourneyApi
} from '@/api/comprehensive-query'
import { useAppStore } from '@/store/modules/app'

interface QueryForm {
  keyword: string
  customerName: string
  category: string
  settlementStatus: string
  anomalyType: string
  progressType: string
  progressRange: string
  dateRange: [string, string] | []
}

const queryFormRef = ref<FormInstance>()
const queryForm = reactive<QueryForm>({
  keyword: '',
  customerName: '',
  category: '',
  settlementStatus: '',
  anomalyType: '',
  progressType: '',
  progressRange: '',
  dateRange: []
})

const loading = ref(false)
const tableData = ref<ComprehensiveQueryRow[]>([])
const total = ref(0)
const appStore = useAppStore()
const isMobile = computed(() => appStore.getMobile)
const tableHeight = computed(() => (isMobile.value ? undefined : 'calc(100vh - 400px)'))

const pagination = reactive({
  page: 1,
  pageSize: 20
})

const activeView = ref<'table' | 'insights'>('table')
const selectedProjectCode = ref('')
const journeyLoading = ref(false)
const journey = ref<ProjectJourney | null>(null)
const showExtraColumns = ref(false)
const customerOptions = ref<string[]>([])
const categoryOptions = ref<string[]>(['塑胶模具', '修改模具', '零件加工'])
const mergedFilterValues = ref<string[]>([])

const mergedFilterTree = computed(() => [
  {
    label: '生产进度',
    value: 'progressType:production',
    disabled: true,
    children: [
      { label: '0%', value: 'progress:production:0' },
      { label: '0%-30%', value: 'progress:production:0_30' },
      { label: '30%-60%', value: 'progress:production:30_60' },
      { label: '60%-90%', value: 'progress:production:60_90' },
      { label: '90%-100%', value: 'progress:production:90_100' },
      { label: '100%', value: 'progress:production:100' }
    ]
  },
  {
    label: '开票进度',
    value: 'progressType:invoice',
    disabled: true,
    children: [
      { label: '0%', value: 'progress:invoice:0' },
      { label: '0%-30%', value: 'progress:invoice:0_30' },
      { label: '30%-60%', value: 'progress:invoice:30_60' },
      { label: '60%-90%', value: 'progress:invoice:60_90' },
      { label: '90%-100%', value: 'progress:invoice:90_100' },
      { label: '100%', value: 'progress:invoice:100' }
    ]
  },
  {
    label: '回款进度',
    value: 'progressType:receipt',
    disabled: true,
    children: [
      { label: '0%', value: 'progress:receipt:0' },
      { label: '0%-30%', value: 'progress:receipt:0_30' },
      { label: '30%-60%', value: 'progress:receipt:30_60' },
      { label: '60%-90%', value: 'progress:receipt:60_90' },
      { label: '90%-100%', value: 'progress:receipt:90_100' },
      { label: '100%', value: 'progress:receipt:100' }
    ]
  },
  {
    label: '出货进度',
    value: 'progressType:outbound',
    disabled: true,
    children: [
      { label: '0%', value: 'progress:outbound:0' },
      { label: '0%-30%', value: 'progress:outbound:0_30' },
      { label: '30%-60%', value: 'progress:outbound:30_60' },
      { label: '60%-90%', value: 'progress:outbound:60_90' },
      { label: '90%-100%', value: 'progress:outbound:90_100' },
      { label: '100%', value: 'progress:outbound:100' }
    ]
  }
])

const summaryCards = ref<ComprehensiveQuerySummary>({
  projectCount: 0,
  salesAmount: 0,
  invoiceAmount: 0,
  receiptAmount: 0,
  discountAmount: 0,
  completedQty: 0,
  outboundQty: 0,
  uninvoicedAmount: 0,
  unreceivedAmount: 0
})

const summaryUnreceivedAmount = computed(() =>
  Math.max(
    0,
    Number(summaryCards.value.salesAmount || 0) -
      (Number(summaryCards.value.receiptAmount || 0) +
        Number(summaryCards.value.discountAmount || 0))
  )
)

const projectOptions = computed(() =>
  tableData.value.map((item) => ({
    value: item.projectCode,
    label: `${item.projectCode} ${item.customerName ? `- ${item.customerName}` : ''}`
  }))
)

const anomalyLabelMap: Record<string, string> = {
  uninvoiced: '已销售未开票',
  unreceived: '已开票未回款',
  unshipped: '生产完成未出货',
  overdue: '订单超期未回款'
}

const stageDateLabelMap: Record<string, string> = {
  latestOrderDate: '最近订单',
  drawingReleaseDate: '图纸下发',
  plannedSampleDate: '计划首样',
  firstSampleDate: '首次送样',
  relocationDate: '移模日期',
  issuedDate: '下达日期',
  startDate: '开始日期',
  endDate: '结束日期',
  totalHours: '工时合计',
  latestOutboundDate: '最近出货',
  latestInvoiceDate: '最近开票',
  latestReceiptDate: '最近回款'
}

const stageCards = computed(() => {
  const list = journey.value?.stages || []
  return list.map((stage) => {
    const dates = (stage.dates || {}) as Record<string, string>
    const dateItems = Object.keys(dates).map((key) => ({
      key,
      label: stageDateLabelMap[key] || key,
      value: dates[key]
    }))
    return {
      ...stage,
      dateItems
    }
  })
})

const resolveStageTag = (status: string) => {
  if (status === 'completed') return 'success'
  if (status === 'in_progress') return 'warning'
  if (status === 'pending') return 'info'
  return 'primary'
}

const resolveStageText = (status: string) => {
  if (status === 'completed') return '已完成'
  if (status === 'in_progress') return '进行中'
  if (status === 'pending') return '待开始'
  return status || '-'
}

const getProjectStatusTagType = (status?: string) => {
  if (!status) return 'info'
  const statusTypeMap: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'primary'> = {
    T0: 'danger',
    T1: 'warning',
    T2: 'warning',
    设计中: 'warning',
    加工中: 'primary',
    表面处理: 'info',
    封样: 'primary',
    待移模: 'primary',
    已经移模: 'success'
  }
  return statusTypeMap[status] || 'info'
}

const getProductionStatusTagType = (status?: string) => {
  if (!status) return 'info'
  const statusMap: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {
    待开始: 'info',
    进行中: 'warning',
    已完成: 'success',
    已暂停: 'danger',
    已取消: 'danger'
  }
  return statusMap[status] || 'info'
}

const getSettlementStatusTagType = (status?: string) => {
  if (status === '销售已结清') return 'success'
  if (status === '开票已结清') return 'primary'
  return 'warning'
}

const stageStatusMap = computed(() => {
  const map: Record<string, string> = {}
  ;(journey.value?.stages || []).forEach((stage) => {
    map[stage.key] = stage.status
  })
  return map
})

const formatAmount = (value: number) => {
  const amount = Number(value || 0)
  if (!Number.isFinite(amount) || amount === 0) return '-'
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

const formatAmountPair = (left: number, right: number) => {
  const total = Number(left || 0) + Number(right || 0)
  const discount = Number(right || 0)
  const fmt = (value: number) =>
    value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  return `${fmt(total)}(${fmt(discount)})`
}

const handleMergedFilterChange = (values: string[] | string | undefined) => {
  const list = Array.isArray(values) ? values : values ? [values] : []
  const progressItems = list.filter((item) => item.startsWith('progress:'))
  const lastProgress = progressItems[progressItems.length - 1]
  if (!lastProgress) {
    queryForm.progressType = ''
    queryForm.progressRange = ''
    return
  }
  const parts = lastProgress.split(':')
  queryForm.progressType = parts[1] || ''
  queryForm.progressRange = parts[2] || ''
}

const buildListParams = (): ComprehensiveQueryListParams => {
  return {
    keyword: queryForm.keyword.trim() || undefined,
    customerName: queryForm.customerName.trim() || undefined,
    category: queryForm.category || undefined,
    settlementStatus: queryForm.settlementStatus || undefined,
    anomalyType: queryForm.anomalyType || undefined,
    progressType: queryForm.progressType || undefined,
    progressRange: queryForm.progressRange || undefined,
    startDate: queryForm.dateRange[0] || undefined,
    endDate: queryForm.dateRange[1] || undefined
  }
}

const parseResponseData = (rawResp: unknown) => {
  const raw = rawResp as any
  const pr: any = raw?.data ?? raw
  return pr?.data ?? pr
}

const loadSummary = async () => {
  try {
    const params = buildListParams()
    const resp = await getComprehensiveQuerySummaryApi(params)
    const summary = parseResponseData(resp)
    summaryCards.value = {
      projectCount: Number(summary?.projectCount || 0),
      salesAmount: Number(summary?.salesAmount || 0),
      invoiceAmount: Number(summary?.invoiceAmount || 0),
      receiptAmount: Number(summary?.receiptAmount || 0),
      discountAmount: Number(summary?.discountAmount || 0),
      completedQty: Number(summary?.completedQty || 0),
      outboundQty: Number(summary?.outboundQty || 0),
      uninvoicedAmount: Number(summary?.uninvoicedAmount || 0),
      unreceivedAmount: Number(summary?.unreceivedAmount || 0)
    }
  } catch (error) {
    console.error('[ComprehensiveQuery] loadSummary failed:', error)
    summaryCards.value = {
      projectCount: 0,
      salesAmount: 0,
      invoiceAmount: 0,
      receiptAmount: 0,
      discountAmount: 0,
      completedQty: 0,
      outboundQty: 0,
      uninvoicedAmount: 0,
      unreceivedAmount: 0
    }
  }
}

const loadFilterOptions = async () => {
  try {
    const customersResp = await getSalesOrderCustomerOptionsApi({ status: 'active' })
    const customerData = parseResponseData(customersResp)
    const customers = Array.isArray(customerData?.list) ? customerData.list : []

    customerOptions.value = customers
      .filter((item: SalesOrderCustomerOption) => item?.status === 'active')
      .map((item: SalesOrderCustomerOption) => String(item?.customerName || '').trim())
      .filter(Boolean)
      .filter((item: string, idx: number, arr: string[]) => arr.indexOf(item) === idx)
  } catch (error) {
    console.error('[ComprehensiveQuery] loadFilterOptions failed:', error)
    customerOptions.value = []
    categoryOptions.value = ['塑胶模具', '修改模具', '零件加工']
  }
}

const loadList = async () => {
  loading.value = true
  try {
    const params = {
      ...buildListParams(),
      page: pagination.page,
      pageSize: pagination.pageSize
    }

    const resp = await getComprehensiveQueryListApi(params)
    const data = parseResponseData(resp)
    const list = data?.list ?? []
    const totalCount = data?.total ?? 0

    if (Array.isArray(list)) {
      tableData.value = list
      total.value = Number(totalCount) || 0
      const dynamicCategories = list
        .map((row) => String(row?.category || '').trim())
        .filter(Boolean)
      if (dynamicCategories.length) {
        categoryOptions.value = Array.from(
          new Set([...categoryOptions.value, ...dynamicCategories])
        )
      }

      if (!list.length) {
        selectedProjectCode.value = ''
        journey.value = null
      } else if (
        !selectedProjectCode.value ||
        !list.some((row) => row.projectCode === selectedProjectCode.value)
      ) {
        selectedProjectCode.value = list[0].projectCode
        journey.value = null
      }
    } else {
      tableData.value = []
      total.value = 0
      selectedProjectCode.value = ''
      journey.value = null
    }
  } catch (error) {
    console.error('[ComprehensiveQuery] loadList failed:', error)
    tableData.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

const loadAll = async () => {
  await Promise.all([loadList(), loadSummary()])
}

const loadJourney = async () => {
  const projectCode = selectedProjectCode.value
  if (!projectCode) {
    journey.value = null
    return
  }

  journeyLoading.value = true
  try {
    const resp = await getProjectJourneyApi(projectCode)
    const raw: any = resp
    const pr: any = raw?.data ?? raw
    journey.value = (pr?.data ?? pr) as ProjectJourney
  } catch (error) {
    console.error('[ComprehensiveQuery] loadJourney failed:', error)
    journey.value = null
  } finally {
    journeyLoading.value = false
  }
}

const handleSearch = () => {
  pagination.page = 1
  void loadAll()
}

const handleReset = () => {
  queryForm.keyword = ''
  queryForm.customerName = ''
  queryForm.category = ''
  queryForm.settlementStatus = ''
  queryForm.anomalyType = ''
  queryForm.progressType = ''
  queryForm.progressRange = ''
  mergedFilterValues.value = []
  queryForm.dateRange = []
  queryFormRef.value?.clearValidate?.()
  pagination.page = 1
  void loadAll()
}

const handlePageSizeChange = (size: number) => {
  pagination.pageSize = size
  pagination.page = 1
  void loadList()
}

const handlePageChange = (page: number) => {
  pagination.page = page
  void loadList()
}

const handleRowClick = (row: ComprehensiveQueryRow) => {
  selectedProjectCode.value = row.projectCode
}

const handleViewInsight = (row: ComprehensiveQueryRow) => {
  selectedProjectCode.value = row.projectCode
  activeView.value = 'insights'
}

watch(
  () => selectedProjectCode.value,
  (value) => {
    if (!value) {
      journey.value = null
      return
    }
    if (activeView.value === 'insights') {
      void loadJourney()
    }
  }
)

watch(
  () => activeView.value,
  (value) => {
    if (value === 'insights' && selectedProjectCode.value && !journey.value) {
      void loadJourney()
    }
  }
)

onMounted(() => {
  void loadFilterOptions()
  void loadAll()
})
</script>

<style scoped>
.filter-form :deep(.el-form-item) {
  margin-bottom: 6px;
}

.filter-form :deep(.el-form-item__label) {
  padding-right: 6px;
  font-size: 12px;
}

.filter-control {
  width: 100%;
}

.query-item-order-date :deep(.el-form-item__content) {
  justify-content: flex-end;
}

.query-item-expand :deep(.el-form-item__label) {
  width: 48px !important;
}

.query-item-customer :deep(.el-form-item__label) {
  width: 60px !important;
  white-space: nowrap;
}

.filter-form :deep(.filter-control .el-input__wrapper) {
  min-height: 30px;
}

.filter-actions-item :deep(.el-form-item__label) {
  color: transparent;
}

.filter-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: nowrap;
  width: 100%;
}

.query-section {
  padding-top: 10px !important;
  padding-bottom: 6px !important;
}

.summary-card {
  min-height: 64px;
  border: none;
  transition: all 0.25s ease;
}

:deep(.summary-card .el-card__body) {
  padding: 6px 8px;
}

.summary-card:hover {
  transform: translateY(-2px);
}

.summary-card--c1 {
  background: linear-gradient(145deg, rgb(42 157 143 / 14%), rgb(42 157 143 / 6%));
}

.summary-card--c2 {
  background: linear-gradient(145deg, rgb(38 70 83 / 14%), rgb(38 70 83 / 6%));
}

.summary-card--c3 {
  background: linear-gradient(145deg, rgb(233 196 106 / 16%), rgb(233 196 106 / 7%));
}

.summary-card--c4 {
  background: linear-gradient(145deg, rgb(244 162 97 / 14%), rgb(244 162 97 / 6%));
}

.summary-card--c5 {
  background: linear-gradient(145deg, rgb(231 111 81 / 14%), rgb(231 111 81 / 6%));
}

.summary-card--c6 {
  background: linear-gradient(145deg, rgb(141 153 174 / 16%), rgb(141 153 174 / 7%));
}

.summary-card__title {
  margin-bottom: 2px;
  font-size: 11px;
  line-height: 1.1;
  color: var(--el-text-color-secondary);
}

.summary-card__value {
  font-size: 16px;
  font-weight: 600;
  line-height: 1.1;
  color: var(--el-text-color-primary);
}

.summary-card__meta {
  margin-top: 2px;
  font-size: 10px;
  line-height: 1.1;
  color: var(--el-text-color-secondary);
}

:deep(.el-tag.cq-production-status-tag) {
  height: 22px;
  padding-top: 0;
  padding-bottom: 0;
  line-height: 18px;
}

:deep(.el-tag.cq-production-status-tag.el-tag--success) {
  color: #52c41a !important;
  background-color: rgb(82 196 26 / 12%) !important;
  border-color: rgb(82 196 26 / 45%) !important;
}

:deep(.el-tag.cq-production-status-tag.el-tag--warning) {
  color: #faad14 !important;
  background-color: rgb(250 173 20 / 12%) !important;
  border-color: rgb(250 173 20 / 45%) !important;
}

:deep(.el-tag.cq-production-status-tag.el-tag--danger) {
  color: #f5222d !important;
  background-color: rgb(245 34 45 / 12%) !important;
  border-color: rgb(245 34 45 / 45%) !important;
}

:deep(.el-tag.cq-production-status-tag.el-tag--info) {
  color: #13c2c2 !important;
  background-color: rgb(19 194 194 / 12%) !important;
  border-color: rgb(19 194 194 / 45%) !important;
}

:deep(.el-tag.cq-status-tag--fixed) {
  display: inline-flex;
  width: 80px;
  text-align: center;
  white-space: nowrap;
  box-sizing: border-box;
  justify-content: center;
}

.cq-name-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.cq-column-toggle {
  display: inline-flex;
  width: 18px;
  height: 18px;
  margin-left: 4px;
  font-size: 14px;
  color: var(--el-text-color-placeholder);
  cursor: pointer;
  align-items: center;
  justify-content: center;
}

.cq-column-toggle:hover {
  color: var(--el-color-primary);
}

.insight-toolbar {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 8px;
}

.pagination-footer {
  position: fixed;
  bottom: 10px;
  left: 50%;
  z-index: 10;
  display: flex;
  transform: translateX(-50%);
  justify-content: center;
}

.insight-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 220px;
}

.insight-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
  gap: 10px;
  height: calc(100vh - 440px);
  max-height: calc(100vh - 440px);
  min-height: calc(100vh - 440px);
}

.insight-left,
.insight-right {
  padding: 10px;
  overflow: auto;
  background: var(--el-fill-color-blank);
  border: 1px solid var(--el-border-color-light);
  border-radius: 12px;
}

.stage-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.stage-card {
  padding: 10px;
  background: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
}

.stage-card--reserved {
  background: rgb(64 158 255 / 4%);
}

.stage-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.stage-card__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.stage-card__summary {
  margin-bottom: 8px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-regular);
}

.stage-card__meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stage-card__meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.timeline-event-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.timeline-event-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 2px;
}

.timeline-event-date {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.timeline-event-detail {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

:deep(.col-customer-name .cell) {
  white-space: nowrap;
}

@media (width <= 1200px) {
  .insight-layout {
    grid-template-columns: 1fr;
  }
}

@media (width <= 768px) {
  .stage-grid {
    grid-template-columns: 1fr;
  }

  .insight-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .pagination-footer--mobile {
    position: static;
    left: auto;
    margin-top: 8px;
    transform: none;
  }
}
</style>
