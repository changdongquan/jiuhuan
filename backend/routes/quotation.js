const express = require('express')
const { query, getPool } = require('../database')
const sql = require('mssql')
const router = express.Router()

// 获取报价单列表
router.get('/list', async (req, res) => {
  try {
    const { keyword, processingDate, page = 1, pageSize = 20 } = req.query

    // 构建查询条件
    const whereConditions = []
    const params = {}

    // 关键词搜索：报价单号、客户名称、更改通知单号、模具编号、加工零件名称
    if (keyword) {
      whereConditions.push(
        `(报价单号 LIKE @keyword OR 客户名称 LIKE @keyword OR 更改通知单号 LIKE @keyword OR 模具编号 LIKE @keyword OR 加工零件名称 LIKE @keyword)`
      )
      params.keyword = `%${keyword}%`
    }

    // 加工周期筛选
    if (processingDate) {
      whereConditions.push('加工周期 = @processingDate')
      params.processingDate = processingDate
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

    // 计算总数
    const countQuery = `
      SELECT COUNT(*) as total
      FROM 报价单
      ${whereClause}
    `
    const countResult = await query(countQuery, params)
    const total = countResult[0]?.total || 0

    // 计算分页
    const pageNum = parseInt(page, 10) || 1
    const pageSizeNum = parseInt(pageSize, 10) || 20
    const offset = (pageNum - 1) * pageSizeNum

    // 查询数据
    const dataQuery = `
      SELECT 
        报价单ID as id,
        报价单号 as quotationNo,
        报价日期 as quotationDate,
        客户名称 as customerName,
        加工周期 as processingDate,
        更改通知单号 as changeOrderNo,
        加工零件名称 as partName,
        模具编号 as moldNo,
        申请更改部门 as department,
        申请更改人 as applicant,
        材料明细 as materialsJson,
        加工费用明细 as processesJson,
        其他费用 as otherFee,
        运输费用 as transportFee,
        加工数量 as quantity,
        含税价格 as taxIncludedPrice,
        创建时间 as createTime,
        更新时间 as updateTime
      FROM 报价单
      ${whereClause}
      ORDER BY 创建时间 DESC, 报价单ID DESC
      OFFSET ${offset} ROWS
      FETCH NEXT ${pageSizeNum} ROWS ONLY
    `

    const data = await query(dataQuery, params)

    // 解析JSON字段
    const quotations = data.map((row) => {
      let materials = []
      let processes = []
      try {
        materials = JSON.parse(row.materialsJson || '[]')
      } catch (e) {
        console.error('解析材料明细JSON失败:', e)
        materials = []
      }
      try {
        processes = JSON.parse(row.processesJson || '[]')
      } catch (e) {
        console.error('解析加工费用明细JSON失败:', e)
        processes = []
      }

      return {
        ...row,
        materials,
        processes
      }
    })

    res.json({
      code: 0,
      success: true,
      data: {
        list: quotations,
        total: total,
        page: pageNum,
        pageSize: pageSizeNum
      }
    })
  } catch (error) {
    console.error('获取报价单列表失败:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: '获取报价单列表失败',
      error: error.message
    })
  }
})

// 生成新的报价单编号
router.get('/generate-no', async (req, res) => {
  try {
    const quotationPrefix = 'BJ' // 报价的拼音首字母
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
    const quotationDate = `${year}${month}${day}` // YYYYMMDD

    // 查询最新的报价单编号
    // 注意：这里假设报价单表名为"报价单"，报价单号字段为"报价单号"
    // 如果表名或字段名不同，需要相应调整
    let serialNumber = 1

    try {
      const queryString = `
        SELECT TOP 1 报价单号 as quotationNo
        FROM 报价单
        WHERE 报价单号 LIKE 'BJ-%'
        ORDER BY 报价单号 DESC
      `

      const result = await query(queryString)

      if (result.length > 0 && result[0].quotationNo) {
        const lastQuotationNo = result[0].quotationNo
        // 解析报价单编号：BJ-YYYYMMDD-XXX
        const match = lastQuotationNo.match(/^BJ-(\d{8})-(\d{3})$/)

        if (match) {
          const lastDate = match[1]
          const lastSerial = parseInt(match[2], 10)

          // 如果是同一天，序列号递增；否则重置为1
          if (lastDate === quotationDate) {
            serialNumber = lastSerial + 1
          } else {
            serialNumber = 1
          }
        }
      }
    } catch (tableError) {
      // 如果表不存在或其他错误，记录日志但继续生成新编号（从001开始）
      console.warn('查询报价单表失败（可能是表不存在），将生成新的编号:', tableError.message)
      serialNumber = 1
    }

    // 格式化序列号为三位数
    const formattedSerial = String(serialNumber).padStart(3, '0')

    // 生成新报价单编号：BJ-YYYYMMDD-XXX
    const newQuotationNo = `${quotationPrefix}-${quotationDate}-${formattedSerial}`

    res.json({
      code: 0,
      success: true,
      data: { quotationNo: newQuotationNo }
    })
  } catch (error) {
    console.error('生成报价单编号失败:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: '生成报价单编号失败',
      error: error.message
    })
  }
})

