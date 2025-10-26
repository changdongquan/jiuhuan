<template>
  <div class="p-4">
    <el-form
      ref="queryFormRef"
      :model="queryForm"
      label-width="90px"
      inline
      style="margin-bottom: 16px"
    >
      <el-form-item label="项目编号">
        <el-input v-model="queryForm.itemCode" placeholder="请输入项目编号" clearable />
      </el-form-item>
      <el-form-item label="客户名称">
        <el-input v-model="queryForm.customerName" placeholder="请输入客户名称" clearable />
      </el-form-item>
      <el-form-item label="订单状态">
        <el-select
          v-model="queryForm.status"
          placeholder="请选择状态"
          clearable
          style="width: 160px"
        >
          <el-option
            v-for="item in statusOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
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
      row-key="id"
      @row-dblclick="handleRowDblClick"
    >
      <el-table-column type="expand">
        <template #default="{ row }">
          <el-table :data="row.details" border size="small" row-key="id" style="width: 100%">
            <el-table-column type="index" label="序号" width="50" />
            <el-table-column prop="itemCode" label="项目编号" min-width="140" />
            <el-table-column prop="productName" label="产品名称" min-width="160" />
            <el-table-column prop="productDrawingNo" label="产品图号" min-width="150" />
            <el-table-column prop="customerPartNo" label="客户模号" min-width="150" />
            <el-table-column label="数量" width="90" align="center">
              <template #default="{ row: detail }">
                {{ detail.quantity }}
              </template>
            </el-table-column>
            <el-table-column label="单价(元)" width="120" align="right">
              <template #default="{ row: detail }">
                {{ formatAmount(detail.unitPrice) }}
              </template>
            </el-table-column>
            <el-table-column label="金额(元)" width="140" align="right">
              <template #default="{ row: detail }">
                {{ formatAmount(detail.amount) }}
              </template>
            </el-table-column>
            <el-table-column prop="deliveryDate" label="交付日期" width="140" />
            <el-table-column prop="remark" label="备注" min-width="140" show-overflow-tooltip />
            <el-table-column
              prop="costSource"
              label="费用出处"
              min-width="140"
              show-overflow-tooltip
            />
          </el-table>
        </template>
      </el-table-column>
      <el-table-column prop="orderNo" label="订单编号" min-width="140" />
      <el-table-column prop="customerName" label="客户名称" min-width="160" />
      <el-table-column label="产品项数" width="100" align="center">
        <template #default="{ row }">
          {{ row.details.length }}
        </template>
      </el-table-column>
      <el-table-column label="总数量" width="100" align="center">
        <template #default="{ row }">
          {{ row.totalQuantity }}
        </template>
      </el-table-column>
      <el-table-column label="总金额" width="140" align="right">
        <template #default="{ row }">
          {{ formatAmount(row.totalAmount) }}
        </template>
      </el-table-column>
      <el-table-column label="订单状态" width="120" align="center">
        <template #default="{ row }">
          <el-tag :type="statusTagMap[row.status].type">
            {{ statusTagMap[row.status].label }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="orderDate" label="下单日期" width="140" />
      <el-table-column prop="contractNo" label="合同编号" width="140" />
      <el-table-column label="操作" width="160" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" link @click="handleEdit(row)">编辑</el-button>
          <el-button type="danger" link @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div style="margin-top: 16px; display: flex; justify-content: flex-end">
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
                placeholder="请输入订单编号"
                class="dialog-input"
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
            <el-form-item label="订单状态" class="dialog-status-item">
              <el-select v-model="dialogForm.status" placeholder="请选择状态" class="dialog-input">
                <el-option
                  v-for="item in statusOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
          </div>
          <div class="dialog-form-column dialog-form-column--right">
            <el-form-item label="客户名称" prop="customerName">
              <el-input
                v-model="dialogForm.customerName"
                placeholder="请输入客户名称"
                class="dialog-input"
              />
            </el-form-item>
            <el-form-item label="签订日期">
              <el-date-picker
                v-model="dialogForm.deliveryDate"
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
                {{ formatAmount(row.amount) }}
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
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
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
  ElOption,
  ElPagination,
  ElSelect,
  ElTable,
  ElTableColumn,
  ElTag
} from 'element-plus'

type OrderStatus = 'open' | 'closed'

