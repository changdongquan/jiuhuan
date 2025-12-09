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
      -- 按项目编号正序排列，确保“从新品中选择”弹窗中项目编号从小到大显示
      ORDER BY g.项目编号 ASC, g.货物ID ASC
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
    const {
      keyword,
      customerName,
      category,
      page = 1,
      pageSize = 10,
      sortField,
      sortOrder
    } = req.query

    let whereConditions = []
    let params = {}

    // 构建查询条件
    if (keyword) {
      whereConditions.push(
        `(g.项目编号 LIKE @keyword OR g.产品名称 LIKE @keyword OR g.产品图号 LIKE @keyword OR p.客户模号 LIKE @keyword)`
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

    // 排序字段白名单映射，防止 SQL 注入
    const sortableFields = {
      projectCode: 'g.项目编号',
      productName: 'g.产品名称',
      productDrawing: 'g.产品图号',
      customerModelNo: 'p.客户模号',
      customerName: 'c.客户名称'
    }

    let orderByClause = 'ORDER BY g.货物ID DESC'
    const mappedField = sortField && sortableFields[sortField]
    const sortDir = (sortOrder || '').toString().toLowerCase()
    if (mappedField && (sortDir === 'asc' || sortDir === 'desc')) {
      orderByClause = `ORDER BY ${mappedField} ${sortDir.toUpperCase()}, g.货物ID DESC`
    }

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
      ${orderByClause}
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
    const {
      projectCode,
      productDrawing,
      productName,
      category,
      remarks,
      customerName,
      customerModelNo
    } = req.body

    // 验证必填字段
    if (!projectCode || !projectCode.trim()) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '项目编号不能为空'
      })
    }

    const pool = await getPool()

    // 检查项目编号是否已在货物信息表中存在
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

    // 根据客户名称查找客户ID（如果提供了客户名称）
    let customerId = null
    if (customerName) {
      const customerQuery = pool.request()
      customerQuery.input('customerName', sql.NVarChar, customerName)
      const customerResult = await customerQuery.query(`
        SELECT 客户ID as customerId
        FROM 客户信息
        WHERE 客户名称 = @customerName
      `)

      if (customerResult.recordset.length > 0) {
        customerId = customerResult.recordset[0].customerId
        console.log(`找到客户ID: ${customerId} (客户名称: ${customerName})`)
      } else {
        console.warn(`未找到客户: ${customerName}`)
      }
    }

    // 检查项目编号是否在项目管理表中存在（外键约束要求）
    // 如果不存在，自动创建一条记录以满足外键约束
    // 如果存在，更新客户ID和客户模号
    const checkProjectRequest = pool.request()
    checkProjectRequest.input('projectCode', sql.NVarChar, projectCode)
    const checkProjectResult = await checkProjectRequest.query(`
      SELECT COUNT(*) as count 
      FROM 项目管理 
      WHERE 项目编号 = @projectCode
    `)

    if (checkProjectResult.recordset[0].count === 0) {
      // 如果项目管理表中不存在，创建一条记录
      const createProjectRequest = pool.request()
      createProjectRequest.input('projectCode', sql.NVarChar, projectCode)

      if (customerId) {
        createProjectRequest.input('customerId', sql.Int, customerId)
        createProjectRequest.input('customerModelNo', sql.NVarChar, customerModelNo || null)
        await createProjectRequest.query(`
          INSERT INTO 项目管理 (项目编号, 客户ID, 客户模号)
          VALUES (@projectCode, @customerId, @customerModelNo)
        `)
        console.log(
          `[自动创建] 已在项目管理表中创建项目编号: ${projectCode}, 客户ID: ${customerId}`
        )
      } else {
        await createProjectRequest.query(`
          INSERT INTO 项目管理 (项目编号)
          VALUES (@projectCode)
        `)
        console.log(`[自动创建] 已在项目管理表中创建项目编号: ${projectCode}`)
      }
    } else {
      // 如果项目管理表中已存在，更新客户ID和客户模号（如果提供了）
      if (customerId !== null) {
        const updateProjectRequest = pool.request()
        updateProjectRequest.input('projectCode', sql.NVarChar, projectCode)
        updateProjectRequest.input('customerId', sql.Int, customerId)
        updateProjectRequest.input('customerModelNo', sql.NVarChar, customerModelNo || null)
        await updateProjectRequest.query(`
          UPDATE 项目管理 
          SET 客户ID = @customerId, 客户模号 = @customerModelNo
          WHERE 项目编号 = @projectCode
        `)
        console.log(`[更新] 已更新项目管理记录，项目编号: ${projectCode}, 客户ID: ${customerId}`)
      }
    }

    // 第一步：先插入货物信息（生产任务表的外键引用货物信息表，必须先插入货物信息）
    // 插入数据（不指定 IsNew，允许为 NULL）
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

    // 第二步：在货物信息插入成功后，检查并创建生产任务记录（如果不存在）
    // 因为生产任务表的外键引用货物信息表，所以必须先插入货物信息
    try {
      const checkProductionTaskRequest = pool.request()
      checkProductionTaskRequest.input('projectCode', sql.NVarChar, projectCode)
      const checkProductionTaskResult = await checkProductionTaskRequest.query(`
        SELECT COUNT(*) as count 
        FROM 生产任务 
        WHERE 项目编号 = @projectCode
      `)

      if (checkProductionTaskResult.recordset[0].count === 0) {
        // 如果生产任务表中不存在，创建一条记录（只创建项目编号）
        const createProductionTaskRequest = pool.request()
        createProductionTaskRequest.input('projectCode', sql.NVarChar, projectCode)

        await createProductionTaskRequest.query(`
          INSERT INTO 生产任务 (项目编号)
          VALUES (@projectCode)
        `)
        console.log(`[自动创建] 已在生产任务表中创建项目编号: ${projectCode}`)
      } else {
        console.log(`[已存在] 生产任务表中已存在项目编号: ${projectCode}，跳过创建`)
      }
    } catch (productionTaskError) {
      console.error('创建生产任务记录失败:', productionTaskError)
      // 即使创建生产任务失败，也不影响货物信息的创建
      // 只是记录警告，不抛出错误
      console.warn('警告：无法创建生产任务记录，但货物信息已成功创建')
    }

    res.json({
      code: 0,
      success: true,
      data: { id: newId },
      message: '新增货物信息成功'
    })
  } catch (error) {
    console.error('新增货物信息失败:', error)
    console.error('错误详情:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      number: error.number,
      originalError: error.originalError
    })
    res.status(500).json({
      code: 500,
      success: false,
      message: '新增货物信息失败',
      error: error.message || '未知错误',
      details:
        process.env.NODE_ENV === 'development'
          ? {
              code: error.code,
              number: error.number,
              originalError: error.originalError
            }
          : undefined
    })
  }
})

