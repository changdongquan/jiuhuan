const express = require('express')
const fs = require('fs')
const path = require('path')
const { resolveActorFromReq } = require('../utils/actor')

const router = express.Router()
const fsp = fs.promises
const LOG_DIR = path.resolve(__dirname, '../logs')
const FRONTEND_PERF_LOG_FILE = path.join(LOG_DIR, 'frontend-perf.ndjson')
const MAX_EVENT_COUNT = 20

const ensureDirSync = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

const normalizeText = (value, maxLength = 500) => {
  const text = String(value || '').trim()
  if (!text) return null
  return text.slice(0, maxLength)
}

const normalizeNumber = (value) => {
  const n = Number(value)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null
}

router.post('/frontend-perf', async (req, res) => {
  try {
    const payload = req.body
    const inputEvents = Array.isArray(payload?.events)
      ? payload.events
      : payload && typeof payload === 'object'
        ? [payload]
        : []

    if (!inputEvents.length) {
      return res.status(400).json({ code: 400, success: false, message: '缺少性能事件' })
    }

    const actor = resolveActorFromReq(req)
    const username = normalizeText(req?.auth?.username || req?.headers?.['x-username'], 120)
    const requestId = normalizeText(
      req.headers['x-request-id'] || req.headers['x-correlation-id'],
      120
    )
    const userAgent = normalizeText(req.headers['user-agent'], 500)
    const remoteAddress = normalizeText(
      req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip,
      200
    )

    const normalizedEvents = inputEvents
      .slice(0, MAX_EVENT_COUNT)
      .map((item) => ({
        eventType: normalizeText(item?.eventType || item?.type || 'unknown', 80) || 'unknown',
        level: normalizeText(item?.level || 'warn', 20) || 'warn',
        route: normalizeText(item?.route, 300),
        title: normalizeText(item?.title, 200),
        method: normalizeText(item?.method, 20),
        url: normalizeText(item?.url, 1000),
        status: Number.isFinite(Number(item?.status)) ? Number(item.status) : null,
        durationMs: normalizeNumber(item?.durationMs),
        message: normalizeText(item?.message, 1000),
        detail: item?.detail && typeof item.detail === 'object' ? item.detail : null,
        clientTs: normalizeText(item?.clientTs, 80),
        isMobile:
          typeof item?.isMobile === 'boolean'
            ? item.isMobile
            : String(item?.isMobile || '').trim()
              ? String(item.isMobile).trim().toLowerCase() === 'true'
              : null,
        viewportWidth: Number.isFinite(Number(item?.viewportWidth)) ? Number(item.viewportWidth) : null,
        viewportHeight: Number.isFinite(Number(item?.viewportHeight))
          ? Number(item.viewportHeight)
          : null,
        devicePixelRatio: normalizeNumber(item?.devicePixelRatio),
        networkType: normalizeText(item?.networkType, 60),
        networkEffectiveType: normalizeText(item?.networkEffectiveType, 60),
        networkDownlinkMbps: normalizeNumber(item?.networkDownlinkMbps),
        networkRttMs: normalizeNumber(item?.networkRttMs)
      }))
      .filter((item) => item.eventType)

    if (!normalizedEvents.length) {
      return res.status(400).json({ code: 400, success: false, message: '性能事件格式无效' })
    }

    ensureDirSync(LOG_DIR)

    const lines = normalizedEvents
      .map((event) =>
        JSON.stringify({
          serverTs: new Date().toISOString(),
          actor,
          username,
          requestId,
          userAgent,
          remoteAddress,
          ...event
        })
      )
      .join('\n')

    await fsp.appendFile(FRONTEND_PERF_LOG_FILE, `${lines}\n`, 'utf8')

    return res.json({
      code: 0,
      success: true,
      data: { accepted: normalizedEvents.length }
    })
  } catch (error) {
    console.error('写入前端性能日志失败:', error)
    return res.status(500).json({
      code: 500,
      success: false,
      message: '写入前端性能日志失败'
    })
  }
})

module.exports = router
