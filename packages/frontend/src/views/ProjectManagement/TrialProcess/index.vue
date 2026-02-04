<template>
  <div class="tp-page p-4 space-y-4">
    <div class="tp-header">
      <div class="tp-header__left">
        <el-button :icon="ArrowLeft" @click="handleBack">返回</el-button>
        <div class="tp-header__title">
          <div class="tp-header__title-main">试模过程</div>
          <div class="tp-header__title-sub">项目：{{ projectCode }}</div>
        </div>
      </div>
      <div class="tp-header__right">
        <el-button type="primary" @click="openCreateDialog(false)">新建记录</el-button>
        <el-button type="primary" plain @click="openCreateDialog(true)">新建并打印</el-button>
      </div>
    </div>

    <el-card shadow="never">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span>试模记录</span>
          <el-button :loading="loading" @click="loadList">刷新</el-button>
        </div>
      </template>

      <el-table :data="records" border size="small" v-loading="loading" style="width: 100%">
        <el-table-column prop="trialNo" label="次数" width="70" align="center" />
        <el-table-column prop="trialDate" label="试模日期" width="120" />
        <el-table-column prop="trialCategory" label="类别" width="110" />
        <el-table-column
          prop="productMaterial"
          label="产品材质"
          min-width="110"
          show-overflow-tooltip
        />
        <el-table-column prop="trialProductQty" label="试模产品数" width="110" align="right" />
        <el-table-column label="外协" width="60" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.isOutsourced" type="warning" size="small">是</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="附件" width="70" align="center">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="openAttachmentDrawer(row)">
              {{ row.attachmentCount ?? 0 }}
            </el-button>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="260" align="center">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="handlePrint(row)">打印</el-button>
            <el-button type="primary" link size="small" @click="openEditDialog(row)"
              >编辑</el-button
            >
            <el-button type="primary" link size="small" @click="openAttachmentDrawer(row)"
              >附件</el-button
            >
            <el-button type="danger" link size="small" @click="handleVoid(row)">作废</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 新建/编辑 -->
    <el-dialog
      v-model="editVisible"
      :title="editMode === 'create' ? '新建试模记录' : `编辑试模记录（第${editTrialNo}次）`"
      width="720px"
      :close-on-click-modal="false"
    >
      <el-card shadow="never" style="margin-bottom: 12px">
        <template #header>
          <span>项目信息</span>
        </template>
        <el-descriptions :column="2" size="small" border>
          <el-descriptions-item label="项目编号">{{
            projectInfo?.项目编号 || projectCode || '-'
          }}</el-descriptions-item>
          <el-descriptions-item label="产品名称">{{
            projectInfo?.productName || projectInfo?.产品名称 || '-'
          }}</el-descriptions-item>
          <el-descriptions-item label="模具穴数">{{
            projectInfo?.模具穴数 || '-'
          }}</el-descriptions-item>
          <el-descriptions-item label="模具尺寸">{{
            projectInfo?.模具尺寸 || '-'
          }}</el-descriptions-item>
          <el-descriptions-item label="模具重量">{{
            projectInfo?.模具重量 != null ? projectInfo.模具重量 : '-'
          }}</el-descriptions-item>
          <el-descriptions-item label="产品重量">{{
            projectInfo?.产品重量 != null ? projectInfo.产品重量 : '-'
          }}</el-descriptions-item>
          <el-descriptions-item label="产品材质">{{
            projectInfo?.产品材质 || '-'
          }}</el-descriptions-item>
          <el-descriptions-item label="产品颜色">{{
            projectInfo?.产品颜色 || '-'
          }}</el-descriptions-item>
        </el-descriptions>
      </el-card>

      <el-form ref="editFormRef" :model="editForm" :rules="rules" label-width="110px">
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="试模日期" prop="trialDate">
              <el-date-picker v-model="editForm.trialDate" type="date" value-format="YYYY-MM-DD" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="试模类别" prop="trialCategory">
              <el-select v-model="editForm.trialCategory" :disabled="trialCategoryLocked">
                <el-option v-for="c in categoryOptions" :key="c" :label="c" :value="c" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 产品颜色由项目管理表提供（项目信息） -->

        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="色母型号" prop="masterbatchModel">
              <el-input v-model="editForm.masterbatchModel" placeholder="可选" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="试模单位" prop="trialUnit">
              <el-input v-model="editForm.trialUnit" placeholder="可选" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="试模产品数" prop="trialProductQty">
              <el-input-number v-model="editForm.trialProductQty" :min="1" :precision="0" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="注塑机吨位" prop="machineTonnage">
              <el-input-number v-model="editForm.machineTonnage" :min="1" :precision="0" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="试模时长(H)" prop="trialDuration">
              <el-input-number v-model="editForm.trialDuration" :min="0" :precision="2" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="外协试模" prop="isOutsourced">
              <el-switch v-model="editForm.isOutsourced" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="备注" prop="remark">
          <el-input v-model="editForm.remark" type="textarea" :rows="3" placeholder="可选" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>

    <!-- 附件抽屉 -->
    <el-drawer v-model="attachmentDrawerVisible" :title="attachmentDrawerTitle" size="520px">
      <div class="space-y-3">
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px">
          <el-upload
            v-if="currentAttachmentTrialNo"
            :action="getTrialProcessAttachmentAction(currentAttachmentTrialNo)"
            :headers="uploadHeaders"
            :show-file-list="false"
            :multiple="true"
            accept="application/pdf,image/*"
            :on-success="handleAttachmentUploadSuccess"
            :on-error="handleAttachmentUploadError"
          >
            <el-button type="primary">上传 PDF/图片</el-button>
          </el-upload>
          <el-button :loading="attachmentLoading" @click="loadAttachments">刷新</el-button>
        </div>

        <el-table :data="attachments" border size="small" v-loading="attachmentLoading">
          <el-table-column
            prop="originalName"
            label="文件名"
            min-width="180"
            show-overflow-tooltip
          />
          <el-table-column label="大小" width="80" align="right">
            <template #default="{ row }">{{ formatFileSize(row.fileSize) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="140" align="center">
            <template #default="{ row }">
              <el-button type="primary" link size="small" @click="downloadAttachment(row)"
                >下载</el-button
              >
              <el-button type="danger" link size="small" @click="deleteAttachment(row)"
                >删除</el-button
              >
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import {
  createTrialProcessApi,
  deleteTrialProcessAttachmentApi,
  downloadTrialProcessAttachmentApi,
  getProjectDetailApi,
  getTrialProcessAttachmentsApi,
  getTrialProcessListApi,
  updateTrialProcessApi,
  voidTrialProcessApi,
  type TrialProcessAttachment,
  type TrialProcessCategory,
  type TrialProcessRecord
} from '@/api/project'
import { useUserStoreWithOut } from '@/store/modules/user'