// 创建报价单
router.post('/create', async (req, res) => {
  try {
    console.log('收到创建报价单请求，请求体:', JSON.stringify(req.body, null, 2))

    const {
      quotationNo,
      quotationDate,
      customerName,
      processingDate,
      changeOrderNo,
      partName,
      moldNo,
      department,
      applicant,
      materials,
      processes,
      otherFee,
      transportFee,
      quantity
    } = req.body

    // 验证必填字段
    if (!quotationNo) {
      console.log('验证失败: 报价单号为空')
      return res.status(400).json({
        code: 400,
        success: false,
        message: '报价单号不能为空'
      })
    }

    if (!quotationDate) {
      console.log('验证失败: 报价日期为空')
      return res.status(400).json({
        code: 400,
        success: false,
        message: '报价日期不能为空'
      })
    }

    if (!customerName) {
      console.log('验证失败: 客户名称为空')
      return res.status(400).json({
        code: 400,
        success: false,
        message: '客户名称不能为空'
      })
    }

    if (!processingDate) {
      console.log('验证失败: 加工周期为空')
      return res.status(400).json({
        code: 400,
        success: false,
        message: '加工周期不能为空'
      })
    }

    if (!partName) {
      console.log('验证失败: 加工零件名称为空')
      return res.status(400).json({
        code: 400,
        success: false,
        message: '加工零件名称不能为空'
      })
    }

    if (!moldNo) {
      console.log('验证失败: 模具编号为空')
      return res.status(400).json({
        code: 400,
        success: false,
        message: '模具编号不能为空'
      })
    }

    if (!department) {
      console.log('验证失败: 申请更改部门为空')
      return res.status(400).json({
        code: 400,
        success: false,
        message: '申请更改部门不能为空'
      })
    }

    if (!applicant) {
      console.log('验证失败: 申请更改人为空')
      return res.status(400).json({
        code: 400,
        success: false,
        message: '申请更改人不能为空'
      })
    }

    // 检查报价单号是否已存在
    const checkQuery = `
      SELECT COUNT(*) as count 
      FROM 报价单 
      WHERE 报价单号 = @quotationNo
    `
    const checkResult = await query(checkQuery, { quotationNo })
    if (checkResult[0].count > 0) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '报价单号已存在'
      })
    }

    // 计算含税价格
    const materialsTotal = (materials || []).reduce(
      (sum, item) => sum + (item.unitPrice || 0) * (item.quantity || 0),
      0
    )
    const processingTotal = (processes || []).reduce(
      (sum, item) => sum + (item.unitPrice || 0) * (item.hours || 0),
      0
    )
    const taxIncludedPrice =
      materialsTotal + processingTotal + (otherFee || 0) + (transportFee || 0)

    // 将材料明细和加工费用明细转换为JSON字符串
    const materialsJson = JSON.stringify(materials || [])
    const processesJson = JSON.stringify(processes || [])

    console.log('材料明细JSON:', materialsJson)
    console.log('加工费用明细JSON:', processesJson)

    // 使用 getPool 直接执行，以便正确处理 NVARCHAR(MAX) 类型
    const pool = await getPool()
    const request = pool.request()

    // 绑定参数
    request.input('quotationNo', sql.NVarChar(50), quotationNo)
    request.input('quotationDate', sql.Date, quotationDate)
    request.input('customerName', sql.NVarChar(200), customerName)
    request.input('processingDate', sql.Date, processingDate)
    request.input('changeOrderNo', sql.NVarChar(50), changeOrderNo || null)
    request.input('partName', sql.NVarChar(200), partName)
    request.input('moldNo', sql.NVarChar(100), moldNo)
    request.input('department', sql.NVarChar(100), department)
    request.input('applicant', sql.NVarChar(50), applicant)
    request.input('materialsJson', sql.NVarChar, materialsJson)
    request.input('processesJson', sql.NVarChar, processesJson)
    request.input('otherFee', sql.Decimal(18, 2), otherFee || 0)
    request.input('transportFee', sql.Decimal(18, 2), transportFee || 0)
    request.input('quantity', sql.Int, quantity || 1)
    request.input('taxIncludedPrice', sql.Decimal(18, 2), taxIncludedPrice)

    // 插入报价单
    const insertQuery = `
      INSERT INTO 报价单 (
        报价单号, 报价日期, 客户名称, 加工周期, 更改通知单号,
        加工零件名称, 模具编号, 申请更改部门, 申请更改人,
        材料明细, 加工费用明细, 其他费用, 运输费用, 加工数量, 含税价格
      ) VALUES (
        @quotationNo, @quotationDate, @customerName, @processingDate, @changeOrderNo,
        @partName, @moldNo, @department, @applicant,
        @materialsJson, @processesJson, @otherFee, @transportFee, @quantity, @taxIncludedPrice
      )
      SELECT SCOPE_IDENTITY() as id
    `

    const result = await request.query(insertQuery)

    const newId = result.recordset[0]?.id || result.rowsAffected[0]

    console.log('报价单创建成功，ID:', newId)

    res.json({
      code: 0,
      success: true,
      data: { id: newId },
      message: '创建报价单成功'
    })
  } catch (error) {
    console.error('创建报价单失败:', error)
    console.error('错误详情:', error)
    if (error.originalError) {
      console.error('原始错误:', error.originalError)
    }
    res.status(500).json({
      code: 500,
      success: false,
      message: '创建报价单失败',
      error: error.message || error.originalError?.message || '未知错误'
    })
  }
})

