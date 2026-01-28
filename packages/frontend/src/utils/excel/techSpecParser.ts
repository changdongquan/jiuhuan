import * as XLSX from 'xlsx'

export type TechSpecData = {
  材料: string
  型腔: string
  型芯: string
  模具穴数: string
  产品外观尺寸: string
  产品列表: string[]
  产品名称列表: string[]
  产品数量列表: number[]
  产品重量列表: number[]
  产品尺寸列表: string[]
  产品结构工程师: string
  零件图片: string
}

export type TechSpecRecord = {
  id: string
  sheetName: string
  rowIndex: number | null
  partDrawingRaw: string
  partName: string
  drawings: string[]
  specData: TechSpecData
}

const normalize = (v: unknown) => String(v ?? '').trim()

const normalizeLoose = (v: unknown) =>
  normalize(v).replaceAll(/\s+/g, '').replaceAll('：', ':').toLowerCase()

export const parseDrawings = (val: unknown) => {
  const raw = normalize(val)
  if (!raw) return []

  const tokens = raw
    .replace(/；/g, ';')
    .split(/[\s;]+/)
    .map((s) => s.trim())
    .filter(Boolean)

  const expandSlashToken = (token: string) => {
    if (!token.includes('/')) return [token]

    const segments = token
      .split('/')
      .map((s) => s.trim())
      .filter(Boolean)
    if (segments.length <= 1) return [token]

    const base = segments[0]
    const baseParts = base
      .split('.')
      .map((s) => s.trim())
      .filter(Boolean)

    const results: string[] = [base]
    for (const seg of segments.slice(1)) {
      if (!seg) continue

      const suffixParts = seg
        .split('.')
        .map((s) => s.trim())
        .filter(Boolean)

      if (suffixParts.length === 0 || baseParts.length === 0) {
        results.push(seg)
        continue
      }

      if (baseParts.length - suffixParts.length === 1) {
        results.push([baseParts[0], ...suffixParts].join('.'))
        continue
      }

      if (suffixParts.length <= baseParts.length) {
        const next = [...baseParts]
        const start = baseParts.length - suffixParts.length
        for (let i = 0; i < suffixParts.length; i++) {
          next[start + i] = suffixParts[i]
        }
        results.push(next.join('.'))
        continue
      }

      results.push(seg)
    }

    return results
  }

  return tokens
    .flatMap((t) => expandSlashToken(t))
    .map((s) => s.trim())
    .filter(Boolean)
}

const parseSizes = (val: unknown) =>
  normalize(val)
    .split(/[\s\/]+/)
    .map((s) => s.trim())
    .filter(Boolean)

type SheetDetection = {
  score: number
  hasTitle: boolean
  mainHeaderRowIndex: number
  subHeaderRowIndex: number
  mainHeaderRow: string[]
  subHeaderRow: string[]
}

const scoreTechSpecSheet = (jsonData: any[][]): SheetDetection => {
  let score = 0
  let hasTitle = false

  const maxRows = Math.min(30, jsonData.length)
  const maxCols = 30
  for (let r = 0; r < maxRows; r++) {
    const row = jsonData[r] || []
    const rowMax = Math.min(maxCols, row.length)
    for (let c = 0; c < rowMax; c++) {
      const cell = normalizeLoose(row[c])
      if (!cell) continue
      if (cell.includes('注塑模具制作规格表')) {
        score += 10
        hasTitle = true
      }
      if (cell.includes('型腔')) score += 3
      if (cell.includes('型芯')) score += 3
      if (cell.includes('产品外观尺寸') || cell.includes('外观尺寸')) score += 3
      if (cell.includes('项目经理')) score += 2
      if (cell.includes('零件图号') || cell === '图号') score += 1
      if (cell.includes('零件名称') || cell === '名称') score += 1
    }
  }

  // Header detection (table style, like ProjectInitDialog)
  let mainHeaderRowIndex = -1
  let subHeaderRowIndex = -1
  let mainHeaderRow: string[] = []
  let subHeaderRow: string[] = []

  for (let i = 0; i < Math.min(20, jsonData.length); i++) {
    const row = jsonData[i] || []
    const rowStr = row.map((cell) => normalizeLoose(cell)).join('|')
    if (
      (rowStr.includes('零件图号') || rowStr.includes('图号')) &&
      (rowStr.includes('零件名称') || rowStr.includes('名称'))
    ) {
      mainHeaderRowIndex = i
      mainHeaderRow = row.map((cell) => normalize(cell))

      if (i + 1 < jsonData.length) {
        const nextRow = jsonData[i + 1] || []
        const nextRowStr = nextRow.map((cell) => normalizeLoose(cell)).join('|')
        if (nextRowStr.includes('材料') || nextRowStr.includes('材质')) {
          subHeaderRowIndex = i + 1
          subHeaderRow = nextRow.map((cell) => normalize(cell))
        }
      }
      break
    }
  }

  return { score, hasTitle, mainHeaderRowIndex, subHeaderRowIndex, mainHeaderRow, subHeaderRow }
}