const router = useRouter()
const route = useRoute()
const userStore = useUserStoreWithOut()

const projectCode = computed(() => String(route.params.projectCode || '').trim())
const projectInfo = ref<any>(null)

const loading = ref(false)
const records = ref<TrialProcessRecord[]>([])

const categoryOptions: TrialProcessCategory[] = ['T0', '工程变更', '细节优化', '客户更改', '封样']

const nextTrialNoGuess = computed(() => {
  const max = records.value.reduce((m, r) => Math.max(m, Number(r.trialNo || 0)), 0)
  return max + 1
})

const loadList = async () => {
  if (!projectCode.value) return
  loading.value = true
  try {
    const res: any = await getTrialProcessListApi(projectCode.value)
    records.value = res?.data || []
  } catch (e: any) {
    ElMessage.error(e?.message || '加载试模过程失败')
    records.value = []
  } finally {
    loading.value = false
  }
}

const loadProjectInfo = async () => {
  if (!projectCode.value) return
  try {
    const resp: any = await getProjectDetailApi(projectCode.value)
    const data = resp?.data?.data || resp?.data || resp
    projectInfo.value = data || null
  } catch (e) {
    projectInfo.value = null
  }
}

const handleBack = () => {
  const from = String(route.query.from || '').trim()
  if (from) {
    router.push(from)
    return
  }
  router.push('/project-management')
}

