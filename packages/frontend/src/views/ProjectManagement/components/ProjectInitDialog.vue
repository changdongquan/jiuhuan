<template>
  <el-dialog
    v-model="visible"
    :width="isMobile ? '100%' : '1030px'"
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
      <div class="pm-init-steps">
        <el-steps :active="currentStep - 1" finish-status="success" simple>
          <el-step title="步骤1 产品组" />
          <el-step title="步骤2 技术规格表信息" />
        </el-steps>
      </div>

      <el-descriptions
        :column="isMobile ? 1 : 4"
        :label-width="isMobile ? undefined : 85"
        border
        class="pm-init-desc"
      >
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

      <div v-if="currentStep === 2" class="pm-init-spec-section">
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
                    resolveTechFieldLabel(row.left)
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
                    resolveTechFieldLabel(row.right)
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
                  <el-radio
                    v-model="bmoAttachmentSelection"
                    :label="String(row.selectionId || '')"
                    :disabled="!row.id"
                  />
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
                    :type="isExcelAttachment(row) ? 'success' : 'info'"
                    effect="plain"
                  >
                    {{ isExcelAttachment(row) ? 'Excel' : '其他' }}
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
      <div v-if="currentStep === 2" class="pm-init-spec-section">
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
            <el-descriptions-item label="材料">
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

      <div v-if="currentStep === 1" class="pm-init-groups-section">
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
                        @blur="handleProductDrawingBlur(group.id)"
                      />
                    </el-form-item>
                    <el-form-item label="产品名称">
                      <el-input
                        v-model="group.productName"
                        placeholder="请输入产品名称（可选）"
                        @blur="handleProductNameBlur"
                      />
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
        <template v-if="currentStep === 1">
          <el-button @click="visible = false">取消</el-button>
          <el-button type="primary" @click="handleNextStep">下一步：技术规格表</el-button>
        </template>
        <template v-else>
          <el-button @click="handlePrevStep">上一步</el-button>
          <el-button @click="visible = false">取消</el-button>
          <el-button type="primary" @click="handleComplete">完成并进入编辑</el-button>
        </template>
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
  getBmoTechSpecParsedCacheApi,
  saveBmoTechSpecParsedCacheApi,
  type BmoInitiationTechSnapshot,
  type BmoMouldProcurementDetailAttachment
} from '@/api/bmo'
import {
  parseDrawings,
  parseTechSpecExcel,
  type TechSpecData,
  type TechSpecRecord
} from '@/utils/excel/techSpecParser'
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
const currentStep = ref<1 | 2>(1)

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
  bmo14: 'BMO',
  techSpec: '技术规格表',
  manual: '手工'
}

