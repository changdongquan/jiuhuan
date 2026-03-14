<template>
  <div class="cq-page">
    <section class="cq-shell">
      <div class="cq-layout">
        <FilterSidebar
          :query-form="queryForm"
          :loading="loading"
          :filters-dirty="filtersDirty"
          :draft-status-text="draftStatusText"
          :customer-options="customerOptions"
          :category-options="categoryOptions"
          :is-mobile="isMobile"
          :mobile-filters-expanded="mobileFiltersExpanded"
          :invoice-progress-type-disabled="invoiceProgressTypeDisabled"
          :progress-range-disabled="progressRangeDisabled"
          @apply-search="handleApplySearch"
          @patch-query-form="patchQueryForm"
          @restore-draft="handleRestoreDraft"
          @reset-workspace="resetWorkspace"
          @update:mobile-filters-expanded="mobileFiltersExpanded = $event"
        />

        <main class="cq-main">
          <template v-if="!hasAppliedSearch">
            <section class="cq-empty-stage">
              <div class="cq-empty-stage__hero">
                <h2 class="cq-empty-stage__title">从左侧开始构建查询</h2>
                <p class="cq-empty-stage__desc">
                  推荐顺序是：关键词或客户缩小范围，再叠加财务筛选，最后在结果区切换概览、财务和阶段洞察。
                </p>
              </div>
              <div class="cq-empty-stage__grid">
                <article class="cq-guide-card">
                  <div class="cq-guide-card__step">01</div>
                  <div class="cq-guide-card__title">确定查询对象</div>
                  <div class="cq-guide-card__desc"
                    >优先用项目编号、产品名称或产品图号定位到较小范围。</div
                  >
                </article>
                <article class="cq-guide-card">
                  <div class="cq-guide-card__step">02</div>
                  <div class="cq-guide-card__title">叠加业务条件</div>
                  <div class="cq-guide-card__desc"
                    >客户、分类、票款状态和进度组合适合做二次收敛。</div
                  >
                </article>
                <article class="cq-guide-card">
                  <div class="cq-guide-card__step">03</div>
                  <div class="cq-guide-card__title">进入结果工作台</div>
                  <div class="cq-guide-card__desc"
                    >查询后直接切换概览、财务和阶段洞察，不需要跳页面。</div
                  >
                </article>
              </div>
            </section>
          </template>

          <template v-else>
            <section class="cq-summary-grid">
              <el-card shadow="hover" class="cq-summary-card cq-summary-card--teal">
                <div class="cq-summary-card__label">项目数</div>
                <div class="cq-summary-card__value">{{
                  summaryCards.projectCount.toLocaleString()
                }}</div>
                <div class="cq-summary-card__hint">命中结果</div>
              </el-card>
              <el-card shadow="hover" class="cq-summary-card cq-summary-card--slate">
                <div class="cq-summary-card__label">销售金额</div>
                <div class="cq-summary-card__value">{{
                  formatAmount(summaryCards.salesAmount)
                }}</div>
                <div class="cq-summary-card__hint">订单口径</div>
              </el-card>
              <el-card shadow="hover" class="cq-summary-card cq-summary-card--gold">
                <div class="cq-summary-card__label">开票金额</div>
                <div class="cq-summary-card__value">{{
                  formatAmount(summaryCards.invoiceAmount)
                }}</div>
                <div class="cq-summary-card__hint">开票口径</div>
              </el-card>
              <el-card shadow="hover" class="cq-summary-card cq-summary-card--amber">
                <div class="cq-summary-card__label">回款合计</div>
                <div class="cq-summary-card__value">
                  {{ formatAmountPair(summaryCards.receiptAmount, summaryCards.discountAmount) }}
                </div>
                <div class="cq-summary-card__hint">含贴息</div>
              </el-card>
              <el-card shadow="hover" class="cq-summary-card cq-summary-card--coral">
                <div class="cq-summary-card__label">未开票金额</div>
                <div class="cq-summary-card__value">{{
                  formatAmount(summaryCards.uninvoicedAmount)
                }}</div>
                <div class="cq-summary-card__hint">销售减开票</div>
              </el-card>
              <el-card shadow="hover" class="cq-summary-card cq-summary-card--steel">
                <div class="cq-summary-card__label">订单欠款</div>
                <div class="cq-summary-card__value">
                  {{ formatAmount(summaryCards.orderArrearsAmount) }}
                </div>
                <div class="cq-summary-card__hint">销售减回款</div>
              </el-card>
            </section>

            <section v-if="filtersDirty" class="cq-draft-banner">
              <div>
                <div class="cq-draft-banner__title"
                  >草稿已修改，当前结果仍是上一次应用后的数据。</div
                >
                <div class="cq-draft-banner__desc">
                  点击“应用筛选”更新结果，或点击“还原草稿”回到当前结果对应的条件。
                </div>
              </div>
              <div class="cq-draft-banner__actions">
                <el-button
                  type="primary"
                  size="small"
                  class="cq-action-btn cq-action-btn--apply cq-action-btn--compact"
                  :loading="loading"
                  @click="handleApplySearch"
                >
                  应用筛选
                </el-button>
                <el-button
                  size="small"
                  class="cq-action-btn cq-action-btn--restore cq-action-btn--compact"
                  @click="handleRestoreDraft"
                  >还原草稿</el-button
                >
              </div>
            </section>

            <section class="cq-results">
              <ResultsToolbar
                :active-view="activeView"
                :table-mode="tableMode"
                :has-applied-search="hasAppliedSearch"
                :exporting="exporting"
                :total="total"
                :is-mobile="isMobile"
                :mobile-table-mode-text="mobileTableModeText"
                @export="handleExport"
                @update:active-view="activeView = $event"
                @update:table-mode="tableMode = $event"
              />

              <template v-if="activeView === 'table'">
                <MobileCardList
                  v-if="isMobile"
                  :loading="loading"
                  :table-data="tableData"
                  :table-mode="tableMode"
                  :anomaly-label-map="anomalyLabelMap"
                  :format-amount="formatAmount"
                  :format-percent="formatPercent"
                  :format-number="formatNumber"
                  :get-settlement-status-tag-type="getSettlementStatusTagType"
                  @row-click="handleRowClick"
                  @view-insight="handleViewInsight"
                />

                <div v-else class="cq-table-shell">
                  <el-table
                    v-loading="loading"
                    :data="tableData"
                    border
                    row-key="projectCode"
                    :height="tableHeight"
                    scrollbar-always-on
                    :default-sort="
                      tableSort.defaultOrder
                        ? { prop: tableSort.prop, order: tableSort.defaultOrder }
                        : undefined
                    "
                    @row-click="handleRowClick"
                    @sort-change="handleTableSortChange"
                  >
                    <el-table-column
                      type="index"
                      width="60"
                      label="序号"
                      align="center"
                      fixed="left"
                    />
                    <el-table-column
                      prop="projectCode"
                      label="项目编号"
                      width="150"
                      fixed="left"
                      sortable="custom"
                    />
                    <el-table-column
                      prop="customerName"
                      label="客户名称"
                      min-width="140"
                      show-overflow-tooltip
                    />
                    <el-table-column
                      prop="productName"
                      label="产品名称"
                      min-width="150"
                      show-overflow-tooltip
                    />
                    <el-table-column
                      prop="category"
                      label="分类"
                      min-width="100"
                      show-overflow-tooltip
                    />
                    <el-table-column
                      label="项目状态"
                      width="110"
                      align="center"
                      show-overflow-tooltip
                    >
                      <template #default="{ row }">
                        <el-tag
                          :type="getProjectStatusTagType(row.projectStatus)"
                          class="cq-production-status-tag cq-status-tag--fixed"
                        >
                          {{ row.projectStatus || '-' }}
                        </el-tag>
                      </template>
                    </el-table-column>
                    <el-table-column
                      label="生产状态"
                      width="110"
                      align="center"
                      show-overflow-tooltip
                    >
                      <template #default="{ row }">
                        <el-tag
                          :type="getProductionStatusTagType(row.productionStatus)"
                          class="cq-production-status-tag cq-status-tag--fixed"
                        >
                          {{ row.productionStatus || '-' }}
                        </el-tag>
                      </template>
                    </el-table-column>
                    <el-table-column label="销售金额" width="120" align="right">
                      <template #default="{ row }">{{ formatAmount(row.salesAmount) }}</template>
                    </el-table-column>

                    <template v-if="tableMode === 'finance' || tableMode === 'full'">
                      <el-table-column label="回款金额" width="110" align="right">
                        <template #default="{ row }">{{
                          formatAmount(row.receiptAmount)
                        }}</template>
                      </el-table-column>
                      <el-table-column label="贴息金额" width="110" align="right">
                        <template #default="{ row }">{{
                          formatAmount(row.discountAmount)
                        }}</template>
                      </el-table-column>
                      <el-table-column label="回款比例" width="96" align="right">
                        <template #default="{ row }">{{
                          formatPercent(row.receiptProgress)
                        }}</template>
                      </el-table-column>
                      <el-table-column label="订单欠款" width="110" align="right">
                        <template #default="{ row }">{{
                          formatAmount(row.orderArrearsAmount)
                        }}</template>
                      </el-table-column>
                      <el-table-column label="开票金额" width="110" align="right">
                        <template #default="{ row }">{{
                          formatAmount(row.invoiceAmount)
                        }}</template>
                      </el-table-column>
                      <el-table-column label="开票比例" width="96" align="right">
                        <template #default="{ row }">{{
                          formatPercent(row.invoiceProgress)
                        }}</template>
                      </el-table-column>
                      <el-table-column label="未开票金额" width="110" align="right">
                        <template #default="{ row }">{{
                          formatAmount(row.uninvoicedAmount)
                        }}</template>
                      </el-table-column>
                      <el-table-column label="开票欠款" width="110" align="right">
                        <template #default="{ row }">{{
                          formatAmount(row.unreceivedAmount)
                        }}</template>
                      </el-table-column>
                      <el-table-column label="结清状态" width="120" align="center">
                        <template #default="{ row }">
                          <el-tag
                            :type="getSettlementStatusTagType(row.settlementStatus)"
                            class="cq-status-tag--fixed"
                          >
                            {{ row.settlementStatus || '-' }}
                          </el-tag>
                        </template>
                      </el-table-column>
                      <el-table-column
                        label="异常类型"
                        width="126"
                        align="center"
                        show-overflow-tooltip
                      >
                        <template #default="{ row }">
                          <el-tag v-if="row.anomalyType" type="danger">
                            {{ anomalyLabelMap[row.anomalyType] || row.anomalyType }}
                          </el-tag>
                          <span v-else>-</span>
                        </template>
                      </el-table-column>
                    </template>

                    <template v-if="tableMode === 'full'">
                      <el-table-column
                        prop="productDrawing"
                        label="产品图号"
                        min-width="130"
                        show-overflow-tooltip
                      />
                      <el-table-column
                        prop="customerModelNo"
                        label="客户模号"
                        min-width="120"
                        show-overflow-tooltip
                      />
                      <el-table-column prop="owner" label="负责人" width="90" align="center" />
                      <el-table-column label="数量" width="90" align="right">
                        <template #default="{ row }">{{
                          formatNumber(row.orderQuantity)
                        }}</template>
                      </el-table-column>
                      <el-table-column label="单价" width="108" align="right">
                        <template #default="{ row }">{{ formatAmount(row.unitPrice) }}</template>
                      </el-table-column>
                      <el-table-column
                        prop="contractNo"
                        label="合同号"
                        min-width="130"
                        sortable="custom"
                        show-overflow-tooltip
                      />
                      <el-table-column
                        prop="remark"
                        label="备注"
                        min-width="160"
                        show-overflow-tooltip
                      />
                      <el-table-column
                        prop="costSource"
                        label="费用出处"
                        min-width="130"
                        show-overflow-tooltip
                      />
                      <el-table-column
                        prop="outboundQty"
                        label="出货数量"
                        width="90"
                        align="right"
                      />
                      <el-table-column
                        prop="latestOutboundDate"
                        label="最近出货"
                        width="110"
                        align="center"
                        sortable="custom"
                      />
                    </template>

                    <el-table-column
                      prop="latestOrderDate"
                      label="最近订单"
                      width="110"
                      align="center"
                      sortable="custom"
                    />
                    <el-table-column
                      prop="latestInvoiceDate"
                      label="最近开票"
                      width="110"
                      align="center"
                      sortable="custom"
                    />
                    <el-table-column
                      prop="latestReceiptDate"
                      label="最近回款"
                      width="110"
                      align="center"
                      sortable="custom"
                    />
                    <el-table-column label="操作" width="86" align="center" fixed="right">
                      <template #default="{ row }">
                        <el-button type="primary" link @click.stop="handleViewInsight(row)">
                          看洞察
                        </el-button>
                      </template>
                    </el-table-column>
                    <template #empty>
                      <el-empty description="暂无数据" :image-size="120" />
                    </template>
                  </el-table>
                </div>

                <div
                  v-if="total > 0"
                  class="cq-pagination"
                  :class="{ 'cq-pagination--mobile': isMobile }"
                >
                  <el-pagination
                    background
                    :layout="paginationLayout"
                    :current-page="pagination.page"
                    :page-size="pagination.pageSize"
                    :page-sizes="[10, 20, 30, 50]"
                    :total="total"
                    :pager-count="paginationPagerCount"
                    @size-change="handlePageSizeChange"
                    @current-change="handlePageChange"
                  />
                </div>
              </template>

              <template v-else>
                <div class="cq-insight-toolbar">
                  <div>
                    <div class="cq-results__title">项目阶段洞察</div>
                    <div class="cq-results__desc">从当前结果集选择一个项目查看阶段时间线。</div>
                  </div>
                  <el-select
                    v-model="selectedProjectCode"
                    filterable
                    clearable
                    placeholder="请选择项目编号"
                    class="cq-insight-toolbar__select"
                  >
                    <el-option
                      v-for="item in projectOptions"
                      :key="item.value"
                      :label="item.label"
                      :value="item.value"
                    />
                  </el-select>
                </div>

                <div v-if="!selectedProjectCode" class="cq-insight-empty">
                  <el-empty description="请先从结果列表选择一个项目" :image-size="120" />
                </div>

                <div v-else-if="journeyLoading" class="cq-insight-empty">
                  <el-skeleton :rows="8" animated />
                </div>

                <div v-else-if="journey" class="cq-insight-layout">
                  <div class="cq-insight-left">
                    <div class="cq-insight-project">
                      <div class="cq-insight-project__code">{{ journey.projectCode }}</div>
                      <div class="cq-insight-project__meta">{{ currentInsightSubtitle }}</div>
                    </div>

                    <div class="cq-stage-grid">
                      <div v-for="stage in stageCards" :key="stage.key" class="cq-stage-card">
                        <div class="cq-stage-card__head">
                          <div class="cq-stage-card__title">{{ stage.name }}</div>
                          <el-tag :type="resolveStageTag(stage.status)">
                            {{ resolveStageText(stage.status) }}
                          </el-tag>
                        </div>
                        <div class="cq-stage-card__summary">{{ stage.summary || '-' }}</div>
                        <div class="cq-stage-card__meta">
                          <template
                            v-for="item in stage.dateItems"
                            :key="`${stage.key}-${item.key}`"
                          >
                            <div class="cq-stage-card__meta-row">
                              <span>{{ item.label }}</span>
                              <span>{{ item.value || '-' }}</span>
                            </div>
                          </template>
                        </div>
                      </div>

                      <div class="cq-stage-card cq-stage-card--reserved">
                        <div class="cq-stage-card__head">
                          <div class="cq-stage-card__title">采购（预留）</div>
                          <el-tag type="info">待接入</el-tag>
                        </div>
                        <div class="cq-stage-card__summary">
                          后续接入采购节点后，会自动纳入当前时间线。
                        </div>
                      </div>

                      <div class="cq-stage-card cq-stage-card--reserved">
                        <div class="cq-stage-card__head">
                          <div class="cq-stage-card__title">入库（预留）</div>
                          <el-tag type="info">待接入</el-tag>
                        </div>
                        <div class="cq-stage-card__summary">
                          后续接入入库节点后，会自动纳入当前时间线。
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="cq-insight-right">
                    <div class="cq-results__title">阶段事件时间线</div>
                    <el-timeline v-if="journey.events.length">
                      <el-timeline-item
                        v-for="(event, idx) in journey.events"
                        :key="`${event.stage}-${event.date}-${idx}`"
                        :type="resolveStageTag(stageStatusMap[event.stage] || 'in_progress')"
                      >
                        <div class="cq-timeline__title">{{ event.title }}</div>
                        <div class="cq-timeline__meta">
                          <span class="cq-timeline__date">{{ event.date }}</span>
                          <span class="cq-timeline__detail">{{ event.detail }}</span>
                        </div>
                      </el-timeline-item>
                    </el-timeline>
                    <el-empty v-else description="暂无阶段事件" :image-size="100" />
                  </div>
                </div>

                <div v-else class="cq-insight-empty">
                  <el-empty description="未查询到项目洞察数据" :image-size="120" />
                </div>
              </template>
            </section>
          </template>
        </main>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import {
  ElButton,
  ElCard,
  ElEmpty,
  ElPagination,
  ElSelect,
  ElSkeleton,
  ElTable,
  ElTableColumn,
  ElTag,
  ElTimeline,
  ElTimelineItem
} from 'element-plus'
import { ElMessage } from 'element-plus'
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import type {
  ComprehensiveQueryListParams,
  ComprehensiveQueryRow,
  ComprehensiveQuerySummary,
  ProjectJourney
} from '@/api/comprehensive-query'
import {
  exportComprehensiveQueryApi,
  getComprehensiveQueryFilterOptionsApi,
  getComprehensiveQueryListApi,
  getProjectJourneyApi
} from '@/api/comprehensive-query'
import { useAppStore } from '@/store/modules/app'
import FilterSidebar from './components/FilterSidebar.vue'
import MobileCardList from './components/MobileCardList.vue'
import ResultsToolbar from './components/ResultsToolbar.vue'
import type { QueryForm, QuerySnapshot, TableMode } from './types'

