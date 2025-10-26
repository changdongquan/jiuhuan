<template>
  <div class="p-4 space-y-4">
    <!-- 搜索表单 -->
    <el-card shadow="never" class="search-card">
      <el-form ref="queryFormRef" :model="queryForm" label-width="100px" inline class="search-form">
        <el-form-item :label="t('inventoryInbound.documentNo')">
          <el-input
            v-model="queryForm.documentNo"
            :placeholder="t('inventoryInbound.documentNoPlaceholder')"
            clearable
            style="width: 220px"
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item :label="t('inventoryInbound.supplier')">
          <el-input
            v-model="queryForm.supplier"
            :placeholder="t('inventoryInbound.supplierPlaceholder')"
            clearable
            style="width: 220px"
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item :label="t('inventoryInbound.warehouse')">
          <el-select
            v-model="queryForm.warehouse"
            :placeholder="t('inventoryInbound.warehousePlaceholder')"
            clearable
            style="width: 200px"
          >
            <el-option
              v-for="item in warehouseOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('inventoryInbound.status')">
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
        <el-form-item :label="t('inventoryInbound.inboundDate')">
          <el-date-picker
            v-model="queryForm.inboundDateRange"
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
            {{ t('inventoryInbound.addInbound') }}
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
        <el-card shadow="hover" class="summary-card total">
          <div class="summary-content">
            <div class="summary-icon">
              <el-icon><Upload /></el-icon>
            </div>
            <div class="summary-info">
              <div class="summary-title">{{ t('inventoryInbound.totalInbound') }}</div>
              <div class="summary-value">{{ summary.totalInbound }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="6">
        <el-card shadow="hover" class="summary-card amount">
          <div class="summary-content">
            <div class="summary-icon">
              <el-icon><Money /></el-icon>
            </div>
            <div class="summary-info">
              <div class="summary-title">{{ t('inventoryInbound.totalValue') }}</div>
              <div class="summary-value">¥ {{ formatAmount(summary.totalValue) }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="6">
        <el-card shadow="hover" class="summary-card pending">
          <div class="summary-content">
            <div class="summary-icon">
              <el-icon><Clock /></el-icon>
            </div>
            <div class="summary-info">
              <div class="summary-title">{{ t('inventoryInbound.pendingCount') }}</div>
              <div class="summary-value">{{ summary.pendingCount }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="6">
        <el-card shadow="hover" class="summary-card completed">
          <div class="summary-content">
            <div class="summary-icon">
              <el-icon><Check /></el-icon>
            </div>
            <div class="summary-info">
              <div class="summary-title">{{ t('inventoryInbound.completedCount') }}</div>
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
          <span class="card-title">{{ t('inventoryInbound.inboundList') }}</span>
          <div class="card-actions">
            <el-button
              type="primary"
              size="small"
              @click="handleBatchConfirm"
              :disabled="!selectedRows.length"
            >
              <el-icon><Check /></el-icon>
              {{ t('inventoryInbound.batchConfirm') }}
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
        :data="paginatedInbounds"
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
          :label="t('inventoryInbound.serial')"
          align="center"
        />
        <el-table-column
          prop="documentNo"
          :label="t('inventoryInbound.documentNo')"
          min-width="160"
          sortable="custom"
          show-overflow-tooltip
        />
        <el-table-column
          prop="supplier"
          :label="t('inventoryInbound.supplier')"
          min-width="160"
          show-overflow-tooltip
        />
        <el-table-column prop="warehouse" :label="t('inventoryInbound.warehouse')" width="120" />
        <el-table-column
          prop="materialCount"
          :label="t('inventoryInbound.materialCount')"
          width="120"
          align="right"
          sortable="custom"
        />
        <el-table-column
          :label="t('inventoryInbound.totalValue')"
          width="140"
          align="right"
          sortable="custom"
        >
          <template #default="{ row }"> ¥ {{ formatAmount(row.totalValue) }} </template>
        </el-table-column>
        <el-table-column :label="t('inventoryInbound.status')" width="120" align="center">
          <template #default="{ row }">
            <el-tag :type="statusTagMap[row.status].type" size="small">
              {{ statusTagMap[row.status].label }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          prop="inboundDate"
          :label="t('inventoryInbound.inboundDate')"
          width="140"
          sortable="custom"
        />
        <el-table-column prop="operator" :label="t('inventoryInbound.operator')" width="120" />
        <el-table-column
          prop="remark"
          :label="t('inventoryInbound.remark')"
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
            <el-form-item :label="t('inventoryInbound.documentNo')" prop="documentNo">
              <el-input
                v-model="formData.documentNo"
                :placeholder="t('inventoryInbound.documentNoPlaceholder')"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('inventoryInbound.supplier')" prop="supplier">
              <el-input
                v-model="formData.supplier"
                :placeholder="t('inventoryInbound.supplierPlaceholder')"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item :label="t('inventoryInbound.warehouse')" prop="warehouse">
              <el-select
                v-model="formData.warehouse"
                :placeholder="t('inventoryInbound.warehousePlaceholder')"
              >
                <el-option
                  v-for="item in warehouseOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('inventoryInbound.inboundDate')" prop="inboundDate">
              <el-date-picker
                v-model="formData.inboundDate"
                type="date"
                value-format="YYYY-MM-DD"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item :label="t('inventoryInbound.operator')" prop="operator">
              <el-input
                v-model="formData.operator"
                :placeholder="t('inventoryInbound.operatorPlaceholder')"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('inventoryInbound.status')" prop="status">
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

        <!-- 物料明细表格 -->
        <el-form-item :label="t('inventoryInbound.materialDetails')">
          <div class="material-details">
            <div class="material-header">
              <el-button type="primary" size="small" @click="handleAddMaterial">
                <el-icon><Plus /></el-icon>
                {{ t('inventoryInbound.addMaterial') }}
              </el-button>
            </div>
            <el-table :data="formData.materialDetails" border class="material-table">
              <el-table-column
                type="index"
                width="60"
                :label="t('inventoryInbound.serial')"
                align="center"
              />
              <el-table-column
                prop="materialCode"
                :label="t('inventoryInbound.materialCode')"
                width="140"
              />
              <el-table-column
                prop="materialName"
                :label="t('inventoryInbound.materialName')"
                min-width="160"
              />
              <el-table-column
                prop="specification"
                :label="t('inventoryInbound.specification')"
                min-width="140"
              />
              <el-table-column
                prop="unit"
                :label="t('inventoryInbound.unit')"
                width="80"
                align="center"
              />
              <el-table-column
                prop="quantity"
                :label="t('inventoryInbound.quantity')"
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
                :label="t('inventoryInbound.unitPrice')"
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
                :label="t('inventoryInbound.totalPrice')"
                width="120"
                align="right"
              >
                <template #default="{ row }"> ¥ {{ formatAmount(row.totalPrice) }} </template>
              </el-table-column>
              <el-table-column :label="t('common.operation')" width="80" align="center">
                <template #default="{ $index }">
                  <el-button type="danger" size="small" @click="handleRemoveMaterial($index)">
                    <el-icon><Delete /></el-icon>
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-form-item>

        <el-form-item :label="t('inventoryInbound.totalValue')" prop="totalValue">
          <el-input v-model="formData.totalValue" readonly />
        </el-form-item>
        <el-form-item :label="t('inventoryInbound.remark')" prop="remark">
          <el-input
            v-model="formData.remark"
            type="textarea"
            :rows="3"
            :placeholder="t('inventoryInbound.remarkPlaceholder')"
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
      :title="t('inventoryInbound.inboundDetail')"
      width="800px"
      :close-on-click-modal="false"
    >
      <el-descriptions :column="2" border>
        <el-descriptions-item :label="t('inventoryInbound.documentNo')">
          {{ currentInbound?.documentNo }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('inventoryInbound.supplier')">
          {{ currentInbound?.supplier }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('inventoryInbound.warehouse')">
          {{ currentInbound?.warehouse }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('inventoryInbound.inboundDate')">
          {{ currentInbound?.inboundDate }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('inventoryInbound.operator')">
          {{ currentInbound?.operator }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('inventoryInbound.status')">
          <el-tag :type="statusTagMap[currentInbound?.status || 'pending'].type">
            {{ statusTagMap[currentInbound?.status || 'pending'].label }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item :label="t('inventoryInbound.materialCount')">
          {{ currentInbound?.materialCount }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('inventoryInbound.totalValue')">
          ¥ {{ formatAmount(currentInbound?.totalValue || 0) }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('inventoryInbound.remark')" :span="2">
          {{ currentInbound?.remark || '-' }}
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
  Upload,
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

type InboundStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled'

interface MaterialDetail {
  materialCode: string
  materialName: string
  specification: string
  unit: string
  quantity: number
  unitPrice: number
  totalPrice: number
}

interface InboundRecord {
  id: number
  documentNo: string
  supplier: string
  warehouse: string
  materialCount: number
  totalValue: number
  status: InboundStatus
  inboundDate: string
  operator: string
  remark: string
  materialDetails: MaterialDetail[]
}

// 响应式数据
const queryFormRef = ref<FormInstance>()
const formRef = ref<FormInstance>()
const loading = ref(false)
const submitLoading = ref(false)
const dialogVisible = ref(false)
const detailDialogVisible = ref(false)
const selectedRows = ref<InboundRecord[]>([])
const currentInbound = ref<InboundRecord | null>(null)

// 搜索表单
const queryForm = reactive({
  documentNo: '',
  supplier: '',
  warehouse: '',
  status: '' as InboundStatus | '',
  inboundDateRange: [] as [string, string] | []
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
const formData = reactive<Partial<InboundRecord>>({
  documentNo: '',
  supplier: '',
  warehouse: '',
  materialCount: 0,
  totalValue: 0,
  status: 'pending',
  inboundDate: '',
  operator: '',
  remark: '',
  materialDetails: []
})

// 表单验证规则
const formRules: FormRules = {
  documentNo: [
    { required: true, message: t('inventoryInbound.documentNoRequired'), trigger: 'blur' }
  ],
  supplier: [{ required: true, message: t('inventoryInbound.supplierRequired'), trigger: 'blur' }],
  warehouse: [
    { required: true, message: t('inventoryInbound.warehouseRequired'), trigger: 'change' }
  ],
  inboundDate: [
    { required: true, message: t('inventoryInbound.inboundDateRequired'), trigger: 'change' }
  ],
  operator: [{ required: true, message: t('inventoryInbound.operatorRequired'), trigger: 'blur' }],
  status: [{ required: true, message: t('inventoryInbound.statusRequired'), trigger: 'change' }]
}

// 仓库选项
const warehouseOptions = [
  { label: '主仓库', value: '主仓库' },
  { label: '原料仓', value: '原料仓' },
  { label: '成品仓', value: '成品仓' },
  { label: '辅料仓', value: '辅料仓' },
  { label: '工具仓', value: '工具仓' }
]

// 状态选项
const statusOptions = [
  { label: t('inventoryInbound.statusPending'), value: 'pending' },
  { label: t('inventoryInbound.statusConfirmed'), value: 'confirmed' },
  { label: t('inventoryInbound.statusCompleted'), value: 'completed' },
  { label: t('inventoryInbound.statusCancelled'), value: 'cancelled' }
]

// 状态标签映射
const statusTagMap: Record<
  InboundStatus,
  { label: string; type: 'info' | 'success' | 'warning' | 'danger' }
> = {
  pending: { label: t('inventoryInbound.statusPending'), type: 'info' },
  confirmed: { label: t('inventoryInbound.statusConfirmed'), type: 'warning' },
  completed: { label: t('inventoryInbound.statusCompleted'), type: 'success' },
  cancelled: { label: t('inventoryInbound.statusCancelled'), type: 'danger' }
}

// 模拟数据
const inbounds = ref<InboundRecord[]>([
  {
    id: 1,
    documentNo: 'IN-240301',
    supplier: '苏州精工版材',
    warehouse: '主仓库',
    materialCount: 3,
    totalValue: 5400.0,
    status: 'completed',
    inboundDate: '2024-03-15',
    operator: '张三',
    remark: '不锈钢板材入库',
    materialDetails: [
      {
        materialCode: 'M001',
        materialName: '不锈钢板材',
        specification: '304不锈钢 2mm厚',
        unit: '张',
        quantity: 50,
        unitPrice: 120.0,
        totalPrice: 6000.0
      }
    ]
  },
  {
    id: 2,
    documentNo: 'IN-240302',
    supplier: '深圳宏达电子',
    warehouse: '辅料仓',
    materialCount: 2,
    totalValue: 1200.0,
    status: 'confirmed',
    inboundDate: '2024-03-10',
    operator: '李四',
    remark: '电子元件入库',
    materialDetails: [
      {
        materialCode: 'M002',
        materialName: '电子元件',
        specification: '电阻 1KΩ',
        unit: '个',
        quantity: 1000,
        unitPrice: 0.5,
        totalPrice: 500.0
      }
    ]
  }
])

// 计算属性
const dialogTitle = computed(() => {
  return formData.id ? t('inventoryInbound.editInbound') : t('inventoryInbound.addInbound')
})

const filteredInbounds = computed(() => {
  const result = inbounds.value.filter((inbound) => {
    const documentMatch = queryForm.documentNo
      ? inbound.documentNo.toLowerCase().includes(queryForm.documentNo.toLowerCase())
      : true
    const supplierMatch = queryForm.supplier
      ? inbound.supplier.toLowerCase().includes(queryForm.supplier.toLowerCase())
      : true
    const warehouseMatch = queryForm.warehouse ? inbound.warehouse === queryForm.warehouse : true
    const statusMatch = queryForm.status ? inbound.status === queryForm.status : true
    const dateMatch =
      queryForm.inboundDateRange.length === 2 && inbound.inboundDate
        ? inbound.inboundDate >= queryForm.inboundDateRange[0] &&
          inbound.inboundDate <= queryForm.inboundDateRange[1]
        : true
    return documentMatch && supplierMatch && warehouseMatch && statusMatch && dateMatch
  })

  // 排序
  if (sortConfig.prop && sortConfig.order) {
    result.sort((a, b) => {
      const aVal = a[sortConfig.prop as keyof InboundRecord]
      const bVal = b[sortConfig.prop as keyof InboundRecord]
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
const paginatedInbounds = computed(() => {
  const start = (pagination.currentPage - 1) * pagination.pageSize
  const end = start + pagination.pageSize
  return filteredInbounds.value.slice(start, end)
})

// 监听过滤结果变化，更新分页总数
watch(
  filteredInbounds,
  (newVal) => {
    pagination.total = newVal.length
  },
  { immediate: true }
)

const summary = computed(() => {
  const result = {
    totalInbound: inbounds.value.length,
    totalValue: 0,
    pendingCount: 0,
    completedCount: 0
  }
  inbounds.value.forEach((inbound) => {
    result.totalValue += inbound.totalValue
    if (inbound.status === 'pending') result.pendingCount += 1
    if (inbound.status === 'completed') result.completedCount += 1
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
  queryForm.documentNo = ''
  queryForm.supplier = ''
  queryForm.warehouse = ''
  queryForm.status = ''
  queryForm.inboundDateRange = []
  handleSearch()
}

const handleAdd = () => {
  Object.assign(formData, {
    id: undefined,
    documentNo: '',
    supplier: '',
    warehouse: '',
    materialCount: 0,
    totalValue: 0,
    status: 'pending',
    inboundDate: '',
    operator: '',
    remark: '',
    materialDetails: []
  })
  dialogVisible.value = true
}

const handleEdit = (row: InboundRecord) => {
  Object.assign(formData, { ...row })
  dialogVisible.value = true
}

const handleRowDoubleClick = (row: InboundRecord) => {
  handleEdit(row)
}

const handleView = (row: InboundRecord) => {
  currentInbound.value = row
  detailDialogVisible.value = true
}

const handleDelete = async (row: InboundRecord) => {
  try {
    await ElMessageBox.confirm(
      t('inventoryInbound.deleteConfirm', { documentNo: row.documentNo }),
      t('common.warning'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    )
    const index = inbounds.value.findIndex((item) => item.id === row.id)
    if (index > -1) {
      inbounds.value.splice(index, 1)
      ElMessage.success(t('common.deleteSuccess'))
    }
  } catch {
    // 用户取消删除
  }
}

const handleBatchConfirm = () => {
  ElMessage.info(t('inventoryInbound.batchConfirmSuccess'))
}

const handleExport = () => {
  ElMessage.info(t('common.exportSuccess'))
}

const handleBatchExport = () => {
  ElMessage.info(t('common.batchExportSuccess'))
}

const handleSelectionChange = (selection: InboundRecord[]) => {
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

const handleAddMaterial = () => {
  formData.materialDetails?.push({
    materialCode: '',
    materialName: '',
    specification: '',
    unit: '',
    quantity: 0,
    unitPrice: 0,
    totalPrice: 0
  })
}

const handleRemoveMaterial = (index: number) => {
  formData.materialDetails?.splice(index, 1)
  calculateTotalValue()
}

const calculateRowTotal = (index: number) => {
  const row = formData.materialDetails?.[index]
  if (row) {
    row.totalPrice = row.quantity * row.unitPrice
    calculateTotalValue()
  }
}

const calculateTotalValue = () => {
  const total = formData.materialDetails?.reduce((sum, item) => sum + item.totalPrice, 0) || 0
  formData.totalValue = total
  formData.materialCount = formData.materialDetails?.length || 0
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
      const index = inbounds.value.findIndex((item) => item.id === formData.id)
      if (index > -1) {
        inbounds.value[index] = { ...formData } as InboundRecord
      }
      ElMessage.success(t('common.editSuccess'))
    } else {
      // 新增
      const newInbound: InboundRecord = {
        ...formData,
        id: Date.now()
      } as InboundRecord
      inbounds.value.unshift(newInbound)
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
watch(() => formData.materialDetails, calculateTotalValue, { deep: true })
</script>

<style scoped>
.search-card {
  border: none;
  background: linear-gradient(145deg, rgba(64, 158, 255, 0.05), rgba(64, 158, 255, 0.02));
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
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
}

.summary-card.total {
  background: linear-gradient(145deg, rgba(64, 158, 255, 0.1), rgba(64, 158, 255, 0.05));
}

.summary-card.amount {
  background: linear-gradient(145deg, rgba(103, 194, 58, 0.1), rgba(103, 194, 58, 0.05));
}

.summary-card.pending {
  background: linear-gradient(145deg, rgba(230, 162, 60, 0.1), rgba(230, 162, 60, 0.05));
}

.summary-card.completed {
  background: linear-gradient(145deg, rgba(82, 196, 26, 0.1), rgba(82, 196, 26, 0.05));
}

.summary-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.summary-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: white;
}

.summary-card.total .summary-icon {
  background: linear-gradient(135deg, #409eff, #66b3ff);
}

.summary-card.amount .summary-icon {
  background: linear-gradient(135deg, #67c23a, #85ce61);
}

.summary-card.pending .summary-icon {
  background: linear-gradient(135deg, #e6a23c, #f0c78a);
}

.summary-card.completed .summary-icon {
  background: linear-gradient(135deg, #52c41a, #73d13d);
}

.summary-info {
  flex: 1;
}

.summary-title {
  color: var(--el-text-color-secondary);
  font-size: 14px;
  margin-bottom: 4px;
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
  border-radius: 8px;
  overflow: hidden;
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

.material-details {
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  padding: 12px;
}

.material-header {
  margin-bottom: 12px;
}

.material-table {
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
