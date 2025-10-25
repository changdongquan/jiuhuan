const express = require('express')
const { query } = require('../database')
const router = express.Router()

// 获取客户信息列表
router.get('/list', async (req, res) => {
  try {
    const { customerName, contact, status, page = 1, pageSize = 10 } = req.query
    
    let whereConditions = []
    let params = {}
    
    // 构建查询条件
    if (customerName) {
      whereConditions.push('客户名称 LIKE @customerName')
      params.customerName = `%${customerName}%`
    }
    
    if (contact) {
      whereConditions.push('联系人 LIKE @contact')
      params.contact = `%${contact}%`
    }
    
    if (status) {
      if (status === 'active') {
        whereConditions.push('(是否停用 = 0 OR 是否停用 IS NULL)')
      } else if (status === 'inactive') {
        whereConditions.push('是否停用 = 1')
      }
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''
    
    // 计算分页
    const offset = (page - 1) * pageSize
    
    // 查询总数
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM 客户信息 
      ${whereClause}
    `
    const countResult = await query(countQuery, params)
    const total = countResult[0].total
    
    // 查询数据
    const dataQuery = `
      SELECT 
        客户ID as id,
        客户名称 as customerName,
        联系人 as contact,
        客户联系方式 as phone,
        客户地址 as address,
        客户邮箱 as email,
        CASE 
          WHEN 是否停用 = 1 THEN 'inactive'
          ELSE 'active'
        END as status,
        SeqNumber as seqNumber
      FROM 客户信息 
      ${whereClause}
      ORDER BY SeqNumber ASC
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
    console.error('获取客户信息列表失败:', error)
    res.status(500).json({
      success: false,
      message: '获取客户信息列表失败',
      error: error.message
    })
  }
})

// 获取客户统计信息
router.get('/statistics', async (req, res) => {
  try {
    const queryString = `
      SELECT 
        COUNT(*) as totalCustomers,
        SUM(CASE WHEN 是否停用 = 0 OR 是否停用 IS NULL THEN 1 ELSE 0 END) as activeCustomers,
        SUM(CASE WHEN 是否停用 = 1 THEN 1 ELSE 0 END) as inactiveCustomers,
        SUM(CASE WHEN 客户联系方式 IS NOT NULL AND 客户联系方式 != '' THEN 1 ELSE 0 END) as withContact
      FROM 客户信息
    `
    
    const result = await query(queryString)
    
    res.json({
      code: 0,
      success: true,
      data: result[0]
    })
  } catch (error) {
    console.error('获取客户统计信息失败:', error)
    res.status(500).json({
      success: false,
      message: '获取客户统计信息失败',
      error: error.message
    })
  }
})

// 获取单个客户信息
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    
    const queryString = `
      SELECT 
        客户ID as id,
        客户名称 as customerName,
        联系人 as contact,
        客户联系方式 as phone,
        客户地址 as address,
        客户邮箱 as email,
        CASE 
          WHEN 是否停用 = 1 THEN 'inactive'
          ELSE 'active'
        END as status,
        SeqNumber as seqNumber
      FROM 客户信息 
      WHERE 客户ID = @id
    `
    
    const result = await query(queryString, { id: parseInt(id) })
    
    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: '客户信息不存在'
      })
    }
    
    res.json({
      code: 0,
      success: true,
      data: result[0]
    })
  } catch (error) {
    console.error('获取客户信息失败:', error)
    res.status(500).json({
      success: false,
      message: '获取客户信息失败',
      error: error.message
    })
  }
})

// 新增客户信息
router.post('/', async (req, res) => {
  try {
    const { customerName, contact, phone, address, email, status = 'active', seqNumber = 0 } = req.body
    
    const queryString = `
      INSERT INTO 客户信息 
      (客户名称, 联系人, 客户联系方式, 客户地址, 客户邮箱, 是否停用, SeqNumber)
      VALUES 
      (@customerName, @contact, @phone, @address, @email, @isDisabled, @seqNumber)
      SELECT SCOPE_IDENTITY() as id
    `
    
    const result = await query(queryString, {
      customerName,
      contact,
      phone,
      address,
      email,
      isDisabled: status === 'inactive' ? 1 : 0,
      seqNumber
    })
    
    res.json({
      code: 0,
      success: true,
      data: { id: result[0].id },
      message: '新增客户信息成功'
    })
  } catch (error) {
    console.error('新增客户信息失败:', error)
    res.status(500).json({
      success: false,
      message: '新增客户信息失败',
      error: error.message
    })
  }
})

// 更新客户信息
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { customerName, contact, phone, address, email, status, seqNumber } = req.body
    
    const queryString = `
      UPDATE 客户信息 SET
        客户名称 = @customerName,
        联系人 = @contact,
        客户联系方式 = @phone,
        客户地址 = @address,
        客户邮箱 = @email,
        是否停用 = @isDisabled,
        SeqNumber = @seqNumber
      WHERE 客户ID = @id
    `
    
    await query(queryString, {
      id: parseInt(id),
      customerName,
      contact,
      phone,
      address,
      email,
      isDisabled: status === 'inactive' ? 1 : 0,
      seqNumber
    })
    
    res.json({
      code: 0,
      success: true,
      message: '更新客户信息成功'
    })
  } catch (error) {
    console.error('更新客户信息失败:', error)
    res.status(500).json({
      success: false,
      message: '更新客户信息失败',
      error: error.message
    })
  }
})

// 删除客户信息
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params
    
    const queryString = `DELETE FROM 客户信息 WHERE 客户ID = @id`
    
    await query(queryString, { id: parseInt(id) })
    
    res.json({
      code: 0,
      success: true,
      message: '删除客户信息成功'
    })
  } catch (error) {
    console.error('删除客户信息失败:', error)
    res.status(500).json({
      success: false,
      message: '删除客户信息失败',
      error: error.message
    })
  }
})

module.exports = router
