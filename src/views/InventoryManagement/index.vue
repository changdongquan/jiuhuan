<template>
  <div class="p-4 space-y-4">
    <!-- 搜索表单 -->
    <el-card shadow="never" class="search-card">
      <el-form ref="queryFormRef" :model="queryForm" label-width="100px" inline class="search-form">
        <el-form-item :label="t('inventory.materialCode')">
          <el-input
            v-model="queryForm.materialCode"
            :placeholder="t('inventory.materialCodePlaceholder')"
            clearable
            style="width: 220px"
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item :label="t('inventory.materialName')">
          <el-input
            v-model="queryForm.materialName"
            :placeholder="t('inventory.materialNamePlaceholder')"
            clearable
            style="width: 220px"
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item :label="t('inventory.category')">
          <el-select
            v-model="queryForm.category"
            :placeholder="t('common.selectText')"
            clearable
            style="width: 200px"
          >
            <el-option
              v-for="item in categoryOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('inventory.warehouse')">
          <el-select
            v-model="queryForm.warehouse"
            :placeholder="t('inventory.warehousePlaceholder')"
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
        <el-form-item :label="t('inventory.status')">
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
            {{ t('inventory.addMaterial') }}
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
              <el-icon><Box /></el-icon>
            </div>
            <div class="summary-info">
              <div class="summary-title">{{ t('inventory.totalMaterials') }}</div>
              <div class="summary-value">{{ summary.totalMaterials }}</div>
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
              <div class="summary-title">{{ t('inventory.totalValue') }}</div>
              <div class="summary-value">¥ {{ formatAmount(summary.totalValue) }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="6">
        <el-card shadow="hover" class="summary-card summary-card--orange">
          <div class="summary-content">
            <div class="summary-icon">
              <el-icon><Warning /></el-icon>
            </div>
            <div class="summary-info">
              <div class="summary-title">{{ t('inventory.lowStockCount') }}</div>
              <div class="summary-value">{{ summary.lowStockCount }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="6">
        <el-card shadow="hover" class="summary-card summary-card--gray">
          <div class="summary-content">
            <div class="summary-icon">
              <el-icon><Close /></el-icon>
            </div>
            <div class="summary-info">
              <div class="summary-title">{{ t('inventory.outOfStockCount') }}</div>
              <div class="summary-value">{{ summary.outOfStockCount }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 数据表格 -->
    <el-card shadow="never" class="table-card">
      <template #header>
        <div class="card-header">
          <span class="card-title">{{ t('inventory.materialList') }}</span>
          <div class="card-actions">
            <el-button
              type="primary"
              size="small"
              @click="handleBatchAdjust"
              :disabled="!selectedRows.length"
            >
              <el-icon><Edit /></el-icon>
              {{ t('inventory.batchAdjust') }}
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
        :data="paginatedMaterials"
        border
        height="520"
        row-key="id"
        @selection-change="handleSelectionChange"
        @sort-change="handleSortChange"
        @row-dblclick="handleRowDoubleClick"
        class="data-table"
      >
        <el-table-column type="selection" width="50" align="center" />
        <el-table-column type="index" width="60" :label="t('inventory.serial')" align="center" />
        <el-table-column
          prop="materialCode"
          :label="t('inventory.materialCode')"
          width="140"
          sortable="custom"
          show-overflow-tooltip
        />
        <el-table-column
          prop="materialName"
          :label="t('inventory.materialName')"
          min-width="180"
          show-overflow-tooltip
        />
        <el-table-column
          prop="specification"
          :label="t('inventory.specification')"
          min-width="160"
          show-overflow-tooltip
        />
        <el-table-column prop="category" :label="t('inventory.category')" width="120" />
        <el-table-column prop="unit" :label="t('inventory.unit')" width="80" align="center" />
        <el-table-column
          prop="currentStock"
          :label="t('inventory.currentStock')"
          width="120"
          align="right"
          sortable="custom"
        />
        <el-table-column
          prop="safetyStock"
          :label="t('inventory.safetyStock')"
          width="120"
          align="right"
          sortable="custom"
        />
        <el-table-column
          :label="t('inventory.unitPrice')"
          width="110"
          align="right"
          sortable="custom"
        >
          <template #default="{ row }"> ¥ {{ formatAmount(row.unitPrice) }} </template>
        </el-table-column>
        <el-table-column
          :label="t('inventory.totalValue')"
          width="120"
          align="right"
          sortable="custom"
        >
          <template #default="{ row }"> ¥ {{ formatAmount(row.totalValue) }} </template>
        </el-table-column>
        <el-table-column :label="t('inventory.status')" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="statusTagMap[row.status].type" size="small">
              {{ statusTagMap[row.status].label }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="warehouse" :label="t('inventory.warehouse')" width="120" />
        <el-table-column prop="location" :label="t('inventory.location')" width="120" />
        <el-table-column
          prop="lastUpdateTime"
          :label="t('inventory.lastUpdateTime')"
          width="140"
          sortable="custom"
        />
        <el-table-column
          prop="remark"
          :label="t('inventory.remark')"
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
            <el-form-item :label="t('inventory.materialCode')" prop="materialCode">
              <el-input
                v-model="formData.materialCode"
                :placeholder="t('inventory.materialCodePlaceholder')"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('inventory.materialName')" prop="materialName">
              <el-input
                v-model="formData.materialName"
                :placeholder="t('inventory.materialNamePlaceholder')"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item :label="t('inventory.specification')" prop="specification">
              <el-input
                v-model="formData.specification"
                :placeholder="t('inventory.specificationPlaceholder')"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('inventory.category')" prop="category">
              <el-select
                v-model="formData.category"
                :placeholder="t('inventory.categoryPlaceholder')"
              >
                <el-option
                  v-for="item in categoryOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item :label="t('inventory.unit')" prop="unit">
              <el-select v-model="formData.unit" :placeholder="t('inventory.unitPlaceholder')">
                <el-option
                  v-for="item in unitOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item :label="t('inventory.currentStock')" prop="currentStock">
              <el-input-number
                v-model="formData.currentStock"
                :min="0"
                :precision="2"
                style="width: 100%"
                @change="calculateTotalValue"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item :label="t('inventory.safetyStock')" prop="safetyStock">
              <el-input-number
                v-model="formData.safetyStock"
                :min="0"
                :precision="2"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item :label="t('inventory.unitPrice')" prop="unitPrice">
              <el-input-number
                v-model="formData.unitPrice"
                :min="0"
                :precision="2"
                style="width: 100%"
                @change="calculateTotalValue"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item :label="t('inventory.totalValue')" prop="totalValue">
              <el-input v-model="formData.totalValue" readonly />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item :label="t('inventory.status')" prop="status">
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
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item :label="t('inventory.warehouse')" prop="warehouse">
              <el-select
                v-model="formData.warehouse"
                :placeholder="t('inventory.warehousePlaceholder')"
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
            <el-form-item :label="t('inventory.location')" prop="location">
              <el-input
                v-model="formData.location"
                :placeholder="t('inventory.locationPlaceholder')"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item :label="t('inventory.remark')" prop="remark">
          <el-input
            v-model="formData.remark"
            type="textarea"
            :rows="3"
            :placeholder="t('inventory.remarkPlaceholder')"
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
      :title="t('inventory.materialDetail')"
      width="600px"
      :close-on-click-modal="false"
    >
      <el-descriptions :column="2" border>
        <el-descriptions-item :label="t('inventory.materialCode')">
          {{ currentMaterial?.materialCode }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('inventory.materialName')">
          {{ currentMaterial?.materialName }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('inventory.specification')">
          {{ currentMaterial?.specification }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('inventory.category')">
          {{ currentMaterial?.category }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('inventory.unit')">
          {{ currentMaterial?.unit }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('inventory.currentStock')">
          {{ currentMaterial?.currentStock }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('inventory.safetyStock')">
          {{ currentMaterial?.safetyStock }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('inventory.unitPrice')">
          ¥ {{ formatAmount(currentMaterial?.unitPrice || 0) }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('inventory.totalValue')">
          ¥ {{ formatAmount(currentMaterial?.totalValue || 0) }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('inventory.status')">
          <el-tag :type="statusTagMap[currentMaterial?.status || 'normal'].type">
            {{ statusTagMap[currentMaterial?.status || 'normal'].label }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item :label="t('inventory.warehouse')">
          {{ currentMaterial?.warehouse }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('inventory.location')">
          {{ currentMaterial?.location }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('inventory.lastUpdateTime')">
          {{ currentMaterial?.lastUpdateTime }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('inventory.remark')" :span="2">
          {{ currentMaterial?.remark || '-' }}
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
  Box,
  Money,
  Warning,
  Close,
  Edit,
  View,
  Delete
} from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from '@/hooks/web/useI18n'

const { t } = useI18n()

type InventoryStatus = 'normal' | 'lowStock' | 'outOfStock' | 'discontinued'

interface InventoryMaterial {
  id: number
  materialCode: string
  materialName: string
  specification: string
  category: string
  unit: string
  currentStock: number
  safetyStock: number
  unitPrice: number
  totalValue: number
  status: InventoryStatus
  warehouse: string
  location: string
  lastUpdateTime: string
  remark: string
}

// 响应式数据
const queryFormRef = ref<FormInstance>()
const formRef = ref<FormInstance>()
const loading = ref(false)
const submitLoading = ref(false)
const dialogVisible = ref(false)
const detailDialogVisible = ref(false)
const selectedRows = ref<InventoryMaterial[]>([])
const currentMaterial = ref<InventoryMaterial | null>(null)

// 搜索表单
const queryForm = reactive({
  materialCode: '',
  materialName: '',
  category: '',
  warehouse: '',
  status: '' as InventoryStatus | ''
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
const formData = reactive<Partial<InventoryMaterial>>({
  materialCode: '',
  materialName: '',
  specification: '',
  category: '',
  unit: '',
  currentStock: 0,
  safetyStock: 0,
  unitPrice: 0,
  totalValue: 0,
  status: 'normal',
  warehouse: '',
  location: '',
  remark: ''
})

// 表单验证规则
const formRules: FormRules = {
  materialCode: [{ required: true, message: t('inventory.materialCodeRequired'), trigger: 'blur' }],
  materialName: [{ required: true, message: t('inventory.materialNameRequired'), trigger: 'blur' }],
  specification: [
    { required: true, message: t('inventory.specificationRequired'), trigger: 'blur' }
  ],
  category: [{ required: true, message: t('inventory.categoryRequired'), trigger: 'change' }],
  unit: [{ required: true, message: t('inventory.unitRequired'), trigger: 'change' }],
  currentStock: [{ required: true, message: t('inventory.currentStockRequired'), trigger: 'blur' }],
  safetyStock: [{ required: true, message: t('inventory.safetyStockRequired'), trigger: 'blur' }],
  unitPrice: [{ required: true, message: t('inventory.unitPriceRequired'), trigger: 'blur' }],
  warehouse: [{ required: true, message: t('inventory.warehouseRequired'), trigger: 'change' }],
  status: [{ required: true, message: t('inventory.statusRequired'), trigger: 'change' }]
}

// 分类选项
const categoryOptions = [
  { label: '原材料', value: '原材料' },
  { label: '半成品', value: '半成品' },
  { label: '成品', value: '成品' },
  { label: '辅料', value: '辅料' },
  { label: '工具', value: '工具' },
  { label: '设备', value: '设备' }
]

// 仓库选项
const warehouseOptions = [
  { label: '主仓库', value: '主仓库' },
  { label: '原料仓', value: '原料仓' },
  { label: '成品仓', value: '成品仓' },
  { label: '辅料仓', value: '辅料仓' },
  { label: '工具仓', value: '工具仓' }
]

// 单位选项
const unitOptions = [
  { label: '个', value: '个' },
  { label: '件', value: '件' },
  { label: '套', value: '套' },
  { label: '台', value: '台' },
  { label: '批', value: '批' },
  { label: '公斤', value: '公斤' },
  { label: '吨', value: '吨' },
  { label: '米', value: '米' }
]

// 状态选项
const statusOptions = [
  { label: t('inventory.statusNormal'), value: 'normal' },
  { label: t('inventory.statusLowStock'), value: 'lowStock' },
  { label: t('inventory.statusOutOfStock'), value: 'outOfStock' },
  { label: t('inventory.statusDiscontinued'), value: 'discontinued' }
]

// 状态标签映射
const statusTagMap: Record<
  InventoryStatus,
  { label: string; type: 'success' | 'warning' | 'danger' | 'info' }
> = {
  normal: { label: t('inventory.statusNormal'), type: 'success' },
  lowStock: { label: t('inventory.statusLowStock'), type: 'warning' },
  outOfStock: { label: t('inventory.statusOutOfStock'), type: 'danger' },
  discontinued: { label: t('inventory.statusDiscontinued'), type: 'info' }
}

// 模拟数据
const materials = ref<InventoryMaterial[]>([
  {
    id: 1,
    materialCode: 'M001',
    materialName: '不锈钢板材',
    specification: '304不锈钢 2mm厚',
    category: '原材料',
    unit: '张',
    currentStock: 150,
    safetyStock: 50,
    unitPrice: 120.0,
    totalValue: 18000.0,
    status: 'normal',
    warehouse: '主仓库',
    location: 'A区-01',
    lastUpdateTime: '2024-03-20 10:30:00',
    remark: '优质不锈钢板材'
  },
  {
    id: 2,
    materialCode: 'M002',
    materialName: '电子元件',
    specification: '电阻 1KΩ',
    category: '辅料',
    unit: '个',
    currentStock: 8,
    safetyStock: 20,
    unitPrice: 0.5,
    totalValue: 4.0,
    status: 'lowStock',
    warehouse: '辅料仓',
    location: 'B区-05',
    lastUpdateTime: '2024-03-19 14:20:00',
    remark: '精密电子元件'
  },
  {
    id: 3,
    materialCode: 'M003',
    materialName: '轴承',
    specification: '6205-2RS',
    category: '辅料',
    unit: '个',
    currentStock: 0,
    safetyStock: 10,
    unitPrice: 25.0,
    totalValue: 0.0,
    status: 'outOfStock',
    warehouse: '辅料仓',
    location: 'B区-03',
    lastUpdateTime: '2024-03-18 09:15:00',
    remark: '精密轴承'
  },
  {
    id: 4,
    materialCode: 'M004',
    materialName: '成品零件',
    specification: '机加工零件A',
    category: '成品',
    unit: '件',
    currentStock: 200,
    safetyStock: 30,
    unitPrice: 45.0,
    totalValue: 9000.0,
    status: 'normal',
    warehouse: '成品仓',
    location: 'C区-02',
    lastUpdateTime: '2024-03-20 16:45:00',
    remark: '精密机加工零件'
  },
  {
    id: 5,
    materialCode: 'M005',
    materialName: '旧型号零件',
    specification: '已停产型号',
    category: '成品',
    unit: '件',
    currentStock: 5,
    safetyStock: 0,
    unitPrice: 30.0,
    totalValue: 150.0,
    status: 'discontinued',
    warehouse: '成品仓',
    location: 'C区-08',
    lastUpdateTime: '2024-03-15 11:30:00',
    remark: '已停产，待处理'
  }
])

// 计算属性
const dialogTitle = computed(() => {
  return formData.id ? t('inventory.editMaterial') : t('inventory.addMaterial')
})

const filteredMaterials = computed(() => {
  const result = materials.value.filter((material) => {
    const codeMatch = queryForm.materialCode
      ? material.materialCode.toLowerCase().includes(queryForm.materialCode.toLowerCase())
      : true
    const nameMatch = queryForm.materialName
      ? material.materialName.toLowerCase().includes(queryForm.materialName.toLowerCase())
      : true
    const categoryMatch = queryForm.category ? material.category === queryForm.category : true
    const warehouseMatch = queryForm.warehouse ? material.warehouse === queryForm.warehouse : true
    const statusMatch = queryForm.status ? material.status === queryForm.status : true
    return codeMatch && nameMatch && categoryMatch && warehouseMatch && statusMatch
  })

  // 排序
  if (sortConfig.prop && sortConfig.order) {
    result.sort((a, b) => {
      const aVal = a[sortConfig.prop as keyof InventoryMaterial]
      const bVal = b[sortConfig.prop as keyof InventoryMaterial]
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
const paginatedMaterials = computed(() => {
  const start = (pagination.currentPage - 1) * pagination.pageSize
  const end = start + pagination.pageSize
  return filteredMaterials.value.slice(start, end)
})

// 监听过滤结果变化，更新分页总数
watch(
  filteredMaterials,
  (newVal) => {
    pagination.total = newVal.length
  },
  { immediate: true }
)

const summary = computed(() => {
  const result = {
    totalMaterials: materials.value.length,
    totalValue: 0,
    lowStockCount: 0,
    outOfStockCount: 0
  }
  materials.value.forEach((material) => {
    result.totalValue += material.totalValue
    if (material.status === 'lowStock') result.lowStockCount += 1
    if (material.status === 'outOfStock') result.outOfStockCount += 1
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
  queryForm.materialCode = ''
  queryForm.materialName = ''
  queryForm.category = ''
  queryForm.warehouse = ''
  queryForm.status = ''
  handleSearch()
}

const handleAdd = () => {
  Object.assign(formData, {
    id: undefined,
    materialCode: '',
    materialName: '',
    specification: '',
    category: '',
    unit: '',
    currentStock: 0,
    safetyStock: 0,
    unitPrice: 0,
    totalValue: 0,
    status: 'normal',
    warehouse: '',
    location: '',
    remark: ''
  })
  dialogVisible.value = true
}

const handleEdit = (row: InventoryMaterial) => {
  Object.assign(formData, { ...row })
  dialogVisible.value = true
}

const handleRowDoubleClick = (row: InventoryMaterial) => {
  handleEdit(row)
}

const handleView = (row: InventoryMaterial) => {
  currentMaterial.value = row
  detailDialogVisible.value = true
}

const handleDelete = async (row: InventoryMaterial) => {
  try {
    await ElMessageBox.confirm(
      t('inventory.deleteConfirm', { materialName: row.materialName }),
      t('common.warning'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    )
    const index = materials.value.findIndex((item) => item.id === row.id)
    if (index > -1) {
      materials.value.splice(index, 1)
      ElMessage.success(t('common.deleteSuccess'))
    }
  } catch {
    // 用户取消删除
  }
}

const handleBatchAdjust = () => {
  ElMessage.info(t('inventory.batchAdjustSuccess'))
}

const handleExport = () => {
  ElMessage.info(t('common.exportSuccess'))
}

const handleBatchExport = () => {
  ElMessage.info(t('common.batchExportSuccess'))
}

const handleSelectionChange = (selection: InventoryMaterial[]) => {
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

const calculateTotalValue = () => {
  formData.totalValue = (formData.currentStock || 0) * (formData.unitPrice || 0)
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
      const index = materials.value.findIndex((item) => item.id === formData.id)
      if (index > -1) {
        materials.value[index] = { ...formData } as InventoryMaterial
      }
      ElMessage.success(t('common.editSuccess'))
    } else {
      // 新增
      const newMaterial: InventoryMaterial = {
        ...formData,
        id: Date.now()
      } as InventoryMaterial
      materials.value.unshift(newMaterial)
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
watch([() => formData.currentStock, () => formData.unitPrice], calculateTotalValue)
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

.operation-buttons {
  display: flex;
  gap: 4px;
  padding: 0 8px;
  justify-content: center;
  align-items: center;
}
</style>
