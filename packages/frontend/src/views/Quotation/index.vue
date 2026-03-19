<template>
  <div class="quotation-page p-4 space-y-4">
    <div v-if="isMobile" class="mobile-top-bar">
      <div class="mobile-top-bar-left">
        <el-button text type="primary" @click="showMobileFilters = !showMobileFilters">
          {{ showMobileFilters ? '收起筛选' : '展开筛选' }}
        </el-button>
      </div>
      <div class="view-mode-switch">
        <span class="view-mode-switch__label">视图</span>
        <el-radio-group v-model="viewMode" size="small">
          <el-radio-button value="card">卡片</el-radio-button>
          <el-radio-button value="table">表格</el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <!-- 查询表单 -->
    <section
      class="qt-search-shell"
      :class="{ 'qt-search-shell--mobile': isMobile }"
      v-show="!isMobile || showMobileFilters"
    >
      <el-form
        :model="queryForm"
        :inline="!isMobile"
        :label-width="isMobile ? 'auto' : '90px'"
        :label-position="isMobile ? 'top' : 'right'"
        class="query-form"
        :class="{ 'query-form--mobile': isMobile }"
      >
        <el-form-item label="模糊查询">
          <el-input
            v-model="queryForm.keyword"
            placeholder="请输入报价单号 / 客户名称 / 更改通知单号 / 模具编号 / 加工零件名称"
            clearable
            :style="{ width: isMobile ? '100%' : '220px' }"
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item label="报价类型">
          <el-select
            v-model="queryForm.quotationType"
            placeholder="请选择报价类型"
            clearable
            :style="{ width: isMobile ? '100%' : '160px' }"
          >
            <el-option label="改模报价单" value="mold" />
            <el-option label="零件报价单" value="part" />
          </el-select>
        </el-form-item>
        <el-form-item label="立项状态">
          <el-select
            v-model="queryForm.initiationStatus"
            placeholder="请选择立项状态"
            clearable
            :style="{ width: isMobile ? '100%' : '160px' }"
          >
            <el-option
              v-for="status in initiationStatusOptions"
              :key="status"
              :label="status"
              :value="status"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="最终项目编号" label-width="110px">
          <el-input
            v-model="queryForm.finalProjectCode"
            placeholder="请输入最终项目编号"
            clearable
            :style="{ width: isMobile ? '100%' : '180px' }"
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item class="query-form__actions">
          <div class="query-actions">
            <el-button type="primary" @click="handleSearch">查询</el-button>
            <el-button @click="handleReset">重置</el-button>
            <el-button type="success" @click="handleCreate()">新增报价单</el-button>
          </div>
        </el-form-item>
      </el-form>
    </section>

    <!-- 报价单列表 -->
    <!-- 手机端卡片视图 -->
    <div v-if="isMobile && viewMode === 'card'" class="qt-mobile-list" v-loading="loading">
      <el-empty v-if="!quotations.length && !loading" description="暂无报价单" />
      <template v-else>
        <el-card v-for="row in pagedQuotations" :key="row.id" class="qt-mobile-card" shadow="hover">
          <div class="qt-mobile-card__header">
            <div>
              <div class="qt-mobile-card__quotation-no">
                报价单号：{{ row.quotationNo || '-' }}
              </div>
              <div class="qt-mobile-card__date">
                报价日期：{{ formatDate(row.quotationDate) || '-' }}
              </div>
              <div class="qt-mobile-card__customer">{{ row.customerName || '-' }}</div>
              <div class="qt-mobile-card__type">
                <el-tag :type="row.quotationType === 'part' ? 'success' : 'primary'" size="small">
                  {{ formatQuotationType(row.quotationType) }}
                </el-tag>
              </div>
            </div>
          </div>
          <div class="qt-mobile-card__meta">
            <div>
              <span class="label">更改通知单号</span>
              <span class="value">{{ row.changeOrderNo || '-' }}</span>
            </div>
            <div>
              <span class="label">立项状态</span>
              <span class="value">{{ row.initiationStatus || '未发起' }}</span>
            </div>
            <div>
              <span class="label">最终项目编号</span>
              <span class="value">{{ getFinalProjectCodeDisplay(row) }}</span>
            </div>
            <div>
              <span class="label">销售订单号</span>
              <span class="value">{{ row.salesOrderNo || '-' }}</span>
            </div>
            <div>
              <span class="label">模具编号</span>
              <span class="value">{{ row.moldNo || '-' }}</span>
            </div>
            <div>
              <span class="label">加工零件名称</span>
              <span class="value">{{ row.partName || '-' }}</span>
            </div>
            <div>
              <span class="label">经办人</span>
              <span class="value">{{ row.operator || '-' }}</span>
            </div>
          </div>
          <div class="qt-mobile-card__stats">
            <div class="stat">
              <div class="stat-label">加工数量</div>
              <div class="stat-value">{{ row.quantity || 0 }}</div>
            </div>
            <div class="stat">
              <div class="stat-label">含税价格(元)</div>
              <div class="stat-value">{{ formatAmount(calcTaxIncludedPrice(row)) }}</div>
            </div>
          </div>
          <div class="qt-mobile-card__actions">
            <el-button
              v-if="getPrimaryInitiationAction(row)"
              :type="getPrimaryInitiationAction(row)?.type"
              :plain="Boolean(getPrimaryInitiationAction(row)?.plain)"
              size="small"
              @click="handlePrimaryInitiationAction(row)"
            >
              {{ getPrimaryInitiationAction(row)?.label }}
            </el-button>
            <el-button type="success" size="small" @click="handleView(row)">查看报价单</el-button>
            <el-dropdown
              v-if="getSecondaryActions(row).length"
              trigger="click"
              popper-class="quotation-action-menu"
              @command="(key) => handleActionCommand(key, row)"
            >
              <el-button size="small">更多</el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item
                    v-for="action in getSecondaryActions(row)"
                    :key="action.key"
                    :command="action.key"
                    :divided="Boolean(action.divided)"
                    :class="{ 'is-danger': action.danger }"
                  >
                    {{ action.label }}
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </el-card>
      </template>
    </div>

    <!-- PC端表格视图 / 手机端表格视图 -->
    <div
      v-else-if="viewMode === 'table'"
      class="qt-table-wrapper"
      :class="{ 'qt-table-wrapper--mobile': isMobile }"
    >
      <el-table
        v-if="quotations.length"
        v-loading="loading"
        :data="pagedQuotations"
        border
        :height="isMobile ? undefined : 'calc(100vh - 280px)'"
        class="qt-table"
        row-key="id"
        @row-dblclick="handleRowDblClick"
        @sort-change="handleSortChange"
      >
        <el-table-column type="index" label="序号" width="60" align="center" />
        <el-table-column
          prop="quotationNo"
          label="报价单号"
          min-width="150"
          show-overflow-tooltip
        />
        <el-table-column prop="quotationDate" label="报价日期" width="120" show-overflow-tooltip>
          <template #default="{ row }">
            {{ formatDate(row.quotationDate) }}
          </template>
        </el-table-column>
        <el-table-column
          prop="quotationType"
          label="报价类型"
          width="110"
          align="center"
          sortable="custom"
        >
          <template #default="{ row }">
            <el-tag :type="row.quotationType === 'part' ? 'success' : 'primary'" size="small">
              {{ formatQuotationType(row.quotationType) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          prop="customerName"
          label="客户名称"
          min-width="180"
          show-overflow-tooltip
          sortable="custom"
        />
        <el-table-column prop="initiationStatus" label="立项状态" width="110" align="center">
          <template #default="{ row }">
            <el-tag
              size="small"
              :type="
                row.initiationStatus === '已通过'
                  ? 'success'
                  : row.initiationStatus === '审核中'
                    ? 'warning'
                    : row.initiationStatus === '已驳回'
                      ? 'danger'
                      : 'info'
              "
            >
              {{ row.initiationStatus || '未发起' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          prop="finalProjectCode"
          label="最终项目编号"
          min-width="150"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            {{ getFinalProjectCodeDisplay(row) }}
          </template>
        </el-table-column>
        <el-table-column
          prop="salesOrderNo"
          label="销售订单号"
          min-width="150"
          show-overflow-tooltip
        />
        <el-table-column
          prop="changeOrderNo"
          label="更改通知单号"
          min-width="140"
          show-overflow-tooltip
        />
        <el-table-column
          prop="partName"
          label="加工零件名称"
          min-width="160"
          show-overflow-tooltip
        />
        <el-table-column prop="moldNo" label="模具编号" min-width="140" show-overflow-tooltip />
        <el-table-column
          prop="operator"
          label="经办人"
          width="120"
          show-overflow-tooltip
          sortable="custom"
        />
        <el-table-column prop="taxIncludedPrice" label="含税价格" width="120" align="right">
          <template #default="{ row }">
            {{ formatAmount(calcTaxIncludedPrice(row)) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="280" fixed="right" align="center">
          <template #default="{ row }">
            <div class="operation-buttons">
              <el-button
                v-if="getPrimaryInitiationAction(row)"
                :type="getPrimaryInitiationAction(row)?.type"
                :plain="Boolean(getPrimaryInitiationAction(row)?.plain)"
                size="small"
                @click="handlePrimaryInitiationAction(row)"
              >
                {{ getPrimaryInitiationAction(row)?.label }}
              </el-button>
              <el-button type="success" size="small" @click="handleView(row)">查看报价单</el-button>
              <el-dropdown
                v-if="getSecondaryActions(row).length"
                trigger="click"
                popper-class="quotation-action-menu"
                @command="(key) => handleActionCommand(key, row)"
              >
                <el-button size="small">更多</el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item
                      v-for="action in getSecondaryActions(row)"
                      :key="action.key"
                      :command="action.key"
                      :divided="Boolean(action.divided)"
                      :class="{ 'is-danger': action.danger }"
                    >
                      {{ action.label }}
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 分页 -->
    <div
      v-if="quotations.length"
      class="pagination-footer"
      :class="{ 'pagination-footer--mobile': isMobile || viewMode === 'card' }"
    >
      <el-pagination
        background
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :total="total"
        :layout="paginationLayout"
        :pager-count="paginationPagerCount"
        :page-sizes="[10, 20, 50]"
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
      />
    </div>

    <!-- 空状态 -->
    <el-empty
      v-if="!quotations.length && !loading && (viewMode === 'table' || !isMobile)"
      description="暂无报价单"
      class="rounded-lg bg-[var(--el-bg-color-overlay)] py-16"
      :image-size="180"
    />

    <el-dialog
      v-model="initiationDialogVisible"
      :title="isInitiationViewMode ? '查看立项' : '报价单立项'"
      :width="isMobile ? '98%' : '1330px'"
      :fullscreen="isMobile"
      destroy-on-close
      class="qt-initiation-dialog"
    >
      <div v-loading="initiationDialogLoading" class="qt-initiation-dialog__content space-y-4">
        <el-descriptions
          :column="isMobile ? 1 : 5"
          border
          size="small"
          title="基础信息"
          class="initiation-basic-descriptions"
        >
          <el-descriptions-item label="报价单号">{{
            initiationSourceQuotation?.quotationNo || '-'
          }}</el-descriptions-item>
          <el-descriptions-item label="报价类型">{{
            formatQuotationType(initiationSourceQuotation?.quotationType)
          }}</el-descriptions-item>
          <el-descriptions-item label="立项状态">{{
            initiationRequestRow?.status_text ||
            initiationSourceQuotation?.initiationStatus ||
            '未发起'
          }}</el-descriptions-item>
          <el-descriptions-item label="最终项目编号">{{
            getInitiationFinalProjectCodeDisplay()
          }}</el-descriptions-item>
          <el-descriptions-item label="销售订单号">{{
            initiationRequestRow?.sales_order_no || initiationSourceQuotation?.salesOrderNo || '-'
          }}</el-descriptions-item>
          <el-descriptions-item label="申请人">{{
            initiationRequestRow?.created_by || '-'
          }}</el-descriptions-item>
          <el-descriptions-item label="审核人">{{
            initiationRequestRow?.approved_by || '-'
          }}</el-descriptions-item>
          <el-descriptions-item label="立项审核驳回原因" :span="isMobile ? 1 : 2">{{
            initiationRequestRow?.initiation_rejected_reason || '-'
          }}</el-descriptions-item>
          <el-descriptions-item label="客户审核驳回原因" :span="isMobile ? 1 : 2">{{
            initiationRequestRow?.customer_review_rejected_reason || '-'
          }}</el-descriptions-item>
          <el-descriptions-item label="撤回原因" :span="isMobile ? 1 : 2">{{
            initiationRequestRow?.withdraw_reason || '-'
          }}</el-descriptions-item>
          <el-descriptions-item label="草稿保存时间">{{
            formatDate(initiationRequestRow?.draft_saved_at)
          }}</el-descriptions-item>
          <el-descriptions-item label="提交审核时间">{{
            formatDate(initiationRequestRow?.submitted_at)
          }}</el-descriptions-item>
          <el-descriptions-item label="审核通过时间">{{
            formatDate(initiationRequestRow?.approved_at)
          }}</el-descriptions-item>
          <el-descriptions-item label="驳回时间">{{
            formatDate(initiationRequestRow?.rejected_at)
          }}</el-descriptions-item>
          <el-descriptions-item label="撤回时间">{{
            formatDate(initiationRequestRow?.withdrawn_at)
          }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{
            formatDate(initiationRequestRow?.created_at)
          }}</el-descriptions-item>
          <el-descriptions-item label="更新时间">{{
            formatDate(initiationRequestRow?.updated_at)
          }}</el-descriptions-item>
        </el-descriptions>

        <el-card shadow="never">
          <template #header>
            <div class="qt-initiation-card-header">
              <span>项目信息</span>
              <div class="qt-initiation-card-header__actions">
                <div class="qt-initiation-card-header__meta">
                  <span class="qt-initiation-card-header__label">客户名称</span>
                  <el-input
                    v-model="initiationForm.customerName"
                    class="qt-initiation-card-header__customer"
                    size="small"
                    :disabled="isInitiationViewMode || initiationCustomerLocked"
                    placeholder="请输入客户名称"
                    @blur="handleInitiationCustomerBlur"
                  />
                </div>
                <div
                  class="qt-initiation-card-header__meta qt-initiation-card-header__meta--status"
                >
                  <span class="qt-initiation-card-header__label">客户状态</span>
                  <el-tag size="small" :type="initiationCustomerMatched ? 'success' : 'warning'">
                    {{ initiationCustomerMatched ? '已匹配并锁定' : '未匹配客户档案' }}
                  </el-tag>
                </div>
                <el-button
                  v-if="!isInitiationViewMode"
                  type="primary"
                  link
                  :loading="initiationRecommendingCode"
                  @click="recommendInitiationProjectCode"
                >
                  推荐项目编号
                </el-button>
              </div>
            </div>
          </template>
          <el-form :inline="false" label-width="100px">
            <el-row :gutter="12">
              <el-col
                v-if="
                  resolveBusinessCategory(initiationSourceQuotation?.quotationType) !== '零件加工'
                "
                :xs="24"
                :md="8"
              >
                <el-form-item
                  label="项目编号"
                  :required="
                    resolveBusinessCategory(initiationSourceQuotation?.quotationType) !== '零件加工'
                  "
                >
                  <el-input
                    v-model="initiationForm.projectCode"
                    :disabled="isInitiationViewMode"
                    placeholder="请输入项目编号"
                    @blur="handleInitiationProjectCodeBlur"
                  />
                  <div
                    v-if="initiationProjectCodeError"
                    class="mt-1 text-xs text-[var(--el-color-danger)]"
                  >
                    {{ initiationProjectCodeError }}
                  </div>
                </el-form-item>
              </el-col>
              <template
                v-if="
                  resolveBusinessCategory(initiationSourceQuotation?.quotationType) === '零件加工'
                "
              >
                <el-col :xs="24">
                  <div
                    v-if="initiationDuplicateProjectCodeError"
                    class="mb-2 text-xs text-[var(--el-color-danger)]"
                  >
                    {{ initiationDuplicateProjectCodeError }}
                  </div>
                  <div
                    v-if="initiationProjectCodeFormatError"
                    class="mb-2 text-xs text-[var(--el-color-danger)]"
                  >
                    {{ initiationProjectCodeFormatError }}
                  </div>
                  <el-table
                    :data="initiationProjectDetails"
                    border
                    size="small"
                    class="mt-1"
                    empty-text="暂无项目信息"
                  >
                    <el-table-column label="序号" type="index" width="70" align="center" />
                    <el-table-column label="项目编号" min-width="180">
                      <template #default="{ row }">
                        <el-input
                          v-model="row.projectCode"
                          :disabled="isInitiationViewMode"
                          placeholder="请输入项目编号"
                        />
                      </template>
                    </el-table-column>
                    <el-table-column label="产品名称" min-width="180">
                      <template #default="{ row }">
                        <el-input
                          v-model="row.productName"
                          :disabled="isInitiationViewMode"
                          placeholder="请输入产品名称"
                        />
                      </template>
                    </el-table-column>
                    <el-table-column label="产品图号" min-width="160">
                      <template #default="{ row }">
                        <el-input
                          v-model="row.productDrawing"
                          :disabled="isInitiationViewMode"
                          placeholder="请输入产品图号"
                        />
                      </template>
                    </el-table-column>
                    <el-table-column label="客户模号" min-width="180">
                      <template #default="{ row }">
                        <el-input
                          v-model="row.customerModelNo"
                          :disabled="isInitiationViewMode"
                          placeholder="请输入客户模号"
                        />
                      </template>
                    </el-table-column>
                    <el-table-column
                      v-if="!isInitiationViewMode"
                      label="操作"
                      width="90"
                      fixed="right"
                    >
                      <template #default="{ $index }">
                        <el-button type="danger" link @click="removeInitiationProjectDetail($index)"
                          >删除</el-button
                        >
                      </template>
                    </el-table-column>
                  </el-table>
                </el-col>
              </template>
              <template v-else>
                <el-col :xs="24" :md="8">
                  <el-form-item label="产品名称">
                    <el-input
                      v-model="initiationForm.productName"
                      :disabled="isInitiationViewMode"
                      placeholder="可为空"
                    />
                  </el-form-item>
                </el-col>
                <el-col :xs="24" :md="8">
                  <el-form-item label="产品图号">
                    <el-input
                      v-model="initiationForm.productDrawing"
                      :disabled="isInitiationViewMode"
                      placeholder="可为空"
                    />
                  </el-form-item>
                </el-col>
                <el-col :xs="24" :md="8">
                  <el-form-item label="客户模号">
                    <el-input
                      v-model="initiationForm.customerModelNo"
                      :disabled="isInitiationViewMode"
                      placeholder="可为空"
                    />
                  </el-form-item>
                </el-col>
              </template>
            </el-row>
          </el-form>
        </el-card>

        <el-card shadow="never">
          <template #header>
            <div class="qt-initiation-card-header">
              <span>销售订单</span>
              <div class="qt-initiation-card-header__actions">
                <div class="qt-initiation-card-header__meta">
                  <span class="qt-initiation-card-header__label">订单日期</span>
                  <el-date-picker
                    v-model="initiationSalesForm.orderDate"
                    class="qt-initiation-card-header__date"
                    type="date"
                    value-format="YYYY-MM-DD"
                    size="small"
                    :disabled="isInitiationViewMode"
                    placeholder="请选择订单日期"
                  />
                </div>
                <div class="qt-initiation-card-header__meta">
                  <span class="qt-initiation-card-header__label">签订日期</span>
                  <el-date-picker
                    v-model="initiationSalesForm.signDate"
                    class="qt-initiation-card-header__date"
                    type="date"
                    value-format="YYYY-MM-DD"
                    size="small"
                    :disabled="isInitiationViewMode"
                    placeholder="可为空"
                  />
                </div>
                <div class="qt-initiation-card-header__meta">
                  <span class="qt-initiation-card-header__label">合同号</span>
                  <el-input
                    v-model="initiationSalesForm.contractNo"
                    class="qt-initiation-card-header__contract"
                    size="small"
                    :disabled="isInitiationViewMode"
                    placeholder="可为空"
                  />
                </div>
                <el-button
                  v-if="!isInitiationViewMode"
                  type="primary"
                  plain
                  size="small"
                  @click="addInitiationDetail"
                  >新增明细</el-button
                >
              </div>
            </div>
          </template>
          <el-table :data="initiationSalesForm.details" border size="small">
            <el-table-column type="index" label="序号" width="60" align="center" />
            <el-table-column label="项目编号" min-width="140">
              <template #default="{ row }">
                <el-input
                  v-model="row.itemCode"
                  :disabled="
                    isInitiationViewMode ||
                    resolveBusinessCategory(initiationSourceQuotation?.quotationType) === '零件加工'
                  "
                  placeholder="请输入项目编号"
                />
              </template>
            </el-table-column>
            <el-table-column label="产品名称" min-width="140">
              <template #default="{ row }">
                <el-input
                  v-model="row.productName"
                  :disabled="
                    isInitiationViewMode ||
                    resolveBusinessCategory(initiationSourceQuotation?.quotationType) === '零件加工'
                  "
                  placeholder="请输入产品名称"
                />
              </template>
            </el-table-column>
            <el-table-column label="产品图号" min-width="120">
              <template #default="{ row }">
                <el-input
                  v-model="row.productDrawingNo"
                  :disabled="
                    isInitiationViewMode ||
                    resolveBusinessCategory(initiationSourceQuotation?.quotationType) === '零件加工'
                  "
                  placeholder="请输入产品图号"
                />
              </template>
            </el-table-column>
            <el-table-column label="客户模号" min-width="120">
              <template #default="{ row }">
                <el-input
                  v-model="row.customerPartNo"
                  :disabled="
                    isInitiationViewMode ||
                    resolveBusinessCategory(initiationSourceQuotation?.quotationType) === '零件加工'
                  "
                  placeholder="请输入客户模号"
                />
              </template>
            </el-table-column>
            <el-table-column label="数量" width="70">
              <template #default="{ row }">
                <el-input-number
                  v-model="row.quantity"
                  :disabled="isInitiationViewMode"
                  :min="0"
                  :precision="0"
                  :controls="false"
                  style="width: 100%"
                  @change="recalcInitiationDetailTotal(row)"
                />
              </template>
            </el-table-column>
            <el-table-column label="单价(元)" width="100">
              <template #default="{ row }">
                <el-input-number
                  v-model="row.unitPrice"
                  :disabled="isInitiationViewMode"
                  :min="0"
                  :precision="2"
                  :controls="false"
                  style="width: 100%"
                  @change="recalcInitiationDetailTotal(row)"
                />
              </template>
            </el-table-column>
            <el-table-column label="金额(元)" width="90">
              <template #default="{ row }">
                <span>{{ formatAmount(row.totalAmount) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="交付日期" width="150">
              <template #default="{ row }">
                <el-date-picker
                  v-model="row.deliveryDate"
                  type="date"
                  value-format="YYYY-MM-DD"
                  :disabled="isInitiationViewMode"
                  placeholder="请选择交付日期"
                  style="width: 100%"
                />
              </template>
            </el-table-column>
            <el-table-column label="备注" min-width="140">
              <template #default="{ row }">
                <el-input
                  v-model="row.remark"
                  :disabled="isInitiationViewMode"
                  placeholder="选填"
                />
              </template>
            </el-table-column>
            <el-table-column label="费用出处" min-width="120">
              <template #default="{ row }">
                <el-input
                  v-model="row.costSource"
                  :disabled="isInitiationViewMode"
                  placeholder="选填"
                />
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </div>

      <template #footer>
        <el-button @click="initiationDialogVisible = false">关闭</el-button>
        <el-button
          v-if="canShowCustomerReviewAction"
          type="warning"
          :loading="initiationRequestingCustomerReview"
          @click="requestCustomerReview"
        >
          发起新增客户名称审核申请
        </el-button>
        <el-button
          v-if="!isInitiationViewMode"
          type="primary"
          plain
          :loading="initiationDialogSaving"
          @click="saveInitiationDraft"
        >
          保存草稿
        </el-button>
        <el-button
          v-if="!isInitiationViewMode"
          type="primary"
          :loading="initiationDialogSubmitting"
          @click="submitInitiationReview"
        >
          提交审核
        </el-button>
      </template>
    </el-dialog>

    <!-- 新增报价单：选择弹窗（报价单号 / 报价日期 / 客户名称） -->
    <el-dialog
      v-model="preCreateDialogVisible"
      :title="selectedPreCreateTypeMeta.dialogTitle"
      :width="isMobile ? '100%' : '820px'"
      :fullscreen="isMobile"
      :close-on-click-modal="false"
      class="qt-create-dialog"
    >
      <div class="qt-create-dialog__hero">
        <div>
          <div class="qt-create-dialog__eyebrow">Create New Quotation</div>
          <div class="qt-create-dialog__title">{{ selectedPreCreateTypeMeta.title }}</div>
          <div class="qt-create-dialog__description">{{
            selectedPreCreateTypeMeta.description
          }}</div>
        </div>
        <el-tag :type="preCreateForm.quotationType === 'part' ? 'success' : 'warning'" round>
          {{ selectedPreCreateTypeMeta.badge }}
        </el-tag>
      </div>

      <div class="qt-create-type-grid">
        <label
          v-for="option in preCreateTypeOptions"
          :key="option.value"
          class="qt-create-type-card"
          :class="{
            'qt-create-type-card--active': preCreateForm.quotationType === option.value,
            'qt-create-type-card--part': option.value === 'part'
          }"
        >
          <input v-model="preCreateForm.quotationType" type="radio" :value="option.value" />
          <span class="qt-create-type-card__title">{{ option.title }}</span>
          <span class="qt-create-type-card__desc">{{ option.description }}</span>
          <span class="qt-create-type-card__foot">{{ option.footnote }}</span>
        </label>
      </div>

      <el-form
        ref="preCreateFormRef"
        :model="preCreateForm"
        :rules="preCreateRules"
        :label-width="isMobile ? 'auto' : '110px'"
        :label-position="isMobile ? 'top' : 'right'"
        class="qt-create-form"
      >
        <el-form-item label="报价类型" prop="quotationType">
          <el-tag :type="preCreateForm.quotationType === 'part' ? 'success' : 'warning'">
            {{ selectedPreCreateTypeMeta.title }}
          </el-tag>
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="isMobile ? 24 : 14">
            <el-form-item label="报价单号" prop="quotationNo">
              <el-input v-model="preCreateForm.quotationNo" disabled placeholder="自动生成" />
            </el-form-item>
          </el-col>
          <el-col :span="isMobile ? 24 : 10">
            <el-form-item label="报价日期" prop="quotationDate">
              <el-date-picker
                v-model="preCreateForm.quotationDate"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="请选择报价日期"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="客户名称" prop="customerName">
          <el-select
            v-model="preCreateForm.customerName"
            placeholder="请选择客户名称"
            filterable
            allow-create
            default-first-option
            clearable
            :loading="customerLoading"
            style="width: 100%"
          >
            <el-option
              v-for="customer in customerList"
              :key="customer.id"
              :label="customer.customerName"
              :value="customer.customerName"
            />
          </el-select>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="preCreateDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleConfirmPreCreate">确定</el-button>
      </template>
    </el-dialog>

    <!-- 报价单编辑/查看对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :width="isMobile ? '100%' : '1130px'"
      :fullscreen="isMobile"
      :class="[
        'qt-edit-dialog',
        {
          'qt-edit-dialog--part': quotationForm.quotationType === 'part',
          'qt-edit-dialog--mold': quotationForm.quotationType === 'mold'
        }
      ]"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :show-close="false"
    >
      <template #header>
        <div class="qt-dialog-header">
          <span class="qt-dialog-header__title"></span>
        </div>
      </template>
      <el-form
        ref="formRef"
        :model="quotationForm"
        :rules="formRules"
        label-width="0"
        class="quotation-form"
      >
        <!-- 顶部字段：报价单号、报价日期、客户名称 -->
        <div class="quotation-top-fields">
          <template v-if="quotationForm.quotationType === 'part'">
            <div class="quotation-top-part">
              <div class="quotation-top-part__row">
                <el-form-item
                  prop="customerName"
                  class="quotation-top-field quotation-top-field--inline quotation-top-part__customer"
                  :show-message="false"
                >
                  <span class="field-required">*</span>
                  <span class="field-label-inline">客户名称：</span>
                  <el-select
                    v-model="quotationForm.customerName"
                    placeholder="请选择客户名称"
                    :disabled="isViewMode || dialogMode === 'create'"
                    filterable
                    clearable
                    :loading="customerLoading"
                    class="field-input-inline field-input-customer-name"
                  >
                    <el-option
                      v-for="customer in customerList"
                      :key="customer.id"
                      :label="customer.customerName"
                      :value="customer.customerName"
                    />
                  </el-select>
                </el-form-item>

                <el-form-item class="quotation-top-field quotation-top-field--inline">
                  <span class="field-label-inline">来源项目编号：</span>
                  <el-input
                    v-model="quotationForm.sourceProjectCode"
                    :disabled="isViewMode"
                    placeholder="来源项目编号"
                    class="field-input-inline field-input-contact"
                  />
                </el-form-item>
              </div>

              <div class="quotation-top-part__row quotation-top-part__row--inline-fields">
                <el-form-item
                  prop="quotationNo"
                  class="quotation-top-field quotation-top-field--inline"
                >
                  <span class="field-label-inline">报价单号：</span>
                  <el-input
                    v-model="quotationForm.quotationNo"
                    :disabled="true"
                    placeholder="报价单号"
                    class="field-input-inline field-input-quotation-no"
                  />
                </el-form-item>

                <el-form-item
                  prop="quotationDate"
                  class="quotation-top-field quotation-top-field--inline"
                  :show-message="false"
                >
                  <span class="field-label-inline">报价日期：</span>
                  <el-date-picker
                    v-model="quotationForm.quotationDate"
                    type="date"
                    value-format="YYYY-MM-DD"
                    placeholder="请选择报价日期"
                    :disabled="isViewMode"
                    clearable
                    class="field-input-inline field-input-quotation-date"
                    style="width: 140px !important"
                  />
                </el-form-item>

                <el-form-item
                  v-if="quotationForm.quotationType === 'part'"
                  class="quotation-top-field quotation-top-field--inline"
                >
                  <span class="field-label-inline">联系人：</span>
                  <el-input
                    v-model="quotationForm.contactName"
                    :disabled="isViewMode"
                    placeholder="联系人"
                    class="field-input-inline field-input-contact"
                  />
                </el-form-item>

                <el-form-item
                  v-if="quotationForm.quotationType === 'part'"
                  class="quotation-top-field quotation-top-field--inline"
                >
                  <span class="field-label-inline">联系电话：</span>
                  <el-input
                    v-model="quotationForm.contactPhone"
                    :disabled="isViewMode"
                    placeholder="联系电话"
                    class="field-input-inline field-input-contact"
                  />
                </el-form-item>
              </div>

              <div class="quotation-top-part__row quotation-top-part__row--inline-fields">
                <el-form-item class="quotation-top-field quotation-top-field--inline">
                  <span class="field-label-inline">经办人：</span>
                  <el-input
                    v-model="quotationForm.operator"
                    :disabled="isViewMode"
                    placeholder="经办人"
                    class="field-input-inline field-input-contact"
                  />
                </el-form-item>
              </div>
            </div>
          </template>

          <template v-else>
            <div class="qm-topbar">
              <div class="qm-topbar__intro">
                <div class="qm-topbar__header">
                  <div>
                    <div class="qm-topbar__eyebrow">Mold Change Workspace</div>
                    <div class="qm-topbar__title-row">
                      <h3 class="qm-topbar__title">
                        {{
                          isViewMode
                            ? '查看改模报价单'
                            : dialogMode === 'edit'
                              ? '编辑改模报价单'
                              : '新建改模报价单'
                        }}
                      </h3>
                      <el-tag type="warning" effect="dark" round>修改模具</el-tag>
                    </div>
                  </div>
                  <div class="qm-action-cluster qm-action-cluster--inline">
                    <el-button size="small" @click="handleCancelQuotationDialog">取消</el-button>
                    <el-button v-if="!isViewMode" size="small" type="primary" @click="handleSubmit"
                      >保存</el-button
                    >
                    <el-button
                      v-if="!isViewMode"
                      size="small"
                      type="primary"
                      plain
                      :loading="importingProject"
                      :disabled="importingProject"
                      @click="handleImportFromProject"
                    >
                      项目代入
                    </el-button>
                    <el-button
                      v-if="isViewMode && quotationForm.id"
                      size="small"
                      type="success"
                      :loading="downloading"
                      :disabled="downloading"
                      @click="handleDownloadQuotationPdf"
                    >
                      {{ downloading ? '正在生成 PDF...' : '报价单下载' }}
                    </el-button>
                    <el-button
                      v-if="isViewMode && quotationForm.id"
                      size="small"
                      type="primary"
                      :loading="downloading"
                      :disabled="downloading"
                      @click="handleDownloadCompletionPdf"
                    >
                      完工单下载
                    </el-button>
                  </div>
                </div>

                <div class="qm-topbar__meta-grid">
                  <div class="qm-meta-card qm-meta-card--customer">
                    <div class="qm-meta-card__label">客户名称</div>
                    <el-form-item
                      prop="customerName"
                      class="qm-meta-card__field"
                      :show-message="false"
                    >
                      <el-select
                        v-model="quotationForm.customerName"
                        placeholder="请选择客户名称"
                        :disabled="isViewMode || dialogMode === 'create'"
                        filterable
                        clearable
                        :loading="customerLoading"
                      >
                        <el-option
                          v-for="customer in customerList"
                          :key="customer.id"
                          :label="customer.customerName"
                          :value="customer.customerName"
                        />
                      </el-select>
                    </el-form-item>
                  </div>

                  <div class="qm-meta-card qm-meta-card--project">
                    <div class="qm-meta-card__label">来源项目编号</div>
                    <div class="qm-meta-card__field">
                      <el-input
                        v-model="quotationForm.sourceProjectCode"
                        :disabled="isViewMode"
                        placeholder="来源项目编号"
                      />
                    </div>
                  </div>

                  <div class="qm-meta-card qm-meta-card--quotation-no">
                    <div class="qm-meta-card__label">报价单号</div>
                    <div class="qm-meta-card__field">
                      <el-input v-model="quotationForm.quotationNo" :disabled="true" />
                    </div>
                  </div>

                  <div class="qm-meta-card qm-meta-card--half">
                    <div class="qm-meta-card__label">报价日期</div>
                    <el-form-item
                      prop="quotationDate"
                      class="qm-meta-card__field"
                      :show-message="false"
                    >
                      <el-date-picker
                        v-model="quotationForm.quotationDate"
                        type="date"
                        value-format="YYYY-MM-DD"
                        placeholder="请选择报价日期"
                        :disabled="isViewMode"
                        clearable
                        style="width: 100%"
                      />
                    </el-form-item>
                  </div>

                  <div class="qm-meta-card qm-meta-card--half">
                    <div class="qm-meta-card__label">经办人</div>
                    <div class="qm-meta-card__field">
                      <el-input
                        v-model="quotationForm.operator"
                        :disabled="isViewMode"
                        placeholder="经办人"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>
          <!-- 操作按钮 -->
          <div v-if="quotationForm.quotationType === 'part'" class="qt-dialog-actions">
            <el-button size="small" @click="handleCancelQuotationDialog">取消</el-button>
            <el-button v-if="!isViewMode" size="small" type="primary" @click="handleSubmit">
              保存
            </el-button>
            <el-button
              v-if="!isViewMode && quotationForm.quotationType !== 'part'"
              size="small"
              type="primary"
              plain
              :loading="importingProject"
              :disabled="importingProject"
              @click="handleImportFromProject"
            >
              项目代入
            </el-button>
            <el-button
              v-if="isViewMode && quotationForm.id"
              size="small"
              type="success"
              :loading="downloading"
              :disabled="downloading"
              @click="handleDownloadQuotationPdf"
            >
              {{ downloading ? '正在生成 PDF...' : '报价单下载' }}
            </el-button>
            <el-button
              v-if="isViewMode && quotationForm.id && quotationForm.quotationType !== 'part'"
              size="small"
              type="primary"
              :loading="downloading"
              :disabled="downloading"
              @click="handleDownloadCompletionPdf"
            >
              完工单下载
            </el-button>
          </div>
        </div>

        <div v-if="quotationForm.quotationType === 'mold'" class="quotation-sheet qm-sheet">
          <section class="qm-grid qm-grid--intro">
            <div class="qm-panel">
              <div class="qm-panel__header">
                <div>
                  <div class="qm-panel__eyebrow">Change Info</div>
                  <div class="qm-panel__title">变更信息与申请备注</div>
                </div>
              </div>
              <div class="qm-fields">
                <div class="qm-field qm-field--half">
                  <div class="qm-field__label">加工日期</div>
                  <el-date-picker
                    v-model="quotationForm.processingDate"
                    type="date"
                    value-format="YYYY-MM-DD"
                    placeholder="请选择加工日期"
                    :disabled="isViewMode"
                    style="width: 100%"
                  />
                </div>
                <div class="qm-field qm-field--half">
                  <div class="qm-field__label">更改通知单号</div>
                  <el-input
                    v-model="quotationForm.changeOrderNo"
                    :disabled="isViewMode"
                    placeholder="请输入更改通知单号"
                    maxlength="50"
                  />
                </div>
                <div class="qm-field qm-field--half">
                  <div class="qm-field__label">加工零件名称</div>
                  <el-input
                    v-model="quotationForm.partName"
                    :disabled="isViewMode"
                    placeholder="请输入加工零件名称"
                  />
                </div>
                <div class="qm-field qm-field--half">
                  <div class="qm-field__label">模具编号</div>
                  <el-input
                    v-model="quotationForm.moldNo"
                    :disabled="isViewMode"
                    placeholder="请输入模具编号"
                  />
                </div>
                <div class="qm-field qm-field--half">
                  <div class="qm-field__label">申请更改部门</div>
                  <el-input
                    v-model="quotationForm.department"
                    :disabled="isViewMode"
                    placeholder="请输入申请更改部门"
                  />
                </div>
                <div class="qm-field qm-field--half">
                  <div class="qm-field__label">申请更改人</div>
                  <el-input
                    v-model="quotationForm.applicant"
                    :disabled="isViewMode"
                    placeholder="请输入申请更改人"
                  />
                </div>
              </div>
            </div>
          </section>

          <section class="qm-cost-stack">
            <div class="qm-panel">
              <div class="qm-panel__header">
                <div>
                  <div class="qm-panel__eyebrow">Material</div>
                  <div class="qm-panel__title">单位材料费</div>
                </div>
                <div class="qm-panel__badge">材料费 ¥{{ formatAmount(materialsTotal) }}</div>
              </div>
              <div class="qm-material-grid">
                <div
                  v-for="(row, rowIndex) in quotationForm.materials"
                  :key="`material-${rowIndex}`"
                  class="qm-material-card"
                >
                  <table class="qm-material-table">
                    <thead>
                      <tr>
                        <th class="qm-material-table__name">材料名称</th>
                        <th class="qm-material-table__price">单价</th>
                        <th class="qm-material-table__qty">用量</th>
                        <th class="qm-material-table__total">费用</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td class="qm-material-table__name">
                          <el-input
                            v-model="row.name"
                            :disabled="isViewMode"
                            placeholder="材料名称"
                          />
                        </td>
                        <td class="qm-material-table__price">
                          <el-input-number
                            v-model="row.unitPrice"
                            :disabled="isViewMode"
                            :min="0"
                            :precision="2"
                            :controls="false"
                            style="width: 100%"
                          />
                        </td>
                        <td class="qm-material-table__qty">
                          <el-input-number
                            v-model="row.quantity"
                            :disabled="isViewMode"
                            :min="0"
                            :precision="0"
                            :controls="false"
                            style="width: 100%"
                          />
                        </td>
                        <td class="qm-material-table__total">
                          {{ formatFilledAmount((row.unitPrice || 0) * (row.quantity || 0)) }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div class="qm-panel">
              <div class="qm-panel__header">
                <div>
                  <div class="qm-panel__eyebrow">Process</div>
                  <div class="qm-panel__title">加工费用</div>
                </div>
                <div class="qm-panel__badge">加工费 ¥{{ formatAmount(processingTotal) }}</div>
              </div>
              <div class="qm-process-table-shell">
                <table class="qm-process-compact-table">
                  <thead>
                    <tr>
                      <template v-for="colIndex in 3" :key="`process-head-${colIndex}`">
                        <th class="qm-process-compact-table__head qm-process-compact-table__name">
                          加工工序
                        </th>
                        <th class="qm-process-compact-table__head qm-process-compact-table__unit">
                          含税单价
                        </th>
                        <th class="qm-process-compact-table__head qm-process-compact-table__hours">
                          用时（H）
                        </th>
                        <th class="qm-process-compact-table__head qm-process-compact-table__total">
                          合计费用
                        </th>
                      </template>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(row, rowIndex) in moldProcessTableRows" :key="`row-${rowIndex}`">
                      <template
                        v-for="(item, colIndex) in row"
                        :key="item?.key || `empty-${rowIndex}-${colIndex}`"
                      >
                        <template v-if="item">
                          <td class="qm-process-compact-table__name">{{ item.name }}</td>
                          <td class="qm-process-compact-table__unit">{{ item.unitPriceLabel }}</td>
                          <td class="qm-process-compact-table__hours">
                            <el-input-number
                              v-model="item.hours"
                              :disabled="isViewMode"
                              :min="0"
                              :precision="1"
                              :controls="false"
                              style="width: 100%"
                            />
                          </td>
                          <td class="qm-process-compact-table__total">
                            {{ formatFilledAmount((item.unitPrice || 0) * (item.hours || 0)) }}
                          </td>
                        </template>
                        <template v-else>
                          <td class="qm-process-compact-table__placeholder" colspan="4"></td>
                        </template>
                      </template>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div class="qm-panel qm-panel--summary">
              <div class="qm-panel__header qm-panel__header--summary">
                <div>
                  <div class="qm-panel__eyebrow">Total</div>
                  <div class="qm-panel__title-row">
                    <div class="qm-panel__title">总价</div>
                    <div class="qm-panel__hint qm-panel__hint--inline"
                      >汇总材料、加工及附加费用</div
                    >
                  </div>
                </div>
              </div>
              <div class="qm-summary-list">
                <div class="qm-summary-main-row">
                  <div class="qm-summary-kpi">
                    <span class="qm-summary-kpi__label">材料费</span>
                    <strong>{{
                      formatFilledAmount(materialsTotal) === '-'
                        ? '-'
                        : `¥${formatFilledAmount(materialsTotal)}`
                    }}</strong>
                  </div>
                  <div class="qm-summary-kpi">
                    <span class="qm-summary-kpi__label">加工费</span>
                    <strong>{{
                      formatFilledAmount(processingTotal) === '-'
                        ? '-'
                        : `¥${formatFilledAmount(processingTotal)}`
                    }}</strong>
                  </div>
                  <div class="qm-summary-edit-card">
                    <span class="qm-summary-edit-card__label">其他费用</span>
                    <el-input-number
                      v-model="quotationForm.otherFee"
                      :disabled="isViewMode"
                      :min="0"
                      :precision="2"
                      :controls="false"
                      style="width: 100%"
                    />
                  </div>
                  <div class="qm-summary-edit-card">
                    <span class="qm-summary-edit-card__label">运输费用</span>
                    <el-input-number
                      v-model="quotationForm.transportFee"
                      :disabled="isViewMode"
                      :min="0"
                      :precision="2"
                      :controls="false"
                      style="width: 100%"
                    />
                  </div>
                  <div class="qm-summary-edit-card">
                    <span class="qm-summary-edit-card__label">加工数量</span>
                    <el-input-number
                      v-model="quotationForm.quantity"
                      :disabled="isViewMode"
                      :min="1"
                      :precision="0"
                      :controls="false"
                      style="width: 100%"
                    />
                  </div>
                </div>
                <div class="qm-summary-total">
                  <span class="qm-summary-total__label">含税价格</span>
                  <strong>{{
                    formatFilledAmount(effectiveTaxIncludedPrice) === '-'
                      ? '-'
                      : `¥${formatFilledAmount(effectiveTaxIncludedPrice)}`
                  }}</strong>
                </div>
              </div>
            </div>
          </section>
        </div>

        <div v-else class="quotation-sheet quotation-sheet--part">
          <div class="qt-card qt-part-items-card">
            <div class="qt-part-items__toolbar">
              <div class="qt-part-items__title">产品明细</div>
              <div class="qt-part-items__toolbar-right">
                <div class="qt-part-items__image-toggle">
                  <span class="qt-part-items__image-toggle-label">图示</span>
                  <el-switch v-model="quotationForm.enableImage" :disabled="isViewMode" />
                </div>
                <el-button
                  v-if="!isViewMode"
                  size="small"
                  type="primary"
                  plain
                  @click="handleAddPartItem"
                >
                  添加行
                </el-button>
              </div>
            </div>

            <el-table
              :data="quotationForm.partItems"
              border
              :class="[
                'qt-part-items-table',
                { 'qt-part-items-table--with-image': quotationForm.enableImage }
              ]"
              row-key="lineNo"
              :row-style="getPartItemsRowStyle"
            >
              <el-table-column type="index" label="序号" width="60" align="center" />
              <el-table-column label="产品名称" min-width="140">
                <template #default="{ row }">
                  <el-input v-model="row.partName" :disabled="isViewMode" placeholder="产品名称" />
                </template>
              </el-table-column>
              <el-table-column label="产品图号" min-width="120">
                <template #default="{ row }">
                  <el-input v-model="row.drawingNo" :disabled="isViewMode" placeholder="产品图号" />
                </template>
              </el-table-column>
              <el-table-column label="材质" min-width="100">
                <template #default="{ row }">
                  <el-input v-model="row.material" :disabled="isViewMode" placeholder="材质" />
                </template>
              </el-table-column>
              <el-table-column label="加工内容" min-width="100">
                <template #default="{ row }">
                  <el-input v-model="row.process" :disabled="isViewMode" placeholder="加工内容" />
                </template>
              </el-table-column>
              <el-table-column
                v-if="quotationForm.enableImage"
                label="图示"
                width="176"
                align="center"
              >
                <template #default="{ row }">
                  <div
                    class="qt-part-image-cell"
                    :class="{ 'qt-part-image-cell--readonly': isViewMode }"
                    tabindex="0"
                    @mousedown="handleFocusPartItemImageCell"
                    @paste="(e) => handlePartItemImagePaste(e, row)"
                    @dragover="handlePartItemImageDragOver"
                    @drop="(e) => handlePartItemImageDrop(e, row)"
                  >
                    <div v-if="partImageUploading[row.lineNo]" class="qt-part-image-cell__loading">
                      上传中
                    </div>
                    <template v-else>
                      <template v-if="row.imageUrl">
                        <el-image
                          class="qt-part-image-thumb"
                          :style="{ '--img-scale': String(row.imageScale || 1) }"
                          :src="toPartItemImageDisplayUrl(row.imageUrl)"
                          :preview-src-list="[toPartItemImageDisplayUrl(row.imageUrl)]"
                          :preview-teleported="true"
                          fit="contain"
                        />
                        <div class="qt-part-image-scale">
                          <el-dropdown
                            v-if="!isViewMode"
                            trigger="click"
                            @command="(cmd) => handlePartItemImageScaleCommand(row, cmd)"
                          >
                            <span class="qt-part-image-scale-badge">
                              {{ Math.round((row.imageScale || 1) * 100) }}%
                            </span>
                            <template #dropdown>
                              <el-dropdown-menu>
                                <el-dropdown-item
                                  v-for="opt in IMAGE_SCALE_OPTIONS"
                                  :key="opt.value"
                                  :command="opt.value"
                                >
                                  {{ opt.label }}
                                </el-dropdown-item>
                              </el-dropdown-menu>
                            </template>
                          </el-dropdown>
                        </div>
                        <button
                          v-if="!isViewMode"
                          type="button"
                          class="qt-part-image-remove"
                          @click.stop="handleRemovePartItemImage(row)"
                        >
                          ×
                        </button>
                        <button
                          v-if="!isViewMode"
                          type="button"
                          class="qt-part-image-pick"
                          title="选择文件"
                          @click.stop="handlePickPartItemImage(row)"
                        >
                          ⤒
                        </button>
                      </template>
                      <template v-else>
                        <div class="qt-part-image-empty">
                          <div class="qt-part-image-empty__text">粘贴 / 拖拽 / 上传</div>
                          <div class="qt-part-image-empty__hint">支持截图粘贴与本地图片选择</div>
                        </div>
                        <button
                          v-if="!isViewMode"
                          type="button"
                          class="qt-part-image-pick"
                          title="选择文件"
                          @click.stop="handlePickPartItemImage(row)"
                        >
                          ⤒
                        </button>
                      </template>
                    </template>
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="数量" width="90" align="right">
                <template #default="{ row }">
                  <el-input-number
                    v-model="row.quantity"
                    :disabled="isViewMode"
                    :min="1"
                    :precision="0"
                    :controls="false"
                    style="width: 100%"
                  />
                </template>
              </el-table-column>
              <el-table-column label="单价(元)" width="90" align="right">
                <template #default="{ row }">
                  <el-input
                    :model-value="
                      row.unitPriceText !== undefined
                        ? row.unitPriceText
                        : formatMoneyText(row.unitPrice)
                    "
                    :disabled="isViewMode"
                    placeholder="-"
                    class="qt-money-input"
                    @focus="
                      () => {
                        row.unitPriceText = toPlainMoneyText(row.unitPrice)
                      }
                    "
                    @update:model-value="(v: string) => (row.unitPriceText = v)"
                    @blur="
                      () => {
                        row.unitPrice = parseMoneyText(row.unitPriceText || '')
                        row.unitPriceText = undefined
                      }
                    "
                  />
                </template>
              </el-table-column>
              <el-table-column label="金额(元)" width="105" align="right">
                <template #default="{ row }">
                  {{
                    row.quantity === undefined || row.unitPrice === undefined
                      ? '-'
                      : formatAmount((row.quantity || 0) * (row.unitPrice || 0))
                  }}
                </template>
              </el-table-column>
              <el-table-column v-if="!isViewMode" label="操作" width="80" align="center">
                <template #default="{ $index }">
                  <el-button type="danger" size="small" @click="handleRemovePartItem($index)">
                    删除
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
            <input
              v-if="quotationForm.enableImage"
              ref="partImageFileInputRef"
              class="qt-part-image-file-input"
              type="file"
              accept="image/*"
              @change="handlePartItemImageFileChange"
            />
          </div>

          <div class="qt-part-summary-row">
            <div class="qt-part-summary-row__spacer"></div>
            <div class="qt-card qt-part-summary-card">
              <div class="qt-part-summary-item">
                <div class="qt-part-summary-label">其它费用</div>
                <div class="qt-part-summary-value">
                  <template v-if="isViewMode">
                    {{ formatMoneyDisplay(quotationForm.otherFee) }}
                  </template>
                  <el-input
                    v-else
                    :model-value="
                      otherFeeText !== undefined
                        ? otherFeeText
                        : formatMoneyText(quotationForm.otherFee)
                    "
                    placeholder="-"
                    class="qt-money-input"
                    @focus="() => (otherFeeText = toPlainMoneyText(quotationForm.otherFee))"
                    @update:model-value="(v: string) => (otherFeeText = v)"
                    @blur="
                      () => {
                        quotationForm.otherFee = parseMoneyText(otherFeeText || '')
                        otherFeeText = undefined
                      }
                    "
                  />
                </div>
              </div>
              <div class="qt-part-summary-item">
                <div class="qt-part-summary-label">运输费用</div>
                <div class="qt-part-summary-value">
                  <template v-if="isViewMode">
                    {{ formatMoneyDisplay(quotationForm.transportFee) }}
                  </template>
                  <el-input
                    v-else
                    :model-value="
                      transportFeeText !== undefined
                        ? transportFeeText
                        : formatMoneyText(quotationForm.transportFee)
                    "
                    placeholder="-"
                    class="qt-money-input"
                    @focus="() => (transportFeeText = toPlainMoneyText(quotationForm.transportFee))"
                    @update:model-value="(v: string) => (transportFeeText = v)"
                    @blur="
                      () => {
                        quotationForm.transportFee = parseMoneyText(transportFeeText || '')
                        transportFeeText = undefined
                      }
                    "
                  />
                </div>
              </div>
              <div class="qt-part-summary-item qt-part-summary-item--total">
                <div class="qt-part-summary-label">含税价格</div>
                <div class="qt-part-summary-value qt-part-summary-value--total">
                  {{ hasAnyPartMoney ? formatAmount(effectiveTaxIncludedPrice) : '-' }}
                </div>
              </div>

              <div class="qt-part-summary-item qt-part-summary-item--remark">
                <div class="qt-part-summary-label">备注</div>
                <div class="qt-part-summary-value qt-part-summary-value--remark">
                  <el-input
                    v-model="quotationForm.remark"
                    :disabled="isViewMode"
                    type="textarea"
                    :rows="1"
                    placeholder="请输入备注"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </el-form>
    </el-dialog>

    <!-- 项目代入对话框 -->
    <el-dialog
      v-model="projectImportDialogVisible"
      title="按项目代入"
      width="720px"
      :close-on-click-modal="false"
    >
      <div class="project-import-dialog">
        <el-input
          v-model="projectSearchKeyword"
          placeholder="请输入项目编号 / 产品名称 / 产品图号 / 客户模号 关键字（仅在分类为“塑胶模具”的项目中查询）"
          clearable
          class="project-import-search-input"
        />
        <el-table
          v-loading="projectSearchLoading"
          :data="projectSearchResults"
          border
          height="360"
          class="project-import-table"
          @row-dblclick="handleSelectProjectForImport"
        >
          <el-table-column prop="项目编号" label="项目编号" min-width="145" />
          <el-table-column
            prop="productDrawing"
            label="产品图号"
            min-width="150"
            show-overflow-tooltip
          />
          <el-table-column
            prop="productName"
            label="产品名称"
            min-width="150"
            show-overflow-tooltip
          />
          <el-table-column prop="客户模号" label="客户模号" min-width="120" show-overflow-tooltip />
          <el-table-column label="操作" width="90" align="center">
            <template #default="{ row }">
              <el-button
                size="small"
                type="primary"
                :loading="importingProject"
                :disabled="importingProject"
                @click.stop="handleSelectProjectForImport(row)"
              >
                代入
              </el-button>
            </template>
          </el-table-column>
        </el-table>
        <div v-if="projectSearchTotal > 0" class="project-import-pagination">
          <el-pagination
            background
            layout="total, prev, pager, next"
            :current-page="projectSearchPage"
            :page-size="projectSearchPageSize"
            :total="projectSearchTotal"
            @current-change="handleProjectImportPageChange"
          />
        </div>
        <div
          v-if="!projectSearchResults.length && projectSearchKeyword && !projectSearchLoading"
          class="project-import-empty"
        >
          在分类为「塑胶模具」的项目中未找到匹配的项目编号
        </div>
        <div class="project-import-tip">
          提示：在输入框中连续输入字符即可逐步缩小项目范围，双击行或点击“代入”按钮即可填充。
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import {
  ElButton,
  ElCard,
  ElDatePicker,
  ElDialog,
  ElDescriptions,
  ElDescriptionsItem,
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu,
  ElEmpty,
  ElForm,
  ElFormItem,
  ElImage,
  ElInput,
  ElInputNumber,
  ElMessage,
  ElMessageBox,
  ElOption,
  ElPagination,
  ElRadioGroup,
  ElRadioButton,
  ElSelect,
  ElSwitch,
  ElTable,
  ElTableColumn,
  ElTag
} from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { computed, nextTick, onMounted, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useAppStore } from '@/store/modules/app'
import { buildQuotationPartImageDisplayUrl } from '@/utils/imageDisplay'
import { useUserStore } from '@/store/modules/user'

const userStore = useUserStore()
import {
  checkQuotationInitiationProjectCodeApi,
  generateQuotationNoApi,
  getQuotationProjectGoodsApi,
  getQuotationProjectOptionsApi,
  createQuotationApi,
  updateQuotationApi,
  deleteQuotationApi,
  getQuotationListApi,
  getQuotationCustomerOptionsApi,
  getQuotationInitiationRequestApi,
  requestQuotationInitiationCustomerReviewApi,
  saveQuotationInitiationDraftApi,
  submitQuotationInitiationApi,
  withdrawQuotationInitiationApi,
  downloadQuotationPdfApi,
  downloadQuotationCompletionPdfApi,
  uploadQuotationPartItemImageApi,
  deleteQuotationTempPartItemImageApi,
  type QuotationFormData,
  type QuotationCustomerOption,
  type QuotationProjectOption,
  type QuotationInitiationProjectDetailDraft,
  type QuotationInitiationProjectDraft,
  type QuotationInitiationRequestRow,
  type QuotationInitiationSalesOrderDetailDraft,
  type QuotationInitiationSalesOrderDraft
} from '@/api/quotation'
import type { QuotationRecord } from '@/api/quotation'
import { getMaxSerialApi } from '@/api/goods'

interface QuotationMaterialItem {
  name: string
  unitPrice: number
  quantity: number
}

interface QuotationProcessItem {
  key: string
  name: string
  unitPriceLabel: string
  unitPrice: number
  hours: number
}

interface QuotationFormModel {
  id: number | null
  quotationNo: string
  quotationDate: string | ''
  customerName: string
  quotationType: 'mold' | 'part' | '塑胶模具' | '修改模具' | '零件加工'
  enableImage: boolean
  processingDate: string | ''
  changeOrderNo: string
  sourceProjectCode: string
  partName: string
  moldNo: string
  department: string
  applicant: string
  contactName: string
  contactPhone: string
  operator: string
  remark: string
  deliveryTerms: string
  paymentTerms: string
  validityDays: number | undefined
  partItems: Array<{
    lineNo: number
    partName: string
    drawingNo: string
    material: string
    process: string
    imageUrl: string
    imageScale: 0.5 | 0.75 | 1 | 1.25 | 1.5 | 2
    quantity: number | undefined
    unitPrice: number | undefined
    unitPriceText?: string
  }>
  materials: QuotationMaterialItem[]
  processes: QuotationProcessItem[]
  otherFee: number | undefined
  transportFee: number | undefined
  quantity: number
}

// QuotationRecord 类型已从 API 导入

interface QueryForm {
  keyword: string
  quotationType: 'mold' | 'part' | '塑胶模具' | '修改模具' | '零件加工' | ''
  initiationStatus:
    | ''
    | '未发起'
    | '待客户审核'
    | '草稿'
    | '审核中'
    | '已通过'
    | '已驳回'
    | '已撤回'
  finalProjectCode: string
}

type InitiationDialogMode = 'create' | 'edit' | 'view' | 'restart'

interface InitiationFormModel {
  projectCode: string
  sourceProjectCode: string
  category: string
  customerName: string
  productName: string
  productDrawing: string
  customerModelNo: string
  customerId: number | null
}

interface InitiationSalesFormModel {
  orderDate: string
  signDate: string
  contractNo: string
  details: QuotationInitiationSalesOrderDetailDraft[]
}

const appStore = useAppStore()
const isMobile = computed(() => appStore.getMobile)
const showMobileFilters = ref(true)

// 视图模式：手机端默认卡片视图，PC端默认表格视图
type ViewMode = 'table' | 'card'
const viewMode = ref<ViewMode>(isMobile.value ? 'card' : 'table')

// 客户列表
const customerList = ref<QuotationCustomerOption[]>([])
const customerLoading = ref(false)

// 查询表单
const queryForm = reactive<QueryForm>({
  keyword: '',
  quotationType: '',
  initiationStatus: '',
  finalProjectCode: ''
})

// 报价单列表
const quotations = ref<QuotationRecord[]>([])
const loading = ref(false)
const total = ref(0)

// 分页
const pagination = reactive({
  page: 1,
  pageSize: 20
})

const paginationLayout = computed(() =>
  isMobile.value || viewMode.value === 'card'
    ? 'total, prev, pager, next'
    : 'total, sizes, prev, pager, next, jumper'
)

const paginationPagerCount = computed(() => (isMobile.value || viewMode.value === 'card' ? 5 : 7))

// 排序配置
const sortConfig = reactive<{
  prop: string | null
  order: 'ascending' | 'descending' | null
}>({
  prop: null,
  order: null
})

// 排序后的数据
const pagedQuotations = computed(() => {
  const result = [...quotations.value]

  if (sortConfig.prop && sortConfig.order) {
    result.sort((a, b) => {
      let aVal: any = a[sortConfig.prop as keyof QuotationRecord]
      let bVal: any = b[sortConfig.prop as keyof QuotationRecord]

      // 处理空值
      if (aVal === null || aVal === undefined) aVal = ''
      if (bVal === null || bVal === undefined) bVal = ''

      // 报价类型特殊处理：part < mold（零件报价单 < 改模报价单）
      if (sortConfig.prop === 'quotationType') {
        const typeOrder: Record<string, number> = {
          part: 0,
          零件加工: 0,
          mold: 1,
          修改模具: 1,
          塑胶模具: 2
        }
        aVal = typeOrder[String(aVal)] ?? 9
        bVal = typeOrder[String(bVal)] ?? 9
      }

      // 字符串比较
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const comparison = aVal.localeCompare(bVal, 'zh-CN')
        return sortConfig.order === 'ascending' ? comparison : -comparison
      }

      // 数字比较
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.order === 'ascending' ? aVal - bVal : bVal - aVal
      }

      // 默认比较
      const comparison = String(aVal).localeCompare(String(bVal), 'zh-CN')
      return sortConfig.order === 'ascending' ? comparison : -comparison
    })
  }

  return result
})

// 表单 & 对话框
const dialogVisible = ref(false)
const dialogTitle = ref('新增报价单')
const dialogMode = ref<'create' | 'edit' | 'view'>('create')
const isViewMode = computed(() => dialogMode.value === 'view')
const formRef = ref<FormInstance>()
const downloading = ref(false)
const importingProject = ref(false)

const initiationStatusOptions = [
  '未发起',
  '待客户审核',
  '草稿',
  '审核中',
  '已通过',
  '已驳回',
  '已撤回'
] as const

const initiationDialogVisible = ref(false)
const initiationDialogLoading = ref(false)
const initiationDialogSaving = ref(false)
const initiationDialogSubmitting = ref(false)
const initiationRequestingCustomerReview = ref(false)
const initiationRecommendingCode = ref(false)
const initiationDialogMode = ref<InitiationDialogMode>('create')
const initiationSourceQuotation = ref<QuotationRecord | null>(null)
const initiationRequestRow = ref<QuotationInitiationRequestRow | null>(null)
const initiationProjectCodeChecking = ref(false)
const initiationProjectCodeError = ref('')
const initiationCustomerMatched = ref(false)
const initiationCustomerLocked = ref(false)
const initiationProjectGoodsSyncToken = ref(0)

const initiationForm = reactive<InitiationFormModel>({
  projectCode: '',
  sourceProjectCode: '',
  category: '',
  customerName: '',
  productName: '',
  productDrawing: '',
  customerModelNo: '',
  customerId: null
})

const initiationSalesForm = reactive<InitiationSalesFormModel>({
  orderDate: '',
  signDate: '',
  contractNo: '',
  details: []
})
const initiationProjectDetails = ref<QuotationInitiationProjectDetailDraft[]>([])

// 项目代入对话框 & 查询状态
const projectImportDialogVisible = ref(false)
const projectSearchKeyword = ref('')
const projectSearchLoading = ref(false)
const projectSearchResults = ref<QuotationProjectOption[]>([])
const projectSearchPage = ref(1)
const projectSearchPageSize = ref(20)
const projectSearchTotal = ref(0)
let projectSearchDebounceTimer: any = null

const createEmptyForm = (): QuotationFormModel => ({
  id: null,
  quotationNo: '',
  quotationDate: '',
  customerName: '',
  quotationType: 'mold',
  enableImage: false,
  processingDate: '',
  changeOrderNo: '',
  sourceProjectCode: '',
  partName: '',
  moldNo: '',
  department: '',
  applicant: '',
  contactName: '',
  contactPhone: '',
  operator:
    (userStore.getUserInfo as any)?.realName ||
    (userStore.getUserInfo as any)?.displayName ||
    userStore.getUserInfo?.username ||
    '',
  remark: '',
  deliveryTerms: '',
  paymentTerms: '',
  validityDays: undefined,
  partItems: [],
  materials: [
    { name: '紫铜电极', unitPrice: 0, quantity: 0 },
    { name: '配件', unitPrice: 0, quantity: 0 }
  ],
  processes: [
    { key: 'nc', name: '数控', unitPriceLabel: '35元/小时', unitPrice: 35, hours: 0 },
    { key: 'fastCut', name: '快丝切割', unitPriceLabel: '12元/小时', unitPrice: 12, hours: 0 },
    { key: 'middleCut', name: '中丝切割', unitPriceLabel: '30元/小时', unitPrice: 30, hours: 0 },
    { key: 'slowCut', name: '慢丝切割', unitPriceLabel: '70元/小时', unitPrice: 70, hours: 0 },
    { key: 'cnc', name: 'CNC', unitPriceLabel: '70元/小时', unitPrice: 70, hours: 0 },
    { key: 'highSpeed', name: '高速铣', unitPriceLabel: '150元/小时', unitPrice: 150, hours: 0 },
    { key: 'spark', name: '电火花', unitPriceLabel: '60元/小时', unitPrice: 60, hours: 0 },
    { key: 'gantry', name: '龙门', unitPriceLabel: '90元/小时', unitPrice: 90, hours: 0 },
    { key: 'fitter', name: '钳工', unitPriceLabel: '35元/小时', unitPrice: 35, hours: 0 },
    { key: 'polish', name: '抛光', unitPriceLabel: '40元/小时', unitPrice: 40, hours: 0 }
  ],
  otherFee: 0,
  transportFee: 0,
  quantity: 1
})

const quotationForm = reactive<QuotationFormModel>(createEmptyForm())

const otherFeeText = ref<string | undefined>(undefined)
const transportFeeText = ref<string | undefined>(undefined)
const partImageUploading = reactive<Record<number, boolean>>({})
const partImageFileInputRef = ref<HTMLInputElement>()
const partImageFileTargetRow = ref<any>(null)
const TEMP_PART_IMAGE_PREFIX = '/uploads/_temp/quotation-images/'

const isTempPartImageUrl = (url: any) => String(url || '').startsWith(TEMP_PART_IMAGE_PREFIX)

const toPartItemImageDisplayUrl = (imageUrl: any) => {
  return buildQuotationPartImageDisplayUrl(imageUrl)
}

const deleteTempPartImageIfNeeded = async (imageUrl: any) => {
  const url = String(imageUrl || '').trim()
  if (!isTempPartImageUrl(url)) return
  try {
    await deleteQuotationTempPartItemImageApi(url)
  } catch (e) {
    console.warn('删除临时图示失败（忽略）:', e)
  }
}

const IMAGE_SCALE_OPTIONS: Array<{ label: string; value: 0.5 | 0.75 | 1 | 1.25 | 1.5 | 2 }> = [
  { label: '50%', value: 0.5 },
  { label: '75%', value: 0.75 },
  { label: '100%', value: 1 },
  { label: '125%', value: 1.25 },
  { label: '150%', value: 1.5 },
  { label: '200%', value: 2 }
]

const normalizeImageScale = (value: any): 0.5 | 0.75 | 1 | 1.25 | 1.5 | 2 => {
  if (value === 0.5 || value === '0.5' || value === '50%') return 0.5
  if (value === 0.75 || value === '0.75' || value === '75%') return 0.75
  if (value === 1.25 || value === '1.25' || value === '125%') return 1.25
  if (value === 1.5 || value === '1.5' || value === '150%') return 1.5
  if (value === 2 || value === '2' || value === '200%') return 2
  return 1
}

const getPartItemsRowStyle = () => (quotationForm.enableImage ? { height: '80px' } : {})

const uploadPartItemImage = async (file: File, row: any) => {
  if (!file) return
  if (isViewMode.value) return
  if (!quotationForm.quotationNo) {
    ElMessage.warning('请先生成/填写报价单号后再上传图示')
    return
  }

  const lineNo = Number(row?.lineNo || 0)
  if (lineNo) partImageUploading[lineNo] = true

  try {
    if (row?.imageUrl) {
      await deleteTempPartImageIfNeeded(row.imageUrl)
    }
    const resp: any = await uploadQuotationPartItemImageApi(String(quotationForm.quotationNo), file)
    const pr: any = resp
    const url = pr?.data?.url || pr?.data?.data?.url || ''
    if (!url) {
      ElMessage.error(pr?.message || '上传失败')
      return
    }
    row.imageUrl = url
    row.imageScale = normalizeImageScale(row.imageScale)
  } catch (error) {
    console.error('上传图示失败:', error)
    ElMessage.error('上传图示失败')
  } finally {
    if (lineNo) partImageUploading[lineNo] = false
  }
}

const handlePickPartItemImage = (row: any) => {
  if (isViewMode.value) return
  partImageFileTargetRow.value = row
  partImageFileInputRef.value?.click()
}

const handleFocusPartItemImageCell = (e: MouseEvent) => {
  const el = e.currentTarget as HTMLElement | null
  el?.focus?.()
}

const handlePartItemImageFileChange = async (e: Event) => {
  const input = e.target as HTMLInputElement | null
  const file = input?.files?.[0]
  const row = partImageFileTargetRow.value
  partImageFileTargetRow.value = null
  if (input) input.value = ''
  if (!file || !row) return
  await uploadPartItemImage(file, row)
}

const handlePartItemImagePaste = async (e: ClipboardEvent, row: any) => {
  if (isViewMode.value) return
  const items = e.clipboardData?.items ? Array.from(e.clipboardData.items) : []
  const imageItem = items.find((it) => String(it.type || '').startsWith('image/'))
  if (!imageItem) return
  const file = imageItem.getAsFile()
  if (!file) return
  e.preventDefault()
  await uploadPartItemImage(file, row)
}

const handlePartItemImageDragOver = (e: DragEvent) => {
  if (isViewMode.value) return
  e.preventDefault()
}

const handlePartItemImageDrop = async (e: DragEvent, row: any) => {
  if (isViewMode.value) return
  e.preventDefault()
  const file = e.dataTransfer?.files?.[0]
  if (!file) return
  if (!String(file.type || '').startsWith('image/')) {
    ElMessage.warning('仅支持拖拽图片文件')
    return
  }
  await uploadPartItemImage(file, row)
}

const handlePartItemImageScaleCommand = (row: any, cmd: any) => {
  if (isViewMode.value) return
  row.imageScale = normalizeImageScale(cmd)
}

const handleRemovePartItemImage = (row: any) => {
  if (isViewMode.value) return
  void deleteTempPartImageIfNeeded(row?.imageUrl)
  row.imageUrl = ''
}

const cleanupTempPartImagesInForm = async () => {
  if (quotationForm.quotationType !== 'part') return
  const urls = (quotationForm.partItems || []).map((x: any) => String(x?.imageUrl || '').trim())
  const uniq = Array.from(new Set(urls.filter((u) => isTempPartImageUrl(u))))
  if (!uniq.length) return
  await Promise.allSettled(uniq.map((u) => deleteTempPartImageIfNeeded(u)))
}

const handleCancelQuotationDialog = async () => {
  if (isViewMode.value) {
    dialogVisible.value = false
    return
  }
  await cleanupTempPartImagesInForm()
  dialogVisible.value = false
}

// 新增报价单：先选择 报价单号/报价日期/客户名称
const preCreateDialogVisible = ref(false)
const preCreateFormRef = ref<FormInstance>()
const preCreateForm = reactive({
  quotationType: 'mold' as 'mold' | 'part',
  quotationNo: '',
  quotationDate: '',
  customerName: ''
})

const preCreateTypeOptions = [
  {
    value: 'mold' as const,
    title: '改模报价单',
    badge: '模具更改',
    dialogTitle: '新增改模报价单',
    description: '适用于修改模具、返修、改料与结构变更等场景，先确认基础信息后进入完整报价表。',
    footnote: '包含加工日期、更改通知单号、材料费与加工费结构。'
  },
  {
    value: 'part' as const,
    title: '零件报价单',
    badge: '零件加工',
    dialogTitle: '新增零件报价单',
    description: '适用于多行零件明细报价，可直接进入带图示与行项目金额汇总的零件报价界面。',
    footnote: '包含明细行、图片图示、附加费用与运输费。'
  }
]

const selectedPreCreateTypeMeta = computed(
  () =>
    preCreateTypeOptions.find((item) => item.value === preCreateForm.quotationType) ||
    preCreateTypeOptions[0]
)

const preCreateRules: FormRules = {
  quotationType: [{ required: true, message: '请选择报价类型', trigger: 'change' }],
  quotationNo: [{ required: true, message: '报价单号不能为空', trigger: 'blur' }],
  quotationDate: [{ required: true, message: '请选择报价日期', trigger: 'change' }],
  customerName: [{ required: true, message: '请选择客户名称', trigger: 'change' }]
}

const formRules: FormRules = {
  // 报价日期、客户名称 为必填（其余字段按报价类型在提交时做额外校验）
  quotationDate: [{ required: true, message: '请选择报价日期', trigger: 'change' }],
  customerName: [{ required: true, message: '请选择客户名称', trigger: 'change' }]
}

// 金额计算
const materialsTotal = computed(() =>
  quotationForm.materials.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
)

const processingTotal = computed(() =>
  quotationForm.processes.reduce((sum, item) => sum + item.unitPrice * item.hours, 0)
)

const taxIncludedPrice = computed(() => {
  const otherFee = Number(quotationForm.otherFee || 0)
  const transportFee = Number(quotationForm.transportFee || 0)
  return materialsTotal.value + processingTotal.value + otherFee + transportFee
})

const partItemsTotal = computed(() =>
  quotationForm.partItems.reduce(
    (sum, item) => sum + (Number(item.unitPrice) || 0) * (Number(item.quantity) || 0),
    0
  )
)

const effectiveTaxIncludedPrice = computed(() => {
  if (quotationForm.quotationType === 'part') {
    const otherFee = Number(quotationForm.otherFee || 0)
    const transportFee = Number(quotationForm.transportFee || 0)
    return partItemsTotal.value + otherFee + transportFee
  }
  return taxIncludedPrice.value
})

const moldProcessTableRows = computed(() => {
  const items = quotationForm.processes || []
  const columnCount = 3
  const rowCount = Math.ceil(items.length / columnCount)
  if (!rowCount) return []

  return Array.from({ length: rowCount }, (_, rowIndex) =>
    Array.from({ length: columnCount }, (_, colIndex) => {
      const itemIndex = colIndex * rowCount + rowIndex
      return items[itemIndex] || null
    })
  )
})

const calcMaterialsTotal = (row: QuotationRecord) =>
  (row.materials || []).reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)

const calcProcessingTotal = (row: QuotationRecord) =>
  (row.processes || []).reduce((sum, item) => sum + item.unitPrice * item.hours, 0)

const calcTaxIncludedPrice = (row: QuotationRecord) => {
  if (row.quotationType === 'part') {
    const partTotal = (row.partItems || []).reduce(
      (sum, item) => sum + (item.unitPrice || 0) * (item.quantity || 0),
      0
    )
    return partTotal + (row.otherFee || 0) + (row.transportFee || 0)
  }
  return (
    calcMaterialsTotal(row) +
    calcProcessingTotal(row) +
    (row.otherFee || 0) +
    (row.transportFee || 0)
  )
}

const formatAmount = (value: number | null | undefined) => {
  if (value === null || value === undefined) return '-'
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return '-'
  return numericValue.toLocaleString('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })
}

const formatFilledAmount = (value: number | null | undefined) => {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue) || numericValue <= 0) return '-'
  return formatAmount(numericValue)
}

const formatMoneyDisplay = (value: number | null | undefined) => {
  if (value === null || value === undefined) return '-'
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return '-'
  return numericValue.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

const formatMoneyText = (value: number | null | undefined) => {
  if (value === null || value === undefined) return ''
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return ''
  return numericValue.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

const toPlainMoneyText = (value: number | null | undefined) => {
  if (value === null || value === undefined) return ''
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return ''
  return String(numericValue)
}

const parseMoneyText = (text: string) => {
  const normalized = String(text || '')
    .trim()
    .replace(/,/g, '')
  if (!normalized) return undefined
  const numericValue = Number(normalized)
  return Number.isFinite(numericValue) ? numericValue : undefined
}

const hasAnyPartMoney = computed(() => {
  if (quotationForm.quotationType !== 'part') return false
  const hasLineAmount = quotationForm.partItems.some(
    (item) => Number(item.quantity) > 0 && Number(item.unitPrice) > 0
  )
  const hasFees = Number(quotationForm.otherFee) > 0 || Number(quotationForm.transportFee) > 0
  return hasLineAmount || hasFees
})

// 格式化日期：YYYY-MM-DD
const formatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return '-'
  // 如果已经是 YYYY-MM-DD 格式，直接返回
  if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr
  }
  // 如果是日期对象或其他格式，尝试转换
  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return '-'
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  } catch {
    return dateStr || '-'
  }
}

// 格式化报价类型
const formatQuotationType = (type: string | null | undefined) => {
  if (type === '塑胶模具') return '塑胶模具'
  if (type === '修改模具') return '修改模具'
  if (type === '零件加工') return '零件加工'
  if (type === 'part') return '零件报价单'
  if (type === 'mold') return '改模报价单'
  return type || '-'
}

const resolveBusinessCategory = (
  quotationType: QuotationRecord['quotationType'] | string | null | undefined
) => {
  if (quotationType === '塑胶模具') return '塑胶模具'
  if (quotationType === '零件加工' || quotationType === 'part') return '零件加工'
  return '修改模具'
}

const getCategoryCodeFromQuotationType = (
  quotationType: QuotationRecord['quotationType'] | string | null | undefined
) => {
  const category = resolveBusinessCategory(quotationType)
  if (category === '塑胶模具') return '01'
  if (category === '零件加工') return '03'
  return '05'
}

const getCategoryFromProjectCode = (projectCode: string) => {
  const code = String(projectCode || '')
    .trim()
    .toUpperCase()
  if (/^JH01-\d{2}-\d{3}(\/\d{2})?$/.test(code)) return '塑胶模具'
  if (/^JH03-\d{2}-\d{3}(\/\d{2})?$/.test(code)) return '零件加工'
  if (/^JH05-\d{2}-\d{3}(\/\d{2})?$/.test(code)) return '修改模具'
  return ''
}

const normalizeInitiationStatus = (value: unknown) => String(value || '').trim() || '未发起'

type RowActionKey =
  | 'initiate'
  | 'viewInitiation'
  | 'editInitiation'
  | 'restartInitiation'
  | 'withdrawInitiation'
  | 'editQuotation'
  | 'deleteQuotation'

interface RowAction {
  key: RowActionKey
  label: string
  type: 'primary' | 'success' | 'warning' | 'danger' | 'info'
  plain?: boolean
  divided?: boolean
  danger?: boolean
}

const formatFinalProjectCodeDisplay = (
  quotationType: QuotationRecord['quotationType'] | string | null | undefined,
  finalProjectCodeInput: string | null | undefined,
  totalCount = 0
) => {
  const finalProjectCode = String(finalProjectCodeInput || '').trim()
  if (!finalProjectCode) return '-'
  const normalizedType = resolveBusinessCategory(quotationType)
  if (normalizedType !== '零件加工' || totalCount <= 1) return finalProjectCode

  const match = finalProjectCode.match(/^(.*)\/\d{2}$/)
  if (!match) return finalProjectCode
  return `${match[1]}（${totalCount}项）`
}

const getFinalProjectCodeDisplay = (row: QuotationRecord) => {
  const projectCount = Number(row.initiationProjectCount || 0)
  const fallbackCount = Array.isArray(row.partItems) ? row.partItems.length : 0
  return formatFinalProjectCodeDisplay(
    row.quotationType,
    row.finalProjectCode,
    projectCount > 0 ? projectCount : fallbackCount
  )
}

const getInitiationFinalProjectCodeDisplay = () => {
  const projectDetails = Array.isArray(initiationRequestRow.value?.project_draft?.projectDetails)
    ? initiationRequestRow.value?.project_draft?.projectDetails || []
    : []
  return formatFinalProjectCodeDisplay(
    initiationSourceQuotation.value?.quotationType,
    initiationRequestRow.value?.project_code_final ||
      initiationSourceQuotation.value?.finalProjectCode,
    projectDetails.length
  )
}

const canShowQuotationEditAction = (row: QuotationRecord) =>
  ['未发起', '草稿', '已驳回', '已撤回'].includes(normalizeInitiationStatus(row.initiationStatus))

const canShowQuotationDeleteAction = (row: QuotationRecord) =>
  ['未发起', '草稿', '已驳回', '已撤回'].includes(normalizeInitiationStatus(row.initiationStatus))

const canShowWithdrawInitiationAction = (row: QuotationRecord) =>
  ['草稿', '待客户审核', '审核中'].includes(normalizeInitiationStatus(row.initiationStatus))

const getPrimaryInitiationAction = (row: QuotationRecord): RowAction | null => {
  const status = normalizeInitiationStatus(row.initiationStatus)
  if (status === '未发起') return { key: 'initiate', label: '立项', type: 'warning' }
  if (status === '草稿') return { key: 'editInitiation', label: '继续立项', type: 'primary' }
  if (status === '待客户审核' || status === '审核中' || status === '已通过') {
    return { key: 'viewInitiation', label: '查看立项', type: 'warning', plain: true }
  }
  if (status === '已驳回') return { key: 'editInitiation', label: '编辑立项', type: 'primary' }
  if (status === '已撤回') return { key: 'restartInitiation', label: '重新发起', type: 'primary' }
  return null
}

const getSecondaryActions = (row: QuotationRecord): RowAction[] => {
  const status = normalizeInitiationStatus(row.initiationStatus)
  const primaryAction = getPrimaryInitiationAction(row)
  const actions: RowAction[] = []

  if (status !== '未发起' && primaryAction?.key !== 'viewInitiation') {
    actions.push({ key: 'viewInitiation', label: '查看立项', type: 'warning', plain: true })
  }
  if (canShowWithdrawInitiationAction(row)) {
    actions.push({ key: 'withdrawInitiation', label: '撤回申请', type: 'danger', plain: true })
  }
  if (canShowQuotationEditAction(row)) {
    actions.push({ key: 'editQuotation', label: '编辑', type: 'primary' })
  }
  if (canShowQuotationDeleteAction(row)) {
    actions.push({
      key: 'deleteQuotation',
      label: '删除',
      type: 'danger',
      divided: true,
      danger: true
    })
  }

  return actions
}

const executeRowAction = async (actionKey: RowActionKey, row: QuotationRecord) => {
  if (actionKey === 'initiate') {
    await handleInitiate(row)
    return
  }
  if (actionKey === 'viewInitiation') {
    await handleViewInitiation(row)
    return
  }
  if (actionKey === 'editInitiation') {
    await handleEditInitiation(row)
    return
  }
  if (actionKey === 'restartInitiation') {
    await handleRestartInitiation(row)
    return
  }
  if (actionKey === 'withdrawInitiation') {
    await handleWithdrawInitiation(row)
    return
  }
  if (actionKey === 'editQuotation') {
    await handleEdit(row)
    return
  }
  if (actionKey === 'deleteQuotation') {
    await handleDelete(row)
  }
}

const handlePrimaryInitiationAction = async (row: QuotationRecord) => {
  const action = getPrimaryInitiationAction(row)
  if (!action) return
  await executeRowAction(action.key, row)
}

const handleActionCommand = async (command: string | number | object, row: QuotationRecord) => {
  const actionKey = String(command || '') as RowActionKey
  if (!actionKey) return
  await executeRowAction(actionKey, row)
}

const todayText = () => {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

const formatCustomerPartNoWithSourceProjectCode = (
  customerPartNoInput: string | null | undefined,
  sourceProjectCodeInput: string | null | undefined
) => {
  const customerPartNo = String(customerPartNoInput || '').trim()
  const sourceProjectCode = String(sourceProjectCodeInput || '').trim()
  if (!customerPartNo) return null
  if (!sourceProjectCode) return customerPartNo
  const suffix = `（${sourceProjectCode}）`
  return customerPartNo.endsWith(suffix) ? customerPartNo : `${customerPartNo}${suffix}`
}

const buildDefaultInitiationDetails = (
  row: QuotationRecord,
  projectCode = ''
): QuotationInitiationSalesOrderDetailDraft[] => {
  const defaultRemark = String(row.remark || '').trim() || null
  const defaultHandler = String(row.operator || '').trim() || null

  if (resolveBusinessCategory(row.quotationType) === '零件加工') {
    const details = (row.partItems || []).map((item, index) => {
      const quantity = Number(item.quantity || 0)
      const unitPrice = Number(item.unitPrice || 0)
      return {
        key: `detail-${index + 1}`,
        name: String(row.partName || '').trim() || String(item.partName || '').trim() || '',
        itemCode: projectCode || '',
        productName: String(item.partName || '').trim() || String(row.partName || '').trim() || '',
        productDrawingNo: String(item.drawingNo || '').trim() || null,
        customerPartNo: formatCustomerPartNoWithSourceProjectCode(
          String(initiationForm.customerModelNo || '').trim() ||
            String(row.moldNo || '').trim() ||
            null,
          initiationForm.sourceProjectCode
        ),
        deliveryDate: null,
        quantity: quantity > 0 ? quantity : null,
        unitPrice: Number.isFinite(unitPrice) ? unitPrice : null,
        totalAmount:
          quantity > 0 && Number.isFinite(unitPrice)
            ? Number((quantity * unitPrice).toFixed(2))
            : null,
        remark: defaultRemark,
        costSource: null,
        handler: defaultHandler,
        isInStock: false,
        isShipped: false,
        shippingDate: null
      } as QuotationInitiationSalesOrderDetailDraft
    })
    return details
  }

  const quantity = Number(row.quantity || 0)
  const totalAmount = calcTaxIncludedPrice(row)
  const details = [
    {
      key: 'summary-1',
      name: String(row.partName || '').trim() || '',
      itemCode: projectCode || '',
      productName:
        String(initiationForm.productName || '').trim() || String(row.partName || '').trim() || '',
      productDrawingNo: String(initiationForm.productDrawing || '').trim() || null,
      customerPartNo: formatCustomerPartNoWithSourceProjectCode(
        String(initiationForm.customerModelNo || '').trim() ||
          String(row.moldNo || '').trim() ||
          null,
        initiationForm.sourceProjectCode
      ),
      deliveryDate: null,
      quantity: quantity > 0 ? quantity : null,
      unitPrice: quantity > 0 ? Number((totalAmount / quantity).toFixed(2)) : null,
      totalAmount: Number.isFinite(totalAmount) ? totalAmount : null,
      remark: defaultRemark,
      costSource: null,
      handler: defaultHandler,
      isInStock: false,
      isShipped: false,
      shippingDate: null
    } as QuotationInitiationSalesOrderDetailDraft
  ]
  return details
}

const buildDefaultInitiationProjectDetails = (
  row: QuotationRecord,
  projectCode = ''
): QuotationInitiationProjectDetailDraft[] => {
  if (resolveBusinessCategory(row.quotationType) === '零件加工') {
    const partItems = Array.isArray(row.partItems) ? row.partItems : []
    return partItems.map((item, index) => ({
      key: `project-${index + 1}`,
      projectCode: formatInitiationItemCode(
        row.quotationType,
        projectCode,
        index,
        partItems.length
      ),
      productName: String(item.partName || row.partName || '').trim() || '',
      productDrawing: String(item.drawingNo || '').trim() || null,
      customerModelNo:
        formatCustomerPartNoWithSourceProjectCode(
          String(initiationForm.customerModelNo || '').trim() ||
            String(row.moldNo || '').trim() ||
            null,
          initiationForm.sourceProjectCode
        ) || null
    }))
  }
  return [
    {
      key: 'project-1',
      projectCode: String(projectCode || '').trim(),
      productName: String(initiationForm.productName || row.partName || '').trim() || '',
      productDrawing: String(initiationForm.productDrawing || '').trim() || null,
      customerModelNo:
        formatCustomerPartNoWithSourceProjectCode(
          String(initiationForm.customerModelNo || '').trim() ||
            String(row.moldNo || '').trim() ||
            null,
          initiationForm.sourceProjectCode
        ) || null
    }
  ]
}

const syncProjectDetailsToSalesDetails = () => {
  if (resolveBusinessCategory(initiationSourceQuotation.value?.quotationType) !== '零件加工') return
  initiationSalesForm.details = initiationSalesForm.details.map((detail, index) => {
    const projectDetail = initiationProjectDetails.value[index]
    if (!projectDetail) return detail
    return {
      ...detail,
      itemCode: String(detail.itemCode || projectDetail.projectCode || '').trim(),
      productName:
        String(detail.productName || projectDetail.productName || '').trim() ||
        String(detail.name || '').trim() ||
        '',
      productDrawingNo:
        String(detail.productDrawingNo || projectDetail.productDrawing || '').trim() || null,
      customerPartNo:
        String(detail.customerPartNo || projectDetail.customerModelNo || '').trim() || null
    }
  })
}

const formatInitiationItemCode = (
  quotationType: QuotationRecord['quotationType'] | string | null | undefined,
  projectCode: string,
  index: number,
  total: number
) => {
  const baseCode = String(projectCode || '').trim()
  if (!baseCode) return ''
  if (resolveBusinessCategory(quotationType) !== '零件加工') return baseCode
  if (total <= 1) return baseCode
  return `${baseCode}/${String(index + 1).padStart(2, '0')}`
}

const getInitiationPrimaryProjectCode = () => {
  if (resolveBusinessCategory(initiationSourceQuotation.value?.quotationType) !== '零件加工') {
    return String(initiationForm.projectCode || '').trim()
  }
  return String(
    initiationProjectDetails.value[0]?.projectCode || initiationSalesForm.details[0]?.itemCode || ''
  ).trim()
}

const syncInitiationDetailItemCodes = (
  quotationType: QuotationRecord['quotationType'] | string | null | undefined,
  projectCode: string
) => {
  if (resolveBusinessCategory(quotationType) === '零件加工') return
  const total = initiationSalesForm.details.length
  initiationSalesForm.details = initiationSalesForm.details.map((detail, index) => ({
    ...detail,
    itemCode: formatInitiationItemCode(quotationType, projectCode, index, total)
  }))
}

const createEmptyInitiationDetail = (): QuotationInitiationSalesOrderDetailDraft => ({
  key: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  name: '',
  itemCode: '',
  productName: '',
  productDrawingNo: null,
  customerPartNo: null,
  deliveryDate: null,
  quantity: null,
  unitPrice: null,
  totalAmount: null,
  remark: String(initiationSourceQuotation.value?.remark || '').trim() || null,
  costSource: null,
  handler: String(initiationSourceQuotation.value?.operator || '').trim() || null,
  isInStock: false,
  isShipped: false,
  shippingDate: null
})

const buildInitiationFormsFromRow = (
  row: QuotationRecord,
  requestRow?: QuotationInitiationRequestRow | null
) => {
  const projectDraft = (requestRow?.project_draft || {}) as QuotationInitiationProjectDraft
  const salesDraft = (requestRow?.sales_order_draft || {}) as QuotationInitiationSalesOrderDraft
  const salesDraftDetails = Array.isArray(salesDraft.details) ? salesDraft.details : []
  const projectDraftDetails = Array.isArray(projectDraft.projectDetails)
    ? projectDraft.projectDetails
    : []
  const projectCode = String(
    projectDraft.projectCode ||
      projectDraftDetails[0]?.projectCode ||
      salesDraftDetails[0]?.itemCode ||
      ''
  ).trim()
  const category =
    getCategoryFromProjectCode(projectCode) || String(projectDraft.category || '').trim()
  initiationForm.projectCode = projectCode
  initiationForm.sourceProjectCode = String(
    projectDraft.sourceProjectCode || (row as any).sourceProjectCode || ''
  ).trim()
  initiationForm.category = category
  initiationForm.customerName = String(projectDraft.customerName || row.customerName || '').trim()
  initiationForm.productName = String(projectDraft.productName || row.partName || '').trim()
  initiationForm.productDrawing = String(projectDraft.productDrawing || '').trim()
  initiationForm.customerModelNo =
    formatCustomerPartNoWithSourceProjectCode(
      String(projectDraft.customerModelNo || row.moldNo || '').trim(),
      initiationForm.sourceProjectCode
    ) || ''
  initiationForm.customerId = Number(salesDraft.customerId || 0) || null
  initiationSalesForm.orderDate = String(salesDraft.orderDate || todayText()).trim() || todayText()
  initiationSalesForm.signDate = String(salesDraft.signDate || '').trim()
  initiationSalesForm.contractNo = String(salesDraft.contractNo || '').trim()
  initiationProjectDetails.value = projectDraftDetails.length
    ? projectDraftDetails.map((detail, index) => ({
        key: String(detail.key || `project-${index + 1}`),
        projectCode: String(detail.projectCode || '').trim(),
        productName: String(detail.productName || '').trim() || '',
        productDrawing: String(detail.productDrawing || '').trim() || null,
        customerModelNo:
          formatCustomerPartNoWithSourceProjectCode(
            String(detail.customerModelNo || '').trim() || null,
            initiationForm.sourceProjectCode
          ) || null
      }))
    : buildDefaultInitiationProjectDetails(row, initiationForm.projectCode)
  const details = salesDraftDetails.length
    ? salesDraftDetails.map((detail, index) => {
        const projectDetail = initiationProjectDetails.value[index]
        return {
          key: String(detail.key || `detail-${index + 1}`),
          name: detail.name || '',
          itemCode: String(detail.itemCode || projectDetail?.projectCode || '').trim(),
          productName:
            String(detail.productName || projectDetail?.productName || '').trim() ||
            String(detail.name || '').trim() ||
            '',
          productDrawingNo:
            String(detail.productDrawingNo || projectDetail?.productDrawing || '').trim() || null,
          customerPartNo:
            formatCustomerPartNoWithSourceProjectCode(
              String(detail.customerPartNo || projectDetail?.customerModelNo || '').trim() || null,
              initiationForm.sourceProjectCode
            ) || null,
          deliveryDate: detail.deliveryDate || null,
          quantity: detail.quantity ?? null,
          unitPrice: detail.unitPrice ?? null,
          totalAmount: detail.totalAmount ?? null,
          remark: detail.remark || null,
          costSource: detail.costSource || null,
          handler: detail.handler || null,
          isInStock: !!detail.isInStock,
          isShipped: !!detail.isShipped,
          shippingDate: detail.shippingDate || null
        }
      })
    : buildDefaultInitiationDetails(row, initiationForm.projectCode)
  initiationSalesForm.details = details
  syncInitiationDetailItemCodes(row.quotationType, initiationForm.projectCode)
  syncProjectDetailsToSalesDetails()
  initiationForm.projectCode = getInitiationPrimaryProjectCode()
}

const buildInitiationPayload = () => {
  const primaryProjectCode = getInitiationPrimaryProjectCode()
  const projectDraft: QuotationInitiationProjectDraft = {
    projectCode: primaryProjectCode || '',
    sourceProjectCode: String(initiationForm.sourceProjectCode || '').trim() || null,
    category: initiationForm.category || null,
    customerName: String(initiationForm.customerName || '').trim() || null,
    productName: String(initiationForm.productName || '').trim() || null,
    productDrawing: String(initiationForm.productDrawing || '').trim() || null,
    customerModelNo: String(initiationForm.customerModelNo || '').trim() || null,
    projectDetails: initiationProjectDetails.value.map((detail) => ({
      key: detail.key,
      projectCode: String(detail.projectCode || '').trim(),
      productName: String(detail.productName || '').trim() || null,
      productDrawing: String(detail.productDrawing || '').trim() || null,
      customerModelNo: String(detail.customerModelNo || '').trim() || null
    }))
  }
  const salesOrderDraft: QuotationInitiationSalesOrderDraft = {
    orderDate: String(initiationSalesForm.orderDate || '').trim() || null,
    signDate: String(initiationSalesForm.signDate || '').trim() || null,
    contractNo: String(initiationSalesForm.contractNo || '').trim() || null,
    customerId: initiationForm.customerId,
    details: initiationSalesForm.details.map((detail, index) => {
      const projectDetail = initiationProjectDetails.value[index]
      const itemCode =
        String(detail.itemCode || projectDetail?.projectCode || '').trim() ||
        primaryProjectCode ||
        null
      return {
        ...detail,
        itemCode,
        productName:
          String(detail.productName || projectDetail?.productName || '').trim() ||
          String(detail.name || '').trim() ||
          null,
        productDrawingNo:
          String(detail.productDrawingNo || projectDetail?.productDrawing || '').trim() || null,
        customerPartNo:
          String(detail.customerPartNo || projectDetail?.customerModelNo || '').trim() || null
      }
    })
  }
  return { projectDraft, salesOrderDraft }
}

const syncInitiationRawFieldsFromProject = async (
  projectCodeInput: string,
  options: { force?: boolean } = {}
) => {
  const sourceProjectCode = String(projectCodeInput || '').trim()
  if (!sourceProjectCode) return

  const token = ++initiationProjectGoodsSyncToken.value

  try {
    const response: any = await getQuotationProjectGoodsApi(sourceProjectCode)
    if (token !== initiationProjectGoodsSyncToken.value) return

    let data: any = null
    if (response?.data?.data) {
      data = response.data.data
    } else if (response?.data) {
      data = response.data
    } else {
      data = response
    }

    if (!data) return

    const productDrawing = String(data.productDrawing || '').trim()
    const productName = String(data.productName || '').trim()
    const customerModelNo = String(data.customerModelNo || '').trim()
    const shouldOverwrite = !!options.force

    if (shouldOverwrite || !String(initiationForm.productName || '').trim()) {
      initiationForm.productName = productName
    }
    if (shouldOverwrite || !String(initiationForm.productDrawing || '').trim()) {
      initiationForm.productDrawing = productDrawing
    }
    if (shouldOverwrite || !String(initiationForm.customerModelNo || '').trim()) {
      initiationForm.customerModelNo =
        formatCustomerPartNoWithSourceProjectCode(
          customerModelNo,
          initiationForm.sourceProjectCode
        ) || ''
    }

    initiationSalesForm.details = initiationSalesForm.details.map((detail) => ({
      ...detail,
      itemCode:
        String(detail.itemCode || '').trim() ||
        String(initiationForm.projectCode || '').trim() ||
        '',
      productName:
        (shouldOverwrite ? '' : String(detail.productName || '').trim()) ||
        productName ||
        String(detail.name || '').trim() ||
        '',
      productDrawingNo:
        (shouldOverwrite ? '' : String(detail.productDrawingNo || '').trim()) ||
        productDrawing ||
        null,
      customerPartNo: formatCustomerPartNoWithSourceProjectCode(
        (shouldOverwrite ? '' : String(detail.customerPartNo || '').trim()) ||
          customerModelNo ||
          null,
        initiationForm.sourceProjectCode
      )
    }))
  } catch (error) {
    console.error('同步立项原始字段失败:', error)
  }
}

// 获取客户列表
const fetchCustomerList = async () => {
  try {
    customerLoading.value = true
    const response = await getQuotationCustomerOptionsApi({ status: 'active' })

    if (response && response.data && response.data.list) {
      customerList.value = response.data.list
    } else {
      ElMessage.error('获取客户列表失败')
    }
  } catch (error) {
    console.error('获取客户列表失败:', error)
    ElMessage.error('获取客户列表失败')
  } finally {
    customerLoading.value = false
  }
}

// 加载报价单列表
const loadQuotations = async () => {
  try {
    loading.value = true
    const response = await getQuotationListApi({
      keyword: queryForm.keyword,
      quotationType: queryForm.quotationType,
      initiationStatus: queryForm.initiationStatus,
      finalProjectCode: queryForm.finalProjectCode,
      page: pagination.page,
      pageSize: pagination.pageSize
    })

    const pr: any = response
    if (pr?.code === 0 || pr?.success === true) {
      quotations.value = pr.data?.list || []
      total.value = pr.data?.total || 0
    } else {
      ElMessage.error(pr?.message || '获取报价单列表失败')
    }
  } catch (error: any) {
    console.error('加载报价单列表失败:', error)
    ElMessage.error('加载报价单列表失败')
  } finally {
    loading.value = false
  }
}

// 查询
const handleSearch = () => {
  pagination.page = 1
  loadQuotations()
}

const handleReset = () => {
  queryForm.keyword = ''
  queryForm.quotationType = ''
  queryForm.initiationStatus = ''
  queryForm.finalProjectCode = ''
  pagination.page = 1
  loadQuotations()
}

// 新增
const handleCreate = async (initialType: 'mold' | 'part' = 'mold') => {
  try {
    dialogMode.value = 'create'
    dialogTitle.value = initialType === 'part' ? '新增零件报价单' : '新增改模报价单'
    Object.assign(quotationForm, createEmptyForm())

    // 生成新的报价单编号
    const response = await generateQuotationNoApi()
    const raw: any = response
    const pr: any = raw?.data ?? raw
    const newQuotationNo = pr?.quotationNo || ''

    if (!newQuotationNo) {
      ElMessage.error('生成报价单号失败')
      return
    }

    await fetchCustomerList()

    // 先打开选择弹窗：报价单号 / 报价日期 / 客户名称
    preCreateForm.quotationType = initialType
    preCreateForm.quotationNo = newQuotationNo
    preCreateForm.customerName = ''
    const today = new Date()
    preCreateForm.quotationDate = today.toISOString().split('T')[0]
    preCreateDialogVisible.value = true
    await nextTick()
    preCreateFormRef.value?.clearValidate?.()
  } catch (error) {
    console.error('打开新建对话框失败:', error)
    ElMessage.error('打开新建对话框失败')
  }
}

const handleConfirmPreCreate = async () => {
  if (!preCreateFormRef.value) return
  try {
    await preCreateFormRef.value.validate()
  } catch {
    return
  }

  const typedCustomerName = (preCreateForm.customerName || '').trim()
  const isKnownCustomer =
    !typedCustomerName ||
    customerList.value.some((c) => (c.customerName || '').trim() === typedCustomerName)
  if (!isKnownCustomer) {
    try {
      await ElMessageBox.confirm(`客户【${typedCustomerName}】不在客户档案中，是否继续？`, '提示', {
        confirmButtonText: '继续',
        cancelButtonText: '取消',
        type: 'warning'
      })
    } catch {
      return
    }
  }

  quotationForm.quotationNo = preCreateForm.quotationNo
  quotationForm.quotationDate = preCreateForm.quotationDate
  quotationForm.customerName = typedCustomerName
  quotationForm.quotationType = preCreateForm.quotationType === 'part' ? 'part' : 'mold'
  dialogTitle.value = quotationForm.quotationType === 'part' ? '新增零件报价单' : '新增改模报价单'
  quotationForm.enableImage = quotationForm.quotationType === 'part'

  preCreateDialogVisible.value = false
  dialogVisible.value = true

  if (quotationForm.quotationType === 'part' && quotationForm.partItems.length === 0) {
    quotationForm.otherFee = undefined
    quotationForm.transportFee = undefined
    otherFeeText.value = undefined
    transportFeeText.value = undefined
    handleAddPartItem()
  }
}

// 编辑
const handleEdit = async (row: QuotationRecord) => {
  if (!canShowQuotationEditAction(row)) {
    ElMessage.warning(`当前立项状态不允许编辑：${normalizeInitiationStatus(row.initiationStatus)}`)
    return
  }
  dialogMode.value = 'edit'
  dialogTitle.value = '编辑报价单'
  const normalizedType = row.quotationType === 'part' ? 'part' : 'mold'
  const rawEnableImage = (row as any).enableImage
  const effectiveEnableImage =
    normalizedType === 'part'
      ? rawEnableImage === undefined
        ? true
        : Boolean(Number(rawEnableImage))
      : false
  Object.assign(quotationForm, {
    ...row,
    quotationType: normalizedType,
    enableImage: effectiveEnableImage,
    processingDate: row.processingDate || '',
    changeOrderNo: row.changeOrderNo || '',
    sourceProjectCode: String((row as any).sourceProjectCode || '').trim(),
    partName: row.partName || '',
    moldNo: row.moldNo || '',
    department: row.department || '',
    applicant: row.applicant || '',
    contactName: (row as any).contactName || '',
    contactPhone: (row as any).contactPhone || '',
    operator: (row as any).operator || '',
    remark: (row as any).remark || '',
    deliveryTerms: (row as any).deliveryTerms || '',
    paymentTerms: (row as any).paymentTerms || '',
    validityDays: (row as any).validityDays ?? undefined,
    partItems: (row.partItems || []).map((p, idx) => ({
      lineNo: idx + 1,
      partName: p.partName || '',
      drawingNo: p.drawingNo || '',
      material: p.material || '',
      process: (p as any).process || '',
      imageUrl: (p as any).imageUrl || '',
      imageScale: normalizeImageScale((p as any).imageScale),
      quantity: p.quantity === null || p.quantity === undefined ? undefined : Number(p.quantity),
      unitPrice: p.unitPrice === null || p.unitPrice === undefined ? undefined : Number(p.unitPrice)
    })),
    materials: (row.materials || []).map((m) => ({ ...m })),
    processes: (row.processes || []).map((p) => ({ ...p }))
  })
  await fetchCustomerList()
  dialogVisible.value = true
}

// 查看
const handleView = async (row: QuotationRecord) => {
  dialogMode.value = 'view'
  dialogTitle.value = '查看报价单'
  const normalizedType = row.quotationType === 'part' ? 'part' : 'mold'
  const rawEnableImage = (row as any).enableImage
  const effectiveEnableImage =
    normalizedType === 'part'
      ? rawEnableImage === undefined
        ? true
        : Boolean(Number(rawEnableImage))
      : false
  Object.assign(quotationForm, {
    ...row,
    quotationType: normalizedType,
    enableImage: effectiveEnableImage,
    processingDate: row.processingDate || '',
    changeOrderNo: row.changeOrderNo || '',
    sourceProjectCode: String((row as any).sourceProjectCode || '').trim(),
    partName: row.partName || '',
    moldNo: row.moldNo || '',
    department: row.department || '',
    applicant: row.applicant || '',
    contactName: (row as any).contactName || '',
    contactPhone: (row as any).contactPhone || '',
    operator: (row as any).operator || '',
    remark: (row as any).remark || '',
    deliveryTerms: (row as any).deliveryTerms || '',
    paymentTerms: (row as any).paymentTerms || '',
    validityDays: (row as any).validityDays ?? undefined,
    partItems: (row.partItems || []).map((p, idx) => ({
      lineNo: idx + 1,
      partName: p.partName || '',
      drawingNo: p.drawingNo || '',
      material: p.material || '',
      process: (p as any).process || '',
      imageUrl: (p as any).imageUrl || '',
      imageScale: normalizeImageScale((p as any).imageScale),
      quantity: p.quantity === null || p.quantity === undefined ? undefined : Number(p.quantity),
      unitPrice: p.unitPrice === null || p.unitPrice === undefined ? undefined : Number(p.unitPrice)
    })),
    materials: (row.materials || []).map((m) => ({ ...m })),
    processes: (row.processes || []).map((p) => ({ ...p }))
  })
  await fetchCustomerList()
  dialogVisible.value = true
}

const buildQuotationUpdatePayloadFromRow = (row: QuotationRecord): QuotationFormData => ({
  quotationNo: String(row.quotationNo || '').trim(),
  quotationDate: String(row.quotationDate || '').trim(),
  customerName: String(row.customerName || '').trim(),
  quotationType: (row.quotationType || 'mold') as QuotationFormData['quotationType'],
  enableImage: Boolean((row as any).enableImage),
  processingDate: String(row.processingDate || '').trim(),
  changeOrderNo: String(row.changeOrderNo || '').trim(),
  sourceProjectCode: String((row as any).sourceProjectCode || '').trim(),
  partName: String(row.partName || '').trim(),
  moldNo: String(row.moldNo || '').trim(),
  department: String(row.department || '').trim(),
  applicant: String(row.applicant || '').trim(),
  contactName: String((row as any).contactName || '').trim(),
  contactPhone: String((row as any).contactPhone || '').trim(),
  operator: String((row as any).operator || '').trim(),
  remark: String((row as any).remark || '').trim(),
  deliveryTerms: String((row as any).deliveryTerms || '').trim(),
  paymentTerms: String((row as any).paymentTerms || '').trim(),
  validityDays: (row as any).validityDays ?? null,
  materials: Array.isArray(row.materials) ? row.materials.map((item) => ({ ...item })) : [],
  processes: Array.isArray(row.processes) ? row.processes.map((item) => ({ ...item })) : [],
  partItems: Array.isArray(row.partItems)
    ? row.partItems.map((item) => ({
        partName: item.partName,
        drawingNo: item.drawingNo,
        material: item.material,
        process: (item as any).process || '',
        imageUrl: (item as any).imageUrl || '',
        imageScale: normalizeImageScale((item as any).imageScale),
        quantity: Number(item.quantity || 0),
        unitPrice: Number(item.unitPrice || 0)
      }))
    : [],
  otherFee: Number(row.otherFee || 0),
  transportFee: Number(row.transportFee || 0),
  quantity: Number(row.quantity || 1) || 1
})

const syncLocalQuotationRow = (nextRow: Partial<QuotationRecord> & { id: number }) => {
  const index = quotations.value.findIndex((item) => item.id === nextRow.id)
  if (index >= 0) {
    quotations.value[index] = {
      ...quotations.value[index],
      ...nextRow
    }
  }
  if (initiationSourceQuotation.value?.id === nextRow.id) {
    initiationSourceQuotation.value = {
      ...initiationSourceQuotation.value,
      ...nextRow
    }
  }
}

const syncQuotationCustomerNameImmediately = async (row: QuotationRecord, customerName: string) => {
  const nextCustomerName = String(customerName || '').trim()
  if (!nextCustomerName || nextCustomerName === String(row.customerName || '').trim()) return
  const payload = buildQuotationUpdatePayloadFromRow({
    ...row,
    customerName: nextCustomerName
  } as QuotationRecord)
  await updateQuotationApi(row.id, payload)
  syncLocalQuotationRow({ id: row.id, customerName: nextCustomerName })
}

const validateInitiationProjectCode = async () => {
  const row = initiationSourceQuotation.value
  initiationProjectCodeError.value = ''
  if (!row) return false
  const isPart = resolveBusinessCategory(row.quotationType) === '零件加工'
  const projectCodes = isPart
    ? initiationProjectDetails.value.map((detail) => String(detail.projectCode || '').trim())
    : [String(initiationForm.projectCode || '').trim()]
  if (projectCodes.some((code) => !code)) {
    initiationProjectCodeError.value = '项目编号不能为空'
    return false
  }
  if (initiationProjectCodeFormatError.value) {
    initiationProjectCodeError.value = initiationProjectCodeFormatError.value
    return false
  }
  if (new Set(projectCodes).size !== projectCodes.length) {
    initiationProjectCodeError.value =
      initiationDuplicateProjectCodeError.value || '项目编号不能重复'
    return false
  }
  initiationForm.category = getCategoryFromProjectCode(projectCodes[0] || '')
  initiationSalesForm.details = initiationSalesForm.details.map((detail) => ({
    ...detail,
    itemCode: String(detail.itemCode || '').trim()
  }))
  syncInitiationDetailItemCodes(row.quotationType, projectCodes[0] || '')
  initiationProjectCodeChecking.value = true
  try {
    for (const projectCode of projectCodes) {
      const res = await checkQuotationInitiationProjectCodeApi({
        quotationId: row.id,
        projectCode,
        quotationType: row.quotationType || 'mold'
      })
      initiationForm.category = String(res.data?.category || '').trim()
    }
    initiationForm.projectCode = getInitiationPrimaryProjectCode()
    return true
  } catch (error: any) {
    initiationProjectCodeError.value = error?.message || '项目编号校验失败'
    initiationForm.category = ''
    return false
  } finally {
    initiationProjectCodeChecking.value = false
  }
}

const handleInitiationProjectCodeBlur = async () => {
  if (resolveBusinessCategory(initiationSourceQuotation.value?.quotationType) === '零件加工') return
  if (!String(initiationForm.projectCode || '').trim()) return
  await validateInitiationProjectCode()
}

const handleInitiationCustomerBlur = async () => {
  const row = initiationSourceQuotation.value
  const customerName = String(initiationForm.customerName || '').trim()
  initiationCustomerMatched.value = false
  initiationCustomerLocked.value = false
  initiationForm.customerId = null
  if (!row || !customerName) return

  try {
    await syncQuotationCustomerNameImmediately(row, customerName)
  } catch (error: any) {
    ElMessage.error(error?.message || '同步客户名称到报价单失败')
    return
  }

  const match = customerList.value.find(
    (item) => String(item.customerName || '').trim() === customerName
  )
  if (match) {
    initiationCustomerMatched.value = true
    initiationCustomerLocked.value = true
    initiationForm.customerId = Number(match.id || 0) || null
    return
  }

  initiationCustomerMatched.value = false
  initiationCustomerLocked.value = false
  initiationForm.customerId = null
  ElMessage.warning('当前客户未匹配到客户档案，可发起新增客户名称审核申请')
}

const recommendInitiationProjectCode = async () => {
  const row = initiationSourceQuotation.value
  if (!row) return
  initiationRecommendingCode.value = true
  try {
    const categoryCode = getCategoryCodeFromQuotationType(row.quotationType)
    const yy = String(new Date().getFullYear()).slice(-2)
    const res: any = await getMaxSerialApi(categoryCode)
    let serial = Number(res?.data?.nextSerial ?? (res?.data?.maxSerial || 0) + 1)
    if (!(serial > 0)) serial = 1
    let pickedCode = ''
    for (let i = 0; i < 200; i += 1) {
      const candidate = `JH${categoryCode}-${yy}-${String(serial + i).padStart(3, '0')}`
      try {
        await checkQuotationInitiationProjectCodeApi({
          quotationId: row.id,
          projectCode: candidate,
          quotationType: row.quotationType || 'mold'
        })
        pickedCode = candidate
        break
      } catch (e) {
        // Try next serial when the current project code is occupied or invalid.
      }
    }
    if (!pickedCode) {
      ElMessage.error('推荐项目编号失败，请手工填写')
      return
    }
    initiationForm.category = getCategoryFromProjectCode(pickedCode)
    initiationProjectCodeError.value = ''
    if (resolveBusinessCategory(row.quotationType) === '零件加工') {
      const total = initiationProjectDetails.value.length
      initiationProjectDetails.value = initiationProjectDetails.value.map((detail, index) => ({
        ...detail,
        projectCode: formatInitiationItemCode(row.quotationType, pickedCode, index, total)
      }))
      syncProjectDetailsToSalesDetails()
      initiationForm.projectCode = getInitiationPrimaryProjectCode()
    } else {
      initiationForm.projectCode = pickedCode
      syncInitiationDetailItemCodes(row.quotationType, pickedCode)
    }
  } catch (error: any) {
    ElMessage.error(error?.message || '推荐项目编号失败')
  } finally {
    initiationRecommendingCode.value = false
  }
}

const openInitiationDialog = async (row: QuotationRecord, mode: InitiationDialogMode) => {
  initiationDialogMode.value = mode
  initiationSourceQuotation.value = { ...row }
  initiationDialogVisible.value = true
  initiationDialogLoading.value = true
  initiationRequestRow.value = null
  initiationProjectCodeError.value = ''
  initiationCustomerMatched.value = false
  initiationCustomerLocked.value = false
  try {
    await fetchCustomerList()
    const res = await getQuotationInitiationRequestApi({ quotationId: row.id })
    initiationRequestRow.value = res.data || null
    buildInitiationFormsFromRow(row, initiationRequestRow.value)
    if (!getInitiationPrimaryProjectCode() && mode !== 'view') {
      await recommendInitiationProjectCode()
    }
    await syncInitiationRawFieldsFromProject(initiationForm.sourceProjectCode, { force: true })
    const match = customerList.value.find(
      (item) =>
        String(item.customerName || '').trim() === String(initiationForm.customerName || '').trim()
    )
    if (match) {
      initiationCustomerMatched.value = true
      initiationCustomerLocked.value = true
      initiationForm.customerId = Number(match.id || 0) || null
    }
  } catch (error: any) {
    ElMessage.error(error?.message || '读取立项信息失败')
    initiationDialogVisible.value = false
  } finally {
    initiationDialogLoading.value = false
  }
}

const handleInitiate = async (row: QuotationRecord) => {
  await openInitiationDialog(row, 'create')
}

const handleViewInitiation = async (row: QuotationRecord) => {
  await openInitiationDialog(row, 'view')
}

const handleEditInitiation = async (row: QuotationRecord) => {
  await openInitiationDialog(row, 'edit')
}

const handleRestartInitiation = async (row: QuotationRecord) => {
  await openInitiationDialog(row, 'restart')
}

const handleWithdrawInitiation = async (row: QuotationRecord) => {
  const status = normalizeInitiationStatus(row.initiationStatus)
  let reason = ''
  try {
    if (status === '审核中') {
      const promptRes = await ElMessageBox.prompt('请输入撤回原因', '撤回申请', {
        confirmButtonText: '确认撤回',
        cancelButtonText: '取消',
        inputType: 'textarea',
        inputValidator: (value) => (String(value || '').trim() ? true : '请输入撤回原因')
      })
      reason = String(promptRes.value || '').trim()
    } else {
      await ElMessageBox.confirm('确认撤回当前立项申请？', '撤回申请', {
        confirmButtonText: '确认撤回',
        cancelButtonText: '取消',
        type: 'warning'
      })
    }
    await withdrawQuotationInitiationApi({ quotationId: row.id, reason })
    ElMessage.success('已撤回')
    await loadQuotations()
  } catch (error: any) {
    if (error === 'cancel' || error?.action === 'cancel' || error?.action === 'close') return
    ElMessage.error(error?.message || '撤回立项申请失败')
  }
}

const addInitiationDetail = () => {
  initiationSalesForm.details.push(createEmptyInitiationDetail())
  if (resolveBusinessCategory(initiationSourceQuotation.value?.quotationType) === '零件加工') {
    initiationProjectDetails.value.push({
      key: `project-manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      projectCode: '',
      productName: '',
      productDrawing: null,
      customerModelNo: null
    })
    syncProjectDetailsToSalesDetails()
  } else {
    syncInitiationDetailItemCodes(
      initiationSourceQuotation.value?.quotationType,
      initiationForm.projectCode
    )
  }
}

const removeInitiationProjectDetail = async (index: number) => {
  initiationProjectDetails.value.splice(index, 1)
  initiationSalesForm.details.splice(index, 1)
  initiationForm.projectCode = getInitiationPrimaryProjectCode()
  if (
    resolveBusinessCategory(initiationSourceQuotation.value?.quotationType) === '零件加工' &&
    initiationProjectDetails.value.length
  ) {
    await recommendInitiationProjectCode()
  }
}

const recalcInitiationDetailTotal = (detail: QuotationInitiationSalesOrderDetailDraft) => {
  const quantity = Number(detail.quantity || 0)
  const unitPrice = Number(detail.unitPrice || 0)
  if (!(quantity > 0) || !Number.isFinite(unitPrice)) {
    detail.totalAmount = null
    return
  }
  detail.totalAmount = Number((quantity * unitPrice).toFixed(2))
}

const isInitiationViewMode = computed(() => initiationDialogMode.value === 'view')
const canShowCustomerReviewAction = computed(() => {
  if (isInitiationViewMode.value) return false
  return !initiationCustomerMatched.value && !!String(initiationForm.customerName || '').trim()
})
const initiationProjectCodeFormatError = computed(() => {
  const row = initiationSourceQuotation.value
  if (!row) return ''
  const expectedCategory = resolveBusinessCategory(row.quotationType)
  const projectCodes =
    expectedCategory === '零件加工'
      ? initiationProjectDetails.value.map((detail) => String(detail.projectCode || '').trim())
      : [String(initiationForm.projectCode || '').trim()]
  for (const code of projectCodes) {
    if (!code) continue
    if (!/^JH(01|03|05)-\d{2}-\d{3}(\/\d{2})?$/.test(code)) {
      return `项目编号格式不合法：${code}`
    }
    const category = getCategoryFromProjectCode(code)
    if (!category || category !== expectedCategory) {
      return `项目编号与报价单分类不一致：${code}`
    }
  }
  return ''
})
const initiationDuplicateProjectCodeError = computed(() => {
  if (resolveBusinessCategory(initiationSourceQuotation.value?.quotationType) !== '零件加工') {
    return ''
  }
  const counter = new Map<string, number>()
  initiationProjectDetails.value.forEach((detail) => {
    const code = String(detail.projectCode || '').trim()
    if (!code) return
    counter.set(code, (counter.get(code) || 0) + 1)
  })
  const duplicatedCode = Array.from(counter.entries()).find(([, count]) => count > 1)?.[0]
  return duplicatedCode ? `项目编号重复：${duplicatedCode}` : ''
})

const saveInitiationDraft = async () => {
  const row = initiationSourceQuotation.value
  if (!row) return
  const isPart = resolveBusinessCategory(row.quotationType) === '零件加工'
  const hasProjectCode = isPart
    ? initiationProjectDetails.value.every((detail) => !!String(detail.projectCode || '').trim())
    : !!String(initiationForm.projectCode || '').trim()
  if (!hasProjectCode) {
    ElMessage.error('项目编号不能为空')
    return
  }
  if (initiationProjectCodeFormatError.value) {
    ElMessage.error(initiationProjectCodeFormatError.value)
    return
  }
  if (initiationDuplicateProjectCodeError.value) {
    ElMessage.error(initiationDuplicateProjectCodeError.value)
    return
  }
  const projectCodeOk = await validateInitiationProjectCode()
  if (!projectCodeOk) {
    ElMessage.error(initiationProjectCodeError.value || '项目编号校验失败')
    return
  }
  if (!String(initiationForm.customerName || '').trim()) {
    ElMessage.error('客户名称不能为空')
    return
  }
  initiationDialogSaving.value = true
  try {
    const payload = buildInitiationPayload()
    const res = await saveQuotationInitiationDraftApi({
      quotationId: row.id,
      ...payload
    })
    initiationRequestRow.value = res.data || null
    buildInitiationFormsFromRow(
      { ...(initiationSourceQuotation.value as QuotationRecord) },
      initiationRequestRow.value
    )
    ElMessage.success('草稿已保存')
    await loadQuotations()
  } catch (error: any) {
    ElMessage.error(error?.message || '保存立项草稿失败')
  } finally {
    initiationDialogSaving.value = false
  }
}

const submitInitiationReview = async () => {
  const row = initiationSourceQuotation.value
  if (!row) return
  const isPart = resolveBusinessCategory(row.quotationType) === '零件加工'
  const hasProjectCode = isPart
    ? initiationProjectDetails.value.every((detail) => !!String(detail.projectCode || '').trim())
    : !!String(initiationForm.projectCode || '').trim()
  if (!hasProjectCode) {
    ElMessage.error('项目编号不能为空')
    return
  }
  if (initiationProjectCodeFormatError.value) {
    ElMessage.error(initiationProjectCodeFormatError.value)
    return
  }
  if (initiationDuplicateProjectCodeError.value) {
    ElMessage.error(initiationDuplicateProjectCodeError.value)
    return
  }
  const projectCodeOk = await validateInitiationProjectCode()
  if (!projectCodeOk) {
    ElMessage.error(initiationProjectCodeError.value || '项目编号校验失败')
    return
  }
  if (!String(initiationForm.customerName || '').trim()) {
    ElMessage.error('客户名称不能为空')
    return
  }
  if (!initiationCustomerMatched.value || !initiationForm.customerId) {
    ElMessage.error('客户未匹配，请先发起客户新增审核申请')
    return
  }
  if (!String(initiationSalesForm.orderDate || '').trim()) {
    ElMessage.error('订单日期不能为空')
    return
  }
  if (!initiationSalesForm.details.length) {
    ElMessage.error('订单明细不能为空')
    return
  }
  const invalidDetail = initiationSalesForm.details.find(
    (detail) =>
      !(Number(detail.quantity || 0) > 0) ||
      !Number.isFinite(Number(detail.unitPrice)) ||
      !Number.isFinite(Number(detail.totalAmount))
  )
  if (invalidDetail) {
    ElMessage.error('订单明细数量/单价/总金额不能为空')
    return
  }
  initiationDialogSubmitting.value = true
  try {
    const payload = buildInitiationPayload()
    const res = await submitQuotationInitiationApi({
      quotationId: row.id,
      ...payload
    })
    initiationRequestRow.value = res.data || null
    ElMessage.success('已提交审核')
    initiationDialogVisible.value = false
    await loadQuotations()
  } catch (error: any) {
    ElMessage.error(error?.message || '提交审核失败')
  } finally {
    initiationDialogSubmitting.value = false
  }
}

const requestCustomerReview = async () => {
  const row = initiationSourceQuotation.value
  const customerName = String(initiationForm.customerName || '').trim()
  if (!row || !customerName) {
    ElMessage.error('客户名称不能为空')
    return
  }
  initiationRequestingCustomerReview.value = true
  try {
    await requestQuotationInitiationCustomerReviewApi({
      quotationId: row.id,
      customerName
    })
    ElMessage.success('客户新增审核申请已提交')
    await loadQuotations()
    const res = await getQuotationInitiationRequestApi({ quotationId: row.id })
    initiationRequestRow.value = res.data || null
  } catch (error: any) {
    ElMessage.error(error?.message || '提交客户新增审核申请失败')
  } finally {
    initiationRequestingCustomerReview.value = false
  }
}

// 下载当前报价单的 报价 PDF 文件
const handleDownloadQuotationPdf = async () => {
  if (!quotationForm.id) {
    ElMessage.warning('请先保存报价单后再下载')
    return
  }

  try {
    downloading.value = true
    ElMessage.info('正在生成报价单 PDF，请稍候...')

    const resp = await downloadQuotationPdfApi(quotationForm.id)
    const blob = (resp as any)?.data ?? resp
    const url = window.URL.createObjectURL(blob as Blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${quotationForm.quotationNo || '报价单'}报价.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  } catch (error) {
    console.error('下载报价单 PDF 失败:', error)
    ElMessage.error('下载报价单失败')
  } finally {
    downloading.value = false
  }
}

// 下载当前报价单的 完工单 PDF 文件
const handleDownloadCompletionPdf = async () => {
  if (!quotationForm.id) {
    ElMessage.warning('请先保存报价单后再下载')
    return
  }

  if (quotationForm.quotationType === 'part') {
    ElMessage.warning('零件报价单不支持完工单下载')
    return
  }

  const missingFields: string[] = []
  if (!quotationForm.processingDate) missingFields.push('加工日期')
  if (!quotationForm.partName || !quotationForm.partName.trim()) missingFields.push('加工零件名称')
  // 模具编号、申请更改部门改为非必填

  if (missingFields.length > 0) {
    ElMessage.error(`完工单下载前请先填写：${missingFields.join('、')}`)
    return
  }

  try {
    downloading.value = true
    ElMessage.info('正在生成完工单 PDF，请稍候...')

    const resp = await downloadQuotationCompletionPdfApi(quotationForm.id)
    const blob = (resp as any)?.data ?? resp
    const url = window.URL.createObjectURL(blob as Blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${quotationForm.quotationNo || '报价单'}完工单.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  } catch (error) {
    console.error('下载完工单 PDF 失败:', error)
    ElMessage.error('下载完工单失败')
  } finally {
    downloading.value = false
  }
}

const handleAddPartItem = () => {
  const nextLineNo =
    quotationForm.partItems.length > 0
      ? Math.max(...quotationForm.partItems.map((i) => i.lineNo || 0)) + 1
      : 1
  quotationForm.partItems.push({
    lineNo: nextLineNo,
    partName: '',
    drawingNo: '',
    material: '',
    process: '',
    imageUrl: '',
    imageScale: 1,
    quantity: undefined,
    unitPrice: undefined
  })
}

const handleRemovePartItem = (index: number) => {
  quotationForm.partItems.splice(index, 1)
  quotationForm.partItems = quotationForm.partItems.map((item, idx) => ({
    ...item,
    lineNo: idx + 1,
    unitPriceText: undefined
  }))
  Object.keys(partImageUploading).forEach((key) => {
    delete partImageUploading[Number(key)]
  })
}

// 项目代入对话框分页
const handleProjectImportPageChange = (page: number) => {
  projectSearchPage.value = page
  searchProjectsForImport()
}

// 查询项目列表（仅分类为「塑胶模具」，在货物信息表中按 项目编号 / 产品名称 / 产品图号 模糊查询）
const searchProjectsForImport = async () => {
  const keyword = projectSearchKeyword.value.trim()

  if (!keyword) {
    projectSearchResults.value = []
    projectSearchTotal.value = 0
    return
  }

  projectSearchLoading.value = true
  try {
    const listParams: any = {
      keyword,
      category: '塑胶模具',
      page: projectSearchPage.value,
      pageSize: projectSearchPageSize.value
    }

    const listResponse: any = await getQuotationProjectOptionsApi(listParams)

    let projectList: any[] = []
    let total = 0

    if (listResponse?.data?.data) {
      const payload = listResponse.data.data
      projectList = payload.list || []
      total = payload.total || 0
      if (typeof payload.page === 'number') {
        projectSearchPage.value = payload.page
      }
      if (typeof payload.pageSize === 'number') {
        projectSearchPageSize.value = payload.pageSize
      }
    } else if (listResponse?.data?.list) {
      projectList = listResponse.data.list || []
      total = listResponse.data.total || projectList.length || 0
    } else if (Array.isArray(listResponse?.list)) {
      projectList = listResponse.list
      total = projectList.length
    }

    projectSearchResults.value = projectList || []
    projectSearchTotal.value = total
  } catch (error) {
    console.error('按项目代入查询失败:', error)
    ElMessage.error('按项目代入查询失败')
    projectSearchResults.value = []
    projectSearchTotal.value = 0
  } finally {
    projectSearchLoading.value = false
  }
}

// 根据项目编号代入项目信息（产品图号 → 加工零件名称，客户模号 → 模具编号）
const handleImportFromProject = async () => {
  projectSearchKeyword.value = ''
  projectSearchResults.value = []
  projectSearchPage.value = 1
  projectSearchTotal.value = 0
  projectImportDialogVisible.value = true
}

// 选中某个项目后代入到表单
const handleSelectProjectForImport = async (row: any) => {
  const projectCode = row?.项目编号 || row?.projectCode || ''
  if (!projectCode) {
    ElMessage.error('无法获取项目编号')
    return
  }

  try {
    importingProject.value = true

    const response: any = await getQuotationProjectGoodsApi(projectCode)

    let data: any = null
    if (response?.data?.data) {
      data = response.data.data
    } else if (response?.data) {
      data = response.data
    } else {
      data = response
    }

    if (!data) {
      ElMessage.warning('未找到对应的项目信息，请检查项目编号')
      return
    }

    const productDrawing: string = data.productDrawing || ''
    const productName: string = data.productName || ''
    const customerModelNo: string = data.customerModelNo || ''

    if (!productDrawing && !productName && !customerModelNo) {
      ElMessage.warning('该项目没有可用的“产品图号 / 产品名称 / 客户模号”信息')
      return
    }

    const partNameValue = [productDrawing, productName].filter((v) => v && v.trim()).join(' ')

    // 直接覆盖当前表单中的值
    quotationForm.partName = partNameValue
    quotationForm.sourceProjectCode = projectCode
    quotationForm.moldNo = customerModelNo
    initiationForm.sourceProjectCode = projectCode
    initiationForm.productName = productName
    initiationForm.productDrawing = productDrawing
    initiationForm.customerModelNo =
      formatCustomerPartNoWithSourceProjectCode(
        customerModelNo,
        initiationForm.sourceProjectCode
      ) || ''

    ElMessage.success('已根据项目编号代入：加工零件名称、模具编号')
    projectImportDialogVisible.value = false
  } catch (error) {
    console.error('按项目代入失败:', error)
    ElMessage.error('按项目代入失败')
  } finally {
    importingProject.value = false
  }
}

// 删除
const handleDelete = async (row: QuotationRecord) => {
  if (!canShowQuotationDeleteAction(row)) {
    ElMessage.warning(`当前立项状态不允许删除：${normalizeInitiationStatus(row.initiationStatus)}`)
    return
  }
  try {
    const message = `确定要删除报价单【${row.quotationNo}】吗？\n请输入 Y 确认删除：`
    const { value } = await ElMessageBox.prompt(message, '警告', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
      inputPattern: /^[Yy]$/,
      inputErrorMessage: '请输入 Y 确认删除'
    })

    if (value === 'Y' || value === 'y') {
      const resp = await deleteQuotationApi(row.id)
      const pr: any = resp

      if (pr?.code === 0 || pr?.success === true) {
        ElMessage.success(pr?.message || '删除成功')
        // 重新加载列表，确保与服务器数据一致
        await loadQuotations()
      } else {
        console.error('删除报价单失败，响应数据:', pr)
        ElMessage.error(pr?.message || '删除失败')
      }
    }
  } catch {
    // 用户取消或输入错误
  }
}

// 行双击编辑
const handleRowDblClick = (row: QuotationRecord) => {
  handleEdit(row)
}

// 排序变化处理
const handleSortChange = ({ prop, order }: { prop: string; order: string | null }) => {
  if (prop && order) {
    sortConfig.prop = prop
    sortConfig.order = order === 'ascending' ? 'ascending' : 'descending'
  } else {
    sortConfig.prop = null
    sortConfig.order = null
  }
}

// 保存
const handleSubmit = async () => {
  if (!formRef.value) return

  try {
    // 客户名称必填：给出明确提示
    if (!quotationForm.customerName || !quotationForm.customerName.trim()) {
      ElMessage.error('请输入客户名称')
      return
    }

    await formRef.value.validate()

    if (quotationForm.quotationType === 'mold') {
      if (!quotationForm.partName || !quotationForm.partName.trim()) {
        ElMessage.error('请输入加工零件名称')
        return
      }
      // 模具编号、申请更改部门改为非必填
    } else {
      const cleanedPartItems = quotationForm.partItems
        .map((item) => ({
          partName: (item.partName || '').trim(),
          drawingNo: (item.drawingNo || '').trim(),
          material: (item.material || '').trim(),
          process: (item.process || '').trim(),
          imageUrl: (item.imageUrl || '').trim(),
          imageScale:
            item.imageScale === 0.5 || item.imageScale === 0.75 || item.imageScale === 1
              ? item.imageScale
              : 1,
          quantity:
            item.quantity === null || item.quantity === undefined
              ? undefined
              : Number(item.quantity),
          unitPrice: Number(item.unitPrice || 0)
        }))
        .filter((item) => {
          const hasText =
            !!item.partName ||
            !!item.drawingNo ||
            !!item.material ||
            !!item.process ||
            !!item.imageUrl
          const hasNumber = Number(item.quantity) > 0 || item.unitPrice > 0
          return hasText || hasNumber
        })

      if (cleanedPartItems.length === 0) {
        ElMessage.error('请至少填写一行零件明细')
        return
      }

      for (let i = 0; i < cleanedPartItems.length; i += 1) {
        const item = cleanedPartItems[i]
        const rowLabel = `第 ${i + 1} 行`

        if (!item.partName) {
          ElMessage.error(`${rowLabel}：产品名称不能为空`)
          return
        }
        if (!Number.isInteger(Number(item.quantity)) || Number(item.quantity) <= 0) {
          ElMessage.error(`${rowLabel}：数量必须为大于 0 的整数`)
          return
        }
        if (!Number.isFinite(item.unitPrice) || item.unitPrice <= 0) {
          ElMessage.error(`${rowLabel}：单价必须大于 0`)
          return
        }
      }

      quotationForm.partItems = cleanedPartItems.map((item, idx) => ({
        lineNo: idx + 1,
        ...item
      }))
    }

    const payload: QuotationFormData = {
      quotationNo: quotationForm.quotationNo?.trim() || '',
      quotationDate: quotationForm.quotationDate || '',
      customerName: quotationForm.customerName?.trim() || '',
      quotationType: quotationForm.quotationType,
      enableImage: quotationForm.quotationType === 'part' ? quotationForm.enableImage : false,
      processingDate: quotationForm.processingDate || '',
      changeOrderNo: quotationForm.changeOrderNo?.trim() || '',
      sourceProjectCode: quotationForm.sourceProjectCode?.trim() || '',
      partName: quotationForm.partName?.trim() || '',
      moldNo: quotationForm.moldNo?.trim() || '',
      department: quotationForm.department?.trim() || '',
      applicant: quotationForm.applicant?.trim() || '',
      contactName: quotationForm.contactName?.trim() || '',
      contactPhone: quotationForm.contactPhone?.trim() || '',
      operator: quotationForm.operator?.trim() || '',
      remark: quotationForm.remark?.trim() || '',
      deliveryTerms: '',
      paymentTerms: '',
      validityDays: null,
      materials:
        quotationForm.quotationType === 'part'
          ? []
          : quotationForm.materials.map((m) => ({ ...m })),
      processes:
        quotationForm.quotationType === 'part'
          ? []
          : quotationForm.processes.map((p) => ({ ...p })),
      partItems:
        quotationForm.quotationType === 'part'
          ? quotationForm.partItems.map((item) => ({
              partName: item.partName,
              drawingNo: item.drawingNo,
              material: item.material,
              process: item.process,
              imageUrl: item.imageUrl,
              imageScale: normalizeImageScale(item.imageScale),
              quantity: Number(item.quantity),
              unitPrice: Number(item.unitPrice)
            }))
          : [],
      otherFee: quotationForm.otherFee || 0,
      transportFee: quotationForm.transportFee || 0,
      quantity: quotationForm.quantity || 1
    }

    console.log('准备保存报价单，数据:', JSON.stringify(payload, null, 2))

    if (dialogMode.value === 'create' || quotationForm.id == null) {
      // 创建新报价单
      const response = await createQuotationApi(payload)
      console.log('创建报价单响应:', response)

      // 响应拦截器已经返回了 response.data，所以 response 就是 { code, success, data, message }
      const pr: any = response
      console.log('处理后的响应数据:', pr)

      // 检查响应：code === 0 或 success === true 都表示成功
      if ((pr?.code === 0 || pr?.success === true) && pr?.data?.id) {
        ElMessage.success('新增报价单成功')
        dialogVisible.value = false
        // 重新加载列表
        await loadQuotations()
      } else {
        console.error('创建失败，响应数据:', pr)
        ElMessage.error(pr?.message || '新增报价单失败')
      }
    } else {
      // 更新报价单
      const response = await updateQuotationApi(quotationForm.id, payload)
      console.log('更新报价单响应:', response)

      // 响应拦截器已经返回了 response.data，所以 response 就是 { code, success, message }
      const pr: any = response
      console.log('处理后的响应数据:', pr)

      // 检查响应：code === 0 或 success === true 都表示成功
      if (pr?.code === 0 || pr?.success === true) {
        ElMessage.success('编辑报价单成功')
        dialogVisible.value = false
        // 重新加载列表
        await loadQuotations()
      } else {
        console.error('更新失败，响应数据:', pr)
        ElMessage.error(pr?.message || '编辑报价单失败')
      }
    }
  } catch (error: any) {
    console.error('保存报价单失败:', error)
    console.error('错误响应数据:', error?.response?.data)
    if (error?.response?.data?.message) {
      ElMessage.error(error.response.data.message)
    } else if (error?.message) {
      ElMessage.error(error.message)
    } else {
      ElMessage.error('保存报价单失败')
    }
  }
}

// 分页
const handleSizeChange = (size: number) => {
  pagination.pageSize = size
  pagination.page = 1
  loadQuotations()
}

const handleCurrentChange = (page: number) => {
  pagination.page = page
  loadQuotations()
}

// 监听移动端状态变化，自动切换视图模式
watch(isMobile, (mobile) => {
  if (mobile) {
    viewMode.value = 'card'
  } else {
    viewMode.value = 'table'
  }
})

watch(
  () => initiationForm.projectCode,
  (next) => {
    const nextCode = String(next || '').trim()
    initiationForm.category = getCategoryFromProjectCode(nextCode)
    if (resolveBusinessCategory(initiationSourceQuotation.value?.quotationType) === '零件加工')
      return
    syncInitiationDetailItemCodes(initiationSourceQuotation.value?.quotationType, nextCode)
  }
)

watch(
  initiationProjectDetails,
  () => {
    if (resolveBusinessCategory(initiationSourceQuotation.value?.quotationType) !== '零件加工') {
      return
    }
    syncProjectDetailsToSalesDetails()
    initiationForm.projectCode = getInitiationPrimaryProjectCode()
  },
  { deep: true }
)

watch(
  () => initiationForm.sourceProjectCode,
  async (next, prev) => {
    const nextCode = String(next || '').trim()
    const prevCode = String(prev || '').trim()
    if (!nextCode) return
    await syncInitiationRawFieldsFromProject(nextCode, { force: nextCode !== prevCode })
  }
)

// 监听项目编号关键字，输入后自动触发（防抖）查询，仅在分类为「塑胶模具」的项目中模糊搜索
watch(
  projectSearchKeyword,
  (val) => {
    if (projectSearchDebounceTimer) {
      clearTimeout(projectSearchDebounceTimer)
      projectSearchDebounceTimer = null
    }

    const keyword = (val || '').trim()
    if (!keyword) {
      projectSearchResults.value = []
      return
    }

    projectSearchDebounceTimer = setTimeout(() => {
      searchProjectsForImport()
    }, 300)
  },
  { flush: 'post' }
)

// ESC 键处理：当弹窗打开时，按 ESC 键相当于按取消按钮
const handleEscKey = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && dialogVisible.value) {
    event.preventDefault()
    event.stopPropagation()
    handleCancelQuotationDialog()
  }
}

// 监听弹窗打开/关闭，添加/移除 ESC 键监听器
watch(
  dialogVisible,
  (isOpen) => {
    if (isOpen) {
      // 弹窗打开时，添加 ESC 键监听器
      document.addEventListener('keydown', handleEscKey)
    } else {
      // 弹窗关闭时，移除 ESC 键监听器
      document.removeEventListener('keydown', handleEscKey)
    }
  },
  { immediate: true }
)

// 组件卸载时移除监听器
onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleEscKey)
})

// 页面加载时获取数据
onMounted(() => {
  loadQuotations()
  fetchCustomerList()
})
</script>

<style scoped>
@media (width <= 768px) {
  :deep(.qt-edit-dialog--part .el-dialog) {
    height: 100% !important;
    max-height: 100% !important;
  }

  :deep(.qt-edit-dialog) {
    width: 100% !important;
    max-width: 100% !important;
    margin: 0 !important;
  }

  :deep(.qt-edit-dialog .el-dialog__body) {
    padding: 2px 8px 8px;
    overflow: auto;
    -webkit-overflow-scrolling: touch;
  }

  :deep(.qt-edit-dialog .el-dialog__header),
  :deep(.qt-edit-dialog .el-dialog__footer) {
    padding-inline: 8px;
  }

  /* 手机端表格容器可滚动 */
  .quotation-sheet {
    width: 100%;
    overflow: auto;
    -webkit-overflow-scrolling: touch;
  }

  /* 确保表格可以横向滚动 */
  .qs-table {
    min-width: 800px;
  }
}

@media (width <= 768px) {
  .qt-workbench__hero {
    flex-direction: column;
  }

  .qm-grid,
  .qm-grid--intro,
  .qm-fields,
  .qm-topbar__meta-grid {
    grid-template-columns: repeat(1, minmax(0, 1fr));
  }

  .qm-topbar {
    padding: 10px;
  }

  .qm-topbar__header {
    flex-direction: column;
    align-items: stretch;
  }

  .qm-field--wide {
    grid-column: span 1;
  }

  .qm-field--half,
  .qm-field--remark,
  .qm-meta-card--customer,
  .qm-meta-card--project,
  .qm-meta-card--quotation-no,
  .qm-meta-card--half {
    grid-column: span 1;
  }

  .qm-action-cluster {
    width: 100%;
    justify-content: flex-start;
  }

  .qm-action-cluster :deep(.el-button) {
    flex: 1 1 calc(50% - 4px);
  }

  .qm-summary-main-row,
  .qm-material-grid {
    grid-template-columns: repeat(1, minmax(0, 1fr));
  }

  .qt-workbench__hero-actions {
    width: 100%;
    justify-content: flex-start;
  }

  .qt-workbench__hero-actions :deep(.el-button) {
    flex: 1 1 auto;
  }

  .qt-workbench__stats,
  .qt-create-type-grid {
    grid-template-columns: repeat(1, minmax(0, 1fr));
  }

  .qt-create-form {
    padding: 12px;
  }

  .quotation-top-fields {
    flex-direction: column;
    gap: 12px;
  }

  .quotation-top-field--inline {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }

  .field-input-inline {
    width: 100% !important;
  }

  .query-form__actions {
    margin-top: 8px;
  }
}

@media (width <= 1280px) {
  .qm-topbar__header {
    flex-direction: column;
    align-items: stretch;
  }

  .qm-topbar__meta-grid {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }

  .qm-action-cluster {
    justify-content: flex-start;
  }

  .qm-meta-card--customer,
  .qm-meta-card--half {
    grid-column: span 6;
  }

  .qm-meta-card--project,
  .qm-meta-card--quotation-no {
    grid-column: span 3;
  }
}

@media (width <= 768px) {
  .qt-mobile-card__meta {
    grid-template-columns: repeat(1, minmax(0, 1fr));
  }
}

@media (width <= 768px) {
  :deep(.qt-initiation-dialog.el-dialog .el-dialog__body),
  :deep(.qt-initiation-dialog .el-dialog__body) {
    overflow: visible;
  }
}

.quotation-page {
  position: relative;
}

.qt-workbench {
  position: relative;
  padding: 22px 22px 18px;
  overflow: hidden;
  background:
    radial-gradient(circle at top left, rgb(255 191 73 / 24%), transparent 28%),
    radial-gradient(circle at top right, rgb(60 114 255 / 14%), transparent 24%),
    linear-gradient(135deg, #fffdf8 0%, #fff 42%, #f6f9ff 100%);
  border: 1px solid rgb(196 173 120 / 28%);
  border-radius: 20px;
  box-shadow: 0 18px 48px rgb(102 88 54 / 8%);
}

.qt-workbench--mobile {
  padding: 18px 16px 14px;
}

.qt-workbench__hero {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
}

.qt-workbench__hero-copy {
  max-width: 760px;
}

.qt-workbench__eyebrow {
  font-family: 'Avenir Next', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.18em;
  color: #9f6b12;
  text-transform: uppercase;
}

.qt-workbench__title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
  flex-wrap: wrap;
}

.qt-workbench__title {
  margin: 0;
  font-family: Baskerville, 'Times New Roman', STSong, serif;
  font-size: 32px;
  font-weight: 700;
  line-height: 1.05;
  color: #1c2434;
}

.qt-workbench__summary {
  max-width: 620px;
  margin: 10px 0 0;
  font-size: 14px;
  line-height: 1.7;
  color: #596273;
}

.qt-initiation-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.qt-initiation-card-header__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  flex-wrap: wrap;
}

.qt-initiation-card-header__meta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.qt-initiation-card-header__meta--status {
  min-height: 24px;
}

.qt-initiation-card-header__label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.qt-initiation-card-header__customer {
  width: 240px;
}

.qt-initiation-card-header__date {
  width: 148px;
}

.qt-initiation-card-header__contract {
  width: 160px;
}

.qt-workbench__hero-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.qt-button--soft {
  color: #6b4b00;
  background: rgb(255 244 220 / 90%);
  border-color: rgb(215 177 88 / 45%);
}

.mobile-top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-top: 2px;
}

.mobile-top-bar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.view-mode-switch {
  display: flex;
  align-items: center;
  gap: 8px;
}

.view-mode-switch__label {
  font-size: 13px;
  color: #606266;
}

.qt-search-shell {
  padding: 16px 18px;
  background:
    linear-gradient(180deg, rgb(255 255 255 / 96%), rgb(250 251 255 / 96%)),
    var(--el-bg-color-overlay);
  border: 1px solid rgb(204 213 227 / 70%);
  border-radius: 18px;
  box-shadow: 0 10px 28px rgb(104 119 152 / 8%);
}

.qt-search-shell--mobile {
  padding: 14px 12px;
}

.query-form {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

:deep(.query-form .el-form-item) {
  margin-bottom: 0;
}

.query-form--mobile {
  padding: 0;
}

:deep(.query-form--mobile .el-form-item) {
  width: 100%;
  margin-right: 0;
  margin-bottom: 8px;
}

:deep(.query-form--mobile .el-form-item .el-form-item__content) {
  width: 100%;
}

.query-form__actions {
  display: flex;
  margin-right: 12px;
  margin-bottom: 0;
  margin-left: auto;
  justify-content: flex-end;
  align-items: center;
}

.query-actions {
  display: flex;
  flex-wrap: nowrap;
  gap: 8px;
  justify-content: flex-end;
}

:deep(.query-form .el-form-item:not(.query-form__actions)) {
  margin-right: 18px;
  margin-bottom: 0;
}

.qt-create-dialog__hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  padding: 2px 2px 14px;
}

.qt-create-dialog__eyebrow {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.16em;
  color: #9f6b12;
  text-transform: uppercase;
}

.qt-create-dialog__title {
  margin-top: 8px;
  font-family: Baskerville, 'Times New Roman', STSong, serif;
  font-size: 26px;
  font-weight: 700;
  color: #1f2d3d;
}

.qt-create-dialog__description {
  margin-top: 6px;
  font-size: 13px;
  line-height: 1.7;
  color: #667085;
}

.qt-create-type-grid {
  display: grid;
  margin-bottom: 16px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.qt-create-type-card {
  position: relative;
  display: flex;
  min-height: 140px;
  padding: 16px;
  cursor: pointer;
  background: linear-gradient(145deg, rgb(255 250 240 / 92%), rgb(255 255 255 / 98%));
  border: 1px solid rgb(217 181 105 / 36%);
  border-radius: 18px;
  box-sizing: border-box;
  flex-direction: column;
  gap: 8px;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    border-color 0.2s ease;
}

.qt-create-type-card input {
  position: absolute;
  pointer-events: none;
  opacity: 0;
}

.qt-create-type-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 28px rgb(138 110 52 / 12%);
}

.qt-create-type-card--part {
  background: linear-gradient(145deg, rgb(242 250 245 / 94%), rgb(255 255 255 / 98%));
  border-color: rgb(112 183 128 / 34%);
}

.qt-create-type-card--active {
  border-color: #cf8d11;
  box-shadow: 0 18px 36px rgb(173 126 36 / 18%);
}

.qt-create-type-card--active.qt-create-type-card--part {
  border-color: #4e9f66;
  box-shadow: 0 18px 36px rgb(68 133 86 / 16%);
}

.qt-create-type-card__title {
  font-size: 18px;
  font-weight: 700;
  color: #1f2d3d;
}

.qt-create-type-card__desc {
  font-size: 13px;
  line-height: 1.7;
  color: #596273;
}

.qt-create-type-card__foot {
  margin-top: auto;
  font-size: 12px;
  color: #8a6e35;
}

.qt-create-type-card--part .qt-create-type-card__foot {
  color: #43765a;
}

.qt-create-form {
  padding: 16px;
  background: linear-gradient(180deg, rgb(250 251 255 / 95%), rgb(255 255 255 / 95%));
  border: 1px solid rgb(218 223 235 / 72%);
  border-radius: 18px;
}

.qt-table-wrapper {
  background: var(--el-bg-color);
  border-radius: 8px;
}

.qt-table-wrapper--mobile {
  padding-bottom: 8px;
  overflow-x: auto;
}

.qt-table-wrapper--mobile .qt-table {
  min-width: 960px;
}

/* 手机端卡片视图样式 */
.qt-mobile-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.qt-mobile-card {
  border-radius: 10px;
}

.qt-mobile-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.qt-mobile-card__quotation-no {
  font-size: 14px;
  font-weight: 600;
}

.qt-mobile-card__date {
  margin-top: 2px;
  font-size: 13px;
  color: #666;
}

.qt-mobile-card__customer {
  font-size: 13px;
  color: #666;
}

.qt-mobile-card__type {
  margin-top: 4px;
}

.qt-mobile-card__meta {
  display: grid;
  margin-top: 8px;
  font-size: 13px;
  color: #555;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px 12px;
}

.qt-mobile-card__meta .label {
  margin-right: 4px;
  color: #888;
}

.qt-mobile-card__stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin: 8px 0;
}

.qt-mobile-card__stats .stat {
  padding: 8px 10px;
  background-color: #f6f7fb;
  border-radius: 8px;
}

.stat-label {
  font-size: 12px;
  color: #888;
}

.stat-value {
  margin-top: 4px;
  font-size: 16px;
  font-weight: 600;
}

.qt-mobile-card__actions {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: flex-start;
  flex-wrap: wrap;
  margin-top: 12px;
}

.operation-buttons {
  display: flex;
  gap: 6px;
  align-items: center;
  justify-content: flex-start;
  flex-wrap: wrap;
  width: 100%;
}

.qt-mobile-card__actions :deep(.el-button),
.operation-buttons :deep(.el-button) {
  min-width: 72px;
  border-radius: 999px;
}

:deep(.quotation-action-menu .el-dropdown-menu__item.is-danger) {
  color: var(--el-color-danger);
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

.pagination-footer--mobile {
  position: static;
  left: auto;
  margin-top: 12px;
  transform: none;
  justify-content: center;
}

/* 报价单顶部字段样式 */
.quotation-top-fields {
  display: flex;
  padding: 0 0 12px;
  margin-top: -8px;
  margin-bottom: 8px;
  background-color: var(--el-bg-color-overlay);
  border-radius: 4px;
  align-items: flex-start;
  gap: 16px;
}

.quotation-top-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.quotation-top-part {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.quotation-top-part__row {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.quotation-top-part__row--inline-fields {
  flex-wrap: nowrap;
  width: 100%;
}

.quotation-top-part__customer {
  flex: 1 1 auto;
}

.quotation-top-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  align-items: center;
  flex: 1 1 auto;
}

.quotation-top-summary__item {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.field-value-inline {
  font-weight: 500;
  color: #303133;
  word-break: break-word;
}

.quotation-top-field {
  position: relative;
  margin-bottom: 0;
  flex: 1;
}

.quotation-top-field .field-label {
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 500;
  color: #606266;
}

:deep(.quotation-top-field .el-form-item__content) {
  margin-left: 0 !important;
}

/* 内联字段样式 */
.quotation-top-field--inline {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
}

.quotation-top-field--inline :deep(.el-form-item__content) {
  width: auto;
  margin-left: 0 !important;
  flex: 0 0 auto;
}

.field-label-inline {
  display: inline-block;
  width: 78px;
  margin-left: 0;
  font-size: 13px;
  font-weight: 500;
  color: #606266;
  text-align: right;
  white-space: nowrap;
}

.field-required {
  position: absolute;
  left: 0;
  margin-right: 2px;
  color: var(--el-color-danger);
}

/* .field-input-inline 默认样式，具体宽度由子类定义 */

/* 报价单号输入框宽度 */
.field-input-inline.field-input-quotation-no {
  width: 140px !important;
  flex: 0 0 140px !important;
}

.field-input-inline.field-input-quotation-no :deep(.el-input__wrapper),
.field-input-inline.field-input-quotation-no :deep(.el-input) {
  width: 140px !important;
}

/* 报价日期选择器宽度 */
.field-input-inline.field-input-quotation-date {
  width: 140px !important;
  max-width: 140px !important;
  min-width: 140px !important;
  flex: 0 0 140px !important;
}

.field-input-inline.field-input-quotation-date :deep(.el-input__wrapper) {
  width: 140px !important;
  max-width: 140px !important;
  min-width: 140px !important;
}

.field-input-inline.field-input-quotation-date :deep(.el-input__inner) {
  width: 140px !important;
}

.field-input-inline.field-input-quotation-date :deep(.el-input) {
  width: 140px !important;
  max-width: 140px !important;
  min-width: 140px !important;
}

/* 客户名称选择框宽度 */
.field-input-inline.field-input-customer-name {
  width: 240px !important;
  flex: 0 0 240px !important;
}

.field-input-inline.field-input-customer-name :deep(.el-input__wrapper),
.field-input-inline.field-input-customer-name :deep(.el-input) {
  width: 240px !important;
}

.field-input-inline.field-input-contact {
  width: 160px !important;
  flex: 0 0 160px !important;
}

.field-input-inline.field-input-contact :deep(.el-input__wrapper),
.field-input-inline.field-input-contact :deep(.el-input) {
  width: 160px !important;
}

/* 报价单弹窗样式 */
.quotation-sheet {
  margin-top: -8px;
  font-size: 13px;
  color: #333;
}

.qt-card {
  padding: 12px;
  background: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}

.quotation-sheet--part {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.qm-topbar {
  display: block;
  width: 100%;
  padding: 12px;
  background:
    radial-gradient(circle at top left, rgb(255 206 129 / 18%), transparent 24%),
    linear-gradient(135deg, #fffdf8 0%, #fff 58%, #f6f8fc 100%);
  border: 1px solid rgb(214 187 136 / 40%);
  border-radius: 22px;
  box-shadow: 0 12px 28px rgb(116 99 59 / 8%);
}

.qm-topbar__intro {
  min-width: 0;
  padding: 10px 10px 0;
}

.qm-topbar__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.qm-topbar__eyebrow {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.16em;
  color: #a86f13;
  text-transform: uppercase;
}

.qm-topbar__title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.qm-topbar__title {
  margin: 0;
  font-family: Baskerville, 'Times New Roman', STSong, serif;
  font-size: 28px;
  font-weight: 700;
  line-height: 1.1;
  color: #1f2d3d;
}

.qm-topbar__meta-grid {
  display: grid;
  margin-top: 12px;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 10px;
}

.qm-meta-card {
  min-width: 0;
  padding: 10px 12px;
  background: rgb(255 255 255 / 76%);
  border: 1px solid rgb(219 224 236 / 80%);
  border-radius: 16px;
}

.qm-meta-card--customer {
  grid-column: span 4;
}

.qm-meta-card--project {
  grid-column: span 2;
}

.qm-meta-card--quotation-no {
  grid-column: span 2;
}

.qm-meta-card--half {
  grid-column: span 2;
}

.qm-meta-card__label {
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 600;
  color: #667284;
}

.qm-meta-card__field {
  margin-bottom: 0;
}

.qm-meta-card__field :deep(.el-form-item__content) {
  margin-left: 0 !important;
}

.qm-action-cluster {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.qm-action-cluster :deep(.el-button) {
  margin-left: 0;
}

.qm-action-cluster--inline {
  flex: 0 0 auto;
}

.qm-sheet {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 0;
}

.qm-panel__eyebrow {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.16em;
  color: #9d6911;
  text-transform: uppercase;
}

.qm-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
}

.qm-grid--intro {
  grid-template-columns: minmax(0, 1fr);
}

.qm-cost-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.qm-panel {
  padding: 14px;
  background: linear-gradient(180deg, rgb(255 255 255 / 98%), rgb(249 251 255 / 98%));
  border: 1px solid rgb(219 224 236 / 90%);
  border-radius: 18px;
  box-shadow: 0 10px 24px rgb(110 123 152 / 6%);
}

.qm-panel--summary {
  background: linear-gradient(180deg, rgb(255 250 238 / 98%), rgb(255 255 255 / 98%)), #fff;
  border-color: rgb(225 205 164 / 70%);
}

.qm-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.qm-panel__title {
  margin-top: 6px;
  font-size: 18px;
  font-weight: 700;
  color: #243244;
}

.qm-panel__title-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.qm-panel__hint {
  margin-top: 4px;
  font-size: 11px;
  color: #768397;
}

.qm-panel__hint--inline {
  margin-top: 0;
  margin-left: auto;
  text-align: right;
  white-space: nowrap;
}

.qm-panel__badge {
  display: inline-flex;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 600;
  color: #7a5200;
  background: #fff6e4;
  border: 1px solid #ebd19d;
  border-radius: 999px;
  align-items: center;
}

.qm-panel__badge--subtle {
  color: #6a778a;
  background: #f5f7fb;
  border-color: #dde3ef;
}

.qm-fields {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 10px;
}

.qm-field--half {
  grid-column: span 1;
}

.qm-field--wide {
  grid-column: span 2;
}

.qm-field--note {
  grid-column: span 1;
}

.qm-field--remark {
  grid-column: span 4;
}

.qm-field__label {
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #657183;
}

.qm-summary-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.qm-summary-main-row {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
}

.qm-summary-kpi {
  display: flex;
  padding: 9px 10px;
  background: linear-gradient(180deg, #fbfcff 0%, #f5f7fb 100%);
  border: 1px solid #e2e7f0;
  border-radius: 12px;
  flex-direction: column;
  gap: 4px;
}

.qm-summary-kpi strong {
  font-size: 16px;
  font-weight: 700;
  color: #203044;
}

.qm-summary-kpi__label,
.qm-summary-edit-card__label {
  font-size: 12px;
  font-weight: 600;
  color: #657183;
}

.qm-summary-edit-card {
  display: grid;
  grid-template-columns: 62px 1fr;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: #fff;
  border: 1px solid #e2e7f0;
  border-radius: 12px;
}

.qm-summary-total {
  display: flex;
  padding: 11px 12px;
  margin-top: 2px;
  color: #1f2d3d;
  background: linear-gradient(135deg, #fff2cb 0%, #fff8ea 100%);
  border: 1px solid #edd9a5;
  border-radius: 12px;
  align-items: center;
  justify-content: space-between;
}

.qm-summary-total strong {
  font-size: 19px;
}

.qm-summary-total__label {
  font-size: 12px;
  font-weight: 700;
}

.qm-process-table-shell {
  overflow: hidden;
  border-radius: 14px;
}

.qm-process-compact-table {
  width: 100%;
  background: #fff;
  border-collapse: collapse;
  table-layout: fixed;
}

.qm-process-compact-table th,
.qm-process-compact-table td {
  padding: 7px 10px;
  border: 1px solid #e2e7f0;
  box-sizing: border-box;
}

.qm-process-compact-table__head {
  font-size: 12px;
  font-weight: 700;
  color: #556274;
  text-align: left;
  background: #f7f9fd;
}

.qm-process-compact-table__name {
  width: 14%;
  font-weight: 700;
  color: #2a3748;
  background: #fafbfd;
}

.qm-process-compact-table__unit {
  width: 15%;
  color: #6f7b8d;
}

.qm-process-compact-table__hours {
  width: 14%;
}

.qm-process-compact-table__hours :deep(.el-input-number .el-input__inner) {
  text-align: right;
}

.qm-process-compact-table__total {
  width: 15%;
  font-weight: 600;
  color: #223044;
  text-align: right;
  background: #fffdf5;
}

.qm-process-compact-table__placeholder {
  background: #fcfcfd;
}

:deep(.qt-edit-dialog--mold.el-dialog),
:deep(.qt-edit-dialog--mold .el-dialog) {
  display: flex;
  max-height: min(88vh, 920px);
  margin-top: 4vh;
  flex-direction: column;
}

:deep(.qt-edit-dialog--mold.el-dialog .el-dialog__body),
:deep(.qt-edit-dialog--mold .el-dialog__body) {
  min-height: 0;
  padding: 0 12px 12px;
  overflow: auto;
  flex: 1 1 auto;
}

.qm-cost-table :deep(.el-table__header-wrapper th) {
  font-weight: 700;
  color: #556274;
  background: #f7f9fd;
}

.qm-cost-table :deep(.el-input-number .el-input__inner) {
  text-align: right;
}

.qm-material-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.qm-material-card {
  overflow: hidden;
  border: 1px solid #e2e7f0;
  border-radius: 14px;
}

.qm-material-table {
  width: 100%;
  background: #fff;
  border-collapse: collapse;
  table-layout: fixed;
}

.qm-material-table th,
.qm-material-table td {
  padding: 8px 10px;
  border: 1px solid #e2e7f0;
  box-sizing: border-box;
}

.qm-material-table th {
  font-size: 12px;
  font-weight: 700;
  color: #556274;
  text-align: left;
  background: #f7f9fd;
}

.qm-material-table__name {
  width: 50%;
}

.qm-material-table__price {
  width: 22%;
}

.qm-material-table__qty {
  width: 16%;
}

.qm-material-table__total {
  width: 12%;
  color: #223044;
  text-align: right;
  background: #fffdf5;
}

.qm-material-table td.qm-material-table__price,
.qm-material-table td.qm-material-table__qty {
  text-align: right;
}

.qm-material-table :deep(.el-input-number .el-input__inner) {
  text-align: right;
}

.qt-part-items__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.qt-part-items__toolbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.qt-part-items__image-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
}

.qt-part-items__image-toggle-label {
  font-weight: 500;
  color: #606266;
  white-space: nowrap;
}

.qt-part-items__title {
  font-weight: 600;
  color: #303133;
}

/* 细竖线：保留 border，但用更浅的颜色 */
.qt-part-items-table :deep(.el-table__header-wrapper th) {
  font-weight: 600;
  color: #606266;
  background-color: #f5f7fa;
}

.qt-part-items-table :deep(.el-table--border) {
  border-color: #ebeef5;
}

.qt-part-items-table :deep(.el-table--border::after),
.qt-part-items-table :deep(.el-table--border::before),
.qt-part-items-table :deep(.el-table__inner-wrapper::before) {
  background-color: #ebeef5;
}

.qt-part-items-table :deep(.el-table td.el-table__cell),
.qt-part-items-table :deep(.el-table th.el-table__cell) {
  border-color: #ebeef5;
}

.qt-part-items-table--with-image :deep(.el-table__cell) {
  padding-top: 6px;
  padding-bottom: 6px;
  vertical-align: middle;
}

.qt-part-items-table--with-image :deep(.el-table__row) {
  height: 92px;
}

.qt-part-image-file-input {
  display: none;
}

.qt-part-image-cell {
  position: relative;
  display: flex;
  width: 100%;
  min-height: 80px;
  padding: 4px;
  outline: none;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
}

.qt-part-image-cell--readonly {
  cursor: default;
}

.qt-part-image-cell__loading {
  display: flex;
  width: 100%;
  min-height: 80px;
  font-size: 12px;
  letter-spacing: 0.02em;
  color: #909399;
  background: linear-gradient(180deg, #f8fafc, #f2f5fa);
  border: 1px dashed #cfd8e3;
  border-radius: 12px;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
}

.qt-part-image-empty {
  display: flex;
  width: 100%;
  min-height: 80px;
  padding: 8px 10px;
  font-size: 11px;
  color: #7a8698;
  background: linear-gradient(180deg, rgb(249 251 254 / 98%), rgb(244 247 251 / 98%)), #fafafa;
  border: 1px dashed #cfd8e3;
  border-radius: 12px;
  box-sizing: border-box;
  align-items: center;
  flex-direction: column;
  gap: 4px;
  justify-content: center;
}

.qt-part-image-empty__text {
  font-size: 11px;
  font-weight: 600;
  line-height: 1.2;
  text-align: center;
  user-select: none;
}

.qt-part-image-empty__hint {
  font-size: 10px;
  line-height: 1.2;
  color: #9aa6b6;
  text-align: center;
  user-select: none;
}

.qt-part-image-thumb {
  width: 100%;
  height: 80px;
  overflow: hidden;
  background: linear-gradient(180deg, rgb(255 255 255 / 100%), rgb(247 249 252 / 100%)), #fff;
  border: 1px solid #dfe5ef;
  border-radius: 12px;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 80%);
  box-sizing: border-box;
}

.qt-part-image-thumb :deep(.el-image__inner) {
  width: 100%;
  height: 80px;
  object-fit: contain;
  transform: scale(var(--img-scale, 1));
  transform-origin: center;
}

.qt-part-image-scale {
  position: absolute;
  right: 10px;
  bottom: 10px;
}

.qt-part-image-scale-badge {
  display: inline-flex;
  height: 22px;
  min-width: 42px;
  padding: 0 7px;
  font-size: 11px;
  font-weight: 600;
  color: #435066;
  cursor: pointer;
  background: rgb(255 255 255 / 94%);
  border: 1px solid #d6dde8;
  border-radius: 999px;
  box-shadow: 0 6px 16px rgb(109 126 154 / 12%);
  user-select: none;
  align-items: center;
  justify-content: center;
}

.qt-part-image-remove {
  position: absolute;
  top: 10px;
  left: 10px;
  width: 22px;
  height: 22px;
  padding: 0;
  font-size: 14px;
  line-height: 20px;
  color: #5f6c80;
  text-align: center;
  cursor: pointer;
  background: rgb(255 255 255 / 94%);
  border: 1px solid #d6dde8;
  border-radius: 50%;
  box-shadow: 0 6px 16px rgb(109 126 154 / 12%);
}

.qt-part-image-pick {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 22px;
  height: 22px;
  padding: 0;
  font-size: 13px;
  line-height: 20px;
  color: #5f6c80;
  text-align: center;
  cursor: pointer;
  background: rgb(255 255 255 / 94%);
  border: 1px solid #d6dde8;
  border-radius: 50%;
  box-shadow: 0 6px 16px rgb(109 126 154 / 12%);
}

.qt-part-image-remove:hover,
.qt-part-image-pick:hover,
.qt-part-image-scale-badge:hover {
  color: #1f2d3d;
  background: #fff;
  border-color: #c2ccd9;
}

.qt-part-items-table :deep(.el-input-number .el-input__inner) {
  text-align: right;
}

.qt-part-summary-card :deep(.el-input-number .el-input__inner) {
  text-align: right;
}

.qt-money-input :deep(.el-input__inner) {
  text-align: right;
}

.qt-part-summary-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.qt-part-summary-row__spacer {
  flex: 1 1 auto;
}

.qt-part-summary-card {
  width: 360px;
  padding: 12px 14px;
}

.qt-part-summary-item {
  display: grid;
  grid-template-columns: 96px 1fr;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.qt-part-summary-item:last-child {
  border-bottom: none;
}

.qt-part-summary-label {
  font-weight: 500;
  color: #606266;
  text-align: right;
  white-space: nowrap;
}

.qt-part-summary-value {
  text-align: right;
}

.qt-part-summary-item--total {
  padding-top: 10px;
}

.qt-part-summary-value--total {
  padding: 6px 10px;
  font-size: 16px;
  font-weight: 700;
  color: #303133;
  background: #eaf7e9;
  border: 1px solid #d5f0d1;
  border-radius: 6px;
}

.qt-part-summary-item--remark {
  align-items: start;
  padding-top: 10px;
  border-bottom: none;
}

.qt-part-summary-value--remark {
  text-align: left;
}

.qt-part-summary-value--remark :deep(.el-textarea__inner) {
  resize: vertical;
}

.qs-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.qs-table td {
  padding: 6px 8px;
  border: 1px solid #000;
  box-sizing: border-box;
}

/* 单位材料费 / 加工费用明细行：行高略微减小 */
.qs-row-material td,
.qs-row-process td {
  padding-top: 4px;
  padding-bottom: 4px;
}

.qs-title {
  padding: 8px 0;
  font-size: 16px;
  font-weight: 600;
  text-align: center;
}

.qs-label {
  font-weight: 500;
  text-align: center;
  background-color: #f5f5f5;
}

.qs-section-title {
  font-weight: 600;
  text-align: center;
}

.qs-input.qs-manual {
  background-color: #fff7d6; /* 手工填写区域（接近 Excel 黄色） */
}

.qs-total {
  font-weight: 600;
  text-align: right;
  background-color: #d8f0d2; /* 合计区域（接近 Excel 绿色） */
}

.qs-text {
  text-align: center;
}

.qs-number {
  text-align: right;
}

.qs-vert-header {
  text-align: center;
}

.qs-footer {
  font-size: 12px;
  color: #666;
  text-align: center;
}

/* 弹窗整体高度控制（PC 端） */
:deep(.qt-edit-dialog--part.el-dialog),
:deep(.qt-edit-dialog--part .el-dialog) {
  display: flex;
  height: 850px;
  max-height: 850px;
  margin-top: 0;
  flex-direction: column;
}

:deep(.qt-edit-dialog--part.el-dialog .el-dialog__body),
:deep(.qt-edit-dialog--part .el-dialog__body) {
  position: relative;
  min-height: 0;
  padding: 0 12px 12px;
  overflow: hidden;
  flex: 1 1 auto;
}

:deep(.qt-edit-dialog .el-dialog__header) {
  height: 0;
  min-height: 0;
  padding: 0;
  margin-bottom: 0;
  overflow: hidden;
  border-bottom: none;
}

.qt-dialog-header {
  display: none;
}

.qt-dialog-header__title {
  font-weight: 600;
  text-align: center;
  flex: 1 1 auto;
}

.qt-edit-dialog--part .quotation-form {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
}

.qt-edit-dialog--part .quotation-sheet--part {
  flex: 1 1 auto;
  min-height: 0;
}

.qt-edit-dialog--part .qt-part-items-card {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
}

.qt-edit-dialog--part :deep(.qt-part-items-table) {
  height: 100%;
  min-height: 0;
  flex: 1 1 auto;
}

/* 操作按钮区域 - 与输入框同一行 */
.qt-dialog-actions {
  display: flex;
  padding: 0;
  margin-left: auto;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
}

:deep(.qt-edit-dialog .el-dialog__headerbtn) {
  position: static;
  margin-left: 8px;
}

/* 项目代入对话框样式 */
.project-import-dialog {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.project-import-search-input {
  max-width: 400px;
}

.project-import-table {
  margin-top: 4px;
}

.project-import-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}

.project-import-empty {
  margin-top: 8px;
  font-size: 13px;
  color: #999;
}

.project-import-tip {
  margin-top: 8px;
  font-size: 12px;
  color: #888;
}

.initiation-basic-descriptions
  :deep(.el-descriptions__label.el-descriptions__cell.is-bordered-label) {
  width: 110px;
  min-width: 110px;
  padding: 8px 6px;
  font-size: 12px;
}

.initiation-basic-descriptions :deep(.el-descriptions__table) {
  width: 100%;
  table-layout: fixed;
}

.initiation-basic-descriptions
  :deep(.el-descriptions__content.el-descriptions__cell.is-bordered-content) {
  padding: 8px 10px;
}

:deep(.qt-initiation-dialog.el-dialog),
:deep(.qt-initiation-dialog .el-dialog) {
  display: flex;
  height: min(88vh, 900px);
  max-height: min(88vh, 900px);
  margin-top: 4vh;
  overflow: hidden;
  flex-direction: column;
}

:deep(.qt-initiation-dialog.el-dialog .el-dialog__body),
:deep(.qt-initiation-dialog .el-dialog__body) {
  min-height: 0;
  padding: 0 16px 16px;
  overflow: hidden auto;
  flex: 1 1 auto;
}

.qt-initiation-dialog__content {
  display: block;
}
</style>
