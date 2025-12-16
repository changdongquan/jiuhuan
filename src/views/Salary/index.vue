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
      :width="isMobile ? '100%' : '760px'"
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
                width="100"
                show-overflow-tooltip
              />
              <el-table-column
                prop="department"
                label="所属部门"
                width="110"
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

        <el-tab-pane label="加班费基数" name="level">
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
              <el-table-column prop="name" label="补助" width="110" />
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

    <el-dialog
      v-model="rangeDialogVisible"
      title="选择工资计算范围"
      :width="isMobile ? '100%' : '560px'"
      :fullscreen="isMobile"
      :close-on-click-modal="false"
      class="salary-range-dialog"
    >
      <el-form :model="rangeForm" label-width="90px" class="salary-range-form">
        <el-form-item label="月份" required>
          <el-date-picker
            v-model="rangeForm.month"
            type="month"
            value-format="YYYY-MM"
            placeholder="选择月份"
            :style="{ width: isMobile ? '100%' : '220px' }"
          />
        </el-form-item>
        <el-form-item label="员工范围" required>
          <el-radio-group v-model="rangeForm.applyToAll">
            <el-radio :value="true">全部在职员工</el-radio>
            <el-radio :value="false">指定员工</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="!rangeForm.applyToAll" label="选择员工" required>
          <el-select
            v-model="rangeForm.employeeIds"
            filterable
            multiple
            collapse-tags
            collapse-tags-tooltip
            placeholder="请选择员工"
            :loading="addEmployeesLoading"
            :style="{ width: isMobile ? '100%' : '420px' }"
          >
            <el-option
              v-for="emp in addEmployees"
              :key="emp.id"
              :label="`${emp.employeeName}（${emp.employeeNumber}）`"
              :value="emp.id"
            />
          </el-select>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="cancelRange">取消</el-button>
        <el-button type="primary" :loading="rangeSaving" @click="saveRange">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="addDialogVisible"
      title="新增工资"
      :width="isMobile ? '100%' : '1100px'"
      :fullscreen="isMobile"
      :close-on-click-modal="false"
      class="salary-add-dialog"
      @closed="resetAddWizard"
    >
      <template #header>
        <div class="salary-add-header">
          <div class="salary-add-header__title">新增工资</div>
          <div class="salary-add-header__meta">
            <el-tag size="small" type="info">{{ rangeForm.month || '-' }}</el-tag>
            <span class="salary-add-header__meta-text">{{ rangeLabel }}</span>
          </div>
        </div>
      </template>

      <el-steps :active="addStep" align-center finish-status="success">
        <el-step title="步骤1" description="填写明细" />
        <el-step title="步骤2" description="确认完成" />
      </el-steps>

      <div class="salary-add-body" v-loading="addSaving">
        <div v-show="addStep === 0" class="salary-add-step">
          <el-table v-if="addRows.length" :data="addRows" border height="560">
            <el-table-column type="index" label="序号" width="70" align="center" />
            <el-table-column prop="employeeName" label="姓名" width="120" show-overflow-tooltip />
            <el-table-column prop="employeeNumber" label="工号" width="110" show-overflow-tooltip />
            <el-table-column label="基本工资" width="140" align="center" class-name="sa-col-input">
              <template #default="{ row }">
                <el-input-number
                  v-model="row.baseSalary"
                  :min="0"
                  :max="99999999"
                  :precision="2"
                  :controls="false"
                  :value-on-clear="null"
                  placeholder="-"
                  size="small"
                  class="sa-number"
                />
              </template>
            </el-table-column>
            <el-table-column label="绩效/奖金" width="140" align="center" class-name="sa-col-input">
              <template #default="{ row }">
                <el-input-number
                  v-model="row.bonus"
                  :min="0"
                  :max="99999999"
                  :precision="2"
                  :controls="false"
                  :value-on-clear="null"
                  placeholder="-"
                  size="small"
                  class="sa-number"
                />
              </template>
            </el-table-column>
            <el-table-column label="扣款" width="140" align="center" class-name="sa-col-input">
              <template #default="{ row }">
                <el-input-number
                  v-model="row.deduction"
                  :min="0"
                  :max="99999999"
                  :precision="2"
                  :controls="false"
                  :value-on-clear="null"
                  placeholder="-"
                  size="small"
                  class="sa-number"
                />
              </template>
            </el-table-column>
            <el-table-column label="合计" width="140" align="right">
              <template #default="{ row }">{{ formatMoney(computeRowTotal(row)) }}</template>
            </el-table-column>
            <el-table-column label="备注" min-width="160">
              <template #default="{ row }">
                <el-input v-model="row.remark" placeholder="-" clearable />
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-else description="暂无人员" />
        </div>

        <div v-show="addStep === 1" class="salary-add-step">
          <div class="salary-add-summary">
            <div>月份：{{ rangeForm.month || '-' }}</div>
            <div>人数：{{ addRows.length }}</div>
            <div>合计汇总：{{ formatMoney(addRowsTotal) }}</div>
          </div>
          <el-table v-if="addRows.length" :data="addRows" border height="560">
            <el-table-column type="index" label="序号" width="70" align="center" />
            <el-table-column prop="employeeName" label="姓名" width="120" show-overflow-tooltip />
            <el-table-column prop="employeeNumber" label="工号" width="110" show-overflow-tooltip />
            <el-table-column prop="baseSalary" label="基本工资" width="140" align="right">
              <template #default="{ row }">{{ formatMoney(row.baseSalary) }}</template>
            </el-table-column>
            <el-table-column prop="bonus" label="绩效/奖金" width="140" align="right">
              <template #default="{ row }">{{ formatMoney(row.bonus) }}</template>
            </el-table-column>
            <el-table-column prop="deduction" label="扣款" width="140" align="right">
              <template #default="{ row }">{{ formatMoney(row.deduction) }}</template>
            </el-table-column>
            <el-table-column prop="total" label="合计" width="140" align="right">
              <template #default="{ row }">{{ formatMoney(computeRowTotal(row)) }}</template>
            </el-table-column>
            <el-table-column prop="remark" label="备注" min-width="160" show-overflow-tooltip />
          </el-table>
          <el-empty v-else description="暂无人员" />
        </div>
      </div>

      <template #footer>
        <el-button @click="addDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="addSaving" @click="saveAddStep">保存</el-button>
        <el-button
          v-if="addStep < 1"
          type="success"
          :disabled="!addStepSaved[addStep]"
          @click="goNextStep"
        >
          下一步
        </el-button>
        <el-button
          v-else
          type="success"
          :disabled="!addStepSaved[1]"
          :loading="addCompleting"
          @click="completeAdd"
        >
          完成
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/store/modules/app'
import { getEmployeeListApi, type EmployeeInfo } from '@/api/employee'
import {
  getOvertimeBaseParamsApi,
  getSalaryBaseParamsApi,
  getSubsidyParamsApi,
  saveOvertimeBaseParamsApi,
  saveSalaryBaseParamsApi,
  saveSubsidyParamsApi,
  type OvertimeBaseParamRow,
  type SalaryBaseParamRow,
  type SubsidyParamRow
} from '@/api/salary-params'

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

