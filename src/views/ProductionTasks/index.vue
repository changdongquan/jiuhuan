<template>
  <div class="p-4">
    <el-form
      ref="queryFormRef"
      :model="queryForm"
      label-width="90px"
      inline
      style="margin-bottom: 16px"
    >
      <el-form-item label="生产任务编号">
        <el-input v-model="queryForm.itemCode" placeholder="请输入生产任务编号" clearable />
      </el-form-item>
      <el-form-item label="生产任务名称">
        <el-input v-model="queryForm.taskName" placeholder="请输入生产任务名称" clearable />
      </el-form-item>
      <el-form-item label="生产任务状态">
        <el-select
          v-model="queryForm.status"
          placeholder="请选择生产任务状态"
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
      <el-form-item label="生产任务周期">
        <el-date-picker
          v-model="queryForm.taskPeriodRange"
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
            <el-table-column prop="itemCode" label="工序编号" min-width="140" />
            <el-table-column prop="productName" label="工序名称" min-width="160" />
            <el-table-column prop="productDrawingNo" label="负责人" min-width="150" />
            <el-table-column prop="customerPartNo" label="关键里程碑" min-width="150" />
            <el-table-column label="计划数量" width="90" align="center">
              <template #default="{ row: detail }">
                {{ detail.quantity }}
              </template>
            </el-table-column>
            <el-table-column label="单价(元)" width="120" align="right">
              <template #default="{ row: detail }">
                {{ formatAmount(detail.unitPrice) }}
              </template>
            </el-table-column>
            <el-table-column label="成本(元)" width="140" align="right">
              <template #default="{ row: detail }">
                {{ formatAmount(detail.amount) }}
              </template>
            </el-table-column>
            <el-table-column prop="endDate" label="截止日期" width="140" />
            <el-table-column prop="remark" label="备注" min-width="140" show-overflow-tooltip />
            <el-table-column
              prop="costSource"
              label="资源来源"
              min-width="140"
              show-overflow-tooltip
            />
          </el-table>
        </template>
      </el-table-column>
      <el-table-column prop="taskCode" label="生产任务编号" min-width="140" />
      <el-table-column prop="taskName" label="生产任务名称" min-width="160" />
      <el-table-column label="工序数量" width="100" align="center">
        <template #default="{ row }">
          {{ row.details.length }}
        </template>
      </el-table-column>
      <el-table-column label="计划总量" width="100" align="center">
        <template #default="{ row }">
          {{ row.totalQuantity }}
        </template>
      </el-table-column>
      <el-table-column label="预算总额" width="140" align="right">
        <template #default="{ row }">
          {{ formatAmount(row.totalAmount) }}
        </template>
      </el-table-column>
      <el-table-column label="生产任务状态" width="120" align="center">
        <template #default="{ row }">
          <el-tag :type="statusTagMap[row.status].type">
            {{ statusTagMap[row.status].label }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="startDate" label="开始日期" width="140" />
      <el-table-column prop="endDate" label="结束日期" width="140" />
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
            <el-form-item label="生产任务编号" prop="taskCode">
              <el-input
                v-model="dialogForm.taskCode"
                placeholder="请输入生产任务编号"
                class="dialog-input"
              />
            </el-form-item>
            <el-form-item label="开始日期">
              <el-date-picker
                v-model="dialogForm.startDate"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="请选择开始日期"
                class="dialog-date-picker"
                style="width: 252px"
              />
            </el-form-item>
            <el-form-item label="生产任务状态" class="dialog-status-item">
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
            <el-form-item label="生产任务名称" prop="taskName">
              <el-input
                v-model="dialogForm.taskName"
                placeholder="请输入生产任务名称"
                class="dialog-input"
              />
            </el-form-item>
            <el-form-item label="结束日期">
              <el-date-picker
                v-model="dialogForm.endDate"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="请选择结束日期"
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
            <el-table-column label="工序编号" min-width="140">
              <template #default="{ row }">
                <el-input v-model="row.itemCode" placeholder="请输入工序编号" />
              </template>
            </el-table-column>
            <el-table-column label="工序名称" min-width="150">
              <template #default="{ row }">
                <el-input v-model="row.productName" placeholder="请输入工序名称" />
              </template>
            </el-table-column>
            <el-table-column label="负责人" min-width="130">
              <template #default="{ row }">
                <el-input v-model="row.productDrawingNo" placeholder="请输入负责人" />
              </template>
            </el-table-column>
            <el-table-column label="关键里程碑" min-width="130">
              <template #default="{ row }">
                <el-input v-model="row.customerPartNo" placeholder="请输入关键里程碑" />
              </template>
            </el-table-column>
            <el-table-column label="计划数量" width="140" align="center">
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
            <el-table-column label="成本单价(元)" width="120" align="right">
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
            <el-table-column label="成本(元)" width="80" align="right">
              <template #default="{ row }">
                {{ formatAmount(row.amount) }}
              </template>
            </el-table-column>
            <el-table-column label="截止日期" width="150">
              <template #default="{ row }">
                <el-date-picker
                  v-model="row.endDate"
                  type="date"
                  value-format="YYYY-MM-DD"
                  placeholder="请选择截止日期"
                  style="width: 130px"
                />
              </template>
            </el-table-column>
            <el-table-column label="备注" min-width="150">
              <template #default="{ row }">
                <el-input v-model="row.remark" placeholder="备注" />
              </template>
            </el-table-column>
            <el-table-column label="资源来源" min-width="145">
              <template #default="{ row }">
                <el-input v-model="row.costSource" placeholder="请输入资源来源" />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="55" fixed="right">
              <template #default="{ $index }">
                <el-button type="danger" link @click="removeDetailRow($index)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>

          <div class="dialog-product-summary">
            <el-button type="primary" plain @click="addDetailRow">新增工序</el-button>
            <div>
              <span class="dialog-product-summary__item"
                >工序数量：{{ dialogForm.details.length }}</span
              >
              <span class="dialog-product-summary__item"
                >计划总量：{{ dialogTotals.totalQuantity }}</span
              >
              <span>预算总额：{{ formatAmount(dialogTotals.totalAmount) }}</span>
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

type TaskStatus = 'inProgress' | 'completed'

interface TaskStep {
  id: number
  itemCode: string
  productName: string
  productDrawingNo: string
  customerPartNo: string
  quantity: number
  unitPrice: number
  amount: number
  endDate: string
  remark: string
  costSource: string
}

interface Task {
  id: number
  taskCode: string
  taskName: string
  contractNo: string
  status: TaskStatus
  startDate: string
  endDate: string
  details: TaskStep[]
}

interface TaskQuery {
  itemCode: string
  taskName: string
  status: '' | TaskStatus
  taskPeriodRange: string[]
}

interface ListTasksParams {
  page: number
  size: number
  itemCode?: string
  taskName?: string
  status?: TaskStatus
  taskPeriodRange?: [string, string]
}

interface PaginatedTasks {
  list: Task[]
  total: number
}

interface TaskTableRow extends Task {
  totalQuantity: number
  totalAmount: number
}

type TaskPayload = Omit<Task, 'id'>

const mockTasks = ref<Task[]>([
  {
    id: 1,
    taskCode: 'TASK-202401',
    taskName: '智能手表装配',
    contractNo: 'SC-ZB-001',
    status: 'inProgress',
    startDate: '2024-01-08',
    endDate: '2024-02-25',
    details: [
      {
        id: 1,
        itemCode: 'STEP-01',
        productName: '原料准备',
        productDrawingNo: '李明',
        customerPartNo: '完成关键原件上架',
        quantity: 1,
        unitPrice: 12000,
        amount: 12000,
        endDate: '2024-01-15',
        remark: '重点关注电池入库',
        costSource: '生产部'
      },
      {
        id: 2,
        itemCode: 'STEP-02',
        productName: '装配调试',
        productDrawingNo: '王娟',
        customerPartNo: '完成样机调试',
        quantity: 1,
        unitPrice: 26000,
        amount: 26000,
        endDate: '2024-02-10',
        remark: '须同步质量验证',
        costSource: '生产部'
      }
    ]
  },
  {
    id: 2,
    taskCode: 'TASK-202402',
    taskName: '电机总成生产',
    contractNo: 'SC-MTR-003',
    status: 'inProgress',
    startDate: '2024-02-12',
    endDate: '2024-04-30',
    details: [
      {
        id: 3,
        itemCode: 'STEP-01',
        productName: '线圈绕制',
        productDrawingNo: '赵工',
        customerPartNo: '完成 500 件线圈',
        quantity: 500,
        unitPrice: 45,
        amount: 22500,
        endDate: '2024-03-05',
        remark: '增加夜班产量',
        costSource: '制造部'
      },
      {
        id: 4,
        itemCode: 'STEP-02',
        productName: '总成装配',
        productDrawingNo: '刘工',
        customerPartNo: '完成 300 套成品',
        quantity: 300,
        unitPrice: 80,
        amount: 24000,
        endDate: '2024-04-20',
        remark: '需协调供应链备料',
        costSource: '制造部'
      }
    ]
  },
  {
    id: 3,
    taskCode: 'TASK-202305',
    taskName: '冲压模具翻新',
    contractNo: 'SC-MD-011',
    status: 'completed',
    startDate: '2023-11-01',
    endDate: '2024-01-20',
    details: [
      {
        id: 5,
        itemCode: 'STEP-01',
        productName: '模具拆检',
        productDrawingNo: '周师傅',
        customerPartNo: '完成磨损评估',
        quantity: 1,
        unitPrice: 9000,
        amount: 9000,
        endDate: '2023-12-05',
        remark: '记录维修视频',
        costSource: '设备部'
      },
      {
        id: 6,
        itemCode: 'STEP-02',
        productName: '复装调试',
        productDrawingNo: '何师傅',
        customerPartNo: '通过试生产',
        quantity: 1,
        unitPrice: 15000,
        amount: 15000,
        endDate: '2024-01-15',
        remark: '产线试模通过',
        costSource: '设备部'
      }
    ]
  }
])

const detailIdSeed = ref(
  (() => {
    const ids = mockTasks.value.flatMap((task) => task.details.map((detail) => detail.id))
    return (ids.length ? Math.max(...ids) : 0) + 1
  })()
)

const createDetailId = () => detailIdSeed.value++

const createEmptyDetail = (): TaskStep => ({
  id: createDetailId(),
  itemCode: '',
  productName: '',
  productDrawingNo: '',
  customerPartNo: '',
  quantity: 1,
  unitPrice: 0,
  amount: 0,
  endDate: '',
  remark: '',
  costSource: ''
})

const createEmptyTask = (): TaskPayload => ({
  taskCode: '',
  taskName: '',
  contractNo: '',
  status: 'inProgress',
  startDate: '',
  endDate: '',
  details: [createEmptyDetail()]
})

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, ms)
  })

