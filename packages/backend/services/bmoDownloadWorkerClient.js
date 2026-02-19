const { EventEmitter } = require('events')
const { fork } = require('child_process')
const fs = require('fs')
const path = require('path')

const JOB_EXPIRE_MS = 60 * 60 * 1000
const JOB_RESULT_EXPIRE_MS = 20 * 60 * 1000
const MAX_JOB_COUNT = 300

const emitter = new EventEmitter()
const jobs = new Map()
const queue = []

let worker = null
let workerReady = false
let workerBooting = null
let runningJobId = null
let lastHealth = null
let lastWorkerExit = null
let lastWorkerStderrTail = ''

const toNow = () => new Date().toISOString()

const makeJobId = () =>
  `bmo_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`

const getWorkerScriptPath = () => path.join(__dirname, '..', 'scripts', 'bmo-download-worker.js')

const pickText = (...values) => {
  for (const v of values) {
    const s = String(v || '').trim()
    if (s) return s
  }
  return ''
}

const trimMessage = (message, max = 400) => {
  const s = String(message || '').trim()
  if (!s) return ''
  return s.length > max ? `${s.slice(0, max)}...` : s
}

const appendTail = (current, next, max = 2000) => {
  const merged = `${String(current || '')}${String(next || '')}`
  if (merged.length <= max) return merged
  return merged.slice(merged.length - max)
}

const normalizeJobInput = (input = {}) => ({
  requestId: pickText(input.requestId),
  attachmentId: pickText(input.attachmentId, input.id),
  fdId: pickText(input.fdId, input.bmoRecordId, input.bmo_record_id),
  fileName: pickText(input.fileName, input.fdFileName),
  viewUrl: pickText(input.viewUrl),
  timeoutMs: Number(input.timeoutMs) > 0 ? Number(input.timeoutMs) : undefined,
  downloadTimeoutMs: Number(input.downloadTimeoutMs) > 0 ? Number(input.downloadTimeoutMs) : undefined
})

const toJobSnapshot = (job) => {
  if (!job) return null
  return {
    id: job.id,
    requestId: job.requestId || null,
    attachmentId: job.attachmentId || null,
    fdId: job.fdId || null,
    fileName: job.fileName || null,
    viewUrl: job.viewUrl || null,
    status: job.status,
    createdAt: job.createdAt,
    startedAt: job.startedAt || null,
    finishedAt: job.finishedAt || null,
    error: job.error || null,
    result: job.result
      ? {
          localPath: job.result.localPath || null,
          fileName: job.result.fileName || null,
          size: job.result.size || 0,
          sha256: job.result.sha256 || null,
          contentType: job.result.contentType || null,
          elapsedMs: job.result.elapsedMs || 0
        }
      : null
  }
}

const updateJob = (jobId, patch) => {
  const job = jobs.get(jobId)
  if (!job) return null
  Object.assign(job, patch)
  const snap = toJobSnapshot(job)
  emitter.emit(`job:${jobId}`, snap)
  return job
}

const trimJobs = () => {
  const now = Date.now()
  const staleIds = []

  for (const [jobId, job] of jobs.entries()) {
    const createdTs = new Date(job.createdAt).getTime()
    const finishedTs = job.finishedAt ? new Date(job.finishedAt).getTime() : 0
    const ttl = job.status === 'running' || job.status === 'queued' ? JOB_EXPIRE_MS : JOB_RESULT_EXPIRE_MS
    const baseTs = finishedTs || createdTs
    if (!Number.isFinite(baseTs) || now - baseTs > ttl) staleIds.push(jobId)
  }

  if (!staleIds.length && jobs.size <= MAX_JOB_COUNT) return

  for (const jobId of staleIds) {
    const job = jobs.get(jobId)
    if (job?.result?.localPath) {
      fs.unlink(job.result.localPath, () => {})
    }
    jobs.delete(jobId)
  }

  if (jobs.size <= MAX_JOB_COUNT) return
  const sorted = Array.from(jobs.values()).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )
  const toDrop = Math.max(0, jobs.size - MAX_JOB_COUNT)
  for (let i = 0; i < toDrop; i += 1) {
    const job = sorted[i]
    if (!job) continue
    if (job.result?.localPath) fs.unlink(job.result.localPath, () => {})
    jobs.delete(job.id)
  }
}

