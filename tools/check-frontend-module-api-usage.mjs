#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

const repoRoot = process.cwd()
const viewsDir = path.resolve(repoRoot, 'packages/frontend/src/views')
const targetExt = new Set(['.vue', '.ts', '.tsx', '.js', '.jsx'])

const restrictedImportsByTopDir = {
  Attendance: [
    {
      module: 'employee',
      reason: '考勤页不得直接依赖员工信息模块接口，请改用考勤模块自己的聚合接口。'
    }
  ],
  CustomerInfo: [],
  ProjectManagement: [
    {
      module: 'production-task',
      symbolPattern: /\bgetProductionTaskDetailApi\b/,
      reason: '项目管理页不得直接依赖生产任务模块只读校验接口，请改用项目模块自己的聚合接口。'
    }
  ],
  Quotation: [
    {
      module: 'project',
      reason: '报价页不得直接依赖项目管理模块接口，请改用报价模块自己的聚合接口。'
    }
  ],
  Salary: [
    {
      module: 'employee',
      reason: '工资页不得直接依赖员工信息模块接口，请改用工资模块自己的聚合接口。'
    },
    {
      module: 'attendance',
      reason: '工资页不得直接依赖考勤模块接口，请改用工资模块自己的聚合接口。'
    }
  ],
  SupplierInfo: []
}

const findings = []

const walk = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const abs = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(abs)
      continue
    }
    if (!targetExt.has(path.extname(entry.name))) continue
    scanFile(abs)
  }
}

const scanFile = (absPath) => {
  const relPath = path.relative(viewsDir, absPath)
  const topDir = relPath.split(path.sep)[0]
  const restricted = restrictedImportsByTopDir[topDir]
  if (!restricted || restricted.length === 0) return

  const text = fs.readFileSync(absPath, 'utf8')
  const lines = text.split(/\r?\n/)

  lines.forEach((line, idx) => {
    const match = line.match(/from\s+['"]@\/api\/([^'"/]+)(?:\/[^'"]*)?['"]/)
    if (!match) return
    const apiModule = String(match[1] || '').trim()
    const matchedRule = restricted.find((item) => {
      if (item.module !== apiModule) return false
      if (!item.symbolPattern) return true
      return item.symbolPattern.test(line)
    })
    if (!matchedRule) return

    findings.push({
      file: absPath,
      line: idx + 1,
      apiModule,
      reason: matchedRule.reason,
      text: line.trim()
    })
  })
}

if (!fs.existsSync(viewsDir)) {
  console.error(`[check-frontend-module-api-usage] views directory not found: ${viewsDir}`)
  process.exit(1)
}

walk(viewsDir)

if (!findings.length) {
  console.log('[check-frontend-module-api-usage] OK: no forbidden cross-module API usage found.')
  process.exit(0)
}

console.error('[check-frontend-module-api-usage] Found forbidden cross-module API usage:')
for (const item of findings) {
  const rel = path.relative(repoRoot, item.file)
  console.error(`- ${rel}:${item.line} (@/api/${item.apiModule})`)
  console.error(`  ${item.text}`)
  console.error(`  ${item.reason}`)
}
process.exit(1)
