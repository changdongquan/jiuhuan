<template>
  <div class="review-center-page px-4 pt-0 pb-2 space-y-3">
    <div class="review-header">
      <div>
        <h3 class="review-title">审核中心</h3>
        <p class="review-subtitle">统一处理待审核单据（当前已接入：BMO 立项）</p>
      </div>
      <div class="review-actions">
        <el-button :loading="loading" @click="loadTasks">刷新</el-button>
      </div>
    </div>

    <el-form :inline="!isMobile" class="review-filter">
      <el-form-item label="状态">
        <el-select v-model="query.status" :style="{ width: isMobile ? '100%' : '160px' }">
          <el-option label="全部" value="ALL" />
          <el-option label="草稿" value="DRAFT" />
          <el-option label="审核中" value="PM_CONFIRMED" />
          <el-option label="已驳回" value="REJECTED" />
          <el-option label="已入库" value="APPLIED" />
        </el-select>
      </el-form-item>
      <el-form-item label="关键词">
        <el-input
          v-model="query.keyword"
          :style="{ width: isMobile ? '100%' : '320px' }"
          clearable
          placeholder="项目编号/客户模号/图号/名称/记录ID"
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
        <el-table-column prop="status_text" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)">{{ row.status_text || '-' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column
          prop="project_code_candidate"
          label="项目编号"
          width="150"
          show-overflow-tooltip
        />
        <el-table-column prop="part_no" label="零部件图号" width="180" show-overflow-tooltip />
        <el-table-column prop="part_name" label="零部件名称" width="160" show-overflow-tooltip />
        <el-table-column prop="mold_number" label="客户模号" width="130" show-overflow-tooltip />
        <el-table-column
          prop="project_manager"
          label="项目经理"
          width="110"
          show-overflow-tooltip
        />
        <el-table-column prop="created_by" label="申请人" width="120" show-overflow-tooltip />
        <el-table-column prop="updated_at" label="更新时间" width="170">
          <template #default="{ row }">{{ formatTime(row.updated_at) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openInitiationViewDialog(row)"
              >查看立项</el-button
            >
            <el-button v-if="canReview(row)" link type="danger" @click="handleReject(row)">
              驳回
            </el-button>
            <el-button
              v-if="canReview(row)"
              link
              type="success"
              :loading="approvingId === row.bmo_record_id"
              @click="handleApprove(row)"
            >
              审核通过并入库
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div v-else v-loading="loading" class="review-mobile-list">
        <el-empty v-if="!list.length && !loading" description="暂无数据" :image-size="72" />
        <el-card v-for="row in list" :key="row.bmo_record_id" class="mobile-item" shadow="hover">
          <div class="mobile-item__head">
            <div class="mobile-item__title">{{ row.project_code_candidate || '-' }}</div>
            <el-tag :type="statusTagType(row.status)" size="small">
              {{ row.status_text || '-' }}
            </el-tag>
          </div>
          <div class="mobile-item__grid">
            <span>图号：{{ row.part_no || '-' }}</span>
            <span>名称：{{ row.part_name || '-' }}</span>
            <span>客户模号：{{ row.mold_number || '-' }}</span>
            <span>项目经理：{{ row.project_manager || '-' }}</span>
            <span>申请人：{{ row.created_by || '-' }}</span>
            <span>更新时间：{{ formatTime(row.updated_at) }}</span>
          </div>
          <div class="mobile-item__actions">
            <el-button link type="primary" @click="openInitiationViewDialog(row)"
              >查看立项</el-button
            >
            <el-button v-if="canReview(row)" link type="danger" @click="handleReject(row)">
              驳回
            </el-button>
            <el-button
              v-if="canReview(row)"
              link
              type="success"
              :loading="approvingId === row.bmo_record_id"
              @click="handleApprove(row)"
            >
              审核通过并入库
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
          <el-descriptions-item label="零部件图号">
            {{ viewRow?.part_no || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="零部件名称">
            {{ viewRow?.part_name || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="产品型号">
            {{ viewRow?.model || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="模具编号">
            {{ viewRow?.mold_number || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="中标价格(含税)">
            {{ formatAmount(viewRow?.bid_price_tax_incl ?? null) }}
          </el-descriptions-item>
          <el-descriptions-item label="中标时间">
            {{ formatTime(viewRow?.bid_time || null) }}
          </el-descriptions-item>
        </el-descriptions>

        <el-descriptions :column="descColumn" border size="small" title="立项状态">
          <el-descriptions-item label="当前状态">
            <el-tag :type="statusTagType(viewRequest?.status)">
              {{ viewRequest?.status_text || '-' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="项目编号候选">
            {{ viewRequest?.project_code_candidate || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="最终项目编号">
            {{ viewRequest?.project_code_final || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="申请人">
            {{ viewRequest?.created_by || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="驳回原因" :span="4">
            {{ viewRequest?.rejected_reason || '-' }}
          </el-descriptions-item>
        </el-descriptions>

        <el-descriptions :column="descColumn" border size="small" title="立项草稿（货物信息）">
          <el-descriptions-item label="项目编号">
            {{ viewRequest?.goods_draft?.projectCode || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="分类">
            {{ viewRequest?.goods_draft?.category || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="产品图号">
            {{ viewRequest?.goods_draft?.productDrawing || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="产品名称">
            {{ viewRequest?.goods_draft?.productName || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="客户名称">
            {{ viewRequest?.goods_draft?.customerName || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="客户模号">
            {{ viewRequest?.goods_draft?.customerModelNo || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="备注" :span="4">
            {{ viewRequest?.goods_draft?.remarks || '-' }}
          </el-descriptions-item>
        </el-descriptions>

        <el-descriptions :column="descColumn" border size="small" title="立项草稿（销售订单）">
          <el-descriptions-item label="订单日期">
            {{ viewRequest?.sales_order_draft?.orderDate || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="签订日期">
            {{ viewRequest?.sales_order_draft?.signDate || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="合同号">
            {{ viewRequest?.sales_order_draft?.contractNo || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="客户">
            {{ viewRequest?.sales_order_draft?.customerId ?? '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="明细项目编号">
            {{ viewRequest?.sales_order_draft?.details?.[0]?.itemCode || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="客户料号">
            {{ viewRequest?.sales_order_draft?.details?.[0]?.customerPartNo || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="交货日期">
            {{ viewRequest?.sales_order_draft?.details?.[0]?.deliveryDate || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="数量">
            {{ viewRequest?.sales_order_draft?.details?.[0]?.quantity ?? '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="单价">
            {{ viewRequest?.sales_order_draft?.details?.[0]?.unitPrice ?? '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="总金额">
            {{ viewRequest?.sales_order_draft?.details?.[0]?.totalAmount ?? '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="经办人">
            {{ viewRequest?.sales_order_draft?.details?.[0]?.handler || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="费用出处">
            {{ viewRequest?.sales_order_draft?.details?.[0]?.costSource || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="备注" :span="4">
            {{ viewRequest?.sales_order_draft?.details?.[0]?.remark || '-' }}
          </el-descriptions-item>
        </el-descriptions>
      </div>

      <template #footer>
        <el-button @click="viewDialogVisible = false">关闭</el-button>
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
import { refreshBmoMenuBadges } from '@/utils/bmoBadge'

type ReviewStatus = 'ALL' | 'DRAFT' | 'PM_CONFIRMED' | 'REJECTED' | 'APPLIED'

const route = useRoute()
const MOBILE_BREAKPOINT = 900
const loading = ref(false)
const list = ref<BmoInitiationReviewTask[]>([])
const total = ref(0)
const approvingId = ref('')
const viewDialogVisible = ref(false)
const viewDialogLoading = ref(false)
const viewRow = ref<BmoInitiationReviewTask | null>(null)
const viewRequest = ref<BmoInitiationRequestRow | null>(null)
const isMobile = ref(false)

const query = reactive({
  status: 'PM_CONFIRMED' as ReviewStatus,
  keyword: '',
  page: 1,
  pageSize: 20
})

const statusTagType = (status: unknown) => {
  const s = String(status || '').trim()
  if (s === 'PM_CONFIRMED') return 'warning'
  if (s === 'APPLIED') return 'success'
  if (s === 'REJECTED') return 'danger'
  return 'info'
}

const canReview = (row: Partial<BmoInitiationReviewTask> | null | undefined) => {
  const status = String(row?.status || '').trim()
  return status === 'PM_CONFIRMED'
}

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

const normalizedKeyword = computed(() => String(query.keyword || '').trim())
const descColumn = computed(() => (isMobile.value ? 1 : 4))

const updateViewport = () => {
  if (typeof window === 'undefined') return
  isMobile.value = window.innerWidth < MOBILE_BREAKPOINT
}

const loadTasks = async () => {
  loading.value = true
  try {
    const res = await getBmoInitiationReviewTasksApi({
      page: query.page,
      pageSize: query.pageSize,
      status: query.status,
      keyword: normalizedKeyword.value || undefined
    })
    list.value = res.data?.list || []
    total.value = Number(res.data?.total || 0) || 0
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
  query.status = 'PM_CONFIRMED'
  query.keyword = ''
  query.page = 1
  query.pageSize = 20
  await loadTasks()
}

const handlePageSizeChange = async () => {
  query.page = 1
  await loadTasks()
}

const openInitiationViewDialog = async (row: Partial<BmoInitiationReviewTask>) => {
  const bmoRecordId = String(row.bmo_record_id || '').trim()
  if (!bmoRecordId) {
    ElMessage.error('缺少 bmo_record_id，无法查看立项')
    return
  }
  viewDialogVisible.value = true
  viewDialogLoading.value = true
  viewRow.value = row as BmoInitiationReviewTask
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

const handleReject = async (row: Partial<BmoInitiationReviewTask>) => {
  const bmo_record_id = String(row.bmo_record_id || '').trim()
  if (!bmo_record_id) {
    ElMessage.error('缺少 bmo_record_id，无法驳回')
    return
  }
  try {
    const promptRes = await ElMessageBox.prompt('请输入驳回原因', '驳回立项', {
      confirmButtonText: '确认驳回',
      cancelButtonText: '取消',
      inputType: 'textarea',
      inputPlaceholder: '请填写驳回原因',
      inputValidator: (value) => (String(value || '').trim() ? true : '请填写驳回原因')
    })
    const reason = String(promptRes.value || '').trim()
    if (!reason) return
    await rejectBmoInitiationReviewApi({ bmo_record_id, reason })
    await refreshBmoMenuBadges()
    ElMessage.success('已驳回')
    await loadTasks()
  } catch (e: any) {
    if (e === 'cancel' || e?.action === 'cancel' || e?.action === 'close') return
    ElMessage.error(e?.message || '驳回失败')
  }
}

const handleApprove = async (row: Partial<BmoInitiationReviewTask>) => {
  const bmo_record_id = String(row.bmo_record_id || '').trim()
  if (!bmo_record_id) {
    ElMessage.error('缺少 bmo_record_id，无法入库')
    return
  }
  approvingId.value = bmo_record_id
  try {
    const res = await approveAndApplyBmoInitiationReviewApi({ bmo_record_id })
    await refreshBmoMenuBadges()
    ElMessage.success(`已入库：${res.data?.projectCode || '-'} / ${res.data?.orderNo || '-'}`)
    await loadTasks()
  } catch (e: any) {
    ElMessage.error(e?.message || '审核入库失败')
  } finally {
    approvingId.value = ''
  }
}

onMounted(async () => {
  updateViewport()
  window.addEventListener('resize', updateViewport, { passive: true })
  const initBmoRecordId = String(route.query.bmoRecordId || '').trim()
  if (initBmoRecordId) {
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
