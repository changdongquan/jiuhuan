<template>
  <div class="outbound-document-page px-4 pt-0 pb-1 space-y-2">
    <div v-if="isMobile" class="mobile-top-bar">
      <div class="mobile-top-bar-left">
        <el-button text type="primary" @click="showMobileFilters = !showMobileFilters">
          {{ showMobileFilters ? '收起筛选' : '展开筛选' }}
        </el-button>
        <el-button text type="primary" @click="showMobileSummary = !showMobileSummary">
          {{ showMobileSummary ? '收起卡片' : '展开卡片' }}
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
    <el-form
      ref="queryFormRef"
      :model="queryForm"
      :label-width="isMobile ? 'auto' : '90px'"
      :label-position="isMobile ? 'top' : 'right'"
      :inline="!isMobile"
      class="query-form rounded-lg bg-[var(--el-bg-color-overlay)] py-2 shadow-sm"
      :class="{ 'query-form--mobile': isMobile }"
      v-show="!isMobile || showMobileFilters"
    >
      <el-form-item label="关键词">
        <el-input
          v-model="queryForm.keyword"
          placeholder="出库单号/产品名称/产品图号/客户模号"
          clearable
          @keydown.enter.prevent="handleSearch"
          :style="{ width: isMobile ? '100%' : '280px' }"
        />
      </el-form-item>
      <el-form-item label="审核状态">
        <el-select
          v-model="queryForm.status"
          placeholder="请选择"
          clearable
          :style="{ width: isMobile ? '100%' : '160px' }"
        >
          <el-option
            v-for="item in statusOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="出库类型">
        <el-select
          v-model="queryForm.outboundType"
          placeholder="请选择"
          clearable
          :style="{ width: isMobile ? '100%' : '160px' }"
        >
          <el-option
            v-for="item in outboundTypeOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item class="query-form__actions">
        <div class="query-actions">
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
          <el-button type="success" @click="handleCreate">新增</el-button>
        </div>
      </el-form-item>
    </el-form>

    <el-row :gutter="16" v-show="!isMobile || showMobileSummary">
      <el-col :xs="24" :sm="12" :lg="6">
        <el-card shadow="hover" class="summary-card summary-card--blue">
          <div class="summary-title">出库单总数</div>
          <div class="summary-value">{{ summary.totalDocuments }}</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="6">
        <el-card shadow="hover" class="summary-card summary-card--orange">
          <div class="summary-title">待审核</div>
          <div class="summary-value">{{ summary.pendingDocuments }}</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="6">
        <el-card shadow="hover" class="summary-card summary-card--green">
          <div class="summary-title">已审核</div>
          <div class="summary-value">{{ summary.approvedDocuments }}</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="6">
        <el-card shadow="hover" class="summary-card summary-card--red">
          <div class="summary-title">已驳回</div>
          <div class="summary-value">{{ summary.rejectedDocuments }}</div>
        </el-card>
      </el-col>
    </el-row>

    <div
      v-if="viewMode === 'table' || !isMobile"
      class="pm-table-wrapper"
      :class="{ 'pm-table-wrapper--mobile': isMobile }"
    >
      <el-table
        ref="tableRef"
        v-loading="loading"
        :data="tableData"
        border
        :fit="true"
        :height="tableHeight"
        @row-dblclick="handleEdit"
        @sort-change="handleSortChange"
        class="pm-table"
        style="width: 100%"
      >
        <el-table-column type="index" label="序号" width="55" align="center" fixed="left" />
        <el-table-column
          prop="出库单号"
          label="出库单号"
          width="145"
          show-overflow-tooltip
          sortable="custom"
          fixed="left"
        />
        <el-table-column
          prop="项目编号"
          label="项目编号"
          width="130"
          show-overflow-tooltip
          fixed="left"
        />
        <el-table-column
          prop="productName"
          label="产品名称"
          width="130"
          show-overflow-tooltip
          fixed="left"
        />
        <el-table-column
          v-if="!isMobile && showExtraColumns"
          prop="productDrawing"
          label="产品图号"
          width="130"
          show-overflow-tooltip
          fixed="left"
        />
        <el-table-column
          v-if="!isMobile && showExtraColumns"
          prop="客户模号"
          label="客户模号"
          width="115"
          show-overflow-tooltip
          fixed="left"
        />
        <!-- 留一列自适应撑满剩余宽度，确保“操作”列始终贴右且不随其它列宽变化产生空白 -->
        <el-table-column prop="客户名称" label="客户名称" show-overflow-tooltip />
        <el-table-column prop="出库数量" label="数量" width="100" align="right" />
        <el-table-column prop="出库日期" label="出库日期" width="110" sortable="custom">
          <template #default="{ row }">
            {{ formatDate(row.出库日期) }}
          </template>
        </el-table-column>
        <el-table-column prop="经办人" label="经办人" width="80" show-overflow-tooltip />
        <el-table-column prop="备注" label="备注" min-width="160" show-overflow-tooltip />
        <el-table-column label="操作" width="130" fixed="right" class-name="pm-op-column">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button type="success" size="small" @click="handleView(row)">查看</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div v-else class="pm-mobile-list" v-loading="loading">
      <el-empty v-if="!tableData.length && !loading" description="暂无出库单" />
      <template v-else>
        <el-card v-for="row in tableData" :key="row.出库单号" class="pm-mobile-card" shadow="hover">
          <div class="pm-mobile-card__header">
            <div>
              <div class="pm-mobile-card__code">出库单号：{{ row.出库单号 || '-' }}</div>
              <div class="pm-mobile-card__name">{{ row.productName || '-' }}</div>
            </div>
            <el-tag
              :type="getStatusTagType(row.审核状态)"
              size="small"
              class="pm-status-tag pm-status-tag--fixed"
              :class="getStatusTagClass(row.审核状态)"
            >
              {{ row.审核状态 || '未知' }}
            </el-tag>
          </div>
          <div class="pm-mobile-card__meta">
            <div>
              <span class="label">产品图号</span>
              <span class="value">{{ row.productDrawing || '-' }}</span>
            </div>
            <div>
              <span class="label">客户模号</span>
              <span class="value">{{ row.客户模号 || '-' }}</span>
            </div>
            <div>
              <span class="label">材质</span>
              <span class="value">{{ row.产品材质 || '-' }}</span>
            </div>
            <div>
              <span class="label">穴数</span>
              <span class="value">{{ row.模具穴数 ?? '-' }}</span>
            </div>
          </div>
          <div class="pm-mobile-card__dates">
            <div>
              <span class="label">首样</span>
              <span class="value">
                {{ formatDate(row.计划首样日期) }}
                <el-tag
                  v-if="isDueSoon(row.计划首样日期)"
                  type="warning"
                  size="small"
                  effect="light"
                  style="margin-left: 6px"
                >
                  {{ daysUntil(row.计划首样日期) }}天
                </el-tag>
                <el-tag
                  v-else-if="isOverdue(row.计划首样日期, row.首次送样日期)"
                  type="danger"
                  size="small"
                  effect="dark"
                  style="margin-left: 6px"
                >
                  -{{ overdueDays(row.计划首样日期, row.首次送样日期) }}天
                </el-tag>
              </span>
            </div>
            <div>
              <span class="label">移模</span>
              <span class="value">{{ formatDate(row.移模日期) }}</span>
            </div>
            <div>
              <span class="label">图纸下发</span>
              <span class="value">{{ formatDate(row.图纸下发日期) }}</span>
            </div>
          </div>
          <div v-if="row.进度影响原因" class="pm-mobile-card__impact">
            <span class="label">进度影响</span>
            <span class="value">{{ row.进度影响原因 }}</span>
          </div>
          <div class="pm-mobile-card__actions">
            <el-button size="small" type="primary" @click="handleView(row)">查看</el-button>
            <el-button size="small" @click="handleEdit(row)">编辑</el-button>
          </div>
        </el-card>
      </template>
    </div>

    <div
      class="pagination-footer"
      :class="{ 'pagination-footer--mobile': isMobile || viewMode === 'card' }"
    >
      <el-pagination
        background
        :layout="paginationLayout"
        :current-page="pagination.page"
        :page-size="pagination.size"
        :page-sizes="[10, 15, 20, 30, 50]"
        :total="total"
        :pager-count="paginationPagerCount"
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
      />
    </div>

    <!-- 查看详情对话框 -->
    <el-dialog
      v-model="viewDialogVisible"
      title="项目详情"
      :width="isMobile ? '100%' : '1200px'"
      :fullscreen="isMobile"
      class="pm-detail-dialog"
    >
      <div v-if="viewDetailSections.length" class="pm-detail-view">
        <div v-for="section in viewDetailSections" :key="section.title" class="detail-section">
          <div class="detail-section-header">{{ section.title }}</div>
          <div class="detail-grid">
            <div v-for="item in section.items" :key="item.label" class="detail-cell">
              <span class="detail-label">{{ item.label }}</span>
              <span class="detail-value">
                <template v-if="item.tag">
                  <el-tag
                    :type="getStatusTagType(item.value as string)"
                    class="pm-status-tag"
                    :class="getStatusTagClass(item.value as string)"
                  >
                    {{ item.value || '-' }}
                  </el-tag>
                </template>
                <template v-else>
                  {{ item.value || '-' }}
                </template>
              </span>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <el-button @click="viewDialogVisible = false">关闭</el-button>
        <el-button type="primary" @click="handleEditFromView">编辑</el-button>
      </template>
    </el-dialog>

    <!-- 新增出库单对话框（参考销售订单新增弹窗） -->
    <el-dialog
      v-model="createDialogVisible"
      title="新增出库单"
      :width="isMobile ? '100%' : 'min(1400px, calc(100vw - 48px))'"
      :fullscreen="isMobile"
      :close-on-click-modal="false"
      class="od-dialog"
      @closed="handleCreateDialogClosed"
    >
      <el-form
        ref="createFormRef"
        :model="createForm"
        :rules="createRules"
        label-width="auto"
        class="dialog-form-container"
      >
        <div class="dialog-form-columns">
          <div class="dialog-form-column dialog-form-column--left">
            <el-form-item label="出库单号" prop="出库单号">
              <el-input
                v-model="createForm.出库单号"
                placeholder="自动生成"
                disabled
                :style="{ width: dialogControlWidth }"
              />
            </el-form-item>
            <el-form-item label="出库日期" prop="出库日期">
              <el-date-picker
                v-model="createForm.出库日期"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="请选择出库日期"
                :style="{ width: dialogControlWidth }"
              />
            </el-form-item>
            <el-form-item label="出库类型">
              <el-select
                v-model="createForm.出库类型"
                placeholder="请选择出库类型"
                clearable
                :style="{ width: dialogControlWidth }"
              >
                <el-option
                  v-for="item in outboundTypeOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
          </div>
          <div class="dialog-form-column dialog-form-column--right">
            <el-form-item label="客户名称" prop="客户ID">
              <el-select
                v-model="createForm.客户ID"
                placeholder="请选择客户"
                filterable
                clearable
                :style="{ width: dialogControlWidth }"
                @change="handleCreateCustomerChange"
              >
                <el-option
                  v-for="customer in customerList"
                  :key="customer.id"
                  :label="customer.customerName"
                  :value="customer.id"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="经办人">
              <el-input
                v-model="createForm.经办人"
                disabled
                :style="{ width: dialogControlWidth }"
              />
            </el-form-item>
            <el-form-item label="仓库">
              <el-select
                v-model="createForm.仓库"
                placeholder="请选择仓库"
                clearable
                :style="{ width: dialogControlWidth }"
              >
                <el-option
                  v-for="item in warehouseOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
          </div>
        </div>

        <div class="dialog-product-section">
          <div style="margin-bottom: 12px">
            <el-button type="primary" size="small" @click="openInventorySelectDialog">
              从存货中选择
            </el-button>
          </div>
          <div v-if="!isMobile" class="dialog-table-wrapper">
            <el-table
              :data="createForm.details"
              border
              size="small"
              row-key="id"
              style="width: 100%"
            >
              <el-table-column type="index" label="序号" width="45" />
              <el-table-column label="项目编号" min-width="140">
                <template #default="{ row }">
                  <el-input v-model="row.itemCode" disabled />
                </template>
              </el-table-column>
              <el-table-column label="产品名称" min-width="140">
                <template #default="{ row }">
                  <el-input v-model="row.productName" disabled />
                </template>
              </el-table-column>
              <el-table-column label="产品图号" min-width="120">
                <template #default="{ row }">
                  <el-input v-model="row.productDrawingNo" disabled />
                </template>
              </el-table-column>
              <el-table-column label="客户模号" min-width="120">
                <template #default="{ row }">
                  <el-input v-model="row.customerPartNo" disabled />
                </template>
              </el-table-column>
              <el-table-column label="数量" width="140" align="center">
                <template #default="{ row }">
                  <el-input-number v-model="row.quantity" :min="0" :step="1" style="width: 100%" />
                </template>
              </el-table-column>
              <el-table-column label="备注" min-width="130">
                <template #default="{ row }">
                  <el-input v-model="row.remark" placeholder="备注" />
                </template>
              </el-table-column>
              <el-table-column label="操作" width="55" fixed="right">
                <template #default="{ $index }">
                  <el-button
                    v-if="createForm.details.length > 1"
                    type="danger"
                    link
                    @click="removeCreateDetailRow($index)"
                  >
                    删除
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
          <div v-else class="dialog-mobile-details-list">
            <div
              v-for="(detail, index) in createForm.details"
              :key="detail.id || index"
              class="dialog-mobile-detail-card"
            >
              <div class="dialog-mobile-detail-header">
                <span class="dialog-mobile-detail-title">明细 {{ index + 1 }}</span>
                <el-button
                  v-if="createForm.details.length > 1"
                  type="danger"
                  text
                  size="small"
                  @click="removeCreateDetailRow(index)"
                >
                  删除
                </el-button>
              </div>
              <div class="dialog-mobile-detail-body">
                <div class="dialog-mobile-detail-field">
                  <div class="dialog-mobile-detail-label">项目编号</div>
                  <el-input v-model="detail.itemCode" disabled />
                </div>
                <div class="dialog-mobile-detail-field">
                  <div class="dialog-mobile-detail-label">产品名称</div>
                  <el-input v-model="detail.productName" disabled />
                </div>
                <div class="dialog-mobile-detail-field">
                  <div class="dialog-mobile-detail-label">产品图号</div>
                  <el-input v-model="detail.productDrawingNo" disabled />
                </div>
                <div class="dialog-mobile-detail-field">
                  <div class="dialog-mobile-detail-label">客户模号</div>
                  <el-input v-model="detail.customerPartNo" disabled />
                </div>
                <div class="dialog-mobile-detail-field">
                  <div class="dialog-mobile-detail-label">数量</div>
                  <el-input-number
                    v-model="detail.quantity"
                    :min="0"
                    :step="1"
                    style="width: 100%"
                  />
                </div>
                <div class="dialog-mobile-detail-field">
                  <div class="dialog-mobile-detail-label">备注</div>
                  <el-input v-model="detail.remark" placeholder="备注" />
                </div>
              </div>
            </div>
          </div>

          <div class="dialog-product-summary">
            <div>
              <span class="dialog-product-summary__item"
                >产品项数：{{ createForm.details.length }}</span
              >
              <span>总数量：{{ createTotals.totalQuantity }}</span>
            </div>
          </div>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="createSubmitting" @click="handleSubmitCreate">
          保存
        </el-button>
      </template>
    </el-dialog>

    <!-- 从存货中选择（仅展示项目管理中“已经移模”的记录） -->
    <el-dialog
      v-model="inventoryDialogVisible"
      title="从存货中选择"
      :width="isMobile ? '100%' : 'min(1200px, calc(100vw - 48px))'"
      :fullscreen="isMobile"
      :close-on-click-modal="false"
      class="od-dialog"
    >
      <div
        v-if="inventorySelectedCustomerName"
        style="
          padding: 8px;
          margin-bottom: 12px;
          background-color: #f0f9ff;
          border: 1px solid #91d5ff;
          border-radius: 4px;
        "
      >
        <span style="font-weight: 500; color: #1890ff">
          已限制客户：{{ inventorySelectedCustomerName }}
        </span>
        <span style="margin-left: 8px; font-size: 12px; color: #666">
          （只能选择同一客户的记录）
        </span>
      </div>
      <div
        style="
          padding: 8px;
          margin-bottom: 12px;
          background-color: #f0f9ff;
          border: 1px solid #91d5ff;
          border-radius: 4px;
        "
      >
        <span style="font-weight: 500; color: #1890ff">仅显示项目状态为“已经移模”的记录</span>
      </div>
      <div class="dialog-table-wrapper">
        <el-table
          ref="inventoryTableRef"
          v-loading="inventoryLoading"
          :data="inventoryList"
          row-key="项目编号"
          border
          @selection-change="handleInventorySelectionChange"
          max-height="500px"
        >
          <el-table-column type="selection" width="55" :selectable="isInventoryRowSelectable" />
          <el-table-column prop="项目编号" label="项目编号" min-width="140" />
          <el-table-column prop="productName" label="产品名称" min-width="160">
            <template #default="{ row }">
              {{ row.productName || row.产品名称 || '-' }}
            </template>
          </el-table-column>
          <el-table-column prop="productDrawing" label="产品图号" min-width="150">
            <template #default="{ row }">
              {{ row.productDrawing || row.产品图号 || '-' }}
            </template>
          </el-table-column>
          <el-table-column prop="客户模号" label="客户模号" min-width="150" show-overflow-tooltip />
          <el-table-column prop="客户名称" label="客户名称" min-width="160" show-overflow-tooltip>
            <template #default="{ row }">
              {{ getInventoryCustomerName(row) }}
            </template>
          </el-table-column>
        </el-table>
      </div>

      <template #footer>
        <span v-if="selectedInventoryRows.length" style="margin-right: auto; color: #666">
          已选择 {{ selectedInventoryRows.length }} 条
        </span>
        <el-button @click="inventoryDialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          :disabled="selectedInventoryRows.length === 0"
          @click="confirmInventorySelect"
        >
          确认选择
        </el-button>
      </template>
    </el-dialog>

    <!-- 新增/编辑出库单对话框 -->
    <el-dialog
      v-model="editDialogVisible"
      :title="editTitle"
      :width="isMobile ? '100%' : '900px'"
      :fullscreen="isMobile"
      :close-on-click-modal="false"
      @close="handleEditDialogClose"
    >
      <el-form
        ref="editFormRef"
        :model="editForm"
        :rules="editRules"
        label-width="120px"
        class="outbound-document-form"
      >
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="出库单号" prop="出库单号">
              <el-input
                v-model="editForm.出库单号"
                placeholder="请输入出库单号"
                :disabled="!!currentDocumentNo"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="出库日期" prop="出库日期">
              <el-date-picker
                v-model="editForm.出库日期"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="请选择出库日期"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="客户名称" prop="客户ID">
              <el-select
                v-model="editForm.客户ID"
                placeholder="请选择客户"
                filterable
                clearable
                style="width: 100%"
                @change="handleCustomerChange"
              >
                <el-option
                  v-for="customer in customerList"
                  :key="customer.id"
                  :label="customer.customerName"
                  :value="customer.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="项目编号">
              <el-input v-model="editForm.项目编号" placeholder="请输入项目编号" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="产品名称">
              <el-input v-model="editForm.产品名称" placeholder="请输入产品名称" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="产品图号">
              <el-input v-model="editForm.产品图号" placeholder="请输入产品图号" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="出库类型" prop="出库类型">
              <el-select
                v-model="editForm.出库类型"
                placeholder="请选择出库类型"
                style="width: 100%"
              >
                <el-option
                  v-for="item in outboundTypeOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="仓库" prop="仓库">
              <el-select v-model="editForm.仓库" placeholder="请选择仓库" style="width: 100%">
                <el-option
                  v-for="item in warehouseOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="出库数量" prop="出库数量">
              <el-input-number
                v-model="editForm.出库数量"
                :min="0"
                :precision="2"
                :controls="false"
                placeholder="出库数量"
                style="width: 100%"
                @change="calculateAmount"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="单位">
              <el-input v-model="editForm.单位" placeholder="单位" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="单价" prop="单价">
              <el-input-number
                v-model="editForm.单价"
                :min="0"
                :precision="2"
                :controls="false"
                placeholder="单价"
                style="width: 100%"
                @change="calculateAmount"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="金额">
              <el-input v-model="editForm.金额" readonly placeholder="自动计算" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="经办人" prop="经办人">
              <el-input v-model="editForm.经办人" placeholder="请输入经办人" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="审核状态" prop="审核状态">
              <el-select
                v-model="editForm.审核状态"
                placeholder="请选择审核状态"
                style="width: 100%"
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
          <el-col :span="12">
            <el-form-item label="审核人">
              <el-input v-model="editForm.审核人" placeholder="请输入审核人" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="24">
            <el-form-item label="备注">
              <el-input
                v-model="editForm.备注"
                type="textarea"
                :rows="3"
                placeholder="请输入备注"
              />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="editSubmitting" @click="handleSubmitEdit">
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage, ElRadioButton, ElRadioGroup, ElEmpty } from 'element-plus'
import {
  getOutboundDocumentListApi,
  getOutboundDocumentDetailApi,
  createOutboundDocumentApi,
  updateOutboundDocumentApi,
  getOutboundDocumentStatisticsApi,
  type OutboundDocument
} from '@/api/outbound-document'
import { useAppStore } from '@/store/modules/app'
import { useUserStore } from '@/store/modules/user'
import { getProjectListApi, type ProjectInfo } from '@/api/project'

