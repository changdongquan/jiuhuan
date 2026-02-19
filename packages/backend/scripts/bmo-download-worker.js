#!/usr/bin/env node

const crypto = require('crypto')
const fs = require('fs')
const os = require('os')
const path = require('path')

let chromium = null
try {
  ;({ chromium } = require('playwright-core'))
} catch (e) {
  // defer failure to job execution so process stays observable by health endpoint
}

const DEFAULT_BASE_URL = 'https://bmo.meiling.com:8023'
const DEFAULT_FORM_ID = '1irp0kjmvwbrwis74wkebru36jtraf1cs5w0'
const DEFAULT_VIEW_ID = '1irp0kk3gwbrwis9nw2ojg5as35h08qs3vw0'
const DEFAULT_XFORM_ID = '1irp0kjmvwbrwis74wkebru36jtraf1cs5w0'
const DEFAULT_LIST_VIEW_ID = '1isqa135kwe9w4adow1ng3ksi3rrcgl912w0'
const DEFAULT_MENU_ID = '1j7l907fmwmnw15nihw3essaq61h6trmg3w0'
const DEFAULT_JOB_TIMEOUT_MS = 60000
const DEFAULT_DOWNLOAD_TIMEOUT_MS = 30000

const state = {
  startedAt: new Date().toISOString(),
  lastHeartbeatAt: new Date().toISOString(),
  lastSuccessAt: null,
  lastError: null,
  busy: false,
  currentJobId: null,
  browserPid: null,
  profileDir: '',
  context: null,
  launching: null
}

const parseBool = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback
  const s = String(value).trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(s)) return true
  if (['0', 'false', 'no', 'off'].includes(s)) return false
  return fallback
}

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
    return null
  }
}