interface OrderDetail {
  id: number
  itemCode: string
  productName: string
  productDrawingNo: string
  customerPartNo: string
  quantity: number
  unitPrice: number
  amount: number
  deliveryDate: string
  remark: string
  costSource: string
}

interface Order {
  id: number
  orderNo: string
  customerName: string
  contractNo: string
  status: OrderStatus
  orderDate: string
  deliveryDate: string
  details: OrderDetail[]
}

interface OrderQuery {
  itemCode: string
  customerName: string
  status: '' | OrderStatus
  orderDateRange: string[]
}

interface ListOrdersParams {
  page: number
  size: number
  itemCode?: string
  customerName?: string
  status?: OrderStatus
  orderDateRange?: [string, string]
}

interface PaginatedOrders {
  list: Order[]
  total: number
}

interface OrderTableRow extends Order {
  totalQuantity: number
  totalAmount: number
}

type OrderPayload = Omit<Order, 'id'>

const mockOrders = ref<Order[]>([
  {
    id: 1,
    orderNo: 'SO202401',
    customerName: 'Acme Corp',
    contractNo: 'HT2024-001',
    status: 'open',
    orderDate: '2024-01-05',
    deliveryDate: '2024-01-22',
    details: [
      {
        id: 1,
        itemCode: 'JH01-25-796',
        productName: '工业空调',
        productDrawingNo: 'AC-001',
        customerPartNo: 'ML01250482',
        quantity: 2,
        unitPrice: 15800.5,
        amount: 31601,
        deliveryDate: '2024-01-18',
        remark: '首批交付',
        costSource: '工程预算'
      },
      {
        id: 2,
        itemCode: 'JH01-25-797',
        productName: '空调控制器',
        productDrawingNo: 'AC-CTRL-01',
        customerPartNo: 'ML01250483',
        quantity: 4,
        unitPrice: 3800,
        amount: 15200,
        deliveryDate: '2024-01-22',
        remark: '',
        costSource: '工程预算'
      }
    ]
  },
  {
    id: 2,
    orderNo: 'SO202402',
    customerName: '凌峰电子',
    contractNo: 'HT2024-002',
    status: 'open',
    orderDate: '2024-02-02',
    deliveryDate: '2024-02-28',
    details: [
      {
        id: 3,
        itemCode: 'JH01-25-798',
        productName: '高性能服务器',
        productDrawingNo: 'SRV-X900',
        customerPartNo: 'ML01250484',
        quantity: 2,
        unitPrice: 32000,
        amount: 64000,
        deliveryDate: '2024-02-20',
        remark: '需预装系统',
        costSource: '项目A'
      },
      {
        id: 4,
        itemCode: 'JH01-25-799',
        productName: '存储扩展柜',
        productDrawingNo: 'ST-BOX-04',
        customerPartNo: 'ML01250485',
        quantity: 1,
        unitPrice: 18500,
        amount: 18500,
        deliveryDate: '2024-02-28',
        remark: '',
        costSource: '项目A'
      }
    ]
  },
  {
    id: 3,
    orderNo: 'SO202403',
    customerName: '星辰工业',
    contractNo: 'HT2024-003',
    status: 'closed',
    orderDate: '2024-03-10',
    deliveryDate: '2024-04-05',
    details: [
      {
        id: 5,
        itemCode: 'JH01-25-800',
        productName: '智能传感器',
        productDrawingNo: 'SS-200',
        customerPartNo: 'ML01250486',
        quantity: 120,
        unitPrice: 380,
        amount: 45600,
        deliveryDate: '2024-03-25',
        remark: '按批次发货',
        costSource: '项目B'
      }
    ]
  }
])

const detailIdSeed = ref(
  (() => {
    const ids = mockOrders.value.flatMap((order) => order.details.map((detail) => detail.id))
    return (ids.length ? Math.max(...ids) : 0) + 1
  })()
)

const createDetailId = () => detailIdSeed.value++

const createEmptyDetail = (): OrderDetail => ({
  id: createDetailId(),
  itemCode: '',
  productName: '',
  productDrawingNo: '',
  customerPartNo: '',
  quantity: 1,
  unitPrice: 0,
  amount: 0,
  deliveryDate: '',
  remark: '',
  costSource: ''
})

const createEmptyOrder = (): OrderPayload => ({
  orderNo: '',
  customerName: '',
  contractNo: '',
  status: 'open',
  orderDate: '',
  deliveryDate: '',
  details: [createEmptyDetail()]
})

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, ms)
  })

