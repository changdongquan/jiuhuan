const path = require('path')
const { spawn } = require('child_process')

let keeperInFlight = null

const isTimeoutError = (e) => String(e?.message || '').includes('timeout')

const runOnce = async (options = {}) => {
  const disabled = process.env.BMO_KEEPER_DISABLE === '1'
  if (disabled) {
    return { ok: false, skipped: true, message: 'BMO keeper disabled (BMO_KEEPER_DISABLE=1)' }
  }

  const timeoutMs = Number(options.timeoutMs || process.env.BMO_KEEPER_RUN_TIMEOUT_MS || 60000)
  const effectiveTimeoutMs = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 60000

  if (keeperInFlight) return keeperInFlight

  keeperInFlight = new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, '..', 'scripts', 'bmo-session-keeper.js')
    const envOverrides =
      options && options.env && typeof options.env === 'object' ? options.env : {}
    const child = spawn(process.execPath, [scriptPath, '--once'], {
      env: {
        ...process.env,
        ...envOverrides,
        // In non-dev environments, default to headless for keeper runs unless explicitly set.
        BMO_KEEPER_HEADLESS:
          envOverrides.BMO_KEEPER_HEADLESS ??
          process.env.BMO_KEEPER_HEADLESS ??
          'true'
      },
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => {
      stdout += String(d || '')
    })
    child.stderr.on('data', (d) => {
      stderr += String(d || '')
    })

    const timer = setTimeout(() => {
      try {
        child.kill('SIGKILL')
      } catch (e) {
        // ignore
      }
      reject(new Error(`bmo-session-keeper timeout (${effectiveTimeoutMs}ms)`))
    }, effectiveTimeoutMs)

    child.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) {
        resolve({ ok: true, code, stdout, stderr })
      } else {
        const msg = stderr.trim() || stdout.trim() || `keeper exited with code ${code}`
        reject(new Error(msg))
      }
    })
  })
    .catch((e) => {
      if (isTimeoutError(e)) {
        return { ok: false, timeout: true, message: e.message }
      }
      return { ok: false, message: e?.message || String(e) }
    })
    .finally(() => {
      keeperInFlight = null
    })

  return keeperInFlight
}

module.exports = {
  runOnce
}
