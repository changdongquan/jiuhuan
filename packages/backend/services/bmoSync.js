const { query } = require('../database')
const crypto = require('crypto')
const fs = require('fs')
const os = require('os')
const path = require('path')

const DEFAULT_BASE_URL = 'https://bmo.meiling.com:8023'
const DEFAULT_DATA_ENDPOINT = '/data/sys-modeling/sysModelingMain/data'
const DEFAULT_VIEW_ENDPOINT = '/data/sys-modeling/sysModelingMain/view'
const DEFAULT_LOGIN_ENDPOINT = '/data/sys-auth/login'
const DEFAULT_LOGIN_PAGE_ENDPOINT = '/data/sys-portal/sysPortalLoginPage/loginPage'
const DEFAULT_VERIFICATION_CHECK_ENDPOINT = '/data/sys-auth/verificationCode/check'
const DEFAULT_HTTP_TIMEOUT_MS = 15000

// 1.4-模具清单详情：表单配置（用于字段中文名、选项映射、表字段集合）
const DEFAULT_MOULD_DETAIL_FORM_CONFIG_PATH =
  '/web/tenant/0/manufact/release/form/config/1j9135nq6wfgw18shworp7ev3tdaie51liw0/448595122a8968c876b61c6f14c002b3.json'
const DEFAULT_MOULD_DETAIL_VIEW_ID = '1irp0kk3gwbrwis9nw2ojg5as35h08qs3vw0'
const DEFAULT_MOULD_DETAIL_FORM_ID = '1irp0kjmvwbrwis74wkebru36jtraf1cs5w0'
const DEFAULT_MOULD_DETAIL_XFORM_ID = '1irp0kjmvwbrwis74wkebru36jtraf1cs5w0'
const DEFAULT_MOULD_TECH_REQUIREMENTS_TABLE = 'mk_model_20250521q2w2c_s_5js8e'
const DEFAULT_MOULD_FIELD_LABEL_MAP = {
  fd_col_o527xg: '模具腔数',
  fd_col_pt6kmk: '模具腔数',
  fd_col_i399sd: '模架',
  fd_col_rkue4b: '型腔要求',
  fd_col_qqqcjm: '型芯要求',
  fd_col_ax14sg: '型腔钢材',
  fd_col_uex1wi: '型芯钢材',
  fd_col_p503gk: '型腔热处理方式',
  fd_col_fu56xl: '型芯热处理方式',
  fd_col_ph3n8d: '浇口类型',
  fd_col_46l6dp: '浇口数量',
  fd_col_c8vviq: '流道类型',
  fd_col_id7g4w: '产品尺寸/mm',
  fd_col_epspco: '模具特殊需求及风险',
  fd_col_4e8fal: '通用技术要求'
}

const FORM_CONFIG_CACHE_TTL_MS = 60 * 60 * 1000
let cachedFormConfigMeta = null
let cachedFormConfigAt = 0

const getRelayBaseUrl = () => String(process.env.BMO_RELAY_BASE_URL || '').trim().replace(/\/+$/, '')
const isRelayEnabled = () => Boolean(getRelayBaseUrl())
const isHubOnlyMode = () => String(process.env.BMO_HUB_ONLY || '1') !== '0'

// Reuse one client instance to avoid logging in on every request (BMO may rate-limit / slow down).
let sharedClient = null
let sharedLoginPromise = null

const DEFAULT_AUTH_FILE_CACHE_TTL_MS = 2000
let cachedAuthFile = null
let cachedAuthFileMtimeMs = 0
let cachedAuthFileAt = 0

const parseEnvFileValue = (raw) => {
  if (raw === null || raw === undefined) return ''
  let v = String(raw).trim()
  if (!v) return ''
  if (
    (v.startsWith('"') && v.endsWith('"') && v.length >= 2) ||
    (v.startsWith("'") && v.endsWith("'") && v.length >= 2)
  ) {
    v = v.slice(1, -1)
  }
  return v
}

const readAuthFromEnvFile = (filePath) => {
  const p = String(filePath || '').trim()
  if (!p) return null
  try {
    const stat = fs.statSync(p)
    const now = Date.now()
    if (
      cachedAuthFile &&
      now - cachedAuthFileAt < DEFAULT_AUTH_FILE_CACHE_TTL_MS &&
      cachedAuthFileMtimeMs === stat.mtimeMs
    ) {
      return cachedAuthFile
    }

    const text = fs.readFileSync(p, 'utf8')
    const out = {}
    for (const lineRaw of text.split(/\r?\n/)) {
      const line = String(lineRaw || '').trim()
      if (!line || line.startsWith('#')) continue
      const cleaned = line.startsWith('export ') ? line.slice(7).trim() : line
      const idx = cleaned.indexOf('=')
      if (idx <= 0) continue
      const key = cleaned.slice(0, idx).trim()
      const value = cleaned.slice(idx + 1).trim()
      if (!key) continue
      out[key] = parseEnvFileValue(value)
    }

    cachedAuthFile = out
    cachedAuthFileMtimeMs = stat.mtimeMs
    cachedAuthFileAt = now
    return out
  } catch (e) {
    return null
  }
}

const getSharedClient = () => {
  if (!sharedClient) {
    sharedClient = new BmoClient()
  }
  return sharedClient
}

const refreshClientStaticAuth = (client) => {
  if (!client) return

  // Prefer explicit env vars (process env / packages/backend/.env), but allow hot-reload from an env file
  // written by a session keeper (e.g. /etc/jh-craftsys/secrets/bmo.env).
  const authFilePath = process.env.BMO_AUTH_FILE || ''
  const fromFile = authFilePath ? readAuthFromEnvFile(authFilePath) : null

  // If auth file is configured, prefer its values so keeper refresh can take effect without restarting backend.
  const cookie = fromFile?.BMO_COOKIE || process.env.BMO_COOKIE || ''
  const token = fromFile?.BMO_X_AUTH_TOKEN || process.env.BMO_X_AUTH_TOKEN || ''

  if (cookie) client.cookie = cookie
  if (token) client.authToken = token
}

const ensureClientAuthed = async (client) => {
  refreshClientStaticAuth(client)
  if (client.hasStaticAuth) return
  if (!client.hasLoginAuth) {
    throw new Error(
      '未配置 BMO 认证信息。请配置 BMO_COOKIE/BMO_X_AUTH_TOKEN，或配置 BMO_USERNAME/BMO_PASSWORD'
    )
  }

  if (!sharedLoginPromise) {
    sharedLoginPromise = client
      .login()
      .catch((e) => {
        // Keep the client, but clear any partial auth state to force a clean login next time.
        try {
          client.cookie = ''
          client.authToken = ''
        } catch (err) {
          // ignore
        }
        throw e
      })
      .finally(() => {
        sharedLoginPromise = null
      })
  }
  await sharedLoginPromise
}

const DEFAULT_LIST_QUERY = {
  fdListViewId: '1isqa135kwe9w4adow1ng3ksi3rrcgl912w0',
  fdMode: 1,
  type: 'list',
  navId: '1j7l907fiwmnw15nidw1m9cagh1kfm6tb3w0',
  sorts: { fd_create_time: 'desc' },
  conditions: {},
  pageSize: 25,
  params: {}
}

const toPositiveInt = (value, fallback) => {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : fallback
}

