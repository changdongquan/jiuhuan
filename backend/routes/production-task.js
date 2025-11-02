const express = require('express')
const { query } = require('../database')
const router = express.Router()

// 获取生产任务列表
router.get('/list', async (req, res) => {
  try {
    const { keyword, status, page = 1, pageSize = 10 } = req.query

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

    if (status) {
      whereConditions.push(`pt.生产状态 = @status`)
      params.status = status
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
        pt.批次完成数量,
        pt.批次完成时间,
        pt.下达日期,
        pt.放电工时,
        pt.检验工时,
        pt.编程工时,
        pt.试模工时,
        pt.机加工时,
        pt.装配工时,
        pt.加工中心工时,
        pt.线切割工时,
        g.产品名称 as productName,
        g.产品图号 as productDrawing,
        p.客户模号 as 客户模号
      FROM 生产任务 pt
      LEFT JOIN 货物信息 g ON pt.项目编号 = g.项目编号 AND CAST(g.IsNew AS INT) != 1
      LEFT JOIN 项目管理 p ON pt.项目编号 = p.项目编号
      ${whereClause}
      ORDER BY pt.项目编号 DESC
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
        COUNT(*) as total,
        SUM(CASE WHEN pt.生产状态 = '进行中' THEN 1 ELSE 0 END) as inProgress,
        SUM(CASE WHEN pt.生产状态 = '已完成' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN pt.生产状态 = '待开始' THEN 1 ELSE 0 END) as pending
      FROM 生产任务 pt
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
        pending: stats.pending || 0
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
        pt.批次完成数量,
        pt.批次完成时间,
        pt.下达日期,
        pt.放电工时,
        pt.检验工时,
        pt.编程工时,
        pt.试模工时,
        pt.机加工时,
        pt.装配工时,
        pt.加工中心工时,
        pt.线切割工时,
        g.产品名称 as productName,
        g.产品图号 as productDrawing,
        p.客户模号 as 客户模号
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
      '批次完成数量',
      '批次完成时间',
      '下达日期',
      '放电工时',
      '检验工时',
      '编程工时',
      '试模工时',
      '机加工时',
      '装配工时',
      '加工中心工时',
      '线切割工时'
    ]

    Object.keys(data).forEach((key) => {
      const value = data[key]
      // 只更新允许的字段，排除只读字段和undefined/null
      if (allowedFields.includes(key) && value !== undefined && value !== null) {
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
