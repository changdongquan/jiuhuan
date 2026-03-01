<template>
  <div class="sales-orders-page px-4 pt-0 pb-1 space-y-2">
    <el-form
      ref="queryFormRef"
      :model="queryForm"
      label-width="90px"
      inline
      class="query-form rounded-lg bg-[var(--el-bg-color-overlay)] py-2 shadow-sm"
    >
      <el-form-item label="单据编号/发票号">
        <el-input
          v-model="queryForm.itemCode"
          placeholder="请输入单据编号或发票号码"
          clearable
          style="width: 160px"
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
      <el-form-item label="单据状态">
        <el-select
          v-model="queryForm.status"
          placeholder="请选择单据状态"
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
      <el-form-item label="开票日期">
        <el-date-picker
          v-model="queryForm.invoiceDateRange"
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
              <el-table-column prop="id" label="明细ID" width="70" />
              <el-table-column prop="invoiceId" label="发票ID" width="70" />
              <el-table-column prop="itemCode" label="项目编号" min-width="140" />
              <el-table-column prop="productName" label="产品名称" min-width="140" />
              <el-table-column label="数量" width="60" align="center">
                <template #default="{ row: detail }">
                  {{ detail.quantity }}
                </template>
              </el-table-column>
              <el-table-column label="单价(元)" width="90" align="right">
                <template #default="{ row: detail }">
                  {{ formatAmount(detail.unitPrice) }}
                </template>
              </el-table-column>
              <el-table-column label="金额(元)" width="100" align="right">
                <template #default="{ row: detail }">
                  {{ formatAmount(detail.amount) }}
                </template>
              </el-table-column>
              <el-table-column prop="remark" label="备注" min-width="120" show-overflow-tooltip />
              <el-table-column label="是否已开全额发票" width="140" align="center">
                <template #default="{ row: detail }">{{
                  formatBoolean(detail.fullIssued)
                }}</template>
              </el-table-column>
              <el-table-column prop="productDrawingNo" label="产品图号" min-width="140" />
              <el-table-column prop="customerPartNo" label="客户模号" min-width="140" />
              <el-table-column prop="contractNo" label="合同号" min-width="140" />
              <el-table-column label="是否已开预付发票" width="140" align="center">
                <template #default="{ row: detail }">{{
                  formatBoolean(detail.prepaidIssued)
                }}</template>
              </el-table-column>
              <el-table-column label="是否已开验收发票" width="140" align="center">
                <template #default="{ row: detail }">{{
                  formatBoolean(detail.acceptanceIssued)
                }}</template>
              </el-table-column>
              <el-table-column label="是否已红冲" width="100" align="center">
                <template #default="{ row: detail }">{{
                  formatBoolean(detail.detailIsRed)
                }}</template>
              </el-table-column>
              <el-table-column label="是否结清" width="100" align="center">
                <template #default="{ row: detail }">{{
                  formatBoolean(detail.detailIsSettled)
                }}</template>
              </el-table-column>
            </el-table>
          </template>
        </el-table-column>
        <el-table-column prop="documentNo" label="单据编号" min-width="140" />
        <el-table-column prop="invoiceNo" label="发票号码" min-width="140" />
        <el-table-column prop="customerName" label="客户名称" min-width="160" />
        <el-table-column label="行项目数" width="100" align="center">
          <template #default="{ row }">
            {{ row.details.length }}
          </template>
        </el-table-column>
        <el-table-column label="总数量" width="100" align="center">
          <template #default="{ row }">
            {{ row.totalQuantity }}
          </template>
        </el-table-column>
        <el-table-column label="含税金额" width="140" align="right">
          <template #default="{ row }">
            {{ formatAmount(row.totalAmount) }}
          </template>
        </el-table-column>
        <el-table-column label="单据状态" width="120" align="center">
          <template #default="{ row }">
            <el-tag :type="statusTagMap[row.status].type">
              {{ statusTagMap[row.status].label }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="invoiceDate" label="开票日期" width="140" />
        <el-table-column prop="deliveryDate" label="到期日期" width="140" />
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
          <div v-for="invoice in group.invoices" :key="invoice.id" class="so-timeline-order-block">
            <div
              class="so-timeline-order-header"
              :class="{ 'is-active': timelineActiveInvoiceId === invoice.id }"
              @click="handleTimelineInvoiceClick(invoice)"
            >
              <div class="so-timeline-order-main">
                <span class="so-timeline-order-no">{{ invoice.documentNo || '-' }}</span>
                <span class="so-timeline-order-customer">{{ invoice.customerName || '-' }}</span>
              </div>
              <div class="so-timeline-order-meta">
                <span>发票 {{ invoice.invoiceNo || '-' }}</span>
                <span>明细 {{ invoice.details.length }}</span>
                <span>数量 {{ invoice.totalQuantity }}</span>
                <span>金额 {{ formatAmount(invoice.totalAmount) }}</span>
                <el-tag :type="statusTagMap[invoice.status].type">
                  {{ statusTagMap[invoice.status].label }}
                </el-tag>
              </div>
            </div>
            <div v-if="invoice.details && invoice.details.length" class="so-timeline-order-details">
              <div
                v-for="detail in invoice.details"
                :key="detail.id"
                class="so-timeline-detail-row"
                :class="{ 'is-active': isTimelineActiveDetail(invoice.id, detail) }"
                @click.stop="handleTimelineDetailClick(invoice, detail)"
              >
                <div class="so-timeline-detail-main">
                  {{ detail.itemCode || '' }} {{ detail.productName || '' }}
                </div>
                <div class="so-timeline-detail-meta">
                  <span v-if="detail.customerPartNo">模号 {{ detail.customerPartNo }}</span>
                  <span>数量 {{ detail.quantity || 0 }}</span>
                  <span>金额 {{ formatAmount(detail.amount) }}</span>
                  <span>结清 {{ formatBoolean(detail.detailIsSettled) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-if="!timelineGroups.length" class="so-timeline-empty">
          <el-empty description="当前条件下暂无开票数据" />
        </div>
      </div>
      <div class="so-timeline-right">
        <div v-if="timelineSelectedInvoice" class="so-timeline-detail-panel">
          <div class="view-dialog-section">
            <h3 class="view-dialog-section-title">开票基本信息</h3>
            <div class="view-dialog-info-grid">
              <div class="view-dialog-info-item">
                <span class="view-dialog-info-label">单据编号：</span>
                <span class="view-dialog-info-value">{{
                  timelineSelectedInvoice.documentNo || '-'
                }}</span>
              </div>
              <div class="view-dialog-info-item">
                <span class="view-dialog-info-label">发票号码：</span>
                <span class="view-dialog-info-value">{{
                  timelineSelectedInvoice.invoiceNo || '-'
                }}</span>
              </div>
              <div class="view-dialog-info-item">
                <span class="view-dialog-info-label">客户名称：</span>
                <span class="view-dialog-info-value">{{
                  timelineSelectedInvoice.customerName || '-'
                }}</span>
              </div>
              <div class="view-dialog-info-item">
                <span class="view-dialog-info-label">合同编号：</span>
                <span class="view-dialog-info-value">{{
                  timelineSelectedInvoice.contractNo || '-'
                }}</span>
              </div>
              <div class="view-dialog-info-item">
                <span class="view-dialog-info-label">开票日期：</span>
                <span class="view-dialog-info-value">{{
                  timelineSelectedInvoice.invoiceDate || '-'
                }}</span>
              </div>
              <div class="view-dialog-info-item">
                <span class="view-dialog-info-label">总数量：</span>
                <span class="view-dialog-info-value">{{
                  timelineSelectedInvoice.totalQuantity
                }}</span>
              </div>
              <div class="view-dialog-info-item">
                <span class="view-dialog-info-label">总金额：</span>
                <span class="view-dialog-info-value">
                  {{ formatAmount(timelineSelectedInvoice.totalAmount) }} 元
                </span>
              </div>
            </div>
          </div>
          <div class="view-dialog-section">
            <h3 class="view-dialog-section-title">发票明细</h3>
            <div class="dialog-table-wrapper">
              <el-table
                :data="timelineSelectedInvoice.details"
                border
                size="small"
                :row-class-name="timelineDetailRowClassName"
              >
                <el-table-column prop="id" label="明细ID" width="70" />
                <el-table-column prop="invoiceId" label="发票ID" width="70" />
                <el-table-column prop="itemCode" label="项目编号" min-width="140" />
                <el-table-column prop="productName" label="产品名称" min-width="140" />
                <el-table-column label="数量" width="60" align="center">
                  <template #default="{ row }">{{ row.quantity }}</template>
                </el-table-column>
                <el-table-column label="单价(元)" width="90" align="right">
                  <template #default="{ row }">{{ formatAmount(row.unitPrice) }}</template>
                </el-table-column>
                <el-table-column label="金额(元)" width="100" align="right">
                  <template #default="{ row }">{{ formatAmount(row.amount) }}</template>
                </el-table-column>
                <el-table-column prop="remark" label="备注" min-width="120" show-overflow-tooltip />
                <el-table-column label="是否已开全额发票" width="140" align="center">
                  <template #default="{ row }">{{ formatBoolean(row.fullIssued) }}</template>
                </el-table-column>
                <el-table-column prop="productDrawingNo" label="产品图号" min-width="140" />
                <el-table-column prop="customerPartNo" label="客户模号" min-width="120" />
                <el-table-column prop="contractNo" label="合同号" min-width="120" />
                <el-table-column label="是否已开预付发票" width="140" align="center">
                  <template #default="{ row }">{{ formatBoolean(row.prepaidIssued) }}</template>
                </el-table-column>
                <el-table-column label="是否已开验收发票" width="140" align="center">
                  <template #default="{ row }">{{ formatBoolean(row.acceptanceIssued) }}</template>
                </el-table-column>
                <el-table-column label="是否已红冲" width="100" align="center">
                  <template #default="{ row }">{{ formatBoolean(row.detailIsRed) }}</template>
                </el-table-column>
                <el-table-column label="是否结清" width="100" align="center">
                  <template #default="{ row }">{{ formatBoolean(row.detailIsSettled) }}</template>
                </el-table-column>
              </el-table>
            </div>
          </div>
        </div>
        <div v-else class="so-timeline-detail-panel-empty">
          <el-empty description="请选择左侧时间轴中的开票单据" />
        </div>
      </div>
    </div>

    <div style="display: flex; margin-top: 16px; justify-content: center">
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
            <el-form-item label="单据编号" prop="documentNo">
              <el-input
                v-model="dialogForm.documentNo"
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
            <el-form-item label="发票号码">
              <el-input
                v-model="dialogForm.invoiceNo"
                placeholder="请输入发票号码"
                class="dialog-input"
              />
            </el-form-item>
            <el-form-item label="开票日期">
              <el-date-picker
                v-model="dialogForm.invoiceDate"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="请选择开票日期"
                class="dialog-date-picker"
                style="width: 252px"
              />
            </el-form-item>
            <el-form-item label="单据日期">
              <el-input v-model="dialogForm.deliveryDate" class="dialog-input" disabled />
            </el-form-item>
            <el-form-item label="单据状态" class="dialog-status-item">
              <el-select
                v-model="dialogForm.status"
                placeholder="请选择单据状态"
                class="dialog-input"
              >
                <el-option
                  v-for="item in statusOptions"
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
            <div class="finance-dialog-section__title">发票明细</div>
            <div class="finance-dialog-summary">
              <span class="finance-dialog-summary__item"
                >明细数 {{ dialogForm.details.length }}</span
              >
              <span class="finance-dialog-summary__item"
                >数量合计 {{ dialogTotals.totalQuantity }}</span
              >
              <span class="finance-dialog-summary__item"
                >金额合计 {{ formatAmount(dialogTotals.totalAmount) }}</span
              >
              <el-button type="primary" plain @click="addDetailRow">新增明细</el-button>
            </div>
          </div>

          <el-table :data="dialogForm.details" border size="small" row-key="id" style="width: 100%">
            <el-table-column type="index" label="序号" width="45" />
            <el-table-column label="行项目编号" min-width="140">
              <template #default="{ row }">
                <el-input v-model="row.itemCode" placeholder="请输入行项目编号" />
              </template>
            </el-table-column>
            <el-table-column label="商品/服务名称" min-width="150">
              <template #default="{ row }">
                <el-input v-model="row.productName" placeholder="请输入商品或服务名称" />
              </template>
            </el-table-column>
            <el-table-column label="税收分类编码" min-width="130">
              <template #default="{ row }">
                <el-input v-model="row.productDrawingNo" placeholder="请输入税收分类编码" />
              </template>
            </el-table-column>
            <el-table-column label="单位" min-width="130">
              <template #default="{ row }">
                <el-input v-model="row.customerPartNo" placeholder="请输入单位" />
              </template>
            </el-table-column>
            <el-table-column label="数量" width="140" align="center">
              <template #default="{ row }">
                <el-input-number
                  v-model="row.quantity"
                  :min="0"
                  :step="1"
                  style="width: 100%"
                  @change="handleDetailQuantityChange(row)"
                />
              </template>
            </el-table-column>
            <el-table-column label="单价(元)" width="120" align="right">
              <template #default="{ row }">
                <el-input-number
                  v-model="row.unitPrice"
                  :min="0"
                  :step="100"
                  :precision="2"
                  :controls="false"
                  style="width: 100%"
                  @change="handleDetailUnitPriceChange(row)"
                />
              </template>
            </el-table-column>
            <el-table-column label="金额(元)" width="80" align="right">
              <template #default="{ row }">
                {{ formatAmount(row.amount) }}
              </template>
            </el-table-column>
            <el-table-column label="到期日期" width="150">
              <template #default="{ row }">
                <el-date-picker
                  v-model="row.deliveryDate"
                  type="date"
                  value-format="YYYY-MM-DD"
                  placeholder="请选择到期日期"
                  style="width: 130px"
                />
              </template>
            </el-table-column>
            <el-table-column label="备注" min-width="150">
              <template #default="{ row }">
                <el-input v-model="row.remark" placeholder="备注" />
              </template>
            </el-table-column>
            <el-table-column label="更多说明" min-width="145">
              <template #default="{ row }">
                <el-input v-model="row.costSource" placeholder="请输入说明" />
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
import { createFinanceInvoiceApi, getFinanceInvoiceListApi } from '@/api/finance'
import { getCustomerListApi } from '@/api/customer'

type InvoiceStatus = 'normal' | 'red'
type TagType = 'primary' | 'success' | 'info' | 'warning' | 'danger'

interface InvoiceLine {
  id: number
  invoiceId?: number
  itemCode: string
  productName: string
  productDrawingNo: string
  customerPartNo: string
  contractNo?: string
  quantity: number
  unitPrice: number
  amount: number
  deliveryDate: string
  remark: string
  costSource: string
  fullIssued?: boolean
  prepaidIssued?: boolean
  acceptanceIssued?: boolean
  detailIsRed?: boolean
  detailIsSettled?: boolean
}

interface Invoice {
  id: number
  documentNo?: string
  invoiceNo: string
  customerName: string
  contractNo: string
  status: InvoiceStatus
  invoiceDate: string
  deliveryDate: string
  details: InvoiceLine[]
}

interface InvoiceQuery {
  itemCode: string
  customerName: string
  status: '' | InvoiceStatus
  invoiceDateRange: string[]
}

interface ListInvoicesParams {
  page: number
  size: number
  itemCode?: string
  customerName?: string
  status?: InvoiceStatus
  invoiceDateRange?: [string, string]
}

interface PaginatedInvoices {
  list: Invoice[]
  total: number
}

interface InvoiceTableRow extends Invoice {
  totalQuantity: number
  totalAmount: number
}

type InvoicePayload = Omit<Invoice, 'id'> & { documentNo: string }

const mockInvoices = ref<Invoice[]>([
  {
    id: 1,
    invoiceNo: 'INV-20240101',
    customerName: '华东制造有限公司',
    contractNo: 'HT-2023-001',
    status: 'normal',
    invoiceDate: '2024-01-05',
    deliveryDate: '2024-02-05',
    details: [
      {
        id: 1,
        itemCode: 'ITEM-001',
        productName: '自动化生产线线路板',
        productDrawingNo: '1304019901',
        customerPartNo: '套',
        quantity: 50,
        unitPrice: 980.0,
        amount: 49000,
        deliveryDate: '2024-01-15',
        remark: '含 13% 税率',
        costSource: '首批发货'
      },
      {
        id: 2,
        itemCode: 'ITEM-002',
        productName: '设备安装与调试服务费',
        productDrawingNo: '9909999999',
        customerPartNo: '项',
        quantity: 1,
        unitPrice: 35000,
        amount: 35000,
        deliveryDate: '2024-02-05',
        remark: '不含运费',
        costSource: '服务结算'
      }
    ]
  },
  {
    id: 2,
    invoiceNo: 'INV-20240216',
    customerName: '远航国际贸易',
    contractNo: 'HT-2023-017',
    status: 'normal',
    invoiceDate: '2024-02-16',
    deliveryDate: '2024-03-15',
    details: [
      {
        id: 3,
        itemCode: 'ITEM-010',
        productName: '服务器整机',
        productDrawingNo: '8471410090',
        customerPartNo: '台',
        quantity: 5,
        unitPrice: 42800,
        amount: 214000,
        deliveryDate: '2024-02-25',
        remark: '含三年维保',
        costSource: '出口发票'
      },
      {
        id: 4,
        itemCode: 'ITEM-011',
        productName: '存储扩展柜',
        productDrawingNo: '8471709000',
        customerPartNo: '套',
        quantity: 2,
        unitPrice: 9100,
        amount: 18200,
        deliveryDate: '2024-03-05',
        remark: '海运至新加坡',
        costSource: '出口发票'
      }
    ]
  },
  {
    id: 3,
    invoiceNo: 'INV-20231220',
    customerName: '星辰工业',
    contractNo: 'HT-2022-089',
    status: 'red',
    invoiceDate: '2023-12-20',
    deliveryDate: '2024-01-20',
    details: [
      {
        id: 5,
        itemCode: 'ITEM-020',
        productName: '模具翻修服务',
        productDrawingNo: '9909999999',
        customerPartNo: '项',
        quantity: 1,
        unitPrice: 32000,
        amount: 32000,
        deliveryDate: '2023-12-30',
        remark: '含税率 6%',
        costSource: '维修结算'
      }
    ]
  }
])

const detailIdSeed = ref(
  (() => {
    const ids = mockInvoices.value.flatMap((invoice) => invoice.details.map((detail) => detail.id))
    return (ids.length ? Math.max(...ids) : 0) + 1
  })()
)

const createDetailId = () => detailIdSeed.value++

const createEmptyDetail = (): InvoiceLine => ({
  id: createDetailId(),
  invoiceId: 0,
  itemCode: '',
  productName: '',
  productDrawingNo: '',
  customerPartNo: '',
  contractNo: '',
  quantity: 1,
  unitPrice: 0,
  amount: 0,
  deliveryDate: '',
  remark: '',
  costSource: '',
  fullIssued: false,
  prepaidIssued: false,
  acceptanceIssued: false,
  detailIsRed: false,
  detailIsSettled: false
})

const createEmptyInvoice = (): InvoicePayload => ({
  documentNo: '',
  invoiceNo: '',
  customerName: '',
  contractNo: '',
  status: 'normal',
  invoiceDate: '',
  deliveryDate: '',
  details: [createEmptyDetail()]
})

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, ms)
  })

