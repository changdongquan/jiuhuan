<template>
  <div class="bmo-relay-page">
    <section class="relay-hero">
      <div class="relay-hero__backdrop"></div>
      <div class="relay-hero__mesh relay-hero__mesh--left"></div>
      <div class="relay-hero__mesh relay-hero__mesh--right"></div>

      <div class="relay-hero__main">
        <div class="relay-hero__eyebrow">
          <span class="relay-hero__eyebrow-line"></span>
          <span>Administrator Console</span>
        </div>
        <h1 class="relay-hero__title">BMO中转管理</h1>
        <p class="relay-hero__subtitle">
          用于管理员查看 relay 健康、BMO 会话、同步链路、入库记录与故障时间线。
        </p>

        <div class="relay-hero__actions">
          <el-button
            type="primary"
            class="relay-hero__action relay-hero__action--primary"
            :loading="checkingStatus"
            @click="checkRelayStatus"
          >
            刷新面板
          </el-button>
          <el-switch v-model="autoPolling" active-text="自动轮询" inactive-text="手动" />
        </div>

        <div class="relay-hero__summary">
          <div v-for="item in summaryTiles" :key="item.label" class="summary-tile">
            <div class="summary-tile__label">{{ item.label }}</div>
            <div class="summary-tile__value" :class="item.emphasis ? `is-${item.emphasis}` : ''">
              {{ item.value }}
            </div>
            <div class="summary-tile__meta">{{ item.meta }}</div>
          </div>
        </div>
      </div>

      <aside class="relay-hero__side">
        <div class="hero-status-card">
          <div class="hero-status-card__head">
            <span class="hero-status-card__label">运行态势</span>
            <span class="hero-status-card__score">{{ healthScore }}</span>
          </div>
          <div class="hero-status-card__headline">
            <el-tag :type="relayReadyTagType" effect="dark">{{ relayReadyText }}</el-tag>
            <span class="hero-status-card__state">{{ relayStatusText }}</span>
          </div>
          <div class="hero-status-card__list">
            <div class="hero-status-card__row">
              <span>Relay</span>
              <strong>{{ dashboard?.relay?.ready ? 'online' : 'offline' }}</strong>
            </div>
            <div class="hero-status-card__row">
              <span>Session</span>
              <strong>{{ authProbeSummaryText }}</strong>
            </div>
            <div class="hero-status-card__row">
              <span>Sync</span>
              <strong>{{ syncRunningText }}</strong>
            </div>
            <div class="hero-status-card__row">
              <span>Checked</span>
              <strong>{{
                formatTime(dashboard?.summary?.lastCheckedAt || dashboard?.checkedAt)
              }}</strong>
            </div>
          </div>
          <div class="hero-status-card__foot">
            {{ dashboardMessage || '当前未发现新的告警摘要' }}
          </div>
        </div>

        <div class="hero-signal-card">
          <div class="hero-signal-card__title">最新故障指纹</div>
          <div class="hero-signal-card__time">
            {{ formatTime(latestIncident?.time || dashboard?.summary?.latestDisconnectAt) }}
          </div>
          <div class="hero-signal-card__message">
            {{
              latestIncident?.message ||
              dashboard?.summary?.latestDisconnectReason ||
              '暂无断连或失败记录'
            }}
          </div>
        </div>
      </aside>
    </section>

    <section class="status-matrix">
      <article v-for="item in statusMatrix" :key="item.title" class="matrix-card">
        <div class="matrix-card__header">
          <span class="matrix-card__kicker">{{ item.kicker }}</span>
          <el-tag :type="item.tagType" effect="plain">{{ item.tag }}</el-tag>
        </div>
        <h3 class="matrix-card__title">{{ item.title }}</h3>
        <div class="matrix-card__primary">{{ item.primary }}</div>
        <div class="matrix-card__meta">{{ item.meta }}</div>
      </article>
    </section>

    <section class="operations-grid">
      <div class="operations-grid__main">
        <el-card shadow="never" class="console-card console-card--events">
          <template #header>
            <div class="console-card__header">
              <div>
                <div class="console-card__eyebrow">Timeline</div>
                <div class="console-card__title">事件时间线</div>
              </div>
              <div class="console-card__hint">最近 20 条系统事件</div>
            </div>
          </template>

          <div class="event-stream">
            <div
              v-for="event in dashboard?.recentEvents || []"
              :key="`${event.type}-${event.time}-${event.detail}`"
              class="event-stream__item"
            >
              <div class="event-stream__rail">
                <span class="event-stream__dot" :class="`is-${event.status}`"></span>
              </div>
              <div class="event-stream__body">
                <div class="event-stream__row">
                  <div class="event-stream__title">{{ event.title }}</div>
                  <div class="event-stream__time">{{ formatTime(event.time) }}</div>
                </div>
                <div class="event-stream__meta">
                  <span class="event-stream__type">{{ event.type }}</span>
                  <el-tag :type="eventTagType(event.status)" size="small">{{
                    event.status
                  }}</el-tag>
                </div>
                <div class="event-stream__detail">{{ event.detail || '-' }}</div>
              </div>
            </div>
          </div>
        </el-card>

        <div class="operations-grid__split">
          <el-card shadow="never" class="console-card">
            <template #header>
              <div class="console-card__header">
                <div>
                  <div class="console-card__eyebrow">Persist</div>
                  <div class="console-card__title">最近入库记录</div>
                </div>
                <div class="console-card__hint">成功写入 craftsys 的最近批次</div>
              </div>
            </template>
            <el-table :data="dashboard?.recentPersists || []" border size="small" max-height="320">
              <el-table-column prop="id" label="ID" width="70" />
              <el-table-column label="入库时间" width="170">
                <template #default="{ row }">{{ formatTime(row.time) }}</template>
              </el-table-column>
              <el-table-column label="抓取时间" width="170">
                <template #default="{ row }">{{ formatTime(row.fetchedAt) }}</template>
              </el-table-column>
              <el-table-column prop="trigger" label="触发来源" width="150" show-overflow-tooltip />
              <el-table-column prop="fetched" label="抓取" width="90" />
              <el-table-column prop="upserted" label="入库" width="90" />
              <el-table-column
                prop="traceId"
                label="traceId"
                min-width="200"
                show-overflow-tooltip
              />
            </el-table>
          </el-card>

          <el-card shadow="never" class="console-card">
            <template #header>
              <div class="console-card__header">
                <div>
                  <div class="console-card__eyebrow">Faults</div>
                  <div class="console-card__title">异常与断连记录</div>
                </div>
                <div class="console-card__hint">最近识别到的失败与断开</div>
              </div>
            </template>
            <el-table :data="dashboard?.recentErrors || []" border size="small" max-height="320">
              <el-table-column label="时间" width="170">
                <template #default="{ row }">{{ formatTime(row.time) }}</template>
              </el-table-column>
              <el-table-column prop="stage" label="阶段" width="140" />
              <el-table-column
                prop="message"
                label="错误信息"
                min-width="300"
                show-overflow-tooltip
              />
            </el-table>
          </el-card>
        </div>
      </div>

      <aside class="operations-grid__rail">
        <el-card shadow="never" class="console-card control-card">
          <template #header>
            <div class="console-card__header">
              <div>
                <div class="console-card__eyebrow">Session Dock</div>
                <div class="console-card__title">会话控制舱</div>
              </div>
            </div>
          </template>

          <div class="control-card__stats">
            <div class="control-chip">
              <span class="control-chip__label">来源</span>
              <span class="control-chip__value">{{ authStatus.source || '-' }}</span>
            </div>
            <div class="control-chip">
              <span class="control-chip__label">Cookie</span>
              <span class="control-chip__value">{{
                authStatus.hasCookie ? '已设置' : '未设置'
              }}</span>
            </div>
            <div class="control-chip">
              <span class="control-chip__label">Token</span>
              <span class="control-chip__value">{{
                authStatus.hasToken ? '已设置' : '未设置'
              }}</span>
            </div>
            <div class="control-chip">
              <span class="control-chip__label">更新</span>
              <span class="control-chip__value">{{ authUpdatedAtText || '-' }}</span>
            </div>
          </div>

          <div
            class="control-card__alert"
            :class="authStatus.probeOk === false ? 'is-danger' : 'is-info'"
          >
            {{ authProbeText || '当前尚未单独执行会话探活' }}
          </div>

          <el-form label-position="top" class="control-form">
            <el-form-item label="账号/密码登录">
              <div class="control-form__row">
                <el-input
                  v-model="authLoginForm.username"
                  placeholder="可选：BMO账号（留空用服务端配置）"
                />
                <el-input
                  v-model="authLoginForm.password"
                  placeholder="可选：BMO密码（留空用服务端配置）"
                  show-password
                />
              </div>
              <div class="control-form__actions">
                <el-button :loading="authLoggingIn" type="primary" @click="handleAuthLogin">
                  手动登录
                </el-button>
                <el-button :loading="authChecking" @click="refreshAuthStatus(true)"
                  >探活检查</el-button
                >
                <el-button :loading="authLoggingOut" type="warning" @click="handleAuthLogout">
                  断开登录
                </el-button>
              </div>
            </el-form-item>

            <el-form-item label="手工会话">
              <el-input
                v-model="authSetForm.cookie"
                type="textarea"
                :rows="3"
                placeholder="Cookie（可选）"
              />
            </el-form-item>
            <el-form-item label="X-AUTH-TOKEN">
              <el-input v-model="authSetForm.token" placeholder="X-AUTH-TOKEN（可选）" />
            </el-form-item>
            <el-form-item>
              <el-button :loading="authSetting" @click="handleAuthSet">写入会话</el-button>
            </el-form-item>
          </el-form>
        </el-card>

        <el-card shadow="never" class="console-card action-card">
          <template #header>
            <div class="console-card__header">
              <div>
                <div class="console-card__eyebrow">Action Lab</div>
                <div class="console-card__title">任务实验台</div>
              </div>
            </div>
          </template>

          <el-form :model="createForm" label-position="top" class="control-form">
            <el-form-item label="任务类型">
              <el-select v-model="createForm.type" class="full-width">
                <el-option label="collect（采集）" value="collect" />
                <el-option label="download_attachment（下载附件）" value="download_attachment" />
                <el-option label="writeback（回填）" value="writeback" />
                <el-option label="upload_attachment（上传附件）" value="upload_attachment" />
              </el-select>
            </el-form-item>

            <template v-if="createForm.type === 'collect'">
              <div class="control-form__row">
                <el-form-item label="pageSize">
                  <el-input-number v-model="collectForm.pageSize" :min="1" :max="500" />
                </el-form-item>
                <el-form-item label="offset">
                  <el-input-number v-model="collectForm.offset" :min="0" :max="100000" />
                </el-form-item>
              </div>
            </template>

            <template v-else-if="createForm.type === 'download_attachment'">
              <el-form-item label="fdId">
                <el-input v-model="downloadForm.fdId" placeholder="BMO记录ID（fdId）" />
              </el-form-item>
              <el-form-item label="attachmentId">
                <el-input
                  v-model="downloadForm.attachmentId"
                  placeholder="附件ID（attachmentId）"
                />
              </el-form-item>
              <el-form-item label="fileName">
                <el-input v-model="downloadForm.fileName" placeholder="可选：下载文件名" />
              </el-form-item>
            </template>

            <template v-else-if="createForm.type === 'writeback'">
              <el-form-item label="path">
                <el-input v-model="writebackForm.path" placeholder="/data/xxx/xxx" />
              </el-form-item>
              <el-form-item label="body(JSON)">
                <el-input v-model="writebackForm.bodyJson" type="textarea" :rows="4" />
              </el-form-item>
            </template>

            <template v-else>
              <el-form-item label="path">
                <el-input v-model="uploadForm.path" placeholder="/data/xxx/upload" />
              </el-form-item>
              <el-form-item label="fileId">
                <el-input v-model="uploadForm.fileId" placeholder="可选：已有fileId" />
              </el-form-item>
              <el-form-item label="localFile">
                <el-input v-model="uploadForm.localFile" placeholder="可选：worker本机文件路径" />
              </el-form-item>
              <el-form-item label="fileName">
                <el-input v-model="uploadForm.fileName" placeholder="可选：上传文件名" />
              </el-form-item>
            </template>

            <el-form-item>
              <el-button
                type="primary"
                :loading="creatingJob"
                class="full-width"
                @click="createJob"
              >
                创建任务
              </el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </aside>
    </section>

    <section class="task-workspace">
      <el-card shadow="never" class="console-card">
        <template #header>
          <div class="console-card__header">
            <div>
              <div class="console-card__eyebrow">Workspace</div>
              <div class="console-card__title">任务工作区</div>
            </div>
            <div class="console-card__hint">查询、刷新、重试和下载 relay 任务文件</div>
          </div>
        </template>

        <div class="workspace-query">
          <el-input
            v-model="queryJobId"
            placeholder="输入任务ID后查询"
            clearable
            @keydown.enter.prevent="querySingleJob"
          />
          <el-button :loading="queryingJob" @click="querySingleJob">查询任务</el-button>
        </div>

        <el-table :data="jobs" border size="small" max-height="440" v-loading="tableLoading">
          <el-table-column prop="id" label="任务ID" min-width="220" show-overflow-tooltip />
          <el-table-column prop="type" label="类型" width="170" />
          <el-table-column label="状态" width="120">
            <template #default="{ row }">
              <el-tag :type="statusTagType(row.status)">{{ row.status }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="createdAt" label="创建时间" width="180" />
          <el-table-column prop="finishedAt" label="结束时间" width="180" />
          <el-table-column label="结果" min-width="220" show-overflow-tooltip>
            <template #default="{ row }">
              {{ formatResult(row.result) }}
            </template>
          </el-table-column>
          <el-table-column prop="error" label="错误" min-width="220" show-overflow-tooltip />
          <el-table-column label="操作" width="220" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="refreshJob(row.id)">刷新</el-button>
              <el-button link type="warning" @click="retryJob(row.id)">重试</el-button>
              <el-button
                v-if="row.result && row.result.fileId"
                link
                type="success"
                @click="downloadRelayFile(String(row.result.fileId))"
              >
                下载文件
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  createBmoRelayJobApi,
  downloadBmoRelayFileApi,
  getBmoRelayAuthStatusApi,
  getBmoRelayDashboardApi,
  getBmoRelayJobApi,
  loginBmoRelayAuthApi,
  logoutBmoRelayAuthApi,
  retryBmoRelayJobApi,
  setBmoRelayAuthApi,
  type BmoRelayDashboardData,
  type BmoRelayDashboardEvent,
  type BmoRelayJob
} from '@/api/bmo'