const normalizeDetails = (details: OrderDetail[]): OrderDetail[] =>
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

const calculateSummary = (details: OrderDetail[]) =>
  details.reduce(
    (acc, item) => {
      acc.totalQuantity += item.quantity
      acc.totalAmount += item.amount
      return acc
    },
    { totalQuantity: 0, totalAmount: 0 }
  )

const listOrders = async (params: ListOrdersParams): Promise<PaginatedOrders> => {
  await wait(300)
  const { page, size, itemCode, customerName, status, orderDateRange } = params

  let filtered = [...mockOrders.value]

  if (itemCode) {
    const value = itemCode.trim().toLowerCase()
    filtered = filtered.filter((order) =>
      order.details.some((detail) => {
        const code = detail.itemCode ? detail.itemCode.toLowerCase() : ''
        return code.includes(value)
      })
    )
  }

  if (customerName) {
    const value = customerName.trim().toLowerCase()
    filtered = filtered.filter((item) => item.customerName.toLowerCase().includes(value))
  }

  if (status) {
    filtered = filtered.filter((item) => item.status === status)
  }

  if (orderDateRange && orderDateRange.length === 2) {
    const [start, end] = orderDateRange
    filtered = filtered.filter((item) => item.orderDate >= start && item.orderDate <= end)
  }

  const startIndex = (page - 1) * size
  const list = filtered.slice(startIndex, startIndex + size)

  return {
    list,
    total: filtered.length
  }
}

const getOrder = async (id: number): Promise<Order> => {
  await wait(200)
  const target = mockOrders.value.find((item) => item.id === id)
  if (!target) {
    throw new Error('订单不存在')
  }
  return JSON.parse(JSON.stringify(target))
}

const createOrder = async (payload: OrderPayload): Promise<Order> => {
  await wait(300)
  const nextId =
    mockOrders.value.length > 0 ? Math.max(...mockOrders.value.map((item) => item.id)) + 1 : 1
  const orderToSave: Order = {
    id: nextId,
    orderNo: payload.orderNo,
    customerName: payload.customerName,
    contractNo: payload.contractNo,
    status: payload.status,
    orderDate: payload.orderDate,
    deliveryDate: payload.deliveryDate,
    details: normalizeDetails(payload.details.map((detail) => ({ ...detail })))
  }
  mockOrders.value.unshift(orderToSave)
  return JSON.parse(JSON.stringify(orderToSave))
}

const updateOrder = async (id: number, payload: OrderPayload): Promise<Order> => {
  await wait(300)
  const index = mockOrders.value.findIndex((item) => item.id === id)
  if (index === -1) {
    throw new Error('订单不存在')
  }
  const updated: Order = {
    id,
    orderNo: payload.orderNo,
    customerName: payload.customerName,
    contractNo: payload.contractNo,
    status: payload.status,
    orderDate: payload.orderDate,
    deliveryDate: payload.deliveryDate,
    details: normalizeDetails(payload.details.map((detail) => ({ ...detail })))
  }
  mockOrders.value.splice(index, 1, updated)
  return JSON.parse(JSON.stringify(updated))
}

const removeOrder = async (id: number): Promise<void> => {
  await wait(200)
  const index = mockOrders.value.findIndex((item) => item.id === id)
  if (index === -1) {
    throw new Error('订单不存在')
  }
  mockOrders.value.splice(index, 1)
}

const statusTagMap: Record<OrderStatus, { label: string; type: string }> = {
  open: { label: '开放', type: 'success' },
  closed: { label: '已关闭', type: 'info' }
}

const statusOptions = (Object.keys(statusTagMap) as OrderStatus[]).map((value) => ({
  value,
  label: statusTagMap[value].label
}))

