<template>
  <div class="p-4">
    <el-form ref="queryFormRef" :model="queryForm" label-width="90px" inline style="margin-bottom: 16px">
      <el-form-item label="关键词">
        <el-input v-model="queryForm.keyword" placeholder="项目编号/项目名称" clearable style="width: 200px" />
      </el-form-item>
      <el-form-item label="项目状态">
        <el-select v-model="queryForm.status" placeholder="请选择" clearable style="width: 160px">
          <el-option v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="handleReset">重置</el-button>
      </el-form-item>
    </el-form>

    <el-table ref="tableRef" v-loading="loading" :data="tableData" border height="calc(100vh - 320px)" @row-dblclick="handleView">
      <el-table-column prop="项目编号" label="项目编号" min-width="100" show-overflow-tooltip />
      <el-table-column prop="项目名称" label="项目名称" width="130" show-overflow-tooltip />
      <el-table-column prop="客户模号" label="客户模号" width="110" show-overflow-tooltip />
      <el-table-column prop="产品材质" label="产品材质" width="100" show-overflow-tooltip />
      <el-table-column prop="模具穴数" label="模具穴数" width="80" align="center" />
      <el-table-column prop="设计师" label="设计师" width="80" />
      <el-table-column prop="项目状态" label="项目状态" width="90" align="center">
        <template #default="{ row }">
          <el-tag :type="getStatusTagType(row.项目状态)">{{ row.项目状态 || '-' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="中标日期" label="中标日期" width="100" />
      <el-table-column prop="产品3D确认" label="产品3D确认" width="100" />
      <el-table-column prop="图纸下发时间" label="图纸下发时间" width="110" />
      <el-table-column prop="计划首样日期" label="计划首样日期" width="110" />
      <el-table-column prop="首次送样日期" label="首次送样日期" width="110" />
      <el-table-column prop="移模日期" label="移模日期" width="100" />
      <el-table-column prop="制件厂家" label="制件厂家" width="110" show-overflow-tooltip />
      <el-table-column prop="进度影响原因" label="进度影响原因" width="130" show-overflow-tooltip />
      <el-table-column label="操作" width="150" fixed="right" align="center">
        <template #default="{ row }">
          <el-button type="primary" link @click="handleView(row)">查看</el-button>
          <el-button type="success" link @click="handleEdit(row)">编辑</el-button>
          <el-button type="danger" link @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div style="margin-top: 16px; display: flex; justify-content: flex-end">
      <el-pagination background layout="total, sizes, prev, pager, next, jumper" 
        :current-page="pagination.page" :page-size="pagination.size" 
        :page-sizes="[10, 20, 30, 50]" :total="total" 
        @size-change="handleSizeChange" @current-change="handleCurrentChange" />
    </div>

    <!-- 查看详情对话框 -->
    <el-dialog v-model="viewDialogVisible" title="项目详情" width="1400px">
      <el-descriptions :column="4" border :size="'small'">
        <el-descriptions-item label="项目编号">{{ viewData.项目编号 }}</el-descriptions-item>
        <el-descriptions-item label="项目名称">{{ viewData.项目名称 }}</el-descriptions-item>
        <el-descriptions-item label="客户ID">{{ viewData.客户ID }}</el-descriptions-item>
        <el-descriptions-item label="客户模号">{{ viewData.客户模号 }}</el-descriptions-item>
        <el-descriptions-item label="产品材质">{{ viewData.产品材质 }}</el-descriptions-item>
        <el-descriptions-item label="模具穴数">{{ viewData.模具穴数 }}</el-descriptions-item>
        <el-descriptions-item label="设计师">{{ viewData.设计师 }}</el-descriptions-item>
        <el-descriptions-item label="项目状态">
          <el-tag :type="getStatusTagType(viewData.项目状态)">{{ viewData.项目状态 }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="中标日期">{{ viewData.中标日期 }}</el-descriptions-item>
        <el-descriptions-item label="产品3D确认">{{ viewData.产品3D确认 }}</el-descriptions-item>
        <el-descriptions-item label="图纸下发时间">{{ viewData.图纸下发时间 }}</el-descriptions-item>
        <el-descriptions-item label="计划首样日期">{{ viewData.计划首样日期 }}</el-descriptions-item>
        <el-descriptions-item label="首次送样日期">{{ viewData.首次送样日期 }}</el-descriptions-item>
        <el-descriptions-item label="移模日期">{{ viewData.移模日期 }}</el-descriptions-item>
        <el-descriptions-item label="送样时间">{{ viewData.送样时间 }}</el-descriptions-item>
        <el-descriptions-item label="制件厂家">{{ viewData.制件厂家 }}</el-descriptions-item>
        <el-descriptions-item label="进度影响原因" :span="4">{{ viewData.进度影响原因 }}</el-descriptions-item>
        <el-descriptions-item label="模具尺寸">{{ viewData.模具尺寸 }}</el-descriptions-item>
        <el-descriptions-item label="产品尺寸">{{ viewData.产品尺寸 }}</el-descriptions-item>
        <el-descriptions-item label="产品重量">{{ viewData.产品重量 }}</el-descriptions-item>
        <el-descriptions-item label="产品颜色">{{ viewData.产品颜色 }}</el-descriptions-item>
        <el-descriptions-item label="模具重量">{{ viewData.模具重量 }}</el-descriptions-item>
        <el-descriptions-item label="收缩率">{{ viewData.收缩率 }}</el-descriptions-item>
        <el-descriptions-item label="前模材质">{{ viewData.前模材质 }}</el-descriptions-item>
        <el-descriptions-item label="后模材质">{{ viewData.后模材质 }}</el-descriptions-item>
        <el-descriptions-item label="滑块材质">{{ viewData.滑块材质 }}</el-descriptions-item>
        <el-descriptions-item label="流道类型">{{ viewData.流道类型 }}</el-descriptions-item>
        <el-descriptions-item label="流道数量">{{ viewData.流道数量 }}</el-descriptions-item>
        <el-descriptions-item label="浇口类型">{{ viewData.浇口类型 }}</el-descriptions-item>
        <el-descriptions-item label="浇口数量">{{ viewData.浇口数量 }}</el-descriptions-item>
        <el-descriptions-item label="机台吨位">{{ viewData.机台吨位 }}</el-descriptions-item>
        <el-descriptions-item label="锁模力">{{ viewData.锁模力 }}</el-descriptions-item>
        <el-descriptions-item label="定位圈">{{ viewData.定位圈 }}</el-descriptions-item>
        <el-descriptions-item label="容模量">{{ viewData.容模量 }}</el-descriptions-item>
        <el-descriptions-item label="拉杆间距">{{ viewData.拉杆间距 }}</el-descriptions-item>
        <el-descriptions-item label="成型周期">{{ viewData.成型周期 }}</el-descriptions-item>
        <el-descriptions-item label="料柄重量">{{ viewData.料柄重量 }}</el-descriptions-item>
        <el-descriptions-item label="总成本">{{ viewData.总成本 }}</el-descriptions-item>
        <el-descriptions-item label="完成百分比">{{ viewData.完成百分比 }}%</el-descriptions-item>
        <el-descriptions-item label="费用出处">{{ viewData.费用出处 }}</el-descriptions-item>
        <el-descriptions-item label="是否归档" :span="4">
          <el-tag v-if="viewData.是否归档" type="success">已归档</el-tag>
          <el-tag v-else type="info">未归档</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="归档日期" :span="4">{{ viewData.归档日期 }}</el-descriptions-item>
        <el-descriptions-item label="备注" :span="4">{{ viewData.备注 }}</el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button @click="viewDialogVisible = false">关闭</el-button>
        <el-button type="primary" @click="handleEditFromView">编辑</el-button>
      </template>
    </el-dialog>

    <!-- 编辑对话框 -->
    <el-dialog v-model="editDialogVisible" :title="editTitle" width="1400px" :close-on-click-modal="false" @closed="handleEditDialogClosed">
      <el-form ref="editFormRef" :model="editForm" :rules="editRules" label-width="120px" class="edit-form-container">
        <el-row :gutter="20">
          <el-col :span="6">
            <el-form-item label="项目编号" prop="项目编号">
              <el-input v-model="editForm.项目编号" placeholder="项目编号" :disabled="!!currentProjectCode" />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="项目名称" prop="项目名称">
              <el-input v-model="editForm.项目名称" placeholder="项目名称" />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="客户ID">
              <el-input-number v-model="editForm.客户ID" :min="0" :controls="false" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="客户模号">
              <el-input v-model="editForm.客户模号" placeholder="客户模号" />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="设计师">
              <el-input v-model="editForm.设计师" placeholder="设计师" />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="产品材质">
              <el-input v-model="editForm.产品材质" placeholder="产品材质" />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="模具穴数">
              <el-input v-model="editForm.模具穴数" placeholder="模具穴数" />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="模具尺寸">
              <el-input v-model="editForm.模具尺寸" placeholder="模具尺寸" />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="产品尺寸">
              <el-input v-model="editForm.产品尺寸" placeholder="产品尺寸" />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="产品重量">
              <el-input-number v-model="editForm.产品重量" :min="0" :precision="2" :controls="false" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="产品颜色">
              <el-input v-model="editForm.产品颜色" placeholder="产品颜色" />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="收缩率">
              <el-input-number v-model="editForm.收缩率" :min="0" :precision="4" :controls="false" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="模具重量">
              <el-input-number v-model="editForm.模具重量" :min="0" :precision="2" :controls="false" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="前模材质">
              <el-input v-model="editForm.前模材质" placeholder="前模材质" />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="后模材质">
              <el-input v-model="editForm.后模材质" placeholder="后模材质" />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="滑块材质">
              <el-input v-model="editForm.滑块材质" placeholder="滑块材质" />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="流道类型">
              <el-input v-model="editForm.流道类型" placeholder="流道类型" />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="流道数量">
              <el-input-number v-model="editForm.流道数量" :min="0" :controls="false" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="浇口类型">
              <el-input v-model="editForm.浇口类型" placeholder="浇口类型" />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="浇口数量">
              <el-input-number v-model="editForm.浇口数量" :min="0" :controls="false" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="机台吨位">
              <el-input-number v-model="editForm.机台吨位" :min="0" :controls="false" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="锁模力">
              <el-input-number v-model="editForm.锁模力" :min="0" :controls="false" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="定位圈">
              <el-input-number v-model="editForm.定位圈" :min="0" :controls="false" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="容模量">
              <el-input v-model="editForm.容模量" placeholder="容模量" />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="拉杆间距">
              <el-input-number v-model="editForm.拉杆间距" :min="0" :controls="false" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="成型周期">
              <el-input-number v-model="editForm.成型周期" :min="0" :controls="false" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="料柄重量">
              <el-input-number v-model="editForm.料柄重量" :min="0" :precision="2" :controls="false" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="总成本">
              <el-input-number v-model="editForm.总成本" :min="0" :precision="2" :controls="false" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="完成百分比">
              <el-input-number v-model="editForm.完成百分比" :min="0" :max="100" :controls="false" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="费用出处">
              <el-input v-model="editForm.费用出处" placeholder="费用出处" />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="项目状态">
              <el-input v-model="editForm.项目状态" placeholder="项目状态" />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="中标日期">
              <el-date-picker v-model="editForm.中标日期" type="date" value-format="YYYY-MM-DD" placeholder="中标日期" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="产品3D确认">
              <el-date-picker v-model="editForm.产品3D确认" type="date" value-format="YYYY-MM-DD" placeholder="产品3D确认" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="图纸下发时间">
              <el-date-picker v-model="editForm.图纸下发时间" type="date" value-format="YYYY-MM-DD" placeholder="图纸下发时间" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="计划首样日期">
              <el-date-picker v-model="editForm.计划首样日期" type="date" value-format="YYYY-MM-DD" placeholder="计划首样日期" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="首次送样日期">
              <el-date-picker v-model="editForm.首次送样日期" type="date" value-format="YYYY-MM-DD" placeholder="首次送样日期" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="移模日期">
              <el-date-picker v-model="editForm.移模日期" type="date" value-format="YYYY-MM-DD" placeholder="移模日期" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="送样时间">
              <el-date-picker v-model="editForm.送样时间" type="date" value-format="YYYY-MM-DD" placeholder="送样时间" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="制件厂家">
              <el-input v-model="editForm.制件厂家" placeholder="制件厂家" />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="进度影响原因">
              <el-input v-model="editForm.进度影响原因" placeholder="进度影响原因" />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="是否归档">
              <el-switch v-model="editForm.是否归档" />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="归档日期">
              <el-date-picker v-model="editForm.归档日期" type="date" value-format="YYYY-MM-DD" placeholder="归档日期" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="备注">
              <el-input v-model="editForm.备注" type="textarea" :rows="3" placeholder="备注" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="editSubmitting" @click="handleSubmitEdit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getProjectListApi, getProjectDetailApi, createProjectApi, updateProjectApi, deleteProjectApi, type ProjectInfo } from '@/api/project'

const loading = ref(false)
const tableData = ref<Partial<ProjectInfo>[]>([])
const total = ref(0)
const pagination = reactive({ page: 1, size: 10 })

const queryForm = reactive({ keyword: '', status: '' })
const statusOptions = [
  { label: '进行中', value: '进行中' },
  { label: '已完成', value: '已完成' },
  { label: '已暂停', value: '已暂停' }
]

const viewDialogVisible = ref(false)
const viewData = ref<Partial<ProjectInfo>>({})

const editDialogVisible = ref(false)
const editTitle = ref('编辑项目')
const editFormRef = ref<FormInstance>()
const editForm = reactive<Partial<ProjectInfo>>({})
const editSubmitting = ref(false)
const currentProjectCode = ref('')

const editRules: FormRules = {
  项目编号: [{ required: true, message: '请输入项目编号', trigger: 'blur' }]
}

const loadData = async () => {
  loading.value = true
  try {
    const params: any = {
      page: pagination.page,
      pageSize: pagination.size
    }
    if (queryForm.keyword) params.keyword = queryForm.keyword
    if (queryForm.status) params.status = queryForm.status

    const response: any = await getProjectListApi(params)
    console.log('API Response:', response)
    
    if (response?.data?.data) {
      tableData.value = response.data.data.list || []
      total.value = response.data.data.total || 0
    } else if (response?.data) {
      tableData.value = response.data.list || []
      total.value = response.data.total || 0
    }
  } catch (error: any) {
    console.error('获取数据失败:', error)
    ElMessage.error('获取数据失败: ' + (error.message || '未知错误'))
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  pagination.page = 1
  loadData()
}

const handleReset = () => {
  queryForm.keyword = ''
  queryForm.status = ''
  handleSearch()
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

const getStatusTagType = (status?: string) => {
  if (!status) return 'info'
  if (status.includes('完成')) return 'success'
  if (status.includes('暂停')) return 'warning'
  return 'primary'
}

const handleView = async (row: Partial<ProjectInfo>) => {
  try {
    const response: any = await getProjectDetailApi(row.项目编号 || '')
    viewData.value = response.data?.data || response.data || row
    viewDialogVisible.value = true
  } catch (error: any) {
    ElMessage.error('获取详情失败')
  }
}

const handleEditFromView = () => {
  viewDialogVisible.value = false
  setTimeout(() => handleEdit(viewData.value), 100)
}

const handleEdit = (row: Partial<ProjectInfo>) => {
  editTitle.value = '编辑项目'
  currentProjectCode.value = row.项目编号 || ''
  Object.assign(editForm, row)
  editDialogVisible.value = true
}

const handleSubmitEdit = async () => {
  if (!editFormRef.value) return
  
  try {
    await editFormRef.value.validate()
  } catch {
    return
  }

  editSubmitting.value = true
  try {
    if (currentProjectCode.value) {
      await updateProjectApi(currentProjectCode.value, editForm)
      ElMessage.success('更新成功')
    } else {
      // 确保项目编号存在
      if (!editForm.项目编号) {
        ElMessage.error('项目编号不能为空')
        return
      }
      await createProjectApi(editForm as ProjectInfo)
      ElMessage.success('创建成功')
    }
    editDialogVisible.value = false
    loadData()
  } catch (error: any) {
    ElMessage.error('保存失败: ' + (error.message || '未知错误'))
  } finally {
    editSubmitting.value = false
  }
}

const handleDelete = async (row: Partial<ProjectInfo>) => {
  try {
    await ElMessageBox.confirm('确认删除该项目？', '提示', { type: 'warning' })
    await deleteProjectApi(row.项目编号 || '')
    ElMessage.success('删除成功')
    loadData()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

const handleEditDialogClosed = () => {
  editFormRef.value?.resetFields()
  Object.keys(editForm).forEach(key => delete (editForm as any)[key])
  currentProjectCode.value = ''
}

onMounted(() => loadData())
</script>

<style scoped>
.edit-form-container {
  max-height: 70vh;
  overflow-y: auto;
}

:deep(.el-descriptions__table) {
  table-layout: fixed;
}

:deep(.el-descriptions__table .el-descriptions__cell) {
  width: 25%;
}
</style>
