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
    const countResult = await query(
      `
      SELECT COUNT(*) as total FROM 员工信息 ${whereClause}
    `,
      params
    )

    const total = countResult[0].total

    // 获取分页数据 - 使用 OFFSET/FETCH 实现真正的分页
    const offset = (parseInt(page) - 1) * parseInt(pageSize)
    const result = await query(
      `
      SELECT 
        ID as id,
        姓名 as employeeName,
        工号 as employeeNumber,
        性别 as gender,
        职级 as level,
        入职时间 as entryDate,
        离职日期 as leaveDate,
        身份证号码 as idCard,
        部门 as department,
        岗位 as position,
        联系方式 as phone,
        紧急联系人 as emergencyContact,
        在职状态 as status,
        转正日期 as confirmDate,
        银行名称 as bankName,
        银行账号 as bankAccount,
        开户行 as bankBranch
      FROM 员工信息 
      ${whereClause}
      ORDER BY ID
      OFFSET ${offset} ROWS
      FETCH NEXT ${parseInt(pageSize)} ROWS ONLY
    `,
      params
    )

    res.json({
      code: 0,
      data: {
        list: result,
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      }
    })
  } catch (error) {
    console.error('获取员工列表失败:', error)
    res.status(500).json({ code: 500, message: '获取员工列表失败' })
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
    res.status(500).json({ code: 500, message: '获取员工统计信息失败' })
  }
})

// 获取员工详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params

    const result = await query(
      `
      SELECT 
        ID as id,
        姓名 as employeeName,
        工号 as employeeNumber,
        性别 as gender,
        职级 as level,
        入职时间 as entryDate,
        离职日期 as leaveDate,
        身份证号码 as idCard,
        部门 as department,
        岗位 as position,
        联系方式 as phone,
        紧急联系人 as emergencyContact,
        在职状态 as status,
        转正日期 as confirmDate,
        银行名称 as bankName,
        银行账号 as bankAccount,
        开户行 as bankBranch
      FROM 员工信息 
      WHERE ID = @id
    `,
      { id: parseInt(id) }
    )

    if (result.length === 0) {
      return res.status(404).json({ code: 404, message: '员工信息不存在' })
    }

    res.json({ code: 0, data: result[0] })
  } catch (error) {
    console.error('获取员工详情失败:', error)
    res.status(500).json({ code: 500, message: '获取员工详情失败' })
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
      leaveDate,
      idCard,
      department,
      position,
      phone,
      emergencyContact,
      status,
      confirmDate,
      bankName,
      bankAccount,
      bankBranch
    } = req.body

    const pool = await require('../database').getPool()
    const request = pool.request()

    // 绑定参数
    const sql = require('mssql')
    request.input('employeeName', sql.NVarChar, employeeName)
    request.input('employeeNumber', sql.Int, employeeNumber)
    request.input('gender', sql.NVarChar, gender)
    request.input('level', sql.Int, level)
    request.input('entryDate', sql.DateTime2, entryDate || null)
    request.input('leaveDate', sql.DateTime2, leaveDate || null)
    request.input('idCard', sql.NVarChar, idCard)
    request.input('department', sql.NVarChar, department)
    request.input('position', sql.NVarChar, position)
    request.input('phone', sql.NVarChar, phone)
    request.input('emergencyContact', sql.NVarChar, emergencyContact)
    request.input('status', sql.NVarChar, status)
    request.input('confirmDate', sql.DateTime2, confirmDate || null)
    request.input('bankName', sql.NVarChar, bankName || null)
    request.input('bankAccount', sql.NVarChar, bankAccount || null)
    request.input('bankBranch', sql.NVarChar, bankBranch || null)

    const result = await request.query(`
      INSERT INTO 员工信息 (
        姓名, 工号, 性别, 职级, 入职时间, 离职日期, 身份证号码, 部门, 岗位, 联系方式, 紧急联系人, 在职状态, 转正日期, 银行名称, 银行账号, 开户行
      ) 
      OUTPUT INSERTED.ID as id
      VALUES (@employeeName, @employeeNumber, @gender, @level, @entryDate, @leaveDate, @idCard, @department, @position, @phone, @emergencyContact, @status, @confirmDate, @bankName, @bankAccount, @bankBranch)
    `)

    const newId = result.recordset[0]?.id || result.rowsAffected[0]
    res.json({ code: 0, message: '员工创建成功', id: newId })
  } catch (error) {
    console.error('创建员工失败:', error)
    res.status(500).json({ code: 500, message: '创建员工失败' })
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
      leaveDate,
      idCard,
      department,
      position,
      phone,
      emergencyContact,
      status,
      confirmDate,
      bankName,
      bankAccount,
      bankBranch
    } = req.body

    const pool = await require('../database').getPool()
    const request = pool.request()

    // 绑定参数
    const sql = require('mssql')
    request.input('id', sql.Int, parseInt(id))
    request.input('employeeName', sql.NVarChar, employeeName)
    request.input('employeeNumber', sql.Int, employeeNumber)
    request.input('gender', sql.NVarChar, gender)
    request.input('level', sql.Int, level)
    request.input('entryDate', sql.DateTime2, entryDate || null)
    request.input('leaveDate', sql.DateTime2, leaveDate || null)
    request.input('idCard', sql.NVarChar, idCard)
    request.input('department', sql.NVarChar, department)
    request.input('position', sql.NVarChar, position)
    request.input('phone', sql.NVarChar, phone)
    request.input('emergencyContact', sql.NVarChar, emergencyContact)
    request.input('status', sql.NVarChar, status)
    request.input('confirmDate', sql.DateTime2, confirmDate || null)
    request.input('bankName', sql.NVarChar, bankName || null)
    request.input('bankAccount', sql.NVarChar, bankAccount || null)
    request.input('bankBranch', sql.NVarChar, bankBranch || null)

    const result = await request.query(`
      UPDATE 员工信息 SET 
        姓名 = @employeeName, 工号 = @employeeNumber, 性别 = @gender, 职级 = @level, 入职时间 = @entryDate, 离职日期 = @leaveDate, 身份证号码 = @idCard, 
        部门 = @department, 岗位 = @position, 联系方式 = @phone, 紧急联系人 = @emergencyContact, 在职状态 = @status, 转正日期 = @confirmDate,
        银行名称 = @bankName, 银行账号 = @bankAccount, 开户行 = @bankBranch
      WHERE ID = @id
    `)

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ code: 404, message: '员工信息不存在' })
    }

    res.json({ code: 0, message: '员工更新成功' })
  } catch (error) {
    console.error('更新员工失败:', error)
    res.status(500).json({ code: 500, message: '更新员工失败' })
  }
})

// 删除员工
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params

    const pool = await require('../database').getPool()
    const request = pool.request()
    request.input('id', require('mssql').Int, parseInt(id))

    const result = await request.query(`
      DELETE FROM 员工信息 WHERE ID = @id
    `)

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ code: 404, message: '员工信息不存在' })
    }

    res.json({ code: 0, message: '员工删除成功' })
  } catch (error) {
    console.error('删除员工失败:', error)
    res.status(500).json({ code: 500, message: '删除员工失败' })
  }
})

module.exports = router
