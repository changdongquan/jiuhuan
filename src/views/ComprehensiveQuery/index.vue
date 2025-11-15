<template>
  <div class="comprehensive-query-page space-y-4 p-4">
    <section class="rounded-lg bg-[var(--el-bg-color-overlay)] p-4 shadow-sm">
      <div class="mb-4 text-sm font-medium text-[var(--el-text-color-secondary)]">
        {{ t('comprehensive.summary') }}
      </div>
      <el-form ref="queryFormRef" :model="queryForm" label-width="100px" class="filter-form">
        <el-row :gutter="16">
          <el-col :xs="24" :sm="12" :lg="8">
            <el-form-item :label="t('comprehensive.keyword')">
              <el-input
                v-model="queryForm.keyword"
                :placeholder="t('comprehensive.keywordPlaceholder')"
                clearable
              />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12" :lg="8">
            <el-form-item :label="t('comprehensive.customerName')">
              <el-input
                v-model="queryForm.customerName"
                :placeholder="t('comprehensive.customerPlaceholder')"
                clearable
              />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12" :lg="8">
            <el-form-item :label="t('comprehensive.owner')">
              <el-input
                v-model="queryForm.owner"
                :placeholder="t('comprehensive.ownerPlaceholder')"
                clearable
              />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12" :lg="8">
            <el-form-item :label="t('comprehensive.businessType')">
              <el-select
                v-model="queryForm.businessType"
                :placeholder="t('common.selectText')"
                clearable
              >
                <el-option
                  v-for="item in businessTypeOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12" :lg="8">
            <el-form-item :label="t('comprehensive.status')">
              <el-select
                v-model="queryForm.status"
                :placeholder="t('common.selectText')"
                :disabled="!statusOptions.length"
                clearable
              >
                <el-option
                  v-for="item in statusOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12" :lg="8">
            <el-form-item :label="t('comprehensive.dateRange')">
              <el-date-picker
                v-model="queryForm.dateRange"
                type="daterange"
                value-format="YYYY-MM-DD"
                range-separator="~"
                :start-placeholder="t('common.startTimeText')"
                :end-placeholder="t('common.endTimeText')"
                clearable
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <div class="flex flex-wrap items-center justify-end gap-2">
          <el-button type="primary" @click="handleSearch">{{ t('common.query') }}</el-button>
          <el-button @click="handleReset">{{ t('common.reset') }}</el-button>
        </div>
      </el-form>
    </section>

    <el-row :gutter="16">
      <el-col v-for="(item, index) in summaryCards" :key="item.key" :xs="24" :sm="12" :lg="6">
        <el-card
          shadow="hover"
          :class="[
            'summary-card',
            index === 0 ? 'summary-card--blue' : '',
            index === 1 ? 'summary-card--green' : '',
            index === 2 ? 'summary-card--orange' : '',
            index === 3 ? 'summary-card--gray' : ''
          ]"
        >
          <div class="summary-card__title">{{ item.title }}</div>
          <div class="summary-card__value">{{ item.value }}</div>
          <div class="summary-card__meta">{{ item.meta }}</div>
        </el-card>
      </el-col>
    </el-row>

    <section class="rounded-lg bg-[var(--el-bg-color-overlay)] p-4 shadow-sm">
      <div class="mb-4 flex items-center justify-between">
        <div class="text-base font-medium text-[var(--el-text-color-primary)]">
          {{ t('comprehensive.tableView') }}
        </div>
        <div class="flex items-center gap-2">
          <span class="text-sm text-[var(--el-text-color-secondary)]">
            {{ t('comprehensive.filteredCount') }}: {{ totalRecords }}
          </span>
          <el-button text type="primary" :loading="loading" @click="handleRefresh">
            {{ t('common.refresh') }}
          </el-button>
        </div>
      </div>

      <el-tabs v-model="activeView" class="comprehensive-tabs">
        <el-tab-pane :label="t('comprehensive.tableView')" name="table">
          <el-table v-loading="loading" :data="paginatedRecords" border height="520" row-key="id">
            <el-table-column type="index" width="60" label="#" align="center" />
            <el-table-column :label="t('comprehensive.businessType')" width="140" align="center">
              <template #default="{ row }">
                <el-tag :type="resolveBusinessMeta(row.businessType).tagType">
                  {{ resolveBusinessMeta(row.businessType).label }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column
              prop="documentNo"
              :label="t('comprehensive.documentNo')"
              min-width="150"
            />
            <el-table-column
              prop="customerName"
              :label="t('comprehensive.customerName')"
              min-width="160"
            />
            <el-table-column prop="owner" :label="t('comprehensive.ownerLabel')" min-width="140" />
            <el-table-column :label="t('comprehensive.amountUnit')" width="150" align="right">
              <template #default="{ row }">
                {{ formatAmount(row.amount, row.currency) }}
              </template>
            </el-table-column>
            <el-table-column :label="t('comprehensive.status')" width="140" align="center">
              <template #default="{ row }">
                <el-tag :type="resolveStatusMeta(row).tagType" disable-transitions>
                  {{ resolveStatusMeta(row).label }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="issuedAt" :label="t('comprehensive.date')" width="140" />
            <el-table-column prop="dueAt" :label="t('comprehensive.dueDate')" width="140" />
            <el-table-column
              prop="summary"
              :label="t('comprehensive.description')"
              min-width="220"
              show-overflow-tooltip
            />
            <template #empty>
              <el-empty :description="t('comprehensive.emptyState')" :image-size="160" />
            </template>
          </el-table>

          <div v-if="totalRecords > 0" class="flex justify-end pt-4">
            <el-pagination
              background
              layout="total, sizes, prev, pager, next, jumper"
              :current-page="pagination.page"
              :page-size="pagination.size"
              :page-sizes="[10, 20, 30, 50]"
              :total="totalRecords"
              @size-change="handleSizeChange"
              @current-change="handleCurrentChange"
            />
          </div>
        </el-tab-pane>

        <el-tab-pane :label="t('comprehensive.insightsView')" name="insights">
          <el-row :gutter="16">
            <el-col :xs="24" :lg="12">
              <div class="insight-panel">
                <div class="insight-panel__title">{{ t('comprehensive.topCustomers') }}</div>
                <div v-if="topCustomers.length" class="insight-panel__body">
                  <div
                    v-for="customer in topCustomers"
                    :key="customer.customerName"
                    class="insight-panel__item"
                  >
                    <div>
                      <div class="font-medium text-[var(--el-text-color-primary)]">
                        {{ customer.customerName }}
                      </div>
                      <div class="text-xs text-[var(--el-text-color-secondary)]">
                        {{ t('comprehensive.ownerLabel') }}: {{ customer.owner }}
                      </div>
                    </div>
                    <div class="text-sm font-semibold text-[var(--el-color-primary)]">
                      {{ formatAmount(customer.amount) }}
                    </div>
                  </div>
                </div>
                <el-empty
                  v-else
                  :description="t('comprehensive.analysisPlaceholder')"
                  :image-size="120"
                />
              </div>
            </el-col>
            <el-col :xs="24" :lg="12">
              <div class="insight-panel">
                <div class="insight-panel__title">{{ t('comprehensive.recentActivities') }}</div>
                <div v-if="recentActivities.length" class="insight-panel__body">
                  <el-timeline>
                    <el-timeline-item
                      v-for="item in recentActivities"
                      :key="item.id"
                      :timestamp="item.issuedAt"
                      :type="resolveStatusMeta(item).tagType"
                    >
                      <div class="font-medium text-[var(--el-text-color-primary)]">
                        {{ item.documentNo }} · {{ resolveBusinessMeta(item.businessType).label }}
                      </div>
                      <div class="text-sm text-[var(--el-text-color-secondary)]">
                        {{ item.customerName }} · {{ resolveStatusMeta(item).label }}
                      </div>
                      <div class="text-xs text-[var(--el-text-color-secondary)]">
                        {{ item.summary }}
                      </div>
                    </el-timeline-item>
                  </el-timeline>
                </div>
                <el-empty
                  v-else
                  :description="t('comprehensive.analysisPlaceholder')"
                  :image-size="120"
                />
              </div>
            </el-col>
          </el-row>
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
  ElTabPane,
  ElTable,
  ElTableColumn,
  ElTabs,
  ElTag,
  ElTimeline,
  ElTimelineItem
} from 'element-plus'
import type { FormInstance } from 'element-plus'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from '@/hooks/web/useI18n'

type BusinessType = 'order' | 'invoice' | 'receipt' | 'project' | 'task'
type Currency = 'CNY' | 'USD'
type TagType = 'primary' | 'success' | 'warning' | 'info' | 'danger'

interface StatusDefinition {
  value: string
  labelKey: string
  tagType: TagType
}

interface BusinessDefinition {
  labelKey: string
  tagType: TagType
  statuses: StatusDefinition[]
}

interface ComprehensiveRecord {
  id: number
  businessType: BusinessType
  documentNo: string
  customerName: string
  owner: string
  amount: number
  currency: Currency
  status: string
  issuedAt: string
  dueAt: string
  summary: string
}

interface QueryFilters {
  keyword: string
  customerName: string
  owner: string
  businessType: BusinessType | ''
  status: string
  dateRange: [string, string] | []
}

const { t } = useI18n()

const BUSINESS_DEFINITIONS: Record<BusinessType, BusinessDefinition> = {
  order: {
    labelKey: 'comprehensive.typeOrder',
    tagType: 'primary',
    statuses: [
      { value: 'open', labelKey: 'comprehensive.statusOpen', tagType: 'warning' },
      { value: 'closed', labelKey: 'comprehensive.statusClosed', tagType: 'success' },
      { value: 'paused', labelKey: 'comprehensive.statusPaused', tagType: 'info' }
    ]
  },
  invoice: {
    labelKey: 'comprehensive.typeInvoice',
    tagType: 'warning',
    statuses: [
      { value: 'pending', labelKey: 'comprehensive.statusPending', tagType: 'warning' },
      { value: 'issued', labelKey: 'comprehensive.statusIssued', tagType: 'success' }
    ]
  },
  receipt: {
    labelKey: 'comprehensive.typeReceipt',
    tagType: 'success',
    statuses: [
      { value: 'pending', labelKey: 'comprehensive.statusPending', tagType: 'warning' },
      { value: 'received', labelKey: 'comprehensive.statusReceived', tagType: 'success' }
    ]
  },
  project: {
    labelKey: 'comprehensive.typeProject',
    tagType: 'info',
    statuses: [
      { value: 'ongoing', labelKey: 'comprehensive.statusOngoing', tagType: 'info' },
      { value: 'completed', labelKey: 'comprehensive.statusCompleted', tagType: 'success' }
    ]
  },
  task: {
    labelKey: 'comprehensive.typeTask',
    tagType: 'danger',
    statuses: [
      { value: 'inProgress', labelKey: 'comprehensive.statusInProgress', tagType: 'warning' },
      { value: 'completed', labelKey: 'comprehensive.statusCompleted', tagType: 'success' }
    ]
  }
}

const MOCK_RECORDS: ComprehensiveRecord[] = [
  {
    id: 1,
    businessType: 'order',
    documentNo: 'SO-202401-001',
    customerName: '华东制造有限公司',
    owner: '陈阳',
    amount: 318000,
    currency: 'CNY',
    status: 'open',
    issuedAt: '2024-01-05',
    dueAt: '2024-03-10',
    summary: '智能装备主机采购合同已签署，等待客户确认交付计划。'
  },
  {
    id: 2,
    businessType: 'invoice',
    documentNo: 'INV-202401-018',
    customerName: '远航国际贸易',
    owner: '胡俊',
    amount: 189500,
    currency: 'CNY',
    status: 'issued',
    issuedAt: '2024-01-18',
    dueAt: '2024-02-05',
    summary: '出口服务器项目已开票，等待客户确认税票。'
  },
  {
    id: 3,
    businessType: 'receipt',
    documentNo: 'RCPT-202401-006',
    customerName: '星辰工业',
    owner: '李倩',
    amount: 87000,
    currency: 'CNY',
    status: 'received',
    issuedAt: '2024-01-22',
    dueAt: '2024-01-30',
    summary: '项目尾款到账，需同步财务完成核销。'
  },
  {
    id: 4,
    businessType: 'project',
    documentNo: 'PRJ-202312-02',
    customerName: '华北能源集团',
    owner: '张兵',
    amount: 360000,
    currency: 'CNY',
    status: 'ongoing',
    issuedAt: '2023-12-15',
    dueAt: '2024-04-30',
    summary: '新能源设备联合开发项目处于集成交付阶段。'
  },
  {
    id: 5,
    businessType: 'task',
    documentNo: 'TASK-202401-09',
    customerName: '内部生产任务',
    owner: '陈阳',
    amount: 0,
    currency: 'CNY',
    status: 'inProgress',
    issuedAt: '2024-01-09',
    dueAt: '2024-01-25',
    summary: '电机总成试产批次正在验证工艺参数。'
  },
  {
    id: 6,
    businessType: 'order',
    documentNo: 'SO-202402-003',
    customerName: '凌峰电子',
    owner: '孙晨',
    amount: 249800,
    currency: 'CNY',
    status: 'closed',
    issuedAt: '2024-02-06',
    dueAt: '2024-03-20',
    summary: '海外仓系统订单已交付，客户已确认验收。'
  },
  {
    id: 7,
    businessType: 'invoice',
    documentNo: 'INV-202402-009',
    customerName: '华东制造有限公司',
    owner: '李倩',
    amount: 152000,
    currency: 'CNY',
    status: 'pending',
    issuedAt: '2024-02-20',
    dueAt: '2024-03-05',
    summary: '智慧工厂设备预付款发票待客户确认开票信息。'
  },
  {
    id: 8,
    businessType: 'project',
    documentNo: 'PRJ-202401-08',
    customerName: '远航国际贸易',
    owner: '胡俊',
    amount: 520000,
    currency: 'CNY',
    status: 'completed',
    issuedAt: '2024-01-30',
    dueAt: '2024-03-01',
    summary: '跨境电商系统升级项目顺利上线，等待回顾复盘。'
  },
  {
    id: 9,
    businessType: 'receipt',
    documentNo: 'RCPT-202401-015',
    customerName: '凌峰电子',
    owner: '孙晨',
    amount: 145000,
    currency: 'CNY',
    status: 'pending',
    issuedAt: '2024-01-28',
    dueAt: '2024-02-15',
    summary: '海外仓系统部分回款正在走审批流程。'
  },
  {
    id: 10,
    businessType: 'task',
    documentNo: 'TASK-202402-04',
    customerName: '内部生产任务',
    owner: '陈阳',
    amount: 0,
    currency: 'CNY',
    status: 'completed',
    issuedAt: '2024-02-18',
    dueAt: '2024-02-20',
    summary: '产线测试与调整结束，产能恢复正常。'
  },
  {
    id: 11,
    businessType: 'order',
    documentNo: 'SO-202403-002',
    customerName: '星辰工业',
    owner: '李倩',
    amount: 312400,
    currency: 'CNY',
    status: 'open',
    issuedAt: '2024-03-12',
    dueAt: '2024-05-06',
    summary: '智能传感器采购合同进入物料采购阶段。'
  },
  {
    id: 12,
    businessType: 'project',
    documentNo: 'PRJ-202403-01',
    customerName: '华北能源集团',
    owner: '张兵',
    amount: 280000,
    currency: 'CNY',
    status: 'ongoing',
    issuedAt: '2024-03-05',
    dueAt: '2024-06-30',
    summary: '能源管理系统调试进行中，计划四月完成验收。'
  }
]

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, ms)
  })

