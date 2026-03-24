<template>
  <div class="bom-workspace">
    <div class="bom-category-strip">
      <button
        v-for="card in categoryCards"
        :key="card.key"
        type="button"
        class="bom-category-card"
        :class="{ 'is-active': activeCategory === card.key }"
        @click="setActiveCategory(card.key)"
      >
        <span class="bom-category-card__title">{{ card.label }}</span>
        <span class="bom-category-card__meta"
          >{{ card.sheetCount }} 张子表 / {{ card.itemCount }} 条</span
        >
      </button>
    </div>

    <div class="bom-layout">
      <aside class="bom-sheet-panel">
        <div class="bom-sheet-panel__header">
          <div>
            <div class="bom-sheet-panel__title">{{ currentCategoryLabel }}</div>
            <div class="bom-sheet-panel__subtitle">支持同分类下新增多张 BOM 子表</div>
          </div>
          <el-button type="primary" size="small" :disabled="readonly" @click="addSheet">
            新增子表
          </el-button>
        </div>

        <div class="bom-sheet-list">
          <button
            v-for="sheet in activeSheets"
            :key="sheet.id"
            type="button"
            class="bom-sheet-card"
            :class="{ 'is-active': sheet.id === activeSheetId }"
            @click="activeSheetId = sheet.id"
          >
            <span class="bom-sheet-card__head">
              <span class="bom-sheet-card__name">{{ sheet.name }}</span>
              <el-button
                type="danger"
                link
                size="small"
                :disabled="readonly || activeSheets.length <= 1"
                @click.stop="removeSheet(sheet.id)"
              >
                作废
              </el-button>
            </span>
            <span class="bom-sheet-card__meta">{{ sheet.items.length }} 条明细</span>
            <span class="bom-sheet-card__status">
              保存：{{ sheetSaveStatusLabel(sheet) }} / 采购：{{
                sheetProcurementStatusLabel(sheet.status)
              }}
            </span>
          </button>
        </div>
      </aside>

      <section
        class="bom-editor-panel"
        :class="{ 'is-import-dragging': isImportDragging }"
        @dragover="handleEditorDragOver"
        @dragleave="handleEditorDragLeave"
        @drop="handleEditorDrop"
      >
        <template v-if="activeSheet">
          <div class="bom-editor-panel__header">
            <div class="bom-editor-panel__header-main">
              <div class="bom-sheet-name-display">{{ activeSheet.name }}</div>
              <el-tag size="small" effect="plain" class="bom-sheet-status-tag">
                保存：{{ sheetSaveStatusLabel(activeSheet) }}
              </el-tag>
              <el-tag size="small" effect="plain" class="bom-sheet-status-tag">
                采购：{{ sheetProcurementStatusLabel(activeSheet.status) }}
              </el-tag>
            </div>
            <div class="bom-editor-panel__actions">
              <el-button type="primary" plain :disabled="readonly" @click="addItem"
                >新增行</el-button
              >
              <el-button
                type="success"
                :disabled="readonly"
                :loading="savingSheet"
                @click="saveSheet"
              >
                保存当前表
              </el-button>
              <el-button
                type="warning"
                :disabled="readonly || !allRequestableItems.length"
                @click="openProcurementDialog"
              >
                发起采购申请
              </el-button>
            </div>
          </div>

          <div class="bom-editor-panel__summary">
            <span>项目：{{ projectCode || '待保存项目' }}</span>
            <span>分类：{{ currentCategoryLabel }}</span>
            <span>子表：{{ activeSheet.items.length }} 条明细</span>
            <span>可申请：{{ allRequestableItems.length }} 条</span>
            <span>可拖入 Excel：模具备料表 / 模具bom表</span>
          </div>

          <div ref="editorBodyRef" class="bom-editor-body">
            <table class="bom-grid">
              <thead>
                <tr>
                  <th>序号</th>
                  <th>名称</th>
                  <th>尺寸</th>
                  <th>材质</th>
                  <th>数量</th>
                  <th>技术要求</th>
                  <th>备注</th>
                  <th>附件</th>
                  <th>采购状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(item, index) in activeSheet.items"
                  :key="item.id"
                  :data-item-id="item.id"
                  class="bom-grid__row"
                >
                  <td class="bom-grid__index">{{ index + 1 }}</td>
                  <td class="bom-col bom-col--name">
                    <el-input v-model="item.name" :disabled="readonly" placeholder="名称" />
                  </td>
                  <td class="bom-col bom-col--size">
                    <el-input v-model="item.size" :disabled="readonly" placeholder="尺寸" />
                  </td>
                  <td class="bom-col bom-col--material">
                    <el-input v-model="item.material" :disabled="readonly" />
                  </td>
                  <td class="bom-col bom-col--qty">
                    <el-input-number
                      v-model="item.quantity"
                      :min="0"
                      :precision="2"
                      :controls="false"
                      :disabled="readonly"
                      style="width: 100%"
                    />
                  </td>
                  <td class="bom-col bom-col--tech">
                    <el-input v-model="item.technicalRequirement" :disabled="readonly" />
                  </td>
                  <td class="bom-col bom-col--remark">
                    <el-input v-model="item.remark" :disabled="readonly" />
                  </td>
                  <td class="bom-grid__attachment bom-col--attachment">
                    <el-button type="primary" link @click="openAttachmentDialog(item)">
                      查看({{ item.attachments.length }})
                    </el-button>
                  </td>
                  <td class="bom-grid__status bom-col--status">
                    <el-tag
                      size="small"
                      :type="item.procurementState === 'OPEN' ? 'info' : 'warning'"
                    >
                      {{ itemProcurementLabel(item.procurementState) }}
                    </el-tag>
                  </td>
                  <td class="bom-grid__action bom-col--action">
                    <el-button type="danger" link :disabled="readonly" @click="removeItem(index)">
                      删除
                    </el-button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
        <div v-else class="bom-editor-empty">
          <el-empty
            description="当前分类还没有子表，可先新增子表，或直接拖入 Excel 自动创建并填充"
          />
        </div>
      </section>
    </div>

    <el-dialog
      v-model="attachmentDialogVisible"
      title="明细附件"
      width="720px"
      :close-on-click-modal="false"
    >
      <div v-if="attachmentEditingItem" class="bom-attachment-dialog">
        <div class="bom-attachment-dialog__header">
          <div>
            <div class="bom-attachment-dialog__title">{{
              attachmentEditingItem.name || '未命名明细'
            }}</div>
            <div class="bom-attachment-dialog__subtitle">
              当前 {{ attachmentEditingItem.attachments.length }} 个附件，支持 PDF / Office / 图片 /
              CAD / 压缩包
            </div>
          </div>
          <el-button type="primary" :disabled="readonly" @click="triggerAttachmentPicker"
            >添加附件</el-button
          >
        </div>

        <input
          ref="attachmentInputRef"
          class="bom-attachment-input"
          type="file"
          multiple
          :accept="attachmentAccept"
          @change="handleAttachmentFileChange"
        />

        <div class="bom-attachment-list">
          <div
            v-for="(attachment, index) in attachmentEditingItem.attachments"
            :key="attachment.id"
            class="bom-attachment-item"
          >
            <div class="bom-attachment-item__main">
              <strong>{{ attachment.originalName }}</strong>
              <span>{{ attachment.sizeLabel }}</span>
            </div>
            <div class="bom-attachment-item__actions">
              <el-button
                v-if="isPdfAttachment(attachment)"
                type="primary"
                link
                @click="openPdfPreview(attachment)"
              >
                预览
              </el-button>
              <el-button type="danger" link @click="removeAttachment(index)">删除</el-button>
            </div>
          </div>
          <el-empty v-if="!attachmentEditingItem.attachments.length" description="当前行暂无附件" />
        </div>
      </div>
    </el-dialog>

    <el-dialog
      v-model="pdfPreviewVisible"
      title="PDF 预览"
      width="960px"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <div v-if="pdfPreviewUrl" class="bom-pdf-preview">
        <iframe :src="pdfPreviewUrl" class="bom-pdf-preview__frame" title="PDF 预览"></iframe>
      </div>
      <el-empty v-else description="当前 PDF 预览不可用" />
    </el-dialog>

    <el-dialog
      v-model="procurementDialogVisible"
      title="发起采购申请"
      width="980px"
      :close-on-click-modal="false"
    >
      <div class="bom-request-dialog">
        <div class="bom-request-dialog__hero">
          <div>
            <div class="bom-request-dialog__title">选择本次进入采购审核的 BOM 明细</div>
            <div class="bom-request-dialog__subtitle">
              第一版按项目范围勾选，审批通过后进入物料采购待处理池。
            </div>
          </div>
          <div class="bom-request-dialog__counter">
            已选 <strong>{{ selectedProcurementItemIds.length }}</strong> 条
          </div>
        </div>

        <el-table
          :data="allRequestableItems"
          border
          height="360"
          row-key="requestKey"
          @selection-change="handleProcurementSelectionChange"
        >
          <el-table-column type="selection" width="48" align="center" />
          <el-table-column prop="categoryLabel" label="分类" width="100" />
          <el-table-column prop="sheetName" label="子表" min-width="140" />
          <el-table-column prop="name" label="名称" min-width="160" />
          <el-table-column prop="size" label="尺寸" min-width="140" />
          <el-table-column prop="material" label="材质" min-width="130" />
          <el-table-column prop="quantity" label="数量" width="90" align="right" />
          <el-table-column
            prop="technicalRequirement"
            label="技术要求"
            min-width="180"
            show-overflow-tooltip
          />
          <el-table-column label="附件" width="80" align="center">
            <template #default="{ row }">{{ row.attachments.length }}</template>
          </el-table-column>
        </el-table>

        <el-input
          v-model="procurementReason"
          class="bom-request-dialog__reason"
          type="textarea"
          :rows="3"
          resize="none"
          placeholder="申请原因，例如：模架先行采购、热流道交期紧张"
        />
      </div>

      <template #footer>
        <div class="bom-request-dialog__footer">
          <el-button @click="procurementDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="submitProcurementRequest">提交审核</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import * as XLSX from 'xlsx'
