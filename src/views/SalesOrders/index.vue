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

    <div style=" display: flex;margin-top: 16px; justify-content: flex-end">
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
                class="dialog-input"
                disabled
              />
            </el-form-item>
            <el-form-item label="订单日期">
              <el-date-picker
                v-model="dialogForm.orderDate"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="请选择订单日期"
                class="dialog-date-picker"
                style="width: 252px"
              />
            </el-form-item>
          </div>
          <div class="dialog-form-column dialog-form-column--right">
            <el-form-item label="客户名称" prop="customerId">
              <el-select
                v-model="dialogForm.customerId"
                placeholder="请选择客户"
                class="dialog-input"
                filterable
                clearable
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
            <el-form-item label="签订日期">
              <el-date-picker
                v-model="dialogForm.signDate"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="请选择签订日期"
                class="dialog-date-picker"
                style="width: 252px"
              />
            </el-form-item>
            <el-form-item label="合同编号">
              <el-input
                v-model="dialogForm.contractNo"
                placeholder="请输入合同编号"
                class="dialog-input"
              />
            </el-form-item>
          </div>
        </div>

        <div class="dialog-product-section">
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
import { computed, onMounted, reactive, ref } from 'vue'
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
  type SalesOrder,
  type SalesOrderQueryParams,
  type UpdateSalesOrderPayload
} from '@/api/sales-orders'
import { getCustomerListApi, type CustomerInfo } from '@/api/customer'

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

// 查看对话框相关变量
const viewDialogVisible = ref(false)
const viewOrderData = ref<SalesOrder | null>(null)
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
  ElMessage.info('新增功能待实现')
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
      dialogForm.customerName = customer.customerName
    }
  } else {
    dialogForm.customerName = ''
    dialogForm.customerId = null
  }
}

const handleEdit = async (row: OrderTableRow) => {
  try {
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
    dialogSubmitting.value = true
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
</style>