type TagType = 'success' | 'warning' | 'info' | 'primary' | 'danger'

const checkingStatus = ref(false)
const creatingJob = ref(false)
const queryingJob = ref(false)
const tableLoading = ref(false)
const autoPolling = ref(true)
const pollingTimer = ref<number | null>(null)

const dashboard = ref<BmoRelayDashboardData | null>(null)
const authChecking = ref(false)
const authLoggingIn = ref(false)
const authLoggingOut = ref(false)
const authSetting = ref(false)
const authStatus = reactive({
  source: '',
  updatedAt: null as number | null,
  hasCookie: false,
  hasToken: false,
  cookiePreview: '',
  tokenPreview: '',
  probeOk: null as boolean | null,
  probeStatus: 0,
  probeMessage: ''
})

const authLoginForm = reactive({
  username: '',
  password: ''
})

const authSetForm = reactive({
  cookie: '',
  token: ''
})

const createForm = reactive({
  type: 'collect'
})

const collectForm = reactive({
  pageSize: 50,
  offset: 0
})

const downloadForm = reactive({
  fdId: '',
  attachmentId: '',
  fileName: ''
})

const writebackForm = reactive({
  path: '',
  bodyJson: '{}'
})

const uploadForm = reactive({
  path: '',
  fileId: '',
  localFile: '',
  fileName: ''
})