const createDefaultFilters = (): QueryFilters => ({
  keyword: '',
  customerName: '',
  owner: '',
  businessType: '',
  status: '',
  dateRange: [] as [string, string] | []
})

const queryFormRef = ref<FormInstance>()
const queryForm = reactive<QueryFilters>(createDefaultFilters())

const loading = ref(false)
const rawRecords = ref<ComprehensiveRecord[]>([])
const activeView = ref<'table' | 'insights'>('table')

const pagination = reactive({
  page: 1,
  size: 10
})

const businessTypeOptions = computed(() =>
  (Object.keys(BUSINESS_DEFINITIONS) as BusinessType[]).map((value) => ({
    value,
    label: t(BUSINESS_DEFINITIONS[value].labelKey)
  }))
)

const aggregatedStatusOptions = computed(() => {
  const map = new Map<string, { labelKey: string; tagType: TagType }>()
  ;(Object.keys(BUSINESS_DEFINITIONS) as BusinessType[]).forEach((type) => {
    BUSINESS_DEFINITIONS[type].statuses.forEach((status) => {
      if (!map.has(status.value)) {
        map.set(status.value, { labelKey: status.labelKey, tagType: status.tagType })
      }
    })
  })
  return Array.from(map.entries()).map(([value, meta]) => ({
    value,
    label: t(meta.labelKey),
    tagType: meta.tagType
  }))
})

