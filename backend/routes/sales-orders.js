const express = require('express')
const path = require('path')
const fs = require('fs')
const multer = require('multer')
const { query, getPool } = require('../database')
const sql = require('mssql')
const router = express.Router()
const fsp = fs.promises

// 销售订单附件存储配置
// 生产环境建议通过环境变量显式设置 JIUHUAN_FILES_ROOT=/mnt/jiuhuan-files（兼容旧变量 SALES_ORDER_FILES_ROOT）
// 本地开发环境则默认使用 backend/uploads 目录，避免没有 /mnt 权限导致上传失败
const FILE_ROOT =
  process.env.JIUHUAN_FILES_ROOT ||
  process.env.SALES_ORDER_FILES_ROOT ||
  path.resolve(__dirname, '../uploads')
const SALES_SUBDIR = process.env.SALES_ORDER_FILES_SUBDIR || 'sales-orders'
const MAX_ATTACHMENT_SIZE_BYTES = parseInt(
  process.env.SALES_ORDER_ATTACHMENT_MAX_SIZE || String(200 * 1024 * 1024),
  10
)

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

// 安全化项目编号，用于路径：将非法路径字符替换为下划线
// 非法字符：/ \ ? % * : | " < >
const safeProjectCodeForPath = (projectCode) => {
  if (!projectCode) return 'UNKNOWN'
  return String(projectCode)
    .trim()
    .replace(/[/\\?%*:|"<>]/g, '_')
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

const toYYYYMMDD = (val) => {
  if (!val) return null
  if (typeof val === 'string') {
    const text = val.trim()
    const match = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(text)
    if (match) {
      return `${match[1]}${String(match[2]).padStart(2, '0')}${String(match[3]).padStart(2, '0')}`
    }
  }
  const d = val instanceof Date ? val : new Date(val)
  if (Number.isNaN(d.getTime())) return null
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

// 注意：新的路径结构为 {项目编号}/销售订单/，不包含订单编号和明细ID
// 因此拆分订单时，路径不需要改变，只需要更新数据库中的订单编号字段
// 此函数保留用于向后兼容，但实际上在新路径结构下不需要使用
const computeAttachmentNewRelativeDir = ({ oldRelativeDir, newOrderNo, detailId }) => {
  // 新路径格式：{项目编号}/销售订单/
  // 如果路径已经是新格式（以 /销售订单 结尾），直接返回原路径
  const rel = String(oldRelativeDir || '').trim()
  if ((rel && rel.endsWith('/销售订单')) || rel.endsWith('销售订单')) {
    return rel
  }

  // 旧格式兼容：如果是旧格式，保持原路径不变（只更新订单编号，不移动文件）
  // 这样可以避免对旧数据的文件操作
  return rel
}

// 使用 multer 将销售订单附件直接写入 NAS
const attachmentStorage = multer.diskStorage({
  destination(req, file, cb) {
    try {
      const { orderNo, detailId } = req.params

      if (!orderNo || !detailId) {
        return cb(new Error('缺少订单编号或明细ID'))
      }

      const numericDetailId = parseInt(detailId, 10)
      if (!Number.isInteger(numericDetailId) || numericDetailId <= 0) {
        return cb(new Error('明细ID不合法'))
      }

      // 注意：destination 在路由处理前执行，此时无法查询数据库获取项目编号
      // 所以先使用临时目录，在路由处理中查询到项目编号后再移动文件到正确位置
      const tempRelativeDir = path.posix.join(
        '_temp',
        SALES_SUBDIR,
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
      const timestamp = Date.now()
      const randomPart = Math.random().toString(36).slice(2, 8)
      const decodedName = normalizeAttachmentFileName(file.originalname)
      const safeOriginalName = decodedName.replace(/[/\\?%*:|"<>]/g, '_')
      const storedFileName = `${timestamp}-${randomPart}-${safeOriginalName}`

      // 记录存储文件名，方便后续插入数据库
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

// 生成新的订单编号
// 格式：XS-YYYYMMDD-XXX
// XS：销售订单前缀
// YYYYMMDD：当前日期（使用东八区时间）
// XXX：三位序列号（同一天内递增，跨天重置为001）
router.get('/generate-order-no', async (req, res) => {
  try {
    const orderPrefix = 'XS'
    // 使用东八区（UTC+8）时间获取当前日期
    // 无论服务器在什么时区，都统一使用东八区时间
    const now = new Date()
    // getTime() 返回的是UTC时间戳（毫秒）
    // 直接加上8小时（东八区偏移）得到东八区时间戳
    const chinaTimestamp = now.getTime() + 8 * 60 * 60 * 1000
    // 创建东八区时间对象
    const chinaTime = new Date(chinaTimestamp)
    // 使用UTC方法获取年月日（因为时间戳已经加上了8小时偏移）
    const year = chinaTime.getUTCFullYear()
    const month = String(chinaTime.getUTCMonth() + 1).padStart(2, '0')
    const day = String(chinaTime.getUTCDate()).padStart(2, '0')
    const orderDate = `${year}${month}${day}` // YYYYMMDD

    // 查询最新的订单编号
    const queryString = `
      SELECT TOP 1 订单编号 as orderNo
      FROM 销售订单
      WHERE 订单编号 LIKE 'XS-%'
      ORDER BY 订单编号 DESC
    `

    const result = await query(queryString)

    let serialNumber = 1

    if (result.length > 0 && result[0].orderNo) {
      const lastOrderNo = result[0].orderNo
      // 解析订单编号：XS-YYYYMMDD-XXX
      const match = lastOrderNo.match(/^XS-(\d{8})-(\d{3})$/)

      if (match) {
        const lastDate = match[1]
        const lastSerial = parseInt(match[2], 10)

        // 如果是同一天，序列号递增；否则重置为1
        if (lastDate === orderDate) {
          serialNumber = lastSerial + 1
        } else {
          serialNumber = 1
        }
      }
    }

    // 格式化序列号为三位数
    const formattedSerial = String(serialNumber).padStart(3, '0')

    // 生成新订单编号：XS-YYYYMMDD-XXX
    const newOrderNo = `${orderPrefix}-${orderDate}-${formattedSerial}`

    res.json({
      code: 0,
      success: true,
      data: { orderNo: newOrderNo }
    })
  } catch (error) {
    console.error('生成订单编号失败:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: '生成订单编号失败',
      error: error.message
    })
  }
})

// 获取销售订单列表
router.get('/list', async (req, res) => {
  try {
    const {
      orderNo,
      customerId,
      customerName,
      itemCode,
      searchText,
      contractNo,
      orderDateStart,
      orderDateEnd,
      category,
      isInStock,
      isShipped,
      page = 1,
      pageSize = 10
    } = req.query

    const params = {}

    // 构建 WHERE 条件，注意所有条件字段都需要使用表别名 so.
    let whereConditionsWithAlias = []

    if (customerId) {
      whereConditionsWithAlias.push('so.客户ID = @customerId')
      params.customerId = parseInt(customerId)
    }

    if (customerName) {
      // 通过客户名称查询，需要关联客户信息表
      whereConditionsWithAlias.push('c.客户名称 LIKE @customerName')
      params.customerName = `%${customerName}%`
    }

    // 综合搜索：支持项目编号、订单编号、客户模号、产品图号、产品名称
    if (searchText) {
      const searchConditions = [
        'so.项目编号 LIKE @searchText',
        'so.订单编号 LIKE @searchText',
        'p.客户模号 LIKE @searchText',
        'g.产品图号 LIKE @searchText',
        'g.产品名称 LIKE @searchText'
      ]
      whereConditionsWithAlias.push(`(${searchConditions.join(' OR ')})`)
      params.searchText = `%${searchText}%`
    } else {
      // 兼容旧的查询方式
      if (orderNo) {
        whereConditionsWithAlias.push('so.订单编号 LIKE @orderNo')
        params.orderNo = `%${orderNo}%`
      }

      if (itemCode) {
        whereConditionsWithAlias.push('so.项目编号 LIKE @itemCode')
        params.itemCode = `%${itemCode}%`
      }
    }

    if (contractNo) {
      whereConditionsWithAlias.push('so.合同号 LIKE @contractNo')
      params.contractNo = `%${contractNo}%`
    }

    if (orderDateStart) {
      whereConditionsWithAlias.push('so.订单日期 >= @orderDateStart')
      params.orderDateStart = orderDateStart
    }

    if (orderDateEnd) {
      whereConditionsWithAlias.push('so.订单日期 <= @orderDateEnd')
      params.orderDateEnd = orderDateEnd
    }

    // 产品分类（来源于货物信息表 g.分类）
    if (category) {
      whereConditionsWithAlias.push('g.分类 = @category')
      params.category = category
    }

    if (isInStock !== undefined) {
      whereConditionsWithAlias.push('so.是否入库 = @isInStock')
      params.isInStock = isInStock === 'true' || isInStock === '1' ? 1 : 0
    }

    if (isShipped !== undefined) {
      whereConditionsWithAlias.push('so.是否出运 = @isShipped')
      params.isShipped = isShipped === 'true' || isShipped === '1' ? 1 : 0
    }

    const whereClause =
      whereConditionsWithAlias.length > 0 ? `WHERE ${whereConditionsWithAlias.join(' AND ')}` : ''

    // 计算分页
    const offset = (parseInt(page) - 1) * parseInt(pageSize)

    // 查询所有满足条件的记录（不分页，用于分组）
    // 同时关联货物信息表、项目管理表和客户信息表，获取产品名称、产品图号、客户模号和客户名称
    const allDataQuery = `
      SELECT 
        so.订单ID as id,
        so.订单编号 as orderNo,
        so.客户ID as customerId,
        so.项目编号 as itemCode,
        so.订单日期 as orderDate,
        so.交货日期 as deliveryDate,
        so.签订日期 as signDate,
        so.合同号 as contractNo,
        so.总金额 as totalAmount,
        so.单价 as unitPrice,
        so.数量 as quantity,
        so.备注 as remark,
        so.费用出处 as costSource,
        so.经办人 as handler,
        so.是否入库 as isInStock,
        so.是否出运 as isShipped,
        so.出运日期 as shippingDate,
        g.产品名称 as productName,
        g.产品图号 as productDrawingNo,
        p.客户模号 as customerPartNo,
        c.客户名称 as customerName
      FROM 销售订单 so
      LEFT JOIN 货物信息 g ON so.项目编号 = g.项目编号
      LEFT JOIN 项目管理 p ON so.项目编号 = p.项目编号
      LEFT JOIN 客户信息 c ON so.客户ID = c.客户ID
      ${whereClause}
      ORDER BY so.订单日期 DESC, so.订单ID DESC
    `

    const allData = await query(allDataQuery, params)

    // 按订单号分组
    const orderMap = new Map()

    allData.forEach((row) => {
      const orderNo = row.orderNo
      if (!orderMap.has(orderNo)) {
        // 创建新订单组
        orderMap.set(orderNo, {
          orderNo: orderNo,
          customerId: row.customerId,
          orderDate: row.orderDate,
          signDate: row.signDate,
          contractNo: row.contractNo,
          customerName: row.customerName || null, // 从JOIN查询中获取
          details: [],
          totalQuantity: 0,
          totalAmount: 0
        })
      }

      // 添加明细
      const order = orderMap.get(orderNo)
      order.details.push({
        id: row.id,
        itemCode: row.itemCode,
        productName: row.productName || null,
        productDrawingNo: row.productDrawingNo || null,
        customerPartNo: row.customerPartNo || null,
        deliveryDate: row.deliveryDate,
        totalAmount: row.totalAmount,
        unitPrice: row.unitPrice,
        quantity: row.quantity,
        remark: row.remark,
        costSource: row.costSource,
        handler: row.handler,
        isInStock: row.isInStock,
        isShipped: row.isShipped,
        shippingDate: row.shippingDate
      })

      // 累计数量和金额
      order.totalQuantity += row.quantity || 0
      order.totalAmount += row.totalAmount || 0
    })

    // 注意：客户名称已经在JOIN查询中获取，无需再单独查询

    // 转换为数组并按订单日期排序
    const groupedList = Array.from(orderMap.values()).sort((a, b) => {
      // 按订单日期“倒序”（最新在前），如果日期相同则按订单编号倒序（大的在前）
      if (a.orderDate && b.orderDate) {
        const diff = new Date(b.orderDate) - new Date(a.orderDate)
        if (diff !== 0) return diff
        return b.orderNo.localeCompare(a.orderNo)
      }
      if (a.orderDate) return -1
      if (b.orderDate) return 1
      return b.orderNo.localeCompare(a.orderNo)
    })

    // 计算总数（按订单号分组后的数量）
    const total = groupedList.length

    // 分页处理
    const paginatedList = groupedList.slice(offset, offset + parseInt(pageSize))

    res.json({
      code: 0,
      success: true,
      data: {
        list: paginatedList,
        total: total,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      }
    })
  } catch (error) {
    console.error('获取销售订单列表失败:', error)
    res.status(500).json({
      success: false,
      message: '获取销售订单列表失败',
      error: error.message
    })
  }
})

// 按订单号获取完整的销售订单信息（包括所有明细）
router.get('/by-orderNo/:orderNo', async (req, res) => {
  try {
    const { orderNo } = req.params

    // 查询该订单号下的所有记录
    const allDataQuery = `
      SELECT 
        so.订单ID as id,
        so.订单编号 as orderNo,
        so.客户ID as customerId,
        so.项目编号 as itemCode,
        so.订单日期 as orderDate,
        so.交货日期 as deliveryDate,
        so.签订日期 as signDate,
        so.合同号 as contractNo,
        so.总金额 as totalAmount,
        so.单价 as unitPrice,
        so.数量 as quantity,
        so.备注 as remark,
        so.费用出处 as costSource,
        so.经办人 as handler,
        so.是否入库 as isInStock,
        so.是否出运 as isShipped,
        so.出运日期 as shippingDate,
        g.产品名称 as productName,
        g.产品图号 as productDrawingNo,
        p.客户模号 as customerPartNo
      FROM 销售订单 so
      LEFT JOIN 货物信息 g ON so.项目编号 = g.项目编号
      LEFT JOIN 项目管理 p ON so.项目编号 = p.项目编号
      WHERE so.订单编号 = @orderNo
      ORDER BY so.订单ID
    `

    const allData = await query(allDataQuery, { orderNo })

    if (allData.length === 0) {
      return res.status(404).json({
        code: 404,
        success: false,
        message: '销售订单不存在'
      })
    }

    // 构建订单信息
    const firstRow = allData[0]
    const order = {
      orderNo: firstRow.orderNo,
      customerId: firstRow.customerId,
      orderDate: firstRow.orderDate,
      signDate: firstRow.signDate,
      contractNo: firstRow.contractNo,
      customerName: null,
      details: allData.map((row) => ({
        id: row.id,
        itemCode: row.itemCode,
        productName: row.productName || null,
        productDrawingNo: row.productDrawingNo || null,
        customerPartNo: row.customerPartNo || null,
        deliveryDate: row.deliveryDate,
        totalAmount: row.totalAmount,
        unitPrice: row.unitPrice,
        quantity: row.quantity,
        remark: row.remark,
        costSource: row.costSource,
        handler: row.handler,
        isInStock: row.isInStock,
        isShipped: row.isShipped,
        shippingDate: row.shippingDate
      })),
      totalQuantity: allData.reduce((sum, row) => sum + (row.quantity || 0), 0),
      totalAmount: allData.reduce((sum, row) => sum + (row.totalAmount || 0), 0)
    }

    // 获取客户名称
    if (order.customerId) {
      const customerQuery = `
        SELECT 客户名称 as customerName
        FROM 客户信息
        WHERE 客户ID = @customerId
      `
      const customers = await query(customerQuery, { customerId: order.customerId })
      if (customers.length > 0) {
        order.customerName = customers[0].customerName
      }
    }

    res.json({
      code: 0,
      success: true,
      data: order
    })
  } catch (error) {
    console.error('获取销售订单失败:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: '获取销售订单失败',
      error: error.message
    })
  }
})

// 获取销售订单统计信息（必须在/:id之前，否则statistics会被当作id）
router.get('/statistics', async (req, res) => {
  try {
    // 获取当前年份和月份
    const currentYear = new Date().getFullYear()
    const currentMonth = new Date().getMonth() + 1

    // 构建当年和本月的日期范围
    const yearStart = `${currentYear}-01-01`
    const yearEnd = `${currentYear}-12-31`
    const monthStart = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`
    const monthEndDate = new Date(currentYear, currentMonth, 0).getDate()
    const monthEnd = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(monthEndDate).padStart(2, '0')}`

    const queryString = `
      SELECT 
        -- 基础统计
        COUNT(*) as totalOrders,
        SUM(总金额) as totalAmount,
        SUM(数量) as totalQuantity,
        SUM(CASE WHEN 是否入库 = 1 THEN 1 ELSE 0 END) as inStockCount,
        SUM(CASE WHEN 是否出运 = 1 THEN 1 ELSE 0 END) as shippedCount,
        SUM(CASE WHEN 是否入库 = 0 THEN 1 ELSE 0 END) as notInStockCount,
        SUM(CASE WHEN 是否出运 = 0 THEN 1 ELSE 0 END) as notShippedCount,
        -- 当年订单累计金额
        SUM(CASE 
          WHEN 订单日期 >= @yearStart AND 订单日期 <= @yearEnd 
          THEN 总金额 
          ELSE 0 
        END) as yearTotalAmount,
        -- 本月订单累计金额
        SUM(CASE 
          WHEN 订单日期 >= @monthStart AND 订单日期 <= @monthEnd 
          THEN 总金额 
          ELSE 0 
        END) as monthTotalAmount,
        -- 待入库（未入库的数量）
        SUM(CASE WHEN 是否入库 = 0 THEN 数量 ELSE 0 END) as pendingInStock,
        -- 待出运（已入库但未出运的数量）
        SUM(CASE WHEN 是否入库 = 1 AND 是否出运 = 0 THEN 数量 ELSE 0 END) as pendingShipped
      FROM 销售订单
    `

    const result = await query(queryString, {
      yearStart,
      yearEnd,
      monthStart,
      monthEnd
    })

    res.json({
      code: 0,
      success: true,
      data: result[0]
    })
  } catch (error) {
    console.error('获取销售订单统计信息失败:', error)
    res.status(500).json({
      success: false,
      message: '获取销售订单统计信息失败',
      error: error.message
    })
  }
})

// 获取单个销售订单记录（按ID）
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params

    const queryString = `
      SELECT 
        订单ID as id,
        订单编号 as orderNo,
        客户ID as customerId,
        项目编号 as itemCode,
        订单日期 as orderDate,
        交货日期 as deliveryDate,
        签订日期 as signDate,
        合同号 as contractNo,
        总金额 as totalAmount,
        单价 as unitPrice,
        数量 as quantity,
        备注 as remark,
        费用出处 as costSource,
        经办人 as handler,
        是否入库 as isInStock,
        是否出运 as isShipped,
        出运日期 as shippingDate
      FROM 销售订单 
      WHERE 订单ID = @id
    `

    const result = await query(queryString, { id: parseInt(id) })

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: '销售订单不存在'
      })
    }

    res.json({
      code: 0,
      success: true,
      data: result[0]
    })
  } catch (error) {
    console.error('获取销售订单失败:', error)
    res.status(500).json({
      success: false,
      message: '获取销售订单失败',
      error: error.message
    })
  }
})

// 创建销售订单
router.post('/create', async (req, res) => {
  try {
    const { orderNo, orderDate, signDate, contractNo, customerId, details } = req.body

    if (!orderNo) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '订单编号不能为空'
      })
    }

    if (!customerId) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '客户不能为空'
      })
    }

    if (!details || !Array.isArray(details) || details.length === 0) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '订单明细不能为空'
      })
    }

    // 检查订单编号是否已存在
    const checkQuery = `
      SELECT COUNT(*) as count 
      FROM 销售订单 
      WHERE 订单编号 = @orderNo
    `
    const checkResult = await query(checkQuery, { orderNo })
    if (checkResult[0].count > 0) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '订单编号已存在'
      })
    }

    // 收集所有项目编号，用于后续更新isNew字段
    const itemCodes = []
    // 收集项目编号和客户模号的映射，用于更新项目管理表
    const itemCodeToCustomerPartNo = new Map()

    const pool = await getPool()

    // 插入订单明细
    for (const detail of details) {
      const insertQuery = `
        INSERT INTO 销售订单 (
          订单编号, 客户ID, 项目编号, 订单日期, 交货日期, 签订日期, 合同号,
          总金额, 单价, 数量, 备注, 费用出处, 经办人, 是否入库, 是否出运, 出运日期
        ) VALUES (
          @orderNo, @customerId, @itemCode, @orderDate, @deliveryDate, @signDate, @contractNo,
          @totalAmount, @unitPrice, @quantity, @remark, @costSource, @handler, @isInStock, @isShipped, @shippingDate
        )
      `

      const insertParams = {
        orderNo: orderNo,
        customerId: customerId,
        itemCode: detail.itemCode || null,
        orderDate: orderDate || null,
        deliveryDate: detail.deliveryDate || null,
        signDate: signDate || null,
        contractNo: contractNo || null,
        totalAmount: detail.totalAmount || 0,
        unitPrice: detail.unitPrice || 0,
        quantity: detail.quantity || 0,
        remark: detail.remark || null,
        costSource: detail.costSource || null,
        handler: detail.handler || null,
        isInStock: detail.isInStock ? 1 : 0,
        isShipped: detail.isShipped ? 1 : 0,
        shippingDate: detail.shippingDate || null
      }

      await query(insertQuery, insertParams)

      // 记录项目编号
      if (detail.itemCode) {
        itemCodes.push(detail.itemCode)
        // 如果提供了客户模号（包括空字符串，表示清除），记录到映射中
        // 使用最后一个非空值，如果最后一个是空字符串，也记录（表示清除）
        if (detail.customerPartNo !== undefined && detail.customerPartNo !== null) {
          // 如果已经有值，且新的值不为空，则更新；如果新的值为空字符串，也更新（清除）
          const existingValue = itemCodeToCustomerPartNo.get(detail.itemCode)
          if (!existingValue || detail.customerPartNo !== '') {
            itemCodeToCustomerPartNo.set(detail.itemCode, detail.customerPartNo)
          }
        }
      }
    }

    // 更新项目管理表中的客户模号
    if (itemCodeToCustomerPartNo.size > 0) {
      try {
        for (const [itemCode, customerPartNo] of itemCodeToCustomerPartNo.entries()) {
          const updateProjectRequest = pool.request()
          updateProjectRequest.input('itemCode', sql.NVarChar, itemCode)
          // 如果客户模号为空字符串，设置为NULL；否则设置为实际值
          const customerPartNoValue = customerPartNo === '' ? null : customerPartNo
          updateProjectRequest.input('customerPartNo', sql.NVarChar, customerPartNoValue)

          await updateProjectRequest.query(`
            UPDATE 项目管理 
            SET 客户模号 = @customerPartNo
            WHERE 项目编号 = @itemCode
          `)
          if (customerPartNoValue) {
            console.log(
              `[销售订单] 已更新项目管理记录，项目编号: ${itemCode}, 客户模号: ${customerPartNoValue}`
            )
          } else {
            console.log(`[销售订单] 已清除项目管理记录中的客户模号，项目编号: ${itemCode}`)
          }
        }
      } catch (updateError) {
        console.error('更新项目管理表中的客户模号失败:', updateError)
        // 不影响订单创建，仅记录错误
      }
    }

    // 更新货物信息表中的IsNew字段为0
    if (itemCodes.length > 0) {
      // 构建IN子句的参数
      const placeholders = itemCodes.map((_, index) => `@itemCode${index}`).join(', ')
      const updateQuery = `
        UPDATE 货物信息 
        SET IsNew = 0 
        WHERE 项目编号 IN (${placeholders})
      `

      const updateParams = {}
      itemCodes.forEach((code, index) => {
        updateParams[`itemCode${index}`] = code
      })

      try {
        await query(updateQuery, updateParams)
        console.log(`已将 ${itemCodes.length} 个项目的IsNew更新为0`)
      } catch (updateError) {
        console.error('更新货物信息IsNew字段失败:', updateError)
        // 不影响订单创建，仅记录错误
      }
    }

    res.json({
      code: 0,
      success: true,
      message: '创建销售订单成功',
      data: { orderNo }
    })
  } catch (error) {
    console.error('创建销售订单失败:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: '创建销售订单失败',
      error: error.message
    })
  }
})

