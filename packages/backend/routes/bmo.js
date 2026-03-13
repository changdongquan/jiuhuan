const express = require('express')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { query, getPool } = require('../database')
const sql = require('mssql')
const {
  syncBmoMouldData,
  fetchBmoMouldListLive,
  fetchBmoMouldDetail,
  checkBmoAttachmentDownload,
  downloadBmoAttachmentByBrowser,
  downloadBmoAttachment,
  upsertBmoRecords,
  readAuthFromEnvFile
} = require('../services/bmoSync')
const { runOnce: runBmoSessionKeeperOnce } = require('../services/bmoSessionKeeper')
const {
  getBmoStatus,
  markLiveOk,
  markLiveError,
  markPersistStart,
  markPersistSuccess,
  markPersistError
} = require('../services/bmoStatus')
const { resolveActorFromReq } = require('../utils/actor')
const { assertReviewPermission } = require('../services/reviewAcl')
const {
  createDownloadJob,
  getDownloadJob,
  waitForDownloadJob,
  getDownloadWorkerHealth,
  getDownloadJobFile,
  restartDownloadWorker
} = require('../services/bmoDownloadWorkerClient')
const {
  runBmoAutoSyncOnce,
  upsertDetailCache,
  getDetailCacheByRecordId
} = require('../services/bmoAutoSync')
const { listCustomerOptions } = require('../services/customerOptions')
const { requireCapability, requireAnyCapability } = require('../middleware/capability')

const router = express.Router()
let persistInFlight = null
const requireBmoSyncRead = requireCapability('BMO_SYNC.READ', { fallbackRoute: 'BmoSync' })
const requireBmoSyncCreate = requireCapability('BMO_SYNC.CREATE', { fallbackRoute: 'BmoSync' })
const requireBmoSyncUpdate = requireCapability('BMO_SYNC.UPDATE', { fallbackRoute: 'BmoSync' })
const requireBmoSyncApprove = requireCapability('BMO_SYNC.APPROVE', { fallbackRoute: 'BmoSync' })
const requireBmoRelayRead = requireCapability('BMO_RELAY_MANAGE.READ', {
  fallbackRoute: 'BmoRelayManage'
})
const requireBmoRelayCreate = requireCapability('BMO_RELAY_MANAGE.CREATE', {
  fallbackRoute: 'BmoRelayManage'
})
const requireBmoRelayUpdate = requireCapability('BMO_RELAY_MANAGE.UPDATE', {
  fallbackRoute: 'BmoRelayManage'
})
const requireBmoSyncOrRelayRead = requireAnyCapability([
  { capabilityKey: 'BMO_SYNC.READ', fallbackRoute: 'BmoSync' },
  { capabilityKey: 'BMO_RELAY_MANAGE.READ', fallbackRoute: 'BmoRelayManage' }
])

router.use('/relay', requireBmoRelayRead)
router.use(
  [
    '/tech-spec',
    '/initiation-request',
    '/sync',
    '/latest',
    '/tasks',
    '/mould-procurement',
    '/initiation-review',
    '/attachment',
    '/auto-sync',
    '/initiation'
  ],
  requireBmoSyncRead
)

router.get('/health', requireBmoSyncOrRelayRead, (req, res) => {
  return res.json({
    code: 0,
    success: true,
    data: {
      hasCookie: Boolean(process.env.BMO_COOKIE),
      hasAuthToken: Boolean(process.env.BMO_X_AUTH_TOKEN),
      hasUsername: Boolean(process.env.BMO_USERNAME),
      hasPassword: Boolean(process.env.BMO_PASSWORD),
      hasLoginPayloadTemplate: Boolean(process.env.BMO_LOGIN_PAYLOAD_TEMPLATE),
      rsaPadding: process.env.BMO_RSA_PADDING || 'pkcs1',
      baseUrl: process.env.BMO_BASE_URL || 'https://bmo.meiling.com:8023',
      loginEndpoint: process.env.BMO_LOGIN_ENDPOINT || '/data/sys-auth/login',
      loginPageEndpoint:
        process.env.BMO_LOGIN_PAGE_ENDPOINT || '/data/sys-portal/sysPortalLoginPage/loginPage',
      dataEndpoint: process.env.BMO_DATA_ENDPOINT || '/data/sys-modeling/sysModelingMain/data'
    }
  })
})

router.get('/health/worker', requireBmoRelayRead, async (req, res) => {
  try {
    const data = await getDownloadWorkerHealth()
    return res.json({ code: 0, success: true, data })
  } catch (error) {
    return res.status(500).json({
      code: 500,
      success: false,
      message: '读取 BMO 下载 worker 健康状态失败: ' + (error?.message || '未知错误')
    })
  }
})

router.post('/health/worker/restart', requireBmoRelayUpdate, async (req, res) => {
  try {
    const data = await restartDownloadWorker()
    return res.json({ code: 0, success: true, data })
  } catch (error) {
    return res.status(500).json({
      code: 500,
      success: false,
      message: '重启 BMO 下载 worker 失败: ' + (error?.message || '未知错误')
    })
  }
})

router.get('/status', requireBmoSyncOrRelayRead, (req, res) => {
  if (isHubOnlyMode()) {
    return res.json({
      code: 0,
      success: true,
      data: {
        mode: 'hub-only',
        relayEnabled: isRelayEnabled(),
        relayBaseUrl: getRelayBaseUrl() || null
      }
    })
  }
  return res.json({
    code: 0,
    success: true,
    data: {
      ...getBmoStatus()
    }
  })
})

router.post('/session/ensure', requireBmoSyncOrRelayRead, async (req, res) => {
  if (isRelayEnabled()) {
    try {
      const pushLocalAuthToRelay = async () => {
        const authFilePath = String(process.env.BMO_AUTH_FILE || '').trim()
        const authFromFile = authFilePath ? readAuthFromEnvFile(authFilePath) : null
        const cookie = String(authFromFile?.BMO_COOKIE || process.env.BMO_COOKIE || '').trim()
        const token = String(authFromFile?.BMO_X_AUTH_TOKEN || process.env.BMO_X_AUTH_TOKEN || '').trim()
        if (!cookie && !token) return false
        await relayRequestJson('/auth/set', {
          method: 'POST',
          timeoutMs: 15000,
          body: {
            ...(cookie ? { cookie } : {}),
            ...(token ? { token } : {})
          }
        })
        return true
      }

      const health = await relayRequestJson('/health', { method: 'GET', timeoutMs: 5000 })
      const healthData = health?.data && typeof health.data === 'object' ? health.data : health
      const serviceOk = Boolean(healthData?.ok || healthData?.ready)
      if (!serviceOk) {
        return res.json({
          code: 0,
          success: true,
          data: {
            state: 'error',
            source: 'db',
            message: 'BMO 中转服务不可用'
          }
        })
      }

      const readRelayProbe = async () => {
        const authStatusResp = await relayRequestJson('/auth/status?probe=1', {
          method: 'GET',
          timeoutMs: 15000
        })
        const authStatus =
          authStatusResp?.data && typeof authStatusResp.data === 'object'
            ? authStatusResp.data
            : authStatusResp
        const probe =
          authStatus?.probe && typeof authStatus.probe === 'object' ? authStatus.probe : null
        return {
          ok: probe?.ok === true,
          status: Number(probe?.status || 0),
          message: String(probe?.message || '').trim()
        }
      }

      let probe = await readRelayProbe()
      let relayLoginMessage = ''
      let pushedLocalAuth = false

      if (!probe.ok && (probe.status === 401 || probe.status === 403)) {
        try {
          pushedLocalAuth = await pushLocalAuthToRelay()
          if (pushedLocalAuth) {
            probe = await readRelayProbe()
          }
        } catch (syncError) {
          const syncMessage = String(syncError?.message || '').trim()
          return res.json({
            code: 0,
            success: true,
            data: {
              state: 'expired',
              source: 'db',
              message: syncMessage || relayLoginMessage || '同步本机会话到 relay 失败'
            }
          })
        }
      }

      if (!probe.ok && (probe.status === 401 || probe.status === 403) && !pushedLocalAuth) {
        try {
          await relayRequestJson('/auth/login', {
            method: 'POST',
            timeoutMs: 30000,
            body: {}
          })
          probe = await readRelayProbe()
        } catch (loginError) {
          relayLoginMessage = String(loginError?.message || '').trim()
        }
      }

      return res.json({
        code: 0,
        success: true,
        data: probe.ok
          ? { state: 'connected', source: 'live' }
          : {
              state: probe.status === 401 || probe.status === 403 ? 'expired' : 'error',
              source: 'db',
              message:
                probe.message ||
                (probe.status ? `BMO 会话探活失败（HTTP ${probe.status}）` : 'BMO 会话不可用')
            }
      })
    } catch (e) {
      return res.json({
        code: 0,
        success: true,
        data: {
          state: 'error',
          source: 'db',
          message: 'BMO 中转服务连接失败: ' + (e?.message || '未知错误')
        }
      })
    }
  }

  if (isHubOnlyMode()) {
    return res.json({
      code: 0,
      success: true,
      data: {
        state: 'error',
        source: 'db',
        message: 'BMO_HUB_ONLY=1 且未配置 BMO_RELAY_BASE_URL'
      }
    })
  }

  const maxWaitMs = toSafeInt(req.query.maxWaitMs ?? req.body?.maxWaitMs, 3000)
  const keeperTimeoutMs = toSafeInt(req.query.keeperTimeoutMs ?? req.body?.keeperTimeoutMs, 60000)

  const tryLive = async () => {
    const r = await fetchBmoMouldListLive({
      pageSize: 1,
      offset: 0,
      timeoutMs: maxWaitMs,
      disableAuthRetry: true
    })
    markLiveOk()
    return r
  }

  try {
    await tryLive()
    return res.json({
      code: 0,
      success: true,
      data: {
        state: 'connected',
        source: 'live'
      }
    })
  } catch (error) {
    markLiveError(error)
    const msg = String(error?.message || error || '')
    const isExpired =
      msg.includes('HTTP 401') ||
      msg.includes('401') ||
      msg.includes('HTTP 403') ||
      msg.includes('403') ||
      msg.includes('未配置 BMO 认证信息')
    if (!isExpired) {
      return res.json({
        code: 0,
        success: true,
        data: {
          state: 'error',
          source: 'db',
          message: msg || 'live failed'
        }
      })
    }

    const keeperResult = await runBmoSessionKeeperOnce({ timeoutMs: keeperTimeoutMs })
    if (!keeperResult?.ok) {
      return res.json({
        code: 0,
        success: true,
        data: {
          state: 'expired',
          source: 'db',
          message: keeperResult?.message || msg || 'session expired'
        }
      })
    }

    try {
      await tryLive()
      return res.json({
        code: 0,
        success: true,
        data: {
          state: 'connected',
          source: 'live'
        }
      })
    } catch (e2) {
      markLiveError(e2)
      return res.json({
        code: 0,
        success: true,
        data: {
          state: 'expired',
          source: 'db',
          message: String(e2?.message || e2 || 'recheck failed')
        }
      })
    }
  }
})

const formatBmoSqlErrorMessage = (error, fallbackMessage) => {
  const message = String(error?.message || '')
  if (
    message.includes("Invalid object name 'bmo_mould_procurement'") ||
    message.includes("Invalid object name 'bmo_sync_task_logs'")
  ) {
    return 'BMO 采集数据表不存在，请先执行迁移：packages/backend/migrations/20260212_create_bmo_sync_tables.sql'
  }
  if (message.includes("Invalid object name 'bmo_initiation_requests'")) {
    return 'BMO 立项申请单表不存在，请先执行迁移：packages/backend/migrations/20260215_create_bmo_initiation_requests.sql'
  }
  if (message.includes("Invalid object name 'bmo_mould_detail_cache'")) {
    return 'BMO 模具详情缓存表不存在，请先执行迁移：packages/backend/migrations/20260219_create_bmo_mould_detail_cache.sql'
  }
  if (message.includes("Invalid object name 'bmo_tech_spec_parse_cache'")) {
    return 'BMO 技术规格表解析缓存表不存在，请先执行迁移：packages/backend/migrations/20260220_create_bmo_tech_spec_parse_cache.sql'
  }
  return `${fallbackMessage}: ${error.message || '未知错误'}`
}

const toSafeLimit = (value, fallback = 20, max = 200) => {
  const n = Number(value)
  if (!Number.isInteger(n) || n <= 0) return fallback
  return Math.min(n, max)
}

const toSafeInt = (value, fallback = 0) => {
  const n = Number(value)
  return Number.isInteger(n) ? n : fallback
}

const getRelayBaseUrl = () => String(process.env.BMO_RELAY_BASE_URL || '').trim().replace(/\/+$/, '')
const isRelayEnabled = () => Boolean(getRelayBaseUrl())
const isHubOnlyMode = () => String(process.env.BMO_HUB_ONLY || '1') !== '0'

