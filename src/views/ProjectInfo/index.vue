<template>
  <div class="p-4">
    <el-card shadow="never">
      <template #header>
        <div class="flex justify-between items-center">
          <span class="text-lg font-bold">项目信息</span>
          <el-button type="primary" @click="handleAdd"> 新增项目 </el-button>
        </div>
      </template>

      <!-- 搜索表单 -->
      <el-form :inline="true" :model="queryForm" class="mb-4">
        <el-form-item label="模糊查询">
          <el-input
            v-model="queryForm.keyword"
            placeholder="请输入项目编号/产品名称/产品图号"
            clearable
            style="width: 280px"
            @keyup.enter="handleQuery"
          />
        </el-form-item>
        <el-form-item label="分类">
          <el-select
            v-model="queryForm.category"
            placeholder="请选择分类"
            clearable
            style="width: 150px"
          >
            <el-option label="塑胶模具" value="塑胶模具" />
            <el-option label="零件加工" value="零件加工" />
            <el-option label="修改模具" value="修改模具" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleQuery"> 查询 </el-button>
          <el-button @click="handleReset"> 重置 </el-button>
        </el-form-item>
      </el-form>

      <!-- 数据表格 -->
      <el-table
        :data="tableData"
        border
        stripe
        v-loading="loading"
        @row-dblclick="handleRowDoubleClick"
      >
        <el-table-column type="index" label="序号" width="60" align="center" />
        <el-table-column
          prop="projectCode"
          label="项目编号"
          min-width="160"
          show-overflow-tooltip
        />
        <el-table-column prop="productName" label="产品名称" width="240" />
        <el-table-column prop="productDrawing" label="产品图号" width="240" />
        <el-table-column
          prop="customerModelNo"
          label="客户模号"
          width="150"
          show-overflow-tooltip
        />
        <el-table-column prop="category" label="分类" width="120" />
        <el-table-column prop="customerName" label="客户名称" width="280" show-overflow-tooltip />
        <el-table-column prop="remarks" label="备注" width="150" show-overflow-tooltip />
        <el-table-column label="操作" width="220" align="center" fixed="right">
          <template #default="{ row }">
            <div class="operation-buttons">
              <el-button type="primary" size="small" @click="handleEdit(row)"> 编辑 </el-button>
              <el-button type="success" size="small" @click="handleView(row)"> 查看 </el-button>
              <el-button type="danger" size="small" @click="handleDelete(row)"> 删除 </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="flex justify-end mt-4">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </el-card>

    <!-- 查看详情对话框 -->
    <el-dialog
      v-model="viewDialogVisible"
      title="项目详情"
      width="600px"
      :close-on-click-modal="false"
    >
      <div v-if="viewData" class="project-detail">
        <el-descriptions :column="2" border>
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
      width="800px"
      @close="handleDialogClose"
      @opened="handleDialogOpened"
    >
      <el-form :model="formData" :rules="rules" ref="formRef" label-width="100px">
        <!-- 项目编号独立首行 -->
        <el-form-item label="项目编号" prop="projectCode">
          <div class="project-code-input">
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
            <template v-if="formData.projectCategory === '03'">
              <span class="code-separator">/</span>
              <el-input
                ref="partNumberInputRef"
                v-model="formData.partNumber"
                placeholder="零件"
                maxlength="2"
                class="code-part"
                @input="updateProjectCode"
                @blur="onPartNumberBlur"
              />
            </template>
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
          <el-col :span="12">
            <el-form-item label="产品名称" prop="projectName">
              <el-input
                ref="projectNameInputRef"
                v-model="formData.projectName"
                placeholder="请输入产品名称"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="产品图号" prop="projectManager">
              <el-input v-model="formData.projectManager" placeholder="请输入产品图号" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="客户模号" prop="customerModelNo">
              <el-input
                v-model="formData.customerModelNo"
                placeholder="请输入客户模号"
                :disabled="true"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
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
import { ref, reactive, onMounted } from 'vue'
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
const pageSize = ref(10)
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

  // 格式化年份（确保是2位数）
  const yearStr = projectYear.padStart(2, '0')

  // 格式化序号（确保是3位数）
  const serialStr = projectSerial.padStart(3, '0')

  // 基础编号格式：JH0X-YY-SSS
  let code = `JH${projectCategory}-${yearStr}-${serialStr}`

  // 如果是03（零件加工）且有零件号，则添加零件号
  if (projectCategory === '03' && partNumber) {
    const partStr = partNumber.padStart(2, '0')
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
  if (formData.projectCategory === '03') {
    // 如果是零件加工，聚焦到零件号输入框
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

// 零件号输入框失焦时聚焦到产品名称
const onPartNumberBlur = () => {
  setTimeout(() => {
    projectNameInputRef.value?.focus()
  }, 100)
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
    await ElMessageBox.confirm(`确定要删除项目"${row.productName}"吗？`, '警告', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    await deleteGoodsApi(row.id)
    ElMessage.success('删除成功')
    // 刷新数据列表
    await fetchData()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除失败:', error)
      ElMessage.error('删除失败')
    }
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
.operation-buttons {
  display: flex;
  gap: 4px;
  padding: 0 8px;
  justify-content: center;
}

.project-code-input {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: nowrap;
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
  width: 80px;
}

.code-year {
  width: 80px;
}

.code-serial {
  width: 100px;
}

.code-part {
  width: 80px;
}

.category-tag {
  margin-left: 12px;
}

.serial-tip {
  margin-top: 8px;
  margin-left: 8px;
}
</style>