// 更新销售订单（批量更新同一订单号下的记录）
router.put('/update', async (req, res) => {
  try {
    const { orderNo, orderDate, signDate, contractNo, customerId, details } = req.body

    if (!orderNo) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '订单编号不能为空'
      })
    }

    if (!details || !Array.isArray(details) || details.length === 0) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '订单明细不能为空'
      })
    }

    // 开始事务更新
    // 1. 更新订单的基本信息（更新所有该订单号的记录）
    const baseUpdateParams = { orderNo }
    let baseUpdates = []

    if (orderDate !== undefined) {
      baseUpdates.push('订单日期 = @orderDate')
      baseUpdateParams.orderDate = orderDate
    }
    if (signDate !== undefined) {
      baseUpdates.push('签订日期 = @signDate')
      baseUpdateParams.signDate = signDate
    }
    if (contractNo !== undefined) {
      baseUpdates.push('合同号 = @contractNo')
      baseUpdateParams.contractNo = contractNo
    }
    if (customerId !== undefined) {
      baseUpdates.push('客户ID = @customerId')
      baseUpdateParams.customerId = customerId
    }

    if (baseUpdates.length > 0) {
      const baseUpdateQuery = `
        UPDATE 销售订单 
        SET ${baseUpdates.join(', ')}
        WHERE 订单编号 = @orderNo
      `
      await query(baseUpdateQuery, baseUpdateParams)
    }

    // 收集项目编号和客户模号的映射，用于更新项目管理表
    const itemCodeToCustomerPartNo = new Map()
    const pool = await getPool()
    const sql = require('mssql')

    // 2. 批量更新明细记录
    for (const detail of details) {
      if (!detail.id) {
        return res.status(400).json({
          code: 400,
          success: false,
          message: '订单明细ID不能为空'
        })
      }

      const detailUpdates = []
      const detailParams = { id: detail.id }

      if (detail.itemCode !== undefined) {
        detailUpdates.push('项目编号 = @itemCode')
        detailParams.itemCode = detail.itemCode
      }
      if (detail.deliveryDate !== undefined) {
        detailUpdates.push('交货日期 = @deliveryDate')
        detailParams.deliveryDate = detail.deliveryDate || null
      }
      if (detail.totalAmount !== undefined) {
        detailUpdates.push('总金额 = @totalAmount')
        detailParams.totalAmount = detail.totalAmount
      }
      if (detail.unitPrice !== undefined) {
        detailUpdates.push('单价 = @unitPrice')
        detailParams.unitPrice = detail.unitPrice
      }
      if (detail.quantity !== undefined) {
        detailUpdates.push('数量 = @quantity')
        detailParams.quantity = detail.quantity
      }
      if (detail.remark !== undefined) {
        detailUpdates.push('备注 = @remark')
        detailParams.remark = detail.remark || null
      }
      if (detail.costSource !== undefined) {
        detailUpdates.push('费用出处 = @costSource')
        detailParams.costSource = detail.costSource || null
      }
      if (detail.handler !== undefined) {
        detailUpdates.push('经办人 = @handler')
        detailParams.handler = detail.handler || null
      }
      if (detail.isInStock !== undefined) {
        detailUpdates.push('是否入库 = @isInStock')
        detailParams.isInStock = detail.isInStock ? 1 : 0
      }
      if (detail.isShipped !== undefined) {
        detailUpdates.push('是否出运 = @isShipped')
        detailParams.isShipped = detail.isShipped ? 1 : 0
      }
      if (detail.shippingDate !== undefined) {
        detailUpdates.push('出运日期 = @shippingDate')
        detailParams.shippingDate = detail.shippingDate || null
      }

      if (detailUpdates.length > 0) {
        const detailUpdateQuery = `
          UPDATE 销售订单 
          SET ${detailUpdates.join(', ')}
          WHERE 订单ID = @id
        `
        await query(detailUpdateQuery, detailParams)
      }

      // 如果提供了客户模号（包括空值，表示要清除），记录到映射中用于更新项目管理表
      let itemCode = detail.itemCode
      if (!itemCode) {
        // 如果前端没有传递 itemCode，查询现有记录的项目编号
        const existingRecordQuery = `SELECT 项目编号 as itemCode FROM 销售订单 WHERE 订单ID = @id`
        const existingRecord = await query(existingRecordQuery, { id: detail.id })
        if (existingRecord.length > 0) {
          itemCode = existingRecord[0].itemCode
        }
      }
      // 如果customerPartNo字段存在（包括null和空字符串），就记录到映射中
      // undefined 表示前端没有传递该字段，不需要更新
      if (itemCode && detail.hasOwnProperty('customerPartNo')) {
        // 将 null、undefined 或空字符串统一转换为空字符串，用于后续清除
        // 如果有值（非空字符串），使用实际值；否则使用空字符串表示清除
        let customerPartNoValue = ''
        if (detail.customerPartNo) {
          // 确保是字符串类型，并进行去空格处理
          const strValue = String(detail.customerPartNo).trim()
          if (strValue !== '') {
            customerPartNoValue = strValue
          }
        }
        itemCodeToCustomerPartNo.set(itemCode, customerPartNoValue)
      }
    }

    // 3. 更新项目管理表中的客户模号
    if (itemCodeToCustomerPartNo.size > 0) {
      try {
        for (const [itemCode, customerPartNo] of itemCodeToCustomerPartNo.entries()) {
          const updateProjectRequest = pool.request()
          updateProjectRequest.input('itemCode', sql.NVarChar, itemCode)
          // 如果客户模号为空字符串，设置为NULL；否则设置为实际值
          const customerPartNoValue = customerPartNo === '' ? null : customerPartNo
          updateProjectRequest.input('customerPartNo', sql.NVarChar, customerPartNoValue)

          await updateProjectRequest.query(`
            UPDATE 项目管理 
            SET 客户模号 = @customerPartNo
            WHERE 项目编号 = @itemCode
          `)
          if (customerPartNoValue) {
            console.log(
              `[销售订单] 已更新项目管理记录，项目编号: ${itemCode}, 客户模号: ${customerPartNoValue}`
            )
          } else {
            console.log(`[销售订单] 已清除项目管理记录中的客户模号，项目编号: ${itemCode}`)
          }
        }
      } catch (updateError) {
        console.error('更新项目管理表中的客户模号失败:', updateError)
        // 不影响订单更新，仅记录错误
      }
    }

    res.json({
      code: 0,
      success: true,
      message: '更新销售订单成功'
    })
  } catch (error) {
    console.error('更新销售订单失败:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: '更新销售订单失败',
      error: error.message
    })
  }
})

