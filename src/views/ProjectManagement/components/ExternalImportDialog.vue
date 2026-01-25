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
            <div class="external-import__dropzone-subtitle">
              支持多文件：PDF（文字版移模流程单）/ Excel（技术规格表）
            </div>
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
          accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,.xlsx,.xls"
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
                <span v-else-if="item.result || item.techSpecRows?.length">成功</span>
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

            <div v-else-if="item.techSpecRows?.length">
              <el-table
                :data="item.techSpecRows"
                :max-height="420"
                border
                row-key="id"
                @selection-change="(rows) => handleTechSpecSelectionChange(item.id, rows)"
              >
                <el-table-column
                  type="selection"
                  width="48"
                  :selectable="(row) => canSelectTechSpecRow(row)"
                />
                <el-table-column label="图号" min-width="220">
                  <template #default="{ row }">
                    <span>{{ row.partDrawingRaw || '-' }}</span>
                    <div style="font-size: 12px; color: var(--el-text-color-secondary)">
                      {{ row.sheetName }}{{ row.rowIndex === null ? '' : ` #${row.rowIndex + 1}` }}
                    </div>
                  </template>
                </el-table-column>
                <el-table-column prop="partName" label="名称" min-width="160" />
                <el-table-column prop="projectCode" label="项目编号" min-width="130">
                  <template #default="{ row }">
                    <span v-if="row.projectStatus === 'pending'">查询中…</span>
                    <el-select
                      v-else-if="row.projectStatus === 'multi'"
                      v-model="row.projectCode"
                      size="small"
                      placeholder="多匹配"
                      style="width: 140px"
                      @change="(v) => handleTechSpecProjectCodeSelect(item.id, row, String(v))"
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
                <el-table-column label="初始化状态" min-width="120">
                  <template #default="{ row }">
                    <span v-if="row.initStatus === 'pending'">查询中…</span>
                    <el-tag
                      v-else-if="row.initStatus === 'uninitialized'"
                      size="small"
                      type="warning"
                      effect="light"
                    >
                      未初始化
                    </el-tag>
                    <el-tag
                      v-else-if="row.initStatus === 'initialized'"
                      size="small"
                      type="success"
                      effect="light"
                    >
                      已初始化
                    </el-tag>
                    <el-tag
                      v-else-if="row.initStatus === 'notRequired'"
                      size="small"
                      type="info"
                      effect="light"
                    >
                      不需要
                    </el-tag>
                    <span v-else>-</span>
                  </template>
                </el-table-column>
                <el-table-column label="技术规格" min-width="460">
                  <template #default="{ row }">
                    <div class="external-import__spec-grid">
                      <div
                        ><span class="external-import__spec-k">材料：</span
                        >{{ row.specData.材料 || '-' }}</div
                      >
                      <div
                        ><span class="external-import__spec-k">型腔：</span
                        >{{ row.specData.型腔 || '-' }}</div
                      >
                      <div
                        ><span class="external-import__spec-k">型芯：</span
                        >{{ row.specData.型芯 || '-' }}</div
                      >
                      <div>
                        <span class="external-import__spec-k">模具穴数：</span
                        >{{ row.specData.模具穴数 || '-' }}
                      </div>
                      <div>
                        <span class="external-import__spec-k">外观尺寸：</span
                        >{{ row.specData.产品外观尺寸 || '-' }}
                      </div>
                      <div>
                        <span class="external-import__spec-k">工程师：</span
                        >{{ row.specData.产品结构工程师 || '-' }}
                      </div>
                    </div>
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
                    <el-tag v-else-if="row.importStatus === 'skipped'" size="small" type="info">
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
      <el-button
        v-if="techSpecSelectedCount > 0 || hasAnyTechSpec"
        type="primary"
        :disabled="techSpecSelectedCount === 0 || isBusy"
        :loading="isTechSpecImporting"
        @click="handleTechSpecImport"
      >
        初始化导入（已选 {{ techSpecSelectedCount }} 项）
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getProjectDetailApi,
  getProjectGoodsApi,
  getProjectListApi,
  updateProjectApi,
  relocationImportApi,
  uploadProjectAttachmentApi,
  uploadProjectPartImageApi,
  type RelocationImportOverwriteMode
} from '@/api/project'
import { extractPdfText } from '@/utils/pdf/extractPdfText'
import {
  parseMouldTransferFromText,
  type MouldTransferImportResult
} from '@/utils/pdf/mouldTransferParser'
import {
  parseDrawings as parseTechSpecDrawings,
  parseTechSpecExcel,
  type TechSpecRecord,
  type TechSpecData
} from '@/utils/excel/techSpecParser'
import { isInitDone, normalizeCavityExpression } from '@/utils/mould/cavityExpression'

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
  kind: 'mouldTransfer' | 'techSpec' | 'unknown'
  parsing: boolean
  error: string
  result: MouldTransferImportResult | null
  techSpecRecords: TechSpecRecord[]
  techSpecRows: TechSpecRow[]
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
const isImporting = ref(false)
const isTechSpecImporting = ref(false)
const isBusy = computed(
  () => items.value.some((i) => i.parsing) || isImporting.value || isTechSpecImporting.value
)

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

