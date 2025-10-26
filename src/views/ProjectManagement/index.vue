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
      <el-form-item label="项目名称">
        <el-input v-model="queryForm.projectName" placeholder="请输入项目名称" clearable />
      </el-form-item>
      <el-form-item label="项目状态">
        <el-select
          v-model="queryForm.status"
          placeholder="请选择项目状态"
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
      <el-form-item label="项目周期">
        <el-date-picker
          v-model="queryForm.projectPeriodRange"
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
            <el-table-column prop="itemCode" label="阶段编号" min-width="140" />
            <el-table-column prop="productName" label="阶段名称" min-width="160" />
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
      <el-table-column prop="projectCode" label="项目编号" min-width="140" />
      <el-table-column prop="projectName" label="项目名称" min-width="160" />
      <el-table-column label="阶段数量" width="100" align="center">
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
      <el-table-column label="项目状态" width="120" align="center">
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
            <el-form-item label="项目编号" prop="projectCode">
              <el-input
                v-model="dialogForm.projectCode"
                placeholder="请输入项目编号"
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
            <el-form-item label="项目状态" class="dialog-status-item">
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
            <el-form-item label="项目名称" prop="projectName">
              <el-input
                v-model="dialogForm.projectName"
                placeholder="请输入项目名称"
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
            <el-table-column label="阶段编号" min-width="140">
              <template #default="{ row }">
                <el-input v-model="row.itemCode" placeholder="请输入阶段编号" />
              </template>
            </el-table-column>
            <el-table-column label="阶段名称" min-width="150">
              <template #default="{ row }">
                <el-input v-model="row.productName" placeholder="请输入阶段名称" />
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
            <el-button type="primary" plain @click="addDetailRow">新增阶段</el-button>
            <div>
              <span class="dialog-product-summary__item"
                >阶段数量：{{ dialogForm.details.length }}</span
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

type ProjectStatus = 'ongoing' | 'completed'

interface ProjectPhase {
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

interface Project {
  id: number
  projectCode: string
  projectName: string
  contractNo: string
  status: ProjectStatus
  startDate: string
  endDate: string
  details: ProjectPhase[]
}

interface ProjectQuery {
  itemCode: string
  projectName: string
  status: '' | ProjectStatus
  projectPeriodRange: string[]
}

interface ListProjectsParams {
  page: number
  size: number
  itemCode?: string
  projectName?: string
  status?: ProjectStatus
  projectPeriodRange?: [string, string]
}

interface PaginatedProjects {
  list: Project[]
  total: number
}

interface ProjectTableRow extends Project {
  totalQuantity: number
  totalAmount: number
}

type ProjectPayload = Omit<Project, 'id'>

const mockProjects = ref<Project[]>([
  {
    id: 1,
    projectCode: 'PRJ-202401',
    projectName: '智慧工厂升级',
    contractNo: 'XM-HT-001',
    status: 'ongoing',
    startDate: '2024-01-05',
    endDate: '2024-04-30',
    details: [
      {
        id: 1,
        itemCode: 'PH-01',
        productName: '需求调研',
        productDrawingNo: '王强',
        customerPartNo: '完成调研报告',
        quantity: 1,
        unitPrice: 18000,
        amount: 18000,
        endDate: '2024-01-20',
        remark: '覆盖核心产线',
        costSource: '项目预算'
      },
      {
        id: 2,
        itemCode: 'PH-02',
        productName: '系统部署',
        productDrawingNo: '刘月',
        customerPartNo: '完成设备联网',
        quantity: 1,
        unitPrice: 42000,
        amount: 42000,
        endDate: '2024-03-15',
        remark: '与供应商协同',
        costSource: '项目预算'
      }
    ]
  },
  {
    id: 2,
    projectCode: 'PRJ-202402',
    projectName: '海外仓建设',
    contractNo: 'XM-HT-002',
    status: 'ongoing',
    startDate: '2024-02-01',
    endDate: '2024-06-30',
    details: [
      {
        id: 3,
        itemCode: 'PH-01',
        productName: '仓库规划',
        productDrawingNo: '陈峰',
        customerPartNo: '完成平面设计',
        quantity: 1,
        unitPrice: 25000,
        amount: 25000,
        endDate: '2024-02-28',
        remark: '重点关注动线',
        costSource: '自筹'
      },
      {
        id: 4,
        itemCode: 'PH-02',
        productName: '土建施工',
        productDrawingNo: '赵丽',
        customerPartNo: '主体结构封顶',
        quantity: 1,
        unitPrice: 76000,
        amount: 76000,
        endDate: '2024-05-10',
        remark: '使用本地施工队',
        costSource: '自筹'
      }
    ]
  },
  {
    id: 3,
    projectCode: 'PRJ-202403',
    projectName: 'MES 系统升级',
    contractNo: 'XM-HT-003',
    status: 'completed',
    startDate: '2023-11-15',
    endDate: '2024-03-20',
    details: [
      {
        id: 5,
        itemCode: 'PH-01',
        productName: '蓝图设计',
        productDrawingNo: '黄倩',
        customerPartNo: '确认系统蓝图',
        quantity: 1,
        unitPrice: 22000,
        amount: 22000,
        endDate: '2023-12-10',
        remark: '完成流程梳理',
        costSource: '项目预算'
      },
      {
        id: 6,
        itemCode: 'PH-02',
        productName: '试运行',
        productDrawingNo: '李敏',
        customerPartNo: '通过 UAT',
        quantity: 1,
        unitPrice: 30000,
        amount: 30000,
        endDate: '2024-03-05',
        remark: '现场培训完成',
        costSource: '项目预算'
      }
    ]
  }
])

const detailIdSeed = ref(
  (() => {
    const ids = mockProjects.value.flatMap((project) => project.details.map((detail) => detail.id))
    return (ids.length ? Math.max(...ids) : 0) + 1
  })()
)

const createDetailId = () => detailIdSeed.value++

const createEmptyDetail = (): ProjectPhase => ({
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

const createEmptyProject = (): ProjectPayload => ({
  projectCode: '',
  projectName: '',
  contractNo: '',
  status: 'ongoing',
  startDate: '',
  endDate: '',
  details: [createEmptyDetail()]
})

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, ms)
  })

