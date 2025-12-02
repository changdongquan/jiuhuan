<template>
  <div class="project-info-page p-4 space-y-4">
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

    <!-- 搜索表单 -->
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
          placeholder="请输入项目编号/产品名称/产品图号"
          clearable
          :style="{ width: isMobile ? '100%' : '280px' }"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item label="分类">
        <el-select
          v-model="queryForm.category"
          placeholder="请选择分类"
          clearable
          :style="{ width: isMobile ? '100%' : '150px' }"
        >
          <el-option label="塑胶模具" value="塑胶模具" />
          <el-option label="零件加工" value="零件加工" />
          <el-option label="修改模具" value="修改模具" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="handleQuery">查询</el-button>
        <el-button @click="handleReset">重置</el-button>
        <el-button type="success" @click="handleAdd">新增项目</el-button>
      </el-form-item>
    </el-form>

    <!-- 数据卡片（手机端） -->
    <div v-if="isMobile && viewMode === 'card' && tableData.length" class="pi-mobile-list">
      <el-card
        v-for="item in tableData"
        :key="item.id || item.projectCode"
        class="pi-mobile-card"
        shadow="hover"
      >
        <div class="pi-mobile-card__header">
          <div>
            <div class="pi-mobile-card__code">{{ item.projectCode }}</div>
            <div class="pi-mobile-card__name">{{ item.productName }}</div>
          </div>
          <el-tag size="small" :type="getCategoryTagType(item.category)">
            {{ item.category }}
          </el-tag>
        </div>
        <div class="pi-mobile-card__meta">
          <div>
            <span class="label">客户</span>
            <span class="value">{{ item.customerName || '-' }}</span>
          </div>
          <div>
            <span class="label">客户模号</span>
            <span class="value">{{ item.customerModelNo || '-' }}</span>
          </div>
          <div>
            <span class="label">产品图号</span>
            <span class="value">{{ item.productDrawing || '-' }}</span>
          </div>
        </div>
        <div v-if="item.remarks" class="pi-mobile-card__remarks">
          <span class="label">备注</span>
          <span class="value">{{ item.remarks }}</span>
        </div>
        <div class="pi-mobile-card__actions">
          <el-button size="small" type="primary" @click="handleView(item)">查看</el-button>
          <el-button size="small" @click="handleEdit(item)">编辑</el-button>
          <el-button size="small" type="danger" @click="handleDelete(item)">删除</el-button>
        </div>
      </el-card>
    </div>

    <!-- 数据表格 -->
    <template v-if="tableData.length">
      <div
        v-if="!isMobile || viewMode === 'table'"
        class="pi-table-wrapper"
        :class="{ 'pi-table-wrapper--mobile': isMobile }"
      >
        <el-table
          :data="tableData"
          border
          v-loading="loading"
          @row-dblclick="handleRowDoubleClick"
          class="pi-table"
          :height="isMobile ? undefined : 'calc(100vh - 320px)'"
        >
          <el-table-column type="index" label="序号" width="60" align="center" />
          <el-table-column
            prop="projectCode"
            label="项目编号"
            min-width="160"
            show-overflow-tooltip
          />
          <el-table-column
            prop="productName"
            label="产品名称"
            min-width="200"
            show-overflow-tooltip
          />
          <el-table-column
            prop="productDrawing"
            label="产品图号"
            min-width="200"
            show-overflow-tooltip
          />
          <el-table-column
            prop="customerModelNo"
            label="客户模号"
            width="150"
            show-overflow-tooltip
          />
          <el-table-column prop="category" label="分类" width="120">
            <template #default="{ row }">
              <el-tag :type="getCategoryTagType(row.category)">{{ row.category }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column
            prop="customerName"
            label="客户名称"
            min-width="200"
            show-overflow-tooltip
          />
          <el-table-column prop="remarks" label="备注" min-width="150" show-overflow-tooltip />
          <el-table-column label="操作" width="220" align="center" fixed="right">
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
        class="pagination-footer"
        :class="{ 'pagination-footer--mobile': isMobile || viewMode === 'card' }"
      >
        <el-pagination
          background
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[10, 20, 50, 100]"
          :layout="paginationLayout"
          :pager-count="paginationPagerCount"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </template>
    <el-empty
      v-else
      description="暂无项目数据"
      class="rounded-lg bg-[var(--el-bg-color-overlay)] py-16"
      :image-size="180"
    />

    <!-- 查看详情对话框 -->
    <el-dialog
      v-model="viewDialogVisible"
      title="项目详情"
      :width="isMobile ? '100%' : '640px'"
      :fullscreen="isMobile"
      :close-on-click-modal="false"
      class="pi-detail-dialog"
    >
      <div v-if="viewData" class="project-detail">
        <el-descriptions :column="isMobile ? 1 : 2" border>
          <el-descriptions-item label="项目编号">
            {{ viewData.projectCode }}
          </el-descriptions-item>
          <el-descriptions-item label="产品名称">
            {{ viewData.productName }}
          </el-descriptions-item>
          <el-descriptions-item label="产品图号">
            {{ viewData.productDrawing }}
          </el-descriptions-item>
          <el-descriptions-item label="分类">
            <el-tag :type="getCategoryTagType(viewData.category)">
              {{ viewData.category }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="客户名称">
            {{ viewData.customerName || '暂无' }}
          </el-descriptions-item>
          <el-descriptions-item label="客户模号">
            {{ viewData.customerModelNo || '暂无' }}
          </el-descriptions-item>
          <el-descriptions-item label="备注" :span="2">
            {{ viewData.remarks || '暂无' }}
          </el-descriptions-item>
        </el-descriptions>
      </div>
      <template #footer>
        <el-button @click="viewDialogVisible = false">关闭</el-button>
        <el-button type="primary" @click="handleEditFromView">编辑</el-button>
      </template>
    </el-dialog>

    <!-- 新增/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      :width="isMobile ? '100%' : '800px'"
      :fullscreen="isMobile"
      class="pi-edit-dialog"
      @close="handleDialogClose"
      @opened="handleDialogOpened"
    >
      <el-form
        :model="formData"
        :rules="rules"
        ref="formRef"
        :label-width="isMobile ? '90px' : '100px'"
      >
        <!-- 项目编号独立首行 -->
        <el-form-item label="项目编号" prop="projectCode">
          <div class="project-code-input">
            <div class="code-main-row">
              <span class="code-prefix">JH</span>
              <el-select
                ref="projectCodeInputRef"
                v-model="formData.projectCategory"
                placeholder="类别"
                class="code-category"
                @change="onCategoryChange"
              >
                <el-option label="01" value="01" />
                <el-option label="03" value="03" />
                <el-option label="05" value="05" />
              </el-select>
              <span class="code-separator">-</span>
              <el-input
                v-model="formData.projectYear"
                placeholder="年份"
                maxlength="2"
                class="code-year"
                @input="updateProjectCode"
              />
              <span class="code-separator">-</span>
              <el-input
                ref="projectSerialInputRef"
                v-model="formData.projectSerial"
                placeholder="序号"
                maxlength="3"
                class="code-serial"
                @input="updateProjectCode"
                @focus="onSerialFocus"
                @blur="onSerialBlur"
              />
              <span class="code-separator">/</span>
              <el-input
                ref="partNumberInputRef"
                v-model="formData.partNumber"
                placeholder="零件"
                maxlength="2"
                class="code-part"
                @input="updateProjectCode"
              />
              <span class="code-spacer"></span>
            </div>
            <el-tag v-if="formData.projectCategory" type="info" class="category-tag">
              {{ getCategoryName(formData.projectCategory) }}
            </el-tag>
            <div v-if="showSerialTip && maxSerialInfo" class="serial-tip">
              <el-tag type="warning" size="small">
                当前分类最大序号: {{ maxSerialInfo.maxSerial }}，建议使用:
                {{ maxSerialInfo.nextSerial }}
              </el-tag>
            </div>
          </div>
        </el-form-item>

        <el-row :gutter="20">
          <el-col :xs="24" :sm="12">
            <el-form-item label="产品名称" prop="projectName">
              <el-input
                ref="projectNameInputRef"
                v-model="formData.projectName"
                placeholder="请输入产品名称"
              />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="产品图号" prop="projectManager">
              <el-input v-model="formData.projectManager" placeholder="请输入产品图号" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :xs="24" :sm="12">
            <el-form-item label="客户模号" prop="customerModelNo">
              <el-input
                v-model="formData.customerModelNo"
                placeholder="请输入客户模号"
                :disabled="true"
              />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="客户名称" prop="customerName">
              <el-select
                v-model="formData.customerName"
                placeholder="请选择客户名称"
                style="width: 100%"
                filterable
                clearable
                :loading="customerLoading"
              >
                <el-option
                  v-for="customer in customerList"
                  :key="customer.id"
                  :label="customer.customerName"
                  :value="customer.customerName"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="备注" prop="description">
          <el-input
            v-model="formData.description"
            type="textarea"
            :rows="4"
            placeholder="请输入备注"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed, watch } from 'vue'
import {
  getGoodsListApi,
  createGoodsApi,
  updateGoodsApi,
  deleteGoodsApi,
  getMaxSerialApi,
  type GoodsInfo,
  type GoodsQueryParams
} from '@/api/goods'
import { getCustomerListApi, type CustomerInfo } from '@/api/customer'
import { useAppStore } from '@/store/modules/app'
import {
  ElButton,
  ElCard,
  ElCol,
  ElDescriptions,
  ElDescriptionsItem,
  ElDialog,
  ElForm,
  ElFormItem,
  ElInput,
  ElMessage,
  ElMessageBox,
  ElOption,
  ElPagination,
  ElRow,
  ElSelect,
  ElTable,
  ElTableColumn,
  ElTag
} from 'element-plus'

type ViewMode = 'table' | 'card'

const appStore = useAppStore()
const isMobile = computed(() => appStore.getMobile)
const showMobileFilters = ref(true)
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

// 查询表单
const queryForm = reactive({
  keyword: '',
  category: ''
})

// 表格数据
const tableData = ref<GoodsInfo[]>([])
const loading = ref(false)

// 客户列表数据
const customerList = ref<CustomerInfo[]>([])
const customerLoading = ref(false)

// 最大序号提示
const maxSerialInfo = ref<{ maxSerial: number; nextSerial: number } | null>(null)
const showSerialTip = ref(false)

// 分页
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)

