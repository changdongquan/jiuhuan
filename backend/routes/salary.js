const express = require('express')
const sql = require('mssql')
const router = express.Router()
const { query, getPool } = require('../database')

const TABLE_SUMMARY = '工资汇总'
const TABLE_DETAIL = '工资明细'
const TABLE_SALARY_BASE = '工资_工资基数'
const TABLE_OVERTIME_BASE = '工资_加班费基数'
const TABLE_SUBSIDY = '工资_补助'

const toNumberOrNull = (val) => {
  if (val === null || val === undefined || val === '') return null
  const num = Number(val)
  return Number.isNaN(num) ? null : num
}

const toMoney = (val) => {
  const num = toNumberOrNull(val)
  return num === null ? null : num
}

const computeTotal = (baseSalary, bonus, deduction) => {
  const base = Number(baseSalary || 0)
  const bon = Number(bonus || 0)
  const ded = Number(deduction || 0)
  const total = base + bon - ded
  return Number.isNaN(total) ? null : total
}

const isValidMonth = (month) => /^(\d{4})-(\d{2})$/.test(String(month || ''))
const parseDateOrNull = (val) => {
  if (!val) return null
  const d = new Date(val)
  return Number.isNaN(d.getTime()) ? null : d
}

const upsertDraftStep1 = async ({ month, employeeIds }) => {
  if (!isValidMonth(month)) throw new Error('月份格式无效')
  if (!Array.isArray(employeeIds) || employeeIds.length === 0) throw new Error('请选择员工')

  const pool = await getPool()
  const transaction = new sql.Transaction(pool)
  await transaction.begin()

  try {
    const selectReq = new sql.Request(transaction)
    selectReq.input('month', sql.NVarChar, month)
    const existed = await selectReq.query(`
      SELECT TOP 1 ID, 步骤, 状态
      FROM ${TABLE_SUMMARY}
      WHERE 月份 = @month
    `)

    let summaryId = existed.recordset[0]?.ID || null
    const status = existed.recordset[0]?.状态 || null
    const step = existed.recordset[0]?.步骤 || 1

    if (summaryId && status === '已完成') {
      throw new Error('该月份工资已完成，不能重复新增')
    }

    if (!summaryId) {
      const insertReq = new sql.Request(transaction)
      insertReq.input('month', sql.NVarChar, month)
      const insertResult = await insertReq.query(`
        INSERT INTO ${TABLE_SUMMARY} (月份, 步骤, 状态, 创建时间, 更新时间)
        OUTPUT INSERTED.ID as id
        VALUES (@month, 1, N'草稿', SYSDATETIME(), SYSDATETIME())
      `)
      summaryId = insertResult.recordset[0]?.id
    } else {
      const updateReq = new sql.Request(transaction)
      updateReq.input('id', sql.Int, summaryId)
      await updateReq.query(`
        UPDATE ${TABLE_SUMMARY}
        SET 步骤 = CASE WHEN 步骤 < 1 THEN 1 ELSE 步骤 END,
            状态 = CASE WHEN 状态 = N'已完成' THEN 状态 ELSE N'草稿' END,
            更新时间 = SYSDATETIME()
        WHERE ID = @id
      `)
    }

    const delReq = new sql.Request(transaction)
    delReq.input('summaryId', sql.Int, summaryId)
    await delReq.query(`DELETE FROM ${TABLE_DETAIL} WHERE 汇总ID = @summaryId`)

    const idParams = employeeIds.map((_, idx) => `@id${idx}`).join(', ')

    const employeesReq = new sql.Request(transaction)
    employeeIds.forEach((id, idx) => {
      employeesReq.input(`id${idx}`, sql.Int, Number(id))
    })

    const employeeRows = await employeesReq.query(`
      SELECT ID, 姓名, 工号
      FROM 员工信息
      WHERE ID IN (${idParams})
    `)

    if (!employeeRows.recordset.length) throw new Error('未找到员工信息')

    for (const emp of employeeRows.recordset) {
      const insReq = new sql.Request(transaction)
      insReq.input('summaryId', sql.Int, summaryId)
      insReq.input('employeeId', sql.Int, emp.ID)
      insReq.input('employeeName', sql.NVarChar, emp.姓名 || '')
      insReq.input('employeeNumber', sql.NVarChar, String(emp.工号 ?? ''))
      await insReq.query(`
        INSERT INTO ${TABLE_DETAIL} (
          汇总ID, 员工ID, 姓名, 工号, 基本工资, 绩效奖金, 扣款, 合计, 备注, 创建时间, 更新时间
        )
        VALUES (
          @summaryId, @employeeId, @employeeName, @employeeNumber,
          NULL, NULL, NULL, NULL, NULL, SYSDATETIME(), SYSDATETIME()
        )
      `)
    }

    await transaction.commit()
    return { id: summaryId, step }
  } catch (err) {
    await transaction.rollback()
    throw err
  }
}

