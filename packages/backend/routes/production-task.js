const express = require('express')
const { query } = require('../database')
const router = express.Router()
const path = require('path')
const fs = require('fs')
const fsp = fs.promises
const multer = require('multer')
const JSZip = require('jszip')

// 生产任务附件存储配置
// 使用统一文件根目录配置，生产环境建议通过环境变量显式设置 JIUHUAN_FILES_ROOT=/mnt/jiuhuan-files（兼容旧变量 SALES_ORDER_FILES_ROOT）
// 本地开发环境则默认使用 backend/uploads 目录
const FILE_ROOT =
  process.env.JIUHUAN_FILES_ROOT ||
  process.env.SALES_ORDER_FILES_ROOT ||
  path.resolve(__dirname, '../uploads')
const TASK_SUBDIR = process.env.PRODUCTION_TASK_FILES_SUBDIR || 'production-tasks'
const MAX_ATTACHMENT_SIZE_BYTES = parseInt(
  process.env.PRODUCTION_TASK_ATTACHMENT_MAX_SIZE || String(200 * 1024 * 1024),
  10
)
const INSPECTION_TEMPLATE_PATH = path.resolve(
  __dirname,
  '../templates/production-task/塑胶模具检验记录单.docx'
)
const INSPECTION_TEMPLATE_DEFAULT_PATH = path.resolve(
  __dirname,
  '../templates/production-task/塑胶模具检验记录单_副本.docx'
)
const DOCX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

const normalizeAttachmentFileName = (name) => {
  if (!name) return name
  try {
    return Buffer.from(name, 'latin1').toString('utf8')
  } catch {
    return name
  }
}

const computeTotalHours = (hours) => {
  const fields = [
    '电极加工工时',
    '加工中心工时',
    '线切割工时',
    '放电工时',
    '机加工时',
    '抛光工时',
    '装配工时',
    '试模工时'
  ]
  let hasValue = false
  let total = 0
  fields.forEach((field) => {
    const value = hours ? hours[field] : null
    if (value !== null && value !== undefined && value !== '') {
      hasValue = true
      const numberValue = Number(value)
      if (!Number.isNaN(numberValue)) {
        total += numberValue
      }
    }
  })
  return hasValue ? Number(total.toFixed(1)) : null
}

// 根据项目编号获取分类名称
const getCategoryFromProjectCode = (projectCode) => {
  if (!projectCode) return '其他'
  const code = String(projectCode).trim().toUpperCase()
  if (code.startsWith('JH01')) return '塑胶模具'
  if (code.startsWith('JH03')) return '零件加工'
  if (code.startsWith('JH05')) return '修改模具'
  return '其他'
}