const formatFileSize = (size: number) => {
  const n = Number(size || 0)
  if (!Number.isFinite(n) || n <= 0) return '-'
  if (n < 1024) return `${n}B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)}MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(1)}GB`
}

type EditMode = 'create' | 'edit'
const editMode = ref<EditMode>('create')
const editVisible = ref(false)
const saving = ref(false)
const editTrialNo = ref<number>(0)
const printAfterSave = ref(false)
const editFormRef = ref<FormInstance>()

const editForm = reactive({
  trialDate: '',
  trialCategory: '' as TrialProcessCategory | '',
  masterbatchModel: '',
  trialUnit: '',
  trialProductQty: 1,
  machineTonnage: undefined as number | undefined,
  trialDuration: undefined as number | undefined,
  isOutsourced: false,
  remark: ''
})

const rules: FormRules = {
  trialCategory: [{ required: true, message: '请选择试模类别', trigger: 'change' }],
  trialProductQty: [{ required: true, message: '请输入试模产品数量', trigger: 'blur' }]
}

const trialCategoryLocked = computed(() => {
  const isFirst = (editMode.value === 'create' ? nextTrialNoGuess.value : editTrialNo.value) === 1
  return isFirst
})

const resetEditForm = () => {
  editForm.trialDate = ''
  editForm.trialCategory = (
    nextTrialNoGuess.value === 1 ? 'T0' : '工程变更'
  ) as TrialProcessCategory
  editForm.masterbatchModel = ''
  editForm.trialUnit = ''
  editForm.trialProductQty = 1
  editForm.machineTonnage = undefined
  editForm.trialDuration = undefined
  editForm.isOutsourced = false
  editForm.remark = ''
}

const openCreateDialog = (andPrint: boolean) => {
  editMode.value = 'create'
  editTrialNo.value = 0
  printAfterSave.value = andPrint
  resetEditForm()
  editVisible.value = true
}

const openEditDialog = (row: TrialProcessRecord) => {
  editMode.value = 'edit'
  editTrialNo.value = row.trialNo
  printAfterSave.value = false
  editForm.trialDate = row.trialDate || ''
  editForm.trialCategory = row.trialCategory
  editForm.masterbatchModel = String(row.masterbatchModel || '')
  editForm.trialUnit = String(row.trialUnit || '')
  editForm.trialProductQty = Number(row.trialProductQty || 1)
  editForm.machineTonnage = row.machineTonnage ?? undefined
  editForm.trialDuration = row.trialDuration ?? undefined
  editForm.isOutsourced = !!row.isOutsourced
  editForm.remark = String(row.remark || '')
  editVisible.value = true
}

