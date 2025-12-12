<template>
  <div class="quotation-page p-4 space-y-4">
    <div v-if="isMobile" class="mobile-top-bar">
      <div class="mobile-top-bar-left">
        <el-button text type="primary" @click="showMobileFilters = !showMobileFilters">
          {{ showMobileFilters ? '收起筛选' : '展开筛选' }}
        </el-button>
      </div>
      <div class="view-mode-switch">
        <span class="view-mode-switch__label">视图</span>
        <el-radio-group v-model="viewMode" size="small">
          <el-radio-button value="card">卡片</el-radio-button>
          <el-radio-button value="table">表格</el-radio-button>
        </el-radio-group>
      </div>
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
          placeholder="请输入报价单号 / 客户名称 / 更改通知单号 / 模具编号 / 加工零件名称"
          clearable
          :style="{ width: isMobile ? '100%' : '320px' }"
          @keyup.enter="handleSearch"
        />
      </el-form-item>
      <el-form-item label="加工日期">
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
    <!-- 手机端卡片视图 -->
    <div v-if="isMobile && viewMode === 'card'" class="qt-mobile-list" v-loading="loading">
      <el-empty v-if="!quotations.length && !loading" description="暂无报价单" />
      <template v-else>
        <el-card v-for="row in pagedQuotations" :key="row.id" class="qt-mobile-card" shadow="hover">
          <div class="qt-mobile-card__header">
            <div>
              <div class="qt-mobile-card__quotation-no">
                报价单号：{{ row.quotationNo || '-' }}
              </div>
              <div class="qt-mobile-card__date">
                报价日期：{{ formatDate(row.quotationDate) || '-' }}
              </div>
              <div class="qt-mobile-card__customer">{{ row.customerName || '-' }}</div>
            </div>
          </div>
          <div class="qt-mobile-card__meta">
            <div>
              <span class="label">更改通知单号</span>
              <span class="value">{{ row.changeOrderNo || '-' }}</span>
            </div>
            <div>
              <span class="label">模具编号</span>
              <span class="value">{{ row.moldNo || '-' }}</span>
            </div>
            <div>
              <span class="label">加工零件名称</span>
              <span class="value">{{ row.partName || '-' }}</span>
            </div>
            <div>
              <span class="label">申请更改人</span>
              <span class="value">{{ row.applicant || '-' }}</span>
            </div>
          </div>
          <div class="qt-mobile-card__stats">
            <div class="stat">
              <div class="stat-label">加工数量</div>
              <div class="stat-value">{{ row.quantity || 0 }}</div>
            </div>
            <div class="stat">
              <div class="stat-label">含税价格(元)</div>
              <div class="stat-value">{{ formatAmount(calcTaxIncludedPrice(row)) }}</div>
            </div>
          </div>
          <div class="qt-mobile-card__actions">
            <el-button type="success" size="small" @click="handleView(row)">查看</el-button>
            <el-button type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button type="danger" size="small" @click="handleDelete(row)">删除</el-button>
          </div>
        </el-card>
      </template>
    </div>

    <!-- PC端表格视图 / 手机端表格视图 -->
    <div
      v-else-if="viewMode === 'table'"
      class="qt-table-wrapper"
      :class="{ 'qt-table-wrapper--mobile': isMobile }"
    >
      <el-table
        v-if="quotations.length"
        v-loading="loading"
        :data="pagedQuotations"
        border
        :height="isMobile ? undefined : 'calc(100vh - 320px)'"
        class="qt-table"
        row-key="id"
        @row-dblclick="handleRowDblClick"
      >
        <el-table-column type="index" label="序号" width="60" align="center" />
        <el-table-column
          prop="quotationNo"
          label="报价单号"
          min-width="150"
          show-overflow-tooltip
        />
        <el-table-column prop="quotationDate" label="报价日期" width="120" show-overflow-tooltip>
          <template #default="{ row }">
            {{ formatDate(row.quotationDate) }}
          </template>
        </el-table-column>
        <el-table-column
          prop="customerName"
          label="客户名称"
          min-width="180"
          show-overflow-tooltip
        />
        <el-table-column
          prop="changeOrderNo"
          label="更改通知单号"
          min-width="140"
          show-overflow-tooltip
        />
        <el-table-column
          prop="partName"
          label="加工零件名称"
          min-width="160"
          show-overflow-tooltip
        />
        <el-table-column prop="moldNo" label="模具编号" min-width="140" show-overflow-tooltip />
        <el-table-column prop="applicant" label="申请更改人" width="120" show-overflow-tooltip />
        <el-table-column prop="taxIncludedPrice" label="含税价格" width="120" align="right">
          <template #default="{ row }">
            {{ formatAmount(calcTaxIncludedPrice(row)) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right" align="center">
          <template #default="{ row }">
            <div class="operation-buttons">
              <el-button type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
              <el-button type="success" size="small" @click="handleView(row)">查看</el-button>
              <el-button type="danger" size="small" @click="handleDelete(row)">删除</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 分页 -->
    <div
      v-if="quotations.length"
      class="pagination-footer"
      :class="{ 'pagination-footer--mobile': isMobile || viewMode === 'card' }"
    >
      <el-pagination
        background
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :total="total"
        :layout="paginationLayout"
        :pager-count="paginationPagerCount"
        :page-sizes="[10, 20, 50]"
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
      />
    </div>

    <!-- 空状态 -->
    <el-empty
      v-if="!quotations.length && !loading && (viewMode === 'table' || !isMobile)"
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
          <span class="qt-dialog-header__title"></span>
        </div>
      </template>
      <el-form
        ref="formRef"
        :model="quotationForm"
        :rules="formRules"
        label-width="0"
        class="quotation-form"
      >
        <!-- 顶部字段：报价单号、报价日期、客户名称 -->
        <div class="quotation-top-fields">
          <div class="quotation-top-left">
            <el-form-item
              prop="quotationNo"
              class="quotation-top-field quotation-top-field--inline"
            >
              <span class="field-label-inline">报价单号：</span>
              <el-input
                v-model="quotationForm.quotationNo"
                :disabled="true"
                placeholder="报价单号"
                class="field-input-inline field-input-quotation-no"
              />
            </el-form-item>
            <el-form-item
              prop="quotationDate"
              class="quotation-top-field quotation-top-field--inline"
            >
              <span class="field-label-inline">报价日期：</span>
              <el-date-picker
                v-model="quotationForm.quotationDate"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="请选择报价日期"
                :disabled="isViewMode"
                class="field-input-inline field-input-quotation-date"
                style="width: 140px !important"
              />
            </el-form-item>
          </div>
          <el-form-item
            prop="customerName"
            class="quotation-top-field quotation-top-field--inline"
            :show-message="false"
          >
            <span class="field-required">*</span>
            <span class="field-label-inline">客户名称：</span>
            <el-select
              v-model="quotationForm.customerName"
              placeholder="请选择客户名称"
              :disabled="isViewMode"
              filterable
              clearable
              :loading="customerLoading"
              class="field-input-inline field-input-customer-name"
            >
              <el-option
                v-for="customer in customerList"
                :key="customer.id"
                :label="customer.customerName"
                :value="customer.customerName"
              />
            </el-select>
          </el-form-item>
          <!-- 操作按钮 -->
          <div class="qt-dialog-actions">
            <el-button size="small" @click="dialogVisible = false">取消</el-button>
            <el-button v-if="!isViewMode" size="small" type="primary" @click="handleSubmit">
              保存
            </el-button>
            <el-button
              v-if="!isViewMode"
              size="small"
              type="primary"
              plain
              :loading="importingProject"
              :disabled="importingProject"
              @click="handleImportFromProject"
            >
              项目代入
            </el-button>
            <el-button
              v-if="isViewMode && quotationForm.id"
              size="small"
              type="success"
              :loading="downloading"
              :disabled="downloading"
              @click="handleDownloadExcel"
            >
              {{ downloading ? '正在生成 PDF...' : '报价单下载' }}
            </el-button>
            <el-button
              v-if="isViewMode && quotationForm.id"
              size="small"
              type="primary"
              :loading="downloading"
              :disabled="downloading"
              @click="handleDownloadCompletionPdf"
            >
              完工单下载
            </el-button>
          </div>
        </div>

        <div class="quotation-sheet">
          <table class="qs-table">
            <tbody>
              <!-- 加工日期 / 更改通知单号 -->
              <tr>
                <td class="qs-label" colspan="2">加工日期</td>
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
              <tr
                v-for="(item, index) in quotationForm.materials"
                :key="`material-${index}`"
                class="qs-row-material"
              >
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
              <tr
                v-for="(item, index) in quotationForm.processes"
                :key="item.key"
                class="qs-row-process"
              >
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

    <!-- 项目代入对话框 -->
    <el-dialog
      v-model="projectImportDialogVisible"
      title="按项目代入"
      width="720px"
      :close-on-click-modal="false"
    >
      <div class="project-import-dialog">
        <el-input
          v-model="projectSearchKeyword"
          placeholder="请输入项目编号 / 产品名称 / 产品图号 / 客户模号 关键字（仅在分类为“塑胶模具”的项目中查询）"
          clearable
          class="project-import-search-input"
        />
        <el-table
          v-loading="projectSearchLoading"
          :data="projectSearchResults"
          border
          height="360"
          class="project-import-table"
          @row-dblclick="handleSelectProjectForImport"
        >
          <el-table-column prop="项目编号" label="项目编号" min-width="145" />
          <el-table-column
            prop="productDrawing"
            label="产品图号"
            min-width="150"
            show-overflow-tooltip
          />
          <el-table-column
            prop="productName"
            label="产品名称"
            min-width="150"
            show-overflow-tooltip
          />
          <el-table-column prop="客户模号" label="客户模号" min-width="120" show-overflow-tooltip />
          <el-table-column label="操作" width="90" align="center">
            <template #default="{ row }">
              <el-button
                size="small"
                type="primary"
                :loading="importingProject"
                :disabled="importingProject"
                @click.stop="handleSelectProjectForImport(row)"
              >
                代入
              </el-button>
            </template>
          </el-table-column>
        </el-table>
        <div v-if="projectSearchTotal > 0" class="project-import-pagination">
          <el-pagination
            background
            layout="total, prev, pager, next"
            :current-page="projectSearchPage"
            :page-size="projectSearchPageSize"
            :total="projectSearchTotal"
            @current-change="handleProjectImportPageChange"
          />
        </div>
        <div
          v-if="!projectSearchResults.length && projectSearchKeyword && !projectSearchLoading"
          class="project-import-empty"
        >
          在分类为「塑胶模具」的项目中未找到匹配的项目编号
        </div>
        <div class="project-import-tip">
          提示：在输入框中连续输入字符即可逐步缩小项目范围，双击行或点击“代入”按钮即可填充。
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import {
  ElButton,
  ElCard,
  ElDatePicker,
  ElDialog,
  ElEmpty,
  ElForm,
  ElFormItem,
  ElInput,
  ElInputNumber,
  ElMessage,
  ElMessageBox,
  ElOption,
  ElPagination,
  ElRadioGroup,
  ElRadioButton,
  ElSelect,
  ElTable,
  ElTableColumn
} from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useAppStore } from '@/store/modules/app'
import { getCustomerListApi, type CustomerInfo } from '@/api/customer'
import { getProjectGoodsApi, getProjectListApi } from '@/api/project'
import {
  generateQuotationNoApi,
  createQuotationApi,
  updateQuotationApi,
  deleteQuotationApi,
  getQuotationListApi,
  downloadQuotationPdfApi,
  downloadQuotationCompletionPdfApi,
  type QuotationFormData
} from '@/api/quotation'
import type { QuotationRecord } from '@/api/quotation'

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
  quotationNo: string
  quotationDate: string | ''
  customerName: string
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

// QuotationRecord 类型已从 API 导入

interface QueryForm {
  keyword: string
  processingDate: string | ''
}

const appStore = useAppStore()
const isMobile = computed(() => appStore.getMobile)
const showMobileFilters = ref(true)

// 视图模式：手机端默认卡片视图，PC端默认表格视图
type ViewMode = 'table' | 'card'
const viewMode = ref<ViewMode>(isMobile.value ? 'card' : 'table')

// 客户列表
const customerList = ref<CustomerInfo[]>([])
const customerLoading = ref(false)

// 查询表单
const queryForm = reactive<QueryForm>({
  keyword: '',
  processingDate: ''
})

// 报价单列表
const quotations = ref<QuotationRecord[]>([])
const loading = ref(false)
const total = ref(0)

// 分页
const pagination = reactive({
  page: 1,
  pageSize: 20
})

const paginationLayout = computed(() =>
  isMobile.value || viewMode.value === 'card'
    ? 'total, prev, pager, next'
    : 'total, sizes, prev, pager, next, jumper'
)

const paginationPagerCount = computed(() => (isMobile.value || viewMode.value === 'card' ? 5 : 7))

// 直接使用后端返回的数据（后端已实现搜索和分页）
const pagedQuotations = computed(() => quotations.value)

// 表单 & 对话框
const dialogVisible = ref(false)
const dialogTitle = ref('新增报价单')
const dialogMode = ref<'create' | 'edit' | 'view'>('create')
const isViewMode = computed(() => dialogMode.value === 'view')
const formRef = ref<FormInstance>()
const downloading = ref(false)
const importingProject = ref(false)

// 项目代入对话框 & 查询状态
const projectImportDialogVisible = ref(false)
const projectSearchKeyword = ref('')
const projectSearchLoading = ref(false)
const projectSearchResults = ref<any[]>([])
const projectSearchPage = ref(1)
const projectSearchPageSize = ref(20)
const projectSearchTotal = ref(0)
let projectSearchDebounceTimer: any = null

const createEmptyForm = (): QuotationFormModel => ({
  id: null,
  quotationNo: '',
  quotationDate: '',
  customerName: '',
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
  // 报价日期、客户名称、加工零件名称 为必填
  quotationDate: [{ required: true, message: '请选择报价日期', trigger: 'change' }],
  customerName: [{ required: true, message: '请选择客户名称', trigger: 'change' }],
  partName: [{ required: true, message: '请输入加工零件名称', trigger: 'blur' }]
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

// 格式化日期：YYYY-MM-DD
const formatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return '-'
  // 如果已经是 YYYY-MM-DD 格式，直接返回
  if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr
  }
  // 如果是日期对象或其他格式，尝试转换
  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return '-'
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  } catch {
    return dateStr || '-'
  }
}