type TechSpecRow = {
  id: string
  sourceItemId: string
  sourceAddedAt: number
  sheetName: string
  rowIndex: number | null
  partDrawingRaw: string
  partName: string
  drawings: string[]
  specData: TechSpecData
  projectStatus: 'pending' | 'matched' | 'multi' | 'none'
  projectCandidates: string[]
  projectCode: string
  category: string
  initStatus: 'pending' | 'uninitialized' | 'initialized' | 'notRequired' | 'unknown'
  existing: {
    产品材质: string
    前模材质: string
    后模材质: string
    模具穴数: string
    产品尺寸: string
    设计师: string
    零件图示URL: string
    产品列表: string
    产品名称列表: string
    产品数量列表: string
    产品重量列表: string
  } | null
  importStatus: '' | 'success' | 'error' | 'skipped'
  importError: string
}

const normalizeKey = (v: unknown) => String(v ?? '').trim()
const pairKey = (name: string, mouldNo: string) => `${name}\u0000${mouldNo}`
const TARGET_FACTORY = '久环'

type ProjectListItem = {
  项目编号?: string
  productName?: string
  产品名称?: string
  productDrawing?: string
  产品图号?: string
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

const projectDetailCache = new Map<string, any>()
const projectCategoryCache = new Map<string, string>()

const extractProjectDetailForTechSpec = (resp: any): any => {
  const data = resp?.data?.data ?? resp?.data ?? null
  if (!data) return null
  if (Array.isArray(data)) return data[0] ?? null
  return data
}

const stringifyList = (input: unknown) => {
  if (Array.isArray(input))
    return input
      .map((x) => normalizeKey(x))
      .filter(Boolean)
      .join(' / ')
  return normalizeKey(input)
}

const hydrateTechSpecRowDetail = async (row: TechSpecRow, projectCode: string) => {
  row.initStatus = 'pending'
  const normalizedCode = normalizeKey(projectCode)
  try {
    const cached = projectDetailCache.get(normalizedCode)
    const detail = cached
      ? cached
      : extractProjectDetailForTechSpec(await getProjectDetailApi(normalizedCode)) || {}
    projectDetailCache.set(normalizedCode, detail)

    let category = normalizeKey(detail.分类)
    if (!category) {
      const cachedCategory = projectCategoryCache.get(normalizedCode)
      if (cachedCategory) {
        category = cachedCategory
      } else {
        try {
          const resp: any = await getProjectGoodsApi(normalizedCode)
          const data = resp?.data?.data ?? resp?.data ?? null
          const c = normalizeKey(data?.category)
          if (c) {
            category = c
            projectCategoryCache.set(normalizedCode, c)
          }
        } catch {
          // ignore goods fetch failure
        }
      }
    }

    row.category = category
    if (category && category !== '塑胶模具') {
      row.initStatus = 'notRequired'
    } else {
      row.initStatus = isInitDone(detail.init_done) ? 'initialized' : 'uninitialized'
    }

    row.existing = {
      产品材质: normalizeKey(detail.产品材质),
      前模材质: normalizeKey(detail.前模材质),
      后模材质: normalizeKey(detail.后模材质),
      模具穴数: normalizeKey(detail.模具穴数),
      产品尺寸: stringifyList(detail.产品尺寸),
      设计师: normalizeKey(detail.设计师),
      零件图示URL: normalizeKey(detail.零件图示URL),
      产品列表: stringifyList(detail.产品列表 ?? detail.产品图号列表),
      产品名称列表: stringifyList(detail.产品名称列表),
      产品数量列表: stringifyList(detail.产品数量列表),
      产品重量列表: stringifyList(detail.产品重量列表)
    }
  } catch {
    row.initStatus = 'unknown'
  }
}

const matchTechSpecRowProjectCode = async (row: TechSpecRow) => {
  row.projectStatus = 'pending'
  row.projectCandidates = []
  row.projectCode = ''
  row.initStatus = 'unknown'
  row.category = ''
  row.existing = null

  const drawings = (row.drawings || []).map((d) => normalizeKey(d)).filter(Boolean)

  // 仅使用“图号”作为反向匹配依据（名称可能大量重复，不参与匹配/兜底）
  const keywords = Array.from(new Set(drawings.slice(0, 3))).filter(Boolean)
  if (!keywords.length) {
    row.projectStatus = 'none'
    return
  }

  const fetchByKeyword = async (keyword: string) => {
    const response: any = await getProjectListApi({ keyword, page: 1, pageSize: 200 })
    return extractProjectList(response)
  }

  const candidateList: ProjectListItem[] = []
  for (const kw of keywords) {
    try {
      candidateList.push(...(await fetchByKeyword(kw)))
    } catch {
      // ignore single keyword failure
    }
  }

  const candidatesByCode = new Map<string, ProjectListItem>()
  for (const c of candidateList) {
    const code = normalizeKey(c['项目编号'])
    if (!code) continue
    if (!candidatesByCode.has(code)) candidatesByCode.set(code, c)
  }

  const drawingSet = new Set(drawings.map((d) => d.toLowerCase()))

  const matchedCodes: string[] = []
  for (const [code, c] of candidatesByCode.entries()) {
    const cd = parseTechSpecDrawings(c.productDrawing || c.产品图号 || '')
    const hasIntersection =
      drawingSet.size > 0 && cd.some((d) => drawingSet.has(String(d).trim().toLowerCase()))
    if (hasIntersection) matchedCodes.push(code)
  }

  const uniq = Array.from(new Set(matchedCodes)).filter(Boolean)
  row.projectCandidates = uniq

  if (uniq.length === 1) {
    row.projectStatus = 'matched'
    row.projectCode = uniq[0]
    await hydrateTechSpecRowDetail(row, uniq[0])
    return
  }

  if (uniq.length > 1) {
    row.projectStatus = 'multi'
    row.initStatus = 'unknown'
    return
  }

  row.projectStatus = 'none'
}

const hydrateTechSpecRows = async (item: ImportItem) => {
  const list = item.techSpecRows || []
  for (const row of list) {
    try {
      await matchTechSpecRowProjectCode(row)
    } catch {
      row.projectStatus = 'none'
    }
  }
}

const canSelectTechSpecRow = (row: TechSpecRow) =>
  row.projectStatus === 'matched' &&
  row.initStatus === 'uninitialized' &&
  row.importStatus !== 'success' &&
  !isBusy.value

const handleTechSpecProjectCodeSelect = async (itemId: string, row: TechSpecRow, code: string) => {
  const item = items.value.find((x) => x.id === itemId)
  if (!item) return

  row.projectCandidates = row.projectCandidates || []
  row.projectCode = code
  row.projectStatus = 'matched'
  await hydrateTechSpecRowDetail(row, code)
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

const selectedTechSpecRowsByItem = ref<Record<string, TechSpecRow[]>>({})

const handleTechSpecSelectionChange = (itemId: string, rows: TechSpecRow[]) => {
  selectedTechSpecRowsByItem.value = { ...selectedTechSpecRowsByItem.value, [itemId]: rows }
}

const techSpecSelectedCount = computed(() =>
  Object.values(selectedTechSpecRowsByItem.value).reduce(
    (sum, rows) => sum + (rows?.length || 0),
    0
  )
)

const hasAnyTechSpec = computed(() => items.value.some((i) => (i.techSpecRows?.length || 0) > 0))

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
  projectDetailCache.clear()
  projectCategoryCache.clear()
  rootRef.value?.focus()
  activeNames.value = items.value.map((i) => i.id)
}

const handleClosed = () => {
  reset()
}

const reset = () => {
  projectDetailCache.clear()
  projectCategoryCache.clear()
  items.value = []
  activeNames.value = []
  isDragging.value = false
  selectedRowsByItem.value = {}
  selectedTechSpecRowsByItem.value = {}
  if (fileInputRef.value) fileInputRef.value.value = ''
}

const openFilePicker = () => fileInputRef.value?.click()

const isPdfFile = (file: File) =>
  file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')

const isExcelFile = (file: File) => {
  const name = file.name.toLowerCase()
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) return true
  const t = String(file.type || '').toLowerCase()
  return (
    t.includes('spreadsheetml') ||
    t.includes('ms-excel') ||
    t.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  )
}

