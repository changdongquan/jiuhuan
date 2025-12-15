<template>
  <div class="salary-page p-4 space-y-4">
    <div v-if="isMobile" class="mobile-top-bar">
      <el-button text type="primary" @click="showMobileFilters = !showMobileFilters">
        {{ showMobileFilters ? '收起筛选' : '展开筛选' }}
      </el-button>
    </div>

    <el-form
      :model="queryForm"
      :inline="!isMobile"
      :label-width="isMobile ? 'auto' : '90px'"
      :label-position="isMobile ? 'top' : 'right'"
      class="query-form rounded-lg bg-[var(--el-bg-color-overlay)] p-4 shadow-sm"
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
          @change="handleQuery"
        />
      </el-form-item>
      <el-form-item label="关键词">
        <el-input
          v-model="queryForm.keyword"
          placeholder="姓名/工号"
          clearable
          :style="{ width: isMobile ? '100%' : '240px' }"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item class="query-form__actions">
        <div class="query-actions">
          <el-button @click="handleParams">参数</el-button>
          <el-button type="primary" @click="handleQuery">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
          <el-button type="success" @click="handleAdd">新增</el-button>
        </div>
      </el-form-item>
    </el-form>

    <template v-if="tableData.length">
      <div class="salary-table-wrapper">
        <el-table
          :data="tableData"
          border
          v-loading="loading"
          :height="isMobile ? undefined : 'calc(100vh - 320px)'"
        >
          <el-table-column type="index" label="序号" width="60" align="center" />
          <el-table-column prop="month" label="月份" width="110" />
          <el-table-column prop="employeeName" label="姓名" width="110" show-overflow-tooltip />
          <el-table-column prop="employeeNumber" label="工号" width="110" show-overflow-tooltip />
          <el-table-column prop="baseSalary" label="基本工资" min-width="120" align="right">
            <template #default="{ row }">{{ formatMoney(row.baseSalary) }}</template>
          </el-table-column>
          <el-table-column prop="bonus" label="绩效/奖金" min-width="120" align="right">
            <template #default="{ row }">{{ formatMoney(row.bonus) }}</template>
          </el-table-column>
          <el-table-column prop="deduction" label="扣款" min-width="120" align="right">
            <template #default="{ row }">{{ formatMoney(row.deduction) }}</template>
          </el-table-column>
          <el-table-column prop="total" label="合计" min-width="120" align="right">
            <template #default="{ row }">{{ formatMoney(row.total) }}</template>
          </el-table-column>
          <el-table-column prop="remark" label="备注" min-width="160" show-overflow-tooltip />
          <el-table-column label="操作" width="180" align="center" fixed="right">
            <template #default>
              <el-button size="small" type="primary" @click="handleNotReady">编辑</el-button>
              <el-button size="small" @click="handleNotReady">查看</el-button>
              <el-button size="small" type="danger" @click="handleNotReady">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <div class="pagination-footer" :class="{ 'pagination-footer--mobile': isMobile }">
        <el-pagination
          background
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.size"
          :total="pagination.total"
          :page-sizes="[10, 20, 50, 100]"
          :layout="paginationLayout"
          :pager-count="paginationPagerCount"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </template>
    <el-empty
      v-else
      description="暂无工资数据"
      class="rounded-lg bg-[var(--el-bg-color-overlay)] py-16"
      :image-size="180"
    />

    <el-dialog
      v-model="paramsDialogVisible"
      title="参数"
      :width="isMobile ? '100%' : '960px'"
      :fullscreen="isMobile"
      :close-on-click-modal="false"
      class="params-dialog"
    >
      <el-tabs v-model="paramsActiveTab" @tab-change="handleParamsTabChange">
        <el-tab-pane label="工资基数" name="salaryBase">
          <div class="params-tab-body" v-loading="salaryBaseLoading">
            <el-table v-if="salaryBaseRows.length" :data="salaryBaseRows" border height="560">
              <el-table-column type="index" label="序号" width="70" align="center" />
              <el-table-column prop="employeeName" label="姓名" width="120" show-overflow-tooltip />
              <el-table-column
                prop="employeeNumber"
                label="员工工号"
                width="120"
                show-overflow-tooltip
              />
              <el-table-column
                prop="department"
                label="所属部门"
                min-width="140"
                show-overflow-tooltip
              />
              <el-table-column
                label="工资基数"
                width="140"
                align="center"
                class-name="sb-col-input"
              >
                <template #default="{ row }">
                  <el-input-number
                    v-model="row.salaryBase"
                    :min="0"
                    :max="999999"
                    :precision="0"
                    :controls="false"
                    :value-on-clear="null"
                    placeholder="-"
                    size="small"
                    class="sb-number"
                  />
                </template>
              </el-table-column>
              <el-table-column
                label="调整日期"
                width="140"
                align="center"
                class-name="sb-col-input"
              >
                <template #default="{ row }">
                  <el-date-picker
                    v-model="row.adjustDate"
                    type="date"
                    value-format="YYYY-MM-DD"
                    placeholder="-"
                    clearable
                    size="small"
                    style="width: 130px"
                  />
                </template>
              </el-table-column>
            </el-table>
            <el-empty v-else description="暂无人员" />
          </div>
        </el-tab-pane>

        <el-tab-pane label="职级" name="level">
          <div class="params-tab-body" v-loading="levelLoading">
            <el-table v-if="levelRows.length" :data="levelRows" border height="560">
              <el-table-column prop="level" label="职级" width="80" align="center" />
              <el-table-column label="加班" width="140" align="center" class-name="lv-col-input">
                <template #default="{ row }">
                  <el-input-number
                    v-model="row.overtime"
                    :min="0"
                    :max="999999"
                    :precision="2"
                    :controls="false"
                    :value-on-clear="null"
                    placeholder="-"
                    size="small"
                    class="lv-number"
                  />
                </template>
              </el-table-column>
              <el-table-column
                label="两倍加班"
                width="140"
                align="center"
                class-name="lv-col-input"
              >
                <template #default="{ row }">
                  <el-input-number
                    v-model="row.doubleOvertime"
                    :min="0"
                    :max="999999"
                    :precision="2"
                    :controls="false"
                    :value-on-clear="null"
                    placeholder="-"
                    size="small"
                    class="lv-number"
                  />
                </template>
              </el-table-column>
              <el-table-column
                label="三倍加班"
                width="140"
                align="center"
                class-name="lv-col-input"
              >
                <template #default="{ row }">
                  <el-input-number
                    v-model="row.tripleOvertime"
                    :min="0"
                    :max="999999"
                    :precision="2"
                    :controls="false"
                    :value-on-clear="null"
                    placeholder="-"
                    size="small"
                    class="lv-number"
                  />
                </template>
              </el-table-column>
              <el-table-column
                label="调整日期"
                width="160"
                align="center"
                class-name="lv-col-input"
              >
                <template #default="{ row }">
                  <el-date-picker
                    v-model="row.adjustDate"
                    type="date"
                    value-format="YYYY-MM-DD"
                    placeholder="-"
                    clearable
                    size="small"
                    style="width: 140px"
                  />
                </template>
              </el-table-column>
            </el-table>
            <el-empty v-else description="暂无职级配置" />
          </div>
        </el-tab-pane>

        <el-tab-pane label="补助" name="subsidy">
          <div class="params-tab-body" v-loading="subsidyLoading">
            <el-table v-if="subsidyRows.length" :data="subsidyRows" border height="560">
              <el-table-column type="index" label="序号" width="70" align="center" />
              <el-table-column prop="name" label="补助" min-width="180" />
              <el-table-column label="金额" width="140" align="center" class-name="sub-col-input">
                <template #default="{ row }">
                  <el-input-number
                    v-model="row.amount"
                    :min="0"
                    :max="999999"
                    :precision="0"
                    :controls="false"
                    :value-on-clear="null"
                    placeholder="-"
                    size="small"
                    class="sub-number"
                  />
                </template>
              </el-table-column>
              <el-table-column
                label="调整日期"
                width="180"
                align="center"
                class-name="sub-col-input"
              >
                <template #default="{ row }">
                  <el-date-picker
                    v-model="row.adjustDate"
                    type="date"
                    value-format="YYYY-MM-DD"
                    placeholder="-"
                    clearable
                    size="small"
                    style="width: 160px"
                  />
                </template>
              </el-table-column>
            </el-table>
            <el-empty v-else description="暂无补助配置" />
          </div>
        </el-tab-pane>
      </el-tabs>

      <template #footer>
        <el-button @click="paramsDialogVisible = false">关闭</el-button>
        <el-button type="primary" @click="handleParamsSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/store/modules/app'