const EMPTY_SUMMARY: ComprehensiveQuerySummary = {
  projectCount: 0,
  salesAmount: 0,
  invoiceAmount: 0,
  receiptAmount: 0,
  discountAmount: 0,
  completedQty: 0,
  outboundQty: 0,
  uninvoicedAmount: 0,
  unreceivedAmount: 0,
  orderArrearsAmount: 0
}

const createEmptyQueryForm = (): QueryForm => ({
  keyword: '',
  customerName: '',
  category: '',
  settlementStatus: '',
  invoiceStatus: '',
  progressType: '',
  progressMin: '',
  progressMax: '',
  dateRange: []
})

const loading = ref(false)
const exporting = ref(false)
const tableData = ref<ComprehensiveQueryRow[]>([])
const total = ref(0)
const appStore = useAppStore()
const isMobile = computed(() => appStore.getMobile)
const tableHeight = computed(() => (isMobile.value ? undefined : '100%'))

const queryForm = reactive<QueryForm>(createEmptyQueryForm())
const appliedSnapshot = ref<QuerySnapshot | null>(null)
const customerOptions = ref<string[]>([])
const categoryOptions = ref<string[]>([])
const summaryCards = ref<ComprehensiveQuerySummary>({ ...EMPTY_SUMMARY })
const activeView = ref<'table' | 'insights'>('table')
const tableMode = ref<TableMode>('overview')
const selectedProjectCode = ref('')
const journeyLoading = ref(false)
const journey = ref<ProjectJourney | null>(null)
const mobileFiltersExpanded = ref(false)

