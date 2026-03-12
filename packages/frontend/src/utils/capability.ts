export interface CapabilityUserLike {
  capabilities?: unknown
  permissions?: unknown
}

const normalizeStringList = (value: unknown, upperCase = false): string[] => {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .map((item) => (upperCase ? item.toUpperCase() : item))
}

export const hasUserCapability = (
  userInfo: CapabilityUserLike | null | undefined,
  capabilityKey: string,
  fallbackPermission?: string
) => {
  const capabilityKeys = normalizeStringList(userInfo?.capabilities, true)
  const routePermissions = normalizeStringList(userInfo?.permissions)
  const normalizedCapabilityKey = String(capabilityKey || '')
    .trim()
    .toUpperCase()
  const normalizedFallbackPermission = String(fallbackPermission || '').trim()

  if (normalizedCapabilityKey && capabilityKeys.includes(normalizedCapabilityKey)) {
    return true
  }

  if (normalizedFallbackPermission && routePermissions.includes(normalizedFallbackPermission)) {
    return true
  }

  return false
}
