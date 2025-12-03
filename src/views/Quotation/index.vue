<template>
  <div class="quotation-page p-4 space-y-4">
    <div v-if="isMobile" class="mobile-top-bar">
      <el-button text type="primary" @click="showMobileFilters = !showMobileFilters">
        {{ showMobileFilters ? '收起筛选' : '展开筛选' }}
      </el-button>
    </div>

    <!-- 查询表单 -->
    <el-form
      :model="queryForm"
      :inline="!isMobile"
      :label-width="isMobile ? 'auto' : '90px'"
      :label-position="isMobile ? 'top' : 'right'"
      class="query-form rounded-lg bg-[var(--el-bg-color-overlay)] p-4 shadow-sm"
      :class="{ 'query-form--mobile': isMobile }"
      v-show="!isMobile || showMobileFilters"
    >
      <el-form-item label="模糊查询">
        <el-input
          v-model="queryForm.keyword"
          placeholder="请输入更改通知单号 / 模具编号 / 加工零件名称"
          clearable
          :style="{ width: isMobile ? '100%' : '320px' }"
          @keyup.enter="handleSearch"
        />
      </el-form-item>
      <el-form-item label="加工周期">
        <el-date-picker
          v-model="queryForm.processingDate"
          type="date"
          placeholder="请选择加工日期"
          value-format="YYYY-MM-DD"
          :style="{ width: isMobile ? '100%' : '180px' }"
          clearable
        />
      </el-form-item>
      <el-form-item class="query-form__actions">
        <div class="query-actions">
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
          <el-button type="success" @click="handleCreate">新增报价单</el-button>
        </div>
      </el-form-item>
    </el-form>

    <!-- 报价单列表 -->
    <template v-if="filteredQuotations.length">
      <div class="qt-table-wrapper" :class="{ 'qt-table-wrapper--mobile': isMobile }">
        <el-table
          :data="pagedQuotations"
          border
          :height="isMobile ? undefined : 'calc(100vh - 320px)'"
          class="qt-table"
          row-key="id"
          @row-dblclick="handleRowDblClick"
        >
          <el-table-column type="index" label="序号" width="60" align="center" />
          <el-table-column
            prop="changeOrderNo"
            label="更改通知单号"
            min-width="180"
            show-overflow-tooltip
          />
          <el-table-column
            prop="processingDate"
            label="加工周期"
            width="140"
            show-overflow-tooltip
          />
          <el-table-column
            prop="partName"
            label="加工零件名称"
            min-width="200"
            show-overflow-tooltip
          />
          <el-table-column prop="moldNo" label="模具编号" min-width="140" show-overflow-tooltip />
          <el-table-column
            prop="department"
            label="申请更改部门"
            min-width="160"
            show-overflow-tooltip
          />
          <el-table-column prop="applicant" label="申请更改人" width="120" show-overflow-tooltip />
          <el-table-column label="单位材料费" width="120" align="right">
            <template #default="{ row }">
              {{ formatAmount(calcMaterialsTotal(row)) }}
            </template>
          </el-table-column>
          <el-table-column label="加工费用" width="120" align="right">
            <template #default="{ row }">
              {{ formatAmount(calcProcessingTotal(row)) }}
            </template>
          </el-table-column>
          <el-table-column prop="taxIncludedPrice" label="含税价格" width="120" align="right">
            <template #default="{ row }">
              {{ formatAmount(calcTaxIncludedPrice(row)) }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="200" fixed="right" align="center">
            <template #default="{ row }">
              <div class="operation-buttons">
                <el-button type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
                <el-button size="small" @click="handleView(row)">查看</el-button>
                <el-button type="danger" size="small" @click="handleDelete(row)">删除</el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 分页 -->
      <div class="pagination-footer" :class="{ 'pagination-footer--mobile': isMobile }">
        <el-pagination
          background
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :total="filteredQuotations.length"
          :layout="paginationLayout"
          :pager-count="paginationPagerCount"
          :page-sizes="[10, 20, 50]"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </template>
    <el-empty
      v-else
      description="暂无报价单"
      class="rounded-lg bg-[var(--el-bg-color-overlay)] py-16"
      :image-size="180"
    />

    <!-- 报价单编辑/查看对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :width="isMobile ? '100%' : '980px'"
      :fullscreen="isMobile"
      class="qt-edit-dialog"
      :close-on-click-modal="false"
      :show-close="false"
    >
      <template #header>
        <div class="qt-dialog-header">
          <span class="qt-dialog-header__title">
            长虹美菱股份有限公司(维修/更改类完工确认单）
          </span>
          <div class="qt-dialog-header__actions">
            <el-button size="small" @click="dialogVisible = false">取消</el-button>
            <el-button v-if="!isViewMode" size="small" type="primary" @click="handleSubmit">
              保存
            </el-button>
            <el-button v-else size="small" type="primary" @click="switchToEdit">
              改为编辑
            </el-button>
          </div>
        </div>
      </template>
      <el-form
        ref="formRef"
        :model="quotationForm"
        :rules="formRules"
        label-width="0"
        class="quotation-form"
      >
        <div class="quotation-sheet">
          <table class="qs-table">
            <tbody>
              <!-- 加工周期 / 更改通知单号 -->
              <tr>
                <td class="qs-label" colspan="2">加工周期</td>
                <td class="qs-input qs-manual" colspan="2">
                  <el-date-picker
                    v-model="quotationForm.processingDate"
                    type="date"
                    value-format="YYYY-MM-DD"
                    placeholder="请选择加工日期"
                    :disabled="isViewMode"
                    style="width: 100%"
                  />
                </td>
                <td class="qs-label" colspan="2">更改通知单号</td>
                <td class="qs-input qs-manual">
                  <el-input
                    v-model="quotationForm.changeOrderNo"
                    :disabled="isViewMode"
                    placeholder="请输入更改通知单号"
                    maxlength="50"
                  />
                </td>
              </tr>

              <!-- 加工零件名称 / 模具编号 -->
              <tr>
                <td class="qs-label" colspan="2">加工零件名称</td>
                <td class="qs-input qs-manual" colspan="2">
                  <el-input
                    v-model="quotationForm.partName"
                    :disabled="isViewMode"
                    placeholder="请输入加工零件名称"
                  />
                </td>
                <td class="qs-label" colspan="2">模具编号</td>
                <td class="qs-input qs-manual">
                  <el-input
                    v-model="quotationForm.moldNo"
                    :disabled="isViewMode"
                    placeholder="请输入模具编号"
                  />
                </td>
              </tr>

              <!-- 申请更改部门 / 申请更改人 -->
              <tr>
                <td class="qs-label" colspan="2">申请更改部门</td>
                <td class="qs-input qs-manual" colspan="2">
                  <el-input
                    v-model="quotationForm.department"
                    :disabled="isViewMode"
                    placeholder="请输入申请更改部门"
                  />
                </td>
                <td class="qs-label" colspan="2">申请更改人</td>
                <td class="qs-input qs-manual">
                  <el-input
                    v-model="quotationForm.applicant"
                    :disabled="isViewMode"
                    placeholder="请输入申请更改人"
                  />
                </td>
              </tr>

              <!-- 单位材料费表头 -->
              <tr>
                <td class="qs-label qs-vert-header" :rowspan="quotationForm.materials.length + 1">
                  单位材料费
                </td>
                <td class="qs-label">材料名称</td>
                <td class="qs-label">单价</td>
                <td class="qs-label">用量</td>
                <td class="qs-label">费用</td>
                <td class="qs-label" colspan="2">总价</td>
              </tr>

              <!-- 单位材料费明细 -->
              <tr v-for="(item, index) in quotationForm.materials" :key="`material-${index}`">
                <td class="qs-input qs-manual">
                  <el-input v-model="item.name" :disabled="isViewMode" placeholder="材料名称" />
                </td>
                <td class="qs-input qs-manual qs-number">
                  <el-input-number
                    v-model="item.unitPrice"
                    :disabled="isViewMode"
                    :min="0"
                    :precision="2"
                    :controls="false"
                    placeholder="单价"
                    style="width: 100%"
                  />
                </td>
                <td class="qs-input qs-manual qs-number">
                  <el-input-number
                    v-model="item.quantity"
                    :disabled="isViewMode"
                    :min="0"
                    :precision="0"
                    :controls="false"
                    placeholder="用量"
                    style="width: 100%"
                  />
                </td>
                <td class="qs-total qs-number">
                  {{ formatAmount(item.unitPrice * item.quantity) }}
                </td>
                <td
                  v-if="index === 0"
                  class="qs-total qs-number"
                  :rowspan="quotationForm.materials.length"
                  colspan="2"
                >
                  {{ formatAmount(materialsTotal) }}
                </td>
              </tr>

              <!-- 加工费用表头 -->
              <tr>
                <td class="qs-label qs-vert-header" :rowspan="quotationForm.processes.length + 1">
                  加工费用
                </td>
                <td class="qs-label">加工形工/工种</td>
                <td class="qs-label">含税单价</td>
                <td class="qs-label">用时（H）</td>
                <td class="qs-label">合计费用</td>
                <td class="qs-label" colspan="2">总价</td>
              </tr>

              <!-- 加工费用明细 -->
              <tr v-for="(item, index) in quotationForm.processes" :key="item.key">
                <td>{{ item.name }}</td>
                <td>{{ item.unitPriceLabel }}</td>
                <td class="qs-input qs-manual qs-number">
                  <el-input-number
                    v-model="item.hours"
                    :disabled="isViewMode"
                    :min="0"
                    :precision="1"
                    :controls="false"
                    placeholder="用时"
                    style="width: 100%"
                  />
                </td>
                <td class="qs-total qs-number">
                  {{ formatAmount(item.unitPrice * item.hours) }}
                </td>
                <td
                  v-if="index === 0"
                  class="qs-total qs-number"
                  :rowspan="quotationForm.processes.length"
                  colspan="2"
                >
                  {{ formatAmount(processingTotal) }}
                </td>
              </tr>

              <!-- 其他费用 -->
              <tr>
                <td class="qs-label" colspan="5">其他费用（焊、合模机、试模等）</td>
                <td class="qs-label">含税</td>
                <td class="qs-input qs-manual qs-number">
                  <el-input-number
                    v-model="quotationForm.otherFee"
                    :disabled="isViewMode"
                    :min="0"
                    :precision="2"
                    :controls="false"
                    placeholder="请输入其他费用"
                    style="width: 100%"
                  />
                </td>
              </tr>

              <!-- 运输费用 -->
              <tr>
                <td class="qs-label">运输费用</td>
                <td colspan="3">单价300元/吨</td>
                <td></td>
                <td class="qs-label">合计来回运输费用</td>
                <td class="qs-input qs-manual qs-number">
                  <el-input-number
                    v-model="quotationForm.transportFee"
                    :disabled="isViewMode"
                    :min="0"
                    :precision="2"
                    :controls="false"
                    placeholder="运输费用"
                    style="width: 100%"
                  />
                </td>
              </tr>

              <!-- 含税价格 -->
              <tr>
                <td class="qs-label">加工数量</td>
                <td class="qs-input qs-manual qs-number">
                  <el-input-number
                    v-model="quotationForm.quantity"
                    :disabled="isViewMode"
                    :min="1"
                    :precision="0"
                    :controls="false"
                    style="width: 100%"
                  />
                </td>
                <td colspan="3"></td>
                <td class="qs-label">含税价格</td>
                <td class="qs-total qs-number">
                  {{ formatAmount(taxIncludedPrice) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </el-form>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import {
  ElButton,
  ElDatePicker,
  ElDialog,
  ElEmpty,
  ElForm,
  ElFormItem,
  ElInput,
  ElInputNumber,
  ElMessage,
  ElMessageBox,
  ElPagination,
  ElTable,
  ElTableColumn
} from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { computed, reactive, ref } from 'vue'
import { useAppStore } from '@/store/modules/app'

interface QuotationMaterialItem {
  name: string
  unitPrice: number
  quantity: number
}

interface QuotationProcessItem {
  key: string
  name: string
  unitPriceLabel: string
  unitPrice: number
  hours: number
}

interface QuotationFormModel {
  id: number | null
  processingDate: string | ''
  changeOrderNo: string
  partName: string
  moldNo: string
  department: string
  applicant: string
  materials: QuotationMaterialItem[]
  processes: QuotationProcessItem[]
  otherFee: number
  transportFee: number
  quantity: number
}

type QuotationRecord = QuotationFormModel & {
  id: number
}

interface QueryForm {
  keyword: string
  processingDate: string | ''
}

const appStore = useAppStore()
const isMobile = computed(() => appStore.getMobile)
const showMobileFilters = ref(true)

// 查询表单
const queryForm = reactive<QueryForm>({
  keyword: '',
  processingDate: ''
})

// 报价单列表（前端临时存储，后端实现后再替换为接口）
const quotations = ref<QuotationRecord[]>([])
const nextId = ref(1)

// 分页
const pagination = reactive({
  page: 1,
  pageSize: 20
})

const paginationLayout = computed(() =>
  isMobile.value ? 'total, prev, pager, next' : 'total, sizes, prev, pager, next, jumper'
)

const paginationPagerCount = computed(() => (isMobile.value ? 5 : 7))

// 过滤后的数据
const filteredQuotations = computed(() => {
  let list = quotations.value

  if (queryForm.keyword) {
    const kw = queryForm.keyword.trim()
    list = list.filter(
      (item) =>
        item.changeOrderNo.includes(kw) || item.moldNo.includes(kw) || item.partName.includes(kw)
    )
  }

  if (queryForm.processingDate) {
    list = list.filter((item) => item.processingDate === queryForm.processingDate)
  }

  return list
})

const pagedQuotations = computed(() => {
  const start = (pagination.page - 1) * pagination.pageSize
  const end = start + pagination.pageSize
  return filteredQuotations.value.slice(start, end)
})

// 表单 & 对话框
const dialogVisible = ref(false)
const dialogTitle = ref('新增报价单')
const dialogMode = ref<'create' | 'edit' | 'view'>('create')
const isViewMode = computed(() => dialogMode.value === 'view')
const formRef = ref<FormInstance>()

const createEmptyForm = (): QuotationFormModel => ({
  id: null,
  processingDate: '',
  changeOrderNo: '',
  partName: '',
  moldNo: '',
  department: '',
  applicant: '',
  materials: [
    { name: '紫铜电极', unitPrice: 0, quantity: 0 },
    { name: '配件', unitPrice: 0, quantity: 0 }
  ],
  processes: [
    { key: 'nc', name: '数控', unitPriceLabel: '35元/小时', unitPrice: 35, hours: 0 },
    { key: 'fastCut', name: '快速切割', unitPriceLabel: '12元/小时', unitPrice: 12, hours: 0 },
    { key: 'middleCut', name: '中丝切割', unitPriceLabel: '30元/小时', unitPrice: 30, hours: 0 },
    { key: 'slowCut', name: '慢丝切割', unitPriceLabel: '70元/小时', unitPrice: 70, hours: 0 },
    { key: 'cnc', name: 'CNC', unitPriceLabel: '70元/小时', unitPrice: 70, hours: 0 },
    { key: 'highSpeed', name: '高速铣', unitPriceLabel: '150元/小时', unitPrice: 150, hours: 0 },
    { key: 'spark', name: '电火花', unitPriceLabel: '60元/小时', unitPrice: 60, hours: 0 },
    { key: 'gantry', name: '龙门', unitPriceLabel: '90元/小时', unitPrice: 90, hours: 0 },
    { key: 'fitter', name: '钳工', unitPriceLabel: '35元/小时', unitPrice: 35, hours: 0 },
    { key: 'polish', name: '抛光', unitPriceLabel: '40元/小时', unitPrice: 40, hours: 0 }
  ],
  otherFee: 0,
  transportFee: 0,
  quantity: 1
})

const quotationForm = reactive<QuotationFormModel>(createEmptyForm())

const formRules: FormRules = {
  processingDate: [{ required: true, message: '请选择加工周期', trigger: 'change' }],
  changeOrderNo: [{ required: true, message: '请输入更改通知单号', trigger: 'blur' }],
  partName: [{ required: true, message: '请输入加工零件名称', trigger: 'blur' }],
  moldNo: [{ required: true, message: '请输入模具编号', trigger: 'blur' }],
  department: [{ required: true, message: '请输入申请更改部门', trigger: 'blur' }],
  applicant: [{ required: true, message: '请输入申请更改人', trigger: 'blur' }]
}

// 金额计算
const materialsTotal = computed(() =>
  quotationForm.materials.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
)

const processingTotal = computed(() =>
  quotationForm.processes.reduce((sum, item) => sum + item.unitPrice * item.hours, 0)
)

const taxIncludedPrice = computed(
  () =>
    materialsTotal.value +
    processingTotal.value +
    quotationForm.otherFee +
    quotationForm.transportFee
)

const calcMaterialsTotal = (row: QuotationRecord) =>
  row.materials.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)

const calcProcessingTotal = (row: QuotationRecord) =>
  row.processes.reduce((sum, item) => sum + item.unitPrice * item.hours, 0)

const calcTaxIncludedPrice = (row: QuotationRecord) =>
  calcMaterialsTotal(row) + calcProcessingTotal(row) + row.otherFee + row.transportFee

const formatAmount = (value: number) => {
  if (!value) return '0'
  return value.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

// 查询
const handleSearch = () => {
  pagination.page = 1
}

const handleReset = () => {
  queryForm.keyword = ''
  queryForm.processingDate = ''
  pagination.page = 1
}

// 新增
const handleCreate = () => {
  dialogMode.value = 'create'
  dialogTitle.value = '新增报价单'
  Object.assign(quotationForm, createEmptyForm())
  dialogVisible.value = true
}

// 编辑
const handleEdit = (row: QuotationRecord) => {
  dialogMode.value = 'edit'
  dialogTitle.value = '编辑报价单'
  Object.assign(quotationForm, {
    ...row,
    materials: row.materials.map((m) => ({ ...m })),
    processes: row.processes.map((p) => ({ ...p }))
  })
  dialogVisible.value = true
}

// 查看
const handleView = (row: QuotationRecord) => {
  dialogMode.value = 'view'
  dialogTitle.value = '查看报价单'
  Object.assign(quotationForm, {
    ...row,
    materials: row.materials.map((m) => ({ ...m })),
    processes: row.processes.map((p) => ({ ...p }))
  })
  dialogVisible.value = true
}

const switchToEdit = () => {
  dialogMode.value = 'edit'
  dialogTitle.value = '编辑报价单'
}

// 删除
const handleDelete = async (row: QuotationRecord) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除报价单【${row.changeOrderNo || row.partName}】吗？`,
      '提示',
      {
        type: 'warning'
      }
    )
    quotations.value = quotations.value.filter((item) => item.id !== row.id)
    ElMessage.success('删除成功')
  } catch {
    // 用户取消
  }
}

// 行双击查看
const handleRowDblClick = (row: QuotationRecord) => {
  handleView(row)
}

// 保存
const handleSubmit = async () => {
  if (!formRef.value) return
  await formRef.value.validate()

  const payload: QuotationFormModel = {
    id: quotationForm.id,
    processingDate: quotationForm.processingDate,
    changeOrderNo: quotationForm.changeOrderNo.trim(),
    partName: quotationForm.partName.trim(),
    moldNo: quotationForm.moldNo.trim(),
    department: quotationForm.department.trim(),
    applicant: quotationForm.applicant.trim(),
    materials: quotationForm.materials.map((m) => ({ ...m })),
    processes: quotationForm.processes.map((p) => ({ ...p })),
    otherFee: quotationForm.otherFee,
    transportFee: quotationForm.transportFee,
    quantity: quotationForm.quantity
  }

  if (dialogMode.value === 'create' || quotationForm.id == null) {
    const id = nextId.value++
    const record: QuotationRecord = {
      ...payload,
      id
    }
    quotations.value.unshift(record)
    ElMessage.success('新增报价单成功（当前为前端本地记录）')
  } else {
    quotations.value = quotations.value.map((item) =>
      item.id === quotationForm.id ? ({ ...item, ...payload } as QuotationRecord) : item
    )
    ElMessage.success('编辑报价单成功（当前为前端本地记录）')
  }

  dialogVisible.value = false
}

// 分页
const handleSizeChange = (size: number) => {
  pagination.pageSize = size
  pagination.page = 1
}

const handleCurrentChange = (page: number) => {
  pagination.page = page
}
</script>

<style scoped>


@media (width <= 768px) {
  :deep(.qt-edit-dialog) {
    width: 100% !important;
    max-width: 100% !important;
    margin: 0 !important;
  }

  :deep(.qt-edit-dialog .el-dialog__body) {
    padding: 2px 8px 8px;
  }

  :deep(.qt-edit-dialog .el-dialog__header),
  :deep(.qt-edit-dialog .el-dialog__footer) {
    padding-inline: 8px;
  }
}

.quotation-page {
  position: relative;
}

.mobile-top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-top: 2px;
}

.query-form {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

:deep(.query-form .el-form-item) {
  margin-bottom: 0;
}

.query-form--mobile {
  padding: 12px;
}

:deep(.query-form--mobile .el-form-item) {
  width: 100%;
  margin-right: 0;
  margin-bottom: 8px;
}

:deep(.query-form--mobile .el-form-item .el-form-item__content) {
  width: 100%;
}

.query-form__actions {
  display: flex;
  margin-right: 12px;
  margin-bottom: 0;
  margin-left: auto;
  justify-content: flex-end;
  align-items: center;
}

.query-actions {
  display: flex;
  flex-wrap: nowrap;
  gap: 8px;
  justify-content: flex-end;
}

:deep(.query-form .el-form-item:not(.query-form__actions)) {
  margin-right: 18px;
  margin-bottom: 0;
}

.qt-table-wrapper {
  background: var(--el-bg-color);
  border-radius: 8px;
}

.qt-table-wrapper--mobile {
  padding-bottom: 8px;
  overflow-x: auto;
}

.qt-table-wrapper--mobile .qt-table {
  min-width: 960px;
}

.operation-buttons {
  display: flex;
  gap: 4px;
  justify-content: center;
}

.pagination-footer {
  position: fixed;
  bottom: 10px;
  left: 50%;
  z-index: 10;
  display: flex;
  transform: translateX(-50%);
  justify-content: center;
}

.pagination-footer--mobile {
  position: static;
  left: auto;
  margin-top: 12px;
  transform: none;
  justify-content: center;
}

/* 报价单弹窗样式 */
.quotation-sheet {
  font-size: 13px;
  color: #333;
}

.qs-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.qs-table td {
  padding: 4px 6px;
  border: 1px solid #000;
  box-sizing: border-box;
}

.qs-title {
  padding: 8px 0;
  font-size: 16px;
  font-weight: 600;
  text-align: center;
}

.qs-label {
  font-weight: 500;
  text-align: center;
  background-color: #f5f5f5;
}

.qs-section-title {
  font-weight: 600;
  text-align: center;
}

.qs-input.qs-manual {
  background-color: #fff7d6; /* 手工填写区域（接近 Excel 黄色） */
}

.qs-total {
  font-weight: 600;
  text-align: right;
  background-color: #d8f0d2; /* 合计区域（接近 Excel 绿色） */
}

.qs-text {
  text-align: center;
}

.qs-number {
  text-align: right;
}

.qs-vert-header {
  text-align: center;
}

.qs-footer {
  font-size: 12px;
  color: #666;
  text-align: center;
}

/* 弹窗整体高度控制（PC 端） */
:deep(.qt-edit-dialog .el-dialog) {
  max-height: calc(100vh - 80px);
  margin-top: 0;
}

:deep(.qt-edit-dialog .el-dialog__body) {
  max-height: calc(100vh - 120px);
  padding: 4px 12px 12px;
  overflow-y: auto;
}

:deep(.qt-edit-dialog .el-dialog__header) {
  padding: 2px 12px 0;
}

.qt-dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.qt-dialog-header__title {
  font-weight: 600;
  text-align: center;
  flex: 1 1 auto;
}

.qt-dialog-header__actions {
  display: flex;
  gap: 8px;
}

:deep(.qt-edit-dialog .el-dialog__headerbtn) {
  position: static;
  margin-left: 8px;
}
</style>
