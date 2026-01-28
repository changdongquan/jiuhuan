<template>
  <div class="p-4 space-y-4">
    <!-- 搜索表单 -->
    <el-card shadow="never" class="search-card">
      <el-form ref="queryFormRef" :model="queryForm" label-width="100px" inline class="search-form">
        <el-form-item :label="t('inventoryStocktake.stocktakeNo')">
          <el-input
            v-model="queryForm.stocktakeNo"
            :placeholder="t('inventoryStocktake.stocktakeNoPlaceholder')"
            clearable
            style="width: 220px"
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item :label="t('inventoryStocktake.warehouse')">
          <el-select
            v-model="queryForm.warehouse"
            :placeholder="t('inventoryStocktake.warehousePlaceholder')"
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
        <el-form-item :label="t('inventoryStocktake.status')">
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
        <el-form-item :label="t('inventoryStocktake.stocktakeDate')">
          <el-date-picker
            v-model="queryForm.stocktakeDateRange"
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
            {{ t('inventoryStocktake.addStocktake') }}
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
              <el-icon><ScaleToOriginal /></el-icon>
            </div>
            <div class="summary-info">
              <div class="summary-title">{{ t('inventoryStocktake.totalStocktake') }}</div>
              <div class="summary-value">{{ summary.totalStocktake }}</div>
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
              <div class="summary-title">{{ t('inventoryStocktake.totalValue') }}</div>
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
              <div class="summary-title">{{ t('inventoryStocktake.pendingCount') }}</div>
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
              <div class="summary-title">{{ t('inventoryStocktake.completedCount') }}</div>
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
          <span class="card-title">{{ t('inventoryStocktake.stocktakeList') }}</span>
          <div class="card-actions">
            <el-button
              type="primary"
              size="small"
              @click="handleBatchConfirm"
              :disabled="!selectedRows.length"
            >
              <el-icon><Check /></el-icon>
              {{ t('inventoryStocktake.batchConfirm') }}
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
        :data="paginatedStocktakes"
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
          :label="t('inventoryStocktake.serial')"
          align="center"
        />
        <el-table-column
          prop="stocktakeNo"
          :label="t('inventoryStocktake.stocktakeNo')"
          min-width="160"
          sortable="custom"
          show-overflow-tooltip
        />
        <el-table-column prop="warehouse" :label="t('inventoryStocktake.warehouse')" width="120" />
        <el-table-column
          prop="materialCount"
          :label="t('inventoryStocktake.materialCount')"
          width="120"
          align="right"
          sortable="custom"
        />
        <el-table-column
          :label="t('inventoryStocktake.totalValue')"
          width="140"
          align="right"
          sortable="custom"
        >
          <template #default="{ row }"> ¥ {{ formatAmount(row.totalValue) }} </template>
        </el-table-column>
        <el-table-column :label="t('inventoryStocktake.status')" width="120" align="center">
          <template #default="{ row }">
            <el-tag :type="statusTagMap[row.status].type" size="small">
              {{ statusTagMap[row.status].label }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          prop="stocktakeDate"
          :label="t('inventoryStocktake.stocktakeDate')"
          width="140"
          sortable="custom"
        />
        <el-table-column prop="operator" :label="t('inventoryStocktake.operator')" width="120" />
        <el-table-column
          prop="remark"
          :label="t('inventoryStocktake.remark')"
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
            <el-form-item :label="t('inventoryStocktake.stocktakeNo')" prop="stocktakeNo">
              <el-input
                v-model="formData.stocktakeNo"
                :placeholder="t('inventoryStocktake.stocktakeNoPlaceholder')"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('inventoryStocktake.stocktakeDate')" prop="stocktakeDate">
              <el-date-picker
                v-model="formData.stocktakeDate"
                type="date"
                value-format="YYYY-MM-DD"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item :label="t('inventoryStocktake.warehouse')" prop="warehouse">
              <el-select
                v-model="formData.warehouse"
                :placeholder="t('inventoryStocktake.warehousePlaceholder')"
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
            <el-form-item :label="t('inventoryStocktake.operator')" prop="operator">
              <el-input
                v-model="formData.operator"
                :placeholder="t('inventoryStocktake.operatorPlaceholder')"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item :label="t('inventoryStocktake.status')" prop="status">
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
          <el-col :span="12">
            <el-form-item :label="t('inventoryStocktake.totalValue')" prop="totalValue">
              <el-input v-model="formData.totalValue" readonly />
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 物料明细表格 -->
        <el-form-item :label="t('inventoryStocktake.materialDetails')">
          <div class="material-details">
            <div class="material-header">
              <el-button type="primary" size="small" @click="handleAddMaterial">
                <el-icon><Plus /></el-icon>
                {{ t('inventoryStocktake.addMaterial') }}
              </el-button>
            </div>
            <el-table :data="formData.materialDetails" border class="material-table">
              <el-table-column
                type="index"
                width="60"
                :label="t('inventoryStocktake.serial')"
                align="center"
              />
              <el-table-column
                prop="materialCode"
                :label="t('inventoryStocktake.materialCode')"
                width="140"
              />
              <el-table-column
                prop="materialName"
                :label="t('inventoryStocktake.materialName')"
                min-width="160"
              />
              <el-table-column
                prop="specification"
                :label="t('inventoryStocktake.specification')"
                min-width="140"
              />
              <el-table-column
                prop="unit"
                :label="t('inventoryStocktake.unit')"
                width="80"
                align="center"
              />
              <el-table-column
                prop="bookQuantity"
                :label="t('inventoryStocktake.bookQuantity')"
                width="120"
                align="right"
              >
                <template #default="{ row }">
                  {{ row.bookQuantity }}
                </template>
              </el-table-column>
              <el-table-column
                prop="actualQuantity"
                :label="t('inventoryStocktake.actualQuantity')"
                width="120"
                align="right"
              >
                <template #default="{ row, $index }">
                  <el-input-number
                    v-model="row.actualQuantity"
                    :min="0"
                    :precision="2"
                    size="small"
                    @change="calculateRowTotal($index)"
                  />
                </template>
              </el-table-column>
              <el-table-column
                prop="difference"
                :label="t('inventoryStocktake.difference')"
                width="120"
                align="right"
              >
                <template #default="{ row }">
                  <span
                    :class="
                      row.difference > 0 ? 'text-success' : row.difference < 0 ? 'text-danger' : ''
                    "
                  >
                    {{ row.difference > 0 ? '+' : '' }}{{ row.difference }}
                  </span>
                </template>
              </el-table-column>
              <el-table-column
                prop="unitPrice"
                :label="t('inventoryStocktake.unitPrice')"
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
                :label="t('inventoryStocktake.totalPrice')"
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

        <el-form-item :label="t('inventoryStocktake.remark')" prop="remark">
          <el-input
            v-model="formData.remark"
            type="textarea"
            :rows="3"
            :placeholder="t('inventoryStocktake.remarkPlaceholder')"
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
      :title="t('inventoryStocktake.stocktakeDetail')"
      width="800px"
      :close-on-click-modal="false"
    >
      <el-descriptions :column="2" border>
        <el-descriptions-item :label="t('inventoryStocktake.stocktakeNo')">
          {{ currentStocktake?.stocktakeNo }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('inventoryStocktake.stocktakeDate')">
          {{ currentStocktake?.stocktakeDate }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('inventoryStocktake.warehouse')">
          {{ currentStocktake?.warehouse }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('inventoryStocktake.operator')">
          {{ currentStocktake?.operator }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('inventoryStocktake.status')">
          <el-tag :type="statusTagMap[currentStocktake?.status || 'pending'].type">
            {{ statusTagMap[currentStocktake?.status || 'pending'].label }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item :label="t('inventoryStocktake.materialCount')">
          {{ currentStocktake?.materialCount }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('inventoryStocktake.totalValue')">
          ¥ {{ formatAmount(currentStocktake?.totalValue || 0) }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('inventoryStocktake.remark')" :span="2">
          {{ currentStocktake?.remark || '-' }}
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
  ScaleToOriginal,
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

type StocktakeStatus = 'pending' | 'inProgress' | 'completed' | 'cancelled'

interface MaterialDetail {
  materialCode: string
  materialName: string
  specification: string
  unit: string
  bookQuantity: number
  actualQuantity: number
  difference: number
  unitPrice: number
  totalPrice: number
}

interface StocktakeRecord {
  id: number
  stocktakeNo: string
  warehouse: string
  materialCount: number
  totalValue: number
  status: StocktakeStatus
  stocktakeDate: string
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
const selectedRows = ref<StocktakeRecord[]>([])
const currentStocktake = ref<StocktakeRecord | null>(null)

// 搜索表单
const queryForm = reactive({
  stocktakeNo: '',
  warehouse: '',
  status: '' as StocktakeStatus | '',
  stocktakeDateRange: [] as [string, string] | []
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
const formData = reactive<Partial<StocktakeRecord>>({
  stocktakeNo: '',
  warehouse: '',
  materialCount: 0,
  totalValue: 0,
  status: 'pending',
  stocktakeDate: '',
  operator: '',
  remark: '',
  materialDetails: []
})

// 表单验证规则
const formRules: FormRules = {
  stocktakeNo: [
    { required: true, message: t('inventoryStocktake.stocktakeNoRequired'), trigger: 'blur' }
  ],
  warehouse: [
    { required: true, message: t('inventoryStocktake.warehouseRequired'), trigger: 'change' }
  ],
  stocktakeDate: [
    { required: true, message: t('inventoryStocktake.stocktakeDateRequired'), trigger: 'change' }
  ],
  operator: [
    { required: true, message: t('inventoryStocktake.operatorRequired'), trigger: 'blur' }
  ],
  status: [{ required: true, message: t('inventoryStocktake.statusRequired'), trigger: 'change' }]
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
  { label: t('inventoryStocktake.statusPending'), value: 'pending' },
  { label: t('inventoryStocktake.statusInProgress'), value: 'inProgress' },
  { label: t('inventoryStocktake.statusCompleted'), value: 'completed' },
  { label: t('inventoryStocktake.statusCancelled'), value: 'cancelled' }
]

// 状态标签映射
const statusTagMap: Record<
  StocktakeStatus,
  { label: string; type: 'info' | 'success' | 'warning' | 'danger' }
> = {
  pending: { label: t('inventoryStocktake.statusPending'), type: 'info' },
  inProgress: { label: t('inventoryStocktake.statusInProgress'), type: 'warning' },
  completed: { label: t('inventoryStocktake.statusCompleted'), type: 'success' },
  cancelled: { label: t('inventoryStocktake.statusCancelled'), type: 'danger' }
}

// 模拟数据
const stocktakes = ref<StocktakeRecord[]>([
  {
    id: 1,
    stocktakeNo: 'ST-240301',
    warehouse: '主仓库',
    materialCount: 2,
    totalValue: 15000.0,
    status: 'completed',
    stocktakeDate: '2024-03-15',
    operator: '张三',
    remark: '月度盘点',
    materialDetails: [
      {
        materialCode: 'M001',
        materialName: '不锈钢板材',
        specification: '304不锈钢 2mm厚',
        unit: '张',
        bookQuantity: 150,
        actualQuantity: 145,
        difference: -5,
        unitPrice: 120.0,
        totalPrice: 17400.0
      }
    ]
  },
  {
    id: 2,
    stocktakeNo: 'ST-240302',
    warehouse: '成品仓',
    materialCount: 1,
    totalValue: 9000.0,
    status: 'inProgress',
    stocktakeDate: '2024-03-20',
    operator: '李四',
    remark: '季度盘点',
    materialDetails: [
      {
        materialCode: 'M004',
        materialName: '成品零件',
        specification: '机加工零件A',
        unit: '件',
        bookQuantity: 200,
        actualQuantity: 200,
        difference: 0,
        unitPrice: 45.0,
        totalPrice: 9000.0
      }
    ]
  }
])

// 计算属性
const dialogTitle = computed(() => {
  return formData.id ? t('inventoryStocktake.editStocktake') : t('inventoryStocktake.addStocktake')
})

const filteredStocktakes = computed(() => {
  const result = stocktakes.value.filter((stocktake) => {
    const stocktakeNoMatch = queryForm.stocktakeNo
      ? stocktake.stocktakeNo.toLowerCase().includes(queryForm.stocktakeNo.toLowerCase())
      : true
    const warehouseMatch = queryForm.warehouse ? stocktake.warehouse === queryForm.warehouse : true
    const statusMatch = queryForm.status ? stocktake.status === queryForm.status : true
    const dateMatch =
      queryForm.stocktakeDateRange.length === 2 && stocktake.stocktakeDate
        ? stocktake.stocktakeDate >= queryForm.stocktakeDateRange[0] &&
          stocktake.stocktakeDate <= queryForm.stocktakeDateRange[1]
        : true
    return stocktakeNoMatch && warehouseMatch && statusMatch && dateMatch
  })

  // 排序
  if (sortConfig.prop && sortConfig.order) {
    result.sort((a, b) => {
      const aVal = a[sortConfig.prop as keyof StocktakeRecord]
      const bVal = b[sortConfig.prop as keyof StocktakeRecord]
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
const paginatedStocktakes = computed(() => {
  const start = (pagination.currentPage - 1) * pagination.pageSize
  const end = start + pagination.pageSize
  return filteredStocktakes.value.slice(start, end)
})

// 监听过滤结果变化，更新分页总数
watch(
  filteredStocktakes,
  (newVal) => {
    pagination.total = newVal.length
  },
  { immediate: true }
)

const summary = computed(() => {
  const result = {
    totalStocktake: stocktakes.value.length,
    totalValue: 0,
    pendingCount: 0,
    completedCount: 0
  }
  stocktakes.value.forEach((stocktake) => {
    result.totalValue += stocktake.totalValue
    if (stocktake.status === 'pending') result.pendingCount += 1
    if (stocktake.status === 'completed') result.completedCount += 1
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
  queryForm.stocktakeNo = ''
  queryForm.warehouse = ''
  queryForm.status = ''
  queryForm.stocktakeDateRange = []
  handleSearch()
}

const handleAdd = () => {
  Object.assign(formData, {
    id: undefined,
    stocktakeNo: '',
    warehouse: '',
    materialCount: 0,
    totalValue: 0,
    status: 'pending',
    stocktakeDate: '',
    operator: '',
    remark: '',
    materialDetails: []
  })
  dialogVisible.value = true
}

const handleEdit = (row: StocktakeRecord) => {
  Object.assign(formData, { ...row })
  dialogVisible.value = true
}

const handleRowDoubleClick = (row: StocktakeRecord) => {
  handleEdit(row)
}

const handleView = (row: StocktakeRecord) => {
  currentStocktake.value = row
  detailDialogVisible.value = true
}

const handleDelete = async (row: StocktakeRecord) => {
  try {
    await ElMessageBox.confirm(
      t('inventoryStocktake.deleteConfirm', { stocktakeNo: row.stocktakeNo }),
      t('common.warning'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    )
    const index = stocktakes.value.findIndex((item) => item.id === row.id)
    if (index > -1) {
      stocktakes.value.splice(index, 1)
      ElMessage.success(t('common.deleteSuccess'))
    }
  } catch {
    // 用户取消删除
  }
}

const handleBatchConfirm = () => {
  ElMessage.info(t('inventoryStocktake.batchConfirmSuccess'))
}

const handleExport = () => {
  ElMessage.info(t('common.exportSuccess'))
}

const handleBatchExport = () => {
  ElMessage.info(t('common.batchExportSuccess'))
}

const handleSelectionChange = (selection: StocktakeRecord[]) => {
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
    bookQuantity: 0,
    actualQuantity: 0,
    difference: 0,
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
    row.difference = row.actualQuantity - row.bookQuantity
    row.totalPrice = row.actualQuantity * row.unitPrice
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
      const index = stocktakes.value.findIndex((item) => item.id === formData.id)
      if (index > -1) {
        stocktakes.value[index] = { ...formData } as StocktakeRecord
      }
      ElMessage.success(t('common.editSuccess'))
    } else {
      // 新增
      const newStocktake: StocktakeRecord = {
        ...formData,
        id: Date.now()
      } as StocktakeRecord
      stocktakes.value.unshift(newStocktake)
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

.material-details {
  padding: 12px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
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

.text-success {
  color: var(--el-color-success);
}

.text-danger {
  color: var(--el-color-danger);
}
</style>
