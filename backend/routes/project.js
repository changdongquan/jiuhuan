const express = require('express')
const { query } = require('../database')
const router = express.Router()

// 获取项目统计信息（需要在其他路由之前定义）
router.get('/statistics', async (req, res) => {
  try {
    const queryString = `
      SELECT 
        COUNT(*) as totalProjects,
        SUM(CASE WHEN 项目状态 = 'T0' THEN 1 ELSE 0 END) as t0Projects,
        SUM(CASE WHEN 项目状态 = '设计中' THEN 1 ELSE 0 END) as designingProjects,
        SUM(CASE WHEN 项目状态 = '加工中' THEN 1 ELSE 0 END) as processingProjects,
        SUM(CASE WHEN 项目状态 = '表面处理' THEN 1 ELSE 0 END) as surfaceTreatingProjects,
        SUM(CASE WHEN 项目状态 = '已经移模' THEN 1 ELSE 0 END) as completedProjects
      FROM 项目管理
    `

    const result = await query(queryString)

    res.json({
      code: 0,
      success: true,
      data: result[0]
    })
  } catch (error) {
    console.error('获取项目统计信息失败:', error)
    res.status(500).json({
      success: false,
      message: '获取项目统计信息失败',
      error: error.message
    })
  }
})

// 获取项目信息列表
router.get('/list', async (req, res) => {
  try {
    const { keyword, status, category, page = 1, pageSize = 10 } = req.query

    let whereConditions = []
    let params = {}

    // 构建查询条件
    if (keyword) {
      whereConditions.push(
        `(p.项目编号 LIKE @keyword OR p.项目名称 LIKE @keyword OR g.产品名称 LIKE @keyword OR g.产品图号 LIKE @keyword OR p.客户模号 LIKE @keyword)`
      )
      params.keyword = `%${keyword}%`
    }

    if (status) {
      whereConditions.push(`p.项目状态 = @status`)
      params.status = status
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
      FROM 项目管理 p
      LEFT JOIN 货物信息 g ON p.项目编号 = g.项目编号
      ${whereClause}
    `
    const countResult = await query(countQuery, params)
    const total = countResult[0].total

    // 查询数据
    const dataQuery = `
      SELECT 
        p.*,
        g.产品名称 as productName,
        g.产品图号 as productDrawing
      FROM 项目管理 p
      LEFT JOIN 货物信息 g ON p.项目编号 = g.项目编号
      ${whereClause}
      ORDER BY p.项目编号 DESC
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
    console.error('获取项目信息列表失败:', error)
    res.status(500).json({
      success: false,
      message: '获取项目信息列表失败',
      error: error.message
    })
  }
})

// 根据项目编号获取货物信息（产品名称和产品图号）
router.get('/goods/:projectCode', async (req, res) => {
  try {
    const { projectCode } = req.params

    const queryString = `
      SELECT TOP 1
        产品图号 as productDrawing,
        产品名称 as productName
      FROM 货物信息
      WHERE 项目编号 = @projectCode
    `

    const result = await query(queryString, { projectCode })

    if (result.length === 0) {
      return res.json({
        code: 0,
        success: true,
        data: null
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

// 获取单个项目信息（使用 query 参数，避免项目编号包含斜杠的问题）
router.get('/detail', async (req, res) => {
  try {
    const { projectCode } = req.query

    if (!projectCode) {
      return res.status(400).json({
        success: false,
        message: '项目编号不能为空'
      })
    }

    const queryString = `SELECT * FROM 项目管理 WHERE 项目编号 = @projectCode`

    const result = await query(queryString, { projectCode })

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: '项目信息不存在'
      })
    }

    res.json({
      code: 0,
      success: true,
      data: result[0]
    })
  } catch (error) {
    console.error('获取项目信息失败:', error)
    res.status(500).json({
      success: false,
      message: '获取项目信息失败',
      error: error.message
    })
  }
})

// 新增项目信息
router.post('/', async (req, res) => {
  try {
    const data = req.body

    // 构建动态字段
    const fields = []
    const values = []
    const params = {}

    Object.keys(data).forEach((key) => {
      // 过滤掉 SSMA_TimeStamp 字段（这是数据库迁移字段，不应通过API修改）
      if (
        key !== 'SSMA_TimeStamp' &&
        data[key] !== undefined &&
        data[key] !== null &&
        data[key] !== ''
      ) {
        fields.push(`[${key}]`)
        values.push(`@${key}`)
        params[key] = data[key]
      }
    })

    if (fields.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请至少提供一个字段'
      })
    }

    const queryString = `
      INSERT INTO 项目管理 (${fields.join(', ')})
      VALUES (${values.join(', ')})
    `

    await query(queryString, params)

    res.json({
      code: 0,
      success: true,
      message: '新增项目信息成功'
    })
  } catch (error) {
    console.error('新增项目信息失败:', error)
    res.status(500).json({
      success: false,
      message: '新增项目信息失败',
      error: error.message
    })
  }
})

// 更新项目信息（使用 body 中的 projectCode，避免路径参数包含斜杠的问题）
router.put('/update', async (req, res) => {
  try {
    const { projectCode, ...data } = req.body

    if (!projectCode) {
      return res.status(400).json({
        success: false,
        message: '项目编号不能为空'
      })
    }

    // 构建动态更新字段
    const updates = []
    const params = { projectCode }

    Object.keys(data).forEach((key) => {
      const value = data[key]
      // 过滤掉项目编号字段、SSMA_TimeStamp 字段，以及 undefined 和 null（允许空字符串和数字0）
      if (key !== '项目编号' && key !== 'SSMA_TimeStamp' && value !== undefined && value !== null) {
        updates.push(`[${key}] = @${key}`)
        params[key] = value
      }
    })

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请至少提供一个要更新的字段'
      })
    }

    const queryString = `
      UPDATE 项目管理 
      SET ${updates.join(', ')}
      WHERE 项目编号 = @projectCode
    `

    await query(queryString, params)

    res.json({
      code: 0,
      success: true,
      message: '更新项目信息成功'
    })
  } catch (error) {
    console.error('更新项目信息失败:', error)
    res.status(500).json({
      success: false,
      message: '更新项目信息失败',
      error: error.message
    })
  }
})

// 删除项目信息（使用 query 参数，避免路径参数包含斜杠的问题）
router.delete('/delete', async (req, res) => {
  try {
    const { projectCode } = req.query

    if (!projectCode) {
      return res.status(400).json({
        success: false,
        message: '项目编号不能为空'
      })
    }

    const queryString = `DELETE FROM 项目管理 WHERE 项目编号 = @projectCode`

    await query(queryString, { projectCode })

    res.json({
      code: 0,
      success: true,
      message: '删除项目信息成功'
    })
  } catch (error) {
    console.error('删除项目信息失败:', error)
    res.status(500).json({
      success: false,
      message: '删除项目信息失败',
      error: error.message
    })
  }
})

module.exports = router