const relayRequestJson = async (pathname, input = {}) => {
  const baseUrl = getRelayBaseUrl()
  if (!baseUrl) throw new Error('BMO_RELAY_BASE_URL 未配置')
  const method = String(input.method || 'GET').toUpperCase()
  const timeoutMs = toPositiveInt(input.timeoutMs, 60000)
  const body = input.body

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), Math.max(1000, timeoutMs))
  try {
    const resp = await fetch(`${baseUrl}${pathname}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal
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
        (json && (json.message || json.detail || json.error)) || text || `relay HTTP ${resp.status}`
      throw new Error(String(errMsg).slice(0, 500))
    }
    if (json && typeof json === 'object') return json
    throw new Error('relay 返回非 JSON')
  } finally {
    clearTimeout(timer)
  }
}

const relayWaitJob = async (jobId, options = {}) => {
  const timeoutMs = toPositiveInt(options.timeoutMs, 120000)
  const intervalMs = toPositiveInt(options.intervalMs, 1000)
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

const parseJsonObject = (raw, fallback = null) => {
  if (!raw) return fallback
  try {
    const parsed = JSON.parse(String(raw))
    return parsed && typeof parsed === 'object' ? parsed : fallback
  } catch (e) {
    return fallback
  }
}

const readCookieHeader = (headers) => {
  if (!headers || typeof headers.getSetCookie !== 'function') return null
  const setCookies = headers.getSetCookie()
  if (!Array.isArray(setCookies) || !setCookies.length) return null
  return setCookies
    .map((cookie) => String(cookie || '').split(';')[0].trim())
    .filter(Boolean)
    .join('; ')
}

const mergeCookieHeader = (currentCookie, nextCookie) => {
  const parse = (raw) =>
    String(raw || '')
      .split(';')
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => {
        const idx = x.indexOf('=')
        if (idx <= 0) return null
        return [x.slice(0, idx).trim(), x.slice(idx + 1).trim()]
      })
      .filter(Boolean)

  const merged = new Map(parse(currentCookie))
  for (const [k, v] of parse(nextCookie)) merged.set(k, v)
  return Array.from(merged.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join('; ')
}

const pemFromBase64Spki = (base64) => {
  const clean = String(base64 || '').trim()
  if (!clean) return null
  const wrapped = clean.match(/.{1,64}/g)?.join('\n') || clean
  return `-----BEGIN PUBLIC KEY-----\n${wrapped}\n-----END PUBLIC KEY-----\n`
}

const encryptPasswordRsa = (publicKeyPem, password, paddingMode) => {
  const plaintext = Buffer.from(String(password || ''), 'utf8')
  const mode = String(paddingMode || 'pkcs1').toLowerCase()
  const options =
    mode === 'oaep'
      ? { key: publicKeyPem, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING }
      : { key: publicKeyPem, padding: crypto.constants.RSA_PKCS1_PADDING }
  const encrypted = crypto.publicEncrypt(options, plaintext)
  return encrypted.toString('base64')
}

const normalizeDate = (value) => {
  if (value === null || value === undefined || value === '') return null
  const asNumber = Number(value)
  const date = Number.isFinite(asNumber) ? new Date(asNumber) : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const fetchWithTimeout = async (url, init, timeoutMs) => {
  const ms = Number(timeoutMs)
  const effectiveTimeoutMs = Number.isFinite(ms) && ms > 0 ? ms : DEFAULT_HTTP_TIMEOUT_MS
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), effectiveTimeoutMs)
  try {
    return await fetch(url, { ...(init || {}), signal: controller.signal })
  } catch (e) {
    if (e && (e.name === 'AbortError' || String(e.message || '').includes('aborted'))) {
      throw new Error(`BMO 请求超时（${effectiveTimeoutMs}ms）`)
    }
    throw e
  } finally {
    clearTimeout(timer)
  }
}

const buildListPayload = (options, offset) => {
  return {
    fdListViewId: options.fdListViewId,
    fdMode: options.fdMode,
    type: options.type,
    navId: options.navId,
    sorts: options.sorts,
    conditions: options.conditions,
    pageSize: options.pageSize,
    offset,
    params: options.params || {}
  }
}

const mapBmoRecord = (item) => {
  const detail = item?.mk_model_20250521q2w2c_s_3zs0l || {}
  return {
    bmoRecordId: item?.fd_id || null,
    moldNumber: item?.fd_mold_number || null,
    partNo: item?.fd_col_zxcef7 || null,
    partName: item?.fd_col_hd3pvs || null,
    moldType: item?.fd_col_ctjpe2 || null,
    model: item?.fd_col_00b6rj || null,
    budgetWanTaxIncl: item?.fd_col_arsf4h ?? null,
    bidPriceTaxIncl: detail?.fd_col_wifvm8 ?? null,
    supplier: detail?.fd_col_zaz21j?.fdName || null,
    projectManager: item?.fd_col_lj5ulc?.fdName || null,
    moldEngineer: item?.fd_col_egn9jl?.fdName || null,
    designer: item?.fd_col_2awc2z?.fdName || null,
    projectNo: item?.fd_col_projectno || null,
    processNo: item?.fd_col_ds3lzr || null,
    assetNo: item?.fd_col_b8gvrm || null,
    progressDays: item?.fd_progress ?? null,
    // BMO UI: "中标时间" is in detail.fd_col_v01znm, while item.fd_col_fp487h corresponds to "立项结束时间".
    bidTime: normalizeDate(detail?.fd_col_v01znm),
    projectEndTime: normalizeDate(item?.fd_col_fp487h),
    // We don't get system field `fd_create_time` back in list response; the list view's
    // time field `fd_col_fp487h` is the best available ordering proxy for matching BMO UI order.
    sourceCreateTime: normalizeDate(item?.fd_col_fp487h),
    rawJson: JSON.stringify(item || {})
  }
}

class BmoClient {
  constructor() {
    this.baseUrl = process.env.BMO_BASE_URL || DEFAULT_BASE_URL
    this.dataEndpoint = process.env.BMO_DATA_ENDPOINT || DEFAULT_DATA_ENDPOINT
    this.viewEndpoint = process.env.BMO_VIEW_ENDPOINT || DEFAULT_VIEW_ENDPOINT
    this.loginEndpoint = process.env.BMO_LOGIN_ENDPOINT || DEFAULT_LOGIN_ENDPOINT
    this.loginPageEndpoint = process.env.BMO_LOGIN_PAGE_ENDPOINT || DEFAULT_LOGIN_PAGE_ENDPOINT
    this.verificationCheckEndpoint =
      process.env.BMO_VERIFICATION_CHECK_ENDPOINT || DEFAULT_VERIFICATION_CHECK_ENDPOINT
    this.httpTimeoutMs = process.env.BMO_HTTP_TIMEOUT_MS || DEFAULT_HTTP_TIMEOUT_MS
    this.userAgent =
      process.env.BMO_USER_AGENT ||
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36'
    this.cookie = process.env.BMO_COOKIE || ''
    this.authToken = process.env.BMO_X_AUTH_TOKEN || ''
    this.username = process.env.BMO_USERNAME || ''
    this.password = process.env.BMO_PASSWORD || ''
    this.loginPayloadTemplate = process.env.BMO_LOGIN_PAYLOAD_TEMPLATE || ''
    this.rsaPadding = process.env.BMO_RSA_PADDING || 'pkcs1'
  }

  get hasStaticAuth() {
    return Boolean(this.cookie || this.authToken)
  }

  get hasLoginAuth() {
    return Boolean(this.username && this.password)
  }

  buildHeaders(extraHeaders = {}) {
    const origin = this.baseUrl.replace(/\/+$/, '')
    const headers = {
      Accept: 'application/json, text/plain, */*',
      'Content-Type': 'application/json;charset=UTF-8',
      'X-Accept-Language': 'zh-CN',
      'Accept-Language': 'zh-CN,zh;q=0.9',
      Origin: origin,
      Referer: `${origin}/web/`,
      'User-Agent': this.userAgent,
      ...extraHeaders
    }
    if (this.cookie) {
      headers.Cookie = this.cookie
    }
    if (this.authToken) {
      headers['X-AUTH-TOKEN'] = this.authToken
    }
    return headers
  }

  buildLoginPayload() {
    if (!this.loginPayloadTemplate) return null
    const replaced = this.loginPayloadTemplate
      .replace(/\{\{username\}\}/g, this.username)
      .replace(/\{\{password\}\}/g, this.password)
    const payload = parseJsonObject(replaced)
    if (!payload) {
      throw new Error('BMO_LOGIN_PAYLOAD_TEMPLATE 不是合法 JSON')
    }
    return payload
  }

  async fetchRsaPubKeyBase64() {
    const res = await fetchWithTimeout(
      new URL(this.loginPageEndpoint, this.baseUrl),
      {
      method: 'POST',
      headers: this.buildHeaders({
        'x-need-pkey': 'RSA'
      }),
      body: JSON.stringify({ fdClient: 1 })
      },
      this.httpTimeoutMs
    )
    if (!res.ok) {
      throw new Error(`BMO 获取登录公钥失败: HTTP ${res.status}`)
    }
    const cookie = readCookieHeader(res.headers)
    if (cookie) {
      this.cookie = mergeCookieHeader(this.cookie, cookie)
    }
    const pubKey = res.headers.get('x-pubkey')
    if (!pubKey) {
      throw new Error('BMO 未返回 x-pubkey，无法进行 RSA 登录')
    }
    return pubKey
  }

  async loginViaRsaForm() {
    // Some deployments may require a preflight verification check (even if captcha is not needed).
    // This call is cheap and matches the browser's login flow.
    try {
      const preflightRes = await fetchWithTimeout(
        new URL(this.verificationCheckEndpoint, this.baseUrl),
        {
          method: 'POST',
          headers: this.buildHeaders(),
          body: JSON.stringify({})
        },
        this.httpTimeoutMs
      )
      const preflightCookie = readCookieHeader(preflightRes.headers)
      if (preflightCookie) {
        this.cookie = mergeCookieHeader(this.cookie, preflightCookie)
      }
    } catch (e) {
      // ignore preflight failures and continue to attempt login
    }

    const pubKeyBase64 = await this.fetchRsaPubKeyBase64()
    const pubKeyPem = pemFromBase64Spki(pubKeyBase64)
    if (!pubKeyPem) {
      throw new Error('BMO 登录公钥为空')
    }
    const encryptedPassword = encryptPasswordRsa(pubKeyPem, this.password, this.rsaPadding)
    const form = new URLSearchParams()
    form.set('j_username', this.username)
    form.set('j_password', encryptedPassword)

    const res = await fetchWithTimeout(
      new URL(this.loginEndpoint, this.baseUrl),
      {
      method: 'POST',
      headers: this.buildHeaders({
        'Content-Type': 'application/x-www-form-urlencoded'
      }),
      body: form.toString()
      },
      this.httpTimeoutMs
    )
    const data = await res.json().catch(() => ({}))
    if (!res.ok || data?.success === false) {
      throw new Error(`BMO 登录失败: ${data?.msg || data?.message || `HTTP ${res.status}`}`)
    }
    const cookie = readCookieHeader(res.headers)
    if (cookie) this.cookie = mergeCookieHeader(this.cookie, cookie)
    const tokenFromHeader = res.headers.get('x-auth-token')
    const tokenFromData = data?.data?.token || data?.token
    if (tokenFromHeader) this.authToken = tokenFromHeader
    if (!this.authToken && tokenFromData) this.authToken = String(tokenFromData)
  }

  async login() {
    if (!this.hasLoginAuth) {
      throw new Error(
        '缺少 BMO 认证配置：请设置 BMO_COOKIE/BMO_X_AUTH_TOKEN，或设置 BMO_USERNAME/BMO_PASSWORD'
      )
    }
    const payload = this.buildLoginPayload()
    if (payload) {
      const res = await fetchWithTimeout(
        new URL(this.loginEndpoint, this.baseUrl),
        {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(payload)
        },
        this.httpTimeoutMs
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data?.success === false) {
        throw new Error(`BMO 登录失败: ${data?.msg || data?.message || `HTTP ${res.status}`}`)
      }
      const cookie = readCookieHeader(res.headers)
      if (cookie) this.cookie = mergeCookieHeader(this.cookie, cookie)
      const tokenFromHeader = res.headers.get('x-auth-token')
      const tokenFromData = data?.data?.token || data?.token
      if (tokenFromHeader) this.authToken = tokenFromHeader
      if (!this.authToken && tokenFromData) this.authToken = String(tokenFromData)
      return
    }

    await this.loginViaRsaForm()
  }

  async requestJson(pathname, payload, retried = false) {
    const timeoutMsOverride =
      arguments.length >= 4 && arguments[3] !== undefined ? arguments[3] : undefined
    const res = await fetchWithTimeout(
      new URL(pathname, this.baseUrl),
      {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(payload)
      },
      timeoutMsOverride ?? this.httpTimeoutMs
    )

    if ((res.status === 401 || res.status === 403) && !retried && this.hasLoginAuth) {
      await this.login()
      return this.requestJson(pathname, payload, true, timeoutMsOverride)
    }

    const data = await res.json().catch(() => null)
    if (!res.ok) {
      throw new Error(`BMO 请求失败: HTTP ${res.status}`)
    }
    if (!data || data.success === false) {
      throw new Error(`BMO 返回失败: ${data?.msg || data?.message || 'unknown'}`)
    }
    return data
  }

  async requestJsonFile(pathname, retried = false) {
    const timeoutMsOverride =
      arguments.length >= 3 && arguments[2] !== undefined ? arguments[2] : undefined
    const headers = this.buildHeaders({
      Accept: 'application/json, text/plain, */*'
    })
    // GET 请求不需要 Content-Type，部分服务端会做严格校验
    delete headers['Content-Type']

    const res = await fetchWithTimeout(
      new URL(pathname, this.baseUrl),
      {
        method: 'GET',
        headers
      },
      timeoutMsOverride ?? this.httpTimeoutMs
    )

    if ((res.status === 401 || res.status === 403) && !retried && this.hasLoginAuth) {
      await this.login()
      return this.requestJsonFile(pathname, true, timeoutMsOverride)
    }

    if (!res.ok) {
      throw new Error(`BMO 请求失败: HTTP ${res.status}`)
    }
    return await res.json()
  }

  async requestStream(pathname, retried = false) {
    const timeoutMsOverride =
      arguments.length >= 3 && arguments[2] !== undefined ? arguments[2] : undefined
    const headers = this.buildHeaders({
      Accept: '*/*'
    })
    delete headers['Content-Type']

    let res = await fetchWithTimeout(
      new URL(pathname, this.baseUrl),
      {
        method: 'GET',
        headers
      },
      timeoutMsOverride ?? this.httpTimeoutMs
    )

    // Some BMO deployments reject file download when stale/mismatched X-AUTH-TOKEN is sent.
    // Retry once with cookie-only headers before relogin.
    if (res.status === 403 && !retried && headers['X-AUTH-TOKEN']) {
      const cookieOnlyHeaders = this.buildHeaders({ Accept: '*/*' })
      delete cookieOnlyHeaders['Content-Type']
      delete cookieOnlyHeaders['X-AUTH-TOKEN']
      const cookieOnlyRes = await fetchWithTimeout(
        new URL(pathname, this.baseUrl),
        {
          method: 'GET',
          headers: cookieOnlyHeaders
        },
        timeoutMsOverride ?? this.httpTimeoutMs
      )
      if (cookieOnlyRes.ok) return cookieOnlyRes
      res = cookieOnlyRes
    }

    if ((res.status === 401 || res.status === 403) && !retried && this.hasLoginAuth) {
      await this.login()
      return this.requestStream(pathname, true, timeoutMsOverride)
    }

    return res
  }
}

const buildFormConfigMeta = (formConfigJson) => {
  const meta = {
    fieldLabelByName: {},
    fieldOptionsByName: {},
    labelToFieldName: {},
    tableFields: {},
    // Internal: keep best label source by rank so we can prefer lang.label over fdLabel when needed.
    _fieldLabelRankByName: {}
  }

  const auth = Array.isArray(formConfigJson?.auth) ? formConfigJson.auth[0] : null
  const add = auth?.add && typeof auth.add === 'object' ? auth.add : {}
  for (const [tableName, tableDef] of Object.entries(add || {})) {
    const fields = tableDef?.fields && typeof tableDef.fields === 'object' ? Object.keys(tableDef.fields) : []
    meta.tableFields[tableName] = fields
  }

  const dataModels = Array.isArray(formConfigJson?.dataModel) ? formConfigJson.dataModel : []
  for (const model of dataModels) {
    const fields = Array.isArray(model?.fdFields) ? model.fdFields : []
    for (const field of fields) {
      const name = field?.fdName
      if (!name || typeof name !== 'string') continue

      const label = field?.fdLabel && typeof field.fdLabel === 'string' ? field.fdLabel : null
      if (label) {
        meta.fieldLabelByName[name] = label
        meta._fieldLabelRankByName[name] = Math.max(meta._fieldLabelRankByName[name] || 0, 2)
        if (!meta.labelToFieldName[label]) meta.labelToFieldName[label] = name
      }

      const attrRaw = field?.fdAttribute
      if (typeof attrRaw !== 'string' || !attrRaw.trim().startsWith('{')) continue
      try {
        const attr = JSON.parse(attrRaw)
        const options = attr?.config?.controlProps?.options
        if (Array.isArray(options) && options.length) {
          const map = {}
          for (const opt of options) {
            const v = opt?.value
            const l = opt?.label
            if (typeof v === 'string' && typeof l === 'string') {
              map[v] = l
            }
          }
          if (Object.keys(map).length) {
            meta.fieldOptionsByName[name] = map
          }
        }
      } catch (e) {
        // ignore invalid fdAttribute JSON
      }
    }
  }

  const langRaw = formConfigJson?.lang
  if (typeof langRaw === 'string' && langRaw.trim().startsWith('{')) {
    try {
      const langMap = JSON.parse(langRaw)
      const rank = { label: 3, displayLabel: 2, title: 1 }
      for (const entry of Object.values(langMap || {})) {
        if (!entry || typeof entry !== 'object') continue
        const prop = entry.prop
        const name = entry.name
        const content = entry.content
        if (!rank[prop] || typeof name !== 'string' || !content || typeof content !== 'object') continue
        const cn = content.Cn || content.default
        if (typeof cn !== 'string' || !cn) continue
        const r = rank[prop] || 0
        const cur = meta._fieldLabelRankByName[name] || 0
        // Prefer lang.label over fdLabel when they disagree (e.g. 模具腔数(技术) vs 模具腔数).
        if (r > cur) {
          meta.fieldLabelByName[name] = cn
          meta._fieldLabelRankByName[name] = r
          if (!meta.labelToFieldName[cn]) meta.labelToFieldName[cn] = name
        }
      }
    } catch (e) {
      // ignore invalid lang JSON
    }
  }

  // Do not leak internal helper.
  delete meta._fieldLabelRankByName
  return meta
}

const getMouldDetailFormConfigMeta = async (client) => {
  const now = Date.now()
  if (cachedFormConfigMeta && now - cachedFormConfigAt < FORM_CONFIG_CACHE_TTL_MS) {
    return cachedFormConfigMeta
  }

  const path =
    process.env.BMO_MOULD_DETAIL_FORM_CONFIG_PATH || DEFAULT_MOULD_DETAIL_FORM_CONFIG_PATH
  const json = await client.requestJsonFile(path)
  cachedFormConfigMeta = buildFormConfigMeta(json)
  cachedFormConfigAt = now
  return cachedFormConfigMeta
}

const normalizeDetailValue = (raw, optionsMap) => {
  if (raw === null || raw === undefined) return null

  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return null
    if (optionsMap && typeof optionsMap === 'object' && optionsMap[trimmed]) {
      return optionsMap[trimmed]
    }
    return trimmed
  }

  if (typeof raw === 'number') {
    // Heuristic: treat large ints as ms timestamps
    if (Number.isFinite(raw) && raw > 1e11) {
      const d = new Date(raw)
      return Number.isNaN(d.getTime()) ? String(raw) : d.toISOString()
    }
    return raw
  }

  if (typeof raw === 'boolean') return raw ? '是' : '否'

  if (Array.isArray(raw)) {
    const parts = raw.map((x) => normalizeDetailValue(x, optionsMap)).filter((x) => x !== null)
    return parts.length ? parts.join('、') : null
  }

  if (typeof raw === 'object') {
    if (typeof raw.fdName === 'string' && raw.fdName.trim()) return raw.fdName.trim()
    if (typeof raw.name === 'string' && raw.name.trim()) return raw.name.trim()
    if (typeof raw.label === 'string' && raw.label.trim()) return raw.label.trim()
    if (typeof raw.value === 'string' && raw.value.trim()) {
      const v = raw.value.trim()
      if (optionsMap && optionsMap[v]) return optionsMap[v]
      return v
    }
    try {
      return JSON.stringify(raw)
    } catch (e) {
      return String(raw)
    }
  }

  return String(raw)
}

const pickAttachmentId = (value) => {
  if (!value) return ''
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim()
  if (typeof value === 'object') {
    const direct = String(value.fdId || value.id || value.fd_id || '').trim()
    if (direct) return direct
  }
  return ''
}

const createEmptyFormMeta = () => ({
  fieldLabelByName: {},
  fieldOptionsByName: {},
  labelToFieldName: {},
  tableFields: {}
})

const resolveFieldLabel = (meta, fieldName) => {
  const name = String(fieldName || '').trim()
  if (!name) return ''
  return (
    (meta?.fieldLabelByName && String(meta.fieldLabelByName[name] || '').trim()) ||
    DEFAULT_MOULD_FIELD_LABEL_MAP[name] ||
    name
  )
}

const buildMouldDetailFromViewData = ({ fdId, viewData, formMeta }) => {
  const meta = formMeta && typeof formMeta === 'object' ? formMeta : createEmptyFormMeta()
  const sysXform = viewData?.data?.mechanisms?.['sys-xform'] || {}
  const dynamicProps =
    sysXform?.dynamicProps && typeof sysXform.dynamicProps === 'object' ? sysXform.dynamicProps : {}
  const attachments = Array.isArray(viewData?.data?.mechanisms?.attachment)
    ? viewData.data.mechanisms.attachment
    : []

  const demandTypeField = meta.labelToFieldName['提需类型'] || 'fd_col_106gyr'
  const designerField = meta.labelToFieldName['设计师'] || 'fd_col_2awc2z'
  const techAttachmentField = meta.labelToFieldName['技术要求附件'] || 'fd_col_5yzo48'
  const techTableName =
    process.env.BMO_MOULD_TECH_REQUIREMENTS_TABLE || DEFAULT_MOULD_TECH_REQUIREMENTS_TABLE

  const demandTypeRaw = dynamicProps[demandTypeField]
  const demandType = normalizeDetailValue(demandTypeRaw, meta.fieldOptionsByName[demandTypeField] || null)

  const designerRaw = dynamicProps[designerField]
  const designer = normalizeDetailValue(designerRaw, meta.fieldOptionsByName[designerField] || null)

  const techTable =
    dynamicProps[techTableName] && typeof dynamicProps[techTableName] === 'object'
      ? dynamicProps[techTableName]
      : {}
  const techFieldNames = Array.isArray(meta.tableFields[techTableName])
    ? meta.tableFields[techTableName]
    : Object.keys(techTable || {})

  const techFields = techFieldNames
    .filter((name) => name && name !== 'fd_id')
    .map((name) => ({
      name,
      label: resolveFieldLabel(meta, name),
      value: normalizeDetailValue(techTable[name], meta.fieldOptionsByName[name] || null)
    }))

  const mainCavityFieldNames = ['fd_col_pt6kmk']
  for (const fieldName of mainCavityFieldNames) {
    const value = normalizeDetailValue(dynamicProps[fieldName], meta.fieldOptionsByName[fieldName] || null)
    const idx = techFields.findIndex((x) => String(x?.name || '') === fieldName)
    if (idx >= 0) {
      if (!techFields[idx].value && value) techFields[idx].value = value
      continue
    }
    techFields.push({
      name: fieldName,
      label: resolveFieldLabel(meta, fieldName) || '模具腔数',
      value: value || null
    })
  }

  const techAttachments = attachments
    .filter((x) => String(x?.fdEntityKey || '') === techAttachmentField)
    .map((x) => {
      const sysAttachFileId = pickAttachmentId(x?.fdSysAttachFile)
      const fileId = pickAttachmentId(x?.fdFileId)
      const attachmentId = pickAttachmentId(x?.fdAttachmentId || x?.fdAttachId)
      const attachFdId = pickAttachmentId(x?.fdId)
      const finalId = attachFdId || attachmentId || fileId || sysAttachFileId || null
      return {
        id: finalId,
        fileName: x?.fdFileName || null,
        fileExt: x?.fdFileExtName || null,
        fileSize: x?.fdFileSize ?? null,
        createdAt: x?.fdCreateTime ? new Date(x.fdCreateTime).toISOString() : null,
        fileId: fileId || sysAttachFileId || null,
        attachmentId: attachmentId || null,
        rawDownloadPath:
          x?.fdDownloadPath || x?.fdDownloadUrl || x?.downloadUrl || x?.url || x?.fdUrl || null,
        rawDownloadUrl: x?.downloadUrl || null,
        sysAttachFileId: sysAttachFileId || null,
        fdId: attachFdId || null,
        _rawKeys: Object.keys(x || {})
      }
    })

  return {
    fdId,
    demandType,
    designer,
    tech: {
      tableName: techTableName,
      mechAuthToken: sysXform?.['sys-auth']?.mechAuthToken || null,
      fields: techFields,
      attachments: techAttachments
    }
  }
}

const fetchBmoMouldDetailViaRelay = async (fdId) => {
  const payload = {
    fdId,
    fdMode: 1,
    fdViewId: process.env.BMO_MOULD_DETAIL_FD_VIEW_ID || DEFAULT_MOULD_DETAIL_VIEW_ID,
    fdFormId: process.env.BMO_MOULD_DETAIL_FD_FORM_ID || DEFAULT_MOULD_DETAIL_FORM_ID,
    fdXFormId: process.env.BMO_MOULD_DETAIL_FD_XFORM_ID || DEFAULT_MOULD_DETAIL_XFORM_ID,
    mechanisms: { load: '*' }
  }

  const created = await relayRequestJson('/jobs', {
    method: 'POST',
    timeoutMs: 15000,
    body: {
      type: 'writeback',
      payload: {
        path: '/data/sys-modeling/sysModelingMain/view',
        body: payload
      }
    }
  })
  const jobId = String(created?.data?.id || created?.id || '').trim()
  if (!jobId) throw new Error('relay 创建详情任务失败（缺少 jobId）')

  const finished = await relayWaitJob(jobId, { timeoutMs: 120000, intervalMs: 1000 })
  if (String(finished?.status || '').trim() !== 'success') {
    throw new Error(String(finished?.error || 'relay 详情任务失败'))
  }

  const viewData =
    finished?.result?.response && typeof finished.result.response === 'object'
      ? finished.result.response
      : finished?.result
  if (!viewData || typeof viewData !== 'object') {
    throw new Error('relay 详情任务返回空数据')
  }

  let formMeta = createEmptyFormMeta()
  try {
    const client = getSharedClient()
    formMeta = await getMouldDetailFormConfigMeta(client)
  } catch (e) {
    formMeta = createEmptyFormMeta()
  }
  return buildMouldDetailFromViewData({ fdId, viewData, formMeta })
}

const fetchBmoMouldDetail = async (input = {}) => {
  const fdId = String(input.fdId || input.bmoRecordId || '').trim()
  if (!fdId) {
    throw new Error('缺少 fdId')
  }

  // Hub-only mode: always fetch detail through relay, never direct-connect BMO.
  if (isHubOnlyMode()) {
    if (!isRelayEnabled()) {
      throw new Error('BMO_HUB_ONLY=1 但未配置 BMO_RELAY_BASE_URL')
    }
    return fetchBmoMouldDetailViaRelay(fdId)
  }

  try {
    const client = getSharedClient()
    await ensureClientAuthed(client)
    const formMeta = await getMouldDetailFormConfigMeta(client)
    const payload = {
      fdId,
      fdMode: 1,
      fdViewId: process.env.BMO_MOULD_DETAIL_FD_VIEW_ID || DEFAULT_MOULD_DETAIL_VIEW_ID,
      fdFormId: process.env.BMO_MOULD_DETAIL_FD_FORM_ID || DEFAULT_MOULD_DETAIL_FORM_ID,
      fdXFormId: process.env.BMO_MOULD_DETAIL_FD_XFORM_ID || DEFAULT_MOULD_DETAIL_XFORM_ID,
      mechanisms: { load: '*' }
    }
    const viewData = await client.requestJson(client.viewEndpoint, payload)
    return buildMouldDetailFromViewData({ fdId, viewData, formMeta })
  } catch (error) {
    if (isRelayEnabled()) {
      try {
        return await fetchBmoMouldDetailViaRelay(fdId)
      } catch (relayError) {
        const primaryMsg = String(error?.message || error || '')
        const relayMsg = String(relayError?.message || relayError || '')
        throw new Error(`${primaryMsg || '直连失败'}；relay 兜底失败：${relayMsg || '未知错误'}`)
      }
    }
    throw error
  }
}

const checkBmoAttachmentDownload = async (attachmentId, mechAuthToken) => {
  const id = String(attachmentId || '').trim()
  const token = String(mechAuthToken || '').trim()
  if (!id || !token) return { ok: false, skipped: true }

  const client = getSharedClient()
  await ensureClientAuthed(client)
  if (client.hasLoginAuth) {
    try {
      await client.login()
    } catch (e) {
      // ignore and keep current auth context
    }
  }
  const data = await client.requestJson(
    `/data/sys-attach/checkDownload/${encodeURIComponent(id)}?mechAuthToken=${encodeURIComponent(token)}`,
    {}
  )
  return { ok: true, data }
}

const downloadBmoAttachmentByBrowser = async (input = {}) => {
  const fdId = String(input.fdId || '').trim()
  const attachmentId = String(input.attachmentId || '').trim()
  if (!fdId || !attachmentId) {
    throw new Error('缺少 fdId 或 attachmentId')
  }

  let chromium = null
  try {
    ;({ chromium } = require('playwright-core'))
  } catch (e) {
    throw new Error('缺少 playwright-core，无法启用浏览器附件下载兜底')
  }

  const authFilePath = process.env.BMO_AUTH_FILE || ''
  const fromFile = authFilePath ? readAuthFromEnvFile(authFilePath) : null
  const baseUrl = (
    process.env.BMO_BASE_URL ||
    fromFile?.BMO_BASE_URL ||
    DEFAULT_BASE_URL
  ).replace(/\/+$/, '')
  const cookieHeader = process.env.BMO_COOKIE || fromFile?.BMO_COOKIE || ''
  const tokenFromEnv = process.env.BMO_X_AUTH_TOKEN || fromFile?.BMO_X_AUTH_TOKEN || ''
  const username = process.env.BMO_USERNAME || fromFile?.BMO_USERNAME || ''
  const password = process.env.BMO_PASSWORD || fromFile?.BMO_PASSWORD || ''
  if (!username || !password) {
    throw new Error('缺少 BMO_USERNAME/BMO_PASSWORD，无法进行浏览器下载兜底')
  }

  const userDataDir =
    process.env.BMO_KEEPER_USER_DATA_DIR ||
    path.join(
      os.tmpdir(),
      `bmo-attachment-download-${Date.now()}-${Math.random().toString(16).slice(2)}`
    )
  const headless = String(process.env.BMO_KEEPER_HEADLESS || 'true').toLowerCase() !== 'false'
  const navTimeoutMs = Number(process.env.BMO_KEEPER_NAV_TIMEOUT_MS || 20000)
  const listViewId = process.env.BMO_MOULD_LIST_VIEW_ID || '1isqa135kwe9w4adow1ng3ksi3rrcgl912w0'
  const menuId = process.env.BMO_MOULD_MENU_ID || '1j7l907fmwmnw15nihw3essaq61h6trmg3w0'
  const portal = String(
    process.env.BMO_KEEPER_PORTAL || fromFile?.BMO_KEEPER_PORTAL || 'BMO'
  )
    .trim()
    .toUpperCase()

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless,
    acceptDownloads: true,
    ignoreHTTPSErrors: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  })
  const page = await context.newPage()
  page.setDefaultTimeout(navTimeoutMs)
  page.setDefaultNavigationTimeout(navTimeoutMs)
  const targetUrl = `${baseUrl}/web/#/current/sys-modeling/app/mojuxt/view/${DEFAULT_MOULD_DETAIL_FORM_ID}/${encodeURIComponent(fdId)}?listviewId=${encodeURIComponent(listViewId)}&menuId=${encodeURIComponent(menuId)}&fdOpenMode=new`

  const typeIntoInput = async (locator, value) => {
    const target = locator.first()
    await target
      .evaluate((el) => {
        if (el && typeof el.removeAttribute === 'function') {
          el.removeAttribute('readonly')
        }
      })
      .catch(() => null)
    await target.click({ timeout: 2000 }).catch(() => null)
    await target.press('Control+A').catch(() => null)
    await target.press('Meta+A').catch(() => null)
    await target.press('Backspace').catch(() => null)
    await page.keyboard.type(String(value || ''), { delay: 20 })
  }

  try {
    // 使用可复现的“登录页 -> 详情页 -> 点击下载”流程，避免依赖历史会话状态。
    await page.goto(`${baseUrl}/web/#/login`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1200)

    const userLocator = page.locator('input[name="j_username"], input#userName, input#username')
    const passLocator = page.locator('input[name="j_password"], input#passWord, input#password')
    const loginButton = page.locator(
      'button:has-text("登录"), button.user-elem-chml-sso-login-odf82-submit, button[type="submit"]'
    )

    const needLogin = (await userLocator.count()) > 0 && (await passLocator.count()) > 0
    if (needLogin) {
      if (portal === 'BMO' || portal === 'OA') {
        const portalRadio = page.locator(`input[type="radio"][value="${portal}"]`)
        if ((await portalRadio.count()) > 0) {
          await portalRadio.first().check().catch(() => null)
        }
      }
      await typeIntoInput(userLocator, username)
      await typeIntoInput(passLocator, password)
      if ((await loginButton.count()) > 0) {
        await loginButton.first().click().catch(() => null)
      } else {
        await passLocator.first().press('Enter').catch(() => null)
      }
    }
    await page.waitForTimeout(2500)
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle').catch(() => null)
    await page.waitForTimeout(5000)

    const runInPageDownload = async () =>
      page
      .evaluate(
        async ({ detailFdId, attachId, viewId, formId, xformId }) => {
          const fail = (status, message) => ({ ok: false, status, message, bytes: [] })
          try {
            const viewResp = await fetch('/data/sys-modeling/sysModelingMain/view', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json;charset=UTF-8' },
              body: JSON.stringify({
                fdId: detailFdId,
                fdMode: 1,
                fdViewId: viewId,
                fdFormId: formId,
                fdXFormId: xformId,
                mechanisms: { load: '*' }
              })
            })
            if (!viewResp.ok) return fail(viewResp.status, 'view failed')
            const viewJson = await viewResp.json().catch(() => ({}))
            const mechAuthToken = viewJson?.data?.mechanisms?.['sys-auth']?.mechAuthToken || ''
            if (!mechAuthToken) return fail(0, 'missing mechAuthToken')

            const checkResp = await fetch(
              `/data/sys-attach/checkDownload/${encodeURIComponent(attachId)}?mechAuthToken=${encodeURIComponent(mechAuthToken)}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json;charset=UTF-8' },
                body: '{}'
              }
            )
            if (!checkResp.ok) {
              const text = await checkResp.text().catch(() => '')
              return fail(checkResp.status, text || 'checkDownload failed')
            }
            const checkJson = await checkResp.json().catch(() => ({}))
            if (checkJson && checkJson.success === false) {
              return fail(403, checkJson.msg || checkJson.message || 'checkDownload denied')
            }

            const dlResp = await fetch(`/data/sys-attach/download/${encodeURIComponent(attachId)}`)
            if (!dlResp.ok) {
              const text = await dlResp.text().catch(() => '')
              return fail(dlResp.status, text || 'download failed')
            }
            const contentType = dlResp.headers.get('content-type') || 'application/octet-stream'
            const ab = await dlResp.arrayBuffer()
            return {
              ok: true,
              contentType,
              bytes: Array.from(new Uint8Array(ab))
            }
          } catch (e) {
            return fail(0, String(e?.message || e))
          }
        },
        {
          detailFdId: fdId,
          attachId: attachmentId,
          viewId: process.env.BMO_MOULD_DETAIL_FD_VIEW_ID || DEFAULT_MOULD_DETAIL_VIEW_ID,
          formId: process.env.BMO_MOULD_DETAIL_FD_FORM_ID || DEFAULT_MOULD_DETAIL_FORM_ID,
          xformId: process.env.BMO_MOULD_DETAIL_FD_XFORM_ID || DEFAULT_MOULD_DETAIL_XFORM_ID
        }
      )
      .catch((e) => ({ ok: false, message: String(e?.message || e) }))

    // A) 先尝试页面内 API 链路，不依赖按钮可见性
    let inPage = await runInPageDownload()
    // 若失败，强制重新登录一次并重试（常见于会话过期/路由跳转后未生效）
    if (!inPage?.ok) {
      await page.goto(`${baseUrl}/web/#/login`, { waitUntil: 'domcontentloaded' }).catch(() => null)
      await page.waitForTimeout(800)
      const reloginUser = page.locator('input[name="j_username"], input#userName, input#username')
      const reloginPass = page.locator('input[name="j_password"], input#passWord, input#password')
      const reloginBtn = page.locator(
        'button:has-text("登录"), button.user-elem-chml-sso-login-odf82-submit, button[type="submit"]'
      )
      if ((await reloginUser.count()) > 0 && (await reloginPass.count()) > 0) {
        if (portal === 'BMO' || portal === 'OA') {
          const portalRadio = page.locator(`input[type="radio"][value="${portal}"]`)
          if ((await portalRadio.count()) > 0) {
            await portalRadio.first().check().catch(() => null)
          }
        }
        await typeIntoInput(reloginUser, username)
        await typeIntoInput(reloginPass, password)
        if ((await reloginBtn.count()) > 0) {
          await reloginBtn.first().click().catch(() => null)
        } else {
          await reloginPass.first().press('Enter').catch(() => null)
        }
      }
      await page.waitForTimeout(2500)
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded' }).catch(() => null)
      await page.waitForLoadState('networkidle').catch(() => null)
      await page.waitForTimeout(2000)
      inPage = await runInPageDownload()
    }

    if (inPage?.ok && Array.isArray(inPage.bytes) && inPage.bytes.length > 0) {
      return {
        contentType: String(inPage.contentType || 'application/octet-stream'),
        buffer: Buffer.from(inPage.bytes)
      }
    }

    let downloadButtons = page.locator('text=下载')
    let count = await downloadButtons.count()
    if (!count) {
      downloadButtons = page.locator('button:has-text("下载"), [role="button"]:has-text("下载")')
      count = await downloadButtons.count()
    }
    if (!count) {
      throw new Error(
        `browser fallback failed: 下载按钮不存在（in-page: ${String(inPage?.message || inPage?.status || 'unknown')}）`
      )
    }

    for (let i = 0; i < Math.min(count, 6); i += 1) {
      const downloadPromise = page.waitForEvent('download', { timeout: 12000 }).catch(() => null)
      await downloadButtons.nth(i).click({ timeout: 6000 }).catch(() => null)
      const download = await downloadPromise
      if (!download) continue
      const suggestedName = String(download.suggestedFilename() || '')
      if (suggestedName && !/\.(xlsx|xls)$/i.test(suggestedName) && count > 1) {
        // 优先接收 Excel 下载，非 Excel 继续尝试下一个按钮
        continue
      }

      const tmpPath = path.join(
        os.tmpdir(),
        `bmo-attachment-${attachmentId}-${Date.now()}-${Math.random().toString(16).slice(2)}`
      )
      await download.saveAs(tmpPath)
      const buffer = fs.readFileSync(tmpPath)
      try {
        fs.unlinkSync(tmpPath)
      } catch (e) {
        // ignore
      }
      return {
        contentType: 'application/octet-stream',
        buffer
      }
    }

    throw new Error('browser fallback failed: 未捕获有效下载事件')
  } finally {
    try {
      await context.close()
    } catch (e) {
      // ignore
    }
  }
}

const downloadBmoAttachment = async (attachmentId) => {
  const id = String(attachmentId || '').trim()
  if (!id) throw new Error('缺少 attachmentId')

  const client = getSharedClient()
  await ensureClientAuthed(client)
  if (client.hasLoginAuth) {
    try {
      await client.login()
    } catch (e) {
      // ignore and keep current auth context
    }
  }

  const encodedId = encodeURIComponent(id)
  const candidatePaths = [
    `/data/sys-attach/download/${encodedId}`,
    `/sys-attach/download/${encodedId}`,
    `/data/sys-attach/download?fdId=${encodedId}`,
    `/sys-attach/download?fdId=${encodedId}`
  ]

  const attempts = []
  let lastRes = null
  let primaryStatus = 0
  for (const pathname of candidatePaths) {
    const res = await client.requestStream(pathname)
    if (!primaryStatus) primaryStatus = Number(res.status || 0)
    attempts.push(`${pathname} => ${res.status}`)
    if (res.ok) return { response: res, attempts }
    lastRes = res
  }

  return { response: lastRes, attempts, primaryStatus }
}

const upsertBmoRecord = async (record, traceId) => {
  const normalized = {
    bmoRecordId: record?.bmoRecordId ?? record?.bmo_record_id ?? null,
    moldNumber: record?.moldNumber ?? record?.mold_number ?? null,
    partNo: record?.partNo ?? record?.part_no ?? null,
    partName: record?.partName ?? record?.part_name ?? null,
    moldType: record?.moldType ?? record?.mold_type ?? null,
    model: record?.model ?? null,
    budgetWanTaxIncl: record?.budgetWanTaxIncl ?? record?.budget_wan_tax_incl ?? null,
    bidPriceTaxIncl: record?.bidPriceTaxIncl ?? record?.bid_price_tax_incl ?? null,
    supplier: record?.supplier ?? null,
    projectManager: record?.projectManager ?? record?.project_manager ?? null,
    moldEngineer: record?.moldEngineer ?? record?.mold_engineer ?? null,
    designer: record?.designer ?? null,
    projectNo: record?.projectNo ?? record?.project_no ?? null,
    processNo: record?.processNo ?? record?.process_no ?? null,
    assetNo: record?.assetNo ?? record?.asset_no ?? null,
    progressDays: record?.progressDays ?? record?.progress_days ?? null,
    bidTime: record?.bidTime ?? record?.bid_time ?? null,
    projectEndTime: record?.projectEndTime ?? record?.project_end_time ?? null,
    sourceCreateTime: record?.sourceCreateTime ?? record?.source_create_time ?? null,
    rawJson: record?.rawJson ?? record?.raw_json ?? JSON.stringify(record || {}),
    traceId: traceId ?? null
  }

  await query(
    `
    MERGE bmo_mould_procurement AS target
    USING (
      SELECT
        @bmoRecordId AS bmo_record_id,
        @moldNumber AS mold_number,
        @partNo AS part_no,
        @partName AS part_name,
        @moldType AS mold_type,
        @model AS model,
        @budgetWanTaxIncl AS budget_wan_tax_incl,
        @bidPriceTaxIncl AS bid_price_tax_incl,
        @supplier AS supplier,
        @projectManager AS project_manager,
        @moldEngineer AS mold_engineer,
        @designer AS designer,
        @projectNo AS project_no,
        @processNo AS process_no,
        @assetNo AS asset_no,
        @progressDays AS progress_days,
        @bidTime AS bid_time,
        @projectEndTime AS project_end_time,
        @sourceCreateTime AS source_create_time,
        @rawJson AS raw_json,
        @traceId AS source_trace_id
    ) AS source
    ON target.bmo_record_id = source.bmo_record_id
    WHEN MATCHED THEN
      UPDATE SET
        mold_number = source.mold_number,
        part_no = source.part_no,
        part_name = source.part_name,
        mold_type = source.mold_type,
        model = source.model,
        budget_wan_tax_incl = source.budget_wan_tax_incl,
        bid_price_tax_incl = source.bid_price_tax_incl,
        supplier = source.supplier,
        project_manager = source.project_manager,
        mold_engineer = source.mold_engineer,
        designer = source.designer,
        project_no = source.project_no,
        process_no = source.process_no,
        asset_no = source.asset_no,
        progress_days = source.progress_days,
        bid_time = source.bid_time,
        project_end_time = source.project_end_time,
        source_create_time = source.source_create_time,
        raw_json = source.raw_json,
        source_trace_id = source.source_trace_id,
        source_updated_at = GETDATE(),
        updated_at = GETDATE()
    WHEN NOT MATCHED THEN
      INSERT (
        bmo_record_id, mold_number, part_no, part_name, mold_type, model,
        budget_wan_tax_incl, bid_price_tax_incl, supplier,
        project_manager, mold_engineer, designer,
        project_no, process_no, asset_no, progress_days,
        bid_time, project_end_time, source_create_time, raw_json, source_trace_id,
        source_updated_at, created_at, updated_at
      )
      VALUES (
        source.bmo_record_id, source.mold_number, source.part_no, source.part_name, source.mold_type, source.model,
        source.budget_wan_tax_incl, source.bid_price_tax_incl, source.supplier,
        source.project_manager, source.mold_engineer, source.designer,
        source.project_no, source.process_no, source.asset_no, source.progress_days,
        source.bid_time, source.project_end_time, source.source_create_time, source.raw_json, source.source_trace_id,
        GETDATE(), GETDATE(), GETDATE()
      );
  `,
    normalized
  )
}

const upsertBmoRecords = async (records, traceId) => {
  const list = Array.isArray(records) ? records : []
  let upserted = 0
  for (const record of list) {
    const bmoRecordId = record?.bmoRecordId ?? record?.bmo_record_id
    if (!bmoRecordId) continue
    await upsertBmoRecord(record, traceId)
    upserted += 1
  }
  return upserted
}

const syncBmoMouldData = async (input = {}) => {
  const options = {
    fdListViewId: input.fdListViewId || DEFAULT_LIST_QUERY.fdListViewId,
    fdMode: input.fdMode ?? DEFAULT_LIST_QUERY.fdMode,
    type: input.type || DEFAULT_LIST_QUERY.type,
    navId: input.navId || DEFAULT_LIST_QUERY.navId,
    sorts: input.sorts || DEFAULT_LIST_QUERY.sorts,
    conditions: input.conditions || DEFAULT_LIST_QUERY.conditions,
    pageSize: toPositiveInt(input.pageSize, DEFAULT_LIST_QUERY.pageSize),
    params: input.params || DEFAULT_LIST_QUERY.params,
    maxPages: toPositiveInt(input.maxPages, 20),
    dryRun: Boolean(input.dryRun)
  }

  const client = getSharedClient()
  await ensureClientAuthed(client)

  const seen = new Set()
  const collected = []
  let totalSize = null
  let pageCount = 0
  let lastTraceId = null

  for (let offset = 0; pageCount < options.maxPages; offset += options.pageSize) {
    const payload = buildListPayload(options, offset)
    const data = await client.requestJson(client.dataEndpoint, payload)
    lastTraceId = data?.traceId || null

    const list = Array.isArray(data?.data?.content) ? data.data.content : []
    const remoteTotal = Number(data?.data?.totalSize)
    if (Number.isFinite(remoteTotal)) {
      totalSize = remoteTotal
    }

    if (!list.length) break

    for (const item of list) {
      const key = item?.fd_id
      if (!key || seen.has(key)) continue
      seen.add(key)
      collected.push(item)
    }

    pageCount += 1
    if (list.length < options.pageSize) break
    if (totalSize !== null && offset + options.pageSize >= totalSize) break
  }

  let upserted = 0
  if (!options.dryRun) {
    for (const item of collected) {
      const mapped = mapBmoRecord(item)
      if (!mapped.bmoRecordId) continue
      await upsertBmoRecord(mapped, lastTraceId)
      upserted += 1
    }
  }

  return {
    success: true,
    fetched: collected.length,
    upserted,
    pageCount,
    totalSize,
    pageSize: options.pageSize,
    traceId: lastTraceId,
    syncedAt: new Date().toISOString(),
    sample: collected.slice(0, 5).map((item) => mapBmoRecord(item))
  }
}

// Fetch list data from BMO without writing to DB. This returns the same ordering as BMO.
const fetchBmoMouldListLive = async (input = {}) => {
  const options = {
    fdListViewId: input.fdListViewId || DEFAULT_LIST_QUERY.fdListViewId,
    fdMode: input.fdMode ?? DEFAULT_LIST_QUERY.fdMode,
    type: input.type || DEFAULT_LIST_QUERY.type,
    navId: input.navId || DEFAULT_LIST_QUERY.navId,
    sorts: input.sorts || DEFAULT_LIST_QUERY.sorts,
    conditions: input.conditions || DEFAULT_LIST_QUERY.conditions,
    pageSize: toPositiveInt(input.pageSize, DEFAULT_LIST_QUERY.pageSize),
    offset: Number.isInteger(Number(input.offset)) ? Number(input.offset) : 0,
    params: input.params || DEFAULT_LIST_QUERY.params
  }

  const client = getSharedClient()
  await ensureClientAuthed(client)

  const payload = buildListPayload(options, options.offset)
  const timeoutMs = Number(input.timeoutMs)
  const disableAuthRetry = Boolean(input.disableAuthRetry)
  const data = await client.requestJson(
    client.dataEndpoint,
    payload,
    disableAuthRetry,
    Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : undefined
  )
  const list = Array.isArray(data?.data?.content) ? data.data.content : []
  const totalSize = Number.isFinite(Number(data?.data?.totalSize)) ? Number(data.data.totalSize) : null

  return {
    success: true,
    fetched: list.length,
    offset: options.offset,
    pageSize: options.pageSize,
    totalSize,
    traceId: data?.traceId || null,
    fetchedAt: new Date().toISOString(),
    list: list.map((item) => mapBmoRecord(item))
  }
}

module.exports = {
  syncBmoMouldData,
  fetchBmoMouldListLive,
  fetchBmoMouldDetail,
  checkBmoAttachmentDownload,
  downloadBmoAttachmentByBrowser,
  downloadBmoAttachment,
  upsertBmoRecords
}
