<template>
  <el-dialog
    v-model="visible"
    title="外部导入"
    width="1320px"
    :close-on-click-modal="false"
    @open="handleOpen"
    @closed="handleClosed"
  >
    <div
      ref="rootRef"
      class="external-import"
      tabindex="0"
      @paste="handlePaste"
      @dragenter.prevent
      @dragover.prevent
      @drop.prevent="handleDrop"
    >
      <div class="external-import__uploader">
        <div class="external-import__dropzone" :class="{ 'is-dragging': isDragging }">
          <div
            class="external-import__dropzone-content"
            @dragenter="isDragging = true"
            @dragleave="isDragging = false"
          >
            <div class="external-import__dropzone-title"
              >拖拽文件到此处 / 粘贴文件 / 或选择文件</div
            >
            <div class="external-import__dropzone-subtitle">支持多文件，仅支持 PDF（文字版）</div>
            <div class="external-import__actions">
              <el-button type="primary" @click="openFilePicker" :loading="isBusy"
                >打开文件</el-button
              >
              <el-button @click="reset" :disabled="items.length === 0 || isBusy">清空</el-button>
            </div>
            <div v-if="items.length" class="external-import__file"
              >已选择 {{ items.length }} 个文件</div
            >
          </div>
        </div>

        <input
          ref="fileInputRef"
          class="external-import__file-input"
          type="file"
          accept="application/pdf"
          multiple
          @change="handleFileChange"
        />
      </div>

      <div v-if="items.length" class="mt-3">
        <el-collapse v-model="activeNames">
          <el-collapse-item v-for="item in items" :key="item.id" :name="item.id">
            <template #title>
              <span class="external-import__item-title">{{ item.fileName }}</span>
              <span class="external-import__item-meta">
                <span v-if="item.parsing">解析中…</span>
                <span v-else-if="item.error" class="external-import__item-error">失败</span>
                <span v-else-if="item.result">成功</span>
              </span>
              <el-button
                class="external-import__item-remove"
                text
                type="danger"
                size="small"
                :disabled="item.parsing"
                @click.stop="removeItem(item.id)"
              >
                移除
              </el-button>
            </template>

            <el-alert
              v-if="item.error"
              type="error"
              :closable="false"
              class="mb-3"
              :title="item.error"
              show-icon
            />

            <div v-if="item.result">
              <el-descriptions :column="3" border>
                <el-descriptions-item label="单据类型">移模单</el-descriptions-item>
                <el-descriptions-item label="模具移模时间">{{
                  item.result.mouldMoveDate
                }}</el-descriptions-item>
                <el-descriptions-item label="明细条数">{{
                  item.result.rows.length
                }}</el-descriptions-item>
              </el-descriptions>

              <el-divider content-position="left">明细表</el-divider>
              <el-table
                :data="item.displayRows"
                :max-height="320"
                border
                row-key="index"
                @selection-change="(rows) => handleSelectionChange(item.id, rows)"
              >
                <el-table-column
                  type="selection"
                  width="48"
                  :selectable="(row) => canSelectRow(row)"
                />
                <el-table-column prop="index" label="#" width="60" />
                <el-table-column prop="partNo" label="零件图号" min-width="160" />
                <el-table-column prop="mouldName" label="模具名称" min-width="160" />
                <el-table-column prop="mouldNo" label="模具编号" min-width="130" />
                <el-table-column prop="mouldFactory" label="模具厂家" min-width="120">
                  <template #default="{ row }">
                    <el-tag
                      v-if="row.mouldFactory === TARGET_FACTORY"
                      size="small"
                      type="success"
                      effect="light"
                    >
                      {{ row.mouldFactory }}
                    </el-tag>
                    <el-tag v-else size="small" type="danger" effect="light">{{
                      row.mouldFactory || '-'
                    }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="moveTo" label="移至地方" min-width="120" />
                <el-table-column prop="sealSampleNo" label="封样单号" min-width="220" />
                <el-table-column prop="projectCode" label="项目编号" min-width="140">
                  <template #default="{ row }">
                    <el-tag v-if="row.isUseless" size="small" type="info" effect="light">
                      跳过
                    </el-tag>
                    <el-tag
                      v-else-if="row.projectStatus === 'pending'"
                      size="small"
                      type="info"
                      effect="light"
                    >
                      查询中…
                    </el-tag>
                    <el-select
                      v-else-if="row.projectStatus === 'multi'"
                      v-model="row.projectCode"
                      size="small"
                      placeholder="多匹配"
                      style="width: 128px"
                      @change="(v) => handleProjectCodeSelect(item.id, row, String(v))"
                    >
                      <el-option
                        v-for="code in row.projectCandidates"
                        :key="code"
                        :label="code"
                        :value="code"
                      />
                    </el-select>
                    <el-tag
                      v-else-if="row.projectStatus === 'matched' && row.projectCode"
                      size="small"
                      type="success"
                      effect="light"
                    >
                      {{ row.projectCode }}
                    </el-tag>
                    <span v-else>-</span>
                  </template>
                </el-table-column>
                <el-table-column label="导入状态" min-width="120">
                  <template #default="{ row }">
                    <el-tag v-if="row.importStatus === 'success'" size="small" type="success">
                      已导入
                    </el-tag>
                    <el-tag v-else-if="row.importStatus === 'error'" size="small" type="danger">
                      失败
                    </el-tag>
                    <el-tag
                      v-else-if="row.importStatus === 'skipped'"
                      size="small"
                      type="info"
                      effect="light"
                    >
                      跳过
                    </el-tag>
                    <span v-else>-</span>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </el-collapse-item>
        </el-collapse>
      </div>
    </div>

    <template #footer>
      <el-button @click="visible = false">关闭</el-button>
      <el-button
        type="primary"
        :disabled="selectedCount === 0 || isBusy"
        :loading="isImporting"
        @click="handleImport"
      >
        导入（已选 {{ selectedCount }} 条）
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getProjectDetailApi,
  getProjectListApi,
  relocationImportApi,
  uploadProjectAttachmentApi,
  type RelocationImportOverwriteMode
} from '@/api/project'
import { extractPdfText } from '@/utils/pdf/extractPdfText'
import {
  parseMouldTransferFromText,
  type MouldTransferImportResult
} from '@/utils/pdf/mouldTransferParser'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'imported'): void
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

