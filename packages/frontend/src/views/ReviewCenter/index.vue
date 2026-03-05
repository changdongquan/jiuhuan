<template>
  <div class="review-center-page px-4 pt-0 pb-2 space-y-3">
    <div class="review-header">
      <div>
        <h3 class="review-title">审核中心</h3>
        <p class="review-subtitle">统一审核中心（单列表）</p>
      </div>
      <div class="review-actions">
        <el-button :loading="loading" @click="loadTasks">刷新</el-button>
      </div>
    </div>

    <el-form :inline="!isMobile" class="review-filter">
      <el-form-item label="审核分类">
        <el-select v-model="query.category" :style="{ width: isMobile ? '100%' : '170px' }">
          <el-option label="全部" value="ALL" />
          <el-option label="硬删除审核" value="HARD_DELETE" />
          <el-option label="BMO立项审核" value="BMO_INITIATION" />
        </el-select>
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="query.status" :style="{ width: isMobile ? '100%' : '160px' }">
          <el-option label="全部" value="ALL" />
          <el-option label="草稿" value="DRAFT" />
          <el-option label="审核中" value="PENDING" />
          <el-option label="已通过" value="APPROVED" />
          <el-option label="已驳回" value="REJECTED" />
          <el-option label="已取消" value="CANCELED" />
        </el-select>
      </el-form-item>
      <el-form-item label="关键词">
        <el-input
          v-model="query.keyword"
          :style="{ width: isMobile ? '100%' : '340px' }"
          clearable
          placeholder="项目编号/名称/图号/申请人/审核人"
          @keydown.enter.prevent="handleSearch"
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="handleReset">重置</el-button>
      </el-form-item>
    </el-form>

    <el-card shadow="never">
      <el-table
        v-if="!isMobile"
        v-loading="loading"
        :data="list"
        border
        size="small"
        max-height="700"
      >
        <el-table-column type="index" label="#" width="56" />
        <el-table-column prop="categoryText" label="审核分类" width="120" />
        <el-table-column prop="statusText" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)">{{ row.statusText }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="sourceText" label="内容来源" width="140" show-overflow-tooltip />
        <el-table-column prop="projectCode" label="项目编号" width="150" show-overflow-tooltip />
        <el-table-column prop="subject" label="审核内容" min-width="220" show-overflow-tooltip />
        <el-table-column prop="applicant" label="申请人" width="120" show-overflow-tooltip />
        <el-table-column prop="reviewer" label="审核人" width="120" show-overflow-tooltip />
        <el-table-column prop="reason" label="说明" min-width="180" show-overflow-tooltip />
        <el-table-column prop="updatedAt" label="更新时间" width="170">
          <template #default="{ row }">{{ formatTime(row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="row.category === 'HARD_DELETE'"
              link
              type="primary"
              @click="openHardDeleteViewDialog(row)"
            >
              查看详情
            </el-button>
            <el-button
              v-if="row.category === 'BMO_INITIATION'"
              link
              type="primary"
              @click="openBmoViewDialog(row)"
            >
              查看立项
            </el-button>
            <el-button v-if="canReview(row)" link type="danger" @click="handleReject(row)">
              驳回
            </el-button>
            <el-button
              v-if="canReview(row)"
              link
              type="success"
              :loading="approvingId === row.id"
              @click="handleApprove(row)"
            >
              审核通过
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div v-else v-loading="loading" class="review-mobile-list">
        <el-empty v-if="!list.length && !loading" description="暂无数据" :image-size="72" />
        <el-card v-for="row in list" :key="row.id" class="mobile-item" shadow="hover">
          <div class="mobile-item__head">
            <div class="mobile-item__title">{{ row.projectCode || '-' }}</div>
            <el-tag :type="statusTagType(row.status)" size="small">{{ row.statusText }}</el-tag>
          </div>
          <div class="mobile-item__grid">
            <span>分类：{{ row.categoryText }}</span>
            <span>来源：{{ row.sourceText || '-' }}</span>
            <span>内容：{{ row.subject || '-' }}</span>
            <span>申请人：{{ row.applicant || '-' }}</span>
            <span>审核人：{{ row.reviewer || '-' }}</span>
            <span>说明：{{ row.reason || '-' }}</span>
            <span>更新时间：{{ formatTime(row.updatedAt) }}</span>
          </div>
          <div class="mobile-item__actions">
            <el-button
              v-if="row.category === 'HARD_DELETE'"
              link
              type="primary"
              @click="openHardDeleteViewDialog(row)"
            >
              查看详情
            </el-button>
            <el-button
              v-if="row.category === 'BMO_INITIATION'"
              link
              type="primary"
              @click="openBmoViewDialog(row)"
            >
              查看立项
            </el-button>
            <el-button v-if="canReview(row)" link type="danger" @click="handleReject(row)">
              驳回
            </el-button>
            <el-button
              v-if="canReview(row)"
              link
              type="success"
              :loading="approvingId === row.id"
              @click="handleApprove(row)"
            >
              审核通过
            </el-button>
          </div>
        </el-card>
      </div>

      <div class="mt-3 review-pagination">
        <el-pagination
          v-model:current-page="query.page"
          v-model:page-size="query.pageSize"
          :layout="
            isMobile ? 'total, prev, pager, next' : 'total, sizes, prev, pager, next, jumper'
          "
          :total="total"
          :page-sizes="[20, 50, 100]"
          :small="isMobile"
          @current-change="loadTasks"
          @size-change="handlePageSizeChange"
        />
      </div>
    </el-card>

    <el-dialog
      v-model="viewDialogVisible"
      title="立项"
      :width="isMobile ? '95vw' : '1400px'"
      :top="isMobile ? '4vh' : '2vh'"
      destroy-on-close
    >
      <div v-loading="viewDialogLoading" class="space-y-3">
        <el-descriptions :column="descColumn" border size="small" title="表头信息">
          <el-descriptions-item label="零部件图号">{{
            viewRow?.part_no || '-'
          }}</el-descriptions-item>
          <el-descriptions-item label="零部件名称">{{
            viewRow?.part_name || '-'
          }}</el-descriptions-item>
          <el-descriptions-item label="产品型号">{{ viewRow?.model || '-' }}</el-descriptions-item>
          <el-descriptions-item label="模具编号">{{
            viewRow?.mold_number || '-'
          }}</el-descriptions-item>
          <el-descriptions-item label="中标价格(含税)">
            {{ formatAmount(viewRow?.bid_price_tax_incl ?? null) }}
          </el-descriptions-item>
          <el-descriptions-item label="中标时间">{{
            formatTime(viewRow?.bid_time || null)
          }}</el-descriptions-item>
        </el-descriptions>

        <el-descriptions :column="descColumn" border size="small" title="立项状态">
          <el-descriptions-item label="当前状态">
            <el-tag :type="statusTagType(normalizeBmoStatus(viewRequest?.status))">
              {{ normalizeStatusText(normalizeBmoStatus(viewRequest?.status)) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="项目编号候选">{{
            viewRequest?.project_code_candidate || '-'
          }}</el-descriptions-item>
          <el-descriptions-item label="最终项目编号">{{
            viewRequest?.project_code_final || '-'
          }}</el-descriptions-item>
          <el-descriptions-item label="申请人">{{
            viewRequest?.created_by || '-'
          }}</el-descriptions-item>
          <el-descriptions-item label="驳回原因" :span="4">{{
            viewRequest?.rejected_reason || '-'
          }}</el-descriptions-item>
        </el-descriptions>
      </div>

      <template #footer>
        <el-button @click="viewDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="hardDeleteViewDialogVisible"
      title="硬删除审核详情"
      :width="isMobile ? '95vw' : '980px'"
      destroy-on-close
    >
      <el-descriptions v-if="hardDeleteViewRow" :column="descColumn" border size="small">
        <el-descriptions-item label="内容来源">{{
          resolveHardDeleteSourceText(hardDeleteViewRow.moduleCode)
        }}</el-descriptions-item>
        <el-descriptions-item label="审核状态">{{
          normalizeStatusText(normalizeHardDeleteStatus(hardDeleteViewRow.status))
        }}</el-descriptions-item>
        <el-descriptions-item label="实体标识">{{
          hardDeleteViewRow.entityKey || '-'
        }}</el-descriptions-item>
        <el-descriptions-item label="项目编号">{{
          hardDeleteViewRow.projectCode || '-'
        }}</el-descriptions-item>
        <el-descriptions-item label="显示编码">{{
          hardDeleteViewRow.displayCode || '-'
        }}</el-descriptions-item>
        <el-descriptions-item label="显示名称">{{
          hardDeleteViewRow.displayName || '-'
        }}</el-descriptions-item>
        <el-descriptions-item label="申请人">{{
          hardDeleteViewRow.requesterName || '-'
        }}</el-descriptions-item>
        <el-descriptions-item label="审核人">{{
          hardDeleteViewRow.reviewerName || '-'
        }}</el-descriptions-item>
        <el-descriptions-item label="申请来源">{{
          hardDeleteViewRow.requestSource || '-'
        }}</el-descriptions-item>
        <el-descriptions-item label="申请说明" :span="descColumn">{{
          hardDeleteViewRow.requestReason || '-'
        }}</el-descriptions-item>
        <el-descriptions-item label="审核意见" :span="descColumn">{{
          hardDeleteViewRow.reviewComment || '-'
        }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{
          formatTime(hardDeleteViewRow.createdAt || null)
        }}</el-descriptions-item>
        <el-descriptions-item label="更新时间">{{
          formatTime(hardDeleteViewRow.updatedAt || null)
        }}</el-descriptions-item>
        <el-descriptions-item label="通过时间">{{
          formatTime(hardDeleteViewRow.approvedAt || null)
        }}</el-descriptions-item>
        <el-descriptions-item label="驳回时间">{{
          formatTime(hardDeleteViewRow.rejectedAt || null)
        }}</el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button @click="hardDeleteViewDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRoute } from 'vue-router'
import {
  approveAndApplyBmoInitiationReviewApi,
  getBmoInitiationRequestApi,
  getBmoInitiationReviewTasksApi,
  rejectBmoInitiationReviewApi,
  type BmoInitiationRequestRow,
  type BmoInitiationReviewTask
} from '@/api/bmo'
import {
  approveHardDeleteReviewApi,
  getHardDeleteReviewTasksApi,
  rejectHardDeleteReviewApi,
  type HardDeleteReviewTask
} from '@/api/goods'
import { refreshBmoMenuBadges } from '@/utils/bmoBadge'

type ReviewCategory = 'ALL' | 'HARD_DELETE' | 'BMO_INITIATION'
type StandardStatus = 'ALL' | 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELED'

type UnifiedReviewRow = {
  id: string
  category: Exclude<ReviewCategory, 'ALL'>
  categoryText: string
  sourceText: string
  status: Exclude<StandardStatus, 'ALL'>
  statusText: string
  projectCode: string
  subject: string
  applicant: string
  reviewer: string
  reason: string
  updatedAt: string | null
  raw: BmoInitiationReviewTask | HardDeleteReviewTask
}

const route = useRoute()
const MOBILE_BREAKPOINT = 900
const loading = ref(false)
const list = ref<UnifiedReviewRow[]>([])
const total = ref(0)
const approvingId = ref('')

const viewDialogVisible = ref(false)
const viewDialogLoading = ref(false)
const viewRow = ref<BmoInitiationReviewTask | null>(null)
const viewRequest = ref<BmoInitiationRequestRow | null>(null)
const hardDeleteViewDialogVisible = ref(false)
const hardDeleteViewRow = ref<HardDeleteReviewTask | null>(null)
const isMobile = ref(false)

const query = reactive({
  category: 'ALL' as ReviewCategory,
  status: 'PENDING' as StandardStatus,
  keyword: '',
  page: 1,
  pageSize: 20
})

const normalizedKeyword = computed(() => String(query.keyword || '').trim())
const descColumn = computed(() => (isMobile.value ? 1 : 4))

const normalizeStatusText = (status: Exclude<StandardStatus, 'ALL'>) => {
  if (status === 'DRAFT') return '草稿'
  if (status === 'PENDING') return '审核中'
  if (status === 'APPROVED') return '已通过'
  if (status === 'REJECTED') return '已驳回'
  return '已取消'
}

const statusTagType = (status: string) => {
  if (status === 'PENDING') return 'warning'
  if (status === 'APPROVED') return 'success'
  if (status === 'REJECTED') return 'danger'
  return 'info'
}

const normalizeBmoStatus = (status: unknown): Exclude<StandardStatus, 'ALL'> => {
  const s = String(status || '')
    .trim()
    .toUpperCase()
  if (s === 'DRAFT') return 'DRAFT'
  if (s === 'PM_CONFIRMED') return 'PENDING'
  if (s === 'APPLIED') return 'APPROVED'
  if (s === 'REJECTED') return 'REJECTED'
  return 'CANCELED'
}

const normalizeHardDeleteStatus = (status: unknown): Exclude<StandardStatus, 'ALL'> => {
  const s = String(status || '')
    .trim()
    .toUpperCase()
  if (s === 'PENDING') return 'PENDING'
  if (s === 'APPROVED') return 'APPROVED'
  if (s === 'REJECTED') return 'REJECTED'
  return 'CANCELED'
}

const mapStatusForBmoApi = (
  status: StandardStatus
): 'ALL' | 'DRAFT' | 'PM_CONFIRMED' | 'APPLIED' | 'REJECTED' | null => {
  if (status === 'DRAFT') return 'DRAFT'
  if (status === 'PENDING') return 'PM_CONFIRMED'
  if (status === 'APPROVED') return 'APPLIED'
  if (status === 'REJECTED') return 'REJECTED'
  if (status === 'CANCELED') return null
  return 'ALL'
}

const mapStatusForHardDeleteApi = (
  status: StandardStatus
): 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELED' | null => {
  if (status === 'DRAFT') return null
  if (status === 'PENDING') return 'PENDING'
  if (status === 'APPROVED') return 'APPROVED'
  if (status === 'REJECTED') return 'REJECTED'
  if (status === 'CANCELED') return 'CANCELED'
  return 'ALL'
}

const canReview = (row: UnifiedReviewRow) => row.status === 'PENDING'

const formatTime = (value: string | null | undefined) => {
  if (!value) return '-'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString()
}

const formatAmount = (value: number | null | undefined) => {
  if (value === null || value === undefined) return '-'
  const amount = Number(value)
  return Number.isFinite(amount) ? amount.toLocaleString('zh-CN') : '-'
}

const updateViewport = () => {
  if (typeof window === 'undefined') return
  isMobile.value = window.innerWidth < MOBILE_BREAKPOINT
}

const resolveHardDeleteSourceText = (moduleCode: unknown) => {
  const code = String(moduleCode || 'GOODS')
    .trim()
    .toUpperCase()
  if (code === 'SALES_ORDER') return '销售订单删除'
  if (code === 'FINANCE_INVOICE') return '开票单据删除'
  if (code === 'FINANCE_RECEIPT') return '回款单据删除'
  if (code === 'SALARY') return '工资删除'
  if (code === 'OUTBOUND_DOCUMENT') return '出库单删除'
  if (code === 'PROJECT_INFO') return '项目信息删除'
  if (code === 'CUSTOMER') return '客户信息删除'
  if (code === 'SUPPLIER') return '供方信息删除'
  if (code === 'EMPLOYEE') return '员工信息删除'
  if (code === 'GOODS') return '货物信息删除'
  return '硬删除申请'
}

const mapHardDeleteRows = (hardDeleteRows: HardDeleteReviewTask[]): UnifiedReviewRow[] => {
  return hardDeleteRows.map((row) => {
    const status = normalizeHardDeleteStatus(row.status)
    return {
      id: `hard-${row.id}`,
      category: 'HARD_DELETE',
      categoryText: '硬删除审核',
      sourceText: resolveHardDeleteSourceText(row.moduleCode),
      status,
      statusText: normalizeStatusText(status),
      projectCode: String(row.projectCode || ''),
      subject:
        [row.displayName, row.displayCode, row.productName, row.productDrawing]
          .filter((v, i, arr) => !!v && arr.indexOf(v) === i)
          .join(' / ') || '-',
      applicant: String(row.requesterName || ''),
      reviewer: String(row.reviewerName || ''),
      reason: String(row.requestReason || row.reviewComment || ''),
      updatedAt: row.updatedAt || row.createdAt || null,
      raw: row
    }
  })
}

const mapBmoRows = (bmoRows: BmoInitiationReviewTask[]): UnifiedReviewRow[] => {
  return bmoRows.map((row) => {
    const status = normalizeBmoStatus(row.status)
    return {
      id: `bmo-${row.bmo_record_id}`,
      category: 'BMO_INITIATION',
      categoryText: 'BMO立项审核',
      sourceText: 'BMO立项审核',
      status,
      statusText: normalizeStatusText(status),
      projectCode: String(row.project_code_candidate || ''),
      subject: [row.part_name, row.part_no].filter(Boolean).join(' / ') || '-',
      applicant: String(row.created_by || ''),
      reviewer: String(row.approved_by || ''),
      reason: String(row.rejected_reason || ''),
      updatedAt: row.updated_at || row.created_at || null,
      raw: row
    }
  })
}

const loadUnifiedRows = async (): Promise<UnifiedReviewRow[]> => {
  const bmoStatus = mapStatusForBmoApi(query.status)
  const hardDeleteStatus = mapStatusForHardDeleteApi(query.status)
  const includeHardDelete =
    (query.category === 'ALL' || query.category === 'HARD_DELETE') && hardDeleteStatus !== null
  const includeBmo =
    (query.category === 'ALL' || query.category === 'BMO_INITIATION') && bmoStatus !== null

  // 单分类：直接使用后端分页，避免前端截断
  if (query.category === 'HARD_DELETE') {
    if (!includeHardDelete) {
      total.value = 0
      return []
    }
    const res = await getHardDeleteReviewTasksApi({
      status: hardDeleteStatus,
      keyword: normalizedKeyword.value || undefined,
      page: query.page,
      pageSize: query.pageSize
    })
    total.value = Number(res.data?.total || 0) || 0
    return mapHardDeleteRows((res.data?.list || []) as HardDeleteReviewTask[])
  }

  if (query.category === 'BMO_INITIATION') {
    if (!includeBmo) {
      total.value = 0
      return []
    }
    const res = await getBmoInitiationReviewTasksApi({
      status: bmoStatus,
      keyword: normalizedKeyword.value || undefined,
      page: query.page,
      pageSize: query.pageSize
    })
    total.value = Number(res.data?.total || 0) || 0
    return mapBmoRows((res.data?.list || []) as BmoInitiationReviewTask[])
  }

  if (query.status === 'ALL') {
    const fetchAllHardDelete = async () => {
      if (!includeHardDelete) return [] as UnifiedReviewRow[]
      const rows: UnifiedReviewRow[] = []
      const pageSize = 200
      let page = 1
      let totalRows = Number.POSITIVE_INFINITY
      while ((page - 1) * pageSize < totalRows) {
        const res = await getHardDeleteReviewTasksApi({
          status: hardDeleteStatus,
          keyword: normalizedKeyword.value || undefined,
          page,
          pageSize
        })
        const part = mapHardDeleteRows((res.data?.list || []) as HardDeleteReviewTask[])
        totalRows = Number(res.data?.total || 0) || 0
        rows.push(...part)
        if (!part.length) break
        page += 1
      }
      return rows
    }

    const fetchAllBmo = async () => {
      if (!includeBmo) return [] as UnifiedReviewRow[]
      const rows: UnifiedReviewRow[] = []
      const pageSize = 200
      let page = 1
      let totalRows = Number.POSITIVE_INFINITY
      while ((page - 1) * pageSize < totalRows) {
        const res = await getBmoInitiationReviewTasksApi({
          status: bmoStatus,
          keyword: normalizedKeyword.value || undefined,
          page,
          pageSize
        })
        const part = mapBmoRows((res.data?.list || []) as BmoInitiationReviewTask[])
        totalRows = Number(res.data?.total || 0) || 0
        rows.push(...part)
        if (!part.length) break
        page += 1
      }
      return rows
    }

    const [hardRows, bmoRows] = await Promise.all([fetchAllHardDelete(), fetchAllBmo()])
    const mergedRows = [...hardRows, ...bmoRows].sort((a, b) => {
      const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
      const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
      return tb - ta
    })
    total.value = mergedRows.length
    return mergedRows.slice((query.page - 1) * query.pageSize, query.page * query.pageSize)
  }

  // 全部分类：按时间做双路增量归并，避免全量拉取导致慢查询
  const mergePageSize = Math.max(50, query.pageSize)
  const targetCount = query.page * query.pageSize
  const merged: UnifiedReviewRow[] = []
  const readTimestamp = (row: UnifiedReviewRow | null) =>
    row?.updatedAt ? new Date(row.updatedAt).getTime() || 0 : 0

  let hardPage = 1
  let hardTotal = 0
  let hardLoaded = 0
  let hardBuffer: UnifiedReviewRow[] = []
  let hardCursor = 0

  let bmoPage = 1
  let bmoTotal = 0
  let bmoLoaded = 0
  let bmoBuffer: UnifiedReviewRow[] = []
  let bmoCursor = 0

  const fetchHardNext = async () => {
    if (!includeHardDelete) return
    if (hardLoaded >= hardTotal && hardPage > 1) return
    const res = await getHardDeleteReviewTasksApi({
      status: hardDeleteStatus,
      keyword: normalizedKeyword.value || undefined,
      page: hardPage,
      pageSize: mergePageSize
    })
    const part = mapHardDeleteRows((res.data?.list || []) as HardDeleteReviewTask[])
    hardTotal = Number(res.data?.total || 0) || 0
    hardLoaded += part.length
    hardPage += 1
    hardBuffer = part
    hardCursor = 0
  }

  const fetchBmoNext = async () => {
    if (!includeBmo) return
    if (bmoLoaded >= bmoTotal && bmoPage > 1) return
    const res = await getBmoInitiationReviewTasksApi({
      status: bmoStatus,
      keyword: normalizedKeyword.value || undefined,
      page: bmoPage,
      pageSize: mergePageSize
    })
    const part = mapBmoRows((res.data?.list || []) as BmoInitiationReviewTask[])
    bmoTotal = Number(res.data?.total || 0) || 0
    bmoLoaded += part.length
    bmoPage += 1
    bmoBuffer = part
    bmoCursor = 0
  }

  while (merged.length < targetCount) {
    const shouldFetchHard = includeHardDelete && hardCursor >= hardBuffer.length
    const shouldFetchBmo = includeBmo && bmoCursor >= bmoBuffer.length

    await Promise.all([
      shouldFetchHard ? fetchHardNext() : Promise.resolve(),
      shouldFetchBmo ? fetchBmoNext() : Promise.resolve()
    ])

    const hardHead = hardCursor < hardBuffer.length ? hardBuffer[hardCursor] : null
    const bmoHead = bmoCursor < bmoBuffer.length ? bmoBuffer[bmoCursor] : null
    if (!hardHead && !bmoHead) break

    if (!bmoHead || (hardHead && readTimestamp(hardHead) >= readTimestamp(bmoHead))) {
      merged.push(hardHead as UnifiedReviewRow)
      hardCursor += 1
      continue
    }
    merged.push(bmoHead)
    bmoCursor += 1
  }

  total.value = (includeHardDelete ? hardTotal : 0) + (includeBmo ? bmoTotal : 0)
  return merged.slice((query.page - 1) * query.pageSize, query.page * query.pageSize)
}

const loadTasks = async () => {
  loading.value = true
  try {
    list.value = await loadUnifiedRows()
  } catch (e: any) {
    list.value = []
    total.value = 0
    ElMessage.error(e?.message || '读取审核任务失败')
  } finally {
    loading.value = false
  }
}

const handleSearch = async () => {
  query.page = 1
  await loadTasks()
}

const handleReset = async () => {
  query.category = 'ALL'
  query.status = 'PENDING'
  query.keyword = ''
  query.page = 1
  query.pageSize = 20
  await loadTasks()
}

const handlePageSizeChange = async () => {
  query.page = 1
  await loadTasks()
}

const openBmoViewDialog = async (row: UnifiedReviewRow) => {
  if (row.category !== 'BMO_INITIATION') return
  const data = row.raw as BmoInitiationReviewTask
  const bmoRecordId = String(data.bmo_record_id || '').trim()
  if (!bmoRecordId) {
    ElMessage.error('缺少 bmo_record_id，无法查看立项')
    return
  }

  viewDialogVisible.value = true
  viewDialogLoading.value = true
  viewRow.value = data
  viewRequest.value = null
  try {
    const requestRes = await getBmoInitiationRequestApi({ bmo_record_id: bmoRecordId })
    viewRequest.value = (requestRes.data as any) || null
  } catch (e: any) {
    ElMessage.error(e?.message || '读取立项详情失败')
  } finally {
    viewDialogLoading.value = false
  }
}

const openHardDeleteViewDialog = (row: UnifiedReviewRow) => {
  if (row.category !== 'HARD_DELETE') return
  hardDeleteViewRow.value = row.raw as HardDeleteReviewTask
  hardDeleteViewDialogVisible.value = true
}

const handleReject = async (row: UnifiedReviewRow) => {
  if (!canReview(row)) return
  try {
    const promptRes = await ElMessageBox.prompt('请输入驳回原因', '驳回审核', {
      confirmButtonText: '确认驳回',
      cancelButtonText: '取消',
      inputType: 'textarea',
      inputPlaceholder: '请填写驳回原因',
      inputValidator: (value) => (String(value || '').trim() ? true : '请填写驳回原因')
    })
    const reason = String(promptRes.value || '').trim()
    if (!reason) return

    if (row.category === 'HARD_DELETE') {
      const data = row.raw as HardDeleteReviewTask
      await rejectHardDeleteReviewApi({ requestId: Number(data.id), reason })
    } else {
      const data = row.raw as BmoInitiationReviewTask
      await rejectBmoInitiationReviewApi({
        bmo_record_id: String(data.bmo_record_id || ''),
        reason
      })
    }

    await refreshBmoMenuBadges()
    ElMessage.success('已驳回')
    await loadTasks()
  } catch (e: any) {
    if (e === 'cancel' || e?.action === 'cancel' || e?.action === 'close') return
    ElMessage.error(e?.message || '驳回失败')
  }
}

const handleApprove = async (row: UnifiedReviewRow) => {
  if (!canReview(row)) return
  approvingId.value = row.id
  try {
    if (row.category === 'HARD_DELETE') {
      const data = row.raw as HardDeleteReviewTask
      await approveHardDeleteReviewApi({ requestId: Number(data.id) })
      ElMessage.success('审核通过，已执行硬删除')
    } else {
      const data = row.raw as BmoInitiationReviewTask
      const res = await approveAndApplyBmoInitiationReviewApi({
        bmo_record_id: String(data.bmo_record_id || '')
      })
      ElMessage.success(`审核通过：${res.data?.projectCode || '-'} / ${res.data?.orderNo || '-'}`)
    }

    await refreshBmoMenuBadges()
    await loadTasks()
  } catch (e: any) {
    ElMessage.error(e?.message || '审核通过失败')
  } finally {
    approvingId.value = ''
  }
}

onMounted(async () => {
  updateViewport()
  window.addEventListener('resize', updateViewport, { passive: true })
  const initBmoRecordId = String(route.query.bmoRecordId || '').trim()
  if (initBmoRecordId) {
    query.category = 'BMO_INITIATION'
    query.keyword = initBmoRecordId
  }
  await loadTasks()
})

onBeforeUnmount(() => {
  if (typeof window === 'undefined') return
  window.removeEventListener('resize', updateViewport)
})
</script>

<style scoped lang="less">
.review-center-page {
  .review-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .review-title {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
  }

  .review-subtitle {
    margin: 4px 0 0;
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  .review-filter {
    padding: 12px 12px 0;
    background: var(--el-bg-color-overlay);
    border-radius: 8px;
  }

  .review-pagination {
    display: flex;
    justify-content: flex-end;
  }

  .review-mobile-list {
    display: grid;
    gap: 10px;
  }

  .mobile-item {
    :deep(.el-card__body) {
      padding: 12px;
    }
  }

  .mobile-item__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;
  }

  .mobile-item__title {
    font-size: 14px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .mobile-item__grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 4px;
    font-size: 12px;
    color: var(--el-text-color-regular);
  }

  .mobile-item__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 8px;
  }
}

@media (width <= 900px) {
  .review-center-page {
    padding-right: 8px;
    padding-left: 8px;

    .review-header {
      align-items: flex-start;
      flex-direction: column;
      gap: 8px;
    }

    .review-actions {
      display: flex;
      width: 100%;
      justify-content: flex-end;
    }

    .review-filter {
      padding-bottom: 12px;
    }

    .review-pagination {
      justify-content: center;
      overflow-x: auto;
    }
  }
}
</style>
