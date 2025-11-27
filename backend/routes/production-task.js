const express = require('express')
const { query } = require('../database')
const router = express.Router()

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
    const { keyword, status, page = 1, pageSize = 10, sortField, sortOrder } = req.query

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
    } else {
      // 默认排除已完成（保留状态为空的记录）
      whereConditions.push(`(pt.生产状态 IS NULL OR pt.生产状态 <> @excludeStatus) `)
      params.excludeStatus = '已完成'
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
        pt.抛光工时,
        pt.机加工时,
        pt.装配工时,
        pt.加工中心工时,
        pt.线切割工时,
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
        pt.抛光工时,
        pt.机加工时,
        pt.装配工时,
        pt.加工中心工时,
        pt.线切割工时,
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
      '抛光工时',
      '机加工时',
      '装配工时',
      '加工中心工时',
      '线切割工时'
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
