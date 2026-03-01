const { query } = require('../database')
const { upsertBmoRecords, fetchBmoMouldDetail, fetchBmoMouldListLive } = require('./bmoSync')
const XLSX = require('xlsx')

const toSafeInt = (value, fallback = 0) => {
  const n = Number(value)
  return Number.isInteger(n) ? n : fallback
}

const toPositiveInt = (value, fallback, min = 1, max = Number.MAX_SAFE_INTEGER) => {
  const n = Number(value)
  if (!Number.isInteger(n) || n < min) return fallback
  return Math.min(n, max)
}

const getRelayBaseUrl = () => String(process.env.BMO_RELAY_BASE_URL || '').trim().replace(/\/+$/, '')
const isRelayEnabled = () => Boolean(getRelayBaseUrl())

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
        (json && (json.message || json.detail || json.error)) ||
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

const relayDownloadFileBuffer = async (fileId, timeoutMs = 30000) => {
  const baseUrl = getRelayBaseUrl()
  if (!baseUrl) throw new Error('BMO_RELAY_BASE_URL 未配置')
  const id = String(fileId || '').trim()
  if (!id) throw new Error('缺少 fileId')
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), Math.max(1000, timeoutMs))
  try {
    const resp = await fetch(`${baseUrl}/files/${encodeURIComponent(id)}`, {
      method: 'GET',
      signal: ctrl.signal
    })
    if (!resp.ok) throw new Error(`relay file HTTP ${resp.status}`)
    const arr = await resp.arrayBuffer()
    return Buffer.from(arr)
  } finally {
    clearTimeout(timer)
  }
}

const normalizeText = (v) => String(v ?? '').trim()
const normalizeFieldKey = (v) =>
  normalizeText(v).replace(/\s+/g, '').replace(/：/g, ':').toLowerCase()

const CAVITY_LABELS = ['模具穴数', '模具腔数', '穴数', '腔数', '型腔数']

const extractCavityFromExcelBuffer = (buffer) => {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const candidates = []

  for (const sheetName of workbook.SheetNames || []) {
    const ws = workbook.Sheets[sheetName]
    if (!ws) continue
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
    for (let r = 0; r < rows.length; r += 1) {
      const row = Array.isArray(rows[r]) ? rows[r] : []
      for (let c = 0; c < row.length; c += 1) {
        const cellRaw = normalizeText(row[c])
        if (!cellRaw) continue
        const key = normalizeFieldKey(cellRaw)
        const matched = CAVITY_LABELS.some((label) => key.includes(normalizeFieldKey(label)))
        if (!matched) continue

        for (let offset = 1; offset <= 4; offset += 1) {
          const right = normalizeText(row[c + offset])
          if (right) {
            candidates.push(right)
            break
          }
        }
        for (let offset = 1; offset <= 2; offset += 1) {
          const nextRow = Array.isArray(rows[r + offset]) ? rows[r + offset] : []
          const down = normalizeText(nextRow[c])
          if (down) {
            candidates.push(down)
            break
          }
        }
      }
    }
  }

  const uniq = Array.from(new Set(candidates.map((x) => normalizeText(x)).filter(Boolean)))
  if (!uniq.length) return { value: '', candidates: [] }
  return { value: uniq[0], candidates: uniq }
}

let techSpecCacheReady = false
const ensureTechSpecParseCacheTable = async () => {
  if (techSpecCacheReady) return
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
  techSpecCacheReady = true
}

const upsertTechSpecParseCache = async ({ fdId, attachmentId, fileName, parsedData, parsedMeta }) => {
  const bmoRecordId = String(fdId || '').trim()
  const attachId = String(attachmentId || '').trim()
  if (!bmoRecordId || !attachId || !parsedData || typeof parsedData !== 'object') return false
  await ensureTechSpecParseCacheTable()
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
  return true
}

