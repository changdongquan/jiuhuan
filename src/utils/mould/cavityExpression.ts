const toSafeCavity = (value: unknown) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return 1
  return Math.min(64, Math.max(1, Math.round(n)))
}

export const normalizeCavityExpression = (input: unknown) => {
  const raw = String(input ?? '').trim()
  if (!raw) return ''

  const expr = raw.replaceAll(/\s+/g, '')

  const num = Number(expr)
  if (Number.isFinite(num) && !expr.includes('+') && !expr.includes('*')) {
    return `1*${toSafeCavity(num)}`
  }

  const parts = expr
    .split('+')
    .map((p) => p.trim())
    .filter(Boolean)

  const terms: string[] = []
  for (const p of parts) {
    if (!p) continue

    if (p.includes('*')) {
      const segs = p.split('*').map((s) => s.trim())
      const count = segs.at(-1)
      const n = Number(count)
      if (!Number.isFinite(n)) continue
      terms.push(`1*${toSafeCavity(n)}`)
      continue
    }

    const n = Number(p)
    if (!Number.isFinite(n)) continue
    terms.push(`1*${toSafeCavity(n)}`)
  }

  if (terms.length) return terms.join('+')

  const fallback = Number(raw)
  return Number.isFinite(fallback) ? `1*${toSafeCavity(fallback)}` : ''
}

export const isInitDone = (val: unknown) => {
  if (val === true) return true
  if (val === false) return false
  const n = Number(val)
  return Number.isFinite(n) ? n === 1 : false
}