// 对话框
const dialogVisible = ref(false)
const dialogTitle = ref('新增项目')
const formRef = ref()
const projectCodeInputRef = ref()
const projectSerialInputRef = ref()
const partNumberInputRef = ref()
const projectNameInputRef = ref()
const editingId = ref<number | null>(null)

// 查看详情对话框
const viewDialogVisible = ref(false)
const viewData = ref<any>(null)

// 表单数据
const formData = reactive({
  projectCode: '',
  projectCategory: '',
  projectYear: '',
  projectSerial: '',
  partNumber: '',
  projectName: '',
  customerModelNo: '',
  customerName: '',
  projectManager: '',
  description: ''
})

// 表单验证规则
const rules = {
  projectCode: [{ required: true, message: '请输入项目编号', trigger: 'blur' }],
  customerName: [{ required: true, message: '请输入客户名称', trigger: 'blur' }]
}

// 获取分类名称
const getCategoryName = (category: string) => {
  const categoryMap: Record<string, string> = {
    '01': '塑胶模具',
    '03': '零件加工',
    '05': '修改模具'
  }
  return categoryMap[category] || ''
}

// 获取分类标签类型
const getCategoryTagType = (
  category: string
): 'primary' | 'success' | 'warning' | 'info' | 'danger' => {
  const typeMap: Record<string, 'primary' | 'success' | 'warning' | 'info' | 'danger'> = {
    塑胶模具: 'primary',
    零件加工: 'success',
    修改模具: 'warning'
  }
  return typeMap[category] || 'info'
}