const normalizeDetails = (details: TaskStep[]): TaskStep[] =>
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

const calculateSummary = (details: TaskStep[]) =>
  details.reduce(
    (acc, item) => {
      acc.totalQuantity += item.quantity
      acc.totalAmount += item.amount
      return acc
    },
    { totalQuantity: 0, totalAmount: 0 }
  )

const listTasks = async (params: ListTasksParams): Promise<PaginatedTasks> => {
  await wait(300)
  const { page, size, itemCode, taskName, status, taskPeriodRange } = params

  let filtered = [...mockTasks.value]

  if (itemCode) {
    const value = itemCode.trim().toLowerCase()
    filtered = filtered.filter((task) =>
      task.details.some((detail) => {
        const code = detail.itemCode ? detail.itemCode.toLowerCase() : ''
        return code.includes(value)
      })
    )
  }

  if (taskName) {
    const value = taskName.trim().toLowerCase()
    filtered = filtered.filter((item) => item.taskName.toLowerCase().includes(value))
  }

  if (status) {
    filtered = filtered.filter((item) => item.status === status)
  }

  if (taskPeriodRange && taskPeriodRange.length === 2) {
    const [start, end] = taskPeriodRange
    filtered = filtered.filter((item) => item.startDate >= start && item.startDate <= end)
  }

  const startIndex = (page - 1) * size
  const list = filtered.slice(startIndex, startIndex + size)

  return {
    list,
    total: filtered.length
  }
}