// 删除销售订单（按订单编号删除所有明细）
router.delete('/delete/:orderNo', async (req, res) => {
  try {
    const { orderNo } = req.params

    if (!orderNo) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '订单编号不能为空'
      })
    }

    // 检查订单是否存在
    const checkQuery = `
      SELECT COUNT(*) as count 
      FROM 销售订单 
      WHERE 订单编号 = @orderNo
    `
    const checkResult = await query(checkQuery, { orderNo })

    if (checkResult[0].count === 0) {
      return res.status(404).json({
        code: 404,
        success: false,
        message: '订单不存在'
      })
    }

    // 删除该订单号下的所有明细记录
    const deleteQuery = `
      DELETE FROM 销售订单 
      WHERE 订单编号 = @orderNo
    `

    await query(deleteQuery, { orderNo })

    res.json({
      code: 0,
      success: true,
      message: '删除销售订单成功'
    })
  } catch (error) {
    console.error('删除销售订单失败:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: '删除销售订单失败',
      error: error.message
    })
  }
})

// 拆分销售订单：将同一订单号下的部分明细移动到新订单号（新订单号按系统流水号生成）
router.post('/:orderNo/split', async (req, res) => {
  let transaction = null
  const movedFiles = []
  try {
    const sourceOrderNo = String(req.params.orderNo || '').trim()
    if (!sourceOrderNo) {
      return res.status(400).json({ code: 400, success: false, message: '订单编号不能为空' })
    }

    const groups = req.body?.groups
    if (!Array.isArray(groups) || groups.length === 0) {
      return res.status(400).json({ code: 400, success: false, message: '拆分分组不能为空' })
    }

    // 先加载该订单所有明细（用于校验 & 获取订单日期）
    const sourceRows = await query(
      `
      SELECT
        订单ID as id,
        订单编号 as orderNo,
        订单日期 as orderDate
      FROM 销售订单
      WHERE 订单编号 = @orderNo
      ORDER BY 订单ID
    `,
      { orderNo: sourceOrderNo }
    )
    if (!sourceRows.length) {
      return res.status(404).json({ code: 404, success: false, message: '订单不存在' })
    }

    const allDetailIds = new Set(
      sourceRows.map((r) => Number(r.id)).filter((n) => Number.isInteger(n) && n > 0)
    )
    const orderDateYYYYMMDD = toYYYYMMDD(sourceRows[0].orderDate) || toYYYYMMDD(new Date())

    const movedDetailIds = new Set()
    const newGroups = []
    for (const g of groups) {
      const key = String(g?.key || '').trim()
      const detailIds = Array.isArray(g?.detailIds) ? g.detailIds : []
      const normalizedIds = detailIds
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0)
        .filter((id) => allDetailIds.has(id))

      if (key && key !== 'origin' && normalizedIds.length) {
        newGroups.push({ key, detailIds: normalizedIds })
        for (const id of normalizedIds) movedDetailIds.add(id)
      }
    }

    if (!newGroups.length || !movedDetailIds.size) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '请至少选择一条明细拆分到新订单'
      })
    }
    if (allDetailIds.size - movedDetailIds.size < 1) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '原订单至少保留 1 条明细'
      })
    }

    const pool = await getPool()
    transaction = new sql.Transaction(pool)
    await transaction.begin()

    // 同“生成订单号”规则：XS-YYYYMMDD-XXX（日期使用原订单日期）
    const orderPrefix = 'XS'
    const likePattern = `${orderPrefix}-${orderDateYYYYMMDD}-%`
    const serialReq = new sql.Request(transaction)
    serialReq.input('likePattern', sql.NVarChar, likePattern)

    // 只取符合 XS-YYYYMMDD-XXX 格式的最大流水号，避免字符串排序导致取错
    const serialResult = await serialReq.query(`
      SELECT
        COALESCE(MAX(TRY_CAST(RIGHT(订单编号, 3) AS INT)), 0) as maxSerial
      FROM 销售订单 WITH (UPDLOCK, HOLDLOCK)
      WHERE 订单编号 LIKE @likePattern
        AND 订单编号 LIKE N'XS-________-___'
    `)
    let lastSerial = Number(serialResult.recordset?.[0]?.maxSerial ?? 0)
    if (!Number.isFinite(lastSerial) || lastSerial < 0) lastSerial = 0

    const created = newGroups.map((g, idx) => {
      const serial = String(lastSerial + 1 + idx).padStart(3, '0')
      let newOrderNo = `${orderPrefix}-${orderDateYYYYMMDD}-${serial}`
      if (newOrderNo === sourceOrderNo) {
        // 极端情况：源订单刚好是当日最小流水号且没有其它记录，避免生成同号
        const nextSerial = String(lastSerial + 2 + idx).padStart(3, '0')
        newOrderNo = `${orderPrefix}-${orderDateYYYYMMDD}-${nextSerial}`
      }
      return { groupKey: g.key, orderNo: newOrderNo, movedDetailIds: g.detailIds }
    })

    // 先搬迁附件文件并同步更新附件表，再更新销售订单明细订单号
    for (const group of created) {
      const detailIds = group.movedDetailIds
      if (!detailIds.length) continue

      const attachmentReq = new sql.Request(transaction)
      attachmentReq.input('orderNo', sql.NVarChar, sourceOrderNo)
      const placeholders = detailIds.map((_, idx) => `@d${idx}`).join(',')
      detailIds.forEach((id, idx) => attachmentReq.input(`d${idx}`, sql.Int, id))
      const attachmentsResult = await attachmentReq.query(
        `
        SELECT
          附件ID as id,
          订单ID as orderId,
          存储文件名 as storedFileName,
          相对路径 as relativePath
        FROM 销售订单附件
        WHERE 订单编号 = @orderNo
          AND 订单ID IN (${placeholders})
      `
      )
      const attachments = attachmentsResult.recordset || []

      // 新路径结构：{项目编号}/销售订单/，不包含订单编号和明细ID
      // 因此拆分订单时，路径不需要改变，只需要更新数据库中的订单编号字段
      // 不需要移动文件，提高了性能并简化了逻辑
      for (const att of attachments) {
        const upReq = new sql.Request(transaction)
        upReq.input('attachmentId', sql.Int, Number(att.id))
        upReq.input('newOrderNo', sql.NVarChar, group.orderNo)
        await upReq.query(`
          UPDATE 销售订单附件
          SET 订单编号 = @newOrderNo
          WHERE 附件ID = @attachmentId
        `)
      }

      const updateReq = new sql.Request(transaction)
      updateReq.input('newOrderNo', sql.NVarChar, group.orderNo)
      updateReq.input('oldOrderNo', sql.NVarChar, sourceOrderNo)
      const placeholders2 = detailIds.map((_, idx) => `@id${idx}`).join(',')
      detailIds.forEach((id, idx) => updateReq.input(`id${idx}`, sql.Int, id))
      await updateReq.query(`
        UPDATE 销售订单
        SET 订单编号 = @newOrderNo
        WHERE 订单编号 = @oldOrderNo
          AND 订单ID IN (${placeholders2})
      `)
    }

    await transaction.commit()
    res.json({ code: 0, success: true, message: '拆分成功', data: { sourceOrderNo, created } })
  } catch (error) {
    if (transaction) {
      try {
        await transaction.rollback()
      } catch {}
    }

    // 注意：新路径结构下，拆分订单不需要移动文件，所以也不需要回滚文件移动
    // 此代码块保留用于向后兼容，但在新路径结构下 movedFiles 始终为空数组

    console.error('拆分销售订单失败:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: error?.message || '拆分销售订单失败'
    })
  }
})

