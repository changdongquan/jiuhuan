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
      <el-descriptions :column="isMobile ? 1 : 3" border class="pm-init-desc">
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
            <el-descriptions-item label="材料">
              <span :class="{ 'pm-spec--missing': !specData.材料 }">{{
                specData.材料 || '待填写'
              }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="型腔">
              <span :class="{ 'pm-spec--missing': !specData.型腔 }">{{
                specData.型腔 || '待填写'
              }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="型芯">
              <span :class="{ 'pm-spec--missing': !specData.型芯 }">{{
                specData.型芯 || '待填写'
              }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="模具穴数">
              <span :class="{ 'pm-spec--missing': !specData.模具穴数 }">{{
                specData.模具穴数 || '待填写'
              }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="产品外观尺寸">
              <span :class="{ 'pm-spec--missing': !specData.产品外观尺寸 }">{{
                specData.产品外观尺寸 || '待填写'
              }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="产品结构工程师">
              <span :class="{ 'pm-spec--missing': !specData.产品结构工程师 }">{{
                specData.产品结构工程师 || '待填写'
              }}</span>
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
                    {{ group.productDrawing || `产品组 ${index + 1}` }}
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
import { ElMessage, ElMessageBox } from 'element-plus'
import { VueDraggable } from 'vue-draggable-plus'
import * as XLSX from 'xlsx'
import type { ProjectInfo } from '@/api/project'
import type { UploadFile } from 'element-plus'

type InitProductGroup = {
  id: string
  name: string
  cavityCount: number | undefined
  productDrawing?: string // 产品图号
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

const getProductDrawing = () => {
  return props.project?.productDrawing || props.project?.产品图号 || ''
}

const makeDefaultGroup = (index: number, cavityCount?: number): InitProductGroup => {
  const productDrawing = getProductDrawing()
  return {
    id: `g_${Date.now()}_${Math.random().toString(16).slice(2)}_${index}`,
    name: `产品组 ${index + 1}`, // 保留name字段用于内部标识，但不显示
    productDrawing: productDrawing || '',
    cavityCount: cavityCount === undefined ? undefined : toSafeCavity(cavityCount),
    expanded: true
  }
}

const resetFromProps = () => {
  const initial = props.initialGroups || []
  const productDrawing = getProductDrawing()
  console.log('[初始化弹窗] resetFromProps - productDrawing:', productDrawing)
  console.log('[初始化弹窗] resetFromProps - props.project:', props.project)

  if (initial.length) {
    groups.value = initial.map((g, idx) => {
      return {
        id: g.id || makeDefaultGroup(idx, g.cavityCount).id,
        name: `产品组 ${idx + 1}`,
        productDrawing: (g as any).productDrawing || productDrawing || '',
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
      cavityCount: fallback,
      expanded: true
    }
  ]
}

watch(
  () => props.modelValue,
  (v) => {
    if (!v) return
    resetFromProps()
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

const applyProductDrawingsToGroups = (drawings: string[]) => {
  const list = (drawings || []).map((d) => String(d || '').trim()).filter(Boolean)

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
  for (const g of groups.value) {
    const d = String(g.productDrawing || '').trim()
    if (!d) continue
    if (!hasValidCavity(g.cavityCount)) continue
    const key = d.toLowerCase()
    if (!cavityByDrawing.has(key)) cavityByDrawing.set(key, toSafeCavity(g.cavityCount))
  }

  groups.value = unique.map((d, idx) => {
    const next = makeDefaultGroup(idx)
    next.productDrawing = d
    const kept = cavityByDrawing.get(d.toLowerCase())
    next.cavityCount = kept === undefined ? undefined : kept
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
  imagePreviewVisible.value = false
  imagePreviewUrl.value = ''
}

// 处理技术规格表文件上传
const handleSpecFileChange = async (file: UploadFile) => {
  if (!file.raw) {
    ElMessage.error('文件读取失败')
    return
  }

  const projectCode = props.project?.项目编号
  const productDrawing = props.project?.productDrawing || props.project?.产品图号
  const productName = props.project?.productName || props.project?.产品名称

  if (!projectCode) {
    ElMessage.error('请先设置项目编号')
    return
  }

  if (!productDrawing || !productName) {
    ElMessage.warning('项目缺少产品图号或产品名称，将尝试匹配技术规格表')
  }

  try {
    // 读取Excel文件
    const arrayBuffer = await file.raw.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })

    // 获取第一个工作表
    const firstSheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[firstSheetName]

    // 转换为JSON格式（保留所有行，包括空单元格）
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][]

    if (!jsonData || jsonData.length < 2) {
      ElMessage.error('Excel文件格式错误：至少需要表头和数据行')
      return
    }

    // 查找表头行（支持多行表头，通常在第2行或第3行）
    // 第2行通常是主表头（可能有合并单元格），第3行是子表头
    let mainHeaderRowIndex = -1 // 主表头行（包含"零件图号"、"零件名称"等）
    let subHeaderRowIndex = -1 // 子表头行（包含"材料"等子列）
    let mainHeaderRow: string[] = []
    let subHeaderRow: string[] = []

    // 先找主表头行（包含"零件图号"的行，通常是第2行，索引1）
    for (let i = 0; i < Math.min(5, jsonData.length); i++) {
      const row = jsonData[i]
      const rowStr = row
        .map((cell) =>
          String(cell || '')
            .trim()
            .toLowerCase()
        )
        .join('|')

      // 检查是否包含关键列名
      if (
        (rowStr.includes('零件图号') || rowStr.includes('图号')) &&
        (rowStr.includes('零件名称') || rowStr.includes('名称'))
      ) {
        mainHeaderRowIndex = i
        mainHeaderRow = row.map((cell) => String(cell || '').trim())

        // 检查下一行是否是子表头（包含"材料"）
        if (i + 1 < jsonData.length) {
          const nextRow = jsonData[i + 1]
          const nextRowStr = nextRow
            .map((cell) =>
              String(cell || '')
                .trim()
                .toLowerCase()
            )
            .join('|')
          if (nextRowStr.includes('材料') || nextRowStr.includes('材质')) {
            subHeaderRowIndex = i + 1
            subHeaderRow = nextRow.map((cell) => String(cell || '').trim())
          }
        }
        break
      }
    }

    if (mainHeaderRowIndex === -1) {
      ElMessage.error('未找到表头行，请确保Excel包含"零件图号"和"零件名称"列')
      return
    }

    // 查找列索引（优先在子表头行查找，如果找不到再在主表头行查找）
    const findColumnIndex = (keywords: string[], preferSubHeader = false): number => {
      // 如果指定优先查找子表头，且子表头存在，先查子表头
      if (preferSubHeader && subHeaderRowIndex >= 0 && subHeaderRow.length > 0) {
        for (let i = 0; i < subHeaderRow.length; i++) {
          const cell = subHeaderRow[i].toLowerCase()
          if (keywords.some((kw) => cell.includes(kw.toLowerCase()))) {
            return i
          }
        }
      }

      // 在主表头行查找
      for (let i = 0; i < mainHeaderRow.length; i++) {
        const cell = mainHeaderRow[i].toLowerCase()
        if (keywords.some((kw) => cell.includes(kw.toLowerCase()))) {
          return i
        }
      }

      // 如果主表头没找到，且子表头存在，再查子表头
      if (!preferSubHeader && subHeaderRowIndex >= 0 && subHeaderRow.length > 0) {
        for (let i = 0; i < subHeaderRow.length; i++) {
          const cell = subHeaderRow[i].toLowerCase()
          if (keywords.some((kw) => cell.includes(kw.toLowerCase()))) {
            return i
          }
        }
      }

      return -1
    }

    const findColumnIndexFiltered = (
      keywords: string[],
      filter: (cell: string) => boolean,
      preferSubHeader = false
    ): number => {
      const match = (cellRaw: string) => {
        const cell = cellRaw.toLowerCase()
        return filter(cell) && keywords.some((kw) => cell.includes(kw.toLowerCase()))
      }

      if (preferSubHeader && subHeaderRowIndex >= 0 && subHeaderRow.length > 0) {
        for (let i = 0; i < subHeaderRow.length; i++) {
          if (match(subHeaderRow[i])) return i
        }
      }

      for (let i = 0; i < mainHeaderRow.length; i++) {
        if (match(mainHeaderRow[i])) return i
      }

      if (!preferSubHeader && subHeaderRowIndex >= 0 && subHeaderRow.length > 0) {
        for (let i = 0; i < subHeaderRow.length; i++) {
          if (match(subHeaderRow[i])) return i
        }
      }

      return -1
    }

    // 查找列索引
    // "材料"是子列，优先在子表头行查找
    const partDrawingCol = findColumnIndex(['零件图号', '图号'])
    const partNameCol = findColumnIndex(['零件名称', '名称'])
    const materialCol = findColumnIndex(['材料', '材质'], true) // 优先在子表头查找
    // "型腔"和"型芯"只从主表头查找（模具组件列），不要把“型腔数/穴数”等误认为材质列
    const cavityCol = findColumnIndexFiltered(
      ['型腔', '前模'],
      (cell) => !cell.includes('数'),
      false
    )
    const coreCol = findColumnIndexFiltered(['型芯', '后模'], (cell) => !cell.includes('数'), false)
    const sizeCol = findColumnIndex(['产品外观尺寸', '外观尺寸', '尺寸'])
    const engineerCol = findColumnIndex(['产品结构工程师', '结构工程师', '工程师'])
    const imageCol = findColumnIndex(['零件图片', '图片', '图示'])
    const cavityCountCol = findColumnIndexFiltered(
      ['模具穴数', '模具腔数', '穴数', '腔数', '型腔数'],
      (cell) =>
        cell.includes('穴') ||
        cell.includes('腔') ||
        cell.includes('型腔数') ||
        cell.includes('模具'),
      false
    )

    if (partDrawingCol === -1 || partNameCol === -1) {
      ElMessage.error('未找到"零件图号"或"零件名称"列')
      return
    }

    // 查找匹配的数据行（从表头行之后开始）
    // 数据行从主表头行的下一行开始，如果有子表头，则从子表头的下一行开始
    const dataStartRowIndex =
      subHeaderRowIndex >= 0 ? subHeaderRowIndex + 1 : mainHeaderRowIndex + 1
    let matchedRow: any[] | null = null

    const parseDrawings = (val: any) => {
      const raw = String(val || '').trim()
      if (!raw) return []

      const tokens = raw
        .replace(/；/g, ';')
        .split(/[\s;]+/)
        .map((s) => s.trim())
        .filter(Boolean)

      const expandSlashToken = (token: string) => {
        if (!token.includes('/')) return [token]

        const segments = token
          .split('/')
          .map((s) => s.trim())
          .filter(Boolean)
        if (segments.length <= 1) return [token]

        const base = segments[0]
        const baseParts = base
          .split('.')
          .map((s) => s.trim())
          .filter(Boolean)

        const results: string[] = [base]
        for (const seg of segments.slice(1)) {
          if (!seg) continue

          const suffixParts = seg
            .split('.')
            .map((s) => s.trim())
            .filter(Boolean)

          if (suffixParts.length === 0 || baseParts.length === 0) {
            results.push(seg)
            continue
          }

          // 规则 A：baseParts.length - suffixParts.length === 1 时，
          // 代表 suffix 省略了 base 的首段之外所有前缀，按 “首段 + suffix” 补全
          if (baseParts.length - suffixParts.length === 1) {
            results.push([baseParts[0], ...suffixParts].join('.'))
            continue
          }

          // 规则 B：否则按右侧段数覆盖 base 的末尾同段数
          if (suffixParts.length <= baseParts.length) {
            const next = [...baseParts]
            const start = baseParts.length - suffixParts.length
            for (let i = 0; i < suffixParts.length; i++) {
              next[start + i] = suffixParts[i]
            }
            results.push(next.join('.'))
            continue
          }

          // suffix 段数比 base 多：按完整图号处理
          results.push(seg)
        }

        return results
      }

      return tokens
        .flatMap((t) => expandSlashToken(t))
        .map((s) => s.trim())
        .filter(Boolean)
    }

    const mainDrawings = parseDrawings(productDrawing)
    const mainDrawingSet = new Set(mainDrawings.map((d) => d.toLowerCase()))

    for (let i = dataStartRowIndex; i < jsonData.length; i++) {
      const row = jsonData[i]
      const rowPartDrawing = String(row[partDrawingCol] || '').trim()
      const rowPartName = String(row[partNameCol] || '').trim()

      // 匹配逻辑：优先匹配图号，图号匹配则直接使用
      // 支持多个图号用"/"或空格分隔的情况
      const rowDrawings = parseDrawings(rowPartDrawing)
      const drawingMatch =
        mainDrawingSet.size > 0 && rowDrawings.some((d) => mainDrawingSet.has(d.toLowerCase()))
      const nameMatch = productName && rowPartName.toLowerCase() === productName.toLowerCase()

      // 优先匹配图号：如果图号匹配，直接使用
      if (drawingMatch) {
        matchedRow = row
        break
      }

      // 如果图号不匹配但名称匹配，记录为候选（但继续查找图号匹配的行）
      if (nameMatch && !matchedRow) {
        matchedRow = row
        // 不break，继续查找是否有图号匹配的行
      }
    }

    if (!matchedRow) {
      ElMessage.warning(
        `未找到匹配的数据行（项目编号: ${projectCode}, 产品图号: ${productDrawing || '-'}, 产品名称: ${productName || '-'}）`
      )
      return
    }

    // 检查最终匹配的行：如果只匹配了名称但图号不匹配，提示用户确认
    const finalRowDrawing = String(matchedRow[partDrawingCol] || '').trim()
    const finalRowDrawings = parseDrawings(finalRowDrawing)
    const finalDrawingMatch =
      mainDrawingSet.size > 0 && finalRowDrawings.some((d) => mainDrawingSet.has(d.toLowerCase()))
    const finalRowName = String(matchedRow[partNameCol] || '').trim()
    const finalNameMatch = productName && finalRowName.toLowerCase() === productName.toLowerCase()

    if (!finalDrawingMatch && finalNameMatch) {
      // 只匹配了名称，图号不匹配，需要用户确认
      const confirmed = await ElMessageBox.confirm(
        `找到产品名称匹配的行，但图号不一致：\n` +
          `项目图号: ${productDrawing || '-'}\n` +
          `Excel图号: ${finalRowDrawing || '-'}\n` +
          `产品名称: ${productName || '-'}\n\n` +
          `是否继续使用该行数据？`,
        '图号不一致',
        {
          confirmButtonText: '继续使用',
          cancelButtonText: '取消',
          type: 'warning'
        }
      ).catch(() => false)

      if (!confirmed) {
        return
      }
    }

    // 提取数据
    const rowPartDrawing = String(matchedRow[partDrawingCol] || '').trim()
    const rowPartSize = sizeCol >= 0 ? String(matchedRow[sizeCol] || '').trim() : ''

    // 解析多个图号（支持空格或"/"分隔）
    const 图号列表 = parseDrawings(rowPartDrawing)
    // 解析多个尺寸（支持空格或"/"分隔）
    const 尺寸列表 = rowPartSize
      .split(/[\s\/]+/)
      .map((s) => s.trim())
      .filter(Boolean)

    // 检查图号和尺寸数量是否一致
    if (图号列表.length > 1 && 尺寸列表.length === 1 && 尺寸列表[0]) {
      // 有多个图号但只有一个尺寸，提示用户选择处理方式
      const 相同尺寸 = 尺寸列表[0]

      // 使用自定义对话框处理三种选择
      const result = await new Promise<'confirm' | 'empty' | 'cancel'>((resolve) => {
        ElMessageBox({
          title: '图号与尺寸数量不一致',
          message:
            `检测到 ${图号列表.length} 个产品图号，但只有 1 个产品尺寸：\n` +
            `图号: ${图号列表.join(' / ')}\n` +
            `尺寸: ${尺寸列表[0]}\n\n` +
            `请选择处理方式：`,
          showCancelButton: true,
          showConfirmButton: true,
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          distinguishCancelAndClose: true,
          type: 'warning',
          beforeClose: (action, _instance, done) => {
            if (action === 'confirm') {
              done()
              resolve('confirm')
            } else if (action === 'cancel') {
              done()
              resolve('cancel')
            } else {
              // close 按钮
              done()
              resolve('cancel')
            }
          }
        }).catch(() => {
          resolve('cancel')
        })

        // 添加"留空"按钮（等待对话框渲染后）
        setTimeout(() => {
          const messageBox = document.querySelector('.el-message-box')
          if (messageBox) {
            const footer = messageBox.querySelector('.el-message-box__btns') as HTMLElement
            if (footer && !footer.querySelector('.empty-size-btn')) {
              const emptyBtn = document.createElement('button')
              emptyBtn.className = 'el-button el-button--default empty-size-btn'
              emptyBtn.textContent = '留空'
              emptyBtn.style.marginRight = '10px'
              emptyBtn.onclick = (e) => {
                e.stopPropagation()
                ElMessageBox.close()
                setTimeout(() => resolve('empty'), 0)
              }
              // 插入到取消按钮之后，确定按钮之前
              const cancelBtn = footer.querySelector('.el-button--default:not(.empty-size-btn)')
              if (cancelBtn && cancelBtn.nextSibling) {
                footer.insertBefore(emptyBtn, cancelBtn.nextSibling)
              } else {
                footer.insertBefore(emptyBtn, footer.querySelector('.el-button--primary'))
              }
            }
          }
        }, 100)
      })

      if (result === 'cancel') {
        return
      } else if (result === 'confirm') {
        // 用户确认，将相同的尺寸应用到所有图号
        尺寸列表.length = 0
        for (let i = 0; i < 图号列表.length; i++) {
          尺寸列表.push(相同尺寸)
        }
      } else if (result === 'empty') {
        // 用户选择留空，不填入尺寸（保持空数组）
        尺寸列表.length = 0
        for (let i = 0; i < 图号列表.length; i++) {
          尺寸列表.push('')
        }
      }
    } else {
      // 确保长度一致（其他情况：图号数量 <= 尺寸数量，或尺寸为空）
      const maxLength = Math.max(图号列表.length, 尺寸列表.length)
      while (尺寸列表.length < maxLength) {
        尺寸列表.push('')
      }
      while (尺寸列表.length > maxLength) {
        尺寸列表.pop()
      }
    }

    // 检查图号与主图号是否一致
    if (mainDrawingSet.size > 0 && 图号列表.length > 0) {
      const notInMain = 图号列表.filter((d) => !mainDrawingSet.has(d.toLowerCase()))
      if (notInMain.length > 0) {
        try {
          await ElMessageBox.confirm(
            `技术规格表中的图号（${notInMain.join(' / ')}）不在主图号集合（${productDrawing}）中，是否继续读取？`,
            '图号不一致',
            {
              type: 'warning',
              confirmButtonText: '继续',
              cancelButtonText: '取消'
            }
          )
        } catch {
          return // 用户取消
        }
      }
    }

    const extractedData: any = {
      材料: materialCol >= 0 ? String(matchedRow[materialCol] || '').trim() : '',
      型腔: cavityCol >= 0 ? String(matchedRow[cavityCol] || '').trim() : '',
      型芯: coreCol >= 0 ? String(matchedRow[coreCol] || '').trim() : '',
      模具穴数: cavityCountCol >= 0 ? String(matchedRow[cavityCountCol] || '').trim() : '',
      产品外观尺寸: rowPartSize, // 保留原始字符串，用于显示
      产品图号列表: 图号列表, // 新增：图号列表
      产品尺寸列表: 尺寸列表, // 新增：尺寸列表
      产品结构工程师: engineerCol >= 0 ? String(matchedRow[engineerCol] || '').trim() : '',
      零件图片: ''
    }

    // 处理图片（可能是嵌入的图片或路径）
    if (imageCol >= 0) {
      const imageValue = matchedRow[imageCol]
      if (imageValue) {
        // 如果是base64或URL，直接使用
        if (
          typeof imageValue === 'string' &&
          (imageValue.startsWith('http') || imageValue.startsWith('data:'))
        ) {
          extractedData.零件图片 = imageValue
        } else {
          // 尝试从工作表中提取图片
          // 注意：xlsx库不直接支持图片提取，这里需要特殊处理
          // 暂时使用空字符串，后续可以通过其他方式处理
          extractedData.零件图片 = ''
        }
      }
    }

    specData.value = extractedData
    // 将技术规格表中的图号列表同步为产品组（一个图号一个产品组）
    applyProductDrawingsToGroups(图号列表)
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

/* B) 产品组单元格颜色（产品图号/穴数） */
</style>
