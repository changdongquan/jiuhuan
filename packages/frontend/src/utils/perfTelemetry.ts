import { useUserStoreWithOut } from '@/store/modules/user'

type PerfEventInput = {
  eventType: string
  level?: 'warn' | 'error' | 'info'
  route?: string
  title?: string
  method?: string
  url?: string
  status?: number
  durationMs?: number
  message?: string
  detail?: Record<string, unknown> | null
}

type NavigatorWithConnection = Navigator & {
  connection?: {
    effectiveType?: string
    type?: string
    downlink?: number
    rtt?: number
  }
}

const ENDPOINT = '/api/telemetry/frontend-perf'
const REPORT_THROTTLE_MS = 10_000
const recentEventMap = new Map<string, number>()

const normalizeDisplayNameHeader = (value: string) => {
  const text = String(value || '').trim()
  return text ? encodeURIComponent(text) : ''
}

const buildDedupKey = (event: PerfEventInput) =>
  [
    event.eventType,
    event.route || '',
    event.method || '',
    event.url || '',
    String(event.status || ''),
    event.message || ''
  ].join('|')

const collectDeviceContext = () => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      isMobile: null,
      viewportWidth: null,
      viewportHeight: null,
      devicePixelRatio: null,
      networkType: null,
      networkEffectiveType: null,
      networkDownlinkMbps: null,
      networkRttMs: null
    }
  }

  const nav = navigator as NavigatorWithConnection
  const viewportWidth = Number.isFinite(window.innerWidth) ? window.innerWidth : null
  const viewportHeight = Number.isFinite(window.innerHeight) ? window.innerHeight : null
  const dpr = Number.isFinite(window.devicePixelRatio) ? Number(window.devicePixelRatio) : null
  const ua = String(navigator.userAgent || '')
  const isMobile =
    viewportWidth != null
      ? viewportWidth <= 768
      : /Android|iPhone|iPad|iPod|Mobile|HarmonyOS/i.test(ua)

  return {
    isMobile,
    viewportWidth,
    viewportHeight,
    devicePixelRatio: dpr,
    networkType: nav.connection?.type || null,
    networkEffectiveType: nav.connection?.effectiveType || null,
    networkDownlinkMbps:
      typeof nav.connection?.downlink === 'number' ? nav.connection.downlink : null,
    networkRttMs: typeof nav.connection?.rtt === 'number' ? nav.connection.rtt : null
  }
}

export const reportFrontendPerfEvent = (event: PerfEventInput) => {
  if (typeof window === 'undefined' || typeof fetch !== 'function') return

  const dedupKey = buildDedupKey(event)
  const now = Date.now()
  const lastReportedAt = recentEventMap.get(dedupKey) || 0
  if (now - lastReportedAt < REPORT_THROTTLE_MS) return
  recentEventMap.set(dedupKey, now)

  const userStore = useUserStoreWithOut()
  const userInfo: any = userStore.getUserInfo || {}
  const tokenKey = userStore.getTokenKey || 'Authorization'
  const token = userStore.getToken || ''
  const displayName = String(userInfo.realName || userInfo.displayName || '').trim()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Username': String(userInfo.username || '').trim(),
    'X-Display-Name': normalizeDisplayNameHeader(displayName)
  }

  if (token) {
    headers[tokenKey] = token
  }

  const payload = {
    events: [
      {
        ...event,
        clientTs: new Date().toISOString(),
        ...collectDeviceContext()
      }
    ]
  }

  void fetch(ENDPOINT, {
    method: 'POST',
    credentials: 'same-origin',
    keepalive: true,
    headers,
    body: JSON.stringify(payload)
  }).catch(() => {
    // ignore telemetry transport errors
  })
}
