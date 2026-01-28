let _pdfjs = null

const getPdfjs = async () => {
  if (_pdfjs) return _pdfjs
  // pdfjs-dist v5 ships ESM build; use dynamic import from CJS backend.
  _pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  return _pdfjs
}

const normalizeKey = (v) =>
  String(v || '')
    .replace(/\s+/g, '')
    .replace(/[\uE000-\uF8FF]/g, '')
    .trim()

const normalizeHyphens = (s) => String(s || '').replace(/[－—–‑−]/g, '-')

const HYPHEN_RE = /[-－—–‑−]/g

const extractMoveDate = (text) => {
  const raw = String(text || '')
  const compact = raw.replace(/\s+/g, '')
  const label = '模具移模时间'

  // 0) Search around label (both sides) for strict ISO date.
  {
    const idx = compact.indexOf(label)
    if (idx >= 0) {
      const around = compact.slice(Math.max(0, idx - 120), Math.min(compact.length, idx + 180))
      const m = around.match(/(\d{4}[-/]\d{1,2}[-/]\d{1,2})/)
      if (m?.[1]) {
        const parts = m[1].split(/[-/]/).map((x) => String(x || '').trim())
        if (parts.length === 3) {
          const [y, mo, d] = parts
          const pad2 = (n) => (String(n).length === 1 ? `0${n}` : String(n))
          return `${y}-${pad2(mo)}-${pad2(d)}`
        }
      }
    }
  }

  const strict = compact.match(/模具移模时间(\d{4}-\d{2}-\d{2})/)?.[1]
  if (strict) return strict

  const m = raw.match(/模具\s*移模\s*时间[\s\S]{0,80}?(\d{4}\s*[-/]\s*\d{1,2}\s*[-/]\s*\d{1,2})/)
  if (m?.[1]) {
    const parts = m[1].split(/[-/]/).map((x) => String(x || '').trim())
    if (parts.length === 3) {
      const [y, mo, d] = parts
      if (y && mo && d) {
        const pad2 = (n) => (String(n).length === 1 ? `0${n}` : String(n))
        return `${y}-${pad2(mo)}-${pad2(d)}`
      }
    }
  }
  return ''
}

const groupByTop = (tokens, tolerance) => {
  const lines = []
  for (const token of tokens) {
    let best = null
    let bestDiff = Infinity
    for (const line of lines) {
      const diff = Math.abs(line.top - token.top)
      if (diff <= tolerance && diff < bestDiff) {
        best = line
        bestDiff = diff
      }
    }
    if (best) {
      best.tokens.push(token)
      best.top = (best.top * (best.tokens.length - 1) + token.top) / best.tokens.length
    } else {
      lines.push({ top: token.top, tokens: [token] })
    }
  }
  return lines.sort((a, b) => a.top - b.top)
}

const buildCompactLine = (line) => {
  const tokens = [...line.tokens].sort((a, b) => a.x0 - b.x0)
  const ranges = []
  let out = ''
  for (const t of tokens) {
    const txt = normalizeKey(t.text)
    if (!txt) continue
    const start = out.length
    out += txt
    const end = out.length
    ranges.push({ start, end, x0: t.x0, x1: t.x1 })
  }
  return { text: out, ranges }
}

const bboxForSubstring = (line, target) => {
  const { text, ranges } = buildCompactLine(line)
  const idx = text.indexOf(target)
  if (idx < 0) return null
  const end = idx + target.length
  const hit = ranges.filter((r) => r.end > idx && r.start < end)
  if (!hit.length) return null
  return {
    x0: Math.min(...hit.map((h) => h.x0)),
    x1: Math.max(...hit.map((h) => h.x1)),
    top: line.top
  }
}

const SEAL_EXTRACT_RE = new RegExp(
  String.raw`ML\s*${HYPHEN_RE.source}\s*[A-Z0-9]+\s*${HYPHEN_RE.source}\s*\d{6,8}\s*${HYPHEN_RE.source}\s*\d+`,
  'i'
)

