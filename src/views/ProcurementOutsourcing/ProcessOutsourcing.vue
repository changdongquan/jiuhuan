<template>
  <div class="p-4 space-y-4">
    <!-- 搜索表单 -->
    <el-card shadow="never" class="search-card">
      <el-form ref="queryFormRef" :model="queryForm" label-width="100px" inline class="search-form">
        <el-form-item :label="t('processOutsourcing.orderNo')">
          <el-input
            v-model="queryForm.orderNo"
            :placeholder="t('processOutsourcing.orderNoPlaceholder')"
            clearable
            style="width: 220px"
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item :label="t('processOutsourcing.supplier')">
          <el-input
            v-model="queryForm.supplier"
            :placeholder="t('processOutsourcing.supplierPlaceholder')"
            clearable
            style="width: 220px"
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item :label="t('processOutsourcing.processType')">
          <el-select
            v-model="queryForm.processType"
            :placeholder="t('processOutsourcing.processTypePlaceholder')"
            clearable
            style="width: 200px"
          >
            <el-option
              v-for="item in processTypeOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('processOutsourcing.status')">
          <el-select
            v-model="queryForm.status"
            :placeholder="t('common.selectText')"
            clearable
            style="width: 180px"
          >
            <el-option
              v-for="item in statusOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('processOutsourcing.orderDate')">
          <el-date-picker
            v-model="queryForm.orderDateRange"
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
          <el-button type="primary" @click="handleSearch" :loading="loading">
            <el-icon><Search /></el-icon>
            {{ t('common.query') }}
          </el-button>
          <el-button @click="handleReset">
            <el-icon><Refresh /></el-icon>
            {{ t('common.reset') }}
          </el-button>
          <el-button type="success" @click="handleAdd">
            <el-icon><Plus /></el-icon>
            {{ t('processOutsourcing.addOrder') }}
          </el-button>
          <el-button type="warning" @click="handleExport">
            <el-icon><Download /></el-icon>
            {{ t('common.export') }}
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 统计卡片 -->
    <el-row :gutter="16">
      <el-col :xs="24" :sm="12" :lg="6">
        <el-card shadow="hover" class="summary-card summary-card--blue">
          <div class="summary-content">
            <div class="summary-icon">
              <el-icon><Operation /></el-icon>
            </div>
            <div class="summary-info">
              <div class="summary-title">{{ t('processOutsourcing.totalOrders') }}</div>
              <div class="summary-value">{{ summary.totalOrders }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="6">
        <el-card shadow="hover" class="summary-card summary-card--green">
          <div class="summary-content">
            <div class="summary-icon">
              <el-icon><Money /></el-icon>
            </div>
            <div class="summary-info">
              <div class="summary-title">{{ t('processOutsourcing.totalValue') }}</div>
              <div class="summary-value">¥ {{ formatAmount(summary.totalValue) }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="6">
        <el-card shadow="hover" class="summary-card summary-card--orange">
          <div class="summary-content">
            <div class="summary-icon">
              <el-icon><Clock /></el-icon>
            </div>
            <div class="summary-info">
              <div class="summary-title">{{ t('processOutsourcing.pendingCount') }}</div>
              <div class="summary-value">{{ summary.pendingCount }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="6">
        <el-card shadow="hover" class="summary-card summary-card--gray">
          <div class="summary-content">
            <div class="summary-icon">
              <el-icon><Check /></el-icon>
            </div>
            <div class="summary-info">
              <div class="summary-title">{{ t('processOutsourcing.completedCount') }}</div>
              <div class="summary-value">{{ summary.completedCount }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 数据表格 -->
    <el-card shadow="never" class="table-card">
      <template #header>
        <div class="card-header">
          <span class="card-title">{{ t('processOutsourcing.orderList') }}</span>
          <div class="card-actions">
            <el-button
              type="primary"
              size="small"
              @click="handleBatchConfirm"
              :disabled="!selectedRows.length"
            >
              <el-icon><Check /></el-icon>
              {{ t('processOutsourcing.batchConfirm') }}
            </el-button>
            <el-button
              type="success"
              size="small"
              @click="handleBatchExport"
              :disabled="!selectedRows.length"
            >
              <el-icon><Download /></el-icon>
              {{ t('common.batchExport') }}
            </el-button>
          </div>
        </div>
      </template>

      <el-table
        v-loading="loading"
        :data="paginatedOrders"
        border
        height="520"
        row-key="id"
        @selection-change="handleSelectionChange"
        @sort-change="handleSortChange"
        @row-dblclick="handleRowDoubleClick"
        class="data-table"
      >
        <el-table-column type="selection" width="50" align="center" />
        <el-table-column
          type="index"
          width="60"
          :label="t('processOutsourcing.serial')"
          align="center"
        />
        <el-table-column
          prop="orderNo"
          :label="t('processOutsourcing.orderNo')"
          min-width="160"
          sortable="custom"
          show-overflow-tooltip
        />
        <el-table-column
          prop="supplier"
          :label="t('processOutsourcing.supplier')"
          min-width="160"
          show-overflow-tooltip
        />
        <el-table-column
          prop="processType"
          :label="t('processOutsourcing.processType')"
          width="120"
        />
        <el-table-column
          prop="processCount"
          :label="t('processOutsourcing.processCount')"
          width="120"
          align="right"
          sortable="custom"
        />
        <el-table-column
          :label="t('processOutsourcing.totalValue')"
          width="140"
          align="right"
          sortable="custom"
        >
          <template #default="{ row }"> ¥ {{ formatAmount(row.totalValue) }} </template>
        </el-table-column>
        <el-table-column :label="t('processOutsourcing.status')" width="120" align="center">
          <template #default="{ row }">
            <el-tag :type="statusTagMap[row.status].type" size="small">
              {{ statusTagMap[row.status].label }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          prop="orderDate"
          :label="t('processOutsourcing.orderDate')"
          width="140"
          sortable="custom"
        />
        <el-table-column prop="operator" :label="t('processOutsourcing.operator')" width="120" />
        <el-table-column
          prop="remark"
          :label="t('processOutsourcing.remark')"
          min-width="150"
          show-overflow-tooltip
        />
        <el-table-column :label="t('common.operation')" width="240" align="center" fixed="right">
          <template #default="{ row }">
            <div class="operation-buttons">
              <el-button type="primary" size="small" @click="handleEdit(row)">
                <el-icon><Edit /></el-icon>
                {{ t('common.edit') }}
              </el-button>
              <el-button type="success" size="small" @click="handleView(row)">
                <el-icon><View /></el-icon>
                {{ t('common.view') }}
              </el-button>
              <el-button type="danger" size="small" @click="handleDelete(row)">
                <el-icon><Delete /></el-icon>
                {{ t('common.delete') }}
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-container">
        <el-pagination
          v-model:current-page="pagination.currentPage"
          v-model:page-size="pagination.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </el-card>

    <!-- 新增/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="900px"
      :close-on-click-modal="false"
      @close="handleDialogClose"
    >
      <el-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-width="120px"
        class="form-dialog"
      >
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item :label="t('processOutsourcing.orderNo')" prop="orderNo">
              <el-input
                v-model="formData.orderNo"
                :placeholder="t('processOutsourcing.orderNoPlaceholder')"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('processOutsourcing.orderDate')" prop="orderDate">
              <el-date-picker
                v-model="formData.orderDate"
                type="date"
                value-format="YYYY-MM-DD"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item :label="t('processOutsourcing.supplier')" prop="supplier">
              <el-input
                v-model="formData.supplier"
                :placeholder="t('processOutsourcing.supplierPlaceholder')"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('processOutsourcing.processType')" prop="processType">
              <el-select
                v-model="formData.processType"
                :placeholder="t('processOutsourcing.processTypePlaceholder')"
              >
                <el-option
                  v-for="item in processTypeOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item :label="t('processOutsourcing.operator')" prop="operator">
              <el-input
                v-model="formData.operator"
                :placeholder="t('processOutsourcing.operatorPlaceholder')"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('processOutsourcing.status')" prop="status">
              <el-select v-model="formData.status" :placeholder="t('common.selectText')">
                <el-option
                  v-for="item in statusOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 工序明细表格 -->
        <el-form-item :label="t('processOutsourcing.processDetails')">
          <div class="process-details">
            <div class="process-header">
              <el-button type="primary" size="small" @click="handleAddProcess">
                <el-icon><Plus /></el-icon>
                {{ t('processOutsourcing.addProcess') }}
              </el-button>
            </div>
            <el-table :data="formData.processDetails" border class="process-table">
              <el-table-column
                type="index"
                width="60"
                :label="t('processOutsourcing.serial')"
                align="center"
              />
              <el-table-column
                prop="processCode"
                :label="t('processOutsourcing.processCode')"
                width="140"
              />
              <el-table-column
                prop="processName"
                :label="t('processOutsourcing.processName')"
                min-width="160"
              />
              <el-table-column
                prop="specification"
                :label="t('processOutsourcing.specification')"
                min-width="140"
              />
              <el-table-column
                prop="unit"
                :label="t('processOutsourcing.unit')"
                width="80"
                align="center"
              />
              <el-table-column
                prop="quantity"
                :label="t('processOutsourcing.quantity')"
                width="100"
                align="right"
              >
                <template #default="{ row, $index }">
                  <el-input-number
                    v-model="row.quantity"
                    :min="0"
                    :precision="2"
                    size="small"
                    @change="calculateRowTotal($index)"
                  />
                </template>
              </el-table-column>
              <el-table-column
                prop="unitPrice"
                :label="t('processOutsourcing.unitPrice')"
                width="120"
                align="right"
              >
                <template #default="{ row, $index }">
                  <el-input-number
                    v-model="row.unitPrice"
                    :min="0"
                    :precision="2"
                    size="small"
                    @change="calculateRowTotal($index)"
                  />
                </template>
              </el-table-column>
              <el-table-column
                prop="totalPrice"
                :label="t('processOutsourcing.totalPrice')"
                width="120"
                align="right"
              >
                <template #default="{ row }"> ¥ {{ formatAmount(row.totalPrice) }} </template>
              </el-table-column>
              <el-table-column :label="t('common.operation')" width="80" align="center">
                <template #default="{ $index }">
                  <el-button type="danger" size="small" @click="handleRemoveProcess($index)">
                    <el-icon><Delete /></el-icon>
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-form-item>

        <el-form-item :label="t('processOutsourcing.totalValue')" prop="totalValue">
          <el-input v-model="formData.totalValue" readonly />
        </el-form-item>
        <el-form-item :label="t('processOutsourcing.remark')" prop="remark">
          <el-input
            v-model="formData.remark"
            type="textarea"
            :rows="3"
            :placeholder="t('processOutsourcing.remarkPlaceholder')"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="dialogVisible = false">{{ t('common.cancel') }}</el-button>
          <el-button type="primary" @click="handleSubmit" :loading="submitLoading">
            {{ t('common.confirm') }}
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 详情对话框 -->
    <el-dialog
      v-model="detailDialogVisible"
      :title="t('processOutsourcing.orderDetail')"
      width="800px"
      :close-on-click-modal="false"
    >
      <el-descriptions :column="2" border>
        <el-descriptions-item :label="t('processOutsourcing.orderNo')">
          {{ currentOrder?.orderNo }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('processOutsourcing.orderDate')">
          {{ currentOrder?.orderDate }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('processOutsourcing.supplier')">
          {{ currentOrder?.supplier }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('processOutsourcing.processType')">
          {{ currentOrder?.processType }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('processOutsourcing.operator')">
          {{ currentOrder?.operator }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('processOutsourcing.status')">
          <el-tag :type="statusTagMap[currentOrder?.status || 'pending'].type">
            {{ statusTagMap[currentOrder?.status || 'pending'].label }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item :label="t('processOutsourcing.processCount')">
          {{ currentOrder?.processCount }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('processOutsourcing.totalValue')">
          ¥ {{ formatAmount(currentOrder?.totalValue || 0) }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('processOutsourcing.remark')" :span="2">
          {{ currentOrder?.remark || '-' }}
        </el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import {
  ElButton,
  ElCard,
  ElCol,
  ElDatePicker,
  ElDescriptions,
  ElDescriptionsItem,
  ElDialog,
  ElForm,
  ElFormItem,
  ElIcon,
  ElInput,
  ElInputNumber,
  ElOption,
  ElPagination,
  ElRow,
  ElSelect,
  ElTable,
  ElTableColumn,
  ElTag,
  ElMessage,
  ElMessageBox
} from 'element-plus'
import {
  Search,
  Refresh,
  Plus,
  Download,
  Operation,
  Money,
  Clock,
  Check,
  Edit,
  View,
  Delete
} from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from '@/hooks/web/useI18n'

const { t } = useI18n()

type OrderStatus = 'pending' | 'confirmed' | 'inProgress' | 'completed' | 'cancelled'

interface ProcessDetail {
  processCode: string
  processName: string
  specification: string
  unit: string
  quantity: number
  unitPrice: number
  totalPrice: number
}

interface ProcessOrder {
  id: number
  orderNo: string
  supplier: string
  processType: string
  processCount: number
  totalValue: number
  status: OrderStatus
  orderDate: string
  operator: string
  remark: string
  processDetails: ProcessDetail[]
}

// 响应式数据
const queryFormRef = ref<FormInstance>()
const formRef = ref<FormInstance>()
const loading = ref(false)
const submitLoading = ref(false)
const dialogVisible = ref(false)
const detailDialogVisible = ref(false)
const selectedRows = ref<ProcessOrder[]>([])
const currentOrder = ref<ProcessOrder | null>(null)

// 搜索表单
const queryForm = reactive({
  orderNo: '',
  supplier: '',
  processType: '',
  status: '' as OrderStatus | '',
  orderDateRange: [] as [string, string] | []
})

// 分页
const pagination = reactive({
  currentPage: 1,
  pageSize: 20,
  total: 0
})

// 排序
const sortConfig = reactive({
  prop: '',
  order: ''
})

// 表单数据
const formData = reactive<Partial<ProcessOrder>>({
  orderNo: '',
  supplier: '',
  processType: '',
  processCount: 0,
  totalValue: 0,
  status: 'pending',
  orderDate: '',
  operator: '',
  remark: '',
  processDetails: []
})

// 表单验证规则
const formRules: FormRules = {
  orderNo: [{ required: true, message: t('processOutsourcing.orderNoRequired'), trigger: 'blur' }],
  supplier: [
    { required: true, message: t('processOutsourcing.supplierRequired'), trigger: 'blur' }
  ],
  processType: [
    { required: true, message: t('processOutsourcing.processTypeRequired'), trigger: 'change' }
  ],
  orderDate: [
    { required: true, message: t('processOutsourcing.orderDateRequired'), trigger: 'change' }
  ],
  operator: [
    { required: true, message: t('processOutsourcing.operatorRequired'), trigger: 'blur' }
  ],
  status: [{ required: true, message: t('processOutsourcing.statusRequired'), trigger: 'change' }]
}

// 工序类型选项
const processTypeOptions = [
  { label: '机加工', value: '机加工' },
  { label: '热处理', value: '热处理' },
  { label: '表面处理', value: '表面处理' },
  { label: '装配', value: '装配' },
  { label: '检测', value: '检测' }
]

// 状态选项
const statusOptions = [
  { label: t('processOutsourcing.statusPending'), value: 'pending' },
  { label: t('processOutsourcing.statusConfirmed'), value: 'confirmed' },
  { label: t('processOutsourcing.statusInProgress'), value: 'inProgress' },
  { label: t('processOutsourcing.statusCompleted'), value: 'completed' },
  { label: t('processOutsourcing.statusCancelled'), value: 'cancelled' }
]

// 状态标签映射
const statusTagMap: Record<
  OrderStatus,
  { label: string; type: 'info' | 'success' | 'warning' | 'danger' }
> = {
  pending: { label: t('processOutsourcing.statusPending'), type: 'info' },
  confirmed: { label: t('processOutsourcing.statusConfirmed'), type: 'warning' },
  inProgress: { label: t('processOutsourcing.statusInProgress'), type: 'warning' },
  completed: { label: t('processOutsourcing.statusCompleted'), type: 'success' },
  cancelled: { label: t('processOutsourcing.statusCancelled'), type: 'danger' }
}

// 模拟数据
const orders = ref<ProcessOrder[]>([
  {
    id: 1,
    orderNo: 'PO-240301',
    supplier: '上海机加工有限公司',
    processType: '机加工',
    processCount: 2,
    totalValue: 12000.0,
    status: 'completed',
    orderDate: '2024-03-15',
    operator: '张三',
    remark: '精密零件加工',
    processDetails: [
      {
        processCode: 'P001',
        processName: '车削加工',
        specification: '精度±0.01mm',
        unit: '件',
        quantity: 100,
        unitPrice: 80.0,
        totalPrice: 8000.0
      },
      {
        processCode: 'P002',
        processName: '铣削加工',
        specification: '表面粗糙度Ra1.6',
        unit: '件',
        quantity: 50,
        unitPrice: 80.0,
        totalPrice: 4000.0
      }
    ]
  },
  {
    id: 2,
    orderNo: 'PO-240302',
    supplier: '北京热处理厂',
    processType: '热处理',
    processCount: 1,
    totalValue: 8000.0,
    status: 'inProgress',
    orderDate: '2024-03-20',
    operator: '李四',
    remark: '淬火处理',
    processDetails: [
      {
        processCode: 'P003',
        processName: '淬火处理',
        specification: '硬度HRC45-50',
        unit: '件',
        quantity: 200,
        unitPrice: 40.0,
        totalPrice: 8000.0
      }
    ]
  }
])

// 计算属性
const dialogTitle = computed(() => {
  return formData.id ? t('processOutsourcing.editOrder') : t('processOutsourcing.addOrder')
})

const filteredOrders = computed(() => {
  const result = orders.value.filter((order) => {
    const orderNoMatch = queryForm.orderNo
      ? order.orderNo.toLowerCase().includes(queryForm.orderNo.toLowerCase())
      : true
    const supplierMatch = queryForm.supplier
      ? order.supplier.toLowerCase().includes(queryForm.supplier.toLowerCase())
      : true
    const processTypeMatch = queryForm.processType
      ? order.processType === queryForm.processType
      : true
    const statusMatch = queryForm.status ? order.status === queryForm.status : true
    const dateMatch =
      queryForm.orderDateRange.length === 2 && order.orderDate
        ? order.orderDate >= queryForm.orderDateRange[0] &&
          order.orderDate <= queryForm.orderDateRange[1]
        : true
    return orderNoMatch && supplierMatch && processTypeMatch && statusMatch && dateMatch
  })

  // 排序
  if (sortConfig.prop && sortConfig.order) {
    result.sort((a, b) => {
      const aVal = a[sortConfig.prop as keyof ProcessOrder]
      const bVal = b[sortConfig.prop as keyof ProcessOrder]
      if (sortConfig.order === 'ascending') {
        return (aVal as any) > (bVal as any) ? 1 : -1
      } else {
        return (aVal as any) < (bVal as any) ? 1 : -1
      }
    })
  }

  return result
})

// 分页计算
const paginatedOrders = computed(() => {
  const start = (pagination.currentPage - 1) * pagination.pageSize
  const end = start + pagination.pageSize
  return filteredOrders.value.slice(start, end)
})

// 监听过滤结果变化，更新分页总数
watch(
  filteredOrders,
  (newVal) => {
    pagination.total = newVal.length
  },
  { immediate: true }
)

const summary = computed(() => {
  const result = {
    totalOrders: orders.value.length,
    totalValue: 0,
    pendingCount: 0,
    completedCount: 0
  }
  orders.value.forEach((order) => {
    result.totalValue += order.totalValue
    if (order.status === 'pending') result.pendingCount += 1
    if (order.status === 'completed') result.completedCount += 1
  })
  return result
})

// 方法
const formatAmount = (value: number) =>
  Number(value ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })

const handleSearch = () => {
  loading.value = true
  pagination.currentPage = 1
  requestAnimationFrame(() => {
    loading.value = false
  })
}

const handleReset = () => {
  queryForm.orderNo = ''
  queryForm.supplier = ''
  queryForm.processType = ''
  queryForm.status = ''
  queryForm.orderDateRange = []
  handleSearch()
}

const handleAdd = () => {
  Object.assign(formData, {
    id: undefined,
    orderNo: '',
    supplier: '',
    processType: '',
    processCount: 0,
    totalValue: 0,
    status: 'pending',
    orderDate: '',
    operator: '',
    remark: '',
    processDetails: []
  })
  dialogVisible.value = true
}

const handleEdit = (row: ProcessOrder) => {
  Object.assign(formData, { ...row })
  dialogVisible.value = true
}

const handleRowDoubleClick = (row: ProcessOrder) => {
  handleEdit(row)
}

const handleView = (row: ProcessOrder) => {
  currentOrder.value = row
  detailDialogVisible.value = true
}

const handleDelete = async (row: ProcessOrder) => {
  try {
    await ElMessageBox.confirm(
      t('processOutsourcing.deleteConfirm', { orderNo: row.orderNo }),
      t('common.warning'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    )
    const index = orders.value.findIndex((item) => item.id === row.id)
    if (index > -1) {
      orders.value.splice(index, 1)
      ElMessage.success(t('common.deleteSuccess'))
    }
  } catch {
    // 用户取消删除
  }
}

const handleBatchConfirm = () => {
  ElMessage.info(t('processOutsourcing.batchConfirmSuccess'))
}

const handleExport = () => {
  ElMessage.info(t('common.exportSuccess'))
}

const handleBatchExport = () => {
  ElMessage.info(t('common.batchExportSuccess'))
}

const handleSelectionChange = (selection: ProcessOrder[]) => {
  selectedRows.value = selection
}

const handleSortChange = ({ prop, order }: { prop: string; order: string }) => {
  sortConfig.prop = prop
  sortConfig.order = order
}

const handleSizeChange = (size: number) => {
  pagination.pageSize = size
  pagination.currentPage = 1
}

const handleCurrentChange = (page: number) => {
  pagination.currentPage = page
}

const handleAddProcess = () => {
  formData.processDetails?.push({
    processCode: '',
    processName: '',
    specification: '',
    unit: '',
    quantity: 0,
    unitPrice: 0,
    totalPrice: 0
  })
}

const handleRemoveProcess = (index: number) => {
  formData.processDetails?.splice(index, 1)
  calculateTotalValue()
}

const calculateRowTotal = (index: number) => {
  const row = formData.processDetails?.[index]
  if (row) {
    row.totalPrice = row.quantity * row.unitPrice
    calculateTotalValue()
  }
}

const calculateTotalValue = () => {
  const total = formData.processDetails?.reduce((sum, item) => sum + item.totalPrice, 0) || 0
  formData.totalValue = total
  formData.processCount = formData.processDetails?.length || 0
}

const handleSubmit = async () => {
  if (!formRef.value) return

  try {
    await formRef.value.validate()
    submitLoading.value = true

    // 模拟API调用
    await new Promise((resolve) => setTimeout(resolve, 1000))

    if (formData.id) {
      // 编辑
      const index = orders.value.findIndex((item) => item.id === formData.id)
      if (index > -1) {
        orders.value[index] = { ...formData } as ProcessOrder
      }
      ElMessage.success(t('common.editSuccess'))
    } else {
      // 新增
      const newOrder: ProcessOrder = {
        ...formData,
        id: Date.now()
      } as ProcessOrder
      orders.value.unshift(newOrder)
      ElMessage.success(t('common.addSuccess'))
    }

    dialogVisible.value = false
  } catch (error) {
    console.error('表单验证失败:', error)
  } finally {
    submitLoading.value = false
  }
}

const handleDialogClose = () => {
  formRef.value?.resetFields()
}

// 监听表单数据变化
watch(() => formData.processDetails, calculateTotalValue, { deep: true })
</script>

<style scoped>
.search-card {
  background: linear-gradient(145deg, rgb(64 158 255 / 5%), rgb(64 158 255 / 2%));
  border: none;
}

.search-form {
  margin-bottom: 0;
}

.summary-card {
  border: none;
  transition: all 0.3s ease;
}

.summary-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgb(0 0 0 / 10%);
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

.summary-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.summary-icon {
  display: flex;
  width: 48px;
  height: 48px;
  font-size: 24px;
  color: white;
  border-radius: 12px;
  align-items: center;
  justify-content: center;
}

.summary-card--blue .summary-icon {
  background: linear-gradient(135deg, #409eff, #66b3ff);
}

.summary-card--green .summary-icon {
  background: linear-gradient(135deg, #67c23a, #85ce61);
}

.summary-card--orange .summary-icon {
  background: linear-gradient(135deg, #e6a23c, #f0c78a);
}

.summary-card--gray .summary-icon {
  background: linear-gradient(135deg, #909399, #b3b6b9);
}

.summary-info {
  flex: 1;
}

.summary-title {
  margin-bottom: 4px;
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

.summary-value {
  font-size: 24px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.table-card {
  border: none;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.card-actions {
  display: flex;
  gap: 8px;
}

.data-table {
  overflow: hidden;
  border-radius: 8px;
}

.pagination-container {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}

.form-dialog {
  max-height: 60vh;
  overflow-y: auto;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.process-details {
  padding: 12px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
}

.process-header {
  margin-bottom: 12px;
}

.process-table {
  margin-top: 12px;
}

.operation-buttons {
  display: flex;
  gap: 4px;
  padding: 0 8px;
  justify-content: center;
  align-items: center;
}
</style>