const queryFormRef = ref<FormInstance>()
const queryForm = reactive<OrderQuery>({
  itemCode: '',
  customerName: '',
  status: 'open',
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

const dialogVisible = ref(false)
const dialogTitle = ref('')
const dialogSubmitting = ref(false)
const dialogFormRef = ref<FormInstance>()
const currentOrderId = ref<number | null>(null)

const dialogForm = reactive<OrderPayload>(createEmptyOrder())

const dialogRules: FormRules<OrderPayload> = {
  orderNo: [{ required: true, message: '请输入订单编号', trigger: 'blur' }],
  customerName: [{ required: true, message: '请输入客户名称', trigger: 'blur' }]
}

const formatAmount = (value: number) => Number(value ?? 0).toFixed(2)

const mapOrderToRow = (order: Order): OrderTableRow => {
  const { totalAmount, totalQuantity } = calculateSummary(order.details)
  return {
    ...order,
    totalAmount,
    totalQuantity
  }
}

const loadData = async () => {
  loading.value = true
  try {
    const params: ListOrdersParams = {
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

    if (queryForm.orderDateRange.length === 2) {
      params.orderDateRange = [queryForm.orderDateRange[0], queryForm.orderDateRange[1]]
    }

    const { list, total: totalCount } = await listOrders(params)
    tableData.value = list.map(mapOrderToRow)
    total.value = totalCount
    await nextTick()
    const shouldExpand = Boolean(
      params.itemCode || params.customerName || params.orderDateRange?.length === 2
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
  queryForm.status = 'open'
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

const assignDialogForm = (payload: OrderPayload) => {
  dialogForm.orderNo = payload.orderNo
  dialogForm.customerName = payload.customerName
  dialogForm.contractNo = payload.contractNo
  dialogForm.status = payload.status
  dialogForm.orderDate = payload.orderDate
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
  assignDialogForm(createEmptyOrder())
}

const handleCreate = async () => {
  dialogTitle.value = '新增订单'
  currentOrderId.value = null
  resetDialogForm()
  dialogVisible.value = true
  await nextTick()
  dialogFormRef.value?.clearValidate()
}

const openEditDialog = async (id: number) => {
  try {
    const order = await getOrder(id)
    const { id: _id, ...payload } = order
    dialogTitle.value = '编辑订单'
    currentOrderId.value = id
    assignDialogForm(payload)
    dialogVisible.value = true
    await nextTick()
    dialogFormRef.value?.clearValidate()
  } catch (error) {
    ElMessage.error((error as Error).message || '加载订单失败')
  }
}

const handleEdit = (row: OrderTableRow) => {
  void openEditDialog(row.id)
}

const handleRowDblClick = (row: OrderTableRow) => {
  void openEditDialog(row.id)
}

const recalculateDetail = (detail: OrderDetail) => {
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

const handleDetailQuantityChange = (detail: OrderDetail) => {
  recalculateDetail(detail)
}

const handleDetailUnitPriceChange = (detail: OrderDetail) => {
  recalculateDetail(detail)
}

const dialogTotals = computed(() => calculateSummary(dialogForm.details))

const cloneOrderPayload = (source: OrderPayload): OrderPayload => ({
  orderNo: source.orderNo,
  customerName: source.customerName,
  contractNo: source.contractNo,
  status: source.status,
  orderDate: source.orderDate,
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

  const payload = cloneOrderPayload(dialogForm)
  dialogSubmitting.value = true

  try {
    if (currentOrderId.value === null) {
      await createOrder(payload)
      pagination.page = 1
      ElMessage.success('新增成功')
    } else {
      await updateOrder(currentOrderId.value, payload)
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

const handleDelete = async (row: OrderTableRow) => {
  try {
    await ElMessageBox.confirm(`确认删除订单 ${row.orderNo} 吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    await removeOrder(row.id)
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
  currentOrderId.value = null
  dialogFormRef.value?.clearValidate()
}

onMounted(() => {
  void loadData()
})
</script>

<style scoped>
.dialog-form-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.dialog-form-columns {
  display: flex;
  gap: 38px;
  width: 100%;
}

.dialog-form-column {
  display: flex;
  flex-direction: column;
  gap: 9.6px;
}

.dialog-form-column :deep(.el-form-item) {
  margin: 0;
}

.dialog-form-column--left :deep(.el-form-item) {
  display: flex;
  align-items: center;
  gap: 12px;
}

.dialog-form-column--left :deep(.el-form-item__label) {
  padding: 0;
  margin: 0;
}

.dialog-form-column--left :deep(.el-form-item__content) {
  margin-left: 0 !important;
}

.dialog-form-column--right :deep(.el-form-item) {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
}

.dialog-form-column--right :deep(.el-form-item__label) {
  padding: 0;
  margin: 0;
  text-align: right;
}

.dialog-form-column--right :deep(.el-form-item__content) {
  margin-left: 0 !important;
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
  margin-top: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dialog-product-summary__item {
  margin-right: 16px;
}
</style>