const normalizeSeal = (s) => normalizeHyphens(String(s || '')).replace(/\s+/g, '')

const extractSealFromText = (s) => {
  const raw = String(s || '')
  const compact = raw.replace(/\s+/g, '')
  const m1 = compact.match(/ML[-－—–‑−][A-Z0-9]+[-－—–‑−]\d{8}[-－—–‑−]\d+/i)?.[0]
  if (m1) return normalizeSeal(m1)

  // PZ_JYFY202408213 (or variants with hyphen/space)
  const pz = compact.match(/PZ[_-]?JYFY\d{8,12}/i)?.[0]
  if (pz) return String(pz).replace(/-/g, '_')

  // Allow last hyphen lost: ML-XXXX-YYYYMMDD 100xxxx
  const m2 = raw
    .replace(/\s+/g, ' ')
    .match(/\bML\s*[-－—–‑−]?\s*([A-Z0-9]+)\s*[-－—–‑−]?\s*(\d{8})\s+(\d{5,})\b/i)
  if (m2?.[1] && m2?.[2] && m2?.[3]) return normalizeSeal(`ML-${m2[1]}-${m2[2]}-${m2[3]}`)

  return ''
}

const collectTokensInBand = (tokens, bandTop, bandBottom, left, right) => {
  const out = []
  for (const t of tokens) {
    const cx = (t.x0 + t.x1) / 2
    if (cx < left || cx >= right) continue
    if (t.top < bandTop || t.top >= bandBottom) continue
    out.push(t)
  }
  return out
}