const fileKeyOf = (file: File) => `${file.name}::${file.size}::${file.lastModified}`

const ensureItem = (file: File): ImportItem | null => {
  if (!isPdfFile(file) && !isExcelFile(file)) {
    ElMessage.error(`仅支持 PDF/Excel 文件：${file.name}`)
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
    kind: 'unknown',
    parsing: false,
    error: '',
    result: null,
    techSpecRecords: [],
    techSpecRows: [],
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
  item.techSpecRecords = []
  item.techSpecRows = []
  item.kind = 'unknown'

  try {
    const buf = await file.arrayBuffer()
    if (isPdfFile(file)) {
      const text = await extractPdfText(buf)
      const parsed = parseMouldTransferFromText(text)
      if (!parsed.ok) {
        item.error = parsed.error
        return
      }
      item.kind = 'mouldTransfer'
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
      return
    }

    if (isExcelFile(file)) {
      const parsed = await parseTechSpecExcel(buf)
      const records = parsed.records || []
      if (!records.length) {
        item.error = '未识别到“注塑模具制作规格表”或可解析的明细表头'
        return
      }
      item.kind = 'techSpec'
      item.techSpecRecords = records
      item.techSpecRows = records.map((r) => {
        return {
          id: r.id,
          sourceItemId: item.id,
          sourceAddedAt: item.addedAt,
          sheetName: r.sheetName,
          rowIndex: r.rowIndex,
          partDrawingRaw: r.partDrawingRaw,
          partName: r.partName,
          drawings: r.drawings,
          specData: r.specData,
          projectStatus: 'pending',
          projectCandidates: [],
          projectCode: '',
          category: '',
          initStatus: 'unknown',
          existing: null,
          importStatus: '',
          importError: ''
        } satisfies TechSpecRow
      })
      void hydrateTechSpecRows(item)
      return
    }

    item.error = '不支持的文件类型'
  } catch (e) {
    item.error = `解析失败：${(e as Error)?.message || String(e)}`
  } finally {
    item.parsing = false
  }
}

const parseFiles = async (files: File[]) => {
  const supportedFiles = files.filter((f) => isPdfFile(f) || isExcelFile(f))
  if (!supportedFiles.length) return

  const toParse: Array<{ file: File; item: ImportItem }> = []
  for (const f of supportedFiles) {
    const it = ensureItem(f)
    if (it) toParse.push({ file: f, item: it })
  }

  activeNames.value = items.value.map((i) => i.id)

  for (const { file, item } of toParse) {
    await parseItem(item, file)
  }

  const allOk =
    toParse.length > 0 &&
    toParse.every(({ item }) => {
      if (item.error) return false
      if (item.kind === 'mouldTransfer') return !!item.result
      if (item.kind === 'techSpec') return (item.techSpecRows?.length || 0) > 0
      return false
    })
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
        dangerouslyUseHTMLString: true,
        customClass: 'external-import__confirm-box'
      }
    )
    return 'overwrite'
  } catch (action) {
    if (action === 'cancel') return 'skipExisting'
    return null
  }
}