const toIsoFromRelayTime = (value) => {
  const n = Number(value)
  if (Number.isFinite(n) && n > 0) {
    // relay currently returns unix seconds
    return new Date(n * 1000).toISOString()
  }
  const s = String(value || '').trim()
  if (!s) return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

const relayRequestJson = async (pathname, input = {}) => {
  const baseUrl = getRelayBaseUrl()
  if (!baseUrl) throw new Error('BMO_RELAY_BASE_URL 未配置')
  const method = String(input.method || 'GET').toUpperCase()
  const timeoutMs = toSafeInt(input.timeoutMs, 60000)
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), Math.max(1000, timeoutMs))
  try {
    const body = input.body
    const resp = await fetch(`${baseUrl}${pathname}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: ctrl.signal
    })
    const text = await resp.text()
    let json = null
    if (text) {
      try {
        json = JSON.parse(text)
      } catch (e) {
        json = null
      }
    }
    if (!resp.ok) {
      const errMsg =
        (json && (json.msg || json.message || json.detail || json.error)) ||
        text ||
        `relay HTTP ${resp.status}`
      throw new Error(String(errMsg).slice(0, 500))
    }
    if (json && typeof json === 'object') return json
    throw new Error('relay 返回非 JSON')
  } finally {
    clearTimeout(timer)
  }
}

const relayWaitJob = async (jobId, options = {}) => {
  const timeoutMs = toSafeInt(options.timeoutMs, 120000)
  const intervalMs = toSafeInt(options.intervalMs, 1000)
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const status = await relayRequestJson(`/jobs/${encodeURIComponent(jobId)}`, {
      method: 'GET',
      timeoutMs: Math.min(15000, timeoutMs)
    })
    const data = status?.data || status
    const state = String(data?.status || '').trim()
    if (state === 'success' || state === 'failed') return data
    await new Promise((resolve) => setTimeout(resolve, Math.max(200, intervalMs)))
  }
  throw new Error(`relay job timeout (${timeoutMs}ms)`)
}

const normalizeRelayDownloadJob = (data) => {
  const payload = data?.payload && typeof data.payload === 'object' ? data.payload : {}
  const result = data?.result && typeof data.result === 'object' ? data.result : null
  return {
    id: String(data?.id || '').trim(),
    requestId: null,
    attachmentId: payload?.attachmentId ? String(payload.attachmentId) : null,
    fdId: payload?.fdId ? String(payload.fdId) : null,
    fileName: payload?.fileName ? String(payload.fileName) : null,
    viewUrl: null,
    status: String(data?.status || '').trim() || 'queued',
    createdAt: toIsoFromRelayTime(data?.created_at || data?.createdAt),
    startedAt: toIsoFromRelayTime(data?.started_at || data?.startedAt),
    finishedAt: toIsoFromRelayTime(data?.finished_at || data?.finishedAt),
    error: data?.error ? String(data.error) : null,
    result: result
      ? {
          localPath: null,
          fileName: result?.fileName ? String(result.fileName) : null,
          size: Number(result?.size || 0) || 0,
          sha256: result?.sha256 ? String(result.sha256) : null,
          contentType: result?.contentType ? String(result.contentType) : 'application/octet-stream',
          elapsedMs: Number(result?.elapsedMs || 0) || 0,
          fileId: result?.fileId ? String(result.fileId) : null
        }
      : null
  }
}

const hasBmoCavityValue = (detail) => {
  const fields = Array.isArray(detail?.tech?.fields) ? detail.tech.fields : []
  for (const f of fields) {
    const label = String(f?.label || f?.name || '').trim()
    const value = String(f?.value ?? '').trim()
    if (!label) continue
    if (/模具(穴|腔)数|型腔数/.test(label) && value) return true
    if (String(f?.name || '').trim() === 'fd_col_pt6kmk' && value) return true
  }
  return false
}

let techSpecCacheTableReady = false
const ensureTechSpecCacheTable = async () => {
  if (techSpecCacheTableReady) return
  await query(`
    IF OBJECT_ID(N'dbo.bmo_tech_spec_parse_cache', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.bmo_tech_spec_parse_cache (
        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        bmo_record_id NVARCHAR(100) NOT NULL,
        attachment_id NVARCHAR(120) NOT NULL,
        file_name NVARCHAR(255) NULL,
        parsed_json NVARCHAR(MAX) NOT NULL,
        parsed_meta_json NVARCHAR(MAX) NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_bmo_tech_spec_parse_cache_created_at DEFAULT (SYSDATETIME()),
        updated_at DATETIME2 NOT NULL CONSTRAINT DF_bmo_tech_spec_parse_cache_updated_at DEFAULT (SYSDATETIME())
      );
      CREATE UNIQUE INDEX UX_bmo_tech_spec_parse_cache_key
        ON dbo.bmo_tech_spec_parse_cache (bmo_record_id, attachment_id);
      CREATE INDEX IX_bmo_tech_spec_parse_cache_updated
        ON dbo.bmo_tech_spec_parse_cache (updated_at DESC, id DESC);
    END
  `)
  techSpecCacheTableReady = true
}

const getTechSpecParseCache = async ({ fdId, attachmentId }) => {
  const bmoRecordId = String(fdId || '').trim()
  const attachId = String(attachmentId || '').trim()
  if (!bmoRecordId || !attachId) return null
  await ensureTechSpecCacheTable()
  const rows = await query(
    `
      SELECT TOP 1
        bmo_record_id,
        attachment_id,
        file_name,
        parsed_json,
        parsed_meta_json,
        updated_at
      FROM dbo.bmo_tech_spec_parse_cache
      WHERE bmo_record_id = @bmoRecordId
        AND attachment_id = @attachmentId
      ORDER BY updated_at DESC, id DESC;
    `,
    { bmoRecordId, attachmentId: attachId }
  )
  const row = rows?.[0]
  if (!row) return null
  let parsedData = null
  let parsedMeta = null
  try {
    parsedData = JSON.parse(row.parsed_json || '{}')
  } catch (e) {
    parsedData = null
  }
  try {
    parsedMeta = row.parsed_meta_json ? JSON.parse(row.parsed_meta_json) : null
  } catch (e) {
    parsedMeta = null
  }
  if (!parsedData || typeof parsedData !== 'object') return null
  return {
    fdId: row.bmo_record_id,
    attachmentId: row.attachment_id,
    fileName: row.file_name || null,
    parsedData,
    parsedMeta,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null
  }
}

const upsertTechSpecParseCache = async ({ fdId, attachmentId, fileName, parsedData, parsedMeta }) => {
  const bmoRecordId = String(fdId || '').trim()
  const attachId = String(attachmentId || '').trim()
  if (!bmoRecordId || !attachId || !parsedData || typeof parsedData !== 'object') {
    throw new Error('缺少必要参数（fdId/attachmentId/parsedData）')
  }
  await ensureTechSpecCacheTable()
  await query(
    `
      MERGE dbo.bmo_tech_spec_parse_cache AS target
      USING (
        SELECT
          @bmoRecordId AS bmo_record_id,
          @attachmentId AS attachment_id,
          @fileName AS file_name,
          @parsedJson AS parsed_json,
          @parsedMetaJson AS parsed_meta_json
      ) AS source
      ON target.bmo_record_id = source.bmo_record_id
       AND target.attachment_id = source.attachment_id
      WHEN MATCHED THEN
        UPDATE SET
          file_name = source.file_name,
          parsed_json = source.parsed_json,
          parsed_meta_json = source.parsed_meta_json,
          updated_at = SYSDATETIME()
      WHEN NOT MATCHED THEN
        INSERT (
          bmo_record_id, attachment_id, file_name, parsed_json, parsed_meta_json, created_at, updated_at
        )
        VALUES (
          source.bmo_record_id, source.attachment_id, source.file_name, source.parsed_json, source.parsed_meta_json, SYSDATETIME(), SYSDATETIME()
        );
    `,
    {
      bmoRecordId,
      attachmentId: attachId,
      fileName: String(fileName || '').trim() || null,
      parsedJson: JSON.stringify(parsedData),
      parsedMetaJson: parsedMeta ? JSON.stringify(parsedMeta) : null
    }
  )
}

const listLatestTechSpecParseCachesByRecordId = async (fdId, limit = 5) => {
  const bmoRecordId = String(fdId || '').trim()
  if (!bmoRecordId) return []
  await ensureTechSpecCacheTable()
  const safeLimit = Math.max(1, Math.min(20, Number(limit) || 5))
  const rows = await query(
    `
      SELECT TOP (${safeLimit})
        bmo_record_id,
        attachment_id,
        file_name,
        parsed_json,
        parsed_meta_json,
        updated_at
      FROM dbo.bmo_tech_spec_parse_cache
      WHERE bmo_record_id = @bmoRecordId
      ORDER BY updated_at DESC, id DESC;
    `,
    { bmoRecordId }
  )
  return (rows || [])
    .map((row) => {
      const parsedData = safeJsonParse(row.parsed_json)
      const parsedMeta = safeJsonParse(row.parsed_meta_json)
      if (!parsedData || typeof parsedData !== 'object') return null
      return {
        fdId: row.bmo_record_id,
        attachmentId: row.attachment_id,
        fileName: row.file_name || null,
        parsedData,
        parsedMeta,
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null
      }
    })
    .filter(Boolean)
}

const collectBmo14CavityCandidatesFromSnapshot = (snapshot) => {
  const fields = Array.isArray(snapshot?.tech?.fields) ? snapshot.tech.fields : []
  const primary = []
  const fallback = []
  for (const f of fields) {
    const label = normalizeCavityFieldKey(f?.label || f?.name)
    const name = normalizeCavityFieldKey(f?.name || f?.label)
    const value = normalizeCavityText(f?.value)
    if (!value) continue

    if (name === 'fd_col_o527xg' || label === '模具腔数') {
      primary.push({
        source: 'bmo14.field.模具腔数',
        value
      })
      continue
    }
    if (/模具(穴|腔)数|型腔数/.test(label)) {
      fallback.push({
        source: `bmo14.field.${label || 'other'}`,
        value
      })
    }
  }
  return primary.length ? primary : fallback
}

const collectTechSpecCavityCandidatesFromParsedCaches = (items) => {
  const list = Array.isArray(items) ? items : []
  const out = []
  for (const item of list) {
    const parsedData = item?.parsedData && typeof item.parsedData === 'object' ? item.parsedData : null
    if (!parsedData) continue
    const value = normalizeCavityText(parsedData.模具穴数 || parsedData.模具腔数 || '')
    if (!value) continue
    out.push({
      source: `techSpec.attachment.${String(item?.attachmentId || '').trim() || 'unknown'}`,
      value
    })
  }
  return out
}

const buildCavitySnapshot = ({ snapshot, parsedCaches }) => {
  const bmo14Candidates = collectBmo14CavityCandidatesFromSnapshot(snapshot)
  const techSpecCandidates = collectTechSpecCavityCandidatesFromParsedCaches(parsedCaches)
  const allCandidates = [...bmo14Candidates, ...techSpecCandidates]
  const picked = pickBestCavityCandidate(allCandidates)
  return {
    candidates: {
      bmo14: bmo14Candidates,
      techSpec: techSpecCandidates
    },
    final: picked
      ? {
          value: picked.parsed.expression || picked.value,
          counts: picked.parsed.counts,
          source: picked.source || null
        }
      : {
          value: '',
          counts: [],
          source: null
        },
    analyzedAt: new Date().toISOString()
  }
}

const refreshInitiationCavitySnapshot = async (fdId, options = {}) => {
  const bmoRecordId = String(fdId || '').trim()
  if (!bmoRecordId) return null

  const rows = await query(
    `SELECT TOP 1 * FROM dbo.bmo_initiation_requests WHERE bmo_record_id = @bmoRecordId`,
    { bmoRecordId }
  )
  const row = rows?.[0] || null
  const existingSnapshot =
    row?.tech_snapshot_json && typeof row.tech_snapshot_json === 'string'
      ? safeJsonParse(row.tech_snapshot_json)
      : null

  const baseSnapshot =
    options.baseSnapshot && typeof options.baseSnapshot === 'object'
      ? options.baseSnapshot
      : existingSnapshot && typeof existingSnapshot === 'object'
        ? existingSnapshot
        : null

  let snapshot =
    baseSnapshot && typeof baseSnapshot === 'object' ? { ...baseSnapshot } : { fdId: bmoRecordId, tech: null }
  if (!snapshot.fdId) snapshot.fdId = bmoRecordId

  if (!snapshot.tech || !Array.isArray(snapshot.tech?.fields)) {
    const detail = await getDetailCacheByRecordId(bmoRecordId)
    if (detail?.tech) {
      snapshot = {
        ...snapshot,
        demandType: snapshot.demandType ?? detail.demandType ?? null,
        designer: snapshot.designer ?? detail.designer ?? null,
        tech: {
          tableName: detail?.tech?.tableName || snapshot?.tech?.tableName || null,
          fields: Array.isArray(detail?.tech?.fields) ? detail.tech.fields : [],
          attachments: Array.isArray(detail?.tech?.attachments) ? detail.tech.attachments : []
        }
      }
    }
  }

  const parsedCaches = await listLatestTechSpecParseCachesByRecordId(bmoRecordId, 10)
  const cavitySnapshot = buildCavitySnapshot({ snapshot, parsedCaches })
  const mergedSnapshot = {
    ...(snapshot && typeof snapshot === 'object' ? snapshot : {}),
    cavitySnapshot
  }

  await upsertInitiationDraft({
    bmo_record_id: bmoRecordId,
    tech_snapshot: mergedSnapshot,
    actor: options.actor || null
  })
  return mergedSnapshot
}

const persistMouldListInBackground = (list, traceId) => {
  if (persistInFlight) return
  markPersistStart()
  persistInFlight = Promise.resolve()
    .then(async () => {
      const upserted = await upsertBmoRecords(list, traceId || null)
      markPersistSuccess(upserted)
    })
    .catch((e) => {
      console.error('BMO 自动入库失败:', e)
      markPersistError(e)
    })
    .finally(() => {
      persistInFlight = null
    })
}

router.get('/tech-spec/parsed-cache', async (req, res) => {
  try {
    const fdId = String(req.query.fdId || req.query.bmoRecordId || req.query.bmo_record_id || '').trim()
    const attachmentId = String(req.query.attachmentId || req.query.id || '').trim()
    if (!fdId || !attachmentId) {
      return res.status(400).json({ code: 400, success: false, message: '缺少 fdId 或 attachmentId' })
    }
    const cached = await getTechSpecParseCache({ fdId, attachmentId })
    return res.json({ code: 0, success: true, data: cached })
  } catch (error) {
    return res.status(500).json({
      code: 500,
      success: false,
      message: formatBmoSqlErrorMessage(error, '读取技术规格表解析缓存失败')
    })
  }
})

router.post('/tech-spec/parsed-cache', requireBmoSyncUpdate, async (req, res) => {
  try {
    const fdId = String(req.body?.fdId || req.body?.bmoRecordId || req.body?.bmo_record_id || '').trim()
    const attachmentId = String(req.body?.attachmentId || req.body?.id || '').trim()
    const fileName = String(req.body?.fileName || '').trim()
    const parsedData =
      req.body?.parsedData && typeof req.body.parsedData === 'object' ? req.body.parsedData : null
    const parsedMeta =
      req.body?.parsedMeta && typeof req.body.parsedMeta === 'object' ? req.body.parsedMeta : null
    await upsertTechSpecParseCache({ fdId, attachmentId, fileName, parsedData, parsedMeta })
    await refreshInitiationCavitySnapshot(fdId, { actor: resolveActorFromReq(req) || null })
    const cached = await getTechSpecParseCache({ fdId, attachmentId })
    return res.json({ code: 0, success: true, data: cached })
  } catch (error) {
    return res.status(500).json({
      code: 500,
      success: false,
      message: formatBmoSqlErrorMessage(error, '保存技术规格表解析缓存失败')
    })
  }
})

router.post('/initiation-request/cavity-snapshot/refresh', requireBmoSyncUpdate, async (req, res) => {
  try {
    const fdId = String(req.body?.fdId || req.body?.bmoRecordId || req.body?.bmo_record_id || '').trim()
    if (!fdId) {
      return res.status(400).json({ code: 400, success: false, message: '缺少 fdId' })
    }
    const snapshot = await refreshInitiationCavitySnapshot(fdId, {
      actor: resolveActorFromReq(req) || null
    })
    return res.json({ code: 0, success: true, data: snapshot })
  } catch (error) {
    return res.status(500).json({
      code: 500,
      success: false,
      message: formatBmoSqlErrorMessage(error, '刷新模具穴数快照失败')
    })
  }
})

const normalizeRelayJob = (data) => {
  const payload = data?.payload && typeof data.payload === 'object' ? data.payload : {}
  const result = data?.result && typeof data.result === 'object' ? data.result : null
  return {
    id: String(data?.id || '').trim(),
    type: String(data?.type || '').trim() || null,
    status: String(data?.status || '').trim() || 'queued',
    payload,
    createdAt: toIsoFromRelayTime(data?.created_at || data?.createdAt),
    startedAt: toIsoFromRelayTime(data?.started_at || data?.startedAt),
    finishedAt: toIsoFromRelayTime(data?.finished_at || data?.finishedAt),
    error: data?.error ? String(data.error) : null,
    result
  }
}

const parseQueryJsonObject = (raw) => {
  if (!raw) return null
  try {
    const parsed = JSON.parse(String(raw))
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch (e) {
    return null
  }
}

const markStaleRunningTasksFailed = async () => {
  try {
    await query(
      `
        UPDATE bmo_sync_task_logs
        SET
          status = 'failed',
          error_message = COALESCE(NULLIF(error_message, ''), '任务超时或服务重启导致中断'),
          finished_at = COALESCE(finished_at, GETDATE())
        WHERE status = 'running'
          AND started_at IS NOT NULL
          AND started_at < DATEADD(minute, -10, GETDATE());
      `
    )
  } catch (e) {
    // ignore
  }
}

const getProjectInfoByCustomerModelNo = async (customerModelNos) => {
  const list = Array.from(new Set((customerModelNos || []).map((x) => String(x || '').trim()).filter(Boolean)))
  if (!list.length) return new Map()

  const params = {}
  const placeholders = list.map((value, idx) => {
    const key = `m${idx}`
    params[key] = value
    return `@${key}`
  })

  const rows = await query(
    `
      SELECT
        客户模号 as customerModelNo,
        MAX(项目编号) as projectCode,
        MAX(项目状态) as projectStatus
      FROM 项目管理
      WHERE 客户模号 IN (${placeholders.join(', ')})
        AND (状态 IS NULL OR 状态 <> N'已删除')
      GROUP BY 客户模号;
    `,
    params
  )

  const map = new Map()
  for (const row of rows || []) {
    const k = String(row?.customerModelNo || '').trim()
    if (!k) continue
    map.set(k, {
      projectCode: row?.projectCode ? String(row.projectCode).trim() : null,
      projectStatus: row?.projectStatus ? String(row.projectStatus).trim() : null
    })
  }
  return map
}

const getInitiationStatusByBmoRecordId = async (bmoRecordIds) => {
  const list = Array.from(new Set((bmoRecordIds || []).map((x) => String(x || '').trim()).filter(Boolean)))
  if (!list.length) return new Map()

  const params = {}
  const placeholders = list.map((value, idx) => {
    const key = `r${idx}`
    params[key] = value
    return `@${key}`
  })

  try {
    const rows = await query(
      `
        SELECT bmo_record_id, status
        FROM dbo.bmo_initiation_requests
        WHERE bmo_record_id IN (${placeholders.join(', ')});
      `,
      params
    )
    const map = new Map()
    for (const row of rows || []) {
      const k = String(row?.bmo_record_id || '').trim()
      if (!k) continue
      map.set(k, row?.status ? String(row.status).trim() : null)
    }
    return map
  } catch (e) {
    // Keep list endpoints resilient even if migration is not applied yet.
    if (String(e?.message || '').includes("Invalid object name 'dbo.bmo_initiation_requests'")) {
      return new Map()
    }
    throw e
  }
}

const fetchMouldProcurementFromDb = async (limit) => {
  const safeLimit = toSafeLimit(limit, 50, 2000)
  try {
    const rows = await query(
      `
        SELECT TOP (${safeLimit})
          id,
          bmo_record_id,
          project_manager,
          part_no,
          part_name,
          model,
          mold_number,
          pm.project_code,
          pm.project_status,
          ir.initiation_status,
          bid_price_tax_incl,
          bid_time,
          bmo_mould_procurement.updated_at
        FROM bmo_mould_procurement
        OUTER APPLY (
          SELECT TOP 1 项目编号 as project_code, 项目状态 as project_status
          FROM 项目管理 p
          WHERE p.客户模号 = bmo_mould_procurement.mold_number
            AND (p.状态 IS NULL OR p.状态 <> N'已删除')
          ORDER BY 项目编号 DESC
        ) pm
        OUTER APPLY (
          SELECT TOP 1 status as initiation_status
          FROM dbo.bmo_initiation_requests r
          WHERE r.bmo_record_id = bmo_mould_procurement.bmo_record_id
        ) ir
        ORDER BY
          CASE WHEN source_create_time IS NULL THEN 1 ELSE 0 END,
          source_create_time DESC,
          id DESC;
      `
    )
    return rows
  } catch (e) {
    if (String(e?.message || '').includes("Invalid object name 'dbo.bmo_initiation_requests'")) {
      const rows = await query(
        `
          SELECT TOP (${safeLimit})
            id,
            bmo_record_id,
            project_manager,
            part_no,
            part_name,
            model,
            mold_number,
            pm.project_code,
            pm.project_status,
            bid_price_tax_incl,
            bid_time,
            bmo_mould_procurement.updated_at
          FROM bmo_mould_procurement
          OUTER APPLY (
            SELECT TOP 1 项目编号 as project_code, 项目状态 as project_status
            FROM 项目管理 p
            WHERE p.客户模号 = bmo_mould_procurement.mold_number
              AND (p.状态 IS NULL OR p.状态 <> N'已删除')
            ORDER BY 项目编号 DESC
          ) pm
          ORDER BY
            CASE WHEN source_create_time IS NULL THEN 1 ELSE 0 END,
            source_create_time DESC,
            id DESC;
        `
      )
      // Keep shape stable for frontend.
      return (rows || []).map((r) => ({ ...r, initiation_status: null }))
    }
    throw e
  }
}

const resolveLatestUpdatedAt = (rows) => {
  const value = rows?.[0]?.updated_at
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(
    date.getUTCHours()
  )}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`
}

const createTaskLog = async (requestJson, triggeredBy) => {
  const rows = await query(
    `
      INSERT INTO bmo_sync_task_logs(status, triggered_by, request_json, started_at, created_at)
      OUTPUT INSERTED.id
      VALUES (@status, @triggeredBy, @requestJson, GETDATE(), GETDATE());
    `,
    {
      status: 'running',
      triggeredBy: triggeredBy || 'api',
      requestJson: JSON.stringify(requestJson || {})
    }
  )
  return rows?.[0]?.id
}

const updateTaskLogSuccess = async (id, summary) => {
  if (!id) return
  await query(
    `
      UPDATE bmo_sync_task_logs
      SET
        status = @status,
        rows_fetched = @rowsFetched,
        rows_upserted = @rowsUpserted,
        response_json = @responseJson,
        finished_at = GETDATE()
      WHERE id = @id;
    `,
    {
      id,
      status: 'success',
      rowsFetched: toSafeInt(summary?.fetched, 0),
      rowsUpserted: toSafeInt(summary?.upserted, 0),
      responseJson: JSON.stringify(summary || {})
    }
  )
}

const updateTaskLogFailed = async (id, error) => {
  if (!id) return
  await query(
    `
      UPDATE bmo_sync_task_logs
      SET
        status = @status,
        error_message = @errorMessage,
        finished_at = GETDATE()
      WHERE id = @id;
    `,
    {
      id,
      status: 'failed',
      errorMessage: String(error?.message || error || 'unknown error')
    }
  )
}

const runSyncWithTask = async (requestBody, triggeredBy) => {
  let taskId = null
  const body = requestBody || {}
  taskId = await createTaskLog(body, triggeredBy || 'api')
  try {
    const summary = await syncBmoMouldData(body)
    await updateTaskLogSuccess(taskId, summary)
    return {
      taskId,
      ...summary
    }
  } catch (error) {
    await updateTaskLogFailed(taskId, error)
    throw error
  }
}

router.post('/sync', requireBmoSyncUpdate, async (req, res) => {
  try {
    if (isHubOnlyMode()) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: 'BMO_HUB_ONLY=1：craftsys 不再执行直连同步，请在 jiuhuan-hub 执行同步任务'
      })
    }
    await markStaleRunningTasksFailed()
    const data = await runSyncWithTask(req.body || {}, req.headers['x-username'] || 'api')
    return res.json({
      code: 0,
      success: true,
      data
    })
  } catch (error) {
    console.error('BMO 同步失败:', error)
    return res.status(500).json({
      code: 500,
      success: false,
      message: formatBmoSqlErrorMessage(error, 'BMO 同步失败')
    })
  }
})

