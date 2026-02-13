const express = require('express')
const { query } = require('../database')
const {
  syncBmoMouldData,
  fetchBmoMouldListLive,
  fetchBmoMouldDetail,
  downloadBmoAttachment
} = require('../services/bmoSync')

const router = express.Router()

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

const formatBmoSqlErrorMessage = (error, fallbackMessage) => {
  const message = String(error?.message || '')
  if (
    message.includes("Invalid object name 'bmo_mould_procurement'") ||
    message.includes("Invalid object name 'bmo_sync_task_logs'")
  ) {
    return 'BMO 采集数据表不存在，请先执行迁移：packages/backend/migrations/20260212_create_bmo_sync_tables.sql'
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
    const limit = toSafeLimit(req.query.limit, 50, 2000)
    const rows = await query(
      `
        SELECT TOP (${limit})
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

    const result = await fetchBmoMouldListLive({
      pageSize,
      offset,
      ...(conditions ? { conditions } : {}),
      ...(sorts ? { sorts } : {})
    })

    const list = Array.isArray(result?.list) ? result.list : []
    const projectInfoMap = await getProjectInfoByCustomerModelNo(
      list.map((x) => x.moldNumber).filter(Boolean)
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

module.exports = router