const queryJobId = ref('')
const jobs = ref<BmoRelayJob[]>([])

const formatTime = (value: string | null | undefined) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('zh-CN', { hour12: false })
}

const syncAuthStatus = (data: BmoRelayDashboardData['auth'] | null | undefined) => {
  authStatus.source = String(data?.source || '')
  authStatus.updatedAt = data?.updatedAt
    ? Math.floor(new Date(data.updatedAt).getTime() / 1000)
    : null
  authStatus.hasCookie = Boolean(data?.hasCookie)
  authStatus.hasToken = Boolean(data?.hasToken)
  authStatus.cookiePreview = String(data?.cookiePreview || '')
  authStatus.tokenPreview = String(data?.tokenPreview || '')
  authStatus.probeOk =
    data?.probe && typeof data.probe.ok === 'boolean' ? Boolean(data.probe.ok) : null
  authStatus.probeStatus = Number(data?.probe?.status || 0)
  authStatus.probeMessage = String(data?.probe?.message || '')
}

const relayReadyTagType = computed(() => (dashboard.value?.relay?.ready ? 'success' : 'danger'))
const relayReadyText = computed(() => (dashboard.value?.relay?.ready ? '正常' : '异常'))

const relayState = computed<'connected' | 'expired' | 'error' | null>(() => {
  if (authStatus.probeOk === true) return 'connected'
  if (authStatus.probeOk === false) return 'expired'
  if (dashboard.value?.relay?.ready === false) return 'error'
  return null
})