import {
  deleteProjectBomAttachmentApi,
  previewProjectBomAttachmentPdfApi,
  saveProjectBomSheetsApi,
  uploadProjectBomItemAttachmentApi,
  type ProjectBomAttachment,
  type ProjectBomCategory as BomCategory,
  type ProjectBomItem as ImportedBomItem,
  type ProjectBomItemState as BomItemState,
  type ProjectBomSheet as ImportedBomSheet,
  type ProjectBomSheetStatus as BomSheetStatus
} from '@/api/project'

type BomAttachment = ProjectBomAttachment & {
  sizeLabel?: string
  mimeType?: string
  previewUrl?: string
}
type BomItem = Omit<ImportedBomItem, 'attachments'> & { attachments: BomAttachment[] }
type BomSheet = Omit<ImportedBomSheet, 'items'> & { items: BomItem[] }

interface RequestableBomItem extends BomItem {
  requestKey: string
  categoryLabel: string
  sheetName: string
  sheetId: string
}

const props = withDefaults(
  defineProps<{
    modelValue?: BomSheet[]
    projectCode?: string
    readonly?: boolean
  }>(),
  {
    modelValue: () => [],
    projectCode: '',
    readonly: false
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: BomSheet[]]
}>()

const categoryMeta: Array<{ key: BomCategory; label: string }> = [
  { key: 'RAW_MATERIAL', label: '原材料' },
  { key: 'HOT_RUNNER', label: '热流道' },
  { key: 'MOULD_BASE', label: '模架' },
  { key: 'ACCESSORY', label: '配件' }
]

