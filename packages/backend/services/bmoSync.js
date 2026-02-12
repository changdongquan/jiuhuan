const { query } = require('../database')
const crypto = require('crypto')

const DEFAULT_BASE_URL = 'https://bmo.meiling.com:8023'
const DEFAULT_DATA_ENDPOINT = '/data/sys-modeling/sysModelingMain/data'
const DEFAULT_LOGIN_ENDPOINT = '/data/sys-auth/login'
const DEFAULT_LOGIN_PAGE_ENDPOINT = '/data/sys-portal/sysPortalLoginPage/loginPage'
const DEFAULT_VERIFICATION_CHECK_ENDPOINT = '/data/sys-auth/verificationCode/check'
const DEFAULT_HTTP_TIMEOUT_MS = 15000

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
      'sec-ch-ua':
        '"Not(A:Brand";v="8", "Chromium";v="144", "Google Chrome";v="144"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
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
      await fetchWithTimeout(
        new URL(this.verificationCheckEndpoint, this.baseUrl),
        {
          method: 'POST',
          headers: this.buildHeaders(),
          body: JSON.stringify({})
        },
        this.httpTimeoutMs
      )
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
    if (cookie) this.cookie = cookie
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
      if (cookie) this.cookie = cookie
      const tokenFromHeader = res.headers.get('x-auth-token')
      const tokenFromData = data?.data?.token || data?.token
      if (tokenFromHeader) this.authToken = tokenFromHeader
      if (!this.authToken && tokenFromData) this.authToken = String(tokenFromData)
      return
    }

    await this.loginViaRsaForm()
  }

  async requestJson(pathname, payload, retried = false) {
    const res = await fetchWithTimeout(
      new URL(pathname, this.baseUrl),
      {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(payload)
      },
      this.httpTimeoutMs
    )

    if (res.status === 401 && !retried && this.hasLoginAuth) {
      await this.login()
      return this.requestJson(pathname, payload, true)
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
}

const upsertBmoRecord = async (record, traceId) => {
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
    { ...record, traceId }
  )
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

  const client = new BmoClient()
  if (!client.hasStaticAuth && client.hasLoginAuth) {
    await client.login()
  }
  if (!client.hasStaticAuth && !client.hasLoginAuth) {
    throw new Error(
      '未配置 BMO 认证信息。请配置 BMO_COOKIE/BMO_X_AUTH_TOKEN，或配置 BMO_USERNAME/BMO_PASSWORD'
    )
  }

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

  const client = new BmoClient()
  if (!client.hasStaticAuth && client.hasLoginAuth) {
    await client.login()
  }
  if (!client.hasStaticAuth && !client.hasLoginAuth) {
    throw new Error(
      '未配置 BMO 认证信息。请配置 BMO_COOKIE/BMO_X_AUTH_TOKEN，或配置 BMO_USERNAME/BMO_PASSWORD'
    )
  }

  const payload = buildListPayload(options, options.offset)
  const data = await client.requestJson(client.dataEndpoint, payload)
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
  fetchBmoMouldListLive
}