const relayStatusText = computed(() => {
  if (relayState.value === 'connected') return '已连接'
  if (relayState.value === 'expired') return '会话过期'
  if (relayState.value === 'error') return '连接异常'
  return '未知'
})

const dashboardMessage = computed(() => {
  return (
    dashboard.value?.summary?.latestDisconnectReason ||
    dashboard.value?.sync?.lastError ||
    dashboard.value?.relay?.message ||
    ''
  )
})

const syncRunningTagType = computed(() => {
  if (dashboard.value?.sync?.running) return 'warning'
  if (dashboard.value?.sync?.enabled) return 'success'
  return 'info'
})

const syncRunningText = computed(() => {
  if (dashboard.value?.sync?.running) return '运行中'
  if (dashboard.value?.sync?.enabled) return '空闲'
  return '未启用'
})

const authProbeTagType = computed(() => {
  if (authStatus.probeOk === true) return 'success'
  if (authStatus.probeOk === false) return 'danger'
  return 'info'
})

const authProbeSummaryText = computed(() => {
  if (authStatus.probeOk === true) return '已连接'
  if (authStatus.probeOk === false) return '断开'
  return '未探活'
})

const authProbeDetailText = computed(() => {
  if (authStatus.probeOk === true) return `HTTP ${authStatus.probeStatus || 200}`
  if (authStatus.probeOk === false) {
    return authStatus.probeMessage || `HTTP ${authStatus.probeStatus || 0}`
  }
  return ''
})

const authUpdatedAtText = computed(() => {
  const ts = Number(authStatus.updatedAt || 0)
  if (!Number.isFinite(ts) || ts <= 0) return ''
  return new Date(ts * 1000).toLocaleString()
})

const authProbeText = computed(() => {
  if (authStatus.probeOk === null) return ''
  if (authStatus.probeOk) return `会话探活成功（HTTP ${authStatus.probeStatus || 200}）`
  return `会话探活失败（HTTP ${authStatus.probeStatus || 0}）${authStatus.probeMessage ? `: ${authStatus.probeMessage}` : ''}`
})

const latestIncident = computed(() => {
  return dashboard.value?.recentErrors?.[0] || null
})

const latestPersist = computed(() => {
  return dashboard.value?.recentPersists?.[0] || null
})

const healthScore = computed(() => {
  let score = 100
  if (!dashboard.value?.relay?.ready) score -= 40
  if (authStatus.probeOk === false) score -= 30
  if (dashboard.value?.sync?.lastError) score -= 15
  if (latestIncident.value) score -= 10
  return String(Math.max(0, score)).padStart(2, '0')
})

const summaryTiles = computed(() => {
  return [
    {
      label: '最近抓取完成',
      value: formatTime(dashboard.value?.sync?.lastFinishedAt),
      meta: dashboard.value?.sync?.running ? '调度正在执行中' : '最近一次抓取结束时间'
    },
    {
      label: '最近获得新数据',
      value: formatTime(dashboard.value?.summary?.lastNewDataAt),
      meta: latestPersist.value
        ? `最近入库：${latestPersist.value.upserted} 条`
        : '最近未识别到数据变化'
    },
    {
      label: '最近断开连接',
      value: formatTime(dashboard.value?.summary?.latestDisconnectAt),
      meta: dashboard.value?.summary?.latestDisconnectReason || '当前无断连摘要',
      emphasis: dashboard.value?.summary?.latestDisconnectAt ? 'danger' : ''
    },
    {
      label: '最近重连成功',
      value: formatTime(dashboard.value?.summary?.latestReconnectAt),
      meta: authStatus.source || '暂无重连来源',
      emphasis: dashboard.value?.summary?.latestReconnectAt ? 'success' : ''
    }
  ]
})

const statusMatrix = computed(() => {
  return [
    {
      kicker: 'service',
      title: 'Relay服务',
      primary: dashboard.value?.relay?.ready ? '服务在线' : '服务异常',
      meta: dashboard.value?.relay?.message || 'relay /health 与面板聚合状态',
      tag: dashboard.value?.relay?.ready ? 'ok' : 'down',
      tagType: (dashboard.value?.relay?.ready ? 'success' : 'danger') as TagType
    },
    {
      kicker: 'session',
      title: 'BMO会话',
      primary: authProbeSummaryText.value,
      meta: authProbeDetailText.value || '最近未单独探活',
      tag: authStatus.source || 'unknown',
      tagType: authProbeTagType.value as TagType
    },
    {
      kicker: 'sync',
      title: '同步调度',
      primary: syncRunningText.value,
      meta: `开始：${formatTime(dashboard.value?.sync?.lastStartedAt)}`,
      tag: dashboard.value?.sync?.enabled ? 'enabled' : 'off',
      tagType: syncRunningTagType.value as TagType
    },
    {
      kicker: 'persist',
      title: '最近入库',
      primary: formatTime(dashboard.value?.summary?.lastPersistAt),
      meta: latestPersist.value
        ? `trigger=${latestPersist.value.trigger || '-'} | fetched=${latestPersist.value.fetched} | upserted=${latestPersist.value.upserted}`
        : '暂无成功入库记录',
      tag: latestPersist.value ? 'persisted' : 'empty',
      tagType: (latestPersist.value ? 'success' : 'info') as TagType
    }
  ]
})

