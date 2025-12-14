const express = require('express')
const sql = require('mssql')
const router = express.Router()
const { query, getPool } = require('../database')

const TABLE_SUMMARY = '考勤汇总'
const TABLE_DETAIL = '考勤明细'

const toNumber = (val) => {
  if (val === null || val === undefined || val === '') return 0
  const num = Number(val)
  return Number.isNaN(num) ? 0 : num
}

const parseDateOrNull = (val) => {
  if (!val) return null
  const d = new Date(val)
  return Number.isNaN(d.getTime()) ? null : d
}

const computeSummary = (records = []) => {
  const sum = (key) => records.reduce((acc, item) => acc + toNumber(item?.[key]), 0)
  const overtimeNormalTotal = sum('overtimeHours')
  const overtimeDoubleTotal = sum('doubleOvertimeHours')
  const overtimeTripleTotal = sum('tripleOvertimeHours')
  const overtimeSubtotalTotal = overtimeNormalTotal + overtimeDoubleTotal + overtimeTripleTotal
  const employeeCount = records.length
  const fullAttendanceCount = records.filter(
    (item) => toNumber(item?.fullAttendanceBonus) !== 0
  ).length
  const lateCountTotal = sum('lateCount')

  return {
    employeeCount,
    overtimeNormalTotal,
    overtimeDoubleTotal,
    overtimeTripleTotal,
    overtimeSubtotalTotal,
    fullAttendanceCount,
    lateCountTotal
  }
}

const isSameMonth = (a, b) => {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}

const getEditableMonths = () => {
  const now = new Date()
  const current = new Date(now.getFullYear(), now.getMonth(), 1)
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  return { current, prev }
}

const isEditableMonthString = (month) => {
  const match = /^(\d{4})-(\d{2})$/.exec(String(month || ''))
  if (!match) return false
  const y = Number(match[1])
  const m = Number(match[2]) - 1
  if (Number.isNaN(y) || Number.isNaN(m)) return false
  const selected = new Date(y, m, 1)
  const { current, prev } = getEditableMonths()
  return isSameMonth(selected, current) || isSameMonth(selected, prev)
}

// 获取考勤列表
router.get('/list', async (req, res) => {
  try {
    const { month, keyword, page = 1, pageSize = 10 } = req.query
    let whereClause = 'WHERE 1=1'
    const params = {}
    if (month) {
      whereClause += ' AND 月份 = @month'
      params.month = month
    }
    if (keyword) {
      whereClause += ' AND 月份 LIKE @keyword'
      params.keyword = `%${keyword}%`
    }

    const countResult = await query(
      `SELECT COUNT(*) as total FROM ${TABLE_SUMMARY} ${whereClause}`,
      params
    )
    const total = countResult[0]?.total || 0

    const offset = (parseInt(page) - 1) * parseInt(pageSize)
    const list = await query(
      `
      SELECT 
        h.ID as id,
        h.月份 as month,
        h.人数 as employeeCount,
        h.加班小计_普通 as overtimeNormalTotal,
        h.加班小计_两倍 as overtimeDoubleTotal,
        h.加班小计_三倍 as overtimeTripleTotal,
        h.加班小计合计 as overtimeSubtotalTotal,
        h.全勤人数 as fullAttendanceCount,
        ISNULL((
          SELECT SUM(ISNULL(d.迟到次数, 0)) 
          FROM ${TABLE_DETAIL} d 
          WHERE d.汇总ID = h.ID
        ), 0) as lateCountTotal,
        h.创建时间 as createdAt,
        h.更新时间 as updatedAt
      FROM ${TABLE_SUMMARY} h
      ${whereClause}
      ORDER BY h.月份 DESC
      OFFSET ${offset} ROWS FETCH NEXT ${parseInt(pageSize)} ROWS ONLY
    `,
      params
    )

    res.json({
      code: 0,
      data: {
        list,
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      }
    })
  } catch (error) {
    console.error('获取考勤列表失败:', error)
    res.status(500).json({ code: 500, message: '获取考勤列表失败' })
  }
})