// === 销售订单附件相关接口 ===

// 上传单个附件（按明细行）
router.post(
  '/:orderNo/details/:detailId/attachments',
  uploadAttachment.single('file'),
  async (req, res) => {
    try {
      const { orderNo, detailId } = req.params
      const numericDetailId = parseInt(detailId, 10)

      if (!orderNo || !Number.isInteger(numericDetailId) || numericDetailId <= 0) {
        return res.status(400).json({
          code: 400,
          success: false,
          message: '订单编号或明细ID不合法'
        })
      }

      const file = req.file
      if (!file) {
        return res.status(400).json({
          code: 400,
          success: false,
          message: '未找到上传文件'
        })
      }

      // 校验该明细是否存在，并获取实际订单编号 / 项目编号
      const detailRows = await query(
        `
        SELECT TOP 1 
          订单ID as id,
          订单编号 as orderNo,
          项目编号 as itemCode
        FROM 销售订单
        WHERE 订单ID = @detailId
      `,
        { detailId: numericDetailId }
      )

      if (!detailRows.length) {
        return res.status(404).json({
          code: 404,
          success: false,
          message: '对应的销售订单明细不存在'
        })
      }

      const dbDetail = detailRows[0]

      if (dbDetail.orderNo && dbDetail.orderNo !== orderNo) {
        return res.status(400).json({
          code: 400,
          success: false,
          message: '订单编号与明细记录不一致'
        })
      }

      const itemCode = dbDetail.itemCode || null

      // 如果项目编号为空，使用默认值
      if (!itemCode) {
        return res.status(400).json({
          code: 400,
          success: false,
          message: '订单明细缺少项目编号，无法保存附件'
        })
      }

      // 计算最终存储路径：{分类}/{项目编号}/销售订单/
      const category = getCategoryFromProjectCode(itemCode)
      const safeProjectCode = safeProjectCodeForPath(itemCode)
      const finalRelativeDir = path.posix.join(category, safeProjectCode, '销售订单')
      const finalFullDir = path.join(FILE_ROOT, finalRelativeDir)
      ensureDirSync(finalFullDir)

      // 将文件从临时目录移动到最终目录
      const originalName = normalizeAttachmentFileName(file.originalname)
      const storedFileName = req._attachmentStoredFileName || file.filename
      const tempFile = path.join(req._tempAttachmentFullDir || FILE_ROOT, storedFileName)
      const finalFile = path.join(finalFullDir, storedFileName)

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

      const relativePath = finalRelativeDir
      const fileSize = file.size
      const contentType = file.mimetype || null
      const uploadedBy = (req.body && (req.body.uploadedBy || req.body.uploader)) || null

      const insertSql = `
        INSERT INTO 销售订单附件 (
          订单ID,
          订单编号,
          项目编号,
          原始文件名,
          存储文件名,
          相对路径,
          文件大小,
          内容类型,
          上传人
        )
        OUTPUT 
          INSERTED.附件ID as attachmentId,
          INSERTED.上传时间 as uploadedAt
        VALUES (
          @detailId,
          @orderNo,
          @itemCode,
          @originalName,
          @storedFileName,
          @relativePath,
          @fileSize,
          @contentType,
          @uploadedBy
        )
      `

      const insertResult = await query(insertSql, {
        detailId: numericDetailId,
        orderNo,
        itemCode,
        originalName,
        storedFileName,
        relativePath,
        fileSize,
        contentType,
        uploadedBy
      })

      const inserted = insertResult[0]

      res.json({
        code: 0,
        success: true,
        message: '上传附件成功',
        data: {
          id: inserted.attachmentId,
          orderId: numericDetailId,
          orderNo,
          itemCode,
          originalName,
          storedFileName,
          relativePath,
          fileSize,
          contentType,
          uploadedAt: inserted.uploadedAt
        }
      })
    } catch (error) {
      console.error('上传销售订单附件失败:', error)
      res.status(500).json({
        code: 500,
        success: false,
        message: '上传销售订单附件失败',
        error: error.message
      })
    }
  }
)