const loading = ref(false)
const tableData = ref<Partial<OutboundDocument>[]>([])
const total = ref(0)
const pagination = reactive({ page: 1, size: 20 })
const showExtraColumns = ref(true)
const sortState = reactive({
  prop: '',
  order: '' as '' | 'ascending' | 'descending'
})
const summary = reactive({
  totalDocuments: 0,
  pendingDocuments: 0,
  approvedDocuments: 0,
  rejectedDocuments: 0
})

type ViewMode = 'table' | 'card'

const appStore = useAppStore()
const userStore = useUserStore()
const isMobile = computed(() => appStore.getMobile)
const viewMode = ref<ViewMode>(isMobile.value ? 'card' : 'table')
const showMobileFilters = ref(false)
const showMobileSummary = ref(false)
const tableHeight = computed(() => (isMobile.value ? undefined : 'calc(100vh - 300px)'))

// 分页组件布局：PC 端保留完整布局，手机端精简，避免内容被遮挡
const paginationLayout = computed(() =>
  isMobile.value || viewMode.value === 'card'
    ? 'total, prev, pager, next'
    : 'total, sizes, prev, pager, next, jumper'
)

// 分页组件页码数量：手机端减少显示的数字页数，避免横向挤压
const paginationPagerCount = computed(() => (isMobile.value || viewMode.value === 'card' ? 5 : 7))

