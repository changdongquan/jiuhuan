const express = require('express')
const router = express.Router()
const { query } = require('../database')

// 获取员工列表
router.get('/list', async (req, res) => {
  try {
    const { employeeName, employeeNumber, department, status, page = 1, pageSize = 10 } = req.query
    
    let whereClause = 'WHERE 1=1'
    const params = {}
    
    if (employeeName) {
      whereClause += ' AND 姓名 LIKE @employeeName'
      params.employeeName = `%${employeeName}%`
    }
    
    if (employeeNumber) {
      whereClause += ' AND 工号 = @employeeNumber'
      params.employeeNumber = parseInt(employeeNumber)
    }
    
    if (department) {
      whereClause += ' AND 部门 LIKE @department'
      params.department = `%${department}%`
    }
    
    if (status) {
      whereClause += ' AND 在职状态 = @status'
      params.status = status
    }
    
    // 获取总数
    const countResult = await query(`
      SELECT COUNT(*) as total FROM 员工信息 ${whereClause}
    `, params)
    
    const total = countResult[0].total
    
    // 获取分页数据 - 使用简单的TOP查询
    const result = await query(`
      SELECT TOP ${parseInt(pageSize)} 
        ID as id,
        姓名 as employeeName,
        工号 as employeeNumber,
        性别 as gender,
        职级 as level,
        入职时间 as entryDate,
        身份证号码 as idCard,
        部门 as department,
        岗位 as position,
        联系方式 as phone,
        紧急联系人 as emergencyContact,
        在职状态 as status,
        转正日期 as confirmDate
      FROM 员工信息 
      ${whereClause}
      ORDER BY ID
    `, params)
    
    res.json({
      list: result,
      total,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    })
  } catch (error) {
    console.error('获取员工列表失败:', error)
    res.status(500).json({ error: '获取员工列表失败' })
  }
})

// 获取员工统计信息
router.get('/statistics', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        COUNT(*) as totalEmployees,
        SUM(CASE WHEN 在职状态 = '在职' THEN 1 ELSE 0 END) as activeEmployees,
        SUM(CASE WHEN 在职状态 = '离职' THEN 1 ELSE 0 END) as inactiveEmployees,
        SUM(CASE WHEN 在职状态 = '休假' THEN 1 ELSE 0 END) as leaveEmployees
      FROM 员工信息
    `)
    
    const stats = result[0]
    res.json({
      totalEmployees: stats.totalEmployees,
      activeEmployees: stats.activeEmployees,
      inactiveEmployees: stats.inactiveEmployees,
      leaveEmployees: stats.leaveEmployees
    })
  } catch (error) {
    console.error('获取员工统计信息失败:', error)
    res.status(500).json({ error: '获取员工统计信息失败' })
  }
})

    // 获取员工详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    
    const result = await query(`
      SELECT 
        ID as id,
        姓名 as employeeName,
        工号 as employeeNumber,
        性别 as gender,
        职级 as level,
        入职时间 as entryDate,
        身份证号码 as idCard,
        部门 as department,
        岗位 as position,
        联系方式 as phone,
        紧急联系人 as emergencyContact,
        在职状态 as status,
        转正日期 as confirmDate
      FROM 员工信息 
      WHERE ID = @id
    `, { id: parseInt(id) })
    
    if (result.length === 0) {
      return res.status(404).json({ error: '员工信息不存在' })
    }
    
    res.json(result[0])
  } catch (error) {
    console.error('获取员工详情失败:', error)
    res.status(500).json({ error: '获取员工详情失败' })
  }
})

// 创建员工
router.post('/', async (req, res) => {
  try {
    const {
      employeeName,
      employeeNumber,
      gender,
      level,
      entryDate,
      idCard,
      department,
      position,
      phone,
      emergencyContact,
      status,
      confirmDate
    } = req.body
    
    const result = await query(`
      INSERT INTO 员工信息 (
        姓名, 工号, 性别, 职级, 入职时间, 身份证号码, 部门, 岗位, 联系方式, 紧急联系人, 在职状态, 转正日期
      ) VALUES (@employeeName, @employeeNumber, @gender, @level, @entryDate, @idCard, @department, @position, @phone, @emergencyContact, @status, @confirmDate)
    `, {
      employeeName,
      employeeNumber,
      gender,
      level,
      entryDate,
      idCard,
      department,
      position,
      phone,
      emergencyContact,
      status,
      confirmDate
    })
    
    res.json({ message: '员工创建成功', id: result.recordset.insertId })
  } catch (error) {
    console.error('创建员工失败:', error)
    res.status(500).json({ error: '创建员工失败' })
  }
})

// 更新员工
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const {
      employeeName,
      employeeNumber,
      gender,
      level,
      entryDate,
      idCard,
      department,
      position,
      phone,
      emergencyContact,
      status,
      confirmDate
    } = req.body
    
    const result = await query(`
      UPDATE 员工信息 SET 
        姓名 = @employeeName, 工号 = @employeeNumber, 性别 = @gender, 职级 = @level, 入职时间 = @entryDate, 身份证号码 = @idCard, 
        部门 = @department, 岗位 = @position, 联系方式 = @phone, 紧急联系人 = @emergencyContact, 在职状态 = @status, 转正日期 = @confirmDate
      WHERE ID = @id
    `, {
      employeeName,
      employeeNumber,
      gender,
      level,
      entryDate,
      idCard,
      department,
      position,
      phone,
      emergencyContact,
      status,
      confirmDate,
      id: parseInt(id)
    })
    
    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: '员工信息不存在' })
    }
    
    res.json({ message: '员工更新成功' })
  } catch (error) {
    console.error('更新员工失败:', error)
    res.status(500).json({ error: '更新员工失败' })
  }
})

// 删除员工
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params
    
    const result = await query(`
      DELETE FROM 员工信息 WHERE ID = @id
    `, { id: parseInt(id) })
    
    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: '员工信息不存在' })
    }
    
    res.json({ message: '员工删除成功' })
  } catch (error) {
    console.error('删除员工失败:', error)
    res.status(500).json({ error: '删除员工失败' })
  }
})

module.exports = router