// 获取某一明细下的所有附件
router.get('/:orderNo/details/:detailId/attachments', async (req, res) => {
  try {
    const { orderNo, detailId } = req.params
    const numericDetailId = parseInt(detailId, 10)

    if (!orderNo || !Number.isInteger(numericDetailId) || numericDetailId <= 0) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '订单编号或明细ID不合法'
      })
    }

    const rows = await query(
      `
      SELECT 
        附件ID as id,
        订单ID as orderId,
        订单编号 as orderNo,
        项目编号 as itemCode,
        原始文件名 as originalName,
        存储文件名 as storedFileName,
        相对路径 as relativePath,
        文件大小 as fileSize,
        内容类型 as contentType,
        上传时间 as uploadedAt,
        上传人 as uploadedBy
      FROM 销售订单附件
      WHERE 订单ID = @detailId
        AND 订单编号 = @orderNo
      ORDER BY 上传时间 DESC, 附件ID DESC
    `,
      { detailId: numericDetailId, orderNo }
    )

    res.json({
      code: 0,
      success: true,
      data: rows
    })
  } catch (error) {
    console.error('获取销售订单附件列表失败:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: '获取销售订单附件列表失败',
      error: error.message
    })
  }
})

// 获取某订单下各明细的附件数量汇总
router.get('/:orderNo/attachments/summary', async (req, res) => {
  try {
    const { orderNo } = req.params
    if (!orderNo) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '订单编号不能为空'
      })
    }

    const rows = await query(
      `
      SELECT 
        订单ID as orderId,
        COUNT(*) as attachmentCount
      FROM 销售订单附件
      WHERE 订单编号 = @orderNo
      GROUP BY 订单ID
    `,
      { orderNo }
    )

    res.json({
      code: 0,
      success: true,
      data: rows
    })
  } catch (error) {
    console.error('获取销售订单附件汇总失败:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: '获取销售订单附件汇总失败',
      error: error.message
    })
  }
})

