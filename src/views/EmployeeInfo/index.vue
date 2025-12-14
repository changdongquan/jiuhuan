<template>
  <div class="employee-info-page p-4 space-y-4">
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
      <el-form-item label="员工姓名">
        <el-input v-model="queryForm.employeeName" placeholder="请输入员工姓名" clearable />
      </el-form-item>
      <el-form-item label="工号">
        <el-input v-model="queryForm.employeeNumber" placeholder="请输入工号" clearable />
      </el-form-item>
      <el-form-item label="部门">
        <el-input v-model="queryForm.department" placeholder="请输入部门" clearable />
      </el-form-item>
      <el-form-item label="在职状态">
        <el-select
          v-model="queryForm.status"
          placeholder="请选择状态"
          clearable
          :style="{ width: isMobile ? '100%' : '120px' }"
        >
          <el-option label="在职" value="在职" />
          <el-option label="离职" value="离职" />
          <el-option label="休假" value="休假" />
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
    <div v-if="isMobile && viewMode === 'card' && tableData.length" class="ei-mobile-list">
      <el-card v-for="item in tableData" :key="item.id" class="ei-mobile-card" shadow="hover">
        <div class="ei-mobile-card__header">
          <div>
            <div class="ei-mobile-card__name">{{ item.employeeName }}</div>
            <div class="ei-mobile-card__number">工号：{{ item.employeeNumber }}</div>
          </div>
          <el-tag size="small" :type="statusTagMap[item.status].type">
            {{ statusTagMap[item.status].label }}
          </el-tag>
        </div>
        <div class="ei-mobile-card__meta">
          <div>
            <span class="label">性别</span>
            <span class="value">{{ item.gender || '-' }}</span>
          </div>
          <div>
            <span class="label">职级</span>
            <span class="value">{{ item.level || '-' }}</span>
          </div>
          <div>
            <span class="label">部门</span>
            <span class="value">{{ item.department || '-' }}</span>
          </div>
          <div>
            <span class="label">岗位</span>
            <span class="value">{{ item.position || '-' }}</span>
          </div>
          <div>
            <span class="label">联系方式</span>
            <span class="value">{{ item.phone || '-' }}</span>
          </div>
          <div>
            <span class="label">入职时间</span>
            <span class="value">{{ formatDate(item.entryDate) || '-' }}</span>
          </div>
        </div>
        <div class="ei-mobile-card__actions">
          <el-button size="small" type="primary" @click="handleEdit(item)">编辑</el-button>
          <el-button size="small" type="danger" @click="handleDelete(item)">删除</el-button>
        </div>
      </el-card>
    </div>

    <div
      v-if="!isMobile || viewMode === 'table'"
      class="ei-table-wrapper"
      :class="{ 'ei-table-wrapper--mobile': isMobile }"
    >
      <el-table
        ref="tableRef"
        v-loading="loading"
        :data="tableData"
        border
        :height="isMobile ? undefined : 'calc(100vh - 320px)'"
        row-key="id"
        @row-dblclick="handleRowDblClick"
        class="ei-table"
      >
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="employeeName" label="姓名" width="100" />
        <el-table-column prop="employeeNumber" label="工号" width="80" />
        <el-table-column prop="gender" label="性别" width="80" />
        <el-table-column prop="level" label="职级" width="80" />
        <el-table-column prop="entryDate" label="入职时间" width="120">
          <template #default="{ row }">
            {{ formatDate(row.entryDate) }}
          </template>
        </el-table-column>
        <el-table-column prop="idCard" label="身份证号码" min-width="160" show-overflow-tooltip />
        <el-table-column prop="department" label="部门" width="100" />
        <el-table-column prop="position" label="岗位" width="100" />
        <el-table-column prop="phone" label="联系方式" width="140" />
        <el-table-column prop="emergencyContact" label="紧急联系人" min-width="140" />
        <el-table-column label="在职状态" width="120" align="center">
          <template #default="{ row }">
            <el-tag :type="statusTagMap[row.status].type">{{
              statusTagMap[row.status].label
            }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="confirmDate" label="转正日期" width="140">
          <template #default="{ row }">
            {{ formatDate(row.confirmDate) }}
          </template>
        </el-table-column>
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

    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      :width="isMobile ? '100%' : '800px'"
      :fullscreen="isMobile"
      :close-on-click-modal="false"
      @closed="handleDialogClosed"
    >
      <el-form
        ref="dialogFormRef"
        :model="dialogForm"
        :rules="dialogRules"
        label-width="100px"
        size="small"
        class="employee-dialog-form"
      >
        <!-- PC 端：左右两列布局 -->
        <el-row v-if="!isMobile" :gutter="16">
          <!-- 左1：姓名 / 右1：工号 -->
          <el-col :xs="24" :md="12">
            <el-form-item label="姓名" prop="employeeName">
              <el-input v-model="dialogForm.employeeName" placeholder="请输入姓名" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="12">
            <el-form-item label="工号" prop="employeeNumber">
              <el-input v-model="dialogForm.employeeNumber" placeholder="请输入工号" />
            </el-form-item>
          </el-col>

          <!-- 左2：职级 / 右2：性别 -->
          <el-col :xs="24" :md="12">
            <el-form-item label="职级" prop="level">
              <el-input-number v-model="dialogForm.level" :min="0" placeholder="请输入职级" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="12">
            <el-form-item label="性别" prop="gender">
              <el-select v-model="dialogForm.gender" placeholder="请选择性别">
                <el-option label="男" value="男" />
                <el-option label="女" value="女" />
              </el-select>
            </el-form-item>
          </el-col>

          <!-- 左3：部门 / 右3：身份证号码 -->
          <el-col :xs="24" :md="12">
            <el-form-item label="部门" prop="department">
              <el-input v-model="dialogForm.department" placeholder="请输入部门" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="12">
            <el-form-item label="身份证号码" prop="idCard">
              <el-input v-model="dialogForm.idCard" placeholder="请输入身份证号码" />
            </el-form-item>
          </el-col>

          <!-- 左4：岗位 / 右4：联系方式 -->
          <el-col :xs="24" :md="12">
            <el-form-item label="岗位" prop="position">
              <el-input v-model="dialogForm.position" placeholder="请输入岗位" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="12">
            <el-form-item label="联系方式" prop="phone">
              <el-input v-model="dialogForm.phone" placeholder="请输入联系方式" />
            </el-form-item>
          </el-col>

          <!-- 左5：入职时间 / 右5：紧急联系人 -->
          <el-col :xs="24" :md="12">
            <el-form-item label="入职时间" prop="entryDate">
              <el-date-picker
                v-model="dialogForm.entryDate"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="请选择入职时间"
              />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="12">
            <el-form-item label="紧急联系人" prop="emergencyContact">
              <el-input v-model="dialogForm.emergencyContact" placeholder="请输入紧急联系人" />
            </el-form-item>
          </el-col>

          <!-- 左6：在职状态 / 右6：银行名称 -->
          <el-col :xs="24" :md="12">
            <el-form-item label="在职状态" prop="status">
              <el-select v-model="dialogForm.status" placeholder="请选择状态">
                <el-option label="在职" value="在职" />
                <el-option label="离职" value="离职" />
                <el-option label="休假" value="休假" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="12">
            <el-form-item label="银行名称" prop="bankName">
              <el-input v-model="dialogForm.bankName" placeholder="请输入银行名称" />
            </el-form-item>
          </el-col>

          <!-- 左7：转正日期 / 右7：银行账号 -->
          <el-col :xs="24" :md="12">
            <el-form-item label="转正日期" prop="confirmDate">
              <el-date-picker
                v-model="dialogForm.confirmDate"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="请选择转正日期"
              />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="12">
            <el-form-item label="银行账号" prop="bankAccount">
              <el-input v-model="dialogForm.bankAccount" placeholder="请输入银行账号" />
            </el-form-item>
          </el-col>

          <!-- 左8：离职日期 / 右8：开户行 -->
          <el-col :xs="24" :md="12">
            <el-form-item label="离职日期" prop="leaveDate">
              <el-date-picker
                v-model="dialogForm.leaveDate"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="请选择离职日期"
              />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="12">
            <el-form-item label="开户行" prop="bankBranch">
              <el-input v-model="dialogForm.bankBranch" placeholder="请输入开户行" />
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 手机端：按指定顺序单列展示 -->
        <el-row v-else :gutter="12">
          <el-col :span="24">
            <el-form-item label="姓名" prop="employeeName">
              <el-input v-model="dialogForm.employeeName" placeholder="请输入姓名" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="工号" prop="employeeNumber">
              <el-input v-model="dialogForm.employeeNumber" placeholder="请输入工号" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="性别" prop="gender">
              <el-select v-model="dialogForm.gender" placeholder="请选择性别">
                <el-option label="男" value="男" />
                <el-option label="女" value="女" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="身份证号" prop="idCard">
              <el-input v-model="dialogForm.idCard" placeholder="请输入身份证号" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="部门" prop="department">
              <el-input v-model="dialogForm.department" placeholder="请输入部门" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="岗位" prop="position">
              <el-input v-model="dialogForm.position" placeholder="请输入岗位" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="职级" prop="level">
              <el-input-number v-model="dialogForm.level" :min="0" placeholder="请输入职级" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="联系方式" prop="phone">
              <el-input v-model="dialogForm.phone" placeholder="请输入联系方式" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="紧急联系人" prop="emergencyContact">
              <el-input v-model="dialogForm.emergencyContact" placeholder="请输入紧急联系人" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="在职状态" prop="status">
              <el-select v-model="dialogForm.status" placeholder="请选择状态">
                <el-option label="在职" value="在职" />
                <el-option label="离职" value="离职" />
                <el-option label="休假" value="休假" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="入职日期" prop="entryDate">
              <el-date-picker
                v-model="dialogForm.entryDate"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="请选择入职日期"
              />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="转正日期" prop="confirmDate">
              <el-date-picker
                v-model="dialogForm.confirmDate"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="请选择转正日期"
              />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="离职日期" prop="leaveDate">
              <el-date-picker
                v-model="dialogForm.leaveDate"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="请选择离职日期"
              />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="银行名称" prop="bankName">
              <el-input v-model="dialogForm.bankName" placeholder="请输入银行名称" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="银行账号" prop="bankAccount">
              <el-input v-model="dialogForm.bankAccount" placeholder="请输入银行账号" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="开户行" prop="bankBranch">
              <el-input v-model="dialogForm.bankBranch" placeholder="请输入开户行" />
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
  ElCol,
  ElDatePicker,
  ElDialog,
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
  getEmployeeListApi,
  getEmployeeDetailApi,
  createEmployeeApi,
  updateEmployeeApi,
  deleteEmployeeApi,
  type EmployeeInfo,
  type EmployeeQueryParams
} from '@/api/employee'
import { useAppStore } from '@/store/modules/app'