type ImportItem = {
  id: string
  addedAt: number
  fileName: string
  fileKey: string
  file: File
  parsing: boolean
  error: string
  result: MouldTransferImportResult | null
  projectMatches: Record<
    string,
    {
      status: 'pending' | 'matched' | 'multi' | 'none'
      candidates: string[]
      selectedCode: string
    }
  >
  displayRows: ImportRow[]
}

const rootRef = ref<HTMLElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const items = ref<ImportItem[]>([])
const activeNames = ref<string[]>([])
const isDragging = ref(false)
const isBusy = computed(() => items.value.some((i) => i.parsing))
const isImporting = ref(false)

type ImportRow = MouldTransferImportResult['rows'][number] & {
  sourceItemId: string
  sourceAddedAt: number
  projectKey: string
  isUseless: boolean
  projectStatus: 'pending' | 'matched' | 'multi' | 'none' | 'skipped'
  projectCandidates: string[]
  projectCode: string
  importStatus: '' | 'success' | 'error' | 'skipped'
}

const normalizeKey = (v: unknown) => String(v ?? '').trim()
const pairKey = (name: string, mouldNo: string) => `${name}\u0000${mouldNo}`
const TARGET_FACTORY = '久环'

type ProjectListItem = {
  项目编号?: string
  productName?: string
  产品名称?: string
  客户模号?: string
}

const extractProjectList = (resp: any): ProjectListItem[] => {
  const list = resp?.data?.data?.list ?? resp?.data?.list ?? []
  return Array.isArray(list) ? list : []
}