// 生成项目编号
const updateProjectCode = () => {
  const { projectCategory, projectYear, projectSerial, partNumber } = formData

  if (!projectCategory || !projectYear || !projectSerial) {
    formData.projectCode = ''
    return
  }

  const trimmedPart = (partNumber || '').trim()

  // 格式化年份（确保是2位数）
  const yearStr = projectYear.padStart(2, '0')

  // 格式化序号（确保是3位数）
  const serialStr = projectSerial.padStart(3, '0')

  // 基础编号格式：JH0X-YY-SSS
  let code = `JH${projectCategory}-${yearStr}-${serialStr}`

  // 只要有零件号，不论分类，统一追加“/零件”
  if (trimmedPart) {
    const partStr = trimmedPart.padStart(2, '0')
    code += `/${partStr}`
  }

  formData.projectCode = code
}

// 类别选择变化时聚焦到序号输入框
const onCategoryChange = () => {
  updateProjectCode()
  setTimeout(() => {
    projectSerialInputRef.value?.focus()
  }, 100)
}

// 序号输入框聚焦时获取最大序号
const onSerialFocus = () => {
  if (formData.projectCategory) {
    fetchMaxSerial(formData.projectCategory)
  }
}

// 序号输入框失焦时聚焦到产品名称或零件号
const onSerialBlur = () => {
  showSerialTip.value = false
  if (formData.projectCategory === '03' || formData.projectCategory === '01') {
    // 如果是零件加工或塑胶模具，聚焦到零件号输入框
    setTimeout(() => {
      partNumberInputRef.value?.focus()
    }, 100)
  } else {
    // 其他情况聚焦到产品名称
    setTimeout(() => {
      projectNameInputRef.value?.focus()
    }, 100)
  }
}