const pagination = reactive({
  page: 1,
  pageSize: 20
})

const tableSort = reactive<{
  prop:
    | ''
    | 'projectCode'
    | 'contractNo'
    | 'latestOutboundDate'
    | 'latestOrderDate'
    | 'latestInvoiceDate'
    | 'latestReceiptDate'
  order: '' | 'asc' | 'desc'
  defaultOrder: '' | 'ascending' | 'descending'
}>({
  prop: '',
  order: '',
  defaultOrder: ''
})

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

const cloneQuerySnapshot = (source: QueryForm): QuerySnapshot => ({
  keyword: source.keyword,
  customerName: source.customerName,
  category: source.category,
  settlementStatus: source.settlementStatus,
  invoiceStatus: source.invoiceStatus,
  progressType: source.progressType,
  progressMin: source.progressMin,
  progressMax: source.progressMax,
  dateRange: source.dateRange.length === 2 ? [source.dateRange[0], source.dateRange[1]] : []
})

const assignQueryForm = (target: QueryForm, source: QuerySnapshot | QueryForm) => {
  target.keyword = source.keyword
  target.customerName = source.customerName
  target.category = source.category
  target.settlementStatus = source.settlementStatus
  target.invoiceStatus = source.invoiceStatus
  target.progressType = source.progressType
  target.progressMin = source.progressMin
  target.progressMax = source.progressMax
  target.dateRange = source.dateRange.length === 2 ? [source.dateRange[0], source.dateRange[1]] : []
}

