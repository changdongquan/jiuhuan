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
const DATE_LOOSE_RE = /(\d{4})\s*[-/]\s*(\d{2})\s*[-/]\s*(\d{2})/
const SEAL_NO_RE = /(ML-[A-Z0-9]+-\d{8}-\d+)/
const MOULD_NO_RE = /\b(ML\d+)\b/
const PART_NO_RE = /\b([A-Z]?\d[\w.]+)\b/

// Keep multi-spaces produced by layout reconstruction (used for table column splitting).
const normalizeText = (text: string) =>
  String(text || '')
    .replace(/\r/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/\t/g, ' ')

const tryParseDate = (s: string): string => {
  const strict = s.match(DATE_STRICT_RE)?.[1]
  if (strict) return strict

  const loose = s.match(DATE_LOOSE_RE)
  if (loose?.[1] && loose?.[2] && loose?.[3]) return `${loose[1]}-${loose[2]}-${loose[3]}`

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

const isTableHeader = (line: string) => {
  const s = line.replace(/\s+/g, '')
  return (
    s.includes('零件图号') &&
    s.includes('模具名称') &&
    s.includes('模具编号') &&
    s.includes('模具厂家') &&
    s.includes('移至地方') &&
    s.includes('封样单号')
  )
}

const isNewRowLine = (line: string) => /^\s*\d+\s+/.test(line)
const isIndexOnlyLine = (line: string) => /^\s*(?:[□☐✓✔✅]?\s*)?(\d+)\s*$/.test(line)
const extractPartNo = (line: string): string => {
  const s = compressSpaces(line)
  return s.match(/\b(C\d[\w.]+)\b/)?.[1] ?? s.match(PART_NO_RE)?.[1] ?? ''
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

const parseSingleLineRow = (index: number, line: string): MouldTransferRow => {
  // Handles cases where column spacing is inconsistent (e.g. index+partNo share a column,
  // or mouldName+mouldNo are merged).
  let s = compressSpaces(stripCheckboxPrefix(line))
  s = s.replace(/^\s*\d+\s+/, '')

  const sealSampleNo = extractFirst(SEAL_NO_RE, s)
  if (sealSampleNo) s = compressSpaces(s.replace(sealSampleNo, ' '))

  const mouldNo = extractFirst(MOULD_NO_RE, s)
  if (mouldNo) s = compressSpaces(s.replace(mouldNo, ' '))

  const partNo = extractPartNo(s)
  if (partNo) s = compressSpaces(s.replace(partNo, ' '))

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
    partNo: compressSpaces(partNo),
    mouldName: compressSpaces(mouldName),
    mouldNo: compressSpaces(mouldNo),
    mouldFactory: compressSpaces(mouldFactory),
    moveTo: compressSpaces(moveTo),
    sealSampleNo: compressSpaces(sealSampleNo)
  }
}

const fillMissingFieldsFromLine = (row: MouldTransferRow, line: string) => {
  let s = compressSpaces(stripCheckboxPrefix(line))
  if (!s) return

  // Prefer strong patterns first.
  if (!row.sealSampleNo) {
    const seal = s.match(SEAL_NO_RE)?.[1]
    if (seal) {
      row.sealSampleNo = seal
      s = compressSpaces(s.replace(seal, ' '))
    }
  }

  if (!row.mouldNo) {
    const mouldNo = s.match(MOULD_NO_RE)?.[1]
    if (mouldNo) {
      row.mouldNo = mouldNo
      s = compressSpaces(s.replace(mouldNo, ' '))
    }
  }

  if (!row.partNo) {
    // Common part no patterns like C25025.5.12.4
    const part = s.match(/\b([A-Z]\d[\w.]+)\b/)?.[1] ?? s.match(PART_NO_RE)?.[1]
    if (part) {
      row.partNo = part
      s = compressSpaces(s.replace(part, ' '))
    }
  }

  if (!s) return

  // Fill remaining fields in order.
  if (!row.mouldName) {
    row.mouldName = s
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

  // Extra continuation goes to mouldName (multi-line)
  row.mouldName = compressSpaces(`${row.mouldName} ${s}`)
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
  const re = new RegExp(
    String.raw`(C\d[\w.]+)[\s\S]{0,80}?\b(ML\d+)\b[\s\S]{0,80}?(ML-[A-Z0-9]+-\d{8}-\d+)`,
    'g'
  )

  const rows: MouldTransferRow[] = []
  let match: RegExpExecArray | null
  while ((match = re.exec(s))) {
    const partNo = match[1] ?? ''
    const mouldNo = match[2] ?? ''
    const sealSampleNo = match[3] ?? ''

    const start = match.index
    const end = match.index + match[0].length
    const segment = s.slice(start, end)

    const betweenPartAndMould = segment
      .slice(segment.indexOf(partNo) + partNo.length, segment.indexOf(mouldNo))
      .trim()
    const betweenMouldAndSeal = segment
      .slice(segment.indexOf(mouldNo) + mouldNo.length, segment.indexOf(sealSampleNo))
      .trim()

    const mouldName = betweenPartAndMould.replace(/\s+/g, ' ').trim()
    const tailTokens = betweenMouldAndSeal.split(/\s+/).filter(Boolean)
    const mouldFactory = tailTokens[0] ?? ''
    const moveTo = tailTokens.slice(1).join(' ')

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

  return rows
}

export function parseMouldTransferFromText(
  text: string
): { ok: true; data: MouldTransferImportResult } | { ok: false; error: string; rawText: string } {
  const rawText = normalizeText(text)
  const rawNoSpace = rawText.replace(/\s+/g, '')

  if (!rawNoSpace.includes('美菱移模通知单（外调）')) {
    return { ok: false, error: '未识别到表头“美菱移模通知单（外调）”，无法判定为移模单。', rawText }
  }

  const lines = rawText
    .split('\n')
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0)

  const mouldMoveDate = findMouldMoveDate(rawText, lines)
  if (!mouldMoveDate) {
    return { ok: false, error: '未能从“模具移模时间”处提取日期（YYYY-MM-DD）。', rawText }
  }

  const headerIdx = lines.findIndex(isTableHeader)
  if (headerIdx < 0) {
    return {
      ok: false,
      error: '未找到明细表表头（零件图号/模具名称/模具编号/模具厂家/移至地方/封样单号）。',
      rawText
    }
  }

  const rows: MouldTransferRow[] = []
  let current: MouldTransferRow | null = null

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i]
    if (line.includes('附件') || line.includes('报告审批意见')) break

    const cleaned = stripCheckboxPrefix(line)

    if (isIndexOnlyLine(cleaned)) {
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
      const idxMatch = cleaned.match(/^\s*(\d+)\s+/)
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
      const shouldStartNew =
        !current ||
        (current.partNo && current.partNo !== partNo) ||
        (current.partNo && current.sealSampleNo)
      if (shouldStartNew) {
        const cols = splitColumns(cleaned)
        const row: MouldTransferRow = {
          index: rows.length + 1,
          partNo: cols[0] ?? partNo,
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

  if (rows.length === 0) {
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
      rows,
      rawText
    }
  }
}