const findColumnIndex = (
  mainHeaderRow: string[],
  subHeaderRow: string[],
  keywords: string[],
  preferSubHeader = false
) => {
  const hasSub = subHeaderRow.length > 0

  if (preferSubHeader && hasSub) {
    for (let i = 0; i < subHeaderRow.length; i++) {
      const cell = subHeaderRow[i].toLowerCase()
      if (keywords.some((kw) => cell.includes(kw.toLowerCase()))) return i
    }
  }

  for (let i = 0; i < mainHeaderRow.length; i++) {
    const cell = mainHeaderRow[i].toLowerCase()
    if (keywords.some((kw) => cell.includes(kw.toLowerCase()))) return i
  }

  if (!preferSubHeader && hasSub) {
    for (let i = 0; i < subHeaderRow.length; i++) {
      const cell = subHeaderRow[i].toLowerCase()
      if (keywords.some((kw) => cell.includes(kw.toLowerCase()))) return i
    }
  }

  return -1
}

const findColumnIndexFiltered = (
  mainHeaderRow: string[],
  subHeaderRow: string[],
  keywords: string[],
  filter: (cell: string) => boolean,
  preferSubHeader = false
) => {
  const match = (cellRaw: string) => {
    const cell = cellRaw.toLowerCase()
    return filter(cell) && keywords.some((kw) => cell.includes(kw.toLowerCase()))
  }

  const hasSub = subHeaderRow.length > 0

  if (preferSubHeader && hasSub) {
    for (let i = 0; i < subHeaderRow.length; i++) {
      if (match(subHeaderRow[i])) return i
    }
  }

  for (let i = 0; i < mainHeaderRow.length; i++) {
    if (match(mainHeaderRow[i])) return i
  }

  if (!preferSubHeader && hasSub) {
    for (let i = 0; i < subHeaderRow.length; i++) {
      if (match(subHeaderRow[i])) return i
    }
  }

  return -1
}