const patchQueryForm = (patch: Partial<QueryForm>) => {
  Object.entries(patch).forEach(([key, value]) => {
    ;(queryForm as Record<string, unknown>)[key] = value as unknown
  })
}

const buildListParamsFromSnapshot = (
  source: QuerySnapshot | QueryForm
): ComprehensiveQueryListParams => ({
  keyword: source.keyword.trim() || undefined,
  customerName: source.customerName.trim() || undefined,
  category: source.category || undefined,
  settlementStatus: source.settlementStatus || undefined,
  invoiceStatus: source.invoiceStatus || undefined,
  progressType: source.progressType || undefined,
  progressMin: normalizePercentValue(source.progressMin),
  progressMax: normalizePercentValue(source.progressMax),
  startDate: source.dateRange[0] || undefined,
  endDate: source.dateRange[1] || undefined
})

const serializeQueryState = (source: QuerySnapshot | QueryForm | null) =>
  JSON.stringify(source ? buildListParamsFromSnapshot(source) : {})

const hasAppliedSearch = computed(() => appliedSnapshot.value !== null)
const filtersDirty = computed(
  () => serializeQueryState(queryForm) !== serializeQueryState(appliedSnapshot.value)
)
const invoiceProgressTypeDisabled = computed(() => queryForm.invoiceStatus === '未开票')
const progressRangeDisabled = computed(() => !queryForm.progressType)

const projectOptions = computed(() =>
  tableData.value.map((item) => ({
    value: item.projectCode,
    label: `${item.projectCode}${item.customerName ? ` / ${item.customerName}` : ''}`
  }))
)
const mobileTableModeText = computed(() => {
  if (tableMode.value === 'finance') return '财务'
  if (tableMode.value === 'full') return '全量'
  return '概览'
})
const paginationLayout = computed(() =>
  isMobile.value ? 'total, prev, pager, next' : 'total, sizes, prev, pager, next, jumper'
)
const paginationPagerCount = computed(() => (isMobile.value ? 5 : 7))

const draftStatusText = computed(() => {
  if (filtersDirty.value && hasAppliedSearch.value) return '草稿已修改'
  if (filtersDirty.value) return '待应用'
  if (hasAppliedSearch.value) return '已同步'
  return '未查询'
})

const currentInsightRow = computed(
  () => tableData.value.find((item) => item.projectCode === selectedProjectCode.value) || null
)

const currentInsightSubtitle = computed(() => {
  const row = currentInsightRow.value
  if (!row) return '当前项目不在本次结果中'
  return [row.customerName, row.productName, row.settlementStatus].filter(Boolean).join(' / ')
})

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