const readOnlyMode = true
const route = useRoute()
const customerOptions = ref<string[]>([])

const normalizeDetails = (details: InvoiceLine[]): InvoiceLine[] =>
  details.map((detail) => {
    const quantity = Number(detail.quantity) || 0
    const unitPrice = Number(detail.unitPrice) || 0
    const amount = Number((quantity * unitPrice).toFixed(2))
    return {
      ...detail,
      quantity,
      unitPrice,
      amount
    }
  })

const calculateSummary = (details: InvoiceLine[]) =>
  details.reduce(
    (acc, item) => {
      acc.totalQuantity += item.quantity
      acc.totalAmount += item.amount
      return acc
    },
    { totalQuantity: 0, totalAmount: 0 }
  )

const listInvoices = async (params: ListInvoicesParams): Promise<PaginatedInvoices> => {
  const payload: any = {
    page: params.page,
    pageSize: params.size
  }
  if (params.itemCode) payload.itemCode = params.itemCode
  if (params.customerName) payload.customerName = params.customerName
  if (params.status) payload.status = params.status
  if (params.invoiceDateRange && params.invoiceDateRange.length === 2) {
    payload.invoiceDateStart = params.invoiceDateRange[0]
    payload.invoiceDateEnd = params.invoiceDateRange[1]
  }

  const response = await getFinanceInvoiceListApi(payload)
  const raw: any = response
  const pr: any = raw?.data ?? raw
  const data: any = pr?.data ?? pr
  const list = Array.isArray(data?.list) ? data.list : []
  const total = Number(data?.total ?? 0)
  return { list, total }
}

