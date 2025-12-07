<template>
  <div class="customer-info-page p-4 space-y-4">
    <div v-if="isMobile" class="mobile-top-bar">
      <el-button text type="primary" @click="showMobileFilters = !showMobileFilters">
        {{ showMobileFilters ? '收起筛选' : '展开筛选' }}
      </el-button>
      <div class="view-mode-switch">
        <span class="view-mode-switch__label">视图</span>
        <el-radio-group v-model="viewMode" size="small">
          <el-radio-button value="card">卡片</el-radio-button>
          <el-radio-button value="table">表格</el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <el-form
      ref="queryFormRef"
      :model="queryForm"
      :label-width="isMobile ? 'auto' : '90px'"
      :label-position="isMobile ? 'top' : 'right'"
      :inline="!isMobile"
      class="query-form rounded-lg bg-[var(--el-bg-color-overlay)] p-4 shadow-sm"
      :class="{ 'query-form--mobile': isMobile }"
      v-show="!isMobile || showMobileFilters"
    >
      <el-form-item label="客户名称">
        <el-input v-model="queryForm.customerName" placeholder="请输入客户名称" clearable />
      </el-form-item>
      <el-form-item label="联系人">
        <el-input v-model="queryForm.contact" placeholder="请输入联系人" clearable />
      </el-form-item>
      <el-form-item label="客户状态">
        <el-select v-model="queryForm.status" placeholder="请选择" clearable>
          <el-option label="启用" value="active" />
          <el-option label="停用" value="inactive" />
        </el-select>
      </el-form-item>
      <el-form-item class="query-form__actions">
        <div class="query-actions">
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
          <el-button type="success" @click="handleCreate">新增</el-button>
        </div>
      </el-form-item>
    </el-form>

    <!-- 数据卡片（手机端） -->
    <div v-if="isMobile && viewMode === 'card' && tableData.length" class="ci-mobile-list">
      <el-card v-for="item in tableData" :key="item.id" class="ci-mobile-card" shadow="hover">
        <div class="ci-mobile-card__header">
          <div>
            <div class="ci-mobile-card__name">{{ item.customerName }}</div>
            <div class="ci-mobile-card__contact">{{ item.contact || '-' }}</div>
          </div>
          <el-tag size="small" :type="statusTagMap[item.status].type">
            {{ statusTagMap[item.status].label }}
          </el-tag>
        </div>
        <div class="ci-mobile-card__meta">
          <div>
            <span class="label">联系电话</span>
            <span class="value">{{ item.phone || '-' }}</span>
          </div>
          <div>
            <span class="label">电子邮箱</span>
            <span class="value">{{ item.email || '-' }}</span>
          </div>
          <div>
            <span class="label">客户地址</span>
            <span class="value">{{ item.address || '-' }}</span>
          </div>
          <div>
            <span class="label">序号</span>
            <span class="value">{{ item.seqNumber || '-' }}</span>
          </div>
        </div>
        <div class="ci-mobile-card__actions">
          <el-button size="small" type="primary" @click="handleEdit(item)">编辑</el-button>
          <el-button size="small" type="danger" @click="handleDelete(item)">删除</el-button>
        </div>
      </el-card>
    </div>

    <template v-if="tableData.length">
      <div
        v-if="!isMobile || viewMode === 'table'"
        class="ci-table-wrapper"
        :class="{ 'ci-table-wrapper--mobile': isMobile }"
      >
        <el-table
          :data="tableData"
          border
          :height="isMobile ? undefined : 'calc(100vh - 320px)'"
          row-key="id"
          @row-dblclick="handleRowDblClick"
          class="ci-table"
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
      </div>

      <div
        class="pagination-footer"
        :class="{ 'pagination-footer--mobile': isMobile || viewMode === 'card' }"
      >
        <el-pagination
          background
          :layout="paginationLayout"
          :pager-count="paginationPagerCount"
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
      :width="isMobile ? '100%' : '800px'"
      :fullscreen="isMobile"
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
import { nextTick, reactive, ref, onMounted, computed, watch } from 'vue'
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
import { useAppStore } from '@/store/modules/app'

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

const appStore = useAppStore()
const isMobile = computed(() => appStore.getMobile)
const showMobileFilters = ref(false)
type ViewMode = 'table' | 'card'
const viewMode = ref<ViewMode>(isMobile.value ? 'card' : 'table')

watch(isMobile, (mobile) => {
  viewMode.value = mobile ? 'card' : 'table'
})

// 分页组件布局：PC 端保留完整布局，手机端精简，避免内容被遮挡
const paginationLayout = computed(() =>
  isMobile.value || viewMode.value === 'card'
    ? 'total, prev, pager, next'
    : 'total, sizes, prev, pager, next, jumper'
)

// 分页组件页码数量：手机端减少显示的数字页数，避免横向挤压
const paginationPagerCount = computed(() => (isMobile.value || viewMode.value === 'card' ? 5 : 7))

const queryFormRef = ref<FormInstance>()
const queryForm = reactive<CustomerQuery>({
  customerName: '',
  contact: '',
  status: ''
})

const pagination = reactive({
  page: 1,
  size: 20
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
@media (width <= 768px) {
  .query-form__actions {
    margin-top: 8px;
  }
}

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

.query-form--mobile {
  padding: 12px;
}

:deep(.query-form--mobile .el-form-item) {
  width: 100%;
  margin-right: 0;
  margin-bottom: 8px;
}

:deep(.query-form--mobile .el-form-item .el-form-item__content) {
  width: 100%;
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

.ci-table-wrapper {
  background: var(--el-bg-color);
  border-radius: 8px;
}

.ci-table-wrapper--mobile {
  padding-bottom: 8px;
  overflow-x: auto;
}

.ci-table-wrapper--mobile .ci-table {
  min-width: 960px;
}

.pagination-footer {
  position: fixed;
  bottom: 10px;
  left: 50%;
  z-index: 10;
  display: flex;
  transform: translateX(-50%);
  justify-content: center;
}

.pagination-footer--mobile {
  position: static;
  left: auto;
  margin-top: 12px;
  transform: none;
  justify-content: center;
}

.mobile-top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-top: 2px;
}

.view-mode-switch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.view-mode-switch__label {
  font-size: 12px;
  color: #666;
}

.ci-mobile-list {
  display: grid;
  gap: 12px;
}

.ci-mobile-card {
  border-radius: 10px;
}

.ci-mobile-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.ci-mobile-card__name {
  font-size: 14px;
  font-weight: 600;
}

.ci-mobile-card__contact {
  margin-top: 2px;
  font-size: 13px;
  color: #666;
}

.ci-mobile-card__meta {
  display: grid;
  font-size: 13px;
  color: #555;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px 12px;
}

.ci-mobile-card__meta .label {
  margin-right: 4px;
  color: #888;
}

.ci-mobile-card__actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 6px;
}

/* 查询表单垂直居中对齐 */
</style>