const eventTagType = (status: BmoRelayDashboardEvent['status']) => {
  if (status === 'success') return 'success'
  if (status === 'warning') return 'warning'
  if (status === 'danger') return 'danger'
  return 'info'
}

const refreshAuthStatus = async (probe = false) => {
  authChecking.value = true
  try {
    const res = await getBmoRelayAuthStatusApi({ probe: probe ? 1 : 0 })
    const data = res.data
    syncAuthStatus({
      source: String(data?.source || '') || null,
      updatedAt:
        Number(data?.updatedAt || 0) > 0
          ? new Date(Number(data.updatedAt) * 1000).toISOString()
          : null,
      hasCookie: Boolean(data?.hasCookie),
      hasToken: Boolean(data?.hasToken),
      cookiePreview: String(data?.cookiePreview || '') || null,
      tokenPreview: String(data?.tokenPreview || '') || null,
      probe:
        data?.probe && typeof data.probe.ok === 'boolean'
          ? {
              ok: Boolean(data.probe.ok),
              status: Number(data?.probe?.status || 0),
              message: String(data?.probe?.message || '') || null
            }
          : null
    })
  } catch (e: any) {
    authStatus.probeOk = false
    authStatus.probeStatus = 0
    authStatus.probeMessage = e?.message || '读取会话状态失败'
    ElMessage.error(e?.message || '读取会话状态失败')
  } finally {
    authChecking.value = false
  }
}

const upsertJob = (job: BmoRelayJob) => {
  const id = String(job?.id || '').trim()
  if (!id) return
  const idx = jobs.value.findIndex((x) => x.id === id)
  if (idx >= 0) jobs.value[idx] = job
  else jobs.value.unshift(job)
}

const loadDashboard = async () => {
  const res = await getBmoRelayDashboardApi()
  dashboard.value = res.data || null
  syncAuthStatus(res.data?.auth)
}

const checkRelayStatus = async () => {
  checkingStatus.value = true
  try {
    await loadDashboard()
  } catch (e: any) {
    ElMessage.error(e?.message || '读取中转面板失败')
  } finally {
    checkingStatus.value = false
  }
}

const handleAuthLogin = async () => {
  authLoggingIn.value = true
  try {
    const payload: { username?: string; password?: string } = {}
    const username = String(authLoginForm.username || '').trim()
    const password = String(authLoginForm.password || '').trim()
    if (username) payload.username = username
    if (password) payload.password = password
    const res = await loginBmoRelayAuthApi(payload)
    const probe = res.data?.probe
    if (probe?.ok) ElMessage.success('手动登录成功，会话探活通过')
    else ElMessage.warning('已登录，但探活未通过，请检查账号权限')
    await checkRelayStatus()
  } catch (e: any) {
    ElMessage.error(e?.message || '手动登录失败')
  } finally {
    authLoggingIn.value = false
  }
}

const handleAuthLogout = async () => {
  authLoggingOut.value = true
  try {
    await logoutBmoRelayAuthApi()
    ElMessage.success('已断开中转会话')
    await checkRelayStatus()
  } catch (e: any) {
    ElMessage.error(e?.message || '断开会话失败')
  } finally {
    authLoggingOut.value = false
  }
}

const handleAuthSet = async () => {
  authSetting.value = true
  try {
    await setBmoRelayAuthApi({
      cookie: String(authSetForm.cookie || '').trim() || undefined,
      token: String(authSetForm.token || '').trim() || undefined
    })
    ElMessage.success('会话写入成功')
    await checkRelayStatus()
  } catch (e: any) {
    ElMessage.error(e?.message || '写入会话失败')
  } finally {
    authSetting.value = false
  }
}

const parseJsonObject = (raw: string) => {
  const text = String(raw || '').trim()
  if (!text) return {}
  const obj = JSON.parse(text)
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    throw new Error('JSON 必须是对象')
  }
  return obj
}

const buildPayload = () => {
  if (createForm.type === 'collect') {
    return {
      pageSize: Number(collectForm.pageSize || 50),
      offset: Number(collectForm.offset || 0)
    }
  }
  if (createForm.type === 'download_attachment') {
    const fdId = String(downloadForm.fdId || '').trim()
    const attachmentId = String(downloadForm.attachmentId || '').trim()
    if (!fdId || !attachmentId) throw new Error('download_attachment 需要 fdId 和 attachmentId')
    return {
      fdId,
      attachmentId,
      fileName: String(downloadForm.fileName || '').trim() || undefined
    }
  }
  if (createForm.type === 'writeback') {
    const path = String(writebackForm.path || '').trim()
    if (!path) throw new Error('writeback 需要 path')
    return {
      path,
      body: parseJsonObject(writebackForm.bodyJson)
    }
  }
  const path = String(uploadForm.path || '').trim()
  if (!path) throw new Error('upload_attachment 需要 path')
  return {
    path,
    fileId: String(uploadForm.fileId || '').trim() || undefined,
    localFile: String(uploadForm.localFile || '').trim() || undefined,
    fileName: String(uploadForm.fileName || '').trim() || undefined
  }
}