const getInvoice = async (id: number): Promise<Invoice> => {
  await wait(200)
  const target = mockInvoices.value.find((item) => item.id === id)
  if (!target) {
    throw new Error('发票不存在')
  }
  return JSON.parse(JSON.stringify(target))
}

const createInvoice = async (payload: InvoicePayload): Promise<Invoice> => {
  await createFinanceInvoiceApi(payload)
  return {
    id: 0,
    documentNo: payload.documentNo,
    invoiceNo: payload.invoiceNo,
    customerName: payload.customerName,
    contractNo: payload.contractNo,
    status: payload.status,
    invoiceDate: payload.invoiceDate,
    deliveryDate: payload.deliveryDate,
    details: normalizeDetails(payload.details.map((detail) => ({ ...detail })))
  }
}

const updateInvoice = async (id: number, payload: InvoicePayload): Promise<Invoice> => {
  await wait(300)
  const index = mockInvoices.value.findIndex((item) => item.id === id)
  if (index === -1) {
    throw new Error('发票不存在')
  }
  const updated: Invoice = {
    id,
    invoiceNo: payload.invoiceNo,
    customerName: payload.customerName,
    contractNo: payload.contractNo,
    status: payload.status,
    invoiceDate: payload.invoiceDate,
    deliveryDate: payload.deliveryDate,
    details: normalizeDetails(payload.details.map((detail) => ({ ...detail })))
  }
  mockInvoices.value.splice(index, 1, updated)
  return JSON.parse(JSON.stringify(updated))
}

