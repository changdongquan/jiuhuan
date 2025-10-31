const express = require('express')
const { query, getPool } = require('../database')
const sql = require('mssql')
const router = express.Router()

// 获取新品货物列表（IsNew=1）
// 只返回在项目管理表中有记录的货物，避免外键约束错误
router.get('/new-products', async (req, res) => {
  try {
    const dataQuery = `
      SELECT 
        g.货物ID as id,
        g.项目编号 as itemCode,
        g.产品图号 as productDrawingNo,
        g.产品名称 as productName,
        g.分类 as category,
        g.备注 as remarks,
        c.客户名称 as customerName,
        p.客户模号 as customerPartNo
      FROM 货物信息 g
      INNER JOIN 项目管理 p ON g.项目编号 = p.项目编号
      LEFT JOIN 客户信息 c ON p.客户ID = c.客户ID
      WHERE g.IsNew = 1 AND g.项目编号 IS NOT NULL AND g.项目编号 != ''
      ORDER BY g.货物ID DESC
    `

    const data = await query(dataQuery)

    res.json({
      code: 0,
      success: true,
      data: {
        list: data
      }
    })
  } catch (error) {
    console.error('获取新品货物列表失败:', error)
    res.status(500).json({
      success: false,
      message: '获取新品货物列表失败',
      error: error.message
    })
  }
})

// 获取货物信息列表
router.get('/list', async (req, res) => {
  try {
    const { keyword, customerName, category, page = 1, pageSize = 10 } = req.query

    let whereConditions = []
    let params = {}

    // 构建查询条件
    if (keyword) {
      whereConditions.push(
        `(g.项目编号 LIKE @keyword OR g.产品名称 LIKE @keyword OR g.产品图号 LIKE @keyword)`
      )
      params.keyword = `%${keyword}%`
    }

    if (customerName) {
      // 暂时注释掉客户名称查询，因为数据库中可能没有这个字段
      // whereConditions.push(`客户名称 LIKE @customerName`)
      // params.customerName = `%${customerName}%`
    }

    if (category) {
      whereConditions.push(`g.分类 = @category`)
      params.category = category
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

    // 计算分页
    const offset = (page - 1) * pageSize

    // 查询总数
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM 货物信息 g
      LEFT JOIN 项目管理 p ON g.项目编号 = p.项目编号
      LEFT JOIN 客户信息 c ON p.客户ID = c.客户ID
      ${whereClause}
    `
    const countResult = await query(countQuery, params)
    const total = countResult[0].total

    // 查询数据
    const dataQuery = `
      SELECT 
        g.货物ID as id,
        g.项目编号 as projectCode,
        g.产品图号 as productDrawing,
        g.产品名称 as productName,
        g.分类 as category,
        g.备注 as remarks,
        c.客户名称 as customerName,
        p.客户模号 as customerModelNo
      FROM 货物信息 g
      LEFT JOIN 项目管理 p ON g.项目编号 = p.项目编号
      LEFT JOIN 客户信息 c ON p.客户ID = c.客户ID
      ${whereClause}
      ORDER BY g.货物ID DESC
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
    console.error('获取货物信息列表失败:', error)
    res.status(500).json({
      success: false,
      message: '获取货物信息列表失败',
      error: error.message
    })
  }
})

// 获取单个货物信息
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params

    const queryString = `
      SELECT 
        g.货物ID as id,
        g.项目编号 as projectCode,
        g.产品图号 as productDrawing,
        g.产品名称 as productName,
        g.分类 as category,
        g.备注 as remarks,
        c.客户名称 as customerName,
        p.客户模号 as customerModelNo
      FROM 货物信息 g
      LEFT JOIN 项目管理 p ON g.项目编号 = p.项目编号
      LEFT JOIN 客户信息 c ON p.客户ID = c.客户ID
      WHERE g.货物ID = @id
    `

    const result = await query(queryString, { id: parseInt(id) })

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: '货物信息不存在'
      })
    }

    res.json({
      code: 0,
      success: true,
      data: result[0]
    })
  } catch (error) {
    console.error('获取货物信息失败:', error)
    res.status(500).json({
      success: false,
      message: '获取货物信息失败',
      error: error.message
    })
  }
})