let cacheTableReady = false
const ensureDetailCacheTable = async () => {
  if (cacheTableReady) return
  await query(`
    IF OBJECT_ID(N'dbo.bmo_mould_detail_cache', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.bmo_mould_detail_cache (
        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        bmo_record_id NVARCHAR(100) NOT NULL,
        demand_type NVARCHAR(100) NULL,
        designer NVARCHAR(100) NULL,
        tech_table_name NVARCHAR(100) NULL,
        mech_auth_token NVARCHAR(255) NULL,
        tech_fields_json NVARCHAR(MAX) NULL,
        tech_attachments_json NVARCHAR(MAX) NULL,
        raw_json NVARCHAR(MAX) NULL,
        source_updated_at DATETIME2 NOT NULL CONSTRAINT DF_bmo_mould_detail_cache_source_updated_at DEFAULT (SYSDATETIME()),
        created_at DATETIME2 NOT NULL CONSTRAINT DF_bmo_mould_detail_cache_created_at DEFAULT (SYSDATETIME()),
        updated_at DATETIME2 NOT NULL CONSTRAINT DF_bmo_mould_detail_cache_updated_at DEFAULT (SYSDATETIME())
      );
      CREATE UNIQUE INDEX UX_bmo_mould_detail_cache_record
        ON dbo.bmo_mould_detail_cache (bmo_record_id);
    END
  `)
  cacheTableReady = true
}

const upsertDetailCache = async (detail) => {
  const bmoRecordId = String(detail?.fdId || '').trim()
  if (!bmoRecordId) return false
  await ensureDetailCacheTable()
  await query(
    `
      MERGE dbo.bmo_mould_detail_cache AS target
      USING (
        SELECT
          @bmoRecordId AS bmo_record_id,
          @demandType AS demand_type,
          @designer AS designer,
          @techTableName AS tech_table_name,
          @mechAuthToken AS mech_auth_token,
          @techFieldsJson AS tech_fields_json,
          @techAttachmentsJson AS tech_attachments_json,
          @rawJson AS raw_json
      ) AS source
      ON target.bmo_record_id = source.bmo_record_id
      WHEN MATCHED THEN
        UPDATE SET
          demand_type = source.demand_type,
          designer = source.designer,
          tech_table_name = source.tech_table_name,
          mech_auth_token = source.mech_auth_token,
          tech_fields_json = source.tech_fields_json,
          tech_attachments_json = source.tech_attachments_json,
          raw_json = source.raw_json,
          source_updated_at = SYSDATETIME(),
          updated_at = SYSDATETIME()
      WHEN NOT MATCHED THEN
        INSERT (
          bmo_record_id, demand_type, designer, tech_table_name, mech_auth_token,
          tech_fields_json, tech_attachments_json, raw_json, source_updated_at, created_at, updated_at
        )
        VALUES (
          source.bmo_record_id, source.demand_type, source.designer, source.tech_table_name, source.mech_auth_token,
          source.tech_fields_json, source.tech_attachments_json, source.raw_json, SYSDATETIME(), SYSDATETIME(), SYSDATETIME()
        );
    `,
    {
      bmoRecordId,
      demandType: detail?.demandType || null,
      designer: detail?.designer || null,
      techTableName: detail?.tech?.tableName || null,
      mechAuthToken: detail?.tech?.mechAuthToken || null,
      techFieldsJson: JSON.stringify(detail?.tech?.fields || []),
      techAttachmentsJson: JSON.stringify(detail?.tech?.attachments || []),
      rawJson: JSON.stringify(detail || {})
    }
  )
  return true
}

const getDetailCacheByRecordId = async (fdId) => {
  const bmoRecordId = String(fdId || '').trim()
  if (!bmoRecordId) return null
  await ensureDetailCacheTable()
  const rows = await query(
    `
      SELECT TOP 1
        bmo_record_id,
        demand_type,
        designer,
        tech_table_name,
        mech_auth_token,
        tech_fields_json,
        tech_attachments_json,
        raw_json
      FROM dbo.bmo_mould_detail_cache
      WHERE bmo_record_id = @bmoRecordId;
    `,
    { bmoRecordId }
  )
  const row = rows?.[0]
  if (!row) return null

  const parseJson = (text, fallback) => {
    try {
      return text ? JSON.parse(text) : fallback
    } catch (e) {
      return fallback
    }
  }

  const raw = parseJson(row.raw_json, null)
  if (raw && typeof raw === 'object') return raw
  return {
    fdId: row.bmo_record_id,
    demandType: row.demand_type || null,
    designer: row.designer || null,
    tech: {
      tableName: row.tech_table_name || null,
      mechAuthToken: row.mech_auth_token || null,
      fields: parseJson(row.tech_fields_json, []),
      attachments: parseJson(row.tech_attachments_json, [])
    }
  }
}

