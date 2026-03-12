<template>
  <div class="comprehensive-query-page" :class="{ 'comprehensive-query-page--home': !hasSearched }">
    <template v-if="!hasSearched">
      <section class="search-home">
        <div class="search-home__eyebrow">项目 / 生产 / 出货 / 开票 / 回款</div>
        <h1 class="search-home__title">综合查询</h1>
        <p class="search-home__desc">先搜索，再进入结果工作台。默认不铺开全量数据。</p>

        <div class="search-home__bar">
          <el-input
            v-model="queryForm.keyword"
            placeholder="输入项目编号 / 客户 / 产品名称 / 图号"
            clearable
            class="search-home__input"
            @keyup.enter="handleSearch"
          />
          <el-button type="primary" size="large" :loading="loading" @click="handleSearch">
            开始查询
          </el-button>
        </div>

        <div class="search-home__filters">
          <el-select
            v-model="queryForm.customerName"
            filterable
            clearable
            placeholder="全部客户"
            class="search-home__select"
          >
            <el-option v-for="item in customerOptions" :key="item" :label="item" :value="item" />
          </el-select>
          <el-select
            v-model="queryForm.category"
            filterable
            clearable
            placeholder="全部分类"
            class="search-home__select"
          >
            <el-option v-for="item in categoryOptions" :key="item" :label="item" :value="item" />
          </el-select>
          <el-button text @click="toggleAdvancedFilters">
            {{ showAdvancedFilters ? '收起高级筛选' : '展开高级筛选' }}
          </el-button>
        </div>

        <div v-show="showAdvancedFilters" class="search-home__advanced">
          <el-row :gutter="12">
            <el-col :xs="24" :sm="12" :lg="6">
              <el-form-item label="结清状态" label-width="72px" class="search-home__form-item">
                <el-select
                  v-model="queryForm.settlementStatus"
                  clearable
                  placeholder="全部"
                  class="filter-control"
                >
                  <el-option label="销售已结清" value="销售已结清" />
                  <el-option label="销售未结清" value="销售未结清" />
                  <el-option label="开票已结清" value="开票已结清" />
                  <el-option label="开票未结清" value="开票未结清" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="12" :lg="6">
              <el-form-item label="异常类型" label-width="72px" class="search-home__form-item">
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
            <el-col :xs="24" :sm="24" :lg="12">
              <el-form-item label="进度范围" label-width="72px" class="search-home__form-item">
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
                  placeholder="可组合多个进度条件"
                  @change="handleMergedFilterChange"
                />
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="24" :lg="12">
              <el-form-item label="订单日期" label-width="72px" class="search-home__form-item">
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
          </el-row>
        </div>

        <div class="search-home__quick-actions">
          <el-button
            v-for="preset in queryPresets"
            :key="preset.key"
            size="small"
            text
            :class="resolvePresetClass(preset.key)"
            @click="applyQueryPreset(preset)"
          >
            {{ preset.label }}
          </el-button>
        </div>
      </section>
    </template>

    <template v-else>
      <section class="query-hero">
        <div class="query-hero__main">
          <div class="query-hero__eyebrow">项目 / 生产 / 出货 / 开票 / 回款</div>
          <div class="query-hero__title-row">
            <h1 class="query-hero__title">综合查询</h1>
            <p class="query-hero__desc">查询完成后进入工作台，支持继续筛选与洞察。</p>
          </div>
        </div>
        <div class="query-hero__side">
          <div class="query-hero__quick-actions">
            <el-button
              v-for="preset in queryPresets"
              :key="preset.key"
              size="small"
              text
              :class="resolvePresetClass(preset.key)"
              @click="applyQueryPreset(preset)"
            >
              {{ preset.label }}
            </el-button>
            <el-button
              size="small"
              class="preset-chip preset-chip--export"
              :loading="exporting"
              @click="handleExport"
            >
              导出 Excel
            </el-button>
          </div>
          <div class="query-hero__meta">
            <div class="query-hero__meta-value">{{ total.toLocaleString() }}</div>
            <div class="query-hero__meta-label">当前命中项目</div>
          </div>
        </div>
      </section>

      <section class="query-panel">
        <el-form ref="queryFormRef" :model="queryForm" label-width="72px" class="filter-form">
          <el-row :gutter="12">
            <el-col :xs="24" :sm="12" :lg="6">
              <el-form-item label="关键词">
                <el-input
                  v-model="queryForm.keyword"
                  placeholder="项目编号 / 产品名称 / 产品图号"
                  clearable
                  class="filter-control"
                  @keyup.enter="handleSearch"
                />
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="12" :lg="4">
              <el-form-item label="客户">
                <el-select
                  v-model="queryForm.customerName"
                  filterable
                  clearable
                  placeholder="全部客户"
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
              <el-form-item label="分类">
                <el-select
                  v-model="queryForm.category"
                  filterable
                  clearable
                  placeholder="全部分类"
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
            <el-col :xs="24" :sm="12" :lg="3">
              <el-form-item label=" ">
                <div class="filter-advanced-toggle">
                  <el-button text @click="toggleAdvancedFilters">
                    {{ showAdvancedFilters ? '收起高级筛选' : '展开高级筛选' }}
                  </el-button>
                  <span v-if="hasAdvancedFilters" class="filter-advanced-toggle__dot">
                    已启用 {{ advancedFilterCount }} 项
                  </span>
                </div>
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="24" :lg="8">
              <el-form-item label=" " class="filter-actions-item">
                <div class="filter-actions">
                  <el-button type="primary" :loading="loading" @click="handleSearch"
                    >查询</el-button
                  >
                  <el-button @click="handleReset">重新搜索</el-button>
                </div>
              </el-form-item>
            </el-col>
          </el-row>

          <div v-show="showAdvancedFilters" class="filter-form__advanced">
            <el-row :gutter="12">
              <el-col :xs="24" :sm="12" :lg="4">
                <el-form-item label="结清状态">
                  <el-select
                    v-model="queryForm.settlementStatus"
                    clearable
                    placeholder="全部"
                    class="filter-control"
                  >
                    <el-option label="销售已结清" value="销售已结清" />
                    <el-option label="销售未结清" value="销售未结清" />
                    <el-option label="开票已结清" value="开票已结清" />
                    <el-option label="开票未结清" value="开票未结清" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :xs="24" :sm="12" :lg="4">
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
              <el-col :xs="24" :sm="24" :lg="8">
                <el-form-item label="进度范围">
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
                    placeholder="可组合多个进度条件"
                    @change="handleMergedFilterChange"
                  />
                </el-form-item>
              </el-col>
              <el-col :xs="24" :sm="24" :lg="8">
                <el-form-item label="订单日期">
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
            </el-row>
          </div>
        </el-form>

        <div v-if="activeFilterTags.length" class="active-filters">
          <span class="active-filters__label">当前筛选</span>
          <el-tag
            v-for="item in activeFilterTags"
            :key="item.key"
            closable
            class="active-filters__tag"
            @close="clearFilter(item.key)"
          >
            {{ item.label }}
          </el-tag>
        </div>
      </section>

      <section class="summary-grid">
        <el-card shadow="hover" class="summary-card summary-card--teal">
          <div class="summary-card__label">项目数</div>
          <div class="summary-card__value">{{ summaryCards.projectCount.toLocaleString() }}</div>
          <div class="summary-card__hint">命中</div>
        </el-card>
        <el-card shadow="hover" class="summary-card summary-card--slate">
          <div class="summary-card__label">销售金额</div>
          <div class="summary-card__value">{{ formatAmount(summaryCards.salesAmount) }}</div>
          <div class="summary-card__hint">订单</div>
        </el-card>
        <el-card shadow="hover" class="summary-card summary-card--gold">
          <div class="summary-card__label">开票金额</div>
          <div class="summary-card__value">{{ formatAmount(summaryCards.invoiceAmount) }}</div>
          <div class="summary-card__hint">开票</div>
        </el-card>
        <el-card shadow="hover" class="summary-card summary-card--amber">
          <div class="summary-card__label">回款合计</div>
          <div class="summary-card__value">
            {{ formatAmountPair(summaryCards.receiptAmount, summaryCards.discountAmount) }}
          </div>
          <div class="summary-card__hint">含贴息</div>
        </el-card>
        <el-card shadow="hover" class="summary-card summary-card--coral">
          <div class="summary-card__label">未开票金额</div>
          <div class="summary-card__value">{{ formatAmount(summaryCards.uninvoicedAmount) }}</div>
          <div class="summary-card__hint">差额</div>
        </el-card>
        <el-card shadow="hover" class="summary-card summary-card--steel">
          <div class="summary-card__label">订单欠款</div>
          <div class="summary-card__value">{{ formatAmount(summaryCards.orderArrearsAmount) }}</div>
          <div class="summary-card__hint">待回款</div>
        </el-card>
      </section>

      <section class="result-panel">
        <div class="result-panel__toolbar">
          <div>
            <div class="result-panel__title">结果列表</div>
            <div class="result-panel__desc">{{ resultDescription }}</div>
          </div>
          <div class="result-toolbar-actions">
            <div class="switch-group">
              <button
                type="button"
                class="switch-chip"
                :class="{ 'switch-chip--active': activeView === 'table' }"
                @click="activeView = 'table'"
              >
                表格视图
              </button>
              <button
                type="button"
                class="switch-chip"
                :class="{ 'switch-chip--active': activeView === 'insights' }"
                @click="activeView = 'insights'"
              >
                阶段洞察
              </button>
            </div>
            <div v-if="activeView === 'table'" class="switch-group switch-group--compact">
              <button
                type="button"
                class="switch-chip switch-chip--compact"
                :class="{ 'switch-chip--active': tableMode === 'overview' }"
                @click="tableMode = 'overview'"
              >
                概览
              </button>
              <button
                type="button"
                class="switch-chip switch-chip--compact"
                :class="{ 'switch-chip--active': tableMode === 'finance' }"
                @click="tableMode = 'finance'"
              >
                财务
              </button>
              <button
                type="button"
                class="switch-chip switch-chip--compact"
                :class="{ 'switch-chip--active': tableMode === 'full' }"
                @click="tableMode = 'full'"
              >
                全部字段
              </button>
            </div>
          </div>
        </div>

        <template v-if="activeView === 'table'">
          <div class="result-table-shell">
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
                min-width="140"
                show-overflow-tooltip
              />
              <el-table-column
                prop="productName"
                label="产品名称"
                min-width="150"
                show-overflow-tooltip
              />
              <el-table-column prop="category" label="分类" min-width="110" show-overflow-tooltip />
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

              <template
                v-if="tableMode === 'overview' || tableMode === 'finance' || tableMode === 'full'"
              >
                <el-table-column label="销售金额" width="120" align="right">
                  <template #default="{ row }">{{ formatAmount(row.salesAmount) }}</template>
                </el-table-column>
              </template>

              <template v-if="tableMode === 'finance' || tableMode === 'full'">
                <el-table-column label="开票金额" width="110" align="right">
                  <template #default="{ row }">{{ formatAmount(row.invoiceAmount) }}</template>
                </el-table-column>
                <el-table-column label="回款金额" width="110" align="right">
                  <template #default="{ row }">{{ formatAmount(row.receiptAmount) }}</template>
                </el-table-column>
                <el-table-column label="贴息金额" width="110" align="right">
                  <template #default="{ row }">{{ formatAmount(row.discountAmount) }}</template>
                </el-table-column>
                <el-table-column label="未开票金额" width="110" align="right">
                  <template #default="{ row }">{{ formatAmount(row.uninvoicedAmount) }}</template>
                </el-table-column>
                <el-table-column label="开票欠款" width="110" align="right">
                  <template #default="{ row }">{{ formatAmount(row.unreceivedAmount) }}</template>
                </el-table-column>
              </template>

              <el-table-column
                v-if="tableMode === 'overview' || tableMode === 'finance' || tableMode === 'full'"
                label="订单欠款"
                width="110"
                align="right"
              >
                <template #default="{ row }">{{ formatAmount(row.orderArrearsAmount) }}</template>
              </el-table-column>

              <el-table-column
                v-if="tableMode === 'finance' || tableMode === 'full'"
                label="结清状态"
                width="120"
                align="center"
              >
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
                v-if="tableMode === 'finance' || tableMode === 'full'"
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

              <template v-if="tableMode === 'full'">
                <el-table-column
                  prop="productDrawing"
                  label="产品图号"
                  min-width="140"
                  show-overflow-tooltip
                />
                <el-table-column
                  prop="customerModelNo"
                  label="客户模号"
                  min-width="130"
                  show-overflow-tooltip
                />
                <el-table-column prop="owner" label="负责人" width="90" align="center" />
                <el-table-column label="数量" width="90" align="right">
                  <template #default="{ row }">{{ formatNumber(row.orderQuantity) }}</template>
                </el-table-column>
                <el-table-column label="单价" width="108" align="right">
                  <template #default="{ row }">{{ formatAmount(row.unitPrice) }}</template>
                </el-table-column>
                <el-table-column
                  prop="contractNo"
                  label="合同号"
                  min-width="130"
                  show-overflow-tooltip
                />
                <el-table-column prop="remark" label="备注" min-width="160" show-overflow-tooltip />
                <el-table-column
                  prop="costSource"
                  label="费用出处"
                  min-width="130"
                  show-overflow-tooltip
                />
                <el-table-column prop="outboundQty" label="出货数量" width="90" align="right" />
                <el-table-column
                  prop="latestOutboundDate"
                  label="最近出货"
                  width="110"
                  align="center"
                />
              </template>

              <el-table-column prop="latestOrderDate" label="最近订单" width="110" align="center" />
              <el-table-column
                prop="latestInvoiceDate"
                label="最近开票"
                width="110"
                align="center"
              />
              <el-table-column
                prop="latestReceiptDate"
                label="最近回款"
                width="110"
                align="center"
              />
              <el-table-column label="操作" width="86" align="center" fixed="right">
                <template #default="{ row }">
                  <el-button type="primary" link @click.stop="handleViewInsight(row)"
                    >看洞察</el-button
                  >
                </template>
              </el-table-column>
              <template #empty>
                <el-empty description="暂无数据" :image-size="120" />
              </template>
            </el-table>
          </div>

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
        </template>

        <template v-else>
          <div class="insight-toolbar">
            <div>
              <div class="insight-toolbar__title">项目阶段洞察</div>
              <div class="insight-toolbar__desc">从当前结果中选择一个项目查看完整时间线。</div>
            </div>
            <el-select
              v-model="selectedProjectCode"
              filterable
              clearable
              placeholder="请选择项目编号"
              class="insight-toolbar__select"
            >
              <el-option
                v-for="item in projectOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </div>

          <div v-if="!selectedProjectCode" class="insight-empty">
            <el-empty description="请先从当前结果中选择一个项目" :image-size="120" />
          </div>

          <div v-else-if="journeyLoading" class="insight-empty">
            <el-skeleton :rows="8" animated />
          </div>

          <div v-else-if="journey" class="insight-layout">
            <div class="insight-left">
              <div class="insight-project">
                <div class="insight-project__code">{{ journey.projectCode }}</div>
                <div class="insight-project__meta">{{ currentInsightSubtitle }}</div>
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
                  <div class="stage-card__summary">后续接入采购节点后，会自动纳入当前时间线。</div>
                </div>

                <div class="stage-card stage-card--reserved">
                  <div class="stage-card__head">
                    <div class="stage-card__title">入库（预留）</div>
                    <el-tag type="info">待接入</el-tag>
                  </div>
                  <div class="stage-card__summary">后续接入入库节点后，会自动纳入当前时间线。</div>
                </div>
              </div>
            </div>

            <div class="insight-right">
              <div class="insight-right__title">阶段事件时间线</div>
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
        </template>
      </section>
    </template>
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
  ElTable,
  ElTableColumn,
  ElTag,
  ElTimeline,
  ElTimelineItem,
  ElTreeSelect
} from 'element-plus'
import { ElMessage } from 'element-plus'
import type { FormInstance } from 'element-plus'
import { computed, onMounted, reactive, ref, watch } from 'vue'
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