const formatFileSize = (size: number) => {
  if (!Number.isFinite(size) || size <= 0) return '0 KB'
  if (size >= 1024 * 1024 * 1024) return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`
  return `${Math.max(1, Math.round(size / 1024))} KB`
}

const decorateAttachment = (attachment: Partial<BomAttachment>): BomAttachment => ({
  id: Number(attachment.id || 0),
  projectCode: String(attachment.projectCode || ''),
  sheetId: String(attachment.sheetId || ''),
  itemId: String(attachment.itemId || ''),
  originalName: String(attachment.originalName || ''),
  storedFileName: String(attachment.storedFileName || ''),
  relativePath: String(attachment.relativePath || ''),
  fileSize: Number(attachment.fileSize || 0),
  contentType: attachment.contentType || undefined,
  uploadedAt: String(attachment.uploadedAt || ''),
  uploadedBy: attachment.uploadedBy || undefined,
  sizeLabel: attachment.sizeLabel || formatFileSize(Number(attachment.fileSize || 0)),
  mimeType: attachment.mimeType || attachment.contentType || undefined,
  previewUrl: attachment.previewUrl
})

const normalizeBomSheets = (sheets: BomSheet[]) =>
  (sheets || []).map((sheet) => ({
    ...sheet,
    items: (sheet.items || []).map((item) => ({
      ...item,
      attachments: (item.attachments || []).map((attachment) => decorateAttachment(attachment))
    }))
  }))

const cloneBomSheets = (sheets: BomSheet[]) =>
  JSON.parse(JSON.stringify(normalizeBomSheets(sheets || []))) as BomSheet[]

const createId = (prefix: string) =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

const createItem = (): BomItem => ({
  id: createId('item'),
  name: '',
  size: '',
  material: '',
  quantity: 1,
  technicalRequirement: '',
  remark: '',
  procurementState: 'OPEN',
  attachments: []
})

const normalizeCell = (value: unknown) => String(value ?? '').trim()

const normalizeProjectCode = (value: unknown) =>
  normalizeCell(value).replaceAll(/\s+/g, '').toUpperCase()

const normalizeSheetName = (value: unknown) =>
  normalizeCell(value).replaceAll(/\s+/g, '').replaceAll('　', '').toLowerCase()

const normalizeOptionalImportText = (value: unknown) => {
  const normalized = normalizeCell(value)
  if (!normalized) return ''
  if (normalized === '\\' || normalized === '/' || normalized === '-' || normalized === '--')
    return ''
  return normalized
}

const toPositiveNumber = (value: unknown) => {
  const raw = normalizeCell(value).replace(/,/g, '')
  if (!raw) return 0
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : 0
}

const getCategoryLabel = (category: BomCategory) =>
  categoryMeta.find((item) => item.key === category)?.label || 'BOM'

const getNextSheetNumber = (category: BomCategory, sheets: BomSheet[]) => {
  const label = getCategoryLabel(category)
  const prefix = `${label}-`
  const maxNo = sheets
    .filter((sheet) => sheet.category === category)
    .map((sheet) => {
      const name = String(sheet.name || '').trim()
      if (!name.startsWith(prefix)) return 0
      const suffix = Number.parseInt(name.slice(prefix.length), 10)
      return Number.isFinite(suffix) ? suffix : 0
    })
    .reduce((max, current) => Math.max(max, current), 0)
  return maxNo + 1
}

const createSheet = (category: BomCategory, index: number): BomSheet => ({
  id: createId('sheet'),
  category,
  name: `${getCategoryLabel(category)}-${index}`,
  status: 'DRAFT',
  items: [createItem()]
})

const ensureSheets = (incoming: BomSheet[]) => cloneBomSheets(incoming)

const localSheets = ref<BomSheet[]>(ensureSheets(props.modelValue))
const savedSheetsSnapshot = ref<BomSheet[]>(cloneBomSheets(props.modelValue || []))
const activeCategory = ref<BomCategory>('RAW_MATERIAL')
const activeSheetId = ref(
  localSheets.value.find((sheet) => sheet.category === activeCategory.value)?.id || ''
)
const editorBodyRef = ref<HTMLElement>()
const isImportDragging = ref(false)
const syncingFromParent = ref(false)

const sameBomSheets = (left: BomSheet[], right: BomSheet[]) =>
  JSON.stringify(cloneBomSheets(left || [])) === JSON.stringify(cloneBomSheets(right || []))

watch(
  () => props.modelValue,
  (value) => {
    const nextSheets = ensureSheets(value || [])
    if (sameBomSheets(localSheets.value, nextSheets)) return
    syncingFromParent.value = true
    localSheets.value = nextSheets
    savedSheetsSnapshot.value = cloneBomSheets(nextSheets)
    if (!localSheets.value.some((sheet) => sheet.id === activeSheetId.value)) {
      activeSheetId.value =
        localSheets.value.find((sheet) => sheet.category === activeCategory.value)?.id ||
        localSheets.value[0]?.id ||
        ''
    }
    nextTick(() => {
      syncingFromParent.value = false
    })
  },
  { deep: true }
)

watch(
  localSheets,
  (value) => {
    if (syncingFromParent.value) return
    if (sameBomSheets(value, props.modelValue || [])) return
    emit('update:modelValue', cloneBomSheets(value))
  },
  { deep: true }
)

const activeSheets = computed(() =>
  localSheets.value.filter(
    (sheet) => sheet.category === activeCategory.value && sheet.status !== 'PUSHED'
  )
)

const activeSheet = computed(
  () => activeSheets.value.find((sheet) => sheet.id === activeSheetId.value) || null
)

const categoryCards = computed(() =>
  categoryMeta.map((category) => {
    const sheets = localSheets.value.filter((sheet) => sheet.category === category.key)
    return {
      ...category,
      sheetCount: sheets.length,
      itemCount: sheets.reduce((sum, sheet) => sum + sheet.items.length, 0)
    }
  })
)

const currentCategoryLabel = computed(
  () => categoryMeta.find((item) => item.key === activeCategory.value)?.label || 'BOM'
)

const sheetProcurementStatusLabel = (status: BomSheetStatus) => {
  if (status === 'REQUESTED') return '申请中'
  if (status === 'PARTIAL_PUSHED') return '部分推送'
  if (status === 'PUSHED') return '已推送'
  return '未申请'
}

const findSavedSheet = (sheetId: string) =>
  savedSheetsSnapshot.value.find((sheet) => String(sheet.id) === String(sheetId))

const sheetSaveStatusLabel = (sheet: BomSheet) => {
  const savedSheet = findSavedSheet(sheet.id)
  if (!savedSheet) return '未保存'
  return sameBomSheets([sheet], [savedSheet]) ? '已保存' : '未保存'
}

const itemProcurementLabel = (status: BomItemState) => {
  if (status === 'IN_REQUEST') return '申请中'
  if (status === 'PUSHED_TO_PROCUREMENT') return '已推送'
  return '未申请'
}

const setActiveCategory = (category: BomCategory) => {
  activeCategory.value = category
  activeSheetId.value =
    localSheets.value.find((sheet) => sheet.category === category && sheet.status !== 'PUSHED')
      ?.id || ''
}

const addSheet = () => {
  const sheet = createSheet(
    activeCategory.value,
    getNextSheetNumber(activeCategory.value, localSheets.value)
  )
  localSheets.value.push(sheet)
  activeSheetId.value = sheet.id
}

const resolveImportCategoryBySheetName = (sheetName: string): BomCategory | null => {
  const normalized = normalizeSheetName(sheetName)
  if (normalized === '模具备料表' || normalized === '模具备料单') return 'RAW_MATERIAL'
  if (normalized === '模具bom表') return 'ACCESSORY'
  return null
}

const parseBomRowsFromSheet = (rows: unknown[][]) => {
  const items: BomItem[] = []
  for (let rowIndex = 4; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex] || []
    const values = row.map((cell) => normalizeCell(cell))
    const rowText = values.join(' ').replace(/\s+/g, '')
    if (!rowText) continue
    if (rowText.includes('编制') || rowText.includes('批注')) continue

    const name = values[1] || ''
    const size = values[2] || ''
    const material = normalizeOptionalImportText(values[3])
    const quantity = toPositiveNumber(values[4])
    const technicalRequirement = normalizeOptionalImportText(values[5])
    const remark = normalizeOptionalImportText(values[6])

    if (!name && !size && !material && !quantity && !technicalRequirement && !remark) continue

    items.push({
      id: createId('item'),
      name,
      size,
      material,
      quantity,
      technicalRequirement,
      remark,
      procurementState: 'OPEN',
      attachments: []
    })
  }
  return items
}

const importBomWorkbook = async (file: File) => {
  if (!/\.(xls|xlsx)$/i.test(file.name)) {
    ElMessage.warning('仅支持导入 Excel 文件（.xls/.xlsx）')
    return
  }

  const projectCode = normalizeProjectCode(props.projectCode)
  if (!projectCode) {
    ElMessage.warning('当前项目编号为空，无法校验导入文件')
    return
  }

  const arrayBuffer = await file.arrayBuffer()
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })
  let importedItems: BomItem[] | null = null

  for (const rawSheetName of workbook.SheetNames) {
    const sheetName = String(rawSheetName || '').trim()
    const category = resolveImportCategoryBySheetName(sheetName)
    if (!category) continue
    if (category !== activeCategory.value) continue

    const worksheet = workbook.Sheets[rawSheetName]
    if (!worksheet) continue
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as unknown[][]
    const fileProjectCode = normalizeProjectCode(rows?.[2]?.[1])
    if (!fileProjectCode || fileProjectCode !== projectCode) {
      throw new Error(`工作表「${sheetName}」项目编号不匹配：${rows?.[2]?.[1] || '空值'}`)
    }

    const items = parseBomRowsFromSheet(rows)
    if (!items.length) continue
    importedItems = items
    break
  }

  if (!importedItems) {
    ElMessage.warning(
      activeCategory.value === 'RAW_MATERIAL'
        ? '当前打开的是原材料表，仅支持导入“模具备料表 / 模具备料单”'
        : activeCategory.value === 'ACCESSORY'
          ? '当前打开的是配件表，仅支持导入“模具BOM表”'
          : '当前打开的分类不支持该 Excel 导入'
    )
    return
  }

  let targetSheet = activeSheet.value
  if (!targetSheet) {
    targetSheet = createSheet(
      activeCategory.value,
      getNextSheetNumber(activeCategory.value, localSheets.value)
    )
    localSheets.value.push(targetSheet)
    activeSheetId.value = targetSheet.id
  }

  targetSheet.items = importedItems
  targetSheet.status = 'DRAFT'

  // 数据写入成功后先直接提示，避免后续 UI 刷新异常被误报成“导入失败”。
  ElMessage.success(`已导入到当前子表：${targetSheet.name}`)

  try {
    await nextTick()
  } catch (error) {
    console.warn('BOM Excel imported, but post-render refresh failed:', error)
  }
}

const handleEditorDragOver = (event: DragEvent) => {
  event.preventDefault()
  if (props.readonly) return
  isImportDragging.value = true
}

const handleEditorDragLeave = (event: DragEvent) => {
  event.preventDefault()
  const current = event.currentTarget as HTMLElement | null
  const related = event.relatedTarget as Node | null
  if (current && related && current.contains(related)) return
  isImportDragging.value = false
}

const handleEditorDrop = async (event: DragEvent) => {
  event.preventDefault()
  isImportDragging.value = false
  if (props.readonly) return

  const file = Array.from(event.dataTransfer?.files || []).find((item) =>
    /\.(xls|xlsx)$/i.test(item.name)
  )
  if (!file) {
    ElMessage.warning('请拖入 Excel 文件（.xls/.xlsx）')
    return
  }

  try {
    await importBomWorkbook(file)
  } catch (error: any) {
    ElMessage.error(error?.message || '导入 BOM Excel 失败')
  }
}

const removeSheet = async (sheetId?: string) => {
  const targetSheet =
    activeSheets.value.find((sheet) => sheet.id === (sheetId || activeSheetId.value)) ||
    activeSheet.value
  if (!targetSheet) return

  await ElMessageBox.confirm(`确认作废子表“${targetSheet.name}”吗？`, '提示', {
    type: 'warning'
  })
  const index = localSheets.value.findIndex((sheet) => sheet.id === targetSheet.id)
  if (index >= 0) {
    localSheets.value.splice(index, 1)
    activeSheetId.value = activeSheets.value[0]?.id || localSheets.value[0]?.id || ''
  }
}

const addItem = async () => {
  if (!activeSheet.value) return
  const item = createItem()
  activeSheet.value.items.push(item)
  await nextTick()
  const rowEl = editorBodyRef.value?.querySelector(
    `[data-item-id="${item.id}"]`
  ) as HTMLElement | null
  rowEl?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
}

const removeItem = (index: number) => {
  if (!activeSheet.value) return
  if (activeSheet.value.items.length <= 1) {
    ElMessage.warning('至少保留一条明细')
    return
  }
  activeSheet.value.items.splice(index, 1)
}

const persistBomSheets = async (successMessage?: string) => {
  const projectCode = String(props.projectCode || '').trim()
  if (!projectCode) {
    ElMessage.warning('请先保存项目基础信息，再保存 BOM')
    return false
  }
  try {
    await saveProjectBomSheetsApi(projectCode, cloneBomSheets(localSheets.value))
    savedSheetsSnapshot.value = cloneBomSheets(localSheets.value)
    if (successMessage) ElMessage.success(successMessage)
    return true
  } catch (error: any) {
    ElMessage.error(error?.message || '保存 BOM 失败')
    return false
  }
}

const savingSheet = ref(false)
const saveSheet = async () => {
  if (!activeSheet.value) return
  savingSheet.value = true
  try {
    activeSheet.value.status = 'DRAFT'
    await persistBomSheets(`已保存 ${activeSheet.value.name}`)
  } finally {
    savingSheet.value = false
  }
}

const attachmentDialogVisible = ref(false)
const attachmentEditingItem = ref<BomItem | null>(null)
const attachmentInputRef = ref<HTMLInputElement | null>(null)
const pdfPreviewVisible = ref(false)
const pdfPreviewUrl = ref('')
const attachmentAccept =
  '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.gif,.webp,.bmp,.zip,.rar,.7z,.dwg,.dxf,.step,.stp,.igs,.iges,.sldprt,.sldasm'

const openAttachmentDialog = (item: BomItem) => {
  attachmentEditingItem.value = item
  attachmentDialogVisible.value = true
}

const isPdfAttachment = (attachment: BomAttachment) =>
  attachment.mimeType === 'application/pdf' || /\.pdf$/i.test(attachment.originalName)

const openPdfPreview = (attachment: BomAttachment) => {
  if (attachment.previewUrl) {
    pdfPreviewUrl.value = attachment.previewUrl
    pdfPreviewVisible.value = true
    return
  }
  if (!attachment.id) {
    ElMessage.warning('当前 PDF 暂不支持预览')
    return
  }
  previewProjectBomAttachmentPdfApi(Number(attachment.id))
    .then((response: any) => {
      const blob = response?.data || response
      pdfPreviewUrl.value = URL.createObjectURL(blob)
      pdfPreviewVisible.value = true
    })
    .catch((error: any) => {
      ElMessage.error(error?.message || 'PDF 预览失败')
    })
}

const triggerAttachmentPicker = () => {
  if (props.readonly) return
  attachmentInputRef.value?.click()
}

const handleAttachmentFileChange = async (event: Event) => {
  if (!attachmentEditingItem.value) return
  const input = event.target as HTMLInputElement | null
  const files = Array.from(input?.files || [])
  if (!files.length) return

  const projectCode = String(props.projectCode || '').trim()
  if (!projectCode) {
    ElMessage.warning('请先保存项目，再上传附件')
    if (input) input.value = ''
    return
  }

  try {
    const persisted = await persistBomSheets()
    if (!persisted) return
    const itemId = String(attachmentEditingItem.value.id || '').trim()
    if (!itemId) {
      ElMessage.warning('当前明细未保存，无法上传附件')
      return
    }

    const responses = await Promise.all(
      files.map((file) => uploadProjectBomItemAttachmentApi(projectCode, itemId, file))
    )
    attachmentEditingItem.value.attachments.push(
      ...responses
        .map((response: any) => response?.data?.data || response?.data)
        .filter(Boolean)
        .map((attachment) => decorateAttachment(attachment as BomAttachment))
    )

    ElMessage.success(`已添加 ${files.length} 个附件`)
  } catch (error: any) {
    ElMessage.error(error?.message || '上传项目 BOM 附件失败')
  } finally {
    if (input) input.value = ''
  }
}

const removeAttachment = async (index: number) => {
  const removed = attachmentEditingItem.value?.attachments.splice(index, 1)?.[0]
  if (removed?.id) {
    try {
      await deleteProjectBomAttachmentApi(Number(removed.id))
    } catch (error: any) {
      attachmentEditingItem.value?.attachments.splice(index, 0, removed)
      ElMessage.error(error?.message || '删除附件失败')
      return
    }
  }
  if (removed?.previewUrl) {
    URL.revokeObjectURL(removed.previewUrl)
    if (pdfPreviewUrl.value === removed.previewUrl) {
      pdfPreviewUrl.value = ''
      pdfPreviewVisible.value = false
    }
  }
}

watch(attachmentDialogVisible, (visible) => {
  if (!visible && attachmentInputRef.value) {
    attachmentInputRef.value.value = ''
  }
})

watch(pdfPreviewVisible, (visible) => {
  if (!visible && pdfPreviewUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(pdfPreviewUrl.value)
    pdfPreviewUrl.value = ''
  } else if (!visible) {
    pdfPreviewUrl.value = ''
  }
})

const allRequestableItems = computed<RequestableBomItem[]>(() =>
  localSheets.value.flatMap((sheet) =>
    sheet.items
      .filter((item) => item.procurementState === 'OPEN')
      .map((item) => ({
        ...item,
        requestKey: `${sheet.id}_${item.id}`,
        categoryLabel:
          categoryMeta.find((meta) => meta.key === sheet.category)?.label || sheet.category,
        sheetName: sheet.name,
        sheetId: sheet.id
      }))
  )
)

const procurementDialogVisible = ref(false)
const procurementReason = ref('')
const selectedProcurementItemIds = ref<string[]>([])

const openProcurementDialog = () => {
  procurementReason.value = ''
  selectedProcurementItemIds.value = []
  procurementDialogVisible.value = true
}

const handleProcurementSelectionChange = (rows: RequestableBomItem[]) => {
  selectedProcurementItemIds.value = rows.map((row) => row.requestKey)
}

const submitProcurementRequest = () => {
  if (!selectedProcurementItemIds.value.length) {
    ElMessage.warning('请至少勾选一条 BOM 明细')
    return
  }

  const selectedSet = new Set(selectedProcurementItemIds.value)
  localSheets.value.forEach((sheet) => {
    let hasRequested = false
    sheet.items.forEach((item) => {
      if (selectedSet.has(`${sheet.id}_${item.id}`)) {
        item.procurementState = 'IN_REQUEST'
        hasRequested = true
      }
    })
    if (hasRequested) sheet.status = 'REQUESTED'
  })

  procurementDialogVisible.value = false
  ElMessage.success(
    `已提交采购申请：${selectedProcurementItemIds.value.length} 条明细${
      procurementReason.value.trim() ? `，原因：${procurementReason.value.trim()}` : ''
    }`
  )
}
</script>

<style scoped>
.bom-workspace {
  --bom-ink: #1f2a35;
  --bom-muted: #667085;
  --bom-line: #d7dde6;
  --bom-panel: linear-gradient(180deg, rgb(255 255 255 / 96%), rgb(247 249 252 / 96%));
  --bom-accent: #c67d31;

  display: grid;
  gap: 14px;
}

.bom-category-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.bom-category-card {
  position: relative;
  display: grid;
  gap: 4px;
  padding: 14px 16px;
  color: var(--bom-ink);
  text-align: left;
  cursor: pointer;
  background: var(--bom-panel);
  border: 1px solid var(--bom-line);
  border-radius: 16px;
  box-shadow: 0 8px 24px rgb(31 42 53 / 6%);
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    border-color 0.18s ease;
}

.bom-category-card:hover,
.bom-category-card.is-active {
  border-color: rgb(20 103 145 / 38%);
  transform: translateY(-1px);
  box-shadow: 0 16px 28px rgb(21 74 116 / 10%);
}

.bom-category-card.is-active::after {
  position: absolute;
  pointer-events: none;
  border: 1px solid rgb(198 125 49 / 32%);
  border-radius: 16px;
  content: '';
  inset: 0;
}

.bom-category-card__title {
  font-size: 15px;
  font-weight: 700;
}

.bom-category-card__meta {
  font-size: 12px;
  color: var(--bom-muted);
}

.bom-layout {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 14px;
}

.bom-sheet-panel,
.bom-editor-panel {
  height: 500px;
  min-width: 0;
  background: var(--bom-panel);
  border: 1px solid var(--bom-line);
  border-radius: 18px;
  box-shadow: 0 12px 26px rgb(31 42 53 / 6%);
}

.bom-sheet-panel {
  padding: 16px;
  overflow: auto;
}

.bom-sheet-panel__header {
  display: grid;
  gap: 12px;
  margin-bottom: 14px;
}

.bom-sheet-panel__title {
  font-size: 17px;
  font-weight: 700;
  color: var(--bom-ink);
}

.bom-sheet-panel__subtitle {
  margin-top: 4px;
  font-size: 12px;
  color: var(--bom-muted);
}

.bom-sheet-list {
  display: grid;
  gap: 10px;
}

.bom-sheet-card {
  display: grid;
  gap: 4px;
  padding: 14px;
  color: var(--bom-ink);
  text-align: left;
  cursor: pointer;
  background: #fff;
  border: 1px solid #dde4ec;
  border-radius: 14px;
}

.bom-sheet-card__head {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  justify-content: space-between;
}

.bom-sheet-card__head :deep(.el-button) {
  padding: 0;
  font-size: 12px;
}

.bom-sheet-card.is-active {
  background: linear-gradient(135deg, rgb(13 69 117 / 8%), rgb(198 125 49 / 8%));
  border-color: rgb(13 69 117 / 26%);
}

.bom-sheet-card__name {
  font-size: 14px;
  font-weight: 700;
}

.bom-sheet-card__meta,
.bom-sheet-card__status {
  font-size: 12px;
  color: var(--bom-muted);
}

.bom-editor-panel {
  display: flex;
  padding: 16px;
  overflow: hidden;
  flex-direction: column;
}

.bom-editor-empty {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
}

.bom-editor-panel.is-import-dragging {
  border-color: #409eff;
  box-shadow:
    0 0 0 2px rgb(64 158 255 / 18%),
    0 12px 26px rgb(31 42 53 / 6%);
}

.bom-editor-panel__header {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.bom-editor-panel__header-main {
  display: flex;
  flex: 1;
  gap: 10px;
  align-items: center;
}

.bom-sheet-name-display {
  max-width: 360px;
  font-size: 16px;
  font-weight: 700;
  line-height: 32px;
  color: var(--bom-ink);
}

.bom-editor-panel__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.bom-editor-panel__summary {
  display: flex;
  padding: 11px 14px;
  margin-bottom: 12px;
  font-size: 12px;
  color: var(--bom-muted);
  background: rgb(10 56 96 / 4%);
  border: 1px dashed rgb(10 56 96 / 14%);
  border-radius: 12px;
  flex-wrap: wrap;
  gap: 10px 16px;
}

.bom-editor-body {
  min-height: 0;
  overflow: auto;
  background: #fff;
  border: 1px solid #dbe3ec;
  border-radius: 14px;
  flex: 1;
}

.bom-grid {
  width: max-content;
  min-width: 0;
  border-collapse: collapse;
  table-layout: auto;
}

.bom-grid th,
.bom-grid td {
  padding: 6px;
  vertical-align: top;
  border-right: 1px solid #e4ebf2;
  border-bottom: 1px solid #e4ebf2;
}

.bom-grid th:last-child,
.bom-grid td:last-child {
  border-right: none;
}

.bom-grid thead th {
  position: sticky;
  top: 0;
  z-index: 2;
  font-size: 12px;
  font-weight: 700;
  color: #586578;
  text-align: center;
  background: #f8fafc;
}

.bom-grid__row:nth-child(even) {
  background: #fcfdff;
}

.bom-grid__index,
.bom-grid__attachment,
.bom-grid__status,
.bom-grid__action {
  text-align: center;
}

.bom-grid__attachment :deep(.el-button),
.bom-grid__action :deep(.el-button) {
  padding: 0;
  font-size: 12px;
}

.bom-grid__status :deep(.el-tag) {
  padding: 0 6px;
  font-size: 11px;
}

.bom-grid__attachment,
.bom-grid__status,
.bom-grid__action {
  white-space: nowrap;
}

.bom-grid :deep(.el-input__wrapper),
.bom-grid :deep(.el-input-number .el-input__wrapper) {
  box-shadow: none;
}

.bom-col--name {
  width: 140px;
  min-width: 140px;
}

.bom-col--size {
  width: 140px;
  min-width: 140px;
}

.bom-col--material {
  width: 120px;
  min-width: 120px;
}

.bom-col--qty {
  width: 70px;
  min-width: 70px;
}

.bom-col--tech {
  width: 120px;
  min-width: 120px;
}

.bom-col--remark {
  width: 120px;
  min-width: 120px;
}

.bom-col--attachment {
  width: 80px;
  min-width: 80px;
}

.bom-col--status {
  width: 90px;
  min-width: 90px;
}

.bom-col--action {
  width: 80px;
  min-width: 80px;
}

.bom-col :deep(.el-input__wrapper),
.bom-col :deep(.el-input-number .el-input__wrapper) {
  padding: 0 8px;
}

.bom-col--qty :deep(.el-input__wrapper),
.bom-col--qty :deep(.el-input-number .el-input__wrapper) {
  padding: 0 6px;
}

.bom-attachment-dialog {
  display: grid;
  gap: 14px;
}

.bom-attachment-dialog__header {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.bom-attachment-dialog__title {
  font-size: 16px;
  font-weight: 700;
}

.bom-attachment-dialog__subtitle {
  margin-top: 4px;
  font-size: 12px;
  color: var(--bom-muted);
}

.bom-attachment-input {
  display: none;
}

.bom-attachment-list {
  display: grid;
  gap: 10px;
}

.bom-attachment-item {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
}

.bom-attachment-item__main {
  display: grid;
  gap: 4px;
}

.bom-attachment-item__actions {
  display: flex;
  gap: 12px;
  align-items: center;
  white-space: nowrap;
}

.bom-pdf-preview {
  height: 72vh;
  min-height: 560px;
  overflow: hidden;
  background: #f8fafc;
  border: 1px solid #dbe3ec;
  border-radius: 12px;
}

.bom-pdf-preview__frame {
  width: 100%;
  height: 100%;
  background: #fff;
  border: none;
}

.bom-attachment-item__main span {
  font-size: 12px;
  color: var(--bom-muted);
}

.bom-request-dialog {
  display: grid;
  gap: 14px;
}

.bom-request-dialog__hero {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
  padding: 14px 16px;
  background: linear-gradient(135deg, rgb(198 125 49 / 10%), rgb(10 56 96 / 6%));
  border: 1px solid rgb(198 125 49 / 16%);
  border-radius: 14px;
}

.bom-request-dialog__title {
  font-size: 16px;
  font-weight: 700;
  color: var(--bom-ink);
}

.bom-request-dialog__subtitle {
  margin-top: 4px;
  font-size: 12px;
  color: var(--bom-muted);
}

.bom-request-dialog__counter {
  min-width: 96px;
  padding: 10px 12px;
  font-size: 12px;
  color: var(--bom-muted);
  text-align: center;
  background: #fff;
  border: 1px solid #e7d4be;
  border-radius: 12px;
}

.bom-request-dialog__counter strong {
  display: block;
  margin-top: 4px;
  font-size: 24px;
  color: var(--bom-accent);
}

.bom-request-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

@media (width <= 1200px) {
  .bom-layout {
    grid-template-columns: 1fr;
  }
}

@media (width <= 900px) {
  .bom-category-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (width <= 640px) {
  .bom-category-strip {
    grid-template-columns: 1fr;
  }

  .bom-editor-panel__header {
    flex-direction: column;
    align-items: stretch;
  }

  .bom-editor-panel__header-main {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
