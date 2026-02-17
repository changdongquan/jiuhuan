<template>
  <el-dialog
    v-model="visible"
    :width="isMobile ? '100%' : '980px'"
    :fullscreen="isMobile"
    :close-on-click-modal="false"
    class="pm-init-dialog"
    @closed="handleClosed"
  >
    <template #title>
      <div class="pm-init-dialog-title">
        <span>初始化</span>
        <el-text type="info" size="small" class="pm-init-title-tip">
          初始化仅需完成一次，完成后将不再弹出。
        </el-text>
      </div>
    </template>
    <div class="pm-init-body">
      <el-descriptions :column="isMobile ? 1 : 4" border class="pm-init-desc">
        <el-descriptions-item label="项目编号">
          {{ project?.项目编号 || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="产品名称">
          {{ project?.productName || project?.产品名称 || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="产品图号">
          {{ project?.productDrawing || project?.产品图号 || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="客户模号">
          {{ project?.客户模号 || '-' }}
        </el-descriptions-item>
      </el-descriptions>

      <div class="pm-init-spec-section">
        <div class="pm-init-spec-header">
          <span class="pm-init-spec-title">1.4-模具清单详情</span>
          <el-tag v-if="bmoLoading" type="info" effect="plain">加载中</el-tag>
        </div>
        <el-alert
          v-if="bmoLoadError"
          type="warning"
          :closable="false"
          show-icon
          :title="bmoLoadError"
          style="margin-bottom: 12px"
        />
        <template v-if="bmoSnapshot">
          <el-descriptions :column="isMobile ? 1 : 3" border size="small">
            <el-descriptions-item label="提需类型">
              {{ bmoSnapshot.demandType || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="设计师">
              {{ bmoSnapshot.designer || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="BMO记录ID">
              {{ bmoSnapshot.fdId || '-' }}
            </el-descriptions-item>
          </el-descriptions>

          <div style="margin-top: 12px">
            <div style="margin-bottom: 8px; font-weight: 600">模具技术要求（全字段）</div>
            <el-table
              :data="bmoTechFieldRows"
              border
              size="small"
              max-height="260"
              :show-header="false"
              class="pm-init-tech-fields-table"
            >
              <el-table-column min-width="160">
                <template #default="{ row }">
                  <span class="pm-init-tech-field-label">{{
                    row.left?.label || row.left?.name || '-'
                  }}</span>
                </template>
              </el-table-column>
              <el-table-column min-width="220">
                <template #default="{ row }">
                  <span class="pm-init-tech-field-value">{{
                    formatTechFieldValue(row.left?.value)
                  }}</span>
                </template>
              </el-table-column>
              <el-table-column min-width="160">
                <template #default="{ row }">
                  <span v-if="row.right" class="pm-init-tech-field-label">{{
                    row.right.label || row.right.name || '-'
                  }}</span>
                  <span v-else class="pm-init-tech-field-empty">-</span>
                </template>
              </el-table-column>
              <el-table-column min-width="220">
                <template #default="{ row }">
                  <span v-if="row.right" class="pm-init-tech-field-value">{{
                    formatTechFieldValue(row.right.value)
                  }}</span>
                  <span v-else class="pm-init-tech-field-empty">-</span>
                </template>
              </el-table-column>
            </el-table>
          </div>

          <div style="margin-top: 12px">
            <div class="pm-init-spec-header" style="margin-bottom: 8px">
              <span style="font-weight: 600">技术规格表附件（手选）</span>
              <div style="display: flex; align-items: center; gap: 8px">
                <el-checkbox v-model="bmoSaveAttachment">保存到项目附件</el-checkbox>
                <el-button
                  type="primary"
                  size="small"
                  :loading="bmoReadingAttachment"
                  :disabled="!bmoAttachmentSelection"
                  @click="handleReadSelectedBmoAttachment"
                >
                  读取并校验
                </el-button>
              </div>
            </div>
            <el-table :data="bmoTechAttachments" border size="small" max-height="220">
              <el-table-column label="选择" width="70" align="center">
                <template #default="{ row }">
                  <el-radio v-model="bmoAttachmentSelection" :label="String(row.id || '')" />
                </template>
              </el-table-column>
              <el-table-column
                prop="fileName"
                label="文件名"
                min-width="320"
                show-overflow-tooltip
              />
              <el-table-column label="类型" width="80" align="center">
                <template #default="{ row }">
                  <el-tag
                    size="small"
                    :type="isExcelFileName(String(row.fileName || '')) ? 'success' : 'info'"
                    effect="plain"
                  >
                    {{ isExcelFileName(String(row.fileName || '')) ? 'Excel' : '其他' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="createdAt" label="上传时间" width="180" />
            </el-table>
          </div>
        </template>
        <el-empty
          v-else-if="!bmoLoading && !bmoLoadError"
          description="未找到对应的1.4数据"
          :image-size="64"
        />
      </div>

      <!-- 技术规格表读取区域 -->
      <div class="pm-init-spec-section">
        <div class="pm-init-spec-header">
          <span class="pm-init-spec-title">技术规格表</span>
          <el-upload
            :auto-upload="false"
            :show-file-list="false"
            accept=".xlsx,.xls"
            :on-change="handleSpecFileChange"
          >
            <template #trigger>
              <el-button type="primary" plain size="small">
                <Icon icon="vi-ep:upload" style="margin-right: 4px" />
                读取技术规格表
              </el-button>
            </template>
          </el-upload>
        </div>

        <!-- 读取的数据显示 -->
        <div v-if="specData" class="pm-init-spec-content">
          <el-descriptions :column="isMobile ? 1 : 2" border size="small">
            <el-descriptions-item label="零件材料及料厚">
              <span :class="{ 'pm-spec--missing': !specData.材料 }">{{
                specData.材料 || '待填写'
              }}</span>
              <el-tag
                v-if="getSourceText('材料')"
                class="pm-source-tag"
                size="small"
                effect="plain"
              >
                {{ getSourceText('材料') }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="型腔">
              <span :class="{ 'pm-spec--missing': !specData.型腔 }">{{
                specData.型腔 || '待填写'
              }}</span>
              <el-tag
                v-if="getSourceText('型腔')"
                class="pm-source-tag"
                size="small"
                effect="plain"
              >
                {{ getSourceText('型腔') }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="型芯">
              <span :class="{ 'pm-spec--missing': !specData.型芯 }">{{
                specData.型芯 || '待填写'
              }}</span>
              <el-tag
                v-if="getSourceText('型芯')"
                class="pm-source-tag"
                size="small"
                effect="plain"
              >
                {{ getSourceText('型芯') }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="模具穴数">
              <span :class="{ 'pm-spec--missing': !specData.模具穴数 }">{{
                specData.模具穴数 || '待填写'
              }}</span>
              <el-tag
                v-if="getSourceText('模具穴数')"
                class="pm-source-tag"
                size="small"
                effect="plain"
              >
                {{ getSourceText('模具穴数') }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="产品外观尺寸">
              <span :class="{ 'pm-spec--missing': !specData.产品外观尺寸 }">{{
                specData.产品外观尺寸 || '待填写'
              }}</span>
              <el-tag
                v-if="getSourceText('产品外观尺寸')"
                class="pm-source-tag"
                size="small"
                effect="plain"
              >
                {{ getSourceText('产品外观尺寸') }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="设计师">
              <span :class="{ 'pm-spec--missing': !specData.产品结构工程师 }">{{
                specData.产品结构工程师 || '待填写'
              }}</span>
              <el-tag
                v-if="getSourceText('产品结构工程师')"
                class="pm-source-tag"
                size="small"
                effect="plain"
              >
                {{ getSourceText('产品结构工程师') }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="顶出类型">
              <span :class="{ 'pm-spec--missing': !specData.顶出类型 }">{{
                specData.顶出类型 || '待填写'
              }}</span>
              <el-tag
                v-if="getSourceText('顶出类型')"
                class="pm-source-tag"
                size="small"
                effect="plain"
              >
                {{ getSourceText('顶出类型') }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="顶出方式">
              <span :class="{ 'pm-spec--missing': !specData.顶出方式 }">{{
                specData.顶出方式 || '待填写'
              }}</span>
              <el-tag
                v-if="getSourceText('顶出方式')"
                class="pm-source-tag"
                size="small"
                effect="plain"
              >
                {{ getSourceText('顶出方式') }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="复位方式">
              <span :class="{ 'pm-spec--missing': !specData.复位方式 }">{{
                specData.复位方式 || '待填写'
              }}</span>
              <el-tag
                v-if="getSourceText('复位方式')"
                class="pm-source-tag"
                size="small"
                effect="plain"
              >
                {{ getSourceText('复位方式') }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="零件图片" v-if="specData.零件图片">
              <img
                :src="getSpecImageUrl(specData.零件图片)"
                alt="零件图片"
                class="pm-init-spec-image"
                @click="showImagePreview(getSpecImageUrl(specData.零件图片))"
              />
            </el-descriptions-item>
          </el-descriptions>

          <div v-if="diffRows.length" class="pm-init-diff">
            <div class="pm-init-diff__header">
              <span class="pm-init-diff__title">技术规格表差异（逐行勾选后一次应用）</span>
              <el-button type="primary" size="small" @click="applySelectedDiffRows">
                应用勾选项
              </el-button>
            </div>
            <el-table :data="diffRows" border size="small" max-height="260">
              <el-table-column label="应用" width="60" align="center">
                <template #default="{ row }">
                  <el-checkbox v-model="row.selected" :disabled="!row.selectable" />
                </template>
              </el-table-column>
              <el-table-column prop="label" label="字段" width="160" />
              <el-table-column prop="currentValue" label="当前值（1.4优先）" min-width="220" />
              <el-table-column prop="nextValue" label="技术规格表值" min-width="220" />
            </el-table>
          </div>
        </div>
      </div>

      <div class="pm-init-groups-section">
        <div class="pm-init-groups-header">
          <div class="pm-init-groups-title">
            <div class="pm-init-groups-title__main">产品组</div>
            <div class="pm-init-groups-title__sub">
              <div>总穴数：{{ hasIncompleteCavity ? '待填写' : totalCavityCount }}</div>
              <div
                v-if="groups.length > 0"
                style="margin-top: 2px; font-size: 11px; color: #909399"
              >
                <span>详细：{{ hasIncompleteCavity ? '待填写' : cavityDetailFormat }}</span>
              </div>
            </div>
          </div>
          <el-button type="primary" plain @click="handleAddGroup">+ 添加产品组</el-button>
        </div>

        <VueDraggable
          v-model="groups"
          handle=".pm-init-group__drag"
          :animation="150"
          class="pm-init-groups-grid"
        >
          <div v-for="(group, index) in groups" :key="group.id" class="pm-init-group-wrap">
            <el-card
              shadow="hover"
              class="pm-init-group"
              :class="{ 'is-expanded': group.expanded }"
              @click="toggleExpanded(group.id)"
            >
              <div class="pm-init-group__header">
                <div class="pm-init-group__left">
                  <div class="pm-init-group__drag" title="拖拽排序" @click.stop>
                    <Icon icon="vi-ep:rank" />
                  </div>
                  <div class="pm-init-group__title">
                    <div>{{ group.productDrawing || `产品组 ${index + 1}` }}</div>
                    <div
                      v-if="String(group.productName || '').trim()"
                      class="pm-init-group__subtitle"
                    >
                      {{ group.productName }}
                    </div>
                    <div
                      v-if="String(group.productSize || '').trim()"
                      class="pm-init-group__subtitle"
                    >
                      {{ group.productSize }}
                    </div>
                  </div>
                </div>
                <div class="pm-init-group__right" @click.stop>
                  <el-button
                    text
                    type="danger"
                    title="删除"
                    :disabled="groups.length <= 1"
                    @click="handleDeleteGroup(group.id)"
                  >
                    <Icon icon="vi-ep:close" />
                  </el-button>
                </div>
              </div>

              <el-collapse-transition>
                <div v-show="group.expanded" class="pm-init-group__detail" @click.stop>
                  <el-form label-width="100px" class="pm-init-group__detail-form">
                    <el-form-item label="产品图号" :error="getProductDrawingError(group.id)">
                      <el-input
                        v-model="group.productDrawing"
                        :class="{
                          'pm-cell-input--error': !!getProductDrawingError(group.id),
                          'pm-cell-input--empty': !String(group.productDrawing || '').trim()
                        }"
                        placeholder="请输入产品图号"
                        @blur="validateProductDrawing(group.id)"
                      />
                    </el-form-item>
                    <el-form-item label="产品名称">
                      <el-input v-model="group.productName" placeholder="请输入产品名称（可选）" />
                    </el-form-item>
                    <el-form-item label="产品尺寸">
                      <el-input v-model="group.productSize" placeholder="请输入产品尺寸（可选）" />
                    </el-form-item>
                    <el-form-item label="穴数">
                      <el-input-number
                        v-model="group.cavityCount"
                        :min="0"
                        :max="64"
                        :controls="true"
                        :value-on-clear="undefined"
                        :class="{
                          'pm-cell-number--empty': !hasValidCavity(group.cavityCount)
                        }"
                        style="width: 100%"
                        @change="normalizeCavity(group.id)"
                      />
                    </el-form-item>
                  </el-form>
                </div>
              </el-collapse-transition>
            </el-card>
          </div>
        </VueDraggable>
      </div>
    </div>

    <template #footer>
      <div class="pm-init-footer">
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" @click="handleComplete">完成并进入编辑</el-button>
      </div>
    </template>
  </el-dialog>

  <!-- 图片预览对话框 -->
  <el-dialog v-model="imagePreviewVisible" title="零件图片预览" width="800px">
    <div style="text-align: center">
      <img :src="imagePreviewUrl" alt="零件图片" style="max-width: 100%; max-height: 600px" />
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { VueDraggable } from 'vue-draggable-plus'
import request from '@/axios'
import type { ProjectInfo } from '@/api/project'
import { uploadProjectAttachmentApi } from '@/api/project'
import {
  getBmoInitiationRequestByProjectApi,
  getBmoMouldProcurementByProjectApi,
  getBmoMouldProcurementDetailApi,
  type BmoInitiationTechSnapshot,
  type BmoMouldProcurementDetailAttachment
} from '@/api/bmo'
import { parseTechSpecExcel, type TechSpecData } from '@/utils/excel/techSpecParser'
import type { UploadFile } from 'element-plus'

type InitProductGroup = {
  id: string
  name: string
  cavityCount: number | undefined
  productDrawing?: string // 产品图号
  productName?: string // 产品名称
  productSize?: string // 产品尺寸
  expanded: boolean
}

const props = defineProps<{
  modelValue: boolean
  project: Partial<ProjectInfo> | null
  initialGroups: Array<Omit<InitProductGroup, 'expanded'>> | null
  isMobile: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'complete', v: Array<Omit<InitProductGroup, 'expanded'>>, specData?: any): void
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

const groups = ref<InitProductGroup[]>([])
const specData = ref<any>(null) // 技术规格表数据
const imagePreviewVisible = ref(false)
const imagePreviewUrl = ref('')
const specDataSources = ref<Record<string, 'bmo14' | 'techSpec' | 'manual'>>({})
const bmoLoading = ref(false)
const bmoLoadError = ref('')
const bmoSnapshot = ref<BmoInitiationTechSnapshot | null>(null)
const bmoAttachmentSelection = ref<string>('')
const bmoReadingAttachment = ref(false)
const bmoSaveAttachment = ref(true)

type FieldDiffRow = {
  key: string
  label: string
  currentValue: string
  nextValue: string
  currentRaw: any
  nextRaw: any
  selectable: boolean
  selected: boolean
}

const diffRows = ref<FieldDiffRow[]>([])

const SOURCE_TEXT: Record<'bmo14' | 'techSpec' | 'manual', string> = {
  bmo14: '1.4',
  techSpec: '技术规格表',
  manual: '手工'
}

const FIELD_KEYS: Array<{
  key: keyof TechSpecData | '顶出类型' | '顶出方式' | '复位方式'
  label: string
}> = [
  { key: '材料', label: '零件材料及料厚' },
  { key: '型腔', label: '前模材质' },
  { key: '型芯', label: '后模材质' },
  { key: '模具穴数', label: '模具穴数' },
  { key: '产品外观尺寸', label: '产品外观尺寸' },
  { key: '产品结构工程师', label: '设计师' },
  { key: '顶出类型', label: '顶出类型' },
  { key: '顶出方式', label: '顶出方式' },
  { key: '复位方式', label: '复位方式' }
]

const toSafeCavity = (value: unknown) => {
  if (value === undefined || value === '') return 1
  const n = Number(value)
  if (!Number.isFinite(n)) return 1
  return Math.min(64, Math.max(1, Math.round(n)))
}

const hasValidCavity = (value: unknown) => {
  if (value === undefined || value === '') return false
  const n = Number(value)
  return Number.isFinite(n) && n >= 1
}

const parseChineseNumber = (raw: string): number | null => {
  const s = String(raw || '').trim()
  if (!s) return null
  if (/^\d+$/.test(s)) return Number(s)

  const digitMap: Record<string, number> = {
    零: 0,
    〇: 0,
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9
  }

  if (s === '十') return 10
  if (s.includes('十')) {
    const [leftRaw, rightRaw] = s.split('十')
    const left = leftRaw ? digitMap[leftRaw] : 1
    const right = rightRaw ? digitMap[rightRaw] : 0
    if (left === undefined || right === undefined) return null
    return left * 10 + right
  }

  const single = digitMap[s]
  return single === undefined ? null : single
}

const parseMouldCavityText = (raw: unknown): { expression: string; counts: number[] } => {
  const original = String(raw || '').trim()
  if (!original) return { expression: '', counts: [] }

  const normalized = original.replaceAll('（', '(').replaceAll('）', ')').replace(/\s+/g, '')

  const parenMatch = normalized.match(/\(([^)]+)\)/)
  const inside = parenMatch?.[1] || ''

  const parseCountsFromExpr = (expr: string): number[] => {
    const e = String(expr || '').trim()
    if (!e) return []
    const parts = e
      .split('+')
      .map((p) => p.trim())
      .filter(Boolean)
    const counts: number[] = []
    for (const part of parts) {
      const token = part.includes('*') ? part.split('*').pop() || '' : part
      const n = Number(String(token).trim())
      if (!Number.isFinite(n) || n <= 0) continue
      counts.push(Math.max(1, Math.trunc(n)))
    }
    return counts
  }

  // A) 优先解析括号内的 "2+2" / "1*2+1*2"（每段代表一个产品的穴数）
  const countsFromParen = parseCountsFromExpr(inside)
  if (countsFromParen.length) {
    return {
      expression: countsFromParen.map((n) => `1*${n}`).join('+'),
      counts: countsFromParen
    }
  }

  // B) 没有括号表达式：解析 "一模四腔/一模四穴/一模4穴" -> "1*4"
  const arabicMatch = normalized.match(/一模(\d+)(?:腔|穴)/)
  if (arabicMatch?.[1]) {
    const n = Number(arabicMatch[1])
    if (Number.isFinite(n) && n > 0) {
      const c = Math.max(1, Math.trunc(n))
      return { expression: `1*${c}`, counts: [c] }
    }
  }

  const zhMatch = normalized.match(/一模([一二两三四五六七八九十〇零]+)(?:腔|穴)/)
  if (zhMatch?.[1]) {
    const n = parseChineseNumber(zhMatch[1])
    if (n && n > 0) {
      const c = Math.max(1, Math.trunc(n))
      return { expression: `1*${c}`, counts: [c] }
    }
  }

  return { expression: '', counts: [] }
}

const normalizeText = (value: unknown) => String(value ?? '').trim()

const normalizeFieldName = (value: unknown) =>
  normalizeText(value).replaceAll(/\s+/g, '').replaceAll('：', ':').toLowerCase()

const getSourceText = (key: string) => {
  const source = specDataSources.value[key]
  return source ? SOURCE_TEXT[source] : ''
}

const isExcelFileName = (name: string) => /\.(xlsx|xls)$/i.test(String(name || '').trim())

const bmoTechAttachments = computed<BmoMouldProcurementDetailAttachment[]>(
  () => bmoSnapshot.value?.tech?.attachments || []
)

const selectedBmoAttachment = computed(() =>
  bmoTechAttachments.value.find((item) => String(item.id || '') === bmoAttachmentSelection.value)
)

const bmoTechFields = computed(() => bmoSnapshot.value?.tech?.fields || [])
const bmoTechFieldRows = computed(() => {
  const fields = bmoTechFields.value || []
  const rows: Array<{ left: any; right?: any }> = []
  for (let i = 0; i < fields.length; i += 2) {
    rows.push({
      left: fields[i],
      right: fields[i + 1]
    })
  }
  return rows
})

const buildPrimaryDataFromBmo = () => {
  const next: any = {
    材料: '',
    型腔: '',
    型芯: '',
    模具穴数: '',
    产品外观尺寸: '',
    产品列表: [] as string[],
    产品名称列表: [] as string[],
    产品数量列表: [] as number[],
    产品重量列表: [] as number[],
    产品尺寸列表: [] as string[],
    产品结构工程师: '',
    零件图片: '',
    顶出类型: '',
    顶出方式: '',
    复位方式: ''
  }
  const sources: Record<string, 'bmo14' | 'techSpec' | 'manual'> = {}

  const setIfEmpty = (key: string, value: unknown) => {
    const v = normalizeText(value)
    if (!v) return
    if (!normalizeText(next[key])) {
      next[key] = v
      sources[key] = 'bmo14'
    }
  }

  if (bmoSnapshot.value?.designer) setIfEmpty('产品结构工程师', bmoSnapshot.value.designer)

  for (const field of bmoTechFields.value) {
    const name = normalizeFieldName(field.name || field.label)
    const label = normalizeFieldName(field.label || field.name)
    const raw = normalizeText(field.value)
    if (!raw) continue

    if (name === 'fd_col_o527xg' || /模具(穴|腔)数|型腔数/.test(label)) {
      setIfEmpty('模具穴数', raw)
      continue
    }
    if (/零件材料及料厚/.test(label)) {
      setIfEmpty('材料', raw)
      continue
    }
    if (/型腔|前模材质/.test(label) && !/数/.test(label)) {
      setIfEmpty('型腔', raw)
      continue
    }
    if (/型芯|后模材质/.test(label) && !/数/.test(label)) {
      setIfEmpty('型芯', raw)
      continue
    }
    if (/产品外观尺寸/.test(label)) {
      setIfEmpty('产品外观尺寸', raw)
      continue
    }
    if (/顶出类型/.test(label)) {
      setIfEmpty('顶出类型', raw)
      continue
    }
    if (/顶出方式/.test(label)) {
      setIfEmpty('顶出方式', raw)
      continue
    }
    if (/复位方式/.test(label)) {
      setIfEmpty('复位方式', raw)
      continue
    }
  }

  const projectDrawing = normalizeText(getProductDrawing())
  const projectName = normalizeText(getProductName())
  if (projectDrawing) {
    next.产品列表 = [projectDrawing]
    next.产品名称列表 = [projectName]
    next.产品数量列表 = [0]
    next.产品重量列表 = [0]
    next.产品尺寸列表 = [normalizeText(next.产品外观尺寸)]
    sources.产品列表 = 'bmo14'
    sources.产品名称列表 = 'bmo14'
    sources.产品数量列表 = 'bmo14'
    sources.产品重量列表 = 'bmo14'
    sources.产品尺寸列表 = 'bmo14'
  }

  return { data: next, sources }
}

const applyPrimaryBmoData = () => {
  const { data, sources } = buildPrimaryDataFromBmo()
  specData.value = data
  specDataSources.value = sources

  const cavityParsed = parseMouldCavityText(data.模具穴数)
  if (cavityParsed.expression) {
    specData.value.模具穴数 = cavityParsed.expression
    specDataSources.value.模具穴数 = 'bmo14'
  }

  if (Array.isArray(data.产品列表) && data.产品列表.length > 0) {
    applyProductDrawingsToGroups(data.产品列表, data.产品尺寸列表, cavityParsed.counts)
  }
}

const parseCsvLikeList = (raw: string) =>
  raw
    .split(/[，,、;；\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .join(',')

const patchMultiSelectFields = (data: any) => {
  ;['顶出类型', '顶出方式', '复位方式'].forEach((k) => {
    const v = normalizeText(data?.[k])
    if (!v) return
    data[k] = parseCsvLikeList(v)
  })
}

const toDisplayText = (value: unknown) => {
  if (Array.isArray(value))
    return value
      .map((v) => normalizeText(v))
      .filter(Boolean)
      .join(' / ')
  return normalizeText(value)
}

const formatTechFieldValue = (value: unknown) => {
  const text = normalizeText(value)
  return text || '-'
}

const getProductDrawing = () => {
  return props.project?.productDrawing || props.project?.产品图号 || ''
}

const getProductName = () => {
  return props.project?.productName || props.project?.产品名称 || ''
}

const makeDefaultGroup = (index: number, cavityCount?: number): InitProductGroup => {
  const productDrawing = getProductDrawing()
  const productName = getProductName()
  return {
    id: `g_${Date.now()}_${Math.random().toString(16).slice(2)}_${index}`,
    name: `产品组 ${index + 1}`, // 保留name字段用于内部标识，但不显示
    productDrawing: productDrawing || '',
    productName: productName || '',
    productSize: '',
    cavityCount: cavityCount === undefined ? undefined : toSafeCavity(cavityCount),
    expanded: true
  }
}

const resetFromProps = () => {
  const initial = props.initialGroups || []
  const productDrawing = getProductDrawing()
  const productName = getProductName()
  console.log('[初始化弹窗] resetFromProps - productDrawing:', productDrawing)
  console.log('[初始化弹窗] resetFromProps - props.project:', props.project)

  if (initial.length) {
    groups.value = initial.map((g, idx) => {
      return {
        id: g.id || makeDefaultGroup(idx, g.cavityCount).id,
        name: `产品组 ${idx + 1}`,
        productDrawing: (g as any).productDrawing || productDrawing || '',
        productName: (g as any).productName || productName || '',
        productSize: (g as any).productSize || '',
        cavityCount: hasValidCavity(g.cavityCount) ? toSafeCavity(g.cavityCount) : undefined,
        expanded: true
      }
    })
    return
  }

  // 没有初始数据时，创建默认产品组1
  const fallback = undefined
  console.log('[初始化弹窗] resetFromProps - productDrawing:', productDrawing)
  groups.value = [
    {
      id: `g_${Date.now()}_${Math.random().toString(16).slice(2)}_0`,
      name: '产品组 1',
      productDrawing: productDrawing || '',
      productName: productName || '',
      productSize: '',
      cavityCount: fallback,
      expanded: true
    }
  ]
}

const loadBmoSnapshotByProject = async () => {
  const projectCode = normalizeText(props.project?.项目编号)
  if (!projectCode) return

  bmoLoading.value = true
  bmoLoadError.value = ''
  bmoSnapshot.value = null
  bmoAttachmentSelection.value = ''
  diffRows.value = []

  try {
    const resp = await getBmoInitiationRequestByProjectApi({ projectCode })
    const row: any = resp?.data || null
    const snapshot = (row?.tech_snapshot || null) as BmoInitiationTechSnapshot | null
    if (snapshot) {
      bmoSnapshot.value = snapshot
      applyPrimaryBmoData()
      return
    }

    // 兜底：立项快照不存在时，按项目编号回查 BMO 记录并读取实时 1.4 详情
    const bmoRowResp = await getBmoMouldProcurementByProjectApi({ projectCode })
    const bmoRecordId = normalizeText((bmoRowResp?.data as any)?.bmo_record_id)
    if (!bmoRecordId) return

    const detailResp = await getBmoMouldProcurementDetailApi({ fdId: bmoRecordId })
    const detail = detailResp?.data
    if (!detail) return

    bmoSnapshot.value = {
      fdId: detail.fdId || bmoRecordId,
      demandType: detail.demandType ?? null,
      designer: detail.designer ?? null,
      tech: detail.tech || { tableName: '', fields: [], attachments: [] }
    }
    applyPrimaryBmoData()
  } catch (e: any) {
    bmoLoadError.value = e?.message || '读取 1.4 数据失败'
  } finally {
    bmoLoading.value = false
  }
}

watch(
  () => props.modelValue,
  async (v) => {
    if (!v) return
    resetFromProps()
    await loadBmoSnapshotByProject()
  }
)

// 监听项目数据变化，如果有产品图号，则更新默认产品组的产品图号
watch(
  () => props.project,
  () => {
    if (!props.modelValue) return
    const productDrawing = getProductDrawing()
    console.log('[初始化弹窗] watch project - productDrawing:', productDrawing)
    console.log('[初始化弹窗] watch project - groups.value:', groups.value)
    if (productDrawing && groups.value.length > 0) {
      groups.value.forEach((group) => {
        // 如果产品图号为空，则使用项目默认的产品图号
        if (!group.productDrawing || !group.productDrawing.trim()) {
          group.productDrawing = productDrawing
        }
      })
    }
  },
  { deep: true, immediate: true }
)

const totalCavityCount = computed(() =>
  groups.value.reduce(
    (sum, g) => (hasValidCavity(g.cavityCount) ? sum + toSafeCavity(g.cavityCount) : sum),
    0
  )
)

const hasIncompleteCavity = computed(() => groups.value.some((g) => !hasValidCavity(g.cavityCount)))

// 生成模具穴数详细格式（如 1*2+1*2，表示1种产品×2穴 + 1种产品×2穴）
const cavityDetailFormat = computed(() => {
  if (!groups.value || groups.value.length === 0) return ''

  if (groups.value.some((g) => !hasValidCavity(g.cavityCount))) return ''

  if (groups.value.length === 1) {
    // 单产品组，返回 1*穴数
    return `1*${toSafeCavity(groups.value[0].cavityCount)}`
  }

  // 多产品组，使用 1*穴数 格式，用 + 连接
  return groups.value.map((g) => `1*${toSafeCavity(g.cavityCount)}`).join('+')
})

const toggleExpanded = (id: string) => {
  const group = groups.value.find((g) => g.id === id)
  if (!group) return
  group.expanded = !group.expanded
}

const normalizeCavity = (id: string) => {
  const group = groups.value.find((g) => g.id === id)
  if (!group) return
  if (!hasValidCavity(group.cavityCount)) {
    group.cavityCount = undefined
    return
  }
  group.cavityCount = toSafeCavity(group.cavityCount)
}

const handleAddGroup = () => {
  groups.value.push(makeDefaultGroup(groups.value.length))
}

const handleDeleteGroup = (id: string) => {
  if (groups.value.length <= 1) return
  groups.value = groups.value.filter((g) => g.id !== id)
  // 删除后不需要重新编号，因为标题显示的是产品图号
}

const applyProductDrawingsToGroups = (
  drawings: string[],
  sizes?: string[],
  cavityCounts?: number[]
) => {
  const list = (drawings || []).map((d) => String(d || '').trim()).filter(Boolean)
  const sizeList = (sizes || []).map((s) => String(s || '').trim())
  const cavityList = (cavityCounts || []).map((c) => toSafeCavity(c))

  if (list.length === 0) return

  // 去重（忽略大小写），保持顺序
  const unique: string[] = []
  const seen = new Set<string>()
  for (const d of list) {
    const key = d.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(d)
  }

  // 尽量保留已填写的穴数（按图号匹配）
  const cavityByDrawing = new Map<string, number>()
  const nameByDrawing = new Map<string, string>()
  const sizeByDrawing = new Map<string, string>()
  for (const g of groups.value) {
    const d = String(g.productDrawing || '').trim()
    if (!d) continue
    const key = d.toLowerCase()
    const pn = String(g.productName || '').trim()
    if (pn && !nameByDrawing.has(key)) nameByDrawing.set(key, pn)
    const ps = String(g.productSize || '').trim()
    if (ps && !sizeByDrawing.has(key)) sizeByDrawing.set(key, ps)
    if (!hasValidCavity(g.cavityCount)) continue
    if (!cavityByDrawing.has(key)) cavityByDrawing.set(key, toSafeCavity(g.cavityCount))
  }

  groups.value = unique.map((d, idx) => {
    const next = makeDefaultGroup(idx)
    next.productDrawing = d
    const fromSpecCavity = cavityList[idx]
    const kept = cavityByDrawing.get(d.toLowerCase())
    next.cavityCount =
      fromSpecCavity !== undefined ? fromSpecCavity : kept === undefined ? undefined : kept
    const keptName = nameByDrawing.get(d.toLowerCase())
    if (keptName) next.productName = keptName
    const fromSpecSize = sizeList[idx] || ''
    const keptSize = sizeByDrawing.get(d.toLowerCase()) || ''
    next.productSize = fromSpecSize || keptSize || ''
    next.expanded = true
    return next
  })
}

// 验证产品图号是否重复
const validateProductDrawing = (groupId?: string) => {
  const productDrawings = groups.value
    .filter((g) => g.id !== groupId && g.productDrawing && g.productDrawing.trim())
    .map((g) => g.productDrawing!.trim().toLowerCase())

  const currentGroup = groupId ? groups.value.find((g) => g.id === groupId) : null
  if (currentGroup && currentGroup.productDrawing) {
    const currentDrawing = currentGroup.productDrawing.trim().toLowerCase()
    if (currentDrawing && productDrawings.includes(currentDrawing)) {
      return `图号重复`
    }
  }
  return ''
}

// 获取产品图号错误信息
const getProductDrawingError = (groupId: string) => {
  return validateProductDrawing(groupId)
}

const handleComplete = () => {
  if (!groups.value.length) {
    ElMessage.warning('请至少保留 1 个产品组')
    return
  }

  // 验证穴数必填
  const cavityErrors: string[] = []
  groups.value.forEach((group, index) => {
    if (!hasValidCavity(group.cavityCount)) {
      cavityErrors.push(`产品组 ${index + 1}: 请填写穴数（>= 1）`)
    }
  })
  if (cavityErrors.length > 0) {
    ElMessage.error(cavityErrors.join('\n'))
    return
  }

  // 验证所有产品组的产品图号是否重复
  const errors: string[] = []
  groups.value.forEach((group, index) => {
    const error = validateProductDrawing(group.id)
    if (error) {
      errors.push(`产品组 ${index + 1}: ${error}`)
    }
  })

  if (errors.length > 0) {
    ElMessage.error('产品图号不能重复：\n' + errors.join('\n'))
    return
  }

  emit(
    'complete',
    groups.value.map(({ expanded: _expanded, ...g }) => ({
      ...g,
      cavityCount: toSafeCavity(g.cavityCount)
    })),
    specData.value
  )
  visible.value = false
}

const handleClosed = () => {
  // 弹窗关闭时的清理逻辑
  specData.value = null
  specDataSources.value = {}
  bmoSnapshot.value = null
  bmoLoadError.value = ''
  bmoAttachmentSelection.value = ''
  diffRows.value = []
  imagePreviewVisible.value = false
  imagePreviewUrl.value = ''
}

const cloneSpecData = (data: any) =>
  JSON.parse(
    JSON.stringify(
      data || {
        材料: '',
        型腔: '',
        型芯: '',
        模具穴数: '',
        产品外观尺寸: '',
        产品列表: [],
        产品名称列表: [],
        产品数量列表: [],
        产品重量列表: [],
        产品尺寸列表: [],
        产品结构工程师: '',
        零件图片: '',
        顶出类型: '',
        顶出方式: '',
        复位方式: ''
      }
    )
  )

const pickMatchedTechSpecData = async (arrayBuffer: ArrayBuffer) => {
  const parsed = await parseTechSpecExcel(arrayBuffer)
  const records = parsed.records || []
  if (!records.length) throw new Error('技术规格表中未解析到有效数据')

  const drawing = normalizeText(getProductDrawing()).toLowerCase()
  const name = normalizeText(getProductName()).toLowerCase()

  let record =
    records.find((r) =>
      (r.drawings || []).some((d) => normalizeText(d).toLowerCase() === drawing)
    ) ||
    records.find((r) => normalizeText(r.partName).toLowerCase() === name) ||
    records[0]

  const data = cloneSpecData(record.specData)
  patchMultiSelectFields(data)
  return data
}

const compareArrayField = (a: any, b: any) =>
  JSON.stringify(Array.isArray(a) ? a : []) === JSON.stringify(Array.isArray(b) ? b : [])

const buildFieldDiffs = (baseData: any, candidateData: any) => {
  const nextDiffs: FieldDiffRow[] = []
  const keys = [
    ...FIELD_KEYS.map((x) => ({ key: x.key as string, label: x.label })),
    { key: '产品列表', label: '产品列表' },
    { key: '产品名称列表', label: '产品名称列表' },
    { key: '产品数量列表', label: '产品数量列表' },
    { key: '产品重量列表', label: '产品重量列表' },
    { key: '产品尺寸列表', label: '产品尺寸列表' }
  ]
  for (const item of keys) {
    const currentVal = baseData[item.key]
    const nextVal = candidateData[item.key]
    const equal =
      Array.isArray(currentVal) || Array.isArray(nextVal)
        ? compareArrayField(currentVal, nextVal)
        : normalizeText(currentVal) === normalizeText(nextVal)
    if (equal) continue
    nextDiffs.push({
      key: item.key,
      label: item.label,
      currentValue: toDisplayText(currentVal) || '（空）',
      nextValue: toDisplayText(nextVal) || '（空）',
      currentRaw: currentVal,
      nextRaw: nextVal,
      selectable: ![
        '产品列表',
        '产品名称列表',
        '产品数量列表',
        '产品重量列表',
        '产品尺寸列表'
      ].includes(item.key),
      selected: false
    })
  }
  return nextDiffs
}

const applyTechSpecFallback = (candidateData: any) => {
  const current = cloneSpecData(specData.value)
  patchMultiSelectFields(current)
  patchMultiSelectFields(candidateData)

  // 产品列表：1.4 优先，仅在空时补齐
  const hasCurrentDrawings = Array.isArray(current.产品列表) && current.产品列表.length > 0
  if (
    !hasCurrentDrawings &&
    Array.isArray(candidateData.产品列表) &&
    candidateData.产品列表.length > 0
  ) {
    current.产品列表 = candidateData.产品列表
    current.产品名称列表 = candidateData.产品名称列表 || []
    current.产品数量列表 = candidateData.产品数量列表 || []
    current.产品重量列表 = candidateData.产品重量列表 || []
    current.产品尺寸列表 = candidateData.产品尺寸列表 || []
    specDataSources.value.产品列表 = 'techSpec'
    specDataSources.value.产品名称列表 = 'techSpec'
    specDataSources.value.产品数量列表 = 'techSpec'
    specDataSources.value.产品重量列表 = 'techSpec'
    specDataSources.value.产品尺寸列表 = 'techSpec'
  }

  for (const item of FIELD_KEYS) {
    const key = item.key as string
    const currentVal = normalizeText(current[key])
    const nextVal = normalizeText(candidateData[key])
    if (!nextVal) continue
    if (!currentVal) {
      current[key] = nextVal
      specDataSources.value[key] = 'techSpec'
    }
  }

  const rawDiffs = buildFieldDiffs(current, candidateData)
  diffRows.value = rawDiffs

  specData.value = current

  const cavityParsed = parseMouldCavityText(current.模具穴数)
  if (Array.isArray(current.产品列表) && current.产品列表.length > 0) {
    applyProductDrawingsToGroups(current.产品列表, current.产品尺寸列表, cavityParsed.counts)
  }
}

const applySelectedDiffRows = () => {
  if (!diffRows.value.some((row) => row.selected)) {
    ElMessage.warning('请先勾选差异项')
    return
  }
  const next = cloneSpecData(specData.value)
  for (const row of diffRows.value) {
    if (!row.selected || !row.selectable) continue
    const key = row.key
    next[key] = Array.isArray(row.nextRaw) ? [...row.nextRaw] : row.nextRaw
    specDataSources.value[key] = 'techSpec'
  }
  specData.value = next
  const cavityParsed = parseMouldCavityText(next.模具穴数)
  if (Array.isArray(next.产品列表) && next.产品列表.length > 0) {
    applyProductDrawingsToGroups(next.产品列表, next.产品尺寸列表, cavityParsed.counts)
  }
  diffRows.value = []
  ElMessage.success('已应用勾选差异')
}

const saveSelectedAttachmentToProject = async (file: File) => {
  const projectCode = normalizeText(props.project?.项目编号)
  if (!projectCode) throw new Error('缺少项目编号，无法保存附件')
  await uploadProjectAttachmentApi(projectCode, 'technical-spec', file)
}

const handleSpecArrayBuffer = async (arrayBuffer: ArrayBuffer) => {
  const parsedData = await pickMatchedTechSpecData(arrayBuffer)
  applyTechSpecFallback(parsedData)
}

const handleReadSelectedBmoAttachment = async () => {
  const picked = selectedBmoAttachment.value
  if (!picked?.id) {
    ElMessage.warning('请先选择技术规格表附件')
    return
  }
  if (!isExcelFileName(String(picked.fileName || ''))) {
    ElMessage.warning('仅支持读取 Excel 技术规格表附件（.xlsx/.xls）')
    return
  }

  bmoReadingAttachment.value = true
  try {
    const resp: any = await request.get<Blob>({
      url: `/api/bmo/attachment/download/${encodeURIComponent(String(picked.id))}`,
      responseType: 'blob'
    })
    const blob = ((resp as any)?.data ?? resp) as Blob
    const fileName = String(picked.fileName || 'BMO技术规格表.xlsx')
    const file = new File([blob], fileName, {
      type: blob.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })

    if (bmoSaveAttachment.value) {
      await saveSelectedAttachmentToProject(file)
    }

    const buffer = await file.arrayBuffer()
    await handleSpecArrayBuffer(buffer)
    ElMessage.success(`技术规格表已读取${bmoSaveAttachment.value ? '并保存' : ''}`)
  } catch (error: any) {
    console.error('读取 BMO 技术规格表失败:', error)
    ElMessage.error(error?.message || '读取 BMO 技术规格表失败')
  } finally {
    bmoReadingAttachment.value = false
  }
}

// 处理本地技术规格表文件上传（手工兜底）
const handleSpecFileChange = async (file: UploadFile) => {
  if (!file.raw) {
    ElMessage.error('文件读取失败')
    return
  }
  try {
    const arrayBuffer = await file.raw.arrayBuffer()
    await handleSpecArrayBuffer(arrayBuffer)
    ElMessage.success('技术规格表读取成功')
  } catch (error: any) {
    console.error('读取技术规格表失败:', error)
    ElMessage.error(`读取失败: ${error.message || '未知错误'}`)
  }
}

// 获取技术规格表图片URL
const getSpecImageUrl = (imageValue: any): string => {
  if (!imageValue) return ''

  if (typeof imageValue === 'string') {
    // 如果是URL或base64，直接返回
    if (imageValue.startsWith('http') || imageValue.startsWith('data:')) {
      return imageValue
    }
    // 如果是相对路径，可能需要转换为完整URL
    if (imageValue.startsWith('/')) {
      return imageValue
    }
  }

  return String(imageValue)
}

// 显示图片预览
const showImagePreview = (url: string) => {
  imagePreviewUrl.value = url
  imagePreviewVisible.value = true
}
</script>

<style scoped>
@media (width <= 768px) {
  .pm-init-groups-grid {
    grid-template-columns: 1fr;
  }
}

.pm-cell-input--error :deep(.el-input__wrapper) {
  background: rgb(245 108 108 / 8%);
  box-shadow: 0 0 0 1px var(--el-color-danger) inset;
}

.pm-cell-input--empty :deep(.el-input__wrapper) {
  background: rgb(230 162 60 / 8%);
  box-shadow: 0 0 0 1px var(--el-color-warning) inset;
}

.pm-cell-number--empty :deep(.el-input__wrapper) {
  background: rgb(230 162 60 / 8%);
  box-shadow: 0 0 0 1px var(--el-color-warning) inset;
}

.pm-init-group__subtitle {
  max-width: 100%;
  margin-top: 2px;
  overflow: hidden;
  font-size: 12px;
  line-height: 1.1;
  color: var(--el-text-color-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* C) 技术规格表缺失字段高亮 */
.pm-spec--missing {
  display: inline-block;
  padding: 0 6px;
  color: var(--el-color-warning);
  background: rgb(230 162 60 / 12%);
  border-radius: 4px;
}

.pm-init-dialog-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.pm-init-title-tip {
  font-weight: normal;
}

.pm-init-desc {
  margin-bottom: 20px;
}

.pm-init-groups-section {
  margin-top: 20px;
}

.pm-init-groups-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.pm-init-groups-title__main {
  font-weight: 600;
}

.pm-init-groups-title__sub {
  margin-top: 2px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.pm-init-groups-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.pm-init-group {
  cursor: pointer;
}

.pm-init-group__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.pm-init-group__left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.pm-init-group__drag {
  color: var(--el-text-color-secondary);
  cursor: move;
}

.pm-init-group__title {
  overflow: hidden;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pm-init-group__right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.pm-init-group__detail {
  padding-top: 10px;
  margin-top: 10px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.pm-init-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.pm-init-spec-section {
  padding: 16px;
  margin-top: 20px;
  background: var(--el-bg-color-page);
  border-radius: 4px;
}

.pm-init-spec-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.pm-init-spec-title {
  font-size: 14px;
  font-weight: 600;
}

.pm-init-spec-content {
  margin-top: 12px;
}

.pm-source-tag {
  margin-left: 8px;
}

.pm-init-diff {
  margin-top: 12px;
}

.pm-init-diff__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.pm-init-diff__title {
  font-size: 13px;
  font-weight: 600;
}

.pm-init-spec-image {
  max-width: 120px;
  max-height: 120px;
  padding: 4px;
  cursor: pointer;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  object-fit: contain;
}

.pm-init-spec-image:hover {
  border-color: var(--el-color-primary);
}

.pm-init-tech-field-label {
  font-weight: 600;
}

.pm-init-tech-field-value {
  word-break: break-all;
}

.pm-init-tech-field-empty {
  color: var(--el-text-color-placeholder);
}

/* B) 产品组单元格颜色（产品图号/穴数） */
</style>