const statusOptions = computed(() => {
  if (!queryForm.businessType) {
    return aggregatedStatusOptions.value
  }
  const definition = BUSINESS_DEFINITIONS[queryForm.businessType]
  return definition.statuses.map((status) => ({
    value: status.value,
    label: t(status.labelKey),
    tagType: status.tagType
  }))
})

const toLowerSafe = (value: unknown) => {
  if (typeof value === 'string') return value.toLowerCase()
  if (value === null || value === undefined) return ''
  return String(value).toLowerCase()
}

const filteredRecords = computed(() => {
  const keyword = queryForm.keyword.trim().toLowerCase()
  const customer = queryForm.customerName.trim().toLowerCase()
  const owner = queryForm.owner.trim().toLowerCase()
  const [start, end] = Array.isArray(queryForm.dateRange) ? queryForm.dateRange : []

  return rawRecords.value.filter((record) => {
    const documentText = toLowerSafe(record.documentNo)
    const summaryText = toLowerSafe(record.summary)
    const customerText = toLowerSafe(record.customerName)
    const ownerText = toLowerSafe(record.owner)
    const issuedAt = record.issuedAt || ''

    const keywordMatch = keyword
      ? documentText.includes(keyword) || summaryText.includes(keyword)
      : true
    const customerMatch = customer ? customerText.includes(customer) : true
    const ownerMatch = owner ? ownerText.includes(owner) : true
    const typeMatch = queryForm.businessType ? record.businessType === queryForm.businessType : true
    const statusMatch = queryForm.status ? record.status === queryForm.status : true
    const dateMatch = start && end ? issuedAt >= start && issuedAt <= end : true

    return keywordMatch && customerMatch && ownerMatch && typeMatch && statusMatch && dateMatch
  })
})