const fetchRecentRecordIdsFromDb = async (limit) => {
  const safeLimit = toPositiveInt(limit, 40, 1, 500)
  const rows = await query(`
    SELECT TOP (${safeLimit}) bmo_record_id
    FROM bmo_mould_procurement
    WHERE bmo_record_id IS NOT NULL
    ORDER BY
      CASE WHEN source_create_time IS NULL THEN 1 ELSE 0 END,
      source_create_time DESC,
      id DESC;
  `)
  return (rows || []).map((r) => String(r?.bmo_record_id || '').trim()).filter(Boolean)
}

const isExcelAttachment = (x) => {
  const ext = String(x?.fileExt || '').toLowerCase()
  const name = String(x?.fileName || '').toLowerCase()
  return ext === 'xlsx' || ext === 'xls' || name.endsWith('.xlsx') || name.endsWith('.xls')
}

const autoDownloadTechAttachmentsByRelay = async (detail, options = {}) => {
  if (!isRelayEnabled()) return { queued: 0, success: 0, failed: 0 }
  const attachments = Array.isArray(detail?.tech?.attachments) ? detail.tech.attachments : []
  const fdId = String(detail?.fdId || '').trim()
  if (!fdId || !attachments.length) return { queued: 0, success: 0, failed: 0 }

  const maxPerRecord = toPositiveInt(options.maxPerRecord, 1, 1, 5)
  const candidates = attachments.filter((a) => a?.id && isExcelAttachment(a)).slice(0, maxPerRecord)
  let queued = 0
  let success = 0
  let failed = 0
  let parsedSuccess = 0
  let parsedFailed = 0
  for (const a of candidates) {
    queued += 1
    try {
      const created = await relayRequestJson('/jobs', {
        method: 'POST',
        timeoutMs: 15000,
        body: {
          type: 'download_attachment',
          payload: {
            fdId,
            attachmentId: String(a.id),
            ...(a?.fileName ? { fileName: String(a.fileName) } : {})
          }
        }
      })
      const jobId = String(created?.data?.id || created?.id || '').trim()
      if (!jobId) throw new Error('relay missing jobId')
      const done = await relayWaitJob(jobId, { timeoutMs: 120000, intervalMs: 1000 })
      if (String(done?.status || '') === 'success') {
        success += 1
        try {
          const fileId = String(done?.result?.fileId || '').trim()
          if (fileId) {
            const fileBuffer = await relayDownloadFileBuffer(fileId, 45000)
            const parsed = extractCavityFromExcelBuffer(fileBuffer)
            const cavityValue = normalizeText(parsed?.value)
            if (cavityValue) {
              await upsertTechSpecParseCache({
                fdId,
                attachmentId: String(a.id),
                fileName: String(a?.fileName || done?.result?.fileName || '').trim() || null,
                parsedData: {
                  模具穴数: cavityValue,
                  __autoParsedBy: 'bmo-auto-sync',
                  __autoParsedAt: new Date().toISOString()
                },
                parsedMeta: {
                  source: 'relay-auto-download-parse',
                  fileId,
                  cavityCandidates: parsed?.candidates || []
                }
              })
              parsedSuccess += 1
            } else {
              parsedFailed += 1
            }
          } else {
            parsedFailed += 1
          }
        } catch (parseError) {
          parsedFailed += 1
        }
      } else failed += 1
    } catch (e) {
      failed += 1
    }
  }
  return { queued, success, failed, parsedSuccess, parsedFailed }
}

const collectViaRelayPages = async (input = {}) => {
  const pageSize = toPositiveInt(input.pageSize, 200, 1, 500)
  const maxPages = toPositiveInt(input.maxPages, 10, 1, 100)
  let offset = 0
  let total = null
  let traceId = null
  const list = []

  for (let page = 0; page < maxPages; page += 1) {
    const created = await relayRequestJson('/jobs', {
      method: 'POST',
      timeoutMs: 15000,
      body: {
        type: 'collect',
        payload: { pageSize, offset }
      }
    })
    const jobId = String(created?.data?.id || created?.id || '').trim()
    if (!jobId) throw new Error('relay collect 创建任务失败（缺少 jobId）')
    const done = await relayWaitJob(jobId, {
      timeoutMs: 180000,
      intervalMs: 1000
    })
    if (String(done?.status || '') !== 'success') {
      throw new Error(String(done?.error || 'relay collect failed'))
    }
    const result = done?.result && typeof done.result === 'object' ? done.result : {}
    const pageList = Array.isArray(result?.list) ? result.list : []
    if (result?.traceId) traceId = result.traceId
    if (Number.isFinite(Number(result?.total))) total = Number(result.total)
    list.push(...pageList)
    if (!pageList.length || pageList.length < pageSize) break
    offset += pageSize
    if (total !== null && offset >= total) break
  }
  return { list, traceId }
}