const sanitizeFileName = (name) => {
  const safe = String(name || '').trim().replace(/[\\/:*?"<>|\r\n]+/g, '_')
  return safe || `attachment-${Date.now()}.bin`
}

const getProfileDir = () => {
  const envDir =
    process.env.BMO_DOWNLOAD_WORKER_USER_DATA_DIR || process.env.BMO_KEEPER_USER_DATA_DIR || ''
  if (envDir) return path.resolve(envDir)
  return path.join(os.homedir(), '.cache', 'jh-craftsys', 'bmo-download-worker')
}

const detectContentType = (fileName) => {
  const name = String(fileName || '').toLowerCase()
  if (name.endsWith('.xlsx')) {
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  }
  if (name.endsWith('.xls')) return 'application/vnd.ms-excel'
  if (name.endsWith('.csv')) return 'text/csv; charset=utf-8'
  if (name.endsWith('.pdf')) return 'application/pdf'
  return 'application/octet-stream'
}

const buildDetailUrl = (fdId) => {
  const baseUrl = (process.env.BMO_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '')
  const formId = process.env.BMO_MOULD_FORM_ID || DEFAULT_FORM_ID
  const listViewId = process.env.BMO_MOULD_LIST_VIEW_ID || DEFAULT_LIST_VIEW_ID
  const menuId = process.env.BMO_MOULD_MENU_ID || DEFAULT_MENU_ID
  return `${baseUrl}/web/#/current/sys-modeling/app/mojuxt/view/${formId}/${encodeURIComponent(
    String(fdId || '').trim()
  )}?listviewId=${encodeURIComponent(listViewId)}&menuId=${encodeURIComponent(menuId)}&fdOpenMode=new`
}

const getBaseUrl = () => (process.env.BMO_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '')

const getLoginConfig = () => {
  const authFilePath = String(process.env.BMO_AUTH_FILE || '').trim()
  const fromFile = authFilePath ? readAuthFromEnvFile(authFilePath) : null
  return {
    baseUrl: (process.env.BMO_BASE_URL || fromFile?.BMO_BASE_URL || DEFAULT_BASE_URL).replace(
      /\/+$/,
      ''
    ),
    cookieHeader: String(process.env.BMO_COOKIE || fromFile?.BMO_COOKIE || '').trim(),
    authToken: String(process.env.BMO_X_AUTH_TOKEN || fromFile?.BMO_X_AUTH_TOKEN || '').trim(),
    username: String(process.env.BMO_USERNAME || fromFile?.BMO_USERNAME || '').trim(),
    password: String(process.env.BMO_PASSWORD || fromFile?.BMO_PASSWORD || '').trim(),
    portal: String(process.env.BMO_KEEPER_PORTAL || fromFile?.BMO_KEEPER_PORTAL || 'BMO')
      .trim()
      .toUpperCase()
  }
}

const parseCookieHeader = (cookieHeader) => {
  const out = []
  const src = String(cookieHeader || '').trim()
  if (!src) return out
  for (const seg of src.split(';')) {
    const item = String(seg || '').trim()
    if (!item) continue
    const idx = item.indexOf('=')
    if (idx <= 0) continue
    const name = item.slice(0, idx).trim()
    const value = item.slice(idx + 1).trim()
    if (!name) continue
    out.push({ name, value })
  }
  return out
}

const emit = (payload) => {
  if (typeof process.send === 'function') process.send(payload)
}

const toHealth = () => ({
  startedAt: state.startedAt,
  lastHeartbeatAt: state.lastHeartbeatAt,
  lastSuccessAt: state.lastSuccessAt,
  lastError: state.lastError,
  busy: state.busy,
  currentJobId: state.currentJobId,
  browserPid: state.browserPid,
  profileDir: state.profileDir
})

const ensureContext = async () => {
  if (!chromium) {
    throw new Error('缺少 playwright-core，无法启动下载 worker')
  }
  if (state.context) return state.context
  if (state.launching) return state.launching

  state.launching = (async () => {
    const profileDir = getProfileDir()
    fs.mkdirSync(profileDir, { recursive: true })
    state.profileDir = profileDir

    const headless = parseBool(process.env.BMO_DOWNLOAD_WORKER_HEADLESS, true)
    const executablePath =
      process.env.BMO_DOWNLOAD_WORKER_CHROME_PATH || process.env.BMO_KEEPER_CHROME_PATH || undefined

    const context = await chromium.launchPersistentContext(profileDir, {
      headless,
      acceptDownloads: true,
      ignoreHTTPSErrors: true,
      ...(executablePath ? { executablePath } : {}),
      args: ['--no-sandbox', '--disable-dev-shm-usage']
    })
    state.browserPid = context.browser()?._initializer?.process?.pid || null
    context.on('close', () => {
      state.context = null
      state.browserPid = null
    })
    state.context = context
    return context
  })()

  try {
    return await state.launching
  } finally {
    state.launching = null
  }
}

const clickDownloadButton = async (page, fileName) => {
  const normalizedName = String(fileName || '').trim()
  const rowSelector = normalizedName ? `tr:has-text("${normalizedName.replace(/"/g, '\\"')}")` : ''

  if (rowSelector) {
    const row = page.locator(rowSelector).first()
    if ((await row.count()) > 0) {
      const rowButton = row
        .locator('button:has-text("下载"), a:has-text("下载"), [title*="下载"], .el-icon-download')
        .first()
      if ((await rowButton.count()) > 0) {
        await rowButton.click({ timeout: 3000 }).catch(() => null)
        return true
      }
    }
  }

  const selectors = [
    'button:has-text("下载")',
    'a:has-text("下载")',
    '[title*="下载"]',
    '[aria-label*="下载"]',
    '.el-button:has-text("下载")',
    '.el-dropdown-menu__item:has-text("下载")'
  ]

  for (const sel of selectors) {
    const target = page.locator(sel).first()
    if ((await target.count()) > 0) {
      await target.click({ timeout: 3000 }).catch(() => null)
      return true
    }
  }

  const clickedByScript = await page
    .evaluate(() => {
      const els = Array.from(document.querySelectorAll('button,a,span,div,i'))
      for (const el of els) {
        const text = (el.textContent || '').trim()
        const title = (el.getAttribute('title') || '').trim()
        if (text.includes('下载') || title.includes('下载')) {
          el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
          return true
        }
      }
      return false
    })
    .catch(() => false)

  return Boolean(clickedByScript)
}

const tryDownloadByPageApi = async (page, payload) => {
  const result = await page.evaluate(
    async ({ fdId, attachmentId, viewId, formId, xformId, authToken }) => {
      const fail = (message) => ({ ok: false, message: String(message || '').slice(0, 200) })
      try {
        const headers = {
          'Content-Type': 'application/json;charset=UTF-8'
        }
        if (authToken) headers['X-AUTH-TOKEN'] = authToken
        const viewResp = await fetch('/data/sys-modeling/sysModelingMain/view', {
          method: 'POST',
          credentials: 'include',
          headers,
          body: JSON.stringify({
            fdId,
            fdMode: 1,
            fdViewId: viewId,
            fdFormId: formId,
            fdXFormId: xformId,
            mechanisms: { load: '*' }
          })
        })
        if (!viewResp.ok) return fail(`view failed (${viewResp.status})`)
        const viewJson = await viewResp.json().catch(() => ({}))
        const mechAuthToken = viewJson?.data?.mechanisms?.['sys-auth']?.mechAuthToken || ''
        if (!mechAuthToken) return fail('missing mechAuthToken')

        const checkResp = await fetch(
          `/data/sys-attach/checkDownload/${encodeURIComponent(attachmentId)}?mechAuthToken=${encodeURIComponent(mechAuthToken)}`,
          {
            method: 'POST',
            credentials: 'include',
            headers,
            body: '{}'
          }
        )
        if (!checkResp.ok) {
          const txt = await checkResp.text().catch(() => '')
          return fail(`checkDownload failed (${checkResp.status}) ${txt}`.slice(0, 200))
        }

        const dlResp = await fetch(`/data/sys-attach/download/${encodeURIComponent(attachmentId)}?mechAuthToken=${encodeURIComponent(mechAuthToken)}`, {
          credentials: 'include',
          headers: authToken ? { 'X-AUTH-TOKEN': authToken } : undefined
        })
        if (!dlResp.ok) {
          const txt = await dlResp.text().catch(() => '')
          return fail(`download failed (${dlResp.status}) ${txt}`.slice(0, 200))
        }
        const contentType = dlResp.headers.get('content-type') || 'application/octet-stream'
        const ab = await dlResp.arrayBuffer()
        let binary = ''
        const bytes = new Uint8Array(ab)
        const chunkSize = 0x8000
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const chunk = bytes.subarray(i, i + chunkSize)
          binary += String.fromCharCode(...chunk)
        }
        const base64 = btoa(binary)
        return { ok: true, base64, contentType }
      } catch (e) {
        return fail(e?.message || e)
      }
    },
    payload
  )
  return result
}

const typeIntoInput = async (page, locator, value) => {
  const target = locator.first()
  await target
    .evaluate((el) => {
      if (el && typeof el.removeAttribute === 'function') el.removeAttribute('readonly')
    })
    .catch(() => null)
  await target.click({ timeout: 2000 }).catch(() => null)
  await target.press('Control+A').catch(() => null)
  await target.press('Meta+A').catch(() => null)
  await target.press('Backspace').catch(() => null)
  await page.keyboard.type(String(value || ''), { delay: 20 })
}

const ensureLoggedIn = async (page) => {
  const { baseUrl, username, password, portal } = getLoginConfig()
  if (!username || !password) {
    throw new Error('缺少 BMO_USERNAME/BMO_PASSWORD，无法自动登录 BMO')
  }

  await page.goto(`${baseUrl}/web/#/login`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)

  const userLocator = page.locator('input[name="j_username"], input#userName, input#username')
  const passLocator = page.locator('input[name="j_password"], input#passWord, input#password')
  const loginButton = page.locator(
    'button:has-text("登录"), button.user-elem-chml-sso-login-odf82-submit, button[type="submit"]'
  )

  const needLogin = (await userLocator.count()) > 0 && (await passLocator.count()) > 0
  if (!needLogin) {
    await page.waitForTimeout(1000)
    return
  }

  if (portal === 'BMO' || portal === 'OA') {
    const portalRadio = page.locator(`input[type="radio"][value="${portal}"]`)
    if ((await portalRadio.count()) > 0) {
      await portalRadio.first().check().catch(() => null)
    }
  }

  await typeIntoInput(page, userLocator, username)
  await typeIntoInput(page, passLocator, password)
  if ((await loginButton.count()) > 0) {
    await loginButton.first().click().catch(() => null)
  } else {
    await passLocator.first().press('Enter').catch(() => null)
  }
  await page.waitForTimeout(2500)
}

const applyStaticAuthToPage = async (context, page) => {
  const { baseUrl, cookieHeader, authToken } = getLoginConfig()
  const parsedUrl = new URL(baseUrl)
  const cookies = parseCookieHeader(cookieHeader).map((x) => ({
    name: x.name,
    value: x.value,
    domain: parsedUrl.hostname,
    path: '/',
    secure: parsedUrl.protocol === 'https:',
    httpOnly: false
  }))
  if (cookies.length) {
    await context.addCookies(cookies).catch(() => null)
  }
  if (authToken) {
    await page.setExtraHTTPHeaders({ 'X-AUTH-TOKEN': authToken }).catch(() => null)
  }
}

const runDownloadJob = async (job) => {
  const attachmentId = String(job?.attachmentId || '').trim()
  const fdId = String(job?.fdId || '').trim()
  const fileName = sanitizeFileName(job?.fileName || '')
  const viewUrl = String(job?.viewUrl || '').trim()

  if (!attachmentId) throw new Error('缺少 attachmentId')
  if (!fdId && !viewUrl) throw new Error('缺少 fdId/viewUrl，无法定位附件页面')

  const context = await ensureContext()
  const page = await context.newPage()
  const jobTimeoutMs = Number(job?.timeoutMs) > 0 ? Number(job.timeoutMs) : DEFAULT_JOB_TIMEOUT_MS
  const downloadTimeoutMs =
    Number(job?.downloadTimeoutMs) > 0
      ? Number(job.downloadTimeoutMs)
      : Number(process.env.BMO_DOWNLOAD_WORKER_DOWNLOAD_TIMEOUT_MS || DEFAULT_DOWNLOAD_TIMEOUT_MS)

  page.setDefaultTimeout(Math.min(jobTimeoutMs, 45000))
  page.setDefaultNavigationTimeout(Math.min(jobTimeoutMs, 45000))

  const targetUrl = viewUrl || buildDetailUrl(fdId)
  const startedAt = Date.now()
  let apiFailureMessage = ''

  try {
    const loginCfg = getLoginConfig()
    await applyStaticAuthToPage(context, page)
    const baseUrl = getBaseUrl()
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle').catch(() => null)
    await page.waitForTimeout(1200)

    const currentUrl = page.url()
    const maybeLoginInput = page.locator(
      'input[name="j_username"], input#userName, input#username'
    )
    if (currentUrl.includes('/login') || currentUrl.startsWith(`${baseUrl}/web/#/login`) || (await maybeLoginInput.count()) > 0) {
      await ensureLoggedIn(page)
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded' })
      await page.waitForLoadState('networkidle').catch(() => null)
      await page.waitForTimeout(1500)
    }

    if (fdId) {
      const dumpApiResult = (apiResult) => {
        if (apiResult?.ok && apiResult.base64) {
          const suggestedName = sanitizeFileName(fileName || `${attachmentId}.bin`)
          const outputPath = path.join(
            os.tmpdir(),
            `bmo-worker-${Date.now()}-${Math.random().toString(16).slice(2)}-${suggestedName}`
          )
          const buf = Buffer.from(apiResult.base64, 'base64')
          fs.writeFileSync(outputPath, buf)
          const stat = fs.statSync(outputPath)
          if (!stat.size) throw new Error('下载文件为空')
          const sha256 = crypto.createHash('sha256').update(buf).digest('hex')
          return {
            attachmentId,
            fdId: fdId || null,
            fileName: suggestedName,
            outputPath,
            size: stat.size,
            sha256,
            contentType: apiResult.contentType || detectContentType(suggestedName),
            elapsedMs: Date.now() - startedAt
          }
        }
        return null
      }

      const doApiDownload = () =>
        tryDownloadByPageApi(page, {
          fdId,
          attachmentId,
          viewId:
            process.env.BMO_MOULD_DETAIL_FD_VIEW_ID ||
            process.env.BMO_MOULD_DETAIL_VIEW_ID ||
            DEFAULT_VIEW_ID,
          formId:
            process.env.BMO_MOULD_DETAIL_FD_FORM_ID ||
            process.env.BMO_MOULD_FORM_ID ||
            DEFAULT_FORM_ID,
          xformId:
            process.env.BMO_MOULD_DETAIL_FD_XFORM_ID ||
            process.env.BMO_MOULD_DETAIL_XFORM_ID ||
            DEFAULT_XFORM_ID,
          authToken: loginCfg.authToken || ''
        })

      let apiResult = await doApiDownload()
      const apiSuccess = dumpApiResult(apiResult)
      if (apiSuccess) return apiSuccess
      apiFailureMessage = String(apiResult?.message || 'api download failed').slice(0, 160)

      await ensureLoggedIn(page).catch(() => null)
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded' }).catch(() => null)
      await page.waitForLoadState('networkidle').catch(() => null)
      await page.waitForTimeout(1500)

      apiResult = await doApiDownload()
      const apiSuccess2 = dumpApiResult(apiResult)
      if (apiSuccess2) return apiSuccess2
      apiFailureMessage = String(apiResult?.message || apiFailureMessage || 'api download failed').slice(
        0,
        160
      )
    }

    const downloadPromise = page
      .waitForEvent('download', { timeout: downloadTimeoutMs })
      .then((download) => ({ ok: true, download }))
      .catch((error) => ({ ok: false, error }))
    const clicked = await clickDownloadButton(page, fileName)
    if (!clicked) {
      throw new Error(
        `下载按钮不存在${apiFailureMessage ? `；API链路失败: ${apiFailureMessage}` : ''}`
      )
    }

    const downloadResult = await downloadPromise
    if (!downloadResult?.ok || !downloadResult.download) {
      const detail = String(downloadResult?.error?.message || downloadResult?.error || '').slice(
        0,
        160
      )
      throw new Error(
        `等待下载失败${detail ? `: ${detail}` : ''}${
          apiFailureMessage ? `；API链路失败: ${apiFailureMessage}` : ''
        }`
      )
    }
    const download = downloadResult.download
    const suggestedName = sanitizeFileName((await download.suggestedFilename()) || fileName)
    const outputPath = path.join(
      os.tmpdir(),
      `bmo-worker-${Date.now()}-${Math.random().toString(16).slice(2)}-${suggestedName}`
    )
    await download.saveAs(outputPath)

    const stat = fs.statSync(outputPath)
    if (!stat.size) throw new Error('下载文件为空')
    const sha256 = crypto.createHash('sha256').update(fs.readFileSync(outputPath)).digest('hex')

    return {
      attachmentId,
      fdId: fdId || null,
      fileName: suggestedName,
      outputPath,
      size: stat.size,
      sha256,
      contentType: detectContentType(suggestedName),
      elapsedMs: Date.now() - startedAt
    }
  } finally {
    await page.close().catch(() => null)
  }
}

const handleRunJob = async (msg) => {
  const jobId = String(msg?.jobId || '').trim()
  if (!jobId) return

  state.busy = true
  state.currentJobId = jobId
  state.lastError = null

  try {
    const result = await runDownloadJob(msg?.job || {})
    state.lastSuccessAt = new Date().toISOString()
    emit({ type: 'jobResult', jobId, ok: true, result })
  } catch (e) {
    const message = String(e?.message || e || '下载失败')
    state.lastError = message
    emit({ type: 'jobResult', jobId, ok: false, error: message })
  } finally {
    state.busy = false
    state.currentJobId = null
    state.lastHeartbeatAt = new Date().toISOString()
  }
}

process.on('message', (msg) => {
  const type = String(msg?.type || '')
  if (type === 'runJob') {
    handleRunJob(msg).catch((e) => {
      emit({ type: 'workerError', error: String(e?.message || e) })
    })
    return
  }
  if (type === 'health') {
    emit({ type: 'health', data: toHealth() })
    return
  }
  if (type === 'shutdown') {
    Promise.resolve()
      .then(async () => {
        if (state.context) {
          await state.context.close().catch(() => null)
          state.context = null
        }
      })
      .finally(() => process.exit(0))
  }
})

setInterval(() => {
  state.lastHeartbeatAt = new Date().toISOString()
  emit({ type: 'heartbeat', data: toHealth() })
}, 10000).unref()

emit({ type: 'ready', data: toHealth() })