// 下载附件
router.get('/attachments/:attachmentId/download', async (req, res) => {
  try {
    const attachmentId = parseInt(req.params.attachmentId, 10)
    if (!Number.isInteger(attachmentId) || attachmentId <= 0) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '附件ID不合法'
      })
    }

    const rows = await query(
      `
      SELECT 
        附件ID as id,
        原始文件名 as originalName,
        存储文件名 as storedFileName,
        相对路径 as relativePath,
        内容类型 as contentType
      FROM 销售订单附件
      WHERE 附件ID = @attachmentId
    `,
      { attachmentId }
    )

    if (!rows.length) {
      return res.status(404).json({
        code: 404,
        success: false,
        message: '附件不存在'
      })
    }

    const attachment = rows[0]
    const fullPath = path.join(FILE_ROOT, attachment.relativePath, attachment.storedFileName)

    fs.access(fullPath, fs.constants.R_OK, (err) => {
      if (err) {
        console.error('附件文件不存在或无法访问:', err)
        return res.status(404).json({
          code: 404,
          success: false,
          message: '附件文件不存在或无法访问'
        })
      }

      res.download(fullPath, attachment.originalName, (downloadErr) => {
        if (downloadErr) {
          console.error('下载销售订单附件时出错:', downloadErr)
        }
      })
    })
  } catch (error) {
    console.error('下载销售订单附件失败:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: '下载销售订单附件失败',
      error: error.message
    })
  }
})

