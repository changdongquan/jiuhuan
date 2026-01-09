const express = require('express')
const sql = require('mssql')
const { getPool, query } = require('../database')
const path = require('path')
const fs = require('fs')
const fsp = fs.promises
const multer = require('multer')

const router = express.Router()

let tablesReady = false
let attachmentsTableReady = false

// 出库单附件存储配置（与生产任务/项目管理使用同一根目录）
// 生产环境建议通过环境变量显式设置 JIUHUAN_FILES_ROOT=/mnt/jiuhuan-files（兼容旧变量 SALES_ORDER_FILES_ROOT）
// 本地开发环境则默认使用 backend/uploads 目录
const FILE_ROOT =
  process.env.JIUHUAN_FILES_ROOT ||
  process.env.SALES_ORDER_FILES_ROOT ||
  path.resolve(__dirname, '../uploads')
const OUTBOUND_SUBDIR = process.env.OUTBOUND_DOCUMENT_FILES_SUBDIR || 'outbound-documents'
const MAX_ATTACHMENT_SIZE_BYTES = parseInt(
  process.env.OUTBOUND_DOCUMENT_ATTACHMENT_MAX_SIZE || String(200 * 1024 * 1024),
  10
)

// 确保客户收货地址表存在
const ensureDeliveryAddressTable = async () => {
  const createSql = `
    IF OBJECT_ID(N'客户收货地址', N'U') IS NULL
    BEGIN
      CREATE TABLE 客户收货地址 (
        收货地址ID INT IDENTITY(1,1) PRIMARY KEY,
        客户ID INT NOT NULL,
        收货方名称 NVARCHAR(200) NOT NULL,
        收货方简称 NVARCHAR(100) NULL,
        收货地址 NVARCHAR(500) NOT NULL,
        邮政编码 NVARCHAR(20) NULL,
        所在地区 NVARCHAR(100) NULL,
        所在城市 NVARCHAR(100) NULL,
        所在省份 NVARCHAR(100) NULL,
        所在国家 NVARCHAR(100) NULL DEFAULT '中国',
        联系人 NVARCHAR(100) NULL,
        联系电话 NVARCHAR(50) NULL,
        联系手机 NVARCHAR(20) NULL,
        电子邮箱 NVARCHAR(100) NULL,
        地址用途 NVARCHAR(50) NOT NULL DEFAULT 'SHIP_TO',
        是否默认 BIT NOT NULL DEFAULT 0,
        排序号 INT NOT NULL DEFAULT 0,
        是否启用 BIT NOT NULL DEFAULT 1,
        备注 NVARCHAR(500) NULL,
        创建时间 DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        更新时间 DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        创建人 NVARCHAR(100) NULL,
        更新人 NVARCHAR(100) NULL,
        CONSTRAINT FK_客户收货地址_客户ID 
          FOREIGN KEY (客户ID) REFERENCES 客户信息(客户ID)
          ON DELETE CASCADE
      )

      CREATE INDEX IX_客户收货地址_客户ID ON 客户收货地址(客户ID)
      CREATE INDEX IX_客户收货地址_是否默认 ON 客户收货地址(客户ID, 是否默认)
      CREATE INDEX IX_客户收货地址_地址用途 ON 客户收货地址(客户ID, 地址用途)
      CREATE INDEX IX_客户收货地址_排序号 ON 客户收货地址(客户ID, 排序号)
    END
  `
  await query(createSql)
}

const ensureTables = async () => {
  if (tablesReady) return

  // 先确保客户收货地址表存在
  await ensureDeliveryAddressTable()

  const createSql = `
    IF OBJECT_ID(N'出库单明细', N'U') IS NULL
    BEGIN
      CREATE TABLE 出库单明细 (
        id INT IDENTITY(1,1) PRIMARY KEY,
        出库单号 NVARCHAR(50) NOT NULL,
        出库日期 DATE NULL,
        客户ID INT NULL,
        客户名称 NVARCHAR(200) NULL,
        项目编号 NVARCHAR(100) NULL,
        产品名称 NVARCHAR(200) NULL,
        产品图号 NVARCHAR(200) NULL,
        客户模号 NVARCHAR(200) NULL,
        出库数量 DECIMAL(18,2) NULL,
        单位 NVARCHAR(50) NULL,
        单价 DECIMAL(18,2) NULL,
        金额 DECIMAL(18,2) NULL,
        出库类型 NVARCHAR(50) NULL,
        仓库 NVARCHAR(50) NULL,
        经办人 NVARCHAR(100) NULL,
        审核人 NVARCHAR(100) NULL,
        审核状态 NVARCHAR(50) NULL,
        备注 NVARCHAR(500) NULL,
        创建人 NVARCHAR(100) NULL,
        更新人 NVARCHAR(100) NULL,
        创建时间 DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        更新时间 DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
      )

      CREATE INDEX IX_出库单明细_出库单号 ON 出库单明细(出库单号)
      CREATE INDEX IX_出库单明细_客户ID ON 出库单明细(客户ID)
    END
  `

  await query(createSql)

  // 检查并添加收货地址相关字段（如果表已存在但字段不存在）
  const alterSql = `
    IF OBJECT_ID(N'出库单明细', N'U') IS NOT NULL
    BEGIN
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'出库单明细') AND name = '收货地址ID')
      BEGIN
        ALTER TABLE 出库单明细 
        ADD 收货地址ID INT NULL,
            收货方名称 NVARCHAR(200) NULL,
            收货地址 NVARCHAR(500) NULL,
            收货联系人 NVARCHAR(100) NULL,
            收货联系电话 NVARCHAR(50) NULL,
            地址用途 NVARCHAR(50) NULL DEFAULT 'SHIP_TO'
        
        CREATE INDEX IX_出库单明细_收货地址ID ON 出库单明细(收货地址ID)
        CREATE INDEX IX_出库单明细_收货方名称 ON 出库单明细(收货方名称)
      END
    END
  `
  await query(alterSql)

  tablesReady = true
}

const ensureAttachmentsTable = async () => {
  if (attachmentsTableReady) return

  const createSql = `
    IF OBJECT_ID(N'出库单附件', N'U') IS NULL
    BEGIN
      CREATE TABLE 出库单附件 (
        附件ID INT IDENTITY(1,1) PRIMARY KEY,
        出库单号 NVARCHAR(50) NOT NULL,
        项目编号 NVARCHAR(100) NOT NULL,
        原始文件名 NVARCHAR(260) NOT NULL,
        存储文件名 NVARCHAR(260) NOT NULL,
        相对路径 NVARCHAR(400) NOT NULL,
        文件大小 BIGINT NULL,
        内容类型 NVARCHAR(100) NULL,
        上传时间 DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        上传人 NVARCHAR(100) NULL
      )

      CREATE INDEX IX_出库单附件_出库单号 ON 出库单附件(出库单号)
      CREATE INDEX IX_出库单附件_项目编号 ON 出库单附件(项目编号)
    END
  `

  await query(createSql)
  attachmentsTableReady = true
}