interface QueryPreset {
  key: string
  label: string
  settlementStatus?: string
  anomalyType?: string
  progressSelections?: string[]
}

interface ActiveFilterTag {
  key: string
  label: string
}

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

const queryPresets: QueryPreset[] = [
  {
    key: 'no-advance',
    label: '未收预付款',
    settlementStatus: '销售未结清',
    progressSelections: ['progress:receipt:0']
  },
  {
    key: 'new-advance-paid-no-invoice',
    label: '预付已收未开票',
    progressSelections: ['progress:invoice:0', 'progress:receipt:0_30']
  },
  {
    key: 'invoice-full-receipt-70',
    label: '开票 100% 仅收一验',
    settlementStatus: '开票未结清',
    progressSelections: ['progress:invoice:100', 'progress:receipt:60_90']
  },
  {
    key: 'final-10-unreceived',
    label: '未收最后 10%',
    settlementStatus: '开票未结清',
    progressSelections: ['progress:invoice:100', 'progress:receipt:90_100']
  },
  {
    key: 'invoice-covered',
    label: '回款覆盖开票',
    progressSelections: ['progress:receipt_invoice:100']
  },
  {
    key: 'all-cleared',
    label: '销售已结清',
    settlementStatus: '销售已结清',
    progressSelections: ['progress:receipt:100']
  }
]