const normalizeDetails = (details: ProjectPhase[]): ProjectPhase[] =>
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

const calculateSummary = (details: ProjectPhase[]) =>
  details.reduce(
    (acc, item) => {
      acc.totalQuantity += item.quantity
      acc.totalAmount += item.amount
      return acc
    },
    { totalQuantity: 0, totalAmount: 0 }
  )

const listProjects = async (params: ListProjectsParams): Promise<PaginatedProjects> => {
  await wait(300)
  const { page, size, itemCode, projectName, status, projectPeriodRange } = params

  let filtered = [...mockProjects.value]

  if (itemCode) {
    const value = itemCode.trim().toLowerCase()
    filtered = filtered.filter((project) =>
      project.details.some((detail) => {
        const code = detail.itemCode ? detail.itemCode.toLowerCase() : ''
        return code.includes(value)
      })
    )
  }

  if (projectName) {
    const value = projectName.trim().toLowerCase()
    filtered = filtered.filter((item) => item.projectName.toLowerCase().includes(value))
  }

  if (status) {
    filtered = filtered.filter((item) => item.status === status)
  }

  if (projectPeriodRange && projectPeriodRange.length === 2) {
    const [start, end] = projectPeriodRange
    filtered = filtered.filter((item) => item.startDate >= start && item.startDate <= end)
  }

  const startIndex = (page - 1) * size
  const list = filtered.slice(startIndex, startIndex + size)

  return {
    list,
    total: filtered.length
  }
}

const getProject = async (id: number): Promise<Project> => {
  await wait(200)
  const target = mockProjects.value.find((item) => item.id === id)
  if (!target) {
    throw new Error('项目不存在')
  }
  return JSON.parse(JSON.stringify(target))
}

const createProject = async (payload: ProjectPayload): Promise<Project> => {
  await wait(300)
  const nextId =
    mockProjects.value.length > 0 ? Math.max(...mockProjects.value.map((item) => item.id)) + 1 : 1
  const projectToSave: Project = {
    id: nextId,
    projectCode: payload.projectCode,
    projectName: payload.projectName,
    contractNo: payload.contractNo,
    status: payload.status,
    startDate: payload.startDate,
    endDate: payload.endDate,
    details: normalizeDetails(payload.details.map((detail) => ({ ...detail })))
  }
  mockProjects.value.unshift(projectToSave)
  return JSON.parse(JSON.stringify(projectToSave))
}

const updateProject = async (id: number, payload: ProjectPayload): Promise<Project> => {
  await wait(300)
  const index = mockProjects.value.findIndex((item) => item.id === id)
  if (index === -1) {
    throw new Error('项目不存在')
  }
  const updated: Project = {
    id,
    projectCode: payload.projectCode,
    projectName: payload.projectName,
    contractNo: payload.contractNo,
    status: payload.status,
    startDate: payload.startDate,
    endDate: payload.endDate,
    details: normalizeDetails(payload.details.map((detail) => ({ ...detail })))
  }
  mockProjects.value.splice(index, 1, updated)
  return JSON.parse(JSON.stringify(updated))
}

const removeProject = async (id: number): Promise<void> => {
  await wait(200)
  const index = mockProjects.value.findIndex((item) => item.id === id)
  if (index === -1) {
    throw new Error('项目不存在')
  }
  mockProjects.value.splice(index, 1)
}

