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
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="month" label="月份" width="110" />
        <el-table-column prop="employeeCount" label="人数" width="80" align="center" />
        <el-table-column
          prop="overtimeNormalTotal"
          label="加班小计_普通"
          min-width="120"
          align="right"
        >
          <template #default="{ row }">{{ formatMoney(row.overtimeNormalTotal) }}</template>
        </el-table-column>
        <el-table-column
          prop="overtimeDoubleTotal"
          label="加班小计_两倍"
          min-width="120"
          align="right"
        >
          <template #default="{ row }">{{ formatMoney(row.overtimeDoubleTotal) }}</template>
        </el-table-column>
        <el-table-column
          prop="overtimeTripleTotal"
          label="加班小计_三倍"
          min-width="120"
          align="right"
        >
          <template #default="{ row }">{{ formatMoney(row.overtimeTripleTotal) }}</template>
        </el-table-column>
        <el-table-column
          prop="overtimeSubtotalTotal"
          label="加班小计合计"
          min-width="120"
          align="right"
        >
          <template #default="{ row }">{{ formatMoney(row.overtimeSubtotalTotal) }}</template>
        </el-table-column>
        <el-table-column prop="fullAttendanceCount" label="全勤人数" width="95" align="center" />
        <el-table-column prop="createdAt" label="创建时间" min-width="140">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column prop="updatedAt" label="更新时间" min-width="140">
          <template #default="{ row }">
            {{ formatDate(row.updatedAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right" align="center">
          <template #default="{ row }">
            <el-button
              type="primary"
              size="small"
              :disabled="!isEditableMonthString(row.month)"
              @click="handleEdit(row)"
            >
              编辑
            </el-button>
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

    <!-- 新增考勤 -->
    <el-dialog
      v-model="createDialogVisible"
      title="新增考勤"
      :width="isMobile ? '100%' : '480px'"
      :fullscreen="isMobile"
      :close-on-click-modal="false"
      class="att-create-dialog"
    >
      <el-form :model="createForm" label-width="70px">
        <el-form-item label="月份" required>
          <el-date-picker
            v-model="createForm.month"
            type="month"
            value-format="YYYY-MM"
            placeholder="选择月份"
            :disabled-date="isCreateMonthDisabled"
            :style="{ width: isMobile ? '100%' : '180px' }"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmCreate">确定</el-button>
      </template>
    </el-dialog>

    <!-- 编辑/查看考勤 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      :width="isMobile ? '100%' : '1420px'"
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
              disabled
              style="width: 150px"
            />
          </div>
        </div>
      </template>

      <div class="att-dialog-body" v-loading="dialogLoading">
        <el-table
          v-if="attendanceRows.length"
          :data="attendanceRows"
          border
          height="720"
          class="att-edit-grid"
          :row-class-name="() => 'att-row'"
          show-summary
          :summary-method="getAttendanceSummary"
          @sort-change="handleAttendanceSortChange"
        >
          <el-table-column type="index" label="序号" width="68" fixed="left" align="center" />
          <el-table-column
            prop="employeeName"
            width="100"
            fixed="left"
            sortable="custom"
            label-class-name="att-col-name-header"
          >
            <template #header>
              <span class="att-name-label">姓名</span>
              <el-tooltip content="展开/折叠员工信息列" placement="top">
                <span
                  class="att-column-toggle-icon att-name-toggle"
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
            </template>
          </el-table-column>
          <el-table-column
            v-if="showEmployeeExtraColumns"
            prop="employeeNumber"
            label="员工工号"
            width="95"
            fixed="left"
            sortable="custom"
          />
          <el-table-column
            v-if="showEmployeeExtraColumns"
            prop="department"
            label="所属部门"
            width="110"
            fixed="left"
            sortable="custom"
          />
          <el-table-column
            v-if="showEmployeeExtraColumns"
            prop="level"
            label="职级"
            width="80"
            fixed="left"
            sortable="custom"
          >
            <template #default="{ row }">
              <span v-if="row.level === 0">-</span>
              <span v-else>{{ row.level ?? '-' }}</span>
            </template>
          </el-table-column>
          <el-table-column
            v-if="showEmployeeExtraColumns"
            prop="gender"
            label="性别"
            width="75"
            fixed="left"
            sortable="custom"
          />
          <el-table-column
            v-if="showEmployeeExtraColumns"
            prop="entryDate"
            label="入职时间"
            width="110"
            fixed="left"
            sortable="custom"
          >
            <template #default="{ row }">
              {{ formatDate(row.entryDate) }}
            </template>
          </el-table-column>

          <el-table-column
            prop="overtimeHours"
            label="加班"
            width="85"
            align="center"
            class-name="att-col-input"
            label-class-name="att-col-input"
            sortable="custom"
          >
            <template #default="{ row }">
              <span v-if="isViewMode">{{ formatNumberInput(1)(row.overtimeHours ?? '-') }}</span>
              <el-input-number
                v-else
                v-model="row.overtimeHours"
                :min="0"
                :max="9999.9"
                :precision="1"
                :controls="false"
                :value-on-clear="null"
                :parser="numberParser"
                :formatter="formatNumberInput(1)"
                placeholder="-"
                size="small"
                class="att-number att-number--hours"
                :disabled="isOvertimeInputDisabled(row)"
              />
            </template>
          </el-table-column>
          <el-table-column
            prop="doubleOvertimeHours"
            label="两倍加班"
            width="95"
            align="center"
            class-name="att-col-input"
            label-class-name="att-col-input"
            sortable="custom"
          >
            <template #default="{ row }">
              <span v-if="isViewMode">{{
                formatNumberInput(1)(row.doubleOvertimeHours ?? '-')
              }}</span>
              <el-input-number
                v-else
                v-model="row.doubleOvertimeHours"
                :min="0"
                :max="9999.9"
                :precision="1"
                :controls="false"
                :value-on-clear="null"
                :parser="numberParser"
                :formatter="formatNumberInput(1)"
                placeholder="-"
                size="small"
                class="att-number att-number--hours"
                :disabled="isOvertimeInputDisabled(row)"
              />
            </template>
          </el-table-column>
          <el-table-column
            prop="tripleOvertimeHours"
            label="三倍加班"
            width="95"
            align="center"
            class-name="att-col-input"
            label-class-name="att-col-input"
            sortable="custom"
          >
            <template #default="{ row }">
              <span v-if="isViewMode">{{
                formatNumberInput(1)(row.tripleOvertimeHours ?? '-')
              }}</span>
              <el-input-number
                v-else
                v-model="row.tripleOvertimeHours"
                :min="0"
                :max="9999.9"
                :precision="1"
                :controls="false"
                :value-on-clear="null"
                :parser="numberParser"
                :formatter="formatNumberInput(1)"
                placeholder="-"
                size="small"
                class="att-number att-number--hours"
                :disabled="isOvertimeInputDisabled(row)"
              />
            </template>
          </el-table-column>
          <el-table-column
            prop="nightShiftCount"
            label="夜班天数"
            width="95"
            align="center"
            class-name="att-col-input"
            label-class-name="att-col-input"
            sortable="custom"
          >
            <template #default="{ row }">
              <span v-if="isViewMode">{{ formatNumberInput(0)(row.nightShiftCount ?? '-') }}</span>
              <el-input-number
                v-else
                v-model="row.nightShiftCount"
                :min="0"
                :precision="0"
                :controls="false"
                :value-on-clear="null"
                :parser="numberParser"
                :formatter="formatNumberInput(0)"
                placeholder="-"
                size="small"
                class="att-number"
                :disabled="isNightShiftInputDisabled()"
              />
            </template>
          </el-table-column>
          <el-table-column
            prop="mealAllowanceCount"
            label="误餐次数"
            width="95"
            align="center"
            class-name="att-col-input"
            label-class-name="att-col-input"
            sortable="custom"
          >
            <template #default="{ row }">
              <span v-if="isViewMode">{{
                formatNumberInput(0)(row.mealAllowanceCount ?? '-')
              }}</span>
              <el-input-number
                v-else
                v-model="row.mealAllowanceCount"
                :min="0"
                :max="99"
                :precision="0"
                :controls="false"
                :value-on-clear="null"
                :parser="numberParser"
                :formatter="formatNumberInput(0)"
                placeholder="-"
                size="small"
                class="att-number att-number--2d"
              />
            </template>
          </el-table-column>
          <el-table-column
            prop="fullAttendanceBonus"
            label="全勤"
            width="70"
            align="center"
            class-name="att-col-input"
            label-class-name="att-col-input"
            sortable="custom"
          >
            <template #default="{ row }">
              <span v-if="isViewMode">{{ isFullAttendance(row) ? '是' : '否' }}</span>
              <el-switch
                v-else
                :model-value="isFullAttendance(row)"
                inline-prompt
                active-text="是"
                inactive-text="否"
                size="small"
                @change="(val) => setFullAttendance(row, val === true)"
              />
            </template>
          </el-table-column>
          <el-table-column
            prop="lateCount"
            label="迟到次数"
            width="95"
            align="center"
            class-name="att-col-input"
            label-class-name="att-col-input"
            sortable="custom"
          >
            <template #default="{ row }">
              <span v-if="isViewMode">{{ formatNumberInput(0)(row.lateCount ?? '-') }}</span>
              <el-input-number
                v-else
                v-model="row.lateCount"
                :min="0"
                :precision="0"
                :controls="false"
                :value-on-clear="null"
                :parser="numberParser"
                :formatter="formatNumberInput(0)"
                placeholder="-"
                size="small"
                class="att-number"
              />
            </template>
          </el-table-column>
          <el-table-column
            prop="newOrPersonalLeaveHours"
            label="新进及事假时"
            width="115"
            align="center"
            class-name="att-col-input"
            label-class-name="att-col-input"
            sortable="custom"
          >
            <template #default="{ row }">
              <span v-if="isViewMode">{{
                formatNumberInput(1)(row.newOrPersonalLeaveHours ?? '-')
              }}</span>
              <el-input-number
                v-else
                v-model="row.newOrPersonalLeaveHours"
                :min="0"
                :precision="1"
                :controls="false"
                :value-on-clear="null"
                :parser="numberParser"
                :formatter="formatNumberInput(1)"
                placeholder="-"
                size="small"
                class="att-number"
              />
            </template>
          </el-table-column>
          <el-table-column
            prop="sickLeaveHours"
            label="病假小时"
            width="95"
            align="center"
            class-name="att-col-input"
            label-class-name="att-col-input"
            sortable="custom"
          >
            <template #default="{ row }">
              <span v-if="isViewMode">{{ formatNumberInput(1)(row.sickLeaveHours ?? '-') }}</span>
              <el-input-number
                v-else
                v-model="row.sickLeaveHours"
                :min="0"
                :precision="1"
                :controls="false"
                :value-on-clear="null"
                :parser="numberParser"
                :formatter="formatNumberInput(1)"
                placeholder="-"
                size="small"
                class="att-number"
              />
            </template>
          </el-table-column>
          <el-table-column
            prop="absenceHours"
            label="旷工小时"
            width="95"
            align="center"
            class-name="att-col-input"
            label-class-name="att-col-input"
            sortable="custom"
          >
            <template #default="{ row }">
              <span v-if="isViewMode">{{ formatNumberInput(1)(row.absenceHours ?? '-') }}</span>
              <el-input-number
                v-else
                v-model="row.absenceHours"
                :min="0"
                :precision="1"
                :controls="false"
                :value-on-clear="null"
                :parser="numberParser"
                :formatter="formatNumberInput(1)"
                placeholder="-"
                size="small"
                class="att-number"
              />
            </template>
          </el-table-column>
          <el-table-column
            prop="hygieneFee"
            label="卫生费"
            width="85"
            align="center"
            class-name="att-col-input"
            label-class-name="att-col-input"
            sortable="custom"
          >
            <template #default="{ row }">
              <span v-if="isViewMode">{{ formatNumberInput(2)(row.hygieneFee ?? '-') }}</span>
              <el-input-number
                v-else
                v-model="row.hygieneFee"
                :min="0"
                :precision="2"
                :controls="false"
                :value-on-clear="null"
                :parser="numberParser"
                :formatter="formatNumberInput(2)"
                placeholder="-"
                size="small"
                class="att-number"
              />
            </template>
          </el-table-column>
          <el-table-column
            prop="waterFee"
            label="水费"
            width="85"
            align="center"
            class-name="att-col-input"
            label-class-name="att-col-input"
            sortable="custom"
          >
            <template #default="{ row }">
              <span v-if="isViewMode">{{ formatNumberInput(2)(row.waterFee ?? '-') }}</span>
              <el-input-number
                v-else
                v-model="row.waterFee"
                :min="0"
                :precision="2"
                :controls="false"
                :value-on-clear="null"
                :parser="numberParser"
                :formatter="formatNumberInput(2)"
                placeholder="-"
                size="small"
                class="att-number"
              />
            </template>
          </el-table-column>
          <el-table-column
            prop="electricityFee"
            label="电费"
            width="85"
            align="center"
            class-name="att-col-input"
            label-class-name="att-col-input"
            sortable="custom"
          >
            <template #default="{ row }">
              <span v-if="isViewMode">{{ formatNumberInput(2)(row.electricityFee ?? '-') }}</span>
              <el-input-number
                v-else
                v-model="row.electricityFee"
                :min="0"
                :precision="2"
                :controls="false"
                :value-on-clear="null"
                :parser="numberParser"
                :formatter="formatNumberInput(2)"
                placeholder="-"
                size="small"
                class="att-number"
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
import { ElMessage, ElMessageBox } from 'element-plus'
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

const createDialogVisible = ref(false)
const createForm = reactive({ month: '' })

const dialogVisible = ref(false)
const dialogTitle = ref('编辑考勤')
const dialogLoading = ref(false)
const saving = ref(false)
const isViewMode = ref(false)
const currentId = ref<number | null>(null)
const editMonth = ref('')
const attendanceRows = ref<AttendanceRecord[]>([])
const showEmployeeExtraColumns = ref(false)

const paginationLayout = computed(() =>
  isMobile.value ? 'prev, pager, next' : 'total, sizes, prev, pager, next, jumper'
)
const paginationPagerCount = computed(() => (isMobile.value ? 5 : 7))

const handleAttendanceSortChange = (payload: {
  prop?: string
  order?: 'ascending' | 'descending' | null
}) => {
  const prop = payload?.prop || null
  const order = payload?.order || null

  const dir = order === 'descending' ? -1 : 1

  const toText = (val: unknown) => {
    if (val === null || val === undefined) return ''
    return String(val).trim()
  }

  const compareNullableNumber = (a: unknown, b: unknown) => {
    const na = toNumberOrNull(a)
    const nb = toNumberOrNull(b)
    if (na === null && nb === null) return 0
    if (na === null) return 1
    if (nb === null) return -1
    return (na - nb) * dir
  }

  const compareNullableText = (a: unknown, b: unknown) => {
    const as = toText(a)
    const bs = toText(b)
    if (!as && !bs) return 0
    if (!as) return 1
    if (!bs) return -1
    return as.localeCompare(bs, 'zh-CN', { numeric: true, sensitivity: 'base' }) * dir
  }

  const compareNullableDate = (a: unknown, b: unknown) => {
    const at = toText(a)
    const bt = toText(b)
    if (!at && !bt) return 0
    if (!at) return 1
    if (!bt) return -1
    const ad = new Date(at).getTime()
    const bd = new Date(bt).getTime()
    const aValid = !Number.isNaN(ad)
    const bValid = !Number.isNaN(bd)
    if (aValid && bValid) return (ad - bd) * dir
    if (aValid && !bValid) return -1
    if (!aValid && bValid) return 1
    return at.localeCompare(bt, 'zh-CN', { numeric: true, sensitivity: 'base' }) * dir
  }

  const sortByEmployeeNumberAsc = () => {
    attendanceRows.value = [...attendanceRows.value].sort((a, b) =>
      compareEmployeeNumberAsc(a.employeeNumber, b.employeeNumber)
    )
  }

  if (!prop || !order) {
    sortByEmployeeNumberAsc()
    return
  }

  if (prop === 'employeeNumber') {
    attendanceRows.value = [...attendanceRows.value].sort(
      (a, b) => compareEmployeeNumberAsc(a.employeeNumber, b.employeeNumber) * dir
    )
    return
  }

  if (prop === 'employeeName' || prop === 'department' || prop === 'gender') {
    attendanceRows.value = [...attendanceRows.value].sort((a, b) =>
      compareNullableText((a as any)[prop], (b as any)[prop])
    )
    return
  }

  if (prop === 'entryDate') {
    attendanceRows.value = [...attendanceRows.value].sort((a, b) =>
      compareNullableDate((a as any)[prop], (b as any)[prop])
    )
    return
  }

  const numericProps = new Set([
    'level',
    'overtimeHours',
    'doubleOvertimeHours',
    'tripleOvertimeHours',
    'nightShiftCount',
    'mealAllowanceCount',
    'fullAttendanceBonus',
    'lateCount',
    'newOrPersonalLeaveHours',
    'sickLeaveHours',
    'absenceHours',
    'hygieneFee',
    'waterFee',
    'electricityFee'
  ])

  if (numericProps.has(prop)) {
    attendanceRows.value = [...attendanceRows.value].sort((a, b) =>
      compareNullableNumber((a as any)[prop], (b as any)[prop])
    )
    return
  }

  sortByEmployeeNumberAsc()
}

const getAttendanceSummary = (payload: { columns: any[]; data: AttendanceRecord[] }) => {
  const { columns, data } = payload
  const sums: string[] = []
  if (!data?.length) return sums

  const precisionByProp: Record<string, number> = {
    overtimeHours: 1,
    doubleOvertimeHours: 1,
    tripleOvertimeHours: 1,
    newOrPersonalLeaveHours: 1,
    sickLeaveHours: 1,
    absenceHours: 1,
    lateCount: 0,
    nightShiftCount: 0,
    mealAllowanceCount: 0,
    hygieneFee: 2,
    waterFee: 2,
    electricityFee: 2
  }

  const toFixedSafe = (val: number, precision: number) => {
    const rounded = Math.round(val * Math.pow(10, precision)) / Math.pow(10, precision)
    return precision === 0 ? String(rounded) : rounded.toFixed(precision)
  }

  columns.forEach((column, index) => {
    if (index === 0) {
      sums[index] = '合计'
      return
    }
    const prop = String(column.property || '').trim()
    if (!prop) {
      sums[index] = ''
      return
    }
    const precision = precisionByProp[prop]
    if (precision === undefined) {
      sums[index] = ''
      return
    }
    const total = data.reduce((acc, row) => {
      const num = toNumberOrNull((row as any)[prop])
      return acc + (num ?? 0)
    }, 0)
    sums[index] = toFixedSafe(total, precision)
  })

  return sums
}

const toNumberOrNull = (val: unknown) => {
  if (val === null || val === undefined || val === '') return null
  const num = Number(val)
  return Number.isNaN(num) ? null : num
}

const compareEmployeeNumberAsc = (a: unknown, b: unknown) => {
  const as = a === null || a === undefined ? '' : String(a).trim()
  const bs = b === null || b === undefined ? '' : String(b).trim()
  const an = Number(as)
  const bn = Number(bs)
  const aIsNum = as !== '' && !Number.isNaN(an)
  const bIsNum = bs !== '' && !Number.isNaN(bn)
  if (aIsNum && bIsNum) return an - bn
  return as.localeCompare(bs, 'zh-CN', { numeric: true, sensitivity: 'base' })
}

const sortRowsByEmployeeNumber = (rows: AttendanceRecord[]) => {
  rows.sort((a, b) => compareEmployeeNumberAsc(a.employeeNumber, b.employeeNumber))
  return rows
}

const isSameMonth = (a: Date, b: Date) => {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}

const getAllowedCreateMonths = () => {
  const now = new Date()
  const current = new Date(now.getFullYear(), now.getMonth(), 1)
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  return { current, prev }
}

const isCreateMonthDisabled = (date: Date) => {
  const { current, prev } = getAllowedCreateMonths()
  return !(isSameMonth(date, current) || isSameMonth(date, prev))
}

const isAllowedCreateMonthString = (month: string) => {
  const match = /^(\d{4})-(\d{2})$/.exec(month)
  if (!match) return false
  const y = Number(match[1])
  const m = Number(match[2]) - 1
  if (Number.isNaN(y) || Number.isNaN(m)) return false
  const selected = new Date(y, m, 1)
  const { current, prev } = getAllowedCreateMonths()
  return isSameMonth(selected, current) || isSameMonth(selected, prev)
}

const isEditableMonthString = (month: string) => isAllowedCreateMonthString(month)

const numberParser = (val: string) => {
  if (val === '-' || val.trim() === '') return null
  const num = Number(val)
  return Number.isNaN(num) ? null : num
}

const formatNumberInput = (precision: number) => {
  return (val: number | string) => {
    if (val === null || val === undefined || val === '' || val === '-') return '-'
    const num = Number(val)
    if (Number.isNaN(num)) return '-'
    return num.toFixed(precision)
  }
}

const isLevelEmptyOrZero = (level: unknown) => {
  if (level === null || level === undefined) return true
  if (typeof level === 'number') return level === 0
  const text = String(level).trim()
  if (!text) return true
  const num = Number(text)
  if (Number.isNaN(num)) return false
  return num === 0
}

const isOvertimeInputDisabled = (row: AttendanceRecord) => {
  if (isViewMode.value) return true
  return isLevelEmptyOrZero(row.level)
}

const isNightShiftInputDisabled = () => {
  return isViewMode.value
}

const isFullAttendance = (row: AttendanceRecord) => {
  const val = row.fullAttendanceBonus
  if (val === null || val === undefined) return false
  const num = Number(val)
  if (Number.isNaN(num)) return false
  return num !== 0
}

const setFullAttendance = (row: AttendanceRecord, val: boolean) => {
  row.fullAttendanceBonus = val ? 1 : null
}

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

const confirmCreate = () => {
  if (!createForm.month) {
    ElMessage.warning('请选择月份')
    return
  }

  void (async () => {
    try {
      const response: any = await getAttendanceListApi({
        month: createForm.month,
        page: 1,
        pageSize: 1
      })

      let list: AttendanceSummary[] = []
      if (response?.code === 0 && response?.data) {
        list = response.data.list || []
      } else {
        list = response?.list || response?.data?.list || response?.data || []
      }

      const existed = list?.[0]
      if (existed?.id) {
        await ElMessageBox.confirm(
          `【${createForm.month}】考勤记录已存在，不能重复新增。\n是否打开编辑？`,
          '提示',
          {
            confirmButtonText: '打开编辑',
            cancelButtonText: '取消',
            type: 'warning'
          }
        )
        createDialogVisible.value = false
        await handleEdit(existed)
        return
      }
    } catch (error) {
      console.error('检查考勤月份是否存在失败:', error)
      ElMessage.error('检查考勤月份是否存在失败')
      return
    }

    createDialogVisible.value = false
    isViewMode.value = false
    currentId.value = null
    dialogTitle.value = '考勤数据'
    editMonth.value = createForm.month
    attendanceRows.value = []
    dialogVisible.value = true
    await initRows()
  })()
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
  const { prev } = getAllowedCreateMonths()
  const preset = queryForm.month || ''
  createForm.month = preset && isAllowedCreateMonthString(preset) ? preset : formatMonth(prev)
  createDialogVisible.value = true
}

const handleRowDblClick = (row: AttendanceSummary) => {
  void handleEdit(row)
}

const handleEdit = async (row: AttendanceSummary) => {
  if (!isEditableMonthString(row.month)) {
    ElMessage.warning('只能编辑当月和上一个月的考勤记录，已为你打开查看模式')
    await handleView(row)
    return
  }
  if (row?.isLocked) {
    const salaryId = (row as any)?.lockedSalaryId
    ElMessage.warning(
      `该月份考勤已由工资锁定${salaryId ? `（工资ID：${salaryId}）` : ''}，请先在工资页解锁后再编辑`
    )
    return
  }
  isViewMode.value = false
  dialogTitle.value = '考勤数据'
  currentId.value = row.id
  editMonth.value = row.month
  attendanceRows.value = []
  dialogVisible.value = true
  await loadDetail(row.id)
}

const handleView = async (row: AttendanceSummary) => {
  isViewMode.value = true
  dialogTitle.value = '考勤数据'
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
    if (!isViewMode.value) {
      await syncEmployeesMerged({ keepNonActiveExisting: true })
    }
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
    await syncEmployeesMerged({ keepNonActiveExisting: false })
  } catch (error) {
    console.error('初始化考勤行失败:', error)
    attendanceRows.value = []
  } finally {
    dialogLoading.value = false
  }
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
  return list.filter((item) => item.employeeName !== '常冬泉')
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
    overtimeHours: null,
    doubleOvertimeHours: null,
    tripleOvertimeHours: null,
    nightShiftCount: null,
    overtimeSubtotal: null,
    seniorityYears: null,
    fullAttendanceBonus: null,
    mealAllowanceCount: null,
    subsidySubtotal: null,
    lateCount: null,
    newOrPersonalLeaveHours: null,
    sickLeaveHours: null,
    absenceHours: null,
    hygieneFee: null,
    waterFee: null,
    electricityFee: null,
    deductionSubtotal: null
  }
}

const syncEmployeesMerged = async (options: { keepNonActiveExisting: boolean }) => {
  const employees = await loadActiveEmployees()
  const existingRows = attendanceRows.value || []
  const existingById = new Map<number, AttendanceRecord>()
  for (const row of existingRows) existingById.set(row.employeeId, row)

  const merged = employees.map((emp) => {
    const base = buildRecordFromEmployee(emp)
    const existing = existingById.get(emp.id)
    if (!existing) return base
    return {
      ...base,
      overtimeHours: existing.overtimeHours,
      doubleOvertimeHours: existing.doubleOvertimeHours,
      tripleOvertimeHours: existing.tripleOvertimeHours,
      nightShiftCount: existing.nightShiftCount,
      fullAttendanceBonus: existing.fullAttendanceBonus,
      mealAllowanceCount: existing.mealAllowanceCount,
      lateCount: existing.lateCount,
      newOrPersonalLeaveHours: existing.newOrPersonalLeaveHours,
      sickLeaveHours: existing.sickLeaveHours,
      absenceHours: existing.absenceHours,
      hygieneFee: existing.hygieneFee,
      waterFee: existing.waterFee,
      electricityFee: existing.electricityFee
    } satisfies AttendanceRecord
  })

  if (options.keepNonActiveExisting) {
    for (const row of existingRows) {
      if (!employees.some((emp) => emp.id === row.employeeId)) merged.push(row)
    }
  }

  attendanceRows.value = sortRowsByEmployeeNumber(merged)
}

const normalizeRecords = (records: AttendanceRecord[]) => {
  const normalized = records.map((rec) => ({
    employeeId: rec.employeeId,
    employeeName: rec.employeeName,
    gender: rec.gender,
    employeeNumber: rec.employeeNumber,
    department: rec.department,
    level: rec.level,
    entryDate: rec.entryDate,
    overtimeHours: toNumberOrNull(rec.overtimeHours),
    doubleOvertimeHours: toNumberOrNull(rec.doubleOvertimeHours),
    tripleOvertimeHours: toNumberOrNull(rec.tripleOvertimeHours),
    nightShiftCount: toNumberOrNull(rec.nightShiftCount),
    overtimeSubtotal: toNumberOrNull(rec.overtimeSubtotal),
    seniorityYears: toNumberOrNull(rec.seniorityYears),
    fullAttendanceBonus: toNumberOrNull(rec.fullAttendanceBonus),
    mealAllowanceCount: toNumberOrNull(rec.mealAllowanceCount),
    subsidySubtotal: toNumberOrNull(rec.subsidySubtotal),
    lateCount: toNumberOrNull(rec.lateCount),
    newOrPersonalLeaveHours: toNumberOrNull(rec.newOrPersonalLeaveHours),
    sickLeaveHours: toNumberOrNull(rec.sickLeaveHours),
    absenceHours: toNumberOrNull(rec.absenceHours),
    hygieneFee: toNumberOrNull(rec.hygieneFee),
    waterFee: toNumberOrNull(rec.waterFee),
    electricityFee: (() => {
      const val = toNumberOrNull(rec.electricityFee)
      return val === 0 ? null : val
    })(),
    deductionSubtotal: toNumberOrNull(rec.deductionSubtotal)
  }))
  return sortRowsByEmployeeNumber(normalized)
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

const formatMoney = (val?: number | null) => {
  if (val === null || val === undefined) return '-'
  const num = Number(val)
  if (Number.isNaN(num)) return '-'
  return num.toFixed(2)
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
  font-size: 14px;
}

:deep(.att-edit-grid .el-table__header-wrapper th.el-table__cell .cell) {
  font-size: 14px;
  white-space: nowrap;
}

:deep(.att-edit-grid .el-table__body-wrapper td.el-table__cell .cell) {
  white-space: nowrap;
}

:deep(.att-edit-grid .el-table__header-wrapper) {
  position: sticky;
  top: 0;
  z-index: 1;
}

:deep(.att-edit-grid .el-table__cell) {
  padding: 2px 0;
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
  display: inline-flex;
  width: 65px;
}

:deep(.att-number--2d.el-input-number) {
  width: 65px;
}

:deep(.att-number--60.el-input-number) {
  width: 65px;
}

:deep(.att-number .el-input__wrapper) {
  padding: 0 6px;
}

:deep(.att-number .el-input__inner) {
  font-size: 14px;
}

:deep(.att-edit-grid .el-input__inner::placeholder) {
  opacity: 1;
}

:deep(.att-edit-grid .att-col-input .cell) {
  padding: 0 !important;
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

:deep(.att-edit-grid th.att-col-name-header .cell) {
  display: flex;
  align-items: center;
  gap: 6px;
}

:deep(.att-edit-grid th.att-col-name-header .cell .att-name-label) {
  order: 1;
}

:deep(.att-edit-grid th.att-col-name-header .cell .caret-wrapper) {
  order: 2;
}

:deep(.att-edit-grid th.att-col-name-header .cell .att-name-toggle) {
  order: 3;
  margin-left: auto;
}
</style>