// 获取数据列表
const fetchData = async () => {
  try {
    loading.value = true
    const params: GoodsQueryParams = {
      keyword: queryForm.keyword || undefined,
      category: queryForm.category || undefined,
      page: currentPage.value,
      pageSize: pageSize.value
    }

    const response = await getGoodsListApi(params)

    if (response && response.data) {
      tableData.value = response.data.list
      total.value = response.data.total
    } else {
      ElMessage.error('获取数据失败')
    }
  } catch (error) {
    console.error('获取数据失败:', error)
    ElMessage.error('获取数据失败')
  } finally {
    loading.value = false
  }
}

// 获取客户列表（仅获取未停用的客户，按 seqNumber 排序）
const fetchCustomerList = async () => {
  try {
    customerLoading.value = true
    const response = await getCustomerListApi({
      status: 'active',
      page: 1,
      pageSize: 10000 // 设置一个足够大的数值以获取所有未停用的客户
    })

    if (response && response.data && response.data.list) {
      // 后端已经按 SeqNumber ASC 排序，直接使用
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

// 获取最大序号
const fetchMaxSerial = async (category: string) => {
  try {
    const response = await getMaxSerialApi(category)

    if (response && response.data) {
      maxSerialInfo.value = response.data
      showSerialTip.value = true
    } else {
      ElMessage.error('获取最大序号失败')
    }
  } catch (error) {
    console.error('获取最大序号失败:', error)
    ElMessage.error('获取最大序号失败')
  }
}

// 查询
const handleQuery = () => {
  currentPage.value = 1
  fetchData()
}

// 重置
const handleReset = () => {
  queryForm.keyword = ''
  queryForm.category = ''
  currentPage.value = 1
  fetchData()
}

// 新增
const handleAdd = async () => {
  editingId.value = null
  dialogTitle.value = '新增项目'

  // 清空所有表单字段
  formData.projectCode = ''
  formData.projectCategory = ''
  formData.projectSerial = ''
  formData.partNumber = ''
  formData.projectName = ''
  formData.customerModelNo = ''
  formData.customerName = ''
  formData.projectManager = ''
  formData.description = ''

  // 设置默认年份为当前年份的后两位
  const currentYear = new Date().getFullYear()
  formData.projectYear = String(currentYear).slice(-2)

  // 清空序号提示
  showSerialTip.value = false
  maxSerialInfo.value = null

  // 获取客户列表
  await fetchCustomerList()

  dialogVisible.value = true
}

// 编辑
const handleEdit = async (row: any) => {
  editingId.value = row.id
  dialogTitle.value = '编辑项目'

  // 映射数据库字段到表单字段
  formData.projectCode = row.projectCode
  formData.projectName = row.productName
  formData.projectManager = row.productDrawing
  formData.customerName = row.customerName
  formData.customerModelNo = row.customerModelNo
  formData.description = row.remarks

  // 解析项目编号
  if (row.projectCode) {
    const match = row.projectCode.match(/JH(\d{2})-(\d{2})-(\d{3})(\/(\d{2}))?/)
    if (match) {
      formData.projectCategory = match[1]
      formData.projectYear = match[2]
      formData.projectSerial = match[3]
      formData.partNumber = match[5] || ''
    }
  }

  // 获取客户列表
  await fetchCustomerList()

  dialogVisible.value = true
}

// 查看
const handleView = (row: any) => {
  viewData.value = row
  viewDialogVisible.value = true
}

// 从查看弹窗跳转到编辑
const handleEditFromView = async () => {
  if (viewData.value) {
    viewDialogVisible.value = false
    await handleEdit(viewData.value)
  }
}

// 双击行事件
const handleRowDoubleClick = async (row: any) => {
  await handleEdit(row)
}

// 删除
const handleDelete = async (row: any) => {
  try {
    // 第一步：显示确认对话框，要求输入 Y
    // 将提示信息分成两行，确保"请输入 Y 确认删除"始终在第二行
    const message = `<div style="line-height: 1.8;">
      <div>确定要删除项目"${row.productName}"吗？</div>
      <div style="margin-top: 8px;">请输入 "Y" 确认删除：</div>
    </div>`

    const { value } = await ElMessageBox.prompt(message, '警告', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
      inputPattern: /^[Yy]$/,
      inputErrorMessage: '请输入字母 Y 才能确认删除',
      dangerouslyUseHTMLString: true
    })

    // 如果用户输入了 Y（不区分大小写），执行删除
    if (value && value.toUpperCase() === 'Y') {
      await deleteGoodsApi(row.id)
      ElMessage.success('删除成功')
      // 刷新数据列表
      await fetchData()
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除失败:', error)
      ElMessage.error('删除失败')
    }
    // 用户取消操作时不显示错误
  }
}

// 提交表单
const handleSubmit = async () => {
  try {
    await formRef.value.validate()

    const goodsData = {
      projectCode: formData.projectCode,
      productDrawing: formData.projectManager,
      productName: formData.projectName,
      category:
        formData.projectCategory === '01'
          ? '塑胶模具'
          : formData.projectCategory === '03'
            ? '零件加工'
            : '修改模具',
      remarks: formData.description,
      customerName: formData.customerName,
      customerModelNo: formData.customerModelNo
    }

    if (editingId.value) {
      // 编辑模式
      await updateGoodsApi(editingId.value, goodsData)
      ElMessage.success('编辑项目成功')
    } else {
      // 新增模式
      await createGoodsApi(goodsData)
      ElMessage.success('新增项目成功')
    }

    dialogVisible.value = false
    // 刷新数据列表
    await fetchData()
  } catch (error: any) {
    // 错误消息已由 axios 拦截器处理并显示
  }
}

// 关闭对话框
const handleDialogClose = () => {
  formRef.value?.resetFields()
  // 重置项目编号相关字段
  formData.projectCategory = ''
  formData.projectYear = ''
  formData.projectSerial = ''
  formData.partNumber = ''
  formData.projectCode = ''
  editingId.value = null
}

// 对话框打开后自动聚焦
const handleDialogOpened = () => {
  projectCodeInputRef.value?.focus()
}

// 分页
const handleSizeChange = (val: number) => {
  pageSize.value = val
  currentPage.value = 1
  fetchData()
}

const handleCurrentChange = (val: number) => {
  currentPage.value = val
  fetchData()
}

// 页面加载时获取数据
onMounted(() => {
  fetchData()
  fetchCustomerList()
})
</script>

<style scoped>
.project-code-input {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

.code-main-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: nowrap;
  width: 100%;
}

.code-spacer {
  flex: 1 1 auto;
  min-width: 8px;
}

.code-prefix {
  font-size: 14px;
  font-weight: 500;
  color: #606266;
  white-space: nowrap;
}

.code-separator {
  font-size: 16px;
  font-weight: 500;
  color: #909399;
  white-space: nowrap;
}

.code-category {
  width: 120px;
}

.code-year {
  width: 54px;
}

.code-serial {
  width: 54px;
}

.code-part {
  width: 54px;
}

@media (width <= 768px) {
  /* 手机端：项目编号输入框宽度 */
  .code-category {
    width: 60px;
  }

  .code-year {
    width: 40px;
  }

  .code-serial {
    width: 50px;
  }

  .code-part {
    width: 50px;
  }

  .project-code-input {
    width: 100%;
    overflow-x: auto;
  }

  .code-main-row {
    min-width: 360px;
  }
}

.category-tag {
  margin-left: 12px;
}

.serial-tip {
  margin-top: 8px;
  margin-left: 8px;
}

.project-info-page {
  position: relative;
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

.pi-table-wrapper {
  background: var(--el-bg-color);
  border-radius: 8px;
}

.pi-table-wrapper--mobile {
  padding-bottom: 8px;
  overflow-x: auto;
}

.pi-table-wrapper--mobile .pi-table {
  min-width: 960px;
}

.operation-buttons {
  display: flex;
  gap: 4px;
  padding: 0 8px;
  justify-content: center;
}

.pi-mobile-list {
  display: grid;
  gap: 12px;
}

.pi-mobile-card {
  border-radius: 10px;
}

.pi-mobile-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.pi-mobile-card__code {
  font-size: 14px;
  font-weight: 600;
}

.pi-mobile-card__name {
  margin-top: 2px;
  font-size: 13px;
  color: #666;
}

.pi-mobile-card__meta {
  display: grid;
  font-size: 13px;
  color: #555;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px 12px;
}

.pi-mobile-card__meta .label {
  margin-right: 4px;
  color: #888;
}

.pi-mobile-card__remarks {
  margin: 6px 0;
  font-size: 13px;
  color: #555;
}

.pi-mobile-card__remarks .label {
  margin-right: 6px;
  color: #888;
}

.pi-mobile-card__actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 6px;
}

@media (width <= 768px) {
  :deep(.pi-detail-dialog .el-dialog__body) {
    padding: 8px 8px 12px;
  }

  :deep(.pi-edit-dialog) {
    width: 100% !important;
    max-width: 100% !important;
    margin: 0 !important;
  }

  :deep(.pi-edit-dialog .el-dialog__body) {
    padding: 8px 8px 12px;
  }

  :deep(.pi-edit-dialog .el-dialog__header),
  :deep(.pi-edit-dialog .el-dialog__footer) {
    padding-inline: 8px;
  }

  .project-code-input {
    gap: 4px;
  }

  .category-tag {
    margin-top: 4px;
    margin-left: 0;
    flex-basis: 100%;
  }

  .serial-tip {
    margin-top: 4px;
    margin-left: 0;
    flex-basis: 100%;
  }
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
</style>