const handleSave = async () => {
  if (!projectCode.value) return
  if (saving.value) return

  await editFormRef.value?.validate()

  const payload = {
    trialDate: editForm.trialDate || null,
    trialCategory: editForm.trialCategory,
    masterbatchModel: editForm.masterbatchModel?.trim() || null,
    trialUnit: editForm.trialUnit?.trim() || null,
    trialProductQty: Number(editForm.trialProductQty),
    machineTonnage: editForm.machineTonnage ?? null,
    trialDuration: editForm.trialDuration ?? null,
    isOutsourced: !!editForm.isOutsourced,
    remark: editForm.remark?.trim() || null
  }

  saving.value = true
  try {
    let saved: TrialProcessRecord | null = null
    if (editMode.value === 'create') {
      const res = await createTrialProcessApi(projectCode.value, payload as any)
      saved = (res as any)?.data || null
    } else {
      const res = await updateTrialProcessApi(projectCode.value, editTrialNo.value, payload as any)
      saved = (res as any)?.data || null
    }
    ElMessage.success('保存成功')
    editVisible.value = false
    await loadList()

    if (printAfterSave.value && saved?.trialNo) {
      handlePrint(saved)
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

const handlePrint = (row: TrialProcessRecord) => {
  if (!projectCode.value) return
  router.push({
    name: 'TrialFormPrintPreview',
    params: { projectCode: projectCode.value },
    query: { trialNo: String(row.trialNo), from: route.fullPath }
  })
}

const handleVoid = async (row: TrialProcessRecord) => {
  if (!projectCode.value) return
  try {
    await ElMessageBox.confirm(`确定作废第${row.trialNo}次试模记录？`, '提示', {
      type: 'warning',
      confirmButtonText: '作废',
      cancelButtonText: '取消'
    })
  } catch {
    return
  }

  try {
    await voidTrialProcessApi(projectCode.value, row.trialNo)
    ElMessage.success('已作废')
    await loadList()
  } catch (e: any) {
    ElMessage.error(e?.message || '作废失败')
  }
}

// === 附件抽屉 ===

const attachmentDrawerVisible = ref(false)
const attachmentLoading = ref(false)
const attachments = ref<TrialProcessAttachment[]>([])
const currentAttachmentTrialNo = ref<number>(0)

const attachmentDrawerTitle = computed(() =>
  currentAttachmentTrialNo.value ? `附件 - 第${currentAttachmentTrialNo.value}次` : '附件'
)

const getTrialProcessAttachmentAction = (trialNo: number) => {
  return `/api/project/${encodeURIComponent(projectCode.value)}/trial-processes/${trialNo}/attachments`
}

const uploadHeaders = computed(() => ({
  [userStore.getTokenKey ?? 'Authorization']: userStore.getToken ?? '',
  'X-Username': userStore.getUserInfo?.username || ''
}))

const loadAttachments = async () => {
  if (!projectCode.value || !currentAttachmentTrialNo.value) return
  attachmentLoading.value = true
  try {
    const res: any = await getTrialProcessAttachmentsApi(
      projectCode.value,
      currentAttachmentTrialNo.value
    )
    attachments.value = res?.data || []
  } catch (e: any) {
    ElMessage.error(e?.message || '加载附件失败')
    attachments.value = []
  } finally {
    attachmentLoading.value = false
  }
}

const openAttachmentDrawer = async (row: TrialProcessRecord) => {
  currentAttachmentTrialNo.value = row.trialNo
  attachmentDrawerVisible.value = true
  await loadAttachments()
}

const handleAttachmentUploadSuccess = async () => {
  ElMessage.success('上传成功')
  await loadAttachments()
  await loadList()
}

const handleAttachmentUploadError = (err: any) => {
  console.error('上传失败:', err)
  ElMessage.error('上传失败')
}

const downloadAttachment = (row: TrialProcessAttachment) => {
  void (async () => {
    try {
      const resp: any = await downloadTrialProcessAttachmentApi(row.id)
      const blob = ((resp as any)?.data ?? resp) as Blob
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = row.originalName || `附件_${row.id}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      ElMessage.error(e?.message || '下载失败')
    }
  })()
}

const deleteAttachment = async (row: TrialProcessAttachment) => {
  try {
    await ElMessageBox.confirm(`确定删除附件：${row.originalName}？`, '提示', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
  } catch {
    return
  }
  try {
    await deleteTrialProcessAttachmentApi(row.id)
    ElMessage.success('已删除')
    await loadAttachments()
    await loadList()
  } catch (e: any) {
    ElMessage.error(e?.message || '删除失败')
  }
}

onMounted(() => {
  void loadList()
  void loadProjectInfo()
})
</script>

<style scoped>
.tp-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.tp-header__left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.tp-header__title-main {
  font-size: 16px;
  font-weight: 700;
}

.tp-header__title-sub {
  font-size: 12px;
  color: rgb(0 0 0 / 55%);
}
</style>