const getTask = async (id: number): Promise<Task> => {
  await wait(200)
  const target = mockTasks.value.find((item) => item.id === id)
  if (!target) {
    throw new Error('生产任务不存在')
  }
  return JSON.parse(JSON.stringify(target))
}

const createTask = async (payload: TaskPayload): Promise<Task> => {
  await wait(300)
  const nextId =
    mockTasks.value.length > 0 ? Math.max(...mockTasks.value.map((item) => item.id)) + 1 : 1
  const taskToSave: Task = {
    id: nextId,
    taskCode: payload.taskCode,
    taskName: payload.taskName,
    contractNo: payload.contractNo,
    status: payload.status,
    startDate: payload.startDate,
    endDate: payload.endDate,
    details: normalizeDetails(payload.details.map((detail) => ({ ...detail })))
  }
  mockTasks.value.unshift(taskToSave)
  return JSON.parse(JSON.stringify(taskToSave))
}

const updateTask = async (id: number, payload: TaskPayload): Promise<Task> => {
  await wait(300)
  const index = mockTasks.value.findIndex((item) => item.id === id)
  if (index === -1) {
    throw new Error('生产任务不存在')
  }
  const updated: Task = {
    id,
    taskCode: payload.taskCode,
    taskName: payload.taskName,
    contractNo: payload.contractNo,
    status: payload.status,
    startDate: payload.startDate,
    endDate: payload.endDate,
    details: normalizeDetails(payload.details.map((detail) => ({ ...detail })))
  }
  mockTasks.value.splice(index, 1, updated)
  return JSON.parse(JSON.stringify(updated))
}

const removeTask = async (id: number): Promise<void> => {
  await wait(200)
  const index = mockTasks.value.findIndex((item) => item.id === id)
  if (index === -1) {
    throw new Error('生产任务不存在')
  }
  mockTasks.value.splice(index, 1)
}

const statusTagMap: Record<TaskStatus, { label: string; type: string }> = {
  inProgress: { label: '生产中', type: 'warning' },
  completed: { label: '已完成', type: 'success' }
}