import { getEmployeeListApi, type EmployeeInfo } from '@/api/employee'

type SalaryRow = {
  id?: number
  month: string
  employeeName: string
  employeeNumber: string
  baseSalary?: number | null
  bonus?: number | null
  deduction?: number | null
  total?: number | null
  remark?: string
}

type SalaryBaseRow = {
  employeeId: number
  employeeName: string
  employeeNumber: string
  department: string
  salaryBase: number | null
  adjustDate: string
}

type LevelRow = {
  level: number
  overtime: number | null
  doubleOvertime: number | null
  tripleOvertime: number | null
  adjustDate: string
}

type SubsidyRow = {
  name: string
  amount: number | null
  adjustDate: string
}

const appStore = useAppStore()
const isMobile = computed(() => appStore.getMobile)
const showMobileFilters = ref(false)

const queryForm = reactive({
  month: '',
  keyword: ''
})

const loading = ref(false)
const tableData = ref<SalaryRow[]>([])
const pagination = reactive({ page: 1, size: 10, total: 0 })

const paginationLayout = computed(() =>
  isMobile.value ? 'prev, pager, next' : 'total, sizes, prev, pager, next, jumper'
)
const paginationPagerCount = computed(() => (isMobile.value ? 5 : 7))

const salaryBaseLoading = ref(false)
const salaryBaseRows = ref<SalaryBaseRow[]>([])

