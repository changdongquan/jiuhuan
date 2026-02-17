const express = require('express')
const { query, getPool } = require('../database')
const sql = require('mssql')
const {
  syncBmoMouldData,
  fetchBmoMouldListLive,
  fetchBmoMouldDetail,
  downloadBmoAttachment,
  upsertBmoRecords
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

const router = express.Router()
let persistInFlight = null

router.get('/health', (req, res) => {
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

router.get('/status', (req, res) => {
  return res.json({
    code: 0,
    success: true,
    data: {
      ...getBmoStatus()
    }
  })
})

router.post('/session/ensure', async (req, res) => {
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
    const isExpired = msg.includes('HTTP 401') || msg.includes('401') || msg.includes('未配置 BMO 认证信息')
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
          bid_time
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
            bid_time
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

router.post('/sync', async (req, res) => {
  try {
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

router.post('/sync/retry/:taskId', async (req, res) => {
  try {
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
        count: rows.length
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
router.get('/mould-procurement/refresh', async (req, res) => {
  const maxWaitMs = toSafeInt(req.query.maxWaitMs, 3000)
  const pageSize = toSafeLimit(req.query.pageSize ?? req.query.limit, 200, 200)
  const offset = toSafeInt(req.query.offset, 0)
  const conditions = parseQueryJsonObject(req.query.conditions)
  const sorts = parseQueryJsonObject(req.query.sorts)

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
    if (!persistInFlight) {
      markPersistStart()
      persistInFlight = Promise.resolve()
        .then(async () => {
          const upserted = await upsertBmoRecords(list, liveResult?.traceId || null)
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
          count: rows.length
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
    if (!fdId) {
      return res.status(400).json({ code: 400, success: false, message: '缺少 fdId' })
    }

    const detail = await fetchBmoMouldDetail({ fdId })
    return res.json({ code: 0, success: true, data: detail })
  } catch (error) {
    console.error('读取 BMO 模具清单详情失败:', error)
    return res.status(500).json({
      code: 500,
      success: false,
      message: '读取 BMO 模具清单详情失败: ' + (error?.message || '未知错误')
    })
  }
})

router.get('/attachment/download/:attachmentId', async (req, res) => {
  try {
    const attachmentId = String(req.params.attachmentId || '').trim()
    if (!attachmentId) {
      return res.status(400).json({ code: 400, success: false, message: '缺少 attachmentId' })
    }

    const upstream = await downloadBmoAttachment(attachmentId)
    if (!upstream.ok) {
      return res.status(upstream.status || 502).json({
        code: upstream.status || 502,
        success: false,
        message: `BMO 下载失败: HTTP ${upstream.status}`
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

// === BMO 立项申请单（申请/确认/审核/自动入库） ===
const safeJsonParse = (s) => {
  if (!s) return null
  try {
    return JSON.parse(String(s))
  } catch (e) {
    return null
  }
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

const upsertInitiationDraft = async (input) => {
  const bmoRecordId = String(input?.bmo_record_id || input?.fdId || input?.bmoRecordId || '').trim()
  if (!bmoRecordId) throw new Error('缺少 bmo_record_id')

  const actor = input?.actor || null
  const projectCodeCandidate = input?.project_code_candidate ? String(input.project_code_candidate).trim() : null
  const goodsDraftJson = input?.goods_draft ? JSON.stringify(input.goods_draft) : null
  const salesDraftJson = input?.sales_order_draft ? JSON.stringify(input.sales_order_draft) : null
  const techSnapshotJson = input?.tech_snapshot ? JSON.stringify(input.tech_snapshot) : null

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

router.post('/initiation-request/draft', async (req, res) => {
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
    return res.status(500).json({
      code: 500,
      success: false,
      message: formatBmoSqlErrorMessage(error, '保存 BMO 立项草稿失败')
    })
  }
})

router.post('/initiation-request/confirm', async (req, res) => {
  try {
    const actor = resolveActorFromReq(req)
    const bmoRecordId = String(req.body?.bmo_record_id || req.body?.fdId || '').trim()
    if (!bmoRecordId) return res.status(400).json({ code: 400, success: false, message: '缺少 bmo_record_id' })

    // Ensure draft exists and is up-to-date.
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
    return res.json({ code: 0, success: true, data: row })
  } catch (error) {
    console.error('确认 BMO 立项申请单失败:', error)
    return res.status(500).json({
      code: 500,
      success: false,
      message: formatBmoSqlErrorMessage(error, '确认 BMO 立项申请单失败')
    })
  }
})

router.post('/initiation-request/reject', async (req, res) => {
  try {
    const actor = resolveActorFromReq(req)
    const bmoRecordId = String(req.body?.bmo_record_id || req.body?.fdId || '').trim()
    const reason = String(req.body?.reason || '').trim()
    if (!bmoRecordId) return res.status(400).json({ code: 400, success: false, message: '缺少 bmo_record_id' })
    if (!reason) return res.status(400).json({ code: 400, success: false, message: '缺少驳回原因' })

    await query(
      `
        UPDATE dbo.bmo_initiation_requests
        SET status = N'REJECTED',
            rejected_reason = @reason,
            updated_at = SYSDATETIME()
        WHERE bmo_record_id = @bmoRecordId
      `,
      { bmoRecordId, reason }
    )
    return res.json({ code: 0, success: true, message: '已驳回' })
  } catch (error) {
    console.error('驳回 BMO 立项申请单失败:', error)
    return res.status(500).json({
      code: 500,
      success: false,
      message: formatBmoSqlErrorMessage(error, '驳回 BMO 立项申请单失败')
    })
  }
})

router.post('/initiation-request/approve-and-apply', async (req, res) => {
  try {
    const actor = resolveActorFromReq(req)
    const bmoRecordId = String(req.body?.bmo_record_id || req.body?.fdId || '').trim()
    if (!bmoRecordId) return res.status(400).json({ code: 400, success: false, message: '缺少 bmo_record_id' })

    const rows = await query(
      `SELECT TOP 1 * FROM dbo.bmo_initiation_requests WHERE bmo_record_id = @bmoRecordId`,
      { bmoRecordId }
    )
    const requestRow = rows?.[0] || null
    if (!requestRow) {
      return res.status(404).json({ code: 404, success: false, message: '立项申请单不存在' })
    }
    if (String(requestRow.status || '') === 'APPLIED') {
      return res.json({
        code: 0,
        success: true,
        message: '已入库（跳过）',
        data: { projectCode: requestRow.project_code_final, orderNo: requestRow.sales_order_no }
      })
    }
    if (String(requestRow.status || '') !== 'PM_CONFIRMED') {
      return res.status(400).json({ code: 400, success: false, message: '未确认，不能入库' })
    }

    const goodsDraft = safeJsonParse(requestRow.goods_draft_json) || {}
    const salesDraft = safeJsonParse(requestRow.sales_order_draft_json) || {}
    const projectCode = String(goodsDraft.projectCode || requestRow.project_code_candidate || '').trim()
    if (!projectCode) return res.status(400).json({ code: 400, success: false, message: '缺少项目编号' })

    const pool = await getPool()
    const tx = new sql.Transaction(pool)
    await tx.begin()
    try {
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
        await upd.query(`
          UPDATE dbo.bmo_initiation_requests
          SET status = N'APPLIED',
              project_code_final = @projectCode,
              sales_order_no = @orderNo,
              approved_by = @actor,
              approved_at = SYSDATETIME(),
              updated_at = SYSDATETIME()
          WHERE bmo_record_id = @bmoRecordId
        `)
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
    return res.status(500).json({
      code: 500,
      success: false,
      message: formatBmoSqlErrorMessage(error, '审核并入库失败')
    })
  }
})

module.exports = router
