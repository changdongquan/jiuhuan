<template>
  <div class="p-4 space-y-4">
    <el-form
      ref="queryFormRef"
      :model="queryForm"
      label-width="100px"
      inline
      class="rounded-lg bg-[var(--el-bg-color-overlay)] p-4 shadow-sm"
    >
      <el-form-item :label="t('procurement.vendorName')">
        <el-input
          v-model="queryForm.vendor"
          :placeholder="t('procurement.vendorPlaceholder')"
          clearable
          style="width: 220px"
        />
      </el-form-item>
      <el-form-item :label="t('procurement.orderCode')">
        <el-input
          v-model="queryForm.orderCode"
          :placeholder="t('procurement.orderPlaceholder')"
          clearable
          style="width: 220px"
        />
      </el-form-item>
      <el-form-item :label="t('procurement.status')">
        <el-select
          v-model="queryForm.status"
          :placeholder="t('common.selectText')"
          clearable
          style="width: 200px"
        >
          <el-option
            v-for="item in statusOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('procurement.dueRange')">
        <el-date-picker
          v-model="queryForm.dueRange"
          type="daterange"
          value-format="YYYY-MM-DD"
          :start-placeholder="t('common.startTimeText')"
          :end-placeholder="t('common.endTimeText')"
          range-separator="~"
          clearable
          style="width: 320px"
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="handleSearch">{{ t('common.query') }}</el-button>
        <el-button @click="handleReset">{{ t('common.reset') }}</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="16">
      <el-col :xs="24" :sm="12" :lg="6">
        <el-card shadow="hover" class="summary-card">
          <div class="summary-title">{{ t('procurement.totalOrders') }}</div>
          <div class="summary-value">{{ summary.totalOrders }}</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="6">
        <el-card shadow="hover" class="summary-card">
          <div class="summary-title">{{ t('procurement.pendingAmount') }}</div>
          <div class="summary-value">¥ {{ formatAmount(summary.pendingAmount) }}</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="6">
        <el-card shadow="hover" class="summary-card">
          <div class="summary-title">{{ t('procurement.inProgressCount') }}</div>
          <div class="summary-value">{{ summary.inProgress }}</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="6">
        <el-card shadow="hover" class="summary-card">
          <div class="summary-title">{{ t('procurement.delayedCount') }}</div>
          <div class="summary-value">{{ summary.delayed }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-table
      v-loading="loading"
      :data="filteredOrders"
      border
      height="520"
      row-key="id"
      class="rounded-lg bg-[var(--el-bg-color-overlay)] shadow-sm"
    >
      <el-table-column type="index" width="60" :label="t('procurement.serial')" align="center" />
      <el-table-column prop="orderCode" :label="t('procurement.orderCode')" min-width="160" />
      <el-table-column prop="vendor" :label="t('procurement.vendorName')" min-width="160" />
      <el-table-column prop="partName" :label="t('procurement.partName')" min-width="160" />
      <el-table-column
        prop="quantity"
        :label="t('procurement.quantity')"
        width="120"
        align="right"
      />
      <el-table-column :label="t('procurement.amount')" width="140" align="right">
        <template #default="{ row }"> ¥ {{ formatAmount(row.amount) }} </template>
      </el-table-column>
      <el-table-column :label="t('procurement.status')" width="140" align="center">
        <template #default="{ row }">
          <el-tag :type="statusTagMap[row.status].type">
            {{ statusTagMap[row.status].label }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="plannedCompletion" :label="t('procurement.plannedDate')" width="140" />
      <el-table-column prop="actualCompletion" :label="t('procurement.actualDate')" width="140" />
      <el-table-column
        prop="remark"
        :label="t('procurement.remark')"
        min-width="220"
        show-overflow-tooltip
      />
    </el-table>
  </div>
</template>

<script setup lang="ts">
import {
  ElButton,
  ElCard,
  ElCol,
  ElDatePicker,
  ElForm,
  ElFormItem,
  ElInput,
  ElOption,
  ElRow,
  ElSelect,
  ElTable,
  ElTableColumn,
  ElTag
} from 'element-plus'
import type { FormInstance } from 'element-plus'
import { computed, reactive, ref } from 'vue'
import { useI18n } from '@/hooks/web/useI18n'

const { t } = useI18n()

type ProcurementStatus = 'pending' | 'inProgress' | 'completed' | 'delayed'

interface OutsourcingOrder {
  id: number
  orderCode: string
  vendor: string
  partName: string
  quantity: number
  amount: number
  status: ProcurementStatus
  plannedCompletion: string
  actualCompletion?: string
  remark: string
}

const queryFormRef = ref<FormInstance>()
const loading = ref(false)

const queryForm = reactive({
  vendor: '',
  orderCode: '',
  status: '' as ProcurementStatus | '',
  dueRange: [] as [string, string] | []
})

const statusOptions = [
  { label: t('procurement.statusPending'), value: 'pending' },
  { label: t('procurement.statusInProgress'), value: 'inProgress' },
  { label: t('procurement.statusCompleted'), value: 'completed' },
  { label: t('procurement.statusDelayed'), value: 'delayed' }
]

const statusTagMap: Record<
  ProcurementStatus,
  { label: string; type: 'info' | 'success' | 'warning' | 'danger' }
> = {
  pending: { label: t('procurement.statusPending'), type: 'info' },
  inProgress: { label: t('procurement.statusInProgress'), type: 'warning' },
  completed: { label: t('procurement.statusCompleted'), type: 'success' },
  delayed: { label: t('procurement.statusDelayed'), type: 'danger' }
}

const orders = ref<OutsourcingOrder[]>([
  {
    id: 1,
    orderCode: 'PO-240301',
    vendor: '苏州精工版材',
    partName: '外壳钣金套件',
    quantity: 120,
    amount: 78000,
    status: 'inProgress',
    plannedCompletion: '2024-03-28',
    remark: '首批材料已到厂，待二次加工'
  },
  {
    id: 2,
    orderCode: 'PO-240302',
    vendor: '深圳宏达电子',
    partName: '控制板焊接',
    quantity: 200,
    amount: 96000,
    status: 'pending',
    plannedCompletion: '2024-04-05',
    remark: '等待供应商确认排产'
  },
  {
    id: 3,
    orderCode: 'PO-240215',
    vendor: '常州裕达机加工',
    partName: '轴套精铣',
    quantity: 80,
    amount: 54000,
    status: 'completed',
    plannedCompletion: '2024-03-10',
    actualCompletion: '2024-03-08',
    remark: '已入库待检'
  },
  {
    id: 4,
    orderCode: 'PO-240205',
    vendor: '无锡协成五金',
    partName: '紧固件外协',
    quantity: 500,
    amount: 28000,
    status: 'delayed',
    plannedCompletion: '2024-03-05',
    remark: '供应商产能不足，预计延迟一周交付'
  }
])

const formatAmount = (value: number) =>
  Number(value ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })

const filteredOrders = computed(() => {
  return orders.value.filter((order) => {
    const vendorMatch = queryForm.vendor
      ? order.vendor.toLowerCase().includes(queryForm.vendor.toLowerCase())
      : true
    const codeMatch = queryForm.orderCode
      ? order.orderCode.toLowerCase().includes(queryForm.orderCode.toLowerCase())
      : true
    const statusMatch = queryForm.status ? order.status === queryForm.status : true
    const planned = order.plannedCompletion
    const rangeMatch =
      queryForm.dueRange.length === 2 && planned
        ? planned >= queryForm.dueRange[0] && planned <= queryForm.dueRange[1]
        : true
    return vendorMatch && codeMatch && statusMatch && rangeMatch
  })
})

const summary = computed(() => {
  const result = {
    totalOrders: filteredOrders.value.length,
    pendingAmount: 0,
    inProgress: 0,
    delayed: 0
  }
  filteredOrders.value.forEach((order) => {
    if (order.status === 'pending') result.pendingAmount += order.amount
    if (order.status === 'inProgress') result.inProgress += 1
    if (order.status === 'delayed') result.delayed += 1
  })
  return result
})

const handleSearch = () => {
  loading.value = true
  requestAnimationFrame(() => {
    loading.value = false
  })
}

const handleReset = () => {
  queryForm.vendor = ''
  queryForm.orderCode = ''
  queryForm.status = ''
  queryForm.dueRange = []
  handleSearch()
}
</script>

<style scoped>
.summary-card {
  border: none;
  background: linear-gradient(145deg, rgba(103, 194, 58, 0.14), rgba(103, 194, 58, 0.04));
}

.summary-title {
  color: var(--el-text-color-secondary);
  font-size: 14px;
  margin-bottom: 6px;
}

.summary-value {
  font-size: 22px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
</style>
