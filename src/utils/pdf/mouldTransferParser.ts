export type MouldTransferRow = {
  index: number
  partNo: string
  mouldName: string
  mouldNo: string
  mouldFactory: string
  moveTo: string
  sealSampleNo: string
}

export type MouldTransferImportResult = {
  type: 'mould-transfer'
  mouldMoveDate: string
  rows: MouldTransferRow[]
  rawText: string
}

const DATE_STRICT_RE = /\b(\d{4}-\d{2}-\d{2})\b/
const DATE_LOOSE_RE = /(\d{4})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{1,2})/
const DATE_CN_RE = /(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日?/
// Hyphen chars seen in PDFs: -, fullwidth, em/en dash, non-breaking hyphen, minus sign.
const HYPHEN_CHARS = '[-－—–‑−]'
const SEAL_NO_RE = new RegExp(
  String.raw`(ML\\s*${HYPHEN_CHARS}\\s*[A-Z0-9]+\\s*${HYPHEN_CHARS}\\s*\\d{8}\\s*${HYPHEN_CHARS}\\s*\\d+)`
)
const MOULD_NO_RE = /(ML\s*\d+)/

// Keep multi-spaces produced by layout reconstruction (used for table column splitting).
const normalizeText = (text: string) =>
  String(text || '')
    .replace(/\r/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/\t/g, ' ')

const pad2 = (n: string) => (String(n).length === 1 ? `0${n}` : String(n))

const tryParseDate = (s: string): string => {
  const strict = s.match(DATE_STRICT_RE)?.[1]
  if (strict) return strict

  const loose = s.match(DATE_LOOSE_RE)
  if (loose?.[1] && loose?.[2] && loose?.[3])
    return `${loose[1]}-${pad2(loose[2])}-${pad2(loose[3])}`

  const cn = s.match(DATE_CN_RE)
  if (cn?.[1] && cn?.[2] && cn?.[3]) return `${cn[1]}-${pad2(cn[2])}-${pad2(cn[3])}`

  return ''
}

const findMouldMoveDate = (rawText: string, lines: string[]): string => {
  // Prefer compact matching first (handles spaces inserted between CJK characters).
  const compact = rawText.replace(/\s+/g, '')
  {
    const m = compact.match(/模具移模时间(\d{4}-\d{2}-\d{2})/)
    if (m?.[1]) return m[1]
  }

  // Fallback: allow spaces around separators or line breaks.
  {
    const m = rawText.match(/模具\s*移模\s*时间[\s\S]{0,80}?(\d{4}\s*[-/]\s*\d{2}\s*[-/]\s*\d{2})/)
    if (m?.[1]) {
      const d = tryParseDate(m[1])
      if (d) return d
    }
  }

  const idx = lines.findIndex((l) => l.replace(/\s+/g, '').includes('模具移模时间'))
  if (idx < 0) return ''

  const candidates: Array<{ abs: number; prefer: number; date: string }> = []
  for (let offset = -3; offset <= 3; offset++) {
    const line = lines[idx + offset]
    if (!line) continue
    const d = tryParseDate(line)
    if (!d) continue
    candidates.push({ abs: Math.abs(offset), prefer: offset < 0 ? 0 : 1, date: d })
  }
  candidates.sort((a, b) => (a.abs !== b.abs ? a.abs - b.abs : a.prefer - b.prefer))
  if (candidates[0]?.date) return candidates[0].date

  return ''
}

const HEADER_KEYS = {
  partNo: '零件图号',
  mouldName: '模具名称',
  mouldNo: '模具编号',
  mouldFactory: '模具厂家',
  moveTo: ['移至地方', '移至地点'],
  seal: ['封样单号', '封样号']
} as const

const compactLine = (line: string) =>
  String(line || '')
    .replace(/\s+/g, '')
    .replace(/^[#]+/g, '')
    .replace(/[：:]/g, '')

const includesAny = (s: string, keys: readonly string[]) => keys.some((k) => s.includes(k))

const isTableHeaderCompact = (compact: string) =>
  compact.includes(HEADER_KEYS.partNo) &&
  compact.includes(HEADER_KEYS.mouldName) &&
  compact.includes(HEADER_KEYS.mouldNo) &&
  compact.includes(HEADER_KEYS.mouldFactory) &&
  includesAny(compact, HEADER_KEYS.moveTo) &&
  includesAny(compact, HEADER_KEYS.seal)

const findTableHeaderBlock = (
  lines: string[]
): { start: number; end: number; tailLine: string } | null => {
  // 1) Most common: all header keys are on one reconstructed line.
  for (let i = 0; i < lines.length; i++) {
    const c = compactLine(lines[i])
    if (!isTableHeaderCompact(c)) continue
    return { start: i, end: i, tailLine: stripHeaderTokens(lines[i]) }
  }

  // 2) Fallback: locate the first "零件图号" and start parsing below it.
  // Some PDFs interleave header labels and first-row values in the extraction order, so we don't
  // try to bound the whole header block strictly here; instead, we will skip header-label lines
  // during parsing.
  const idx = lines.findIndex((l) => compactLine(l).includes(HEADER_KEYS.partNo))
  if (idx >= 0) return { start: idx, end: idx, tailLine: stripHeaderTokens(lines[idx]) }
  return null
}

const isNewRowLine = (line: string) => /^\s*\d+(?:[.、]|\s)\s+/.test(line)
const isIndexOnlyLine = (line: string) => /^\s*(?:[□☐✓✔✅]?\s*)?(\d+)\s*(?:[.、])?\s*$/.test(line)
const extractPartNo = (line: string): string => {
  const s = compressSpaces(line)
  // Prefer typical "Cxxxx" part numbers.
  const c = s.match(/\b(C\d[\w.]*\w)\b/)?.[1]
  if (c) return c
  // Handle cases where extraction breaks the trailing token and leaves a dangling dot, e.g. "C23122.21."
  const loose = s.match(/\b([A-Z]?\d[\w.]*\w)\b/)?.[1] ?? s.match(/([A-Z]?\d[\w.]+)\.(?=\s|$)/)?.[1]
  return loose ?? ''
}

const splitColumns = (line: string): string[] => {
  // Prefer 2+ spaces as column delimiter (layout text)
  const cols = line
    .trim()
    .split(/\s{2,}/)
    .filter(Boolean)
  if (cols.length >= 2) {
    // Some PDFs place `index` and `partNo` in the same "column" separated by a single space,
    // e.g. "1 B22197.21.1.3  把手座  ML01230271  ...". Split it back.
    const m = cols[0]?.match(/^(\d+)\s+(\S.*)$/)
    if (m?.[1] && m?.[2]) {
      cols.splice(0, 1, m[1], m[2])
    }
    return cols
  }
  return line.trim().split(/\s+/).filter(Boolean)
}

const compressSpaces = (s: string) => s.replace(/\s+/g, ' ').trim()

const stripCheckboxPrefix = (line: string) => line.replace(/^\s*[□☐✓✔✅]\s*/, '')

const extractFirst = (re: RegExp, s: string) => s.match(re)?.[1] ?? ''

const normalizeMouldNo = (s: string) => compressSpaces(s).replace(/\s+/g, '')
const normalizeSealNo = (s: string) =>
  compressSpaces(s)
    .replace(/\s+/g, '')
    .replace(/[－—–‑−]/g, '-')

const stripHeaderTokens = (line: string) => {
  let s = String(line || '')
  s = s.replace(/^[#\s]+/, '')
  s = s.replace(new RegExp(HEADER_KEYS.partNo, 'g'), ' ')
  s = s.replace(new RegExp(HEADER_KEYS.mouldName, 'g'), ' ')
  s = s.replace(new RegExp(HEADER_KEYS.mouldNo, 'g'), ' ')
  s = s.replace(new RegExp(HEADER_KEYS.mouldFactory, 'g'), ' ')
  for (const k of HEADER_KEYS.moveTo) s = s.replace(new RegExp(k, 'g'), ' ')
  for (const k of HEADER_KEYS.seal) s = s.replace(new RegExp(k, 'g'), ' ')
  s = s.replace(/[：:]/g, ' ')
  return compressSpaces(s)
}

const isHeaderLabelLine = (line: string) => {
  const c = compactLine(line)
  if (!c) return false
  if (isTableHeaderCompact(c)) return true
  if (c === HEADER_KEYS.partNo) return true
  if (c === HEADER_KEYS.mouldName) return true
  if (c === HEADER_KEYS.mouldNo) return true
  if (c === HEADER_KEYS.mouldFactory) return true
  if (includesAny(c, HEADER_KEYS.moveTo) && c.length <= 6) return true
  if (includesAny(c, HEADER_KEYS.seal) && c.length <= 6) return true
  return false
}

const isSealNoPrefixLine = (line: string) =>
  new RegExp(`^\\s*ML\\s*${HYPHEN_CHARS}`, 'i').test(line)
const isSealNoSuffixLine = (line: string) =>
  new RegExp(`^\\s*\\d{2}\\s*${HYPHEN_CHARS}\\s*\\d+\\s*$`).test(line)

const joinSealNoSplitLines = (lines: string[]): string[] => {
  const out: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const cur = lines[i] ?? ''
    const next = lines[i + 1] ?? ''
    if (isSealNoPrefixLine(cur) && isSealNoSuffixLine(next)) {
      out.push(compressSpaces(`${cur}${next}`))
      i++
      continue
    }
    // Another common split: `ML-XXXX-YYYYMMDD` + `-NNNNNNN`
    if (
      isSealNoPrefixLine(cur) &&
      /\d{8}\s*$/.test(cur) &&
      new RegExp(`^\\s*${HYPHEN_CHARS}?\\s*\\d+\\s*$`).test(next)
    ) {
      out.push(compressSpaces(`${cur}${next}`))
      i++
      continue
    }
    out.push(cur)
  }
  return out
}

const isLikelyPartNo = (v: string) => {
  const s = String(v || '').trim()
  if (!s) return false
  if (/^ML\b/i.test(s)) return false
  if (/^\d{1,3}(?:\.\d{1,3})*$/.test(s)) return false
  if (/^\d{2}[-－—]\d+$/.test(s)) return false
  if (s.length < 5) return false
  if (!/\d/.test(s)) return false
  if (!/[A-Z]/i.test(s) && !s.includes('.')) return false
  return true
}

const isPartNoSuffixToken = (s: string) => /^\d+(?:\.\d+)+$/.test(String(s || '').trim())
const isPartNoPrefixToken = (s: string) => {
  const v = String(s || '').trim()
  if (!v) return false
  if (!/[A-Z]/i.test(v)) return false
  return v.endsWith('.')
}

const joinSplitPartNo = (prefix: string, suffix: string) =>
  `${String(prefix || '').trim()}${String(suffix || '').trim()}`.replace(/\s+/g, '')

const isPureDigits = (s: string) => /^\d+$/.test(String(s || '').trim())
const isYYYYMMDD = (s: string) => /^\d{8}$/.test(String(s || '').trim())

const mergeSplitPartNoRows = (rows: MouldTransferRow[]): MouldTransferRow[] => {
  const out: MouldTransferRow[] = []
  for (let i = 0; i < rows.length; i++) {
    const cur = rows[i]
    const next = rows[i + 1]
    if (
      cur &&
      next &&
      isPartNoPrefixToken(cur.partNo) &&
      isPartNoSuffixToken(next.partNo) &&
      // Usually the "suffix row" holds the real columns; "prefix row" is a mis-split artifact.
      (normalizeMouldNo(cur.mouldNo) === '' ||
        normalizeMouldNo(next.mouldNo) === '' ||
        normalizeMouldNo(cur.mouldNo) === normalizeMouldNo(next.mouldNo))
    ) {
      next.partNo = joinSplitPartNo(cur.partNo, next.partNo)
      if (!next.sealSampleNo && cur.sealSampleNo) next.sealSampleNo = cur.sealSampleNo
      if (!next.mouldNo && cur.mouldNo) next.mouldNo = cur.mouldNo
      if (!next.mouldFactory && cur.mouldFactory) next.mouldFactory = cur.mouldFactory
      if (!next.moveTo && cur.moveTo) next.moveTo = cur.moveTo
      if (!next.mouldName && cur.mouldName && !/^ML\s*[-－—]/i.test(cur.mouldName)) {
        next.mouldName = cur.mouldName
      }
      // Drop `cur`.
      continue
    }
    out.push(cur)
  }
  return out
}

type ColumnModeRow = {
  partNo: string
  mouldName: string
  mouldNo: string
  mouldFactory: string
  moveTo: string
  sealSampleNo: string
}

const isCjkWord = (s: string) => /^[\u4e00-\u9fa5]+$/.test(String(s || '').trim())
const isJunkLine = (s: string) => /[]/.test(String(s || ''))

const normalizeDraft = (r: ColumnModeRow): MouldTransferRow => ({
  index: 0,
  partNo: compressSpaces(r.partNo),
  mouldName: compressSpaces(r.mouldName),
  mouldNo: normalizeMouldNo(r.mouldNo),
  mouldFactory: compressSpaces(r.mouldFactory),
  moveTo: compressSpaces(r.moveTo),
  sealSampleNo: normalizeSealNo(r.sealSampleNo)
})

const completenessScore = (rows: MouldTransferRow[]) =>
  rows.reduce((acc, r) => {
    acc += r.partNo ? 1 : 0
    acc += r.mouldName ? 1 : 0
    acc += r.mouldNo ? 1 : 0
    acc += r.mouldFactory ? 1 : 0
    acc += r.moveTo ? 1 : 0
    acc += r.sealSampleNo ? 1 : 0
    return acc
  }, 0)

const isSuspiciousRow = (r: MouldTransferRow) => {
  const name = normalizeText(r.mouldName || '')
  if (!name) return true
  if (r.mouldFactory && name.includes(r.mouldFactory)) return true
  if (r.moveTo && name.includes(r.moveTo)) return true
  if (/ML\s*[-－—]/i.test(name)) return true
  if (/\d{2}\s*[-－—]\s*\d{6,}/.test(name)) return true
  return false
}

const parseColumnTableByHeaders = (lines: string[]): MouldTransferRow[] => {
  // Handle PDFs that output table by columns:
  // 零件图号 (list...) / 模具名称 (list...) / 模具编号 (list...) / 模具厂家 (list...) / 移至地方 (list...) / 封样单号 (list...)
  const cols: Record<keyof ColumnModeRow, string[]> = {
    partNo: [],
    mouldName: [],
    mouldNo: [],
    mouldFactory: [],
    moveTo: [],
    sealSampleNo: ''
      .split('') // keep type inference happy; overwritten below
      .slice(0, 0) as unknown as string[]
  }
  cols.sealSampleNo = []

  let cur: keyof ColumnModeRow | '' = ''
  const pushSeal = (v: string) => {
    const cleaned = compressSpaces(v)
    if (!cleaned) return
    const last = cols.sealSampleNo[cols.sealSampleNo.length - 1] ?? ''
    // Join `ML-...-YYYYMMDD` + `-NNN...` or `NNN...`
    if (
      last &&
      /^ML/i.test(last) &&
      /\d{8}$/.test(last) &&
      new RegExp(`^${HYPHEN_CHARS}?\\s*\\d+\\s*$`).test(cleaned)
    ) {
      cols.sealSampleNo[cols.sealSampleNo.length - 1] = compressSpaces(`${last}${cleaned}`)
      return
    }
    cols.sealSampleNo.push(cleaned)
  }
  for (const raw of lines) {
    if (!raw) continue
    if (raw.includes('附件') || raw.includes('报告审批意见')) break

    const cleaned = compressSpaces(stripCheckboxPrefix(raw)).replace(/^[#\s]+/, '')
    const c = compactLine(cleaned)
    if (!c) continue

    if (c === HEADER_KEYS.partNo) {
      cur = 'partNo'
      continue
    }
    if (c === HEADER_KEYS.mouldName) {
      cur = 'mouldName'
      continue
    }
    if (c === HEADER_KEYS.mouldNo) {
      cur = 'mouldNo'
      continue
    }
    if (c === HEADER_KEYS.mouldFactory) {
      cur = 'mouldFactory'
      continue
    }
    if (includesAny(c, HEADER_KEYS.moveTo)) {
      cur = 'moveTo'
      continue
    }
    if (includesAny(c, HEADER_KEYS.seal)) {
      cur = 'sealSampleNo'
      continue
    }

    if (!cur) continue

    // Skip the index column values like "1/2/3" and other junk.
    if (isPureDigits(cleaned)) continue
    if (isJunkLine(cleaned)) continue

    if (cur === 'partNo') {
      // Some PDFs split partNo into 2 lines; join if needed.
      if (isPartNoPrefixToken(cleaned)) {
        // store prefix temporarily as last element with marker
        cols.partNo.push(`${cleaned}__PFX__`)
        continue
      }
      const last = cols.partNo[cols.partNo.length - 1] ?? ''
      if (last.endsWith('__PFX__') && isPartNoSuffixToken(cleaned)) {
        cols.partNo[cols.partNo.length - 1] = joinSplitPartNo(last.replace(/__PFX__$/, ''), cleaned)
        continue
      }
      cols.partNo.push(cleaned)
      continue
    }

    if (cur === 'sealSampleNo') {
      pushSeal(cleaned)
      continue
    }
    cols[cur].push(cleaned)
  }

  const rowCount = Math.max(
    cols.partNo.length,
    cols.mouldName.length,
    cols.mouldNo.length,
    cols.mouldFactory.length,
    cols.moveTo.length,
    cols.sealSampleNo.length
  )
  if (rowCount <= 0) return []

  const rows: MouldTransferRow[] = []
  for (let i = 0; i < rowCount; i++) {
    const partNo = compressSpaces(cols.partNo[i] ?? '')
    const mouldName = compressSpaces(cols.mouldName[i] ?? '')
    const mouldNo = normalizeMouldNo(cols.mouldNo[i] ?? '')
    const mouldFactory = compressSpaces(cols.mouldFactory[i] ?? '')
    const moveTo = compressSpaces(cols.moveTo[i] ?? '')
    const sealSampleNo = normalizeSealNo(cols.sealSampleNo[i] ?? '')
    // Avoid bogus rows from stray dates/ids.
    if (!partNo && !mouldNo && !mouldName) continue
    if (isYYYYMMDD(partNo) && !mouldNo) continue
    rows.push({
      index: rows.length + 1,
      partNo,
      mouldName,
      mouldNo,
      mouldFactory,
      moveTo,
      sealSampleNo
    })
  }

  // Require at least one meaningful row.
  return rows.filter((r) => r.partNo || r.mouldNo || r.mouldName)
}

const parseColumnMode = (lines: string[]): MouldTransferRow[] => {
  const mouldNames: string[] = []
  const moveTos: string[] = []
  const seals: string[] = []
  const partNos: string[] = []
  const mouldRows: ColumnModeRow[] = []

  let pendingPartPrefix = ''
  let pendingName = ''

  for (const rawLine of lines) {
    if (!rawLine) continue
    if (rawLine.includes('附件') || rawLine.includes('报告审批意见')) break
    if (isHeaderLabelLine(rawLine)) continue
    if (isJunkLine(rawLine)) continue

    const line = compressSpaces(stripCheckboxPrefix(rawLine))
    if (!line) continue

    const seal = line.match(SEAL_NO_RE)?.[1]
    if (seal) {
      seals.push(normalizeSealNo(seal))
      continue
    }

    // Part no tends to be extracted as 2 lines: "B22197.21." + "2.1"
    if (isPartNoPrefixToken(line)) {
      pendingPartPrefix = line
      continue
    }
    if (pendingPartPrefix && isPartNoSuffixToken(line)) {
      partNos.push(joinSplitPartNo(pendingPartPrefix, line))
      pendingPartPrefix = ''
      continue
    }

    // Direct part no (e.g. Cxxxx) in one line.
    const directPart = extractPartNo(line)
    if (directPart && isLikelyPartNo(directPart) && !/^ML\b/i.test(directPart)) {
      partNos.push(directPart)
      continue
    }

    // MouldNo + factory, sometimes with mouldName in same line.
    const m = line.match(/^(.*?)(ML\s*\d+)\s*(.*)$/)
    if (m?.[2]) {
      const prefix = compressSpaces(m[1] || '')
      const mouldNo = normalizeMouldNo(m[2] || '')
      const tail = compressSpaces(m[3] || '')
      const row: ColumnModeRow = {
        partNo: '',
        mouldName: '',
        mouldNo,
        mouldFactory: '',
        moveTo: '',
        sealSampleNo: ''
      }
      if (prefix && !isHeaderLabelLine(prefix)) row.mouldName = prefix
      if (tail && isCjkWord(tail)) row.mouldFactory = tail
      if (!row.mouldName && pendingName) {
        row.mouldName = pendingName
        pendingName = ''
      }
      mouldRows.push(row)
      continue
    }

    // Move-to is often a short pure CJK word repeated by row count (e.g. 红旗 x3).
    if (isCjkWord(line) && line.length <= 4) {
      const last = mouldRows[mouldRows.length - 1]
      // In column-wise extraction, factory/moveTo may appear as standalone short CJK lines.
      if (last?.mouldNo && !last.mouldFactory) {
        last.mouldFactory = line
      } else if (
        last?.mouldNo &&
        last.mouldFactory &&
        !last.moveTo &&
        moveTos.length < mouldRows.length
      ) {
        last.moveTo = line
      } else {
        moveTos.push(line)
      }
      continue
    }

    // MouldName-only line (e.g. 把手杆 / 推杆)
    if (line.length <= 16 && /[\u4e00-\u9fa5]/.test(line) && !line.includes('通知单')) {
      pendingName = line
      mouldNames.push(line)
      continue
    }
  }

  if (!mouldRows.length) return []

  // Fill missing mouldName from collected names (in order).
  {
    const pool = [...mouldNames]
    for (const r of mouldRows) {
      if (r.mouldName) continue
      const next = pool.shift()
      if (next) r.mouldName = next
    }
  }

  // Assign moveTo / seal / partNo by order if counts match; otherwise best-effort fill.
  for (let i = 0; i < mouldRows.length; i++) {
    const r = mouldRows[i]
    if (!r.moveTo && moveTos.length) r.moveTo = moveTos[i] ?? moveTos[0] ?? ''
    if (!r.sealSampleNo && seals.length) r.sealSampleNo = seals[i] ?? ''
    if (!r.partNo && partNos.length) r.partNo = partNos[i] ?? ''
  }

  const out = mouldRows.map(normalizeDraft).filter((r) => r.partNo || r.mouldNo || r.mouldName)
  out.forEach((r, idx) => (r.index = idx + 1))
  return out
}

const parseSingleLineRow = (index: number, line: string): MouldTransferRow => {
  // Handles cases where column spacing is inconsistent (e.g. index+partNo share a column,
  // or mouldName+mouldNo are merged).
  let s = compressSpaces(stripCheckboxPrefix(line))
  s = s.replace(/^\s*\d+(?:[.、]|\s)\s+/, '')

  const sealSampleNo = extractFirst(SEAL_NO_RE, s)
  if (sealSampleNo) s = compressSpaces(s.replace(sealSampleNo, ' '))

  const mouldNo = extractFirst(MOULD_NO_RE, s)
  if (mouldNo) s = compressSpaces(s.replace(mouldNo, ' '))

  const partNo = extractPartNo(s)
  const finalPartNo = partNo && isLikelyPartNo(partNo) ? partNo : ''
  if (finalPartNo) s = compressSpaces(s.replace(finalPartNo, ' '))

  const tokens = s.split(/\s+/).filter(Boolean)
  let mouldName = ''
  let mouldFactory = ''
  let moveTo = ''

  if (tokens.length >= 3) {
    mouldFactory = tokens[tokens.length - 2] ?? ''
    moveTo = tokens[tokens.length - 1] ?? ''
    mouldName = tokens.slice(0, -2).join(' ')
  } else if (tokens.length === 2) {
    mouldName = tokens[0] ?? ''
    mouldFactory = tokens[1] ?? ''
  } else {
    mouldName = tokens[0] ?? ''
  }

  return {
    index,
    partNo: compressSpaces(finalPartNo),
    mouldName: compressSpaces(mouldName),
    mouldNo: normalizeMouldNo(mouldNo),
    mouldFactory: compressSpaces(mouldFactory),
    moveTo: compressSpaces(moveTo),
    sealSampleNo: normalizeSealNo(sealSampleNo)
  }
}

const fillMissingFieldsFromLine = (row: MouldTransferRow, line: string) => {
  let s = compressSpaces(stripCheckboxPrefix(line))
  if (!s) return

  // Remove already-known values from the current line to avoid mis-assigning them as other fields.
  if (row.sealSampleNo) s = compressSpaces(s.replace(row.sealSampleNo, ' '))
  if (row.mouldNo) s = compressSpaces(s.replace(row.mouldNo, ' '))
  if (row.partNo) s = compressSpaces(s.replace(row.partNo, ' '))

  // Prefer strong patterns first.
  if (!row.sealSampleNo) {
    const seal = s.match(SEAL_NO_RE)?.[1]
    if (seal) {
      row.sealSampleNo = normalizeSealNo(seal)
      s = compressSpaces(s.replace(seal, ' '))
    }
  }

  if (!row.mouldNo) {
    const mouldNo = s.match(MOULD_NO_RE)?.[1]
    if (mouldNo) {
      row.mouldNo = normalizeMouldNo(mouldNo)
      s = compressSpaces(s.replace(mouldNo, ' '))
    }
  }

  if (!row.partNo) {
    // Common part no patterns like C25025.5.12.4
    const part = extractPartNo(s)
    if (part) {
      row.partNo = part
      s = compressSpaces(s.replace(part, ' '))
    }
  }

  if (!s) return

  // Fill remaining fields with a heuristic:
  // - Before we see `mouldNo`, treat all continuation as `mouldName` (some PDFs break the name into many lines).
  // - After `mouldNo`, we can fill `mouldFactory` then `moveTo`.
  if (!row.mouldNo) {
    // Avoid polluting mouldName with bare row indices like "1/2/3" (column-wise extraction artifacts).
    if (/^\d+$/.test(s) || s === String(row.index)) return
    row.mouldName = row.mouldName ? compressSpaces(`${row.mouldName} ${s}`) : s
    return
  }
  if (!row.mouldFactory) {
    row.mouldFactory = s
    return
  }
  if (!row.moveTo) {
    row.moveTo = s
    return
  }
  row.mouldName = row.mouldName ? compressSpaces(`${row.mouldName} ${s}`) : s
}

const extractTableSection = (rawText: string): string => {
  const headerKey = '零件图号'
  const startIdx = rawText.indexOf(headerKey)
  if (startIdx < 0) return rawText

  const tail = rawText.slice(startIdx)
  const endIdx1 = tail.indexOf('附件')
  const endIdx2 = tail.indexOf('报告审批意见')
  const endIdxCandidates = [endIdx1, endIdx2].filter((n) => n >= 0)
  const endIdx = endIdxCandidates.length ? Math.min(...endIdxCandidates) : -1

  return endIdx >= 0 ? tail.slice(0, endIdx) : tail
}

const parseRowsByGlobalRegex = (sectionText: string): MouldTransferRow[] => {
  const s = sectionText.replace(/\s+/g, ' ').trim()
  // Fallback parser: tolerant matching of (partNo -> mouldNo -> optional sealSampleNo).
  const re = new RegExp(String.raw`([A-Z]?\d[\w.]*\w)[\s\S]{0,220}?\b(ML\s*\d+)\b`, 'g')

  const rows: MouldTransferRow[] = []
  let match: RegExpExecArray | null
  while ((match = re.exec(s))) {
    const partNo = match[1] ?? ''
    const mouldNo = match[2] ?? ''
    const start = match.index
    const nextStart = re.lastIndex
    const segment = s.slice(start, Math.min(s.length, nextStart + 240))

    const sealMatch = segment.match(SEAL_NO_RE)?.[1] ?? ''
    const sealSampleNo = sealMatch ? normalizeSealNo(sealMatch) : ''

    const betweenPartAndMould = segment
      .slice(segment.indexOf(partNo) + partNo.length, segment.indexOf(mouldNo))
      .trim()
    const mouldName = betweenPartAndMould.replace(/\s+/g, ' ').trim()

    let tail = segment.slice(segment.indexOf(mouldNo) + mouldNo.length)
    if (sealMatch) tail = tail.slice(0, tail.indexOf(sealMatch))
    tail = tail.replace(/\s+/g, ' ').trim()
    const tailTokens = tail.split(/\s+/).filter(Boolean)
    const mouldFactory = tailTokens[0] ?? ''
    const moveTo = tailTokens.slice(1).join(' ')

    rows.push({
      index: rows.length + 1,
      partNo,
      mouldName,
      mouldNo: normalizeMouldNo(mouldNo),
      mouldFactory,
      moveTo,
      sealSampleNo
    })
  }

  return rows
}

const collectSealSampleNos = (rawText: string): string[] => {
  const list: string[] = []
  const blob = rawText.replace(/\s+/g, ' ').trim()

  // 1) Normal form: ML-XXXX-YYYYMMDD-NNN
  {
    const re = new RegExp(SEAL_NO_RE.source, 'g')
    for (const m of blob.matchAll(re)) {
      const v = normalizeSealNo(m?.[1] ?? m?.[0] ?? '')
      if (v) list.push(v)
    }
  }

  const sep = String.raw`(?:\\s*${HYPHEN_CHARS}\\s*|\\s+)`

  // 2) Split form: ML-XXXX-YYYYMM\\sDD-NNN (common in column-wise PDFs)
  {
    const re = new RegExp(
      String.raw`(ML)${sep}([A-Z0-9]+)${sep}(\\d{6})\\s*(\\d{2})${sep}(\\d+)`,
      'g'
    )
    for (const m of blob.matchAll(re)) {
      const code = String(m?.[2] ?? '').trim()
      const ym = String(m?.[3] ?? '').trim()
      const dd = String(m?.[4] ?? '').trim()
      const seq = String(m?.[5] ?? '').trim()
      if (!code || !ym || !dd || !seq) continue
      list.push(normalizeSealNo(`ML-${code}-${ym}${dd}-${seq}`))
    }
  }

  // 3) Ultra-loose: some extractors may drop hyphens entirely, leaving `ML FYJYD 202411 05 1001642`
  {
    const re = new RegExp(
      String.raw`\\bML${sep}([A-Z0-9]+)${sep}(\\d{6})\\s*(\\d{2})${sep}(\\d{6,})\\b`,
      'g'
    )
    for (const m of blob.matchAll(re)) {
      const code = String(m?.[1] ?? '').trim()
      const ym = String(m?.[2] ?? '').trim()
      const dd = String(m?.[3] ?? '').trim()
      const seq = String(m?.[4] ?? '').trim()
      if (!code || !ym || !dd || !seq) continue
      list.push(normalizeSealNo(`ML-${code}-${ym}${dd}-${seq}`))
    }
  }

  // 4) Split at the last hyphen: `ML-XXXX-YYYYMMDD` + `NNN...` (hyphen lost)
  {
    const re = new RegExp(String.raw`\\bML${sep}([A-Z0-9]+)${sep}(\\d{8})\\s+(\\d{5,})\\b`, 'g')
    for (const m of blob.matchAll(re)) {
      const code = String(m?.[1] ?? '').trim()
      const date = String(m?.[2] ?? '').trim()
      const seq = String(m?.[3] ?? '').trim()
      if (!code || !date || !seq) continue
      list.push(normalizeSealNo(`ML-${code}-${date}-${seq}`))
    }
  }

  // Keep order but de-dupe.
  return Array.from(new Set(list)).filter(Boolean)
}

const cleanMouldName = (row: MouldTransferRow): string => {
  const original = normalizeText(row.mouldName || '')
  if (!original) return ''

  const badTokens = new Set(
    [row.mouldNo, row.mouldFactory, row.moveTo, row.sealSampleNo]
      .map((x) => compressSpaces(x || ''))
      .filter(Boolean)
  )

  let s = original
    .replace(/[\uE000-\uF8FF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  for (const t of badTokens) {
    s = s.split(t).join(' ')
  }

  // Remove any seal-like fragments that often leak into mouldName.
  s = s
    .replace(/ML\s*[-－—]\s*[A-Z0-9]+\s*[-－—]\s*\d{6,8}\s*[-－—]\s*\d+/gi, ' ')
    .replace(/\b\d{2}\s*[-－—]\s*\d+\b/g, ' ')

  // Remove leading indices like "1 把手杆 1 把手杆 ..."
  s = s.replace(/^(\d+)\s+/g, '').replace(/\s+(\d+)\s+/g, ' ')

  const tokens = s
    .split(/\s+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .filter((t) => t !== String(row.index))
    .filter((t) => !badTokens.has(t))
    .filter((t) => !/^\d+$/.test(t))

  const deduped: string[] = []
  for (const t of tokens) {
    if (deduped.length && deduped[deduped.length - 1] === t) continue
    deduped.push(t)
  }

  // Prefer short CJK mould names when present.
  const cjk = deduped.filter((t) => /[\u4e00-\u9fa5]/.test(t) && t.length <= 16)
  const out = (cjk[0] ?? deduped.join(' ')).trim()
  return compressSpaces(out)
}

export function parseMouldTransferFromText(
  text: string
): { ok: true; data: MouldTransferImportResult } | { ok: false; error: string; rawText: string } {
  const rawText = normalizeText(text)
  const rawNoSpace = rawText.replace(/\s+/g, '')

  const titleOk =
    rawNoSpace.includes('美菱移模通知单') ||
    rawNoSpace.includes('移模通知单（外调）') ||
    (rawNoSpace.includes('移模通知单') && rawNoSpace.includes('外调'))
  if (!titleOk) {
    return {
      ok: false,
      error: '未识别到“移模通知单（外调）”相关表头关键字，无法判定为移模单。',
      rawText
    }
  }

  const lines = rawText
    .split('\n')
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0)

  const mouldMoveDate = findMouldMoveDate(rawText, lines)
  if (!mouldMoveDate) {
    return { ok: false, error: '未能从“模具移模时间”处提取日期（YYYY-MM-DD）。', rawText }
  }

  const headerBlock = findTableHeaderBlock(lines)
  if (!headerBlock) {
    return {
      ok: false,
      error: '未找到明细表表头（零件图号/模具名称/模具编号/模具厂家/移至地方/封样单号）。',
      rawText
    }
  }

  // Try column-wise table reconstruction first (handles PDFs that export table by columns).
  // We attempt this unconditionally because some extractors emit header tokens differently.
  const rawTableLines = lines.slice(headerBlock.start)
  {
    const colRows = parseColumnTableByHeaders(rawTableLines)
    const hasEnoughPartNo =
      colRows.length > 0 &&
      colRows.filter((r) => Boolean(r.partNo)).length >= Math.ceil(colRows.length / 2)
    const hasEnoughMouldNo =
      colRows.length > 0 &&
      colRows.filter((r) => Boolean(r.mouldNo)).length >= Math.ceil(colRows.length / 2)
    if (colRows.length > 0 && hasEnoughPartNo && hasEnoughMouldNo) {
      const finalizeRows = (inputRows: MouldTransferRow[]) => {
        const seals = collectSealSampleNos(rawText)
        for (let i = 0; i < inputRows.length; i++) {
          const r = inputRows[i]
          if (!r.sealSampleNo && seals.length > 0) r.sealSampleNo = seals[i] ?? ''
          r.mouldName = cleanMouldName(r) || r.mouldName
        }
        return inputRows
      }

      return {
        ok: true,
        data: {
          type: 'mould-transfer',
          mouldMoveDate,
          rows: finalizeRows(colRows),
          rawText
        }
      }
    }
  }

  const rows: MouldTransferRow[] = []
  let current: MouldTransferRow | null = null

  const dataLines: string[] = []
  if (headerBlock.tailLine) dataLines.push(headerBlock.tailLine)
  dataLines.push(...lines.slice(headerBlock.end + 1))
  const normalizedDataLines = joinSealNoSplitLines(dataLines)

  for (let i = 0; i < normalizedDataLines.length; i++) {
    const line = normalizedDataLines[i]
    if (line.includes('附件') || line.includes('报告审批意见')) break
    if (isHeaderLabelLine(line)) continue

    const cleaned = stripCheckboxPrefix(line)

    if (isIndexOnlyLine(cleaned)) {
      // Some PDFs place mould-name fragments like "1", "1.2" in separate lines (column-wise extraction).
      // If we're still building the current row and haven't encountered `mouldNo` yet, treat index-like
      // lines as continuation rather than a new row.
      if (
        current &&
        current.partNo &&
        !current.mouldNo &&
        !current.mouldFactory &&
        !current.moveTo &&
        !current.sealSampleNo
      ) {
        fillMissingFieldsFromLine(current, line)
        continue
      }
      const idxMatch = cleaned.match(/(\d+)/)
      const index = idxMatch ? Number(idxMatch[1]) : NaN
      if (!Number.isFinite(index)) continue

      const row: MouldTransferRow = {
        index,
        partNo: '',
        mouldName: '',
        mouldNo: '',
        mouldFactory: '',
        moveTo: '',
        sealSampleNo: ''
      }
      rows.push(row)
      current = row
      continue
    }

    // New row line (may include checkbox prefix)
    if (isNewRowLine(cleaned)) {
      const idxMatch = cleaned.match(/^\s*(\d+)(?:[.、]|\s)\s+/)
      const index = idxMatch ? Number(idxMatch[1]) : NaN
      if (!Number.isFinite(index)) continue

      const row = parseSingleLineRow(index, cleaned)
      // If the PDF extraction didn't expose some fields, keep the old multi-line filling logic as fallback.
      if (!row.partNo || !row.mouldNo || !row.sealSampleNo || !row.mouldFactory || !row.moveTo) {
        fillMissingFieldsFromLine(row, cleaned)
      }

      rows.push(row)
      current = row
      continue
    }

    // Some extractors split a row across multiple lines and may omit the index on the same line.
    // If we see a partNo, treat it as a new row start when needed.
    const partNo = extractPartNo(cleaned)
    if (partNo) {
      const cols = splitColumns(cleaned)
      const firstCol = cols[0] ?? ''
      if (!isLikelyPartNo(firstCol || partNo)) {
        // Likely a seal-sample fragment or other numeric noise; treat as continuation.
        if (current) fillMissingFieldsFromLine(current, line)
        continue
      }
      const shouldStartNew =
        !current ||
        (current.partNo && current.partNo !== partNo) ||
        (current.partNo && current.sealSampleNo)
      if (shouldStartNew) {
        const row: MouldTransferRow = {
          index: rows.length + 1,
          partNo: firstCol || partNo,
          mouldName: cols[1] ?? '',
          mouldNo: cols[2] ?? '',
          mouldFactory: cols[3] ?? '',
          moveTo: cols[4] ?? '',
          sealSampleNo: cols.slice(5).join(' ') ?? ''
        }
        fillMissingFieldsFromLine(row, cleaned)
        rows.push(row)
        current = row
        continue
      }
    }

    // Continuation line: merge into previous record (mainly mouldName; also补封样单号)
    if (!current) continue

    // For extractor outputs that split a row into multiple lines, fill fields sequentially.
    fillMissingFieldsFromLine(current, line)
  }

  const mergedRows = mergeSplitPartNoRows(rows)
  const cleanedRows = mergedRows.filter((r) =>
    Boolean(r.partNo || r.mouldName || r.mouldNo || r.mouldFactory || r.moveTo || r.sealSampleNo)
  )

  // Post-fix: some PDFs leak factory/moveTo/seal suffix into `mouldName`, and seal can be split across lines.
  const finalizeRows = (inputRows: MouldTransferRow[]) => {
    const seals = collectSealSampleNos(rawText)
    for (let i = 0; i < inputRows.length; i++) {
      const r = inputRows[i]
      if (!r.sealSampleNo && seals.length > 0) r.sealSampleNo = seals[i] ?? ''
      r.mouldName = cleanMouldName(r) || r.mouldName
    }
    return inputRows
  }

  if (cleanedRows.length > 0) finalizeRows(cleanedRows)

  // Column-wise extraction fallback (some PDFs export cells by column blocks, which pollutes mouldName).
  if (cleanedRows.length > 0) {
    const hasSuspicious = cleanedRows.some(isSuspiciousRow)
    if (hasSuspicious) {
      const columnRows = parseColumnMode(normalizedDataLines)
      if (columnRows.length > 0 && completenessScore(columnRows) > completenessScore(cleanedRows)) {
        return {
          ok: true,
          data: {
            type: 'mould-transfer',
            mouldMoveDate,
            rows: finalizeRows(columnRows),
            rawText
          }
        }
      }
    }
  }

  if (cleanedRows.length === 0) {
    const section = extractTableSection(rawText)
    const fallbackRows = parseRowsByGlobalRegex(section)
    if (fallbackRows.length === 0) {
      return { ok: false, error: '未解析到任何明细行。', rawText }
    }
    return {
      ok: true,
      data: {
        type: 'mould-transfer',
        mouldMoveDate,
        rows: fallbackRows,
        rawText
      }
    }
  }

  return {
    ok: true,
    data: {
      type: 'mould-transfer',
      mouldMoveDate,
      rows: cleanedRows,
      rawText
    }
  }
}
