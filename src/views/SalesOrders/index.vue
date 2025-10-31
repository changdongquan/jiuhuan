<template>
  <div class="p-4">
    <el-form
      ref="queryFormRef"
      :model="queryForm"
      label-width="90px"
      inline
      style="margin-bottom: 16px"
    >
      <el-form-item label="综合搜索">
        <el-input
          v-model="queryForm.searchText"
          placeholder="请输入项目编号/订单编号/客户模号/产品图号/产品名称"
          clearable
          style="width: 300px"
        />
      </el-form-item>
      <el-form-item label="客户名称">
        <el-select
          v-model="queryForm.customerName"
          placeholder="请选择客户"
          clearable
          filterable
          style="width: 200px"
        >
          <el-option
            v-for="customer in customerList"
            :key="customer.id"
            :label="customer.customerName"
            :value="customer.customerName"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="合同号">
        <el-input v-model="queryForm.contractNo" placeholder="请输入合同号" clearable />
      </el-form-item>
      <el-form-item label="下单日期">
        <el-date-picker
          v-model="queryForm.orderDateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          value-format="YYYY-MM-DD"
          clearable
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="handleReset">重置</el-button>
        <el-button type="success" @click="handleCreate">新增</el-button>
      </el-form-item>
    </el-form>

    <el-table
      ref="tableRef"
      v-loading="loading"
      :data="tableData"
      border
      height="calc(100vh - 320px)"
      row-key="orderNo"
      @row-dblclick="handleRowDblClick"
      :row-class-name="rowClassName"
      @expand-change="onExpandChange"
    >
      <el-table-column type="expand">
        <template #default="{ row }">
          <div class="so-expanded-wrap">
            <el-table :data="row.details" border size="small" row-key="id" style="width: 100%">
              <el-table-column type="index" label="序号" width="50" />
              <el-table-column prop="itemCode" label="项目编号" min-width="140" />
              <el-table-column prop="productName" label="产品名称" min-width="160" />
              <el-table-column prop="productDrawingNo" label="产品图号" min-width="150" />
              <el-table-column prop="customerPartNo" label="客户模号" min-width="150" />
              <el-table-column label="数量" width="90" align="center">
                <template #default="{ row: detail }">
                  {{ detail.quantity || 0 }}
                </template>
              </el-table-column>
              <el-table-column label="单价(元)" width="120" align="right">
                <template #default="{ row: detail }">
                  {{ formatAmount(detail.unitPrice) }}
                </template>
              </el-table-column>
              <el-table-column label="总金额(元)" width="140" align="right">
                <template #default="{ row: detail }">
                  {{ formatAmount(detail.totalAmount) }}
                </template>
              </el-table-column>
              <el-table-column label="交货日期" width="140">
                <template #default="{ row: detail }">
                  {{ formatDate(detail.deliveryDate) }}
                </template>
              </el-table-column>
              <el-table-column prop="remark" label="备注" min-width="140" show-overflow-tooltip />
              <el-table-column
                prop="costSource"
                label="费用出处"
                min-width="140"
                show-overflow-tooltip
              />
              <el-table-column prop="handler" label="经办人" width="100" />
              <el-table-column label="是否入库" width="100" align="center">
                <template #default="{ row: detail }">
                  <el-tag :type="detail.isInStock ? 'success' : 'info'" size="small">
                    {{ detail.isInStock ? '是' : '否' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="是否出运" width="100" align="center">
                <template #default="{ row: detail }">
                  <el-tag :type="detail.isShipped ? 'success' : 'info'" size="small">
                    {{ detail.isShipped ? '是' : '否' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="出运日期" width="140">
                <template #default="{ row: detail }">
                  {{ formatDate(detail.shippingDate) }}
                </template>
              </el-table-column>
            </el-table>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="orderNo" label="订单编号" min-width="120" />
      <el-table-column prop="customerName" label="客户名称" min-width="176">
        <template #default="{ row }">
          {{ row.customerName || '-' }}
        </template>
      </el-table-column>
      <el-table-column prop="orderDate" label="订单日期" width="154">
        <template #default="{ row }">
          {{ formatDate(row.orderDate) }}
        </template>
      </el-table-column>
      <el-table-column prop="signDate" label="签订日期" width="154">
        <template #default="{ row }">
          {{ formatDate(row.signDate) }}
        </template>
      </el-table-column>
      <el-table-column prop="contractNo" label="合同号" min-width="140" />
      <el-table-column label="明细数量" width="100" align="center">
        <template #default="{ row }">
          {{ row.details.length }}
        </template>
      </el-table-column>
      <el-table-column label="总数量" width="100" align="center">
        <template #default="{ row }">
          {{ row.totalQuantity || 0 }}
        </template>
      </el-table-column>
      <el-table-column label="总金额(元)" width="140" align="right">
        <template #default="{ row }">
          {{ formatAmount(row.totalAmount) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" link @click="handleEdit(row)">编辑</el-button>
          <el-button type="primary" link @click="handleView(row)">查看</el-button>
          <el-button type="danger" link @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div style="display: flex; margin-top: 16px; justify-content: flex-end">
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
      @closed="handleDialogClosed"
    >
      <el-form
        ref="dialogFormRef"
        :model="dialogForm"
        :rules="dialogRules"
        label-width="auto"
        class="dialog-form-container"
      >
        <div class="dialog-form-columns">
          <div class="dialog-form-column dialog-form-column--left">
            <el-form-item label="订单编号" prop="orderNo">
              <el-input
                v-model="dialogForm.orderNo"
                placeholder="订单编号"
                disabled
                style="width: 280px"
              />
            </el-form-item>
            <el-form-item label="订单日期">
              <el-date-picker
                v-model="dialogForm.orderDate"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="请选择订单日期"
                style="width: 280px"
              />
            </el-form-item>
          </div>
          <div class="dialog-form-column dialog-form-column--right">
            <el-form-item label="客户名称" prop="customerId">
              <el-select
                v-model="dialogForm.customerId"
                placeholder="请选择客户"
                filterable
                clearable
                @change="handleCustomerChange"
                style="width: 280px"
              >
                <el-option
                  v-for="customer in customerList"
                  :key="customer.id"
                  :label="customer.customerName"
                  :value="customer.id"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="签订日期">
              <el-date-picker
                v-model="dialogForm.signDate"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="请选择签订日期"
                style="width: 280px"
              />
            </el-form-item>
            <el-form-item label="合同编号">
              <el-input
                v-model="dialogForm.contractNo"
                placeholder="请输入合同编号"
                style="width: 280px"
              />
            </el-form-item>
          </div>
        </div>

        <div class="dialog-product-section">
          <div style="margin-bottom: 12px">
            <el-button type="primary" size="small" @click="openNewProductDialog">
              从新品中选择
            </el-button>
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
            <el-table-column label="产品图号" min-width="130">
              <template #default="{ row }">
                <el-input v-model="row.productDrawingNo" placeholder="请输入产品图号" />
              </template>
            </el-table-column>
            <el-table-column label="客户模号" min-width="130">
              <template #default="{ row }">
                <el-input v-model="row.customerPartNo" placeholder="请输入客户模号" />
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
                {{ formatAmount(row.totalAmount) }}
              </template>
            </el-table-column>
            <el-table-column label="交付日期" width="150">
              <template #default="{ row }">
                <el-date-picker
                  v-model="row.deliveryDate"
                  type="date"
                  value-format="YYYY-MM-DD"
                  placeholder="请选择交付日期"
                  style="width: 130px"
                />
              </template>
            </el-table-column>
            <el-table-column label="备注" min-width="150">
              <template #default="{ row }">
                <el-input v-model="row.remark" placeholder="备注" />
              </template>
            </el-table-column>
            <el-table-column label="费用出处" min-width="145">
              <template #default="{ row }">
                <el-input v-model="row.costSource" placeholder="费用出处" />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="55" fixed="right">
              <template #default="{ $index }">
                <el-button type="danger" link @click="removeDetailRow($index)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>

          <div class="dialog-product-summary">
            <el-button type="primary" plain @click="addDetailRow">新增明细行</el-button>
            <div>
              <span class="dialog-product-summary__item"
                >产品项数：{{ dialogForm.details.length }}</span
              >
              <span class="dialog-product-summary__item"
                >总数量：{{ dialogTotals.totalQuantity }}</span
              >
              <span>总金额：{{ formatAmount(dialogTotals.totalAmount) }}</span>
            </div>
          </div>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="dialogSubmitting" @click="submitDialogForm">
          保存
        </el-button>
      </template>
    </el-dialog>

    <!-- 新品选择对话框 -->
    <el-dialog
      v-model="newProductDialogVisible"
      title="选择新品货物"
      width="1200px"
      :close-on-click-modal="false"
    >
      <div
        v-if="selectedCustomerName"
        style="
          padding: 8px;
          margin-bottom: 12px;
          background-color: #f0f9ff;
          border: 1px solid #91d5ff;
          border-radius: 4px;
        "
      >
        <span style=" font-weight: 500;color: #1890ff">
          已限制客户：{{ selectedCustomerName }}
        </span>
        <span style=" margin-left: 8px; font-size: 12px;color: #666">
          （只能选择同一客户的货物）
        </span>
      </div>
      <el-table
        ref="newProductTableRef"
        v-loading="newProductLoading"
        :data="newProductList"
        border
        @selection-change="handleProductSelectionChange"
        @select="handleProductSelect"
        max-height="500px"
        :row-class-name="getRowClassName"
      >
        <el-table-column type="selection" width="55" :selectable="checkSelectable" />
        <el-table-column prop="itemCode" label="项目编号" min-width="140">
          <template #default="{ row }">
            <span :style="{ color: isItemCodeExists(row.itemCode) ? '#999' : '#333' }">
              {{ row.itemCode || '-' }}
              <el-tag
                v-if="isItemCodeExists(row.itemCode)"
                type="info"
                size="small"
                style="margin-left: 8px"
              >
                已添加
              </el-tag>
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="productName" label="产品名称" min-width="160" />
        <el-table-column prop="productDrawingNo" label="产品图号" min-width="150" />
        <el-table-column prop="customerPartNo" label="客户模号" min-width="150" />
        <el-table-column prop="customerName" label="客户名称" min-width="160">
          <template #default="{ row }">
            <span
              :style="{ color: row.customerName === selectedCustomerName ? '#1890ff' : '#333' }"
            >
              {{ row.customerName || '-' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="category" label="分类" width="100" />
        <el-table-column prop="remarks" label="备注" min-width="140" show-overflow-tooltip />
      </el-table>
      <template #footer>
        <el-button @click="newProductDialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          @click="fillSelectedProducts"
          :disabled="selectedProducts.length === 0"
        >
          填充 ({{ selectedProducts.length }})
        </el-button>
      </template>
    </el-dialog>

    <!-- 查看对话框 -->
    <el-dialog
      v-model="viewDialogVisible"
      title="查看销售订单"
      width="1500px"
      :close-on-click-modal="false"
    >
      <div v-if="viewOrderData" class="view-dialog-container">
        <!-- 订单基本信息 -->
        <div class="view-dialog-section">
          <h3 class="view-dialog-section-title">订单基本信息</h3>
          <div class="view-dialog-info-grid">
            <div class="view-dialog-info-item">
              <span class="view-dialog-info-label">订单编号：</span>
              <span class="view-dialog-info-value">{{ viewOrderData.orderNo || '-' }}</span>
            </div>
            <div class="view-dialog-info-item">
              <span class="view-dialog-info-label">客户名称：</span>
              <span class="view-dialog-info-value">{{ viewOrderData.customerName || '-' }}</span>
            </div>
            <div class="view-dialog-info-item">
              <span class="view-dialog-info-label">订单日期：</span>
              <span class="view-dialog-info-value">{{
                formatDate(viewOrderData.orderDate) || '-'
              }}</span>
            </div>
            <div class="view-dialog-info-item">
              <span class="view-dialog-info-label">签订日期：</span>
              <span class="view-dialog-info-value">{{
                formatDate(viewOrderData.signDate) || '-'
              }}</span>
            </div>
            <div class="view-dialog-info-item">
              <span class="view-dialog-info-label">合同编号：</span>
              <span class="view-dialog-info-value">{{ viewOrderData.contractNo || '-' }}</span>
            </div>
            <div class="view-dialog-info-item">
              <span class="view-dialog-info-label">总数量：</span>
              <span class="view-dialog-info-value">{{ viewOrderData.totalQuantity || 0 }}</span>
            </div>
            <div class="view-dialog-info-item">
              <span class="view-dialog-info-label">总金额：</span>
              <span class="view-dialog-info-value">
                {{ formatAmount(viewOrderData.totalAmount) }} 元
              </span>
            </div>
          </div>
        </div>

        <!-- 订单明细 -->
        <div class="view-dialog-section">
          <h3 class="view-dialog-section-title">订单明细</h3>
          <el-table :data="viewOrderData.details" border size="small" style="width: 100%">
            <el-table-column type="index" label="序号" width="50" align="center" />
            <el-table-column prop="itemCode" label="项目编号" min-width="140" />
            <el-table-column prop="productName" label="产品名称" min-width="160" />
            <el-table-column prop="productDrawingNo" label="产品图号" min-width="150" />
            <el-table-column prop="customerPartNo" label="客户模号" min-width="150" />
            <el-table-column label="数量" width="90" align="center">
              <template #default="{ row }">
                {{ row.quantity || 0 }}
              </template>
            </el-table-column>
            <el-table-column label="单价(元)" width="120" align="right">
              <template #default="{ row }">
                {{ formatAmount(row.unitPrice) }}
              </template>
            </el-table-column>
            <el-table-column label="总金额(元)" width="140" align="right">
              <template #default="{ row }">
                {{ formatAmount(row.totalAmount) }}
              </template>
            </el-table-column>
            <el-table-column label="交货日期" width="140" align="center">
              <template #default="{ row }">
                {{ formatDate(row.deliveryDate) }}
              </template>
            </el-table-column>
            <el-table-column prop="remark" label="备注" min-width="140" show-overflow-tooltip />
            <el-table-column
              prop="costSource"
              label="费用出处"
              min-width="140"
              show-overflow-tooltip
            />
            <el-table-column prop="handler" label="经办人" width="100" />
            <el-table-column label="是否入库" width="100" align="center">
              <template #default="{ row }">
                <el-tag :type="row.isInStock ? 'success' : 'info'" size="small">
                  {{ row.isInStock ? '是' : '否' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="是否出运" width="100" align="center">
              <template #default="{ row }">
                <el-tag :type="row.isShipped ? 'success' : 'info'" size="small">
                  {{ row.isShipped ? '是' : '否' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="出运日期" width="140" align="center">
              <template #default="{ row }">
                {{ formatDate(row.shippingDate) }}
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>

      <template #footer>
        <el-button @click="viewDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, nextTick } from 'vue'
import type { FormInstance } from 'element-plus'
import {
  ElButton,
  ElDatePicker,
  ElDialog,
  ElForm,
  ElFormItem,
  ElInput,
  ElInputNumber,
  ElMessage,
  ElMessageBox,
  ElPagination,
  ElSelect,
  ElOption,
  ElTable,
  ElTableColumn,
  ElTag
} from 'element-plus'
import {
  getSalesOrdersListApi,
  getSalesOrderByOrderNoApi,
  updateSalesOrderApi,
  createSalesOrderApi,
  generateOrderNoApi,
  type SalesOrder,
  type SalesOrderQueryParams,
  type UpdateSalesOrderPayload,
  type CreateSalesOrderPayload
} from '@/api/sales-orders'
import { getCustomerListApi, type CustomerInfo } from '@/api/customer'
import { getNewProductsApi, type NewProductInfo } from '@/api/goods'

interface OrderQuery {
  searchText: string
  customerName: string
  contractNo: string
  orderDateRange: string[]
}

interface OrderTableRow extends SalesOrder {
  totalQuantity: number
  totalAmount: number
}

// 日期格式化
const formatDate = (date: string | Date | null | undefined): string => {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return ''
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const queryFormRef = ref<FormInstance>()
const queryForm = reactive<OrderQuery>({
  searchText: '',
  customerName: '',
  contractNo: '',
  orderDateRange: []
})

const pagination = reactive({
  page: 1,
  size: 10
})

const tableRef = ref<InstanceType<typeof ElTable>>()
const tableData = ref<OrderTableRow[]>([])
const total = ref(0)
const loading = ref(false)

// 对话框相关变量
const dialogVisible = ref(false)
const dialogTitle = ref('编辑销售订单')
const dialogFormRef = ref<FormInstance>()
const dialogSubmitting = ref(false)
const currentOrderNo = ref<string | null>(null)
const customerList = ref<CustomerInfo[]>([])
const isCreateMode = ref(false) // 标识是新建模式还是编辑模式

// 查看对话框相关变量
const viewDialogVisible = ref(false)
const viewOrderData = ref<SalesOrder | null>(null)

// 新品选择对话框相关变量
const newProductDialogVisible = ref(false)
const newProductList = ref<NewProductInfo[]>([])
const selectedProducts = ref<NewProductInfo[]>([])
const newProductLoading = ref(false)
const selectedCustomerName = ref<string>('')
const newProductTableRef = ref<InstanceType<typeof ElTable>>()
const dialogForm = reactive<any>({
  orderNo: '',
  orderDate: '',
  signDate: '',
  customerName: '',
  customerId: null,
  contractNo: '',
  details: []
})
const dialogRules = {}

// 记录展开的订单编号集合，用于高亮展开行
const expandedOrderNos = ref<Set<string>>(new Set())

const onExpandChange = (_row: OrderTableRow, expandedRows: OrderTableRow[]) => {
  expandedOrderNos.value = new Set(expandedRows.map((r) => r.orderNo))
}

const rowClassName = ({ row }: { row: OrderTableRow }) => {
  return expandedOrderNos.value.has(row.orderNo) ? 'so-row--expanded' : ''
}

const formatAmount = (value: number | null | undefined): string => {
  return Number(value ?? 0).toFixed(2)
}

const mapOrderToRow = (order: SalesOrder): OrderTableRow => {
  return {
    ...order,
    totalQuantity: order.totalQuantity || 0,
    totalAmount: order.totalAmount || 0
  }
}

const loadData = async () => {
  loading.value = true
  try {
    const params: SalesOrderQueryParams = {
      page: pagination.page,
      pageSize: pagination.size
    }

    // 综合搜索：支持项目编号、订单编号、客户模号、产品图号、产品名称
    if (queryForm.searchText && queryForm.searchText.trim()) {
      params.searchText = queryForm.searchText.trim()
    }

    if (queryForm.customerName && queryForm.customerName.trim()) {
      params.customerName = queryForm.customerName.trim()
    }

    if (queryForm.contractNo && queryForm.contractNo.trim()) {
      params.contractNo = queryForm.contractNo.trim()
    }

    if (queryForm.orderDateRange.length === 2) {
      params.orderDateStart = queryForm.orderDateRange[0]
      params.orderDateEnd = queryForm.orderDateRange[1]
    }

    const response = await getSalesOrdersListApi(params)

    // 统一兼容多种响应结构格式
    const raw: any = response
    const pr: any = raw?.data ?? raw // IResponse.data 或直出
    const list = pr?.data?.list ?? pr?.list ?? []
    const totalCount = pr?.data?.total ?? pr?.total ?? 0

    if (Array.isArray(list)) {
      if (list.length > 0) {
        tableData.value = list.map(mapOrderToRow)
        total.value = Number(totalCount) || 0
      } else {
        tableData.value = []
        total.value = 0
        // 没有数据，但不显示错误消息
      }
    } else {
      tableData.value = []
      total.value = 0
      ElMessage.error(pr?.message || raw?.message || '获取数据失败：响应格式错误')
    }
  } catch (error) {
    console.error('加载数据失败:', error)
    ElMessage.error('加载数据失败')
    tableData.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  pagination.page = 1
  void loadData()
}

const handleReset = () => {
  queryForm.searchText = ''
  queryForm.customerName = ''
  queryForm.contractNo = ''
  queryForm.orderDateRange = []
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

const handleCreate = async () => {
  try {
    isCreateMode.value = true
    dialogTitle.value = '新建销售订单'
    currentOrderNo.value = null

    // 如果客户列表为空，先加载客户列表
    if (customerList.value.length === 0) {
      await loadCustomerList()
    }

    // 生成新的订单编号
    loading.value = true
    const response = await generateOrderNoApi()
    const raw: any = response
    const pr: any = raw?.data ?? raw
    const newOrderNo = pr?.orderNo || ''

    if (!newOrderNo) {
      ElMessage.error('生成订单编号失败')
      return
    }

    // 初始化表单
    dialogForm.orderNo = newOrderNo
    dialogForm.orderDate = formatDate(new Date())
    dialogForm.signDate = ''
    dialogForm.customerId = null
    dialogForm.customerName = ''
    dialogForm.contractNo = ''
    dialogForm.details = []

    dialogVisible.value = true
  } catch (error) {
    console.error('打开新建对话框失败:', error)
    ElMessage.error('打开新建对话框失败')
  } finally {
    loading.value = false
  }
}

const handleView = async (row: OrderTableRow) => {
  try {
    loading.value = true

    // 加载订单完整信息
    const response = await getSalesOrderByOrderNoApi(row.orderNo)
    const raw: any = response
    const pr: any = raw?.data ?? raw
    const orderData = pr?.data ?? pr

    if (!orderData) {
      ElMessage.error('获取订单信息失败')
      return
    }

    // 设置查看数据
    viewOrderData.value = {
      orderNo: orderData.orderNo || '',
      customerId: orderData.customerId || null,
      customerName: orderData.customerName || '',
      orderDate: orderData.orderDate ? formatDate(orderData.orderDate) : '',
      signDate: orderData.signDate ? formatDate(orderData.signDate) : '',
      contractNo: orderData.contractNo || '',
      totalQuantity: orderData.totalQuantity || 0,
      totalAmount: orderData.totalAmount || 0,
      details: (orderData.details || []).map((detail: any) => ({
        id: detail.id,
        itemCode: detail.itemCode || '',
        productName: detail.productName || '',
        productDrawingNo: detail.productDrawingNo || '',
        customerPartNo: detail.customerPartNo || '',
        quantity: detail.quantity || 0,
        unitPrice: detail.unitPrice || 0,
        totalAmount: detail.totalAmount || 0,
        deliveryDate: detail.deliveryDate ? formatDate(detail.deliveryDate) : null,
        remark: detail.remark || '',
        costSource: detail.costSource || '',
        handler: detail.handler || '',
        isInStock: detail.isInStock || false,
        isShipped: detail.isShipped || false,
        shippingDate: detail.shippingDate ? formatDate(detail.shippingDate) : null
      }))
    }

    viewDialogVisible.value = true
  } catch (error) {
    console.error('加载订单信息失败:', error)
    ElMessage.error('加载订单信息失败')
  } finally {
    loading.value = false
  }
}

// 加载客户列表
const loadCustomerList = async () => {
  try {
    const response = await getCustomerListApi({ pageSize: 1000, status: 'active' })
    const raw: any = response
    const pr: any = raw?.data ?? raw
    const list = pr?.data?.list ?? pr?.list ?? []
    customerList.value = list.filter((c: CustomerInfo) => c.status === 'active')
  } catch (error) {
    console.error('加载客户列表失败:', error)
    customerList.value = []
  }
}

// 客户选择变化时的处理
const handleCustomerChange = (customerId: number | null) => {
  if (customerId) {
    const customer = customerList.value.find((c) => c.id === customerId)
    if (customer) {
      // 检查是否已有明细，如果有明细需要验证客户是否一致
      if (dialogForm.details.length > 0) {
        ElMessage.warning('更改客户将清空已添加的明细，请谨慎操作')
        // 可选：清空明细
        // dialogForm.details = []
      }
      dialogForm.customerName = customer.customerName
    }
  } else {
    dialogForm.customerName = ''
    dialogForm.customerId = null
  }
}

const handleEdit = async (row: OrderTableRow) => {
  try {
    isCreateMode.value = false
    currentOrderNo.value = row.orderNo
    dialogTitle.value = `编辑销售订单 - ${row.orderNo}`
    loading.value = true

    // 如果客户列表为空，先加载客户列表
    if (customerList.value.length === 0) {
      await loadCustomerList()
    }

    // 加载订单完整信息
    const response = await getSalesOrderByOrderNoApi(row.orderNo)
    const raw: any = response
    const pr: any = raw?.data ?? raw
    const orderData = pr?.data ?? pr

    if (!orderData) {
      ElMessage.error('获取订单信息失败')
      return
    }

    // 填充表单数据
    dialogForm.orderNo = orderData.orderNo || ''
    dialogForm.orderDate = orderData.orderDate ? formatDate(orderData.orderDate) : ''
    dialogForm.signDate = orderData.signDate ? formatDate(orderData.signDate) : ''
    dialogForm.customerId = orderData.customerId || null
    dialogForm.customerName = orderData.customerName || ''
    dialogForm.contractNo = orderData.contractNo || ''

    // 填充明细数据
    dialogForm.details = (orderData.details || []).map((detail: any) => ({
      id: detail.id,
      itemCode: detail.itemCode || '',
      productName: detail.productName || '',
      productDrawingNo: detail.productDrawingNo || '',
      customerPartNo: detail.customerPartNo || '',
      quantity: detail.quantity || 0,
      unitPrice: detail.unitPrice || 0,
      totalAmount: detail.totalAmount || 0,
      deliveryDate: detail.deliveryDate ? formatDate(detail.deliveryDate) : null,
      remark: detail.remark || '',
      costSource: detail.costSource || '',
      handler: detail.handler || '',
      isInStock: detail.isInStock || false,
      isShipped: detail.isShipped || false,
      shippingDate: detail.shippingDate ? formatDate(detail.shippingDate) : null
    }))

    dialogVisible.value = true
  } catch (error) {
    console.error('加载订单信息失败:', error)
    ElMessage.error('加载订单信息失败')
  } finally {
    loading.value = false
  }
}

const handleRowDblClick = (row: OrderTableRow) => {
  // 双击打开编辑对话框
  void handleEdit(row)
}

const handleDelete = async (row: OrderTableRow) => {
  try {
    await ElMessageBox.confirm(`确定删除订单 ${row.orderNo} 吗？`, '提示', {
      type: 'warning'
    })
    ElMessage.info('删除功能待实现')
  } catch (err) {
    // 用户取消，无需处理
  }
}

// 计算对话框内的合计
const dialogTotals = computed(() => {
  const totalQuantity = (dialogForm.details || []).reduce(
    (sum: number, d: any) => sum + Number(d.quantity || 0),
    0
  )
  const totalAmount = (dialogForm.details || []).reduce(
    (sum: number, d: any) => sum + Number(d.totalAmount || 0),
    0
  )
  return { totalQuantity, totalAmount }
})

const recalcDetailAmount = (detail: any) => {
  const quantity = Number(detail.quantity || 0)
  const unitPrice = Number(detail.unitPrice || 0)
  detail.totalAmount = Number((quantity * unitPrice).toFixed(2))
}

const handleDetailQuantityChange = (detail: any) => {
  recalcDetailAmount(detail)
}

const handleDetailUnitPriceChange = (detail: any) => {
  recalcDetailAmount(detail)
}

const addDetailRow = () => {
  dialogForm.details.push({
    id: Date.now(),
    itemCode: '',
    productName: '',
    productDrawingNo: '',
    customerPartNo: '',
    quantity: 0,
    unitPrice: 0,
    totalAmount: 0,
    deliveryDate: null,
    remark: '',
    costSource: '',
    handler: '',
    isInStock: false,
    isShipped: false,
    shippingDate: null
  })
}

const removeDetailRow = (index: number) => {
  dialogForm.details.splice(index, 1)
}

const submitDialogForm = async () => {
  try {
    if (!dialogForm.orderNo) {
      ElMessage.error('订单编号不能为空')
      return
    }

    if (!dialogForm.customerId) {
      ElMessage.error('请选择客户')
      return
    }

    if (!dialogForm.details || dialogForm.details.length === 0) {
      ElMessage.error('请至少添加一条订单明细')
      return
    }

    // 验证明细行数量必填
    const emptyQuantityRows: number[] = []
    dialogForm.details.forEach((detail: any, index: number) => {
      if (!detail.quantity || detail.quantity <= 0) {
        emptyQuantityRows.push(index + 1)
      }
    })

    if (emptyQuantityRows.length > 0) {
      ElMessage.error(`第 ${emptyQuantityRows.join('、')} 行的数量不能为空或小于等于0`)
      return
    }

    dialogSubmitting.value = true

    if (isCreateMode.value) {
      // 新建模式
      const payload: CreateSalesOrderPayload = {
        orderNo: dialogForm.orderNo,
        orderDate: dialogForm.orderDate || undefined,
        signDate: dialogForm.signDate || undefined,
        contractNo: dialogForm.contractNo || undefined,
        customerId: dialogForm.customerId,
        details: dialogForm.details.map((d: any) => ({
          itemCode: d.itemCode || undefined,
          deliveryDate: d.deliveryDate || null,
          totalAmount: Number(d.totalAmount || 0),
          unitPrice: Number(d.unitPrice || 0),
          quantity: Number(d.quantity || 0),
          remark: d.remark || null,
          costSource: d.costSource || null,
          handler: d.handler || null,
          isInStock: !!d.isInStock,
          isShipped: !!d.isShipped,
          shippingDate: d.shippingDate || null
        }))
      }

      const resp = await createSalesOrderApi(payload)
      const raw: any = resp
      const pr: any = raw?.data ?? raw
      const success = pr?.success ?? pr?.code === 0
      if (success) {
        ElMessage.success(pr?.message || '创建成功')
        dialogVisible.value = false
        await loadData()
      } else {
        ElMessage.error(pr?.message || '创建失败')
      }
    } else {
      // 编辑模式
      const payload: UpdateSalesOrderPayload = {
        orderNo: dialogForm.orderNo,
        orderDate: dialogForm.orderDate || undefined,
        signDate: dialogForm.signDate || undefined,
        contractNo: dialogForm.contractNo || undefined,
        customerId: dialogForm.customerId || undefined,
        details: dialogForm.details.map((d: any) => ({
          id: d.id,
          itemCode: d.itemCode || undefined,
          deliveryDate: d.deliveryDate || null,
          totalAmount: Number(d.totalAmount || 0),
          unitPrice: Number(d.unitPrice || 0),
          quantity: Number(d.quantity || 0),
          remark: d.remark || null,
          costSource: d.costSource || null,
          handler: d.handler || null,
          isInStock: !!d.isInStock,
          isShipped: !!d.isShipped,
          shippingDate: d.shippingDate || null
        }))
      }

      const resp = await updateSalesOrderApi(payload)
      const raw: any = resp
      const pr: any = raw?.data ?? raw
      const success = pr?.success ?? pr?.code === 0
      if (success) {
        ElMessage.success(pr?.message || '保存成功')
        dialogVisible.value = false
        await loadData()
      } else {
        ElMessage.error(pr?.message || '保存失败')
      }
    }
  } catch (error) {
    console.error('保存失败:', error)
    ElMessage.error('保存失败')
  } finally {
    dialogSubmitting.value = false
  }
}

const handleDialogClosed = () => {
  dialogForm.orderNo = ''
  dialogForm.orderDate = ''
  dialogForm.signDate = ''
  dialogForm.customerId = null
  dialogForm.customerName = ''
  dialogForm.contractNo = ''
  dialogForm.details = []
  isCreateMode.value = false
  currentOrderNo.value = null
}

// 打开新品选择对话框
const openNewProductDialog = async () => {
  try {
    newProductLoading.value = true
    newProductDialogVisible.value = true
    selectedProducts.value = []

    // 检查订单是否已经选择了客户
    let orderCustomerName = ''
    if (dialogForm.customerId) {
      // 从客户列表中获取客户名称
      const customer = customerList.value.find((c) => c.id === dialogForm.customerId)
      if (customer) {
        orderCustomerName = customer.customerName
        selectedCustomerName.value = orderCustomerName
        ElMessage.info(`订单已选择客户"${orderCustomerName}"，只能选择该客户的货物`)
      }
    } else {
      // 检查明细中是否已有货物（可能是手动输入的）
      // 如果有明细，尝试从货物信息中获取客户
      if (dialogForm.details.length > 0) {
        // 从第一个明细的项目编号查找对应的客户
        const firstDetail = dialogForm.details[0]
        if (firstDetail.itemCode) {
          // 暂时清空限制，后续可以通过itemCode查询
          selectedCustomerName.value = ''
        }
      } else {
        selectedCustomerName.value = ''
      }
    }

    const response = await getNewProductsApi()
    const raw: any = response
    const pr: any = raw?.data ?? raw
    const list = pr?.list ?? []

    newProductList.value = list

    // 如果有客户限制，过滤列表
    if (orderCustomerName && list.length > 0) {
      const filteredList = list.filter((item) => item.customerName === orderCustomerName)
      if (filteredList.length === 0) {
        ElMessage.warning(`没有客户"${orderCustomerName}"的新品货物`)
      }
    }

    if (list.length === 0) {
      ElMessage.info('暂无新品货物')
    }
  } catch (error) {
    console.error('加载新品货物列表失败:', error)
    ElMessage.error('加载新品货物列表失败')
  } finally {
    newProductLoading.value = false
  }
}

// 检查项目编号是否已存在于明细中
const isItemCodeExists = (itemCode: string) => {
  if (!itemCode || !itemCode.trim()) return false
  return dialogForm.details.some((d: any) => d.itemCode === itemCode)
}

// 检查行是否可选
const checkSelectable = (row: NewProductInfo) => {
  // 如果项目编号已存在，不可选
  if (isItemCodeExists(row.itemCode)) {
    return false
  }
  // 如果还没有选择任何客户，所有行都可选
  if (!selectedCustomerName.value) {
    return true
  }
  // 如果已选择客户，只有同一客户的行可选
  return row.customerName === selectedCustomerName.value
}

// 获取行的class名称（用于样式）
const getRowClassName = ({ row }: { row: NewProductInfo }) => {
  if (isItemCodeExists(row.itemCode)) {
    return 'row-disabled'
  }
  return ''
}

// 处理单行选择
const handleProductSelect = (selection: NewProductInfo[], row: NewProductInfo) => {
  const isSelecting = selection.some((item) => item.id === row.id)

  if (isSelecting) {
    // 正在选择这一行
    if (!selectedCustomerName.value) {
      // 第一次选择，记录客户名称
      selectedCustomerName.value = row.customerName || ''
    } else if (row.customerName !== selectedCustomerName.value) {
      // 尝试选择不同客户的产品，阻止并提示
      ElMessage.warning(`只能选择客户"${selectedCustomerName.value}"的货物`)
      // 从选择中移除这个产品
      const index = selection.findIndex((item) => item.id === row.id)
      if (index > -1) {
        selection.splice(index, 1)
      }
      return
    }
  }
}

// 处理新品选择变化
const handleProductSelectionChange = async (selection: NewProductInfo[]) => {
  // 检查是否所有选中的产品都是同一个客户
  if (selection.length > 0) {
    const firstCustomer = selection[0].customerName
    const allSameCustomer = selection.every((item) => item.customerName === firstCustomer)

    if (!allSameCustomer) {
      // 如果有不同客户的产品，过滤掉不同客户的产品
      ElMessage.warning(`只能选择同一个客户的货物`)

      // 保留符合条件的产品
      const validSelection = selection.filter((item) => {
        return !selectedCustomerName.value || item.customerName === selectedCustomerName.value
      })

      // 更新表格选择状态
      await nextTick()
      if (newProductTableRef.value) {
        newProductTableRef.value.clearSelection()
        validSelection.forEach((row) => {
          newProductTableRef.value?.toggleRowSelection(row, true)
        })
      }

      selectedProducts.value = validSelection
      return
    }

    // 更新已选客户
    if (!selectedCustomerName.value) {
      selectedCustomerName.value = firstCustomer || ''
    }

    selectedProducts.value = selection
  } else {
    // 如果取消所有选择，清空客户名称限制
    selectedCustomerName.value = ''
    selectedProducts.value = []
  }
}

// 填充选中的产品到明细行
const fillSelectedProducts = () => {
  if (selectedProducts.value.length === 0) {
    ElMessage.warning('请先选择需要添加的产品')
    return
  }

  // 最终验证：确保所有选中产品都是同一个客户
  const customerName = selectedProducts.value[0]?.customerName
  const allSameCustomer = selectedProducts.value.every((item) => item.customerName === customerName)

  if (!allSameCustomer) {
    ElMessage.error('选中的产品必须是同一个客户，请重新选择')
    return
  }

  // 检查订单是否已经有客户，并且是否与选中产品的客户一致
  if (dialogForm.customerId) {
    const orderCustomer = customerList.value.find((c) => c.id === dialogForm.customerId)
    if (orderCustomer && orderCustomer.customerName !== customerName) {
      ElMessage.error(`订单已选择客户"${orderCustomer.customerName}"，不能添加其他客户的货物`)
      return
    }
  }

  // 检查明细中已有货物的客户（通过已填充的货物推断）
  if (dialogForm.details.length > 0) {
    // 如果订单已经有客户，检查是否一致
    if (dialogForm.customerId) {
      const orderCustomer = customerList.value.find((c) => c.id === dialogForm.customerId)
      if (orderCustomer && orderCustomer.customerName !== customerName) {
        ElMessage.error(
          `订单中已有客户"${orderCustomer.customerName}"的货物，不能添加其他客户的货物`
        )
        return
      }
    }
  }

  // 获取现有明细中的所有项目编号
  const existingItemCodes = new Set(
    dialogForm.details.map((d: any) => d.itemCode).filter((code: string) => code && code.trim())
  )

  // 检查要添加的产品中是否有重复的项目编号
  const duplicateProducts: string[] = []
  const validProducts: NewProductInfo[] = []

  selectedProducts.value.forEach((product) => {
    if (product.itemCode && existingItemCodes.has(product.itemCode)) {
      duplicateProducts.push(product.itemCode)
    } else {
      validProducts.push(product)
    }
  })

  // 如果有重复的项目编号，提示用户
  if (duplicateProducts.length > 0) {
    ElMessage.warning(`以下项目编号已存在，已自动跳过：${duplicateProducts.join('、')}`)
  }

  // 如果没有可添加的产品
  if (validProducts.length === 0) {
    ElMessage.error('所选产品的项目编号都已存在，无法添加')
    return
  }

  // 自动填充客户信息
  if (customerName && !dialogForm.customerId) {
    // 根据客户名称查找客户ID
    const customer = customerList.value.find((c) => c.customerName === customerName)
    if (customer) {
      dialogForm.customerId = customer.id
      dialogForm.customerName = customer.customerName
      ElMessage.success(`已自动选择客户：${customerName}`)
    }
  }

  // 将有效的产品添加到明细列表
  validProducts.forEach((product) => {
    dialogForm.details.push({
      id: Date.now() + Math.random(), // 生成唯一ID
      itemCode: product.itemCode || '',
      productName: product.productName || '',
      productDrawingNo: product.productDrawingNo || '',
      customerPartNo: product.customerPartNo || '',
      quantity: 0,
      unitPrice: 0,
      totalAmount: 0,
      deliveryDate: null,
      remark: product.remarks || '',
      costSource: '',
      handler: '',
      isInStock: false,
      isShipped: false,
      shippingDate: null
    })
  })

  if (validProducts.length > 0) {
    ElMessage.success(`已添加 ${validProducts.length} 条明细`)
  }

  newProductDialogVisible.value = false
  selectedProducts.value = []
  // 注意：不清空 selectedCustomerName，因为订单的客户已确定
}

onMounted(async () => {
  await Promise.all([loadCustomerList(), loadData()])
})
</script>

<style scoped>
.so-row--expanded {
  background-color: #f0f2f5 !important;
}

:deep(.el-table__expanded-cell) .so-expanded-wrap {
  padding: 8px;
  background-color: #eef1f6 !important;
}

/* 展开行内明细表表头背景色 */
:deep(.so-expanded-wrap) .el-table__header-wrapper th {
  color: #333;
  background-color: #e6ebf3 !important;
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
  margin-top: 12px;
}

.dialog-product-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 8px;
}

.dialog-product-summary__item {
  margin-right: 16px;
}

.view-dialog-section {
  margin-bottom: 16px;
}

.view-dialog-section-title {
  margin: 0 0 8px;
  font-size: 14px;
}

.view-dialog-info-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px 16px;
}

.view-dialog-info-label {
  color: #666;
}

/* 新品选择对话框 - 已添加的行样式 */
:deep(.row-disabled) {
  color: #999 !important;
  background-color: #f5f5f5 !important;
}

:deep(.row-disabled):hover {
  background-color: #f5f5f5 !important;
}
</style>
