<template>
  <div class="attendance-page px-4 pt-0 pb-2 space-y-3">
    <div v-if="isMobile" class="mobile-top-bar">
      <el-button text type="primary" @click="showMobileFilters = !showMobileFilters">
        {{ showMobileFilters ? '收起筛选' : '展开筛选' }}
      </el-button>
    </div>

    <el-form
      ref="queryFormRef"
      :model="queryForm"
      :label-width="isMobile ? 'auto' : '90px'"
      :label-position="isMobile ? 'top' : 'right'"
      :inline="!isMobile"
      class="query-form rounded-lg bg-[var(--el-bg-color-overlay)] p-3 shadow-sm"
      :class="{ 'query-form--mobile': isMobile }"
      v-show="!isMobile || showMobileFilters"
    >
      <el-form-item label="月份">
        <el-date-picker
          v-model="queryForm.month"
          type="month"
          value-format="YYYY-MM"
          placeholder="选择月份"
          clearable
          :style="{ width: isMobile ? '100%' : '180px' }"
        />
      </el-form-item>
      <el-form-item label="关键词">
        <el-input
          v-model="queryForm.keyword"
          placeholder="月份/备注"
          clearable
          :style="{ width: isMobile ? '100%' : '220px' }"
        />
      </el-form-item>
      <el-form-item class="query-form__actions">
        <div class="query-actions">
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
          <el-button type="success" @click="handleCreate">新增</el-button>
          <el-button type="info" plain @click="downloadTemplate">下载模板</el-button>
        </div>
      </el-form-item>
    </el-form>

    <!-- 列表 -->
    <div class="att-table-wrapper" v-loading="loading">
      <el-empty v-if="!tableData.length && !loading" description="暂无考勤数据" />
      <el-table
        v-else
        :data="tableData"
        border
        :height="isMobile ? undefined : 'calc(100vh - 320px)'"
        row-key="id"
        @row-dblclick="handleRowDblClick"
      >
        <el-table-column prop="month" label="月份" width="110" />
        <el-table-column prop="employeeCount" label="人数" width="80" align="center" />
        <el-table-column label="加班小计" width="110" align="right">
          <template #default="{ row }">
            {{ formatAmount(row.overtimeSubtotalTotal) }}
          </template>
        </el-table-column>
        <el-table-column label="补助小计" width="110" align="right">
          <template #default="{ row }">
            {{ formatAmount(row.subsidySubtotalTotal) }}
          </template>
        </el-table-column>
        <el-table-column label="扣款小计" width="110" align="right">
          <template #default="{ row }">
            {{ formatAmount(row.deductionSubtotalTotal) }}
          </template>
        </el-table-column>
        <el-table-column prop="lateCountTotal" label="迟到(次)" width="95" align="center" />
        <el-table-column prop="updatedAt" label="更新时间" min-width="140">
          <template #default="{ row }">
            {{ formatDate(row.updatedAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right" align="center">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button size="small" @click="handleView(row)">查看</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div class="pagination-footer" :class="{ 'pagination-footer--mobile': isMobile }">
      <el-pagination
        background
        :layout="paginationLayout"
        :pager-count="paginationPagerCount"
        :current-page="pagination.page"
        :page-size="pagination.size"
        :page-sizes="[10, 20, 30, 50]"
        :total="pagination.total"
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
      />
    </div>

    <!-- 编辑/查看考勤 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      :width="isMobile ? '100%' : '1200px'"
      :fullscreen="isMobile"
      class="att-dialog"
      :close-on-click-modal="false"
    >
      <template #header>
        <div class="att-dialog-header">
          <div class="att-dialog-title">{{ dialogTitle }}</div>
          <div class="att-dialog-actions">
            <el-date-picker
              v-model="editMonth"
              type="month"
              value-format="YYYY-MM"
              placeholder="选择月份"
              :disabled="dialogLoading || isViewMode"
              style="width: 150px"
            />
            <el-button
              v-if="!isViewMode"
              type="primary"
              :loading="syncingEmployees"
              @click="syncEmployees"
            >
              同步在职员工
            </el-button>
          </div>
        </div>
      </template>

      <div class="att-dialog-body" v-loading="dialogLoading">
        <el-table
          v-if="attendanceRows.length"
          :data="attendanceRows"
          border
          height="520"
          class="att-edit-grid"
          :row-class-name="() => 'att-row'"
        >
          <el-table-column type="index" label="序号" width="55" fixed="left" align="center" />
          <el-table-column prop="employeeName" width="100" fixed="left">
            <template #header>
              <div class="att-name-header">
                <span>姓名</span>
                <el-tooltip content="展开/折叠员工信息列" placement="top">
                  <span
                    class="att-column-toggle-icon"
                    @click.stop="showEmployeeExtraColumns = !showEmployeeExtraColumns"
                  >
                    <Icon
                      :size="16"
                      :icon="
                        showEmployeeExtraColumns
                          ? 'vi-ant-design:menu-fold-outlined'
                          : 'vi-ant-design:menu-unfold-outlined'
                      "
                    />
                  </span>
                </el-tooltip>
              </div>
            </template>
          </el-table-column>
          <el-table-column
            v-if="showEmployeeExtraColumns"
            prop="employeeNumber"
            label="员工工号"
            width="80"
            fixed="left"
          />
          <el-table-column
            v-if="showEmployeeExtraColumns"
            prop="department"
            label="所属部门"
            width="80"
            fixed="left"
          />
          <el-table-column
            v-if="showEmployeeExtraColumns"
            prop="level"
            label="职级"
            width="60"
            fixed="left"
          />
          <el-table-column
            v-if="showEmployeeExtraColumns"
            prop="gender"
            label="性别"
            width="40"
            fixed="left"
          />
          <el-table-column
            v-if="showEmployeeExtraColumns"
            prop="entryDate"
            label="入职时间"
            width="100"
            fixed="left"
          >
            <template #default="{ row }">
              {{ formatDate(row.entryDate) }}
            </template>
          </el-table-column>

          <el-table-column label="加班时" width="110" align="center">
            <template #default="{ row }">
              <el-input-number
                v-model="row.overtimeHours"
                :min="0"
                :precision="1"
                :controls="false"
                size="small"
                class="att-number"
                :disabled="isViewMode"
              />
            </template>
          </el-table-column>
          <el-table-column label="夜班45/次" width="110" align="center">
            <template #default="{ row }">
              <el-input-number
                v-model="row.nightShiftCount"
                :min="0"
                :precision="0"
                :controls="false"
                size="small"
                class="att-number"
                :disabled="isViewMode"
              />
            </template>
          </el-table-column>
          <el-table-column label="加班小计" width="120" align="center">
            <template #default="{ row }">
              <el-input-number
                v-model="row.overtimeSubtotal"
                :min="0"
                :precision="2"
                :controls="false"
                size="small"
                class="att-number"
                :disabled="isViewMode"
              />
            </template>
          </el-table-column>
          <el-table-column label="工龄数" width="70" align="center">
            <template #default="{ row }">
              <el-input-number
                v-model="row.seniorityYears"
                :min="0"
                :max="99"
                :precision="0"
                :controls="false"
                size="small"
                class="att-number att-number--2d"
                :disabled="isViewMode"
              />
            </template>
          </el-table-column>
          <el-table-column label="全勤费" width="70" align="center">
            <template #default="{ row }">
              <el-input-number
                v-model="row.fullAttendanceBonus"
                :min="0"
                :max="99"
                :precision="0"
                :controls="false"
                size="small"
                class="att-number att-number--2d"
                :disabled="isViewMode"
              />
            </template>
          </el-table-column>
          <el-table-column label="误餐15/次" width="90" align="center">
            <template #default="{ row }">
              <el-input-number
                v-model="row.mealAllowanceCount"
                :min="0"
                :max="99"
                :precision="0"
                :controls="false"
                size="small"
                class="att-number att-number--2d"
                :disabled="isViewMode"
              />
            </template>
          </el-table-column>
          <el-table-column label="补助小计" width="120" align="center">
            <template #default="{ row }">
              <el-input-number
                v-model="row.subsidySubtotal"
                :min="0"
                :precision="2"
                :controls="false"
                size="small"
                class="att-number"
                :disabled="isViewMode"
              />
            </template>
          </el-table-column>
          <el-table-column label="迟到次" width="90" align="center">
            <template #default="{ row }">
              <el-input-number
                v-model="row.lateCount"
                :min="0"
                :precision="0"
                :controls="false"
                size="small"
                class="att-number"
                :disabled="isViewMode"
              />
            </template>
          </el-table-column>
          <el-table-column label="新进及事假时" width="130" align="center">
            <template #default="{ row }">
              <el-input-number
                v-model="row.newOrPersonalLeaveHours"
                :min="0"
                :precision="1"
                :controls="false"
                size="small"
                class="att-number"
                :disabled="isViewMode"
              />
            </template>
          </el-table-column>
          <el-table-column label="病假时" width="90" align="center">
            <template #default="{ row }">
              <el-input-number
                v-model="row.sickLeaveHours"
                :min="0"
                :precision="1"
                :controls="false"
                size="small"
                class="att-number"
                :disabled="isViewMode"
              />
            </template>
          </el-table-column>
          <el-table-column label="旷工时" width="90" align="center">
            <template #default="{ row }">
              <el-input-number
                v-model="row.absenceHours"
                :min="0"
                :precision="1"
                :controls="false"
                size="small"
                class="att-number"
                :disabled="isViewMode"
              />
            </template>
          </el-table-column>
          <el-table-column label="卫生费" width="90" align="center">
            <template #default="{ row }">
              <el-input-number
                v-model="row.hygieneFee"
                :min="0"
                :precision="2"
                :controls="false"
                size="small"
                class="att-number"
                :disabled="isViewMode"
              />
            </template>
          </el-table-column>
          <el-table-column label="水电费" width="90" align="center">
            <template #default="{ row }">
              <el-input-number
                v-model="row.utilitiesFee"
                :min="0"
                :precision="2"
                :controls="false"
                size="small"
                class="att-number"
                :disabled="isViewMode"
              />
            </template>
          </el-table-column>
          <el-table-column label="扣款小计" width="120" align="center">
            <template #default="{ row }">
              <el-input-number
                v-model="row.deductionSubtotal"
                :min="0"
                :precision="2"
                :controls="false"
                size="small"
                class="att-number"
                :disabled="isViewMode"
              />
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-else description="暂无人员" />
      </div>

      <template #footer>
        <el-button @click="dialogVisible = false">{{ isViewMode ? '关闭' : '取消' }}</el-button>
        <el-button v-if="!isViewMode" type="primary" :loading="saving" @click="submit">
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  getAttendanceListApi,
  getAttendanceDetailApi,
  saveAttendanceApi,
  type AttendanceRecord,
  type AttendanceSummary
} from '@/api/attendance'
import { getEmployeeListApi, type EmployeeInfo } from '@/api/employee'
import { useAppStore } from '@/store/modules/app'

const appStore = useAppStore()
const isMobile = computed(() => appStore.getMobile)
const showMobileFilters = ref(false)

const queryForm = reactive({ month: '', keyword: '' })
const queryFormRef = ref()

const pagination = reactive({ page: 1, size: 10, total: 0 })

const tableData = ref<AttendanceSummary[]>([])
const loading = ref(false)

const dialogVisible = ref(false)
const dialogTitle = ref('编辑考勤')
const dialogLoading = ref(false)
const saving = ref(false)
const isViewMode = ref(false)
const currentId = ref<number | null>(null)
const editMonth = ref('')
const attendanceRows = ref<AttendanceRecord[]>([])
const syncingEmployees = ref(false)
const showEmployeeExtraColumns = ref(false)

const paginationLayout = computed(() =>
  isMobile.value ? 'prev, pager, next' : 'total, sizes, prev, pager, next, jumper'
)
const paginationPagerCount = computed(() => (isMobile.value ? 5 : 7))

const templateUrl = '/attendance-template.xlsx'

const handleSearch = () => {
  pagination.page = 1
  void loadList()
}

const handleReset = () => {
  queryForm.month = ''
  queryForm.keyword = ''
  pagination.page = 1
  void loadList()
}

const handleSizeChange = (size: number) => {
  pagination.size = size
  pagination.page = 1
  void loadList()
}

const handleCurrentChange = (page: number) => {
  pagination.page = page
  void loadList()
}

const loadList = async () => {
  loading.value = true
  try {
    const params: Record<string, any> = {
      page: pagination.page,
      pageSize: pagination.size
    }
    if (queryForm.month) params.month = queryForm.month
    if (queryForm.keyword) params.keyword = queryForm.keyword
    const response: any = await getAttendanceListApi(params)
    if (response?.code === 0 && response?.data) {
      tableData.value = response.data.list || []
      pagination.total = response.data.total || 0
    } else {
      tableData.value = response?.list || response?.data?.list || response?.data || []
      pagination.total =
        response?.total || response?.data?.total || (tableData.value ? tableData.value.length : 0)
    }
  } catch (error) {
    console.error('加载考勤数据失败:', error)
    ElMessage.error('加载考勤数据失败')
    tableData.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

const handleCreate = () => {
  isViewMode.value = false
  currentId.value = null
  dialogTitle.value = '新增考勤'
  editMonth.value = queryForm.month || formatMonth(new Date())
  attendanceRows.value = []
  dialogVisible.value = true
  void initRows()
}

const handleRowDblClick = (row: AttendanceSummary) => {
  void handleEdit(row)
}

const handleEdit = async (row: AttendanceSummary) => {
  isViewMode.value = false
  dialogTitle.value = `编辑考勤 - ${row.month}`
  currentId.value = row.id
  editMonth.value = row.month
  attendanceRows.value = []
  dialogVisible.value = true
  await loadDetail(row.id)
}

const handleView = async (row: AttendanceSummary) => {
  isViewMode.value = true
  dialogTitle.value = `查看考勤 - ${row.month}`
  currentId.value = row.id
  editMonth.value = row.month
  attendanceRows.value = []
  dialogVisible.value = true
  await loadDetail(row.id)
}

const loadDetail = async (id: number) => {
  dialogLoading.value = true
  try {
    const response: any = await getAttendanceDetailApi(id)
    const detail = response?.data || response || {}
    const records: AttendanceRecord[] = normalizeRecords(detail.records || [])
    attendanceRows.value = records
  } catch (error) {
    console.error('获取考勤详情失败:', error)
    ElMessage.error('获取考勤详情失败，已使用在职员工初始化')
    await initRows()
  } finally {
    dialogLoading.value = false
  }
}

const initRows = async () => {
  dialogLoading.value = true
  try {
    const employees = await loadActiveEmployees()
    attendanceRows.value = employees.map((emp) => buildRecordFromEmployee(emp))
  } catch (error) {
    console.error('初始化考勤行失败:', error)
    attendanceRows.value = []
  } finally {
    dialogLoading.value = false
  }
}

const loadActiveEmployees = async () => {
  syncingEmployees.value = true
  try {
    const response: any = await getEmployeeListApi({
      status: '在职',
      page: 1,
      pageSize: 500
    })
    let list: EmployeeInfo[] = []
    if (response?.code === 0 && response?.data) {
      list = response.data.list || []
    } else {
      list = response?.list || response?.data?.list || response?.data || []
    }
    return list.filter((item) => item.employeeName !== '常冬泉')
  } finally {
    syncingEmployees.value = false
  }
}

const buildRecordFromEmployee = (emp: EmployeeInfo): AttendanceRecord => {
  return {
    employeeId: emp.id,
    employeeName: emp.employeeName,
    gender: emp.gender,
    employeeNumber: emp.employeeNumber,
    department: emp.department,
    level: emp.level,
    entryDate: emp.entryDate,
    overtimeHours: 0,
    nightShiftCount: 0,
    overtimeSubtotal: 0,
    seniorityYears: 0,
    fullAttendanceBonus: 0,
    mealAllowanceCount: 0,
    subsidySubtotal: 0,
    lateCount: 0,
    newOrPersonalLeaveHours: 0,
    sickLeaveHours: 0,
    absenceHours: 0,
    hygieneFee: 0,
    utilitiesFee: 0,
    deductionSubtotal: 0
  }
}

const normalizeRecords = (records: AttendanceRecord[]) => {
  return records.map((rec) => ({
    employeeId: rec.employeeId,
    employeeName: rec.employeeName,
    gender: rec.gender,
    employeeNumber: rec.employeeNumber,
    department: rec.department,
    level: rec.level,
    entryDate: rec.entryDate,
    overtimeHours: Number(rec.overtimeHours || 0),
    nightShiftCount: Number(rec.nightShiftCount || 0),
    overtimeSubtotal: Number(rec.overtimeSubtotal || 0),
    seniorityYears: Number(rec.seniorityYears || 0),
    fullAttendanceBonus: Number(rec.fullAttendanceBonus || 0),
    mealAllowanceCount: Number(rec.mealAllowanceCount || 0),
    subsidySubtotal: Number(rec.subsidySubtotal || 0),
    lateCount: Number(rec.lateCount || 0),
    newOrPersonalLeaveHours: Number(rec.newOrPersonalLeaveHours || 0),
    sickLeaveHours: Number(rec.sickLeaveHours || 0),
    absenceHours: Number(rec.absenceHours || 0),
    hygieneFee: Number(rec.hygieneFee || 0),
    utilitiesFee: Number(rec.utilitiesFee || 0),
    deductionSubtotal: Number(rec.deductionSubtotal || 0)
  }))
}

const formatMonth = (date: Date) => {
  const y = date.getFullYear()
  const m = `${date.getMonth() + 1}`.padStart(2, '0')
  return `${y}-${m}`
}

const formatDate = (val?: string) => {
  if (!val) return ''
  if (val.includes('T')) return val.split('T')[0]
  if (val.includes(' ')) return val.split(' ')[0]
  return val
}

const formatAmount = (val?: number) => {
  if (val === undefined || val === null || Number.isNaN(val)) return '-'
  return Number(val).toFixed(2)
}

const submit = async () => {
  if (!editMonth.value) {
    ElMessage.warning('请选择月份')
    return
  }
  saving.value = true
  try {
    const payload = {
      id: currentId.value || undefined,
      month: editMonth.value,
      records: attendanceRows.value
    }
    await saveAttendanceApi(payload)
    ElMessage.success('保存成功')
    dialogVisible.value = false
    void loadList()
  } catch (error) {
    console.error('保存考勤失败:', error)
    ElMessage.error('保存考勤失败')
  } finally {
    saving.value = false
  }
}

const syncEmployees = async () => {
  const employees = await loadActiveEmployees()
  attendanceRows.value = employees.map((emp) => buildRecordFromEmployee(emp))
}

const downloadTemplate = () => {
  window.open(templateUrl, '_blank')
}

onMounted(() => {
  void loadList()
})
</script>

<style scoped>
@media (width <= 768px) {
  .query-form--mobile {
    padding: 12px;
  }

  :deep(.query-form--mobile .el-form-item) {
    width: 100%;
    margin-right: 0;
    margin-bottom: 12px;
  }

  :deep(.query-form--mobile .el-form-item .el-form-item__content) {
    width: 100%;
  }

  :deep(.query-form--mobile .el-input),
  :deep(.query-form--mobile .el-select),
  :deep(.query-form--mobile .el-date-editor) {
    width: 100%;
  }

  :deep(.query-form--mobile .el-button) {
    width: 100%;
  }
}

.attendance-page {
  position: relative;
}

.mobile-top-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}

.query-form {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

.query-form__actions {
  display: flex;
  margin-left: auto;
}

.query-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.att-table-wrapper {
  padding: 4px;
  background: var(--el-bg-color);
  border-radius: 8px;
}

.pagination-footer {
  display: flex;
  justify-content: center;
}

.pagination-footer--mobile {
  justify-content: center;
}

.att-dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 6px 0;
}

.att-dialog-title {
  font-size: 16px;
  font-weight: 600;
}

.att-dialog-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.att-dialog-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.att-edit-grid {
  font-size: 11px;
}

:deep(.att-edit-grid .el-table__header-wrapper) {
  position: sticky;
  top: 0;
  z-index: 1;
}

:deep(.att-edit-grid .el-table__cell) {
  padding: 2px 4px;
}

:deep(.att-edit-grid .el-table__inner-wrapper::before) {
  display: none;
}

:deep(.att-edit-grid .el-table__body-wrapper tbody tr) {
  height: 28px;
}

:deep(.att-edit-grid .el-table__header-wrapper th.el-table__cell) {
  padding-top: 4px;
  padding-bottom: 4px;
}

:deep(.att-number.el-input-number) {
  width: 72px;
}

:deep(.att-number--2d.el-input-number) {
  width: 54px;
}

:deep(.att-number .el-input__wrapper) {
  padding: 0 6px;
}

:deep(.att-number .el-input__inner) {
  font-size: 11px;
}

.att-name-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.att-column-toggle-icon {
  display: inline-flex;
  width: 18px;
  height: 18px;
  color: var(--el-text-color-placeholder);
  cursor: pointer;
  align-items: center;
  justify-content: center;
}

.att-column-toggle-icon:hover {
  color: var(--el-color-primary);
}
</style>