const removeInvoice = async (id: number): Promise<void> => {
  await wait(200)
  const index = mockInvoices.value.findIndex((item) => item.id === id)
  if (index === -1) {
    throw new Error('发票不存在')
  }
  mockInvoices.value.splice(index, 1)
}

const statusTagMap: Record<InvoiceStatus, { label: string; type: TagType }> = {
  normal: { label: '正常', type: 'success' },
  red: { label: '红冲', type: 'danger' }
}

const statusOptions = (Object.keys(statusTagMap) as InvoiceStatus[]).map((value) => ({
  value,
  label: statusTagMap[value].label
}))

const queryFormRef = ref<FormInstance>()
const queryForm = reactive<InvoiceQuery>({
  itemCode: '',
  customerName: '',
  status: '',
  invoiceDateRange: []
})

const pagination = reactive({
  page: 1,
  size: 10
})

const tableRef = ref<InstanceType<typeof ElTable>>()
const tableData = ref<InvoiceTableRow[]>([])
const total = ref(0)
const loading = ref(false)
const resolveViewModeFromRoute = () => {
  const v = route.query.view
  if (v === 'table' || v === 'timeline') return v as 'table' | 'timeline'
  return 'timeline'
}

const viewMode = ref<'table' | 'timeline'>(resolveViewModeFromRoute())
const timelineActiveInvoiceId = ref<number | null>(null)
const timelineActiveDetailKey = ref<string | null>(null)

