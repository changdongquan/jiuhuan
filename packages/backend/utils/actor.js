// Resolve a human-readable operator name from request headers.
// Frontend sets X-Display-Name (URL-encoded) and X-Username.
const resolveActorFromReq = (req) => {
  const authDisplayName = String(req?.auth?.displayName || '').trim()
  if (authDisplayName) return authDisplayName
  const authUsername = String(req?.auth?.username || '').trim()
  if (authUsername) return authUsername

  const displayNameRaw = req?.headers?.['x-display-name']
  const displayName = Array.isArray(displayNameRaw) ? displayNameRaw[0] : displayNameRaw
  const displayNameStr = String(displayName || '').trim()
  if (displayNameStr) {
    try {
      const decoded = decodeURIComponent(displayNameStr).trim()
      if (decoded) return decoded
    } catch (_e) {
      return displayNameStr
    }
  }

  const raw = req?.headers?.['x-username']
  const username = Array.isArray(raw) ? raw[0] : raw
  const s = String(username || '').trim()
  return s || null
}

module.exports = { resolveActorFromReq }