const createJob = async () => {
  creatingJob.value = true
  try {
    const payload = buildPayload()
    const res = await createBmoRelayJobApi({
      type: createForm.type,
      payload
    })
    const job = res.data
    if (job) upsertJob(job)
    ElMessage.success(`任务已创建：${job?.id || '-'}`)
  } catch (e: any) {
    ElMessage.error(e?.message || '创建任务失败')
  } finally {
    creatingJob.value = false
  }
}

const refreshJob = async (jobId: string) => {
  const id = String(jobId || '').trim()
  if (!id) return
  try {
    const res = await getBmoRelayJobApi(id)
    if (res.data) upsertJob(res.data)
  } catch (e: any) {
    ElMessage.error(e?.message || '读取任务失败')
  }
}

const querySingleJob = async () => {
  const id = String(queryJobId.value || '').trim()
  if (!id) {
    ElMessage.warning('请输入任务ID')
    return
  }
  queryingJob.value = true
  try {
    const res = await getBmoRelayJobApi(id)
    if (res.data) upsertJob(res.data)
  } catch (e: any) {
    ElMessage.error(e?.message || '读取任务失败')
  } finally {
    queryingJob.value = false
  }
}

const retryJob = async (jobId: string) => {
  const id = String(jobId || '').trim()
  if (!id) return
  try {
    await retryBmoRelayJobApi(id)
    await refreshJob(id)
    ElMessage.success('已提交重试')
  } catch (e: any) {
    ElMessage.error(e?.message || '重试任务失败')
  }
}