const loading = ref(false)
const exporting = ref(false)
const tableData = ref<ComprehensiveQueryRow[]>([])
const total = ref(0)
const hasSearched = ref(false)
const appStore = useAppStore()
const isMobile = computed(() => appStore.getMobile)
const tableHeight = computed(() => (isMobile.value ? undefined : '100%'))

const pagination = reactive({
  page: 1,
  pageSize: 20
})

const activeView = ref<'table' | 'insights'>('table')
const tableMode = ref<'overview' | 'finance' | 'full'>('overview')
const selectedProjectCode = ref('')
const journeyLoading = ref(false)
const journey = ref<ProjectJourney | null>(null)
const customerOptions = ref<string[]>([])
const categoryOptions = ref<string[]>([])
const mergedFilterValues = ref<string[]>([])
const summaryCards = ref<ComprehensiveQuerySummary>({ ...EMPTY_SUMMARY })
const showAdvancedFilters = ref(false)
const appliedPresetKey = ref('')

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
    label: '回款进度(对销售)',
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
    label: '回款覆盖率(对开票)',
    value: 'progressType:receipt_invoice',
    disabled: true,
    children: [
      { label: '0%', value: 'progress:receipt_invoice:0' },
      { label: '0%-30%', value: 'progress:receipt_invoice:0_30' },
      { label: '30%-60%', value: 'progress:receipt_invoice:30_60' },
      { label: '60%-90%', value: 'progress:receipt_invoice:60_90' },
      { label: '90%-100%', value: 'progress:receipt_invoice:90_100' },
      { label: '100%', value: 'progress:receipt_invoice:100' }
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

const projectOptions = computed(() =>
  tableData.value.map((item) => ({
    value: item.projectCode,
    label: `${item.projectCode}${item.customerName ? ` / ${item.customerName}` : ''}`
  }))
)

const hasAdvancedFilters = computed(() =>
  Boolean(
    queryForm.settlementStatus ||
      queryForm.anomalyType ||
      mergedFilterValues.value.length ||
      queryForm.dateRange.length
  )
)

const advancedFilterCount = computed(() => {
  let count = 0
  if (queryForm.settlementStatus) count += 1
  if (queryForm.anomalyType) count += 1
  if (mergedFilterValues.value.length) count += 1
  if (queryForm.dateRange.length) count += 1
  return count
})

const activeFilterTags = computed<ActiveFilterTag[]>(() => {
  const list: ActiveFilterTag[] = []
  if (queryForm.keyword.trim()) {
    list.push({ key: 'keyword', label: `关键词: ${queryForm.keyword.trim()}` })
  }
  if (queryForm.customerName) {
    list.push({ key: 'customerName', label: `客户: ${queryForm.customerName}` })
  }
  if (queryForm.category) {
    list.push({ key: 'category', label: `分类: ${queryForm.category}` })
  }
  if (queryForm.settlementStatus) {
    list.push({ key: 'settlementStatus', label: `结清: ${queryForm.settlementStatus}` })
  }
  if (queryForm.anomalyType) {
    list.push({
      key: 'anomalyType',
      label: `异常: ${anomalyLabelMap[queryForm.anomalyType] || queryForm.anomalyType}`
    })
  }
  if (mergedFilterValues.value.length) {
    list.push({ key: 'progress', label: `进度: ${mergedFilterValues.value.length} 项` })
  }
  if (queryForm.dateRange.length === 2) {
    list.push({ key: 'dateRange', label: `订单日期: ${queryForm.dateRange.join(' ~ ')}` })
  }
  return list
})

const resultDescription = computed(() => {
  if (!activeFilterTags.value.length) {
    return `共 ${total.value.toLocaleString()} 个项目，默认展示核心概览。`
  }
  return `共 ${total.value.toLocaleString()} 个项目，已按 ${activeFilterTags.value.length} 个条件筛选。`
})

const currentInsightRow = computed(
  () => tableData.value.find((item) => item.projectCode === selectedProjectCode.value) || null
)

const currentInsightSubtitle = computed(() => {
  const row = currentInsightRow.value
  if (!row) return '当前项目不在本页结果中'
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

const parseResponseData = (rawResp: unknown) => {
  const raw = rawResp as any
  const pr: any = raw?.data ?? raw
  return pr?.data ?? pr
}

const resolvePresetClass = (key: string) => {
  const classList = ['preset-chip']
  if (key === appliedPresetKey.value) {
    classList.push('preset-chip--active')
  }
  if (key === 'no-advance') classList.push('preset-chip--warning')
  if (key === 'new-advance-paid-no-invoice') classList.push('preset-chip--cyan')
  if (key === 'invoice-full-receipt-70') classList.push('preset-chip--primary')
  if (key === 'final-10-unreceived') classList.push('preset-chip--danger')
  if (key === 'invoice-covered') classList.push('preset-chip--indigo')
  if (key === 'all-cleared') classList.push('preset-chip--success')
  return classList.join(' ')
}

const buildListParams = (): ComprehensiveQueryListParams => ({
  keyword: queryForm.keyword.trim() || undefined,
  customerName: queryForm.customerName.trim() || undefined,
  category: queryForm.category || undefined,
  settlementStatus: queryForm.settlementStatus || undefined,
  anomalyType: queryForm.anomalyType || undefined,
  progressType: queryForm.progressType || undefined,
  progressRange: queryForm.progressRange || undefined,
  progressFilters:
    mergedFilterValues.value
      .filter((item) => item.startsWith('progress:'))
      .map((item) => {
        const parts = item.split(':')
        return parts.length >= 3 ? `${parts[1]}:${parts[2]}` : ''
      })
      .filter(Boolean)
      .join(',') || undefined,
  startDate: queryForm.dateRange[0] || undefined,
  endDate: queryForm.dateRange[1] || undefined
})

const syncAdvancedFilterVisibility = () => {
  if (hasAdvancedFilters.value) {
    showAdvancedFilters.value = true
  }
}

const handleMergedFilterChange = (values: string[] | string | undefined) => {
  const list = Array.isArray(values) ? values : values ? [values] : []
  const progressItems = list.filter((item) => item.startsWith('progress:'))
  if (!progressItems.length) {
    queryForm.progressType = ''
    queryForm.progressRange = ''
    return
  }
  const [lastProgress] = progressItems.slice(-1)
  const parts = lastProgress.split(':')
  queryForm.progressType = parts[1] || ''
  queryForm.progressRange = parts[2] || ''
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
  loading.value = true
  try {
    const params = {
      ...buildListParams(),
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

const toggleAdvancedFilters = () => {
  showAdvancedFilters.value = !showAdvancedFilters.value
}

const resetResultState = () => {
  tableData.value = []
  total.value = 0
  summaryCards.value = { ...EMPTY_SUMMARY }
  selectedProjectCode.value = ''
  journey.value = null
  activeView.value = 'table'
}

const applyQueryPreset = (preset: QueryPreset) => {
  appliedPresetKey.value = preset.key
  queryForm.settlementStatus = preset.settlementStatus || ''
  queryForm.anomalyType = preset.anomalyType || ''
  mergedFilterValues.value = Array.isArray(preset.progressSelections)
    ? [...preset.progressSelections]
    : []
  handleMergedFilterChange(mergedFilterValues.value)
  showAdvancedFilters.value = true
  pagination.page = 1
  hasSearched.value = true
  activeView.value = 'table'
  void loadList()
}

const clearFilter = (key: string) => {
  if (key === 'keyword') queryForm.keyword = ''
  if (key === 'customerName') queryForm.customerName = ''
  if (key === 'category') queryForm.category = ''
  if (key === 'settlementStatus') queryForm.settlementStatus = ''
  if (key === 'anomalyType') queryForm.anomalyType = ''
  if (key === 'progress') {
    mergedFilterValues.value = []
    queryForm.progressType = ''
    queryForm.progressRange = ''
  }
  if (key === 'dateRange') {
    queryForm.dateRange = []
  }
  appliedPresetKey.value = ''
  syncAdvancedFilterVisibility()
  pagination.page = 1
  hasSearched.value = true
  void loadList()
}

const handleSearch = () => {
  appliedPresetKey.value = ''
  syncAdvancedFilterVisibility()
  pagination.page = 1
  hasSearched.value = true
  activeView.value = 'table'
  void loadList()
}

const handleExport = async () => {
  try {
    exporting.value = true
    const resp: any = await exportComprehensiveQueryApi(buildListParams())
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

const handleReset = () => {
  queryForm.keyword = ''
  queryForm.customerName = ''
  queryForm.category = ''
  queryForm.settlementStatus = ''
  queryForm.anomalyType = ''
  queryForm.progressType = ''
  queryForm.progressRange = ''
  queryForm.dateRange = []
  mergedFilterValues.value = []
  showAdvancedFilters.value = false
  appliedPresetKey.value = ''
  queryFormRef.value?.clearValidate?.()
  pagination.page = 1
  hasSearched.value = false
  resetResultState()
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
})
</script>

<style scoped>
.comprehensive-query-page {
  display: flex;
  flex-direction: column;
  min-height: 0;
  gap: 12px;
  padding: 12px;
  background:
    radial-gradient(circle at top left, rgb(42 157 143 / 8%), transparent 32%),
    linear-gradient(180deg, rgb(248 250 252 / 96%), rgb(244 246 248 / 98%));
}

.comprehensive-query-page--home {
  justify-content: center;
}

.search-home,
.query-hero,
.query-panel,
.result-panel {
  background: rgb(255 255 255 / 88%);
  border: 1px solid rgb(210 218 226 / 90%);
  border-radius: 20px;
  box-shadow: 0 18px 40px rgb(15 23 42 / 6%);
  backdrop-filter: blur(10px);
}

.search-home {
  width: min(1080px, 100%);
  padding: 32px;
  margin: 0 auto;
}

.search-home__eyebrow {
  margin-bottom: 10px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.18em;
  color: #2a9d8f;
  text-align: center;
  text-transform: uppercase;
}

.search-home__title {
  margin: 0;
  font-size: clamp(34px, 4vw, 48px);
  font-weight: 700;
  line-height: 1.05;
  color: #18212f;
  text-align: center;
}

.search-home__desc {
  max-width: 520px;
  margin: 12px auto 0;
  font-size: 14px;
  line-height: 1.6;
  color: #64748b;
  text-align: center;
}

.search-home__bar {
  display: flex;
  gap: 12px;
  align-items: center;
  max-width: 760px;
  margin: 28px auto 0;
}

.search-home__input {
  flex: 1;
}

.search-home :deep(.search-home__input .el-input__wrapper) {
  min-height: 50px;
  padding-inline: 16px;
  border-radius: 16px;
  box-shadow: 0 8px 24px rgb(15 23 42 / 6%);
}

.search-home__filters {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  max-width: 760px;
  margin: 16px auto 0;
}

.search-home__select {
  width: 220px;
}

.search-home__advanced {
  max-width: 960px;
  padding: 18px 18px 8px;
  margin: 22px auto 0;
  background: linear-gradient(180deg, rgb(248 250 252 / 92%), rgb(244 247 249 / 96%));
  border: 1px dashed #d8e0e6;
  border-radius: 18px;
}

.search-home__form-item {
  margin-bottom: 10px;
}

.search-home__quick-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
  margin-top: 24px;
}

.query-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 18px;
}

.query-hero__main {
  min-width: 0;
  flex: 1;
}

.query-hero__side {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.query-hero__eyebrow {
  margin-bottom: 4px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: #2a9d8f;
  text-transform: uppercase;
}

.query-hero__title-row {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.query-hero__title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  line-height: 1.1;
  color: #18212f;
}

.query-hero__desc {
  margin: 0;
  font-size: 12px;
  color: #64748b;
}

.query-hero__meta {
  min-width: 140px;
  padding: 10px 14px;
  text-align: right;
  background: linear-gradient(135deg, rgb(38 70 83 / 10%), rgb(42 157 143 / 14%));
  border: 1px solid rgb(42 157 143 / 18%);
  border-radius: 14px;
}

.query-hero__meta-value {
  font-size: 24px;
  font-weight: 700;
  line-height: 1;
  color: #18212f;
}

.query-hero__meta-label {
  margin-top: 4px;
  font-size: 11px;
  color: #5a6778;
}

.query-panel {
  padding: 12px 14px 10px;
  overflow: auto;
}

.query-hero__quick-actions,
.search-home__quick-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.query-hero__quick-actions {
  justify-content: flex-end;
}

.query-hero__quick-actions :deep(.el-button),
.search-home__quick-actions :deep(.el-button) {
  min-height: 28px;
  padding: 0 12px;
  margin: 0;
  font-size: 12px;
  border: 1px solid #d7e0e8;
  border-radius: 999px;
}

.query-hero__quick-actions :deep(.preset-chip),
.search-home__quick-actions :deep(.preset-chip) {
  color: #3c4c5f;
  background: #f7f9fc;
}

.query-hero__quick-actions :deep(.preset-chip--active),
.search-home__quick-actions :deep(.preset-chip--active) {
  transform: translateY(-1px);
  box-shadow: inset 0 0 0 1px rgb(24 33 47 / 18%);
}

.query-hero__quick-actions :deep(.preset-chip--primary),
.search-home__quick-actions :deep(.preset-chip--primary) {
  color: #245ea8;
  background: #eaf3ff;
  border-color: #b8d2f2;
}

.query-hero__quick-actions :deep(.preset-chip--success),
.search-home__quick-actions :deep(.preset-chip--success) {
  color: #2f7d32;
  background: #ebf8ed;
  border-color: #b7e2bd;
}

.query-hero__quick-actions :deep(.preset-chip--warning),
.search-home__quick-actions :deep(.preset-chip--warning) {
  color: #986801;
  background: #fff7e8;
  border-color: #f0d6a0;
}

.query-hero__quick-actions :deep(.preset-chip--danger),
.search-home__quick-actions :deep(.preset-chip--danger) {
  color: #a63b3b;
  background: #fff1f0;
  border-color: #efc1c1;
}

.query-hero__quick-actions :deep(.preset-chip--cyan),
.search-home__quick-actions :deep(.preset-chip--cyan) {
  color: #0d6b6b;
  background: #edfafa;
  border-color: #b6e0e0;
}

.query-hero__quick-actions :deep(.preset-chip--indigo),
.search-home__quick-actions :deep(.preset-chip--indigo) {
  color: #3d4ea3;
  background: #f0f2ff;
  border-color: #c8ceef;
}

.query-hero__quick-actions :deep(.preset-chip--export),
.search-home__quick-actions :deep(.preset-chip--export) {
  color: #fff;
  background: #264653;
  border-color: #264653;
}

.filter-form :deep(.el-form-item),
.search-home :deep(.el-form-item) {
  margin-bottom: 8px;
}

.filter-form :deep(.el-form-item__label),
.search-home :deep(.el-form-item__label) {
  padding-right: 8px;
  font-size: 12px;
  color: #556273;
}

.filter-control {
  width: 100%;
}

.filter-form :deep(.filter-control .el-input__wrapper),
.filter-form :deep(.filter-control .el-select__wrapper),
.search-home :deep(.filter-control .el-input__wrapper),
.search-home :deep(.filter-control .el-select__wrapper) {
  min-height: 32px;
  border-radius: 10px;
}

.filter-actions-item :deep(.el-form-item__label) {
  color: transparent;
}

.filter-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  width: 100%;
}

.filter-advanced-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
}

.filter-advanced-toggle__dot {
  font-size: 12px;
  color: #2a9d8f;
}

.filter-form__advanced {
  padding: 8px 10px 0;
  margin-top: 2px;
  background: linear-gradient(180deg, rgb(248 250 252 / 92%), rgb(244 247 249 / 96%));
  border: 1px dashed #d8e0e6;
  border-radius: 14px;
}

.active-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  padding-top: 4px;
}

.active-filters__label {
  font-size: 12px;
  font-weight: 600;
  color: #556273;
}

.active-filters__tag {
  border-radius: 999px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 10px;
}

.summary-card {
  min-height: 74px;
  border: none;
  border-radius: 16px;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

:deep(.summary-card .el-card__body) {
  padding: 10px 12px;
}

.summary-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 16px 28px rgb(15 23 42 / 10%);
}

.summary-card__label {
  font-size: 12px;
  font-weight: 600;
  color: #546173;
}

.summary-card__value {
  margin-top: 6px;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.1;
  color: #18212f;
}

.summary-card__hint {
  margin-top: 4px;
  font-size: 11px;
  color: #66768a;
}

.summary-card--teal {
  background: linear-gradient(145deg, rgb(42 157 143 / 16%), rgb(42 157 143 / 6%));
}

.summary-card--slate {
  background: linear-gradient(145deg, rgb(38 70 83 / 14%), rgb(38 70 83 / 6%));
}

.summary-card--gold {
  background: linear-gradient(145deg, rgb(233 196 106 / 18%), rgb(233 196 106 / 8%));
}

.summary-card--amber {
  background: linear-gradient(145deg, rgb(244 162 97 / 16%), rgb(244 162 97 / 7%));
}

.summary-card--coral {
  background: linear-gradient(145deg, rgb(231 111 81 / 16%), rgb(231 111 81 / 7%));
}

.summary-card--steel {
  background: linear-gradient(145deg, rgb(141 153 174 / 18%), rgb(141 153 174 / 8%));
}

.result-panel {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  padding: 16px 16px 10px;
}

.result-panel__toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.result-panel__title,
.insight-toolbar__title,
.insight-right__title {
  font-size: 15px;
  font-weight: 700;
  color: #18212f;
}

.result-panel__desc,
.insight-toolbar__desc {
  margin-top: 4px;
  font-size: 12px;
  color: #66768a;
}

.result-toolbar-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.result-table-shell {
  flex: 1;
  min-height: 0;
}

.switch-group {
  display: inline-flex;
  gap: 6px;
  padding: 4px;
  background: #f4f7fa;
  border: 1px solid #dae2e8;
  border-radius: 999px;
}

.switch-group--compact {
  background: #fbfcfd;
}

.switch-chip {
  padding: 8px 14px;
  font-size: 12px;
  font-weight: 600;
  color: #556273;
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: 999px;
  transition: all 0.2s ease;
}

.switch-chip--compact {
  padding: 6px 12px;
}

.switch-chip--active {
  color: #18212f;
  background: #fff;
  box-shadow: 0 6px 16px rgb(15 23 42 / 9%);
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

.pagination-footer {
  position: fixed;
  bottom: 10px;
  left: 50%;
  z-index: 10;
  display: flex;
  justify-content: center;
  transform: translateX(-50%);
}

.insight-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.insight-toolbar__select {
  width: 360px;
}

.insight-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 240px;
}

.insight-layout {
  flex: 1;
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr);
  gap: 12px;
  min-height: 0;
}

.insight-left,
.insight-right {
  padding: 14px;
  overflow: auto;
  background: #fbfcfd;
  border: 1px solid #dde4ea;
  border-radius: 18px;
}

.insight-project {
  padding: 12px 14px;
  margin-bottom: 12px;
  background: linear-gradient(135deg, rgb(24 33 47 / 4%), rgb(42 157 143 / 10%));
  border: 1px solid rgb(42 157 143 / 14%);
  border-radius: 16px;
}

.insight-project__code {
  font-size: 20px;
  font-weight: 700;
  color: #18212f;
}

.insight-project__meta {
  margin-top: 4px;
  font-size: 12px;
  color: #5f6d7e;
}

.stage-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.stage-card {
  padding: 12px;
  background: #fff;
  border: 1px solid #e2e8ee;
  border-radius: 14px;
}

.stage-card--reserved {
  background: rgb(64 158 255 / 4%);
}

.stage-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}

.stage-card__title {
  font-size: 14px;
  font-weight: 700;
  color: #18212f;
}

.stage-card__summary {
  min-height: 38px;
  margin-bottom: 8px;
  font-size: 12px;
  line-height: 1.5;
  color: #5f6d7e;
}

.stage-card__meta {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.stage-card__meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 12px;
  color: #66768a;
}

.timeline-event-title {
  font-size: 13px;
  font-weight: 700;
  color: #18212f;
}

.timeline-event-meta {
  display: flex;
  gap: 8px;
  margin-top: 2px;
}

.timeline-event-date,
.timeline-event-detail {
  font-size: 12px;
  color: #66768a;
}

@media (width <= 1400px) {
  .summary-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (width >= 769px) {
  .comprehensive-query-page {
    height: calc(100vh - 84px);
    overflow: hidden;
  }

  .comprehensive-query-page--home {
    overflow: auto;
  }
}

@media (width <= 1200px) {
  .insight-layout {
    grid-template-columns: 1fr;
  }

  .stage-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (width <= 768px) {
  .comprehensive-query-page {
    padding: 10px;
  }

  .search-home,
  .query-hero,
  .query-panel,
  .result-panel {
    padding-right: 14px;
    padding-left: 14px;
  }

  .search-home {
    padding-top: 24px;
    padding-bottom: 24px;
  }

  .search-home__title {
    font-size: 30px;
  }

  .search-home__desc {
    font-size: 13px;
  }

  .search-home__bar {
    flex-direction: column;
    align-items: stretch;
  }

  .search-home__select {
    width: 100%;
  }

  .search-home__advanced {
    padding: 14px 12px 6px;
  }

  .query-hero {
    flex-direction: column;
    align-items: flex-start;
  }

  .query-hero__side {
    flex-direction: column-reverse;
    align-items: stretch;
    width: 100%;
  }

  .query-hero__title-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .query-hero__meta {
    width: 100%;
    text-align: left;
  }

  .query-panel__head,
  .result-panel__toolbar,
  .insight-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .query-hero__quick-actions,
  .result-toolbar-actions {
    justify-content: flex-start;
  }

  .filter-actions {
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .summary-grid {
    grid-template-columns: 1fr;
  }

  .insight-toolbar__select {
    width: 100%;
  }

  .stage-grid {
    grid-template-columns: 1fr;
  }

  .result-panel {
    min-height: auto;
  }

  .pagination-footer--mobile {
    position: static;
    left: auto;
    margin-top: 10px;
    transform: none;
  }
}
</style>