const statusTagMap: Record<ProjectStatus, { label: string; type: string }> = {
  ongoing: { label: '进行中', type: 'success' },
  completed: { label: '已完成', type: 'info' }
}

const statusOptions = (Object.keys(statusTagMap) as ProjectStatus[]).map((value) => ({
  value,
  label: statusTagMap[value].label
}))

const queryFormRef = ref<FormInstance>()
const queryForm = reactive<ProjectQuery>({
  itemCode: '',
  projectName: '',
  status: 'ongoing',
  projectPeriodRange: []
})

const pagination = reactive({
  page: 1,
  size: 10
})

const tableRef = ref<InstanceType<typeof ElTable>>()
const tableData = ref<ProjectTableRow[]>([])
const total = ref(0)
const loading = ref(false)

const dialogVisible = ref(false)
const dialogTitle = ref('')
const dialogSubmitting = ref(false)
const dialogFormRef = ref<FormInstance>()
const currentProjectId = ref<number | null>(null)

const dialogForm = reactive<ProjectPayload>(createEmptyProject())

const dialogRules: FormRules<ProjectPayload> = {
  projectCode: [{ required: true, message: '请输入项目编号', trigger: 'blur' }],
  projectName: [{ required: true, message: '请输入项目名称', trigger: 'blur' }]
}

const formatAmount = (value: number) => Number(value ?? 0).toFixed(2)

const mapProjectToRow = (project: Project): ProjectTableRow => {
  const { totalAmount, totalQuantity } = calculateSummary(project.details)
  return {
    ...project,
    totalAmount,
    totalQuantity
  }
}

const loadData = async () => {
  loading.value = true
  try {
    const params: ListProjectsParams = {
      page: pagination.page,
      size: pagination.size
    }

    if (queryForm.itemCode.trim()) {
      params.itemCode = queryForm.itemCode.trim()
    }

    if (queryForm.projectName.trim()) {
      params.projectName = queryForm.projectName.trim()
    }

    if (queryForm.status) {
      params.status = queryForm.status
    }

    if (queryForm.projectPeriodRange.length === 2) {
      params.projectPeriodRange = [queryForm.projectPeriodRange[0], queryForm.projectPeriodRange[1]]
    }

    const { list, total: totalCount } = await listProjects(params)
    tableData.value = list.map(mapProjectToRow)
    total.value = totalCount
    await nextTick()
    const shouldExpand = Boolean(
      params.itemCode || params.projectName || params.projectPeriodRange?.length === 2
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
  queryForm.projectName = ''
  queryForm.status = 'ongoing'
  queryForm.projectPeriodRange = []
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

const assignDialogForm = (payload: ProjectPayload) => {
  dialogForm.projectCode = payload.projectCode
  dialogForm.projectName = payload.projectName
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
  assignDialogForm(createEmptyProject())
}

const handleCreate = async () => {
  dialogTitle.value = '新增项目'
  currentProjectId.value = null
  resetDialogForm()
  dialogVisible.value = true
  await nextTick()
  dialogFormRef.value?.clearValidate()
}

const openEditDialog = async (id: number) => {
  try {
    const project = await getProject(id)
    const { id: _id, ...payload } = project
    dialogTitle.value = '编辑项目'
    currentProjectId.value = id
    assignDialogForm(payload)
    dialogVisible.value = true
    await nextTick()
    dialogFormRef.value?.clearValidate()
  } catch (error) {
    ElMessage.error((error as Error).message || '加载项目失败')
  }
}

const handleEdit = (row: ProjectTableRow) => {
  void openEditDialog(row.id)
}

const handleRowDblClick = (row: ProjectTableRow) => {
  void openEditDialog(row.id)
}

const recalculateDetail = (detail: ProjectPhase) => {
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

const handleDetailQuantityChange = (detail: ProjectPhase) => {
  recalculateDetail(detail)
}

const handleDetailUnitPriceChange = (detail: ProjectPhase) => {
  recalculateDetail(detail)
}

const dialogTotals = computed(() => calculateSummary(dialogForm.details))

const cloneProjectPayload = (source: ProjectPayload): ProjectPayload => ({
  projectCode: source.projectCode,
  projectName: source.projectName,
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

  const payload = cloneProjectPayload(dialogForm)
  dialogSubmitting.value = true

  try {
    if (currentProjectId.value === null) {
      await createProject(payload)
      pagination.page = 1
      ElMessage.success('新增成功')
    } else {
      await updateProject(currentProjectId.value, payload)
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

const handleDelete = async (row: ProjectTableRow) => {
  try {
    await ElMessageBox.confirm(`确认删除项目 ${row.projectCode} 吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    await removeProject(row.id)
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
  currentProjectId.value = null
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
