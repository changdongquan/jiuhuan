#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

const repoRoot = process.cwd()
const viewsDir = path.resolve(repoRoot, 'packages/frontend/src/views')
const allowDir = path.join(viewsDir, 'CustomerInfo') + path.sep
const targetExt = new Set(['.vue', '.ts', '.tsx', '.js', '.jsx'])
const patterns = ["@/api/customer", '/api/customer']

const findings = []

const walk = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const abs = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (abs.startsWith(allowDir)) continue
      walk(abs)
      continue
    }

    if (!targetExt.has(path.extname(entry.name))) continue
    if (abs.startsWith(allowDir)) continue

    const text = fs.readFileSync(abs, 'utf8')
    const lines = text.split(/\r?\n/)
    lines.forEach((line, idx) => {
      const matched = patterns.find((p) => line.includes(p))
      if (!matched) return
      findings.push({
        file: abs,
        line: idx + 1,
        pattern: matched,
        text: line.trim()
      })
    })
  }
}

if (!fs.existsSync(viewsDir)) {
  console.error(`[check-customer-api-usage] views directory not found: ${viewsDir}`)
  process.exit(1)
}

walk(viewsDir)

if (!findings.length) {
  console.log('[check-customer-api-usage] OK: no cross-module customer API usage found.')
  process.exit(0)
}

console.error('[check-customer-api-usage] Found forbidden customer API usage outside CustomerInfo:')
for (const item of findings) {
  const rel = path.relative(repoRoot, item.file)
  console.error(`- ${rel}:${item.line} (${item.pattern})`)
  console.error(`  ${item.text}`)
}
console.error(
  '[check-customer-api-usage] Please use module-local customer option endpoints instead of customer module routes.'
)
process.exit(1)

