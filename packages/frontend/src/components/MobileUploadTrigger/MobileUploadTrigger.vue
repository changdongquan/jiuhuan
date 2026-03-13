<template>
  <slot :open="open" :uploading="uploading"></slot>
  <input
    ref="inputRef"
    class="mobile-upload-trigger__input"
    type="file"
    :accept="accept"
    :multiple="multiple"
    @change="handleChange"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'

type UploadDataValue = string | number | boolean | Blob | File | null | undefined
type UploadDataRecord = Record<string, UploadDataValue | UploadDataValue[]>

const props = withDefaults(
  defineProps<{
    action: string
    headers?: Record<string, string>
    data?: UploadDataRecord
    accept?: string
    multiple?: boolean
    disabled?: boolean
    beforeUpload?: (file: File) => boolean | Promise<boolean>
  }>(),
  {
    headers: () => ({}),
    data: () => ({}),
    accept: '',
    multiple: false,
    disabled: false,
    beforeUpload: undefined
  }
)

const emit = defineEmits<{
  (e: 'success', payload: any, file: File): void
  (e: 'error', error: any, file: File): void
  (
    e: 'completed',
    summary: {
      total: number
      uploaded: number
      failed: number
      skipped: number
    }
  ): void
}>()

const inputRef = ref<HTMLInputElement | null>(null)
const uploading = ref(false)

const resetInput = () => {
  if (inputRef.value) inputRef.value.value = ''
}

const open = () => {
  if (props.disabled || uploading.value) return
  resetInput()
  inputRef.value?.click()
}

const appendFormDataEntry = (formData: FormData, key: string, value: UploadDataValue) => {
  if (value === null || value === undefined) return
  const blobLike = value as Blob
  if (typeof value === 'object' && blobLike instanceof Blob) {
    formData.append(key, blobLike)
    return
  }
  formData.append(key, String(value))
}

const buildPayloadFromResponse = async (resp: Response) => {
  const contentType = String(resp.headers.get('content-type') || '').toLowerCase()
  if (contentType.includes('application/json')) {
    return await resp.json().catch(() => null)
  }
  const text = await resp.text().catch(() => '')
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return { message: text }
  }
}

const normalizeError = (payload: any, status: number) => ({
  message: payload?.message || `上传失败（HTTP ${status}）`,
  status,
  response: { data: payload, status }
})

const handleChange = async (event: Event) => {
  const input = event.target as HTMLInputElement | null
  const files = Array.from(input?.files || [])

  if (!files.length || !props.action) {
    resetInput()
    return
  }

  uploading.value = true
  let uploaded = 0
  let failed = 0
  let skipped = 0

  try {
    for (const file of files) {
      try {
        if (props.beforeUpload) {
          const shouldUpload = await props.beforeUpload(file)
          if (!shouldUpload) {
            skipped += 1
            continue
          }
        }

        const formData = new FormData()
        formData.append('file', file)
        Object.entries(props.data || {}).forEach(([key, rawValue]) => {
          if (Array.isArray(rawValue)) {
            rawValue.forEach((item) => appendFormDataEntry(formData, key, item))
            return
          }
          appendFormDataEntry(formData, key, rawValue)
        })

        const resp = await fetch(props.action, {
          method: 'POST',
          body: formData,
          headers: props.headers
        })
        const payload = await buildPayloadFromResponse(resp)
        if (!resp.ok) throw normalizeError(payload, resp.status)

        const success = payload?.success ?? payload?.code === 0
        if (!success) throw normalizeError(payload, resp.status || 400)

        uploaded += 1
        emit('success', payload, file)
      } catch (error) {
        failed += 1
        emit('error', error, file)
      }
    }
  } finally {
    uploading.value = false
    emit('completed', {
      total: files.length,
      uploaded,
      failed,
      skipped
    })
    resetInput()
  }
}
</script>

<style scoped>
.mobile-upload-trigger__input {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