type EmployeePayload = Omit<EmployeeInfo, 'id'>

const statusTagMap: Record<
  string,
  { label: string; type: 'success' | 'warning' | 'info' | 'danger' }
> = {
  在职: { label: '在职', type: 'success' },
  离职: { label: '离职', type: 'danger' },
  休假: { label: '休假', type: 'info' }
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
const queryForm = reactive<EmployeeQueryParams>({
  employeeName: '',
  employeeNumber: '',
  department: '',
  status: ''
})

const pagination = reactive({ page: 1, size: 20 })
const tableData = ref<EmployeeInfo[]>([])
const total = ref(0)
const loading = ref(false)

const dialogVisible = ref(false)
const dialogTitle = ref('')
const dialogSubmitting = ref(false)
const dialogFormRef = ref<FormInstance>()
const currentEmployeeId = ref<number | null>(null)

const createEmptyEmployee = (): EmployeePayload => ({
  employeeName: '',
  employeeNumber: 0,
  gender: '',
  level: 0,
  entryDate: '',
  leaveDate: '',
  idCard: '',
  department: '',
  position: '',
  phone: '',
  emergencyContact: '',
  status: '在职',
  confirmDate: '',
  bankName: '',
  bankAccount: '',
  bankBranch: ''
})

const dialogForm = reactive<EmployeePayload>(createEmptyEmployee())

const dialogRules: FormRules<EmployeePayload> = {
  employeeName: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  employeeNumber: [{ required: true, message: '请输入工号', trigger: 'blur' }],
  gender: [{ required: true, message: '请选择性别', trigger: 'change' }],
  level: [{ required: true, message: '请输入职级', trigger: 'blur' }],
  entryDate: [{ required: true, message: '请选择入职时间', trigger: 'change' }],
  idCard: [{ required: true, message: '请输入身份证号码', trigger: 'blur' }],
  department: [{ required: true, message: '请输入部门', trigger: 'blur' }],
  position: [{ required: true, message: '请输入岗位', trigger: 'blur' }],
  phone: [{ required: true, message: '请输入联系方式', trigger: 'blur' }],
  emergencyContact: [{ required: true, message: '请输入紧急联系人', trigger: 'blur' }],
  status: [{ required: true, message: '请选择在职状态', trigger: 'change' }]
}

// 员工数据将从API获取

const tableRef = ref()

const loadEmployeeData = async () => {
  loading.value = true
  try {
    const params: EmployeeQueryParams = {
      page: pagination.page,
      pageSize: pagination.size,
      ...queryForm
    }
    const response = (await getEmployeeListApi(params)) as any
    // 处理统一响应格式：{ code: 0, data: { list, total, page, pageSize } }
    if (response.code === 0 && response.data) {
      tableData.value = response.data.list || []
      total.value = response.data.total || 0
    } else {
      // 兼容旧格式
      tableData.value = response.list || []
      total.value = response.total || 0
    }
  } catch (error) {
    console.error('加载员工数据失败:', error)
    ElMessage.error('加载员工数据失败')
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  pagination.page = 1
  void loadEmployeeData()
}

const handleReset = () => {
  queryForm.employeeName = ''
  queryForm.employeeNumber = ''
  queryForm.department = ''
  queryForm.status = ''
  pagination.page = 1
  void loadEmployeeData()
}

const handleSizeChange = (size: number) => {
  pagination.size = size
  pagination.page = 1
  void loadEmployeeData()
}

const handleCurrentChange = (page: number) => {
  pagination.page = page
  void loadEmployeeData()
}

const handleCreate = async () => {
  dialogTitle.value = '新增员工'
  currentEmployeeId.value = null
  assignDialogForm(createEmptyEmployee())
  dialogVisible.value = true
  await nextTick()
  dialogFormRef.value?.clearValidate()
}

const handleRowDblClick = (row: EmployeeInfo) => {
  void openEditDialog(row.id)
}

const handleEdit = (row: EmployeeInfo) => {
  void openEditDialog(row.id)
}

const openEditDialog = async (id: number) => {
  try {
    const response = (await getEmployeeDetailApi(id)) as any
    dialogTitle.value = '编辑员工'
    currentEmployeeId.value = id
    assignDialogForm(response.data || response)
    dialogVisible.value = true
    await nextTick()
    dialogFormRef.value?.clearValidate()
  } catch (error) {
    console.error('获取员工详情失败:', error)
    ElMessage.error('获取员工详情失败')
  }
}

const assignDialogForm = (payload: EmployeePayload) => {
  dialogForm.employeeName = payload.employeeName || ''
  dialogForm.employeeNumber = payload.employeeNumber || 0
  dialogForm.gender = typeof payload.gender === 'string' ? payload.gender : ''
  dialogForm.level = payload.level || 0
  dialogForm.entryDate = payload.entryDate || ''
  dialogForm.leaveDate = payload.leaveDate || ''
  dialogForm.idCard = payload.idCard || ''
  dialogForm.department = payload.department || ''
  dialogForm.position = payload.position || ''
  dialogForm.phone = payload.phone || ''
  dialogForm.emergencyContact = payload.emergencyContact || ''
  dialogForm.status = payload.status || '在职'
  dialogForm.confirmDate = payload.confirmDate || ''
  dialogForm.bankName = payload.bankName || ''
  dialogForm.bankAccount = payload.bankAccount || ''
  dialogForm.bankBranch = payload.bankBranch || ''
}

const submitDialogForm = async () => {
  if (!dialogFormRef.value) return
  try {
    await dialogFormRef.value.validate()
  } catch {
    return
  }

  dialogSubmitting.value = true
  try {
    if (currentEmployeeId.value === null) {
      await createEmployeeApi(dialogForm)
      ElMessage.success('新增员工成功')
    } else {
      await updateEmployeeApi(currentEmployeeId.value, dialogForm)
      ElMessage.success('更新员工成功')
    }
    dialogVisible.value = false
    await loadEmployeeData()
  } catch (error) {
    console.error('保存员工失败:', error)
    ElMessage.error('保存员工失败')
  } finally {
    dialogSubmitting.value = false
  }
}

const handleDelete = async (row: EmployeeInfo) => {
  try {
    await ElMessageBox.confirm(`确认删除员工 ${row.employeeName} 吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await deleteEmployeeApi(row.id)
    if (tableData.value.length === 1 && pagination.page > 1) {
      pagination.page -= 1
    }
    await loadEmployeeData()
    ElMessage.success('删除成功')
  } catch (error) {
    if (error === 'cancel' || error === 'close') return
    console.error('删除员工失败:', error)
    ElMessage.error('删除员工失败')
  }
}

const handleDialogClosed = () => {
  assignDialogForm(createEmptyEmployee())
  currentEmployeeId.value = null
  dialogFormRef.value?.clearValidate()
}

// 格式化日期，只显示年月日
const formatDate = (dateString: string) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

// 组件挂载时加载数据
onMounted(() => {
  void loadEmployeeData()
})
</script>

<style scoped>
.query-form {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

:deep(.query-form .el-form-item) {
  margin-bottom: 0;
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

@media (width <= 768px) {
  .query-form__actions {
    margin-top: 8px;
  }
}

:deep(.query-form .el-form-item:not(.query-form__actions)) {
  margin-right: 18px;
  margin-bottom: 0;
}

.ei-table-wrapper {
  background: var(--el-bg-color);
  border-radius: 8px;
}

.ei-table-wrapper--mobile {
  padding-bottom: 8px;
  overflow-x: auto;
}

.ei-table-wrapper--mobile .ei-table {
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

.ei-mobile-list {
  display: grid;
  gap: 12px;
}

.ei-mobile-card {
  border-radius: 10px;
}

.ei-mobile-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.ei-mobile-card__name {
  font-size: 14px;
  font-weight: 600;
}

.ei-mobile-card__number {
  margin-top: 2px;
  font-size: 13px;
  color: #666;
}

.ei-mobile-card__meta {
  display: grid;
  font-size: 13px;
  color: #555;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px 12px;
}

.ei-mobile-card__meta .label {
  margin-right: 4px;
  color: #888;
}

.ei-mobile-card__actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 6px;
}

.employee-dialog-form {
  padding-top: 8px;
  font-size: 14px;
}

:deep(.employee-dialog-form .el-form-item) {
  margin-bottom: 12px;
}

:deep(.employee-dialog-form .el-form-item__label) {
  font-size: 14px;
  font-weight: normal;
  color: #444;
}

:deep(
  .employee-dialog-form .el-input,
  .employee-dialog-form .el-select,
  .employee-dialog-form .el-date-editor,
  .employee-dialog-form .el-input-number
) {
  width: 100%;
  font-size: 14px;
}

:deep(
  .employee-dialog-form .el-input__inner,
  .employee-dialog-form .el-textarea__inner,
  .employee-dialog-form .el-select__selected-item,
  .employee-dialog-form .el-select__placeholder,
  .employee-dialog-form .el-date-editor .el-input__inner,
  .employee-dialog-form .el-input-number .el-input__inner
) {
  font-size: 14px;
}
</style>
