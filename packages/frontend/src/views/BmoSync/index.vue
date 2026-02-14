<template>
  <div class="bmo-sync-page px-4 pt-0 pb-2 space-y-3">
    <div class="bmo-header-wrap">
      <div class="bmo-header">
        <div>
          <div class="bmo-title-line">
            <h3 class="bmo-title">BMO 数据采集</h3>
            <div class="bmo-title-status">
              <el-tag :type="connTagType" effect="plain">{{ connShortLabel }}</el-tag>
              <span v-if="lastRefreshSource" class="bmo-conn-meta"
                >来源：{{ lastRefreshSource }}</span
              >
            </div>
          </div>
          <p class="bmo-subtitle">手动触发同步，并查看最新入库数据与任务状态</p>
        </div>
        <div class="bmo-actions">
          <el-button :loading="syncing" type="primary" @click="openSyncDialog">采集最新</el-button>
          <el-button :disabled="!latestList.length" @click="exportCsv">导出CSV</el-button>
          <el-switch v-model="useLiveOrder" active-text="实时顺序" inactive-text="库内顺序" />
          <el-switch
            v-model="autoRefresh"
            active-text="自动刷新"
            inactive-text="手动"
            @change="handleAutoRefreshToggle"
          />
          <el-button :loading="loadingLatest || loadingTasks" @click="refreshAll">刷新</el-button>
        </div>
      </div>
    </div>

    <div class="bmo-section">
      <div class="bmo-section__title">最新采集数据</div>
      <el-table
        class="bmo-latest-table"
        v-loading="loadingLatest"
        :data="latestList"
        border
        size="small"
        max-height="500"
      >
        <el-table-column type="index" label="#" width="52" />
        <el-table-column
          prop="project_manager"
          label="项目经理"
          width="110"
          show-overflow-tooltip
        />
        <el-table-column prop="part_no" label="零部件图号" width="200" show-overflow-tooltip />
        <el-table-column prop="part_name" label="零部件名称" width="160" show-overflow-tooltip />
        <el-table-column prop="model" label="产品型号" width="170" show-overflow-tooltip />
        <el-table-column prop="mold_number" label="模具编号" width="130" show-overflow-tooltip />
        <el-table-column prop="bid_price_tax_incl" label="中标价格(含税)" width="140" align="right">
          <template #default="{ row }">
            {{ formatAmount(row.bid_price_tax_incl) }}
          </template>
        </el-table-column>
        <el-table-column prop="bid_time" label="中标时间" width="170">
          <template #default="{ row }">{{ formatTime(row.bid_time) }}</template>
        </el-table-column>
        <el-table-column prop="project_code" label="项目编号" width="140" show-overflow-tooltip>
          <template #default="{ row }">
            <el-tag
              v-if="row.project_code"
              :type="getStatusTagType(row.project_status)"
              :class="getStatusTagClass(row.project_status)"
              class="pm-status-tag--fixed bmo-project-code-tag"
            >
              {{ row.project_code }}
            </el-tag>
            <el-tag v-else type="info" class="bmo-project-code-tag">-</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="90">
          <template #default="{ row }">
            <span v-if="row.project_code" class="bmo-action-running">项目执行中</span>
            <el-button v-else link type="primary" @click="openInitiateDialog(row)">立项</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div class="bmo-section">
      <div class="bmo-section__title">同步任务日志</div>
      <el-table v-loading="loadingTasks" :data="taskList" border size="small" max-height="160">
        <el-table-column prop="id" label="任务ID" width="90" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="taskTagType(row.status)">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="triggered_by" label="触发人" width="120" show-overflow-tooltip />
        <el-table-column prop="rows_fetched" label="抓取" width="80" align="right" />
        <el-table-column prop="rows_upserted" label="写入" width="80" align="right" />
        <el-table-column prop="started_at" label="开始时间" width="170">
          <template #default="{ row }">{{ formatTime(row.started_at) }}</template>
        </el-table-column>
        <el-table-column prop="finished_at" label="结束时间" width="170">
          <template #default="{ row }">{{ formatTime(row.finished_at) }}</template>
        </el-table-column>
        <el-table-column
          prop="error_message"
          label="错误信息"
          min-width="220"
          show-overflow-tooltip
        />
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="row.status === 'failed'"
              link
              type="primary"
              :loading="retryingTaskId === row.id"
              @click="handleRetry(row.id)"
            >
              重试
            </el-button>
            <span v-else>-</span>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="syncDialogVisible" title="触发 BMO 采集" width="420px">
      <el-form :model="syncForm" label-width="100px">
        <el-form-item label="每页条数">
          <el-input-number v-model="syncForm.pageSize" :min="1" :max="200" />
        </el-form-item>
        <el-form-item label="最多页数">
          <el-input-number v-model="syncForm.maxPages" :min="1" :max="500" />
        </el-form-item>
        <el-form-item label="仅试跑">
          <el-switch v-model="syncForm.dryRun" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="syncDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="syncing" @click="handleSync">开始采集</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="initiateDialogVisible" title="立项" width="980px" destroy-on-close>
      <div v-loading="initiateLoading" class="space-y-3">
        <el-descriptions :column="3" border size="small" title="表头信息">
          <el-descriptions-item label="零部件图号">
            {{ initiateRow?.part_no || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="零部件名称">
            {{ initiateRow?.part_name || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="产品型号">
            {{ initiateRow?.model || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="模具编号">
            {{ initiateRow?.mold_number || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="中标价格(含税)">
            {{ formatAmount(initiateRow?.bid_price_tax_incl ?? null) }}
          </el-descriptions-item>
          <el-descriptions-item label="中标时间">
            {{ formatTime(initiateRow?.bid_time || null) }}
          </el-descriptions-item>
        </el-descriptions>

        <el-descriptions :column="3" border size="small" title="1.4-模具清单详情">
          <el-descriptions-item label="提需类型">
            {{ initiateDetail?.demandType ?? '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="设计师">
            {{ initiateDetail?.designer ?? '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="BMO 记录ID">
            {{ initiateDetail?.fdId ?? initiateRow?.bmo_record_id ?? '-' }}
          </el-descriptions-item>
        </el-descriptions>

        <div class="bmo-initiate-section">
          <div class="bmo-initiate-section__title">模具技术要求</div>
          <el-table :data="initiateDetail?.tech?.fields || []" border size="small" max-height="320">
            <el-table-column prop="label" label="字段" width="220" show-overflow-tooltip />
            <el-table-column prop="value" label="值" min-width="260" show-overflow-tooltip />
          </el-table>
        </div>

        <div class="bmo-initiate-section">
          <div class="bmo-initiate-section__title">技术要求附件</div>
          <el-table
            :data="initiateDetail?.tech?.attachments || []"
            border
            size="small"
            max-height="220"
          >
            <el-table-column prop="fileName" label="文件名" min-width="320" show-overflow-tooltip />
            <el-table-column prop="fileSize" label="大小" width="120" align="right">
              <template #default="{ row }">{{ formatFileSize(row.fileSize) }}</template>
            </el-table-column>
            <el-table-column prop="createdAt" label="上传时间" width="180">
              <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="90" fixed="right">
              <template #default="{ row }">
                <el-button
                  v-if="row.id"
                  link
                  type="primary"
                  @click="downloadTechAttachment(row.id)"
                >
                  下载
                </el-button>
                <span v-else>-</span>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>

      <template #footer>
        <el-button @click="initiateDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  getBmoStatusApi,
  ensureBmoSessionApi,
  getBmoMouldProcurementApi,
  getBmoMouldProcurementRefreshApi,
  getBmoMouldProcurementDetailApi,
  getBmoTasksApi,
  retryBmoSyncApi,
  syncBmoApi,
  type BmoConnectionStatus,
  type BmoMouldProcurementRow,
  type BmoMouldProcurementDetail,
  type BmoTaskLog
} from '@/api/bmo'

const getStatusTagType = (status?: string | null) => {
  if (!status) return 'info'
  const statusTypeMap: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'primary'> = {
    T0: 'danger',
    T1: 'warning',
    T2: 'warning',
    设计中: 'warning',
    加工中: 'primary',
    表面处理: 'info',
    封样: 'primary',
    待移模: 'primary',
    已经移模: 'success'
  }
  return statusTypeMap[status] || 'info'
}

const statusClassMap: Record<string, string> = {
  T0: 'pm-status--t0',
  T1: 'pm-status--t1',
  T2: 'pm-status--t2',
  设计中: 'pm-status--designing',
  加工中: 'pm-status--processing',
  表面处理: 'pm-status--surface',
  封样: 'pm-status--sample',
  待移模: 'pm-status--pending-move',
  已经移模: 'pm-status--moved'
}

const getStatusTagClass = (status?: string | null) => {
  if (!status) return ''
  return statusClassMap[status] || ''
}

const loadingLatest = ref(false)
const loadingTasks = ref(false)
const syncing = ref(false)
const retryingTaskId = ref<number | null>(null)
const syncDialogVisible = ref(false)
const autoRefresh = ref(true)
const pollingTimer = ref<number | null>(null)
const useLiveOrder = ref(true)

const latestList = ref<BmoMouldProcurementRow[]>([])
const taskList = ref<BmoTaskLog[]>([])

const bmoStatus = ref<BmoConnectionStatus | null>(null)
const lastRefreshSource = ref<'live' | 'db' | null>(null)
const lastConnectionState = ref<'connected' | 'expired' | 'error' | null>(null)
const lastConnectionMessage = ref<string | null>(null)

const initiateDialogVisible = ref(false)
const initiateLoading = ref(false)
const initiateRow = ref<BmoMouldProcurementRow | null>(null)
const initiateDetail = ref<BmoMouldProcurementDetail | null>(null)

const syncForm = reactive({
  pageSize: 25,
  maxPages: 20,
  dryRun: false
})

const connTagType = computed(() => {
  if (!useLiveOrder.value) return 'info'
  if (lastConnectionState.value === 'connected') return 'success'
  if (lastConnectionState.value === 'expired') return 'warning'
  if (lastConnectionState.value === 'error') return 'danger'
  return 'info'
})

const connShortLabel = computed(() => {
  if (!useLiveOrder.value) return '库内顺序'
  if (lastConnectionState.value === 'connected') return '已连接'
  if (lastConnectionState.value === 'expired') return '会话过期'
  if (lastConnectionState.value === 'error') return '连接异常'
  return '未知状态'
})

const formatTime = (value: string | null | undefined) => {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString()
}

const formatAmount = (value: number | null | undefined) => {
  if (value === null || value === undefined) return '-'
  const amount = Number(value)
  return Number.isFinite(amount) ? amount.toLocaleString('zh-CN') : '-'
}

const formatFileSize = (bytes: number | null | undefined) => {
  const n = Number(bytes)
  if (!Number.isFinite(n) || n <= 0) return '-'
  const units = ['B', 'KB', 'MB', 'GB']
  let size = n
  let idx = 0
  while (size >= 1024 && idx < units.length - 1) {
    size /= 1024
    idx += 1
  }
  return `${size.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`
}

const taskTagType = (status?: string) => {
  if (status === 'success') return 'success'
  if (status === 'failed') return 'danger'
  if (status === 'running') return 'warning'
  return 'info'
}

const loadStatus = async () => {
  try {
    const res = await getBmoStatusApi()
    bmoStatus.value = res.data || null
  } catch (e) {
    // ignore status fetch errors
  }
}

const ensureSessionOnOpen = async () => {
  try {
    const res = await ensureBmoSessionApi({ maxWaitMs: 2000, keeperTimeoutMs: 60000 })
    const data = res.data
    lastConnectionState.value = data?.state || null
    lastRefreshSource.value = (data?.source as any) || null
    lastConnectionMessage.value = data?.message || null
  } catch (e: any) {
    lastConnectionState.value = 'error'
    lastRefreshSource.value = 'db'
    lastConnectionMessage.value = e?.message || 'ensure session failed'
  }
}

const loadLatest = async () => {
  loadingLatest.value = true
  try {
    if (useLiveOrder.value) {
      const res = await getBmoMouldProcurementRefreshApi({
        pageSize: 200,
        offset: 0,
        maxWaitMs: 3000,
        timeout: 6000
      })
      latestList.value = res.data?.list || []
      lastRefreshSource.value = (res.data?.source as any) || null
      lastConnectionState.value = (res.data?.connection?.state as any) || null
      lastConnectionMessage.value = res.data?.connection?.message || null
      if (res.data?.source === 'db') {
        ElMessage.warning(res.data?.connection?.message || '实时读取失败，已回退库内数据')
      }
      return
    } else {
      const res = await getBmoMouldProcurementApi({ limit: 200, timeout: 12000 })
      latestList.value = res.data?.list || []
      lastRefreshSource.value = null
      lastConnectionState.value = null
      lastConnectionMessage.value = null
      return
    }

    const res = await getBmoMouldProcurementApi({ limit: 200, timeout: 12000 })
    latestList.value = res.data?.list || []
  } finally {
    loadingLatest.value = false
  }
}

watch(useLiveOrder, () => {
  if (loadingLatest.value) return
  void loadLatest()
})

const loadTasks = async () => {
  loadingTasks.value = true
  try {
    const res = await getBmoTasksApi({ limit: 30 })
    taskList.value = res.data?.list || []
  } finally {
    loadingTasks.value = false
  }
}

const refreshAll = async () => {
  await Promise.all([loadLatest(), loadTasks()])
  await loadStatus()
}

const openSyncDialog = () => {
  syncDialogVisible.value = true
}

const openInitiateDialog = async (row: BmoMouldProcurementRow) => {
  const fdId = row.bmo_record_id
  if (!fdId) {
    ElMessage.warning('缺少 BMO 记录ID（bmo_record_id），无法读取 1.4 详情')
    return
  }

  initiateDialogVisible.value = true
  initiateRow.value = row
  initiateDetail.value = null
  initiateLoading.value = true
  try {
    const res = await getBmoMouldProcurementDetailApi({ fdId })
    initiateDetail.value = res.data || null
  } catch (e: any) {
    ElMessage.error(e?.message || '读取 1.4 详情失败')
  } finally {
    initiateLoading.value = false
  }
}

const downloadTechAttachment = (attachmentId: string) => {
  const url = `/api/bmo/attachment/download/${encodeURIComponent(attachmentId)}`
  window.open(url, '_blank')
}

const handleRetry = async (taskId: number) => {
  retryingTaskId.value = taskId
  try {
    const res = await retryBmoSyncApi(taskId)
    ElMessage.success(
      `重试完成：抓取 ${res.data?.fetched ?? 0} 条，写入 ${res.data?.upserted ?? 0} 条`
    )
    await refreshAll()
  } finally {
    retryingTaskId.value = null
  }
}

const exportCsv = () => {
  if (!latestList.value.length) {
    ElMessage.warning('暂无可导出数据')
    return
  }
  const headers = [
    '序号',
    '项目经理',
    '零部件图号',
    '零部件名称',
    '产品型号',
    '模具编号',
    '中标价格（含税）',
    '中标时间',
    '项目编号'
  ]
  const escapeCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`
  const lines = [
    headers.join(','),
    ...latestList.value.map((row, idx) =>
      [
        idx + 1,
        row.project_manager,
        row.part_no,
        row.part_name,
        row.model,
        row.mold_number,
        row.bid_price_tax_incl ?? '',
        formatTime(row.bid_time),
        row.project_code ?? ''
      ]
        .map(escapeCell)
        .join(',')
    )
  ]
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `bmo-latest-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const startPolling = () => {
  if (pollingTimer.value !== null) return
  pollingTimer.value = window.setInterval(async () => {
    if (loadingLatest.value || loadingTasks.value || syncing.value) return
    await Promise.all([loadTasks(), loadStatus()])
    if (useLiveOrder.value) {
      await loadLatest()
      return
    }
    if (taskList.value.some((task) => task.status === 'running')) await loadLatest()
  }, 60000)
}

const stopPolling = () => {
  if (pollingTimer.value !== null) {
    window.clearInterval(pollingTimer.value)
    pollingTimer.value = null
  }
}

const handleAutoRefreshToggle = (enabled: boolean) => {
  if (enabled) {
    startPolling()
  } else {
    stopPolling()
  }
}

const handleSync = async () => {
  syncing.value = true
  try {
    const res = await syncBmoApi({
      pageSize: syncForm.pageSize,
      maxPages: syncForm.maxPages,
      dryRun: syncForm.dryRun
    })
    ElMessage.success(
      `采集完成：抓取 ${res.data?.fetched ?? 0} 条，写入 ${res.data?.upserted ?? 0} 条`
    )
    syncDialogVisible.value = false
    await refreshAll()
  } finally {
    syncing.value = false
  }
}

onMounted(() => {
  // 默认库内顺序，但会先确保会话可用（过期则自动续期一次）
  void ensureSessionOnOpen().finally(() => {
    void refreshAll()
  })
  if (autoRefresh.value) startPolling()
})

onBeforeUnmount(() => {
  stopPolling()
})
</script>

<style scoped lang="less">
.bmo-sync-page {
  .bmo-header-wrap {
    padding: 12px 15px;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 10px;
  }

  .bmo-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .bmo-title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    line-height: 1.2;
  }

  .bmo-title-line {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .bmo-title-status {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .bmo-subtitle {
    margin: 4px 0 0;
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  .bmo-conn {
    display: flex;
    margin-top: 8px;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .bmo-conn-meta {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .bmo-actions {
    display: flex;
    gap: 8px;
  }

  .bmo-section {
    padding: 12px 15px;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 10px;
  }

  .bmo-section__title {
    margin-bottom: 10px;
    font-size: 14px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .bmo-initiate-section {
    padding: 12px 15px;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 10px;
  }

  .bmo-initiate-section__title {
    margin-bottom: 10px;
    font-size: 14px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  /* 对齐“项目管理-项目状态”的 tag 风格 */
  :deep(.el-tag) {
    font-weight: 500;
    letter-spacing: 0.5px;
    border-radius: 4px;
    box-shadow: 0 1px 3px rgb(0 0 0 / 10%);
  }

  :deep(.el-tag.pm-status--t0) {
    color: #f5222d !important;
    background-color: rgb(245 34 45 / 12%) !important;
    border-color: rgb(245 34 45 / 45%) !important;
  }

  :deep(.el-tag.pm-status--t1) {
    color: #fa541c !important;
    background-color: rgb(250 84 28 / 12%) !important;
    border-color: rgb(250 84 28 / 45%) !important;
  }

  :deep(.el-tag.pm-status--t2) {
    color: #faad14 !important;
    background-color: rgb(250 173 20 / 12%) !important;
    border-color: rgb(250 173 20 / 45%) !important;
  }

  :deep(.el-tag.pm-status--designing) {
    color: #67c23a !important;
    background-color: rgb(103 194 58 / 12%) !important;
    border-color: rgb(103 194 58 / 45%) !important;
  }

  :deep(.el-tag.pm-status--processing) {
    color: #e6a23c !important;
    background-color: rgb(230 162 60 / 12%) !important;
    border-color: rgb(230 162 60 / 45%) !important;
  }

  :deep(.el-tag.pm-status--surface) {
    color: #13c2c2 !important;
    background-color: rgb(19 194 194 / 12%) !important;
    border-color: rgb(19 194 194 / 45%) !important;
  }

  :deep(.el-tag.pm-status--sample) {
    color: #2f54eb !important;
    background-color: rgb(47 84 235 / 12%) !important;
    border-color: rgb(47 84 235 / 45%) !important;
  }

  :deep(.el-tag.pm-status--pending-move) {
    color: #eb2f96 !important;
    background-color: rgb(235 47 150 / 12%) !important;
    border-color: rgb(235 47 150 / 45%) !important;
  }

  :deep(.el-tag.pm-status--moved) {
    color: #52c41a !important;
    background-color: rgb(82 196 26 / 12%) !important;
    border-color: rgb(82 196 26 / 45%) !important;
  }

  :deep(.el-tag.pm-status-tag--fixed) {
    display: inline-flex;
    width: 80px;
    text-align: center;
    white-space: nowrap;
    box-sizing: border-box;
    justify-content: center;
  }

  /* 采集表：项目编号 tag 背景宽度 +15px */
  :deep(.el-tag.pm-status-tag--fixed.bmo-project-code-tag) {
    width: 95px;
  }

  .bmo-project-code-tag {
    max-width: 100%;
  }

  /* 最新采集数据表：字体加大一号（12px -> 13px） */
  :deep(.bmo-latest-table .el-table__cell .cell) {
    font-size: 14px;
  }

  .bmo-action-running {
    font-size: 13px;
    color: var(--el-text-color-regular);
  }
}
</style>
