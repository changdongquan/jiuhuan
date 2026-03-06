const ROUTE_ALIAS_GROUPS = [
  ['ProjectInfoIndex', 'ProjectInfo'],
  ['CustomerInfoIndex', 'CustomerInfo'],
  ['SupplierInfoIndex', 'SupplierInfo'],
  ['EmployeeInfoIndex', 'EmployeeInfo']
]

const buildAliasMap = () => {
  const map = new Map()
  for (const group of ROUTE_ALIAS_GROUPS) {
    const normalized = group.map((x) => String(x || '').trim()).filter(Boolean)
    if (!normalized.length) continue
    const set = new Set(normalized)
    for (const key of normalized) {
      map.set(key, set)
    }
  }
  return map
}

const ALIAS_MAP = buildAliasMap()

const resolvePermissionCandidates = (routeName) => {
  const key = String(routeName || '').trim()
  if (!key) return []
  const aliasSet = ALIAS_MAP.get(key)
  if (!aliasSet) return [key]
  return Array.from(aliasSet)
}

const expandPermissionNames = (routeNames) => {
  const input = Array.isArray(routeNames) ? routeNames : []
  const out = new Set()
  for (const raw of input) {
    const name = String(raw || '').trim()
    if (!name) continue
    const aliases = resolvePermissionCandidates(name)
    aliases.forEach((x) => out.add(x))
  }
  return Array.from(out)
}

module.exports = {
  resolvePermissionCandidates,
  expandPermissionNames
}