// 获取客户列表
const fetchCustomerList = async () => {
  try {
    customerLoading.value = true
    const response = await getCustomerListApi({
      status: 'active',
      page: 1,
      pageSize: 10000
    })

    if (response && response.data && response.data.list) {
      customerList.value = response.data.list
    } else {
      ElMessage.error('获取客户列表失败')
    }
  } catch (error) {
    console.error('获取客户列表失败:', error)
    ElMessage.error('获取客户列表失败')
  } finally {
    customerLoading.value = false
  }
}

// 加载报价单列表
const loadQuotations = async () => {
  try {
    loading.value = true
    const response = await getQuotationListApi({
      keyword: queryForm.keyword,
      processingDate: queryForm.processingDate,
      page: pagination.page,
      pageSize: pagination.pageSize
    })

    const pr: any = response
    if (pr?.code === 0 || pr?.success === true) {
      quotations.value = pr.data?.list || []
      total.value = pr.data?.total || 0
    } else {
      ElMessage.error(pr?.message || '获取报价单列表失败')
    }
  } catch (error: any) {
    console.error('加载报价单列表失败:', error)
    ElMessage.error('加载报价单列表失败')
  } finally {
    loading.value = false
  }
}

// 查询
const handleSearch = () => {
  pagination.page = 1
  loadQuotations()
}