// 更新货物信息
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const {
      projectCode,
      productDrawing,
      productName,
      category,
      remarks,
      customerName,
      customerModelNo
    } = req.body

    const pool = await getPool()

    // 根据客户名称查找客户ID（如果提供了客户名称）
    let customerId = null
    if (customerName) {
      const customerQuery = pool.request()
      customerQuery.input('customerName', sql.NVarChar, customerName)
      const customerResult = await customerQuery.query(`
        SELECT 客户ID as customerId
        FROM 客户信息
        WHERE 客户名称 = @customerName
      `)

      if (customerResult.recordset.length > 0) {
        customerId = customerResult.recordset[0].customerId
        console.log(`[更新] 找到客户ID: ${customerId} (客户名称: ${customerName})`)
      } else {
        console.warn(`[更新] 未找到客户: ${customerName}`)
      }
    }

    // 更新货物信息
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

    // 更新项目管理表中的客户ID和客户模号
    if (projectCode) {
      const updateProjectRequest = pool.request()
      updateProjectRequest.input('projectCode', sql.NVarChar, projectCode)

      if (customerId !== null) {
        // 如果有客户ID，更新客户ID和客户模号
        updateProjectRequest.input('customerId', sql.Int, customerId)
        updateProjectRequest.input('customerModelNo', sql.NVarChar, customerModelNo || null)
        await updateProjectRequest.query(`
          UPDATE 项目管理 
          SET 客户ID = @customerId, 客户模号 = @customerModelNo
          WHERE 项目编号 = @projectCode
        `)
        console.log(`[更新] 已更新项目管理记录，项目编号: ${projectCode}, 客户ID: ${customerId}`)
      } else if (customerName === '' || customerName === null) {
        // 如果客户名称为空，清除客户ID和客户模号
        await updateProjectRequest.query(`
          UPDATE 项目管理 
          SET 客户ID = NULL, 客户模号 = NULL
          WHERE 项目编号 = @projectCode
        `)
        console.log(`[更新] 已清除项目管理记录中的客户信息，项目编号: ${projectCode}`)
      }
    }

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
    const pool = await getPool()

    // 首先获取要删除的货物信息的项目编号
    const getProjectCodeRequest = pool.request()
    getProjectCodeRequest.input('id', sql.Int, parseInt(id))
    const goodsResult = await getProjectCodeRequest.query(`
      SELECT 项目编号 
      FROM 货物信息 
      WHERE 货物ID = @id
    `)

    if (goodsResult.recordset.length === 0) {
      return res.status(404).json({
        code: 404,
        success: false,
        message: '货物信息不存在'
      })
    }

    const projectCode = goodsResult.recordset[0].项目编号

    // 检查该项目编号是否在生产任务表中存在（外键约束）
    if (projectCode) {
      const checkProductionTaskRequest = pool.request()
      checkProductionTaskRequest.input('projectCode', sql.NVarChar, projectCode)
      const productionTaskResult = await checkProductionTaskRequest.query(`
        SELECT COUNT(*) as count 
        FROM 生产任务 
        WHERE 项目编号 = @projectCode
      `)

      if (productionTaskResult.recordset[0].count > 0) {
        // 如果存在生产任务记录，需要先删除生产任务记录（因为外键约束）
        // 或者给出明确的错误提示
        const deleteProductionTaskRequest = pool.request()
        deleteProductionTaskRequest.input('projectCode', sql.NVarChar, projectCode)
        await deleteProductionTaskRequest.query(`
          DELETE FROM 生产任务 
          WHERE 项目编号 = @projectCode
        `)
        console.log(`[删除] 已删除生产任务记录，项目编号: ${projectCode}`)
      }
    }

    // 删除货物信息
    const deleteRequest = pool.request()
    deleteRequest.input('id', sql.Int, parseInt(id))
    await deleteRequest.query(`DELETE FROM 货物信息 WHERE 货物ID = @id`)

    res.json({
      code: 0,
      success: true,
      message: '删除货物信息成功'
    })
  } catch (error) {
    console.error('删除货物信息失败:', error)
    console.error('错误详情:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      number: error.number,
      originalError: error.originalError
    })
    res.status(500).json({
      code: 500,
      success: false,
      message: '删除货物信息失败',
      error: error.message || '未知错误',
      details:
        process.env.NODE_ENV === 'development'
          ? {
              code: error.code,
              number: error.number,
              originalError: error.originalError
            }
          : undefined
    })
  }
})

