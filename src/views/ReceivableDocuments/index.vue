<template>
  <div class="p-4">
    <el-form
      ref="queryFormRef"
      :model="queryForm"
      label-width="90px"
      inline
      style="margin-bottom: 16px"
    >
      <el-form-item label="回款单号">
        <el-input v-model="queryForm.itemCode" placeholder="请输入回款单号" clearable />
      </el-form-item>
      <el-form-item label="客户名称">
        <el-input v-model="queryForm.customerName" placeholder="请输入客户名称" clearable />
      </el-form-item>
      <el-form-item label="回款状态">
        <el-select
          v-model="queryForm.status"
          placeholder="请选择回款状态"
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
      <el-form-item label="回款日期">
        <el-date-picker
          v-model="queryForm.receiptDateRange"
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
            <el-table-column prop="itemCode" label="批次编号" min-width="140" />
            <el-table-column prop="productName" label="回款项目" min-width="160" />
            <el-table-column prop="productDrawingNo" label="收款账户" min-width="150" />
            <el-table-column prop="customerPartNo" label="付款方" min-width="150" />
            <el-table-column label="回款金额" width="140" align="right">
              <template #default="{ row: detail }">
                {{ formatAmount(detail.amount) }}
              </template>
            </el-table-column>
            <el-table-column prop="deliveryDate" label="到账日期" width="140" />
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
      <el-table-column prop="receiptNo" label="回款单号" min-width="140" />
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
      <el-table-column prop="deliveryDate" label="到账日期" width="140" />
      <el-table-column prop="contractNo" label="合同编号" width="140" />
      <el-table-column label="操作" width="160" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" link @click="handleEdit(row)">编辑</el-button>
          <el-button type="danger" link @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div style=" display: flex;margin-top: 16px; justify-content: center">
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
            <el-form-item label="订单编号" prop="receiptNo">
              <el-input
                v-model="dialogForm.receiptNo"
                placeholder="请输入订单编号"
                class="dialog-input"
              />
            </el-form-item>
            <el-form-item label="订单日期">
              <el-date-picker
                v-model="dialogForm.receiptDate"
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
            <el-table-column label="收款账户" min-width="130">
              <template #default="{ row }">
                <el-input v-model="row.productDrawingNo" placeholder="请输入收款账户" />
              </template>
            </el-table-column>
            <el-table-column label="付款方" min-width="130">
              <template #default="{ row }">
                <el-input v-model="row.customerPartNo" placeholder="请输入付款方" />
              </template>
            </el-table-column>
            <el-table-column label="回款金额" width="120" align="right">
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
            <el-table-column label="到账日期" width="150">
              <template #default="{ row }">
                <el-date-picker
                  v-model="row.deliveryDate"
                  type="date"
                  value-format="YYYY-MM-DD"
                  placeholder="请选择到账日期"
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
            <el-button type="primary" plain @click="addDetailRow">新增回款批次</el-button>
            <div>
              <span class="dialog-product-summary__item"
                >批次数量：{{ dialogForm.details.length }}</span
              >
              <span>合计回款：{{ formatAmount(dialogTotals.totalAmount) }}</span>
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

type ReceiptStatus = 'pending' | 'received'

interface ReceiptDetail {
  id: number
  itemCode: string
  productName: string
  productDrawingNo: string
  customerPartNo: string
  amount: number
  deliveryDate: string
  remark: string
  costSource: string
}

interface Receipt {
  id: number
  receiptNo: string
  customerName: string
  contractNo: string
  status: ReceiptStatus
  receiptDate: string
  deliveryDate: string
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
  itemCode: '',
  productName: '',
  productDrawingNo: '',
  customerPartNo: '',
  amount: 0,
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
  details: [createEmptyDetail()]
})

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, ms)
  })

const normalizeDetails = (details: ReceiptDetail[]): ReceiptDetail[] =>
  details.map((detail) => ({
    ...detail,
    amount: Number(detail.amount) || 0
  }))

const calculateSummary = (details: ReceiptDetail[]) =>
  details.reduce(
    (acc, item) => {
      acc.totalAmount += item.amount
      return acc
    },
    { totalAmount: 0 }
  )