type SalaryDraftRow = {
  employeeId: number
  employeeName: string
  employeeNumber: string
  baseSalary: number | null
  bonus: number | null
  deduction: number | null
  total: number | null
  remark: string
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

const rangeDialogVisible = ref(false)
const rangeSaving = ref(false)
const rangeForm = reactive({
  month: '',
  applyToAll: true,
  employeeIds: [] as number[]
})

const addDialogVisible = ref(false)
const addStep = ref(0)
const addSaving = ref(false)
const addCompleting = ref(false)
const addStepSaved = reactive([false, false])

const addEmployeesLoading = ref(false)
const addEmployees = ref<EmployeeInfo[]>([])
const addRows = ref<SalaryDraftRow[]>([])

const formatMoney = (val?: number | null) => {
  if (val === null || val === undefined) return '-'
  const num = Number(val)
  if (Number.isNaN(num)) return '-'
  return num.toFixed(2)
}

const computeRowTotal = (row: Pick<SalaryDraftRow, 'baseSalary' | 'bonus' | 'deduction'>) => {
  const base = Number(row.baseSalary || 0)
  const bonus = Number(row.bonus || 0)
  const deduction = Number(row.deduction || 0)
  const total = base + bonus - deduction
  return Number.isNaN(total) ? null : total
}

const addRowsTotal = computed(() => {
  return addRows.value.reduce((acc, row) => acc + (computeRowTotal(row) || 0), 0)
})

const loadList = async () => {
  loading.value = true
  try {
    // 先断开工资新增弹窗与后端：工资列表暂不从数据库加载
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
    const paramsResp: any = await getSalaryBaseParamsApi()
    const paramsList: SalaryBaseParamRow[] = paramsResp?.data || paramsResp || []
    const paramsByEmployeeId = new Map<number, SalaryBaseParamRow>()
    for (const item of paramsList) paramsByEmployeeId.set(item.employeeId, item)

    salaryBaseRows.value = employees.map((emp) => {
      const param = paramsByEmployeeId.get(emp.id)
      return {
        employeeId: emp.id,
        employeeName: emp.employeeName,
        employeeNumber: String(emp.employeeNumber ?? ''),
        department: emp.department || '',
        salaryBase: param?.salaryBase ?? null,
        adjustDate: (param?.adjustDate as any) || ''
      }
    })
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
  void (async () => {
    levelLoading.value = true
    try {
      const paramsResp: any = await getOvertimeBaseParamsApi()
      const paramsList: OvertimeBaseParamRow[] = paramsResp?.data || paramsResp || []
      const paramsByLevel = new Map<number, OvertimeBaseParamRow>()
      for (const item of paramsList) paramsByLevel.set(item.level, item)

      levelRows.value = Array.from({ length: 10 }, (_, idx) => {
        const level = idx + 1
        const param = paramsByLevel.get(level)
        return {
          level,
          overtime: param?.overtime ?? null,
          doubleOvertime: param?.doubleOvertime ?? null,
          tripleOvertime: param?.tripleOvertime ?? null,
          adjustDate: (param?.adjustDate as any) || ''
        }
      })
    } catch (error) {
      console.error('加载加班费基数失败:', error)
      ElMessage.error('加载加班费基数失败')
      levelRows.value = []
    } finally {
      levelLoading.value = false
    }
  })()
}

const ensureSubsidyLoaded = () => {
  if (subsidyRows.value.length) return
  void (async () => {
    subsidyLoading.value = true
    try {
      const resp: any = await getSubsidyParamsApi()
      const list: SubsidyParamRow[] = resp?.data || resp || []
      if (list.length) {
        subsidyRows.value = list.map((item) => ({
          name: item.name,
          amount: item.amount ?? null,
          adjustDate: (item.adjustDate as any) || ''
        }))
      } else {
        subsidyRows.value = [
          { name: '夜班补助', amount: null, adjustDate: '' },
          { name: '误餐补助', amount: null, adjustDate: '' }
        ]
      }
    } catch (error) {
      console.error('加载补助参数失败:', error)
      ElMessage.error('加载补助参数失败')
      subsidyRows.value = []
    } finally {
      subsidyLoading.value = false
    }
  })()
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
  void (async () => {
    try {
      if (paramsActiveTab.value === 'salaryBase') {
        const rows: SalaryBaseParamRow[] = salaryBaseRows.value.map((r) => ({
          employeeId: r.employeeId,
          salaryBase: r.salaryBase ?? null,
          adjustDate: r.adjustDate || null
        }))
        const resp: any = await saveSalaryBaseParamsApi(rows)
        if (resp?.code !== 0) throw new Error(resp?.message || '保存失败')
        ElMessage.success('工资基数已保存')
        salaryBaseRows.value = []
        await ensureSalaryBaseLoaded()
        return
      }

      if (paramsActiveTab.value === 'level') {
        const rows: OvertimeBaseParamRow[] = levelRows.value.map((r) => ({
          level: r.level,
          overtime: r.overtime ?? null,
          doubleOvertime: r.doubleOvertime ?? null,
          tripleOvertime: r.tripleOvertime ?? null,
          adjustDate: r.adjustDate || null
        }))
        const resp: any = await saveOvertimeBaseParamsApi(rows)
        if (resp?.code !== 0) throw new Error(resp?.message || '保存失败')
        ElMessage.success('加班费基数已保存')
        levelRows.value = []
        ensureLevelLoaded()
        return
      }

      if (paramsActiveTab.value === 'subsidy') {
        const rows: SubsidyParamRow[] = subsidyRows.value.map((r) => ({
          name: r.name,
          unit: '按次',
          amount: r.amount ?? null,
          adjustDate: r.adjustDate || null
        }))
        const resp: any = await saveSubsidyParamsApi(rows)
        if (resp?.code !== 0) throw new Error(resp?.message || '保存失败')
        ElMessage.success('补助已保存')
        subsidyRows.value = []
        ensureSubsidyLoaded()
      }
    } catch (error: any) {
      console.error('保存参数失败:', error)
      ElMessage.error(error?.message || '保存失败')
    }
  })()
}

const rangeLabel = computed(() => {
  if (rangeForm.applyToAll) return '范围：全部在职员工'
  return `范围：指定员工（${rangeForm.employeeIds.length}人）`
})

const resetAddWizard = () => {
  addStep.value = 0
  addSaving.value = false
  addCompleting.value = false
  addStepSaved[0] = false
  addStepSaved[1] = false
  addRows.value = []
}

const loadAddEmployees = async () => {
  addEmployeesLoading.value = true
  try {
    addEmployees.value = await loadActiveEmployees()
  } catch (error) {
    console.error('加载员工列表失败:', error)
    ElMessage.error('加载员工列表失败')
    addEmployees.value = []
  } finally {
    addEmployeesLoading.value = false
  }
}

const handleAdd = async () => {
  resetAddWizard()
  await loadAddEmployees()
  resetRangeDialog()
  rangeDialogVisible.value = true
}

const getStep1EmployeeIds = () => {
  if (rangeForm.applyToAll) return addEmployees.value.map((emp) => emp.id)
  return rangeForm.employeeIds
}

const buildDraftRowsFromEmployees = (employeeIds: number[]) => {
  const selectedEmployees = addEmployees.value.filter((emp) => employeeIds.includes(emp.id))
  return selectedEmployees.map((emp) => ({
    employeeId: emp.id,
    employeeName: emp.employeeName,
    employeeNumber: String(emp.employeeNumber ?? ''),
    baseSalary: null,
    bonus: null,
    deduction: null,
    total: null,
    remark: ''
  }))
}

const resetRangeDialog = () => {
  rangeSaving.value = false
  rangeForm.month = queryForm.month || ''
  rangeForm.applyToAll = true
  rangeForm.employeeIds = []
}

const cancelRange = () => {
  resetRangeDialog()
  rangeDialogVisible.value = false
}

const saveRange = async () => {
  if (!rangeForm.month) {
    ElMessage.warning('请选择月份')
    return
  }
  const employeeIds = getStep1EmployeeIds()
  if (!employeeIds.length) {
    ElMessage.warning('请选择员工')
    return
  }

  rangeSaving.value = true
  try {
    addRows.value = buildDraftRowsFromEmployees(employeeIds)
    addStep.value = 0
    addStepSaved[0] = false
    addStepSaved[1] = false
    rangeDialogVisible.value = false
    addDialogVisible.value = true
  } finally {
    rangeSaving.value = false
  }
}

const saveAddStep = async () => {
  if (addStep.value === 0) {
    addSaving.value = true
    try {
      const rows = addRows.value.map((r) => ({ ...r, total: computeRowTotal(r) }))
      addRows.value = rows
      addStepSaved[0] = true
      ElMessage.success('步骤1已保存（未写入数据库）')
    } finally {
      addSaving.value = false
    }
    return
  }

  if (addStep.value === 1) {
    addSaving.value = true
    try {
      addStepSaved[1] = true
      ElMessage.success('步骤2已保存（未写入数据库）')
    } finally {
      addSaving.value = false
    }
    return
  }

  // 没有第三步
}

const goNextStep = () => {
  if (!addStepSaved[addStep.value]) {
    ElMessage.warning('请先保存当前步骤')
    return
  }
  addStep.value = Math.min(addStep.value + 1, 1)
}

const completeAdd = async () => {
  if (!addStepSaved[1]) {
    ElMessage.warning('请先保存步骤2')
    return
  }

  addCompleting.value = true
  try {
    const month = rangeForm.month
    const newRows: SalaryRow[] = addRows.value.map((row) => ({
      month,
      employeeName: row.employeeName,
      employeeNumber: row.employeeNumber,
      baseSalary: row.baseSalary,
      bonus: row.bonus,
      deduction: row.deduction,
      total: computeRowTotal(row),
      remark: row.remark
    }))
    tableData.value = [...newRows, ...tableData.value]
    pagination.total = tableData.value.length
    ElMessage.success('新增完成（未写入数据库）')
    addDialogVisible.value = false
  } finally {
    addCompleting.value = false
  }
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

.salary-add-body {
  margin-top: 12px;
}

.salary-add-step {
  margin-top: 12px;
}

.salary-add-summary {
  display: flex;
  gap: 18px;
  padding: 10px 0;
  font-size: 14px;
  color: var(--el-text-color-regular);
}

:deep(.salary-add-dialog .sa-col-input .cell) {
  padding: 0 !important;
}

:deep(.salary-add-dialog .sa-number.el-input-number) {
  width: 120px;
}

.salary-add-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.salary-add-header__title {
  font-size: 16px;
  font-weight: 600;
}

.salary-add-header__meta {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.salary-add-header__meta-text {
  font-size: 13px;
  color: var(--el-text-color-regular);
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