const buildTechSpecConfirmHtml = (rows: TechSpecRow[]) => {
  if (!rows.length) return ''

  const render = (v: unknown) => escapeHtml(normalizeKey(v) || '-')

  const body = rows
    .map((r) => {
      const existing = r.existing || {
        产品材质: '',
        前模材质: '',
        后模材质: '',
        模具穴数: '',
        产品尺寸: '',
        设计师: '',
        零件图示URL: '',
        产品列表: '',
        产品名称列表: '',
        产品数量列表: '',
        产品重量列表: ''
      }

      const nextCavityExpr = normalizeCavityExpression(r.specData.模具穴数)

      const cells = [
        render(r.projectCode),
        render(
          r.initStatus === 'uninitialized'
            ? '未初始化'
            : r.initStatus === 'initialized'
              ? '已初始化'
              : r.initStatus
        ),
        render(existing.产品材质),
        render(existing.前模材质),
        render(existing.后模材质),
        render(existing.模具穴数),
        render(existing.产品尺寸),
        render(existing.设计师),
        render(r.specData.材料),
        render(r.specData.型腔),
        render(r.specData.型芯),
        render(nextCavityExpr || r.specData.模具穴数),
        render(r.specData.产品外观尺寸),
        render(r.specData.产品结构工程师)
      ]

      return `<tr>${cells.map((c) => `<td style="padding:6px 8px;border:1px solid #ebeef5;vertical-align:top;">${c}</td>`).join('')}</tr>`
    })
    .join('')

  return `
    <div style="margin-top:10px;">
      <div style="margin-bottom:6px;color:#606266;">即将写入以下字段（与初始化弹窗一致）：</div>
      <div style="max-height:260px;overflow:auto;">
        <table style="border-collapse:collapse;width:100%;font-size:12px;">
          <thead>
            <tr>
              <th style="padding:6px 8px;border:1px solid #ebeef5;background:#f5f7fa;text-align:left;">项目编号</th>
              <th style="padding:6px 8px;border:1px solid #ebeef5;background:#f5f7fa;text-align:left;">初始化状态</th>
              <th style="padding:6px 8px;border:1px solid #ebeef5;background:#f5f7fa;text-align:left;">已有-材料</th>
              <th style="padding:6px 8px;border:1px solid #ebeef5;background:#f5f7fa;text-align:left;">已有-型腔</th>
              <th style="padding:6px 8px;border:1px solid #ebeef5;background:#f5f7fa;text-align:left;">已有-型芯</th>
              <th style="padding:6px 8px;border:1px solid #ebeef5;background:#f5f7fa;text-align:left;">已有-模具穴数</th>
              <th style="padding:6px 8px;border:1px solid #ebeef5;background:#f5f7fa;text-align:left;">已有-外观尺寸</th>
              <th style="padding:6px 8px;border:1px solid #ebeef5;background:#f5f7fa;text-align:left;">已有-工程师</th>
              <th style="padding:6px 8px;border:1px solid #ebeef5;background:#f5f7fa;text-align:left;">导入-材料</th>
              <th style="padding:6px 8px;border:1px solid #ebeef5;background:#f5f7fa;text-align:left;">导入-型腔</th>
              <th style="padding:6px 8px;border:1px solid #ebeef5;background:#f5f7fa;text-align:left;">导入-型芯</th>
              <th style="padding:6px 8px;border:1px solid #ebeef5;background:#f5f7fa;text-align:left;">导入-模具穴数</th>
              <th style="padding:6px 8px;border:1px solid #ebeef5;background:#f5f7fa;text-align:left;">导入-外观尺寸</th>
              <th style="padding:6px 8px;border:1px solid #ebeef5;background:#f5f7fa;text-align:left;">导入-工程师</th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </div>
  `
}

