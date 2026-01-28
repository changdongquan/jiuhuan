<template>
  <el-drawer
    v-model="visible"
    :title="drawerTitle"
    size="70%"
    direction="rtl"
    destroy-on-close
    @close="handleClose"
  >
    <div class="ird" v-loading="loading">
      <div class="ird__top">
        <div class="ird__meta">
          <el-tag v-if="bindingLabel" type="info" effect="plain">{{ bindingLabel }}</el-tag>
          <el-tag v-else type="info" effect="plain">未绑定</el-tag>
          <span class="ird__hint">PDF/图片可预览，Excel 仅下载</span>
        </div>
        <div class="ird__actions">
          <el-upload
            v-if="!readonly"
            :action="uploadAction"
            :data="uploadData"
            multiple
            :show-file-list="false"
            accept=".pdf,.xls,.xlsx,image/*"
            :on-success="handleUploadSuccess"
            :on-error="handleUploadError"
          >
            <el-button type="primary" size="small" :disabled="!canUpload">上传</el-button>
          </el-upload>
          <el-button size="small" @click="refresh">刷新</el-button>
        </div>
      </div>

      <div class="ird__body">
        <div class="ird__list">
          <el-tabs v-model="activeGroup" class="ird__tabs">
            <el-tab-pane :label="`本行（${currentList.length}）`" name="current">
              <el-table :data="currentList" border size="small" style="width: 100%">
                <el-table-column type="index" label="序号" width="54" align="center" />
                <el-table-column label="文件名" min-width="220" show-overflow-tooltip>
                  <template #default="{ row }">
                    <span>{{ row.storedFileName || row.originalName }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="类型" width="80" align="center">
                  <template #default="{ row }">
                    <el-tag size="small">{{ fileKind(row) }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="上传时间" width="150" show-overflow-tooltip>
                  <template #default="{ row }">
                    <span>{{ row.uploadedAt || '-' }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="190" align="center">
                  <template #default="{ row }">
                    <div style="display: flex; gap: 8px; justify-content: center">
                      <el-button type="primary" link size="small" @click="preview(row)"
                        >预览</el-button
                      >
                      <el-button type="primary" link size="small" @click="download(row)"
                        >下载</el-button
                      >
                      <el-button
                        v-if="!readonly"
                        type="danger"
                        link
                        size="small"
                        @click="remove(row)"
                      >
                        删除
                      </el-button>
                    </div>
                  </template>
                </el-table-column>
              </el-table>
            </el-tab-pane>

            <el-tab-pane :label="`未绑定/已删除行（${orphanList.length}）`" name="orphan">
              <el-table :data="orphanList" border size="small" style="width: 100%">
                <el-table-column type="index" label="序号" width="54" align="center" />
                <el-table-column label="文件名" min-width="220" show-overflow-tooltip>
                  <template #default="{ row }">
                    <span>{{ row.storedFileName || row.originalName }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="类型" width="80" align="center">
                  <template #default="{ row }">
                    <el-tag size="small">{{ fileKind(row) }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="上传时间" width="150" show-overflow-tooltip>
                  <template #default="{ row }">
                    <span>{{ row.uploadedAt || '-' }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="150" align="center">
                  <template #default="{ row }">
                    <div style="display: flex; gap: 8px; justify-content: center">
                      <el-button type="primary" link size="small" @click="preview(row)"
                        >预览</el-button
                      >
                      <el-button type="primary" link size="small" @click="download(row)"
                        >下载</el-button
                      >
                    </div>
                  </template>
                </el-table-column>
              </el-table>
            </el-tab-pane>
          </el-tabs>
        </div>

        <div class="ird__preview">
          <div class="ird__preview-toolbar">
            <el-button size="small" :disabled="!canPrev" @click="prevPreview">上一份</el-button>
            <el-button size="small" :disabled="!canNext" @click="nextPreview">下一份</el-button>
            <div class="ird__preview-name" :title="previewName">{{ previewName || '—' }}</div>
          </div>

          <div class="ird__preview-content">
            <el-empty v-if="!previewUrl" description="请选择左侧文件预览" :image-size="80" />
            <iframe
              v-else-if="previewKind === 'pdf'"
              class="ird__iframe"
              :src="previewUrl"
              frameborder="0"
            ></iframe>
            <img v-else-if="previewKind === 'image'" class="ird__img" :src="previewUrl" />
            <el-empty v-else description="该文件不支持在线预览，请下载" :image-size="80" />
          </div>
        </div>
      </div>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  deleteProjectInspectionReportApi,
  downloadProjectInspectionReportApi,
  getProjectInspectionReportsApi,
  type ProjectInspectionReportAttachment
} from '@/api/project'
import { useAppStore } from '@/store/modules/app'

const props = defineProps<{
  modelValue: boolean
  projectCode: string
  drawing?: string | null
  rowIndex?: number | null
  readonly?: boolean
}>()
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
}>()

const appStore = useAppStore()
const isMobile = computed(() => appStore.getMobile)

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

const readonly = computed(() => !!props.readonly)
const loading = ref(false)
const all = ref<ProjectInspectionReportAttachment[]>([])
const activeGroup = ref<'current' | 'orphan'>('current')

const bindingLabel = computed(() => {
  const drawing = String(props.drawing || '').trim()
  if (drawing) return `图号：${drawing}`
  if (props.rowIndex !== null && props.rowIndex !== undefined)
    return `行序号：${props.rowIndex + 1}`
  return ''
})

const drawerTitle = computed(() => (isMobile.value ? '检验报告' : '检验报告（抽屉预览）'))

const uploadAction = computed(
  () => `/api/project/${encodeURIComponent(props.projectCode)}/attachments/inspection-report`
)
const uploadData = computed(() => ({
  drawing: String(props.drawing || '').trim() || '',
  rowIndex:
    props.rowIndex === null || props.rowIndex === undefined || Number.isNaN(Number(props.rowIndex))
      ? ''
      : String(props.rowIndex)
}))
const canUpload = computed(() => {
  const drawing = String(props.drawing || '').trim()
  const rowIndexOk = props.rowIndex !== null && props.rowIndex !== undefined
  return !!props.projectCode && (drawing.length > 0 || rowIndexOk)
})

const currentList = computed(() => {
  const drawing = String(props.drawing || '').trim()
  const rowIndex = props.rowIndex
  return all.value.filter((a) => {
    if (a.isOrphan) return false
    if (drawing) return String(a.drawing || '').trim() === drawing
    if (rowIndex === null || rowIndex === undefined) return false
    return !String(a.drawing || '').trim() && a.rowIndex === rowIndex
  })
})

const orphanList = computed(() => all.value.filter((a) => !!a.isOrphan))

const formatFileName = (a: ProjectInspectionReportAttachment) =>
  a.storedFileName || a.originalName || `附件_${a.id}`

const fileKind = (a: ProjectInspectionReportAttachment) => {
  const name = formatFileName(a).toLowerCase()
  if (name.endsWith('.pdf')) return 'PDF'
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) return 'XLSX'
  if (
    String(a.contentType || '')
      .toLowerCase()
      .startsWith('image/')
  )
    return 'IMG'
  if (/\.(png|jpe?g|gif|webp|bmp|tiff?)$/.test(name)) return 'IMG'
  return 'FILE'
}

const guessPreviewKind = (a: ProjectInspectionReportAttachment): 'pdf' | 'image' | 'none' => {
  const name = formatFileName(a).toLowerCase()
  if (name.endsWith('.pdf')) return 'pdf'
  if (
    String(a.contentType || '')
      .toLowerCase()
      .startsWith('image/')
  )
    return 'image'
  if (/\.(png|jpe?g|gif|webp|bmp|tiff?)$/.test(name)) return 'image'
  return 'none'
}

const previewUrl = ref<string>('')
const previewName = ref<string>('')
const previewKind = ref<'pdf' | 'image' | 'none'>('none')
const previewId = ref<number | null>(null)

const clearPreviewUrl = () => {
  if (previewUrl.value) {
    try {
      window.URL.revokeObjectURL(previewUrl.value)
    } catch {}
  }
  previewUrl.value = ''
}

const refresh = async () => {
  if (!props.projectCode) return
  loading.value = true
  try {
    const resp: any = await getProjectInspectionReportsApi(props.projectCode)
    all.value = resp?.data?.data || resp?.data || []
  } catch (error) {
    console.error('加载检验报告失败:', error)
    ElMessage.error('加载检验报告失败')
    all.value = []
  } finally {
    loading.value = false
  }
}

const previewables = computed(() => {
  const base = activeGroup.value === 'orphan' ? orphanList.value : currentList.value
  return base.filter((a) => guessPreviewKind(a) !== 'none')
})

const canPrev = computed(() => {
  if (!previewId.value) return false
  const idx = previewables.value.findIndex((a) => a.id === previewId.value)
  return idx > 0
})
const canNext = computed(() => {
  if (!previewId.value) return false
  const idx = previewables.value.findIndex((a) => a.id === previewId.value)
  return idx >= 0 && idx < previewables.value.length - 1
})

const preview = async (a: ProjectInspectionReportAttachment) => {
  const kind = guessPreviewKind(a)
  if (kind === 'none') {
    ElMessage.info('该文件不支持在线预览，请下载')
    return
  }

  try {
    clearPreviewUrl()
    const resp: any = await downloadProjectInspectionReportApi(a.id)
    const blob = (resp as any)?.data ?? resp
    const url = window.URL.createObjectURL(blob as Blob)
    previewUrl.value = url
    previewName.value = formatFileName(a)
    previewKind.value = kind
    previewId.value = a.id
  } catch (error) {
    console.error('预览失败:', error)
    ElMessage.error('预览失败')
  }
}

const prevPreview = async () => {
  if (!previewId.value) return
  const idx = previewables.value.findIndex((a) => a.id === previewId.value)
  if (idx <= 0) return
  await preview(previewables.value[idx - 1])
}
const nextPreview = async () => {
  if (!previewId.value) return
  const idx = previewables.value.findIndex((a) => a.id === previewId.value)
  if (idx < 0 || idx >= previewables.value.length - 1) return
  await preview(previewables.value[idx + 1])
}

const download = async (a: ProjectInspectionReportAttachment) => {
  try {
    const resp: any = await downloadProjectInspectionReportApi(a.id)
    const blob = ((resp as any)?.data ?? resp) as Blob
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = formatFileName(a)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  } catch (error) {
    console.error('下载失败:', error)
    ElMessage.error('下载失败')
  }
}

const remove = async (a: ProjectInspectionReportAttachment) => {
  if (readonly.value) return
  try {
    await ElMessageBox.confirm(`确定删除：${formatFileName(a)}？`, '提示', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
      closeOnClickModal: false
    })
  } catch {
    return
  }

  try {
    await deleteProjectInspectionReportApi(a.id)
    await refresh()
    if (previewId.value === a.id) {
      clearPreviewUrl()
      previewId.value = null
      previewName.value = ''
      previewKind.value = 'none'
    }
    ElMessage.success('删除成功')
  } catch (error) {
    console.error('删除失败:', error)
    ElMessage.error('删除失败')
  }
}

const handleUploadSuccess = async () => {
  await refresh()
  ElMessage.success('上传成功')
}
const handleUploadError = (err: any) => {
  console.error('上传失败:', err)
  ElMessage.error('上传失败')
}

const handleClose = () => {
  activeGroup.value = 'current'
  clearPreviewUrl()
  previewId.value = null
  previewName.value = ''
  previewKind.value = 'none'
}

watch(
  () => props.modelValue,
  (v) => {
    if (v) void refresh()
  }
)

watch(
  () => [props.projectCode, props.drawing, props.rowIndex],
  () => {
    if (!props.modelValue) return
    activeGroup.value = 'current'
    clearPreviewUrl()
    previewId.value = null
    previewName.value = ''
    previewKind.value = 'none'
  }
)

onBeforeUnmount(() => {
  clearPreviewUrl()
})
</script>

<style scoped>
.ird__top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  margin-bottom: 10px;
}

.ird__meta {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.ird__hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.ird__actions {
  display: flex;
  gap: 8px;
}

.ird__body {
  display: grid;
  grid-template-columns: minmax(420px, 1fr) minmax(420px, 1fr);
  gap: 12px;
  height: calc(100vh - 220px);
}

.ird__preview {
  display: flex;
  overflow: hidden;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  flex-direction: column;
}

.ird__preview-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-bottom: 1px solid var(--el-border-color);
}

.ird__preview-name {
  overflow: hidden;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.ird__preview-content {
  display: flex;
  overflow: auto;
  background: var(--el-fill-color-lighter);
  flex: 1;
  align-items: center;
  justify-content: center;
}

.ird__iframe {
  width: 100%;
  height: 100%;
}

.ird__img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

@media (width <= 768px) {
  .ird__body {
    grid-template-columns: 1fr;
    height: auto;
  }

  .ird__hint {
    display: none;
  }
}
</style>