const handleReset = () => {
  queryForm.keyword = ''
  queryForm.processingDate = ''
  pagination.page = 1
  loadQuotations()
}

// 新增
const handleCreate = async () => {
  try {
    dialogMode.value = 'create'
    dialogTitle.value = '新增报价单'
    Object.assign(quotationForm, createEmptyForm())

    // 生成新的报价单编号
    const response = await generateQuotationNoApi()
    const raw: any = response
    const pr: any = raw?.data ?? raw
    const newQuotationNo = pr?.quotationNo || ''

    if (!newQuotationNo) {
      ElMessage.error('生成报价单号失败')
      return
    }

    // 设置报价单号
    quotationForm.quotationNo = newQuotationNo

    // 设置默认报价日期为今天
    const today = new Date()
    quotationForm.quotationDate = today.toISOString().split('T')[0]

    await fetchCustomerList()
    dialogVisible.value = true
  } catch (error) {
    console.error('打开新建对话框失败:', error)
    ElMessage.error('打开新建对话框失败')
  }
}

// 编辑
const handleEdit = async (row: QuotationRecord) => {
  dialogMode.value = 'edit'
  dialogTitle.value = '编辑报价单'
  Object.assign(quotationForm, {
    ...row,
    materials: row.materials.map((m) => ({ ...m })),
    processes: row.processes.map((p) => ({ ...p }))
  })
  await fetchCustomerList()
  dialogVisible.value = true
}