router.post('/sync/retry/:taskId', requireBmoSyncUpdate, async (req, res) => {
  try {
    if (isHubOnlyMode()) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: 'BMO_HUB_ONLY=1：craftsys 不再执行直连同步重试，请在 jiuhuan-hub 重试任务'
      })
    }
    await markStaleRunningTasksFailed()
    const taskId = Number(req.params.taskId)
    if (!Number.isInteger(taskId) || taskId <= 0) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '任务ID无效'
      })
    }

    const rows = await query(
      `
        SELECT TOP 1 request_json
        FROM bmo_sync_task_logs
        WHERE id = @taskId
        ORDER BY id DESC;
      `,
      { taskId }
    )
    const raw = rows?.[0]?.request_json
    if (!raw) {
      return res.status(404).json({
        code: 404,
        success: false,
        message: '未找到可重试的任务参数'
      })
    }

    let requestBody = {}
    try {
      requestBody = JSON.parse(raw)
    } catch (e) {
      requestBody = {}
    }

    const data = await runSyncWithTask(
      requestBody,
      `${req.headers['x-username'] || 'api'}(retry:${taskId})`
    )
    return res.json({
      code: 0,
      success: true,
      data
    })
  } catch (error) {
    console.error('BMO 重试同步失败:', error)
    return res.status(500).json({
      code: 500,
      success: false,
      message: 'BMO 重试同步失败: ' + (error.message || '未知错误')
    })
  }
})

router.get('/latest', async (req, res) => {
  try {
    if (isHubOnlyMode()) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: 'BMO_HUB_ONLY=1：latest 已停用，请从 /api/bmo/mould-procurement 读取中转结果'
      })
    }
    const limit = toSafeLimit(req.query.limit, 50, 500)
    const rows = await query(
      `
        SELECT TOP (${limit})
          id,
          bmo_record_id,
          mold_number,
          part_no,
          part_name,
          mold_type,
          model,
          budget_wan_tax_incl,
          bid_price_tax_incl,
          supplier,
          project_manager,
          mold_engineer,
          designer,
          project_no,
          process_no,
          asset_no,
          progress_days,
          bid_time,
          project_end_time,
          source_updated_at,
          updated_at
        FROM bmo_mould_procurement
        ORDER BY updated_at DESC, id DESC;
      `
    )
    return res.json({
      code: 0,
      success: true,
      data: {
        list: rows,
        count: rows.length
      }
    })
  } catch (error) {
    console.error('读取 BMO 最新数据失败:', error)
    return res.status(500).json({
      code: 500,
      success: false,
      message: formatBmoSqlErrorMessage(error, '读取 BMO 最新数据失败')
    })
  }
})

router.get('/tasks', async (req, res) => {
  try {
    if (isHubOnlyMode()) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: 'BMO_HUB_ONLY=1：tasks 已停用，请使用 /api/bmo/relay/jobs 跟踪中转任务'
      })
    }
    const limit = toSafeLimit(req.query.limit, 20, 200)
    const rows = await query(
      `
        SELECT TOP (${limit})
          id,
          status,
          triggered_by,
          rows_fetched,
          rows_upserted,
          started_at,
          finished_at,
          created_at,
          error_message
        FROM bmo_sync_task_logs
        ORDER BY id DESC;
      `
    )
    return res.json({
      code: 0,
      success: true,
      data: {
        list: rows
      }
    })
  } catch (error) {
    console.error('读取 BMO 同步任务失败:', error)
    return res.status(500).json({
      code: 500,
      success: false,
      message: formatBmoSqlErrorMessage(error, '读取 BMO 同步任务失败')
    })
  }
})

router.get('/mould-procurement', async (req, res) => {
  try {
    const rows = await fetchMouldProcurementFromDb(req.query.limit)
    return res.json({
      code: 0,
      success: true,
      data: {
        list: rows,
        count: rows.length,
        latestUpdatedAt: resolveLatestUpdatedAt(rows)
      }
    })
  } catch (error) {
    console.error('读取 BMO 模具采购数据失败:', error)
    return res.status(500).json({
      code: 500,
      success: false,
      message: formatBmoSqlErrorMessage(error, '读取 BMO 模具采购数据失败')
    })
  }
})

router.get('/mould-procurement/pending-count', async (req, res) => {
  try {
    const rows = await query(
      `
        SELECT COUNT(1) AS pendingCount
        FROM bmo_mould_procurement mp
        OUTER APPLY (
          SELECT TOP 1 项目编号 as project_code
          FROM 项目管理 p
          WHERE p.客户模号 = mp.mold_number
            AND (p.状态 IS NULL OR p.状态 <> N'已删除')
          ORDER BY 项目编号 DESC
        ) pm
        WHERE pm.project_code IS NULL;
      `
    )
    const pendingCount = Number(rows?.[0]?.pendingCount || 0) || 0
    return res.json({
      code: 0,
      success: true,
      data: { pendingCount }
    })
  } catch (error) {
    console.error('读取 BMO 待立项数量失败:', error)
    return res.status(500).json({
      code: 500,
      success: false,
      message: formatBmoSqlErrorMessage(error, '读取 BMO 待立项数量失败')
    })
  }
})

router.get('/initiation-review/pending-count', async (req, res) => {
  try {
    try {
      await assertInitiationReviewerPermission(req)
    } catch (e) {
      if (Number(e?.statusCode || 0) === 403) {
        return res.json({ code: 0, success: true, data: { pendingCount: 0 } })
      }
      throw e
    }
    const rows = await query(
      `
        SELECT COUNT(1) AS pendingCount
        FROM dbo.bmo_initiation_requests
        WHERE status = N'PM_CONFIRMED';
      `
    )
    const pendingCount = Number(rows?.[0]?.pendingCount || 0) || 0
    return res.json({
      code: 0,
      success: true,
      data: { pendingCount }
    })
  } catch (error) {
    console.error('读取立项待审核数量失败:', error)
    return res.status(500).json({
      code: 500,
      success: false,
      message: formatBmoSqlErrorMessage(error, '读取立项待审核数量失败')
    })
  }
})

router.get('/mould-procurement/by-project', async (req, res) => {
  try {
    const projectCode = String(req.query.projectCode || '').trim()
    if (!projectCode) {
      return res.status(400).json({ code: 400, success: false, message: '缺少 projectCode' })
    }

    const rows = await query(
      `
        SELECT TOP 1
          mp.id,
          mp.bmo_record_id,
          mp.project_manager,
          mp.part_no,
          mp.part_name,
          mp.model,
          mp.mold_number,
          p.项目编号 as project_code,
          p.项目状态 as project_status,
          mp.bid_price_tax_incl,
          mp.bid_time
        FROM bmo_mould_procurement mp
        INNER JOIN 项目管理 p
          ON p.客户模号 = mp.mold_number
        WHERE p.项目编号 = @projectCode
          AND (p.状态 IS NULL OR p.状态 <> N'已删除')
        ORDER BY
          CASE WHEN mp.source_create_time IS NULL THEN 1 ELSE 0 END,
          mp.source_create_time DESC,
          mp.id DESC;
      `,
      { projectCode }
    )

    return res.json({
      code: 0,
      success: true,
      data: rows?.[0] || null
    })
  } catch (error) {
    console.error('按项目读取 BMO 模具采购记录失败:', error)
    return res.status(500).json({
      code: 500,
      success: false,
      message: formatBmoSqlErrorMessage(error, '按项目读取 BMO 模具采购记录失败')
    })
  }
})