const totalRecords = computed(() => filteredRecords.value.length)

const paginatedRecords = computed(() => {
  const start = (pagination.page - 1) * pagination.size
  return filteredRecords.value.slice(start, start + pagination.size)
})

const summaryTotals = computed(() => {
  const totals: Record<BusinessType, number> = {
    order: 0,
    invoice: 0,
    receipt: 0,
    project: 0,
    task: 0
  }
  let totalAmount = 0

  filteredRecords.value.forEach((record) => {
    totalAmount += record.amount
    totals[record.businessType] += record.amount
  })

  return {
    totalAmount,
    totals,
    count: filteredRecords.value.length
  }
})

const summaryCards = computed(() => [
  {
    key: 'total',
    title: t('comprehensive.totalAmount'),
    value: formatAmount(summaryTotals.value.totalAmount),
    meta: `${t('comprehensive.recordCount')}: ${summaryTotals.value.count}`
  },
  {
    key: 'order',
    title: t('comprehensive.orderAmount'),
    value: formatAmount(summaryTotals.value.totals.order),
    meta: t('comprehensive.typeOrder')
  },
  {
    key: 'invoice',
    title: t('comprehensive.invoiceAmount'),
    value: formatAmount(summaryTotals.value.totals.invoice),
    meta: t('comprehensive.typeInvoice')
  },
  {
    key: 'receipt',
    title: t('comprehensive.receiptAmount'),
    value: formatAmount(summaryTotals.value.totals.receipt),
    meta: t('comprehensive.typeReceipt')
  }
])