const joinCellText = (cellTokens, mode) => {
  if (!cellTokens.length) return ''
  // group by line in band
  const lines = groupByTop(cellTokens, 3)
  if (mode === 'nospace') {
    return lines
      .map((l) =>
        l.tokens
          .sort((a, b) => a.x0 - b.x0)
          .map((t) => String(t.text || '').trim())
          .join('')
      )
      .join('')
      .replace(/\s+/g, '')
  }
  return lines
    .map((l) =>
      l.tokens
        .sort((a, b) => a.x0 - b.x0)
        .map((t) => String(t.text || '').trim())
        .join('')
    )
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const cleanMouldName = (name) => {
  const s = String(name || '')
    .replace(/[\uE000-\uF8FF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  // remove leading indices like "2 把手盖 2 把手盖"
  return s
    .replace(/^(\d+)\s+/g, '')
    .replace(/\s+\1\s+/g, ' ')
    .trim()
}

const normalizePartNo = (partNo) => {
  const s = String(partNo || '').replace(/\s+/g, '')
  // Some PDFs output the suffix line before the prefix line: `2.1B22197.21.` -> `B22197.21.2.1`
  const m = s.match(/^(\d+(?:\.\d+)+)([A-Z].*\.)$/i)
  if (m?.[1] && m?.[2]) return `${m[2]}${m[1]}`
  return s
}

async function parseMouldTransferPdf(buffer) {
  const pdfjsLib = await getPdfjs()
  // pdf.js rejects Node Buffer (even though it's a Uint8Array subclass); ensure plain Uint8Array.
  const data = Buffer.isBuffer(buffer)
    ? new Uint8Array(buffer)
    : buffer instanceof Uint8Array
      ? buffer
      : new Uint8Array(buffer)
  const loadingTask = pdfjsLib.getDocument({ data, disableWorker: true })
  const pdf = await loadingTask.promise
  if (!pdf.numPages) throw new Error('PDF 无页面')

  const page = await pdf.getPage(1)
  const viewport = page.getViewport({ scale: 1.0 })
  const pageHeight = viewport.height

  const content = await page.getTextContent()
  const items = Array.isArray(content?.items) ? content.items : []
  if (!items.length) throw new Error('未提取到任何文字（可能是扫描/图片版 PDF，需要 OCR）')

  const tokens = []
  for (const it of items) {
    const str = String(it?.str || '')
    if (!str.trim()) continue
    const transform = it?.transform
    if (!Array.isArray(transform) || transform.length < 6) continue
    const x0 = Number(transform[4] || 0)
    const y = Number(transform[5] || 0)
    const w = Number(it?.width || 0)
    const x1 = x0 + (Number.isFinite(w) ? w : 0)
    const top = pageHeight - y
    tokens.push({
      text: str,
      x0,
      x1: Number.isFinite(x1) && x1 > x0 ? x1 : x0 + 1,
      top
    })
  }

  if (tokens.length < 30) throw new Error('提取到的文字太少（可能是扫描/图片版 PDF，需要 OCR）')

  // Build a rough full text (for date extraction)
  const linesAll = groupByTop(tokens, 3)
  const fullText = linesAll
    .map((l) =>
      l.tokens
        .sort((a, b) => a.x0 - b.x0)
        .map((t) => String(t.text || '').trim())
        .join(' ')
    )
    .join('\n')

  const mouldMoveDate = extractMoveDate(fullText)
  if (!mouldMoveDate) throw new Error('未能从“模具移模时间”处提取日期（YYYY-MM-DD）')

  const HEADER_ORDER = [
    { key: 'partNo', label: '零件图号' },
    { key: 'mouldName', label: '模具名称' },
    { key: 'mouldNo', label: '模具编号' },
    { key: 'mouldFactory', label: '模具厂家' },
    { key: 'moveTo', label: '移至地方' },
    { key: 'sealSampleNo', label: '封样单号' }
  ]

  const headerBBoxes = {}
  for (const { key, label } of HEADER_ORDER) {
    const target = normalizeKey(label)
    let found = null
    for (const line of linesAll) {
      const bbox = bboxForSubstring(line, target)
      if (!bbox) continue
      found = bbox
      break
    }
    if (found) headerBBoxes[key] = found
  }

  // We need at least partNo/mouldNo to define the table.
  if (!headerBBoxes.partNo || !headerBBoxes.mouldNo) {
    throw new Error('未找到明细表表头（至少需要“零件图号/模具编号”）')
  }

  // Column centers from headers (fallback to previous one if missing)
  const centersOrder = []
  let prevCx = (headerBBoxes.partNo.x0 + headerBBoxes.partNo.x1) / 2
  for (const { key } of HEADER_ORDER) {
    const b = headerBBoxes[key]
    const cx = b ? (b.x0 + b.x1) / 2 : prevCx + 120
    centersOrder.push(cx)
    prevCx = cx
  }

  // Left edge of the first data column (exclude the row-index column).
  const leftEdge = Math.max(0, headerBBoxes.partNo.x0 - 2)
  const boundaries = [leftEdge]
  for (let i = 0; i < centersOrder.length - 1; i++) {
    boundaries.push((centersOrder[i] + centersOrder[i + 1]) / 2)
  }
  boundaries.push(viewport.width)

  // Determine data region.
  const headerTopMax = Math.max(...Object.values(headerBBoxes).map((b) => b.top))
  const tableStartTop = headerTopMax + 4
  const attachmentToken = tokens.find((t) => normalizeKey(t.text).includes('附件'))
  const tableEndTop = attachmentToken
    ? Math.max(tableStartTop + 10, attachmentToken.top - 2)
    : pageHeight

  // Row anchors: prefer index digits at far-left.
  const firstDataColLeft = boundaries[0] // left edge of first data column
  const anchors = tokens
    .filter((t) => t.top >= tableStartTop && t.top <= tableEndTop)
    // Strictly keep tokens that are entirely in the index column; avoid picking up digits
    // that wrap inside the first data cell (e.g. partNo tail `.1` / `.2` on next line).
    .filter((t) => t.x1 <= firstDataColLeft - 1)
    .map((t) => ({ text: String(t.text || '').trim(), top: t.top }))
    .filter((t) => /^\d{1,2}$/.test(t.text))
    .sort((a, b) => a.top - b.top)

  const rowTops = []
  for (const a of anchors) {
    if (!rowTops.length || Math.abs(rowTops[rowTops.length - 1] - a.top) > 6) rowTops.push(a.top)
  }

  // Fallback if no index anchors: use mouldNo tokens.
  if (!rowTops.length) {
    const mouldColLeft = boundaries[3]
    const mouldColRight = boundaries[4]
    const mouldAnchors = tokens
      .filter((t) => t.top >= tableStartTop && t.top <= tableEndTop)
      .filter((t) => {
        const cx = (t.x0 + t.x1) / 2
        return cx >= mouldColLeft && cx < mouldColRight
      })
      .map((t) => ({ text: normalizeKey(t.text), top: t.top }))
      .filter((t) => /^ML\d+$/.test(t.text))
      .sort((a, b) => a.top - b.top)
    for (const a of mouldAnchors) {
      if (!rowTops.length || Math.abs(rowTops[rowTops.length - 1] - a.top) > 10) rowTops.push(a.top)
    }
  }

  if (!rowTops.length) throw new Error('未识别到明细行（无法定位行号/模具编号）')

  const rows = []
  for (let i = 0; i < rowTops.length; i++) {
    const bandTop =
      i === 0 ? tableStartTop : Math.max(tableStartTop, (rowTops[i - 1] + rowTops[i]) / 2)
    const bandBottom =
      i + 1 < rowTops.length
        ? Math.min(tableEndTop + 2, (rowTops[i] + rowTops[i + 1]) / 2)
        : tableEndTop + 2

    const partNoTokens = collectTokensInBand(
      tokens,
      bandTop,
      bandBottom,
      boundaries[0],
      boundaries[1]
    )
    const mouldNameTokens = collectTokensInBand(
      tokens,
      bandTop,
      bandBottom,
      boundaries[1],
      boundaries[2]
    )
    const mouldNoTokens = collectTokensInBand(
      tokens,
      bandTop,
      bandBottom,
      boundaries[2],
      boundaries[3]
    )
    const factoryTokens = collectTokensInBand(
      tokens,
      bandTop,
      bandBottom,
      boundaries[3],
      boundaries[4]
    )
    const moveToTokens = collectTokensInBand(
      tokens,
      bandTop,
      bandBottom,
      boundaries[4],
      boundaries[5]
    )
    const sealTokens = collectTokensInBand(
      tokens,
      bandTop,
      bandBottom,
      boundaries[5],
      boundaries[6]
    )

    const partNoRaw = joinCellText(partNoTokens, 'nospace')
    const mouldNameRaw = joinCellText(mouldNameTokens, 'space')
    const mouldNoRaw = joinCellText(mouldNoTokens, 'nospace')
    const factoryRaw = joinCellText(factoryTokens, 'space')
    const moveToRaw = joinCellText(moveToTokens, 'space')
    const sealRaw = joinCellText(sealTokens, 'nospace')

    const partNo = normalizePartNo(normalizeHyphens(partNoRaw))
    const mouldNo = normalizeKey(mouldNoRaw)
    const mouldFactory = String(factoryRaw || '').trim()
    const moveTo = String(moveToRaw || '').trim()

    let sealSampleNo = extractSealFromText(sealRaw)
    if (!sealSampleNo && moveToRaw) sealSampleNo = extractSealFromText(moveToRaw)

    const mouldName = cleanMouldName(mouldNameRaw)

    // Filter bogus rows (e.g. dates leaking into partNo)
    if (!partNo && !mouldNo && !mouldName) continue
    if (/^\d{8}$/.test(partNo) && !mouldNo) continue

    rows.push({
      index: rows.length + 1,
      partNo,
      mouldName,
      mouldNo,
      mouldFactory,
      moveTo,
      sealSampleNo: sealSampleNo || ''
    })
  }

  if (!rows.length) throw new Error('未解析到任何明细行')

  return { type: 'mould-transfer', mouldMoveDate, rows }
}

module.exports = { parseMouldTransferPdf }
