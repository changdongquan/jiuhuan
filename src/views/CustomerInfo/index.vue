<template>
  <div class="p-4 space-y-4">
    <el-form
      ref="queryFormRef"
      :model="queryForm"
      label-width="90px"
      inline
      class="rounded-lg bg-[var(--el-bg-color-overlay)] p-4 shadow-sm"
    >
      <el-form-item label="客户编码">
        <el-input v-model="queryForm.customerCode" placeholder="请输入客户编码" clearable style="width: 200px;" />
      </el-form-item>
      <el-form-item label="客户名称">
        <el-input v-model="queryForm.customerName" placeholder="请输入客户名称" clearable style="width: 200px;" />
      </el-form-item>
      <el-form-item label="客户等级">
        <el-select v-model="queryForm.level" placeholder="请选择" clearable style="width: 160px;">
          <el-option v-for="item in levelOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="所在地区">
        <el-input v-model="queryForm.region" placeholder="请输入地区" clearable style="width: 180px;" />
      </el-form-item>
      <el-form-item label="客户状态">
        <el-select v-model="queryForm.status" placeholder="请选择" clearable style="width: 160px;">
          <el-option label="启用" value="active" />
          <el-option label="暂停" value="suspended" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="handleReset">重置</el-button>
        <el-button type="success" @click="handleCreate">新增</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="16">
      <el-col :xs="24" :sm="12" :lg="6">
        <el-card shadow="hover" class="summary-card">
          <div class="summary-title">客户总数</div>
          <div class="summary-value">{{ summary.totalCustomers }}</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="6">
        <el-card shadow="hover" class="summary-card">
          <div class="summary-title">启用客户</div>
          <div class="summary-value">{{ summary.activeCustomers }}</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="6">
        <el-card shadow="hover" class="summary-card">
          <div class="summary-title">年度销售额</div>
          <div class="summary-value">¥ {{ formatAmount(summary.annualSales) }}</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="6">
        <el-card shadow="hover" class="summary-card">
          <div class="summary-title">跟进记录</div>
          <div class="summary-value">{{ summary.followRecords }}</div>
        </el-card>
      </el-col>
    </el-row>

    <template v-if="tableData.length">
      <el-table
        :data="tableData"
        border
        height="calc(100vh - 320px)"
        row-key="id"
        @row-dblclick="handleRowDblClick"
      >
        <el-table-column type="expand">
          <template #default="{ row }">
            <el-table :data="row.followRecords" border size="small" row-key="id" style="width: 100%;">
              <el-table-column type="index" label="序号" width="60" />
              <el-table-column prop="followTime" label="跟进时间" width="160" />
              <el-table-column prop="staff" label="跟进人" width="140" />
              <el-table-column prop="content" label="沟通内容" min-width="200" show-overflow-tooltip />
              <el-table-column prop="nextPlan" label="后续计划" min-width="200" show-overflow-tooltip />
            </el-table>
          </template>
        </el-table-column>
        <el-table-column prop="customerCode" label="客户编码" min-width="140" />
        <el-table-column prop="customerName" label="客户名称" min-width="180" />
        <el-table-column prop="level" label="客户等级" width="120" align="center">
          <template #default="{ row }">
            <el-tag :type="levelTagType[row.level]">{{ row.level }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="contact" label="联系人" width="140" />
        <el-table-column prop="phone" label="联系电话" width="160" />
        <el-table-column prop="region" label="所在地区" min-width="160" />
        <el-table-column label="客户状态" width="120" align="center">
          <template #default="{ row }">
            <el-tag :type="statusTagMap[row.status].type">{{ statusTagMap[row.status].label }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="salesAmount" label="年度销售额" width="140" align="right">
          <template #default="{ row }">
            ¥ {{ formatAmount(row.salesAmount) }}
          </template>
        </el-table-column>
        <el-table-column prop="lastFollowDate" label="最近跟进" width="140" />
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="handleEdit(row)">编辑</el-button>
            <el-button type="danger" link @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="flex justify-end">
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
    </template>
    <el-empty
      v-else
      description="暂无客户数据"
      class="rounded-lg bg-[var(--el-bg-color-overlay)] py-16"
      image-size="180"
    />

    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="1200px"
      :close-on-click-modal="false"
      @closed="handleDialogClosed"
    >
      <el-form ref="dialogFormRef" :model="dialogForm" :rules="dialogRules" label-width="100px">
        <el-row :gutter="16">
          <el-col :xs="24" :md="12">
            <el-form-item label="客户编码" prop="customerCode">
              <el-input v-model="dialogForm.customerCode" placeholder="请输入客户编码" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="12">
            <el-form-item label="客户名称" prop="customerName">
              <el-input v-model="dialogForm.customerName" placeholder="请输入客户名称" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="12">
            <el-form-item label="客户等级" prop="level">
              <el-select v-model="dialogForm.level" placeholder="请选择客户等级">
                <el-option v-for="item in levelOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="12">
            <el-form-item label="客户状态" prop="status">
              <el-select v-model="dialogForm.status" placeholder="请选择客户状态">
                <el-option label="启用" value="active" />
                <el-option label="暂停" value="suspended" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="12">
            <el-form-item label="联系人" prop="contact">
              <el-input v-model="dialogForm.contact" placeholder="请输入联系人" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="12">
            <el-form-item label="联系电话" prop="phone">
              <el-input v-model="dialogForm.phone" placeholder="请输入联系电话" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="12">
            <el-form-item label="电子邮箱" prop="email">
              <el-input v-model="dialogForm.email" placeholder="请输入邮箱" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="12">
            <el-form-item label="所在地区" prop="region">
              <el-input v-model="dialogForm.region" placeholder="请输入所在地区" />
            </el-form-item>
          </el-col>
          <el-col :xs="24">
            <el-form-item label="详细地址" prop="address">
              <el-input v-model="dialogForm.address" placeholder="请输入详细地址" />
            </el-form-item>
          </el-col>
          <el-col :xs="24">
            <el-form-item label="备注">
              <el-input v-model="dialogForm.remark" type="textarea" :rows="2" placeholder="可记录合作背景、特殊条款等" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="跟进记录" required>
          <el-table :data="dialogForm.followRecords" border size="small" row-key="id" style="width: 100%;">
            <el-table-column type="index" label="序号" width="60" />
            <el-table-column label="跟进时间" width="180">
              <template #default="{ row }">
                <el-date-picker v-model="row.followTime" type="datetime" value-format="YYYY-MM-DD HH:mm" placeholder="选择时间" />
              </template>
            </el-table-column>
            <el-table-column label="跟进人" width="140">
              <template #default="{ row }">
                <el-input v-model="row.staff" placeholder="填写跟进人" />
              </template>
            </el-table-column>
            <el-table-column label="沟通内容" min-width="220">
              <template #default="{ row }">
                <el-input v-model="row.content" placeholder="本次沟通内容" />
              </template>
            </el-table-column>
            <el-table-column label="后续计划" min-width="220">
              <template #default="{ row }">
                <el-input v-model="row.nextPlan" placeholder="下次行动计划" />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="100" align="center">
              <template #default="{ $index }">
                <el-button type="danger" link @click="removeFollowRecord($index)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
          <div class="flex justify-between items-center mt-2">
            <el-button type="primary" plain @click="addFollowRecord">新增跟进</el-button>
            <span class="text-sm text-[var(--el-text-color-secondary)]">
              共 {{ dialogForm.followRecords.length }} 条跟进记录
            </span>
          </div>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="dialogSubmitting" @click="submitDialogForm">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { nextTick, reactive, ref } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage, ElMessageBox } from 'element-plus'

type CustomerLevel = 'A' | 'B' | 'C'
type CustomerStatus = 'active' | 'suspended'

interface FollowRecord {
  id: number
  followTime: string
  staff: string
  content: string
  nextPlan: string
}

interface Customer {
  id: number
  customerCode: string
  customerName: string
  level: CustomerLevel
  contact: string
  phone: string
  email: string
  region: string
  address: string
  status: CustomerStatus
  salesAmount: number
  lastFollowDate: string
  followRecords: FollowRecord[]
  remark: string
}

interface CustomerQuery {
  customerCode: string
  customerName: string
  level: '' | CustomerLevel
  region: string
  status: '' | CustomerStatus
}

interface CustomerTableRow extends Customer {}

type CustomerPayload = Omit<Customer, 'id'>

const levelOptions = [
  { label: 'A', value: 'A' as CustomerLevel },
  { label: 'B', value: 'B' as CustomerLevel },
  { label: 'C', value: 'C' as CustomerLevel }
]

const levelTagType: Record<CustomerLevel, 'success' | 'warning' | 'info'> = {
  A: 'success',
  B: 'warning',
  C: 'info'
}

const statusTagMap: Record<CustomerStatus, { label: string; type: 'success' | 'info' }> = {
  active: { label: '启用', type: 'success' },
  suspended: { label: '暂停', type: 'info' }
}

const queryFormRef = ref<FormInstance>()
const queryForm = reactive<CustomerQuery>({
  customerCode: '',
  customerName: '',
  level: '',
  region: '',
  status: ''
})

const pagination = reactive({
  page: 1,
  size: 10
})

const dialogVisible = ref(false)
const dialogTitle = ref('')
const dialogSubmitting = ref(false)
const dialogFormRef = ref<FormInstance>()
const currentCustomerId = ref<number | null>(null)

const followIdSeed = ref(1)

const dialogRules: FormRules<CustomerPayload> = {
  customerCode: [{ required: true, message: '请输入客户编码', trigger: 'blur' }],
  customerName: [{ required: true, message: '请输入客户名称', trigger: 'blur' }],
  contact: [{ required: true, message: '请输入联系人', trigger: 'blur' }],
  phone: [
    { required: true, message: '请输入联系电话', trigger: 'blur' },
    { pattern: /^\d{3,20}$/, message: '请输入正确的电话格式', trigger: 'blur' }
  ]
}

const mockCustomers = ref<Customer[]>([
  {
    id: 1,
    customerCode: 'CUS-001',
    customerName: '华东制造有限公司',
    level: 'A',
    contact: '刘芳',
    phone: '021-62345678',
    email: 'client@hdmfg.com',
    region: '上海市',
    address: '浦东新区张江高科产业园',
    status: 'active',
    salesAmount: 320000,
    lastFollowDate: '2024-02-15',
    remark: '重点制造客户，年度框架协议',
    followRecords: [
      {
        id: 1,
        followTime: '2024-02-15 14:30',
        staff: '张伟',
        content: '确认第二季度采购计划，预计增加30%产线升级订单',
        nextPlan: '三月初提供报价方案'
      },
      {
        id: 2,
        followTime: '2024-01-10 09:00',
        staff: '李娜',
        content: '设备维保回访，客户反馈良好',
        nextPlan: '跟进售后满意度调查'
      }
    ]
  },
  {
    id: 2,
    customerCode: 'CUS-008',
    customerName: '远航国际贸易',
    level: 'B',
    contact: '陈俊',
    phone: '0755-86771234',
    email: 'service@yuahang.com',
    region: '深圳市',
    address: '南山区前海路弘毅中心18楼',
    status: 'active',
    salesAmount: 186000,
    lastFollowDate: '2024-01-28',
    remark: '外贸出口客户，付款周期 30 天',
    followRecords: [
      {
        id: 3,
        followTime: '2024-01-28 11:10',
        staff: '赵磊',
        content: '确认东南亚项目货期，客户要求提前一周发货',
        nextPlan: '协调供应链调整排产'
      }
    ]
  },
  {
    id: 3,
    customerCode: 'CUS-015',
    customerName: '星辰工业',
    level: 'C',
    contact: '王京',
    phone: '010-66553322',
    email: 'info@xingchen.com',
    region: '北京市',
    address: '亦庄经济开发区创新园B座',
    status: 'suspended',
    salesAmount: 89000,
    lastFollowDate: '2023-12-12',
    remark: '工厂搬迁阶段，目前暂停大额采购',
    followRecords: [
      {
        id: 4,
        followTime: '2023-12-12 16:40',
        staff: '刘超',
        content: '客户通知明年三月份重新规划生产线',
        nextPlan: '三月初拜访'
      }
    ]
  }
])

const syncFollowIdSeed = () => {
  const ids = mockCustomers.value.flatMap((customer) => customer.followRecords.map((record) => record.id))
  followIdSeed.value = (ids.length ? Math.max(...ids) : 0) + 1
}

syncFollowIdSeed()

const dialogForm = reactive<CustomerPayload>(createEmptyCustomer())
const tableData = ref<CustomerTableRow[]>([])
const total = ref(0)
const summary = reactive({
  totalCustomers: 0,
  activeCustomers: 0,
  annualSales: 0,
  followRecords: 0
})

const filterCustomers = (): Customer[] => {
  const code = queryForm.customerCode.trim().toLowerCase()
  const name = queryForm.customerName.trim().toLowerCase()
  const level = queryForm.level
  const region = queryForm.region.trim().toLowerCase()
  const status = queryForm.status

  return mockCustomers.value.filter((item) => {
    const matchesCode = code ? item.customerCode.toLowerCase().includes(code) : true
    const matchesName = name ? item.customerName.toLowerCase().includes(name) : true
    const matchesLevel = level ? item.level === level : true
    const matchesRegion = region ? item.region.toLowerCase().includes(region) : true
    const matchesStatus = status ? item.status === status : true
    return matchesCode && matchesName && matchesLevel && matchesRegion && matchesStatus
  })
}

const updateSummary = (customers: Customer[]) => {
  summary.totalCustomers = customers.length
  summary.activeCustomers = customers.filter((item) => item.status === 'active').length
  summary.annualSales = customers.reduce((acc, item) => acc + (Number(item.salesAmount) || 0), 0)
  summary.followRecords = customers.reduce((acc, item) => acc + item.followRecords.length, 0)
}

const refreshTable = () => {
  const filtered = filterCustomers()
  total.value = filtered.length

  if (filtered.length === 0) {
    pagination.page = 1
    tableData.value = []
    updateSummary(filtered)
    return
  }

  const maxPage = Math.max(1, Math.ceil(filtered.length / pagination.size))
  if (pagination.page > maxPage) {
    pagination.page = maxPage
  }

  const startIndex = (pagination.page - 1) * pagination.size
  tableData.value = filtered.slice(startIndex, startIndex + pagination.size).map((customer) => ({
    ...customer
  }))
  updateSummary(filtered)
}

const handleSearch = () => {
  pagination.page = 1
  refreshTable()
}

const handleReset = () => {
  queryForm.customerCode = ''
  queryForm.customerName = ''
  queryForm.level = ''
  queryForm.region = ''
  queryForm.status = ''
  pagination.page = 1
  refreshTable()
}

const handleSizeChange = (size: number) => {
  pagination.size = size
  pagination.page = 1
  refreshTable()
}

const handleCurrentChange = (page: number) => {
  pagination.page = page
  refreshTable()
}

const handleCreate = async () => {
  dialogTitle.value = '新增客户'
  currentCustomerId.value = null
  assignDialogForm(createEmptyCustomer())
  dialogVisible.value = true
  await nextTick()
  dialogFormRef.value?.clearValidate()
}

const handleRowDblClick = (row: CustomerTableRow) => {
  void openEditDialog(row.id)
}

const handleEdit = (row: CustomerTableRow) => {
  void openEditDialog(row.id)
}

const openEditDialog = async (id: number) => {
  const customer = mockCustomers.value.find((item) => item.id === id)
  if (!customer) {
    ElMessage.error('客户不存在')
    return
  }
  dialogTitle.value = '编辑客户'
  currentCustomerId.value = id
  assignDialogForm({ ...customer, followRecords: customer.followRecords.map((record) => ({ ...record })) })
  dialogVisible.value = true
  await nextTick()
  dialogFormRef.value?.clearValidate()
}

const assignDialogForm = (payload: CustomerPayload) => {
  dialogForm.customerCode = payload.customerCode
  dialogForm.customerName = payload.customerName
  dialogForm.level = payload.level
  dialogForm.contact = payload.contact
  dialogForm.phone = payload.phone
  dialogForm.email = payload.email
  dialogForm.region = payload.region
  dialogForm.address = payload.address
  dialogForm.status = payload.status
  dialogForm.salesAmount = payload.salesAmount
  dialogForm.lastFollowDate = payload.lastFollowDate
  dialogForm.remark = payload.remark
  dialogForm.followRecords.splice(0, dialogForm.followRecords.length, ...payload.followRecords.map((record) => ({ ...record })))
  if (!dialogForm.followRecords.length) {
    dialogForm.followRecords.push(createEmptyFollowRecord())
  }
}

function createEmptyFollowRecord(): FollowRecord {
  return {
    id: followIdSeed.value++,
    followTime: '',
    staff: '',
    content: '',
    nextPlan: ''
  }
}

function createEmptyCustomer(): CustomerPayload {
  return {
    customerCode: '',
    customerName: '',
    level: 'A',
    contact: '',
    phone: '',
    email: '',
    region: '',
    address: '',
    status: 'active',
    salesAmount: 0,
    lastFollowDate: '',
    remark: '',
    followRecords: [createEmptyFollowRecord()]
  }
}

const addFollowRecord = () => {
  dialogForm.followRecords.push(createEmptyFollowRecord())
}

const removeFollowRecord = (index: number) => {
  if (dialogForm.followRecords.length <= 1) {
    ElMessage.warning('至少保留一条跟进记录')
    return
  }
  dialogForm.followRecords.splice(index, 1)
}

const submitDialogForm = async () => {
  if (!dialogFormRef.value) return

  try {
    await dialogFormRef.value.validate()
  } catch {
    return
  }

  if (!dialogForm.followRecords.length) {
    ElMessage.error('请至少添加一条跟进记录')
    return
  }

  const invalidFollow = dialogForm.followRecords.find(
    (item) => !item.followTime || !item.staff.trim() || !item.content.trim()
  )
  if (invalidFollow) {
    ElMessage.error('请完善跟进时间、跟进人和沟通内容')
    return
  }

  const payload = cloneCustomerPayload(dialogForm)
  dialogSubmitting.value = true

  try {
    if (currentCustomerId.value === null) {
      await createCustomer(payload)
      pagination.page = 1
      ElMessage.success('新增客户成功')
    } else {
      await updateCustomer(currentCustomerId.value, payload)
      ElMessage.success('更新客户成功')
    }
    dialogVisible.value = false
    refreshTable()
  } catch (error) {
    ElMessage.error((error as Error).message || '保存失败')
  } finally {
    dialogSubmitting.value = false
  }
}

const cloneCustomerPayload = (source: CustomerPayload): CustomerPayload => ({
  customerCode: source.customerCode,
  customerName: source.customerName,
  level: source.level,
  contact: source.contact,
  phone: source.phone,
  email: source.email,
  region: source.region,
  address: source.address,
  status: source.status,
  salesAmount: source.salesAmount,
  lastFollowDate: source.lastFollowDate,
  remark: source.remark,
  followRecords: source.followRecords.map((record) => ({ ...record }))
})

const createCustomer = async (payload: CustomerPayload): Promise<Customer> => {
  await wait(200)
  const nextId = mockCustomers.value.length > 0 ? Math.max(...mockCustomers.value.map((item) => item.id)) + 1 : 1
  const customer: Customer = {
    id: nextId,
    ...payload
  }
  mockCustomers.value.unshift(customer)
  syncFollowIdSeed()
  return JSON.parse(JSON.stringify(customer))
}

const updateCustomer = async (id: number, payload: CustomerPayload): Promise<Customer> => {
  await wait(200)
  const index = mockCustomers.value.findIndex((item) => item.id === id)
  if (index === -1) throw new Error('客户不存在')
  const updated: Customer = {
    id,
    ...payload
  }
  mockCustomers.value.splice(index, 1, updated)
  syncFollowIdSeed()
  return JSON.parse(JSON.stringify(updated))
}

const removeCustomer = async (id: number): Promise<void> => {
  await wait(200)
  const index = mockCustomers.value.findIndex((item) => item.id === id)
  if (index === -1) throw new Error('客户不存在')
  mockCustomers.value.splice(index, 1)
  syncFollowIdSeed()
}

const handleDelete = async (row: CustomerTableRow) => {
  try {
    await ElMessageBox.confirm(`确认删除客户 ${row.customerName} 吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    await removeCustomer(row.id)
    refreshTable()
    ElMessage.success('删除成功')
  } catch (error) {
    if (error === 'cancel' || error === 'close') return
    if (error instanceof Error) {
      ElMessage.error(error.message || '删除失败')
    }
  }
}

const handleDialogClosed = () => {
  assignDialogForm(createEmptyCustomer())
  currentCustomerId.value = null
  dialogFormRef.value?.clearValidate()
}

const wait = (ms: number) => new Promise<void>((resolve) => {
  globalThis.setTimeout(resolve, ms)
})

const formatAmount = (value: number) => Number(value ?? 0).toFixed(2)

refreshTable()

</script>

<style scoped>
.summary-card {
  border: none;
  background: linear-gradient(145deg, rgba(64, 158, 255, 0.08), rgba(64, 158, 255, 0.02));
}

.summary-title {
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

.summary-value {
  margin-top: 8px;
  font-size: 24px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
</style>