// 获取考勤详情
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    if (Number.isNaN(id)) {
      return res.status(400).json({ code: 400, message: 'ID 无效' })
    }

    const summary = await query(
      `
      SELECT 
        ID as id,
        月份 as month,
        人数 as employeeCount,
        加班小计_普通 as overtimeNormalTotal,
        加班小计_两倍 as overtimeDoubleTotal,
        加班小计_三倍 as overtimeTripleTotal,
        加班小计合计 as overtimeSubtotalTotal,
        全勤人数 as fullAttendanceCount,
        创建时间 as createdAt,
        更新时间 as updatedAt
      FROM ${TABLE_SUMMARY}
      WHERE ID = @id
    `,
      { id }
    )

    if (!summary.length) {
      return res.status(404).json({ code: 404, message: '考勤记录不存在' })
    }

    const records = await query(
      `
      SELECT 
        ID as id,
        汇总ID as summaryId,
        员工ID as employeeId,
        姓名 as employeeName,
        工号 as employeeNumber,
        性别 as gender,
        部门 as department,
        职级 as level,
        入职时间 as entryDate,
        加班小时 as overtimeHours,
        两倍加班小时 as doubleOvertimeHours,
        三倍加班小时 as tripleOvertimeHours,
        夜班天数 as nightShiftCount,
        加班小计 as overtimeSubtotal,
        工龄数 as seniorityYears,
        全勤费 as fullAttendanceBonus,
        误餐次数 as mealAllowanceCount,
        补助小计 as subsidySubtotal,
        迟到次数 as lateCount,
        新进及事假小时 as newOrPersonalLeaveHours,
        病假小时 as sickLeaveHours,
        旷工小时 as absenceHours,
        卫生费 as hygieneFee,
        水电费 as utilitiesFee,
        扣款小计 as deductionSubtotal,
        创建时间 as createdAt,
        更新时间 as updatedAt
      FROM ${TABLE_DETAIL}
      WHERE 汇总ID = @id
      ORDER BY 工号
    `,
      { id }
    )

    res.json({
      code: 0,
      data: {
        ...summary[0],
        records
      }
    })
  } catch (error) {
    console.error('获取考勤详情失败:', error)
    res.status(500).json({ code: 500, message: '获取考勤详情失败' })
  }
})