// 处理上传文件名中的中文乱码（multipart 默认按 latin1 解码）
const normalizeAttachmentFileName = (name) => {
  if (!name) return name
  try {
    return Buffer.from(name, 'latin1').toString('utf8')
  } catch {
    return name
  }
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

// 安全化项目编号，用于路径
const safeProjectCodeForPath = (projectCode) => {
  if (!projectCode) return 'UNKNOWN'
  return String(projectCode)
    .trim()
    .replace(/[/\\?%*:|"<>]/g, '_')
}

// 安全化文件名
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

const getFileFullPath = (relativePath, storedFileName) =>
  path.join(FILE_ROOT, String(relativePath || ''), String(storedFileName || ''))

const attachmentStorage = multer.diskStorage({
  destination(req, _file, cb) {
    try {
      const tempRelativeDir = path.posix.join(
        '_temp',
        OUTBOUND_SUBDIR,
        String(Date.now()),
        String(Math.random().toString(36).slice(2, 8))
      )
      const fullDir = path.join(FILE_ROOT, tempRelativeDir)
      ensureDirSync(fullDir)

      req._tempAttachmentDir = tempRelativeDir
      req._tempAttachmentFullDir = fullDir

      cb(null, fullDir)
    } catch (err) {
      cb(err)
    }
  },
  filename(req, file, cb) {
    try {
      const timestamp = Date.now()
      const randomPart = Math.random().toString(36).slice(2, 8)
      const decodedName = normalizeAttachmentFileName(file.originalname)
      const safeOriginalName = safeFileName(decodedName)
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
  limits: { fileSize: MAX_ATTACHMENT_SIZE_BYTES }
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

const bindParams = (request, params) => {
  Object.keys(params).forEach((key) => {
    const value = params[key]
    if (value === null || value === undefined) {
      request.input(key, sql.NVarChar, null)
    } else if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        request.input(key, sql.Int, value)
      } else {
        request.input(key, sql.Float, value)
      }
    } else if (typeof value === 'boolean') {
      request.input(key, sql.Bit, value)
    } else if (value instanceof Date) {
      request.input(key, sql.DateTime2, value)
    } else {
      request.input(key, sql.NVarChar, value)
    }
  })
}

// 出库数量：业务上要求为正整数（保存即生效）
const toPositiveIntOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null
  const num = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(num) || !Number.isInteger(num) || num <= 0) return null
  return num
}

const toNonNegativeIntOrZero = (value) => {
  if (value === null || value === undefined || value === '') return 0
  const num = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(num) || !Number.isInteger(num) || num < 0) return 0
  return num
}

const normalizeDetailsFromBody = (body) => {
  const list = Array.isArray(body?.details) ? body.details : [body]
  return list
    .map((d) => ({
      项目编号: String(d?.项目编号 || body?.项目编号 || '').trim(),
      产品名称: d?.产品名称 ?? body?.产品名称 ?? null,
      产品图号: d?.产品图号 ?? body?.产品图号 ?? null,
      客户模号: d?.客户模号 ?? body?.客户模号 ?? null,
      出库数量: d?.出库数量 ?? body?.出库数量 ?? null,
      备注: d?.备注 ?? body?.备注 ?? null
    }))
    .filter((d) => d.项目编号)
}

const sumDocQuantityByProject = (details) => {
  const map = new Map()
  for (const d of details) {
    const code = String(d.项目编号 || '').trim()
    if (!code) continue
    map.set(code, (map.get(code) || 0) + toNonNegativeIntOrZero(d.出库数量))
  }
  return map
}

const getProductionTaskSnapshot = async (tx, projectCode) => {
  const req = new sql.Request(tx)
  req.input('projectCode', sql.NVarChar, projectCode)
  const res = await req.query(`
    SELECT TOP 1
      生产状态,
      已完成数量
    FROM 生产任务 WITH (UPDLOCK, HOLDLOCK)
    WHERE 项目编号 = @projectCode
  `)
  return res.recordset?.[0] || null
}

const getShippedQuantity = async (tx, projectCode, excludeDocumentNo) => {
  const req = new sql.Request(tx)
  req.input('projectCode', sql.NVarChar, projectCode)
  if (excludeDocumentNo) req.input('excludeDocumentNo', sql.NVarChar, excludeDocumentNo)
  const sqlText = excludeDocumentNo
    ? `
      SELECT SUM(ISNULL(出库数量, 0)) as shipped
      FROM 出库单明细 WITH (UPDLOCK, HOLDLOCK)
      WHERE 项目编号 = @projectCode AND 出库单号 <> @excludeDocumentNo
    `
    : `
      SELECT SUM(ISNULL(出库数量, 0)) as shipped
      FROM 出库单明细 WITH (UPDLOCK, HOLDLOCK)
      WHERE 项目编号 = @projectCode
    `
  const res = await req.query(sqlText)
  return res.recordset?.[0]?.shipped ?? 0
}

const updateProjectMoveState = async (tx, projectCode, nextStatus, moveDate) => {
  const req = new sql.Request(tx)
  req.input('projectCode', sql.NVarChar, projectCode)
  req.input('status', sql.NVarChar, nextStatus)
  req.input('moveDate', sql.NVarChar, moveDate || null)
  await req.query(`
    UPDATE 项目管理
    SET
      项目状态 = @status,
      移模日期 = CASE
        WHEN @status = N'已经移模' THEN COALESCE(@moveDate, 移模日期)
        ELSE NULL
      END
    WHERE 项目编号 = @projectCode
  `)
}

// === 可出货存货选择（按 “生产任务已完成数量 - 已出货数量” 计算剩余） ===
router.get('/inventory', async (req, res) => {
  try {
    await ensureTables()

    const {
      customerId = '',
      keyword = '',
      page = 1,
      pageSize = 1000,
      sortOrder = 'desc'
    } = req.query

    const pageNum = Math.max(parseInt(page, 10) || 1, 1)
    const sizeNum = Math.max(parseInt(pageSize, 10) || 1000, 1)
    const offset = (pageNum - 1) * sizeNum

    const params = {}
    const where = [`pt.已完成数量 IS NOT NULL`, `pt.已完成数量 > 0`]

    if (customerId) {
      where.push(`p.客户ID = @customerId`)
      params.customerId = Number(customerId)
    }

    if (keyword) {
      where.push(`(
        p.项目编号 LIKE @kw
        OR p.客户模号 LIKE @kw
        OR c.客户名称 LIKE @kw
        OR g_pick.产品名称 LIKE @kw
        OR g_pick.产品图号 LIKE @kw
      )`)
      params.kw = `%${keyword}%`
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const orderDir = String(sortOrder).toLowerCase() === 'asc' ? 'ASC' : 'DESC'

    // 说明：
    // - 货物信息可能同项目编号多条记录，这里用 OUTER APPLY 取一条（优先排除 IsNew=1）
    // - 已出货数量从 出库单明细 汇总（保存即生效，无审核区分）
    // - 剩余可出货 > 0 才返回
    const baseSql = `
      SELECT
        p.项目编号,
        p.客户ID,
        c.客户名称,
        p.客户模号,
        g_pick.产品名称,
        g_pick.产品图号,
        pt.已完成数量 as 已完成数量,
        ISNULL(od_sum.已出货数量, 0) as 已出货数量,
        (pt.已完成数量 - ISNULL(od_sum.已出货数量, 0)) as 剩余可出货
      FROM 项目管理 p
      INNER JOIN 生产任务 pt ON pt.项目编号 = p.项目编号
      LEFT JOIN 客户信息 c ON p.客户ID = c.客户ID
      OUTER APPLY (
        SELECT TOP 1
          g.产品名称,
          g.产品图号
        FROM 货物信息 g
        WHERE g.项目编号 = p.项目编号
        ORDER BY
          CASE WHEN CAST(ISNULL(g.IsNew, 0) AS INT) = 1 THEN 1 ELSE 0 END ASC,
          g.货物ID DESC
      ) g_pick
      OUTER APPLY (
        SELECT SUM(ISNULL(出库数量, 0)) as 已出货数量
        FROM 出库单明细 od
        WHERE od.项目编号 = p.项目编号
      ) od_sum
      ${whereSql}
        AND (pt.已完成数量 - ISNULL(od_sum.已出货数量, 0)) > 0
    `

    const countSql = `SELECT COUNT(1) as total FROM (${baseSql}) t`
    const countRows = await query(countSql, params)
    const total = Number(countRows?.[0]?.total || 0)

    const dataSql = `
      ${baseSql}
      ORDER BY p.项目编号 ${orderDir}
      OFFSET ${offset} ROWS FETCH NEXT ${sizeNum} ROWS ONLY
    `
    const rows = await query(dataSql, params)

    res.json({
      code: 0,
      success: true,
      data: {
        list: rows || [],
        total,
        page: pageNum,
        pageSize: sizeNum
      }
    })
  } catch (error) {
    console.error('获取可出货存货列表失败:', error)
    res.status(500).json({ code: 500, success: false, message: '获取可出货存货列表失败' })
  }
})

router.get('/list', async (req, res) => {
  try {
    await ensureTables()
    const {
      keyword = '',
      outboundType = '',
      sortField = '',
      sortOrder = '',
      page = 1,
      pageSize = 20
    } = req.query

    const pageNum = Math.max(parseInt(page, 10) || 1, 1)
    const sizeNum = Math.max(parseInt(pageSize, 10) || 20, 1)
    const offset = (pageNum - 1) * sizeNum

    const params = {}
    const where = []

    if (keyword) {
      where.push(`(
        od.出库单号 LIKE @kw OR od.客户名称 LIKE @kw OR od.项目编号 LIKE @kw OR od.产品名称 LIKE @kw OR od.产品图号 LIKE @kw OR od.客户模号 LIKE @kw
      )`)
      params.kw = `%${keyword}%`
    }
    if (outboundType) {
      where.push('od.出库类型 = @outboundType')
      params.outboundType = outboundType
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

    const sortMap = {
      出库单号: '出库单号',
      出库日期: '出库日期',
      客户名称: '客户名称',
      出库类型: '出库类型',
      经办人: '经办人',
      创建时间: '创建时间',
      更新时间: '更新时间'
    }
    const safeSortField = sortMap[String(sortField)] || '创建时间'
    const safeSortOrder = String(sortOrder).toLowerCase() === 'asc' ? 'ASC' : 'DESC'

    // 为了仿照“销售订单”的汇总行 + 展开明细效果，这里先查出所有符合条件的明细行，
    // 再按“出库单号”分组、汇总、分页（分页按出库单号分组后的数量计算）。
    const allSql = `
      SELECT
        od.*,
        p.模具穴数,
        p.产品材质,
        p.模具尺寸,
        p.模具重量,
        p.流道类型,
        p.流道数量
      FROM 出库单明细 od
      LEFT JOIN 项目管理 p ON od.项目编号 = p.项目编号
      ${whereSql}
    `
    const allRows = await query(allSql, params)

    const docMap = new Map()
    for (const row of allRows) {
      const documentNo = row.出库单号
      if (!documentNo) continue
      if (!docMap.has(documentNo)) {
        docMap.set(documentNo, {
          出库单号: row.出库单号,
          出库日期: row.出库日期,
          客户ID: row.客户ID,
          客户名称: row.客户名称,
          出库类型: row.出库类型,
          仓库: row.仓库,
          经办人: row.经办人,
          审核人: row.审核人,
          审核状态: row.审核状态,
          备注: row.备注,
          创建人: row.创建人,
          更新人: row.更新人,
          创建时间: row.创建时间,
          更新时间: row.更新时间,
          收货地址ID: row.收货地址ID || null,
          收货方名称: row.收货方名称 || null,
          收货地址: row.收货地址 || null,
          收货联系人: row.收货联系人 || null,
          收货联系电话: row.收货联系电话 || null,
          地址用途: row.地址用途 || null,
          details: [],
          detailCount: 0,
          totalQuantity: 0,
          totalAmount: 0
        })
      }

      const doc = docMap.get(documentNo)
      doc.details.push(row)
      doc.detailCount += 1
      doc.totalQuantity += Number(row.出库数量 || 0)
      doc.totalAmount += Number(row.金额 || 0)
    }

    const toTime = (v) => {
      if (!v) return null
      const d = v instanceof Date ? v : new Date(v)
      const t = d.getTime()
      return Number.isNaN(t) ? null : t
    }

    const compareValues = (a, b) => {
      if (a === b) return 0
      if (a === null || a === undefined) return -1
      if (b === null || b === undefined) return 1

      const ta = toTime(a)
      const tb = toTime(b)
      if (ta !== null && tb !== null) return ta - tb

      if (typeof a === 'number' && typeof b === 'number') return a - b

      return String(a).localeCompare(String(b), 'zh-Hans-CN', { numeric: true })
    }

    let groupedList = Array.from(docMap.values())
    groupedList.sort((a, b) => {
      const delta = compareValues(a[safeSortField], b[safeSortField])
      return safeSortOrder === 'ASC' ? delta : -delta
    })

    const total = groupedList.length
    const list = groupedList.slice(offset, offset + sizeNum)

    res.json({
      code: 0,
      success: true,
      data: {
        list,
        total,
        page: pageNum,
        pageSize: sizeNum
      }
    })
  } catch (error) {
    console.error('获取出库单列表失败:', error)
    res.status(500).json({ code: 500, success: false, message: '获取出库单列表失败' })
  }
})

router.get('/detail', async (req, res) => {
  try {
    await ensureTables()
    const documentNo = String(req.query.documentNo || '').trim()
    if (!documentNo) {
      res.status(400).json({ code: 400, success: false, message: 'documentNo 不能为空' })
      return
    }

    const rows = await query(
      `
        SELECT
          od.*,
          p.模具穴数,
          p.产品材质,
          p.模具尺寸,
          p.模具重量,
          p.流道类型,
          p.流道数量
        FROM 出库单明细 od
        LEFT JOIN 项目管理 p ON od.项目编号 = p.项目编号
        WHERE od.出库单号 = @documentNo
        ORDER BY od.id ASC
      `,
      { documentNo }
    )
    const header = rows[0] || null
    res.json({ code: 0, success: true, data: header ? { ...header, details: rows } : null })
  } catch (error) {
    console.error('获取出库单详情失败:', error)
    res.status(500).json({ code: 500, success: false, message: '获取出库单详情失败' })
  }
})

// === 出库单附件相关接口（按 出库单号 + 项目编号 归档） ===

// 上传附件
router.post(
  '/:documentNo/items/:itemCode/attachments',
  uploadSingleAttachment,
  async (req, res) => {
    try {
      await ensureTables()
      await ensureAttachmentsTable()

      const documentNo = String(req.params.documentNo || '').trim()
      const itemCode = String(req.params.itemCode || '').trim()
      if (!documentNo) {
        return res.status(400).json({ code: 400, success: false, message: 'documentNo 不能为空' })
      }
      if (!itemCode) {
        return res.status(400).json({ code: 400, success: false, message: '项目编号不能为空' })
      }

      const existed = await query(
        `SELECT TOP 1 1 as ok FROM 出库单明细 WHERE 出库单号 = @documentNo AND 项目编号 = @itemCode`,
        { documentNo, itemCode }
      )
      if (!existed.length) {
        return res.status(404).json({ code: 404, success: false, message: '未找到对应出库单明细' })
      }

      const file = req.file
      if (!file) {
        return res.status(400).json({ code: 400, success: false, message: '未找到上传文件' })
      }

      const category = getCategoryFromProjectCode(itemCode)
      const safeProjectCode = safeProjectCodeForPath(itemCode)
      const safeDocumentNo = safeFileName(documentNo)

      // 计算最终存储路径：{分类}/{项目编号}/出库单/{出库单号}/
      const finalRelativeDir = path.posix.join(category, safeProjectCode, '出库单', safeDocumentNo)
      const finalFullDir = path.join(FILE_ROOT, finalRelativeDir)
      ensureDirSync(finalFullDir)

      const originalName = normalizeAttachmentFileName(file.originalname)
      const finalStoredFileName = safeFileName(req._attachmentStoredFileName || originalName)
      const fromPath = path.join(req._tempAttachmentFullDir, file.filename)
      const toPath = path.join(finalFullDir, finalStoredFileName)

      await moveFileWithFallback(fromPath, toPath)

      const inserted = await query(
        `
      INSERT INTO 出库单附件 (
        出库单号, 项目编号, 原始文件名, 存储文件名, 相对路径,
        文件大小, 内容类型, 上传人
      )
      OUTPUT INSERTED.附件ID as id, INSERTED.上传时间 as uploadedAt
      VALUES (
        @documentNo, @itemCode, @originalName, @storedFileName, @relativePath,
        @fileSize, @contentType, @uploadedBy
      )
    `,
        {
          documentNo,
          itemCode,
          originalName,
          storedFileName: finalStoredFileName,
          relativePath: finalRelativeDir,
          fileSize: file.size,
          contentType: file.mimetype || null,
          uploadedBy: null
        }
      )

      res.json({
        code: 0,
        success: true,
        message: '上传附件成功',
        data: {
          id: inserted?.[0]?.id,
          documentNo,
          itemCode,
          originalName,
          storedFileName: finalStoredFileName,
          relativePath: finalRelativeDir,
          fileSize: file.size,
          contentType: file.mimetype || null,
          uploadedAt: inserted?.[0]?.uploadedAt
        }
      })
    } catch (error) {
      console.error('上传出库单附件失败:', error)
      res.status(500).json({ code: 500, success: false, message: '上传出库单附件失败' })
    }
  }
)

// 获取某出库单某项目编号的附件列表
router.get('/:documentNo/items/:itemCode/attachments', async (req, res) => {
  try {
    await ensureAttachmentsTable()
    const documentNo = String(req.params.documentNo || '').trim()
    const itemCode = String(req.params.itemCode || '').trim()
    if (!documentNo) {
      return res.status(400).json({ code: 400, success: false, message: 'documentNo 不能为空' })
    }
    if (!itemCode) {
      return res.status(400).json({ code: 400, success: false, message: '项目编号不能为空' })
    }

    const rows = await query(
      `
      SELECT
        附件ID as id,
        出库单号 as documentNo,
        项目编号 as itemCode,
        原始文件名 as originalName,
        存储文件名 as storedFileName,
        相对路径 as relativePath,
        文件大小 as fileSize,
        内容类型 as contentType,
        上传时间 as uploadedAt,
        上传人 as uploadedBy
      FROM 出库单附件
      WHERE 出库单号 = @documentNo AND 项目编号 = @itemCode
      ORDER BY 上传时间 DESC, 附件ID DESC
    `,
      { documentNo, itemCode }
    )

    res.json({ code: 0, success: true, data: rows })
  } catch (error) {
    console.error('获取出库单附件列表失败:', error)
    res.status(500).json({ code: 500, success: false, message: '获取出库单附件列表失败' })
  }
})

// 获取某出库单下各项目编号的附件数量汇总（用于表格/查看弹窗展示“查看附件（n）”）
router.get('/:documentNo/attachments/summary', async (req, res) => {
  try {
    await ensureAttachmentsTable()
    const documentNo = String(req.params.documentNo || '').trim()
    if (!documentNo) {
      return res.status(400).json({ code: 400, success: false, message: 'documentNo 不能为空' })
    }

    const rows = await query(
      `
      SELECT
        项目编号 as itemCode,
        COUNT(1) as attachmentCount
      FROM 出库单附件
      WHERE 出库单号 = @documentNo
      GROUP BY 项目编号
    `,
      { documentNo }
    )

    res.json({ code: 0, success: true, data: rows })
  } catch (error) {
    console.error('获取出库单附件数量汇总失败:', error)
    res.status(500).json({ code: 500, success: false, message: '获取出库单附件数量汇总失败' })
  }
})

// 下载附件
router.get('/attachments/:attachmentId/download', async (req, res) => {
  try {
    await ensureAttachmentsTable()
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
      FROM 出库单附件
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
    console.error('下载出库单附件失败:', error)
    res.status(500).json({ code: 500, success: false, message: '下载出库单附件失败' })
  }
})

// 删除附件
router.delete('/attachments/:attachmentId', async (req, res) => {
  try {
    await ensureAttachmentsTable()
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
      FROM 出库单附件
      WHERE 附件ID = @attachmentId
    `,
      { attachmentId }
    )
    if (!rows.length) {
      return res.status(404).json({ code: 404, success: false, message: '附件不存在' })
    }

    const att = rows[0]
    const fullPath = getFileFullPath(att.relativePath, att.storedFileName)

    await query(`DELETE FROM 出库单附件 WHERE 附件ID = @attachmentId`, { attachmentId })

    try {
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath)
      }
    } catch (fileErr) {
      console.warn('删除附件文件失败（已删除数据库记录）:', fileErr)
    }

    res.json({ code: 0, success: true, message: '删除成功' })
  } catch (error) {
    console.error('删除出库单附件失败:', error)
    res.status(500).json({ code: 500, success: false, message: '删除出库单附件失败' })
  }
})

router.post('/', async (req, res) => {
  try {
    await ensureTables()
    const body = req.body || {}
    const documentNo = String(body.出库单号 || '').trim()
    if (!documentNo) {
      res.status(400).json({ code: 400, success: false, message: '出库单号不能为空' })
      return
    }

    const outboundDate = String(body.出库日期 || '').trim()
    if (!outboundDate) {
      res.status(400).json({ code: 400, success: false, message: '出库日期不能为空' })
      return
    }

    const details = normalizeDetailsFromBody(body)
    if (!details.length) {
      res.status(400).json({ code: 400, success: false, message: '明细不能为空' })
      return
    }

    for (const d of details) {
      if (!toPositiveIntOrNull(d.出库数量)) {
        res.status(400).json({ code: 400, success: false, message: '出库数量必须为正整数' })
        return
      }
    }

    const pool = await getPool()
    const tx = new sql.Transaction(pool)
    await tx.begin()
    try {
      // 同一出库单号不允许重复创建
      const existsReq = new sql.Request(tx)
      existsReq.input('documentNo', sql.NVarChar, documentNo)
      const existsRes = await existsReq.query(
        `SELECT TOP 1 1 as ok FROM 出库单明细 WHERE 出库单号 = @documentNo`
      )
      if (existsRes.recordset?.length) {
        await tx.rollback()
        res.status(409).json({ code: 409, success: false, message: '出库单号已存在' })
        return
      }

      const qtyByProject = sumDocQuantityByProject(details)

      // 校验：不得超出生产任务已完成数量（保存即生效）
      for (const [projectCode, docQty] of qtyByProject.entries()) {
        const code = String(projectCode || '').trim()
        if (!code) continue

        const task = await getProductionTaskSnapshot(tx, code)
        if (!task) {
          await tx.rollback()
          res.status(400).json({ code: 400, success: false, message: `未找到生产任务：${code}` })
          return
        }
        const completedQty = toPositiveIntOrNull(task.已完成数量)
        if (!completedQty) {
          await tx.rollback()
          res.status(400).json({
            code: 400,
            success: false,
            message: `生产任务已完成数量无效（必须为正整数）：${code}`
          })
          return
        }

        const shippedRaw = await getShippedQuantity(tx, code)
        const shippedOther = typeof shippedRaw === 'number' ? shippedRaw : Number(shippedRaw || 0)
        if (!Number.isFinite(shippedOther) || !Number.isInteger(shippedOther) || shippedOther < 0) {
          await tx.rollback()
          res.status(409).json({
            code: 409,
            success: false,
            message: `历史出货数据存在非整数数量，无法继续出货：${code}`
          })
          return
        }
        if (shippedOther + docQty > completedQty) {
          await tx.rollback()
          res.status(409).json({
            code: 409,
            success: false,
            message: `出货数量超出已完成数量：${code}（已完成 ${completedQty}，已出货 ${shippedOther}，本次 ${docQty}）`
          })
          return
        }
      }

      // 处理收货地址信息
      let addressInfo = {
        收货地址ID: null,
        收货方名称: null,
        收货地址: null,
        收货联系人: null,
        收货联系电话: null,
        地址用途: 'SHIP_TO'
      }

      // 如果提供了收货地址ID，查询地址信息
      if (body.收货地址ID) {
        const addressReq = new sql.Request(tx)
        addressReq.input('addressId', sql.Int, parseInt(body.收货地址ID))
        addressReq.input('customerId', sql.Int, body.客户ID || null)
        const addressRes = await addressReq.query(`
          SELECT 
            收货地址ID, 收货方名称, 收货地址, 联系人, 联系电话, 地址用途
          FROM 客户收货地址
          WHERE 收货地址ID = @addressId 
            AND 是否启用 = 1
            ${body.客户ID ? 'AND 客户ID = @customerId' : ''}
        `)

        if (addressRes.recordset.length > 0) {
          const addr = addressRes.recordset[0]
          addressInfo = {
            收货地址ID: addr.收货地址ID,
            收货方名称: addr.收货方名称,
            收货地址: addr.收货地址,
            收货联系人: addr.联系人 || null,
            收货联系电话: addr.联系电话 || null,
            地址用途: addr.地址用途 || 'SHIP_TO'
          }
        }
      } else if (body.收货方名称 || body.收货地址) {
        // 手动输入的地址信息
        addressInfo = {
          收货地址ID: null,
          收货方名称: body.收货方名称 || null,
          收货地址: body.收货地址 || null,
          收货联系人: body.收货联系人 || null,
          收货联系电话: body.收货联系电话 || null,
          地址用途: body.地址用途 || 'SHIP_TO'
        }
      }

      for (const d of details) {
        const req1 = new sql.Request(tx)
        const params = {
          出库单号: documentNo,
          出库日期: outboundDate || null,
          客户ID: body.客户ID || null,
          客户名称: body.客户名称 || null,
          项目编号: d.项目编号 || null,
          产品名称: d.产品名称 ?? null,
          产品图号: d.产品图号 ?? null,
          客户模号: d.客户模号 ?? null,
          出库数量: toPositiveIntOrNull(d.出库数量),
          单位: body.单位 || null,
          单价: body.单价 ?? null,
          金额: body.金额 ?? null,
          出库类型: body.出库类型 || null,
          仓库: body.仓库 || null,
          经办人: body.经办人 || null,
          审核人: null,
          审核状态: null,
          备注: d.备注 || body.备注 || null,
          创建人: body.创建人 || null,
          更新人: body.更新人 || null,
          收货地址ID: addressInfo.收货地址ID,
          收货方名称: addressInfo.收货方名称,
          收货地址: addressInfo.收货地址,
          收货联系人: addressInfo.收货联系人,
          收货联系电话: addressInfo.收货联系电话,
          地址用途: addressInfo.地址用途
        }
        bindParams(req1, params)
        await req1.query(`
          INSERT INTO 出库单明细 (
            出库单号, 出库日期, 客户ID, 客户名称,
            项目编号, 产品名称, 产品图号, 客户模号, 出库数量,
            单位, 单价, 金额, 出库类型, 仓库,
            经办人, 审核人, 审核状态, 备注, 创建人, 更新人,
            收货地址ID, 收货方名称, 收货地址, 收货联系人, 收货联系电话, 地址用途
          ) VALUES (
            @出库单号, @出库日期, @客户ID, @客户名称,
            @项目编号, @产品名称, @产品图号, @客户模号, @出库数量,
            @单位, @单价, @金额, @出库类型, @仓库,
            @经办人, @审核人, @审核状态, @备注, @创建人, @更新人,
            @收货地址ID, @收货方名称, @收货地址, @收货联系人, @收货联系电话, @地址用途
          )
        `)
      }

      // 同步项目状态与移模日期：
      // - 剩余可出货 = 已完成数量 - 已出货数量
      // - 当剩余变为 0 时：项目状态=已经移模，移模日期=本单出库日期
      // - 当剩余 > 0 时：项目状态=待移模，移模日期=NULL
      for (const [projectCode] of qtyByProject.entries()) {
        const code = String(projectCode || '').trim()
        if (!code) continue
        const task = await getProductionTaskSnapshot(tx, code)
        const completedQty = toPositiveIntOrNull(task?.已完成数量)
        if (!completedQty) continue
        const shippedRaw = await getShippedQuantity(tx, code)
        const shippedAfter = typeof shippedRaw === 'number' ? shippedRaw : Number(shippedRaw || 0)
        if (!Number.isFinite(shippedAfter) || !Number.isInteger(shippedAfter) || shippedAfter < 0)
          continue
        const moved = shippedAfter === completedQty
        await updateProjectMoveState(
          tx,
          code,
          moved ? '已经移模' : '待移模',
          moved ? outboundDate : null
        )
      }

      await tx.commit()
      res.json({ code: 0, success: true, message: '创建成功', data: { documentNo } })
    } catch (e) {
      await tx.rollback()
      throw e
    }
  } catch (error) {
    console.error('创建出库单失败:', error)
    res.status(500).json({ code: 500, success: false, message: '创建出库单失败' })
  }
})

router.put('/update', async (req, res) => {
  try {
    await ensureTables()
    const documentNo = String(req.body?.documentNo || '').trim()
    if (!documentNo) {
      res.status(400).json({ code: 400, success: false, message: 'documentNo 不能为空' })
      return
    }

    const data = req.body || {}
    const details = Array.isArray(data.details) ? data.details : null
    const outboundDate = String(data.出库日期 || '').trim()

    // 若传入明细：按出库单号整体重写（删除旧明细，插入新明细）
    if (details && details.length) {
      if (!outboundDate) {
        res.status(400).json({ code: 400, success: false, message: '出库日期不能为空' })
        return
      }

      const normalizedDetails = normalizeDetailsFromBody(data)
      if (!normalizedDetails.length) {
        res.status(400).json({ code: 400, success: false, message: '明细不能为空' })
        return
      }
      for (const d of normalizedDetails) {
        if (!toPositiveIntOrNull(d.出库数量)) {
          res.status(400).json({ code: 400, success: false, message: '出库数量必须为正整数' })
          return
        }
      }

      const pool = await getPool()
      const tx = new sql.Transaction(pool)
      await tx.begin()
      try {
        const oldProjectsReq = new sql.Request(tx)
        oldProjectsReq.input('documentNo', sql.NVarChar, documentNo)
        const oldProjectsRes = await oldProjectsReq.query(
          `SELECT DISTINCT 项目编号 FROM 出库单明细 WITH (UPDLOCK, HOLDLOCK) WHERE 出库单号 = @documentNo`
        )
        const oldProjects = new Set(
          (oldProjectsRes.recordset || [])
            .map((r) => String(r.项目编号 || '').trim())
            .filter((x) => x.length > 0)
        )

        const headerReq = new sql.Request(tx)
        headerReq.input('documentNo', sql.NVarChar, documentNo)
        const headerRes = await headerReq.query(
          `SELECT TOP 1 * FROM 出库单明细 WHERE 出库单号 = @documentNo ORDER BY id ASC`
        )
        const header = headerRes.recordset?.[0]
        if (!header) {
          await tx.rollback()
          res.status(404).json({ code: 404, success: false, message: '出库单不存在' })
          return
        }

        // 处理收货地址信息
        let addressInfo = {
          收货地址ID: null,
          收货方名称: null,
          收货地址: null,
          收货联系人: null,
          收货联系电话: null,
          地址用途: 'SHIP_TO'
        }

        // 如果提供了收货地址ID，查询地址信息
        if (data.收货地址ID !== undefined) {
          if (data.收货地址ID) {
            const addressReq = new sql.Request(tx)
            addressReq.input('addressId', sql.Int, parseInt(data.收货地址ID))
            addressReq.input('customerId', sql.Int, data.客户ID ?? header.客户ID ?? null)
            const addressRes = await addressReq.query(`
              SELECT 
                收货地址ID, 收货方名称, 收货地址, 联系人, 联系电话, 地址用途
              FROM 客户收货地址
              WHERE 收货地址ID = @addressId 
                AND 是否启用 = 1
                ${data.客户ID || header.客户ID ? 'AND 客户ID = @customerId' : ''}
            `)

            if (addressRes.recordset.length > 0) {
              const addr = addressRes.recordset[0]
              addressInfo = {
                收货地址ID: addr.收货地址ID,
                收货方名称: addr.收货方名称,
                收货地址: addr.收货地址,
                收货联系人: addr.联系人 || null,
                收货联系电话: addr.联系电话 || null,
                地址用途: addr.地址用途 || 'SHIP_TO'
              }
            }
          } else {
            // 收货地址ID为null，清空地址信息
            addressInfo = {
              收货地址ID: null,
              收货方名称: null,
              收货地址: null,
              收货联系人: null,
              收货联系电话: null,
              地址用途: 'SHIP_TO'
            }
          }
        } else if (data.收货方名称 !== undefined || data.收货地址 !== undefined) {
          // 手动输入的地址信息
          addressInfo = {
            收货地址ID: null,
            收货方名称: data.收货方名称 ?? null,
            收货地址: data.收货地址 ?? null,
            收货联系人: data.收货联系人 ?? null,
            收货联系电话: data.收货联系电话 ?? null,
            地址用途: data.地址用途 || 'SHIP_TO'
          }
        } else {
          // 使用原有地址信息
          addressInfo = {
            收货地址ID: header.收货地址ID ?? null,
            收货方名称: header.收货方名称 ?? null,
            收货地址: header.收货地址 ?? null,
            收货联系人: header.收货联系人 ?? null,
            收货联系电话: header.收货联系电话 ?? null,
            地址用途: header.地址用途 || 'SHIP_TO'
          }
        }

        const headerFields = {
          出库日期: outboundDate ?? header.出库日期 ?? null,
          客户ID: data.客户ID ?? header.客户ID ?? null,
          客户名称: data.客户名称 ?? header.客户名称 ?? null,
          出库类型: data.出库类型 ?? header.出库类型 ?? null,
          仓库: data.仓库 ?? header.仓库 ?? null,
          经办人: data.经办人 ?? header.经办人 ?? null,
          审核人: null,
          审核状态: null,
          备注: data.备注 ?? header.备注 ?? null,
          更新人: data.更新人 ?? header.更新人 ?? null,
          创建人: header.创建人 ?? null,
          创建时间: header.创建时间 ?? null,
          收货地址ID: addressInfo.收货地址ID,
          收货方名称: addressInfo.收货方名称,
          收货地址: addressInfo.收货地址,
          收货联系人: addressInfo.收货联系人,
          收货联系电话: addressInfo.收货联系电话,
          地址用途: addressInfo.地址用途
        }

        const newQtyByProject = sumDocQuantityByProject(normalizedDetails)
        const affectedProjects = new Set([...oldProjects, ...newQtyByProject.keys()])

        // 校验：不得超出生产任务已完成数量
        for (const projectCode of affectedProjects) {
          const code = String(projectCode || '').trim()
          if (!code) continue
          const newDocQty = newQtyByProject.get(code) || 0
          if (!newDocQty) continue

          const task = await getProductionTaskSnapshot(tx, code)
          if (!task) {
            await tx.rollback()
            res.status(400).json({ code: 400, success: false, message: `未找到生产任务：${code}` })
            return
          }
          const completedQty = toPositiveIntOrNull(task.已完成数量)
          if (!completedQty) {
            await tx.rollback()
            res.status(400).json({
              code: 400,
              success: false,
              message: `生产任务已完成数量无效（必须为正整数）：${code}`
            })
            return
          }

          const shippedRaw = await getShippedQuantity(tx, code, documentNo)
          const shippedOther = typeof shippedRaw === 'number' ? shippedRaw : Number(shippedRaw || 0)
          if (
            !Number.isFinite(shippedOther) ||
            !Number.isInteger(shippedOther) ||
            shippedOther < 0
          ) {
            await tx.rollback()
            res.status(409).json({
              code: 409,
              success: false,
              message: `历史出货数据存在非整数数量，无法继续出货：${code}`
            })
            return
          }
          if (shippedOther + newDocQty > completedQty) {
            await tx.rollback()
            res.status(409).json({
              code: 409,
              success: false,
              message: `出货数量超出已完成数量：${code}（已完成 ${completedQty}，已出货 ${shippedOther}，本单 ${newDocQty}）`
            })
            return
          }
        }

        const delReq = new sql.Request(tx)
        delReq.input('documentNo', sql.NVarChar, documentNo)
        await delReq.query(`DELETE FROM 出库单明细 WHERE 出库单号 = @documentNo`)

        for (const d of normalizedDetails) {
          const insReq = new sql.Request(tx)
          const params = {
            出库单号: documentNo,
            出库日期: headerFields.出库日期,
            客户ID: headerFields.客户ID,
            客户名称: headerFields.客户名称,
            项目编号: d?.项目编号 ?? null,
            产品名称: d?.产品名称 ?? null,
            产品图号: d?.产品图号 ?? null,
            客户模号: d?.客户模号 ?? null,
            出库数量: toPositiveIntOrNull(d?.出库数量),
            单位: d?.单位 ?? null,
            单价: d?.单价 ?? null,
            金额: d?.金额 ?? null,
            出库类型: headerFields.出库类型,
            仓库: headerFields.仓库,
            经办人: headerFields.经办人,
            审核人: null,
            审核状态: null,
            备注: d?.备注 ?? headerFields.备注 ?? null,
            创建人: headerFields.创建人,
            更新人: headerFields.更新人,
            创建时间: headerFields.创建时间,
            更新时间: new Date(),
            收货地址ID: headerFields.收货地址ID,
            收货方名称: headerFields.收货方名称,
            收货地址: headerFields.收货地址,
            收货联系人: headerFields.收货联系人,
            收货联系电话: headerFields.收货联系电话,
            地址用途: headerFields.地址用途
          }
          bindParams(insReq, params)
          await insReq.query(`
            INSERT INTO 出库单明细 (
              出库单号, 出库日期, 客户ID, 客户名称,
              项目编号, 产品名称, 产品图号, 客户模号, 出库数量,
              单位, 单价, 金额, 出库类型, 仓库,
              经办人, 审核人, 审核状态, 备注, 创建人, 更新人,
              创建时间, 更新时间,
              收货地址ID, 收货方名称, 收货地址, 收货联系人, 收货联系电话, 地址用途
            ) VALUES (
              @出库单号, @出库日期, @客户ID, @客户名称,
              @项目编号, @产品名称, @产品图号, @客户模号, @出库数量,
              @单位, @单价, @金额, @出库类型, @仓库,
              @经办人, @审核人, @审核状态, @备注, @创建人, @更新人,
              @创建时间, @更新时间,
              @收货地址ID, @收货方名称, @收货地址, @收货联系人, @收货联系电话, @地址用途
            )
	          `)
        }

        // 同步项目状态与移模日期（受影响项目：旧明细 + 新明细）
        for (const projectCode of affectedProjects) {
          const code = String(projectCode || '').trim()
          if (!code) continue
          const task = await getProductionTaskSnapshot(tx, code)
          const completedQty = toPositiveIntOrNull(task?.已完成数量)
          if (!completedQty) continue
          const shippedRaw = await getShippedQuantity(tx, code)
          const shippedAfter = typeof shippedRaw === 'number' ? shippedRaw : Number(shippedRaw || 0)
          if (!Number.isFinite(shippedAfter) || !Number.isInteger(shippedAfter) || shippedAfter < 0)
            continue
          const moved = shippedAfter === completedQty
          const newDocQty = newQtyByProject.get(code) || 0
          const shouldSetMoveDate = moved && newDocQty > 0
          await updateProjectMoveState(
            tx,
            code,
            moved ? '已经移模' : '待移模',
            shouldSetMoveDate ? outboundDate : null
          )
        }

        await tx.commit()
        res.json({ code: 0, success: true, message: '更新成功' })
        return
      } catch (e) {
        await tx.rollback()
        throw e
      }
    }

    // 未传明细：仅更新头字段（同一出库单号下所有行同步）
    const params = {
      documentNo,
      出库日期: data.出库日期 ?? null,
      客户ID: data.客户ID ?? null,
      客户名称: data.客户名称 ?? null,
      单位: data.单位 ?? null,
      单价: data.单价 ?? null,
      金额: data.金额 ?? null,
      出库类型: data.出库类型 ?? null,
      仓库: data.仓库 ?? null,
      经办人: data.经办人 ?? null,
      备注: data.备注 ?? null,
      更新人: data.更新人 ?? null
    }

    await query(
      `
        UPDATE 出库单明细
        SET
          出库日期 = COALESCE(@出库日期, 出库日期),
          客户ID = COALESCE(@客户ID, 客户ID),
          客户名称 = COALESCE(@客户名称, 客户名称),
          单位 = COALESCE(@单位, 单位),
          单价 = COALESCE(@单价, 单价),
          金额 = COALESCE(@金额, 金额),
	          出库类型 = COALESCE(@出库类型, 出库类型),
	          仓库 = COALESCE(@仓库, 仓库),
	          经办人 = COALESCE(@经办人, 经办人),
	          备注 = COALESCE(@备注, 备注),
	          更新人 = COALESCE(@更新人, 更新人),
	          更新时间 = SYSUTCDATETIME()
	        WHERE 出库单号 = @documentNo
      `,
      params
    )

    res.json({ code: 0, success: true, message: '更新成功' })
  } catch (error) {
    console.error('更新出库单失败:', error)
    res.status(500).json({ code: 500, success: false, message: '更新出库单失败' })
  }
})

router.delete('/delete', async (req, res) => {
  try {
    await ensureTables()
    const documentNo = String(req.query.documentNo || '').trim()
    if (!documentNo) {
      res.status(400).json({ code: 400, success: false, message: 'documentNo 不能为空' })
      return
    }

    const pool = await getPool()
    const tx = new sql.Transaction(pool)
    await tx.begin()
    try {
      const oldProjectsReq = new sql.Request(tx)
      oldProjectsReq.input('documentNo', sql.NVarChar, documentNo)
      const oldProjectsRes = await oldProjectsReq.query(
        `SELECT DISTINCT 项目编号 FROM 出库单明细 WITH (UPDLOCK, HOLDLOCK) WHERE 出库单号 = @documentNo`
      )
      const oldProjects = new Set(
        (oldProjectsRes.recordset || [])
          .map((r) => String(r.项目编号 || '').trim())
          .filter((x) => x.length > 0)
      )

      const delReq = new sql.Request(tx)
      delReq.input('documentNo', sql.NVarChar, documentNo)
      await delReq.query(`DELETE FROM 出库单明细 WHERE 出库单号 = @documentNo`)

      // 同步项目状态（删除不会产生“触发清零”的出库日期，因此不写移模日期，只在需要回退时清空）
      for (const projectCode of oldProjects) {
        const code = String(projectCode || '').trim()
        if (!code) continue
        const task = await getProductionTaskSnapshot(tx, code)
        const completedQty = toPositiveIntOrNull(task?.已完成数量)
        if (!completedQty) continue
        const shippedRaw = await getShippedQuantity(tx, code)
        const shippedAfter = typeof shippedRaw === 'number' ? shippedRaw : Number(shippedRaw || 0)
        if (!Number.isFinite(shippedAfter) || !Number.isInteger(shippedAfter) || shippedAfter < 0)
          continue
        const moved = shippedAfter === completedQty
        await updateProjectMoveState(tx, code, moved ? '已经移模' : '待移模', null)
      }

      await tx.commit()
      res.json({ code: 0, success: true, message: '删除成功' })
    } catch (e) {
      await tx.rollback()
      throw e
    }
  } catch (error) {
    console.error('删除出库单失败:', error)
    res.status(500).json({ code: 500, success: false, message: '删除出库单失败' })
  }
})

router.get('/statistics', async (_req, res) => {
  try {
    await ensureTables()
    const rows = await query(`
      SELECT
        COUNT(DISTINCT 出库单号) as totalDocuments,
        COUNT(1) as totalDetails,
        SUM(ISNULL(出库数量, 0)) as totalQuantity,
        SUM(ISNULL(金额, 0)) as totalAmount
      FROM 出库单明细
    `)
    const s = rows[0] || {}
    res.json({ code: 0, success: true, data: s })
  } catch (error) {
    console.error('获取出库单统计失败:', error)
    res.status(500).json({ code: 500, success: false, message: '获取出库单统计失败' })
  }
})

module.exports = router
