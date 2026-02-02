<template>
  <el-drawer
    v-model="visible"
    :title="drawerTitle"
    size="70%"
    direction="rtl"
    destroy-on-close
    @close="handleClose"
  >
    <div class="pdd" v-loading="loading">
      <div class="pdd__top">
        <div class="pdd__meta">
          <el-tag v-if="drawing" type="info" effect="plain">图号：{{ drawing }}</el-tag>
          <span class="pdd__hint">PDF/图片可预览，3D 格式仅下载</span>
        </div>
        <div class="pdd__actions">
          <el-upload
            v-if="!readonly && drawing"
            :action="uploadAction"
            :data="uploadData"
            multiple
            :show-file-list="false"
            accept=".pdf,.dwg,.prt,.x_t,.x_b,.stp,.step,.igs,.iges,.sldprt,.sldasm,.asm,.par,.psm,.catpart,.catproduct"
            :on-success="handleUploadSuccess"
            :on-error="handleUploadError"
          >
            <el-button type="primary" size="small">上传</el-button>
          </el-upload>
          <el-button size="small" @click="refresh">刷新</el-button>
        </div>
      </div>

      <div class="pdd__body">
        <div class="pdd__list">
          <el-table :data="list" border size="small" style="width: 100%">
            <el-table-column type="index" label="序号" width="45" align="center" />
            <el-table-column label="文件名" min-width="160" show-overflow-tooltip>
              <template #default="{ row }">
                <span>{{ row.storedFileName || row.originalName }}</span>
              </template>
            </el-table-column>
            <el-table-column label="类型" width="60" align="center">
              <template #default="{ row }">
                <el-tag size="small">{{ fileKind(row) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="日期" width="100" show-overflow-tooltip>
              <template #default="{ row }">
                <span>{{ formatUploadedDate(row.uploadedAt) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="100" align="center">
              <template #default="{ row }">
                <div class="pdd__op-btns">
                  <el-button
                    v-if="guessPreviewKind(row) !== 'none'"
                    type="primary"
                    link
                    size="small"
                    @click="preview(row)"
                  >
                    预览
                  </el-button>
                  <el-button type="primary" link size="small" @click="download(row)">
                    下载
                  </el-button>
                  <el-button v-if="!readonly" type="danger" link size="small" @click="remove(row)">
                    删除
                  </el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <div class="pdd__preview">
          <div class="pdd__preview-toolbar">
            <el-button size="small" :disabled="!canPrev" @click="prevPreview">上一份</el-button>
            <el-button size="small" :disabled="!canNext" @click="nextPreview">下一份</el-button>
            <div class="pdd__preview-name" :title="previewName">{{ previewName || '—' }}</div>
          </div>

          <div class="pdd__preview-content">
            <el-empty v-if="!previewUrl" description="请选择左侧文件预览" :image-size="80" />
            <iframe
              v-else-if="previewKind === 'pdf'"
              class="pdd__iframe"
              :src="previewUrl"
              frameborder="0"
            ></iframe>
            <img v-else-if="previewKind === 'image'" class="pdd__img" :src="previewUrl" />
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
  getProjectAttachmentsApi,
  downloadProjectAttachmentApi,
  deleteProjectAttachmentApi,
  type ProjectAttachment
} from '@/api/project'
import { useAppStore } from '@/store/modules/app'

const props = defineProps<{
  modelValue: boolean
  projectCode: string
  drawing?: string | null
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

const drawing = computed(() => String(props.drawing || '').trim() || '')
const readonly = computed(() => !!props.readonly)
const loading = ref(false)
const all = ref<ProjectAttachment[]>([])
const drawerTitle = computed(() =>
  isMobile.value ? '零件图纸' : `零件图纸（${drawing.value || '—'}）`
)

const uploadAction = computed(
  () => `/api/project/${encodeURIComponent(props.projectCode)}/attachments/part-drawing`
)
const uploadData = computed(() => ({ drawing: drawing.value }))

const formatUploadedDate = (val?: string | null) => {
  const s = String(val || '').trim()
  if (!s) return '-'
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s)
  return m?.[1] || s
}

const list = computed(() => {
  const d = drawing.value
  if (!d) return []
  return all.value.filter((a) => String((a as any).drawing || '').trim() === d)
})

const formatFileName = (a: ProjectAttachment) =>
  a.storedFileName || a.originalName || `附件_${a.id}`

const fileKind = (a: ProjectAttachment) => {
  const name = formatFileName(a).toLowerCase()
  if (name.endsWith('.pdf')) return 'PDF'
  if (name.endsWith('.dwg')) return 'DWG'
  if (/\.(prt|x_t|x_b|stp|step|igs|iges|sldprt|sldasm|asm|par|psm|catpart|catproduct)$/.test(name))
    return '3D'
  if (
    String(a.contentType || '')
      .toLowerCase()
      .startsWith('image/')
  )
    return 'IMG'
  if (/\.(png|jpe?g|gif|webp|bmp|tiff?)$/.test(name)) return 'IMG'
  return 'FILE'
}

const guessPreviewKind = (a: ProjectAttachment): 'pdf' | 'image' | 'none' => {
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
    } catch {
      /* ignore */
    }
  }
  previewUrl.value = ''
}

const refresh = async () => {
  if (!props.projectCode) return
  loading.value = true
  try {
    const resp: any = await getProjectAttachmentsApi(props.projectCode, 'part-drawing')
    all.value = resp?.data?.data || resp?.data || []
  } catch (error) {
    console.error('加载零件图纸失败:', error)
    ElMessage.error('加载零件图纸失败')
    all.value = []
  } finally {
    loading.value = false
  }
}

const previewables = computed(() => list.value.filter((a) => guessPreviewKind(a) !== 'none'))

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

const preview = async (a: ProjectAttachment) => {
  const kind = guessPreviewKind(a)
  if (kind === 'none') {
    ElMessage.info('该文件不支持在线预览，请下载')
    return
  }

  try {
    clearPreviewUrl()
    const resp: any = await downloadProjectAttachmentApi(a.id)
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

const download = async (a: ProjectAttachment) => {
  try {
    const resp: any = await downloadProjectAttachmentApi(a.id)
    const blob = ((resp as any)?.data ?? resp) as Blob
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = formatFileName(a)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    ElMessage.success('下载成功')
  } catch (error) {
    console.error('下载失败:', error)
    ElMessage.error('下载失败')
  }
}

const remove = async (a: ProjectAttachment) => {
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
    await deleteProjectAttachmentApi(a.id)
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

const handleUploadSuccess = async (response: any) => {
  await refresh()
  ElMessage.success('上传成功')
  // 默认打开刚上传文件的预览（PDF/图片）
  const newId = response?.data?.id ?? response?.data?.data?.id
  if (newId != null) {
    const item = list.value.find((a) => a.id === newId)
    if (item && guessPreviewKind(item) !== 'none') {
      await preview(item)
    }
  }
}
const handleUploadError = (err: any) => {
  console.error('上传失败:', err)
  const msg = err?.response?.data?.message || err?.message || '上传失败'
  ElMessage.error(typeof msg === 'string' ? msg : '上传失败')
}

const handleClose = () => {
  clearPreviewUrl()
  previewId.value = null
  previewName.value = ''
  previewKind.value = 'none'
}

watch(
  () => props.modelValue,
  async (v) => {
    if (!v) return
    await refresh()
    // 只有一个 PDF 时默认打开预览
    if (list.value.length === 1 && guessPreviewKind(list.value[0]) === 'pdf') {
      await preview(list.value[0])
    }
  }
)

watch(
  () => [props.projectCode, props.drawing],
  () => {
    if (!props.modelValue) return
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
.pdd__top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  margin-bottom: 10px;
}

.pdd__meta {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.pdd__hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.pdd__actions {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 8px;
}

.pdd__actions :deep(.el-upload) {
  display: inline-flex;
  align-items: center;
}

.pdd__op-btns {
  display: flex;
  gap: 2px;
  justify-content: center;
  flex-wrap: wrap;
}

.pdd__op-btns :deep(.el-button) {
  padding-right: 6px;
  padding-left: 6px;
  margin: 0;
}

.pdd__body {
  display: grid;
  grid-template-columns: minmax(360px, 0.9fr) minmax(560px, 1.3fr);
  gap: 12px;
  height: calc(100vh - 220px);
}

.pdd__preview {
  display: flex;
  overflow: hidden;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  flex-direction: column;
}

.pdd__preview-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-bottom: 1px solid var(--el-border-color);
}

.pdd__preview-name {
  overflow: hidden;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.pdd__preview-content {
  display: flex;
  overflow: auto;
  background: var(--el-fill-color-lighter);
  flex: 1;
  align-items: center;
  justify-content: center;
}

.pdd__iframe {
  width: 100%;
  height: 100%;
}

.pdd__img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

@media (width <= 768px) {
  .pdd__body {
    grid-template-columns: 1fr;
    height: auto;
  }

  .pdd__hint {
    display: none;
  }
}
</style>