const insertOrUpdate = async ({ id, month, records, isUpdate }) => {
  if (!month) {
    throw new Error('月份不能为空')
  }
  const pool = await getPool()
  const transaction = new sql.Transaction(pool)
  await transaction.begin()

  try {
    const summaryStats = computeSummary(records)
    let summaryId = id || null

    if (isUpdate) {
      if (!summaryId) throw new Error('ID 不能为空')
      const updateReq = new sql.Request(transaction)
      updateReq.input('id', sql.Int, summaryId)
      updateReq.input('month', sql.NVarChar, month)
      updateReq.input('employeeCount', sql.Int, summaryStats.employeeCount)
      updateReq.input('overtimeNormalTotal', sql.Decimal(10, 2), summaryStats.overtimeNormalTotal)
      updateReq.input('overtimeDoubleTotal', sql.Decimal(10, 2), summaryStats.overtimeDoubleTotal)
      updateReq.input('overtimeTripleTotal', sql.Decimal(10, 2), summaryStats.overtimeTripleTotal)
      updateReq.input(
        'overtimeSubtotalTotal',
        sql.Decimal(10, 2),
        summaryStats.overtimeSubtotalTotal
      )
      updateReq.input('fullAttendanceCount', sql.Int, summaryStats.fullAttendanceCount)

      const result = await updateReq.query(`
        UPDATE ${TABLE_SUMMARY}
        SET 月份 = @month,
            人数 = @employeeCount,
            加班小计_普通 = @overtimeNormalTotal,
            加班小计_两倍 = @overtimeDoubleTotal,
            加班小计_三倍 = @overtimeTripleTotal,
            加班小计合计 = @overtimeSubtotalTotal,
            全勤人数 = @fullAttendanceCount,
            更新时间 = SYSDATETIME()
        WHERE ID = @id
      `)

      if (result.rowsAffected[0] === 0) {
        throw new Error('考勤记录不存在')
      }

      await transaction
        .request()
        .input('id', sql.Int, summaryId)
        .query(`DELETE FROM ${TABLE_DETAIL} WHERE 汇总ID = @id`)
    } else {
      const insertReq = new sql.Request(transaction)
      insertReq.input('month', sql.NVarChar, month)
      insertReq.input('employeeCount', sql.Int, summaryStats.employeeCount)
      insertReq.input('overtimeNormalTotal', sql.Decimal(10, 2), summaryStats.overtimeNormalTotal)
      insertReq.input('overtimeDoubleTotal', sql.Decimal(10, 2), summaryStats.overtimeDoubleTotal)
      insertReq.input('overtimeTripleTotal', sql.Decimal(10, 2), summaryStats.overtimeTripleTotal)
      insertReq.input(
        'overtimeSubtotalTotal',
        sql.Decimal(10, 2),
        summaryStats.overtimeSubtotalTotal
      )
      insertReq.input('fullAttendanceCount', sql.Int, summaryStats.fullAttendanceCount)

      const insertResult = await insertReq.query(`
        INSERT INTO ${TABLE_SUMMARY} (
          月份, 人数, 加班小计_普通, 加班小计_两倍, 加班小计_三倍, 加班小计合计, 全勤人数, 创建时间, 更新时间
        )
        OUTPUT INSERTED.ID as id
        VALUES (
          @month, @employeeCount, @overtimeNormalTotal, @overtimeDoubleTotal, @overtimeTripleTotal,
          @overtimeSubtotalTotal, @fullAttendanceCount, SYSDATETIME(), SYSDATETIME()
        )
      `)
      summaryId = insertResult.recordset[0]?.id
    }

    const detailSql = `
      INSERT INTO ${TABLE_DETAIL} (
        汇总ID, 员工ID, 姓名, 工号, 性别, 部门, 职级, 入职时间,
        加班小时, 两倍加班小时, 三倍加班小时, 夜班天数, 加班小计,
        工龄数, 全勤费, 误餐次数, 补助小计,
        迟到次数, 新进及事假小时, 病假小时, 旷工小时, 卫生费, 水电费, 扣款小计,
        创建时间, 更新时间
      )
      VALUES (
        @summaryId, @employeeId, @employeeName, @employeeNumber, @gender, @department, @level, @entryDate,
        @overtimeHours, @doubleOvertimeHours, @tripleOvertimeHours, @nightShiftCount, @overtimeSubtotal,
        @seniorityYears, @fullAttendanceBonus, @mealAllowanceCount, @subsidySubtotal,
        @lateCount, @newOrPersonalLeaveHours, @sickLeaveHours, @absenceHours, @hygieneFee, @utilitiesFee, @deductionSubtotal,
        SYSDATETIME(), SYSDATETIME()
      )
    `

    for (const rec of records || []) {
      const req = new sql.Request(transaction)
      req.input('summaryId', sql.Int, summaryId)
      req.input('employeeId', sql.Int, rec.employeeId || null)
      req.input('employeeName', sql.NVarChar, rec.employeeName || '')
      req.input(
        'employeeNumber',
        sql.NVarChar,
        rec.employeeNumber !== undefined ? String(rec.employeeNumber) : ''
      )
      req.input('gender', sql.NVarChar, rec.gender || null)
      req.input('department', sql.NVarChar, rec.department || null)
      req.input('level', sql.NVarChar, rec.level !== undefined ? String(rec.level) : null)
      req.input('entryDate', sql.DateTime2, parseDateOrNull(rec.entryDate))
      req.input('overtimeHours', sql.Decimal(10, 1), rec.overtimeHours ?? null)
      req.input('doubleOvertimeHours', sql.Decimal(10, 1), rec.doubleOvertimeHours ?? null)
      req.input('tripleOvertimeHours', sql.Decimal(10, 1), rec.tripleOvertimeHours ?? null)
      req.input('nightShiftCount', sql.Int, rec.nightShiftCount ?? null)
      req.input('overtimeSubtotal', sql.Decimal(10, 2), rec.overtimeSubtotal ?? null)
      req.input('seniorityYears', sql.Decimal(4, 1), rec.seniorityYears ?? null)
      req.input('fullAttendanceBonus', sql.Decimal(10, 2), rec.fullAttendanceBonus ?? null)
      req.input('mealAllowanceCount', sql.Int, rec.mealAllowanceCount ?? null)
      req.input('subsidySubtotal', sql.Decimal(10, 2), rec.subsidySubtotal ?? null)
      req.input('lateCount', sql.Int, rec.lateCount ?? null)
      req.input('newOrPersonalLeaveHours', sql.Decimal(10, 1), rec.newOrPersonalLeaveHours ?? null)
      req.input('sickLeaveHours', sql.Decimal(10, 1), rec.sickLeaveHours ?? null)
      req.input('absenceHours', sql.Decimal(10, 1), rec.absenceHours ?? null)
      req.input('hygieneFee', sql.Decimal(10, 2), rec.hygieneFee ?? null)
      req.input('utilitiesFee', sql.Decimal(10, 2), rec.utilitiesFee ?? null)
      req.input('deductionSubtotal', sql.Decimal(10, 2), rec.deductionSubtotal ?? null)
      await req.query(detailSql)
    }

    await transaction.commit()
    return { id: summaryId }
  } catch (err) {
    await transaction.rollback()
    throw err
  }
}

