<template>
  <div class="p-4 space-y-4">
    <el-form
      ref="queryFormRef"
      :model="queryForm"
      label-width="90px"
      inline
      class="query-form rounded-lg bg-[var(--el-bg-color-overlay)] p-4 shadow-sm"
    >
      <el-form-item label="客户名称">
        <el-input
          v-model="queryForm.customerName"
          placeholder="请输入客户名称"
          clearable
          style="width: 160px"
        />
      </el-form-item>
      <el-form-item label="联系人">
        <el-input
          v-model="queryForm.contact"
          placeholder="请输入联系人"
          clearable
          style="width: 140px"
        />
      </el-form-item>
      <el-form-item label="客户状态">
        <el-select v-model="queryForm.status" placeholder="请选择" clearable style="width: 160px">
          <el-option label="启用" value="active" />
          <el-option label="停用" value="inactive" />
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
        <el-card shadow="hover" class="summary-card summary-card--blue">
          <div class="summary-title">客户总数</div>
          <div class="summary-value">{{ summary.totalCustomers }}</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="6">
        <el-card shadow="hover" class="summary-card summary-card--green">
          <div class="summary-title">启用客户</div>
          <div class="summary-value">{{ summary.activeCustomers }}</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="6">
        <el-card shadow="hover" class="summary-card summary-card--orange">
          <div class="summary-title">停用客户</div>
          <div class="summary-value">{{ summary.inactiveCustomers }}</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="6">
        <el-card shadow="hover" class="summary-card summary-card--gray">
          <div class="summary-title">有联系方式</div>
          <div class="summary-value">{{ summary.withContact }}</div>
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
        <el-table-column prop="id" label="客户ID" width="80" />
        <el-table-column prop="customerName" label="客户名称" min-width="200" />
        <el-table-column prop="contact" label="联系人" width="120" />
        <el-table-column prop="phone" label="联系电话" width="160" />
        <el-table-column prop="email" label="电子邮箱" min-width="180" />
        <el-table-column prop="address" label="客户地址" min-width="200" show-overflow-tooltip />
        <el-table-column label="客户状态" width="120" align="center">
          <template #default="{ row }">
            <el-tag :type="statusTagMap[row.status].type">{{
              statusTagMap[row.status].label
            }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="seqNumber" label="序号" width="80" align="center" />
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
      :image-size="180"
    />

    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="800px"
      :close-on-click-modal="false"
      @closed="handleDialogClosed"
    >
      <el-form ref="dialogFormRef" :model="dialogForm" :rules="dialogRules" label-width="100px">
        <el-row :gutter="16">
          <el-col :xs="24" :md="12">
            <el-form-item label="客户名称" prop="customerName">
              <el-input v-model="dialogForm.customerName" placeholder="请输入客户名称" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="12">
            <el-form-item label="客户状态" prop="status">
              <el-select v-model="dialogForm.status" placeholder="请选择客户状态">
                <el-option label="启用" value="active" />
                <el-option label="停用" value="inactive" />
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
            <el-form-item label="序号" prop="seqNumber">
              <el-input-number v-model="dialogForm.seqNumber" :min="0" placeholder="请输入序号" />
            </el-form-item>
          </el-col>
          <el-col :xs="24">
            <el-form-item label="客户地址" prop="address">
              <el-input v-model="dialogForm.address" placeholder="请输入客户地址" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="dialogSubmitting" @click="submitDialogForm"
          >保存</el-button
        >
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import {
  ElButton,
  ElCard,
  ElCol,
  ElDialog,
  ElEmpty,
  ElForm,
  ElFormItem,
  ElInput,
  ElInputNumber,
  ElOption,
  ElPagination,
  ElRow,
  ElSelect,
  ElTable,
  ElTableColumn,
  ElTag
} from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { nextTick, reactive, ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getCustomerListApi,
  getCustomerDetailApi,
  createCustomerApi,
  updateCustomerApi,
  deleteCustomerApi,
  getCustomerStatisticsApi,
  type CustomerInfo,
  type CustomerQueryParams
} from '@/api/customer'

type CustomerStatus = 'active' | 'inactive'

interface CustomerQuery {
  customerName: string
  contact: string
  status: '' | CustomerStatus
}

interface CustomerTableRow extends CustomerInfo {
  // 保留结构，后续扩展表格专用字段
  _placeholder?: never
}

type CustomerPayload = Omit<CustomerInfo, 'id'>

const statusTagMap: Record<CustomerStatus, { label: string; type: 'success' | 'info' }> = {
  active: { label: '启用', type: 'success' },
  inactive: { label: '停用', type: 'info' }
}

const queryFormRef = ref<FormInstance>()
const queryForm = reactive<CustomerQuery>({
  customerName: '',
  contact: '',
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

const dialogRules: FormRules<CustomerPayload> = {
  customerName: [{ required: true, message: '请输入客户名称', trigger: 'blur' }],
  contact: [{ required: false, message: '请输入联系人', trigger: 'blur' }],
  phone: [{ required: false, message: '请输入联系电话', trigger: 'blur' }],
  email: [{ type: 'email', message: '请输入正确的邮箱格式', trigger: 'blur' }]
}

// 移除模拟数据，使用真实API数据

const dialogForm = reactive<CustomerPayload>(createEmptyCustomer())
const tableData = ref<CustomerTableRow[]>([])
const total = ref(0)
const summary = reactive({
  totalCustomers: 0,
  activeCustomers: 0,
  inactiveCustomers: 0,
  withContact: 0
})

// 加载客户数据
const loadCustomerData = async () => {
  try {
    const params: CustomerQueryParams = {
      customerName: queryForm.customerName || undefined,
      contact: queryForm.contact || undefined,
      status: queryForm.status || undefined,
      page: pagination.page,
      pageSize: pagination.size
    }

    const response = await getCustomerListApi(params)

    if (response.code === 0) {
      tableData.value = response.data.list
      total.value = response.data.total
    } else {
      ElMessage.error((response as any)?.message || '加载客户数据失败')
    }
  } catch (error) {
    console.error('加载客户数据失败:', error)
    ElMessage.error('加载客户数据失败')
  }
}

// 加载统计信息
const loadStatistics = async () => {
  try {
    const response = await getCustomerStatisticsApi()

    if (response.code === 0) {
      summary.totalCustomers = response.data.totalCustomers
      summary.activeCustomers = response.data.activeCustomers
      summary.inactiveCustomers = response.data.inactiveCustomers
      summary.withContact = response.data.withContact
    }
  } catch (error) {
    console.error('加载统计信息失败:', error)
  }
}

const refreshTable = async () => {
  await loadCustomerData()
  await loadStatistics()
}

const handleSearch = async () => {
  pagination.page = 1
  await refreshTable()
}

const handleReset = async () => {
  queryForm.customerName = ''
  queryForm.contact = ''
  queryForm.status = ''
  pagination.page = 1
  await refreshTable()
}

const handleSizeChange = async (size: number) => {
  pagination.size = size
  pagination.page = 1
  await refreshTable()
}

const handleCurrentChange = async (page: number) => {
  pagination.page = page
  await refreshTable()
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
  try {
    const response = await getCustomerDetailApi(id)
    if (response.code === 0) {
      dialogTitle.value = '编辑客户'
      currentCustomerId.value = id
      assignDialogForm(response.data)
      dialogVisible.value = true
      await nextTick()
      dialogFormRef.value?.clearValidate()
    } else {
      ElMessage.error('客户不存在')
    }
  } catch (error) {
    console.error('获取客户详情失败:', error)
    ElMessage.error('获取客户详情失败')
  }
}

const assignDialogForm = (payload: CustomerPayload) => {
  dialogForm.customerName = payload.customerName
  dialogForm.contact = payload.contact
  dialogForm.phone = payload.phone
  dialogForm.email = payload.email
  dialogForm.address = payload.address
  dialogForm.status = payload.status
  dialogForm.seqNumber = payload.seqNumber
}

function createEmptyCustomer(): CustomerPayload {
  return {
    customerName: '',
    contact: '',
    phone: '',
    email: '',
    address: '',
    status: 'active',
    seqNumber: 0
  }
}

// 移除跟进记录相关函数，因为数据库中没有这个字段

const submitDialogForm = async () => {
  if (!dialogFormRef.value) return

  try {
    await dialogFormRef.value.validate()
  } catch {
    return
  }

  const payload = cloneCustomerPayload(dialogForm)
  dialogSubmitting.value = true

  try {
    if (currentCustomerId.value === null) {
      await createCustomerApi(payload)
      pagination.page = 1
      ElMessage.success('新增客户成功')
    } else {
      await updateCustomerApi(currentCustomerId.value, payload)
      ElMessage.success('更新客户成功')
    }
    dialogVisible.value = false
    await refreshTable()
  } catch (error) {
    ElMessage.error((error as Error).message || '保存失败')
  } finally {
    dialogSubmitting.value = false
  }
}

const cloneCustomerPayload = (source: CustomerPayload): CustomerPayload => ({
  customerName: source.customerName,
  contact: source.contact,
  phone: source.phone,
  email: source.email,
  address: source.address,
  status: source.status,
  seqNumber: source.seqNumber
})

const handleDelete = async (row: CustomerTableRow) => {
  try {
    await ElMessageBox.confirm(`确认删除客户 ${row.customerName} 吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    await deleteCustomerApi(row.id)
    await refreshTable()
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

// 页面初始化
onMounted(async () => {
  await refreshTable()
})
</script>

<style scoped>
/* 查询表单垂直居中对齐 */
.query-form {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

:deep(.query-form .el-form-item) {
  margin-bottom: 0;
}

.summary-card {
  border: none;
  transition: all 0.3s ease;
}

.summary-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgb(0 0 0 / 10%) !important;
}

/* 第一个卡片 - 蓝色 */
.summary-card--blue {
  background: linear-gradient(145deg, rgb(64 158 255 / 12%), rgb(64 158 255 / 6%));
}

.summary-card--blue .summary-title {
  color: #409eff;
}

.summary-card--blue .summary-value {
  color: #409eff;
}

/* 第二个卡片 - 绿色 */
.summary-card--green {
  background: linear-gradient(145deg, rgb(103 194 58 / 12%), rgb(103 194 58 / 6%));
}

.summary-card--green .summary-title {
  color: #67c23a;
}

.summary-card--green .summary-value {
  color: #67c23a;
}

/* 第三个卡片 - 橙色 */
.summary-card--orange {
  background: linear-gradient(145deg, rgb(230 162 60 / 12%), rgb(230 162 60 / 6%));
}

.summary-card--orange .summary-title {
  color: #e6a23c;
}

.summary-card--orange .summary-value {
  color: #e6a23c;
}

/* 第四个卡片 - 灰色 */
.summary-card--gray {
  background: linear-gradient(145deg, rgb(144 147 153 / 12%), rgb(144 147 153 / 6%));
}

.summary-card--gray .summary-title {
  color: #909399;
}

.summary-card--gray .summary-value {
  color: #909399;
}

.summary-title {
  font-size: 14px;
  font-weight: 500;
}

.summary-value {
  margin-top: 8px;
  font-size: 24px;
  font-weight: 600;
}
</style>