// 更新报价单
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const {
      quotationNo,
      quotationDate,
      customerName,
      processingDate,
      changeOrderNo,
      partName,
      moldNo,
      department,
      applicant,
      materials,
      processes,
      otherFee,
      transportFee,
      quantity
    } = req.body

    // 验证必填字段
    if (!quotationNo) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '报价单号不能为空'
      })
    }

    // 检查报价单是否存在
    const checkQuery = `
      SELECT COUNT(*) as count 
      FROM 报价单 
      WHERE 报价单ID = @id
    `
    const checkResult = await query(checkQuery, { id: parseInt(id) })
    if (checkResult[0].count === 0) {
      return res.status(404).json({
        code: 404,
        success: false,
        message: '报价单不存在'
      })
    }

    // 检查报价单号是否被其他记录使用
    const checkNoQuery = `
      SELECT COUNT(*) as count 
      FROM 报价单 
      WHERE 报价单号 = @quotationNo AND 报价单ID != @id
    `
    const checkNoResult = await query(checkNoQuery, { quotationNo, id: parseInt(id) })
    if (checkNoResult[0].count > 0) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '报价单号已被其他记录使用'
      })
    }

    // 计算含税价格
    const materialsTotal = (materials || []).reduce(
      (sum, item) => sum + (item.unitPrice || 0) * (item.quantity || 0),
      0
    )
    const processingTotal = (processes || []).reduce(
      (sum, item) => sum + (item.unitPrice || 0) * (item.hours || 0),
      0
    )
    const taxIncludedPrice =
      materialsTotal + processingTotal + (otherFee || 0) + (transportFee || 0)

    // 将材料明细和加工费用明细转换为JSON字符串
    const materialsJson = JSON.stringify(materials || [])
    const processesJson = JSON.stringify(processes || [])

    // 使用 getPool 直接执行，以便正确处理 NVARCHAR(MAX) 类型
    const pool = await getPool()
    const request = pool.request()

    // 绑定参数
    request.input('id', sql.Int, parseInt(id))
    request.input('quotationNo', sql.NVarChar(50), quotationNo)
    request.input('quotationDate', sql.Date, quotationDate)
    request.input('customerName', sql.NVarChar(200), customerName)
    request.input('processingDate', sql.Date, processingDate)
    request.input('changeOrderNo', sql.NVarChar(50), changeOrderNo || null)
    request.input('partName', sql.NVarChar(200), partName)
    request.input('moldNo', sql.NVarChar(100), moldNo)
    request.input('department', sql.NVarChar(100), department)
    request.input('applicant', sql.NVarChar(50), applicant)
    request.input('materialsJson', sql.NVarChar, materialsJson)
    request.input('processesJson', sql.NVarChar, processesJson)
    request.input('otherFee', sql.Decimal(18, 2), otherFee || 0)
    request.input('transportFee', sql.Decimal(18, 2), transportFee || 0)
    request.input('quantity', sql.Int, quantity || 1)
    request.input('taxIncludedPrice', sql.Decimal(18, 2), taxIncludedPrice)

    // 更新报价单
    const updateQuery = `
      UPDATE 报价单 SET
        报价单号 = @quotationNo,
        报价日期 = @quotationDate,
        客户名称 = @customerName,
        加工周期 = @processingDate,
        更改通知单号 = @changeOrderNo,
        加工零件名称 = @partName,
        模具编号 = @moldNo,
        申请更改部门 = @department,
        申请更改人 = @applicant,
        材料明细 = @materialsJson,
        加工费用明细 = @processesJson,
        其他费用 = @otherFee,
        运输费用 = @transportFee,
        加工数量 = @quantity,
        含税价格 = @taxIncludedPrice,
        更新时间 = GETDATE()
      WHERE 报价单ID = @id
    `

    await request.query(updateQuery)

    res.json({
      code: 0,
      success: true,
      message: '更新报价单成功'
    })
  } catch (error) {
    console.error('更新报价单失败:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: '更新报价单失败',
      error: error.message
    })
  }
})

module.exports = router
