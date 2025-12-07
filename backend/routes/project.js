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
    const { keyword, status, category, page = 1, pageSize = 10, sortField, sortOrder } = req.query

    let whereConditions = []
    let params = {}

    // 构建查询条件
    if (keyword) {
      // 关键词搜索：需要在子查询中检查货物信息，排除 IsNew = 1 的记录
      whereConditions.push(`(
        p.项目编号 LIKE @keyword 
        OR p.项目名称 LIKE @keyword 
        OR p.客户模号 LIKE @keyword
        OR EXISTS (
          SELECT 1 
          FROM 货物信息 g_search 
          WHERE g_search.项目编号 = p.项目编号 
            AND CAST(g_search.IsNew AS INT) != 1
            AND (g_search.产品名称 LIKE @keyword OR g_search.产品图号 LIKE @keyword)
        )
      )`)
      params.keyword = `%${keyword}%`
    }

    if (status && status.trim() !== '') {
      // 显式选择了项目状态时，按所选状态精确筛选（兼容字段中可能存在的前后空格）
      whereConditions.push(`RTRIM(LTRIM(p.项目状态)) = @status`)
      params.status = status.trim()
    } else {
      // 默认情况下（未选择项目状态），不显示「已经移模」的记录
      // 兼容数据库中「已经移模」字段值前后可能存在空格的情况
      whereConditions.push(`RTRIM(LTRIM(ISNULL(p.项目状态, ''))) <> '已经移模'`)
    }

    // 分类条件：需要在子查询中检查货物信息，排除 IsNew = 1 的记录
    if (category) {
      whereConditions.push(`EXISTS (
        SELECT 1 
        FROM 货物信息 g_cat 
        WHERE g_cat.项目编号 = p.项目编号 
          AND g_cat.分类 = @category
          AND CAST(g_cat.IsNew AS INT) != 1
      )`)
      params.category = category
    }

    // 排除条件：不显示货物信息表中 IsNew = 1 的项目
    // 使用 NOT EXISTS 子查询，排除在货物信息表中存在 IsNew = 1 记录的项目
    const excludeCondition = `NOT EXISTS (
      SELECT 1 
      FROM 货物信息 g_exclude 
      WHERE g_exclude.项目编号 = p.项目编号 
        AND CAST(g_exclude.IsNew AS INT) = 1
    )`

    // 构建完整的 WHERE 子句
    const allConditions = [...whereConditions, excludeCondition]
    const finalWhereClause = allConditions.length > 0 ? `WHERE ${allConditions.join(' AND ')}` : ''

    // 计算分页
    const pageNum = parseInt(page)
    const pageSizeNum = parseInt(pageSize)
    const offset = (pageNum - 1) * pageSizeNum

    // 排序字段白名单映射（仅用于前端点击表头时）
    const sortableFields = {
      项目编号: 'p.项目编号',
      项目状态: 'p.项目状态',
      计划首样日期: 'p.计划首样日期',
      移模日期: 'p.移模日期'
    }

    let orderByClause = ''
    const mappedField = sortField && sortableFields[sortField]
    const sortDir = (sortOrder || '').toString().toLowerCase()
    if (mappedField && (sortDir === 'asc' || sortDir === 'desc')) {
      orderByClause = `ORDER BY ${mappedField} ${sortDir.toUpperCase()}`
    }

    // 如果没有任何排序参数，则使用默认排序规则
    if (!orderByClause) {
      // 默认排序规则：
      // 1. 计划首样日期在【今天前后 7 天之内】且“尚未送样”的项目排在最前面
      //    （尚未送样：首次送样日期为空）
      //    （即：|计划首样日期 - 今天| <= 7 天）
      // 2. 这组内部按计划首样日期从早到晚排序
      // 3. 其他项目按项目编号倒序（近似数据库倒序）
      orderByClause = `
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
          p.项目编号 DESC
      `
    }

    // 查询总数（需要排除 IsNew = 1 的项目）
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM 项目管理 p
      ${finalWhereClause}
    `
    const countResult = await query(countQuery, params)
    const total = countResult[0].total

    // 查询数据（需要排除 IsNew = 1 的项目）
    // 使用 TOP 1 获取每个项目的第一条货物信息（排除 IsNew = 1 的记录）
    const dataQuery = `
      SELECT 
        p.*,
        CONVERT(varchar(10), p.图纸下发日期, 23) as 图纸下发日期_fmt,
        (SELECT TOP 1 g1.产品名称 
         FROM 货物信息 g1 
         WHERE g1.项目编号 = p.项目编号 
           AND CAST(g1.IsNew AS INT) != 1
         ORDER BY g1.货物ID) as productName,
        (SELECT TOP 1 g1.产品图号 
         FROM 货物信息 g1 
         WHERE g1.项目编号 = p.项目编号 
           AND CAST(g1.IsNew AS INT) != 1
         ORDER BY g1.货物ID) as productDrawing
      FROM 项目管理 p
      ${finalWhereClause}
      ${orderByClause}
      OFFSET ${offset} ROWS
      FETCH NEXT ${pageSizeNum} ROWS ONLY
    `

    const data = await query(dataQuery, params)
    // 解决 p.* 与格式化列重名导致的数组问题：用格式化后的值覆盖
    const mapped = (data || []).map((row) => {
      if (row && row['图纸下发日期_fmt'] !== undefined) {
        row['图纸下发日期'] = row['图纸下发日期_fmt']
        delete row['图纸下发日期_fmt']
      }
      return row
    })

    res.json({
      code: 0,
      success: true,
      data: {
        list: mapped,
        total: total,
        page: pageNum,
        pageSize: pageSizeNum
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

// 根据项目编号获取货物信息（产品名称、产品图号、客户模号）
// 使用 query 参数，避免项目编号包含斜杠的问题
router.get('/goods', async (req, res) => {
  try {
    const { projectCode } = req.query

    if (!projectCode) {
      return res.status(400).json({
        success: false,
        message: '项目编号不能为空'
      })
    }

    const queryString = `
      SELECT TOP 1
        g.产品图号 as productDrawing,
        g.产品名称 as productName,
        p.客户模号 as customerModelNo
      FROM 货物信息 g
      LEFT JOIN 项目管理 p ON g.项目编号 = p.项目编号
      WHERE g.项目编号 = @projectCode
        AND (g.IsNew IS NULL OR CAST(g.IsNew AS INT) != 1)
      ORDER BY g.货物ID
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

    const queryString = `SELECT p.*, CONVERT(varchar(10), p.图纸下发日期, 23) as 图纸下发日期_fmt FROM 项目管理 p WHERE p.项目编号 = @projectCode`

    const result = await query(queryString, { projectCode })
    if (result && result[0] && result[0]['图纸下发日期_fmt'] !== undefined) {
      result[0]['图纸下发日期'] = result[0]['图纸下发日期_fmt']
      delete result[0]['图纸下发日期_fmt']
    }

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
      // 过滤掉项目编号字段、SSMA_TimeStamp 字段，以及 undefined（允许显式传 null 来将字段置为 NULL）
      if (key !== '项目编号' && key !== 'SSMA_TimeStamp' && value !== undefined) {
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