const levelLoading = ref(false)
const levelRows = ref<LevelRow[]>([])

const subsidyLoading = ref(false)
const subsidyRows = ref<SubsidyRow[]>([])

const paramsDialogVisible = ref(false)
const paramsActiveTab = ref<'salaryBase' | 'level' | 'subsidy'>('salaryBase')

const formatMoney = (val?: number | null) => {
  if (val === null || val === undefined) return '-'
  const num = Number(val)
  if (Number.isNaN(num)) return '-'
  return num.toFixed(2)
}

const loadList = async () => {
  loading.value = true
  try {
    tableData.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

const handleQuery = () => {
  pagination.page = 1
  void loadList()
}

const handleReset = () => {
  queryForm.month = ''
  queryForm.keyword = ''
  handleQuery()
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

const handleNotReady = () => {
  ElMessage.info('工资功能接口暂未接入')
}

const loadActiveEmployees = async () => {
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
  return list
}

const ensureSalaryBaseLoaded = async () => {
  if (salaryBaseRows.value.length) return
  salaryBaseLoading.value = true
  try {
    const employees = await loadActiveEmployees()
    salaryBaseRows.value = employees.map((emp) => ({
      employeeId: emp.id,
      employeeName: emp.employeeName,
      employeeNumber: String(emp.employeeNumber ?? ''),
      department: emp.department || '',
      salaryBase: null,
      adjustDate: ''
    }))
  } catch (error) {
    console.error('加载员工列表失败:', error)
    ElMessage.error('加载员工列表失败')
    salaryBaseRows.value = []
  } finally {
    salaryBaseLoading.value = false
  }
}

const ensureLevelLoaded = () => {
  if (levelRows.value.length) return
  levelRows.value = Array.from({ length: 10 }, (_, idx) => ({
    level: idx + 1,
    overtime: null,
    doubleOvertime: null,
    tripleOvertime: null,
    adjustDate: ''
  }))
}

const ensureSubsidyLoaded = () => {
  if (subsidyRows.value.length) return
  if (!subsidyRows.value.length) {
    subsidyRows.value = [
      { name: '夜班补助', amount: null, adjustDate: '' },
      { name: '误餐补助', amount: null, adjustDate: '' }
    ]
  }
}

const ensureParamsTabLoaded = async (tab: 'salaryBase' | 'level' | 'subsidy') => {
  if (tab === 'salaryBase') {
    await ensureSalaryBaseLoaded()
    return
  }
  if (tab === 'level') {
    ensureLevelLoaded()
    return
  }
  if (tab === 'subsidy') {
    ensureSubsidyLoaded()
  }
}

const handleParams = () => {
  paramsDialogVisible.value = true
  void ensureParamsTabLoaded(paramsActiveTab.value)
}

const handleParamsTabChange = (tabName: string | number) => {
  if (tabName === 'salaryBase' || tabName === 'level' || tabName === 'subsidy') {
    void ensureParamsTabLoaded(tabName)
  }
}

const handleParamsSave = () => {
  handleNotReady()
}

const handleAdd = () => {
  handleNotReady()
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
}

@media (width > 768px) {
  .query-form {
    display: flex;
    align-items: center;
    flex-wrap: nowrap;
    gap: 12px;
  }

  :deep(.query-form .el-form-item) {
    margin-bottom: 0;
  }

  .query-actions {
    flex-wrap: nowrap;
    white-space: nowrap;
  }
}

.mobile-top-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
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

.salary-table-wrapper {
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

:deep(.params-dialog .el-dialog__body) {
  padding-top: 8px;
}

:deep(.params-dialog .sb-col-input .cell) {
  padding: 0 !important;
}

:deep(.params-dialog .sb-number.el-input-number) {
  width: 120px;
}

:deep(.params-dialog .el-dialog__body) {
  padding-top: 8px;
}

:deep(.params-dialog .lv-col-input .cell) {
  padding: 0 !important;
}

:deep(.params-dialog .lv-number.el-input-number) {
  width: 120px;
}

:deep(.params-dialog .sub-col-input .cell) {
  padding: 0 !important;
}

:deep(.params-dialog .sub-number.el-input-number) {
  width: 120px;
}

.params-tab-body {
  min-height: 580px;
}
</style>