const topCustomers = computed(() => {
  const map = new Map<string, { amount: number; owner: string }>()

  filteredRecords.value.forEach((record) => {
    const current = map.get(record.customerName)
    if (current) {
      current.amount += record.amount
    } else {
      map.set(record.customerName, { amount: record.amount, owner: record.owner })
    }
  })

  return Array.from(map.entries())
    .map(([customerName, meta]) => ({
      customerName,
      amount: meta.amount,
      owner: meta.owner
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
})

const recentActivities = computed(() =>
  [...filteredRecords.value].sort((a, b) => b.issuedAt.localeCompare(a.issuedAt)).slice(0, 6)
)

const resolveBusinessMeta = (type: BusinessType | string) => {
  const definition = BUSINESS_DEFINITIONS[type as BusinessType]
  if (!definition) {
    return {
      label: type || '-',
      tagType: 'info' as TagType
    }
  }
  return {
    label: t(definition.labelKey),
    tagType: definition.tagType
  }
}

const resolveStatusMeta = (record: ComprehensiveRecord) => {
  const definition = BUSINESS_DEFINITIONS[record.businessType]
  const status = definition.statuses.find((item) => item.value === record.status)
  if (!status) {
    return {
      label: record.status || '-',
      tagType: 'info' as TagType
    }
  }
  return {
    label: t(status.labelKey),
    tagType: status.tagType
  }
}

const formatAmount = (value: number, currency: Currency = 'CNY') => {
  const symbol = currency === 'USD' ? '$' : '¥'
  const formatted = Number(value ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
  return `${symbol} ${formatted}`
}

const loadRecords = async (showLoading = true) => {
  if (showLoading) {
    loading.value = true
  }
  try {
    await wait(320)
    rawRecords.value = [...MOCK_RECORDS]
  } catch (error) {
    console.error('[ComprehensiveQuery] loadRecords failed:', error)
    rawRecords.value = []
  } finally {
    if (showLoading) {
      loading.value = false
    }
  }
}

const handleSearch = () => {
  pagination.page = 1
  void loadRecords(true)
}

const handleReset = () => {
  Object.assign(queryForm, createDefaultFilters())
  queryFormRef.value?.clearValidate?.()
  pagination.page = 1
  void loadRecords(true)
}

const handleRefresh = () => {
  void loadRecords(true)
}

const handleSizeChange = (size: number) => {
  pagination.size = size
  pagination.page = 1
}

const handleCurrentChange = (page: number) => {
  pagination.page = page
}

watch(
  () => [
    queryForm.keyword,
    queryForm.customerName,
    queryForm.owner,
    queryForm.businessType,
    queryForm.status,
    Array.isArray(queryForm.dateRange) ? queryForm.dateRange[0] : '',
    Array.isArray(queryForm.dateRange) ? queryForm.dateRange[1] : ''
  ],
  () => {
    pagination.page = 1
  }
)

watch(
  () => queryForm.businessType,
  (current) => {
    if (!current) {
      return
    }
    const definition = BUSINESS_DEFINITIONS[current]
    if (!definition.statuses.some((item) => item.value === queryForm.status)) {
      queryForm.status = ''
    }
  }
)

watch(
  () => totalRecords.value,
  (total) => {
    if (total === 0) {
      pagination.page = 1
      return
    }
    const maxPage = Math.ceil(total / pagination.size) || 1
    if (pagination.page > maxPage) {
      pagination.page = maxPage
    }
  }
)

onMounted(() => {
  void loadRecords(true)
})
</script>

<style scoped>
@media (width <= 768px) {
  .insight-panel__item {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}

.filter-form :deep(.el-form-item) {
  margin-bottom: 16px;
}

.summary-card {
  border: none;
  transition: all 0.3s ease;
}

.summary-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgb(0 0 0 / 10%) !important;
}

/* 第一个卡片 - 蓝色 */
.summary-card--blue {
  background: linear-gradient(145deg, rgb(64 158 255 / 12%), rgb(64 158 255 / 6%));
}

.summary-card--blue .summary-card__title {
  color: #409eff;
}

.summary-card--blue .summary-card__value {
  color: #409eff;
}

/* 第二个卡片 - 绿色 */
.summary-card--green {
  background: linear-gradient(145deg, rgb(103 194 58 / 12%), rgb(103 194 58 / 6%));
}

.summary-card--green .summary-card__title {
  color: #67c23a;
}

.summary-card--green .summary-card__value {
  color: #67c23a;
}

/* 第三个卡片 - 橙色 */
.summary-card--orange {
  background: linear-gradient(145deg, rgb(230 162 60 / 12%), rgb(230 162 60 / 6%));
}

.summary-card--orange .summary-card__title {
  color: #e6a23c;
}

.summary-card--orange .summary-card__value {
  color: #e6a23c;
}

/* 第四个卡片 - 灰色 */
.summary-card--gray {
  background: linear-gradient(145deg, rgb(144 147 153 / 12%), rgb(144 147 153 / 6%));
}

.summary-card--gray .summary-card__title {
  color: #909399;
}

.summary-card--gray .summary-card__value {
  color: #909399;
}

.summary-card__title {
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 500;
}

.summary-card__value {
  font-size: 24px;
  font-weight: 600;
}

.summary-card__meta {
  margin-top: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.insight-panel {
  display: flex;
  min-height: 260px;
  padding: 16px;
  background-color: var(--el-fill-color-blank);
  border: 1px solid var(--el-border-color-light);
  border-radius: 12px;
  flex-direction: column;
  gap: 16px;
}

.insight-panel__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.insight-panel__body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
}

.insight-panel__item {
  display: flex;
  padding: 12px 16px;
  background-color: rgb(64 158 255 / 8%);
  border-radius: 12px;
  align-items: center;
  justify-content: space-between;
}
</style>