const FIELD_KEYS: Array<{ key: keyof TechSpecData; label: string }> = [
  { key: '材料', label: '材料' },
  { key: '型腔', label: '型腔钢材' },
  { key: '型芯', label: '型芯钢材' },
  { key: '模具穴数', label: '模具穴数' },
  { key: '产品外观尺寸', label: '产品尺寸/mm' },
  { key: '产品结构工程师', label: '设计师' }
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

  const normalized = original
    .replaceAll('（', '(')
    .replaceAll('）', ')')
    .replaceAll('＋', '+')
    .replaceAll('，', ',')
    .replace(/\s+/g, '')

  const parenMatch = normalized.match(/\(([^)]+)\)/)
  const inside = parenMatch?.[1] || ''

  const parseCountsFromExpr = (expr: string): number[] => {
    const e = String(expr || '').trim()
    if (!e) return []
    const parts = e
      .split(/[+,，、]/)
      .map((p) => p.trim())
      .filter(Boolean)
    const counts: number[] = []
    for (const part of parts) {
      const token = String(part.includes('*') ? part.split('*').pop() || '' : part).trim()
      if (!token) continue

      // 兼容 "1*1(前模)" / "1*1穴" / "一+一" 等混合文本
      const digitMatches = token.match(/\d+/g)
      if (digitMatches && digitMatches.length) {
        const n = Number(digitMatches[digitMatches.length - 1])
        if (Number.isFinite(n) && n > 0) {
          counts.push(Math.max(1, Math.trunc(n)))
          continue
        }
      }

      const zh = token.match(/[一二两三四五六七八九十〇零]+/)
      if (zh?.[0]) {
        const n = parseChineseNumber(zh[0])
        if (n && n > 0) {
          counts.push(Math.max(1, Math.trunc(n)))
        }
      }
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

  // A2) 解析无括号表达式："1*2+1*2" / "2+2"
  const countsFromWhole = parseCountsFromExpr(normalized)
  if (countsFromWhole.length) {
    return {
      expression: countsFromWhole.map((n) => `1*${n}`).join('+'),
      counts: countsFromWhole
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

const normalizeMouldCavityExpression = (raw: unknown) => {
  const text = normalizeText(raw)
  if (!text) return { value: '', counts: [] as number[] }
  const parsed = parseMouldCavityText(text)
  return {
    value: parsed.expression || text,
    counts: parsed.counts
  }
}

const splitSizeValues = (value: unknown) => {
  const text = String(value || '').trim()
  if (!text) return []
  const normalized = text.replace(/\s*([*xX×])\s*/g, '$1').trim()
  if (!normalized) return []
  if (/[\/／]/.test(normalized)) {
    return normalized
      .split(/[\/／]/)
      .map((x) => x.trim())
      .filter(Boolean)
  }
  if (/\s+/.test(normalized)) {
    return normalized
      .split(/\s+/)
      .map((x) => x.trim())
      .filter(Boolean)
  }
  return [normalized]
}

const normalizeText = (value: unknown) => String(value ?? '').trim()

const normalizeFieldName = (value: unknown) =>
  normalizeText(value).replaceAll(/\s+/g, '').replaceAll('：', ':').toLowerCase()

const getSourceText = (key: string) => {
  const source = specDataSources.value[key]
  return source ? SOURCE_TEXT[source] : ''
}

const isExcelFileName = (name: string) => /\.(xlsx|xls)$/i.test(String(name || '').trim())
const normalizeExcelExt = (extLike: unknown) =>
  normalizeText(extLike).toLowerCase().replace(/^\./, '')
const TECH_SPEC_PARSED_CACHE_VERSION = 3

const isExcelAttachment = (attachment: any) => {
  if (!attachment) return false
  if (isExcelFileName(String(attachment.fileName || ''))) return true
  const ext = normalizeExcelExt(attachment.fileExt || attachment.fdFileExtName)
  return ext === 'xlsx' || ext === 'xls'
}

const normalizeBmoAttachment = (
  raw: any,
  index: number
): BmoMouldProcurementDetailAttachment & { selectionId: string } => {
  const id = normalizeText(raw?.id ?? raw?.fdId ?? raw?.attachmentId ?? raw?.fileId) || null
  const fileName =
    normalizeText(raw?.fileName ?? raw?.fdFileName ?? raw?.name ?? raw?.filename) || null
  const fileExt =
    normalizeText(raw?.fileExt ?? raw?.fdFileExtName ?? raw?.ext ?? raw?.extension) || null

  const fileSizeRaw = raw?.fileSize ?? raw?.fdFileSize ?? raw?.size
  const fileSize = Number.isFinite(Number(fileSizeRaw)) ? Number(fileSizeRaw) : null

  const createdRaw = raw?.createdAt ?? raw?.fdCreateTime ?? raw?.createTime ?? raw?.created_at
  const createdAt = createdRaw
    ? (() => {
        const d = new Date(createdRaw)
        return Number.isNaN(d.getTime()) ? String(createdRaw) : d.toISOString()
      })()
    : null

  return {
    id,
    fileName: fileName || (id ? `附件_${id}` : null),
    fileExt,
    fileSize,
    createdAt,
    rawDownloadPath:
      normalizeText(raw?.rawDownloadPath ?? raw?.downloadUrl ?? raw?.fdDownloadPath) || null,
    downloadUrl: normalizeText(raw?.downloadUrl) || null,
    // 选择值必须行级唯一；历史快照里可能存在重复 id，直接用 id 会导致“全选”错觉
    selectionId: `${id || 'no-id'}__${index}`
  }
}

const bmoTechAttachments = computed<BmoMouldProcurementDetailAttachment[]>(() =>
  (bmoSnapshot.value?.tech?.attachments || [])
    .map((item: any, index: number) => normalizeBmoAttachment(item, index))
    .filter((item) => !!(item.id || item.fileName))
)

const selectedBmoAttachment = computed(() =>
  bmoTechAttachments.value.find(
    (item: any) => String(item.selectionId || '') === bmoAttachmentSelection.value
  )
)

const ensureDefaultBmoAttachmentSelection = () => {
  if (bmoAttachmentSelection.value) return
  const preferred: any =
    bmoTechAttachments.value.find((item: any) => item?.id && isExcelAttachment(item)) ||
    bmoTechAttachments.value.find((item: any) => item?.id)
  if (preferred && preferred.selectionId) {
    bmoAttachmentSelection.value = String(preferred.selectionId)
  }
}

const bmoTechFields = computed(() => bmoSnapshot.value?.tech?.fields || [])
const BMO_TECH_FIELD_LABEL_FALLBACK: Record<string, string> = {
  fd_col_o527xg: '模具腔数',
  fd_col_pt6kmk: '模具腔数',
  fd_col_i399sd: '模架',
  fd_col_rkue4b: '型腔要求',
  fd_col_qqqcjm: '型芯要求',
  fd_col_ax14sg: '型腔钢材',
  fd_col_uex1wi: '型芯钢材',
  fd_col_p503gk: '型腔热处理方式',
  fd_col_fu56xl: '型芯热处理方式',
  fd_col_ph3n8d: '浇口类型',
  fd_col_46l6dp: '浇口数量',
  fd_col_c8vviq: '流道类型',
  fd_col_id7g4w: '产品尺寸/mm',
  fd_col_epspco: '模具特殊需求及风险',
  fd_col_4e8fal: '通用技术要求'
}

const resolveTechFieldLabel = (field: any) => {
  const label = normalizeText(field?.label)
  if (label && !/^fd_col_/i.test(label)) return label
  const name = normalizeText(field?.name)
  return BMO_TECH_FIELD_LABEL_FALLBACK[name] || label || name || '-'
}
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

  const mouldCavityPrimaryCandidates: string[] = []
  const mouldCavityFallbackCandidates: string[] = []
  const snapshotFinalCavity = normalizeText(bmoSnapshot.value?.cavitySnapshot?.final?.value)
  const snapshotFinalCounts = Array.isArray(bmoSnapshot.value?.cavitySnapshot?.final?.counts)
    ? (bmoSnapshot.value?.cavitySnapshot?.final?.counts as number[])
    : []
  for (const field of bmoTechFields.value) {
    const name = normalizeFieldName(field.name || field.label)
    const label = normalizeFieldName(field.label || field.name)
    const raw = normalizeText(field.value)
    if (!raw) continue

    if (name === 'fd_col_o527xg' || name === 'fd_col_pt6kmk' || label === '模具腔数') {
      // 优先使用 1.4 页面中字段名明确为“模具腔数”的值（通常会出现两个同名字段）
      mouldCavityPrimaryCandidates.push(raw)
      continue
    }
    if (/模具(穴|腔)数|型腔数/.test(label)) {
      mouldCavityFallbackCandidates.push(raw)
      continue
    }
    if (/零件材料及料厚/.test(label)) {
      setIfEmpty('材料', raw)
      continue
    }
    if (/型腔钢材/.test(label)) {
      setIfEmpty('型腔', raw)
      continue
    }
    if (/型芯钢材/.test(label)) {
      setIfEmpty('型芯', raw)
      continue
    }
    // relay 兜底场景可能拿不到中文标签，使用字段编码兜底识别关键字段
    if (name === 'fd_col_id7g4w') {
      setIfEmpty('产品外观尺寸', raw)
      continue
    }
    if (/产品尺寸\/mm/.test(label)) {
      setIfEmpty('产品外观尺寸', raw)
      continue
    }
  }

  const mouldCavityCandidates = [
    ...(snapshotFinalCavity ? [snapshotFinalCavity] : []),
    ...(mouldCavityPrimaryCandidates.length > 0
      ? mouldCavityPrimaryCandidates
      : mouldCavityFallbackCandidates)
  ]

  if (mouldCavityCandidates.length) {
    // 1.4 里可能存在多个“模具腔数”，优先使用可标准化的表达式
    const normalizedCandidates = mouldCavityCandidates.map((x) => normalizeMouldCavityExpression(x))
    const preferred =
      normalizedCandidates
        .filter((x) => normalizeText(x.value))
        .sort((a, b) => {
          const aParsed = a.counts.length > 0 ? 1 : 0
          const bParsed = b.counts.length > 0 ? 1 : 0
          if (aParsed !== bParsed) return bParsed - aParsed
          return b.counts.length - a.counts.length
        })[0] || null
    if (preferred?.value) {
      next.模具穴数 = preferred.value
      sources.模具穴数 = 'bmo14'
    }
  }

  const projectDrawing = normalizeText(getProductDrawing())
  const projectName = normalizeText(getProductName())
  if (projectDrawing) {
    next.产品列表 = [projectDrawing]
    next.产品名称列表 = [projectName]
    next.产品数量列表 = [0]
    next.产品重量列表 = [0]
    const parsedSizes = splitSizeValues(next.产品外观尺寸)
    next.产品尺寸列表 = parsedSizes.length ? parsedSizes : [normalizeText(next.产品外观尺寸)]
    sources.产品列表 = 'bmo14'
    sources.产品名称列表 = 'bmo14'
    sources.产品数量列表 = 'bmo14'
    sources.产品重量列表 = 'bmo14'
    sources.产品尺寸列表 = 'bmo14'
  }

  if (!next.模具穴数 && snapshotFinalCavity) {
    next.模具穴数 = snapshotFinalCavity
    sources.模具穴数 = 'bmo14'
  }

  if (snapshotFinalCounts.length > 0 && !next.模具穴数) {
    next.模具穴数 = snapshotFinalCounts.map((n) => `1*${Number(n) || 1}`).join('+')
    sources.模具穴数 = 'bmo14'
  }

  return { data: next, sources }
}

const applyPrimaryBmoData = () => {
  const { data, sources } = buildPrimaryDataFromBmo()
  specData.value = data
  specDataSources.value = sources

  const cavityParsed = parseMouldCavityText(data.模具穴数)
  const snapshotCounts = Array.isArray(bmoSnapshot.value?.cavitySnapshot?.final?.counts)
    ? (bmoSnapshot.value?.cavitySnapshot?.final?.counts as number[])
    : []
  const effectiveCounts =
    cavityParsed.counts.length > 0
      ? cavityParsed.counts
      : snapshotCounts.filter((x) => Number(x) > 0)
  if (cavityParsed.expression) {
    specData.value.模具穴数 = cavityParsed.expression
    specDataSources.value.模具穴数 = 'bmo14'
  }

  if (Array.isArray(data.产品列表) && data.产品列表.length > 0) {
    applyProductDrawingsToGroups(data.产品列表, data.产品尺寸列表, effectiveCounts)
  }
  applyCavityCountsFallback(effectiveCounts)
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
      await autoApplyCachedTechSpecFromSnapshot()
      return
    }

    // 兜底：立项快照不存在时，按项目编号回查 BMO 记录并读取实时 1.4 详情
    const bmoRowResp = await getBmoMouldProcurementByProjectApi({ projectCode })
    const fallbackBmoRecordId = normalizeText((bmoRowResp?.data as any)?.bmo_record_id)
    if (!fallbackBmoRecordId) return

    const detailResp = await getBmoMouldProcurementDetailApi({ fdId: fallbackBmoRecordId })
    const detail = detailResp?.data
    if (!detail) return

    bmoSnapshot.value = {
      fdId: detail.fdId || fallbackBmoRecordId,
      demandType: detail.demandType ?? null,
      designer: detail.designer ?? null,
      tech: detail.tech || { tableName: '', fields: [], attachments: [] }
    }
    applyPrimaryBmoData()
    await autoApplyCachedTechSpecFromSnapshot()
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
    currentStep.value = 1
    resetFromProps()
    runAutoAnalyzeGroups()
    await loadBmoSnapshotByProject()
    ensureDefaultBmoAttachmentSelection()
  }
)

watch(
  () => bmoTechAttachments.value,
  () => {
    ensureDefaultBmoAttachmentSelection()
  },
  { deep: true, immediate: true }
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
      runAutoAnalyzeGroups()
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

const splitBySlash = (value: unknown) =>
  String(value || '')
    .split(/[\/／]/)
    .map((x) => x.trim())
    .filter(Boolean)

const analyzeGroups = (options: { notifyMismatch?: boolean } = {}) => {
  const notifyMismatch = options.notifyMismatch !== false
  const nextGroups: InitProductGroup[] = []
  let changed = false

  for (const group of groups.value) {
    const drawings = splitBySlash(group.productDrawing)
    const names = splitBySlash(group.productName)
    const sizes = splitSizeValues(group.productSize)
    const drawingsCount = drawings.length
    const namesCount = names.length

    if (drawingsCount <= 1 && namesCount <= 1) {
      nextGroups.push(group)
      continue
    }

    const targetCount = Math.max(drawingsCount || 1, namesCount || 1)
    const drawingList =
      drawingsCount > 1
        ? drawings
        : Array.from({ length: targetCount }, () => String(group.productDrawing || '').trim())
    const nameList =
      namesCount > 1
        ? names
        : Array.from({ length: targetCount }, () => String(group.productName || '').trim())
    const sizeList =
      sizes.length > 1
        ? sizes
        : Array.from({ length: targetCount }, () => String(group.productSize || '').trim())

    if (drawingList.length !== nameList.length) {
      if (notifyMismatch) {
        ElMessage.warning('产品图号与产品名称拆分数量不一致，已跳过本次分析')
      }
      return { changed: false, skipped: true as const }
    }

    changed = true
    for (let i = 0; i < targetCount; i += 1) {
      const row = makeDefaultGroup(nextGroups.length)
      row.productDrawing = drawingList[i] || ''
      row.productName = nameList[i] || ''
      row.productSize = sizeList[i] || ''
      row.cavityCount = group.cavityCount
      row.expanded = true
      nextGroups.push(row)
    }
  }

  if (!changed) {
    return { changed: false, skipped: false as const }
  }

  groups.value = nextGroups
  return { changed: true, skipped: false as const }
}

const runAutoAnalyzeGroups = () => {
  analyzeGroups({ notifyMismatch: false })
}

const handleProductDrawingBlur = (groupId: string) => {
  validateProductDrawing(groupId)
  runAutoAnalyzeGroups()
}

const handleProductNameBlur = () => {
  runAutoAnalyzeGroups()
}

const handleDeleteGroup = (id: string) => {
  if (groups.value.length <= 1) return
  groups.value = groups.value.filter((g) => g.id !== id)
  // 删除后不需要重新编号，因为标题显示的是产品图号
}

const applyCavityCountsFallback = (counts: number[]) => {
  const normalized = (counts || [])
    .map((c) => toSafeCavity(c))
    .filter((c) => Number.isFinite(c) && c > 0)
  if (!normalized.length || !groups.value.length) return

  const multi = normalized.length > 1
  groups.value = groups.value.map((g, idx) => {
    if (hasValidCavity(g.cavityCount)) return g
    const picked = multi ? normalized[idx] : normalized[0]
    if (!picked) return g
    return {
      ...g,
      cavityCount: toSafeCavity(picked)
    }
  })
}

const applyProductDrawingsToGroups = (
  drawings: string[],
  sizes?: string[],
  cavityCounts?: number[]
) => {
  const splitParts = (value: unknown) =>
    String(value || '')
      .split(/[\/／]/)
      .map((x) => x.trim())
      .filter(Boolean)

  const rawDrawings = (drawings || []).map((d) => String(d || '').trim())
  const rawNames =
    (specData.value?.产品名称列表 || []).map((n: unknown) => String(n || '').trim()) || []
  const rawSizes = (sizes || []).map((s) => String(s || '').trim())
  const rawCavities = (cavityCounts || []).map((c) => toSafeCavity(c))

  const normalizedDrawings: string[] = []
  const normalizedNames: string[] = []
  const normalizedSizes: string[] = []
  const normalizedCavities: Array<number | undefined> = []

  const maxRows = Math.max(rawDrawings.length, rawNames.length, rawSizes.length, rawCavities.length)
  for (let i = 0; i < maxRows; i += 1) {
    const drawingRaw = rawDrawings[i] || ''
    const nameRaw = rawNames[i] || ''
    const sizeRaw = rawSizes[i] || ''
    const cavityRaw = rawCavities[i]

    const drawingParts = splitParts(drawingRaw)
    const nameParts = splitParts(nameRaw)
    const sizeParts = splitSizeValues(sizeRaw)
    const drawingCount = drawingParts.length
    const nameCount = nameParts.length

    const targetCount = Math.max(drawingCount || 1, nameCount || 1)
    const canExpand =
      drawingCount <= 1 ||
      nameCount <= 1 ||
      drawingCount === nameCount ||
      nameRaw === '' ||
      drawingRaw === ''

    if (!canExpand) {
      normalizedDrawings.push(drawingRaw)
      normalizedNames.push(nameRaw)
      normalizedSizes.push(sizeRaw)
      normalizedCavities.push(cavityRaw)
      continue
    }

    const dList =
      drawingCount > 1 ? drawingParts : Array.from({ length: targetCount }, () => drawingRaw)
    const nList = nameCount > 1 ? nameParts : Array.from({ length: targetCount }, () => nameRaw)
    const sList =
      sizeParts.length > 1 ? sizeParts : Array.from({ length: targetCount }, () => sizeRaw)

    for (let j = 0; j < targetCount; j += 1) {
      normalizedDrawings.push(String(dList[j] || '').trim())
      normalizedNames.push(String(nList[j] || '').trim())
      normalizedSizes.push(String(sList[j] || '').trim())
      normalizedCavities.push(cavityRaw)
    }
  }

  const compactRows = normalizedDrawings
    .map((d, idx) => ({
      drawing: String(d || '').trim(),
      name: String(normalizedNames[idx] || '').trim(),
      size: String(normalizedSizes[idx] || '').trim(),
      cavity: normalizedCavities[idx]
    }))
    .filter((x) => !!x.drawing)

  const flatSizeCandidates = rawSizes.flatMap((s) => splitSizeValues(s)).filter(Boolean)
  if (compactRows.length > 1 && flatSizeCandidates.length >= compactRows.length) {
    // 当图号拆分为多条时，优先按拆平后的尺寸列表逐条对齐，避免首个尺寸被重复套用
    for (let i = 0; i < compactRows.length; i += 1) {
      compactRows[i].size = String(flatSizeCandidates[i] || compactRows[i].size || '').trim()
    }
  }

  const flatCavityCandidates = rawCavities
    .map((c) => (c === undefined ? undefined : toSafeCavity(c)))
    .filter((c): c is number => c !== undefined)
  if (compactRows.length > 1 && flatCavityCandidates.length >= compactRows.length) {
    // 穴数与产品组按索引一一对应，避免多组时沿用首个穴数
    for (let i = 0; i < compactRows.length; i += 1) {
      compactRows[i].cavity = toSafeCavity(flatCavityCandidates[i])
    }
  }

  const list = compactRows.map((x) => x.drawing)
  const nameList = compactRows.map((x) => x.name)
  const sizeList = compactRows.map((x) => x.size)
  const cavityList = compactRows.map((x) => x.cavity)

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
    const fromSpecName = String(nameList[idx] || '').trim()
    const keptName = nameByDrawing.get(d.toLowerCase()) || ''
    next.productName = fromSpecName || keptName || next.productName
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

const validateStep1 = () => {
  if (!groups.value.length) {
    ElMessage.warning('请至少保留 1 个产品组')
    return false
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
    return false
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
    return false
  }
  return true
}

const handleNextStep = () => {
  const analyzeResult = analyzeGroups({ notifyMismatch: true })
  if (analyzeResult.skipped) return
  if (!validateStep1()) return
  currentStep.value = 2
}

const handlePrevStep = () => {
  currentStep.value = 1
}

const handleComplete = () => {
  if (!validateStep1()) return

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
  currentStep.value = 1
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

  const toKey = (v: unknown) => normalizeText(v).toLowerCase()
  const uniqPush = (list: string[], value: string) => {
    const key = toKey(value)
    if (!key) return
    if (!list.some((x) => toKey(x) === key)) list.push(value)
  }

  const targetDrawings = Array.from(
    new Set(
      groups.value
        .flatMap((g) => parseDrawings(g.productDrawing || ''))
        .map((d) => toKey(d))
        .filter(Boolean)
    )
  )
  const fallbackDrawings = parseDrawings(getProductDrawing())
    .map((d) => toKey(d))
    .filter(Boolean)
  const drawingKeys = targetDrawings.length ? targetDrawings : fallbackDrawings

  const targetNames = Array.from(
    new Set(groups.value.map((g) => toKey(g.productName)).filter(Boolean))
  )
  const fallbackName = toKey(getProductName())
  const nameKeys = targetNames.length ? targetNames : fallbackName ? [fallbackName] : []

  const selected: TechSpecRecord[] = []
  const selectedSet = new Set<string>()
  const appendRecord = (record: TechSpecRecord | undefined) => {
    if (!record) return
    if (selectedSet.has(record.id)) return
    selected.push(record)
    selectedSet.add(record.id)
  }

  for (const drawingKey of drawingKeys) {
    appendRecord(records.find((r) => (r.drawings || []).some((d) => toKey(d) === drawingKey)))
  }
  for (const nameKey of nameKeys) {
    appendRecord(records.find((r) => toKey(r.partName) === nameKey))
  }
  if (!selected.length) appendRecord(records[0])

  const merged = cloneSpecData(null) as TechSpecData
  const drawings: string[] = []
  const names: string[] = []
  const sizes: string[] = []
  const cavityExpressions: string[] = []

  const scalarKeys: Array<keyof TechSpecData> = [
    '材料',
    '型腔',
    '型芯',
    '产品外观尺寸',
    '产品结构工程师',
    '零件图片'
  ]

  for (const record of selected) {
    const row = cloneSpecData(record.specData) as TechSpecData
    patchMultiSelectFields(row)

    for (const key of scalarKeys) {
      if (!normalizeText(merged[key]) && normalizeText(row[key])) {
        ;(merged as any)[key] = row[key]
      }
    }

    const cavityParsed = parseMouldCavityText(row.模具穴数)
    const cavityExpr = normalizeText(cavityParsed.expression || row.模具穴数)
    if (cavityExpr) cavityExpressions.push(cavityExpr)

    const rowDrawings =
      Array.isArray(row.产品列表) && row.产品列表.length ? row.产品列表 : record.drawings
    const rowNames = Array.isArray(row.产品名称列表) ? row.产品名称列表 : []
    const rowSizes = Array.isArray(row.产品尺寸列表) ? row.产品尺寸列表 : []
    const rowPartName = normalizeText(record.partName)

    const maxLen = Math.max(rowDrawings.length, rowNames.length, rowSizes.length, 1)
    for (let i = 0; i < maxLen; i += 1) {
      const d = normalizeText(rowDrawings[i] || rowDrawings[0] || '')
      const n = normalizeText(rowNames[i] || rowNames[0] || rowPartName)
      const s = normalizeText(rowSizes[i] || rowSizes[0] || '')
      if (!d) continue
      uniqPush(drawings, d)
      names.push(n)
      sizes.push(s)
    }
  }

  if (drawings.length) {
    merged.产品列表 = drawings
    merged.产品名称列表 = names.length ? names.slice(0, drawings.length) : drawings.map(() => '')
    merged.产品数量列表 = drawings.map(() => 0)
    merged.产品重量列表 = drawings.map(() => 0)
    merged.产品尺寸列表 = sizes.length ? sizes.slice(0, drawings.length) : drawings.map(() => '')
  }

  if (cavityExpressions.length) {
    merged.模具穴数 = cavityExpressions.join('+')
  } else if (selected[0]) {
    merged.模具穴数 = normalizeText(selected[0].specData?.模具穴数)
  }

  const data = merged
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
    const normalizedCurrent =
      item.key === '模具穴数' ? normalizeMouldCavityExpression(currentVal).value : currentVal
    const normalizedNext =
      item.key === '模具穴数' ? normalizeMouldCavityExpression(nextVal).value : nextVal
    const equal =
      Array.isArray(normalizedCurrent) || Array.isArray(normalizedNext)
        ? compareArrayField(normalizedCurrent, normalizedNext)
        : normalizeText(normalizedCurrent) === normalizeText(normalizedNext)
    if (equal) continue
    nextDiffs.push({
      key: item.key,
      label: item.label,
      currentValue: toDisplayText(normalizedCurrent) || '（空）',
      nextValue: toDisplayText(normalizedNext) || '（空）',
      currentRaw: normalizedCurrent,
      nextRaw: normalizedNext,
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
    if (key === '模具穴数') {
      // “模具穴数”已来自 1.4 时，不再被技术规格表覆盖
      const isBmo14Locked = specDataSources.value[key] === 'bmo14' && !!currentVal
      if (isBmo14Locked) continue

      const currentParsed = normalizeMouldCavityExpression(currentVal)
      const nextParsed = normalizeMouldCavityExpression(nextVal)
      const canUseNext =
        !currentVal ||
        (currentParsed.counts.length === 0 && nextParsed.counts.length > 0) ||
        (!currentParsed.value && !!nextParsed.value)
      if (canUseNext) {
        current[key] = nextParsed.value || nextVal
        specDataSources.value[key] = 'techSpec'
      }
      continue
    }
    if (!currentVal) {
      current[key] = nextVal
      specDataSources.value[key] = 'techSpec'
    }
  }

  const normalizedCurrentCavity = normalizeMouldCavityExpression(current.模具穴数)
  if (normalizedCurrentCavity.value) {
    current.模具穴数 = normalizedCurrentCavity.value
  }

  const rawDiffs = buildFieldDiffs(current, candidateData)
  diffRows.value = rawDiffs

  specData.value = current

  const cavityParsed = parseMouldCavityText(current.模具穴数)
  if (Array.isArray(current.产品列表) && current.产品列表.length > 0) {
    applyProductDrawingsToGroups(current.产品列表, current.产品尺寸列表, cavityParsed.counts)
  }
  applyCavityCountsFallback(cavityParsed.counts)
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
    const rawValue = Array.isArray(row.nextRaw) ? [...row.nextRaw] : row.nextRaw
    next[key] = key === '模具穴数' ? normalizeMouldCavityExpression(rawValue).value : rawValue
    specDataSources.value[key] = 'techSpec'
  }
  specData.value = next
  const cavityParsed = parseMouldCavityText(next.模具穴数)
  if (Array.isArray(next.产品列表) && next.产品列表.length > 0) {
    applyProductDrawingsToGroups(next.产品列表, next.产品尺寸列表, cavityParsed.counts)
  }
  applyCavityCountsFallback(cavityParsed.counts)
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
  return parsedData
}

const downloadBmoAttachmentByJob = async (picked: BmoMouldProcurementDetailAttachment) => {
  const fdId = normalizeText(bmoSnapshot.value?.fdId)
  const params = new URLSearchParams()
  if (fdId) params.set('fdId', fdId)
  const fileName = String(picked.fileName || '').trim()
  if (fileName) params.set('fileName', fileName)
  const query = params.toString()
  const url = `/api/bmo/attachment/download/${encodeURIComponent(String(picked.id || ''))}${
    query ? `?${query}` : ''
  }`
  const fileResp: any = await request.get<Blob>({
    url,
    responseType: 'blob',
    timeout: 180000
  })
  return ((fileResp as any)?.data ?? fileResp) as Blob
}

const applyTechSpecFile = async (file: File, successMessage = '技术规格表读取成功') => {
  const arrayBuffer = await file.arrayBuffer()
  const parsedData = await handleSpecArrayBuffer(arrayBuffer)
  ElMessage.success(successMessage)
  return parsedData
}

const getCachedTechSpecParsedData = async (fdId: string, attachmentId: string) => {
  const resp = await getBmoTechSpecParsedCacheApi({ fdId, attachmentId })
  const cache = (resp as any)?.data ?? resp
  const parsedData =
    cache?.parsedData && typeof cache.parsedData === 'object' ? cache.parsedData : null
  if (!parsedData) return null
  const cacheVersion = Number((parsedData as any).__cacheVersion || 0)
  if (cacheVersion !== TECH_SPEC_PARSED_CACHE_VERSION) return null
  return parsedData
}

const saveTechSpecParsedDataCache = async (params: {
  fdId: string
  attachmentId: string
  fileName?: string
  parsedData: any
}) => {
  const parsedDataWithVersion =
    params.parsedData && typeof params.parsedData === 'object'
      ? {
          ...params.parsedData,
          __cacheVersion: TECH_SPEC_PARSED_CACHE_VERSION
        }
      : params.parsedData
  await saveBmoTechSpecParsedCacheApi({
    fdId: params.fdId,
    attachmentId: params.attachmentId,
    fileName: params.fileName,
    parsedData: parsedDataWithVersion,
    parsedMeta: {
      source: 'project-init-dialog',
      savedAt: new Date().toISOString()
    }
  })
}

const autoApplyCachedTechSpecFromSnapshot = async () => {
  const fdId = normalizeText(bmoSnapshot.value?.fdId)
  if (!fdId) return false

  const attachments = (bmoTechAttachments.value || []).filter(
    (x: any) => x?.id && isExcelAttachment(x)
  )
  if (!attachments.length) return false

  for (const item of attachments) {
    const attachmentId = normalizeText((item as any)?.id)
    if (!attachmentId) continue
    try {
      const cachedParsed = await getCachedTechSpecParsedData(fdId, attachmentId)
      if (!cachedParsed) continue
      applyTechSpecFallback(cachedParsed)
      return true
    } catch {
      // ignore and continue trying next attachment
    }
  }
  return false
}

const handleReadSelectedBmoAttachment = async () => {
  const picked = selectedBmoAttachment.value
  const fdId = normalizeText(bmoSnapshot.value?.fdId)
  const attachmentId = normalizeText(picked?.id)
  if (!picked?.id) {
    ElMessage.warning('请先选择技术规格表附件')
    return
  }
  if (!isExcelAttachment(picked)) {
    ElMessage.warning('仅支持读取 Excel 技术规格表附件（.xlsx/.xls）')
    return
  }

  bmoReadingAttachment.value = true
  try {
    if (fdId && attachmentId) {
      try {
        const cachedParsed = await getCachedTechSpecParsedData(fdId, attachmentId)
        if (cachedParsed) {
          applyTechSpecFallback(cachedParsed)
          ElMessage.success('技术规格表已从缓存读取')
          return
        }
      } catch (cacheErr) {
        // ignore cache read errors, continue with download+parse flow
      }
    }

    const blob = await downloadBmoAttachmentByJob(picked)
    const fallbackExt = normalizeExcelExt(picked.fileExt)
    const ext = fallbackExt === 'xls' || fallbackExt === 'xlsx' ? fallbackExt : 'xlsx'
    const fallbackName = `BMO技术规格表.${ext}`
    const fileName = String(picked.fileName || fallbackName)
    const file = new File([blob], fileName, {
      type: blob.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })

    if (bmoSaveAttachment.value) {
      await saveSelectedAttachmentToProject(file)
    }

    const parsedData = await applyTechSpecFile(
      file,
      `技术规格表已读取${bmoSaveAttachment.value ? '并保存' : ''}`
    )

    if (fdId && attachmentId && parsedData) {
      saveTechSpecParsedDataCache({
        fdId,
        attachmentId,
        fileName,
        parsedData
      }).catch((cacheErr) => {
        console.warn('保存技术规格表解析缓存失败:', cacheErr?.message || cacheErr)
      })
    }
  } catch (error: any) {
    console.error('读取 BMO 技术规格表失败:', error)
    const status = Number(error?.response?.status || 0)
    const isBmoDenied = status === 403 || status === 404
    if (isBmoDenied && picked) {
      const path = String(picked.rawDownloadPath || '').trim()
      const fallbackPath = `/data/sys-attach/download/${encodeURIComponent(String(picked.id || ''))}`
      const fullUrl = path
        ? path.startsWith('http')
          ? path
          : `https://bmo.meiling.com:8023${path}`
        : `https://bmo.meiling.com:8023${fallbackPath}`
      window.open(fullUrl, '_blank')
      ElMessage.error(
        '后端无附件下载权限，已为你打开 BMO 原始下载链接。请下载后用“读取技术规格表”本地上传。'
      )
      return
    }
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
    await applyTechSpecFile(file.raw, '技术规格表读取成功')
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

  .pm-init-body {
    max-height: calc(100vh - 128px);
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

.pm-init-body {
  max-height: calc(100vh - 220px);
  padding-right: 4px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.pm-init-desc {
  margin-bottom: 20px;
}

.pm-init-steps {
  margin-bottom: 16px;
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