const dialogVisible = ref(false)
const dialogTitle = ref('')
const dialogSubmitting = ref(false)
const dialogFormRef = ref<FormInstance>()
const currentInvoiceId = ref<number | null>(null)

const dialogForm = reactive<InvoicePayload>(createEmptyInvoice())

const dialogRules: FormRules<InvoicePayload> = {
  documentNo: [{ required: true, message: '单据编号不能为空', trigger: 'blur' }],
  invoiceNo: [{ required: true, message: '请输入发票号码', trigger: 'blur' }],
  customerName: [{ required: true, message: '请输入客户名称', trigger: 'blur' }]
}

const formatAmount = (value: number) => Number(value ?? 0).toFixed(2)
const formatBoolean = (value: unknown) => (Boolean(value) ? '是' : '否')

const mapInvoiceToRow = (invoice: Invoice): InvoiceTableRow => {
  const { totalAmount, totalQuantity } = calculateSummary(invoice.details)
  return {
    ...invoice,
    documentNo: invoice.documentNo || invoice.invoiceNo || '',
    totalAmount,
    totalQuantity
  }
}

interface InvoiceTimelineGroup {
  date: string
  invoices: InvoiceTableRow[]
}

const timelineGroups = computed<InvoiceTimelineGroup[]>(() => {
  const map = new Map<string, InvoiceTableRow[]>()
  const sorted = [...tableData.value].sort((a, b) => {
    const aDate = new Date(a.invoiceDate || a.deliveryDate || 0).getTime()
    const bDate = new Date(b.invoiceDate || b.deliveryDate || 0).getTime()
    return bDate - aDate
  })

  sorted.forEach((item) => {
    const key = item.invoiceDate || item.deliveryDate || '未设置日期'
    if (!map.has(key)) map.set(key, [])
    map.get(key)?.push(item)
  })

  return Array.from(map.entries()).map(([date, invoices]) => ({ date, invoices }))
})