const statusOptions = (Object.keys(statusTagMap) as TaskStatus[]).map((value) => ({
  value,
  label: statusTagMap[value].label
}))

const queryFormRef = ref<FormInstance>()
const queryForm = reactive<TaskQuery>({
  itemCode: '',
  taskName: '',
  status: 'inProgress',
  taskPeriodRange: []
})

const pagination = reactive({
  page: 1,
  size: 10
})

const tableRef = ref<InstanceType<typeof ElTable>>()
const tableData = ref<TaskTableRow[]>([])
const total = ref(0)
const loading = ref(false)

const dialogVisible = ref(false)
const dialogTitle = ref('')
const dialogSubmitting = ref(false)
const dialogFormRef = ref<FormInstance>()
const currentTaskId = ref<number | null>(null)

const dialogForm = reactive<TaskPayload>(createEmptyTask())

const dialogRules: FormRules<TaskPayload> = {
  taskCode: [{ required: true, message: '请输入生产任务编号', trigger: 'blur' }],
  taskName: [{ required: true, message: '请输入生产任务名称', trigger: 'blur' }]
}

const formatAmount = (value: number) => Number(value ?? 0).toFixed(2)

const mapTaskToRow = (task: Task): TaskTableRow => {
  const { totalAmount, totalQuantity } = calculateSummary(task.details)
  return {
    ...task,
    totalAmount,
    totalQuantity
  }
}

const loadData = async () => {
  loading.value = true
  try {
    const params: ListTasksParams = {
      page: pagination.page,
      size: pagination.size
    }

    if (queryForm.itemCode.trim()) {
      params.itemCode = queryForm.itemCode.trim()
    }

    if (queryForm.taskName.trim()) {
      params.taskName = queryForm.taskName.trim()
    }

    if (queryForm.status) {
      params.status = queryForm.status
    }

    if (queryForm.taskPeriodRange.length === 2) {
      params.taskPeriodRange = [queryForm.taskPeriodRange[0], queryForm.taskPeriodRange[1]]
    }

    const { list, total: totalCount } = await listTasks(params)
    tableData.value = list.map(mapTaskToRow)
    total.value = totalCount
    await nextTick()
    const shouldExpand = Boolean(
      params.itemCode || params.taskName || params.taskPeriodRange?.length === 2
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
  queryForm.taskName = ''
  queryForm.status = 'inProgress'
  queryForm.taskPeriodRange = []
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

const assignDialogForm = (payload: TaskPayload) => {
  dialogForm.taskCode = payload.taskCode
  dialogForm.taskName = payload.taskName
  dialogForm.contractNo = payload.contractNo
  dialogForm.status = payload.status
  dialogForm.startDate = payload.startDate
  dialogForm.endDate = payload.endDate
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
  assignDialogForm(createEmptyTask())
}

const handleCreate = async () => {
  dialogTitle.value = '新增生产任务'
  currentTaskId.value = null
  resetDialogForm()
  dialogVisible.value = true
  await nextTick()
  dialogFormRef.value?.clearValidate()
}

const openEditDialog = async (id: number) => {
  try {
    const task = await getTask(id)
    const { id: _id, ...payload } = task
    dialogTitle.value = '编辑生产任务'
    currentTaskId.value = id
    assignDialogForm(payload)
    dialogVisible.value = true
    await nextTick()
    dialogFormRef.value?.clearValidate()
  } catch (error) {
    ElMessage.error((error as Error).message || '加载生产任务失败')
  }
}

const handleEdit = (row: TaskTableRow) => {
  void openEditDialog(row.id)
}

const handleRowDblClick = (row: TaskTableRow) => {
  void openEditDialog(row.id)
}

const recalculateDetail = (detail: TaskStep) => {
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

const handleDetailQuantityChange = (detail: TaskStep) => {
  recalculateDetail(detail)
}

const handleDetailUnitPriceChange = (detail: TaskStep) => {
  recalculateDetail(detail)
}

const dialogTotals = computed(() => calculateSummary(dialogForm.details))

const cloneTaskPayload = (source: TaskPayload): TaskPayload => ({
  taskCode: source.taskCode,
  taskName: source.taskName,
  contractNo: source.contractNo,
  status: source.status,
  startDate: source.startDate,
  endDate: source.endDate,
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

  const payload = cloneTaskPayload(dialogForm)
  dialogSubmitting.value = true

  try {
    if (currentTaskId.value === null) {
      await createTask(payload)
      pagination.page = 1
      ElMessage.success('新增成功')
    } else {
      await updateTask(currentTaskId.value, payload)
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

const handleDelete = async (row: TaskTableRow) => {
  try {
    await ElMessageBox.confirm(`确认删除生产任务 ${row.taskCode} 吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    await removeTask(row.id)
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
  currentTaskId.value = null
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