const queryForm = reactive({ keyword: '', status: '', outboundType: '' })
const outboundTypeOptions = [
  { label: '销售出库', value: '销售出库' },
  { label: '生产出库', value: '生产出库' },
  { label: '调拨出库', value: '调拨出库' },
  { label: '其他出库', value: '其他出库' }
]
const statusOptions = [
  { label: '待审核', value: '待审核' },
  { label: '已审核', value: '已审核' },
  { label: '已驳回', value: '已驳回' }
]

const viewDialogVisible = ref(false)
const viewData = ref<Partial<OutboundDocument>>({})

type CreateDetailRow = {
  id: number
  itemCode: string
  productName: string
  productDrawingNo: string
  customerPartNo: string
  quantity: number
  remark: string
}

const createDialogVisible = ref(false)
const createSubmitting = ref(false)
const createFormRef = ref<FormInstance>()
const createForm = reactive<{
  出库单号: string
  出库日期: string
  出库类型: string
  仓库: string
  客户ID: number | null
  客户名称: string
  经办人: string
  details: CreateDetailRow[]
}>({
  出库单号: '',
  出库日期: '',
  出库类型: '',
  仓库: '',
  客户ID: null,
  客户名称: '',
  经办人: '',
  details: []
})

const createRules: FormRules = {
  出库单号: [{ required: true, message: '请输入出库单号', trigger: 'blur' }],
  出库日期: [{ required: true, message: '请选择出库日期', trigger: 'change' }],
  客户ID: [{ required: true, message: '请选择客户', trigger: 'change' }]
}

const dialogControlWidth = computed(() => (isMobile.value ? '100%' : '420px'))

const createTotals = computed(() => {
  const totalQuantity = (createForm.details || []).reduce(
    (sum, d) => sum + Number(d.quantity || 0),
    0
  )
  return { totalQuantity }
})

const makeCreateDetailRow = (): CreateDetailRow => ({
  id: Date.now() + Math.floor(Math.random() * 10000),
  itemCode: '',
  productName: '',
  productDrawingNo: '',
  customerPartNo: '',
  quantity: 0,
  remark: ''
})

const handleCreateCustomerChange = (customerId: number | null) => {
  if (customerId) {
    const customer = customerList.value.find((c) => c.id === customerId)
    createForm.客户名称 = customer?.customerName || ''
  } else {
    createForm.客户名称 = ''
  }
}

const openInventorySelectDialog = () => {
  inventoryDialogVisible.value = true
  if (customerList.value.length === 0) {
    void loadCustomerList()
  }
  void loadInventoryList()
}

const removeCreateDetailRow = (index: number) => {
  if (!Array.isArray(createForm.details)) return
  if (createForm.details.length <= 1) return
  createForm.details.splice(index, 1)
}

const inventoryDialogVisible = ref(false)
const inventoryLoading = ref(false)
const inventoryList = ref<Partial<ProjectInfo>[]>([])
const inventoryTableRef = ref()
const selectedInventoryRows = ref<Partial<ProjectInfo>[]>([])
const inventorySelectionKeys = ref<Set<string>>(new Set())

const inventorySelectedCustomerName = computed(() => {
  if (!createForm.客户ID) return ''
  const customer = customerList.value.find((c) => c.id === createForm.客户ID)
  return customer?.customerName || ''
})

const getInventoryCustomerName = (row: Partial<ProjectInfo>) => {
  const direct = (row as any).客户名称
  if (typeof direct === 'string' && direct.trim()) return direct
  const cid = Number((row as any).客户ID)
  if (!Number.isFinite(cid) || cid <= 0) return '-'
  const customer = customerList.value.find((c) => c.id === cid)
  return customer?.customerName || '-'
}

const getInventoryCustomerKey = (row: Partial<ProjectInfo>) => {
  const cid = Number((row as any).客户ID)
  if (Number.isFinite(cid) && cid > 0) return `id:${cid}`
  const name = getInventoryCustomerName(row)
  if (name && name !== '-') return `name:${name}`
  return null
}

const getInventoryRowKey = (row: Partial<ProjectInfo>) => String((row as any).项目编号 || '')

const isInventoryRowSelectable = (row: Partial<ProjectInfo>) => {
  if (!selectedInventoryRows.value.length) return true
  const locked = getInventoryCustomerKey(selectedInventoryRows.value[0])
  if (!locked) return false
  return getInventoryCustomerKey(row) === locked
}

const loadInventoryList = async () => {
  try {
    inventoryLoading.value = true
    selectedInventoryRows.value = []
    inventorySelectionKeys.value = new Set()

    const resp: any = await getProjectListApi({
      page: 1,
      pageSize: 1000,
      status: '已经移模',
      sortField: '项目编号',
      sortOrder: 'desc'
    })
    const raw: any = resp
    const payload: any = raw?.data ?? raw
    const list = payload?.data?.list ?? payload?.list ?? payload?.data ?? []
    let rows = Array.isArray(list) ? list : []

    if (createForm.客户ID) {
      rows = rows.filter((r: any) => Number(r?.客户ID) === Number(createForm.客户ID))
    }

    rows = rows.map((r: any) => ({
      ...r,
      客户名称: r?.客户名称 || getInventoryCustomerName(r)
    }))

    inventoryList.value = rows
    await nextTick()
    ;(inventoryTableRef.value as any)?.clearSelection?.()
  } catch (error) {
    console.error('加载存货列表失败:', error)
    inventoryList.value = []
    ElMessage.error('加载存货列表失败')
  } finally {
    inventoryLoading.value = false
  }
}

const handleInventorySelectionChange = (rows: Partial<ProjectInfo>[]) => {
  const nextRows = Array.isArray(rows) ? rows : []
  const table: any = inventoryTableRef.value

  if (nextRows.length <= 1) {
    selectedInventoryRows.value = nextRows
    inventorySelectionKeys.value = new Set(nextRows.map(getInventoryRowKey).filter(Boolean))
    return
  }

  const keys = nextRows
    .map(getInventoryCustomerKey)
    .filter((k): k is string => typeof k === 'string' && k.length > 0)
  const unique = new Set(keys)

  // 多选时强制同一客户
  if (unique.size > 1) {
    const prevKeys = inventorySelectionKeys.value || new Set()
    const nextKeys = new Set(nextRows.map(getInventoryRowKey).filter(Boolean))
    const addedKey = Array.from(nextKeys).find((k) => !prevKeys.has(k))
    const addedRow = addedKey ? nextRows.find((r) => getInventoryRowKey(r) === addedKey) : null

    ElMessage.warning('多选时必须选择相同客户的记录')

    if (table?.toggleRowSelection && addedRow) {
      table.toggleRowSelection(addedRow, false)
      return
    }

    // 兜底：清空选择
    table?.clearSelection?.()
    selectedInventoryRows.value = []
    inventorySelectionKeys.value = new Set()
    return
  }

  selectedInventoryRows.value = nextRows
  inventorySelectionKeys.value = new Set(nextRows.map(getInventoryRowKey).filter(Boolean))
}

const confirmInventorySelect = () => {
  const rows = selectedInventoryRows.value || []
  if (!rows.length) return

  const customerIds = new Set<number>()
  for (const r of rows) {
    const cid = Number((r as any).客户ID)
    if (Number.isFinite(cid) && cid > 0) customerIds.add(cid)
  }
  if (!createForm.客户ID && customerIds.size === 1) {
    createForm.客户ID = Array.from(customerIds)[0]
    handleCreateCustomerChange(createForm.客户ID)
  } else if (!createForm.客户ID && customerIds.size > 1) {
    ElMessage.warning('所选记录客户不一致，未自动选择客户')
  }

  if (!Array.isArray(createForm.details) || createForm.details.length === 0) {
    createForm.details = [makeCreateDetailRow()]
  }

  const isBlankRow = (d: CreateDetailRow) =>
    !d.itemCode && !d.productName && !d.productDrawingNo && !d.customerPartNo && !d.remark

  const existing = new Set(
    createForm.details.map((d) => String(d.itemCode || '').trim()).filter(Boolean)
  )
  const toAdd: CreateDetailRow[] = []
  const skipped: string[] = []

  for (const r of rows) {
    const projectCode = String(r.项目编号 || '').trim()
    if (!projectCode) continue
    if (existing.has(projectCode)) {
      skipped.push(projectCode)
      continue
    }
    existing.add(projectCode)
    toAdd.push({
      ...makeCreateDetailRow(),
      itemCode: projectCode,
      productName: String((r as any).productName || r.产品名称 || ''),
      productDrawingNo: String((r as any).productDrawing || r.产品图号 || ''),
      customerPartNo: String((r as any).客户模号 || ''),
      quantity: 0,
      remark: ''
    })
  }

  if (!toAdd.length) {
    ElMessage.warning('所选记录均已添加或无有效项目编号')
    return
  }

  if (createForm.details.length === 1 && isBlankRow(createForm.details[0])) {
    createForm.details.splice(0, 1, ...toAdd)
  } else {
    createForm.details.push(...toAdd)
  }

  if (skipped.length) {
    ElMessage.warning(`以下项目编号已存在，已跳过：${skipped.join('、')}`)
  }

  inventoryDialogVisible.value = false
}