// Open page → try live within 3s → return latest data, and auto-persist in background.
router.get('/mould-procurement/refresh', requireBmoSyncUpdate, async (req, res) => {
  const relayEnabled = isRelayEnabled()
  const maxWaitMs = toSafeInt(req.query.maxWaitMs, 3000)
  const pageSize = toSafeLimit(req.query.pageSize ?? req.query.limit, 200, 200)
  const offset = toSafeInt(req.query.offset, 0)
  const conditions = parseQueryJsonObject(req.query.conditions)
  const sorts = parseQueryJsonObject(req.query.sorts)
  let relayErrorMessage = ''
  let relaySuccess = false

  if (!relayEnabled && isHubOnlyMode()) {
    try {
      const rows = await fetchMouldProcurementFromDb(pageSize)
      return res.json({
        code: 0,
        success: true,
        data: {
          source: 'db',
          connection: {
            state: 'error',
            message: 'BMO_HUB_ONLY=1 且未配置 BMO_RELAY_BASE_URL，已返回库内数据'
          },
          list: rows,
          count: rows.length,
          latestUpdatedAt: resolveLatestUpdatedAt(rows)
        }
      })
    } catch (dbError) {
      return res.status(500).json({
        code: 500,
        success: false,
        message: formatBmoSqlErrorMessage(dbError, '读取 BMO 模具采购数据失败')
      })
    }
  }

  if (relayEnabled) {
    try {
      const created = await relayRequestJson('/jobs', {
        method: 'POST',
        timeoutMs: 15000,
        body: {
          type: 'collect',
          payload: {
            pageSize,
            offset,
            ...(conditions ? { conditions } : {}),
            ...(sorts ? { sorts } : {})
          }
        }
      })
      const jobId = String(created?.data?.id || created?.id || '').trim()
      if (jobId) {
        const finished = await relayWaitJob(jobId, {
          timeoutMs: Math.max(3000, maxWaitMs),
          intervalMs: 1000
        })
        if (String(finished?.status || '') === 'success') {
          relaySuccess = true
          const result = finished?.result && typeof finished.result === 'object' ? finished.result : null
          const list = Array.isArray(result?.list) ? result.list : []
          const projectInfoMap = await getProjectInfoByCustomerModelNo(
            list.map((x) => x.moldNumber || x.mold_number).filter(Boolean)
          )
          const initiationStatusMap = await getInitiationStatusByBmoRecordId(
            list.map((x) => x.bmoRecordId || x.bmo_record_id).filter(Boolean)
          )
          const viewList = list.map((row, idx) => {
            const moldNumber = row.moldNumber || row.mold_number || null
            const bmoRecordId = row.bmoRecordId || row.bmo_record_id || null
            const bidTime = row.bidTime || row.bid_time || null
            return {
              seq: offset + idx + 1,
              bmo_record_id: bmoRecordId,
              project_manager: row.projectManager || row.project_manager || null,
              part_no: row.partNo || row.part_no || null,
              part_name: row.partName || row.part_name || null,
              model: row.model || null,
              mold_number: moldNumber,
              project_code:
                projectInfoMap.get(String(moldNumber || '').trim())?.projectCode ||
                row.project_code ||
                null,
              project_status:
                projectInfoMap.get(String(moldNumber || '').trim())?.projectStatus ||
                row.project_status ||
                null,
              initiation_status:
                initiationStatusMap.get(String(bmoRecordId || '').trim()) ||
                row.initiation_status ||
                null,
              bid_price_tax_incl: row.bidPriceTaxIncl ?? row.bid_price_tax_incl ?? null,
              bid_time: bidTime ? new Date(bidTime).toISOString() : null
            }
          })

          persistMouldListInBackground(list, result?.traceId || null)

          return res.json({
            code: 0,
            success: true,
            data: {
              source: 'live',
              connection: { state: 'connected' },
              list: viewList,
              count: viewList.length,
              offset: toSafeInt(result?.offset, offset),
              pageSize: toSafeInt(result?.pageSize, pageSize),
              totalSize: Number(result?.total ?? result?.totalSize ?? viewList.length),
              traceId: null,
              fetchedAt: new Date().toISOString()
            }
          })
        }
        if (String(finished?.status || '') === 'failed') {
          relayErrorMessage = String(finished?.error || '中转任务执行失败').slice(0, 300)
        }
      }
    } catch (relayError) {
      relayErrorMessage = String(relayError?.message || relayError || '').slice(0, 300)
      console.warn('[bmo-relay-refresh-fallback]', relayError?.message || relayError)
    }
  }

  if (relayEnabled && (relayErrorMessage || !relaySuccess)) {
    try {
      const rows = await fetchMouldProcurementFromDb(pageSize)
      return res.json({
        code: 0,
        success: true,
        data: {
          source: 'db',
          connection: {
            state: 'error',
            message: relayErrorMessage
              ? `BMO 中转服务异常: ${relayErrorMessage}`
              : 'BMO 中转未返回实时数据，已回退库内数据'
          },
          list: rows,
          count: rows.length,
          latestUpdatedAt: resolveLatestUpdatedAt(rows)
        }
      })
    } catch (dbError) {
      console.error('读取 BMO 模具采购数据失败:', dbError)
      return res.status(500).json({
        code: 500,
        success: false,
        message: formatBmoSqlErrorMessage(dbError, '读取 BMO 模具采购数据失败')
      })
    }
  }

  try {
    const liveResult = await fetchBmoMouldListLive({
      pageSize,
      offset,
      timeoutMs: maxWaitMs,
      disableAuthRetry: true,
      ...(conditions ? { conditions } : {}),
      ...(sorts ? { sorts } : {})
    })
    markLiveOk()

    const list = Array.isArray(liveResult?.list) ? liveResult.list : []
    const projectInfoMap = await getProjectInfoByCustomerModelNo(
      list.map((x) => x.moldNumber).filter(Boolean)
    )
    const initiationStatusMap = await getInitiationStatusByBmoRecordId(
      list.map((x) => x.bmoRecordId).filter(Boolean)
    )
    const viewList = list.map((row, idx) => ({
      seq: offset + idx + 1,
      bmo_record_id: row.bmoRecordId || null,
      project_manager: row.projectManager || null,
      part_no: row.partNo || null,
      part_name: row.partName || null,
      model: row.model || null,
      mold_number: row.moldNumber || null,
      project_code: projectInfoMap.get(String(row.moldNumber || '').trim())?.projectCode || null,
      project_status: projectInfoMap.get(String(row.moldNumber || '').trim())?.projectStatus || null,
      initiation_status: initiationStatusMap.get(String(row.bmoRecordId || '').trim()) || null,
      bid_price_tax_incl: row.bidPriceTaxIncl ?? null,
      bid_time: row.bidTime ? new Date(row.bidTime).toISOString() : null
    }))

    // Persist in background (do not block UI).
    persistMouldListInBackground(list, liveResult?.traceId || null)

    return res.json({
      code: 0,
      success: true,
      data: {
        source: 'live',
        connection: { state: 'connected' },
        list: viewList,
        count: viewList.length,
        offset: liveResult.offset,
        pageSize: liveResult.pageSize,
        totalSize: liveResult.totalSize,
        traceId: liveResult.traceId,
        fetchedAt: liveResult.fetchedAt
      }
    })
  } catch (error) {
    markLiveError(error)
    const message = String(error?.message || error || '')
    const state =
      message.includes('未配置 BMO 认证信息') || message.includes('401') ? 'expired' : 'error'

    try {
      const rows = await fetchMouldProcurementFromDb(pageSize)
      return res.json({
        code: 0,
        success: true,
        data: {
          source: 'db',
          connection: { state, message: message || 'live failed' },
          list: rows,
          count: rows.length,
          latestUpdatedAt: resolveLatestUpdatedAt(rows)
        }
      })
    } catch (dbError) {
      console.error('读取 BMO 模具采购数据失败:', dbError)
      return res.status(500).json({
        code: 500,
        success: false,
        message: formatBmoSqlErrorMessage(dbError, '读取 BMO 模具采购数据失败')
      })
    }
  }
})

router.get('/mould-procurement/detail', async (req, res) => {
  try {
    const fdId = String(req.query.fdId || req.query.bmoRecordId || req.query.bmo_record_id || '').trim()
    const forceLive = String(req.query.forceLive || '').trim() === '1'
    if (!fdId) {
      return res.status(400).json({ code: 400, success: false, message: '缺少 fdId' })
    }
    if (isHubOnlyMode() && !isRelayEnabled()) {
      return res.status(500).json({
        code: 500,
        success: false,
        message: 'BMO_HUB_ONLY=1 但未配置 BMO_RELAY_BASE_URL，无法读取 1.4 详情'
      })
    }

    if (!forceLive) {
      const cached = await getDetailCacheByRecordId(fdId)
      if (cached) {
        if (hasBmoCavityValue(cached)) {
          return res.json({ code: 0, success: true, data: cached, source: 'db' })
        }
        // 缓存缺少模具腔数时，尝试实时回填一次；失败再回退旧缓存。
        try {
          const liveDetail = await fetchBmoMouldDetail({ fdId })
          upsertDetailCache(liveDetail).catch((e) => {
            console.warn('更新 BMO 模具详情缓存失败:', e?.message || e)
          })
          return res.json({
            code: 0,
            success: true,
            data: liveDetail,
            source: 'live',
            warning: '缓存缺少模具腔数，已自动实时回填'
          })
        } catch (liveErr) {
          return res.json({
            code: 0,
            success: true,
            data: cached,
            source: 'db',
            warning: '缓存缺少模具腔数且实时回填失败，已回退缓存数据'
          })
        }
      }
    }

    const detail = await fetchBmoMouldDetail({ fdId })
    upsertDetailCache(detail).catch((e) => {
      console.warn('更新 BMO 模具详情缓存失败:', e?.message || e)
    })
    return res.json({ code: 0, success: true, data: detail })
  } catch (error) {
    try {
      const fdId = String(
        req.query.fdId || req.query.bmoRecordId || req.query.bmo_record_id || ''
      ).trim()
      if (fdId) {
        const cached = await getDetailCacheByRecordId(fdId)
        if (cached) {
          return res.json({
            code: 0,
            success: true,
            data: cached,
            source: 'db',
            warning: '实时读取失败，已回退缓存数据'
          })
        }
      }
    } catch (cacheErr) {
      console.warn('读取 BMO 模具详情缓存失败:', cacheErr?.message || cacheErr)
    }
    console.error('读取 BMO 模具清单详情失败:', error)
    return res.status(500).json({
      code: 500,
      success: false,
      message: formatBmoSqlErrorMessage(error, '读取 BMO 模具清单详情失败')
    })
  }
})

router.post('/auto-sync/run', requireBmoSyncUpdate, async (req, res) => {
  try {
    if (isHubOnlyMode()) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: 'BMO_HUB_ONLY=1：自动采集/下载/解析/入库由 jiuhuan-hub 负责'
      })
    }
    const result = await runBmoAutoSyncOnce({
      pageSize: req.body?.pageSize,
      maxPages: req.body?.maxPages,
      detailLimit: req.body?.detailLimit,
      downloadPerRecord: req.body?.downloadPerRecord
    })
    return res.json({ code: 0, success: true, data: result })
  } catch (error) {
    return res.status(500).json({
      code: 500,
      success: false,
      message: '执行 BMO 自动同步失败: ' + (error?.message || '未知错误')
    })
  }
})

router.post('/download-jobs', requireBmoSyncUpdate, async (req, res) => {
  try {
    const attachmentId = String(
      req.body?.attachmentId || req.body?.id || req.query.attachmentId || req.query.id || ''
    ).trim()
    const fdId = String(req.body?.fdId || req.query.fdId || '').trim()
    const fileName = String(req.body?.fileName || req.query.fileName || '').trim()
    const viewUrl = String(req.body?.viewUrl || req.query.viewUrl || '').trim()
    const requestId = String(req.headers['x-request-id'] || req.body?.requestId || '').trim()
    if (!attachmentId) {
      return res.status(400).json({ code: 400, success: false, message: '缺少 attachmentId' })
    }

    if (isRelayEnabled()) {
      const relayCreated = await relayRequestJson('/jobs', {
        method: 'POST',
        timeoutMs: 15000,
        body: {
          type: 'download_attachment',
          payload: {
            attachmentId,
            fdId,
            fileName
          }
        }
      })
      const normalized = normalizeRelayDownloadJob(relayCreated?.data || relayCreated)
      if (!normalized.id) throw new Error('relay 创建任务失败（缺少 jobId）')
      return res.json({ code: 0, success: true, data: normalized })
    }

    const job = await createDownloadJob({
      requestId,
      attachmentId,
      fdId,
      fileName,
      viewUrl
    })
    return res.json({ code: 0, success: true, data: job })
  } catch (error) {
    return res.status(500).json({
      code: 500,
      success: false,
      message: '创建 BMO 下载任务失败: ' + (error?.message || '未知错误')
    })
  }
})

router.get('/download-jobs/:jobId', (req, res) => {
  const jobId = String(req.params.jobId || '').trim()
  if (!jobId) return res.status(400).json({ code: 400, success: false, message: '缺少 jobId' })
  if (isRelayEnabled()) {
    relayRequestJson(`/jobs/${encodeURIComponent(jobId)}`, { method: 'GET', timeoutMs: 15000 })
      .then((relayStatus) => {
        const normalized = normalizeRelayDownloadJob(relayStatus?.data || relayStatus)
        if (!normalized.id) {
          return res
            .status(404)
            .json({ code: 404, success: false, message: '任务不存在或已过期' })
        }
        return res.json({ code: 0, success: true, data: normalized })
      })
      .catch((e) => {
        const msg = String(e?.message || e || '')
        const notFound = msg.includes('not found') || msg.includes('不存在')
        return res
          .status(notFound ? 404 : 500)
          .json({ code: notFound ? 404 : 500, success: false, message: msg || '读取任务失败' })
      })
    return
  }
  const job = getDownloadJob(jobId)
  if (!job) return res.status(404).json({ code: 404, success: false, message: '任务不存在或已过期' })
  return res.json({ code: 0, success: true, data: job })
})

