import fs from 'node:fs/promises'
import path from 'node:path'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { parseMouldTransferFromText } from '../../packages/frontend/src/utils/pdf/mouldTransferParser'

type TextItem = {
  str: string
  transform: number[]
  width: number
}

type TextContent = {
  items: Array<TextItem | unknown>
}

type PositionedText = {
  text: string
  x: number
  y: number
  width: number
}

type TextLine = {
  y: number
  items: PositionedText[]
}

const groupByY = (items: PositionedText[], tolerance = 2.5): TextLine[] => {
  const lines: TextLine[] = []
  for (const item of items) {
    const existing = lines.find((l) => Math.abs(l.y - item.y) <= tolerance)
    if (existing) {
      existing.items.push(item)
      continue
    }
    lines.push({ y: item.y, items: [item] })
  }
  return lines
}

const buildLineText = (line: TextLine): string => {
  const sorted = [...line.items].sort((a, b) => a.x - b.x)
  let out = ''
  let prev: PositionedText | undefined
  for (const cur of sorted) {
    const text = (cur.text ?? '').replace(/\s+/g, ' ').trim()
    if (!text) continue

    if (!prev) {
      out += text
      prev = cur
      continue
    }

    const gap = cur.x - (prev.x + prev.width)
    if (gap > 0) {
      const spaces = Math.max(1, Math.min(10, Math.floor(gap / 8)))
      out += ' '.repeat(spaces)
    } else {
      out += ' '
    }
    out += text
    prev = cur
  }
  return out.trimEnd()
}

async function extractTextFromPdfFile(filePath: string): Promise<string> {
  const buf = await fs.readFile(filePath)
  const doc = await getDocument({ data: new Uint8Array(buf), disableWorker: true }).promise
  const pages: string[] = []

  for (let pageNo = 1; pageNo <= doc.numPages; pageNo++) {
    const page = await doc.getPage(pageNo)
    const content = (await page.getTextContent()) as TextContent

    const positioned: PositionedText[] = []
    for (const raw of content.items) {
      const item = raw as Partial<TextItem>
      if (typeof item?.str !== 'string') continue
      if (!Array.isArray(item.transform) || item.transform.length < 6) continue
      positioned.push({
        text: item.str,
        x: item.transform[4] ?? 0,
        y: item.transform[5] ?? 0,
        width: item.width ?? 0
      })
    }

    const lines = groupByY(positioned).sort((a, b) => b.y - a.y)
    const pageText = lines
      .map(buildLineText)
      .filter((l) => l.trim().length > 0)
      .join('\n')
    pages.push(pageText)
  }

  return pages.join('\n\n')
}

const mask = (s: string, limit = 220) => {
  const clipped = s.slice(0, limit)
  return clipped
    .replace(/\d/g, '#')
    .replace(/[A-Za-z]/g, 'A')
    .replace(/\s+/g, ' ')
    .trim()
}

async function main() {
  const files = process.argv.slice(2).filter(Boolean)
  if (!files.length) {
    console.error('Usage: pnpm esno tools/pdf/debug-mould-transfer.ts <file1.pdf> [file2.pdf ...]')
    process.exit(2)
  }

  for (const f of files) {
    const abs = path.resolve(process.cwd(), f)
    const text = await extractTextFromPdfFile(abs)
    const compact = text.replace(/\s+/g, '')

    const titleHit =
      /美菱移模通知单[（(]外调[）)]/.test(compact) ||
      compact.includes('美菱移模通知单（外调）') ||
      compact.includes('美菱移模通知单(外调)')
    const hasMoveDateLabel = compact.includes('模具移模时间')

    const parsed = parseMouldTransferFromText(text)

    console.log(`\n=== ${path.basename(f)} ===`)
    console.log(`textLength: ${text.length}`)
    console.log(`titleHit: ${titleHit}`)
    console.log(`hasMoveDateLabel: ${hasMoveDateLabel}`)
    console.log(`parseOk: ${parsed.ok}`)
    if (!parsed.ok) {
      console.log(`error: ${parsed.error}`)
      const idx = compact.indexOf('移模通知单')
      if (idx >= 0)
        console.log(`titleContext: ${mask(compact.slice(Math.max(0, idx - 40), idx + 120))}`)
      const idx2 = compact.indexOf('模具移模时间')
      if (idx2 >= 0)
        console.log(`dateContext: ${mask(compact.slice(Math.max(0, idx2 - 40), idx2 + 120))}`)
      continue
    }

    console.log(`mouldMoveDate: ${parsed.data.mouldMoveDate}`)
    console.log(`rows: ${parsed.data.rows.length}`)
    const sample = parsed.data.rows.slice(0, 2).map((r) => ({
      index: r.index,
      partNo: mask(r.partNo, 32),
      mouldName: mask(r.mouldName, 60),
      mouldNo: mask(r.mouldNo, 32),
      mouldFactory: mask(r.mouldFactory, 20),
      moveTo: mask(r.moveTo, 20),
      sealSampleNo: mask(r.sealSampleNo, 40)
    }))
    console.log(`sampleRows: ${JSON.stringify(sample)}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