const ensureWorker = async () => {
  if (worker && worker.connected) return worker
  if (workerBooting) return workerBooting

  workerBooting = new Promise((resolve, reject) => {
    const scriptPath = getWorkerScriptPath()
    lastWorkerStderrTail = ''
    const child = fork(scriptPath, {
      cwd: path.join(__dirname, '..'),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe', 'ipc']
    })

    let settled = false
    const readyTimer = setTimeout(() => {
      if (settled) return
      settled = true
      reject(new Error('bmo download worker start timeout'))
    }, 15000)

    const finalize = (err, val) => {
      if (settled) return
      settled = true
      clearTimeout(readyTimer)
      if (err) reject(err)
      else resolve(val)
    }

    child.stdout?.on('data', (buf) => {
      const text = String(buf || '').trim()
      if (text) console.log('[bmo-download-worker]', text)
    })
    child.stderr?.on('data', (buf) => {
      const raw = String(buf || '')
      lastWorkerStderrTail = appendTail(lastWorkerStderrTail, raw)
      const text = raw.trim()
      if (text) console.error('[bmo-download-worker]', text)
    })

    child.on('message', (msg) => {
      const type = String(msg?.type || '')
      if (type === 'ready') {
        worker = child
        workerReady = true
        lastHealth = msg?.data || null
        finalize(null, child)
        return
      }

      if (type === 'heartbeat' || type === 'health') {
        lastHealth = msg?.data || null
        return
      }

      if (type === 'jobResult') {
        const jobId = String(msg?.jobId || '').trim()
        if (!jobId) return
        const job = jobs.get(jobId)
        if (!job) {
          runningJobId = null
          setImmediate(kickQueue)
          return
        }

        if (msg?.ok) {
          updateJob(jobId, {
            status: 'success',
            finishedAt: toNow(),
            error: '',
            result: {
              localPath: msg?.result?.outputPath || '',
              fileName: msg?.result?.fileName || job.fileName || '',
              size: Number(msg?.result?.size) || 0,
              sha256: msg?.result?.sha256 || '',
              contentType: msg?.result?.contentType || 'application/octet-stream',
              elapsedMs: Number(msg?.result?.elapsedMs) || 0
            }
          })
        } else {
          updateJob(jobId, {
            status: 'failed',
            finishedAt: toNow(),
            error: trimMessage(msg?.error || '下载失败')
          })
        }

        runningJobId = null
        setImmediate(kickQueue)
      }
    })

    child.on('exit', (code, signal) => {
      lastWorkerExit = {
        at: toNow(),
        code: Number.isFinite(Number(code)) ? Number(code) : null,
        signal: signal || null,
        stderrTail: trimMessage(lastWorkerStderrTail, 800)
      }
      worker = null
      workerReady = false
      lastHealth = null

      if (!settled) {
        const tail = trimMessage(lastWorkerStderrTail, 300)
        finalize(
          new Error(
            `bmo download worker exited early: code=${code} signal=${signal || ''}${
              tail ? ` stderr=${tail}` : ''
            }`
          )
        )
      }

      if (runningJobId) {
        updateJob(runningJobId, {
          status: 'failed',
          finishedAt: toNow(),
          error: `worker exited: code=${code} signal=${signal || ''}${
            lastWorkerExit?.stderrTail ? ` stderr=${lastWorkerExit.stderrTail}` : ''
          }`
        })
        runningJobId = null
        setImmediate(kickQueue)
      }
    })

    child.on('error', (err) => {
      finalize(err)
    })
  })

  try {
    const w = await workerBooting
    return w
  } finally {
    workerBooting = null
  }
}

const kickQueue = async () => {
  if (runningJobId) return
  if (!queue.length) return

  const nextJobId = queue.shift()
  const job = jobs.get(nextJobId)
  if (!job || job.status !== 'queued') {
    setImmediate(kickQueue)
    return
  }

  try {
    const w = await ensureWorker()
    runningJobId = job.id
    updateJob(job.id, { status: 'running', startedAt: toNow() })
    w.send({
      type: 'runJob',
      jobId: job.id,
      job: {
        attachmentId: job.attachmentId,
        fdId: job.fdId,
        fileName: job.fileName,
        viewUrl: job.viewUrl,
        timeoutMs: job.timeoutMs,
        downloadTimeoutMs: job.downloadTimeoutMs
      }
    })
  } catch (e) {
    updateJob(job.id, {
      status: 'failed',
      finishedAt: toNow(),
      error: trimMessage(e?.message || e || 'worker 启动失败')
    })
    runningJobId = null
    setImmediate(kickQueue)
  }
}

