const express = require('express')
const { query } = require('../database')
const router = express.Router()

// 生成新的订单编号
// 格式：XS-YYYYMMDD-XXX
// XS：销售订单前缀
// YYYYMMDD：当前日期
// XXX：三位序列号（同一天内递增，跨天重置为001）
router.get('/generate-order-no', async (req, res) => {
  try {
    const orderPrefix = 'XS'
    const today = new Date()
    const orderDate = today.toISOString().slice(0, 10).replace(/-/g, '') // YYYYMMDD

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
      // 按订单日期降序，如果日期相同则按订单号排序
      if (a.orderDate && b.orderDate) {
        return new Date(b.orderDate) - new Date(a.orderDate)
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

// 获取销售订单统计信息
router.get('/statistics', async (req, res) => {
  try {
    const queryString = `
      SELECT 
        COUNT(*) as totalOrders,
        SUM(总金额) as totalAmount,
        SUM(数量) as totalQuantity,
        SUM(CASE WHEN 是否入库 = 1 THEN 1 ELSE 0 END) as inStockCount,
        SUM(CASE WHEN 是否出运 = 1 THEN 1 ELSE 0 END) as shippedCount,
        SUM(CASE WHEN 是否入库 = 0 THEN 1 ELSE 0 END) as notInStockCount,
        SUM(CASE WHEN 是否出运 = 0 THEN 1 ELSE 0 END) as notShippedCount
      FROM 销售订单
    `

    const result = await query(queryString)

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

module.exports = router
