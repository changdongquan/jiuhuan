const crypto = require('crypto')
const { readAuthFromEnvFile } = require('./bmoSync')

const getRelayBaseUrl = () => String(process.env.BMO_RELAY_BASE_URL || '').trim().replace(/\/+$/, '')
const isRelayEnabled = () => Boolean(getRelayBaseUrl())

const toPositiveInt = (value, fallback) => {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback
}

const readLocalRelayAuth = () => {
  const authFilePath = String(process.env.BMO_AUTH_FILE || '').trim()
  const fromFile = authFilePath ? readAuthFromEnvFile(authFilePath) : null
  const cookie = String(fromFile?.BMO_COOKIE || process.env.BMO_COOKIE || '').trim()
  const token = String(fromFile?.BMO_X_AUTH_TOKEN || process.env.BMO_X_AUTH_TOKEN || '').trim()
  return { cookie, token }
}

const buildAuthFingerprint = (cookie, token) =>
  crypto.createHash('sha256').update(`${cookie}\n${token}`).digest('hex')

const relayRequestJson = async (pathname, input = {}) => {
  const baseUrl = getRelayBaseUrl()
  if (!baseUrl) throw new Error('BMO_RELAY_BASE_URL 未配置')
  const method = String(input.method || 'GET').toUpperCase()
  const timeoutMs = toPositiveInt(input.timeoutMs, 15000)
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
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

let started = false
let timer = null
let syncing = null
let lastSyncedFingerprint = ''

const syncBmoRelayAuthOnce = async (options = {}) => {
  if (!isRelayEnabled()) {
    return { ok: false, skipped: true, reason: 'relay-disabled' }
  }
  if (syncing) return syncing

  syncing = (async () => {
    const { cookie, token } = readLocalRelayAuth()
    if (!cookie && !token) {
      return { ok: false, skipped: true, reason: 'no-local-auth' }
    }

    const fingerprint = buildAuthFingerprint(cookie, token)
    let relayStatus = null
    try {
      relayStatus = await relayRequestJson('/auth/status?probe=1', {
        method: 'GET',
        timeoutMs: toPositiveInt(options.statusTimeoutMs, 15000)
      })
    } catch (error) {
      relayStatus = null
    }

    const relayData =
      relayStatus?.data && typeof relayStatus.data === 'object' ? relayStatus.data : relayStatus
    const probe = relayData?.probe && typeof relayData.probe === 'object' ? relayData.probe : null
    const relayOk = probe?.ok === true
    const relayHasAuth = Boolean(relayData?.hasCookie || relayData?.hasToken)

    if (relayOk && relayHasAuth && lastSyncedFingerprint === fingerprint) {
      return { ok: true, skipped: true, reason: 'relay-already-ok' }
    }

    await relayRequestJson('/auth/set', {
      method: 'POST',
      timeoutMs: toPositiveInt(options.setTimeoutMs, 15000),
      body: {
        ...(cookie ? { cookie } : {}),
        ...(token ? { token } : {})
      }
    })

    const verified = await relayRequestJson('/auth/status?probe=1', {
      method: 'GET',
      timeoutMs: toPositiveInt(options.verifyTimeoutMs, 15000)
    })
    const verifiedData =
      verified?.data && typeof verified.data === 'object' ? verified.data : verified
    const verifiedProbe =
      verifiedData?.probe && typeof verifiedData.probe === 'object' ? verifiedData.probe : null
    if (verifiedProbe?.ok !== true) {
      return {
        ok: false,
        synced: true,
        reason: 'relay-probe-failed',
        status: Number(verifiedProbe?.status || 0),
        message: String(verifiedProbe?.message || '').trim()
      }
    }

    lastSyncedFingerprint = fingerprint
    return { ok: true, synced: true, status: Number(verifiedProbe?.status || 200) }
  })()
    .catch((error) => ({
      ok: false,
      error: String(error?.message || error || '未知错误')
    }))
    .finally(() => {
      syncing = null
    })

  return syncing
}

const startBmoRelayAuthSyncLoop = () => {
  if (started) return
  started = true

  if (String(process.env.BMO_RELAY_AUTH_SYNC_ENABLED || '0') !== '1') {
    console.log('[bmo-relay-auth-sync] disabled by BMO_RELAY_AUTH_SYNC_ENABLED=0')
    return
  }
  if (!isRelayEnabled()) return

  const intervalMs = toPositiveInt(process.env.BMO_RELAY_AUTH_SYNC_INTERVAL_MS, 5 * 60 * 1000)

  const run = async (reason) => {
    const result = await syncBmoRelayAuthOnce()
    if (!result?.ok && !result?.skipped) {
      console.warn('[bmo-relay-auth-sync]', reason, result)
      return
    }
    if (result?.ok && result?.synced) {
      console.log('[bmo-relay-auth-sync]', reason, result)
    }
  }

  void run('startup')
  timer = setInterval(() => {
    void run('interval')
  }, intervalMs)
}

module.exports = {
  syncBmoRelayAuthOnce,
  startBmoRelayAuthSyncLoop
}
