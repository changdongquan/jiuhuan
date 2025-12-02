<template>
  <div class="supplier-info-page p-4 space-y-4">
    <div v-if="isMobile" class="mobile-top-bar">
      <el-button text type="primary" @click="showMobileFilters = !showMobileFilters">
        {{ showMobileFilters ? '收起筛选' : '展开筛选' }}
      </el-button>
      <div class="view-mode-switch">
        <span class="view-mode-switch__label">视图</span>
        <el-radio-group v-model="viewMode" size="small">
          <el-radio-button value="card">卡片</el-radio-button>
          <el-radio-button value="table">表格</el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <el-form
      ref="queryFormRef"
      :model="queryForm"
      :label-width="isMobile ? 'auto' : '90px'"
      :label-position="isMobile ? 'top' : 'right'"
      :inline="!isMobile"
      class="query-form rounded-lg bg-[var(--el-bg-color-overlay)] p-4 shadow-sm"
      :class="{ 'query-form--mobile': isMobile }"
      v-show="!isMobile || showMobileFilters"
    >
      <el-form-item label="供方名称">
        <el-input v-model="queryForm.supplierName" placeholder="请输入供方名称" clearable />
      </el-form-item>
      <el-form-item label="分类">
        <el-select v-model="queryForm.category" placeholder="请选择" clearable>
          <el-option
            v-for="item in categoryOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="供方状态">
        <el-select v-model="queryForm.status" placeholder="请选择" clearable>
          <el-option label="启用" value="active" />
          <el-option label="暂停" value="suspended" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="handleReset">重置</el-button>
        <el-button type="success" @click="handleCreate">新增</el-button>
      </el-form-item>
    </el-form>

    <!-- 数据卡片（手机端） -->
    <div v-if="isMobile && viewMode === 'card' && tableData.length" class="si-mobile-list">
      <el-card v-for="item in tableData" :key="item.供方ID" class="si-mobile-card" shadow="hover">
        <div class="si-mobile-card__header">
          <div>
            <div class="si-mobile-card__name">{{ item.供方名称 }}</div>
            <div class="si-mobile-card__contact">{{ item.联系人 || '-' }}</div>
          </div>
          <div>
            <el-tag size="small" :type="levelTagType[item.供方等级]">{{ item.供方等级 }}</el-tag>
            <el-tag size="small" :type="categoryTagType[item.分类]" style="margin-left: 4px">
              {{ item.分类 }}
            </el-tag>
          </div>
        </div>
        <div class="si-mobile-card__meta">
          <div>
            <span class="label">联系电话</span>
            <span class="value">{{ item.联系电话 || '-' }}</span>
          </div>
          <div>
            <span class="label">所在地区</span>
            <span class="value">{{ item.所在地区 || '-' }}</span>
          </div>
          <div>
            <span class="label">供方状态</span>
            <el-tag size="small" :type="statusTagMap[item.供方状态].type">
              {{ statusTagMap[item.供方状态].label }}
            </el-tag>
          </div>
        </div>
        <div class="si-mobile-card__actions">
          <el-button size="small" type="primary" @click="handleEdit(item)">编辑</el-button>
          <el-button size="small" type="danger" @click="handleDelete(item)">删除</el-button>
        </div>
      </el-card>
    </div>

    <template v-if="tableData.length">
      <div
        v-if="!isMobile || viewMode === 'table'"
        class="si-table-wrapper"
        :class="{ 'si-table-wrapper--mobile': isMobile }"
      >
        <el-table
          :data="tableData"
          border
          :height="isMobile ? undefined : 'calc(100vh - 320px)'"
          row-key="供方ID"
          @row-dblclick="handleRowDblClick"
          v-loading="loading"
          class="si-table"
        >
          <el-table-column prop="供方ID" label="供方ID" width="80" />
          <el-table-column prop="供方名称" label="供方名称" min-width="180" />
          <el-table-column prop="供方等级" label="供方等级" width="120" align="center">
            <template #default="{ row }">
              <el-tag :type="levelTagType[row.供方等级]">{{ row.供方等级 }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="分类" label="分类" width="120" align="center">
            <template #default="{ row }">
              <el-tag :type="categoryTagType[row.分类]">{{ row.分类 }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="联系人" label="联系人" width="140" />
          <el-table-column prop="联系电话" label="联系电话" width="160" />
          <el-table-column prop="所在地区" label="所在地区" min-width="160" />
          <el-table-column label="供方状态" width="120" align="center">
            <template #default="{ row }">
              <el-tag :type="statusTagMap[row.供方状态].type">{{
                statusTagMap[row.供方状态].label
              }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="160" fixed="right">
            <template #default="{ row }">
              <el-button type="primary" link @click="handleEdit(row)">编辑</el-button>
              <el-button type="danger" link @click="handleDelete(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <div
        class="pagination-footer"
        :class="{ 'pagination-footer--mobile': isMobile || viewMode === 'card' }"
      >
        <el-pagination
          background
          :layout="paginationLayout"
          :pager-count="paginationPagerCount"
          :current-page="pagination.page"
          :page-size="pagination.size"
          :page-sizes="[10, 20, 30, 50]"
          :total="total"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </template>
    <el-empty
      v-else
      description="暂无供方数据"
      class="rounded-lg bg-[var(--el-bg-color-overlay)] py-16"
      :image-size="180"
    />

    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="1200px"
      :close-on-click-modal="false"
      @closed="handleDialogClosed"
    >
      <el-form ref="dialogFormRef" :model="dialogForm" :rules="dialogRules" label-width="100px">
        <el-row :gutter="16">
          <el-col :xs="24" :md="12">
            <el-form-item label="供方名称" prop="供方名称">
              <el-input v-model="dialogForm.供方名称" placeholder="请输入供方名称" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="12">
            <el-form-item label="分类" prop="分类">
              <el-select v-model="dialogForm.分类" placeholder="请选择分类">
                <el-option
                  v-for="item in categoryOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="12">
            <el-form-item label="供方等级" prop="供方等级">
              <el-select v-model="dialogForm.供方等级" placeholder="请选择供方等级">
                <el-option
                  v-for="item in levelOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="12">
            <el-form-item label="供方状态" prop="供方状态">
              <el-select v-model="dialogForm.供方状态" placeholder="请选择供方状态">
                <el-option label="启用" value="active" />
                <el-option label="暂停" value="suspended" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="12">
            <el-form-item label="联系人" prop="联系人">
              <el-input v-model="dialogForm.联系人" placeholder="请输入联系人" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="12">
            <el-form-item label="联系电话" prop="联系电话">
              <el-input v-model="dialogForm.联系电话" placeholder="请输入联系电话" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="12">
            <el-form-item label="电子邮箱" prop="电子邮箱">
              <el-input v-model="dialogForm.电子邮箱" placeholder="请输入邮箱" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="12">
            <el-form-item label="所在地区" prop="所在地区">
              <el-input v-model="dialogForm.所在地区" placeholder="请输入所在地区" />
            </el-form-item>
          </el-col>
          <el-col :xs="24">
            <el-form-item label="详细地址" prop="详细地址">
              <el-input v-model="dialogForm.详细地址" placeholder="请输入详细地址" />
            </el-form-item>
          </el-col>
          <el-col :xs="24">
            <el-form-item label="备注">
              <el-input
                v-model="dialogForm.备注信息"
                type="textarea"
                :rows="2"
                placeholder="可记录合作背景、特殊条款等"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 银行信息 -->
        <el-divider content-position="left" />
        <el-row :gutter="16">
          <el-col :xs="24" :md="12">
            <el-form-item label="纳税人识别号" prop="纳税人识别号">
              <el-input v-model="dialogForm.纳税人识别号" placeholder="请输入纳税人识别号" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="12">
            <el-form-item label="开户银行" prop="开户银行">
              <el-input v-model="dialogForm.开户银行" placeholder="请输入开户银行" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="12">
            <el-form-item label="银行账号" prop="银行账号">
              <el-input v-model="dialogForm.银行账号" placeholder="请输入银行账号" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="12">
            <el-form-item label="银行行号" prop="银行行号">
              <el-input v-model="dialogForm.银行行号" placeholder="请输入银行行号" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="dialogSubmitting" @click="submitDialogForm"
          >保存</el-button
        >
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import {
  ElButton,
  ElCard,
  ElCol,
  ElDialog,
  ElDivider,
  ElEmpty,
  ElForm,
  ElFormItem,
  ElInput,
  ElOption,
  ElPagination,
  ElRow,
  ElSelect,
  ElTable,
  ElTableColumn,
  ElTag
} from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { nextTick, reactive, ref, onMounted, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getSupplierList,
  getSupplierDetail,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getSupplierStatistics,
  type Supplier,
  type SupplierQuery,
  type SupplierCreate,
  type SupplierUpdate
} from '@/api/supplier'
import { useAppStore } from '@/store/modules/app'

type SupplierLevel = 'A' | 'B' | 'C'
type SupplierStatus = 'active' | 'suspended'
type SupplierCategory = '原料' | '配件' | '设备' | '外协' | '服务'

interface SupplierTableRow extends Supplier {
  // 保留结构，后续扩展表格专用字段
  _placeholder?: never
}

type SupplierPayload = Omit<Supplier, '供方ID'>

const levelOptions = [
  { label: 'A', value: 'A' as SupplierLevel },
  { label: 'B', value: 'B' as SupplierLevel },
  { label: 'C', value: 'C' as SupplierLevel }
]

const categoryOptions = [
  { label: '原料', value: '原料' as SupplierCategory },
  { label: '配件', value: '配件' as SupplierCategory },
  { label: '设备', value: '设备' as SupplierCategory },
  { label: '外协', value: '外协' as SupplierCategory },
  { label: '服务', value: '服务' as SupplierCategory }
]

const levelTagType: Record<SupplierLevel, 'success' | 'warning' | 'info'> = {
  A: 'success',
  B: 'warning',
  C: 'info'
}

const statusTagMap: Record<SupplierStatus, { label: string; type: 'success' | 'info' }> = {
  active: { label: '启用', type: 'success' },
  suspended: { label: '暂停', type: 'info' }
}

const categoryTagType: Record<
  SupplierCategory,
  'primary' | 'success' | 'warning' | 'danger' | 'info'
> = {
  原料: 'primary',
  配件: 'success',
  设备: 'warning',
  外协: 'danger',
  服务: 'info'
}

const appStore = useAppStore()
const isMobile = computed(() => appStore.getMobile)
const showMobileFilters = ref(false)
type ViewMode = 'table' | 'card'
const viewMode = ref<ViewMode>(isMobile.value ? 'card' : 'table')

watch(isMobile, (mobile) => {
  viewMode.value = mobile ? 'card' : 'table'
})

// 分页组件布局：PC 端保留完整布局，手机端精简，避免内容被遮挡
const paginationLayout = computed(() =>
  isMobile.value || viewMode.value === 'card'
    ? 'total, prev, pager, next'
    : 'total, sizes, prev, pager, next, jumper'
)

// 分页组件页码数量：手机端减少显示的数字页数，避免横向挤压
const paginationPagerCount = computed(() => (isMobile.value || viewMode.value === 'card' ? 5 : 7))

const queryFormRef = ref<FormInstance>()
const queryForm = reactive<SupplierQuery>({
  supplierName: '',
  category: '',
  status: ''
})

const pagination = reactive({
  page: 1,
  size: 20
})

const dialogVisible = ref(false)
const dialogTitle = ref('')
const dialogSubmitting = ref(false)
const dialogFormRef = ref<FormInstance>()
const currentSupplierId = ref<number | null>(null)
const loading = ref(false)

const dialogRules: FormRules<SupplierPayload> = {
  供方名称: [{ required: true, message: '请输入供方名称', trigger: 'blur' }],
  分类: [{ required: true, message: '请选择分类', trigger: 'change' }],
  联系人: [{ required: true, message: '请输入联系人', trigger: 'blur' }],
  联系电话: [
    { required: true, message: '请输入联系电话', trigger: 'blur' },
    { pattern: /^\d{3,20}$/, message: '请输入正确的电话格式', trigger: 'blur' }
  ],
  纳税人识别号: [
    { pattern: /^[0-9A-Z]{15,20}$/, message: '纳税人识别号格式不正确', trigger: 'blur' }
  ],
  银行账号: [{ pattern: /^\d{16,19}$/, message: '银行账号格式不正确', trigger: 'blur' }],
  银行行号: [{ pattern: /^\d{12}$/, message: '银行行号格式不正确', trigger: 'blur' }]
}

const dialogForm = reactive<SupplierPayload>(createEmptySupplier())
const tableData = ref<SupplierTableRow[]>([])
const total = ref(0)
const summary = reactive({
  totalSuppliers: 0,
  activeSuppliers: 0,
  materialSuppliers: 0,
  partsSuppliers: 0,
  equipmentSuppliers: 0,
  outsourcingSuppliers: 0,
  serviceSuppliers: 0
})

// 加载数据
const loadData = async () => {
  try {
    loading.value = true
    const params: SupplierQuery = {
      page: pagination.page,
      size: pagination.size,
      supplierName: queryForm.supplierName,
      category: queryForm.category,
      status: queryForm.status
    }

    const response = (await getSupplierList(params)) as any
    console.log('API响应:', response) // 调试日志

    if (response && response.code === 200) {
      tableData.value = response.data.list
      total.value = response.data.total
    } else {
      ElMessage.error(response?.message || '查询失败')
    }
  } catch (error) {
    console.error('加载数据失败:', error)
    ElMessage.error('查询失败')
  } finally {
    loading.value = false
  }
}

// 加载统计信息
const loadStatistics = async () => {
  try {
    const response = (await getSupplierStatistics()) as any
    console.log('统计API响应:', response) // 调试日志

    if (response && response.code === 200) {
      Object.assign(summary, response.data)
    }
  } catch (error) {
    console.error('加载统计信息失败:', error)
  }
}

const handleSearch = () => {
  pagination.page = 1
  loadData()
}

const handleReset = () => {
  queryForm.supplierName = ''
  queryForm.category = ''
  queryForm.status = ''
  pagination.page = 1
  loadData()
}

const handleSizeChange = (size: number) => {
  pagination.size = size
  pagination.page = 1
  loadData()
}

const handleCurrentChange = (page: number) => {
  pagination.page = page
  loadData()
}

const handleCreate = async () => {
  dialogTitle.value = '新增供方'
  currentSupplierId.value = null
  assignDialogForm(createEmptySupplier())
  dialogVisible.value = true
  await nextTick()
  dialogFormRef.value?.clearValidate()
}

const handleRowDblClick = (row: SupplierTableRow) => {
  void openEditDialog(row.供方ID)
}

const handleEdit = (row: SupplierTableRow) => {
  void openEditDialog(row.供方ID)
}

const openEditDialog = async (id: number) => {
  try {
    const response = (await getSupplierDetail(id)) as any
    if (response.code === 200) {
      dialogTitle.value = '编辑供方'
      currentSupplierId.value = id
      assignDialogForm(response.data)
      dialogVisible.value = true
      await nextTick()
      dialogFormRef.value?.clearValidate()
    } else {
      ElMessage.error(response.message || '获取供方信息失败')
    }
  } catch (error) {
    console.error('获取供方信息失败:', error)
    ElMessage.error('获取供方信息失败')
  }
}

const assignDialogForm = (payload: SupplierPayload) => {
  dialogForm.供方名称 = payload.供方名称
  dialogForm.供方等级 = payload.供方等级
  dialogForm.分类 = payload.分类
  dialogForm.供方状态 = payload.供方状态
  dialogForm.联系人 = payload.联系人
  dialogForm.联系电话 = payload.联系电话
  dialogForm.电子邮箱 = payload.电子邮箱
  dialogForm.所在地区 = payload.所在地区
  dialogForm.详细地址 = payload.详细地址
  dialogForm.备注信息 = payload.备注信息
  dialogForm.纳税人识别号 = payload.纳税人识别号
  dialogForm.开户银行 = payload.开户银行
  dialogForm.银行账号 = payload.银行账号
  dialogForm.银行行号 = payload.银行行号
}

function createEmptySupplier(): SupplierPayload {
  return {
    供方名称: '',
    供方等级: 'A',
    分类: '原料',
    供方状态: 'active',
    联系人: '',
    联系电话: '',
    电子邮箱: '',
    所在地区: '',
    详细地址: '',
    备注信息: '',
    纳税人识别号: '',
    开户银行: '',
    银行账号: '',
    银行行号: ''
  }
}

const submitDialogForm = async () => {
  if (!dialogFormRef.value) return

  try {
    await dialogFormRef.value.validate()
  } catch {
    return
  }

  dialogSubmitting.value = true

  try {
    if (currentSupplierId.value === null) {
      // 新增
      const createData: SupplierCreate = {
        供方名称: dialogForm.供方名称,
        供方等级: dialogForm.供方等级,
        分类: dialogForm.分类,
        供方状态: dialogForm.供方状态,
        联系人: dialogForm.联系人,
        联系电话: dialogForm.联系电话,
        电子邮箱: dialogForm.电子邮箱,
        所在地区: dialogForm.所在地区,
        详细地址: dialogForm.详细地址,
        备注信息: dialogForm.备注信息,
        纳税人识别号: dialogForm.纳税人识别号,
        开户银行: dialogForm.开户银行,
        银行账号: dialogForm.银行账号,
        银行行号: dialogForm.银行行号,
        创建人: 'system'
      }

      const response = (await createSupplier(createData)) as any
      if (response.code === 200) {
        ElMessage.success('新增供方成功')
        dialogVisible.value = false
        pagination.page = 1
        await loadData()
        await loadStatistics()
      } else {
        ElMessage.error(response.message || '新增失败')
      }
    } else {
      // 编辑
      const updateData: SupplierUpdate = {
        供方ID: currentSupplierId.value,
        供方名称: dialogForm.供方名称,
        供方等级: dialogForm.供方等级,
        分类: dialogForm.分类,
        供方状态: dialogForm.供方状态,
        联系人: dialogForm.联系人,
        联系电话: dialogForm.联系电话,
        电子邮箱: dialogForm.电子邮箱,
        所在地区: dialogForm.所在地区,
        详细地址: dialogForm.详细地址,
        备注信息: dialogForm.备注信息,
        纳税人识别号: dialogForm.纳税人识别号,
        开户银行: dialogForm.开户银行,
        银行账号: dialogForm.银行账号,
        银行行号: dialogForm.银行行号,
        更新人: 'system'
      }

      const response = (await updateSupplier(currentSupplierId.value, updateData)) as any
      if (response.code === 200) {
        ElMessage.success('更新供方成功')
        dialogVisible.value = false
        await loadData()
        await loadStatistics()
      } else {
        ElMessage.error(response.message || '更新失败')
      }
    }
  } catch (error) {
    console.error('保存失败:', error)
    ElMessage.error('保存失败')
  } finally {
    dialogSubmitting.value = false
  }
}

const handleDelete = async (row: SupplierTableRow) => {
  try {
    await ElMessageBox.confirm(`确认删除供方 ${row.供方名称} 吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    const response = (await deleteSupplier(row.供方ID)) as any
    if (response.code === 200) {
      ElMessage.success('删除成功')
      await loadData()
      await loadStatistics()
    } else {
      ElMessage.error(response.message || '删除失败')
    }
  } catch (error) {
    if (error === 'cancel' || error === 'close') return
    console.error('删除失败:', error)
    ElMessage.error('删除失败')
  }
}

const handleDialogClosed = () => {
  assignDialogForm(createEmptySupplier())
  currentSupplierId.value = null
  dialogFormRef.value?.clearValidate()
}

// 页面初始化
onMounted(async () => {
  await loadData()
  await loadStatistics()
})
</script>

<style scoped>
/* 查询表单垂直居中对齐 */
.query-form {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

:deep(.query-form .el-form-item) {
  margin-bottom: 0;
}

.summary-card {
  border: none;
  transition: all 0.3s ease;
}

.summary-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgb(0 0 0 / 10%) !important;
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

.summary-title {
  font-size: 14px;
  font-weight: 500;
}

.summary-value {
  margin-top: 8px;
  font-size: 24px;
  font-weight: 600;
  color: var(--el-text-color-primary);
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

.si-table-wrapper {
  background: var(--el-bg-color);
  border-radius: 8px;
}

.si-table-wrapper--mobile {
  padding-bottom: 8px;
  overflow-x: auto;
}

.si-table-wrapper--mobile .si-table {
  min-width: 960px;
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

.mobile-top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-top: 2px;
}

.view-mode-switch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.view-mode-switch__label {
  font-size: 12px;
  color: #666;
}

.si-mobile-list {
  display: grid;
  gap: 12px;
}

.si-mobile-card {
  border-radius: 10px;
}

.si-mobile-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.si-mobile-card__name {
  font-size: 14px;
  font-weight: 600;
}

.si-mobile-card__contact {
  margin-top: 2px;
  font-size: 13px;
  color: #666;
}

.si-mobile-card__meta {
  display: grid;
  font-size: 13px;
  color: #555;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px 12px;
}

.si-mobile-card__meta .label {
  margin-right: 4px;
  color: #888;
}

.si-mobile-card__actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 6px;
}
</style>