const fetchProjectCodes = async (mouldName: string, mouldNo: string): Promise<string[]> => {
  const name = normalizeKey(mouldName)
  const no = normalizeKey(mouldNo)
  if (!name || !no) return []

  const fetchByKeyword = async (keyword: string) => {
    const response: any = await getProjectListApi({ keyword, page: 1, pageSize: 200 })
    return extractProjectList(response)
  }

  const candidates = [...(await fetchByKeyword(no)), ...(await fetchByKeyword(name))]
  const matches = candidates.filter((p) => {
    const pn = normalizeKey(p.productName || p.产品名称)
    const mn = normalizeKey(p['客户模号'])
    const code = normalizeKey(p['项目编号'])
    return code && pn === name && mn === no
  })

  return Array.from(new Set(matches.map((m) => normalizeKey(m['项目编号'])))).filter(Boolean)
}

const applyProjectMatchToRows = (item: ImportItem, key: string) => {
  const match = item.projectMatches[key]
  for (const row of item.displayRows) {
    if (row.projectKey !== key) continue
    if (row.isUseless) {
      row.projectStatus = 'skipped'
      row.projectCandidates = []
      row.projectCode = ''
      continue
    }
    row.projectCandidates = match?.candidates ?? []
    row.projectCode = match?.selectedCode ?? ''
    row.projectStatus = row.projectCode
      ? 'matched'
      : match?.status === 'pending'
        ? 'pending'
        : match?.status === 'multi'
          ? 'multi'
          : 'none'
  }
}

const hydrateProjectCodes = async (item: ImportItem) => {
  for (const row of item.displayRows) {
    if (row.isUseless) continue
    const key = row.projectKey
    if (!key || item.projectMatches[key]) continue
    try {
      item.projectMatches[key] = {
        status: 'pending',
        candidates: [],
        selectedCode: ''
      }
      applyProjectMatchToRows(item, key)

      const codes = await fetchProjectCodes(row.mouldName, row.mouldNo)
      if (codes.length === 1) {
        item.projectMatches[key] = { status: 'matched', candidates: codes, selectedCode: codes[0] }
      } else if (codes.length > 1) {
        item.projectMatches[key] = { status: 'multi', candidates: codes, selectedCode: '' }
      } else {
        item.projectMatches[key] = { status: 'none', candidates: [], selectedCode: '' }
      }
      applyProjectMatchToRows(item, key)
    } catch {
      item.projectMatches[key] = { status: 'none', candidates: [], selectedCode: '' }
      applyProjectMatchToRows(item, key)
    }
  }
}

const canSelectRow = (row: ImportRow) =>
  !row.isUseless && row.projectStatus === 'matched' && !!normalizeKey(row.projectCode)

const selectedRowsByItem = ref<Record<string, ImportRow[]>>({})

const handleSelectionChange = (itemId: string, rows: ImportRow[]) => {
  selectedRowsByItem.value = { ...selectedRowsByItem.value, [itemId]: rows }
}

const selectedCount = computed(() =>
  Object.values(selectedRowsByItem.value).reduce((sum, rows) => sum + (rows?.length || 0), 0)
)

const handleProjectCodeSelect = (itemId: string, row: ImportRow, code: string) => {
  const item = items.value.find((x) => x.id === itemId)
  if (!item) return

  const key = row.projectKey
  const match = item.projectMatches[key]
  if (!match) return

  item.projectMatches[key] = { ...match, selectedCode: code, status: 'matched' }
  applyProjectMatchToRows(item, key)
}

const handleOpen = async () => {
  await nextTick()
  rootRef.value?.focus()
  activeNames.value = items.value.map((i) => i.id)
}

const handleClosed = () => {
  reset()
}

const reset = () => {
  items.value = []
  activeNames.value = []
  isDragging.value = false
  selectedRowsByItem.value = {}
  if (fileInputRef.value) fileInputRef.value.value = ''
}