const timelineSelectedInvoice = computed(() => {
  if (!timelineActiveInvoiceId.value) return null
  return tableData.value.find((item) => item.id === timelineActiveInvoiceId.value) || null
})

const makeTimelineDetailKey = (invoiceId: number, detail: InvoiceLine) => {
  const idPart = detail.id != null ? String(detail.id) : ''
  const codePart = detail.itemCode || ''
  return `${invoiceId}-${idPart}-${codePart}`
}

const isTimelineActiveDetail = (invoiceId: number, detail: InvoiceLine) => {
  if (!timelineActiveDetailKey.value) return false
  return timelineActiveDetailKey.value === makeTimelineDetailKey(invoiceId, detail)
}

const handleTimelineInvoiceClick = (invoice: InvoiceTableRow) => {
  timelineActiveInvoiceId.value = invoice.id
  timelineActiveDetailKey.value = null
}

const handleTimelineDetailClick = (invoice: InvoiceTableRow, detail: InvoiceLine) => {
  timelineActiveInvoiceId.value = invoice.id
  timelineActiveDetailKey.value = makeTimelineDetailKey(invoice.id, detail)
}

const timelineDetailRowClassName = ({ row }: { row: InvoiceLine }) => {
  if (!timelineSelectedInvoice.value || !timelineActiveDetailKey.value) return ''
  const key = makeTimelineDetailKey(timelineSelectedInvoice.value.id, row)
  return key === timelineActiveDetailKey.value ? 'so-view-detail-row--active' : ''
}