// 查看
const handleView = async (row: QuotationRecord) => {
  dialogMode.value = 'view'
  dialogTitle.value = '查看报价单'
  Object.assign(quotationForm, {
    ...row,
    materials: row.materials.map((m) => ({ ...m })),
    processes: row.processes.map((p) => ({ ...p }))
  })
  await fetchCustomerList()
  dialogVisible.value = true
}

// 下载当前报价单的 Excel 文件
const handleDownloadExcel = async () => {
  if (!quotationForm.id) {
    ElMessage.warning('请先保存报价单后再下载')
    return
  }

  try {
    downloading.value = true
    ElMessage.info('正在生成报价单 PDF，请稍候...')

    const resp = await downloadQuotationPdfApi(quotationForm.id)
    const blob = (resp as any)?.data ?? resp
    const url = window.URL.createObjectURL(blob as Blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${quotationForm.quotationNo || '报价单'}报价.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  } catch (error) {
    console.error('下载报价单 Excel 失败:', error)
    ElMessage.error('下载报价单失败')
  } finally {
    downloading.value = false
  }
}

// 下载当前报价单的 完工单 PDF 文件
const handleDownloadCompletionPdf = async () => {
  if (!quotationForm.id) {
    ElMessage.warning('请先保存报价单后再下载')
    return
  }

  const missingFields: string[] = []
  if (!quotationForm.processingDate) missingFields.push('加工日期')
  if (!quotationForm.partName || !quotationForm.partName.trim()) missingFields.push('加工零件名称')
  if (!quotationForm.moldNo || !quotationForm.moldNo.trim()) missingFields.push('模具编号')
  if (!quotationForm.department || !quotationForm.department.trim())
    missingFields.push('申请更改部门')
  if (!quotationForm.applicant || !quotationForm.applicant.trim()) missingFields.push('申请更改人')

  if (missingFields.length > 0) {
    ElMessage.error(`完工单下载前请先填写：${missingFields.join('、')}`)
    return
  }

  try {
    downloading.value = true
    ElMessage.info('正在生成完工单 PDF，请稍候...')

    const resp = await downloadQuotationCompletionPdfApi(quotationForm.id)
    const blob = (resp as any)?.data ?? resp
    const url = window.URL.createObjectURL(blob as Blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${quotationForm.quotationNo || '报价单'}完工单.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  } catch (error) {
    console.error('下载完工单 PDF 失败:', error)
    ElMessage.error('下载完工单失败')
  } finally {
    downloading.value = false
  }
}

// 项目代入对话框分页
const handleProjectImportPageChange = (page: number) => {
  projectSearchPage.value = page
  searchProjectsForImport()
}

// 查询项目列表（仅分类为「塑胶模具」，在货物信息表中按 项目编号 / 产品名称 / 产品图号 模糊查询）
const searchProjectsForImport = async () => {
  const keyword = projectSearchKeyword.value.trim()

  if (!keyword) {
    projectSearchResults.value = []
    projectSearchTotal.value = 0
    return
  }

  projectSearchLoading.value = true
  try {
    const listParams: any = {
      keyword,
      category: '塑胶模具',
      page: projectSearchPage.value,
      pageSize: projectSearchPageSize.value
    }

    const listResponse: any = await getProjectListApi(listParams)

    let projectList: any[] = []
    let total = 0

    if (listResponse?.data?.data) {
      const payload = listResponse.data.data
      projectList = payload.list || []
      total = payload.total || 0
      if (typeof payload.page === 'number') {
        projectSearchPage.value = payload.page
      }
      if (typeof payload.pageSize === 'number') {
        projectSearchPageSize.value = payload.pageSize
      }
    } else if (listResponse?.data?.list) {
      projectList = listResponse.data.list || []
      total = listResponse.data.total || projectList.length || 0
    } else if (Array.isArray(listResponse?.list)) {
      projectList = listResponse.list
      total = projectList.length
    }

    projectSearchResults.value = projectList || []
    projectSearchTotal.value = total
  } catch (error) {
    console.error('按项目代入查询失败:', error)
    ElMessage.error('按项目代入查询失败')
    projectSearchResults.value = []
    projectSearchTotal.value = 0
  } finally {
    projectSearchLoading.value = false
  }
}

// 根据项目编号代入项目信息（产品图号 → 加工零件名称，客户模号 → 模具编号）
const handleImportFromProject = async () => {
  projectSearchKeyword.value = ''
  projectSearchResults.value = []
  projectSearchPage.value = 1
  projectSearchTotal.value = 0
  projectImportDialogVisible.value = true
}

// 选中某个项目后代入到表单
const handleSelectProjectForImport = async (row: any) => {
  const projectCode = row?.项目编号 || row?.projectCode || ''
  if (!projectCode) {
    ElMessage.error('无法获取项目编号')
    return
  }

  try {
    importingProject.value = true

    const response: any = await getProjectGoodsApi(projectCode)

    let data: any = null
    if (response?.data?.data) {
      data = response.data.data
    } else if (response?.data) {
      data = response.data
    } else {
      data = response
    }

    if (!data) {
      ElMessage.warning('未找到对应的项目信息，请检查项目编号')
      return
    }

    const productDrawing: string = data.productDrawing || ''
    const productName: string = data.productName || ''
    const customerModelNo: string = data.customerModelNo || ''

    if (!productDrawing && !productName && !customerModelNo) {
      ElMessage.warning('该项目没有可用的“产品图号 / 产品名称 / 客户模号”信息')
      return
    }

    const partNameValue = [productDrawing, productName].filter((v) => v && v.trim()).join(' ')

    // 直接覆盖当前表单中的值
    quotationForm.partName = partNameValue
    quotationForm.moldNo = customerModelNo

    ElMessage.success('已根据项目编号代入：加工零件名称、模具编号')
    projectImportDialogVisible.value = false
  } catch (error) {
    console.error('按项目代入失败:', error)
    ElMessage.error('按项目代入失败')
  } finally {
    importingProject.value = false
  }
}

// 删除
const handleDelete = async (row: QuotationRecord) => {
  try {
    const message = `确定要删除报价单【${row.quotationNo}】吗？\n请输入 Y 确认删除：`
    const { value } = await ElMessageBox.prompt(message, '警告', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
      inputPattern: /^[Yy]$/,
      inputErrorMessage: '请输入 Y 确认删除'
    })

    if (value === 'Y' || value === 'y') {
      const resp = await deleteQuotationApi(row.id)
      const pr: any = resp

      if (pr?.code === 0 || pr?.success === true) {
        ElMessage.success(pr?.message || '删除成功')
        // 重新加载列表，确保与服务器数据一致
        await loadQuotations()
      } else {
        console.error('删除报价单失败，响应数据:', pr)
        ElMessage.error(pr?.message || '删除失败')
      }
    }
  } catch {
    // 用户取消或输入错误
  }
}

// 行双击查看
const handleRowDblClick = (row: QuotationRecord) => {
  handleView(row)
}

// 保存
const handleSubmit = async () => {
  if (!formRef.value) return

  try {
    // 客户名称必填：给出明确提示
    if (!quotationForm.customerName || !quotationForm.customerName.trim()) {
      ElMessage.error('请输入客户名称')
      return
    }

    await formRef.value.validate()

    // 额外校验：加工零件名称为必填项（表格区域未使用 el-form-item）
    if (!quotationForm.partName || !quotationForm.partName.trim()) {
      ElMessage.error('请输入加工零件名称')
      return
    }

    const payload: QuotationFormData = {
      quotationNo: quotationForm.quotationNo?.trim() || '',
      quotationDate: quotationForm.quotationDate || '',
      customerName: quotationForm.customerName?.trim() || '',
      processingDate: quotationForm.processingDate || '',
      changeOrderNo: quotationForm.changeOrderNo?.trim() || '',
      partName: quotationForm.partName?.trim() || '',
      moldNo: quotationForm.moldNo?.trim() || '',
      department: quotationForm.department?.trim() || '',
      applicant: quotationForm.applicant?.trim() || '',
      materials: quotationForm.materials.map((m) => ({ ...m })),
      processes: quotationForm.processes.map((p) => ({ ...p })),
      otherFee: quotationForm.otherFee || 0,
      transportFee: quotationForm.transportFee || 0,
      quantity: quotationForm.quantity || 1
    }

    console.log('准备保存报价单，数据:', JSON.stringify(payload, null, 2))

    if (dialogMode.value === 'create' || quotationForm.id == null) {
      // 创建新报价单
      const response = await createQuotationApi(payload)
      console.log('创建报价单响应:', response)

      // 响应拦截器已经返回了 response.data，所以 response 就是 { code, success, data, message }
      const pr: any = response
      console.log('处理后的响应数据:', pr)

      // 检查响应：code === 0 或 success === true 都表示成功
      if ((pr?.code === 0 || pr?.success === true) && pr?.data?.id) {
        ElMessage.success('新增报价单成功')
        dialogVisible.value = false
        // 重新加载列表
        await loadQuotations()
      } else {
        console.error('创建失败，响应数据:', pr)
        ElMessage.error(pr?.message || '新增报价单失败')
      }
    } else {
      // 更新报价单
      const response = await updateQuotationApi(quotationForm.id, payload)
      console.log('更新报价单响应:', response)

      // 响应拦截器已经返回了 response.data，所以 response 就是 { code, success, message }
      const pr: any = response
      console.log('处理后的响应数据:', pr)

      // 检查响应：code === 0 或 success === true 都表示成功
      if (pr?.code === 0 || pr?.success === true) {
        ElMessage.success('编辑报价单成功')
        dialogVisible.value = false
        // 重新加载列表
        await loadQuotations()
      } else {
        console.error('更新失败，响应数据:', pr)
        ElMessage.error(pr?.message || '编辑报价单失败')
      }
    }
  } catch (error: any) {
    console.error('保存报价单失败:', error)
    console.error('错误响应数据:', error?.response?.data)
    if (error?.response?.data?.message) {
      ElMessage.error(error.response.data.message)
    } else if (error?.message) {
      ElMessage.error(error.message)
    } else {
      ElMessage.error('保存报价单失败')
    }
  }
}

// 分页
const handleSizeChange = (size: number) => {
  pagination.pageSize = size
  pagination.page = 1
  loadQuotations()
}

const handleCurrentChange = (page: number) => {
  pagination.page = page
  loadQuotations()
}

// 监听移动端状态变化，自动切换视图模式
watch(isMobile, (mobile) => {
  if (mobile) {
    viewMode.value = 'card'
  } else {
    viewMode.value = 'table'
  }
})

// 监听项目编号关键字，输入后自动触发（防抖）查询，仅在分类为「塑胶模具」的项目中模糊搜索
watch(
  projectSearchKeyword,
  (val) => {
    if (projectSearchDebounceTimer) {
      clearTimeout(projectSearchDebounceTimer)
      projectSearchDebounceTimer = null
    }

    const keyword = (val || '').trim()
    if (!keyword) {
      projectSearchResults.value = []
      return
    }

    projectSearchDebounceTimer = setTimeout(() => {
      searchProjectsForImport()
    }, 300)
  },
  { flush: 'post' }
)

// 页面加载时获取数据
onMounted(() => {
  loadQuotations()
  fetchCustomerList()
})
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
    overflow: auto;
    -webkit-overflow-scrolling: touch;
  }

  :deep(.qt-edit-dialog .el-dialog__header),
  :deep(.qt-edit-dialog .el-dialog__footer) {
    padding-inline: 8px;
  }

  /* 手机端表格容器可滚动 */
  .quotation-sheet {
    width: 100%;
    overflow: auto;
    -webkit-overflow-scrolling: touch;
  }

  /* 确保表格可以横向滚动 */
  .qs-table {
    min-width: 800px;
  }
}

