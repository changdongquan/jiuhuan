import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import workerSrc from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url'

GlobalWorkerOptions.workerSrc = workerSrc

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

export async function extractPdfText(arrayBuffer: ArrayBuffer): Promise<string> {
  const doc = await getDocument({ data: arrayBuffer }).promise
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