watch(
  () => tableData.value,
  (rows) => {
    if (!rows.length) {
      timelineActiveInvoiceId.value = null
      timelineActiveDetailKey.value = null
      return
    }
    if (
      !timelineActiveInvoiceId.value ||
      !rows.some((r) => r.id === timelineActiveInvoiceId.value)
    ) {
      timelineActiveInvoiceId.value = rows[0].id
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
    const params: ListInvoicesParams = {
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

    if (queryForm.invoiceDateRange.length === 2) {
      params.invoiceDateRange = [queryForm.invoiceDateRange[0], queryForm.invoiceDateRange[1]]
    }

    const { list, total: totalCount } = await listInvoices(params)
    tableData.value = list.map(mapInvoiceToRow)
    total.value = totalCount
    await nextTick()
    const shouldExpand = Boolean(
      params.itemCode || params.customerName || params.invoiceDateRange?.length === 2
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
  queryForm.invoiceDateRange = []
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

const assignDialogForm = (payload: InvoicePayload) => {
  dialogForm.documentNo = payload.documentNo
  dialogForm.invoiceNo = payload.invoiceNo
  dialogForm.customerName = payload.customerName
  dialogForm.contractNo = payload.contractNo
  dialogForm.status = payload.status
  dialogForm.invoiceDate = payload.invoiceDate
  dialogForm.deliveryDate = payload.deliveryDate
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
  assignDialogForm(createEmptyInvoice())
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
  const prefix = `KP-${today}-`
  let maxSeq = 0
  tableData.value.forEach((row) => {
    const no = String(row.documentNo || '')
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

const handleCreate = async () => {
  dialogTitle.value = '新增发票'
  currentInvoiceId.value = null
  resetDialogForm()
  const today = getTodayText()
  dialogForm.documentNo = generateDialogDocumentNo()
  dialogForm.deliveryDate = today
  dialogForm.invoiceDate = today
  dialogVisible.value = true
  await nextTick()
  dialogFormRef.value?.clearValidate()
}

const openEditDialog = async (id: number) => {
  try {
    const invoice = await getInvoice(id)
    const { id: _id, ...rest } = invoice
    const payload: InvoicePayload = {
      ...rest,
      documentNo: invoice.documentNo || invoice.invoiceNo || ''
    }
    dialogTitle.value = '编辑发票'
    currentInvoiceId.value = id
    assignDialogForm(payload)
    dialogVisible.value = true
    await nextTick()
    dialogFormRef.value?.clearValidate()
  } catch (error) {
    ElMessage.error((error as Error).message || '加载发票失败')
  }
}

const handleEdit = (row: InvoiceTableRow) => {
  if (readOnlyMode) {
    ElMessage.warning('当前阶段为只读模式，暂不支持编辑')
    return
  }
  void openEditDialog(row.id)
}

const handleRowDblClick = (row: InvoiceTableRow) => {
  if (readOnlyMode) {
    return
  }
  void openEditDialog(row.id)
}

const recalculateDetail = (detail: InvoiceLine) => {
  const quantity = Number(detail.quantity) || 0
  const unitPrice = Number(detail.unitPrice) || 0
  detail.quantity = quantity
  detail.unitPrice = unitPrice
  detail.amount = Number((quantity * unitPrice).toFixed(2))
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

const handleDetailQuantityChange = (detail: InvoiceLine) => {
  recalculateDetail(detail)
}

const handleDetailUnitPriceChange = (detail: InvoiceLine) => {
  recalculateDetail(detail)
}

const dialogTotals = computed(() => calculateSummary(dialogForm.details))

const cloneInvoicePayload = (source: InvoicePayload): InvoicePayload => ({
  documentNo: source.documentNo,
  invoiceNo: source.invoiceNo,
  customerName: source.customerName,
  contractNo: source.contractNo,
  status: source.status,
  invoiceDate: source.invoiceDate,
  deliveryDate: source.deliveryDate,
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

  dialogForm.details.forEach(recalculateDetail)

  if (!dialogForm.details.length) {
    ElMessage.error('请至少添加一条产品明细')
    return
  }

  const invalidDetail = dialogForm.details.find(
    (detail) => !detail.productName.trim() || detail.quantity <= 0
  )

  if (invalidDetail) {
    ElMessage.error('请完善产品名称并确保数量大于 0')
    return
  }

  const payload = cloneInvoicePayload(dialogForm)
  dialogSubmitting.value = true

  try {
    if (currentInvoiceId.value === null) {
      await createInvoice(payload)
      pagination.page = 1
      ElMessage.success('新增成功')
    } else {
      await updateInvoice(currentInvoiceId.value, payload)
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

const handleDelete = async (row: InvoiceTableRow) => {
  if (readOnlyMode) {
    ElMessage.warning('当前阶段为只读模式，暂不支持删除')
    return
  }
  try {
    await ElMessageBox.confirm(`确认删除发票 ${row.invoiceNo} 吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    await removeInvoice(row.id)
    if (tableData.value.length === 1 && pagination.page > 1) {
      pagination.page -= 1
    }
    await loadData()
    ElMessage.success('删除成功')
  } catch (error) {
    if (error === 'cancel' || error === 'close') {
      return
    }
    if (error instanceof Error) {
      ElMessage.error(error.message || '删除失败')
    }
  }
}

const handleDialogClosed = () => {
  resetDialogForm()
  currentInvoiceId.value = null
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

.view-dialog-info-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
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