@media (width <= 768px) {
  .quotation-top-fields {
    flex-direction: column;
    gap: 12px;
  }

  .quotation-top-field--inline {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }

  .field-input-inline {
    width: 100% !important;
  }

  .query-form__actions {
    margin-top: 8px;
  }
}

@media (width <= 768px) {
  .qt-mobile-card__meta {
    grid-template-columns: repeat(1, minmax(0, 1fr));
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

.mobile-top-bar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.view-mode-switch {
  display: flex;
  align-items: center;
  gap: 8px;
}

.view-mode-switch__label {
  font-size: 13px;
  color: #606266;
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

/* 手机端卡片视图样式 */
.qt-mobile-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.qt-mobile-card {
  border-radius: 10px;
}

.qt-mobile-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.qt-mobile-card__quotation-no {
  font-size: 14px;
  font-weight: 600;
}

.qt-mobile-card__date {
  margin-top: 2px;
  font-size: 13px;
  color: #666;
}

.qt-mobile-card__customer {
  font-size: 13px;
  color: #666;
}

.qt-mobile-card__meta {
  display: grid;
  margin-top: 8px;
  font-size: 13px;
  color: #555;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px 12px;
}

.qt-mobile-card__meta .label {
  margin-right: 4px;
  color: #888;
}

.qt-mobile-card__stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin: 8px 0;
}

.qt-mobile-card__stats .stat {
  padding: 8px 10px;
  background-color: #f6f7fb;
  border-radius: 8px;
}

.stat-label {
  font-size: 12px;
  color: #888;
}

.stat-value {
  margin-top: 4px;
  font-size: 16px;
  font-weight: 600;
}

.qt-mobile-card__actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 12px;
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

/* 报价单顶部字段样式 */
.quotation-top-fields {
  display: flex;
  padding: 0 12px 12px;
  margin-top: -8px;
  margin-bottom: 8px;
  background-color: var(--el-bg-color-overlay);
  border-radius: 4px;
  align-items: flex-start;
  gap: 16px;
}

.quotation-top-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.quotation-top-field {
  position: relative;
  margin-bottom: 0;
  flex: 1;
}

.quotation-top-field .field-label {
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 500;
  color: #606266;
}

:deep(.quotation-top-field .el-form-item__content) {
  margin-left: 0 !important;
}

/* 内联字段样式 */
.quotation-top-field--inline {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
}

.quotation-top-field--inline :deep(.el-form-item__content) {
  width: auto;
  margin-left: 0 !important;
  flex: 0 0 auto;
}

.field-label-inline {
  margin-left: 10px;
  font-size: 13px;
  font-weight: 500;
  color: #606266;
  white-space: nowrap;
}

.field-required {
  position: absolute;
  left: 0;
  margin-right: 2px;
  color: var(--el-color-danger);
}

/* .field-input-inline 默认样式，具体宽度由子类定义 */

/* 报价单号输入框宽度 */
.field-input-inline.field-input-quotation-no {
  width: 140px !important;
  flex: 0 0 140px !important;
}

.field-input-inline.field-input-quotation-no :deep(.el-input__wrapper),
.field-input-inline.field-input-quotation-no :deep(.el-input) {
  width: 140px !important;
}

/* 报价日期选择器宽度 */
.field-input-inline.field-input-quotation-date {
  width: 140px !important;
  max-width: 140px !important;
  min-width: 140px !important;
  flex: 0 0 140px !important;
}

.field-input-inline.field-input-quotation-date :deep(.el-input__wrapper) {
  width: 140px !important;
  max-width: 140px !important;
  min-width: 140px !important;
}

.field-input-inline.field-input-quotation-date :deep(.el-input__inner) {
  width: 140px !important;
}

.field-input-inline.field-input-quotation-date :deep(.el-input) {
  width: 140px !important;
  max-width: 140px !important;
  min-width: 140px !important;
}

/* 客户名称选择框宽度 */
.field-input-inline.field-input-customer-name {
  width: 240px !important;
  flex: 0 0 240px !important;
}

.field-input-inline.field-input-customer-name :deep(.el-input__wrapper),
.field-input-inline.field-input-customer-name :deep(.el-input) {
  width: 240px !important;
}

/* 报价单弹窗样式 */
.quotation-sheet {
  margin-top: -8px;
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

/* 单位材料费 / 加工费用明细行：行高略微减小 */
.qs-row-material td,
.qs-row-process td {
  padding-top: 2px;
  padding-bottom: 2px;
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
  max-height: none;
  margin-top: 0;
}

:deep(.qt-edit-dialog .el-dialog__body) {
  position: relative;
  padding: 0 12px 12px;
  overflow-y: visible;
}

:deep(.qt-edit-dialog .el-dialog__header) {
  height: 0;
  min-height: 0;
  padding: 0;
  margin-bottom: 0;
  overflow: hidden;
  border-bottom: none;
}

.qt-dialog-header {
  display: none;
}

.qt-dialog-header__title {
  font-weight: 600;
  text-align: center;
  flex: 1 1 auto;
}

/* 操作按钮区域 - 与输入框同一行 */
.qt-dialog-actions {
  display: flex;
  padding: 0;
  margin-left: auto;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
}

:deep(.qt-edit-dialog .el-dialog__headerbtn) {
  position: static;
  margin-left: 8px;
}

/* 项目代入对话框样式 */
.project-import-dialog {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.project-import-search-input {
  max-width: 400px;
}

.project-import-table {
  margin-top: 4px;
}

.project-import-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}

.project-import-empty {
  margin-top: 8px;
  font-size: 13px;
  color: #999;
}

.project-import-tip {
  margin-top: 8px;
  font-size: 12px;
  color: #888;
}
</style>