// 新增
router.post('/', async (req, res) => {
  try {
    const { month, records = [] } = req.body || {}
    if (!month) return res.status(400).json({ code: 400, message: '月份不能为空' })
    if (!isEditableMonthString(month)) {
      return res.status(403).json({ code: 403, message: '只能新增当月和上一个月的考勤记录' })
    }
    const existed = await query(`SELECT 1 FROM ${TABLE_SUMMARY} WHERE 月份 = @month`, { month })
    if (existed.length) {
      return res.status(400).json({ code: 400, message: '该月份考勤已存在' })
    }

    const { id } = await insertOrUpdate({ month, records, isUpdate: false })
    res.json({ code: 0, message: '创建成功', id })
  } catch (error) {
    console.error('创建考勤失败:', error)
    res.status(500).json({ code: 500, message: error.message || '创建考勤失败' })
  }
})

// 更新
router.put('/', async (req, res) => {
  try {
    const { id, month, records = [] } = req.body || {}
    if (!id) return res.status(400).json({ code: 400, message: 'ID 不能为空' })
    if (!month) return res.status(400).json({ code: 400, message: '月份不能为空' })
    if (!isEditableMonthString(month)) {
      return res.status(403).json({ code: 403, message: '只能编辑当月和上一个月的考勤记录' })
    }

    const existed = await query(`SELECT 1 FROM ${TABLE_SUMMARY} WHERE ID = @id`, { id })
    if (!existed.length) {
      return res.status(404).json({ code: 404, message: '考勤记录不存在' })
    }

    const monthConflict = await query(
      `SELECT 1 FROM ${TABLE_SUMMARY} WHERE 月份 = @month AND ID <> @id`,
      { month, id }
    )
    if (monthConflict.length) {
      return res.status(400).json({ code: 400, message: '该月份考勤已存在' })
    }

    await insertOrUpdate({ id, month, records, isUpdate: true })
    res.json({ code: 0, message: '更新成功' })
  } catch (error) {
    console.error('更新考勤失败:', error)
    res.status(500).json({ code: 500, message: error.message || '更新考勤失败' })
  }
})

module.exports = router