const chooseTechSpecOverwriteMode = async (
  html: string
): Promise<RelocationImportOverwriteMode | null> => {
  try {
    await ElMessageBox.confirm(
      `
      <div>若目标字段已有值：请选择“覆盖”或“跳过已有（字段级跳过，其他字段仍可写）”。</div>
      <div style="margin-top:6px;color:#909399;">空值不会写入；导入成功后会将 init_done 置为 1。</div>
      ${html}
      `,
      '初始化导入确认',
      {
        confirmButtonText: '覆盖',
        cancelButtonText: '跳过已有',
        showCancelButton: true,
        distinguishCancelAndClose: true,
        type: 'warning',
        dangerouslyUseHTMLString: true,
        customClass: 'external-import__confirm-box external-import__confirm-box--wide'
      }
    )
    return 'overwrite'
  } catch (action) {
    if (action === 'cancel') return 'skipExisting'
    return null
  }
}

const hasMeaningfulValue = (v: unknown) => {
  const s = normalizeKey(v)
  return !!s && s !== '-'
}

const buildTechSpecUpdatePayload = async (
  row: TechSpecRow,
  overwriteMode: RelocationImportOverwriteMode
): Promise<Record<string, any>> => {
  const existing = row.existing || {
    产品材质: '',
    前模材质: '',
    后模材质: '',
    模具穴数: '',
    产品尺寸: '',
    设计师: '',
    零件图示URL: '',
    产品列表: '',
    产品名称列表: '',
    产品数量列表: '',
    产品重量列表: ''
  }

  const shouldWrite = (next: unknown, existed: unknown) => {
    if (!hasMeaningfulValue(next)) return false
    if (overwriteMode === 'overwrite') return true
    return !hasMeaningfulValue(existed)
  }

  const payload: Record<string, any> = {}

  const nextMat = normalizeKey(row.specData.材料)
  if (shouldWrite(nextMat, existing.产品材质)) payload.产品材质 = nextMat

  const nextCavity = normalizeKey(row.specData.型腔)
  if (shouldWrite(nextCavity, existing.前模材质)) payload.前模材质 = nextCavity

  const nextCore = normalizeKey(row.specData.型芯)
  if (shouldWrite(nextCore, existing.后模材质)) payload.后模材质 = nextCore

  const nextEngineer = normalizeKey(row.specData.产品结构工程师)
  if (shouldWrite(nextEngineer, existing.设计师)) payload.设计师 = nextEngineer

  const nextCavityExpr = normalizeCavityExpression(row.specData.模具穴数)
  if (shouldWrite(nextCavityExpr, existing.模具穴数)) payload.模具穴数 = nextCavityExpr

  const nextDrawings = row.specData.产品列表 || []
  const nextSizes = row.specData.产品尺寸列表 || []
  const nextNames = row.specData.产品名称列表 || []
  const nextQty = row.specData.产品数量列表 || []
  const nextWeights = row.specData.产品重量列表 || []
  const nextDrawingsStr = nextDrawings.length ? JSON.stringify(nextDrawings) : ''
  const nextSizesStr = nextSizes.length ? JSON.stringify(nextSizes) : ''
  const nextNamesStr = nextNames.length ? JSON.stringify(nextNames) : ''
  const nextQtyStr = nextQty.length ? JSON.stringify(nextQty) : ''
  const nextWeightsStr = nextWeights.length ? JSON.stringify(nextWeights) : ''

  if (shouldWrite(nextDrawingsStr, existing.产品列表)) payload.产品列表 = nextDrawingsStr
  if (shouldWrite(nextNamesStr, existing.产品名称列表)) payload.产品名称列表 = nextNamesStr
  if (shouldWrite(nextQtyStr, existing.产品数量列表)) payload.产品数量列表 = nextQtyStr
  if (shouldWrite(nextWeightsStr, existing.产品重量列表)) payload.产品重量列表 = nextWeightsStr
  if (shouldWrite(nextSizesStr, existing.产品尺寸)) payload.产品尺寸 = nextSizesStr

  const nextImage = normalizeKey(row.specData.零件图片)
  const shouldWriteImage = shouldWrite(nextImage, existing.零件图示URL)
  if (shouldWriteImage && nextImage) {
    if (nextImage.startsWith('data:')) {
      const matches = nextImage.match(/^data:([A-Za-z-+\\/]+);base64,(.+)$/)
      if (matches && matches.length === 3) {
        const mimeType = matches[1]
        const base64String = matches[2]
        const byteCharacters = atob(base64String)
        const byteNumbers = new Array(byteCharacters.length)
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i)
        }
        const byteArray = new Uint8Array(byteNumbers)
        const blob = new Blob([byteArray], { type: mimeType })
        const file = new File([blob], 'spec-image.png', { type: mimeType })
        const resp: any = await uploadProjectPartImageApi(row.projectCode, file)
        const url = resp?.data?.data?.url ?? resp?.data?.url ?? resp?.data?.data?.data?.url
        if (url) payload.零件图示URL = String(url)
      }
    } else {
      payload.零件图示URL = nextImage
    }
  }

  if (row.category === '塑胶模具') payload.init_done = 1

  return payload
}