let autoSyncRunning = false

const runBmoAutoSyncOnce = async (options = {}) => {
  if (autoSyncRunning) return { skipped: true, message: 'auto sync is already running' }
  autoSyncRunning = true
  try {
    const pageSize = toPositiveInt(options.pageSize || process.env.BMO_AUTO_SYNC_PAGE_SIZE, 200, 1, 500)
    const maxPages = toPositiveInt(options.maxPages || process.env.BMO_AUTO_SYNC_MAX_PAGES, 10, 1, 100)
    const detailLimit = toPositiveInt(options.detailLimit || process.env.BMO_AUTO_SYNC_DETAIL_LIMIT, 40, 1, 300)
    const downloadPerRecord = toPositiveInt(
      options.downloadPerRecord || process.env.BMO_AUTO_SYNC_DOWNLOAD_PER_RECORD,
      1,
      1,
      5
    )

    let list = []
    let traceId = null

    if (isRelayEnabled()) {
      const relayResult = await collectViaRelayPages({ pageSize, maxPages })
      list = relayResult.list || []
      traceId = relayResult.traceId || null
    } else {
      // Fallback for non-relay environments.
      const live = await fetchBmoMouldListLive({ pageSize, offset: 0 })
      list = live?.list || []
      traceId = live?.traceId || null
    }

    const upserted = await upsertBmoRecords(list, traceId)

    const ids = Array.from(
      new Set(
        (list || [])
          .map((x) => String(x?.bmoRecordId || x?.bmo_record_id || '').trim())
          .filter(Boolean)
      )
    )
    const targetIds = ids.length ? ids.slice(0, detailLimit) : await fetchRecentRecordIdsFromDb(detailLimit)

    let detailUpserted = 0
    let detailFailed = 0
    let downloadQueued = 0
    let downloadSuccess = 0
    let downloadFailed = 0
    let parseSuccess = 0
    let parseFailed = 0
    for (const fdId of targetIds) {
      try {
        const detail = await fetchBmoMouldDetail({ fdId })
        const ok = await upsertDetailCache(detail)
        if (ok) detailUpserted += 1
        const d = await autoDownloadTechAttachmentsByRelay(detail, {
          maxPerRecord: downloadPerRecord
        })
        downloadQueued += d.queued
        downloadSuccess += d.success
        downloadFailed += d.failed
        parseSuccess += Number(d.parsedSuccess || 0)
        parseFailed += Number(d.parsedFailed || 0)
      } catch (e) {
        detailFailed += 1
      }
    }

    return {
      skipped: false,
      fetched: list.length,
      upserted,
      detailTarget: targetIds.length,
      detailUpserted,
      detailFailed,
      downloadQueued,
      downloadSuccess,
      downloadFailed,
      parseSuccess,
      parseFailed,
      traceId,
      syncedAt: new Date().toISOString()
    }
  } finally {
    autoSyncRunning = false
  }
}

let started = false
let timer = null
const startBmoAutoSyncLoop = () => {
  if (started) return
  started = true
  // After BMO capability is centralized into jiuhuan-hub, craftsys should not auto-sync by default.
  const enabled = String(process.env.BMO_AUTO_SYNC_ENABLED || '0') !== '0'
  if (!enabled) {
    console.log('[bmo-auto-sync] disabled by BMO_AUTO_SYNC_ENABLED=0')
    return
  }
  const intervalMs = toPositiveInt(process.env.BMO_AUTO_SYNC_INTERVAL_MS, 60 * 60 * 1000, 60000)
  const startupDelayMs = toPositiveInt(process.env.BMO_AUTO_SYNC_STARTUP_DELAY_MS, 15000, 1000)

  const runWithLog = async (reason) => {
    try {
      const result = await runBmoAutoSyncOnce()
      console.log('[bmo-auto-sync]', reason, result)
    } catch (e) {
      console.error('[bmo-auto-sync] failed:', e?.message || e)
    }
  }

  setTimeout(() => {
    void runWithLog('startup')
  }, startupDelayMs).unref()

  timer = setInterval(() => {
    void runWithLog('interval')
  }, intervalMs)
  timer.unref()
}

module.exports = {
  ensureDetailCacheTable,
  getDetailCacheByRecordId,
  upsertDetailCache,
  runBmoAutoSyncOnce,
  startBmoAutoSyncLoop
}
