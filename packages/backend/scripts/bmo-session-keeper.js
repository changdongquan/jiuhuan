#!/usr/bin/env node
/* eslint-disable no-console */
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const os = require('os')

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

const readEnvFile = (filePath) => {
  const p = String(filePath || '').trim()
  if (!p) return {}
  try {
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
    return out
  } catch (e) {
    return {}
  }
}

const quoteEnvValue = (value) => {
  const v = String(value ?? '')
  return `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`
}

const atomicWriteEnvFile = (filePath, kv, { mode, uid, gid } = {}) => {
  const p = String(filePath || '').trim()
  if (!p) throw new Error('缺少输出路径：BMO_KEEPER_OUTPUT_ENV_PATH 或 BMO_AUTH_FILE')
  const dir = path.dirname(p)
  fs.mkdirSync(dir, { recursive: true })

  const tmp = `${p}.tmp.${process.pid}.${Date.now()}`
  const lines = [
    `# updated_at=${new Date().toISOString()}`,
    ...Object.keys(kv)
      .sort()
      .map((k) => `${k}=${quoteEnvValue(kv[k])}`)
  ]
  fs.writeFileSync(tmp, lines.join('\n') + '\n', { encoding: 'utf8' })
  if (typeof mode === 'number') fs.chmodSync(tmp, mode)
  if (Number.isInteger(uid) && Number.isInteger(gid)) {
    try {
      fs.chownSync(tmp, uid, gid)
    } catch (e) {
      // ignore
    }
  }
  fs.renameSync(tmp, p)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const fetchWithTimeout = async (url, init, timeoutMs) => {
  const ms = Number(timeoutMs)
  const effectiveTimeoutMs = Number.isFinite(ms) && ms > 0 ? ms : 15000
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

const getCookieHeaderFromCookies = (cookies) => {
  const byName = new Map()
  for (const c of cookies || []) {
    if (!c?.name) continue
    byName.set(c.name, c.value ?? '')
  }

  const preferredOrder = [
    'LtpaToken',
    'X-AUTH-TOKEN',
    'isMkLogin',
    'EXPIRED_MODAL',
    'JSESSIONID'
  ]

  const parts = []
  for (const name of preferredOrder) {
    if (!byName.has(name)) continue
    parts.push(`${name}=${byName.get(name)}`)
    byName.delete(name)
  }
  for (const [name, value] of byName.entries()) {
    parts.push(`${name}=${value}`)
  }
  return parts.filter(Boolean).join('; ')
}

const hasSessionCookies = (cookies) => {
  const list = Array.isArray(cookies) ? cookies : []
  return list.some((c) => (c?.name === 'LtpaToken' || c?.name === 'X-AUTH-TOKEN') && c?.value)
}

const resolveBool = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback
  const v = String(value).trim().toLowerCase()
  if (v === '1' || v === 'true' || v === 'yes' || v === 'y') return true
  if (v === '0' || v === 'false' || v === 'no' || v === 'n') return false
  return fallback
}

const main = async () => {
  // Optional: load env from a file (so we don't pass secrets via CLI args/env inline).
  try {
    const dotenv = require('dotenv')
    const authFilePath = process.env.BMO_KEEPER_OUTPUT_ENV_PATH || process.env.BMO_AUTH_FILE || ''
    if (authFilePath) {
      dotenv.config({ path: authFilePath })
    } else {
      dotenv.config()
    }
  } catch (e) {
    // ignore
  }

  const argv = process.argv.slice(2)
  const once = argv.includes('--once') || resolveBool(process.env.BMO_KEEPER_ONCE, false)
  const manual = argv.includes('--manual') || resolveBool(process.env.BMO_KEEPER_MANUAL, false)
  const loginMode = String(process.env.BMO_KEEPER_LOGIN_MODE || 'chromium').toLowerCase()

  const baseUrl = (process.env.BMO_BASE_URL || 'https://bmo.meiling.com:8023').replace(/\/+$/, '')
  const username = process.env.BMO_USERNAME || ''
  const password = process.env.BMO_PASSWORD || ''
  const rsaPadding = process.env.BMO_RSA_PADDING || 'pkcs1'
  const dataEndpoint = process.env.BMO_DATA_ENDPOINT || '/data/sys-modeling/sysModelingMain/data'
  const loginEndpoint = process.env.BMO_LOGIN_ENDPOINT || '/data/sys-auth/login'
  const loginPageEndpoint =
    process.env.BMO_LOGIN_PAGE_ENDPOINT || '/data/sys-portal/sysPortalLoginPage/loginPage'
  const authFilePath = process.env.BMO_KEEPER_OUTPUT_ENV_PATH || process.env.BMO_AUTH_FILE || ''
  const intervalMs = Number(process.env.BMO_KEEPER_INTERVAL_MS || 10 * 60 * 1000)
  const manualWaitMs = Number(process.env.BMO_KEEPER_MANUAL_WAIT_MS || 120000)
  const loginUrl = process.env.BMO_KEEPER_LOGIN_URL || `${baseUrl}/web/#/login`
  const portal = String(process.env.BMO_KEEPER_PORTAL || 'BMO').trim().toUpperCase()

  if (!authFilePath) {
    throw new Error('未配置输出路径：请设置 BMO_AUTH_FILE 或 BMO_KEEPER_OUTPUT_ENV_PATH')
  }
  if (!manual && (!username || !password)) {
    throw new Error('未配置账号密码：请设置 BMO_USERNAME/BMO_PASSWORD（用于自动登录续期），或使用 --manual 手动登录')
  }

  console.log(`[bmo-keeper] baseUrl=${baseUrl}`)
  console.log(`[bmo-keeper] output=${authFilePath}`)
  console.log(`[bmo-keeper] loginUrl=${loginUrl}`)
  console.log(
    `[bmo-keeper] mode=${loginMode} once=${once ? 'true' : 'false'} manual=${manual ? 'true' : 'false'} intervalMs=${intervalMs}`
  )

  const headersBase = {
    Accept: 'application/json, text/plain, */*',
    'Content-Type': 'application/json;charset=UTF-8',
    'X-Accept-Language': 'zh-CN',
    'Accept-Language': 'zh-CN,zh;q=0.9',
    Origin: baseUrl,
    Referer: `${baseUrl}/web/`,
    'User-Agent':
      process.env.BMO_USER_AGENT ||
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36'
  }

  const probePayload = {
    fdListViewId: '1isqa135kwe9w4adow1ng3ksi3rrcgl912w0',
    fdMode: 1,
    type: 'list',
    navId: '1j7l907fiwmnw15nidw1m9cagh1kfm6tb3w0',
    sorts: { fd_create_time: 'desc' },
    conditions: {},
    pageSize: 1,
    offset: 0,
    params: {}
  }

  const probeWithAuth = async (cookie, token, timeoutMs = 8000) => {
    if (!cookie && !token) return { ok: false, status: 0 }
    const headers = {
      ...headersBase,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(token ? { 'X-AUTH-TOKEN': token } : {})
    }
    const res = await fetchWithTimeout(
      new URL(dataEndpoint, baseUrl),
      { method: 'POST', headers, body: JSON.stringify(probePayload) },
      timeoutMs
    )
    if (res.ok) {
      const json = await res.json().catch(() => null)
      if (json && json.success !== false) return { ok: true, status: res.status }
    }
    return { ok: false, status: res.status }
  }

  const refreshOnceApi = async () => {
    const existing = readEnvFile(authFilePath)
    const cookie = existing.BMO_COOKIE || process.env.BMO_COOKIE || ''
    const token = existing.BMO_X_AUTH_TOKEN || process.env.BMO_X_AUTH_TOKEN || ''

    const probeResult = await probeWithAuth(cookie, token, 8000).catch(() => ({ ok: false, status: 0 }))
    if (probeResult.ok) {
      console.log(`[bmo-keeper] probe ok (already connected)`)
      return
    }

    if (!username || !password) {
      throw new Error('缺少 BMO_USERNAME/BMO_PASSWORD，无法进行 API 登录续期')
    }

    const pubRes = await fetchWithTimeout(
      new URL(loginPageEndpoint, baseUrl),
      {
        method: 'POST',
        headers: { ...headersBase, 'x-need-pkey': 'RSA' },
        body: JSON.stringify({ fdClient: 1 })
      },
      15000
    )
    if (!pubRes.ok) throw new Error(`BMO 获取登录公钥失败: HTTP ${pubRes.status}`)
    const pubKey = pubRes.headers.get('x-pubkey')
    if (!pubKey) throw new Error('BMO 未返回 x-pubkey，无法进行 RSA 登录')
    const pubKeyPem = pemFromBase64Spki(pubKey)
    if (!pubKeyPem) throw new Error('BMO 登录公钥为空')

    const encryptedPassword = encryptPasswordRsa(pubKeyPem, password, rsaPadding)
    const form = new URLSearchParams()
    form.set('j_username', username)
    form.set('j_password', encryptedPassword)

    const loginRes = await fetchWithTimeout(
      new URL(loginEndpoint, baseUrl),
      {
        method: 'POST',
        headers: { ...headersBase, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString()
      },
      15000
    )
    const data = await loginRes.json().catch(() => ({}))
    if (!loginRes.ok || data?.success === false) {
      throw new Error(`BMO 登录失败: ${data?.msg || data?.message || `HTTP ${loginRes.status}`}`)
    }

    const newCookie = readCookieHeader(loginRes.headers)
    const tokenFromHeader = loginRes.headers.get('x-auth-token')
    const tokenFromData = data?.data?.token || data?.token
    const newToken = tokenFromHeader || (tokenFromData ? String(tokenFromData) : '')
    if (!newCookie && !newToken) throw new Error('BMO 登录未返回 Cookie/Token')

    const merged = {
      ...existing,
      BMO_BASE_URL: existing.BMO_BASE_URL || baseUrl,
      ...(newCookie ? { BMO_COOKIE: newCookie } : {}),
      ...(newToken ? { BMO_X_AUTH_TOKEN: newToken } : {})
    }
    atomicWriteEnvFile(authFilePath, merged, { mode: 0o640 })
    console.log(`[bmo-keeper] refreshed_at=${new Date().toISOString()}`)
  }

  if (loginMode === 'api') {
    await refreshOnceApi()
    if (once) return
    while (true) {
      await sleep(intervalMs)
      try {
        await refreshOnceApi()
      } catch (e) {
        console.error('[bmo-keeper] refresh failed:', e?.message || e)
      }
    }
  }

  let chromium = null
  try {
    ;({ chromium } = require('playwright-core'))
  } catch (e) {
    throw new Error('缺少依赖：请在 packages/backend 执行 npm i playwright-core，或设置 BMO_KEEPER_LOGIN_MODE=api')
  }

  const chromePath = process.env.BMO_KEEPER_CHROME_PATH || ''
  const headless = resolveBool(process.env.BMO_KEEPER_HEADLESS, true)
  const navTimeoutMs = Number(process.env.BMO_KEEPER_NAV_TIMEOUT_MS || 20000)
  const userDataDir =
    process.env.BMO_KEEPER_USER_DATA_DIR ||
    path.join(os.homedir(), '.cache', 'jh-craftsys', 'bmo-session-keeper')

  console.log(`[bmo-keeper] userDataDir=${userDataDir}`)
  console.log(`[bmo-keeper] headless=${headless ? 'true' : 'false'}`)

  const launchOptions = {
    headless,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    ...(chromePath ? { executablePath: chromePath } : {})
  }

  const context = await chromium.launchPersistentContext(userDataDir, {
    ...launchOptions,
    ignoreHTTPSErrors: true
  })
  const page = await context.newPage()
  page.setDefaultTimeout(navTimeoutMs)
  page.setDefaultNavigationTimeout(navTimeoutMs)

  const waitForCookies = async (maxMs) => {
    const start = Date.now()
    while (Date.now() - start < maxMs) {
      const cookies = await context.cookies()
      if (hasSessionCookies(cookies)) return cookies
      await sleep(500)
    }
    return await context.cookies()
  }

  const refreshOnceChromium = async () => {
    const gotoAndWait = async (url) => {
      await page.goto(url, { waitUntil: 'domcontentloaded' })
      await page.waitForLoadState('networkidle').catch(() => null)
      await sleep(500)
    }

    await gotoAndWait(loginUrl)

    const userLocator = page.locator(
      'input[name="j_username"], input#userName, input#username'
    )
    const passLocator = page.locator(
      'input[name="j_password"], input#passWord, input#password'
    )
    const loginButton = page.locator(
      'button:has-text("登录"), button.user-elem-chml-sso-login-odf82-submit, button[type="submit"]'
    )

    const typeIntoInput = async (locator, value) => {
      const target = locator.first()
      await target.evaluate((el) => {
        if (el && typeof el.removeAttribute === 'function') {
          el.removeAttribute('readonly')
        }
      }).catch(() => null)
      await target.click({ timeout: 2000 })
      // `fill()` is unreliable on this login page (custom input runtime); use keyboard typing.
      await target.press('Control+A').catch(() => null)
      await target.press('Meta+A').catch(() => null)
      await target.press('Backspace').catch(() => null)
      await page.keyboard.type(String(value || ''), { delay: 30 })
    }

    const needLogin = (await userLocator.count()) > 0 && (await passLocator.count()) > 0
    if (needLogin && !manual) {
      if (portal === 'BMO' || portal === 'OA') {
        const portalRadio = page.locator(`input[type="radio"][value="${portal}"]`)
        if ((await portalRadio.count()) > 0) {
          await portalRadio.first().check().catch(() => null)
        }
      }
      await typeIntoInput(userLocator, username)
      await typeIntoInput(passLocator, password)
      const currentUserVal = await userLocator.first().inputValue().catch(() => '')
      const currentPassVal = await passLocator.first().inputValue().catch(() => '')
      if (currentUserVal !== String(username || '') || currentPassVal !== String(password || '')) {
        await page.evaluate(
          ({ u, p }) => {
            const setInput = (selector, val) => {
              const el = document.querySelector(selector)
              if (!el) return false
              const proto = Object.getPrototypeOf(el)
              const desc = proto ? Object.getOwnPropertyDescriptor(proto, 'value') : null
              if (desc && typeof desc.set === 'function') {
                desc.set.call(el, val)
              } else {
                el.value = val
              }
              el.dispatchEvent(new Event('input', { bubbles: true }))
              el.dispatchEvent(new Event('change', { bubbles: true }))
              return true
            }
            setInput('input#username,input#userName,input[name="j_username"]', String(u || ''))
            setInput('input#password,input#passWord,input[name="j_password"]', String(p || ''))
          },
          { u: username, p: password }
        )
      }
      if ((await loginButton.count()) > 0) {
        await loginButton.first().click().catch(() => null)
      }
      await passLocator.first().press('Enter').catch(() => null)
      await waitForCookies(navTimeoutMs)
    }

    if (manual) {
      console.log('[bmo-keeper] waiting for manual login in opened browser...')
      await waitForCookies(manualWaitMs)
    }

    const cookies = await waitForCookies(5000)
    const cookieHeader = getCookieHeaderFromCookies(cookies)
    if (!cookieHeader) {
      const url = page.url()
      const hasUser = await page
        .locator('input[name="j_username"], input#userName, input#username')
        .count()
        .catch(() => 0)
      const hasPass = await page
        .locator('input[name="j_password"], input#passWord, input#password')
        .count()
        .catch(() => 0)
      throw new Error(
        `未能从浏览器上下文读取到 Cookie（登录入口仅 #/login）。url=${url} hasUser=${hasUser} hasPass=${hasPass}`
      )
    }

    const tokenCookie = (cookies || []).find((c) => c?.name === 'X-AUTH-TOKEN')
    const authToken = tokenCookie?.value ? String(tokenCookie.value) : ''
    const probeResult = await probeWithAuth(cookieHeader, authToken, 10000).catch(() => ({
      ok: false,
      status: 0
    }))
    if (!probeResult.ok) {
      throw new Error(`浏览器登录后会话校验失败: status=${probeResult.status || 0}`)
    }

    const existing = readEnvFile(authFilePath)
    const merged = {
      ...existing,
      BMO_BASE_URL: existing.BMO_BASE_URL || baseUrl,
      BMO_COOKIE: cookieHeader,
      ...(authToken ? { BMO_X_AUTH_TOKEN: authToken } : {})
    }

    atomicWriteEnvFile(authFilePath, merged, { mode: 0o640 })
    console.log(`[bmo-keeper] refreshed_at=${new Date().toISOString()}`)
  }

  try {
    await refreshOnceChromium()
    if (once) return

    while (true) {
      await sleep(intervalMs)
      try {
        await refreshOnceChromium()
      } catch (e) {
        console.error('[bmo-keeper] refresh failed:', e?.message || e)
      }
    }
  } finally {
    try {
      await context.close()
    } catch (e) {
      // ignore
    }
  }
}

main().catch((e) => {
  console.error('[bmo-keeper] fatal:', e?.message || e)
  process.exit(1)
})
