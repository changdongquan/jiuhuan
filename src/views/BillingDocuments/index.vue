<template>
  <div class="p-4">
    <el-form
      ref="queryFormRef"
      :model="queryForm"
      label-width="90px"
      inline
      style="margin-bottom: 16px"
    >
      <el-form-item label="发票号码">
        <el-input v-model="queryForm.itemCode" placeholder="请输入发票号码" clearable />
      </el-form-item>
      <el-form-item label="客户名称">
        <el-input v-model="queryForm.customerName" placeholder="请输入客户名称" clearable />
      </el-form-item>
      <el-form-item label="开票状态">
        <el-select
          v-model="queryForm.status"
          placeholder="请选择开票状态"
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
      <el-form-item label="开票日期">
        <el-date-picker
          v-model="queryForm.invoiceDateRange"
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
            <el-table-column prop="itemCode" label="行项目编号" min-width="140" />
            <el-table-column prop="productName" label="商品/服务名称" min-width="160" />
            <el-table-column prop="productDrawingNo" label="税收分类编码" min-width="150" />
            <el-table-column prop="customerPartNo" label="单位" min-width="150" />
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
            <el-table-column prop="deliveryDate" label="到期日期" width="140" />
            <el-table-column prop="remark" label="备注" min-width="140" show-overflow-tooltip />
            <el-table-column
              prop="costSource"
              label="备注信息"
              min-width="140"
              show-overflow-tooltip
            />
          </el-table>
        </template>
      </el-table-column>
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
      <el-table-column label="开票状态" width="120" align="center">
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
            <el-form-item label="发票号码" prop="invoiceNo">
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
            <el-form-item label="开票状态" class="dialog-status-item">
              <el-select
                v-model="dialogForm.status"
                placeholder="请选择开票状态"
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
          <div class="dialog-form-column dialog-form-column--right">
            <el-form-item label="客户名称" prop="customerName">
              <el-input
                v-model="dialogForm.customerName"
                placeholder="请输入客户名称"
                class="dialog-input"
              />
            </el-form-item>
            <el-form-item label="到期日期">
              <el-date-picker
                v-model="dialogForm.deliveryDate"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="请选择到期日期"
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

          <div class="dialog-product-summary">
            <el-button type="primary" plain @click="addDetailRow">新增发票行</el-button>
            <div>
              <span class="dialog-product-summary__item"
                >行项目数：{{ dialogForm.details.length }}</span
              >
              <span class="dialog-product-summary__item"
                >数量合计：{{ dialogTotals.totalQuantity }}</span
              >
              <span>金额合计：{{ formatAmount(dialogTotals.totalAmount) }}</span>
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

type InvoiceStatus = 'pending' | 'issued'

interface InvoiceLine {
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

interface Invoice {
  id: number
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

type InvoicePayload = Omit<Invoice, 'id'>

const mockInvoices = ref<Invoice[]>([
  {
    id: 1,
    invoiceNo: 'INV-20240101',
    customerName: '华东制造有限公司',
    contractNo: 'HT-2023-001',
    status: 'pending',
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
    status: 'issued',
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
    status: 'issued',
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

const createEmptyInvoice = (): InvoicePayload => ({
  invoiceNo: '',
  customerName: '',
  contractNo: '',
  status: 'pending',
  invoiceDate: '',
  deliveryDate: '',
  details: [createEmptyDetail()]
})

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, ms)
  })

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
  await wait(300)
  const { page, size, itemCode, customerName, status, invoiceDateRange } = params

  let filtered = [...mockInvoices.value]

  if (itemCode) {
    const value = itemCode.trim().toLowerCase()
    filtered = filtered.filter((invoice) =>
      invoice.details.some((detail) => {
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

  if (invoiceDateRange && invoiceDateRange.length === 2) {
    const [start, end] = invoiceDateRange
    filtered = filtered.filter((item) => item.invoiceDate >= start && item.invoiceDate <= end)
  }

  const startIndex = (page - 1) * size
  const list = filtered.slice(startIndex, startIndex + size)

  return {
    list,
    total: filtered.length
  }
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
  await wait(300)
  const nextId =
    mockInvoices.value.length > 0 ? Math.max(...mockInvoices.value.map((item) => item.id)) + 1 : 1
  const invoiceToSave: Invoice = {
    id: nextId,
    invoiceNo: payload.invoiceNo,
    customerName: payload.customerName,
    contractNo: payload.contractNo,
    status: payload.status,
    invoiceDate: payload.invoiceDate,
    deliveryDate: payload.deliveryDate,
    details: normalizeDetails(payload.details.map((detail) => ({ ...detail })))
  }
  mockInvoices.value.unshift(invoiceToSave)
  return JSON.parse(JSON.stringify(invoiceToSave))
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

const statusTagMap: Record<InvoiceStatus, { label: string; type: string }> = {
  pending: { label: '待开票', type: 'warning' },
  issued: { label: '已开票', type: 'success' }
}

const statusOptions = (Object.keys(statusTagMap) as InvoiceStatus[]).map((value) => ({
  value,
  label: statusTagMap[value].label
}))

const queryFormRef = ref<FormInstance>()
const queryForm = reactive<InvoiceQuery>({
  itemCode: '',
  customerName: '',
  status: 'pending',
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

const dialogVisible = ref(false)
const dialogTitle = ref('')
const dialogSubmitting = ref(false)
const dialogFormRef = ref<FormInstance>()
const currentInvoiceId = ref<number | null>(null)

const dialogForm = reactive<InvoicePayload>(createEmptyInvoice())

const dialogRules: FormRules<InvoicePayload> = {
  invoiceNo: [{ required: true, message: '请输入发票号码', trigger: 'blur' }],
  customerName: [{ required: true, message: '请输入客户名称', trigger: 'blur' }]
}

const formatAmount = (value: number) => Number(value ?? 0).toFixed(2)

const mapInvoiceToRow = (invoice: Invoice): InvoiceTableRow => {
  const { totalAmount, totalQuantity } = calculateSummary(invoice.details)
  return {
    ...invoice,
    totalAmount,
    totalQuantity
  }
}

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
  queryForm.status = 'pending'
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

const handleCreate = async () => {
  dialogTitle.value = '新增发票'
  currentInvoiceId.value = null
  resetDialogForm()
  dialogVisible.value = true
  await nextTick()
  dialogFormRef.value?.clearValidate()
}

const openEditDialog = async (id: number) => {
  try {
    const invoice = await getInvoice(id)
    const { id: _id, ...payload } = invoice
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
  void openEditDialog(row.id)
}

const handleRowDblClick = (row: InvoiceTableRow) => {
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