// 批量删除货物信息
router.delete('/batch', async (req, res) => {
  try {
    const { ids } = req.body

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '请提供有效的ID列表'
      })
    }

    const pool = await getPool()

    // 首先获取要删除的所有货物信息的项目编号
    const placeholders = ids.map((_, index) => `@id${index}`).join(',')
    const getProjectCodesRequest = pool.request()
    ids.forEach((id, index) => {
      getProjectCodesRequest.input(`id${index}`, sql.Int, parseInt(id))
    })
    const goodsResult = await getProjectCodesRequest.query(`
      SELECT DISTINCT 项目编号 
      FROM 货物信息 
      WHERE 货物ID IN (${placeholders}) AND 项目编号 IS NOT NULL AND 项目编号 != ''
    `)

    // 删除相关的生产任务记录（如果存在）
    if (goodsResult.recordset.length > 0) {
      const projectCodes = goodsResult.recordset.map((row) => row.项目编号).filter(Boolean)
      if (projectCodes.length > 0) {
        const projectCodePlaceholders = projectCodes.map((_, index) => `@pc${index}`).join(',')
        const deleteProductionTaskRequest = pool.request()
        projectCodes.forEach((projectCode, index) => {
          deleteProductionTaskRequest.input(`pc${index}`, sql.NVarChar, projectCode)
        })
        await deleteProductionTaskRequest.query(`
          DELETE FROM 生产任务 
          WHERE 项目编号 IN (${projectCodePlaceholders})
        `)
        console.log(`[批量删除] 已删除 ${projectCodes.length} 条生产任务记录`)
      }
    }

    // 删除货物信息
    const deleteRequest = pool.request()
    ids.forEach((id, index) => {
      deleteRequest.input(`id${index}`, sql.Int, parseInt(id))
    })
    await deleteRequest.query(`DELETE FROM 货物信息 WHERE 货物ID IN (${placeholders})`)

    res.json({
      code: 0,
      success: true,
      message: '批量删除货物信息成功'
    })
  } catch (error) {
    console.error('批量删除货物信息失败:', error)
    console.error('错误详情:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      number: error.number,
      originalError: error.originalError
    })
    res.status(500).json({
      code: 500,
      success: false,
      message: '批量删除货物信息失败',
      error: error.message || '未知错误',
      details:
        process.env.NODE_ENV === 'development'
          ? {
              code: error.code,
              number: error.number,
              originalError: error.originalError
            }
          : undefined
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