// 列表（只展示已完成）
router.get('/list', async (req, res) => {
  try {
    const { month, keyword, page = 1, pageSize = 10 } = req.query
    let whereClause = `WHERE h.状态 = N'已完成'`
    const params = {}

    if (month) {
      whereClause += ' AND h.月份 = @month'
      params.month = month
    }
    if (keyword) {
      whereClause += ' AND (d.姓名 LIKE @keyword OR d.工号 LIKE @keyword)'
      params.keyword = `%${keyword}%`
    }

    const countResult = await query(
      `
      SELECT COUNT(*) as total
      FROM ${TABLE_DETAIL} d
      INNER JOIN ${TABLE_SUMMARY} h ON d.汇总ID = h.ID
      ${whereClause}
    `,
      params
    )
    const total = countResult[0]?.total || 0
    const offset = (parseInt(page) - 1) * parseInt(pageSize)

    const list = await query(
      `
      SELECT
        d.ID as id,
        h.月份 as month,
        d.姓名 as employeeName,
        d.工号 as employeeNumber,
        d.基本工资 as baseSalary,
        d.绩效奖金 as bonus,
        d.扣款 as deduction,
        d.合计 as total,
        d.备注 as remark
      FROM ${TABLE_DETAIL} d
      INNER JOIN ${TABLE_SUMMARY} h ON d.汇总ID = h.ID
      ${whereClause}
      ORDER BY h.月份 DESC, d.工号
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
    console.error('获取工资列表失败:', error)
    res.status(500).json({ code: 500, message: '获取工资列表失败' })
  }
})

// 草稿：step1 保存（月份 + 员工范围）
router.post('/draft/step1', async (req, res) => {
  try {
    const { month, employeeIds } = req.body || {}
    const result = await upsertDraftStep1({ month, employeeIds })
    res.json({ code: 0, data: result })
  } catch (error) {
    console.error('保存工资草稿(step1)失败:', error)
    res.status(400).json({ code: 400, message: error.message || '保存失败' })
  }
})

// 草稿详情
router.get('/draft/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    if (Number.isNaN(id)) return res.status(400).json({ code: 400, message: 'ID 无效' })

    const summary = await query(
      `
      SELECT
        ID as id,
        月份 as month,
        步骤 as step,
        状态 as status,
        创建时间 as createdAt,
        更新时间 as updatedAt
      FROM ${TABLE_SUMMARY}
      WHERE ID = @id
    `,
      { id }
    )
    if (!summary.length) return res.status(404).json({ code: 404, message: '草稿不存在' })

    const rows = await query(
      `
      SELECT
        员工ID as employeeId,
        姓名 as employeeName,
        工号 as employeeNumber,
        基本工资 as baseSalary,
        绩效奖金 as bonus,
        扣款 as deduction,
        合计 as total,
        备注 as remark
      FROM ${TABLE_DETAIL}
      WHERE 汇总ID = @id
      ORDER BY 工号
    `,
      { id }
    )

    res.json({ code: 0, data: { ...summary[0], rows } })
  } catch (error) {
    console.error('获取工资草稿失败:', error)
    res.status(500).json({ code: 500, message: '获取工资草稿失败' })
  }
})

// 草稿：step2 保存（明细）
router.put('/draft/:id/step2', async (req, res) => {
  let transaction = null
  try {
    const id = parseInt(req.params.id)
    if (Number.isNaN(id)) return res.status(400).json({ code: 400, message: 'ID 无效' })
    const { rows } = req.body || {}
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ code: 400, message: '明细不能为空' })
    }

    const pool = await getPool()
    transaction = new sql.Transaction(pool)
    await transaction.begin()

    const existedReq = new sql.Request(transaction)
    existedReq.input('id', sql.Int, id)
    const existed = await existedReq.query(`
      SELECT TOP 1 状态 FROM ${TABLE_SUMMARY} WHERE ID = @id
    `)
    if (!existed.recordset.length) {
      await transaction.rollback()
      return res.status(404).json({ code: 404, message: '草稿不存在' })
    }
    if (existed.recordset[0].状态 === '已完成') {
      await transaction.rollback()
      return res.status(400).json({ code: 400, message: '该月份工资已完成，不能编辑' })
    }

    const delReq = new sql.Request(transaction)
    delReq.input('id', sql.Int, id)
    await delReq.query(`DELETE FROM ${TABLE_DETAIL} WHERE 汇总ID = @id`)

    for (const row of rows) {
      const baseSalary = toMoney(row.baseSalary)
      const bonus = toMoney(row.bonus)
      const deduction = toMoney(row.deduction)
      const total = toMoney(row.total ?? computeTotal(baseSalary, bonus, deduction))

      const insReq = new sql.Request(transaction)
      insReq.input('summaryId', sql.Int, id)
      insReq.input('employeeId', sql.Int, row.employeeId || null)
      insReq.input('employeeName', sql.NVarChar, row.employeeName || '')
      insReq.input('employeeNumber', sql.NVarChar, String(row.employeeNumber ?? ''))
      insReq.input('baseSalary', sql.Decimal(12, 2), baseSalary)
      insReq.input('bonus', sql.Decimal(12, 2), bonus)
      insReq.input('deduction', sql.Decimal(12, 2), deduction)
      insReq.input('total', sql.Decimal(12, 2), total)
      insReq.input('remark', sql.NVarChar, row.remark || null)

      await insReq.query(`
        INSERT INTO ${TABLE_DETAIL} (
          汇总ID, 员工ID, 姓名, 工号, 基本工资, 绩效奖金, 扣款, 合计, 备注, 创建时间, 更新时间
        )
        VALUES (
          @summaryId, @employeeId, @employeeName, @employeeNumber,
          @baseSalary, @bonus, @deduction, @total, @remark, SYSDATETIME(), SYSDATETIME()
        )
      `)
    }

    const updateReq = new sql.Request(transaction)
    updateReq.input('id', sql.Int, id)
    await updateReq.query(`
      UPDATE ${TABLE_SUMMARY}
      SET 步骤 = 2, 状态 = N'步骤2已保存', 更新时间 = SYSDATETIME()
      WHERE ID = @id
    `)

    await transaction.commit()
    res.json({ code: 0, message: '保存成功' })
  } catch (error) {
    if (transaction) await transaction.rollback()
    console.error('保存工资草稿(step2)失败:', error)
    res.status(500).json({ code: 500, message: error.message || '保存失败' })
  }
})

// 草稿：step3 保存（确认页保存）
router.put('/draft/:id/step3', async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    if (Number.isNaN(id)) return res.status(400).json({ code: 400, message: 'ID 无效' })
    await query(
      `
      UPDATE ${TABLE_SUMMARY}
      SET 步骤 = 3, 状态 = N'步骤3已保存', 更新时间 = SYSDATETIME()
      WHERE ID = @id AND 状态 <> N'已完成'
    `,
      { id }
    )
    res.json({ code: 0, message: '保存成功' })
  } catch (error) {
    console.error('保存工资草稿(step3)失败:', error)
    res.status(500).json({ code: 500, message: '保存失败' })
  }
})

// 完成
router.put('/complete/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    if (Number.isNaN(id)) return res.status(400).json({ code: 400, message: 'ID 无效' })

    const existed = await query(`SELECT TOP 1 状态 FROM ${TABLE_SUMMARY} WHERE ID = @id`, { id })
    if (!existed.length) return res.status(404).json({ code: 404, message: '记录不存在' })
    if (existed[0].状态 === '已完成') return res.json({ code: 0, message: '已完成' })

    await query(
      `
      UPDATE ${TABLE_SUMMARY}
      SET 步骤 = 3, 状态 = N'已完成', 更新时间 = SYSDATETIME()
      WHERE ID = @id
    `,
      { id }
    )
    res.json({ code: 0, message: '完成成功' })
  } catch (error) {
    console.error('完成工资失败:', error)
    res.status(500).json({ code: 500, message: '完成失败' })
  }
})

// -----------------------------
// 参数接口（工资计算参数）
// -----------------------------

router.get('/params/salary-base', async (req, res) => {
  try {
    const rows = await query(`
      SELECT
        员工ID as employeeId,
        工资基数 as salaryBase,
        调整日期 as adjustDate,
        更新时间 as updatedAt
      FROM ${TABLE_SALARY_BASE}
      ORDER BY 员工ID
    `)
    res.json({ code: 0, data: rows })
  } catch (error) {
    console.error('获取工资基数失败:', error)
    res.status(500).json({ code: 500, message: '获取工资基数失败' })
  }
})

router.put('/params/salary-base', async (req, res) => {
  let transaction = null
  try {
    const { rows } = req.body || {}
    if (!Array.isArray(rows)) return res.status(400).json({ code: 400, message: 'rows 必须是数组' })

    const pool = await getPool()
    transaction = new sql.Transaction(pool)
    await transaction.begin()

    for (const row of rows) {
      const employeeId = Number(row.employeeId)
      if (!employeeId) continue

      const upsertReq = new sql.Request(transaction)
      upsertReq.input('employeeId', sql.Int, employeeId)
      upsertReq.input('salaryBase', sql.Decimal(12, 2), toMoney(row.salaryBase))
      upsertReq.input('adjustDate', sql.DateTime2, parseDateOrNull(row.adjustDate))
      await upsertReq.query(`
        MERGE ${TABLE_SALARY_BASE} AS t
        USING (SELECT @employeeId AS 员工ID) AS s
        ON (t.员工ID = s.员工ID)
        WHEN MATCHED THEN
          UPDATE SET 工资基数 = @salaryBase, 调整日期 = @adjustDate, 更新时间 = SYSDATETIME()
        WHEN NOT MATCHED THEN
          INSERT (员工ID, 工资基数, 调整日期, 创建时间, 更新时间)
          VALUES (@employeeId, @salaryBase, @adjustDate, SYSDATETIME(), SYSDATETIME());
      `)
    }

    await transaction.commit()
    res.json({ code: 0, message: '保存成功' })
  } catch (error) {
    if (transaction) await transaction.rollback()
    console.error('保存工资基数失败:', error)
    res.status(500).json({ code: 500, message: error.message || '保存工资基数失败' })
  }
})

router.get('/params/overtime-base', async (req, res) => {
  try {
    const rows = await query(`
      SELECT
        职级 as level,
        加班 as overtime,
        两倍加班 as doubleOvertime,
        三倍加班 as tripleOvertime,
        调整日期 as adjustDate,
        更新时间 as updatedAt
      FROM ${TABLE_OVERTIME_BASE}
      ORDER BY 职级
    `)
    res.json({ code: 0, data: rows })
  } catch (error) {
    console.error('获取加班费基数失败:', error)
    res.status(500).json({ code: 500, message: '获取加班费基数失败' })
  }
})

router.put('/params/overtime-base', async (req, res) => {
  let transaction = null
  try {
    const { rows } = req.body || {}
    if (!Array.isArray(rows)) return res.status(400).json({ code: 400, message: 'rows 必须是数组' })

    const pool = await getPool()
    transaction = new sql.Transaction(pool)
    await transaction.begin()

    for (const row of rows) {
      const level = Number(row.level)
      if (!level) continue

      const upsertReq = new sql.Request(transaction)
      upsertReq.input('level', sql.Int, level)
      upsertReq.input('overtime', sql.Decimal(12, 2), toMoney(row.overtime))
      upsertReq.input('doubleOvertime', sql.Decimal(12, 2), toMoney(row.doubleOvertime))
      upsertReq.input('tripleOvertime', sql.Decimal(12, 2), toMoney(row.tripleOvertime))
      upsertReq.input('adjustDate', sql.DateTime2, parseDateOrNull(row.adjustDate))
      await upsertReq.query(`
        MERGE ${TABLE_OVERTIME_BASE} AS t
        USING (SELECT @level AS 职级) AS s
        ON (t.职级 = s.职级)
        WHEN MATCHED THEN
          UPDATE SET 加班 = @overtime, 两倍加班 = @doubleOvertime, 三倍加班 = @tripleOvertime,
                     调整日期 = @adjustDate, 更新时间 = SYSDATETIME()
        WHEN NOT MATCHED THEN
          INSERT (职级, 加班, 两倍加班, 三倍加班, 调整日期, 创建时间, 更新时间)
          VALUES (@level, @overtime, @doubleOvertime, @tripleOvertime, @adjustDate, SYSDATETIME(), SYSDATETIME());
      `)
    }

    await transaction.commit()
    res.json({ code: 0, message: '保存成功' })
  } catch (error) {
    if (transaction) await transaction.rollback()
    console.error('保存加班费基数失败:', error)
    res.status(500).json({ code: 500, message: error.message || '保存加班费基数失败' })
  }
})

router.get('/params/subsidy', async (req, res) => {
  try {
    const rows = await query(`
      SELECT
        补助名称 as name,
        计量方式 as unit,
        金额 as amount,
        调整日期 as adjustDate,
        更新时间 as updatedAt
      FROM ${TABLE_SUBSIDY}
      ORDER BY 补助名称
    `)
    res.json({ code: 0, data: rows })
  } catch (error) {
    console.error('获取补助参数失败:', error)
    res.status(500).json({ code: 500, message: '获取补助参数失败' })
  }
})

router.put('/params/subsidy', async (req, res) => {
  let transaction = null
  try {
    const { rows } = req.body || {}
    if (!Array.isArray(rows)) return res.status(400).json({ code: 400, message: 'rows 必须是数组' })

    const pool = await getPool()
    transaction = new sql.Transaction(pool)
    await transaction.begin()

    for (const row of rows) {
      const name = String(row.name || '').trim()
      if (!name) continue

      const upsertReq = new sql.Request(transaction)
      upsertReq.input('name', sql.NVarChar, name)
      upsertReq.input('unit', sql.NVarChar, row.unit ? String(row.unit) : '按次')
      upsertReq.input('amount', sql.Decimal(12, 2), toMoney(row.amount))
      upsertReq.input('adjustDate', sql.DateTime2, parseDateOrNull(row.adjustDate))
      await upsertReq.query(`
        MERGE ${TABLE_SUBSIDY} AS t
        USING (SELECT @name AS 补助名称) AS s
        ON (t.补助名称 = s.补助名称)
        WHEN MATCHED THEN
          UPDATE SET 计量方式 = @unit, 金额 = @amount, 调整日期 = @adjustDate, 更新时间 = SYSDATETIME()
        WHEN NOT MATCHED THEN
          INSERT (补助名称, 计量方式, 金额, 调整日期, 创建时间, 更新时间)
          VALUES (@name, @unit, @amount, @adjustDate, SYSDATETIME(), SYSDATETIME());
      `)
    }

    await transaction.commit()
    res.json({ code: 0, message: '保存成功' })
  } catch (error) {
    if (transaction) await transaction.rollback()
    console.error('保存补助参数失败:', error)
    res.status(500).json({ code: 500, message: error.message || '保存补助参数失败' })
  }
})

module.exports = router
