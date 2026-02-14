const status = {
  lastLiveOkAt: null,
  lastLiveErrorAt: null,
  lastLiveErrorMessage: null,
  lastPersistStartedAt: null,
  lastPersistFinishedAt: null,
  lastPersistUpserted: null,
  lastPersistErrorAt: null,
  lastPersistErrorMessage: null
}

const nowIso = () => new Date().toISOString()

const markLiveOk = () => {
  status.lastLiveOkAt = nowIso()
  status.lastLiveErrorAt = null
  status.lastLiveErrorMessage = null
}

const markLiveError = (error) => {
  status.lastLiveErrorAt = nowIso()
  status.lastLiveErrorMessage = String(error?.message || error || 'unknown error')
}

const markPersistStart = () => {
  status.lastPersistStartedAt = nowIso()
  status.lastPersistFinishedAt = null
  status.lastPersistUpserted = null
  status.lastPersistErrorAt = null
  status.lastPersistErrorMessage = null
}

const markPersistSuccess = (upserted) => {
  status.lastPersistFinishedAt = nowIso()
  status.lastPersistUpserted = Number.isFinite(Number(upserted)) ? Number(upserted) : null
  status.lastPersistErrorAt = null
  status.lastPersistErrorMessage = null
}

const markPersistError = (error) => {
  status.lastPersistErrorAt = nowIso()
  status.lastPersistErrorMessage = String(error?.message || error || 'unknown error')
}

const getBmoStatus = () => ({ ...status })

module.exports = {
  getBmoStatus,
  markLiveOk,
  markLiveError,
  markPersistStart,
  markPersistSuccess,
  markPersistError
}