const downloadRelayFile = async (fileId: string) => {
  try {
    const res = await downloadBmoRelayFileApi(fileId)
    const blob = res.data as unknown as Blob
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `relay-${fileId}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (e: any) {
    ElMessage.error(e?.message || '下载中转文件失败')
  }
}

const statusTagType = (status?: string) => {
  const s = String(status || '').toLowerCase()
  if (s === 'success') return 'success'
  if (s === 'failed') return 'danger'
  if (s === 'running') return 'warning'
  return 'info'
}

const formatResult = (result: Record<string, any> | null) => {
  if (!result || typeof result !== 'object') return '-'
  const fileId = result.fileId ? `fileId=${String(result.fileId)}` : ''
  const count = Number.isFinite(Number(result.count)) ? `count=${result.count}` : ''
  const size = Number.isFinite(Number(result.size)) ? `size=${result.size}` : ''
  return [fileId, count, size].filter(Boolean).join(' | ') || JSON.stringify(result)
}

const pollJobs = async () => {
  if (!jobs.value.length) return
  tableLoading.value = true
  try {
    const runningIds = jobs.value
      .filter((x) => ['queued', 'running'].includes(String(x.status || '').toLowerCase()))
      .map((x) => x.id)
    for (const id of runningIds) {
      try {
        const res = await getBmoRelayJobApi(id)
        if (res.data) upsertJob(res.data)
      } catch (e) {
        // ignore single job failure
      }
    }
  } finally {
    tableLoading.value = false
  }
}

const startPolling = () => {
  if (pollingTimer.value !== null) return
  pollingTimer.value = window.setInterval(() => {
    if (!autoPolling.value) return
    void checkRelayStatus()
    void pollJobs()
  }, 10000)
}

const stopPolling = () => {
  if (pollingTimer.value !== null) {
    window.clearInterval(pollingTimer.value)
    pollingTimer.value = null
  }
}

onMounted(() => {
  void checkRelayStatus()
  startPolling()
})

onBeforeUnmount(() => {
  stopPolling()
})
</script>

<style scoped lang="less">
.bmo-relay-page {
  --relay-bg: #f4efe7;
  --relay-paper: rgb(255 252 247 / 82%);
  --relay-paper-strong: rgb(255 250 243 / 96%);
  --relay-ink: #1f1811;
  --relay-muted: #6c6157;
  --relay-line: rgb(70 52 36 / 12%);
  --relay-gold: #b3762f;
  --relay-red: #b5493c;
  --relay-green: #2f7d52;
  --relay-shadow: 0 24px 60px rgb(59 38 19 / 12%);

  min-height: 100%;
  padding: 16px;
  color: var(--relay-ink);
  background:
    radial-gradient(circle at top left, rgb(190 135 58 / 18%), transparent 24%),
    radial-gradient(circle at 80% 12%, rgb(70 121 89 / 14%), transparent 22%),
    linear-gradient(180deg, #f7f1e7 0%, #efe6d9 56%, #f5efe8 100%);

  @media (width <= 1280px) {
    .relay-hero,
    .operations-grid {
      grid-template-columns: 1fr;
    }

    .relay-hero__summary,
    .status-matrix,
    .operations-grid__split {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (width <= 900px) {
    padding: 12px;

    .relay-hero {
      padding: 20px;
      border-radius: 22px;
    }

    .relay-hero__summary,
    .status-matrix,
    .operations-grid__split,
    .control-card__stats,
    .control-form__row {
      grid-template-columns: 1fr;
    }

    .relay-hero__actions,
    .control-form__actions,
    .workspace-query {
      flex-direction: column;
      align-items: stretch;
    }
  }

  .relay-hero {
    position: relative;
    display: grid;
    padding: 28px;
    overflow: hidden;
    background: linear-gradient(145deg, rgb(255 250 243 / 98%), rgb(246 237 225 / 90%));
    border: 1px solid var(--relay-line);
    border-radius: 28px;
    box-shadow: var(--relay-shadow);
    grid-template-columns: minmax(0, 1.9fr) minmax(320px, 0.95fr);
    gap: 18px;
  }

  .relay-hero__backdrop,
  .relay-hero__mesh {
    position: absolute;
    pointer-events: none;
  }

  .relay-hero__backdrop {
    inset: 0;
    background:
      linear-gradient(120deg, rgb(255 255 255 / 18%), transparent 38%),
      linear-gradient(300deg, rgb(179 118 47 / 8%), transparent 44%);
  }

  .relay-hero__mesh {
    width: 340px;
    height: 340px;
    border-radius: 50%;
    opacity: 0.72;
    filter: blur(18px);
  }

  .relay-hero__mesh--left {
    top: -140px;
    left: -70px;
    background: radial-gradient(circle, rgb(182 117 53 / 40%), transparent 68%);
  }

  .relay-hero__mesh--right {
    right: -90px;
    bottom: -160px;
    background: radial-gradient(circle, rgb(53 106 78 / 32%), transparent 68%);
  }

  .relay-hero__main,
  .relay-hero__side {
    position: relative;
    z-index: 1;
  }

  .relay-hero__eyebrow {
    display: flex;
    font-size: 12px;
    letter-spacing: 0.18em;
    color: var(--relay-muted);
    text-transform: uppercase;
    align-items: center;
    gap: 10px;
  }

  .relay-hero__eyebrow-line {
    width: 42px;
    height: 1px;
    background: rgb(31 24 17 / 26%);
  }

  .relay-hero__title {
    margin: 14px 0 0;
    font-family: 'Source Han Serif SC', 'Noto Serif SC', 'Songti SC', serif;
    font-size: clamp(34px, 4vw, 54px);
    line-height: 1.04;
    letter-spacing: 0.02em;
  }

  .relay-hero__subtitle {
    max-width: 760px;
    margin: 12px 0 0;
    font-size: 15px;
    line-height: 1.7;
    color: var(--relay-muted);
  }

  .relay-hero__actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 14px;
    margin-top: 22px;
  }

  .relay-hero__action {
    min-width: 132px;
    border-radius: 999px;
  }

  .relay-hero__action--primary {
    background: linear-gradient(135deg, #1f1811, #533b28);
    border-color: transparent;
  }

  .relay-hero__summary {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
    margin-top: 28px;
  }

  .summary-tile {
    padding: 16px 18px;
    background: rgb(255 253 249 / 78%);
    border: 1px solid rgb(66 47 27 / 8%);
    border-radius: 20px;
    backdrop-filter: blur(8px);
  }

  .summary-tile__label {
    font-size: 12px;
    color: var(--relay-muted);
  }

  .summary-tile__value {
    margin-top: 10px;
    font-size: 18px;
    font-weight: 700;
    line-height: 1.3;
  }

  .summary-tile__value.is-danger {
    color: var(--relay-red);
  }

  .summary-tile__value.is-success {
    color: var(--relay-green);
  }

  .summary-tile__meta {
    margin-top: 10px;
    font-size: 12px;
    line-height: 1.5;
    color: var(--relay-muted);
  }

  .hero-status-card,
  .hero-signal-card {
    color: #efe4d5;
    background: rgb(27 21 17 / 94%);
    border: 1px solid rgb(66 47 27 / 10%);
    border-radius: 24px;
    box-shadow: 0 18px 36px rgb(22 16 12 / 22%);
  }

  .hero-status-card {
    padding: 18px;
  }

  .hero-status-card__head,
  .hero-status-card__row,
  .console-card__header,
  .event-stream__row,
  .event-stream__meta,
  .workspace-query {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .hero-status-card__label {
    font-size: 12px;
    letter-spacing: 0.12em;
    color: rgb(239 228 213 / 64%);
    text-transform: uppercase;
  }

  .hero-status-card__score {
    font-family: 'Source Han Serif SC', 'Noto Serif SC', 'Songti SC', serif;
    font-size: 32px;
    line-height: 1;
    color: #f5c27c;
  }

  .hero-status-card__headline {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 14px;
  }

  .hero-status-card__state {
    font-size: 14px;
    color: rgb(239 228 213 / 82%);
  }

  .hero-status-card__list {
    padding-top: 12px;
    margin-top: 18px;
    border-top: 1px solid rgb(239 228 213 / 12%);
  }

  .hero-status-card__row {
    padding: 9px 0;
    font-size: 13px;
  }

  .hero-status-card__row span {
    color: rgb(239 228 213 / 62%);
  }

  .hero-status-card__foot {
    padding: 12px 14px;
    margin-top: 14px;
    font-size: 12px;
    line-height: 1.6;
    color: rgb(239 228 213 / 80%);
    background: rgb(255 255 255 / 6%);
    border-radius: 16px;
  }

  .hero-signal-card {
    padding: 18px;
    margin-top: 14px;
    background: linear-gradient(145deg, rgb(184 73 60 / 94%), rgb(70 27 23 / 96%));
  }

  .hero-signal-card__title {
    font-size: 12px;
    letter-spacing: 0.12em;
    color: rgb(255 241 236 / 76%);
    text-transform: uppercase;
  }

  .hero-signal-card__time {
    margin-top: 10px;
    font-size: 18px;
    font-weight: 700;
  }

  .hero-signal-card__message {
    margin-top: 12px;
    font-size: 13px;
    line-height: 1.6;
    color: rgb(255 241 236 / 86%);
  }

  .status-matrix {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
    margin-top: 18px;
  }

  .matrix-card {
    padding: 18px;
    background: var(--relay-paper);
    border: 1px solid var(--relay-line);
    border-radius: 22px;
    box-shadow: 0 10px 24px rgb(68 49 28 / 6%);
    backdrop-filter: blur(10px);
  }

  .matrix-card__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .matrix-card__kicker {
    font-size: 11px;
    letter-spacing: 0.14em;
    color: var(--relay-muted);
    text-transform: uppercase;
  }

  .matrix-card__title {
    margin: 16px 0 0;
    font-size: 18px;
    font-weight: 700;
  }

  .matrix-card__primary {
    margin-top: 10px;
    font-size: 24px;
    font-weight: 700;
    line-height: 1.2;
  }

  .matrix-card__meta {
    margin-top: 12px;
    font-size: 12px;
    line-height: 1.65;
    color: var(--relay-muted);
  }

  .operations-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.65fr) minmax(320px, 0.82fr);
    gap: 16px;
    margin-top: 18px;
  }

  .operations-grid__main,
  .operations-grid__rail,
  .operations-grid__split {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .operations-grid__split {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .console-card {
    overflow: hidden;
    background: var(--relay-paper-strong);
    border: 1px solid var(--relay-line);
    border-radius: 24px;
    box-shadow: 0 16px 34px rgb(59 38 19 / 8%);
  }

  .console-card :deep(.el-card__header) {
    padding: 18px 20px 14px;
    background: linear-gradient(180deg, rgb(255 255 255 / 62%), rgb(255 255 255 / 0%));
    border-bottom: 1px solid rgb(55 39 24 / 8%);
  }

  .console-card :deep(.el-card__body) {
    padding: 18px 20px 20px;
  }

  .console-card__eyebrow {
    font-size: 11px;
    letter-spacing: 0.14em;
    color: var(--relay-muted);
    text-transform: uppercase;
  }

  .console-card__title {
    margin-top: 6px;
    font-size: 20px;
    font-weight: 700;
  }

  .console-card__hint {
    font-size: 12px;
    color: var(--relay-muted);
  }

  .event-stream {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .event-stream__item {
    display: grid;
    grid-template-columns: 24px minmax(0, 1fr);
    gap: 12px;
    padding: 14px 0;
    border-bottom: 1px solid rgb(71 53 35 / 8%);
  }

  .event-stream__item:last-child {
    padding-bottom: 0;
    border-bottom: none;
  }

  .event-stream__rail {
    position: relative;
    display: flex;
    justify-content: center;
  }

  .event-stream__rail::before {
    position: absolute;
    top: 6px;
    bottom: -20px;
    width: 1px;
    background: rgb(70 52 36 / 12%);
    content: '';
  }

  .event-stream__item:last-child .event-stream__rail::before {
    display: none;
  }

  .event-stream__dot {
    width: 12px;
    height: 12px;
    margin-top: 6px;
    background: rgb(120 105 89 / 38%);
    border-radius: 50%;
    box-shadow: 0 0 0 6px rgb(179 118 47 / 8%);
  }

  .event-stream__dot.is-success {
    background: var(--relay-green);
  }

  .event-stream__dot.is-warning {
    background: var(--relay-gold);
  }

  .event-stream__dot.is-danger {
    background: var(--relay-red);
  }

  .event-stream__title {
    font-size: 15px;
    font-weight: 700;
  }

  .event-stream__time {
    font-size: 12px;
    color: var(--relay-muted);
  }

  .event-stream__meta {
    justify-content: flex-start;
    margin-top: 8px;
  }

  .event-stream__type {
    display: inline-flex;
    height: 24px;
    padding: 0 10px;
    font-size: 11px;
    letter-spacing: 0.08em;
    color: #8b5a23;
    text-transform: uppercase;
    background: rgb(179 118 47 / 10%);
    border-radius: 999px;
    align-items: center;
  }

  .event-stream__detail {
    margin-top: 8px;
    font-size: 13px;
    line-height: 1.65;
    color: var(--relay-muted);
  }

  .control-card__stats {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .control-chip {
    padding: 12px;
    background: rgb(255 255 255 / 72%);
    border: 1px solid rgb(69 49 27 / 8%);
    border-radius: 16px;
  }

  .control-chip__label {
    display: block;
    font-size: 11px;
    letter-spacing: 0.08em;
    color: var(--relay-muted);
    text-transform: uppercase;
  }

  .control-chip__value {
    display: block;
    margin-top: 6px;
    font-size: 13px;
    font-weight: 700;
  }

  .control-card__alert {
    padding: 14px 16px;
    margin-top: 14px;
    font-size: 13px;
    line-height: 1.65;
    border-radius: 18px;
  }

  .control-card__alert.is-danger {
    color: #8a2f25;
    background: rgb(181 73 60 / 10%);
  }

  .control-card__alert.is-info {
    color: #83551f;
    background: rgb(179 118 47 / 8%);
  }

  .control-form {
    margin-top: 16px;
  }

  .control-form__row {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .control-form__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 10px;
  }

  .workspace-query {
    margin-bottom: 14px;
  }

  .workspace-query :deep(.el-input) {
    flex: 1;
  }

  .full-width {
    width: 100%;
  }

  .task-workspace {
    margin-top: 18px;
  }

  :deep(.el-input__wrapper),
  :deep(.el-textarea__inner),
  :deep(.el-input-number),
  :deep(.el-select__wrapper) {
    border-radius: 14px;
  }

  :deep(.el-table) {
    --el-table-border-color: rgb(70 52 36 / 8%);
    --el-table-header-bg-color: rgb(107 79 47 / 5%);
  }
}
</style>