const handleTechSpecImport = async () => {
  if (isBusy.value || isTechSpecImporting.value) return
  if (techSpecSelectedCount.value === 0) {
    ElMessage.warning('请先勾选需要导入的技术规格表记录（仅未初始化项目可勾选）')
    return
  }

  isTechSpecImporting.value = true
  try {
    const selected = Object.values(selectedTechSpecRowsByItem.value).flat()

    const aggregated = new Map<string, TechSpecRow>()
    for (const row of selected) {
      const code = normalizeKey(row.projectCode)
      if (!code) continue
      const prev = aggregated.get(code)
      if (!prev) {
        aggregated.set(code, row)
        continue
      }
      const prevAdded = prev.sourceAddedAt
      const nextAdded = row.sourceAddedAt
      const prevIndex = prev.rowIndex === null ? -1 : prev.rowIndex
      const nextIndex = row.rowIndex === null ? -1 : row.rowIndex
      const isLater = nextAdded > prevAdded || (nextAdded === prevAdded && nextIndex >= prevIndex)
      if (isLater) aggregated.set(code, row)
    }

    const targets = Array.from(aggregated.values())

    for (const r of targets) {
      if (!r.existing) await hydrateTechSpecRowDetail(r, r.projectCode)
    }

    const html = buildTechSpecConfirmHtml(targets)
    const overwriteMode = await chooseTechSpecOverwriteMode(html)
    if (!overwriteMode) return

    const errors: string[] = []
    let okCount = 0
    let skippedCount = 0

    for (const row of targets) {
      try {
        await hydrateTechSpecRowDetail(row, row.projectCode)
        const payload = await buildTechSpecUpdatePayload(row, overwriteMode)
        const keys = Object.keys(payload)
        if (!keys.length) {
          row.importStatus = 'skipped'
          skippedCount++
          continue
        }

        await updateProjectApi(row.projectCode, payload)
        row.importStatus = 'success'
        row.importError = ''
        row.initStatus = 'initialized'
        const cached = projectDetailCache.get(normalizeKey(row.projectCode))
        if (cached) cached.init_done = 1
        okCount++
      } catch (e) {
        row.importStatus = 'error'
        row.importError = (e as Error)?.message || String(e)
        errors.push(`${row.projectCode}: ${row.importError}`)
      }
    }

    if (errors.length) {
      ElMessage.warning(`导入完成：成功 ${okCount}，跳过 ${skippedCount}，失败 ${errors.length}`)
    } else {
      ElMessage.success(`导入完成：成功 ${okCount}，跳过 ${skippedCount}`)
    }
  } finally {
    isTechSpecImporting.value = false
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

.external-import__spec-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px 14px;
  font-size: 12px;
  color: var(--el-text-color-regular);
}

.external-import__spec-k {
  color: var(--el-text-color-secondary);
}
</style>

<style>
.external-import__confirm-box {
  width: 620px;
  max-width: calc(100vw - 40px);
}

.external-import__confirm-box--wide {
  width: 980px;
  max-width: calc(100vw - 40px);
}
</style>