const buildSpecDataFromRow = (args: {
  row: any[]
  materialCol: number
  cavityCol: number
  coreCol: number
  cavityCountCol: number
  sizeCol: number
  engineerCol: number
  pmCol: number
  imageCol: number
  partDrawingRaw: string
  partName: string
}) => {
  const row = args.row
  const rowPartSize = args.sizeCol >= 0 ? normalize(row[args.sizeCol]) : ''

  const drawings = parseDrawings(args.partDrawingRaw)
  const sizes = parseSizes(rowPartSize)

  const productDrawings = drawings
  let productSizes = sizes
  const productNames = Array(productDrawings.length).fill(args.partName || '')
  const productQty = Array(productDrawings.length).fill(0)
  const productWeight = Array(productDrawings.length).fill(0)

  if (productDrawings.length > 1 && productSizes.length === 1 && productSizes[0]) {
    productSizes = Array(productDrawings.length).fill(productSizes[0])
  }

  const maxLength = Math.max(productDrawings.length, productSizes.length)
  while (productSizes.length < maxLength) productSizes.push('')
  while (productSizes.length > maxLength) productSizes.pop()

  const engineer = args.engineerCol >= 0 ? normalize(row[args.engineerCol]) : ''
  const pm = args.pmCol >= 0 ? normalize(row[args.pmCol]) : ''
  const productEngineer = engineer || pm

  const extracted: TechSpecData = {
    材料: args.materialCol >= 0 ? normalize(row[args.materialCol]) : '',
    型腔: args.cavityCol >= 0 ? normalize(row[args.cavityCol]) : '',
    型芯: args.coreCol >= 0 ? normalize(row[args.coreCol]) : '',
    模具穴数: args.cavityCountCol >= 0 ? normalize(row[args.cavityCountCol]) : '',
    产品外观尺寸: rowPartSize,
    产品列表: productDrawings,
    产品名称列表: productNames,
    产品数量列表: productQty,
    产品重量列表: productWeight,
    产品尺寸列表: productSizes,
    产品结构工程师: productEngineer,
    零件图片: ''
  }

  if (args.imageCol >= 0) {
    const imageValue = row[args.imageCol]
    if (
      typeof imageValue === 'string' &&
      (imageValue.startsWith('http') || imageValue.startsWith('data:'))
    ) {
      extracted.零件图片 = imageValue
    }
  }

  return { extracted, drawings }
}

const findLabelValue = (jsonData: any[][], keywords: string[]) => {
  const maxRows = Math.min(50, jsonData.length)
  for (let r = 0; r < maxRows; r++) {
    const row = jsonData[r] || []
    for (let c = 0; c < Math.min(50, row.length); c++) {
      const cell = normalize(row[c])
      if (!cell) continue
      const hit = keywords.some((kw) => cell.includes(kw))
      if (!hit) continue

      for (let k = c + 1; k < Math.min(c + 6, row.length); k++) {
        const v = normalize(row[k])
        if (v) return v
      }
    }
  }
  return ''
}

const parseTechSpecSheetAsForm = (sheetName: string, jsonData: any[][]): TechSpecRecord | null => {
  const title = normalizeLoose(jsonData?.[0]?.[0] ?? '')
  const hasAny =
    normalizeLoose(jsonData.flat().join('|')).includes('注塑模具制作规格表') ||
    title.includes('注塑模具制作规格表')
  if (!hasAny) return null

  const partDrawingRaw =
    findLabelValue(jsonData, ['产品图号', '零件图号', '图号']) ||
    findLabelValue(jsonData, ['产品图号：', '零件图号：'])
  // 避免误把“项目名称”当作“零件名称/产品名称”
  const partName = findLabelValue(jsonData, ['产品名称', '零件名称'])

  const size = findLabelValue(jsonData, ['产品外观尺寸', '外观尺寸', '尺寸'])
  const engineer =
    findLabelValue(jsonData, ['产品结构工程师', '结构工程师', '工程师']) ||
    findLabelValue(jsonData, ['项目经理'])

  const drawings = parseDrawings(partDrawingRaw)
  const sizes = parseSizes(size)
  const maxLength = Math.max(drawings.length, sizes.length)
  while (sizes.length < maxLength) sizes.push('')
  while (sizes.length > maxLength) sizes.pop()

  const record: TechSpecRecord = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    sheetName,
    rowIndex: null,
    partDrawingRaw,
    partName,
    drawings,
    specData: {
      材料: findLabelValue(jsonData, ['材料', '材质']),
      型腔: findLabelValue(jsonData, ['型腔', '前模']),
      型芯: findLabelValue(jsonData, ['型芯', '后模']),
      模具穴数: findLabelValue(jsonData, ['模具穴数', '模具腔数', '穴数', '腔数', '型腔数']),
      产品外观尺寸: size,
      产品列表: drawings,
      产品名称列表: Array(drawings.length).fill(partName || ''),
      产品数量列表: Array(drawings.length).fill(0),
      产品重量列表: Array(drawings.length).fill(0),
      产品尺寸列表: sizes,
      产品结构工程师: engineer,
      零件图片: ''
    }
  }

  return record
}