const openFilePicker = () => fileInputRef.value?.click()

const isPdfFile = (file: File) =>
  file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')

const fileKeyOf = (file: File) => `${file.name}::${file.size}::${file.lastModified}`

const ensureItem = (file: File): ImportItem | null => {
  if (!isPdfFile(file)) {
    ElMessage.error(`仅支持 PDF 文件：${file.name}`)
    return null
  }

  const fileKey = fileKeyOf(file)
  const existing = items.value.find((i) => i.fileKey === fileKey)
  if (existing) {
    activeNames.value = Array.from(new Set([existing.id, ...activeNames.value]))
    return existing
  }

  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`
  const addedAt = Date.now()
  const item = reactive<ImportItem>({
    id,
    addedAt,
    fileName: file.name,
    fileKey,
    file,
    parsing: false,
    error: '',
    result: null,
    projectMatches: {},
    displayRows: []
  })
  items.value.unshift(item)
  activeNames.value = Array.from(new Set([item.id, ...activeNames.value]))
  return item
}

const parseItem = async (item: ImportItem, file: File) => {
  item.parsing = true
  item.error = ''
  item.result = null
  item.projectMatches = {}
  item.displayRows = []

  try {
    const buf = await file.arrayBuffer()
    const text = await extractPdfText(buf)
    const parsed = parseMouldTransferFromText(text)
    if (!parsed.ok) {
      item.error = parsed.error
      return
    }
    item.result = parsed.data
    item.displayRows = parsed.data.rows.map((r) => {
      const isUseless = normalizeKey(r.mouldFactory) !== TARGET_FACTORY
      const key = pairKey(normalizeKey(r.mouldName), normalizeKey(r.mouldNo))
      return {
        ...r,
        sourceItemId: item.id,
        sourceAddedAt: item.addedAt,
        projectKey: key,
        isUseless,
        projectStatus: isUseless ? 'skipped' : 'none',
        projectCandidates: [],
        projectCode: '',
        importStatus: ''
      }
    })
    void hydrateProjectCodes(item)
  } catch (e) {
    item.error = `解析失败：${(e as Error)?.message || String(e)}`
  } finally {
    item.parsing = false
  }
}

const parseFiles = async (files: File[]) => {
  const pdfFiles = files.filter(isPdfFile)
  if (!pdfFiles.length) return

  const toParse: Array<{ file: File; item: ImportItem }> = []
  for (const f of pdfFiles) {
    const it = ensureItem(f)
    if (it) toParse.push({ file: f, item: it })
  }

  activeNames.value = items.value.map((i) => i.id)

  for (const { file, item } of toParse) {
    await parseItem(item, file)
  }

  const allOk = toParse.length > 0 && toParse.every(({ item }) => item.result && !item.error)
  if (allOk) ElMessage.success('读取成功')
}

const removeItem = (id: string) => {
  items.value = items.value.filter((i) => i.id !== id)
  activeNames.value = activeNames.value.filter((n) => n !== id)
  const { [id]: _removed, ...rest } = selectedRowsByItem.value
  selectedRowsByItem.value = rest
}

const handleFileChange = async (ev: Event) => {
  const input = ev.target as HTMLInputElement
  const files = Array.from(input.files || [])
  if (!files.length) return
  await parseFiles(files)
}

const handleDrop = async (ev: DragEvent) => {
  isDragging.value = false
  const files = Array.from(ev.dataTransfer?.files || [])
  if (!files.length) return
  await parseFiles(files)
}

const handlePaste = async (ev: ClipboardEvent) => {
  const files = Array.from(ev.clipboardData?.files || [])
  if (!files.length) return
  await parseFiles(files)
}

const escapeHtml = (input: unknown) =>
  String(input ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')

const extractProjectDetail = (resp: any): any => {
  const data = resp?.data?.data ?? resp?.data ?? null
  if (!data) return null
  if (Array.isArray(data)) return data[0] ?? null
  return data
}

const fetchExistingFields = async (projectCode: string) => {
  const response: any = await getProjectDetailApi(projectCode)
  const detail = extractProjectDetail(response) || {}
  return {
    projectCode,
    制件厂家: normalizeKey(detail.制件厂家),
    移模日期: normalizeKey(detail.移模日期),
    封样单号: normalizeKey(detail.封样单号)
  }
}

const buildExistingFieldsHtml = (rows: Array<any>) => {
  const filled = rows.filter((r) => r.制件厂家 || r.移模日期 || r.封样单号)
  if (!filled.length) return ''

  const body = filled
    .map((r) => {
      const cells = [
        escapeHtml(r.projectCode),
        escapeHtml(r.制件厂家 || '-'),
        escapeHtml(r.移模日期 || '-'),
        escapeHtml(r.封样单号 || '-')
      ]
      return `<tr>${cells.map((c) => `<td style="padding:6px 8px;border:1px solid #ebeef5;">${c}</td>`).join('')}</tr>`
    })
    .join('')

  return `
    <div style="margin-top:10px;">
      <div style="margin-bottom:6px;color:#606266;">以下项目已有字段值：</div>
      <div style="max-height:220px;overflow:auto;">
        <table style="border-collapse:collapse;width:100%;font-size:12px;">
          <thead>
            <tr>
              <th style="padding:6px 8px;border:1px solid #ebeef5;background:#f5f7fa;text-align:left;">项目编号</th>
              <th style="padding:6px 8px;border:1px solid #ebeef5;background:#f5f7fa;text-align:left;">制件厂家</th>
              <th style="padding:6px 8px;border:1px solid #ebeef5;background:#f5f7fa;text-align:left;">移模日期</th>
              <th style="padding:6px 8px;border:1px solid #ebeef5;background:#f5f7fa;text-align:left;">封样单号</th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </div>
  `
}

const chooseOverwriteMode = async (
  existingFieldsHtml: string
): Promise<RelocationImportOverwriteMode | null> => {
  try {
    await ElMessageBox.confirm(
      `
      <div>若目标字段已有值：请选择“覆盖”或“跳过已有（字段级跳过，其他字段仍可写）”。</div>
      <div style="margin-top:6px;color:#909399;">空值不会写入。</div>
      ${existingFieldsHtml}
      `,
      '导入确认',
      {
        confirmButtonText: '覆盖',
        cancelButtonText: '跳过已有',
        showCancelButton: true,
        distinguishCancelAndClose: true,
        type: 'warning',
        dangerouslyUseHTMLString: true
      }
    )
    return 'overwrite'
  } catch (action) {
    if (action === 'cancel') return 'skipExisting'
    return null
  }
}

const handleImport = async () => {
  if (isBusy.value || isImporting.value) return
  if (selectedCount.value === 0) {
    ElMessage.warning('请先勾选需要导入的明细行')
    return
  }

  isImporting.value = true
  try {
    const selectedRows = Object.values(selectedRowsByItem.value).flat()

    // 聚合：同一项目编号只导入一次（最后一条非空覆盖），同时用于“最后一个文件覆盖”
    const aggregated = new Map<
      string,
      {
        projectCode: string
        moveTo: string
        sealSampleNo: string
        mouldMoveDate: string
        file: File
        addedAt: number
        rowIndex: number
      }
    >()

    const findItemById = (id: string) => items.value.find((x) => x.id === id) || null

    for (const row of selectedRows) {
      const projectCode = normalizeKey(row.projectCode)
      if (!projectCode) continue
      const item = findItemById(row.sourceItemId)
      const mouldMoveDate = normalizeKey(item?.result?.mouldMoveDate)
      const addedAt = row.sourceAddedAt
      const rowIndex = Number(row.index || 0)
      const file = item?.file
      if (!file) continue

      const prev = aggregated.get(projectCode)
      const isLater =
        !prev || addedAt > prev.addedAt || (addedAt === prev.addedAt && rowIndex >= prev.rowIndex)

      const moveTo = normalizeKey(row.moveTo)
      const sealSampleNo = normalizeKey(row.sealSampleNo)

      if (!prev) {
        aggregated.set(projectCode, {
          projectCode,
          moveTo,
          sealSampleNo,
          mouldMoveDate,
          file,
          addedAt,
          rowIndex
        })
        continue
      }

      const next = { ...prev }
      if (isLater) {
        if (normalizeKey(mouldMoveDate)) next.mouldMoveDate = mouldMoveDate
        next.file = file
        next.addedAt = addedAt
        next.rowIndex = rowIndex
      }
      if (isLater && moveTo) next.moveTo = moveTo
      if (isLater && sealSampleNo) next.sealSampleNo = sealSampleNo

      aggregated.set(projectCode, next)
    }

    const existing = await Promise.all(
      Array.from(aggregated.keys()).map((c) => fetchExistingFields(c))
    )
    const existingHtml = buildExistingFieldsHtml(existing)

    const overwriteMode = await chooseOverwriteMode(existingHtml)
    if (!overwriteMode) return

    const payloadItems = Array.from(aggregated.values()).map((x) => ({
      projectCode: x.projectCode,
      moveTo: x.moveTo,
      sealSampleNo: x.sealSampleNo,
      mouldMoveDate: x.mouldMoveDate
    }))

    const resp: any = await relocationImportApi({ overwriteMode, items: payloadItems })
    const results: Array<any> = resp?.data?.data?.results ?? resp?.data?.results ?? []
    const resultMap = new Map<string, any>()
    for (const r of results) {
      const code = normalizeKey(r?.projectCode)
      if (code) resultMap.set(code, r)
    }

    // 标记每行导入结果
    for (const item of items.value) {
      for (const row of item.displayRows) {
        if (!row.projectCode || row.isUseless) continue
        const r = resultMap.get(normalizeKey(row.projectCode))
        if (!r) continue
        row.importStatus = r.ok ? 'success' : 'error'
      }
    }

    // 自动上传“移模流程单”：只要本次勾选到该项目，就上传；同项目多文件时，保留最后一个文件
    const uploadTargets = Array.from(aggregated.values())
      .filter((x) => resultMap.get(x.projectCode)?.ok)
      .sort((a, b) => a.addedAt - b.addedAt)

    const uploadErrors: string[] = []
    for (const t of uploadTargets) {
      try {
        await uploadProjectAttachmentApi(t.projectCode, 'relocation-process', t.file)
      } catch (e) {
        uploadErrors.push(`${t.projectCode}: ${(e as Error)?.message || String(e)}`)
      }
    }

    if (uploadErrors.length) {
      ElMessage.warning(`导入完成，但部分上传失败：${uploadErrors.length} 项`)
    } else {
      ElMessage.success('导入完成并上传封样单')
    }

    emit('imported')
  } catch (e) {
    ElMessage.error(`导入失败：${(e as Error)?.message || String(e)}`)
  } finally {
    isImporting.value = false
  }
}
</script>

<style scoped>
.external-import__file-input {
  display: none;
}

.external-import__item-title {
  margin-right: 10px;
}

.external-import__item-meta {
  margin-right: 10px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.external-import__item-error {
  color: var(--el-color-danger);
}

.external-import__item-remove {
  margin-left: 8px;
}

.external-import__dropzone {
  padding: 16px;
  background: var(--el-bg-color-overlay);
  border: 1px dashed var(--el-border-color);
  border-radius: 10px;
}

.external-import__dropzone.is-dragging {
  background: rgb(64 158 255 / 6%);
  border-color: var(--el-color-primary);
}

.external-import__dropzone-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.external-import__dropzone-subtitle {
  margin-top: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.external-import__actions {
  display: flex;
  margin-top: 12px;
  gap: 10px;
  flex-wrap: wrap;
}

.external-import__file {
  margin-top: 10px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  word-break: break-all;
}
</style>