const getChinaYmdCompact = () => {
  const now = new Date()
  const chinaTimestamp = now.getTime() + 8 * 60 * 60 * 1000
  const chinaTime = new Date(chinaTimestamp)
  const year = chinaTime.getUTCFullYear()
  const month = String(chinaTime.getUTCMonth() + 1).padStart(2, '0')
  const day = String(chinaTime.getUTCDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

const formatChinaYmdDash = () => {
  const now = new Date()
  const chinaTimestamp = now.getTime() + 8 * 60 * 60 * 1000
  const chinaTime = new Date(chinaTimestamp)
  const year = chinaTime.getUTCFullYear()
  const month = String(chinaTime.getUTCMonth() + 1).padStart(2, '0')
  const day = String(chinaTime.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// 参考销售订单编号生成规则：前缀-YYYYMMDD-XXX（东八区日期，同日递增，跨天重置为001）
const generateOutboundDocumentNo = async () => {
  const prefix = 'CK'
  const ymd = getChinaYmdCompact()

  let serialNumber = 1
  try {
    const resp: any = await getOutboundDocumentListApi({
      page: 1,
      pageSize: 50,
      keyword: `${prefix}-`,
      sortField: '出库单号',
      sortOrder: 'desc'
    })
    const raw: any = resp
    const payload: any = raw?.data ?? raw

    const list =
      payload?.data?.list ?? payload?.list ?? payload?.data?.data?.list ?? payload?.data ?? []

    const lastNo = Array.isArray(list)
      ? (list.find((x: any) => typeof x?.出库单号 === 'string')?.出库单号 as string | undefined)
      : undefined

    if (lastNo) {
      const match = lastNo.match(/^CK-(\d{8})-(\d{3})$/)
      if (match) {
        const lastDate = match[1]
        const lastSerial = Number.parseInt(match[2], 10)
        if (lastDate === ymd && Number.isFinite(lastSerial)) {
          serialNumber = lastSerial + 1
        }
      }
    }
  } catch (e) {
    // 如果后端不支持排序/查询，降级为本地序列（仅保证当前浏览器会话内尽量不重复）
    const key = `outboundDocSerial_${prefix}_${ymd}`
    const last = Number.parseInt(localStorage.getItem(key) || '0', 10)
    serialNumber = Number.isFinite(last) && last > 0 ? last + 1 : 1
    localStorage.setItem(key, String(serialNumber))
  }

  const formattedSerial = String(serialNumber).padStart(3, '0')
  return `${prefix}-${ymd}-${formattedSerial}`
}

const handleCreate = async () => {
  if (customerList.value.length === 0) {
    await loadCustomerList()
  }

  createForm.出库单号 = await generateOutboundDocumentNo()
  createForm.出库日期 = formatChinaYmdDash()
  createForm.出库类型 = '销售出库'
  createForm.仓库 = '成品仓'
  createForm.客户ID = null
  createForm.客户名称 = ''
  createForm.经办人 = userStore.getUserInfo?.username || ''
  createForm.details = [makeCreateDetailRow()]

  createDialogVisible.value = true
  await nextTick()
  createFormRef.value?.clearValidate()
}

const handleSubmitCreate = async () => {
  if (!createFormRef.value) return

  try {
    await createFormRef.value.validate()
  } catch {
    return
  }

  const details = Array.isArray(createForm.details) ? createForm.details : []
  if (!details.length) {
    ElMessage.error('请至少填写一条明细')
    return
  }

  const emptyRows: number[] = []
  const missingItemRows: number[] = []
  details.forEach((d, idx) => {
    if (!d.itemCode?.trim()) {
      missingItemRows.push(idx + 1)
      return
    }
    // 仅“数量”为必填
    if (!d.quantity || d.quantity <= 0) {
      emptyRows.push(idx + 1)
    }
  })
  if (missingItemRows.length) {
    ElMessage.error(`第 ${missingItemRows.join('、')} 行缺少项目编号，请从存货中选择`)
    return
  }
  if (emptyRows.length) {
    ElMessage.error(`第 ${emptyRows.join('、')} 行的数量不能为空或小于等于0`)
    return
  }

  // 多明细提交：由后端按同一出库单号落多条明细/或保存明细表（具体由后端实现）
  const payload: Record<string, any> = {
    出库单号: createForm.出库单号,
    出库日期: createForm.出库日期,
    出库类型: createForm.出库类型 || undefined,
    仓库: createForm.仓库 || undefined,
    客户ID: createForm.客户ID || undefined,
    客户名称: createForm.客户名称 || undefined,
    经办人: createForm.经办人 || undefined,
    details: details.map((d) => ({
      项目编号: d.itemCode || undefined,
      产品名称: d.productName || undefined,
      产品图号: d.productDrawingNo || undefined,
      客户模号: d.customerPartNo || undefined,
      出库数量: Number(d.quantity || 0),
      备注: d.remark || undefined
    }))
  }

  createSubmitting.value = true
  try {
    await createOutboundDocumentApi(payload as any)
    ElMessage.success('创建成功')
    createDialogVisible.value = false
    loadData()
    loadStatistics()
  } catch (error: any) {
    ElMessage.error('创建失败: ' + (error.message || '未知错误'))
  } finally {
    createSubmitting.value = false
  }
}

const handleCreateDialogClosed = () => {
  createFormRef.value?.resetFields()
  createForm.details = []
}

const editDialogVisible = ref(false)
const editTitle = ref('编辑出库单')
const editFormRef = ref<FormInstance>()
const editForm = reactive<Partial<OutboundDocument>>({})
const editSubmitting = ref(false)
const currentDocumentNo = ref('')

const isFieldFilled = (value: unknown) => {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  return true
}

const basicTabCompleted = computed(() => {
  // 除了 项目名称、设计师、进度影响原因、备注 以外的“基本信息”字段
  const fields: (keyof ProjectInfo | 'projectName')[] = [
    '出库单号',
    '审核状态',
    '客户模号',
    '制件厂家',
    '中标日期',
    '产品3D确认',
    '图纸下发日期',
    '计划首样日期',
    '首次送样日期',
    '封样时间',
    '移模日期'
  ]
  return fields.every((key) => isFieldFilled((editForm as any)[key]))
})

const partTabCompleted = computed(() => {
  const fields: (keyof ProjectInfo | 'productName' | 'productDrawing')[] = [
    'productName',
    'productDrawing',
    '产品尺寸',
    '产品重量',
    '产品材质',
    '产品颜色',
    '收缩率',
    '料柄重量'
  ]
  return fields.every((key) => isFieldFilled((editForm as any)[key]))
})

const mouldTabCompleted = computed(() => {
  const fields: (keyof ProjectInfo)[] = [
    '模具穴数',
    '模具尺寸',
    '模具重量',
    '前模材质',
    '后模材质',
    '滑块材质',
    '流道类型',
    '流道数量',
    '浇口类型',
    '浇口数量',
    '机台吨位',
    '锁模力',
    '定位圈',
    '容模量',
    '拉杆间距',
    '成型周期'
  ]
  return fields.every((key) => isFieldFilled((editForm as any)[key]))
})

// 仓库选项
const warehouseOptions = [
  { label: '主仓库', value: '主仓库' },
  { label: '原料仓', value: '原料仓' },
  { label: '成品仓', value: '成品仓' },
  { label: '辅料仓', value: '辅料仓' },
  { label: '工具仓', value: '工具仓' }
]

// 客户列表
const customerList = ref<Array<{ id: number; customerName: string }>>([])

// 表单验证规则
const editRules: FormRules = {
  出库单号: [{ required: true, message: '请输入出库单号', trigger: 'blur' }],
  出库日期: [{ required: true, message: '请选择出库日期', trigger: 'change' }],
  客户ID: [{ required: true, message: '请选择客户', trigger: 'change' }],
  出库类型: [{ required: true, message: '请选择出库类型', trigger: 'change' }],
  仓库: [{ required: true, message: '请选择仓库', trigger: 'change' }],
  出库数量: [{ required: true, message: '请输入出库数量', trigger: 'blur' }],
  单价: [{ required: true, message: '请输入单价', trigger: 'blur' }],
  经办人: [{ required: true, message: '请输入经办人', trigger: 'blur' }]
}

// 计算金额
const calculateAmount = () => {
  const quantity = editForm.出库数量 || 0
  const unitPrice = editForm.单价 || 0
  editForm.金额 = quantity * unitPrice
}

// 客户选择变化
const handleCustomerChange = (customerId: number | null) => {
  if (customerId) {
    const customer = customerList.value.find((c) => c.id === customerId)
    if (customer) {
      editForm.客户名称 = customer.customerName
    }
  } else {
    editForm.客户名称 = undefined
  }
}

// 加载客户列表
const loadCustomerList = async () => {
  try {
    const { getCustomerListApi } = await import('@/api/customer')
    const response = await getCustomerListApi({ pageSize: 1000, status: 'active' })
    const list = response?.data?.list || response?.data || []
    customerList.value = list.filter((c: any) => c.status === 'active')
  } catch (error) {
    console.error('加载客户列表失败:', error)
    customerList.value = []
  }
}

watch(isMobile, (mobile) => {
  viewMode.value = mobile ? 'card' : 'table'
  if (!mobile) {
    showMobileFilters.value = true
  }
})

const loadData = async () => {
  loading.value = true
  try {
    const params: any = {
      page: pagination.page,
      pageSize: pagination.size
    }
    if (queryForm.keyword) params.keyword = queryForm.keyword
    if (queryForm.status) params.status = queryForm.status
    if (queryForm.outboundType) params.outboundType = queryForm.outboundType
    if (sortState.prop && sortState.order) {
      params.sortField = sortState.prop
      params.sortOrder = sortState.order === 'ascending' ? 'asc' : 'desc'
    }

    const response: any = await getOutboundDocumentListApi(params)
    console.log('API Response:', response)

    // 为保证记录完整性，这里不再做前端过滤，全部交给后端根据状态参数处理
    if (response?.data?.data) {
      tableData.value = response.data.data.list || []
      total.value = response.data.data.total || 0
    } else if (response?.data) {
      tableData.value = response.data.list || []
      total.value = response.data.total || 0
    }
  } catch (error: any) {
    console.error('获取数据失败:', error)
    ElMessage.error('获取数据失败: ' + (error.message || '未知错误'))
  } finally {
    loading.value = false
  }
}

const handleSortChange = (sort: { prop: string; order: 'ascending' | 'descending' | null }) => {
  sortState.prop = sort.order ? sort.prop : ''
  sortState.order = sort.order || ''
  pagination.page = 1
  loadData()
}

// 加载统计信息
const loadStatistics = async () => {
  try {
    const response: any = await getOutboundDocumentStatisticsApi()
    if (response?.code === 0 && response?.data) {
      summary.totalDocuments = response.data.totalDocuments || 0
      summary.pendingDocuments = response.data.pendingDocuments || 0
      summary.approvedDocuments = response.data.approvedDocuments || 0
      summary.rejectedDocuments = response.data.rejectedDocuments || 0
    }
  } catch (error) {
    console.error('加载统计信息失败:', error)
  }
}

const handleSearch = () => {
  pagination.page = 1
  loadData()
  loadStatistics()
}

const handleReset = () => {
  queryForm.keyword = ''
  queryForm.status = ''
  queryForm.outboundType = ''
  handleSearch()
}

const handleSizeChange = (size: number) => {
  pagination.size = size
  pagination.page = 1
  loadData()
}

const handleCurrentChange = (page: number) => {
  pagination.page = page
  loadData()
}

const getStatusTagType = (status?: string) => {
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

// 给每个审核状态分配唯一颜色（通过 class 覆盖 el-tag 默认配色）
const statusClassMap: Record<string, string> = {
  T0: 'pm-status--t0',
  T1: 'pm-status--t1',
  T2: 'pm-status--t2',
  设计中: 'pm-status--designing',
  加工中: 'pm-status--processing',
  表面处理: 'pm-status--surface',
  封样: 'pm-status--sample',
  待移模: 'pm-status--pending-move',
  已经移模: 'pm-status--moved'
}

const getStatusTagClass = (status?: string) => {
  if (!status) return ''
  return statusClassMap[status] || ''
}

// 格式化日期，只显示年月日
const formatDate = (date?: string | null) => {
  if (!date) return '-'

  // 处理 ISO 格式: 2025-10-02T00:00:00.000Z
  if (date.includes('T')) {
    return date.split('T')[0]
  }

  // 处理带时间的格式: 2024-01-01 12:00:00 或 2024-01-01 12:00:00.000
  if (date.includes(' ')) {
    return date.split(' ')[0]
  }

  // 如果已经是 YYYY-MM-DD 格式，直接返回
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date
  }

  return date
}

// 格式化值，处理空值显示
const formatValue = (value?: string | number | null) => {
  if (value === null || value === undefined || value === '') return '-'
  if (typeof value === 'number' && value === 0) return '-'
  return value
}

type DetailItem = {
  label: string
  value: string
  tag?: boolean
}

type DetailSection = {
  title: string
  items: DetailItem[]
}

const viewDetailSections = computed<DetailSection[]>(() => {
  const data = viewData.value || {}

  const v = (val?: string | number | null) => {
    const res = formatValue(val)
    return typeof res === 'number' ? String(res) : (res ?? '-')
  }

  const baseInfo: DetailItem[] = [
    { label: '出库单号', value: v(data.出库单号 ?? '') },
    { label: '审核状态', value: v(data.审核状态 ?? ''), tag: true },
    { label: '项目名称', value: v(data.项目名称 ?? '') },
    { label: '产品名称', value: v(data.productName ?? '') },
    { label: '产品图号', value: v(data.productDrawing ?? '') },
    { label: '客户模号', value: v(data.客户模号 ?? '') },
    { label: '制件厂家', value: v(data.制件厂家 ?? '') },
    { label: '进度影响原因', value: v(data.进度影响原因 ?? '') },
    { label: '备注', value: v(data.备注 ?? '') }
  ]

  const productInfo: DetailItem[] = [
    { label: '产品尺寸', value: v(data.产品尺寸 ?? '') },
    { label: '产品重量（克）', value: v(data.产品重量 ?? '') },
    { label: '产品材质', value: v(data.产品材质 ?? '') },
    { label: '产品颜色', value: v(data.产品颜色 ?? '') },
    { label: '收缩率', value: v(data.收缩率 ?? '') },
    { label: '料柄重量', value: v(data.料柄重量 ?? '') }
  ]

  const mouldInfo: DetailItem[] = [
    { label: '模具穴数', value: v(data.模具穴数 ?? '') },
    { label: '模具尺寸', value: v(data.模具尺寸 ?? '') },
    { label: '模具重量（吨）', value: v(data.模具重量 ?? '') },
    { label: '前模材质', value: v(data.前模材质 ?? '') },
    { label: '后模材质', value: v(data.后模材质 ?? '') },
    { label: '滑块材质', value: v(data.滑块材质 ?? '') },
    { label: '流道类型', value: v(data.流道类型 ?? '') },
    { label: '流道数量', value: v(data.流道数量 ?? '') },
    { label: '浇口类型', value: v(data.浇口类型 ?? '') },
    { label: '浇口数量', value: v(data.浇口数量 ?? '') }
  ]

  const equipmentInfo: DetailItem[] = [
    { label: '机台吨位（吨）', value: v(data.机台吨位 ?? '') },
    { label: '锁模力', value: v(data.锁模力 ?? '') },
    { label: '定位圈', value: v(data.定位圈 ?? '') },
    { label: '容模量', value: v(data.容模量 ?? '') },
    { label: '拉杆间距', value: v(data.拉杆间距 ?? '') },
    { label: '成型周期（秒）', value: v(data.成型周期 ?? '') }
  ]

  const dateInfo: DetailItem[] = [
    { label: '中标日期', value: formatDate(data.中标日期 ?? '') },
    { label: '产品3D确认', value: formatDate(data.产品3D确认 ?? '') },
    { label: '图纸下发日期', value: formatDate(data.图纸下发日期 ?? '') },
    { label: '计划首样日期', value: formatDate(data.计划首样日期 ?? '') },
    { label: '首次送样日期', value: formatDate(data.首次送样日期 ?? '') },
    { label: '移模日期', value: formatDate(data.移模日期 ?? '') },
    { label: '封样时间', value: formatDate(data.封样时间 ?? '') }
  ]

  return [
    { title: '基本信息', items: baseInfo },
    { title: '产品信息', items: productInfo },
    { title: '模具信息', items: mouldInfo },
    { title: '设备参数', items: equipmentInfo },
    { title: '时间信息', items: dateInfo }
  ]
})

// 规范化为本地零点的日期，避免时区引起的天数误差
const normalizeToLocalDate = (date?: string | null) => {
  const ymd = formatDate(date)
  if (!ymd || ymd === '-') return null
  const [y, m, d] = ymd.split('-').map((v) => parseInt(v, 10))
  return new Date(y, (m || 1) - 1, d || 1)
}

// 返回今天到目标日期的天数（目标 - 今天），向下取整
const daysUntil = (date?: string | null) => {
  const target = normalizeToLocalDate(date)
  if (!target) return Infinity
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diffMs = target.getTime() - today.getTime()
  return Math.floor(diffMs / (24 * 60 * 60 * 1000))
}

// 是否在未来7天内（含当天和第7天）
const isDueSoon = (date?: string | null) => {
  const d = daysUntil(date)
  return d >= 0 && d <= 7
}

// 是否已经逾期：
// - 如果有首次送样日期：首次送样日期 > 计划首样日期 时视为逾期
// - 如果首次送样日期为空：用系统当前日期与计划首样日期对比，当前日期 > 计划首样日期 时视为逾期
const isOverdue = (planDate?: string | null, firstSampleDate?: string | null) => {
  const plan = normalizeToLocalDate(planDate)
  if (!plan) return false

  const first = normalizeToLocalDate(firstSampleDate)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const compareDate = first || today

  const diffMs = compareDate.getTime() - plan.getTime()
  return diffMs > 0
}

// 逾期天数：
// - 如果有首次送样日期：首次送样日期 - 计划首样日期 的天数差（>0 时取正）
// - 如果首次送样日期为空：系统当前日期 - 计划首样日期 的天数差（>0 时取正）
const overdueDays = (planDate?: string | null, firstSampleDate?: string | null) => {
  const plan = normalizeToLocalDate(planDate)
  if (!plan) return 0

  const first = normalizeToLocalDate(firstSampleDate)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const compareDate = first || today

  const diffMs = compareDate.getTime() - plan.getTime()
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000))
  return days > 0 ? days : 0
}

const handleView = async (row: Partial<OutboundDocument>) => {
  try {
    const response: any = await getOutboundDocumentDetailApi(row.出库单号 || '')
    viewData.value = response.data?.data || response.data || row
    viewDialogVisible.value = true
  } catch (error: any) {
    ElMessage.error('获取详情失败')
  }
}

const handleEditFromView = () => {
  viewDialogVisible.value = false
  setTimeout(() => handleEdit(viewData.value), 100)
}

const handleEdit = async (row: Partial<OutboundDocument>) => {
  editTitle.value = '编辑出库单'
  currentDocumentNo.value = row.出库单号 || ''

  try {
    // 如果有出库单号，加载详细信息
    if (row.出库单号) {
      const response = await getOutboundDocumentDetailApi(row.出库单号)
      const data = response?.data?.data || response?.data || row
      Object.assign(editForm, data)
    } else {
      Object.assign(editForm, row)
    }

    editDialogVisible.value = true
  } catch (error) {
    console.error('加载出库单详情失败:', error)
    ElMessage.error('加载出库单详情失败')
    Object.assign(editForm, row)
    editDialogVisible.value = true
  }
}

// 附件相关状态
const attachmentLoading = ref(false)
const allAttachments = ref<ProjectAttachment[]>([])

const relocationProcessAttachments = computed(() =>
  allAttachments.value.filter((item) => item.type === 'relocation-process')
)
const trialRecordAttachments = computed(() =>
  allAttachments.value.filter((item) => item.type === 'trial-record')
)
const tripartiteAgreementAttachments = computed(() =>
  allAttachments.value.filter((item) => item.type === 'tripartite-agreement')
)
const trialFormAttachments = computed(() =>
  allAttachments.value.filter((item) => item.type === 'trial-form')
)

// 生产任务附件相关状态
const productionTaskAttachmentLoading = ref(false)
const productionTaskPhotoAttachments = ref<ProductionTaskAttachment[]>([])
const productionTaskInspectionAttachments = ref<ProductionTaskAttachment[]>([])

const productionTaskPhotoAppearanceAttachments = computed(() =>
  productionTaskPhotoAttachments.value.filter((a) => a.tag === 'appearance')
)
const productionTaskPhotoNameplateAttachments = computed(() =>
  productionTaskPhotoAttachments.value.filter((a) => a.tag === 'nameplate')
)

// 加载附件列表
const loadAttachments = async () => {
  const projectCode = editForm.出库单号 || currentDocumentNo.value
  if (!projectCode) {
    allAttachments.value = []
    return
  }

  attachmentLoading.value = true
  try {
    // 出库单暂不支持附件功能
    // 根据 axios 拦截器的处理，response 已经是后端返回的 { code, success, data: [...] } 对象
    // 所以应该直接访问 response.data 获取数组（类似生产任务的实现：photoResp?.data）
    allAttachments.value = response?.data || []
    console.log(
      '加载附件列表成功，出库单号:',
      projectCode,
      '附件数量:',
      allAttachments.value.length,
      '响应:',
      response
    )
  } catch (error: any) {
    console.error('加载附件列表失败:', error)
    ElMessage.error(error?.message || '加载附件列表失败')
    allAttachments.value = []
  } finally {
    attachmentLoading.value = false
  }
}

// 加载生产任务附件列表
const loadProductionTaskAttachments = async () => {
  const projectCode = editForm.出库单号 || currentDocumentNo.value
  if (!projectCode) {
    productionTaskPhotoAttachments.value = []
    productionTaskInspectionAttachments.value = []
    return
  }

  productionTaskAttachmentLoading.value = true
  try {
    const [photoResp, inspectionResp]: any[] = await Promise.all([
      getProductionTaskAttachmentsApi(projectCode, 'photo'),
      getProductionTaskAttachmentsApi(projectCode, 'inspection')
    ])
    productionTaskPhotoAttachments.value = photoResp?.data || []
    productionTaskInspectionAttachments.value = inspectionResp?.data || []
  } catch (error) {
    console.error('加载生产任务附件失败:', error)
    productionTaskPhotoAttachments.value = []
    productionTaskInspectionAttachments.value = []
  } finally {
    productionTaskAttachmentLoading.value = false
  }
}

// 获取上传API地址
const getAttachmentAction = (type: ProjectAttachmentType) => {
  const projectCode = String(editForm.出库单号 || currentDocumentNo.value || '').trim()
  // 直接返回URL，即使出库单号为空也返回（让后端处理验证）
  // 这样可以避免在页面初始化时就显示错误提示
  return `/api/project/${encodeURIComponent(projectCode || '')}/attachments/${type}`
}

// 上传前确认（用于单文件类型的覆盖确认）
const beforeAttachmentUpload = async (_file: File, type: ProjectAttachmentType) => {
  // 单文件类型需要确认覆盖
  const singleFileTypes: ProjectAttachmentType[] = [
    'relocation-process',
    'trial-record',
    'tripartite-agreement'
  ]

  if (singleFileTypes.includes(type)) {
    // 检查是否已有文件
    let existingAttachments: ProjectAttachment[] = []
    if (type === 'relocation-process') {
      existingAttachments = relocationProcessAttachments.value
    } else if (type === 'trial-record') {
      existingAttachments = trialRecordAttachments.value
    } else if (type === 'tripartite-agreement') {
      existingAttachments = tripartiteAgreementAttachments.value
    }

    if (existingAttachments.length > 0) {
      const oldFileName =
        existingAttachments[0].storedFileName || existingAttachments[0].originalName
      try {
        await ElMessageBox.confirm(
          `已存在文件：${oldFileName}。确认上传将覆盖现有文件，是否继续？`,
          '确认覆盖',
          {
            confirmButtonText: '确认覆盖',
            cancelButtonText: '取消',
            type: 'warning',
            closeOnClickModal: false
          }
        )
        return true
      } catch {
        return false // 用户取消，阻止上传
      }
    }
  }

  return true // 没有旧文件或不是单文件类型，允许上传
}

// 上传成功回调
const handleAttachmentUploadSuccess = (response: any) => {
  console.log('上传响应:', response)
  // 处理不同的响应结构：response.code 或 response.data?.code
  const code = response?.code ?? response?.data?.code
  const success = response?.success ?? response?.data?.success

  if (code === 0 || success) {
    ElMessage.success('上传成功')
    // 延迟一点再加载，确保数据库已更新
    setTimeout(() => {
      loadAttachments()
    }, 200)
  } else {
    ElMessage.error(response?.message || response?.data?.message || '上传失败')
  }
}

// 上传失败回调
const handleAttachmentUploadError = (error: any) => {
  console.error('上传附件失败:', error)
  ElMessage.error(error?.message || '上传失败')
}

// 判断附件是否为图片
const isImageFile = (attachment: ProjectAttachment): boolean => {
  if (attachment.contentType && attachment.contentType.startsWith('image/')) {
    return true
  }
  const fileName = attachment.storedFileName || attachment.originalName || ''
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico']
  return imageExts.includes(ext)
}

// 判断附件是否为 PDF
const isPdfFile = (attachment: ProjectAttachment): boolean => {
  if (attachment.contentType === 'application/pdf') {
    return true
  }
  const fileName = attachment.storedFileName || attachment.originalName || ''
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  return ext === 'pdf'
}

// 预览图片附件
const handleAttachmentPreview = async (attachment: ProjectAttachment) => {
  if (!isImageFile(attachment)) {
    ElMessage.warning('该文件不是图片格式')
    return
  }

  try {
    // 获取同类型的所有图片附件
    const sameTypeAttachments = allAttachments.value.filter(
      (item) => item.type === attachment.type && isImageFile(item)
    )
    if (sameTypeAttachments.length === 0) {
      ElMessage.warning('没有可预览的图片')
      return
    }

    const currentIndex = sameTypeAttachments.findIndex((item) => item.id === attachment.id)

    const urlList: string[] = []
    const blobUrls: string[] = []

    try {
      const blobPromises = sameTypeAttachments.map(async (item) => {
        try {
          const resp = await downloadProjectAttachmentApi(item.id)
          const blob = (resp as any)?.data ?? resp
          const url = window.URL.createObjectURL(blob as Blob)
          blobUrls.push(url)
          return url
        } catch (error) {
          console.error(`加载图片 ${item.storedFileName || item.originalName} 失败:`, error)
          return null
        }
      })

      const urls = await Promise.all(blobPromises)
      urlList.push(...urls.filter((url): url is string => url !== null))

      if (urlList.length === 0) {
        ElMessage.warning('加载图片失败')
        return
      }

      createImageViewer({
        urlList,
        initialIndex: currentIndex >= 0 ? currentIndex : 0,
        infinite: true,
        hideOnClickModal: true,
        zIndex: 3000,
        teleported: true
      })
    } catch (error) {
      blobUrls.forEach((url) => window.URL.revokeObjectURL(url))
      throw error
    }
  } catch (error) {
    console.error('预览图片失败:', error)
    ElMessage.error('预览图片失败')
  }
}

// 预览 PDF 附件
const handleAttachmentPdfPreview = async (attachment: ProjectAttachment) => {
  if (!isPdfFile(attachment)) {
    ElMessage.warning('该文件不是 PDF 格式')
    return
  }

  try {
    const resp = await downloadProjectAttachmentApi(attachment.id)
    const blob = (resp as any)?.data ?? resp
    const url = window.URL.createObjectURL(blob as Blob)

    if (isMobile.value) {
      const newWindow = window.open(url, '_blank')
      if (!newWindow) {
        ElMessage.warning('请允许弹出窗口以预览 PDF')
        window.URL.revokeObjectURL(url)
      }
    } else {
      createPdfViewer({
        url,
        fileName: attachment.storedFileName || attachment.originalName || 'PDF 文件'
      })
    }
  } catch (error) {
    console.error('预览 PDF 失败:', error)
    ElMessage.error('预览 PDF 失败')
  }
}

// 下载附件
const downloadAttachment = async (row: ProjectAttachment) => {
  try {
    const resp: any = await downloadProjectAttachmentApi(row.id)
    const blob = ((resp as any)?.data ?? resp) as Blob
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = row.storedFileName || row.originalName || `附件_${row.id}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  } catch (error: any) {
    console.error('下载附件失败:', error)
    ElMessage.error(error?.message || '下载失败')
  }
}

// 删除附件
const deleteAttachment = async (row: ProjectAttachment) => {
  try {
    await ElMessageBox.confirm(
      `确定删除附件：${row.storedFileName || row.originalName}？`,
      '提示',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
        closeOnClickModal: false
      }
    )
  } catch {
    return
  }

  try {
    await deleteProjectAttachmentApi(row.id)
    ElMessage.success('删除成功')
    await loadAttachments()
  } catch (error: any) {
    console.error('删除附件失败:', error)
    ElMessage.error(error?.message || '删除失败')
  }
}

// 格式化文件大小
const formatFileSize = (size?: number | null): string => {
  if (!size || size <= 0) return '-'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

// 判断生产任务附件是否为图片
const isProductionTaskImageFile = (attachment: ProductionTaskAttachment): boolean => {
  if (attachment.contentType?.startsWith('image/')) {
    return true
  }
  const fileName = attachment.storedFileName || attachment.originalName || ''
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico']
  return imageExts.includes(ext)
}

// 判断生产任务附件是否为 PDF
const isProductionTaskPdfFile = (attachment: ProductionTaskAttachment): boolean => {
  if (attachment.contentType === 'application/pdf') {
    return true
  }
  const fileName = attachment.storedFileName || attachment.originalName || ''
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  return ext === 'pdf'
}

// 预览生产任务图片附件
const handleProductionTaskAttachmentPreview = async (attachment: ProductionTaskAttachment) => {
  if (!isProductionTaskImageFile(attachment)) {
    ElMessage.warning('该文件不是图片格式')
    return
  }

  try {
    // 获取同类型的所有图片附件
    let allAttachments: ProductionTaskAttachment[] = []
    if (attachment.type === 'photo') {
      allAttachments = productionTaskPhotoAttachments.value
    } else if (attachment.type === 'inspection') {
      allAttachments = productionTaskInspectionAttachments.value
    }

    const imageAttachments = allAttachments.filter(isProductionTaskImageFile)
    if (imageAttachments.length === 0) {
      ElMessage.warning('没有可预览的图片')
      return
    }

    const currentIndex = imageAttachments.findIndex((item) => item.id === attachment.id)

    const urlList: string[] = []
    const blobUrls: string[] = []

    try {
      const blobPromises = imageAttachments.map(async (item) => {
        try {
          const resp = await downloadProductionTaskAttachmentApi(item.id)
          const blob = (resp as any)?.data ?? resp
          const url = window.URL.createObjectURL(blob as Blob)
          blobUrls.push(url)
          return url
        } catch (error) {
          console.error(`加载图片 ${item.storedFileName || item.originalName} 失败:`, error)
          return null
        }
      })

      const urls = await Promise.all(blobPromises)
      urlList.push(...urls.filter((url): url is string => url !== null))

      if (urlList.length === 0) {
        ElMessage.warning('加载图片失败')
        return
      }

      createImageViewer({
        urlList,
        initialIndex: currentIndex >= 0 ? currentIndex : 0,
        infinite: true,
        hideOnClickModal: true,
        zIndex: 3000,
        teleported: true
      })
    } catch (error) {
      blobUrls.forEach((url) => window.URL.revokeObjectURL(url))
      throw error
    }
  } catch (error) {
    console.error('预览图片失败:', error)
    ElMessage.error('预览图片失败')
  }
}

// 预览生产任务 PDF 附件
const handleProductionTaskAttachmentPdfPreview = async (attachment: ProductionTaskAttachment) => {
  if (!isProductionTaskPdfFile(attachment)) {
    ElMessage.warning('该文件不是 PDF 格式')
    return
  }

  try {
    const resp = await downloadProductionTaskAttachmentApi(attachment.id)
    const blob = (resp as any)?.data ?? resp
    const url = window.URL.createObjectURL(blob as Blob)

    if (isMobile.value) {
      const newWindow = window.open(url, '_blank')
      if (!newWindow) {
        ElMessage.warning('请允许弹出窗口以预览 PDF')
        window.URL.revokeObjectURL(url)
      }
    } else {
      createPdfViewer({
        url,
        fileName: attachment.storedFileName || attachment.originalName || 'PDF 文件'
      })
    }
  } catch (error) {
    console.error('预览 PDF 失败:', error)
    ElMessage.error('预览 PDF 失败')
  }
}

// 下载生产任务附件
const downloadProductionTaskAttachment = async (row: ProductionTaskAttachment) => {
  try {
    const resp: any = await downloadProductionTaskAttachmentApi(row.id)
    const blob = ((resp as any)?.data ?? resp) as Blob
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = row.storedFileName || row.originalName || `附件_${row.id}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  } catch (error: any) {
    console.error('下载附件失败:', error)
    ElMessage.error(error?.message || '下载失败')
  }
}

const handleSubmitEdit = async () => {
  if (!editFormRef.value) return

  try {
    await editFormRef.value.validate()
  } catch {
    return
  }

  // 当审核状态改为“已经移模”时，进行额外业务校验：
  // 1. 必须填写移模日期
  // 2. 对应生产任务的生产状态必须为“已完成”
  if (editForm.审核状态 === '已经移模') {
    if (!editForm.移模日期) {
      ElMessage.error('审核状态为“已经移模”时，必须填写移模日期')
      return
    }

    const projectCode = editForm.出库单号 || currentDocumentNo.value
    if (!projectCode) {
      ElMessage.error('出库单号不能为空，无法校验生产任务状态')
      return
    }

    try {
      const response: any = await getProductionTaskDetailApi(projectCode)
      const taskData = response?.data?.data || response?.data || null

      if (!taskData) {
        ElMessage.error('未找到对应的生产任务，无法将审核状态设置为“已经移模”')
        return
      }

      const taskStatus = taskData.生产状态
      if (taskStatus !== '已完成') {
        ElMessage.error('生产任务状态必须为“已完成”才能将审核状态设置为“已经移模”')
        return
      }
    } catch (error: any) {
      ElMessage.error('校验生产任务状态失败，暂不能将审核状态设置为“已经移模”')
      return
    }
  }

  editSubmitting.value = true
  try {
    if (currentDocumentNo.value) {
      // 过滤掉 productName 和 productDrawing，这两个字段不属于出库单表
      const { productName, productDrawing, ...updateData } = editForm
      await updateOutboundDocumentApi(currentDocumentNo.value, updateData)
      ElMessage.success('更新成功')
    } else {
      // 确保出库单号存在
      if (!editForm.出库单号) {
        ElMessage.error('出库单号不能为空')
        return
      }
      // 过滤掉 productName 和 productDrawing
      const { productName, productDrawing, ...createData } = editForm
      await createOutboundDocumentApi(createData as OutboundDocument)
      ElMessage.success('创建成功')
    }
    editDialogVisible.value = false
    loadData()
    loadStatistics()
  } catch (error: any) {
    ElMessage.error('保存失败: ' + (error.message || '未知错误'))
  } finally {
    editSubmitting.value = false
  }
}

const handleEditDialogClose = () => {
  editFormRef.value?.resetFields()
  Object.keys(editForm).forEach((key) => delete (editForm as any)[key])
  currentDocumentNo.value = ''
}

onMounted(() => {
  loadData()
  loadStatistics()
  loadCustomerList()
})
</script>

<style scoped>
@media (width <= 1200px) {
  .detail-grid {
    flex-wrap: wrap;
    background: transparent;
    border: none;
    border-radius: 0;
    box-shadow: none;
  }

  .detail-grid-col {
    flex: 0 0 50%;
    max-width: 50%;
    background: transparent;
    border-right: 1px solid #e4e7ed;
    border-bottom: 1px solid #e4e7ed;
  }

  .detail-cell {
    min-height: 40px;
    padding: 6px 8px;
  }

  .detail-label {
    flex: 0 0 90px;
    font-size: 12px;
  }

  .detail-value {
    font-size: 13px;
  }

  /* 每行右侧列去掉右边框，避免双线 */
  .detail-grid-col:nth-child(2n) {
    border-right: none;
  }

  /* 最后一行两列去掉下边框 */
  .detail-grid-col:nth-last-child(-n + 2) {
    border-bottom: none;
  }

  .detail-row-remark {
    background: transparent;
    border: none;
    border-radius: 0;
    box-shadow: none;
  }

  :deep(.el-dialog__body) {
    padding-right: 8px;
    padding-left: 8px;
  }
}

@media (width <= 768px) {
  /* 手机端项目详情对话框：尽量铺满且减少边距 */
  :deep(.el-dialog__body) {
    padding: 8px 4px 12px;
  }

  .detail-grid {
    width: 100%;
    border-right: none;
    border-left: none;
    border-radius: 0;
    box-shadow: none;
  }

  .detail-cell {
    min-height: 40px;
    padding: 6px 4px;
  }

  .detail-label {
    flex: 0 0 70px;
    font-size: 12px;
  }

  .detail-value {
    overflow: hidden;
    font-size: 13px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .detail-row-remark {
    border-right: none;
    border-left: none;
    border-radius: 0;
    box-shadow: none;
  }

  .query-form--mobile {
    padding: 12px;
  }

  :deep(.query-form--mobile .el-form-item) {
    width: 100%;
    margin-right: 0;
    margin-bottom: 12px;
  }

  :deep(.query-form--mobile .el-form-item .el-form-item__content) {
    width: 100%;
  }

  :deep(.query-form--mobile .el-input),
  :deep(.query-form--mobile .el-select),
  :deep(.query-form--mobile .el-date-editor) {
    width: 100%;
  }

  .summary-card {
    height: auto;
    min-height: 70px;
  }

  .pm-mobile-card__meta {
    grid-template-columns: repeat(1, minmax(0, 1fr));
  }

  .pm-mobile-card__dates {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  :deep(.pm-table .el-table__body-wrapper tbody tr) {
    height: 40px !important;
  }

  :deep(.pm-table .el-table__body-wrapper .el-table__cell) {
    padding-top: 6px !important;
    padding-bottom: 6px !important;
  }
}

@media (width <= 768px) {
  .dialog-form-columns {
    flex-direction: column;
    gap: 12px;
  }
}

/* 手机端详情两列 + 紧凑布局（仅项目详情弹窗） */
@media (width <= 768px) {
  /* 覆盖对话框本身的左右留白，尽量铺满 */
  :deep(.pm-detail-dialog) {
    width: 100% !important;
    max-width: 100% !important;
    margin: 0 !important;
    border-radius: 0;
  }

  /* 让查看弹窗更贴边、减少留白 */
  :deep(.pm-detail-dialog .el-dialog__body) {
    padding: 2px 0 6px;
  }

  :deep(.pm-detail-dialog .el-dialog__header) {
    padding-right: 6px;
    padding-left: 6px;
  }

  :deep(.pm-detail-dialog .el-dialog__footer) {
    padding-right: 6px;
    padding-left: 6px;
  }

  .pm-detail-view {
    gap: 8px;
  }

  .pm-detail-dialog .detail-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }

  .pm-detail-dialog .detail-cell {
    min-height: 22px;
    padding: 2px 4px;
  }

  .pm-detail-dialog .detail-label {
    padding-right: 4px;
    overflow: visible;
    font-size: 11px;
    text-overflow: unset;
    white-space: normal;
    flex: 0 0 auto;
  }

  .pm-detail-dialog .detail-value {
    font-size: 11px;
  }
}

@media (width <= 768px) {
  .query-form__actions {
    margin-top: 8px;
  }
}

/* PC 端编辑弹窗：拉高整体高度并收紧头/脚边距，主体自适应填充 */
@media (width >= 769px) {
  :deep(.pm-edit-dialog .el-dialog) {
    display: flex;
    height: 720px;
    max-height: 720px;
    min-height: 720px;
    margin: auto;
    flex-direction: column;
  }

  :deep(.pm-edit-dialog .el-dialog__body) {
    display: flex;
    min-height: 0;
    padding: 14px 16px;
    overflow: hidden;
    flex: 1;
    flex-direction: column;
  }

  :deep(.pm-edit-dialog .el-dialog__footer) {
    padding: 12px 16px 14px;
  }
}

.dialog-form-container {
  padding-top: 6px;
}

.dialog-form-columns {
  display: flex;
  gap: 24px;
}

.dialog-form-column {
  flex: 1;
}

.dialog-product-section {
  margin-top: 6px;
}

.dialog-table-wrapper {
  width: 100%;
}

.dialog-mobile-details-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.dialog-mobile-detail-card {
  padding: 10px;
  background: var(--el-bg-color-overlay);
  border: 1px solid #e4e7ed;
  border-radius: 8px;
}

.dialog-mobile-detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.dialog-mobile-detail-title {
  font-weight: 600;
}

.dialog-mobile-detail-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.dialog-mobile-detail-field {
  display: grid;
  grid-template-columns: 86px 1fr;
  gap: 8px;
  align-items: center;
}

.dialog-mobile-detail-label {
  font-size: 12px;
  color: #666;
}

.dialog-product-summary {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin-top: 12px;
}

.dialog-product-summary__item {
  margin-right: 12px;
}

.query-form {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
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

.outbound-document-page {
  position: relative;
}

/* 编辑弹窗中所有输入框内容左对齐（覆盖默认样式，仅限该弹窗） */
:deep(.pm-edit-dialog .el-input__inner) {
  text-align: left;
}

/* 特别覆盖数字输入框默认居中样式 */
:deep(.pm-edit-dialog .el-input-number .el-input__inner) {
  text-align: left !important;
}

.pm-edit-body {
  display: flex;
  max-height: var(--pm-edit-body-fixed-height, none);
  min-height: var(--pm-edit-body-fixed-height, auto);
  overflow: hidden;
  flex: 1;
  flex-direction: column;
}

.pm-edit-tabs-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

:deep(.pm-edit-tabs) {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

:deep(.pm-edit-tabs .el-tabs__header) {
  order: 0;
}

:deep(.pm-edit-tabs .el-tabs__content) {
  min-height: 0;
  padding-right: 6px;
  overflow: auto;
  order: 1;
  flex: 1;
}

.pm-edit-header {
  display: flex;
  padding: 10px 14px;
  margin-bottom: 12px;
  background: #f5f7fa;
  border-radius: 6px;
  flex-direction: column;
  gap: 4px;
}

.pm-edit-header-main {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pm-edit-header-code {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.pm-edit-header-status {
  margin-left: 4px;
}

.pm-edit-header-sub {
  font-size: 13px;
  color: #606266;
}

.pm-edit-header-name {
  font-weight: 500;
}

.pm-edit-header-product {
  color: #909399;
}

.pm-edit-tabs {
  display: flex;
  height: 100%;
  margin-top: 4px;
  overflow: hidden;
  flex-direction: column;
}

/* 固定 tabs 内容区域高度，确保切换页签时弹窗高度不变 */
:deep(.pm-edit-tabs .el-tabs__content) {
  min-height: 0;
  overflow: hidden auto;
  flex: 1;
}

:deep(.pm-edit-tabs .el-tab-pane) {
  height: 100%;
}

.pm-edit-section {
  padding: 12px 14px 4px;
  margin-bottom: 12px;
  background-color: #fff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
}

.pm-edit-section-title {
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #606266;
}

.pm-tab-complete-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  margin-left: 4px;
  background-color: var(--el-color-success);
  border-radius: 50%;
}

.mobile-top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 2px 6px 0;
}

.mobile-top-bar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.view-mode-switch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.view-mode-switch__label {
  font-size: 12px;
  color: #666;
}

.query-form__actions {
  margin-left: auto;
}

.query-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.pm-table-wrapper {
  background: var(--el-bg-color);
  border-radius: 8px;
}

.pm-table-wrapper--mobile {
  padding-bottom: 8px;
  overflow-x: auto;
}

.pm-table-wrapper--mobile .pm-table {
  min-width: 960px;
}

.pm-mobile-list {
  display: grid;
  gap: 12px;
}

.pm-mobile-card {
  border-radius: 10px;
}

.pm-mobile-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.pm-mobile-card__code {
  font-size: 14px;
  font-weight: 600;
}

.pm-mobile-card__name {
  font-size: 13px;
  color: #666;
}

.pm-name-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.pm-column-toggle-icon {
  display: inline-flex;
  width: 18px;
  height: 18px;
  margin-left: 4px;
  color: var(--el-text-color-placeholder);
  cursor: pointer;
  align-items: center;
  justify-content: center;
}

.pm-column-toggle-icon:hover {
  color: var(--el-color-primary);
}

.pm-mobile-card__meta {
  display: grid;
  font-size: 13px;
  color: #555;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px 12px;
}

.pm-mobile-card__meta .label {
  margin-right: 4px;
  color: #888;
}

.pm-mobile-card__dates {
  display: grid;
  margin: 8px 0;
  font-size: 13px;
  color: #555;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px 10px;
}

.pm-mobile-card__dates .label {
  margin-right: 4px;
  color: #888;
}

.pm-mobile-card__impact {
  margin: 6px 0;
  color: #666;
}

.pm-mobile-card__impact .label {
  margin-right: 6px;
  color: #888;
}

.pm-mobile-card__actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 6px;
}

.pm-plan-date-cell {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.pm-plan-date-text {
  flex: 1;
  min-width: 0;
}

.pm-plan-date-tag {
  flex: 0 0 auto;
  display: flex;
  justify-content: flex-end;
}

.pm-due-tag {
  min-width: 52px;
  text-align: center;
  justify-content: center;
}

.query-form {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

:deep(.query-form .el-form-item) {
  margin-bottom: 0;
}

.edit-form-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 确保 el-form 不会撑开容器 */
:deep(.edit-form-container.el-form) {
  display: flex;
  height: 100%;
  overflow: hidden;
  flex-direction: column;
}

:deep(.el-descriptions__table) {
  table-layout: fixed;
}

:deep(.el-descriptions__table .el-descriptions__cell) {
  width: 25%;
}

/* 详情查看布局 */
.detail-grid {
  display: flex;
  flex-wrap: wrap;
  overflow: hidden;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgb(0 0 0 / 8%);
  gap: 0;
}

.detail-grid-col {
  max-width: 50%;
  background: linear-gradient(180deg, #fafbfc 0%, #fff 100%);
  border-right: 1px solid #e4e7ed;
  flex: 0 0 50%;
}

.detail-grid-col:last-child {
  border-right: none;
}

.detail-grid-col:nth-child(odd) {
  background: linear-gradient(180deg, #f5f7fa 0%, #fff 100%);
}

.pm-detail-view {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail-section {
  overflow: hidden;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.detail-section-header {
  padding: 6px 10px;
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #409eff;
  background-color: #f5f7fa;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.pm-detail-view .detail-grid {
  display: grid;
  background: transparent;
  border: none;
  border-radius: 0;
  box-shadow: none;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0;
}

.detail-cell {
  display: flex;
  min-height: 32px;
  padding: 6px 8px;
  border-right: 1px solid #f0f2f5;
  border-bottom: 1px solid #f0f2f5;
  align-items: center;
}

.detail-label {
  flex: 0 0 130px;
  padding-right: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #606266;
}

.detail-label::after {
  margin-left: 2px;
  color: #c0c4cc;
  content: ':';
}

.detail-value {
  flex: 1;
  font-size: 14px;
  color: #303133;
  word-break: break-word;
}

.detail-value:empty::before {
  font-style: italic;
  color: #c0c4cc;
  content: '-';
}

/* 标签样式优化 */
:deep(.el-tag) {
  font-weight: 500;
  letter-spacing: 0.5px;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgb(0 0 0 / 10%);
}

/* 审核状态颜色覆盖（每个状态独立配色） */
:deep(.el-tag.pm-status--t0) {
  color: #f5222d !important;
  background-color: rgb(245 34 45 / 12%) !important;
  border-color: rgb(245 34 45 / 45%) !important;
}

:deep(.el-tag.pm-status--t1) {
  color: #fa541c !important;
  background-color: rgb(250 84 28 / 12%) !important;
  border-color: rgb(250 84 28 / 45%) !important;
}

:deep(.el-tag.pm-status--t2) {
  color: #faad14 !important;
  background-color: rgb(250 173 20 / 12%) !important;
  border-color: rgb(250 173 20 / 45%) !important;
}

:deep(.el-tag.pm-status--designing) {
  color: #67c23a !important;
  background-color: rgb(103 194 58 / 12%) !important;
  border-color: rgb(103 194 58 / 45%) !important;
}

:deep(.el-tag.pm-status--processing) {
  color: #e6a23c !important;
  background-color: rgb(230 162 60 / 12%) !important;
  border-color: rgb(230 162 60 / 45%) !important;
}

:deep(.el-tag.pm-status--surface) {
  color: #13c2c2 !important;
  background-color: rgb(19 194 194 / 12%) !important;
  border-color: rgb(19 194 194 / 45%) !important;
}

:deep(.el-tag.pm-status--sample) {
  color: #2f54eb !important;
  background-color: rgb(47 84 235 / 12%) !important;
  border-color: rgb(47 84 235 / 45%) !important;
}

:deep(.el-tag.pm-status--pending-move) {
  color: #eb2f96 !important;
  background-color: rgb(235 47 150 / 12%) !important;
  border-color: rgb(235 47 150 / 45%) !important;
}

:deep(.el-tag.pm-status--moved) {
  color: #52c41a !important;
  background-color: rgb(82 196 26 / 12%) !important;
  border-color: rgb(82 196 26 / 45%) !important;
}

/* 列表里的审核状态统一宽度 */
:deep(.el-tag.pm-status-tag--fixed) {
  display: inline-flex;
  width: 80px;
  text-align: center;
  white-space: nowrap;
  box-sizing: border-box;
  justify-content: center;
}

/* 统计卡片样式 */
.summary-card {
  display: flex;
  height: 64px;
  border: none;
  transition: all 0.3s ease;
  align-items: stretch;
}

.summary-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgb(0 0 0 / 10%) !important;
}

/* 分页固定在页面底部居中，靠近版权信息区域（与销售订单一致） */
.pagination-footer {
  position: fixed;
  bottom: 10px;
  left: 50%;
  z-index: 10;
  display: flex;
  transform: translateX(-50%);
  justify-content: center;
}

/* 第一个卡片 - 蓝色 */
.summary-card--blue {
  background: linear-gradient(145deg, rgb(64 158 255 / 12%), rgb(64 158 255 / 6%));
}

.summary-card--blue .summary-title {
  color: #409eff;
}

.summary-card--blue .summary-value {
  color: #409eff;
}

/* 第二个卡片 - 绿色 */
.summary-card--green {
  background: linear-gradient(145deg, rgb(103 194 58 / 12%), rgb(103 194 58 / 6%));
}

.summary-card--green .summary-title {
  color: #67c23a;
}

.summary-card--green .summary-value {
  color: #67c23a;
}

/* 第三个卡片 - 橙色 */
.summary-card--orange {
  background: linear-gradient(145deg, rgb(230 162 60 / 12%), rgb(230 162 60 / 6%));
}

.summary-card--orange .summary-title {
  color: #e6a23c;
}

.summary-card--orange .summary-value {
  color: #e6a23c;
}

/* 第四个卡片 - 紫色 */
.summary-card--purple {
  background: linear-gradient(145deg, rgb(144 147 153 / 12%), rgb(144 147 153 / 6%));
}

.summary-card--purple .summary-title {
  color: #909399;
}

.summary-card--purple .summary-value {
  color: #909399;
}

.summary-title {
  font-size: 13px;
  font-weight: 500;
}

.summary-value {
  margin-top: 2px;
  font-size: 20px;
  font-weight: 600;
}

/* 压缩统计卡片高度，并垂直居中内容 */
:deep(.summary-card .el-card__body) {
  display: flex;
  height: 100%;
  padding: 4px 12px;
  overflow: hidden;
  box-sizing: border-box;
  flex: 1;
  flex-direction: column;
  justify-content: center;
}

/* 表格所有单元格内容不换行，超出宽度省略显示 */
:deep(.el-table .cell),
:deep(.el-table .cell span),
:deep(.el-table .cell div) {
  white-space: nowrap !important;
}

/* 压缩数据行行高，仅作用于数据行 */
:deep(.el-table__body-wrapper .el-table__cell) {
  padding-top: 2px;
  padding-bottom: 2px;
}

/* 额外覆盖：调整出库单主表数据行高度，使在固定表高下正好显示 20 行 */
:deep(.pm-table .el-table__body-wrapper tbody tr) {
  height: 22px !important;
}

:deep(.pm-table .el-table__body-wrapper .el-table__cell) {
  padding-top: 2px !important;
  padding-bottom: 2px !important;
}

:deep(.pm-op-column .cell) {
  display: flex;
  justify-content: center;
  padding-right: 2px !important;
  padding-left: 2px !important;
}

.pagination-footer--mobile {
  position: static;
  left: auto;
  margin-top: 12px;
  transform: none;
  justify-content: center;
}

/* 附件页签样式 */
.pm-attachments {
  padding: 12px 14px 6px;
}

.pm-attachments-row {
  width: 100%;
}

.pm-attachment-col {
  margin-bottom: 16px;
}

.pm-attachment-card {
  width: 100%;
  height: 100%;
}

:deep(.pm-attachment-card .el-card__body) {
  padding: 12px;
}

/* 响应式优化 */
</style>