const createDownloadJob = async (input = {}) => {
  trimJobs()
  const payload = normalizeJobInput(input)
  if (!payload.attachmentId) {
    throw new Error('缺少 attachmentId')
  }

  const now = toNow()
  const job = {
    id: makeJobId(),
    requestId: payload.requestId || null,
    attachmentId: payload.attachmentId,
    fdId: payload.fdId || null,
    fileName: payload.fileName || null,
    viewUrl: payload.viewUrl || null,
    timeoutMs: payload.timeoutMs,
    downloadTimeoutMs: payload.downloadTimeoutMs,
    status: 'queued',
    createdAt: now,
    startedAt: null,
    finishedAt: null,
    error: '',
    result: null
  }

  jobs.set(job.id, job)
  queue.push(job.id)
  setImmediate(kickQueue)
  return toJobSnapshot(job)
}

const getDownloadJob = (jobId) => {
  trimJobs()
  const job = jobs.get(String(jobId || '').trim())
  return toJobSnapshot(job)
}

const waitForDownloadJob = async (jobId, options = {}) => {
  const id = String(jobId || '').trim()
  if (!id) throw new Error('缺少 jobId')
  const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : 120000

  const current = getDownloadJob(id)
  if (!current) throw new Error('任务不存在')
  if (current.status === 'success' || current.status === 'failed') return current

  return new Promise((resolve, reject) => {
    let timer = null
    const eventName = `job:${id}`

    const done = (err, data) => {
      if (timer) clearTimeout(timer)
      emitter.removeListener(eventName, onUpdate)
      if (err) reject(err)
      else resolve(data)
    }

    const onUpdate = (snapshot) => {
      if (!snapshot) return
      if (snapshot.status === 'success' || snapshot.status === 'failed') {
        done(null, snapshot)
      }
    }

    emitter.on(eventName, onUpdate)
    timer = setTimeout(() => {
      const latest = getDownloadJob(id)
      if (latest && (latest.status === 'success' || latest.status === 'failed')) {
        done(null, latest)
      } else {
        done(new Error(`等待下载超时 (${timeoutMs}ms)`))
      }
    }, timeoutMs)
  })
}

const getDownloadWorkerHealth = async () => {
  const queueLength = queue.length
  const base = {
    workerOnline: Boolean(worker && worker.connected && workerReady),
    workerReady,
    queueLength,
    runningJobId: runningJobId || null,
    lastWorkerExit,
    lastHealth,
    updatedAt: toNow()
  }

  if (worker && worker.connected) {
    try {
      worker.send({ type: 'health' })
    } catch (e) {
      // ignore
    }
  }

  return base
}

const getDownloadJobFile = (jobId) => {
  const job = jobs.get(String(jobId || '').trim())
  if (!job) return null
  if (job.status !== 'success') return null
  const localPath = String(job.result?.localPath || '').trim()
  if (!localPath || !fs.existsSync(localPath)) return null

  return {
    localPath,
    fileName: job.result?.fileName || 'attachment.bin',
    contentType: job.result?.contentType || 'application/octet-stream'
  }
}

const restartDownloadWorker = async () => {
  if (!worker || !worker.connected) {
    worker = null
    workerReady = false
    lastHealth = null
    return { restarted: false, reason: 'worker-not-running' }
  }
  const wasRunningJobId = runningJobId
  if (wasRunningJobId) {
    updateJob(wasRunningJobId, {
      status: 'failed',
      finishedAt: toNow(),
      error: 'worker restarted while job running'
    })
    runningJobId = null
  }
  const exiting = new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), 5000)
    worker.once('exit', () => {
      clearTimeout(timer)
      resolve(true)
    })
  })
  try {
    worker.send({ type: 'shutdown' })
  } catch (e) {
    // ignore send failure and continue
  }
  await exiting
  worker = null
  workerReady = false
  lastHealth = null
  lastWorkerStderrTail = ''
  return { restarted: true, reason: 'manual-restart' }
}

setInterval(trimJobs, 60 * 1000).unref()

module.exports = {
  createDownloadJob,
  getDownloadJob,
  waitForDownloadJob,
  getDownloadWorkerHealth,
  getDownloadJobFile,
  restartDownloadWorker
}
