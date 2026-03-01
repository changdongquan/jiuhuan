<template>
  <div class="comprehensive-query-page space-y-4 p-4">
    <section class="rounded-lg bg-[var(--el-bg-color-overlay)] p-4 shadow-sm">
      <div class="mb-4 text-sm font-medium text-[var(--el-text-color-secondary)]">综合查询</div>
      <el-form ref="queryFormRef" :model="queryForm" label-width="90px" class="filter-form">
        <el-row :gutter="16">
          <el-col :xs="24" :sm="12" :lg="6">
            <el-form-item label="关键词">
              <el-input
                v-model="queryForm.keyword"
                placeholder="项目编号 / 产品名称 / 产品图号"
                clearable
                @keyup.enter="handleSearch"
              />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12" :lg="6">
            <el-form-item label="客户名称">
              <el-input
                v-model="queryForm.customerName"
                placeholder="请输入客户名称"
                clearable
                @keyup.enter="handleSearch"
              />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12" :lg="6">
            <el-form-item label="负责人">
              <el-input
                v-model="queryForm.owner"
                placeholder="请输入负责人"
                clearable
                @keyup.enter="handleSearch"
              />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12" :lg="6">
            <el-form-item label="订单日期">
              <el-date-picker
                v-model="queryForm.dateRange"
                type="daterange"
                value-format="YYYY-MM-DD"
                range-separator="~"
                start-placeholder="开始日期"
                end-placeholder="结束日期"
                clearable
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <div class="flex flex-wrap items-center justify-end gap-2">
          <el-button type="primary" :loading="loading" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </div>
      </el-form>
    </section>

    <el-row :gutter="16">
      <el-col :xs="24" :sm="12" :lg="8">
        <el-card shadow="hover" class="summary-card summary-card--blue">
          <div class="summary-card__title">项目数</div>
          <div class="summary-card__value">{{ summaryCards.projectCount }}</div>
          <div class="summary-card__meta">当前页项目条数</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="8">
        <el-card shadow="hover" class="summary-card summary-card--green">
          <div class="summary-card__title">销售金额</div>
          <div class="summary-card__value">{{ formatAmount(summaryCards.salesAmount) }}</div>
          <div class="summary-card__meta">当前页销售订单汇总</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="8">
        <el-card shadow="hover" class="summary-card summary-card--orange">
          <div class="summary-card__title">开票金额</div>
          <div class="summary-card__value">{{ formatAmount(summaryCards.invoiceAmount) }}</div>
          <div class="summary-card__meta">当前页开票汇总</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="8">
        <el-card shadow="hover" class="summary-card summary-card--gray">
          <div class="summary-card__title">回款金额</div>
          <div class="summary-card__value">{{ formatAmount(summaryCards.receiptAmount) }}</div>
          <div class="summary-card__meta">当前页回款汇总</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="8">
        <el-card shadow="hover" class="summary-card summary-card--blue">
          <div class="summary-card__title">已完成产量</div>
          <div class="summary-card__value">{{ summaryCards.completedQty.toLocaleString() }}</div>
          <div class="summary-card__meta">生产任务累计</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="8">
        <el-card shadow="hover" class="summary-card summary-card--gray">
          <div class="summary-card__title">出货数量</div>
          <div class="summary-card__value">{{ summaryCards.outboundQty.toLocaleString() }}</div>
          <div class="summary-card__meta">出库累计</div>
        </el-card>
      </el-col>
    </el-row>

    <section class="rounded-lg bg-[var(--el-bg-color-overlay)] p-4 shadow-sm">
      <div class="mb-4 flex items-center justify-between">
        <div class="text-base font-medium text-[var(--el-text-color-primary)]">综合视图</div>
        <div class="flex items-center gap-2">
          <span class="text-sm text-[var(--el-text-color-secondary)]">筛选结果：{{ total }}</span>
          <el-button text type="primary" :loading="loading" @click="loadList">刷新</el-button>
        </div>
      </div>

      <el-tabs v-model="activeView">
        <el-tab-pane label="表格视图" name="table">
          <el-table
            v-loading="loading"
            :data="tableData"
            border
            row-key="projectCode"
            height="540"
            @row-click="handleRowClick"
          >
            <el-table-column type="index" width="60" label="#" align="center" />
            <el-table-column prop="projectCode" label="项目编号" min-width="150" />
            <el-table-column prop="customerName" label="客户名称" min-width="150" />
            <el-table-column
              prop="productName"
              label="产品名称"
              min-width="150"
              show-overflow-tooltip
            />
            <el-table-column
              prop="productDrawing"
              label="产品图号"
              min-width="140"
              show-overflow-tooltip
            />
            <el-table-column prop="owner" label="负责人" width="110" align="center" />
            <el-table-column label="销售金额" width="140" align="right">
              <template #default="{ row }">{{ formatAmount(row.salesAmount) }}</template>
            </el-table-column>
            <el-table-column label="项目状态" width="130" align="center">
              <template #default="{ row }">
                <el-tag type="info">{{ row.projectStatus || '-' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="生产状态" width="130" align="center">
              <template #default="{ row }">
                <el-tag type="warning">{{ row.productionStatus || '-' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="开票金额" width="140" align="right">
              <template #default="{ row }">{{ formatAmount(row.invoiceAmount) }}</template>
            </el-table-column>
            <el-table-column label="回款金额" width="140" align="right">
              <template #default="{ row }">{{ formatAmount(row.receiptAmount) }}</template>
            </el-table-column>
            <el-table-column prop="outboundQty" label="出货数量" width="100" align="right" />
            <el-table-column prop="latestOrderDate" label="最近订单" width="120" align="center" />
            <el-table-column prop="latestInvoiceDate" label="最近开票" width="120" align="center" />
            <el-table-column prop="latestReceiptDate" label="最近回款" width="120" align="center" />
            <el-table-column
              prop="latestOutboundDate"
              label="最近出货"
              width="120"
              align="center"
            />
            <el-table-column label="操作" width="110" align="center" fixed="right">
              <template #default="{ row }">
                <el-button type="primary" link @click.stop="handleViewInsight(row)"
                  >查看洞察</el-button
                >
              </template>
            </el-table-column>
            <template #empty>
              <el-empty description="暂无数据" :image-size="120" />
            </template>
          </el-table>

          <div v-if="total > 0" class="flex justify-center pt-4">
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
                  :timestamp="event.date"
                  :type="resolveStageTag(stageStatusMap[event.stage] || 'in_progress')"
                >
                  <div class="timeline-event-title">{{ event.title }}</div>
                  <div class="timeline-event-detail">{{ event.detail }}</div>
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
  ElTimeline,
  ElTimelineItem
} from 'element-plus'
import type { FormInstance } from 'element-plus'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import type { ComprehensiveQueryRow, ProjectJourney } from '@/api/comprehensive-query'
import { getComprehensiveQueryListApi, getProjectJourneyApi } from '@/api/comprehensive-query'

interface QueryForm {
  keyword: string
  customerName: string
  owner: string
  dateRange: [string, string] | []
}

const queryFormRef = ref<FormInstance>()
const queryForm = reactive<QueryForm>({
  keyword: '',
  customerName: '',
  owner: '',
  dateRange: []
})

const loading = ref(false)
const tableData = ref<ComprehensiveQueryRow[]>([])
const total = ref(0)

const pagination = reactive({
  page: 1,
  pageSize: 20
})

const activeView = ref<'table' | 'insights'>('table')
const selectedProjectCode = ref('')
const journeyLoading = ref(false)
const journey = ref<ProjectJourney | null>(null)

const projectOptions = computed(() =>
  tableData.value.map((item) => ({
    value: item.projectCode,
    label: `${item.projectCode} ${item.customerName ? `- ${item.customerName}` : ''}`
  }))
)

const summaryCards = computed(() => {
  return tableData.value.reduce(
    (acc, row) => {
      acc.projectCount += 1
      acc.salesAmount += Number(row.salesAmount || 0)
      acc.invoiceAmount += Number(row.invoiceAmount || 0)
      acc.receiptAmount += Number(row.receiptAmount || 0)
      acc.completedQty += Number(row.completedQty || 0)
      acc.outboundQty += Number(row.outboundQty || 0)
      return acc
    },
    {
      projectCount: 0,
      salesAmount: 0,
      invoiceAmount: 0,
      receiptAmount: 0,
      completedQty: 0,
      outboundQty: 0
    }
  )
})

const stageDateLabelMap: Record<string, string> = {
  latestOrderDate: '最近订单',
  drawingReleaseDate: '图纸下发',
  plannedSampleDate: '计划首样',
  firstSampleDate: '首次送样',
  relocationDate: '移模日期',
  issuedDate: '下达日期',
  startDate: '开始日期',
  endDate: '结束日期',
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

const stageStatusMap = computed(() => {
  const map: Record<string, string> = {}
  ;(journey.value?.stages || []).forEach((stage) => {
    map[stage.key] = stage.status
  })
  return map
})

const formatAmount = (value: number) => {
  return `¥ ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`
}

const loadList = async () => {
  loading.value = true
  try {
    const params = {
      keyword: queryForm.keyword.trim() || undefined,
      customerName: queryForm.customerName.trim() || undefined,
      owner: queryForm.owner.trim() || undefined,
      startDate: queryForm.dateRange[0] || undefined,
      endDate: queryForm.dateRange[1] || undefined,
      page: pagination.page,
      pageSize: pagination.pageSize
    }

    const resp = await getComprehensiveQueryListApi(params)
    const raw: any = resp
    const pr: any = raw?.data ?? raw
    const list = pr?.data?.list ?? pr?.list ?? []
    const totalCount = pr?.data?.total ?? pr?.total ?? 0

    if (Array.isArray(list)) {
      tableData.value = list
      total.value = Number(totalCount) || 0

      if (!selectedProjectCode.value && list[0]?.projectCode) {
        selectedProjectCode.value = list[0].projectCode
      }
    } else {
      tableData.value = []
      total.value = 0
    }
  } catch (error) {
    console.error('[ComprehensiveQuery] loadList failed:', error)
    tableData.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
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
  void loadList()
}

const handleReset = () => {
  queryForm.keyword = ''
  queryForm.customerName = ''
  queryForm.owner = ''
  queryForm.dateRange = []
  queryFormRef.value?.clearValidate?.()
  pagination.page = 1
  void loadList()
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
  void loadJourney()
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
  void loadList()
})
</script>

<style scoped>
.filter-form :deep(.el-form-item) {
  margin-bottom: 14px;
}

.summary-card {
  border: none;
  transition: all 0.25s ease;
}

.summary-card:hover {
  transform: translateY(-2px);
}

.summary-card--blue {
  background: linear-gradient(145deg, rgb(64 158 255 / 12%), rgb(64 158 255 / 6%));
}

.summary-card--green {
  background: linear-gradient(145deg, rgb(103 194 58 / 12%), rgb(103 194 58 / 6%));
}

.summary-card--orange {
  background: linear-gradient(145deg, rgb(230 162 60 / 12%), rgb(230 162 60 / 6%));
}

.summary-card--gray {
  background: linear-gradient(145deg, rgb(144 147 153 / 12%), rgb(144 147 153 / 6%));
}

.summary-card__title {
  margin-bottom: 6px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.summary-card__value {
  font-size: 22px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.summary-card__meta {
  margin-top: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.insight-toolbar {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 16px;
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
  gap: 16px;
}

.insight-left,
.insight-right {
  padding: 14px;
  background: var(--el-fill-color-blank);
  border: 1px solid var(--el-border-color-light);
  border-radius: 12px;
}

.stage-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
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

.timeline-event-detail {
  margin-top: 2px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
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
}
</style>
