<template>
  <div class="tp-page p-4 space-y-4">
    <div v-if="!embedded" class="tp-header">
      <el-button :icon="ArrowLeft" @click="handleBack">返回</el-button>
    </div>

    <el-card shadow="never">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span>试模记录</span>
          <el-button type="primary" @click="openCreateDialog(false)">新建记录</el-button>
        </div>
      </template>

      <el-table :data="records" border size="small" v-loading="loading" style="width: 100%">
        <el-table-column prop="trialNo" label="次数" width="50" align="center" />
        <el-table-column prop="trialDate" label="试模日期" width="120" />
        <el-table-column prop="trialCategory" label="类别" width="100" />
        <el-table-column
          prop="productMaterial"
          label="产品材质"
          min-width="80"
          show-overflow-tooltip
        />
        <el-table-column
          prop="productColor"
          label="产品颜色"
          min-width="80"
          show-overflow-tooltip
        />
        <el-table-column prop="trialProductQty" label="试模产品数" width="80" align="right" />
        <el-table-column prop="createdBy" label="创建人" width="100" show-overflow-tooltip />
        <el-table-column label="创建时间" width="140" show-overflow-tooltip>
          <template #default="{ row }">
            {{ formatDateTime(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="外协" width="50" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.isOutsourced" type="warning" size="small">是</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="附件" width="50" align="center">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="openAttachmentDrawer(row)">
              {{ row.attachmentCount ?? 0 }}
            </el-button>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" align="center">
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
          <el-descriptions-item label="客户模号">{{
            projectInfo?.客户模号 || '-'
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
            projectProductWeightDisplay
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
          <MobileUploadTrigger
            v-if="isMobile && currentAttachmentTrialNo"
            :action="getTrialProcessAttachmentAction(currentAttachmentTrialNo)"
            :headers="uploadHeaders"
            :multiple="true"
            accept="application/pdf,image/*"
            @success="handleAttachmentUploadSuccess"
            @error="handleAttachmentUploadError"
          >
            <template #default="{ open, uploading }">
              <el-button type="primary" :loading="uploading" @click="open">上传 PDF/图片</el-button>
            </template>
          </MobileUploadTrigger>
          <el-upload
            v-else-if="currentAttachmentTrialNo"
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
              <el-button type="primary" link size="small" @click="previewAttachment(row)">
                预览
              </el-button>
              <el-button type="primary" link size="small" @click="downloadAttachment(row)">
                下载
              </el-button>
              <el-button type="danger" link size="small" @click="deleteAttachment(row)">
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-drawer>

    <el-dialog v-model="previewVisible" title="附件预览" width="80vw" :close-on-click-modal="false">
      <div v-if="previewLoading" style="padding: 24px; text-align: center">加载中...</div>
      <template v-else>
        <img
          v-if="previewKind === 'image' && previewUrl"
          :src="previewUrl"
          style="max-width: 100%"
        />
        <iframe
          v-else-if="previewKind === 'pdf' && previewUrl"
          :src="previewUrl"
          style="width: 100%; height: 75vh; border: 0"
        ></iframe>
        <div v-else style="padding: 24px; color: rgb(0 0 0 / 55%); text-align: center">
          无法预览该文件，请下载后查看
        </div>
      </template>
      <template #footer>
        <el-button @click="previewVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
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
import { useAppStore } from '@/store/modules/app'
import MobileUploadTrigger from '@/components/MobileUploadTrigger/MobileUploadTrigger.vue'

const props = defineProps<{
  projectCode?: string
  embedded?: boolean
}>()

const router = useRouter()
const route = useRoute()
const userStore = useUserStoreWithOut()
const appStore = useAppStore()
const isMobile = computed(() => appStore.getMobile)

const projectCode = computed(() =>
  String(props.projectCode || route.params.projectCode || '').trim()
)
const embedded = computed(() => props.embedded === true)
const projectInfo = ref<any>(null)

const loading = ref(false)
const records = ref<TrialProcessRecord[]>([])

const categoryOptions: TrialProcessCategory[] = ['T0', '工程变更', '细节优化', '客户更改', '封样']

const nextTrialNoGuess = computed(() => {
  const used = new Set(
    records.value
      .map((r) => Number(r.trialNo || 0))
      .filter((n) => Number.isInteger(n) && n > 0)
      .sort((a, b) => a - b)
  )
  let next = 1
  while (used.has(next)) next += 1
  return next
})

const previousActiveRecord = computed(() => {
  if (!records.value.length) return null
  const sorted = [...records.value].sort((a, b) => Number(a.trialNo || 0) - Number(b.trialNo || 0))
  return sorted[sorted.length - 1] || null
})

const parseProductWeightList = (info: any): number[] => {
  const raw = info?.产品重量列表
  if (raw === null || raw === undefined || raw === '') return []
  let arr: unknown[] = []
  if (Array.isArray(raw)) {
    arr = raw
  } else if (typeof raw === 'string') {
    const text = raw.trim()
    if (!text) return []
    try {
      const parsed = JSON.parse(text)
      if (Array.isArray(parsed)) arr = parsed
    } catch (_e) {
      return []
    }
  }
  return arr
    .map((v) => (typeof v === 'number' ? v : Number(String(v ?? '').trim())))
    .filter((v) => Number.isFinite(v))
}

const resolveProjectProductWeight = (info: any): number | null => {
  const weightList = parseProductWeightList(info)
  if (weightList.length > 0) {
    return weightList.reduce((sum, n) => sum + n, 0)
  }
  const single = info?.产品重量
  if (single === null || single === undefined || single === '') return null
  const n = typeof single === 'number' ? single : Number(String(single).trim())
  return Number.isFinite(n) ? n : null
}

const projectProductWeightDisplay = computed(() => {
  const weight = resolveProjectProductWeight(projectInfo.value || {})
  if (weight === null) return '-'
  return Number.isInteger(weight) ? String(weight) : String(Number(weight.toFixed(3)))
})

type TrialCreateCheckStatus = 'ok' | 'missing'
type TrialCreateCheckItem = {
  key: string
  label: string
  status: TrialCreateCheckStatus
  detail: string
}

const hasProjectValue = (value: unknown) => {
  if (value === null || value === undefined) return false
  if (typeof value === 'number') return Number.isFinite(value)
  return String(value).trim().length > 0
}

const getTrialCreateCheckItems = (): TrialCreateCheckItem[] => {
  const info = projectInfo.value || {}
  const totalProductWeight = resolveProjectProductWeight(info)
  const fields = [
    { key: 'mouldSize', label: '模具尺寸', value: info.模具尺寸 },
    { key: 'mouldWeight', label: '模具重量', value: info.模具重量 },
    { key: 'productWeight', label: '产品重量', value: totalProductWeight },
    { key: 'productMaterial', label: '产品材质', value: info.产品材质 },
    { key: 'productColor', label: '产品颜色', value: info.产品颜色 }
  ]
  return fields.map((field) => {
    const ok = hasProjectValue(field.value)
    return {
      key: field.key,
      label: field.label,
      status: ok ? 'ok' : 'missing',
      detail: ok ? '已填写' : '不能为空（请先在项目管理补全）'
    }
  })
}

const showTrialCreateChecklistDialog = async (items: TrialCreateCheckItem[]) => {
  const total = items.length
  const missingCount = items.filter((i) => i.status === 'missing').length
  const okCount = total - missingCount
  const passed = missingCount === 0

  const badge = (status: TrialCreateCheckStatus) => {
    if (status === 'ok') {
      return '<span style="display:inline-block;padding:2px 8px;border-radius:999px;background:#f0f9eb;color:#67c23a;font-weight:600;">通过</span>'
    }
    return '<span style="display:inline-block;padding:2px 8px;border-radius:999px;background:#fef0f0;color:#f56c6c;font-weight:600;">缺少</span>'
  }

  const rows = items
    .map(
      (item, idx) =>
        `<tr>
          <td style="padding:8px;border:1px solid #ebeef5;text-align:center;">${idx + 1}</td>
          <td style="padding:8px;border:1px solid #ebeef5;">${item.label}</td>
          <td style="padding:8px;border:1px solid #ebeef5;text-align:center;">${badge(item.status)}</td>
          <td style="padding:8px;border:1px solid #ebeef5;color:${item.status === 'ok' ? '#606266' : '#f56c6c'};">${item.detail}</td>
        </tr>`
    )
    .join('')

  const content = `
    <div style="line-height:1.6;">
      <div style="margin-bottom:8px;font-weight:600;">共 ${total} 项：通过 ${okCount}，缺少 ${missingCount}</div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr>
            <th style="padding:8px;border:1px solid #ebeef5;background:#f5f7fa;width:56px;">序号</th>
            <th style="padding:8px;border:1px solid #ebeef5;background:#f5f7fa;width:120px;">检查项</th>
            <th style="padding:8px;border:1px solid #ebeef5;background:#f5f7fa;width:88px;">状态</th>
            <th style="padding:8px;border:1px solid #ebeef5;background:#f5f7fa;">说明</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `

  if (!passed) {
    await ElMessageBox.alert(content, '新建试模记录检查清单（未通过）', {
      dangerouslyUseHTMLString: true,
      confirmButtonText: '我知道了',
      closeOnClickModal: false,
      customClass: 'trial-checklist-dialog'
    })
    return { passed: false }
  }

  await ElMessageBox.confirm(content, '新建试模记录检查清单（已通过）', {
    dangerouslyUseHTMLString: true,
    confirmButtonText: '继续新建',
    cancelButtonText: '取消',
    closeOnClickModal: false,
    customClass: 'trial-checklist-dialog'
  })
  return { passed: true }
}

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
  if (embedded.value) return
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

const formatDateTime = (value?: string | null) => {
  const s = String(value || '').trim()
  if (!s) return '-'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`
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
  trialDate: [
    { required: true, message: '请选择试模日期', trigger: 'change' },
    {
      validator: (_rule, value, callback) => {
        if (editMode.value !== 'create') return callback()
        const current = String(value || '').trim()
        if (!current) return callback()
        const previousDate = String(previousActiveRecord.value?.trialDate || '').trim()
        if (previousDate && current < previousDate) {
          return callback(new Error(`试模日期不能早于上一次试模日期（${previousDate}）`))
        }
        callback()
      },
      trigger: 'change'
    }
  ],
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

const openCreateDialog = async (andPrint: boolean) => {
  if (!projectInfo.value) {
    await loadProjectInfo()
  }
  const checklistItems = getTrialCreateCheckItems()
  try {
    const { passed } = await showTrialCreateChecklistDialog(checklistItems)
    if (!passed) return
  } catch (_e) {
    return
  }

  const previous = previousActiveRecord.value
  if (previous && Number(previous.attachmentCount || 0) <= 0) {
    ElMessage.warning('请先上传本次试模附件后，再新建下一次试模记录')
    return
  }
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
  const from = embedded.value
    ? router.resolve({
        path: '/project-management/index',
        query: {
          view: String(route.query.view || 'table'),
          openProjectCode: projectCode.value,
          openProjectTab: 'trialProcess'
        }
      }).fullPath
    : route.fullPath
  router.push({
    name: 'TrialFormPrintPreview',
    params: { projectCode: projectCode.value },
    query: { trialNo: String(row.trialNo), from }
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
  } catch (_e) {
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
  return `/api/project/${encodeURIComponent(projectCode.value)}/trial-processes/${trialNo}/trial-attachments`
}

const uploadHeaders = computed(() => {
  const userInfo: any = userStore.getUserInfo || {}
  const displayNameRaw = String(userInfo.realName || userInfo.displayName || '').trim()
  const displayNameHeader = displayNameRaw ? encodeURIComponent(displayNameRaw) : ''
  return {
    [userStore.getTokenKey ?? 'Authorization']: userStore.getToken ?? '',
    'X-Username': userInfo.username || '',
    'X-Display-Name': displayNameHeader
  }
})

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
  } catch (_e) {
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

// === 预览 ===

type PreviewKind = 'image' | 'pdf' | 'unknown'

const previewVisible = ref(false)
const previewLoading = ref(false)
const previewUrl = ref<string>('')
const previewKind = ref<PreviewKind>('unknown')

const resolvePreviewKind = (row: TrialProcessAttachment): PreviewKind => {
  const ct = String(row.contentType || '').toLowerCase()
  if (ct.startsWith('image/')) return 'image'
  if (ct.includes('pdf')) return 'pdf'
  const name = String(row.originalName || row.storedFileName || '').toLowerCase()
  if (name.endsWith('.pdf')) return 'pdf'
  if (/\.(png|jpe?g|gif|webp|bmp)$/i.test(name)) return 'image'
  return 'unknown'
}

const cleanupPreviewUrl = () => {
  if (!previewUrl.value) return
  try {
    URL.revokeObjectURL(previewUrl.value)
  } catch (e) {
    // ignore
  }
  previewUrl.value = ''
}

const previewAttachment = (row: TrialProcessAttachment) => {
  void (async () => {
    cleanupPreviewUrl()
    previewKind.value = resolvePreviewKind(row)
    previewVisible.value = true
    previewLoading.value = true
    try {
      const resp: any = await downloadTrialProcessAttachmentApi(row.id)
      const blob = ((resp as any)?.data ?? resp) as Blob
      previewUrl.value = URL.createObjectURL(blob)
    } catch (e: any) {
      ElMessage.error(e?.message || '预览失败')
      cleanupPreviewUrl()
      previewKind.value = 'unknown'
    } finally {
      previewLoading.value = false
    }
  })()
}

watch(previewVisible, (v) => {
  if (!v) cleanupPreviewUrl()
})

watch(
  projectCode,
  (code) => {
    if (!code) return
    void loadList()
    void loadProjectInfo()
  },
  { immediate: true }
)
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