const stageStatusMap = computed(() => {
  const map: Record<string, string> = {}
  ;(journey.value?.stages || []).forEach((stage) => {
    map[stage.key] = stage.status
  })
  return map
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
  if (!status) return 'info'
  if (status === '销售已结清') return 'success'
  if (status === '开票已结清') return 'primary'
  return 'warning'
}

const formatAmount = (value: number) => {
  const amount = Number(value || 0)
  if (!Number.isFinite(amount) || amount === 0) return '-'
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

const formatPercent = (value: number) => {
  const percent = Number(value)
  if (!Number.isFinite(percent)) return '-'
  return `${percent.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })}%`
}

const formatNumber = (value: number) => {
  const amount = Number(value || 0)
  if (!Number.isFinite(amount) || amount === 0) return '-'
  return amount.toLocaleString()
}

const formatAmountPair = (left: number, right: number) => {
  const totalAmount = Number(left || 0) + Number(right || 0)
  const discount = Number(right || 0)
  if (!totalAmount && !discount) return '-'
  const format = (value: number) =>
    value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  return `${format(totalAmount)} (${format(discount)})`
}

const normalizePercentValue = (value: string) => {
  const text = String(value || '')
    .replace(/%/g, '')
    .trim()
  if (!text) return undefined
  const num = Number(text)
  if (!Number.isFinite(num)) return undefined
  return Math.min(100, Math.max(0, num))
}

const clearProgressFilter = (clearType = true) => {
  if (clearType) queryForm.progressType = ''
  queryForm.progressMin = ''
  queryForm.progressMax = ''
}

const syncProgressRangeInputs = (source: QueryForm) => {
  const min = normalizePercentValue(source.progressMin)
  const max = normalizePercentValue(source.progressMax)
  source.progressMin = min === undefined ? '' : String(min)
  source.progressMax = max === undefined ? '' : String(max)
}

const getInvoiceProgressConflictMessage = (source: QueryForm) => {
  if (source.progressType !== 'invoice') return ''
  if (source.invoiceStatus === '未开票') {
    return '“未开票”与“开票百分比”互斥，已清空执行进度。'
  }
  if (source.invoiceStatus !== '仅开部分发票') return ''

  const min = normalizePercentValue(source.progressMin)
  const max = normalizePercentValue(source.progressMax)

  if (min === 0 && max === 0) {
    return '“仅开部分发票”不可能是 0%，已清空执行进度范围。'
  }
  if (min === 100 && max === 100) {
    return '“仅开部分发票”不可能是 100%，已清空执行进度范围。'
  }
  return ''
}

const validateProgressRange = (source: QueryForm) => {
  if (!source.progressType) return true

  syncProgressRangeInputs(source)

  const min = normalizePercentValue(source.progressMin)
  const max = normalizePercentValue(source.progressMax)

  if (min !== undefined && max !== undefined && min > max) {
    ElMessage.warning('执行进度范围无效：最小百分比不能大于最大百分比。')
    return false
  }
  return true
}

const parseResponseData = (rawResp: unknown) => {
  const raw = rawResp as any
  const pr: any = raw?.data ?? raw
  return pr?.data ?? pr
}

const resetQueryDraft = () => {
  assignQueryForm(queryForm, createEmptyQueryForm())
}

const suggestTableMode = (source: QueryForm): TableMode => {
  if (
    source.settlementStatus ||
    source.invoiceStatus ||
    source.progressType ||
    source.progressMin ||
    source.progressMax ||
    source.dateRange.length === 2
  ) {
    return 'finance'
  }
  return 'overview'
}

const resetResultState = () => {
  tableData.value = []
  total.value = 0
  summaryCards.value = { ...EMPTY_SUMMARY }
  selectedProjectCode.value = ''
  journey.value = null
  activeView.value = 'table'
}

const loadFilterOptions = async () => {
  try {
    const resp = await getComprehensiveQueryFilterOptionsApi()
    const data = parseResponseData(resp)
    customerOptions.value = Array.isArray(data?.customers) ? data.customers : []
    categoryOptions.value = Array.isArray(data?.categories) ? data.categories : []
  } catch (error) {
    console.error('[ComprehensiveQuery] loadFilterOptions failed:', error)
    customerOptions.value = []
    categoryOptions.value = ['塑胶模具', '修改模具', '零件加工']
  }
}

const loadList = async () => {
  if (!appliedSnapshot.value) {
    resetResultState()
    return
  }

  loading.value = true
  try {
    const params = {
      ...buildListParamsFromSnapshot(appliedSnapshot.value),
      sortField: tableSort.prop || undefined,
      sortOrder: tableSort.order || undefined,
      page: pagination.page,
      pageSize: pagination.pageSize
    }
    const resp = await getComprehensiveQueryListApi(params)
    const data = parseResponseData(resp)
    const list = Array.isArray(data?.list) ? data.list : []
    tableData.value = list
    total.value = Number(data?.total || 0)
    summaryCards.value = {
      ...EMPTY_SUMMARY,
      ...(data?.summary || {})
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
  } catch (error) {
    console.error('[ComprehensiveQuery] loadList failed:', error)
    tableData.value = []
    total.value = 0
    summaryCards.value = { ...EMPTY_SUMMARY }
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

const applyCurrentDraft = async (mode?: TableMode) => {
  const hadAppliedSearch = hasAppliedSearch.value
  appliedSnapshot.value = cloneQuerySnapshot(queryForm)
  pagination.page = 1
  activeView.value = 'table'
  tableMode.value = mode || (hadAppliedSearch ? tableMode.value : suggestTableMode(queryForm))
  await loadList()
}

const handleApplySearch = () => {
  if (!validateProgressRange(queryForm)) return
  void applyCurrentDraft()
}

const handleRestoreDraft = () => {
  if (!appliedSnapshot.value) {
    resetQueryDraft()
    return
  }
  assignQueryForm(queryForm, appliedSnapshot.value)
}

const resetWorkspace = () => {
  resetQueryDraft()
  appliedSnapshot.value = null
  tableMode.value = 'overview'
  mobileFiltersExpanded.value = false
  resetResultState()
}

const handleExport = async () => {
  if (!appliedSnapshot.value) {
    ElMessage.warning('请先应用筛选后再导出')
    return
  }
  try {
    exporting.value = true
    const resp: any = await exportComprehensiveQueryApi({
      ...buildListParamsFromSnapshot(appliedSnapshot.value),
      sortField: tableSort.prop || undefined,
      sortOrder: tableSort.order || undefined
    })
    const blob = (resp?.data ?? resp) as Blob
    if (!(blob instanceof Blob)) {
      ElMessage.error('导出失败：未获取到文件')
      return
    }
    const contentDisposition = String(resp?.headers?.['content-disposition'] || '')
    const matched = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)
    const fallback = `综合查询_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.xlsx`
    const fileName = matched?.[1] ? decodeURIComponent(matched[1]) : fallback
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
    ElMessage.success('导出成功')
  } catch (error) {
    console.error('[ComprehensiveQuery] export failed:', error)
    ElMessage.error('导出失败')
  } finally {
    exporting.value = false
  }
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

const handleTableSortChange = ({
  prop,
  order
}: {
  column: unknown
  prop: string
  order: 'ascending' | 'descending' | null
}) => {
  const sortableFields = new Set([
    'projectCode',
    'contractNo',
    'latestOutboundDate',
    'latestOrderDate',
    'latestInvoiceDate',
    'latestReceiptDate'
  ])

  if (!prop || !sortableFields.has(prop) || !order) {
    tableSort.prop = ''
    tableSort.order = ''
    tableSort.defaultOrder = ''
  } else {
    tableSort.prop = prop as typeof tableSort.prop
    tableSort.order = order === 'ascending' ? 'asc' : 'desc'
    tableSort.defaultOrder = order
  }

  pagination.page = 1
  if (hasAppliedSearch.value) {
    void loadList()
  }
}

const handleViewInsight = (row: ComprehensiveQueryRow) => {
  selectedProjectCode.value = row.projectCode
  activeView.value = 'insights'
}

watch(
  () => isMobile.value,
  (value) => {
    mobileFiltersExpanded.value = !value
  },
  { immediate: true }
)

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

let syncingProgressConflict = false

watch(
  () => [
    queryForm.invoiceStatus,
    queryForm.progressType,
    queryForm.progressMin,
    queryForm.progressMax
  ],
  () => {
    if (syncingProgressConflict) return

    const message = getInvoiceProgressConflictMessage(queryForm)
    if (!message) return

    syncingProgressConflict = true
    if (queryForm.invoiceStatus === '未开票') {
      clearProgressFilter(true)
    } else {
      clearProgressFilter(false)
    }
    ElMessage.warning(message)
    syncingProgressConflict = false
  }
)

watch(
  () => queryForm.progressType,
  (value, oldValue) => {
    if (!value && oldValue) {
      clearProgressFilter(false)
      return
    }
    if (value) {
      syncProgressRangeInputs(queryForm)
    }
  }
)

onMounted(() => {
  appStore.setFooter(false)
  void loadFilterOptions()
})

onBeforeUnmount(() => {
  appStore.setFooter(true)
})
</script>

<style scoped>
.cq-page {
  height: 100%;
  min-height: 0;
  padding: 8px 10px 6px;
  overflow: hidden;
  background:
    radial-gradient(circle at top left, rgb(17 138 178 / 7%), transparent 26%),
    radial-gradient(circle at right top, rgb(248 150 30 / 8%), transparent 24%),
    linear-gradient(180deg, #f5f8fb 0%, #eef3f7 100%);
  box-sizing: border-box;
}

.cq-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  gap: 8px;
  overflow: hidden;
}

.cq-panel,
.cq-results,
.cq-empty-stage {
  background: rgb(255 255 255 / 88%);
  border: 1px solid rgb(214 223 231 / 90%);
  border-radius: 24px;
  box-shadow: 0 18px 40px rgb(15 23 42 / 7%);
  backdrop-filter: blur(12px);
}

.cq-layout {
  display: grid;
  grid-template-columns: 340px minmax(0, 1fr);
  gap: 6px;
  min-height: 0;
  flex: 1;
  overflow: hidden;
}

.cq-sidebar {
  display: flex;
  min-height: 0;
  padding-right: 2px;
  overflow: hidden auto;
  flex-direction: column;
  gap: 8px;
  scrollbar-gutter: stable;
}

.cq-sidebar--mobile-collapsed {
  overflow: visible;
}

.cq-main {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 0;
  overflow: hidden;
}

.cq-panel {
  padding: 14px;
}

.cq-panel--primary {
  background:
    linear-gradient(180deg, rgb(255 255 255 / 94%), rgb(247 251 253 / 92%)),
    linear-gradient(135deg, rgb(17 138 178 / 7%), transparent);
}

.cq-panel__head {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 10px;
}

.cq-panel__title {
  font-size: 15px;
  font-weight: 700;
  color: #152130;
}

.cq-panel__desc {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.5;
  color: #6a7989;
}

.cq-status-pill {
  display: inline-flex;
  align-items: center;
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 600;
  color: #547184;
  background: #eef4f8;
  border-radius: 999px;
}

.cq-status-pill--dirty {
  color: #8f5e00;
  background: #fff5df;
}

.cq-form :deep(.el-form-item) {
  margin-bottom: 12px;
}

.cq-form :deep(.el-form-item__label) {
  font-size: 12px;
  font-weight: 600;
  color: #546678;
}

.cq-scope-list {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 14px;
}

.cq-scope-list__label {
  font-size: 12px;
  font-weight: 600;
  color: #5d7083;
}

.cq-scope-list__chip {
  padding: 6px 10px;
  font-size: 12px;
  color: #0f5663;
  background: rgb(17 138 178 / 10%);
  border: 1px solid rgb(17 138 178 / 14%);
  border-radius: 999px;
}

.cq-actions {
  display: flex;
  gap: 8px;
  flex-wrap: nowrap;
  align-items: stretch;
}

.cq-actions :deep(.el-button) {
  margin: 0;
}

.cq-actions :deep(.el-button:not(.is-text)) {
  flex: 1;
  min-width: 0;
}

.cq-mobile-filter-toggle {
  width: 100%;
  padding: 9px 12px;
  margin-top: 10px;
  font-size: 12px;
  font-weight: 700;
  color: #1b4f66;
  cursor: pointer;
  background: linear-gradient(180deg, rgb(236 245 249 / 96%), rgb(224 238 244 / 96%));
  border: 1px solid #c9dbe4;
  border-radius: 12px;
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease,
    transform 0.18s ease;
}

.cq-mobile-filter-toggle:hover {
  background: linear-gradient(180deg, rgb(242 248 251 / 100%), rgb(231 241 246 / 100%));
  border-color: #9fc0cf;
  transform: translateY(-1px);
}

:deep(.cq-action-btn) {
  height: 36px;
  padding: 0 14px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.01em;
  border-width: 1px;
  border-radius: 12px;
  backdrop-filter: blur(10px);
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    border-color 0.18s ease,
    background-color 0.18s ease,
    color 0.18s ease,
    opacity 0.18s ease;
}

:deep(.cq-action-btn:hover) {
  transform: translateY(-1px);
}

:deep(.cq-action-btn .el-icon) {
  font-size: 13px;
}

:deep(.cq-action-btn--compact) {
  height: 30px;
  padding: 0 12px;
  font-size: 11px;
  border-radius: 10px;
}

:deep(.cq-action-btn--apply) {
  background: linear-gradient(135deg, #60a5fa, #3b82f6);
  border-color: #3b82f6;
  box-shadow: 0 10px 18px rgb(59 130 246 / 18%);
}

:deep(.cq-action-btn--apply:hover) {
  background: linear-gradient(135deg, #4f94f8, #2563eb);
  border-color: #2563eb;
  box-shadow: 0 14px 24px rgb(59 130 246 / 24%);
}

:deep(.cq-action-btn--apply.is-disabled) {
  box-shadow: none;
}

:deep(.cq-action-btn--restore) {
  color: #21485b;
  background: linear-gradient(180deg, rgb(244 248 251 / 96%), rgb(234 241 246 / 96%));
  border-color: #c9d7e2;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 75%);
}

:deep(.cq-action-btn--restore:hover) {
  color: #16394b;
  background: linear-gradient(180deg, rgb(248 251 253 / 100%), rgb(239 245 249 / 100%));
  border-color: #aebfcb;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 82%),
    0 10px 18px rgb(147 167 186 / 16%);
}

:deep(.cq-action-btn--clear) {
  flex: 0 0 auto;
  padding-inline: 12px;
  color: #8a5b5b;
  background: linear-gradient(180deg, rgb(255 250 249 / 100%), rgb(250 241 239 / 100%));
  border-color: rgb(234 209 204 / 95%);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 75%);
}

:deep(.cq-action-btn--clear:hover) {
  color: #a13f3f;
  background: linear-gradient(180deg, rgb(255 245 243 / 100%), rgb(251 236 233 / 100%));
  border-color: #dfb8b2;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 75%),
    0 10px 18px rgb(205 125 109 / 14%);
}

:deep(.cq-action-btn--export) {
  color: #18303a;
  background: linear-gradient(180deg, rgb(242 247 248 / 98%), rgb(229 238 240 / 98%));
  border-color: #bed0d6;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 76%),
    0 10px 18px rgb(64 104 116 / 10%);
}

:deep(.cq-action-btn--export:hover) {
  color: #102a33;
  background: linear-gradient(180deg, rgb(246 250 251 / 100%), rgb(233 242 244 / 100%));
  border-color: #9eb8c0;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 86%),
    0 12px 22px rgb(64 104 116 / 14%);
}

:deep(.cq-action-btn.is-disabled),
:deep(.cq-action-btn.is-disabled:hover) {
  transform: none;
  box-shadow: none;
}

.cq-date-picker {
  width: 100%;
}

.cq-progress-range {
  display: grid;
  gap: 8px;
}

.cq-progress-range__inputs {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  gap: 8px;
  align-items: center;
}

.cq-progress-range__divider {
  font-size: 12px;
  color: #6a7989;
}

.cq-empty-stage {
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: center;
  min-height: 0;
  padding: 24px;
  overflow: auto;
}

.cq-empty-stage__hero {
  max-width: 720px;
}

.cq-empty-stage__title {
  margin: 12px 0 0;
  font-size: clamp(30px, 4vw, 44px);
  line-height: 1.04;
  color: #152130;
}

.cq-empty-stage__desc {
  max-width: 640px;
  margin: 14px 0 0;
  font-size: 15px;
  line-height: 1.7;
  color: #617284;
}

.cq-empty-stage__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 28px;
}

.cq-guide-card {
  padding: 18px;
  background: linear-gradient(180deg, #fff, #f7fafc);
  border: 1px solid #dce5ec;
  border-radius: 20px;
}

.cq-guide-card__step {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: #118ab2;
  text-transform: uppercase;
}

.cq-guide-card__title {
  margin-top: 14px;
  font-size: 16px;
  font-weight: 700;
  color: #152130;
}

.cq-guide-card__desc {
  margin-top: 8px;
  font-size: 13px;
  line-height: 1.6;
  color: #6a7989;
}

.cq-summary-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 4px;
  flex-shrink: 0;
}

.cq-summary-card {
  min-height: 56px;
  border: none;
  border-radius: 18px;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

:deep(.cq-summary-card .el-card__body) {
  padding: 6px 8px;
}

.cq-summary-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 16px 28px rgb(15 23 42 / 10%);
}

.cq-summary-card__label {
  font-size: 10px;
  font-weight: 600;
  color: #526476;
}

.cq-summary-card__value {
  margin-top: 2px;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.1;
  color: #152130;
}

.cq-summary-card__hint {
  margin-top: 1px;
  font-size: 9px;
  color: #6c7a8a;
}

.cq-summary-card--teal {
  background: linear-gradient(145deg, rgb(42 157 143 / 16%), rgb(42 157 143 / 6%));
}

.cq-summary-card--slate {
  background: linear-gradient(145deg, rgb(38 70 83 / 14%), rgb(38 70 83 / 6%));
}

.cq-summary-card--gold {
  background: linear-gradient(145deg, rgb(233 196 106 / 18%), rgb(233 196 106 / 8%));
}

.cq-summary-card--amber {
  background: linear-gradient(145deg, rgb(244 162 97 / 16%), rgb(244 162 97 / 7%));
}

.cq-summary-card--coral {
  background: linear-gradient(145deg, rgb(231 111 81 / 16%), rgb(231 111 81 / 7%));
}

.cq-summary-card--steel {
  background: linear-gradient(145deg, rgb(141 153 174 / 18%), rgb(141 153 174 / 8%));
}

.cq-draft-banner {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  background: linear-gradient(180deg, #fff9eb, #fff5dd);
  border: 1px solid #f2d6a0;
  border-radius: 18px;
  flex-shrink: 0;
}

.cq-draft-banner__title {
  font-size: 11px;
  font-weight: 700;
  color: #7c5900;
}

.cq-draft-banner__desc {
  margin-top: 1px;
  font-size: 10px;
  line-height: 1.5;
  color: #8b6b18;
}

.cq-draft-banner__actions {
  display: flex;
  gap: 8px;
}

.cq-results {
  position: relative;
  display: flex;
  min-height: 0;
  padding: 10px 10px 6px;
  overflow: hidden;
  flex: 1;
  flex-direction: column;
}

.cq-results__toolbar,
.cq-insight-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 6px;
  flex-shrink: 0;
}

.cq-results__title {
  font-size: 13px;
  font-weight: 700;
  color: #152130;
}

.cq-results__desc {
  display: none;
}

.cq-mobile-results-meta {
  display: flex;
  gap: 6px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.cq-mobile-results-meta span {
  padding: 4px 8px;
  font-size: 10px;
  font-weight: 600;
  color: #4f6476;
  background: #eff4f7;
  border-radius: 999px;
}

.cq-results__actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.cq-switch-group {
  display: inline-flex;
  gap: 6px;
  padding: 3px;
  background: #f4f7fa;
  border: 1px solid #dae2e8;
  border-radius: 999px;
}

.cq-switch-group--compact {
  background: #fbfcfd;
}

.cq-switch-chip {
  padding: 6px 10px;
  font-size: 10px;
  font-weight: 600;
  color: #556273;
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: 999px;
  transition: all 0.2s ease;
}

.cq-switch-chip--compact {
  padding: 4px 8px;
}

.cq-switch-chip--active {
  color: #152130;
  background: #fff;
  box-shadow: 0 6px 16px rgb(15 23 42 / 9%);
}

.cq-table-shell {
  min-height: 0;
  padding-bottom: 8px;
  overflow: hidden;
  flex: 1;
}

.cq-mobile-card-list {
  display: flex;
  padding-bottom: 8px;
  overflow: auto;
  gap: 10px;
  flex: 1;
  flex-direction: column;
}

.cq-mobile-card {
  display: flex;
  gap: 12px;
  flex-direction: column;
  padding: 14px;
  background:
    linear-gradient(180deg, rgb(255 255 255 / 100%), rgb(248 251 253 / 98%)),
    linear-gradient(135deg, rgb(17 138 178 / 6%), transparent);
  border: 1px solid #d9e4eb;
  border-radius: 18px;
  box-shadow: 0 14px 24px rgb(15 23 42 / 6%);
}

.cq-mobile-card__head,
.cq-mobile-card__footer {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  justify-content: space-between;
}

.cq-mobile-card__code {
  font-size: 15px;
  font-weight: 800;
  color: #152130;
}

.cq-mobile-card__title {
  margin-top: 3px;
  font-size: 13px;
  line-height: 1.4;
  color: #4e6174;
}

.cq-mobile-card__status {
  flex-shrink: 0;
}

.cq-mobile-card__summary {
  display: flex;
  gap: 6px;
  flex-direction: column;
}

.cq-mobile-card__product {
  font-size: 14px;
  font-weight: 700;
  color: #1e2f3f;
}

.cq-mobile-card__subline {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 11px;
  color: #6b7b8c;
}

.cq-mobile-card__metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.cq-mobile-metric {
  display: flex;
  gap: 4px;
  flex-direction: column;
  padding: 10px;
  background: #f6fafc;
  border: 1px solid #e1eaef;
  border-radius: 14px;
}

.cq-mobile-metric__label {
  font-size: 10px;
  font-weight: 600;
  color: #68798a;
}

.cq-mobile-metric__value {
  font-size: 13px;
  font-weight: 800;
  color: #162536;
}

.cq-mobile-card__finance,
.cq-mobile-card__detail {
  display: grid;
  gap: 8px;
}

.cq-mobile-pair {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 8px;
  font-size: 12px;
  color: #637284;
  border-bottom: 1px dashed #dbe5eb;
}

.cq-mobile-pair:last-child {
  padding-bottom: 0;
  border-bottom: none;
}

.cq-mobile-pair strong {
  max-width: 60%;
  font-size: 12px;
  font-weight: 700;
  color: #1a2d3f;
  text-align: right;
}

.cq-mobile-card__dates {
  display: flex;
  gap: 6px;
  flex-direction: column;
  font-size: 11px;
  color: #6f7f90;
}

.cq-table-shell :deep(.el-scrollbar__bar.is-horizontal) {
  bottom: 2px;
  height: 10px;
  opacity: 1;
}

.cq-table-shell :deep(.el-scrollbar__bar.is-horizontal > div) {
  background-color: rgb(138 152 167 / 65%);
  border-radius: 999px;
}

.cq-table-shell :deep(.el-scrollbar__bar.is-horizontal:hover > div) {
  background-color: rgb(92 109 126 / 78%);
}

:deep(.el-tag.cq-production-status-tag) {
  height: 22px;
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
  justify-content: center;
  box-sizing: border-box;
}

.cq-pagination {
  display: flex;
  justify-content: center;
  margin-top: 8px;
  flex-shrink: 0;
}

:deep(.cq-pagination .el-pagination) {
  --el-pagination-button-height: 24px;
  --el-pagination-button-width: 24px;

  gap: 4px;
  padding: 4px 8px;
  background: rgb(255 255 255 / 92%);
  border: 1px solid rgb(214 223 231 / 90%);
  border-radius: 999px;
  box-shadow: 0 8px 18px rgb(15 23 42 / 8%);
}

:deep(.cq-pagination .el-pagination .btn-prev),
:deep(.cq-pagination .el-pagination .btn-next),
:deep(.cq-pagination .el-pagination .el-pager li) {
  height: 24px;
  min-width: 24px;
  font-size: 11px;
  line-height: 24px;
}

:deep(.cq-pagination .el-pagination .el-pagination__total),
:deep(.cq-pagination .el-pagination .el-pagination__jump),
:deep(.cq-pagination .el-pagination .el-pagination__sizes) {
  font-size: 11px;
}

:deep(.cq-pagination .el-pagination .el-input__wrapper),
:deep(.cq-pagination .el-pagination .el-select__wrapper) {
  min-height: 24px;
  padding-top: 0;
  padding-bottom: 0;
}

.cq-insight-toolbar__select {
  width: 360px;
}

.cq-insight-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 240px;
}

.cq-insight-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.28fr) minmax(0, 1fr);
  gap: 12px;
  flex: 1;
  min-height: 0;
}

.cq-insight-left,
.cq-insight-right {
  padding: 8px;
  overflow: auto;
  background: #fbfcfd;
  border: 1px solid #dde4ea;
  border-radius: 18px;
}

.cq-insight-project {
  padding: 12px 14px;
  margin-bottom: 12px;
  background: linear-gradient(135deg, rgb(21 33 48 / 4%), rgb(17 138 178 / 10%));
  border: 1px solid rgb(17 138 178 / 14%);
  border-radius: 16px;
}

.cq-insight-project__code {
  font-size: 20px;
  font-weight: 700;
  color: #152130;
}

.cq-insight-project__meta {
  margin-top: 4px;
  font-size: 12px;
  color: #627182;
}

.cq-stage-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.cq-stage-card {
  padding: 12px;
  background: #fff;
  border: 1px solid #e2e8ee;
  border-radius: 14px;
}

.cq-stage-card--reserved {
  background: rgb(64 158 255 / 4%);
}

.cq-stage-card__head {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.cq-stage-card__title {
  font-size: 14px;
  font-weight: 700;
  color: #152130;
}

.cq-stage-card__summary {
  min-height: 38px;
  margin-bottom: 8px;
  font-size: 12px;
  line-height: 1.5;
  color: #627182;
}

.cq-stage-card__meta {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.cq-stage-card__meta-row {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: #66768a;
}

.cq-timeline__title {
  font-size: 13px;
  font-weight: 700;
  color: #152130;
}

.cq-timeline__meta {
  display: flex;
  gap: 8px;
  margin-top: 2px;
}

.cq-timeline__date,
.cq-timeline__detail {
  font-size: 12px;
  color: #66768a;
}

@media (width >= 769px) {
  .cq-page {
    height: calc(100vh - 90px);
    overflow: hidden;
  }
}

@media (width <= 1480px) {
  .cq-summary-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (width <= 1240px) {
  .cq-layout {
    grid-template-columns: 1fr;
  }

  .cq-sidebar {
    overflow: visible;
  }

  .cq-main {
    overflow: visible;
  }

  .cq-insight-layout {
    grid-template-columns: 1fr;
  }

  .cq-stage-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (width <= 768px) {
  .cq-page {
    height: 100%;
    min-height: 0;
    padding: 10px;
    overflow: hidden auto;
    -webkit-overflow-scrolling: touch;
  }

  .cq-shell {
    height: auto;
    min-height: max-content;
    overflow: visible;
  }

  .cq-layout {
    gap: 10px;
    min-height: auto;
    overflow: visible;
  }

  .cq-sidebar {
    padding-right: 0;
  }

  .cq-panel,
  .cq-results,
  .cq-empty-stage {
    border-radius: 20px;
  }

  .cq-empty-stage {
    padding: 20px 16px;
  }

  .cq-main {
    min-height: auto;
    overflow: visible;
  }

  .cq-empty-stage__grid {
    grid-template-columns: 1fr;
  }

  .cq-summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .cq-draft-banner {
    flex-direction: column;
    align-items: stretch;
  }

  .cq-draft-banner__actions {
    justify-content: flex-start;
  }

  .cq-results {
    min-height: auto;
    padding: 12px 12px 10px;
    overflow: visible;
  }

  .cq-results__toolbar,
  .cq-insight-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .cq-results__actions {
    justify-content: flex-start;
  }

  .cq-switch-group {
    width: 100%;
    justify-content: flex-start;
    overflow: auto hidden;
    scrollbar-width: none;
  }

  .cq-switch-chip {
    flex: 0 0 auto;
    min-width: max-content;
  }

  .cq-insight-toolbar__select {
    width: 100%;
  }

  .cq-stage-grid {
    grid-template-columns: 1fr;
  }

  .cq-summary-card {
    min-height: 72px;
  }

  :deep(.cq-summary-card .el-card__body) {
    padding: 10px 10px 9px;
  }

  .cq-pagination--mobile {
    margin-top: 10px;
  }

  :deep(.cq-pagination--mobile .el-pagination) {
    width: 100%;
    justify-content: center;
    border-radius: 18px;
  }

  :deep(.cq-pagination--mobile .el-pagination__sizes),
  :deep(.cq-pagination--mobile .el-pagination__jump) {
    display: none;
  }

  .cq-mobile-card__footer {
    align-items: flex-end;
  }

  .cq-mobile-card-list {
    overflow: visible;
    flex: none;
  }

  .cq-insight-layout {
    min-height: auto;
  }

  .cq-insight-left,
  .cq-insight-right,
  .cq-insight-empty {
    min-height: auto;
    overflow: visible;
  }
}
</style>