// 删除附件
router.delete('/attachments/:attachmentId', async (req, res) => {
  try {
    const attachmentId = parseInt(req.params.attachmentId, 10)
    if (!Number.isInteger(attachmentId) || attachmentId <= 0) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '附件ID不合法'
      })
    }

    const rows = await query(
      `
      SELECT 
        附件ID as id,
        原始文件名 as originalName,
        存储文件名 as storedFileName,
        相对路径 as relativePath
      FROM 销售订单附件
      WHERE 附件ID = @attachmentId
    `,
      { attachmentId }
    )

    if (!rows.length) {
      return res.status(404).json({
        code: 404,
        success: false,
        message: '附件不存在'
      })
    }

    const attachment = rows[0]
    const fullPath = path.join(FILE_ROOT, attachment.relativePath, attachment.storedFileName)

    try {
      await fs.promises.unlink(fullPath)
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error('删除附件文件失败:', err)
      } else {
        console.warn('附件文件不存在，直接删除数据库记录')
      }
    }

    await query(
      `
      DELETE FROM 销售订单附件
      WHERE 附件ID = @attachmentId
    `,
      { attachmentId }
    )

    res.json({
      code: 0,
      success: true,
      message: '删除附件成功'
    })
  } catch (error) {
    console.error('删除销售订单附件失败:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: '删除销售订单附件失败',
      error: error.message
    })
  }
})

module.exports = router
