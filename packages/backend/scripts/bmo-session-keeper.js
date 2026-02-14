#!/usr/bin/env node
/* eslint-disable no-console */
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

const resolveBool = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback
  const v = String(value).trim().toLowerCase()
  if (v === '1' || v === 'true' || v === 'yes' || v === 'y') return true
  if (v === '0' || v === 'false' || v === 'no' || v === 'n') return false
  return fallback
}

const main = async () => {
  let chromium = null
  try {
    ;({ chromium } = require('playwright-core'))
  } catch (e) {
    throw new Error('缺少依赖：请在 packages/backend 执行 npm i playwright-core')
  }

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

  const baseUrl = (process.env.BMO_BASE_URL || 'https://bmo.meiling.com:8023').replace(/\/+$/, '')
  const username = process.env.BMO_USERNAME || ''
  const password = process.env.BMO_PASSWORD || ''
  const authFilePath = process.env.BMO_KEEPER_OUTPUT_ENV_PATH || process.env.BMO_AUTH_FILE || ''
  const chromePath = process.env.BMO_KEEPER_CHROME_PATH || ''
  const headless = resolveBool(process.env.BMO_KEEPER_HEADLESS, true)
  const intervalMs = Number(process.env.BMO_KEEPER_INTERVAL_MS || 10 * 60 * 1000)
  const navTimeoutMs = Number(process.env.BMO_KEEPER_NAV_TIMEOUT_MS || 20000)
  const manualWaitMs = Number(process.env.BMO_KEEPER_MANUAL_WAIT_MS || 120000)
  const userDataDir =
    process.env.BMO_KEEPER_USER_DATA_DIR ||
    path.join(os.homedir(), '.cache', 'jh-craftsys', 'bmo-session-keeper')

  if (!authFilePath) {
    throw new Error('未配置输出路径：请设置 BMO_AUTH_FILE 或 BMO_KEEPER_OUTPUT_ENV_PATH')
  }
  if (!manual && (!username || !password)) {
    throw new Error('未配置账号密码：请设置 BMO_USERNAME/BMO_PASSWORD（用于自动登录续期），或使用 --manual 手动登录')
  }

  console.log(`[bmo-keeper] baseUrl=${baseUrl}`)
  console.log(`[bmo-keeper] userDataDir=${userDataDir}`)
  console.log(`[bmo-keeper] output=${authFilePath}`)
  console.log(
    `[bmo-keeper] headless=${headless ? 'true' : 'false'} once=${once ? 'true' : 'false'} manual=${manual ? 'true' : 'false'}`
  )

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

  const refreshOnce = async () => {
    await page.goto(`${baseUrl}/web/`, { waitUntil: 'domcontentloaded' })

    const userLocator = page.locator('input[name="j_username"]')
    const passLocator = page.locator('input[name="j_password"]')

    const needLogin = (await userLocator.count()) > 0 && (await passLocator.count()) > 0
    if (needLogin && !manual) {
      await userLocator.first().fill(username)
      await passLocator.first().fill(password)

      // Prefer pressing Enter to trigger the page's login handler (which usually encrypts password).
      await passLocator.first().press('Enter')

      // Wait until login form disappears or a post-login shell appears.
      const loginGone = page
        .locator('input[name="j_username"]')
        .first()
        .waitFor({ state: 'detached', timeout: navTimeoutMs })
        .catch(() => null)
      const urlChanged = page
        .waitForURL((url) => !String(url).includes('login'), { timeout: navTimeoutMs })
        .catch(() => null)
      await Promise.race([loginGone, urlChanged])
    }

    if (manual) {
      console.log('[bmo-keeper] waiting for manual login in opened browser...')
      const start = Date.now()
      while (Date.now() - start < manualWaitMs) {
        const cookies = await context.cookies()
        const hasLtpa = (cookies || []).some((c) => c?.name === 'LtpaToken' && c?.value)
        const hasAuth = (cookies || []).some((c) => c?.name === 'X-AUTH-TOKEN' && c?.value)
        if (hasLtpa || hasAuth) break
        await sleep(800)
      }
    }

    const cookies = await context.cookies()
    const cookieHeader = getCookieHeaderFromCookies(cookies)
    if (!cookieHeader) {
      throw new Error('未能从浏览器上下文读取到 Cookie（可能仍未登录成功）')
    }

    const tokenCookie = (cookies || []).find((c) => c?.name === 'X-AUTH-TOKEN')
    const authToken = tokenCookie?.value ? String(tokenCookie.value) : ''

    const existing = readEnvFile(authFilePath)
    const merged = {
      ...existing,
      BMO_BASE_URL: existing.BMO_BASE_URL || baseUrl,
      BMO_COOKIE: cookieHeader,
      ...(authToken ? { BMO_X_AUTH_TOKEN: authToken } : {})
    }

    // Best-effort keep secrets file permissions: root:www-data 640 (common in jiuhuan).
    atomicWriteEnvFile(authFilePath, merged, { mode: 0o640 })

    console.log(`[bmo-keeper] refreshed_at=${new Date().toISOString()}`)
  }

  try {
    await refreshOnce()
    if (once) return

    while (true) {
      await sleep(intervalMs)
      try {
        await refreshOnce()
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
