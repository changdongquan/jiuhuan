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
          <el-button type="success" @click="handleCreate">新增月份</el-button>
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
        <el-table-column label="出勤率" width="110" align="center">
          <template #default="{ row }">
            {{ formatPercent(row.attendanceRate) }}
          </template>
        </el-table-column>
        <el-table-column prop="leaveDays" label="请假(天)" width="100" align="center" />
        <el-table-column prop="overtimeHours" label="加班(小时)" width="110" align="center" />
        <el-table-column prop="lateOrEarlyCount" label="迟到/早退(次)" width="130" align="center" />
        <el-table-column prop="absenceDays" label="缺勤(天)" width="100" align="center" />
        <el-table-column prop="updatedAt" label="更新时间" min-width="140">
          <template #default="{ row }">
            {{ formatDate(row.updatedAt) }}
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="160" show-overflow-tooltip />
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
              @change="handleMonthChange"
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
        <div class="att-dialog-tip">
          数据来源：在职员工（不含常冬泉），字段：姓名、性别、工号、部门、职级、入职时间。
          单元格可选择出勤/请假/加班/休息等状态，按天录入。
        </div>
        <el-table
          v-if="attendanceRows.length"
          :data="attendanceRows"
          border
          height="520"
          class="att-edit-grid"
          :row-class-name="() => 'att-row'"
        >
          <el-table-column prop="employeeName" label="姓名" width="120" fixed="left" />
          <el-table-column prop="gender" label="性别" width="80" fixed="left" />
          <el-table-column prop="employeeNumber" label="工号" width="90" fixed="left" />
          <el-table-column prop="department" label="部门" width="120" fixed="left" />
          <el-table-column prop="level" label="职级" width="90" fixed="left" />
          <el-table-column prop="entryDate" label="入职时间" width="120" fixed="left">
            <template #default="{ row }">
              {{ formatDate(row.entryDate) }}
            </template>
          </el-table-column>

          <el-table-column
            v-for="day in dayColumns"
            :key="day"
            :label="day.toString()"
            width="88"
            align="center"
          >
            <template #default="{ row }">
              <el-select
                v-model="row.days[day]"
                class="att-day-select"
                placeholder="-"
                size="small"
                :disabled="isViewMode"
                @change="handleCellChange(row)"
              >
                <el-option
                  v-for="opt in statusOptions"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
            </template>
          </el-table-column>

          <el-table-column label="出勤天数" width="90" align="center">
            <template #default="{ row }">
              {{ getRowSummary(row).present }}
            </template>
          </el-table-column>
          <el-table-column label="请假天数" width="90" align="center">
            <template #default="{ row }">
              {{ getRowSummary(row).leave }}
            </template>
          </el-table-column>
          <el-table-column label="加班(次)" width="90" align="center">
            <template #default="{ row }">
              {{ getRowSummary(row).overtime }}
            </template>
          </el-table-column>
          <el-table-column label="迟到" width="70" align="center">
            <template #default="{ row }">
              {{ getRowSummary(row).late }}
            </template>
          </el-table-column>
          <el-table-column label="早退" width="70" align="center">
            <template #default="{ row }">
              {{ getRowSummary(row).early }}
            </template>
          </el-table-column>
          <el-table-column label="旷工" width="70" align="center">
            <template #default="{ row }">
              {{ getRowSummary(row).absence }}
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-else description="暂无人员" />

        <el-input
          v-model="remark"
          type="textarea"
          :rows="3"
          placeholder="备注（选填）"
          :disabled="isViewMode"
          class="att-remark"
        />
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
  type AttendanceCellStatus,
  type AttendanceRecord,
  type AttendanceSummary
} from '@/api/attendance'
import { getEmployeeListApi, type EmployeeInfo } from '@/api/employee'
import { useAppStore } from '@/store/modules/app'

const appStore = useAppStore()
const isMobile = computed(() => appStore.getMobile)
const showMobileFilters = ref(false)

const queryForm = reactive({ month: '', keyword: '' })

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
const remark = ref('')
const syncingEmployees = ref(false)

const statusOptions = [
  { label: '出勤', value: '出勤' },
  { label: '休息', value: '休息' },
  { label: '请假', value: '请假' },
  { label: '加班', value: '加班' },
  { label: '出差', value: '出差' },
  { label: '迟到', value: '迟到' },
  { label: '早退', value: '早退' },
  { label: '旷工', value: '旷工' }
] as { label: string; value: AttendanceCellStatus }[]

const paginationLayout = computed(() =>
  isMobile.value ? 'prev, pager, next' : 'total, sizes, prev, pager, next, jumper'
)
const paginationPagerCount = computed(() => (isMobile.value ? 5 : 7))

const dayColumns = computed(() => {
  const days = getDaysInMonth(editMonth.value || queryForm.month || formatMonth(new Date()))
  return Array.from({ length: days }, (_, i) => i + 1)
})

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
  remark.value = ''
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
  remark.value = ''
  attendanceRows.value = []
  dialogVisible.value = true
  await loadDetail(row.id)
}

