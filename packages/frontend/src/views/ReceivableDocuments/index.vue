<template>
  <div class="sales-orders-page px-4 pt-0 pb-1 space-y-2">
    <el-form
      ref="queryFormRef"
      :model="queryForm"
      label-width="90px"
      inline
      class="query-form rounded-lg bg-[var(--el-bg-color-overlay)] py-2 shadow-sm"
    >
      <el-form-item label="模号查询">
        <el-input
          v-model="queryForm.itemCode"
          placeholder="单据号/项目号/产品名/图号/模号"
          clearable
          style="width: 260px"
        />
      </el-form-item>
      <el-form-item label="客户名称">
        <el-input
          v-model="queryForm.customerName"
          placeholder="请输入客户名称"
          clearable
          style="width: 150px"
        />
      </el-form-item>
      <el-form-item label="回款状态">
        <el-select
          v-model="queryForm.status"
          placeholder="请选择回款状态"
          clearable
          style="width: 140px"
        >
          <el-option
            v-for="item in statusOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="回款日期">
        <el-date-picker
          v-model="queryForm.receiptDateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          value-format="YYYY-MM-DD"
          clearable
          style="width: 230px"
        />
      </el-form-item>
      <el-form-item class="query-form__actions">
        <div class="query-actions">
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
          <el-button type="success" @click="handleCreate">新增</el-button>
        </div>
      </el-form-item>
    </el-form>

    <div v-if="viewMode === 'table'" class="so-table-wrapper">
      <el-table
        ref="tableRef"
        v-loading="loading"
        :data="tableData"
        border
        class="so-table"
        height="calc(100vh - 320px)"
        row-key="id"
        @row-dblclick="handleRowDblClick"
      >
        <el-table-column type="expand">
          <template #default="{ row }">
            <el-table :data="row.details" border size="small" row-key="id" style="width: 100%">
              <el-table-column type="index" label="序号" width="45" />
              <el-table-column prop="id" label="回款ID" width="70" />
              <el-table-column prop="detailId" label="明细ID" width="70" />
              <el-table-column prop="itemCode" label="项目编号" min-width="140" />
              <el-table-column prop="productName" label="产品名称" min-width="140" />
              <el-table-column prop="productDrawingNo" label="产品图号" min-width="140" />
              <el-table-column prop="customerPartNo" label="客户模号" min-width="120" />
              <el-table-column prop="contractNo" label="合同号" min-width="120" />
              <el-table-column label="应收金额" width="110" align="right">
                <template #default="{ row: detail }">{{
                  formatAmount(detail.receivableAmount)
                }}</template>
              </el-table-column>
              <el-table-column label="实收金额" width="110" align="right">
                <template #default="{ row: detail }">{{ formatAmount(detail.amount) }}</template>
              </el-table-column>
              <el-table-column label="贴息金额" width="110" align="right">
                <template #default="{ row: detail }">{{
                  formatAmount(detail.discountAmount)
                }}</template>
              </el-table-column>
              <el-table-column prop="receiptProgress" label="收款进度" min-width="100" />
              <el-table-column prop="receiptDate" label="回款日期" width="120" />
              <el-table-column prop="receiptMethod" label="回款方式" min-width="110" />
              <el-table-column prop="accountName" label="收款账户" min-width="130" />
              <el-table-column prop="remark" label="备注" min-width="140" show-overflow-tooltip />
              <el-table-column label="是否结清" width="100" align="center">
                <template #default="{ row: detail }">{{
                  formatBoolean(detail.isSettled)
                }}</template>
              </el-table-column>
            </el-table>
          </template>
        </el-table-column>
        <el-table-column prop="documentNo" label="单据编号" min-width="140" />
        <el-table-column prop="customerName" label="客户名称" min-width="160" />
        <el-table-column label="回款批次" width="100" align="center">
          <template #default="{ row }">
            {{ row.details.length }}
          </template>
        </el-table-column>
        <el-table-column label="回款金额" width="140" align="right">
          <template #default="{ row }">
            {{ formatAmount(row.totalAmount) }}
          </template>
        </el-table-column>
        <el-table-column label="回款状态" width="120" align="center">
          <template #default="{ row }">
            <el-tag :type="statusTagMap[row.status].type">
              {{ statusTagMap[row.status].label }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="receiptDate" label="回款日期" width="140" />
        <el-table-column prop="deliveryDate" label="单据日期" width="140" />
        <el-table-column prop="contractNo" label="合同编号" width="140" />
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link :disabled="readOnlyMode" @click="handleEdit(row)"
              >编辑</el-button
            >
            <el-button type="danger" link :disabled="readOnlyMode" @click="handleDelete(row)"
              >删除</el-button
            >
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div v-else v-loading="loading" class="so-timeline-layout">
      <div class="so-timeline-left">
        <div v-for="group in timelineGroups" :key="group.date" class="so-timeline-date-group">
          <div class="so-timeline-date-header">
            <span class="so-timeline-date-label">{{ group.date }}</span>
          </div>
          <div v-for="receipt in group.receipts" :key="receipt.id" class="so-timeline-order-block">
            <div
              class="so-timeline-order-header"
              :class="{ 'is-active': timelineActiveReceiptNo === receipt.receiptNo }"
              @click="handleTimelineReceiptClick(receipt)"
            >
              <div class="so-timeline-order-main">
                <span class="so-timeline-order-no">{{ receipt.documentNo || '-' }}</span>
                <span class="so-timeline-order-customer">{{ receipt.customerName || '-' }}</span>
              </div>
              <div class="so-timeline-order-meta">
                <span>批次 {{ receipt.details.length }}</span>
                <span>金额 {{ formatAmount(receipt.totalAmount) }}</span>
                <span>日期 {{ receipt.receiptDate || '-' }}</span>
                <el-tag :type="statusTagMap[receipt.status].type">
                  {{ statusTagMap[receipt.status].label }}
                </el-tag>
              </div>
            </div>
            <div v-if="receipt.details && receipt.details.length" class="so-timeline-order-details">
              <div
                v-for="detail in receipt.details"
                :key="detail.id"
                class="so-timeline-detail-row"
                :class="{ 'is-active': isTimelineActiveDetail(receipt.receiptNo, detail) }"
                @click.stop="handleTimelineDetailClick(receipt, detail)"
              >
                <div class="so-timeline-detail-main">
                  {{ detail.itemCode || '' }} {{ detail.productName || '' }}
                </div>
                <div class="so-timeline-detail-meta">
                  <span v-if="detail.accountName">账户 {{ detail.accountName }}</span>
                  <span>实收 {{ formatAmount(detail.amount) }}</span>
                  <span>应收 {{ formatAmount(detail.receivableAmount ?? 0) }}</span>
                  <span>结清 {{ formatBoolean(detail.isSettled) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-if="!timelineGroups.length" class="so-timeline-empty">
          <el-empty description="当前条件下暂无回款数据" />
        </div>
      </div>
      <div class="so-timeline-right">
        <div v-if="timelineSelectedReceipt" class="so-timeline-detail-panel">
          <div class="view-dialog-section">
            <div class="view-dialog-section-header view-dialog-section-header--timeline">
              <div class="view-dialog-section-main">
                <h3 class="view-dialog-section-title">回款基本信息</h3>
                <div class="view-dialog-info-grid">
                  <div class="view-dialog-info-item">
                    <span class="view-dialog-info-label">单据编号：</span>
                    <span class="view-dialog-info-value">{{
                      timelineSelectedReceipt.documentNo || '-'
                    }}</span>
                  </div>
                  <div class="view-dialog-info-item">
                    <span class="view-dialog-info-label">客户名称：</span>
                    <span class="view-dialog-info-value">{{
                      timelineSelectedReceipt.customerName || '-'
                    }}</span>
                  </div>
                  <div class="view-dialog-info-item">
                    <span class="view-dialog-info-label">合同编号：</span>
                    <span class="view-dialog-info-value">{{
                      timelineSelectedReceipt.contractNo || '-'
                    }}</span>
                  </div>
                  <div class="view-dialog-info-item">
                    <span class="view-dialog-info-label">回款日期：</span>
                    <span class="view-dialog-info-value">{{
                      timelineSelectedReceipt.receiptDate || '-'
                    }}</span>
                  </div>
                  <div class="view-dialog-info-item">
                    <span class="view-dialog-info-label">单据日期：</span>
                    <span class="view-dialog-info-value">{{
                      timelineSelectedReceipt.deliveryDate || '-'
                    }}</span>
                  </div>
                  <div class="view-dialog-info-item">
                    <span class="view-dialog-info-label">总金额：</span>
                    <span class="view-dialog-info-value">
                      {{ formatAmount(timelineSelectedReceipt.totalAmount) }} 元
                    </span>
                  </div>
                </div>
              </div>
              <div class="so-timeline-header-actions">
                <el-button type="success" size="small" @click="handleTimelineView">查看</el-button>
                <el-button type="primary" size="small" @click="handleTimelineEdit">编辑</el-button>
                <el-button type="danger" size="small" @click="handleTimelineDelete">删除</el-button>
              </div>
            </div>
          </div>
          <div class="view-dialog-section">
            <h3 class="view-dialog-section-title">回款明细</h3>
            <div class="dialog-table-wrapper">
              <el-table
                :data="timelineSelectedReceipt.details"
                border
                size="small"
                :row-class-name="timelineDetailRowClassName"
              >
                <el-table-column type="index" label="序号" width="45" />
                <el-table-column prop="id" label="回款ID" width="70" />
                <el-table-column prop="detailId" label="明细ID" width="70" />
                <el-table-column prop="itemCode" label="项目编号" min-width="140" />
                <el-table-column prop="productName" label="产品名称" min-width="130" />
                <el-table-column prop="productDrawingNo" label="产品图号" min-width="140" />
                <el-table-column prop="customerPartNo" label="客户模号" min-width="120" />
                <el-table-column prop="contractNo" label="合同号" min-width="120" />
                <el-table-column label="应收金额" width="110" align="right">
                  <template #default="{ row }">{{ formatAmount(row.receivableAmount) }}</template>
                </el-table-column>
                <el-table-column label="实收金额" width="110" align="right">
                  <template #default="{ row }">{{ formatAmount(row.amount) }}</template>
                </el-table-column>
                <el-table-column label="贴息金额" width="110" align="right">
                  <template #default="{ row }">{{ formatAmount(row.discountAmount) }}</template>
                </el-table-column>
                <el-table-column prop="receiptProgress" label="收款进度" min-width="100" />
                <el-table-column prop="receiptDate" label="回款日期" width="120" />
                <el-table-column prop="receiptMethod" label="回款方式" min-width="110" />
                <el-table-column prop="accountName" label="收款账户" min-width="130" />
                <el-table-column prop="remark" label="备注" min-width="120" show-overflow-tooltip />
                <el-table-column label="是否结清" width="100" align="center">
                  <template #default="{ row }">{{ formatBoolean(row.isSettled) }}</template>
                </el-table-column>
              </el-table>
            </div>
          </div>
        </div>
        <div v-else class="so-timeline-detail-panel-empty">
          <el-empty description="请选择左侧时间轴中的回款单据" />
        </div>
      </div>
    </div>

    <div class="pagination-footer">
      <el-pagination
        background
        layout="total, sizes, prev, pager, next, jumper"
        :current-page="pagination.page"
        :page-size="pagination.size"
        :page-sizes="[10, 20, 30, 50]"
        :total="total"
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
      />
    </div>

    <el-dialog
      v-model="viewDialogVisible"
      title="查看回款单据"
      width="1400px"
      :close-on-click-modal="false"
      class="so-dialog so-dialog-view"
    >
      <div v-if="viewReceiptData" class="view-dialog-container">
        <div class="view-dialog-section">
          <h3 class="view-dialog-section-title">回款基本信息</h3>
          <div class="view-dialog-info-grid">
            <div class="view-dialog-info-item">
              <span class="view-dialog-info-label">单据编号：</span>
              <span class="view-dialog-info-value">{{ viewReceiptData.documentNo || '-' }}</span>
            </div>
            <div class="view-dialog-info-item">
              <span class="view-dialog-info-label">客户名称：</span>
              <span class="view-dialog-info-value">{{ viewReceiptData.customerName || '-' }}</span>
            </div>
            <div class="view-dialog-info-item">
              <span class="view-dialog-info-label">合同编号：</span>
              <span class="view-dialog-info-value">{{ viewReceiptData.contractNo || '-' }}</span>
            </div>
            <div class="view-dialog-info-item">
              <span class="view-dialog-info-label">回款日期：</span>
              <span class="view-dialog-info-value">{{ viewReceiptData.receiptDate || '-' }}</span>
            </div>
            <div class="view-dialog-info-item">
              <span class="view-dialog-info-label">单据日期：</span>
              <span class="view-dialog-info-value">{{ viewReceiptData.deliveryDate || '-' }}</span>
            </div>
            <div class="view-dialog-info-item">
              <span class="view-dialog-info-label">总金额：</span>
              <span class="view-dialog-info-value">
                {{ formatAmount(viewReceiptData.totalAmount) }} 元
              </span>
            </div>
          </div>
        </div>
        <div class="view-dialog-section">
          <h3 class="view-dialog-section-title">回款明细</h3>
          <div class="dialog-table-wrapper">
            <el-table :data="viewReceiptData.details" border size="small">
              <el-table-column type="index" label="序号" width="45" />
              <el-table-column prop="id" label="回款ID" width="70" />
              <el-table-column prop="detailId" label="明细ID" width="70" />
              <el-table-column prop="itemCode" label="项目编号" min-width="140" />
              <el-table-column prop="productName" label="产品名称" min-width="130" />
              <el-table-column prop="productDrawingNo" label="产品图号" min-width="140" />
              <el-table-column prop="customerPartNo" label="客户模号" min-width="120" />
              <el-table-column prop="contractNo" label="合同号" min-width="120" />
              <el-table-column label="应收金额" width="110" align="right">
                <template #default="{ row }">{{ formatAmount(row.receivableAmount) }}</template>
              </el-table-column>
              <el-table-column label="实收金额" width="110" align="right">
                <template #default="{ row }">{{ formatAmount(row.amount) }}</template>
              </el-table-column>
              <el-table-column label="贴息金额" width="110" align="right">
                <template #default="{ row }">{{ formatAmount(row.discountAmount) }}</template>
              </el-table-column>
            </el-table>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="viewDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="1500px"
      :close-on-click-modal="false"
      class="finance-create-dialog"
      @closed="handleDialogClosed"
    >
      <el-form
        ref="dialogFormRef"
        :model="dialogForm"
        :rules="dialogRules"
        label-width="auto"
        class="finance-dialog-form"
      >
        <section class="finance-dialog-section">
          <div class="finance-dialog-section__title">单据信息</div>
          <div class="finance-dialog-grid">
            <el-form-item label="单据编号" prop="receiptNo">
              <el-input
                v-model="dialogForm.receiptNo"
                placeholder="系统自动生成"
                class="dialog-input"
                disabled
              />
            </el-form-item>
            <el-form-item label="客户名称" prop="customerName">
              <el-select
                v-model="dialogForm.customerName"
                placeholder="请选择客户名称"
                class="dialog-input"
                filterable
              >
                <el-option
                  v-for="item in customerOptions"
                  :key="item"
                  :label="item"
                  :value="item"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="回款日期">
              <el-date-picker
                v-model="dialogForm.receiptDate"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="请选择回款日期"
                class="dialog-date-picker"
                style="width: 252px"
              />
            </el-form-item>
            <el-form-item label="单据日期">
              <el-input v-model="dialogForm.deliveryDate" class="dialog-input" disabled />
            </el-form-item>
            <el-form-item label="收款账户">
              <el-input
                v-model="dialogForm.accountName"
                placeholder="请输入收款账户"
                class="dialog-input"
              />
            </el-form-item>
            <el-form-item label="回款方式">
              <el-select
                v-model="dialogForm.receiptMethod"
                placeholder="请选择回款方式"
                class="dialog-input"
              >
                <el-option
                  v-for="item in receiptMethodOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
          </div>
        </section>

        <section class="finance-dialog-section">
          <div class="finance-dialog-section__head">
            <div class="finance-dialog-section__title">回款明细</div>
            <div class="finance-dialog-summary">
              <span class="finance-dialog-summary__item"
                >明细数 {{ dialogForm.details.length }}</span
              >
              <span class="finance-dialog-summary__item"
                >实收合计 {{ formatAmount(dialogTotals.totalAmount) }}</span
              >
              <el-button @click="openReceiptCandidateDialog">从应收池选择</el-button>
              <el-button type="primary" plain @click="addDetailRow">新增明细</el-button>
            </div>
          </div>
          <el-table :data="dialogForm.details" border size="small" row-key="id" style="width: 100%">
            <el-table-column type="index" label="序号" width="45" />
            <el-table-column label="项目编号" min-width="140">
              <template #default="{ row }">
                <el-input v-model="row.itemCode" placeholder="请输入项目编号" />
              </template>
            </el-table-column>
            <el-table-column label="产品名称" min-width="150">
              <template #default="{ row }">
                <el-input v-model="row.productName" placeholder="请输入产品名称" />
              </template>
            </el-table-column>
            <el-table-column label="产品图号" min-width="140">
              <template #default="{ row }">
                <el-input v-model="row.productDrawingNo" placeholder="请输入产品图号" />
              </template>
            </el-table-column>
            <el-table-column label="客户模号" min-width="130">
              <template #default="{ row }">
                <el-input v-model="row.customerPartNo" placeholder="请输入客户模号" />
              </template>
            </el-table-column>
            <el-table-column label="合同号" min-width="130">
              <template #default="{ row }">
                <el-input v-model="row.contractNo" placeholder="请输入合同号" />
              </template>
            </el-table-column>
            <el-table-column label="订单数量" width="130" align="right">
              <template #default="{ row }">
                <el-input-number
                  v-model="row.orderQuantity"
                  :min="0"
                  :step="1"
                  :precision="0"
                  :controls="false"
                  style="width: 100%"
                />
              </template>
            </el-table-column>
            <el-table-column label="订单单价" width="130" align="right">
              <template #default="{ row }">
                <el-input-number
                  v-model="row.orderUnitPrice"
                  :min="0"
                  :step="100"
                  :precision="2"
                  :controls="false"
                  style="width: 100%"
                />
              </template>
            </el-table-column>
            <el-table-column label="订单金额" width="130" align="right">
              <template #default="{ row }">
                <el-input-number
                  v-model="row.orderAmount"
                  :min="0"
                  :step="100"
                  :precision="2"
                  :controls="false"
                  style="width: 100%"
                />
              </template>
            </el-table-column>
            <el-table-column label="应收金额" width="120" align="right">
              <template #default="{ row }">
                <el-input-number
                  v-model="row.receivableAmount"
                  :min="0"
                  :step="100"
                  :precision="2"
                  :controls="false"
                  style="width: 100%"
                />
              </template>
            </el-table-column>
            <el-table-column label="实收金额" width="120" align="right">
              <template #default="{ row }">
                <el-input-number
                  v-model="row.amount"
                  :min="0"
                  :step="100"
                  :precision="2"
                  :controls="false"
                  style="width: 100%"
                />
              </template>
            </el-table-column>
            <el-table-column label="贴息金额" width="120" align="right">
              <template #default="{ row }">
                <el-input-number
                  v-model="row.discountAmount"
                  :min="0"
                  :step="100"
                  :precision="2"
                  :controls="false"
                  style="width: 100%"
                />
              </template>
            </el-table-column>
            <el-table-column label="备注" min-width="150">
              <template #default="{ row }">
                <el-input v-model="row.remark" placeholder="备注" />
              </template>
            </el-table-column>
            <el-table-column label="明细ID" width="90" align="center">
              <template #default="{ row }">
                <el-input-number
                  v-model="row.detailId"
                  :min="0"
                  :step="1"
                  :precision="0"
                  :controls="false"
                  style="width: 100%"
                />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="55" fixed="right">
              <template #default="{ $index }">
                <el-button type="danger" link @click="removeDetailRow($index)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </section>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="dialogSubmitting" @click="submitDialogForm">
          保存
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="receiptCandidateDialogVisible"
      title="选择回款明细"
      width="1200px"
      :close-on-click-modal="false"
    >
      <div class="finance-candidate-toolbar">
        <el-select
          v-model="receiptCandidateCustomerName"
          placeholder="客户名称"
          clearable
          filterable
          style="width: 220px"
          :disabled="Boolean(dialogForm.customerName)"
          @change="loadReceiptCandidates(true)"
        >
          <el-option
            v-for="item in receiptCandidateCustomerSelectOptions"
            :key="item"
            :label="item"
            :value="item"
          />
        </el-select>
        <el-input
          v-model="receiptCandidateKeyword"
          placeholder="明细ID/项目编号/产品名称/图号/模号/合同号"
          clearable
          style="width: 360px"
          @keydown.enter.prevent="loadReceiptCandidates(true)"
        />
        <el-button type="primary" @click="loadReceiptCandidates(true)">查询</el-button>
        <span class="finance-candidate-toolbar__selected"
          >已选 {{ selectedReceiptCandidates.length }} 条</span
        >
        <el-button @click="clearReceiptCandidateSelection">清空已选</el-button>
      </div>
      <el-table
        ref="receiptCandidateTableRef"
        v-loading="receiptCandidateLoading"
        :data="receiptCandidates"
        border
        height="460"
        row-key="detailId"
        @selection-change="handleReceiptCandidateSelectionChange"
      >
        <el-table-column type="selection" width="50" />
        <el-table-column prop="detailId" label="明细ID" width="90" />
        <el-table-column prop="itemCode" label="项目编号" min-width="130" />
        <el-table-column prop="productName" label="产品名称" min-width="150" />
        <el-table-column prop="productDrawingNo" label="产品图号" min-width="140" />
        <el-table-column prop="customerPartNo" label="客户模号" min-width="120" />
        <el-table-column prop="customerName" label="客户名称" min-width="160" />
        <el-table-column label="应收金额" width="120" align="right">
          <template #default="{ row }">{{ formatAmount(row.receivableAmount || 0) }}</template>
        </el-table-column>
      </el-table>
      <div class="finance-candidate-pagination">
        <el-pagination
          background
          layout="total, sizes, prev, pager, next"
          :current-page="receiptCandidatePage"
          :page-size="receiptCandidatePageSize"
          :page-sizes="[50, 100, 200]"
          :total="receiptCandidateTotal"
          @size-change="handleReceiptCandidateSizeChange"
          @current-change="handleReceiptCandidatePageChange"
        />
      </div>
      <template #footer>
        <el-button @click="receiptCandidateDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="applyReceiptCandidates">代入明细</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import type { FormInstance, FormRules } from 'element-plus'
import {
  ElButton,
  ElEmpty,
  ElDatePicker,
  ElDialog,
  ElForm,
  ElFormItem,
  ElInput,
  ElInputNumber,
  ElMessage,
  ElMessageBox,
  ElOption,
  ElPagination,
  ElSelect,
  ElTable,
  ElTableColumn,
  ElTag
} from 'element-plus'
import {
  createFinanceReceiptApi,
  deleteFinanceReceiptApi,
  getFinanceReceiptCandidatesApi,
  getFinanceReceiptListApi,
  updateFinanceReceiptApi
} from '@/api/finance'
import { getCustomerListApi } from '@/api/customer'

type ReceiptStatus = 'pending' | 'received'
type TagType = 'primary' | 'success' | 'info' | 'warning' | 'danger'

interface ReceiptDetail {
  id: number
  documentNo?: string
  detailId?: number | null
  itemCode: string
  productName: string
  productDrawingNo: string
  customerPartNo: string
  contractNo?: string
  orderQuantity?: number
  orderUnitPrice?: number
  orderAmount?: number
  receivableAmount?: number
  amount?: number
  discountAmount?: number
  receiptProgress?: string
  receiptDate?: string
  receiptMethod?: string
  accountName?: string
  customerName?: string
  isSettled?: boolean
  deliveryDate: string
  remark: string
  costSource: string
}

interface Receipt {
  id: number
  documentNo?: string
  receiptNo: string
  customerName: string
  contractNo: string
  status: ReceiptStatus
  receiptDate: string
  deliveryDate: string
  receiptMethod?: string
  accountName?: string
  details: ReceiptDetail[]
}

interface ReceiptQuery {
  itemCode: string
  customerName: string
  status: '' | ReceiptStatus
  receiptDateRange: string[]
}

interface ListReceiptsParams {
  page: number
  size: number
  itemCode?: string
  customerName?: string
  status?: ReceiptStatus
  receiptDateRange?: [string, string]
}

interface PaginatedReceipts {
  list: Receipt[]
  total: number
}

interface ReceiptTableRow extends Receipt {
  totalAmount: number
}

interface ReceiptCandidate {
  detailId: number
  itemCode: string
  productName: string
  productDrawingNo: string
  customerPartNo: string
  customerName: string
  contractNo: string
  orderQuantity: number
  orderUnitPrice: number
  orderAmount: number
  receivableAmount: number
}

type ReceiptPayload = Omit<Receipt, 'id'>

const mockReceipts = ref<Receipt[]>([
  {
    id: 1,
    receiptNo: 'RCPT-202401',
    customerName: '华东制造有限公司',
    contractNo: 'HT-2023-001',
    status: 'pending',
    receiptDate: '2024-01-05',
    deliveryDate: '2024-02-05',
    details: [
      {
        id: 1,
        itemCode: 'BATCH-01',
        productName: '首批货款',
        productDrawingNo: '招商银行 6222****991',
        customerPartNo: '宁波盛阳',
        amount: 38000,
        deliveryDate: '2024-01-12',
        remark: '货物验收后到账',
        costSource: '首批回款'
      },
      {
        id: 2,
        itemCode: 'BATCH-02',
        productName: '安装服务费',
        productDrawingNo: '招商银行 6222****991',
        customerPartNo: '宁波盛阳',
        amount: 18000,
        deliveryDate: '2024-02-03',
        remark: '含税额 13%',
        costSource: '服务结算'
      }
    ]
  },
  {
    id: 2,
    receiptNo: 'RCPT-202402',
    customerName: '远航国际贸易',
    contractNo: 'HT-2023-017',
    status: 'pending',
    receiptDate: '2024-02-18',
    deliveryDate: '2024-03-20',
    details: [
      {
        id: 3,
        itemCode: 'BATCH-01',
        productName: '货款到账',
        productDrawingNo: '工行北京 9558****120',
        customerPartNo: '远航国际',
        amount: 214000,
        deliveryDate: '2024-03-01',
        remark: '美元结汇后转入',
        costSource: '出口业务'
      },
      {
        id: 4,
        itemCode: 'BATCH-02',
        productName: '尾款',
        productDrawingNo: '工行北京 9558****120',
        customerPartNo: '远航国际',
        amount: 18200,
        deliveryDate: '2024-03-18',
        remark: '含运费补差',
        costSource: '出口业务'
      }
    ]
  },
  {
    id: 3,
    receiptNo: 'RCPT-202312',
    customerName: '星辰工业',
    contractNo: 'HT-2022-089',
    status: 'received',
    receiptDate: '2023-12-18',
    deliveryDate: '2024-01-15',
    details: [
      {
        id: 5,
        itemCode: 'BATCH-01',
        productName: '阶段验收款',
        productDrawingNo: '建设银行 6217****880',
        customerPartNo: '星辰工业',
        amount: 32000,
        deliveryDate: '2023-12-25',
        remark: '完成整改后支付',
        costSource: '项目尾款'
      },
      {
        id: 6,
        itemCode: 'BATCH-02',
        productName: '质保金结算',
        productDrawingNo: '建设银行 6217****880',
        customerPartNo: '星辰工业',
        amount: 15000,
        deliveryDate: '2024-01-10',
        remark: '含质保金',
        costSource: '项目尾款'
      }
    ]
  }
])

const detailIdSeed = ref(
  (() => {
    const ids = mockReceipts.value.flatMap((receipt) => receipt.details.map((detail) => detail.id))
    return (ids.length ? Math.max(...ids) : 0) + 1
  })()
)

const createDetailId = () => detailIdSeed.value++

const createEmptyDetail = (): ReceiptDetail => ({
  id: createDetailId(),
  documentNo: '',
  detailId: null,
  itemCode: '',
  productName: '',
  productDrawingNo: '',
  customerPartNo: '',
  contractNo: '',
  orderQuantity: undefined,
  orderUnitPrice: undefined,
  orderAmount: undefined,
  receivableAmount: 0,
  amount: undefined,
  discountAmount: undefined,
  receiptProgress: '',
  receiptDate: '',
  receiptMethod: '',
  accountName: '',
  customerName: '',
  isSettled: false,
  deliveryDate: '',
  remark: '',
  costSource: ''
})

const createEmptyReceipt = (): ReceiptPayload => ({
  receiptNo: '',
  customerName: '',
  contractNo: '',
  status: 'pending',
  receiptDate: '',
  deliveryDate: '',
  receiptMethod: '现汇',
  accountName: '交行',
  details: [createEmptyDetail()]
})

const readOnlyMode = false
const route = useRoute()
const customerOptions = ref<string[]>([])
const receiptCandidateDialogVisible = ref(false)
const receiptCandidateLoading = ref(false)
const receiptCandidateCustomerName = ref('')
const receiptCandidateCustomerOptions = ref<string[]>([])
const receiptCandidateKeyword = ref('')
const receiptCandidatePage = ref(1)
const receiptCandidatePageSize = ref(50)
const receiptCandidateTotal = ref(0)
const receiptCandidates = ref<ReceiptCandidate[]>([])
const selectedReceiptCandidates = ref<ReceiptCandidate[]>([])
const selectedReceiptCandidateMap = ref<Record<string, ReceiptCandidate>>({})
const receiptCandidateTableRef = ref<InstanceType<typeof ElTable>>()
const syncingReceiptCandidateSelection = ref(false)
const RECEIPT_CANDIDATE_PREF_KEY = 'finance.receipt.candidate.pref.v1'

const restoreReceiptCandidatePrefs = () => {
  try {
    const raw = localStorage.getItem(RECEIPT_CANDIDATE_PREF_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw)
    if (typeof parsed?.customerName === 'string') {
      receiptCandidateCustomerName.value = parsed.customerName
    }
    if (typeof parsed?.keyword === 'string') {
      receiptCandidateKeyword.value = parsed.keyword
    }
    const size = Number(parsed?.pageSize)
    if (Number.isFinite(size) && size >= 1) {
      receiptCandidatePageSize.value = Math.min(200, Math.max(1, Math.trunc(size)))
    }
  } catch {
    // ignore
  }
}

const persistReceiptCandidatePrefs = () => {
  try {
    localStorage.setItem(
      RECEIPT_CANDIDATE_PREF_KEY,
      JSON.stringify({
        customerName: receiptCandidateCustomerName.value,
        keyword: receiptCandidateKeyword.value,
        pageSize: receiptCandidatePageSize.value
      })
    )
  } catch {
    // ignore
  }
}

restoreReceiptCandidatePrefs()

const receiptCandidateCustomerSelectOptions = computed(() => {
  if (dialogForm.customerName) {
    return [dialogForm.customerName]
  }
  return receiptCandidateCustomerOptions.value
})

const getReceiptCandidateKey = (item: ReceiptCandidate) => String(item.detailId || '')

const rebuildSelectedReceiptCandidates = () => {
  selectedReceiptCandidates.value = Object.values(selectedReceiptCandidateMap.value)
}

const normalizeDetails = (details: ReceiptDetail[]): ReceiptDetail[] =>
  details.map((detail) => ({
    ...detail,
    amount: Number(detail.amount) || 0
  }))

const calculateSummary = (details: ReceiptDetail[]) =>
  details.reduce(
    (acc, item) => {
      acc.totalAmount += Number(item.amount) || 0
      return acc
    },
    { totalAmount: 0 }
  )

const listReceipts = async (params: ListReceiptsParams): Promise<PaginatedReceipts> => {
  const payload: any = {
    page: params.page,
    pageSize: params.size
  }
  if (params.itemCode) payload.itemCode = params.itemCode
  if (params.customerName) payload.customerName = params.customerName
  if (params.status) payload.status = params.status
  if (params.receiptDateRange && params.receiptDateRange.length === 2) {
    payload.receiptDateStart = params.receiptDateRange[0]
    payload.receiptDateEnd = params.receiptDateRange[1]
  }

  const response = await getFinanceReceiptListApi(payload)
  const raw: any = response
  const pr: any = raw?.data ?? raw
  const data: any = pr?.data ?? pr
  const list = Array.isArray(data?.list) ? data.list : []
  const total = Number(data?.total ?? 0)
  return { list, total }
}

const createReceipt = async (payload: ReceiptPayload): Promise<Receipt> => {
  await createFinanceReceiptApi(payload)
  return {
    id: 0,
    receiptNo: payload.receiptNo,
    customerName: payload.customerName,
    contractNo: payload.contractNo,
    status: payload.status,
    receiptDate: payload.receiptDate,
    deliveryDate: payload.deliveryDate,
    details: normalizeDetails(payload.details.map((detail) => ({ ...detail })))
  }
}

const updateReceipt = async (documentNo: string, payload: ReceiptPayload): Promise<Receipt> => {
  await updateFinanceReceiptApi(documentNo, payload)
  return {
    id: 0,
    receiptNo: payload.receiptNo,
    customerName: payload.customerName,
    contractNo: payload.contractNo,
    status: payload.status,
    receiptDate: payload.receiptDate,
    deliveryDate: payload.deliveryDate,
    details: normalizeDetails(payload.details.map((detail) => ({ ...detail })))
  }
}

const removeReceipt = async (documentNo: string): Promise<void> => {
  await deleteFinanceReceiptApi(documentNo)
}

const statusTagMap: Record<ReceiptStatus, { label: string; type: TagType }> = {
  pending: { label: '待回款', type: 'warning' },
  received: { label: '已到账', type: 'success' }
}

const statusOptions = (Object.keys(statusTagMap) as ReceiptStatus[]).map((value) => ({
  value,
  label: statusTagMap[value].label
}))

const receiptMethodOptions = [
  { label: '现汇', value: '现汇' },
  { label: '商承', value: '商承' },
  { label: '银承', value: '银承' }
]

const queryFormRef = ref<FormInstance>()
const queryForm = reactive<ReceiptQuery>({
  itemCode: '',
  customerName: '',
  status: '',
  receiptDateRange: []
})

const pagination = reactive({
  page: 1,
  size: 10
})

const tableRef = ref<InstanceType<typeof ElTable>>()
const tableData = ref<ReceiptTableRow[]>([])
const total = ref(0)
const loading = ref(false)
const resolveViewModeFromRoute = () => {
  const v = route.query.view
  if (v === 'table' || v === 'timeline') return v as 'table' | 'timeline'
  return 'timeline'
}

const viewMode = ref<'table' | 'timeline'>(resolveViewModeFromRoute())
const timelineActiveReceiptNo = ref<string | null>(null)
const timelineActiveDetailKey = ref<string | null>(null)

const dialogVisible = ref(false)
const viewDialogVisible = ref(false)
const dialogTitle = ref('')
const dialogSubmitting = ref(false)
const dialogFormRef = ref<FormInstance>()
const currentReceiptNo = ref<string | null>(null)
const viewReceiptData = ref<ReceiptTableRow | null>(null)

const dialogForm = reactive<ReceiptPayload>(createEmptyReceipt())

const dialogRules: FormRules<ReceiptPayload> = {
  receiptNo: [{ required: true, message: '请输入单据编号', trigger: 'blur' }],
  customerName: [{ required: true, message: '请输入客户名称', trigger: 'blur' }]
}

const formatAmount = (value: number | null | undefined) => Number(value ?? 0).toFixed(2)
const formatBoolean = (value: unknown) => (value ? '是' : '否')

const mapReceiptToRow = (receipt: Receipt): ReceiptTableRow => {
  const { totalAmount } = calculateSummary(receipt.details)
  return {
    ...receipt,
    totalAmount
  }
}

interface ReceiptTimelineGroup {
  date: string
  receipts: ReceiptTableRow[]
}

const timelineGroups = computed<ReceiptTimelineGroup[]>(() => {
  const map = new Map<string, ReceiptTableRow[]>()
  const sorted = [...tableData.value].sort((a, b) => {
    const aDate = new Date(a.receiptDate || a.deliveryDate || 0).getTime()
    const bDate = new Date(b.receiptDate || b.deliveryDate || 0).getTime()
    return bDate - aDate
  })

  sorted.forEach((item) => {
    const key = item.receiptDate || item.deliveryDate || '未设置日期'
    if (!map.has(key)) map.set(key, [])
    map.get(key)?.push(item)
  })

  return Array.from(map.entries()).map(([date, receipts]) => ({ date, receipts }))
})

const timelineSelectedReceipt = computed(() => {
  if (!timelineActiveReceiptNo.value) return null
  return tableData.value.find((item) => item.receiptNo === timelineActiveReceiptNo.value) || null
})

const makeTimelineDetailKey = (receiptNo: string, detail: ReceiptDetail) => {
  const idPart = detail.id != null ? String(detail.id) : ''
  const codePart = detail.itemCode || ''
  return `${receiptNo}-${idPart}-${codePart}`
}

const isTimelineActiveDetail = (receiptNo: string, detail: ReceiptDetail) => {
  if (!timelineActiveDetailKey.value) return false
  return timelineActiveDetailKey.value === makeTimelineDetailKey(receiptNo, detail)
}

const handleTimelineReceiptClick = (receipt: ReceiptTableRow) => {
  timelineActiveReceiptNo.value = receipt.receiptNo
  timelineActiveDetailKey.value = null
}

const handleTimelineDetailClick = (receipt: ReceiptTableRow, detail: ReceiptDetail) => {
  timelineActiveReceiptNo.value = receipt.receiptNo
  timelineActiveDetailKey.value = makeTimelineDetailKey(receipt.receiptNo, detail)
}

const openViewDialog = (row: ReceiptTableRow) => {
  viewReceiptData.value = JSON.parse(JSON.stringify(row))
  viewDialogVisible.value = true
}

const handleTimelineView = () => {
  if (!timelineSelectedReceipt.value) return
  openViewDialog(timelineSelectedReceipt.value)
}

const handleTimelineEdit = () => {
  if (!timelineSelectedReceipt.value) return
  handleEdit(timelineSelectedReceipt.value)
}

const handleTimelineDelete = () => {
  if (!timelineSelectedReceipt.value) return
  void handleDelete(timelineSelectedReceipt.value)
}

const timelineDetailRowClassName = ({ row }: { row: ReceiptDetail }) => {
  if (!timelineSelectedReceipt.value || !timelineActiveDetailKey.value) return ''
  const key = makeTimelineDetailKey(timelineSelectedReceipt.value.receiptNo, row)
  return key === timelineActiveDetailKey.value ? 'so-view-detail-row--active' : ''
}

watch(
  () => tableData.value,
  (rows) => {
    if (!rows.length) {
      timelineActiveReceiptNo.value = null
      timelineActiveDetailKey.value = null
      return
    }
    if (
      !timelineActiveReceiptNo.value ||
      !rows.some((r) => r.receiptNo === timelineActiveReceiptNo.value)
    ) {
      timelineActiveReceiptNo.value = rows[0].receiptNo
      timelineActiveDetailKey.value = null
    }
  },
  { immediate: true }
)

watch(
  () => route.query.view,
  () => {
    viewMode.value = resolveViewModeFromRoute()
  }
)

const loadData = async () => {
  loading.value = true
  try {
    const params: ListReceiptsParams = {
      page: pagination.page,
      size: pagination.size
    }

    if (queryForm.itemCode.trim()) {
      params.itemCode = queryForm.itemCode.trim()
    }

    if (queryForm.customerName.trim()) {
      params.customerName = queryForm.customerName.trim()
    }

    if (queryForm.status) {
      params.status = queryForm.status
    }

    if (queryForm.receiptDateRange.length === 2) {
      params.receiptDateRange = [queryForm.receiptDateRange[0], queryForm.receiptDateRange[1]]
    }

    const { list, total: totalCount } = await listReceipts(params)
    tableData.value = list.map(mapReceiptToRow)
    total.value = totalCount
    await nextTick()
    const shouldExpand = Boolean(
      params.itemCode || params.customerName || params.receiptDateRange?.length === 2
    )
    tableData.value.forEach((row) => {
      tableRef.value?.toggleRowExpansion(row, shouldExpand)
    })
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  pagination.page = 1
  void loadData()
}

const handleReset = () => {
  queryForm.itemCode = ''
  queryForm.customerName = ''
  queryForm.status = ''
  queryForm.receiptDateRange = []
  pagination.page = 1
  void loadData()
}

const handleSizeChange = (size: number) => {
  pagination.size = size
  pagination.page = 1
  void loadData()
}

const handleCurrentChange = (page: number) => {
  pagination.page = page
  void loadData()
}

const assignDialogForm = (payload: ReceiptPayload) => {
  dialogForm.receiptNo = payload.receiptNo
  dialogForm.customerName = payload.customerName
  dialogForm.contractNo = payload.contractNo
  dialogForm.status = payload.status
  dialogForm.receiptDate = payload.receiptDate
  dialogForm.deliveryDate = payload.deliveryDate
  dialogForm.receiptMethod = payload.receiptMethod || '现汇'
  dialogForm.accountName = payload.accountName || '交行'
  dialogForm.details.splice(
    0,
    dialogForm.details.length,
    ...payload.details.map((detail) => ({ ...detail }))
  )
  if (!dialogForm.details.length) {
    dialogForm.details.push(createEmptyDetail())
  }
}

const resetDialogForm = () => {
  assignDialogForm(createEmptyReceipt())
}

const getTodayText = () => {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const generateDialogDocumentNo = () => {
  const today = getTodayText().replace(/-/g, '')
  const prefix = `HK-${today}-`
  let maxSeq = 0
  tableData.value.forEach((row) => {
    const no = String(row.documentNo || row.receiptNo || '')
    if (!no.startsWith(prefix)) return
    const seq = Number(no.slice(prefix.length))
    if (Number.isFinite(seq)) maxSeq = Math.max(maxSeq, seq)
  })
  return `${prefix}${String(maxSeq + 1).padStart(3, '0')}`
}

const loadCustomerOptions = async () => {
  const resp = await getCustomerListApi({ page: 1, pageSize: 1000, status: 'active' })
  const raw: any = resp
  const pr: any = raw?.data ?? raw
  const data: any = pr?.data ?? pr
  const list = Array.isArray(data?.list) ? data.list : []
  customerOptions.value = list
    .map((item: any) => String(item.customerName || '').trim())
    .filter((name: string) => !!name)
}

const loadReceiptCandidates = async (resetPage = false) => {
  if (resetPage) {
    receiptCandidatePage.value = 1
    selectedReceiptCandidateMap.value = {}
    selectedReceiptCandidates.value = []
  }
  receiptCandidateLoading.value = true
  try {
    const selectedCustomerName = (
      dialogForm.customerName ||
      receiptCandidateCustomerName.value ||
      ''
    ).trim()
    const resp = await getFinanceReceiptCandidatesApi({
      keyword: receiptCandidateKeyword.value.trim() || undefined,
      customerName: selectedCustomerName || undefined,
      page: receiptCandidatePage.value,
      pageSize: receiptCandidatePageSize.value
    })
    const raw: any = resp
    const pr: any = raw?.data ?? raw
    const data: any = pr?.data ?? pr
    const list = Array.isArray(data?.list) ? data.list : []
    const customerOptions = Array.isArray(data?.customerOptions) ? data.customerOptions : []
    receiptCandidateCustomerOptions.value = customerOptions
      .map((v: any) => String(v || '').trim())
      .filter(Boolean)
    receiptCandidateTotal.value = Number(data?.total || 0)
    receiptCandidatePage.value = Number(data?.page || receiptCandidatePage.value)
    receiptCandidatePageSize.value = Number(data?.pageSize || receiptCandidatePageSize.value)
    receiptCandidates.value = list.map((it: any) => ({
      detailId: Number(it.detailId) || 0,
      itemCode: String(it.itemCode || ''),
      productName: String(it.productName || ''),
      productDrawingNo: String(it.productDrawingNo || ''),
      customerPartNo: String(it.customerPartNo || ''),
      customerName: String(it.customerName || ''),
      contractNo: String(it.contractNo || ''),
      orderQuantity: Number(it.orderQuantity) || 0,
      orderUnitPrice: Number(it.orderUnitPrice) || 0,
      orderAmount: Number(it.orderAmount) || 0,
      receivableAmount: Number(it.receivableAmount) || 0
    }))
    await nextTick()
    await syncReceiptCandidateSelection()
    persistReceiptCandidatePrefs()
  } finally {
    receiptCandidateLoading.value = false
  }
}

const openReceiptCandidateDialog = async () => {
  receiptCandidateDialogVisible.value = true
  await nextTick()
  receiptCandidateTableRef.value?.clearSelection()
  await loadReceiptCandidates()
}

const clearReceiptCandidateSelection = () => {
  selectedReceiptCandidateMap.value = {}
  selectedReceiptCandidates.value = []
  receiptCandidateTableRef.value?.clearSelection()
}

const handleReceiptCandidatePageChange = (page: number) => {
  receiptCandidatePage.value = page
  void loadReceiptCandidates()
}

const handleReceiptCandidateSizeChange = (size: number) => {
  receiptCandidatePageSize.value = size
  receiptCandidatePage.value = 1
  void loadReceiptCandidates()
}

const syncReceiptCandidateSelection = async () => {
  if (!receiptCandidateTableRef.value) return
  syncingReceiptCandidateSelection.value = true
  receiptCandidateTableRef.value.clearSelection()
  receiptCandidates.value.forEach((row) => {
    const key = getReceiptCandidateKey(row)
    if (!selectedReceiptCandidateMap.value[key]) return
    receiptCandidateTableRef.value?.toggleRowSelection(row, true)
  })
  await nextTick()
  syncingReceiptCandidateSelection.value = false
}

const handleReceiptCandidateSelectionChange = (rows: ReceiptCandidate[]) => {
  if (syncingReceiptCandidateSelection.value) return
  const currentPageKeys = new Set(receiptCandidates.value.map((it) => getReceiptCandidateKey(it)))
  const map = { ...selectedReceiptCandidateMap.value }

  const existingSelected = Object.values(map)
  const expectedCustomer = (
    dialogForm.customerName ||
    existingSelected[0]?.customerName ||
    rows[0]?.customerName ||
    ''
  ).trim()
  const validRows = rows.filter((it) => String(it.customerName || '').trim() === expectedCustomer)

  if (validRows.length !== rows.length) {
    ElMessage.warning(
      dialogForm.customerName
        ? '仅可勾选与当前单据客户一致的候选明细'
        : '仅可勾选同一客户的候选明细'
    )
  }

  currentPageKeys.forEach((key) => {
    delete map[key]
  })
  validRows.forEach((it) => {
    map[getReceiptCandidateKey(it)] = it
  })
  selectedReceiptCandidateMap.value = map
  rebuildSelectedReceiptCandidates()

  if (validRows.length !== rows.length) {
    void syncReceiptCandidateSelection()
  }
}

const applyReceiptCandidates = () => {
  if (!selectedReceiptCandidates.value.length) {
    ElMessage.warning('请先勾选候选明细')
    return
  }
  const firstCustomer = selectedReceiptCandidates.value[0].customerName
  const mixed = selectedReceiptCandidates.value.some((it) => it.customerName !== firstCustomer)
  if (mixed) {
    ElMessage.warning('只能选择同一客户的候选明细')
    return
  }
  if (dialogForm.customerName && dialogForm.customerName !== firstCustomer) {
    ElMessage.warning('候选明细客户与单据客户不一致')
    return
  }
  if (!dialogForm.customerName) {
    dialogForm.customerName = firstCustomer
  }
  if (
    dialogForm.details.length === 1 &&
    !dialogForm.details[0].itemCode &&
    !dialogForm.details[0].productName
  ) {
    dialogForm.details.splice(0, 1)
  }
  const existingDetailIds = new Set(dialogForm.details.map((d) => String(d.detailId || '')))
  selectedReceiptCandidates.value.forEach((it) => {
    if (existingDetailIds.has(String(it.detailId))) return
    const detail = createEmptyDetail()
    detail.detailId = it.detailId
    detail.itemCode = it.itemCode
    detail.productName = it.productName
    detail.productDrawingNo = it.productDrawingNo
    detail.customerPartNo = it.customerPartNo
    detail.contractNo = it.contractNo
    detail.orderQuantity = it.orderQuantity
    detail.orderUnitPrice = it.orderUnitPrice
    detail.orderAmount = it.orderAmount
    detail.receivableAmount = it.receivableAmount
    detail.amount = undefined
    detail.discountAmount = undefined
    detail.receiptMethod = dialogForm.receiptMethod || '现汇'
    detail.accountName = dialogForm.accountName || '交行'
    detail.customerName = dialogForm.customerName
    dialogForm.details.push(detail)
  })
  selectedReceiptCandidateMap.value = {}
  selectedReceiptCandidates.value = []
  receiptCandidateDialogVisible.value = false
}

const handleCreate = async () => {
  dialogTitle.value = '新增回款单据'
  currentReceiptNo.value = null
  resetDialogForm()
  const today = getTodayText()
  dialogForm.receiptNo = generateDialogDocumentNo()
  dialogForm.deliveryDate = today
  dialogForm.receiptDate = today
  dialogForm.receiptMethod = '现汇'
  dialogForm.accountName = '交行'
  dialogVisible.value = true
  await nextTick()
  dialogFormRef.value?.clearValidate()
}

const openEditDialog = async (row: ReceiptTableRow) => {
  try {
    const receipt = JSON.parse(JSON.stringify(row)) as ReceiptTableRow
    const { totalAmount: _totalAmount, ...payload } = receipt
    dialogTitle.value = '编辑回款单据'
    currentReceiptNo.value = receipt.documentNo || receipt.receiptNo || ''
    assignDialogForm(payload)
    dialogVisible.value = true
    await nextTick()
    dialogFormRef.value?.clearValidate()
  } catch (error) {
    ElMessage.error((error as Error).message || '加载回款单据失败')
  }
}

const handleEdit = (row: ReceiptTableRow) => {
  if (readOnlyMode) {
    ElMessage.warning('当前阶段为只读模式，暂不支持编辑')
    return
  }
  void openEditDialog(row)
}

const handleRowDblClick = (row: ReceiptTableRow) => {
  if (readOnlyMode) {
    return
  }
  void openEditDialog(row)
}

const addDetailRow = () => {
  dialogForm.details.push(createEmptyDetail())
}

const removeDetailRow = (index: number) => {
  if (dialogForm.details.length <= 1) {
    ElMessage.warning('至少保留一条产品明细')
    return
  }
  dialogForm.details.splice(index, 1)
}

const dialogTotals = computed(() => calculateSummary(dialogForm.details))

const cloneReceiptPayload = (source: ReceiptPayload): ReceiptPayload => ({
  receiptNo: source.receiptNo,
  customerName: source.customerName,
  contractNo: source.contractNo,
  status: source.status,
  receiptDate: source.receiptDate,
  deliveryDate: source.deliveryDate,
  receiptMethod: source.receiptMethod,
  accountName: source.accountName,
  details: source.details.map((detail) => ({ ...detail }))
})

const submitDialogForm = async () => {
  if (!dialogFormRef.value) {
    return
  }

  try {
    await dialogFormRef.value.validate()
  } catch {
    return
  }

  if (!dialogForm.details.length) {
    ElMessage.error('请至少添加一条产品明细')
    return
  }

  const invalidDetail = dialogForm.details.find(
    (detail) =>
      !detail.productName.trim() ||
      !Number.isFinite(Number(detail.amount)) ||
      Number(detail.amount) <= 0
  )

  if (invalidDetail) {
    ElMessage.error('请完善产品名称并确保数量大于 0')
    return
  }

  const payload = cloneReceiptPayload(dialogForm)
  payload.details = payload.details.map((detail) => ({
    ...detail,
    receiptMethod: detail.receiptMethod || payload.receiptMethod || '现汇',
    accountName: detail.accountName || payload.accountName || '交行'
  }))
  dialogSubmitting.value = true

  try {
    if (currentReceiptNo.value === null) {
      await createReceipt(payload)
      pagination.page = 1
      ElMessage.success('新增成功')
    } else {
      await updateReceipt(currentReceiptNo.value, payload)
      ElMessage.success('更新成功')
    }
    dialogVisible.value = false
    await loadData()
  } catch (error) {
    ElMessage.error((error as Error).message || '保存失败')
  } finally {
    dialogSubmitting.value = false
  }
}

const handleDelete = async (row: ReceiptTableRow) => {
  if (readOnlyMode) {
    ElMessage.warning('当前阶段为只读模式，暂不支持删除')
    return
  }
  try {
    const message = `<div style="line-height: 1.8;">
      <div>确定删除回款单据 ${row.documentNo || row.receiptNo} 吗？删除后将无法恢复！</div>
      <div style="margin-top: 8px;">请输入 "Y" 确认删除：</div>
    </div>`

    const { value } = await ElMessageBox.prompt(message, '警告', {
      confirmButtonText: '确定删除',
      cancelButtonText: '取消',
      type: 'warning',
      inputPattern: /^[Yy]$/,
      inputErrorMessage: '请输入字母 Y 才能确认删除',
      dangerouslyUseHTMLString: true
    })

    if (value && value.toUpperCase() === 'Y') {
      await removeReceipt(row.documentNo || row.receiptNo)
      if (tableData.value.length === 1 && pagination.page > 1) {
        pagination.page -= 1
      }
      await loadData()
      ElMessage.success('删除成功')
    }
  } catch (error: any) {
    if (error === 'cancel' || error === 'close') {
      return
    }
    if (error instanceof Error) {
      ElMessage.error(error.message || '删除失败')
    } else {
      ElMessage.error('删除失败')
    }
  }
}

const handleDialogClosed = () => {
  resetDialogForm()
  currentReceiptNo.value = null
  dialogFormRef.value?.clearValidate()
}

onMounted(() => {
  void loadData()
  void loadCustomerOptions().catch(() => {
    customerOptions.value = []
  })
})
</script>

<style scoped>
.sales-orders-page {
  position: relative;
}

.query-form {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  padding-right: 0;
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

.so-table-wrapper {
  background: var(--el-bg-color);
  border-radius: 8px;
}

:deep(.so-table .el-table__header .cell),
:deep(.so-table .el-table__body .cell) {
  font-size: 13px;
}

:deep(.so-table .el-table__cell .cell),
:deep(.so-table .el-table__cell .cell span),
:deep(.so-table .el-table__cell .cell div) {
  white-space: nowrap !important;
}

.finance-dialog-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.finance-dialog-section {
  padding: 10px 12px 12px;
  background: #f8fafc;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
}

.finance-dialog-section__head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
  margin-bottom: 10px;
}

.finance-dialog-section__title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.finance-dialog-grid {
  display: grid;
  gap: 10px 18px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.finance-dialog-grid :deep(.el-form-item) {
  margin-bottom: 0;
}

.finance-dialog-summary {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
}

.finance-dialog-summary__item {
  padding: 4px 10px;
  font-size: 12px;
  color: #606266;
  background: #eef2f7;
  border-radius: 999px;
}

.finance-candidate-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.finance-candidate-toolbar__selected {
  margin-left: auto;
  font-size: 12px;
  color: #606266;
}

.finance-candidate-pagination {
  display: flex;
  margin-top: 10px;
  justify-content: flex-end;
}

.dialog-form-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.dialog-input {
  width: 252px;
}

.dialog-date-picker {
  width: 252px !important;
}

.dialog-date-picker :deep(.el-input),
.dialog-date-picker :deep(.el-input__wrapper),
.dialog-date-picker :deep(.el-input__inner) {
  width: 100%;
}

.dialog-status-item :deep(.el-form-item__label::before) {
  content: '';
}

.dialog-product-section {
  margin-top: 24px;
}

.dialog-product-summary {
  display: flex;
  margin-top: 12px;
  justify-content: space-between;
  align-items: center;
}

.dialog-product-summary__item {
  margin-right: 16px;
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

.so-timeline-layout {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

.so-timeline-left {
  flex: 0 0 408px;
  max-height: calc(100vh - 220px);
  padding: 8px;
  overflow: auto;
  background-color: var(--el-bg-color);
  border-radius: 8px;
}

.so-timeline-right {
  flex: 1;
  max-height: calc(100vh - 220px);
  padding: 8px 12px;
  overflow: auto;
  background-color: var(--el-bg-color);
  border-radius: 8px;
}

.so-timeline-date-group + .so-timeline-date-group {
  margin-top: 12px;
}

.so-timeline-date-header {
  margin-bottom: 4px;
  font-weight: 600;
  color: #303133;
}

.so-timeline-order-block {
  padding-left: 10px;
  margin-left: 4px;
  border-left: 2px solid #e4e7ed;
}

.so-timeline-order-header {
  display: flex;
  padding: 6px 8px;
  margin: 4px 0;
  cursor: pointer;
  background-color: #f5f7fa;
  border-radius: 6px;
  justify-content: space-between;
  align-items: flex-start;
}

.so-timeline-order-header:hover {
  background-color: #eef1f6;
}

.so-timeline-order-header.is-active {
  background-color: #ecf5ff;
  border: 1px solid #409eff;
}

.so-timeline-order-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 13px;
}

.so-timeline-order-no {
  font-weight: 600;
}

.so-timeline-order-customer {
  font-size: 12px;
  color: #666;
}

.so-timeline-order-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  font-size: 12px;
  color: #666;
}

.so-timeline-order-details {
  padding-bottom: 4px;
  margin-left: 16px;
}

.so-timeline-detail-row {
  padding: 4px 6px;
  margin: 2px 0;
  font-size: 14px;
  cursor: pointer;
  border-radius: 4px;
}

.so-timeline-detail-row:hover {
  background-color: #f5f7fa;
}

.so-timeline-detail-row.is-active {
  background-color: #ecf5ff;
  border: 1px solid #409eff;
}

.so-timeline-detail-main {
  font-weight: 500;
  color: #333;
}

.so-timeline-detail-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 2px;
  color: #666;
}

.so-timeline-detail-panel-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.so-timeline-empty {
  margin-top: 16px;
}

:deep(.so-timeline-detail-panel .el-table__header .cell),
:deep(.so-timeline-detail-panel .el-table__body .cell) {
  font-size: 14px;
}

.view-dialog-section + .view-dialog-section {
  margin-top: 14px;
}

.view-dialog-section-title {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 600;
}

.view-dialog-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.view-dialog-section-header--timeline {
  align-items: flex-start;
}

.view-dialog-section-main {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.view-dialog-info-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px 12px;
}

.view-dialog-info-item {
  font-size: 13px;
}

.view-dialog-info-label {
  color: var(--el-text-color-secondary);
}

.view-dialog-info-value {
  color: var(--el-text-color-primary);
}

.so-timeline-header-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}

.dialog-table-wrapper {
  width: 100%;
}

:deep(.so-view-detail-row--active) td {
  background-color: #ecf5ff !important;
}

:deep(.so-view-detail-row--active) .cell {
  color: #409eff !important;
}
</style>
