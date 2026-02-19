<template>
  <div class="bmo-relay-page px-4 pt-0 pb-2 space-y-3">
    <div class="bmo-relay-header">
      <div>
        <h3 class="bmo-relay-title">BMO中转管理</h3>
        <p class="bmo-relay-subtitle">中转状态检查、任务创建与任务追踪</p>
      </div>
      <div class="bmo-relay-actions">
        <el-switch v-model="autoPolling" active-text="自动轮询" inactive-text="手动" />
        <el-button :loading="checkingStatus" @click="checkRelayStatus">检查状态</el-button>
      </div>
    </div>

    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span>中转状态</span>
        </div>
      </template>
      <el-descriptions :column="3" border size="small">
        <el-descriptions-item label="状态">
          <el-tag :type="relayTagType">{{ relayStatusText }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="来源">
          {{ relaySource || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="最近检查">
          {{ lastCheckedAt || '-' }}
        </el-descriptions-item>
      </el-descriptions>
      <div v-if="relayMessage" class="relay-msg mt-2">{{ relayMessage }}</div>
    </el-card>

    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span>BMO登录会话管理</span>
        </div>
      </template>
      <el-descriptions :column="4" border size="small">
        <el-descriptions-item label="会话来源">
          {{ authStatus.source || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="Cookie">
          <el-tag :type="authStatus.hasCookie ? 'success' : 'info'">
            {{ authStatus.hasCookie ? '已设置' : '未设置' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="Token">
          <el-tag :type="authStatus.hasToken ? 'success' : 'info'">
            {{ authStatus.hasToken ? '已设置' : '未设置' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="更新时间">
          {{ authUpdatedAtText || '-' }}
        </el-descriptions-item>
      </el-descriptions>
      <div class="relay-msg mt-2" v-if="authProbeText">{{ authProbeText }}</div>

      <el-form label-width="120px" class="create-form mt-3">
        <el-form-item label="账号/密码登录">
          <div class="auth-inline">
            <el-input
              v-model="authLoginForm.username"
              placeholder="可选：BMO账号（留空使用服务器配置）"
            />
            <el-input
              v-model="authLoginForm.password"
              placeholder="可选：BMO密码（留空使用服务器配置）"
              show-password
            />
            <el-button :loading="authLoggingIn" type="primary" @click="handleAuthLogin">
              手动登录
            </el-button>
            <el-button :loading="authChecking" @click="refreshAuthStatus(true)">探活检查</el-button>
            <el-button :loading="authLoggingOut" type="warning" @click="handleAuthLogout">
              断开登录
            </el-button>
          </div>
        </el-form-item>
        <el-form-item label="手工会话">
          <el-input
            v-model="authSetForm.cookie"
            type="textarea"
            :rows="2"
            placeholder="Cookie（可选）"
          />
        </el-form-item>
        <el-form-item label=" ">
          <div class="auth-inline">
            <el-input v-model="authSetForm.token" placeholder="X-AUTH-TOKEN（可选）" />
            <el-button :loading="authSetting" @click="handleAuthSet">写入会话</el-button>
          </div>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span>创建任务</span>
        </div>
      </template>
      <el-form :model="createForm" label-width="120px" class="create-form">
        <el-form-item label="任务类型">
          <el-select v-model="createForm.type" style="width: 260px">
            <el-option label="collect（采集）" value="collect" />
            <el-option label="download_attachment（下载附件）" value="download_attachment" />
            <el-option label="writeback（回填）" value="writeback" />
            <el-option label="upload_attachment（上传附件）" value="upload_attachment" />
          </el-select>
        </el-form-item>

        <template v-if="createForm.type === 'collect'">
          <el-form-item label="pageSize">
            <el-input-number v-model="collectForm.pageSize" :min="1" :max="500" />
          </el-form-item>
          <el-form-item label="offset">
            <el-input-number v-model="collectForm.offset" :min="0" :max="100000" />
          </el-form-item>
        </template>

        <template v-else-if="createForm.type === 'download_attachment'">
          <el-form-item label="fdId">
            <el-input v-model="downloadForm.fdId" placeholder="BMO记录ID（fdId）" />
          </el-form-item>
          <el-form-item label="attachmentId">
            <el-input v-model="downloadForm.attachmentId" placeholder="附件ID（attachmentId）" />
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
          <el-button type="primary" :loading="creatingJob" @click="createJob">创建任务</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span>任务跟踪</span>
        </div>
      </template>
      <div class="job-actions mb-2">
        <el-input
          v-model="queryJobId"
          placeholder="输入任务ID后查询"
          style="width: 360px"
          clearable
          @keydown.enter.prevent="querySingleJob"
        />
        <el-button :loading="queryingJob" @click="querySingleJob">查询任务</el-button>
      </div>
      <el-table :data="jobs" border size="small" max-height="420" v-loading="tableLoading">
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
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  createBmoRelayJobApi,
  downloadBmoRelayFileApi,
  ensureBmoSessionApi,
  getBmoRelayAuthStatusApi,
  getBmoRelayJobApi,
  loginBmoRelayAuthApi,
  logoutBmoRelayAuthApi,
  retryBmoRelayJobApi,
  setBmoRelayAuthApi,
  type BmoRelayJob
} from '@/api/bmo'

const checkingStatus = ref(false)
const creatingJob = ref(false)
const queryingJob = ref(false)
const tableLoading = ref(false)
const autoPolling = ref(true)
const pollingTimer = ref<number | null>(null)

const relayState = ref<'connected' | 'expired' | 'error' | null>(null)
const relaySource = ref<'live' | 'db' | null>(null)
const relayMessage = ref('')
const lastCheckedAt = ref('')
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

const relayTagType = computed(() => {
  if (relayState.value === 'connected') return 'success'
  if (relayState.value === 'expired') return 'warning'
  if (relayState.value === 'error') return 'danger'
  return 'info'
})

const relayStatusText = computed(() => {
  if (relayState.value === 'connected') return '已连接'
  if (relayState.value === 'expired') return '会话过期'
  if (relayState.value === 'error') return '连接异常'
  return '未知'
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

const nowText = () => new Date().toLocaleString()

const refreshAuthStatus = async (probe = false) => {
  authChecking.value = true
  try {
    const res = await getBmoRelayAuthStatusApi({ probe: probe ? 1 : 0 })
    const data = res.data
    authStatus.source = String(data?.source || '')
    authStatus.updatedAt = Number(data?.updatedAt || 0) || null
    authStatus.hasCookie = Boolean(data?.hasCookie)
    authStatus.hasToken = Boolean(data?.hasToken)
    authStatus.cookiePreview = String(data?.cookiePreview || '')
    authStatus.tokenPreview = String(data?.tokenPreview || '')
    authStatus.probeOk =
      data?.probe && typeof data.probe.ok === 'boolean' ? Boolean(data.probe.ok) : null
    authStatus.probeStatus = Number(data?.probe?.status || 0)
    authStatus.probeMessage = String(data?.probe?.message || '')
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

const checkRelayStatus = async () => {
  checkingStatus.value = true
  try {
    const res = await ensureBmoSessionApi({ maxWaitMs: 2000, keeperTimeoutMs: 60000 })
    const data = res.data
    relayState.value = (data?.state as any) || null
    relaySource.value = (data?.source as any) || null
    relayMessage.value = String(data?.message || '')
    lastCheckedAt.value = nowText()
  } catch (e: any) {
    relayState.value = 'error'
    relaySource.value = 'db'
    relayMessage.value = e?.message || '状态检查失败'
    lastCheckedAt.value = nowText()
  } finally {
    checkingStatus.value = false
    void refreshAuthStatus(false)
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
    await refreshAuthStatus(true)
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
    await refreshAuthStatus(false)
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
    await refreshAuthStatus(true)
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
    void pollJobs()
  }, 3000)
}

const stopPolling = () => {
  if (pollingTimer.value !== null) {
    window.clearInterval(pollingTimer.value)
    pollingTimer.value = null
  }
}

onMounted(() => {
  void checkRelayStatus()
  void refreshAuthStatus(false)
  startPolling()
})

onBeforeUnmount(() => {
  stopPolling()
})
</script>

<style scoped lang="less">
.bmo-relay-page {
  .bmo-relay-header {
    display: flex;
    padding: 12px 15px;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 10px;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }

  .bmo-relay-title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }

  .bmo-relay-subtitle {
    margin: 4px 0 0;
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  .bmo-relay-actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .relay-msg {
    font-size: 12px;
    color: var(--el-color-danger);
  }

  .create-form {
    max-width: 900px;
  }

  .auth-inline {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
  }

  .job-actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }
}
</style>