const handleView = async (row: AttendanceSummary) => {
  isViewMode.value = true
  dialogTitle.value = `查看考勤 - ${row.month}`
  currentId.value = row.id
  editMonth.value = row.month
  remark.value = ''
  attendanceRows.value = []
  dialogVisible.value = true
  await loadDetail(row.id)
}

const loadDetail = async (id: number) => {
  dialogLoading.value = true
  try {
    const response: any = await getAttendanceDetailApi(id)
    const detail = response?.data || response || {}
    remark.value = detail.remark || ''
    const records: AttendanceRecord[] = normalizeRecords(detail.records || [])
    ensureDays(records)
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
    const days = getDaysInMonth(editMonth.value || formatMonth(new Date()))
    attendanceRows.value = employees.map((emp) => buildRecordFromEmployee(emp, days))
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

const buildRecordFromEmployee = (emp: EmployeeInfo, days: number): AttendanceRecord => {
  const dayMap: Record<number, AttendanceCellStatus> = {}
  for (let i = 1; i <= days; i += 1) {
    dayMap[i] = ''
  }
  return {
    employeeId: emp.id,
    employeeName: emp.employeeName,
    gender: emp.gender,
    employeeNumber: emp.employeeNumber,
    department: emp.department,
    level: emp.level,
    entryDate: emp.entryDate,
    days: dayMap
  }
}

const normalizeRecords = (records: AttendanceRecord[]) => {
  return records.map((rec) => ({
    ...rec,
    days: rec.days || {}
  }))
}

const ensureDays = (records: AttendanceRecord[]) => {
  const days = getDaysInMonth(editMonth.value || formatMonth(new Date()))
  records.forEach((rec) => {
    if (!rec.days) rec.days = {}
    for (let i = 1; i <= days; i += 1) {
      if (!rec.days[i]) rec.days[i] = ''
    }
  })
}

const handleMonthChange = () => {
  if (!attendanceRows.value.length) return
  ensureDays(attendanceRows.value)
}

const handleCellChange = (row: AttendanceRecord) => {
  // 触发视图刷新；目前仅用于重算汇总
  row.employeeId = row.employeeId
}

const getRowSummary = (row: AttendanceRecord) => {
  const days = getDaysInMonth(editMonth.value || formatMonth(new Date()))
  let present = 0
  let leave = 0
  let overtime = 0
  let absence = 0
  let late = 0
  let early = 0
  for (let i = 1; i <= days; i += 1) {
    const v = row.days?.[i] || ''
    switch (v) {
      case '出勤':
        present += 1
        break
      case '休息':
        break
      case '请假':
        leave += 1
        break
      case '加班':
        present += 1
        overtime += 1
        break
      case '出差':
        present += 1
        break
      case '迟到':
        late += 1
        present += 1
        break
      case '早退':
        early += 1
        present += 1
        break
      case '旷工':
        absence += 1
        break
      default:
        break
    }
  }
  return { present, leave, overtime, absence, late, early }
}

const formatMonth = (date: Date) => {
  const y = date.getFullYear()
  const m = `${date.getMonth() + 1}`.padStart(2, '0')
  return `${y}-${m}`
}

const getDaysInMonth = (monthStr: string) => {
  if (!monthStr) {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  }
  const [y, m] = monthStr.split('-').map((v) => Number(v))
  if (!y || !m) return 30
  return new Date(y, m, 0).getDate()
}

const formatDate = (val?: string) => {
  if (!val) return ''
  if (val.includes('T')) return val.split('T')[0]
  if (val.includes(' ')) return val.split(' ')[0]
  return val
}

const formatPercent = (val?: number) => {
  if (val === undefined || val === null || Number.isNaN(val)) return '-'
  return `${(val * 100).toFixed(1)}%`
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
      remark: remark.value,
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
  const days = getDaysInMonth(editMonth.value || formatMonth(new Date()))
  const employees = await loadActiveEmployees()
  attendanceRows.value = employees.map((emp) => buildRecordFromEmployee(emp, days))
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

.att-dialog-tip {
  padding: 8px 10px;
  font-size: 12px;
  color: #606266;
  background: #f5f7fa;
  border: 1px dashed var(--el-border-color);
  border-radius: 6px;
}

.att-edit-grid {
  font-size: 12px;
}

:deep(.att-edit-grid .el-table__header-wrapper) {
  position: sticky;
  top: 0;
  z-index: 1;
}

:deep(.att-edit-grid .el-table__cell) {
  padding: 4px 6px;
}

:deep(.att-edit-grid .el-table__inner-wrapper::before) {
  display: none;
}

:deep(.att-day-select .el-input__wrapper) {
  padding: 0 8px;
}

.att-remark {
  margin-top: 4px;
}
</style>
