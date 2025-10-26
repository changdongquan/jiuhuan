<template>
  <div class="p-4 space-y-4">
    <!-- 搜索表单 -->
    <el-card shadow="never" class="search-card">
      <el-form ref="queryFormRef" :model="queryForm" label-width="100px" inline class="search-form">
        <el-form-item :label="t('materialProcurement.supplierName')">
          <el-input
            v-model="queryForm.supplier"
            :placeholder="t('materialProcurement.supplierPlaceholder')"
            clearable
            style="width: 220px"
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item :label="t('materialProcurement.materialCode')">
          <el-input
            v-model="queryForm.materialCode"
            :placeholder="t('materialProcurement.materialCodePlaceholder')"
            clearable
            style="width: 220px"
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item :label="t('materialProcurement.materialName')">
          <el-input
            v-model="queryForm.materialName"
            :placeholder="t('materialProcurement.materialNamePlaceholder')"
            clearable
            style="width: 220px"
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item :label="t('materialProcurement.status')">
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
        <el-form-item :label="t('materialProcurement.orderDate')">
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
            {{ t('materialProcurement.addOrder') }}
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
              <el-icon><Document /></el-icon>
            </div>
            <div class="summary-info">
              <div class="summary-title">{{ t('materialProcurement.totalOrders') }}</div>
              <div class="summary-value">{{ summary.totalOrders }}</div>
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
              <div class="summary-title">{{ t('materialProcurement.totalAmount') }}</div>
              <div class="summary-value">¥ {{ formatAmount(summary.totalAmount) }}</div>
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
              <div class="summary-title">{{ t('materialProcurement.pendingCount') }}</div>
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
              <div class="summary-title">{{ t('materialProcurement.completedCount') }}</div>
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
          <span class="card-title">{{ t('materialProcurement.orderList') }}</span>
          <div class="card-actions">
            <el-button
              type="primary"
              size="small"
              @click="handleBatchDelete"
              :disabled="!selectedRows.length"
            >
              <el-icon><Delete /></el-icon>
              {{ t('common.batchDelete') }}
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
          :label="t('materialProcurement.serial')"
          align="center"
        />
        <el-table-column
          prop="orderCode"
          :label="t('materialProcurement.orderCode')"
          min-width="140"
          sortable="custom"
          show-overflow-tooltip
        />
        <el-table-column
          prop="supplier"
          :label="t('materialProcurement.supplierName')"
          min-width="150"
          show-overflow-tooltip
        />
        <el-table-column
          prop="specification"
          :label="t('materialProcurement.specification')"
          min-width="180"
          show-overflow-tooltip
        />
        <el-table-column
          prop="quantity"
          :label="t('materialProcurement.quantity')"
          width="100"
          align="right"
          sortable="custom"
        />
        <el-table-column
          :label="t('materialProcurement.unitPrice')"
          width="110"
          align="right"
          sortable="custom"
        >
          <template #default="{ row }"> ¥ {{ formatAmount(row.unitPrice) }} </template>
        </el-table-column>
        <el-table-column
          :label="t('materialProcurement.totalAmount')"
          width="120"
          align="right"
          sortable="custom"
        >
          <template #default="{ row }"> ¥ {{ formatAmount(row.totalAmount) }} </template>
        </el-table-column>
        <el-table-column :label="t('materialProcurement.status')" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="statusTagMap[row.status].type" size="small">
              {{ statusTagMap[row.status].label }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          prop="orderDate"
          :label="t('materialProcurement.orderDate')"
          width="110"
          sortable="custom"
        />
        <el-table-column
          prop="actualDelivery"
          :label="t('materialProcurement.actualDelivery')"
          width="110"
        />
        <el-table-column
          prop="remark"
          :label="t('materialProcurement.remark')"
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
      width="800px"
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
            <el-form-item :label="t('materialProcurement.orderCode')" prop="orderCode">
              <el-input
                v-model="formData.orderCode"
                :placeholder="t('materialProcurement.orderCodePlaceholder')"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('materialProcurement.supplierName')" prop="supplier">
              <el-select
                v-model="formData.supplier"
                :placeholder="t('materialProcurement.supplierPlaceholder')"
                filterable
              >
                <el-option
                  v-for="supplier in supplierOptions"
                  :key="supplier.value"
                  :label="supplier.label"
                  :value="supplier.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item :label="t('materialProcurement.materialCode')" prop="materialCode">
              <el-input
                v-model="formData.materialCode"
                :placeholder="t('materialProcurement.materialCodePlaceholder')"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('materialProcurement.materialName')" prop="materialName">
              <el-input
                v-model="formData.materialName"
                :placeholder="t('materialProcurement.materialNamePlaceholder')"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item :label="t('materialProcurement.specification')" prop="specification">
              <el-input
                v-model="formData.specification"
                :placeholder="t('materialProcurement.specificationPlaceholder')"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('materialProcurement.unit')" prop="unit">
              <el-select
                v-model="formData.unit"
                :placeholder="t('materialProcurement.unitPlaceholder')"
              >
                <el-option
                  v-for="unit in unitOptions"
                  :key="unit.value"
                  :label="unit.label"
                  :value="unit.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item :label="t('materialProcurement.quantity')" prop="quantity">
              <el-input-number
                v-model="formData.quantity"
                :min="0"
                :precision="2"
                style="width: 100%"
                @change="calculateTotalAmount"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item :label="t('materialProcurement.unitPrice')" prop="unitPrice">
              <el-input-number
                v-model="formData.unitPrice"
                :min="0"
                :precision="2"
                style="width: 100%"
                @change="calculateTotalAmount"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item :label="t('materialProcurement.totalAmount')" prop="totalAmount">
              <el-input v-model="formData.totalAmount" readonly />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item :label="t('materialProcurement.orderDate')" prop="orderDate">
              <el-date-picker
                v-model="formData.orderDate"
                type="date"
                value-format="YYYY-MM-DD"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item
              :label="t('materialProcurement.expectedDelivery')"
              prop="expectedDelivery"
            >
              <el-date-picker
                v-model="formData.expectedDelivery"
                type="date"
                value-format="YYYY-MM-DD"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item :label="t('materialProcurement.status')" prop="status">
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
            <el-form-item :label="t('materialProcurement.actualDelivery')" prop="actualDelivery">
              <el-date-picker
                v-model="formData.actualDelivery"
                type="date"
                value-format="YYYY-MM-DD"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item :label="t('materialProcurement.remark')" prop="remark">
          <el-input
            v-model="formData.remark"
            type="textarea"
            :rows="3"
            :placeholder="t('materialProcurement.remarkPlaceholder')"
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
      :title="t('materialProcurement.orderDetail')"
      width="600px"
      :close-on-click-modal="false"
    >
      <el-descriptions :column="2" border>
        <el-descriptions-item :label="t('materialProcurement.orderCode')">
          {{ currentOrder?.orderCode }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('materialProcurement.supplierName')">
          {{ currentOrder?.supplier }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('materialProcurement.materialCode')">
          {{ currentOrder?.materialCode }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('materialProcurement.materialName')">
          {{ currentOrder?.materialName }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('materialProcurement.specification')">
          {{ currentOrder?.specification }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('materialProcurement.unit')">
          {{ currentOrder?.unit }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('materialProcurement.quantity')">
          {{ currentOrder?.quantity }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('materialProcurement.unitPrice')">
          ¥ {{ formatAmount(currentOrder?.unitPrice || 0) }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('materialProcurement.totalAmount')">
          ¥ {{ formatAmount(currentOrder?.totalAmount || 0) }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('materialProcurement.status')">
          <el-tag :type="statusTagMap[currentOrder?.status || 'pending'].type">
            {{ statusTagMap[currentOrder?.status || 'pending'].label }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item :label="t('materialProcurement.orderDate')">
          {{ currentOrder?.orderDate }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('materialProcurement.expectedDelivery')">
          {{ currentOrder?.expectedDelivery }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('materialProcurement.actualDelivery')">
          {{ currentOrder?.actualDelivery || '-' }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('materialProcurement.remark')" :span="2">
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
  ElDescriptions,
  ElDescriptionsItem,
  ElMessage,
  ElMessageBox
} from 'element-plus'
import {
  Search,
  Refresh,
  Plus,
  Download,
  Document,
  Money,
  Clock,
  Check,
  Delete,
  Edit,
  View
} from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from '@/hooks/web/useI18n'

const { t } = useI18n()

type MaterialProcurementStatus =
  | 'pending'
  | 'ordered'
  | 'shipped'
  | 'delivered'
  | 'completed'
  | 'cancelled'

interface MaterialProcurementOrder {
  id: number
  orderCode: string
  supplier: string
  materialCode: string
  materialName: string
  specification: string
  quantity: number
  unit: string
  unitPrice: number
  totalAmount: number
  status: MaterialProcurementStatus
  orderDate: string
  expectedDelivery: string
  actualDelivery?: string
  remark: string
}

// 响应式数据
const queryFormRef = ref<FormInstance>()
const formRef = ref<FormInstance>()
const loading = ref(false)
const submitLoading = ref(false)
const dialogVisible = ref(false)
const detailDialogVisible = ref(false)
const selectedRows = ref<MaterialProcurementOrder[]>([])
const currentOrder = ref<MaterialProcurementOrder | null>(null)

// 搜索表单
const queryForm = reactive({
  supplier: '',
  materialCode: '',
  materialName: '',
  status: '' as MaterialProcurementStatus | '',
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
const formData = reactive<Partial<MaterialProcurementOrder>>({
  orderCode: '',
  supplier: '',
  materialCode: '',
  materialName: '',
  specification: '',
  quantity: 0,
  unit: '',
  unitPrice: 0,
  totalAmount: 0,
  status: 'pending',
  orderDate: '',
  expectedDelivery: '',
  actualDelivery: '',
  remark: ''
})

// 表单验证规则
const formRules: FormRules = {
  orderCode: [
    { required: true, message: t('materialProcurement.orderCodeRequired'), trigger: 'blur' }
  ],
  supplier: [
    { required: true, message: t('materialProcurement.supplierRequired'), trigger: 'change' }
  ],
  materialCode: [
    { required: true, message: t('materialProcurement.materialCodeRequired'), trigger: 'blur' }
  ],
  materialName: [
    { required: true, message: t('materialProcurement.materialNameRequired'), trigger: 'blur' }
  ],
  quantity: [
    { required: true, message: t('materialProcurement.quantityRequired'), trigger: 'blur' }
  ],
  unit: [{ required: true, message: t('materialProcurement.unitRequired'), trigger: 'change' }],
  unitPrice: [
    { required: true, message: t('materialProcurement.unitPriceRequired'), trigger: 'blur' }
  ],
  orderDate: [
    { required: true, message: t('materialProcurement.orderDateRequired'), trigger: 'change' }
  ],
  expectedDelivery: [
    {
      required: true,
      message: t('materialProcurement.expectedDeliveryRequired'),
      trigger: 'change'
    }
  ],
  status: [{ required: true, message: t('materialProcurement.statusRequired'), trigger: 'change' }]
}

// 状态选项
const statusOptions = [
  { label: t('materialProcurement.statusPending'), value: 'pending' },
  { label: t('materialProcurement.statusOrdered'), value: 'ordered' },
  { label: t('materialProcurement.statusShipped'), value: 'shipped' },
  { label: t('materialProcurement.statusDelivered'), value: 'delivered' },
  { label: t('materialProcurement.statusCompleted'), value: 'completed' },
  { label: t('materialProcurement.statusCancelled'), value: 'cancelled' }
]

// 供应商选项
const supplierOptions = [
  { label: '上海钢材贸易有限公司', value: '上海钢材贸易有限公司' },
  { label: '苏州精密材料厂', value: '苏州精密材料厂' },
  { label: '无锡电子元器件', value: '无锡电子元器件' },
  { label: '常州五金配件', value: '常州五金配件' },
  { label: '深圳塑料原料', value: '深圳塑料原料' }
]

// 单位选项
const unitOptions = [
  { label: '张', value: '张' },
  { label: '套', value: '套' },
  { label: '个', value: '个' },
  { label: 'kg', value: 'kg' },
  { label: '件', value: '件' },
  { label: '台', value: '台' }
]

// 状态标签映射
const statusTagMap: Record<
  MaterialProcurementStatus,
  { label: string; type: 'info' | 'success' | 'warning' | 'danger' | 'primary' }
> = {
  pending: { label: t('materialProcurement.statusPending'), type: 'info' },
  ordered: { label: t('materialProcurement.statusOrdered'), type: 'primary' },
  shipped: { label: t('materialProcurement.statusShipped'), type: 'warning' },
  delivered: { label: t('materialProcurement.statusDelivered'), type: 'warning' },
  completed: { label: t('materialProcurement.statusCompleted'), type: 'success' },
  cancelled: { label: t('materialProcurement.statusCancelled'), type: 'danger' }
}

// 模拟数据
const orders = ref<MaterialProcurementOrder[]>([
  {
    id: 1,
    orderCode: 'MP-240301',
    supplier: '上海钢材贸易有限公司',
    materialCode: 'ST-001',
    materialName: 'Q235B钢板',
    specification: '3mm×2000mm×1000mm',
    quantity: 50,
    unit: '张',
    unitPrice: 280.0,
    totalAmount: 14000.0,
    status: 'ordered',
    orderDate: '2024-03-15',
    expectedDelivery: '2024-03-25',
    remark: '用于生产外壳钣金件'
  },
  {
    id: 2,
    orderCode: 'MP-240302',
    supplier: '苏州精密材料厂',
    materialCode: 'AL-002',
    materialName: '6061铝合金板',
    specification: '5mm×1500mm×800mm',
    quantity: 30,
    unit: '张',
    unitPrice: 450.0,
    totalAmount: 13500.0,
    status: 'shipped',
    orderDate: '2024-03-10',
    expectedDelivery: '2024-03-20',
    remark: '高精度加工用材'
  },
  {
    id: 3,
    orderCode: 'MP-240303',
    supplier: '无锡电子元器件',
    materialCode: 'EL-003',
    materialName: '电子元器件套件',
    specification: '标准封装',
    quantity: 200,
    unit: '套',
    unitPrice: 85.0,
    totalAmount: 17000.0,
    status: 'delivered',
    orderDate: '2024-03-05',
    expectedDelivery: '2024-03-15',
    actualDelivery: '2024-03-14',
    remark: '控制板组装用'
  },
  {
    id: 4,
    orderCode: 'MP-240304',
    supplier: '常州五金配件',
    materialCode: 'HW-004',
    materialName: '不锈钢紧固件',
    specification: 'M8×20mm',
    quantity: 1000,
    unit: '个',
    unitPrice: 2.5,
    totalAmount: 2500.0,
    status: 'completed',
    orderDate: '2024-02-28',
    expectedDelivery: '2024-03-10',
    actualDelivery: '2024-03-08',
    remark: '标准紧固件'
  },
  {
    id: 5,
    orderCode: 'MP-240305',
    supplier: '深圳塑料原料',
    materialCode: 'PL-005',
    materialName: 'ABS工程塑料',
    specification: '颗粒状',
    quantity: 500,
    unit: 'kg',
    unitPrice: 18.0,
    totalAmount: 9000.0,
    status: 'pending',
    orderDate: '2024-03-20',
    expectedDelivery: '2024-03-30',
    remark: '注塑成型用原料'
  }
])

// 计算属性
const dialogTitle = computed(() => {
  return formData.id ? t('materialProcurement.editOrder') : t('materialProcurement.addOrder')
})

const filteredOrders = computed(() => {
  const result = orders.value.filter((order) => {
    const supplierMatch = queryForm.supplier
      ? order.supplier.toLowerCase().includes(queryForm.supplier.toLowerCase())
      : true
    const codeMatch = queryForm.materialCode
      ? order.materialCode.toLowerCase().includes(queryForm.materialCode.toLowerCase())
      : true
    const nameMatch = queryForm.materialName
      ? order.materialName.toLowerCase().includes(queryForm.materialName.toLowerCase())
      : true
    const statusMatch = queryForm.status ? order.status === queryForm.status : true
    const orderDate = order.orderDate
    const rangeMatch =
      queryForm.orderDateRange.length === 2 && orderDate
        ? orderDate >= queryForm.orderDateRange[0] && orderDate <= queryForm.orderDateRange[1]
        : true
    return supplierMatch && codeMatch && nameMatch && statusMatch && rangeMatch
  })

  // 排序
  if (sortConfig.prop && sortConfig.order) {
    result.sort((a, b) => {
      const aVal = a[sortConfig.prop as keyof MaterialProcurementOrder]
      const bVal = b[sortConfig.prop as keyof MaterialProcurementOrder]
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
    totalAmount: 0,
    pendingCount: 0,
    completedCount: 0
  }
  orders.value.forEach((order) => {
    result.totalAmount += order.totalAmount
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
  queryForm.supplier = ''
  queryForm.materialCode = ''
  queryForm.materialName = ''
  queryForm.status = ''
  queryForm.orderDateRange = []
  handleSearch()
}

const handleAdd = () => {
  Object.assign(formData, {
    id: undefined,
    orderCode: '',
    supplier: '',
    materialCode: '',
    materialName: '',
    specification: '',
    quantity: 0,
    unit: '',
    unitPrice: 0,
    totalAmount: 0,
    status: 'pending',
    orderDate: '',
    expectedDelivery: '',
    actualDelivery: '',
    remark: ''
  })
  dialogVisible.value = true
}

const handleEdit = (row: MaterialProcurementOrder) => {
  Object.assign(formData, { ...row })
  dialogVisible.value = true
}

const handleRowDoubleClick = (row: MaterialProcurementOrder) => {
  handleEdit(row)
}

const handleView = (row: MaterialProcurementOrder) => {
  currentOrder.value = row
  detailDialogVisible.value = true
}

const handleDelete = async (row: MaterialProcurementOrder) => {
  try {
    await ElMessageBox.confirm(
      t('materialProcurement.deleteConfirm', { orderCode: row.orderCode }),
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

const handleBatchDelete = async () => {
  try {
    await ElMessageBox.confirm(
      t('materialProcurement.batchDeleteConfirm', { count: selectedRows.value.length }),
      t('common.warning'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    )
    selectedRows.value.forEach((row) => {
      const index = orders.value.findIndex((item) => item.id === row.id)
      if (index > -1) {
        orders.value.splice(index, 1)
      }
    })
    selectedRows.value = []
    ElMessage.success(t('common.batchDeleteSuccess'))
  } catch {
    // 用户取消删除
  }
}

const handleExport = () => {
  ElMessage.info(t('common.exportSuccess'))
}

const handleBatchExport = () => {
  ElMessage.info(t('common.batchExportSuccess'))
}

const handleSelectionChange = (selection: MaterialProcurementOrder[]) => {
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

const calculateTotalAmount = () => {
  formData.totalAmount = (formData.quantity || 0) * (formData.unitPrice || 0)
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
        orders.value[index] = { ...formData } as MaterialProcurementOrder
      }
      ElMessage.success(t('common.editSuccess'))
    } else {
      // 新增
      const newOrder: MaterialProcurementOrder = {
        ...formData,
        id: Date.now()
      } as MaterialProcurementOrder
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
watch([() => formData.quantity, () => formData.unitPrice], calculateTotalAmount)
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

.operation-buttons {
  display: flex;
  gap: 4px;
  padding: 0 8px;
  justify-content: center;
  align-items: center;
}
</style>