// 安全化项目编号，用于路径：将非法路径字符替换为下划线
// 非法字符：/ \ ? % * : | " < >
const safeProjectCodeForPath = (projectCode) => {
  if (!projectCode) return 'UNKNOWN'
  return String(projectCode)
    .trim()
    .replace(/[/\\?%*:|"<>]/g, '_')
}

// 安全化文件名（将非法字符替换为下划线）
const safeFileName = (fileName) => {
  if (!fileName) return fileName
  return String(fileName).replace(/[/\\?%*:|"<>]/g, '_')
}

const ensureDirSync = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

const moveFileWithFallback = async (fromPath, toPath) => {
  try {
    await fsp.rename(fromPath, toPath)
  } catch (err) {
    if (err && err.code === 'EXDEV') {
      await fsp.copyFile(fromPath, toPath)
      await fsp.unlink(fromPath)
      return
    }
    throw err
  }
}

const attachmentStorage = multer.diskStorage({
  destination(req, file, cb) {
    try {
      // 注意：destination 在路由处理前执行，此时无法查询数据库获取客户模号
      // 所以先使用临时目录，在路由处理中查询到客户模号后再移动文件到正确位置
      const tempRelativeDir = path.posix.join(
        '_temp',
        TASK_SUBDIR,
        String(Date.now()),
        String(Math.random().toString(36).slice(2, 8))
      )
      const fullDir = path.join(FILE_ROOT, tempRelativeDir)
      ensureDirSync(fullDir)

      // 记录临时目录，用于后续移动文件
      req._tempAttachmentDir = tempRelativeDir
      req._tempAttachmentFullDir = fullDir

      cb(null, fullDir)
    } catch (err) {
      cb(err)
    }
  },
  filename(req, file, cb) {
    try {
      // 临时文件名（后续会重命名为基于客户模号的名称）
      const timestamp = Date.now()
      const randomPart = Math.random().toString(36).slice(2, 8)
      const decodedName = normalizeAttachmentFileName(file.originalname)
      const safeOriginalName = decodedName.replace(/[/\\?%*:|"<>]/g, '_')
      const storedFileName = `${timestamp}-${randomPart}-${safeOriginalName}`
      req._attachmentStoredFileName = storedFileName
      cb(null, storedFileName)
    } catch (err) {
      cb(err)
    }
  }
})

const uploadAttachment = multer({
  storage: attachmentStorage,
  limits: {
    fileSize: MAX_ATTACHMENT_SIZE_BYTES
  }
})

const uploadSingleAttachment = (req, res, next) => {
  uploadAttachment.single('file')(req, res, (err) => {
    if (!err) return next()
    const message =
      err?.code === 'LIMIT_FILE_SIZE'
        ? `上传失败：单个附件不能超过 ${Math.round(MAX_ATTACHMENT_SIZE_BYTES / 1024 / 1024)}MB`
        : err?.message || '上传失败'
    res.status(400).json({ code: 400, success: false, message })
  })
}

const getProjectCodeParam = (req) =>
  String(req.params.projectCode || req.body?.projectCode || req.query?.projectCode || '').trim()

const assertProjectExists = async (projectCode) => {
  const rows = await query(
    `SELECT TOP 1 项目编号 as projectCode FROM 生产任务 WHERE 项目编号 = @projectCode`,
    {
      projectCode
    }
  )
  return !!rows.length
}

// 根据项目编号查询项目管理信息（客户模号 / 前模材质 / 后模材质）
const getProjectMaterialInfo = async (projectCode) => {
  const rows = await query(
    `
      SELECT TOP 1
        客户模号 as customerModelNo,
        前模材质 as frontMaterial,
        后模材质 as backMaterial
      FROM 项目管理
      WHERE 项目编号 = @projectCode
    `,
    { projectCode }
  )
  if (!rows.length) return null
  return rows[0]
}

// 生成新的文件名（基于客户模号和附件类型）
const generateAttachmentFileName = (customerModelNo, type, tag, originalFileName) => {
  // 获取文件扩展名
  const ext = originalFileName.split('.').pop()?.toLowerCase() || ''

  // 客户模号处理：如果为空，使用默认值
  const safeCustomerModelNo = customerModelNo || 'UNKNOWN'

  // 根据类型和标签生成文件名前缀
  let namePrefix = ''
  if (type === 'photo') {
    if (tag === 'appearance') {
      namePrefix = `${safeCustomerModelNo}_模具外观`
    } else if (tag === 'nameplate') {
      namePrefix = `${safeCustomerModelNo}_模具铭牌`
    }
  } else if (type === 'inspection') {
    namePrefix = `${safeCustomerModelNo}_塑胶模具检验记录单`
  }

  // 如果扩展名存在，组合文件名；否则只返回前缀
  return ext ? `${namePrefix}.${ext}` : namePrefix
}

const ensureTemplateExists = async (templatePath) => {
  try {
    await fsp.access(templatePath, fs.constants.R_OK)
    return true
  } catch {
    return false
  }
}

const escapeXmlText = (value) => {
  if (value === null || value === undefined) return ''
  const str = String(value)
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

const toDocxText = (value) => {
  const escaped = escapeXmlText(value)
  return escaped.replace(/\r?\n/g, ' ')
}

const resolveTemplateValue = (data, key) => {
  if (!data) return ''
  if (Object.prototype.hasOwnProperty.call(data, key)) return data[key]
  if (key.includes('.')) {
    const parts = key.split('.')
    let current = data
    for (const part of parts) {
      if (current && Object.prototype.hasOwnProperty.call(current, part)) {
        current = current[part]
      } else {
        current = undefined
        break
      }
    }
    return current
  }
  return ''
}

const replaceDocxPlaceholders = (xml, data) => {
  if (!xml) return xml
  return xml.replace(/(<w:t[^>]*>)([^<]*)(<\/w:t>)/g, (match, openTag, text, closeTag) => {
    if (!text || !text.includes('{{')) return match
    const replaced = text.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (m, key) => {
      if (String(key).trim().startsWith('检验结果_')) return m
      const value = resolveTemplateValue(data, String(key).trim())
      return toDocxText(value)
    })
    return `${openTag}${replaced}${closeTag}`
  })
}

const decodeXmlEntities = (text) => {
  if (!text) return ''
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

const extractDefaultResultChoiceList = (xml) => {
  if (!xml) return []
  const rows = xml.match(/<w:tr[\s\S]*?<\/w:tr>/g) || []
  const results = []
  rows.forEach((row) => {
    const plain = decodeXmlEntities(String(row).replace(/<[^>]+>/g, ' '))
    const normalized = plain.replace(/\s+/g, '')
    if (!normalized.includes('是【') || !normalized.includes('】')) return
    if (normalized.includes('是【/】')) {
      results.push('yes')
      return
    }
    if (normalized.includes('否【/】')) {
      results.push('no')
      return
    }
    if (normalized.includes('无【/】')) {
      results.push('none')
    }
  })
  return results
}

const buildDefaultResultChoiceMap = (templateXml, defaultXml) => {
  const map = {}
  if (!templateXml || !defaultXml) return map

  const templateRows = templateXml.match(/<w:tr[\s\S]*?<\/w:tr>/g) || []
  const defaultResults = extractDefaultResultChoiceList(defaultXml)

  let defaultIndex = 0
  templateRows.forEach((row) => {
    const m = row.match(/\{\{检验结果_(\d+)(?::[^}]+)?\}\}/)
    if (!m) return
    const seq = m[1]
    if (defaultIndex >= defaultResults.length) return
    map[seq] = defaultResults[defaultIndex]
    defaultIndex += 1
  })

  return map
}

const extractInspectionItemsFromTemplateXml = (xml) => {
  if (!xml) return []
  const rows = xml.match(/<w:tr[\s\S]*?<\/w:tr>/g) || []
  const items = []

  const stripTags = (input) => decodeXmlEntities(String(input || '').replace(/<[^>]+>/g, ''))

  rows.forEach((row) => {
    if (!row.includes('w:highlight') || !row.includes('yellow')) return
    const placeholderMatch = row.match(/\{\{检验结果_(\d+)(?::([^}]+))?\}\}/)
    if (!placeholderMatch) return
    const seq = placeholderMatch[1]
    const optionText = placeholderMatch[2] || 'yes,no,none'
    const options = optionText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const cells = row.match(/<w:tc[\s\S]*?<\/w:tc>/g) || []
    if (!cells.length) return

    const texts = cells.map((cell) => stripTags(cell).trim())

    const contentCandidates = texts.filter(
      (t) =>
        t &&
        !t.includes('检验') &&
        !t.includes('目测') &&
        !t.includes(`{{检验结果_${seq}}}`) &&
        !t.includes('检验结果_')
    )
    const content = contentCandidates.length
      ? contentCandidates.reduce((a, b) => (a.length >= b.length ? a : b))
      : ''

    if (seq && content) {
      if (seq === '2') {
        return
      }
      items.push({ seq, content, options })
    }
  })
  return items
}

const renderResultText = (choice, options) => {
  const opts = options && options.length ? options : ['yes', 'no', 'none']
  const hasNo = opts.includes('no')
  const hasNone = opts.includes('none')

  if (!hasNo && hasNone) {
    return choice === 'yes' ? '是【/】无【】' : '是【】无【/】'
  }
  if (hasNo && !hasNone) {
    return choice === 'yes' ? '是【/】否【】' : '是【】否【/】'
  }
  return choice === 'yes'
    ? '是【/】否【】无【】'
    : choice === 'no'
      ? '是【】否【/】无【】'
      : '是【】否【】无【/】'
}

const applyInspectionResultsToXml = (xml, results, defaultMap, manualSeqs) => {
  if (!xml) return xml
  const manualSeqSet = new Set(
    Array.isArray(manualSeqs) ? manualSeqs.map((s) => String(s).trim()).filter(Boolean) : []
  )
  return xml.replace(/\{\{检验结果_(\d+)(?::([^}]+))?\}\}/g, (match, seq, optionText) => {
    const options = String(optionText || 'yes,no,none')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const choice = results && results[seq] ? results[seq] : ''
    if (choice) return renderResultText(choice, options)

    if (manualSeqSet.has(String(seq))) return ''

    const defChoice = defaultMap && defaultMap[seq] ? defaultMap[seq] : ''
    if (!defChoice) return match
    return renderResultText(defChoice, options)
  })
}

const renderDocxTemplate = async (templateBuffer, data, inspectionResults, defaultMap, manualSeqs) => {
  const zip = await JSZip.loadAsync(templateBuffer)
  const targetNames = Object.keys(zip.files).filter((name) =>
    /^word\/(document|header\d+|footer\d+)\.xml$/i.test(name)
  )
  if (!targetNames.length) {
    throw new Error('模板文件内容不完整')
  }
  await Promise.all(
    targetNames.map(async (name) => {
      const file = zip.file(name)
      if (!file) return
      let xml = await file.async('string')
      if (name === 'word/document.xml') {
        xml = applyInspectionResultsToXml(xml, inspectionResults || {}, defaultMap, manualSeqs)
      }
      const nextXml = replaceDocxPlaceholders(xml, data)
      zip.file(name, nextXml)
    })
  )
  const buffer = await zip.generateAsync({ type: 'nodebuffer' })
  // 清理掉目录项，避免部分 Word 版本提示修复
  const cleaned = await JSZip.loadAsync(buffer)
  const outZip = new JSZip()
  await Promise.all(
    Object.values(cleaned.files).map(async (file) => {
      if (file.dir) return
      const content = await file.async('nodebuffer')
      outZip.file(file.name, content)
    })
  )
  return outZip.generateAsync({ type: 'nodebuffer' })
}

const getFileFullPath = (relativePath, storedFileName) => {
  return path.join(FILE_ROOT, relativePath, storedFileName)
}

const ensureTaskAttachmentsTable = async () => {
  // 生产环境建议用迁移脚本创建；这里做兜底，避免本地未建表导致 500
  await query(`
    IF OBJECT_ID(N'dbo.生产任务附件', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.生产任务附件 (
        附件ID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        项目编号 NVARCHAR(50) NOT NULL,
        附件类型 NVARCHAR(20) NOT NULL,
        附件标签 NVARCHAR(20) NULL,
        原始文件名 NVARCHAR(255) NOT NULL,
        存储文件名 NVARCHAR(255) NOT NULL,
        相对路径 NVARCHAR(255) NOT NULL,
        文件大小 BIGINT NOT NULL,
        内容类型 NVARCHAR(100) NULL,
        上传时间 DATETIME2 NOT NULL CONSTRAINT DF_生产任务附件_上传时间 DEFAULT (SYSDATETIME()),
        上传人 NVARCHAR(100) NULL
      );

      CREATE INDEX IX_生产任务附件_项目编号 ON dbo.生产任务附件 (项目编号);
      CREATE INDEX IX_生产任务附件_项目编号_类型 ON dbo.生产任务附件 (项目编号, 附件类型, 上传时间 DESC, 附件ID DESC);
      CREATE INDEX IX_生产任务附件_项目编号_类型_标签 ON dbo.生产任务附件 (项目编号, 附件类型, 附件标签, 上传时间 DESC, 附件ID DESC);

      ALTER TABLE dbo.生产任务附件
      ADD CONSTRAINT FK_生产任务附件_生产任务
      FOREIGN KEY (项目编号) REFERENCES dbo.生产任务(项目编号)
      ON DELETE CASCADE;
    END

    IF COL_LENGTH(N'dbo.生产任务附件', N'附件标签') IS NULL
    BEGIN
      ALTER TABLE dbo.生产任务附件 ADD 附件标签 NVARCHAR(20) NULL;
    END
  `)
}

/**
 * 构建 ORDER BY 子句
 * @param {string} sortField - 排序字段
 * @param {string} sortOrder - 排序方向 (asc/desc)
 * @returns {string} ORDER BY SQL 子句
 */
function buildOrderByClause(sortField, sortOrder) {
  // 排序字段白名单映射（防止SQL注入）
  const sortableFields = {
    项目编号: 'pt.项目编号',
    计划首样日期: 'p.计划首样日期',
    生产状态: 'pt.生产状态'
  }

  // 如果提供了有效的排序字段和排序方向
  const mappedField = sortField && sortableFields[sortField]
  const sortDir = (sortOrder || '').toString().toLowerCase()

  if (mappedField && (sortDir === 'asc' || sortDir === 'desc')) {
    return `ORDER BY ${mappedField} ${sortDir.toUpperCase()}`
  }

  // 默认排序（与项目管理保持一致）：
  // 1. 计划首样日期在【今天前后 7 天之内】且“尚未送样”的项目排在最前面
  //    （尚未送样：首次送样日期为空）
  //    （即：|计划首样日期 - 今天| <= 7 天）
  // 2. 这组内部按计划首样日期从早到晚排序
  // 3. 其他项目按项目编号倒序（近似数据库倒序）
  return `
    ORDER BY 
      CASE 
        WHEN p.计划首样日期 IS NOT NULL 
             AND p.首次送样日期 IS NULL
             AND ABS(DATEDIFF(DAY, CAST(GETDATE() AS date), p.计划首样日期)) <= 7
        THEN 0
        ELSE 1
      END ASC,
      CASE 
        WHEN p.计划首样日期 IS NOT NULL 
             AND p.首次送样日期 IS NULL
             AND ABS(DATEDIFF(DAY, CAST(GETDATE() AS date), p.计划首样日期)) <= 7
        THEN p.计划首样日期
        ELSE NULL
      END ASC,
      pt.项目编号 DESC
  `
}

// 获取生产任务列表
router.get('/list', async (req, res) => {
  try {
    const { keyword, status, category, page = 1, pageSize = 10, sortField, sortOrder } = req.query

    let whereConditions = []
    let params = {}

    // 构建查询条件
    if (keyword) {
      whereConditions.push(`(
        pt.项目编号 LIKE @keyword 
        OR g.产品名称 LIKE @keyword
        OR g.产品图号 LIKE @keyword
        OR p.客户模号 LIKE @keyword
      )`)
      params.keyword = `%${keyword}%`
    }

    // 生产状态条件：
    // - 不显示“已完成”记录（无论是否传入关键词或状态）
    // - 如需精确筛选其他状态，仍可传 status
    whereConditions.push(`(pt.生产状态 IS NULL OR pt.生产状态 <> @excludeStatus)`)
    params.excludeStatus = '已完成'

    if (status && status !== '已完成') {
      whereConditions.push(`pt.生产状态 = @status`)
      params.status = status
    }

    if (category) {
      whereConditions.push(`g.分类 = @category`)
      params.category = category
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

    // 计算分页
    const offset = (page - 1) * pageSize

    // 查询总数（需要包含JOIN以支持关键词查询关联表字段）
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM 生产任务 pt
      LEFT JOIN 货物信息 g ON pt.项目编号 = g.项目编号 AND CAST(g.IsNew AS INT) != 1
      LEFT JOIN 项目管理 p ON pt.项目编号 = p.项目编号
      ${whereClause}
    `
    const countResult = await query(countQuery, params)
    const total = countResult[0].total

    // 查询数据，关联货物信息获取产品名称和产品图号
    const dataQuery = `
      SELECT 
        pt.项目编号,
        pt.负责人,
        pt.开始日期,
        pt.结束日期,
        pt.生产状态,
        pt.优先级,
        pt.投产数量,
        pt.已完成数量,
        pt.电极加工工时,
        pt.下达日期,
        pt.放电工时,
        pt.检验工时,
        pt.编程工时,
        pt.试模工时,
        pt.抛光工时,
        pt.机加工时,
        pt.装配工时,
        pt.加工中心工时,
        pt.线切割工时,
        pt.合计工时,
        g.产品名称 as productName,
        g.产品图号 as productDrawing,
        p.客户模号 as 客户模号,
        ISNULL((
          SELECT SUM(数量) 
          FROM 销售订单 
          WHERE 项目编号 = pt.项目编号
        ), 0) as 订单数量,
        p.产品材质 as 产品材质,
        CONVERT(varchar(10), p.图纸下发日期, 23) as 图纸下发日期,
        p.计划首样日期 as 计划首样日期
      FROM 生产任务 pt
      LEFT JOIN 货物信息 g ON pt.项目编号 = g.项目编号 AND CAST(g.IsNew AS INT) != 1
      LEFT JOIN 项目管理 p ON pt.项目编号 = p.项目编号
      ${whereClause}
      ${buildOrderByClause(sortField, sortOrder)}
      OFFSET ${offset} ROWS
      FETCH NEXT ${pageSize} ROWS ONLY
    `

    const data = await query(dataQuery, params)

    res.json({
      code: 0,
      success: true,
      data: {
        list: data,
        total: total,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      }
    })
  } catch (error) {
    console.error('获取生产任务列表失败:', error)
    res.status(500).json({
      success: false,
      message: '获取生产任务列表失败',
      error: error.message
    })
  }
})

// 获取生产任务统计数据
router.get('/statistics', async (req, res) => {
  try {
    const statisticsQuery = `
      SELECT 
        SUM(CASE WHEN pt.生产状态 IS NULL OR pt.生产状态 <> '已完成' THEN 1 ELSE 0 END) as total,
        SUM(CASE WHEN pt.生产状态 = '进行中' THEN 1 ELSE 0 END) as inProgress,
        SUM(CASE WHEN pt.生产状态 = '已完成' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN pt.生产状态 = '待开始' THEN 1 ELSE 0 END) as pending,
        SUM(
          CASE 
            WHEN (pt.生产状态 IS NULL OR pt.生产状态 <> '已完成') AND g.分类 = '塑胶模具'
            THEN 1 ELSE 0 
          END
        ) as plasticMould,
        SUM(
          CASE 
            WHEN (pt.生产状态 IS NULL OR pt.生产状态 <> '已完成') AND g.分类 = '修改模具'
            THEN 1 ELSE 0 
          END
        ) as modifyMould,
        SUM(
          CASE 
            WHEN (pt.生产状态 IS NULL OR pt.生产状态 <> '已完成') AND g.分类 = '零件加工'
            THEN 1 ELSE 0 
          END
        ) as partsProcessing
      FROM 生产任务 pt
      LEFT JOIN 货物信息 g ON pt.项目编号 = g.项目编号 AND CAST(g.IsNew AS INT) != 1
    `
    const result = await query(statisticsQuery)
    const stats = result[0] || {}

    res.json({
      code: 0,
      success: true,
      data: {
        total: stats.total || 0,
        inProgress: stats.inProgress || 0,
        completed: stats.completed || 0,
        pending: stats.pending || 0,
        plasticMould: stats.plasticMould || 0,
        modifyMould: stats.modifyMould || 0,
        partsProcessing: stats.partsProcessing || 0
      }
    })
  } catch (error) {
    console.error('获取生产任务统计数据失败:', error)
    res.status(500).json({
      success: false,
      message: '获取生产任务统计数据失败',
      error: error.message
    })
  }
})

// 获取单个生产任务信息（使用 query 参数）
router.get('/detail', async (req, res) => {
  try {
    const { projectCode } = req.query

    if (!projectCode) {
      return res.status(400).json({
        success: false,
        message: '项目编号不能为空'
      })
    }

    const queryString = `
      SELECT 
        pt.项目编号,
        pt.负责人,
        pt.开始日期,
        pt.结束日期,
        pt.生产状态,
        pt.优先级,
        pt.投产数量,
        pt.已完成数量,
        pt.电极加工工时,
        pt.下达日期,
        pt.放电工时,
        pt.检验工时,
        pt.编程工时,
        pt.试模工时,
        pt.抛光工时,
        pt.机加工时,
        pt.装配工时,
        pt.加工中心工时,
        pt.线切割工时,
        pt.合计工时,
        g.产品名称 as productName,
        g.产品图号 as productDrawing,
        p.客户模号 as 客户模号,
        ISNULL((
          SELECT SUM(数量) 
          FROM 销售订单 
          WHERE 项目编号 = pt.项目编号
        ), 0) as 订单数量,
        (
          SELECT TOP 1 CONVERT(varchar(10), 交货日期, 23)
          FROM 销售订单 
          WHERE 项目编号 = pt.项目编号 AND 交货日期 IS NOT NULL
          ORDER BY 交货日期 ASC
        ) as 交货日期,
        p.产品材质 as 产品材质,
        CONVERT(varchar(10), p.图纸下发日期, 23) as 图纸下发日期,
        p.计划首样日期 as 计划首样日期
      FROM 生产任务 pt
      LEFT JOIN 货物信息 g ON pt.项目编号 = g.项目编号 AND CAST(g.IsNew AS INT) != 1
      LEFT JOIN 项目管理 p ON pt.项目编号 = p.项目编号
      WHERE pt.项目编号 = @projectCode
    `

    const result = await query(queryString, { projectCode })

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: '生产任务不存在'
      })
    }

    res.json({
      code: 0,
      success: true,
      data: result[0]
    })
  } catch (error) {
    console.error('获取生产任务失败:', error)
    res.status(500).json({
      success: false,
      message: '获取生产任务失败',
      error: error.message
    })
  }
})

// === 生产任务附件相关接口 ===

// 上传附件（照片 / 模具检验表）
// 注意：项目编号可能包含斜杠（例如 JH05-25-044/01），Express 会在路由匹配前将 %2F 解码为 /
// 使用 :projectCode(*) 以便参数可跨越多个 path segment
router.post('/:projectCode(*)/attachments/:type', uploadSingleAttachment, async (req, res) => {
  try {
    await ensureTaskAttachmentsTable()
    const projectCode = getProjectCodeParam(req)
    const type = String(req.params.type || '').trim()
    const tagRaw = (req.body && (req.body.tag || req.body.label)) || null
    const tag = tagRaw === null || tagRaw === undefined ? null : String(tagRaw).trim()
    if (!projectCode) {
      return res.status(400).json({ code: 400, success: false, message: '项目编号不能为空' })
    }
    if (!['photo', 'inspection'].includes(type)) {
      return res.status(400).json({ code: 400, success: false, message: '附件类型不合法' })
    }
    if (type === 'photo') {
      if (!tag) {
        return res.status(400).json({ code: 400, success: false, message: '照片附件必须指定标签' })
      }
      if (!['appearance', 'nameplate'].includes(tag)) {
        return res.status(400).json({ code: 400, success: false, message: '照片附件标签不合法' })
      }
    }

    const existed = await assertProjectExists(projectCode)
    if (!existed) {
      return res.status(404).json({ code: 404, success: false, message: '生产任务不存在' })
    }

    const file = req.file
    if (!file) {
      return res.status(400).json({ code: 400, success: false, message: '未找到上传文件' })
    }

    // 查询客户模号/材质
    const materialInfo = await getProjectMaterialInfo(projectCode)
    const customerModelNo = materialInfo?.customerModelNo || null

    // 安全化项目编号（用于路径）
    const category = getCategoryFromProjectCode(projectCode)
    const safeProjectCode = safeProjectCodeForPath(projectCode)

    // 确定子目录名
    const typeDirName = type === 'photo' ? '模具图片' : '塑胶模具检验记录单'

    // 计算最终存储路径：{分类}/{项目编号}/生产任务/{子目录名}/
    const finalRelativeDir = path.posix.join(category, safeProjectCode, '生产任务', typeDirName)
    const finalFullDir = path.join(FILE_ROOT, finalRelativeDir)
    ensureDirSync(finalFullDir)

    // 生成新的文件名
    const originalName = normalizeAttachmentFileName(file.originalname)
    const newFileName = generateAttachmentFileName(customerModelNo, type, tag, originalName)
    const safeNewFileName = safeFileName(newFileName) // 安全化文件名

    // 照片：同一项目+标签只保留一张（上传即替换）
    // 注意：需要在移动新文件之前先删除旧文件，避免新文件名和旧文件名相同时导致问题
    if (type === 'photo') {
      const existedRows = await query(
        `
        SELECT TOP 1
          附件ID as id,
          存储文件名 as storedFileName,
          相对路径 as relativePath
        FROM 生产任务附件
        WHERE 项目编号 = @projectCode
          AND 附件类型 = @type
          AND 附件标签 = @tag
        ORDER BY 上传时间 DESC, 附件ID DESC
      `,
        { projectCode, type, tag }
      )
      if (existedRows.length) {
        const prev = existedRows[0]
        // 先删除旧文件
        try {
          const prevPath = getFileFullPath(prev.relativePath, prev.storedFileName)
          if (fs.existsSync(prevPath)) fs.unlinkSync(prevPath)
        } catch (fileErr) {
          console.warn('替换照片附件时删除旧文件失败:', fileErr)
        }
        // 再删除数据库记录
        await query(`DELETE FROM 生产任务附件 WHERE 附件ID = @id`, { id: Number(prev.id) })
      }
    }

    // 照片：同一项目+标签只保留一张（上传即替换）
    // 注意：需要在移动新文件之前先删除旧文件，避免新文件名和旧文件名相同时导致问题
    if (type === 'photo') {
      const existedRows = await query(
        `
        SELECT TOP 1
          附件ID as id,
          存储文件名 as storedFileName,
          相对路径 as relativePath
        FROM 生产任务附件
        WHERE 项目编号 = @projectCode
          AND 附件类型 = @type
          AND 附件标签 = @tag
        ORDER BY 上传时间 DESC, 附件ID DESC
      `,
        { projectCode, type, tag }
      )
      if (existedRows.length) {
        const prev = existedRows[0]
        // 先删除旧文件
        try {
          const prevPath = getFileFullPath(prev.relativePath, prev.storedFileName)
          if (fs.existsSync(prevPath)) fs.unlinkSync(prevPath)
        } catch (fileErr) {
          console.warn('替换照片附件时删除旧文件失败:', fileErr)
        }
        // 再删除数据库记录
        await query(`DELETE FROM 生产任务附件 WHERE 附件ID = @id`, { id: Number(prev.id) })
      }
    }

    // 将文件从临时目录移动到最终目录（使用新文件名）
    const tempFile = path.join(
      req._tempAttachmentFullDir || FILE_ROOT,
      req._attachmentStoredFileName || file.filename
    )
    const finalFile = path.join(finalFullDir, safeNewFileName)

    if (fs.existsSync(tempFile)) {
      await moveFileWithFallback(tempFile, finalFile)
      // 清理临时目录（如果为空）
      try {
        const tempDir = req._tempAttachmentFullDir
        if (tempDir && fs.existsSync(tempDir)) {
          const files = fs.readdirSync(tempDir)
          if (files.length === 0) {
            fs.rmdirSync(tempDir, { recursive: true })
            // 尝试清理父目录
            const parentDir = path.dirname(tempDir)
            if (fs.existsSync(parentDir)) {
              try {
                const parentFiles = fs.readdirSync(parentDir)
                if (parentFiles.length === 0) {
                  fs.rmdirSync(parentDir, { recursive: true })
                }
              } catch (e) {
                // 忽略清理父目录的错误
              }
            }
          }
        }
      } catch (cleanupErr) {
        // 忽略清理临时目录的错误，不影响主流程
        console.warn('清理临时目录失败:', cleanupErr)
      }
    }

    const storedFileName = safeNewFileName // 使用新生成的文件名
    const relativePath = finalRelativeDir // 新的相对路径
    const fileSize = file.size
    const contentType = file.mimetype || null
    const uploadedBy = (req.body && (req.body.uploadedBy || req.body.uploader)) || null

    const inserted = await query(
      `
      INSERT INTO 生产任务附件 (
        项目编号,
        附件类型,
        附件标签,
        原始文件名,
        存储文件名,
        相对路径,
        文件大小,
        内容类型,
        上传人
      )
      OUTPUT
        INSERTED.附件ID as id,
        INSERTED.上传时间 as uploadedAt
      VALUES (
        @projectCode,
        @type,
        @tag,
        @originalName,
        @storedFileName,
        @relativePath,
        @fileSize,
        @contentType,
        @uploadedBy
      )
    `,
      {
        projectCode,
        type,
        tag,
        originalName,
        storedFileName,
        relativePath,
        fileSize,
        contentType,
        uploadedBy
      }
    )

    res.json({
      code: 0,
      success: true,
      message: '上传附件成功',
      data: {
        id: inserted?.[0]?.id,
        projectCode,
        type,
        tag,
        originalName,
        storedFileName,
        relativePath,
        fileSize,
        contentType,
        uploadedAt: inserted?.[0]?.uploadedAt
      }
    })
  } catch (error) {
    console.error('上传生产任务附件失败:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: '上传生产任务附件失败',
      error: error.message
    })
  }
})

// 生成模具检验记录单（基于模板）
router.post('/:projectCode(*)/attachments/inspection/generate', async (req, res) => {
  try {
    await ensureTaskAttachmentsTable()
    const projectCode = getProjectCodeParam(req)
    if (!projectCode) {
      return res.status(400).json({ code: 400, success: false, message: '项目编号不能为空' })
    }

    const existed = await assertProjectExists(projectCode)
    if (!existed) {
      return res.status(404).json({ code: 404, success: false, message: '生产任务不存在' })
    }

    const templateExists = await ensureTemplateExists(INSPECTION_TEMPLATE_PATH)
    if (!templateExists) {
      return res
        .status(500)
        .json({ code: 500, success: false, message: '模板文件不存在' })
    }

    const payload = req.body && typeof req.body === 'object' ? req.body : {}
    const data = payload.data && typeof payload.data === 'object' ? payload.data : {}
    const inspectionResults =
      payload.inspectionResults && typeof payload.inspectionResults === 'object'
        ? payload.inspectionResults
        : null
    const manualSeqs = Array.isArray(payload.manualSeqs)
      ? payload.manualSeqs.map((s) => String(s).trim()).filter(Boolean)
      : null
    const uploadedBy = (payload && (payload.uploadedBy || payload.uploader)) || null

    const materialInfo = await getProjectMaterialInfo(projectCode)
    const customerModelNo = materialInfo?.customerModelNo || null
    const mergedData = {
      客户模号: customerModelNo || '',
      前模材质: materialInfo?.frontMaterial || '',
      后模材质: materialInfo?.backMaterial || '',
      ...data
    }

    const templateBuffer = await fsp.readFile(INSPECTION_TEMPLATE_PATH)
    let defaultMap = null
    try {
      const defaultBuffer = await fsp.readFile(INSPECTION_TEMPLATE_DEFAULT_PATH)
      const defaultZip = await JSZip.loadAsync(defaultBuffer)
      const defaultDoc = defaultZip.file('word/document.xml')
      const templateZip = await JSZip.loadAsync(templateBuffer)
      const templateDoc = templateZip.file('word/document.xml')
      if (defaultDoc && templateDoc) {
        const [defaultXml, templateXml] = await Promise.all([
          defaultDoc.async('string'),
          templateDoc.async('string')
        ])
      defaultMap = buildDefaultResultChoiceMap(templateXml, defaultXml)
      }
    } catch (e) {
      console.warn('读取默认检验结果模板失败:', e)
    }
    if (!defaultMap || Object.keys(defaultMap).length === 0) {
      console.warn('默认检验结果映射为空，未能应用默认勾选')
    }

    const generatedBuffer = await renderDocxTemplate(
      templateBuffer,
      mergedData,
      inspectionResults,
      defaultMap,
      manualSeqs
    )
    const category = getCategoryFromProjectCode(projectCode)
    const safeProjectCode = safeProjectCodeForPath(projectCode)
    const typeDirName = '塑胶模具检验记录单'
    const finalRelativeDir = path.posix.join(category, safeProjectCode, '生产任务', typeDirName)
    const finalFullDir = path.join(FILE_ROOT, finalRelativeDir)
    ensureDirSync(finalFullDir)

    const templateBaseName = path.basename(INSPECTION_TEMPLATE_PATH)
    const newFileName = generateAttachmentFileName(
      customerModelNo,
      'inspection',
      null,
      templateBaseName
    )
    const safeNewFileName = safeFileName(newFileName)
    const finalFile = path.join(finalFullDir, safeNewFileName)

    const existedRows = await query(
      `
        SELECT TOP 1
          附件ID as id,
          存储文件名 as storedFileName,
          相对路径 as relativePath
        FROM 生产任务附件
        WHERE 项目编号 = @projectCode
          AND 附件类型 = @type
          AND 存储文件名 = @storedFileName
        ORDER BY 上传时间 DESC, 附件ID DESC
      `,
      { projectCode, type: 'inspection', storedFileName: safeNewFileName }
    )
    if (existedRows.length) {
      const prev = existedRows[0]
      try {
        const prevPath = getFileFullPath(prev.relativePath, prev.storedFileName)
        if (fs.existsSync(prevPath)) fs.unlinkSync(prevPath)
      } catch (fileErr) {
        console.warn('生成检验记录单时删除旧文件失败:', fileErr)
      }
      await query(`DELETE FROM 生产任务附件 WHERE 附件ID = @id`, { id: Number(prev.id) })
    }

    await fsp.writeFile(finalFile, generatedBuffer)

    const storedFileName = safeNewFileName
    const relativePath = finalRelativeDir
    const fileSize = generatedBuffer.length
    const contentType = DOCX_CONTENT_TYPE
    const originalName = templateBaseName

    const inserted = await query(
      `
      INSERT INTO 生产任务附件 (
        项目编号,
        附件类型,
        附件标签,
        原始文件名,
        存储文件名,
        相对路径,
        文件大小,
        内容类型,
        上传人
      )
      OUTPUT
        INSERTED.附件ID as id,
        INSERTED.上传时间 as uploadedAt
      VALUES (
        @projectCode,
        @type,
        @tag,
        @originalName,
        @storedFileName,
        @relativePath,
        @fileSize,
        @contentType,
        @uploadedBy
      )
    `,
      {
        projectCode,
        type: 'inspection',
        tag: null,
        originalName,
        storedFileName,
        relativePath,
        fileSize,
        contentType,
        uploadedBy
      }
    )

    res.json({
      code: 0,
      success: true,
      message: '生成模具检验记录单成功',
      data: {
        id: inserted?.[0]?.id,
        projectCode,
        type: 'inspection',
        tag: null,
        originalName,
        storedFileName,
        relativePath,
        fileSize,
        contentType,
        uploadedAt: inserted?.[0]?.uploadedAt
      }
    })
  } catch (error) {
    console.error('生成模具检验记录单失败:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: '生成模具检验记录单失败',
      error: error.message
    })
  }
})

// 获取检验结果需要填充的行（模板中黄色高亮的行）
router.get('/inspection-template/items', async (req, res) => {
  try {
    const templateExists = await ensureTemplateExists(INSPECTION_TEMPLATE_PATH)
    if (!templateExists) {
      return res
        .status(500)
        .json({ code: 500, success: false, message: '模板文件不存在' })
    }
    const templateBuffer = await fsp.readFile(INSPECTION_TEMPLATE_PATH)
    const zip = await JSZip.loadAsync(templateBuffer)
    const docFile = zip.file('word/document.xml')
    if (!docFile) {
      return res
        .status(500)
        .json({ code: 500, success: false, message: '模板内容不完整' })
    }
    const xml = await docFile.async('string')
    const items = extractInspectionItemsFromTemplateXml(xml)
    res.json({ code: 0, success: true, data: items })
  } catch (error) {
    console.error('读取检验模板失败:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: '读取检验模板失败',
      error: error.message
    })
  }
})

// 获取某生产任务下的附件列表（按类型可选）
// 注意：项目编号可能包含斜杠（例如 JH05-25-044/01），Express 会在路由匹配前将 %2F 解码为 /
// 使用 :projectCode(*) 以便参数可跨越多个 path segment
router.get('/:projectCode(*)/attachments', async (req, res) => {
  try {
    await ensureTaskAttachmentsTable()
    const projectCode = getProjectCodeParam(req)
    const type = String(req.query.type || '').trim()
    if (!projectCode) {
      return res.status(400).json({ code: 400, success: false, message: '项目编号不能为空' })
    }

    const params = { projectCode }
    const whereType = type ? 'AND 附件类型 = @type' : ''
    if (type) params.type = type

    const rows = await query(
      `
      SELECT
        附件ID as id,
        项目编号 as projectCode,
        附件类型 as type,
        附件标签 as tag,
        原始文件名 as originalName,
        存储文件名 as storedFileName,
        相对路径 as relativePath,
        文件大小 as fileSize,
        内容类型 as contentType,
        上传时间 as uploadedAt,
        上传人 as uploadedBy
      FROM 生产任务附件
      WHERE 项目编号 = @projectCode
      ${whereType}
      ORDER BY 上传时间 DESC, 附件ID DESC
    `,
      params
    )

    res.json({ code: 0, success: true, data: rows })
  } catch (error) {
    console.error('获取生产任务附件列表失败:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: '获取生产任务附件列表失败',
      error: error.message
    })
  }
})

// 下载附件
router.get('/attachments/:attachmentId/download', async (req, res) => {
  try {
    await ensureTaskAttachmentsTable()
    const attachmentId = parseInt(req.params.attachmentId, 10)
    if (!Number.isInteger(attachmentId) || attachmentId <= 0) {
      return res.status(400).json({ code: 400, success: false, message: '附件ID不合法' })
    }

    const rows = await query(
      `
      SELECT TOP 1
        附件ID as id,
        原始文件名 as originalName,
        存储文件名 as storedFileName,
        相对路径 as relativePath
      FROM 生产任务附件
      WHERE 附件ID = @attachmentId
    `,
      { attachmentId }
    )
    if (!rows.length) {
      return res.status(404).json({ code: 404, success: false, message: '附件不存在' })
    }

    const attachment = rows[0]
    const fullPath = getFileFullPath(attachment.relativePath, attachment.storedFileName)
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ code: 404, success: false, message: '附件文件不存在' })
    }

    res.download(fullPath, attachment.originalName)
  } catch (error) {
    console.error('下载生产任务附件失败:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: '下载生产任务附件失败',
      error: error.message
    })
  }
})

// 删除附件
router.delete('/attachments/:attachmentId', async (req, res) => {
  try {
    await ensureTaskAttachmentsTable()
    const attachmentId = parseInt(req.params.attachmentId, 10)
    if (!Number.isInteger(attachmentId) || attachmentId <= 0) {
      return res.status(400).json({ code: 400, success: false, message: '附件ID不合法' })
    }

    const rows = await query(
      `
      SELECT TOP 1
        附件ID as id,
        存储文件名 as storedFileName,
        相对路径 as relativePath
      FROM 生产任务附件
      WHERE 附件ID = @attachmentId
    `,
      { attachmentId }
    )
    if (!rows.length) {
      return res.status(404).json({ code: 404, success: false, message: '附件不存在' })
    }

    const att = rows[0]
    const fullPath = getFileFullPath(att.relativePath, att.storedFileName)

    await query(`DELETE FROM 生产任务附件 WHERE 附件ID = @attachmentId`, { attachmentId })

    try {
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath)
      }
    } catch (fileErr) {
      console.warn('删除附件文件失败（已删除数据库记录）:', fileErr)
    }

    res.json({ code: 0, success: true, message: '删除成功' })
  } catch (error) {
    console.error('删除生产任务附件失败:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: '删除生产任务附件失败',
      error: error.message
    })
  }
})

// 更新生产任务信息（使用 body 中的 projectCode）
router.put('/update', async (req, res) => {
  try {
    const { projectCode, ...data } = req.body

    if (!projectCode) {
      return res.status(400).json({
        success: false,
        message: '项目编号不能为空'
      })
    }

    const hourFields = [
      '电极加工工时',
      '加工中心工时',
      '线切割工时',
      '放电工时',
      '机加工时',
      '抛光工时',
      '装配工时',
      '试模工时'
    ]
    const hasHourUpdate =
      hourFields.some((field) => Object.prototype.hasOwnProperty.call(data, field)) ||
      Object.prototype.hasOwnProperty.call(data, '合计工时')
    if (hasHourUpdate) {
      const currentRows = await query(
        `
        SELECT
          电极加工工时,
          加工中心工时,
          线切割工时,
          放电工时,
          机加工时,
          抛光工时,
          装配工时,
          试模工时
        FROM 生产任务
        WHERE 项目编号 = @projectCode
        `,
        { projectCode }
      )
      const currentHours = currentRows[0] || {}
      const mergedHours = { ...currentHours }
      hourFields.forEach((field) => {
        if (Object.prototype.hasOwnProperty.call(data, field)) {
          mergedHours[field] = data[field]
        }
      })
      data.合计工时 = computeTotalHours(mergedHours)
    }

    // 构建动态更新字段
    const updates = []
    const params = { projectCode }

    // 生产任务表的字段列表
    const allowedFields = [
      '负责人',
      '开始日期',
      '结束日期',
      '生产状态',
      '优先级',
      '投产数量',
      '已完成数量',
      '电极加工工时',
      '下达日期',
      '放电工时',
      '检验工时',
      '编程工时',
      '试模工时',
      '抛光工时',
      '机加工时',
      '装配工时',
      '加工中心工时',
      '线切割工时',
      '合计工时'
    ]

    Object.keys(data).forEach((key) => {
      const value = data[key]
      // 只更新允许的字段，排除只读字段和 undefined
      // 保留显式传入的 null，用于将字段置为 NULL（支持清空日期/数值等）
      if (allowedFields.includes(key) && value !== undefined) {
        updates.push(`[${key}] = @${key}`)
        params[key] = value === undefined ? null : value
      }
    })

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请至少提供一个要更新的字段'
      })
    }

    const queryString = `
      UPDATE 生产任务 
      SET ${updates.join(', ')}
      WHERE 项目编号 = @projectCode
    `

    await query(queryString, params)

    res.json({
      code: 0,
      success: true,
      message: '更新生产任务成功'
    })
  } catch (error) {
    console.error('更新生产任务失败:', error)
    res.status(500).json({
      success: false,
      message: '更新生产任务失败',
      error: error.message
    })
  }
})

// 删除生产任务（使用 query 参数）
router.delete('/delete', async (req, res) => {
  try {
    const { projectCode } = req.query

    if (!projectCode) {
      return res.status(400).json({
        success: false,
        message: '项目编号不能为空'
      })
    }

    const queryString = `DELETE FROM 生产任务 WHERE 项目编号 = @projectCode`

    await query(queryString, { projectCode })

    res.json({
      code: 0,
      success: true,
      message: '删除生产任务成功'
    })
  } catch (error) {
    console.error('删除生产任务失败:', error)
    res.status(500).json({
      success: false,
      message: '删除生产任务失败',
      error: error.message
    })
  }
})

module.exports = router