// 新增货物信息
router.post('/', async (req, res) => {
  try {
    const { projectCode, productDrawing, productName, category, remarks } = req.body

    const pool = await getPool()

    // 检查项目编号是否已存在
    const checkRequest = pool.request()
    checkRequest.input('projectCode', sql.NVarChar, projectCode)
    const checkResult = await checkRequest.query(`
      SELECT COUNT(*) as count 
      FROM 货物信息 
      WHERE 项目编号 = @projectCode
    `)

    if (checkResult.recordset[0].count > 0) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: `项目编号 "${projectCode}" 已存在，不允许重复`
      })
    }

    // 第一步：插入数据（不指定 IsNew，允许为 NULL）
    const insertRequest = pool.request()
    insertRequest.input('projectCode', sql.NVarChar, projectCode)
    insertRequest.input('productDrawing', sql.NVarChar, productDrawing || null)
    insertRequest.input('productName', sql.NVarChar, productName || null)
    insertRequest.input('category', sql.NVarChar, category || null)
    insertRequest.input('remarks', sql.NVarChar, remarks || null)

    const insertQuery = `
      INSERT INTO 货物信息 
      (项目编号, 产品图号, 产品名称, 分类, 备注)
      VALUES 
      (@projectCode, @productDrawing, @productName, @category, @remarks)
      SELECT SCOPE_IDENTITY() as id
    `

    const insertResult = await insertRequest.query(insertQuery)
    const newId = insertResult.recordset[0].id

    // 第二步：立即更新 IsNew 为 1（使用 UPDATE，我们知道这个操作是可行的）
    const updateRequest = pool.request()
    updateRequest.input('id', sql.Int, newId)
    const updateQuery = `UPDATE 货物信息 SET IsNew = 1 WHERE 货物ID = @id`
    await updateRequest.query(updateQuery)

    // 验证更新结果
    const verifyRequest = pool.request()
    verifyRequest.input('id', sql.Int, newId)
    const verifyResult = await verifyRequest.query(`
      SELECT IsNew, CAST(IsNew AS INT) as IsNewInt 
      FROM 货物信息 
      WHERE 货物ID = @id
    `)

    if (verifyResult.recordset[0].IsNewInt !== 1) {
      console.error('警告：IsNew 更新失败，值为:', verifyResult.recordset[0].IsNewInt)
    } else {
      console.log('✅ IsNew 已成功设置为 1')
    }

    res.json({
      code: 0,
      success: true,
      data: { id: newId },
      message: '新增货物信息成功'
    })
  } catch (error) {
    console.error('新增货物信息失败:', error)
    res.status(500).json({
      success: false,
      message: '新增货物信息失败',
      error: error.message
    })
  }
})

// 更新货物信息
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { projectCode, productDrawing, productName, category, remarks } = req.body

    const queryString = `
      UPDATE 货物信息 SET
        项目编号 = @projectCode,
        产品图号 = @productDrawing,
        产品名称 = @productName,
        分类 = @category,
        备注 = @remarks
      WHERE 货物ID = @id
    `

    await query(queryString, {
      id: parseInt(id),
      projectCode,
      productDrawing,
      productName,
      category,
      remarks
    })

    res.json({
      code: 0,
      success: true,
      message: '更新货物信息成功'
    })
  } catch (error) {
    console.error('更新货物信息失败:', error)
    res.status(500).json({
      success: false,
      message: '更新货物信息失败',
      error: error.message
    })
  }
})

// 删除货物信息
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params

    const queryString = `DELETE FROM 货物信息 WHERE 货物ID = @id`

    await query(queryString, { id: parseInt(id) })

    res.json({
      code: 0,
      success: true,
      message: '删除货物信息成功'
    })
  } catch (error) {
    console.error('删除货物信息失败:', error)
    res.status(500).json({
      success: false,
      message: '删除货物信息失败',
      error: error.message
    })
  }
})

// 批量删除货物信息
router.delete('/batch', async (req, res) => {
  try {
    const { ids } = req.body

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请提供有效的ID列表'
      })
    }

    const placeholders = ids.map((_, index) => `@id${index}`).join(',')
    const queryString = `DELETE FROM 货物信息 WHERE 货物ID IN (${placeholders})`

    const params = {}
    ids.forEach((id, index) => {
      params[`id${index}`] = parseInt(id)
    })

    await query(queryString, params)

    res.json({
      code: 0,
      success: true,
      message: '批量删除货物信息成功'
    })
  } catch (error) {
    console.error('批量删除货物信息失败:', error)
    res.status(500).json({
      success: false,
      message: '批量删除货物信息失败',
      error: error.message
    })
  }
})

// 获取指定分类的最大序号
router.get('/max-serial/:category', async (req, res) => {
  try {
    const { category } = req.params

    const queryString = `
      SELECT ISNULL(MAX(
        CASE 
          WHEN LEN(项目编号) >= 11 AND ISNUMERIC(SUBSTRING(项目编号, 9, 3)) = 1 
          THEN CAST(SUBSTRING(项目编号, 9, 3) AS INT)
          ELSE 0
        END
      ), 0) as maxSerial
      FROM 货物信息 
      WHERE 项目编号 LIKE @pattern
        AND LEN(项目编号) >= 11
        AND ISNUMERIC(SUBSTRING(项目编号, 9, 3)) = 1
    `

    const pattern = `JH${category}-%-%`
    const result = await query(queryString, { pattern })

    res.json({
      code: 0,
      success: true,
      data: {
        maxSerial: result[0].maxSerial,
        nextSerial: result[0].maxSerial + 1
      }
    })
  } catch (error) {
    console.error('获取最大序号失败:', error)
    res.status(500).json({
      success: false,
      message: '获取最大序号失败',
      error: error.message
    })
  }
})

module.exports = router