const listReceipts = async (params: ListReceiptsParams): Promise<PaginatedReceipts> => {
  await wait(300)
  const { page, size, itemCode, customerName, status, receiptDateRange } = params

  let filtered = [...mockReceipts.value]

  if (itemCode) {
    const value = itemCode.trim().toLowerCase()
    filtered = filtered.filter((receipt) =>
      receipt.details.some((detail) => {
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

  if (receiptDateRange && receiptDateRange.length === 2) {
    const [start, end] = receiptDateRange
    filtered = filtered.filter((item) => item.receiptDate >= start && item.receiptDate <= end)
  }

  const startIndex = (page - 1) * size
  const list = filtered.slice(startIndex, startIndex + size)

  return {
    list,
    total: filtered.length
  }
}

const getReceipt = async (id: number): Promise<Receipt> => {
  await wait(200)
  const target = mockReceipts.value.find((item) => item.id === id)
  if (!target) {
    throw new Error('订单不存在')
  }
  return JSON.parse(JSON.stringify(target))
}

const createReceipt = async (payload: ReceiptPayload): Promise<Receipt> => {
  await wait(300)
  const nextId =
    mockReceipts.value.length > 0 ? Math.max(...mockReceipts.value.map((item) => item.id)) + 1 : 1
  const receiptToSave: Receipt = {
    id: nextId,
    receiptNo: payload.receiptNo,
    customerName: payload.customerName,
    contractNo: payload.contractNo,
    status: payload.status,
    receiptDate: payload.receiptDate,
    deliveryDate: payload.deliveryDate,
    details: normalizeDetails(payload.details.map((detail) => ({ ...detail })))
  }
  mockReceipts.value.unshift(receiptToSave)
  return JSON.parse(JSON.stringify(receiptToSave))
}

const updateReceipt = async (id: number, payload: ReceiptPayload): Promise<Receipt> => {
  await wait(300)
  const index = mockReceipts.value.findIndex((item) => item.id === id)
  if (index === -1) {
    throw new Error('订单不存在')
  }
  const updated: Receipt = {
    id,
    receiptNo: payload.receiptNo,
    customerName: payload.customerName,
    contractNo: payload.contractNo,
    status: payload.status,
    receiptDate: payload.receiptDate,
    deliveryDate: payload.deliveryDate,
    details: normalizeDetails(payload.details.map((detail) => ({ ...detail })))
  }
  mockReceipts.value.splice(index, 1, updated)
  return JSON.parse(JSON.stringify(updated))
}

const removeReceipt = async (id: number): Promise<void> => {
  await wait(200)
  const index = mockReceipts.value.findIndex((item) => item.id === id)
  if (index === -1) {
    throw new Error('订单不存在')
  }
  mockReceipts.value.splice(index, 1)
}

const statusTagMap: Record<ReceiptStatus, { label: string; type: string }> = {
  pending: { label: '待回款', type: 'warning' },
  received: { label: '已到账', type: 'success' }
}

const statusOptions = (Object.keys(statusTagMap) as ReceiptStatus[]).map((value) => ({
  value,
  label: statusTagMap[value].label
}))

const queryFormRef = ref<FormInstance>()
const queryForm = reactive<ReceiptQuery>({
  itemCode: '',
  customerName: '',
  status: 'pending',
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

const dialogVisible = ref(false)
const dialogTitle = ref('')
const dialogSubmitting = ref(false)
const dialogFormRef = ref<FormInstance>()
const currentReceiptId = ref<number | null>(null)

const dialogForm = reactive<ReceiptPayload>(createEmptyReceipt())

const dialogRules: FormRules<ReceiptPayload> = {
  receiptNo: [{ required: true, message: '请输入订单编号', trigger: 'blur' }],
  customerName: [{ required: true, message: '请输入客户名称', trigger: 'blur' }]
}

const formatAmount = (value: number) => Number(value ?? 0).toFixed(2)

const mapReceiptToRow = (receipt: Receipt): ReceiptTableRow => {
  const { totalAmount } = calculateSummary(receipt.details)
  return {
    ...receipt,
    totalAmount
  }
}

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
  queryForm.status = 'pending'
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

const handleCreate = async () => {
  dialogTitle.value = '新增订单'
  currentReceiptId.value = null
  resetDialogForm()
  dialogVisible.value = true
  await nextTick()
  dialogFormRef.value?.clearValidate()
}

const openEditDialog = async (id: number) => {
  try {
    const receipt = await getReceipt(id)
    const { id: _id, ...payload } = receipt
    dialogTitle.value = '编辑订单'
    currentReceiptId.value = id
    assignDialogForm(payload)
    dialogVisible.value = true
    await nextTick()
    dialogFormRef.value?.clearValidate()
  } catch (error) {
    ElMessage.error((error as Error).message || '加载订单失败')
  }
}

const handleEdit = (row: ReceiptTableRow) => {
  void openEditDialog(row.id)
}

const handleRowDblClick = (row: ReceiptTableRow) => {
  void openEditDialog(row.id)
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
    (detail) => !detail.productName.trim() || detail.amount <= 0
  )

  if (invalidDetail) {
    ElMessage.error('请完善产品名称并确保数量大于 0')
    return
  }

  const payload = cloneReceiptPayload(dialogForm)
  dialogSubmitting.value = true

  try {
    if (currentReceiptId.value === null) {
      await createReceipt(payload)
      pagination.page = 1
      ElMessage.success('新增成功')
    } else {
      await updateReceipt(currentReceiptId.value, payload)
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
  try {
    await ElMessageBox.confirm(`确认删除订单 ${row.receiptNo} 吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    await removeReceipt(row.id)
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
  currentReceiptId.value = null
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
  display: flex;
  margin-top: 12px;
  justify-content: space-between;
  align-items: center;
}

.dialog-product-summary__item {
  margin-right: 16px;
}
</style>