router.get('/download-jobs/:jobId/file', async (req, res) => {
  const jobId = String(req.params.jobId || '').trim()
  if (!jobId) return res.status(400).json({ code: 400, success: false, message: '缺少 jobId' })
  if (isRelayEnabled()) {
    try {
      const relayStatus = await relayRequestJson(`/jobs/${encodeURIComponent(jobId)}`, {
        method: 'GET',
        timeoutMs: 15000
      })
      const normalized = normalizeRelayDownloadJob(relayStatus?.data || relayStatus)
      const fileId = String(normalized?.result?.fileId || '').trim()
      if (!fileId) {
        return res.status(404).json({ code: 404, success: false, message: '任务文件不存在，请重新下载' })
      }
      const relayBase = getRelayBaseUrl()
      const upstream = await fetch(`${relayBase}/files/${encodeURIComponent(fileId)}`)
      if (!upstream.ok) {
        return res
          .status(upstream.status || 500)
          .json({ code: upstream.status || 500, success: false, message: 'relay 文件下载失败' })
      }
      const contentType = upstream.headers.get('content-type') || 'application/octet-stream'
      const disposition = upstream.headers.get('content-disposition')
      res.setHeader('Content-Type', contentType)
      if (disposition) res.setHeader('Content-Disposition', disposition)
      const buf = Buffer.from(await upstream.arrayBuffer())
      return res.send(buf)
    } catch (e) {
      return res.status(500).json({
        code: 500,
        success: false,
        message: '读取 relay 任务文件失败: ' + (e?.message || '未知错误')
      })
    }
  }
  const file = getDownloadJobFile(jobId)
  if (!file) {
    return res.status(404).json({ code: 404, success: false, message: '任务文件不存在，请重新下载' })
  }

  const safeName = String(file.fileName || 'attachment.bin').replace(/"/g, '')
  res.setHeader('Content-Type', file.contentType || 'application/octet-stream')
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(safeName)}`)
  return fs.createReadStream(file.localPath).pipe(res)
})

router.post('/relay/jobs', requireBmoRelayCreate, async (req, res) => {
  try {
    if (!isRelayEnabled()) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '未启用 BMO_RELAY_BASE_URL'
      })
    }
    const type = String(req.body?.type || '').trim()
    const payload = req.body?.payload && typeof req.body.payload === 'object' ? req.body.payload : {}
    if (!type) {
      return res.status(400).json({ code: 400, success: false, message: '缺少 type' })
    }
    const relayCreated = await relayRequestJson('/jobs', {
      method: 'POST',
      timeoutMs: 15000,
      body: { type, payload }
    })
    const normalized = normalizeRelayJob(relayCreated?.data || relayCreated)
    if (!normalized.id) throw new Error('relay 创建任务失败（缺少 jobId）')
    return res.json({ code: 0, success: true, data: normalized })
  } catch (error) {
    return res.status(500).json({
      code: 500,
      success: false,
      message: '创建 relay 任务失败: ' + (error?.message || '未知错误')
    })
  }
})

router.get('/relay/jobs/:jobId', async (req, res) => {
  try {
    if (!isRelayEnabled()) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '未启用 BMO_RELAY_BASE_URL'
      })
    }
    const jobId = String(req.params.jobId || '').trim()
    if (!jobId) return res.status(400).json({ code: 400, success: false, message: '缺少 jobId' })
    const relayStatus = await relayRequestJson(`/jobs/${encodeURIComponent(jobId)}`, {
      method: 'GET',
      timeoutMs: 15000
    })
    const normalized = normalizeRelayJob(relayStatus?.data || relayStatus)
    if (!normalized.id) {
      return res.status(404).json({ code: 404, success: false, message: '任务不存在或已过期' })
    }
    return res.json({ code: 0, success: true, data: normalized })
  } catch (e) {
    const msg = String(e?.message || e || '')
    const notFound = msg.includes('not found') || msg.includes('不存在')
    return res
      .status(notFound ? 404 : 500)
      .json({ code: notFound ? 404 : 500, success: false, message: msg || '读取任务失败' })
  }
})

router.get('/relay/sync-status', async (req, res) => {
  try {
    if (!isRelayEnabled()) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '未启用 BMO_RELAY_BASE_URL'
      })
    }
    const raw = await relayRequestJson('/sync/status', {
      method: 'GET',
      timeoutMs: 15000
    })
    return res.json({ code: 0, success: true, data: raw?.data || raw || null })
  } catch (error) {
    return res.status(500).json({
      code: 500,
      success: false,
      message: '读取 relay 同步状态失败: ' + (error?.message || '未知错误')
    })
  }
})

router.post('/relay/sync/run', requireBmoRelayUpdate, async (req, res) => {
  try {
    if (!isRelayEnabled()) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '未启用 BMO_RELAY_BASE_URL'
      })
    }
    const raw = await relayRequestJson('/sync/run', {
      method: 'POST',
      timeoutMs: 20000,
      body: req.body || {}
    })
    return res.json({ code: 0, success: true, data: raw?.data || raw || null })
  } catch (error) {
    return res.status(500).json({
      code: 500,
      success: false,
      message: '触发 relay 同步失败: ' + (error?.message || '未知错误')
    })
  }
})

router.post('/relay/persist-mould', requireBmoRelayUpdate, async (req, res) => {
  const requestBody = req.body && typeof req.body === 'object' ? req.body : {}
  const list = Array.isArray(requestBody.list) ? requestBody.list : []
  const traceId = String(requestBody.traceId || '').trim() || null
  const source = String(requestBody.source || 'relay').trim() || 'relay'
  const fetched = toSafeInt(requestBody.fetched, list.length)
  let taskId = null

  try {
    taskId = await createTaskLog(
      {
        source,
        traceId,
        fetched,
        total: toSafeInt(requestBody.total, fetched),
        fetchedAt: requestBody.fetchedAt || null
      },
      `${req.headers['x-username'] || 'relay-sync'}:${source}`
    )
    const upserted = await upsertBmoRecords(list, traceId)
    const summary = {
      source,
      fetched,
      upserted,
      total: toSafeInt(requestBody.total, fetched),
      traceId,
      fetchedAt: requestBody.fetchedAt || null,
      persistedAt: new Date().toISOString()
    }
    await updateTaskLogSuccess(taskId, summary)
    return res.json({ code: 0, success: true, data: summary })
  } catch (error) {
    await updateTaskLogFailed(taskId, error)
    return res.status(500).json({
      code: 500,
      success: false,
      message: 'relay BMO 入库失败: ' + (error?.message || '未知错误')
    })
  }
})

router.post('/relay/jobs/:jobId/retry', requireBmoRelayUpdate, async (req, res) => {
  try {
    if (!isRelayEnabled()) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '未启用 BMO_RELAY_BASE_URL'
      })
    }
    const jobId = String(req.params.jobId || '').trim()
    if (!jobId) return res.status(400).json({ code: 400, success: false, message: '缺少 jobId' })
    const relayRetried = await relayRequestJson(`/jobs/${encodeURIComponent(jobId)}/retry`, {
      method: 'POST',
      timeoutMs: 15000
    })
    return res.json({ code: 0, success: true, data: relayRetried?.data || relayRetried || null })
  } catch (error) {
    return res.status(500).json({
      code: 500,
      success: false,
      message: '重试 relay 任务失败: ' + (error?.message || '未知错误')
    })
  }
})

router.get('/relay/auth/status', async (req, res) => {
  try {
    if (!isRelayEnabled()) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '未启用 BMO_RELAY_BASE_URL'
      })
    }
    const probe = String(req.query.probe || '').trim() === '1' ? '1' : '0'
    const data = await relayRequestJson(`/auth/status?probe=${probe}`, {
      method: 'GET',
      timeoutMs: 20000
    })
    return res.json({ code: 0, success: true, data: data?.data || data || null })
  } catch (error) {
    return res.status(500).json({
      code: 500,
      success: false,
      message: '读取 relay 会话状态失败: ' + (error?.message || '未知错误')
    })
  }
})

router.post('/relay/auth/login', requireBmoRelayUpdate, async (req, res) => {
  try {
    if (!isRelayEnabled()) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '未启用 BMO_RELAY_BASE_URL'
      })
    }
    const body = req.body && typeof req.body === 'object' ? req.body : {}
    const data = await relayRequestJson('/auth/login', {
      method: 'POST',
      timeoutMs: 30000,
      body
    })
    return res.json({ code: 0, success: true, data: data?.data || data || null })
  } catch (error) {
    return res.status(500).json({
      code: 500,
      success: false,
      message: 'relay 手动登录失败: ' + (error?.message || '未知错误')
    })
  }
})

router.post('/relay/auth/logout', requireBmoRelayUpdate, async (req, res) => {
  try {
    if (!isRelayEnabled()) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '未启用 BMO_RELAY_BASE_URL'
      })
    }
    const data = await relayRequestJson('/auth/logout', {
      method: 'POST',
      timeoutMs: 15000,
      body: {}
    })
    return res.json({ code: 0, success: true, data: data?.data || data || null })
  } catch (error) {
    return res.status(500).json({
      code: 500,
      success: false,
      message: 'relay 断开会话失败: ' + (error?.message || '未知错误')
    })
  }
})

router.post('/relay/auth/set', requireBmoRelayUpdate, async (req, res) => {
  try {
    if (!isRelayEnabled()) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '未启用 BMO_RELAY_BASE_URL'
      })
    }
    const body = req.body && typeof req.body === 'object' ? req.body : {}
    const data = await relayRequestJson('/auth/set', {
      method: 'POST',
      timeoutMs: 15000,
      body
    })
    return res.json({ code: 0, success: true, data: data?.data || data || null })
  } catch (error) {
    return res.status(500).json({
      code: 500,
      success: false,
      message: 'relay 写入会话失败: ' + (error?.message || '未知错误')
    })
  }
})

router.get('/relay/files/:fileId', async (req, res) => {
  try {
    if (!isRelayEnabled()) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '未启用 BMO_RELAY_BASE_URL'
      })
    }
    const fileId = String(req.params.fileId || '').trim()
    if (!fileId) return res.status(400).json({ code: 400, success: false, message: '缺少 fileId' })
    const relayBase = getRelayBaseUrl()
    const upstream = await fetch(`${relayBase}/files/${encodeURIComponent(fileId)}`)
    if (!upstream.ok) {
      return res
        .status(upstream.status || 500)
        .json({ code: upstream.status || 500, success: false, message: 'relay 文件下载失败' })
    }
    const contentType = upstream.headers.get('content-type') || 'application/octet-stream'
    const disposition = upstream.headers.get('content-disposition')
    res.setHeader('Content-Type', contentType)
    if (disposition) res.setHeader('Content-Disposition', disposition)
    const buf = Buffer.from(await upstream.arrayBuffer())
    return res.send(buf)
  } catch (error) {
    return res.status(500).json({
      code: 500,
      success: false,
      message: '读取 relay 文件失败: ' + (error?.message || '未知错误')
    })
  }
})

router.get('/attachment/download/:attachmentId', async (req, res) => {
  try {
    const attachmentId = String(req.params.attachmentId || '').trim()
    const fdId = String(
      req.query.fdId || req.query.bmo_record_id || req.query.bmoRecordId || ''
    ).trim()
    const fileName = String(req.query.fileName || '').trim()
    if (!attachmentId) {
      return res.status(400).json({ code: 400, success: false, message: '缺少 attachmentId' })
    }
    if (isHubOnlyMode() && !isRelayEnabled()) {
      return res.status(500).json({
        code: 500,
        success: false,
        message: 'BMO_HUB_ONLY=1 但未配置 BMO_RELAY_BASE_URL，无法下载附件'
      })
    }

    // Relay mode: use a single authoritative download path via relay worker.
    if (isRelayEnabled()) {
      if (!fdId) {
        return res
          .status(400)
          .json({ code: 400, success: false, message: '缺少 fdId，无法通过中转下载附件' })
      }

      try {
        const created = await relayRequestJson('/jobs', {
          method: 'POST',
          timeoutMs: 15000,
          body: {
            type: 'download_attachment',
            payload: {
              fdId,
              attachmentId,
              ...(fileName ? { fileName } : {})
            }
          }
        })
        const jobId = String(created?.data?.id || created?.id || '').trim()
        if (!jobId) throw new Error('中转任务创建失败（缺少 jobId）')

        const finished = await relayWaitJob(jobId, {
          timeoutMs: 120000,
          intervalMs: 1000
        })
        if (String(finished?.status || '') !== 'success') {
          const reason = String(finished?.error || '中转任务执行失败').trim()
          return res.status(403).json({
            code: 403,
            success: false,
            message: `BMO 下载失败: ${reason || '当前服务会话无权读取附件'}`
          })
        }

        const fileId = String(finished?.result?.fileId || '').trim()
        if (!fileId) throw new Error('中转任务成功但未返回 fileId')

        const relayBase = getRelayBaseUrl()
        const upstream = await fetch(`${relayBase}/files/${encodeURIComponent(fileId)}`)
        if (!upstream.ok) {
          throw new Error(`中转文件下载失败 HTTP ${upstream.status}`)
        }

        const contentType = upstream.headers.get('content-type') || 'application/octet-stream'
        res.setHeader('Content-Type', contentType)
        if (fileName) {
          res.setHeader(
            'Content-Disposition',
            `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`
          )
        } else {
          const disposition = upstream.headers.get('content-disposition')
          if (disposition) res.setHeader('Content-Disposition', disposition)
        }
        const buf = Buffer.from(await upstream.arrayBuffer())
        return res.send(buf)
      } catch (relayErr) {
        const msg = String(relayErr?.message || relayErr || '未知错误').slice(0, 220)
        return res.status(403).json({
          code: 403,
          success: false,
          message: `BMO 下载失败: ${msg}`
        })
      }
    }

    let attempts = []
    if (fdId) {
      try {
        const requestId = String(req.headers['x-request-id'] || '').trim()
        const job = await createDownloadJob({
          requestId,
          attachmentId,
          fdId,
          fileName
        })
        const finished = await waitForDownloadJob(job.id, { timeoutMs: 120000 })
        if (finished.status === 'success') {
          const file = getDownloadJobFile(job.id)
          if (file) {
            const finalName = String(fileName || file.fileName || 'attachment.bin').replace(/"/g, '')
            res.setHeader('Content-Type', file.contentType || 'application/octet-stream')
            res.setHeader(
              'Content-Disposition',
              `attachment; filename*=UTF-8''${encodeURIComponent(finalName)}`
            )
            res.on('finish', () => {
              fs.unlink(file.localPath, () => {})
            })
            return fs.createReadStream(file.localPath).pipe(res)
          }
          attempts.push(`worker/${attachmentId} => success-but-no-file`)
        } else {
          attempts.push(`worker/${attachmentId} => ${String(finished.error || 'failed').slice(0, 200)}`)
        }
      } catch (e) {
        attempts.push(`worker/${attachmentId} => ${String(e?.message || e).slice(0, 200)}`)
      }
    }

    let download = await downloadBmoAttachment(attachmentId)
    let upstream = download.response
    attempts.push(...(Array.isArray(download.attempts) ? download.attempts : []))
    let primaryStatus = Number(download.primaryStatus || upstream?.status || 0)
    if (
      !upstream.ok &&
      (upstream.status === 401 ||
        upstream.status === 403 ||
        upstream.status === 500 ||
        primaryStatus === 401 ||
        primaryStatus === 403 ||
        primaryStatus === 500)
    ) {
      try {
        await runBmoSessionKeeperOnce({
          timeoutMs: 90000,
          env: {
            BMO_KEEPER_LOGIN_MODE: 'chromium',
            BMO_KEEPER_HEADLESS: 'true',
            BMO_KEEPER_USER_DATA_DIR: path.join(
              os.tmpdir(),
              `bmo-keeper-download-${Date.now()}`
            )
          }
        })
        download = await downloadBmoAttachment(attachmentId)
        upstream = download.response
        attempts = attempts.concat(download.attempts || [])
        if (!primaryStatus) primaryStatus = Number(download.primaryStatus || upstream?.status || 0)
      } catch (e) {
        // ignore keeper refresh errors, keep fallback flow below
      }
    }
    if (
      !upstream.ok &&
      fdId &&
      (upstream.status === 401 ||
        upstream.status === 403 ||
        upstream.status === 500 ||
        primaryStatus === 401 ||
        primaryStatus === 403 ||
        primaryStatus === 500)
    ) {
      try {
        const detail = await fetchBmoMouldDetail({ fdId })
        const mechAuthToken = detail?.tech?.mechAuthToken || ''
        if (mechAuthToken) {
          try {
            await checkBmoAttachmentDownload(attachmentId, mechAuthToken)
            attempts.push(`checkDownload/${attachmentId} => 200`)
            const retried = await downloadBmoAttachment(attachmentId)
            attempts = attempts.concat(retried.attempts || [])
            if (!primaryStatus) {
              primaryStatus = Number(retried.primaryStatus || retried.response?.status || 0)
            }
            if (retried.response?.ok) {
              upstream = retried.response
            }
          } catch (e) {
            attempts.push(`checkDownload/${attachmentId} => ${String(e?.message || e).slice(0, 80)}`)
          }
        }
        if (!upstream.ok) {
          const attachments = Array.isArray(detail?.tech?.attachments) ? detail.tech.attachments : []
          const normalizedTargetName = fileName.toLowerCase()
          const candidateIds = attachments
            .filter((x) => x?.id && x.id !== attachmentId)
            .sort((a, b) => {
              const aName = String(a?.fileName || '').toLowerCase()
              const bName = String(b?.fileName || '').toLowerCase()
              const aScore = normalizedTargetName && aName === normalizedTargetName ? 2 : aName.includes(normalizedTargetName) ? 1 : 0
              const bScore = normalizedTargetName && bName === normalizedTargetName ? 2 : bName.includes(normalizedTargetName) ? 1 : 0
              return bScore - aScore
            })
            .map((x) => String(x.id))

          for (const nextId of candidateIds) {
            const retried = await downloadBmoAttachment(nextId)
            attempts = attempts.concat(retried.attempts || [])
            if (!primaryStatus) primaryStatus = Number(retried.primaryStatus || retried.response?.status || 0)
            if (retried.response?.ok) {
              upstream = retried.response
              break
            }
          }
        }
      } catch (e) {
        // ignore fallback errors, keep original response below
      }
    }

    if (
      !upstream.ok &&
      fdId &&
      (upstream.status === 401 ||
        upstream.status === 403 ||
        upstream.status === 500 ||
        primaryStatus === 401 ||
        primaryStatus === 403 ||
        primaryStatus === 500)
    ) {
      try {
        const browserDownloaded = await downloadBmoAttachmentByBrowser({
          fdId,
          attachmentId,
          fileName
        })
        if (browserDownloaded?.buffer?.length) {
          if (browserDownloaded.contentType) {
            res.setHeader('Content-Type', browserDownloaded.contentType)
          }
          if (fileName) {
            res.setHeader(
              'Content-Disposition',
              `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`
            )
          }
          return res.send(browserDownloaded.buffer)
        }
      } catch (e) {
        attempts.unshift(
          `browserFallback/${attachmentId} => ${String(e?.message || e).slice(0, 120)}`
        )
      }
    }

    if (!upstream.ok) {
      let upstreamMsg = ''
      try {
        upstreamMsg = String(await upstream.text()).trim()
      } catch (e) {
        upstreamMsg = ''
      }
      const tries = attempts.length ? attempts.join(' | ') : ''
      const tail = [tries, upstreamMsg].filter(Boolean).join(' | ')
      const statusCode = primaryStatus || upstream.status || 502
      const workerAttempt = attempts.find((x) => String(x || '').startsWith('worker/'))
      const workerReason = workerAttempt
        ? String(workerAttempt).replace(/^worker\/[^=]+=>\s*/, '').trim()
        : ''
      const conciseFailure =
        statusCode === 403 || statusCode === 404 || statusCode === 500
          ? workerReason
            ? `BMO 下载失败: ${workerReason}`
            : 'BMO 下载失败：当前服务会话无权读取附件，请在 BMO 页面下载后使用本地上传读取。'
          : `BMO 下载失败: HTTP ${statusCode}`
      if (tail) {
        console.error('[bmo-attachment-download-failed]', {
          attachmentId,
          fdId,
          statusCode,
          detail: tail.slice(0, 2000)
        })
      }
      return res.status(statusCode).json({
        code: statusCode,
        success: false,
        message: conciseFailure
      })
    }

    const contentType = upstream.headers.get('content-type')
    const disposition = upstream.headers.get('content-disposition')
    if (contentType) res.setHeader('Content-Type', contentType)
    if (disposition) res.setHeader('Content-Disposition', disposition)

    const buf = Buffer.from(await upstream.arrayBuffer())
    return res.send(buf)
  } catch (error) {
    console.error('下载 BMO 附件失败:', error)
    return res.status(500).json({
      code: 500,
      success: false,
      message: '下载 BMO 附件失败: ' + (error?.message || '未知错误')
    })
  }
})

// Live fetch from BMO for matching UI ordering (no DB read/write).
router.get('/mould-procurement/live', async (req, res) => {
  try {
    const pageSize = toSafeLimit(req.query.pageSize ?? req.query.limit, 50, 200)
    const offset = toSafeInt(req.query.offset, 0)
    const conditions = parseQueryJsonObject(req.query.conditions)
    const sorts = parseQueryJsonObject(req.query.sorts)
    const maxWaitMs = toSafeInt(req.query.maxWaitMs, 3000)

    if (isRelayEnabled()) {
      const created = await relayRequestJson('/jobs', {
        method: 'POST',
        timeoutMs: 15000,
        body: {
          type: 'collect',
          payload: {
            pageSize,
            offset,
            ...(conditions ? { conditions } : {}),
            ...(sorts ? { sorts } : {})
          }
        }
      })
      const jobId = String(created?.data?.id || created?.id || '').trim()
      if (!jobId) throw new Error('中转任务创建失败（缺少 jobId）')

      const done = await relayWaitJob(jobId, {
        timeoutMs: Math.max(3000, maxWaitMs),
        intervalMs: 1000
      })
      if (String(done?.status || '') !== 'success') {
        throw new Error(String(done?.error || '中转实时拉取失败'))
      }

      const relayResult = done?.result && typeof done.result === 'object' ? done.result : {}
      const list = Array.isArray(relayResult?.list) ? relayResult.list : []
      const projectInfoMap = await getProjectInfoByCustomerModelNo(
        list.map((x) => x.moldNumber || x.mold_number).filter(Boolean)
      )
      const initiationStatusMap = await getInitiationStatusByBmoRecordId(
        list.map((x) => x.bmoRecordId || x.bmo_record_id).filter(Boolean)
      )
      const viewList = list.map((row, idx) => {
        const moldNumber = row.moldNumber || row.mold_number || null
        const bmoRecordId = row.bmoRecordId || row.bmo_record_id || null
        const bidTime = row.bidTime || row.bid_time || null
        return {
          seq: offset + idx + 1,
          bmo_record_id: bmoRecordId,
          project_manager: row.projectManager || row.project_manager || null,
          part_no: row.partNo || row.part_no || null,
          part_name: row.partName || row.part_name || null,
          model: row.model || null,
          mold_number: moldNumber,
          project_code:
            projectInfoMap.get(String(moldNumber || '').trim())?.projectCode || row.project_code || null,
          project_status:
            projectInfoMap.get(String(moldNumber || '').trim())?.projectStatus ||
            row.project_status ||
            null,
          initiation_status:
            initiationStatusMap.get(String(bmoRecordId || '').trim()) || row.initiation_status || null,
          bid_price_tax_incl: row.bidPriceTaxIncl ?? row.bid_price_tax_incl ?? null,
          bid_time: bidTime ? new Date(bidTime).toISOString() : null
        }
      })

      return res.json({
        code: 0,
        success: true,
        data: {
          list: viewList,
          count: viewList.length,
          offset: toSafeInt(relayResult?.offset, offset),
          pageSize: toSafeInt(relayResult?.pageSize, pageSize),
          totalSize: Number(relayResult?.total ?? relayResult?.totalSize ?? viewList.length),
          traceId: relayResult?.traceId || null,
          fetchedAt: new Date().toISOString()
        }
      })
    }

    if (isHubOnlyMode()) {
      return res.status(500).json({
        code: 500,
        success: false,
        message: 'BMO_HUB_ONLY=1 但未配置 BMO_RELAY_BASE_URL，无法实时读取'
      })
    }

    const result = await fetchBmoMouldListLive({
      pageSize,
      offset,
      timeoutMs: maxWaitMs,
      ...(conditions ? { conditions } : {}),
      ...(sorts ? { sorts } : {})
    })

    const list = Array.isArray(result?.list) ? result.list : []
    const projectInfoMap = await getProjectInfoByCustomerModelNo(
      list.map((x) => x.moldNumber).filter(Boolean)
    )
    const initiationStatusMap = await getInitiationStatusByBmoRecordId(
      list.map((x) => x.bmoRecordId).filter(Boolean)
    )
    const viewList = list.map((row, idx) => ({
      seq: offset + idx + 1,
      bmo_record_id: row.bmoRecordId || null,
      project_manager: row.projectManager || null,
      part_no: row.partNo || null,
      part_name: row.partName || null,
      model: row.model || null,
      mold_number: row.moldNumber || null,
      project_code: projectInfoMap.get(String(row.moldNumber || '').trim())?.projectCode || null,
      project_status: projectInfoMap.get(String(row.moldNumber || '').trim())?.projectStatus || null,
      initiation_status: initiationStatusMap.get(String(row.bmoRecordId || '').trim()) || null,
      bid_price_tax_incl: row.bidPriceTaxIncl ?? null,
      bid_time: row.bidTime ? new Date(row.bidTime).toISOString() : null
    }))

    return res.json({
      code: 0,
      success: true,
      data: {
        list: viewList,
        count: viewList.length,
        offset: result.offset,
        pageSize: result.pageSize,
        totalSize: result.totalSize,
        traceId: result.traceId,
        fetchedAt: result.fetchedAt
      }
    })
  } catch (error) {
    console.error('读取 BMO 模具采购实时数据失败:', error)
    return res.status(500).json({
      code: 500,
      success: false,
      message: '读取 BMO 模具采购实时数据失败: ' + (error?.message || '未知错误')
    })
  }
})

const ensureBmoInitiationCustomerSoftDeleteColumns = async (poolOrTx) => {
  const req = new sql.Request(poolOrTx)
  await req.batch(`
    IF COL_LENGTH(N'客户信息', N'是否删除') IS NULL
      ALTER TABLE 客户信息 ADD 是否删除 BIT NOT NULL CONSTRAINT DF_客户信息_是否删除 DEFAULT(0);
  `)
}

router.get('/initiation/customers', async (req, res) => {
  try {
    const pool = await getPool()
    await ensureBmoInitiationCustomerSoftDeleteColumns(pool)
    const list = await listCustomerOptions({ status: req.query.status })

    return res.json({
      code: 0,
      success: true,
      data: { list: list || [] }
    })
  } catch (error) {
    console.error('读取 BMO 立项客户列表失败:', error)
    return res.status(500).json({
      code: 500,
      success: false,
      message: formatBmoSqlErrorMessage(error, '读取 BMO 立项客户列表失败')
    })
  }
})

// === BMO 立项申请单（申请/确认/审核/自动入库） ===
const safeJsonParse = (s) => {
  if (!s) return null
  try {
    return JSON.parse(String(s))
  } catch (e) {
    return null
  }
}

const normalizeCavityText = (v) => String(v ?? '').trim()
const normalizeCavityFieldKey = (v) =>
  normalizeCavityText(v).replace(/\s+/g, '').replace(/：/g, ':').toLowerCase()

const parseChineseNumber = (value) => {
  const s = String(value || '').trim()
  if (!s) return null
  const digitMap = {
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

const parseMouldCavityText = (raw) => {
  const original = normalizeCavityText(raw)
  if (!original) return { expression: '', counts: [] }

  const normalized = original
    .replaceAll('（', '(')
    .replaceAll('）', ')')
    .replaceAll('＋', '+')
    .replaceAll('，', ',')
    .replace(/\s+/g, '')

  const parseCountsFromExpr = (expr) => {
    const e = String(expr || '').trim()
    if (!e) return []
    const parts = e
      .split(/[+,，、]/)
      .map((p) => p.trim())
      .filter(Boolean)
    const counts = []
    for (const part of parts) {
      const token = String(part.includes('*') ? part.split('*').pop() || '' : part).trim()
      if (!token) continue

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
        if (n && n > 0) counts.push(Math.max(1, Math.trunc(n)))
      }
    }
    return counts
  }

  const parenMatch = normalized.match(/\(([^)]+)\)/)
  const countsFromParen = parseCountsFromExpr(parenMatch?.[1] || '')
  if (countsFromParen.length) {
    return {
      expression: countsFromParen.map((n) => `1*${n}`).join('+'),
      counts: countsFromParen
    }
  }

  const countsFromWhole = parseCountsFromExpr(normalized)
  if (countsFromWhole.length) {
    return {
      expression: countsFromWhole.map((n) => `1*${n}`).join('+'),
      counts: countsFromWhole
    }
  }

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

const pickBestCavityCandidate = (candidates) => {
  const list = Array.isArray(candidates) ? candidates : []
  if (!list.length) return null

  const scored = list
    .map((x, idx) => {
      const value = normalizeCavityText(x?.value)
      const source = normalizeCavityText(x?.source)
      const parsed = parseMouldCavityText(value)
      const isBmo14 = source.startsWith('bmo14') ? 1 : 0
      return {
        idx,
        value,
        source,
        parsed,
        score: isBmo14 * 1000 + parsed.counts.length * 100 + (parsed.expression ? 10 : 0)
      }
    })
    .filter((x) => !!x.value)
    .sort((a, b) => b.score - a.score || a.idx - b.idx)
  if (!scored.length) return null
  return scored[0]
}

const formatToday = () => {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const generateSalesOrderNo = async (tx) => {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const orderDate = `${year}${month}${day}`
  const orderPrefix = 'XS'

  const req = new sql.Request(tx)
  req.input('pattern', sql.NVarChar, `${orderPrefix}-${orderDate}-%`)
  const rows = await req.query(`
    SELECT TOP 1 订单编号 as orderNo
    FROM 销售订单
    WHERE 订单编号 LIKE @pattern
      AND (状态 IS NULL OR 状态 <> N'已删除')
    ORDER BY 订单编号 DESC
  `)

  let serial = 1
  const last = rows.recordset?.[0]?.orderNo ? String(rows.recordset[0].orderNo) : ''
  if (last) {
    const m = last.match(/^XS-(\d{8})-(\d{3})$/)
    if (m && m[1] === orderDate) {
      const lastSerial = parseInt(m[2], 10)
      if (Number.isFinite(lastSerial) && lastSerial > 0) serial = lastSerial + 1
    }
  }
  const formattedSerial = String(serial).padStart(3, '0')
  return `${orderPrefix}-${orderDate}-${formattedSerial}`
}

const LOCKED_INITIATION_STATUSES = new Set(['PM_CONFIRMED', 'APPLIED'])

const INITIATION_STATUS_TEXT_MAP = {
  DRAFT: '草稿',
  PM_CONFIRMED: '审核中',
  APPLIED: '已通过',
  REJECTED: '已驳回'
}

const normalizeInitiationStatus = (status) => String(status || '').trim().toUpperCase()

const getInitiationStatusText = (status) => {
  const s = normalizeInitiationStatus(status)
  return INITIATION_STATUS_TEXT_MAP[s] || '未知状态'
}

const getReviewerWhitelist = () => {
  const raw = String(process.env.BMO_INITIATION_REVIEWERS || '').trim()
  if (!raw) return []
  return raw
    .split(',')
    .map((x) => String(x || '').trim().toLowerCase())
    .filter(Boolean)
}

const assertInitiationReviewerPermission = async (req) => {
  const whitelist = getReviewerWhitelist()
  await assertReviewPermission({
    req,
    actionKey: 'BMO_INITIATION.REVIEW',
    resolveActorFromReq,
    legacyEnvName: 'BMO_INITIATION_REVIEWERS',
    legacyAllowWhenEmpty: !whitelist.length
  })
}

const toInitiationReviewTaskData = (row) => {
  if (!row) return null
  const data = toInitiationResponseData(row)
  return {
    ...data,
    part_no: row.part_no || null,
    part_name: row.part_name || null,
    model: row.model || null,
    mold_number: row.mold_number || null,
    project_manager: row.project_manager || null,
    bid_price_tax_incl: row.bid_price_tax_incl ?? null,
    bid_time: row.bid_time || null
  }
}

const ensureInitiationEditable = (status) => {
  const s = normalizeInitiationStatus(status)
  if (LOCKED_INITIATION_STATUSES.has(s)) {
    throw new Error('当前状态不可修改')
  }
}

const extractProjectCodeFromDraftInput = (input) => {
  const fromGoods = String(input?.goods_draft?.projectCode || '').trim()
  if (fromGoods) return fromGoods
  return String(input?.project_code_candidate || '').trim()
}

const ensureProjectCodeNotOccupied = async ({ projectCode, currentBmoRecordId }) => {
  const code = String(projectCode || '').trim()
  if (!code) return
  const currentRecordId = String(currentBmoRecordId || '').trim()

  const rows = await query(
    `
      SELECT TOP 1 bmo_record_id, status
      FROM dbo.bmo_initiation_requests
      WHERE (
          project_code_final = @projectCode
          OR project_code_candidate = @projectCode
          OR JSON_VALUE(goods_draft_json, '$.projectCode') = @projectCode
        )
        AND bmo_record_id <> @currentBmoRecordId
      ORDER BY
        CASE status
          WHEN N'APPLIED' THEN 0
          WHEN N'PM_CONFIRMED' THEN 1
          WHEN N'DRAFT' THEN 2
          WHEN N'REJECTED' THEN 3
          ELSE 9
        END ASC,
        updated_at DESC,
        id DESC
    `,
    { projectCode: code, currentBmoRecordId: currentRecordId }
  )
  const row = rows?.[0] || null
  if (!row) return

  const occupiedStatus = normalizeInitiationStatus(row.status)
  if (occupiedStatus === 'REJECTED') return

  throw new Error(`项目编号 "${code}" 已被其他立项单占用`)
}

const upsertInitiationDraft = async (input) => {
  const bmoRecordId = String(input?.bmo_record_id || input?.fdId || input?.bmoRecordId || '').trim()
  if (!bmoRecordId) throw new Error('缺少 bmo_record_id')

  const actor = input?.actor || null
  const projectCode = extractProjectCodeFromDraftInput(input)
  if (!projectCode) throw new Error('项目编号不能为空')

  const existingRows = await query(
    `SELECT TOP 1 status FROM dbo.bmo_initiation_requests WHERE bmo_record_id = @bmoRecordId`,
    { bmoRecordId }
  )
  const existing = existingRows?.[0] || null
  ensureInitiationEditable(existing?.status)
  await ensureProjectCodeNotOccupied({ projectCode, currentBmoRecordId: bmoRecordId })

  const projectCodeCandidate = input?.project_code_candidate ? String(input.project_code_candidate).trim() : null
  const goodsDraftJson = input?.goods_draft ? JSON.stringify(input.goods_draft) : null
  const salesDraftJson = input?.sales_order_draft ? JSON.stringify(input.sales_order_draft) : null
  let techSnapshotJson = null
  if (input?.tech_snapshot && typeof input.tech_snapshot === 'object') {
    const parsedCaches = await listLatestTechSpecParseCachesByRecordId(bmoRecordId, 10)
    const cavitySnapshot = buildCavitySnapshot({
      snapshot: input.tech_snapshot,
      parsedCaches
    })
    techSnapshotJson = JSON.stringify({
      ...input.tech_snapshot,
      fdId: input.tech_snapshot?.fdId || bmoRecordId,
      cavitySnapshot
    })
  }

  const pool = await getPool()
  const req = pool.request()
  req.input('bmoRecordId', sql.NVarChar, bmoRecordId)
  req.input('projectCodeCandidate', sql.NVarChar, projectCodeCandidate)
  req.input('goodsDraftJson', sql.NVarChar(sql.MAX), goodsDraftJson)
  req.input('salesDraftJson', sql.NVarChar(sql.MAX), salesDraftJson)
  req.input('techSnapshotJson', sql.NVarChar(sql.MAX), techSnapshotJson)
  req.input('actor', sql.NVarChar, actor)

  await req.query(`
    MERGE dbo.bmo_initiation_requests AS target
    USING (SELECT @bmoRecordId AS bmo_record_id) AS source
    ON target.bmo_record_id = source.bmo_record_id
    WHEN MATCHED THEN
      UPDATE SET
        created_by = COALESCE(target.created_by, @actor),
        project_code_candidate = COALESCE(@projectCodeCandidate, target.project_code_candidate),
        goods_draft_json = COALESCE(@goodsDraftJson, target.goods_draft_json),
        sales_order_draft_json = COALESCE(@salesDraftJson, target.sales_order_draft_json),
        tech_snapshot_json = COALESCE(@techSnapshotJson, target.tech_snapshot_json),
        updated_at = SYSDATETIME()
    WHEN NOT MATCHED THEN
      INSERT (
        bmo_record_id, status, project_code_candidate,
        goods_draft_json, sales_order_draft_json, tech_snapshot_json,
        created_by, created_at, updated_at
      )
      VALUES (
        @bmoRecordId, N'DRAFT', @projectCodeCandidate,
        @goodsDraftJson, @salesDraftJson, @techSnapshotJson,
        @actor, SYSDATETIME(), SYSDATETIME()
      );
  `)

  const rows = await query(
    `
      SELECT TOP 1 *
      FROM dbo.bmo_initiation_requests
      WHERE bmo_record_id = @bmoRecordId
    `,
    { bmoRecordId }
  )
  return rows?.[0] || null
}

const toInitiationResponseData = (row) => {
  if (!row) return null
  return {
    ...row,
    status_text: getInitiationStatusText(row.status),
    goods_draft: safeJsonParse(row.goods_draft_json),
    sales_order_draft: safeJsonParse(row.sales_order_draft_json),
    tech_snapshot: safeJsonParse(row.tech_snapshot_json)
  }
}

router.get('/initiation-request', async (req, res) => {
  try {
    const bmoRecordId = String(req.query.bmo_record_id || req.query.fdId || req.query.bmoRecordId || '').trim()
    if (!bmoRecordId) {
      return res.status(400).json({ code: 400, success: false, message: '缺少 bmo_record_id' })
    }

    const rows = await query(
      `
        SELECT TOP 1 *
        FROM dbo.bmo_initiation_requests
        WHERE bmo_record_id = @bmoRecordId
      `,
      { bmoRecordId }
    )
    const row = rows?.[0] || null
    if (!row) {
      return res.json({ code: 0, success: true, data: null })
    }

    return res.json({
      code: 0,
      success: true,
      data: toInitiationResponseData(row)
    })
  } catch (error) {
    console.error('读取 BMO 立项申请单失败:', error)
    return res.status(500).json({
      code: 500,
      success: false,
      message: formatBmoSqlErrorMessage(error, '读取 BMO 立项申请单失败')
    })
  }
})

router.get('/initiation-request/by-project', async (req, res) => {
  try {
    const projectCode = String(req.query.projectCode || '').trim()
    if (!projectCode) {
      return res.status(400).json({ code: 400, success: false, message: '缺少 projectCode' })
    }

    const rows = await query(
      `
        SELECT TOP 1 *
        FROM dbo.bmo_initiation_requests
        WHERE project_code_final = @projectCode
          OR project_code_candidate = @projectCode
          OR JSON_VALUE(goods_draft_json, '$.projectCode') = @projectCode
        ORDER BY
          CASE status
            WHEN N'APPLIED' THEN 0
            WHEN N'PM_CONFIRMED' THEN 1
            WHEN N'DRAFT' THEN 2
            WHEN N'REJECTED' THEN 3
            ELSE 9
          END ASC,
          updated_at DESC,
          id DESC
      `,
      { projectCode }
    )
    const row = rows?.[0] || null
    return res.json({
      code: 0,
      success: true,
      data: toInitiationResponseData(row)
    })
  } catch (error) {
    console.error('按项目读取 BMO 立项申请单失败:', error)
    return res.status(500).json({
      code: 500,
      success: false,
      message: formatBmoSqlErrorMessage(error, '按项目读取 BMO 立项申请单失败')
    })
  }
})

router.post('/initiation-request/draft', requireBmoSyncCreate, async (req, res) => {
  try {
    const actor = resolveActorFromReq(req)
    const row = await upsertInitiationDraft({ ...req.body, actor })
    return res.json({
      code: 0,
      success: true,
      data: toInitiationResponseData(row)
    })
  } catch (error) {
    console.error('保存 BMO 立项草稿失败:', error)
    if (String(error?.message || '').includes('不可修改')) {
      return res.status(409).json({ code: 409, success: false, message: error.message })
    }
    if (String(error?.message || '').includes('占用')) {
      return res.status(409).json({ code: 409, success: false, message: error.message })
    }
    if (String(error?.message || '').includes('项目编号不能为空')) {
      return res.status(400).json({ code: 400, success: false, message: error.message })
    }
    return res.status(500).json({
      code: 500,
      success: false,
      message: formatBmoSqlErrorMessage(error, '保存 BMO 立项草稿失败')
    })
  }
})

router.post('/initiation-request/confirm', requireBmoSyncUpdate, async (req, res) => {
  try {
    const actor = resolveActorFromReq(req)
    const bmoRecordId = String(req.body?.bmo_record_id || req.body?.fdId || '').trim()
    if (!bmoRecordId) return res.status(400).json({ code: 400, success: false, message: '缺少 bmo_record_id' })

    const existingRows = await query(
      `SELECT TOP 1 * FROM dbo.bmo_initiation_requests WHERE bmo_record_id = @bmoRecordId`,
      { bmoRecordId }
    )
    const existing = existingRows?.[0] || null
    const existingStatus = String(existing?.status || '').trim()
    if (existingStatus === 'APPLIED') {
      return res.status(400).json({ code: 400, success: false, message: '已通过，不能重复提交审核' })
    }
    if (existingStatus === 'PM_CONFIRMED') {
      return res.status(400).json({ code: 400, success: false, message: '已提交审核，请勿重复提交' })
    }
    // Ensure draft exists and is up-to-date after editable status check.
    await upsertInitiationDraft({ ...req.body, actor })

    await query(
      `
        UPDATE dbo.bmo_initiation_requests
        SET status = N'PM_CONFIRMED',
            confirmed_by = @actor,
            confirmed_at = SYSDATETIME(),
            updated_at = SYSDATETIME(),
            rejected_reason = NULL
        WHERE bmo_record_id = @bmoRecordId
      `,
      { bmoRecordId, actor }
    )

    const rows = await query(
      `SELECT TOP 1 * FROM dbo.bmo_initiation_requests WHERE bmo_record_id = @bmoRecordId`,
      { bmoRecordId }
    )
    const row = rows?.[0] || null
    return res.json({ code: 0, success: true, data: toInitiationResponseData(row) })
  } catch (error) {
    console.error('确认 BMO 立项申请单失败:', error)
    if (String(error?.message || '').includes('不可修改')) {
      return res.status(409).json({ code: 409, success: false, message: error.message })
    }
    if (String(error?.message || '').includes('占用')) {
      return res.status(409).json({ code: 409, success: false, message: error.message })
    }
    if (String(error?.message || '').includes('项目编号不能为空')) {
      return res.status(400).json({ code: 400, success: false, message: error.message })
    }
    return res.status(500).json({
      code: 500,
      success: false,
      message: formatBmoSqlErrorMessage(error, '确认 BMO 立项申请单失败')
    })
  }
})

router.get('/initiation-review/tasks', async (req, res) => {
  try {
    await assertInitiationReviewerPermission(req)
    const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1)
    const pageSize = Math.min(200, Math.max(1, Number.parseInt(String(req.query.pageSize || '20'), 10) || 20))
    const statusInput = normalizeInitiationStatus(req.query.status)
    const status = statusInput && statusInput !== 'ALL' ? statusInput : ''
    const keyword = String(req.query.keyword || '').trim()
    const offset = (page - 1) * pageSize

    const whereParts = ['1=1']
    const params = {}
    if (status) {
      whereParts.push('ir.status = @status')
      params.status = status
    }
    if (keyword) {
      whereParts.push(`(
        ir.bmo_record_id LIKE @keyword
        OR ir.project_code_candidate LIKE @keyword
        OR ir.project_code_final LIKE @keyword
        OR JSON_VALUE(ir.goods_draft_json, '$.projectCode') LIKE @keyword
        OR mp.part_no LIKE @keyword
        OR mp.part_name LIKE @keyword
        OR mp.mold_number LIKE @keyword
        OR mp.project_manager LIKE @keyword
      )`)
      params.keyword = `%${keyword}%`
    }
    params.offset = offset
    params.pageSize = pageSize

    const whereSql = whereParts.join(' AND ')
    const rows = await query(
      `
        WITH base AS (
          SELECT
            ir.*,
            mp.part_no,
            mp.part_name,
            mp.model,
            mp.mold_number,
            mp.project_manager,
            mp.bid_price_tax_incl,
            mp.bid_time
          FROM dbo.bmo_initiation_requests ir
          LEFT JOIN dbo.bmo_mould_procurement mp
            ON mp.bmo_record_id = ir.bmo_record_id
          WHERE ${whereSql}
        ),
        ordered AS (
          SELECT
            *,
            ROW_NUMBER() OVER (
              ORDER BY
                CASE status
                  WHEN N'PM_CONFIRMED' THEN 0
                  WHEN N'DRAFT' THEN 1
                  WHEN N'REJECTED' THEN 2
                  WHEN N'APPLIED' THEN 3
                  ELSE 9
                END ASC,
                updated_at DESC,
                id DESC
            ) AS rn
          FROM base
        )
        SELECT *
        FROM ordered
        WHERE rn > @offset
          AND rn <= (@offset + @pageSize)
        ORDER BY rn ASC
      `,
      params
    )

    const totalRows = await query(
      `
        SELECT COUNT(1) AS total
        FROM dbo.bmo_initiation_requests ir
        LEFT JOIN dbo.bmo_mould_procurement mp
          ON mp.bmo_record_id = ir.bmo_record_id
        WHERE ${whereSql}
      `,
      params
    )
    const total = Number(totalRows?.[0]?.total || 0) || 0
    return res.json({
      code: 0,
      success: true,
      data: {
        page,
        pageSize,
        total,
        list: (rows || []).map((row) => toInitiationReviewTaskData(row))
      }
    })
  } catch (error) {
    console.error('读取立项审核任务失败:', error)
    if (Number(error?.statusCode || 0) === 403) {
      return res.status(403).json({ code: 403, success: false, message: error.message || '无权限' })
    }
    return res.status(500).json({
      code: 500,
      success: false,
      message: formatBmoSqlErrorMessage(error, '读取立项审核任务失败')
    })
  }
})

const rejectInitiationRequest = async (req, res, options = {}) => {
  try {
    if (options.requireReviewerPermission) {
      await assertInitiationReviewerPermission(req)
    }
    const bmoRecordId = String(req.body?.bmo_record_id || req.body?.fdId || '').trim()
    const reason = String(req.body?.reason || '').trim()
    if (!bmoRecordId) return res.status(400).json({ code: 400, success: false, message: '缺少 bmo_record_id' })
    if (!reason) return res.status(400).json({ code: 400, success: false, message: '缺少驳回原因' })

    const pool = await getPool()
    const tx = new sql.Transaction(pool)
    await tx.begin()
    try {
      const lockReq = new sql.Request(tx)
      lockReq.input('bmoRecordId', sql.NVarChar, bmoRecordId)
      const existingRows = await lockReq.query(`
        SELECT TOP 1 status
        FROM dbo.bmo_initiation_requests WITH (UPDLOCK, HOLDLOCK)
        WHERE bmo_record_id = @bmoRecordId
      `)
      const existing = existingRows.recordset?.[0] || null
      if (!existing) {
        await tx.rollback()
        return res.status(404).json({ code: 404, success: false, message: '立项申请单不存在' })
      }
      const status = normalizeInitiationStatus(existing.status)
      if (status === 'APPLIED') {
        await tx.rollback()
        return res.status(400).json({ code: 400, success: false, message: '已通过，不能驳回' })
      }
      if (status !== 'PM_CONFIRMED') {
        await tx.rollback()
        return res.status(400).json({ code: 400, success: false, message: '仅审核中状态可驳回' })
      }

      const updateReq = new sql.Request(tx)
      updateReq.input('bmoRecordId', sql.NVarChar, bmoRecordId)
      updateReq.input('reason', sql.NVarChar, reason)
      updateReq.input('statusPending', sql.NVarChar, 'PM_CONFIRMED')
      const updateResult = await updateReq.query(`
        UPDATE dbo.bmo_initiation_requests
        SET status = N'REJECTED',
            rejected_reason = @reason,
            updated_at = SYSDATETIME()
        WHERE bmo_record_id = @bmoRecordId
          AND status = @statusPending
      `)
      if ((updateResult.rowsAffected?.[0] || 0) <= 0) {
        await tx.rollback()
        return res.status(409).json({ code: 409, success: false, message: '状态冲突，无法驳回' })
      }
      await tx.commit()
    } catch (e) {
      try {
        await tx.rollback()
      } catch {}
      throw e
    }
    return res.json({ code: 0, success: true, message: '已驳回' })
  } catch (error) {
    console.error('驳回 BMO 立项申请单失败:', error)
    if (Number(error?.statusCode || 0) === 403) {
      return res.status(403).json({ code: 403, success: false, message: error.message || '无权限' })
    }
    return res.status(500).json({
      code: 500,
      success: false,
      message: formatBmoSqlErrorMessage(error, '驳回 BMO 立项申请单失败')
    })
  }
}

router.post('/initiation-request/reject', requireBmoSyncApprove, async (req, res) => {
  return rejectInitiationRequest(req, res, { requireReviewerPermission: true })
})

router.post('/initiation-review/reject', requireBmoSyncApprove, async (req, res) => {
  return rejectInitiationRequest(req, res, { requireReviewerPermission: true })
})

const approveAndApplyInitiationRequest = async (req, res, options = {}) => {
  try {
    if (options.requireReviewerPermission) {
      await assertInitiationReviewerPermission(req)
    }
    const actor = resolveActorFromReq(req)
    const bmoRecordId = String(req.body?.bmo_record_id || req.body?.fdId || '').trim()
    if (!bmoRecordId) return res.status(400).json({ code: 400, success: false, message: '缺少 bmo_record_id' })

    const pool = await getPool()
    const tx = new sql.Transaction(pool)
    await tx.begin()
    try {
      const lockReq = new sql.Request(tx)
      lockReq.input('bmoRecordId', sql.NVarChar, bmoRecordId)
      const rows = await lockReq.query(`
        SELECT TOP 1 *
        FROM dbo.bmo_initiation_requests WITH (UPDLOCK, HOLDLOCK)
        WHERE bmo_record_id = @bmoRecordId
      `)
      const requestRow = rows.recordset?.[0] || null
      if (!requestRow) {
        await tx.rollback()
        return res.status(404).json({ code: 404, success: false, message: '立项申请单不存在' })
      }
      if (String(requestRow.status || '') === 'APPLIED') {
        await tx.rollback()
        return res.json({
          code: 0,
          success: true,
          message: '已通过（跳过）',
          data: { projectCode: requestRow.project_code_final, orderNo: requestRow.sales_order_no }
        })
      }
      if (String(requestRow.status || '') !== 'PM_CONFIRMED') {
        await tx.rollback()
        return res.status(400).json({ code: 400, success: false, message: '未确认，不能入库' })
      }
      const goodsDraft = safeJsonParse(requestRow.goods_draft_json) || {}
      const salesDraft = safeJsonParse(requestRow.sales_order_draft_json) || {}
      const projectCode = String(goodsDraft.projectCode || requestRow.project_code_candidate || '').trim()
      if (!projectCode) {
        await tx.rollback()
        return res.status(400).json({ code: 400, success: false, message: '缺少项目编号' })
      }

      // 0) projectCode unique
      {
        const checkReq = new sql.Request(tx)
        checkReq.input('projectCode', sql.NVarChar, projectCode)
        const r = await checkReq.query(`SELECT COUNT(*) as cnt FROM 货物信息 WHERE 项目编号 = @projectCode`)
        const cnt = r.recordset?.[0]?.cnt ?? 0
        if (cnt > 0) throw new Error(`项目编号 "${projectCode}" 已存在`)
      }

      // 1) 项目管理占位（满足外键/关联）
      const customerName = String(goodsDraft.customerName || '').trim()
      const customerModelNo = goodsDraft.customerModelNo ?? null
      let customerId = null
      if (salesDraft.customerId) customerId = Number(salesDraft.customerId) || null
      if (!customerId && customerName) {
        const cReq = new sql.Request(tx)
        cReq.input('customerName', sql.NVarChar, customerName)
        const c = await cReq.query(`
          SELECT TOP 1 客户ID as customerId
          FROM 客户信息
          WHERE 客户名称 = @customerName
        `)
        customerId = c.recordset?.[0]?.customerId ?? null
      }

      {
        const pReq = new sql.Request(tx)
        pReq.input('projectCode', sql.NVarChar, projectCode)
        const p = await pReq.query(`SELECT COUNT(*) as cnt FROM 项目管理 WHERE 项目编号 = @projectCode`)
        const exists = (p.recordset?.[0]?.cnt ?? 0) > 0
        if (!exists) {
          const ins = new sql.Request(tx)
          ins.input('projectCode', sql.NVarChar, projectCode)
          if (customerId) ins.input('customerId', sql.Int, customerId)
          ins.input('customerModelNo', sql.NVarChar, customerModelNo)
          if (customerId) {
            await ins.query(`
              INSERT INTO 项目管理 (项目编号, 客户ID, 客户模号)
              VALUES (@projectCode, @customerId, @customerModelNo)
            `)
          } else {
            await ins.query(`INSERT INTO 项目管理 (项目编号) VALUES (@projectCode)`)
          }
        } else if (customerId !== null) {
          const upd = new sql.Request(tx)
          upd.input('projectCode', sql.NVarChar, projectCode)
          upd.input('customerId', sql.Int, customerId)
          upd.input('customerModelNo', sql.NVarChar, customerModelNo)
          await upd.query(`
            UPDATE 项目管理
            SET 客户ID = @customerId, 客户模号 = @customerModelNo
            WHERE 项目编号 = @projectCode
          `)
        }
      }

      // 2) 货物信息
      {
        const gReq = new sql.Request(tx)
        gReq.input('projectCode', sql.NVarChar, projectCode)
        gReq.input('productDrawing', sql.NVarChar, goodsDraft.productDrawing || null)
        gReq.input('productName', sql.NVarChar, goodsDraft.productName || null)
        gReq.input('category', sql.NVarChar, goodsDraft.category || '塑胶模具')
        gReq.input('remarks', sql.NVarChar, goodsDraft.remarks || null)
        await gReq.query(`
          INSERT INTO 货物信息 (项目编号, 产品图号, 产品名称, 分类, 备注, IsNew)
          VALUES (@projectCode, @productDrawing, @productName, @category, @remarks, 1)
        `)
      }

      // 3) 生产任务占位
      {
        const tReq = new sql.Request(tx)
        tReq.input('projectCode', sql.NVarChar, projectCode)
        const r = await tReq.query(`SELECT COUNT(*) as cnt FROM 生产任务 WHERE 项目编号 = @projectCode`)
        const exists = (r.recordset?.[0]?.cnt ?? 0) > 0
        if (!exists) {
          const ins = new sql.Request(tx)
          ins.input('projectCode', sql.NVarChar, projectCode)
          await ins.query(`INSERT INTO 生产任务 (项目编号) VALUES (@projectCode)`)
        }
      }

      // 4) 销售订单
      const orderNo = await generateSalesOrderNo(tx)
      const orderDate = salesDraft.orderDate || formatToday()
      const signDate = salesDraft.signDate || null
      const contractNo = salesDraft.contractNo || null
      const details = Array.isArray(salesDraft.details) ? salesDraft.details : []
      if (!customerId) throw new Error('缺少客户（customerId）')
      if (!details.length) throw new Error('缺少订单明细')

      const itemCodes = []
      const itemCodeToCustomerPartNo = new Map()
      for (const d of details) {
        const itemCode = String(d.itemCode || projectCode || '').trim() || null
        const insertReq = new sql.Request(tx)
        insertReq.input('orderNo', sql.NVarChar, orderNo)
        insertReq.input('customerId', sql.Int, customerId)
        insertReq.input('itemCode', sql.NVarChar, itemCode)
        insertReq.input('orderDate', sql.NVarChar, orderDate)
        insertReq.input('deliveryDate', sql.NVarChar, d.deliveryDate || null)
        insertReq.input('signDate', sql.NVarChar, signDate)
        insertReq.input('contractNo', sql.NVarChar, contractNo)
        insertReq.input('totalAmount', sql.Float, Number(d.totalAmount || 0))
        insertReq.input('unitPrice', sql.Float, Number(d.unitPrice || 0))
        insertReq.input('quantity', sql.Int, Number(d.quantity || 0))
        insertReq.input('remark', sql.NVarChar, d.remark || null)
        insertReq.input('costSource', sql.NVarChar, d.costSource || null)
        insertReq.input('handler', sql.NVarChar, d.handler || null)
        insertReq.input('isInStock', sql.Bit, d.isInStock ? 1 : 0)
        insertReq.input('isShipped', sql.Bit, d.isShipped ? 1 : 0)
        insertReq.input('shippingDate', sql.NVarChar, d.shippingDate || null)
        await insertReq.query(`
          INSERT INTO 销售订单 (
            订单编号, 客户ID, 项目编号, 订单日期, 交货日期, 签订日期, 合同号,
            总金额, 单价, 数量, 备注, 费用出处, 经办人, 是否入库, 是否出运, 出运日期
          ) VALUES (
            @orderNo, @customerId, @itemCode, @orderDate, @deliveryDate, @signDate, @contractNo,
            @totalAmount, @unitPrice, @quantity, @remark, @costSource, @handler, @isInStock, @isShipped, @shippingDate
          )
        `)

        if (itemCode) {
          itemCodes.push(itemCode)
          if (d.customerPartNo !== undefined && d.customerPartNo !== null) {
            itemCodeToCustomerPartNo.set(itemCode, d.customerPartNo)
          }
        }
      }

      // 4.1) 同步客户模号到项目管理
      for (const [itemCode, customerPartNo] of itemCodeToCustomerPartNo.entries()) {
        const upd = new sql.Request(tx)
        upd.input('itemCode', sql.NVarChar, itemCode)
        upd.input('customerPartNo', sql.NVarChar, customerPartNo === '' ? null : customerPartNo)
        await upd.query(`
          UPDATE 项目管理
          SET 客户模号 = @customerPartNo
          WHERE 项目编号 = @itemCode
        `)
      }

      // 4.2) 更新 IsNew=0
      if (itemCodes.length) {
        const placeholders = itemCodes.map((_, i) => `@c${i}`).join(', ')
        const u = new sql.Request(tx)
        itemCodes.forEach((code, i) => u.input(`c${i}`, sql.NVarChar, code))
        await u.query(`UPDATE 货物信息 SET IsNew = 0 WHERE 项目编号 IN (${placeholders})`)
      }

      // 5) 更新申请单
      {
        const upd = new sql.Request(tx)
        upd.input('bmoRecordId', sql.NVarChar, bmoRecordId)
        upd.input('projectCode', sql.NVarChar, projectCode)
        upd.input('orderNo', sql.NVarChar, orderNo)
        upd.input('actor', sql.NVarChar, actor)
        upd.input('statusPending', sql.NVarChar, 'PM_CONFIRMED')
        const updateResult = await upd.query(`
          UPDATE dbo.bmo_initiation_requests
          SET status = N'APPLIED',
              project_code_final = @projectCode,
              sales_order_no = @orderNo,
              approved_by = @actor,
              approved_at = SYSDATETIME(),
              updated_at = SYSDATETIME()
          WHERE bmo_record_id = @bmoRecordId
            AND status = @statusPending
        `)
        if ((updateResult.rowsAffected?.[0] || 0) <= 0) {
          const err = new Error('状态冲突，无法审核通过')
          err.statusCode = 409
          throw err
        }
      }

      await tx.commit()
      return res.json({
        code: 0,
        success: true,
        message: '已审核并自动入库',
        data: { projectCode, orderNo }
      })
    } catch (e) {
      try {
        await tx.rollback()
      } catch (rollbackErr) {
        // ignore
      }
      throw e
    }
  } catch (error) {
    console.error('审核并入库失败:', error)
    if (Number(error?.statusCode || 0) === 403) {
      return res.status(403).json({ code: 403, success: false, message: error.message || '无权限' })
    }
    if (Number(error?.statusCode || 0) === 409) {
      return res.status(409).json({ code: 409, success: false, message: error.message || '状态冲突' })
    }
    return res.status(500).json({
      code: 500,
      success: false,
      message: formatBmoSqlErrorMessage(error, '审核并入库失败')
    })
  }
}

router.post('/initiation-request/approve-and-apply', requireBmoSyncApprove, async (req, res) => {
  return approveAndApplyInitiationRequest(req, res, { requireReviewerPermission: true })
})

router.post('/initiation-review/approve-and-apply', requireBmoSyncApprove, async (req, res) => {
  return approveAndApplyInitiationRequest(req, res, { requireReviewerPermission: true })
})

module.exports = router