export const parseTechSpecExcel = async (arrayBuffer: ArrayBuffer) => {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })
  const records: TechSpecRecord[] = []

  // 与初始化弹窗一致：只读取第一个工作表
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return { records }
  const worksheet = workbook.Sheets[sheetName]
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][]
  if (!jsonData || jsonData.length < 2) return { records }

  const det = scoreTechSpecSheet(jsonData)
  const likelyTechSpec = det.hasTitle || det.score >= 8

  if (det.mainHeaderRowIndex >= 0) {
    const partDrawingCol = findColumnIndex(det.mainHeaderRow, det.subHeaderRow, [
      '零件图号',
      '图号'
    ])
    // 避免“项目名称”被命中（它也包含“名称”）
    const partNameCol =
      findColumnIndex(det.mainHeaderRow, det.subHeaderRow, ['零件名称']) >= 0
        ? findColumnIndex(det.mainHeaderRow, det.subHeaderRow, ['零件名称'])
        : findColumnIndexFiltered(
            det.mainHeaderRow,
            det.subHeaderRow,
            ['名称'],
            (cell) => !cell.includes('项目'),
            false
          )
    if (partDrawingCol < 0 || partNameCol < 0) return { records }

    const materialCol = findColumnIndex(det.mainHeaderRow, det.subHeaderRow, ['材料', '材质'], true)
    const cavityCol = findColumnIndexFiltered(
      det.mainHeaderRow,
      det.subHeaderRow,
      ['型腔', '前模'],
      (cell) => !cell.includes('数'),
      false
    )
    const coreCol = findColumnIndexFiltered(
      det.mainHeaderRow,
      det.subHeaderRow,
      ['型芯', '后模'],
      (cell) => !cell.includes('数'),
      false
    )
    const sizeCol = findColumnIndex(det.mainHeaderRow, det.subHeaderRow, [
      '产品外观尺寸',
      '外观尺寸',
      '尺寸'
    ])
    const engineerCol = findColumnIndex(det.mainHeaderRow, det.subHeaderRow, [
      '产品结构工程师',
      '结构工程师',
      '工程师'
    ])
    const pmCol = findColumnIndex(det.mainHeaderRow, det.subHeaderRow, ['项目经理'])
    const imageCol = findColumnIndex(det.mainHeaderRow, det.subHeaderRow, [
      '零件图片',
      '图片',
      '图示'
    ])
    const cavityCountCol = findColumnIndexFiltered(
      det.mainHeaderRow,
      det.subHeaderRow,
      ['模具穴数', '模具腔数', '穴数', '腔数', '型腔数'],
      (cell) =>
        cell.includes('穴') ||
        cell.includes('腔') ||
        cell.includes('型腔数') ||
        cell.includes('模具'),
      false
    )

    const dataStartRowIndex =
      det.subHeaderRowIndex >= 0 ? det.subHeaderRowIndex + 1 : det.mainHeaderRowIndex + 1

    for (let r = dataStartRowIndex; r < jsonData.length; r++) {
      const row = jsonData[r] || []
      const partDrawingRaw = normalize(row[partDrawingCol])
      const partName = normalize(row[partNameCol])
      // 只把“图号列非空”的行当作有效记录（备注/说明行通常图号为空）
      if (!partDrawingRaw) continue

      const { extracted, drawings } = buildSpecDataFromRow({
        row,
        materialCol,
        cavityCol,
        coreCol,
        cavityCountCol,
        sizeCol,
        engineerCol,
        pmCol,
        imageCol,
        partDrawingRaw,
        partName
      })

      records.push({
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        sheetName,
        rowIndex: r,
        partDrawingRaw,
        partName,
        drawings,
        specData: extracted
      })
    }

    return { records }
  }

  if (likelyTechSpec) {
    const formRecord = parseTechSpecSheetAsForm(sheetName, jsonData)
    if (formRecord) records.push(formRecord)
  }

  return { records }
}
