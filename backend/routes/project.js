const express = require('express')
const { query } = require('../database')
const router = express.Router()

// 获取项目信息列表
router.get('/list', async (req, res) => {
  try {
    const { keyword, status, page = 1, pageSize = 10 } = req.query
    
    let whereConditions = []
    let params = {}
    
    // 构建查询条件
    if (keyword) {
      whereConditions.push(`(p.项目编号 LIKE @keyword OR p.项目名称 LIKE @keyword)`)
      params.keyword = `%${keyword}%`
    }
    
    if (status) {
      whereConditions.push(`p.项目状态 = @status`)
      params.status = status
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''
    
    // 计算分页
    const offset = (page - 1) * pageSize
    
    // 查询总数
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM 项目管理 p
      ${whereClause}
    `
    const countResult = await query(countQuery, params)
    const total = countResult[0].total
    
    // 查询数据
    const dataQuery = `
      SELECT * FROM 项目管理 p
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

// 获取单个项目信息
router.get('/:projectCode', async (req, res) => {
  try {
    const { projectCode } = req.params
    
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
    
    Object.keys(data).forEach(key => {
      if (data[key] !== undefined && data[key] !== null && data[key] !== '') {
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

// 更新项目信息
router.put('/:projectCode', async (req, res) => {
  try {
    const { projectCode } = req.params
    const data = req.body
    
    // 构建动态更新字段
    const updates = []
    const params = { projectCode }
    
    Object.keys(data).forEach(key => {
      if (key !== '项目编号' && data[key] !== undefined && data[key] !== null) {
        updates.push(`[${key}] = @${key}`)
        params[key] = data[key]
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

// 删除项目信息
router.delete('/:projectCode', async (req, res) => {
  try {
    const { projectCode } = req.params
    
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
