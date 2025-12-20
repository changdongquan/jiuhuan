const express = require('express')
const sql = require('mssql')
const ExcelJS = require('exceljs')
const path = require('path')
const multer = require('multer')
const XLSX = require('xlsx')
const router = express.Router()
const { query, getPool } = require('../database')

const TABLE_SUMMARY = '工资汇总'
const TABLE_DETAIL = '工资明细'
const TABLE_SALARY_BASE = '工资_工资基数'
const TABLE_OVERTIME_BASE = '工资_加班费基数'
const TABLE_SUBSIDY = '工资_补助'
const TABLE_PENALTY = '工资_罚扣'
const TAX_IMPORT_SHEET_NAME = '正常工资薪金收入'
const TAX_IMPORT_HEADERS = [
  '工号',
  '*姓名',
  '*证件类型',
  '*证件号码',
  '本期收入',
  '本期免税收入',
  '基本养老保险费',
  '基本医疗保险费',
  '失业保险费',
  '住房公积金',
  '累计子女教育',
  '累计继续教育',
  '累计住房贷款利息',
  '累计住房租金',
  '累计赡养老人',
  '累计3岁以下婴幼儿照护',
  '累计个人养老金',
  '企业(职业)年金',
  '商业健康保险',
  '税延养老保险',
  '其他',
  '准予扣除的捐赠额',
  '减免税额',
  '备注'
]

const uploadTaxFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }
})

const toNumberOrNull = (val) => {
  if (val === null || val === undefined || val === '') return null
  const num = Number(val)
  return Number.isNaN(num) ? null : num
}

const toNumberOrZero = (val) => {
  const num = toNumberOrNull(val)
  return num === null ? 0 : num
}

const toMoney = (val) => {
  const num = toNumberOrNull(val)
  return num === null ? null : num
}

const toNegativeMoney = (val) => {
  const num = toNumberOrNull(val)
  if (num === null) return null
  const rounded = Math.round(num * 100) / 100
  return rounded === 0 ? 0 : -Math.abs(rounded)
}

const computeTotal = (baseSalary, bonus, deduction) => {
  const base = Number(baseSalary || 0)
  const bon = Number(bonus || 0)
  const ded = Number(deduction || 0)
  const total = base + bon - ded
  return Number.isNaN(total) ? null : total
}

const computeSummaryTotals = (rows) => {
  const safeMoney = (val) => toNumberOrNull(val) ?? 0
  const round2 = (num) => Math.round(Number(num) * 100) / 100

  const list = Array.isArray(rows) ? rows : []
  const employeeCount = list.length

  const overtimePayTotal = round2(list.reduce((acc, r) => acc + safeMoney(r.overtimePay), 0))
  const doubleOvertimePayTotal = round2(
    list.reduce((acc, r) => acc + safeMoney(r.doubleOvertimePay), 0)
  )
  const tripleOvertimePayTotal = round2(
    list.reduce((acc, r) => acc + safeMoney(r.tripleOvertimePay), 0)
  )
  const currentSalaryTotal = round2(list.reduce((acc, r) => acc + safeMoney(r.currentSalary), 0))
  const firstPayableTotal = round2(list.reduce((acc, r) => acc + safeMoney(r.firstPayable), 0))
  const secondPayableTotal = round2(list.reduce((acc, r) => acc + safeMoney(r.secondPayable), 0))
  const twoPayableTotal = round2(list.reduce((acc, r) => acc + safeMoney(r.twoPayableTotal), 0))

  return {
    employeeCount,
    overtimePayTotal,
    doubleOvertimePayTotal,
    tripleOvertimePayTotal,
    currentSalaryTotal,
    firstPayableTotal,
    secondPayableTotal,
    twoPayableTotal
  }
}

const isValidMonth = (month) => /^(\d{4})-(\d{2})$/.test(String(month || ''))
const parseDateOrNull = (val) => {
  if (!val) return null
  const d = new Date(val)
  return Number.isNaN(d.getTime()) ? null : d
}

const upsertDraftStep1 = async ({ month, employeeIds }) => {
  if (!isValidMonth(month)) throw new Error('月份格式无效')
  const hasEmployeeIds = Array.isArray(employeeIds) && employeeIds.length > 0

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

    const employeesReq = new sql.Request(transaction)
    let employeeRows = null
    if (hasEmployeeIds) {
      const idParams = employeeIds.map((_, idx) => `@id${idx}`).join(', ')
      employeeIds.forEach((id, idx) => {
        employeesReq.input(`id${idx}`, sql.Int, Number(id))
      })
      employeeRows = await employeesReq.query(`
        SELECT ID, 姓名, 工号, 身份证号码, 入职时间, 职级
        FROM 员工信息
        WHERE ID IN (${idParams})
        ORDER BY 工号
      `)
    } else {
      employeeRows = await employeesReq.query(`
        SELECT ID, 姓名, 工号, 身份证号码, 入职时间, 职级
        FROM 员工信息
        WHERE 在职状态 = N'在职'
        ORDER BY 工号
      `)
    }

    if (!employeeRows.recordset.length) throw new Error('未找到员工信息')

    for (const emp of employeeRows.recordset) {
      const insReq = new sql.Request(transaction)
      insReq.input('summaryId', sql.Int, summaryId)
      insReq.input('employeeId', sql.Int, emp.ID)
      insReq.input('employeeName', sql.NVarChar, emp.姓名 || '')
      insReq.input('employeeNumber', sql.NVarChar, String(emp.工号 ?? ''))
      insReq.input('idCard', sql.NVarChar, emp.身份证号码 ? String(emp.身份证号码) : null)
      insReq.input('entryDate', sql.Date, parseDateOrNull(emp.入职时间))
      insReq.input('level', sql.Int, toNumberOrNull(emp.职级))
      await insReq.query(`
        INSERT INTO ${TABLE_DETAIL} (
          汇总ID, 员工ID, 姓名, 工号, 身份证号, 入职日期, 职级,
          基本工资, 绩效奖金, 扣款, 合计, 备注, 创建时间, 更新时间
        )
        VALUES (
          @summaryId, @employeeId, @employeeName, @employeeNumber,
          @idCard, @entryDate, @level,
          NULL, NULL, NULL, NULL, NULL, SYSDATETIME(), SYSDATETIME()
        )
      `)
    }

    const updateTotalsReq = new sql.Request(transaction)
    updateTotalsReq.input('id', sql.Int, summaryId)
    updateTotalsReq.input('employeeCount', sql.Int, employeeRows.recordset.length)
    await updateTotalsReq.query(`
      UPDATE ${TABLE_SUMMARY}
      SET 人数 = @employeeCount, 更新时间 = SYSDATETIME()
      WHERE ID = @id
    `)

    await transaction.commit()
    return { id: summaryId, step }
  } catch (err) {
    await transaction.rollback()
    throw err
  }
}

// 列表（汇总）
router.get('/list', async (req, res) => {
  try {
    const { month, keyword, page = 1, pageSize = 10 } = req.query
    let whereClause = `WHERE 1=1`
    const params = {}

    if (month) {
      whereClause += ' AND h.月份 = @month'
      params.month = month
    }
    if (keyword) {
      whereClause += ` AND (
        h.月份 LIKE @keyword OR h.备注 LIKE @keyword OR
        EXISTS (
          SELECT 1 FROM ${TABLE_DETAIL} d
          WHERE d.汇总ID = h.ID AND (d.姓名 LIKE @keyword OR d.工号 LIKE @keyword)
        )
      )`
      params.keyword = `%${keyword}%`
    }

    const countResult = await query(
      `
      SELECT COUNT(*) as total
      FROM ${TABLE_SUMMARY} h
      ${whereClause}
    `,
      params
    )
    const total = countResult[0]?.total || 0
    const offset = (parseInt(page) - 1) * parseInt(pageSize)

    const list = await query(
      `
      SELECT
        h.ID as id,
        h.月份 as month,
        h.步骤 as step,
        h.状态 as status,
        h.人数 as employeeCount,
        h.加班费合计 as overtimePayTotal,
        h.两倍加班费合计 as doubleOvertimePayTotal,
        h.三倍加班费合计 as tripleOvertimePayTotal,
        h.本期工资合计 as currentSalaryTotal,
        h.第一次应发合计 as firstPayableTotal,
        h.第二次应发合计 as secondPayableTotal,
        h.两次应发合计 as twoPayableTotal,
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
    console.error('获取工资列表失败:', error)
    res.status(500).json({ code: 500, message: '获取工资列表失败' })
  }
})

// 按月份查询汇总（用于新增时判断是否已存在）
router.get('/by-month', async (req, res) => {
  try {
    const { month } = req.query
    if (!isValidMonth(month)) return res.status(400).json({ code: 400, message: '月份格式无效' })

    const rows = await query(
      `
      SELECT TOP 1
        ID as id,
        月份 as month,
        步骤 as step,
        状态 as status
      FROM ${TABLE_SUMMARY}
      WHERE 月份 = @month
    `,
      { month }
    )
    if (!rows.length) return res.status(404).json({ code: 404, message: '不存在' })
    res.json({ code: 0, data: rows[0] })
  } catch (error) {
    console.error('按月份获取工资汇总失败:', error)
    res.status(500).json({ code: 500, message: '按月份获取工资汇总失败' })
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
        人数 as employeeCount,
        加班费合计 as overtimePayTotal,
        两倍加班费合计 as doubleOvertimePayTotal,
        三倍加班费合计 as tripleOvertimePayTotal,
        本期工资合计 as currentSalaryTotal,
        第一次应发合计 as firstPayableTotal,
        第二次应发合计 as secondPayableTotal,
        两次应发合计 as twoPayableTotal,
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
        身份证号 as idCard,
        入职日期 as entryDate,
        职级 as level,

        基本工资 as baseSalary,
        加班费 as overtimePay,
        两倍加班费 as doubleOvertimePay,
        三倍加班费 as tripleOvertimePay,
        夜班补助 as nightShiftSubsidy,
        误餐补助 as mealSubsidy,
        全勤 as fullAttendanceBonus,
        工龄工资 as seniorityPay,

        迟到扣款 as lateDeduction,
        新进及事假 as newOrPersonalLeaveDeduction,
        病假 as sickLeaveDeduction,
        旷工扣款 as absenceDeduction,
        卫生费 as hygieneFee,
        水费 as waterFee,
        电费 as electricityFee,

        基本养老保险费 as pensionInsuranceFee,
        基本医疗保险费 as medicalInsuranceFee,
        失业保险费 as unemploymentInsuranceFee,

        第一批工资 as firstPay,
        第二批工资 as secondPay,
        个税 as incomeTax,

        本期工资 as total,
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

    const normalizedRows = rows.map((r) => {
      const firstPay = toMoney(r.firstPay)
      const secondPay = toMoney(r.secondPay)
      const pensionInsuranceFee = toNegativeMoney(r.pensionInsuranceFee)
      const medicalInsuranceFee = toNegativeMoney(r.medicalInsuranceFee)
      const unemploymentInsuranceFee = toNegativeMoney(r.unemploymentInsuranceFee)

      const firstPayable = toMoney(
        (toNumberOrNull(firstPay) ?? 0) +
          (toNumberOrNull(pensionInsuranceFee) ?? 0) +
          (toNumberOrNull(medicalInsuranceFee) ?? 0) +
          (toNumberOrNull(unemploymentInsuranceFee) ?? 0)
      )

      const incomeTax = toMoney(r.incomeTax)
      const secondPayable = toMoney(
        (toNumberOrNull(secondPay) ?? 0) - (toNumberOrNull(incomeTax) ?? 0)
      )

      const twoPayableTotal = toMoney(
        (toNumberOrNull(firstPayable) ?? 0) + (toNumberOrNull(secondPayable) ?? 0)
      )

      return {
        ...r,
        baseSalary: toMoney(r.baseSalary),
        overtimePay: toMoney(r.overtimePay),
        doubleOvertimePay: toMoney(r.doubleOvertimePay),
        tripleOvertimePay: toMoney(r.tripleOvertimePay),
        nightShiftSubsidy: toMoney(r.nightShiftSubsidy),
        mealSubsidy: toMoney(r.mealSubsidy),
        fullAttendanceBonus: toMoney(r.fullAttendanceBonus),
        seniorityPay: toMoney(r.seniorityPay),
        lateDeduction: toNegativeMoney(r.lateDeduction),
        newOrPersonalLeaveDeduction: toNegativeMoney(r.newOrPersonalLeaveDeduction),
        sickLeaveDeduction: toNegativeMoney(r.sickLeaveDeduction),
        absenceDeduction: toNegativeMoney(r.absenceDeduction),
        hygieneFee: toNegativeMoney(r.hygieneFee),
        waterFee: toNegativeMoney(r.waterFee),
        electricityFee: toNegativeMoney(r.electricityFee),
        pensionInsuranceFee,
        medicalInsuranceFee,
        unemploymentInsuranceFee,
        firstPay,
        secondPay,
        firstPayable,
        incomeTax,
        secondPayable,
        twoPayableTotal,
        currentSalary: toMoney(r.total),
        bonus: toMoney(r.bonus),
        deduction: toMoney(r.deduction),
        total: toMoney(r.total)
      }
    })

    for (const row of normalizedRows) {
      const insReq = new sql.Request(transaction)
      insReq.input('summaryId', sql.Int, id)
      insReq.input('employeeId', sql.Int, row.employeeId || null)
      insReq.input('employeeName', sql.NVarChar, row.employeeName || '')
      insReq.input('employeeNumber', sql.NVarChar, String(row.employeeNumber ?? ''))
      insReq.input('idCard', sql.NVarChar, row.idCard ? String(row.idCard) : null)
      insReq.input('entryDate', sql.Date, parseDateOrNull(row.entryDate))
      insReq.input('level', sql.Int, toNumberOrNull(row.level))

      insReq.input('baseSalary', sql.Decimal(12, 2), row.baseSalary)
      insReq.input('overtimePay', sql.Decimal(12, 2), row.overtimePay)
      insReq.input('doubleOvertimePay', sql.Decimal(12, 2), row.doubleOvertimePay)
      insReq.input('tripleOvertimePay', sql.Decimal(12, 2), row.tripleOvertimePay)
      insReq.input('nightShiftSubsidy', sql.Decimal(12, 2), row.nightShiftSubsidy)
      insReq.input('mealSubsidy', sql.Decimal(12, 2), row.mealSubsidy)
      insReq.input('fullAttendanceBonus', sql.Decimal(12, 2), row.fullAttendanceBonus)
      insReq.input('seniorityPay', sql.Decimal(12, 2), row.seniorityPay)

      insReq.input('lateDeduction', sql.Decimal(12, 2), row.lateDeduction)
      insReq.input(
        'newOrPersonalLeaveDeduction',
        sql.Decimal(12, 2),
        row.newOrPersonalLeaveDeduction
      )
      insReq.input('sickLeaveDeduction', sql.Decimal(12, 2), row.sickLeaveDeduction)
      insReq.input('absenceDeduction', sql.Decimal(12, 2), row.absenceDeduction)
      insReq.input('hygieneFee', sql.Decimal(12, 2), row.hygieneFee)
      insReq.input('waterFee', sql.Decimal(12, 2), row.waterFee)
      insReq.input('electricityFee', sql.Decimal(12, 2), row.electricityFee)

      insReq.input('pensionInsuranceFee', sql.Decimal(12, 2), row.pensionInsuranceFee)
      insReq.input('medicalInsuranceFee', sql.Decimal(12, 2), row.medicalInsuranceFee)
      insReq.input('unemploymentInsuranceFee', sql.Decimal(12, 2), row.unemploymentInsuranceFee)

      insReq.input('firstPay', sql.Decimal(12, 2), row.firstPay)
      insReq.input('secondPay', sql.Decimal(12, 2), row.secondPay)
      insReq.input('firstPayable', sql.Decimal(12, 2), row.firstPayable)
      insReq.input('incomeTax', sql.Decimal(12, 2), row.incomeTax)
      insReq.input('secondPayable', sql.Decimal(12, 2), row.secondPayable)
      insReq.input('twoPayableTotal', sql.Decimal(12, 2), row.twoPayableTotal)
      insReq.input('currentSalary', sql.Decimal(12, 2), row.currentSalary)

      insReq.input('bonus', sql.Decimal(12, 2), row.bonus)
      insReq.input('deduction', sql.Decimal(12, 2), row.deduction)
      insReq.input('total', sql.Decimal(12, 2), row.total)
      insReq.input('remark', sql.NVarChar, row.remark || null)

      await insReq.query(`
        INSERT INTO ${TABLE_DETAIL} (
          汇总ID, 员工ID, 姓名, 工号, 身份证号, 入职日期, 职级,
          基本工资, 加班费, 两倍加班费, 三倍加班费, 夜班补助, 误餐补助, 全勤, 工龄工资,
          迟到扣款, 新进及事假, 病假, 旷工扣款, 卫生费, 水费, 电费,
          基本养老保险费, 基本医疗保险费, 失业保险费,
          第一批工资, 第二批工资, 第一次应发, 个税, 第二次应发, 两次应发合计, 本期工资,
          绩效奖金, 扣款, 合计, 备注,
          创建时间, 更新时间
        )
        VALUES (
          @summaryId, @employeeId, @employeeName, @employeeNumber, @idCard, @entryDate, @level,
          @baseSalary, @overtimePay, @doubleOvertimePay, @tripleOvertimePay, @nightShiftSubsidy, @mealSubsidy, @fullAttendanceBonus, @seniorityPay,
          @lateDeduction, @newOrPersonalLeaveDeduction, @sickLeaveDeduction, @absenceDeduction, @hygieneFee, @waterFee, @electricityFee,
          @pensionInsuranceFee, @medicalInsuranceFee, @unemploymentInsuranceFee,
          @firstPay, @secondPay, @firstPayable, @incomeTax, @secondPayable, @twoPayableTotal, @currentSalary,
          @bonus, @deduction, @total, @remark,
          SYSDATETIME(), SYSDATETIME()
        )
      `)
    }

    const totals = computeSummaryTotals(normalizedRows)
    const updateSummaryReq = new sql.Request(transaction)
    updateSummaryReq.input('id', sql.Int, id)
    updateSummaryReq.input('employeeCount', sql.Int, totals.employeeCount)
    updateSummaryReq.input('overtimePayTotal', sql.Decimal(12, 2), totals.overtimePayTotal)
    updateSummaryReq.input(
      'doubleOvertimePayTotal',
      sql.Decimal(12, 2),
      totals.doubleOvertimePayTotal
    )
    updateSummaryReq.input(
      'tripleOvertimePayTotal',
      sql.Decimal(12, 2),
      totals.tripleOvertimePayTotal
    )
    updateSummaryReq.input('currentSalaryTotal', sql.Decimal(12, 2), totals.currentSalaryTotal)
    updateSummaryReq.input('firstPayableTotal', sql.Decimal(12, 2), totals.firstPayableTotal)
    updateSummaryReq.input('secondPayableTotal', sql.Decimal(12, 2), totals.secondPayableTotal)
    updateSummaryReq.input('twoPayableTotal', sql.Decimal(12, 2), totals.twoPayableTotal)
    await updateSummaryReq.query(`
      UPDATE ${TABLE_SUMMARY}
      SET
        人数 = @employeeCount,
        加班费合计 = @overtimePayTotal,
        两倍加班费合计 = @doubleOvertimePayTotal,
        三倍加班费合计 = @tripleOvertimePayTotal,
        本期工资合计 = @currentSalaryTotal,
        第一次应发合计 = @firstPayableTotal,
        第二次应发合计 = @secondPayableTotal,
        两次应发合计 = @twoPayableTotal,
        更新时间 = SYSDATETIME()
      WHERE ID = @id
    `)

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

// 删除（删除汇总，级联删除明细）
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    if (Number.isNaN(id)) return res.status(400).json({ code: 400, message: 'ID 无效' })
    await query(`DELETE FROM ${TABLE_SUMMARY} WHERE ID = @id`, { id })
    res.json({ code: 0, message: '删除成功' })
  } catch (error) {
    console.error('删除工资失败:', error)
    res.status(500).json({ code: 500, message: '删除失败' })
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
        基本养老保险费 as pensionInsuranceFee,
        基本医疗保险费 as medicalInsuranceFee,
        失业保险费 as unemploymentInsuranceFee,
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
      upsertReq.input('pensionInsuranceFee', sql.Decimal(12, 2), toMoney(row.pensionInsuranceFee))
      upsertReq.input('medicalInsuranceFee', sql.Decimal(12, 2), toMoney(row.medicalInsuranceFee))
      upsertReq.input(
        'unemploymentInsuranceFee',
        sql.Decimal(12, 2),
        toMoney(row.unemploymentInsuranceFee)
      )
      upsertReq.input('adjustDate', sql.DateTime2, parseDateOrNull(row.adjustDate))
      await upsertReq.query(`
        MERGE ${TABLE_SALARY_BASE} AS t
        USING (SELECT @employeeId AS 员工ID) AS s
        ON (t.员工ID = s.员工ID)
        WHEN MATCHED THEN
          UPDATE SET
            工资基数 = @salaryBase,
            基本养老保险费 = @pensionInsuranceFee,
            基本医疗保险费 = @medicalInsuranceFee,
            失业保险费 = @unemploymentInsuranceFee,
            调整日期 = @adjustDate,
            更新时间 = SYSDATETIME()
        WHEN NOT MATCHED THEN
          INSERT (
            员工ID,
            工资基数,
            基本养老保险费,
            基本医疗保险费,
            失业保险费,
            调整日期,
            创建时间,
            更新时间
          )
          VALUES (
            @employeeId,
            @salaryBase,
            @pensionInsuranceFee,
            @medicalInsuranceFee,
            @unemploymentInsuranceFee,
            @adjustDate,
            SYSDATETIME(),
            SYSDATETIME()
          );
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

router.get('/params/penalty', async (req, res) => {
  try {
    const rows = await query(`
      SELECT
        罚扣名称 as name,
        计量方式 as unit,
        金额 as amount,
        调整日期 as adjustDate,
        更新时间 as updatedAt
      FROM ${TABLE_PENALTY}
      ORDER BY 罚扣名称
    `)
    res.json({ code: 0, data: rows })
  } catch (error) {
    console.error('获取罚扣参数失败:', error)
    res.status(500).json({ code: 500, message: '获取罚扣参数失败' })
  }
})

router.put('/params/penalty', async (req, res) => {
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
        MERGE ${TABLE_PENALTY} AS t
        USING (SELECT @name AS 罚扣名称) AS s
        ON (t.罚扣名称 = s.罚扣名称)
        WHEN MATCHED THEN
          UPDATE SET 计量方式 = @unit, 金额 = @amount, 调整日期 = @adjustDate, 更新时间 = SYSDATETIME()
        WHEN NOT MATCHED THEN
          INSERT (罚扣名称, 计量方式, 金额, 调整日期, 创建时间, 更新时间)
          VALUES (@name, @unit, @amount, @adjustDate, SYSDATETIME(), SYSDATETIME());
      `)
    }

    await transaction.commit()
    res.json({ code: 0, message: '保存成功' })
  } catch (error) {
    if (transaction) await transaction.rollback()
    console.error('保存罚扣参数失败:', error)
    res.status(500).json({ code: 500, message: error.message || '保存罚扣参数失败' })
  }
})

// 个税申报文件：生成 Excel（步骤2数据）
router.post('/tax-import/export', async (req, res) => {
  try {
    const { month, rows, batch } = req.body || {}
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ code: 400, message: 'rows 必须是数组且不能为空' })
    }
    const batchNo = Number(batch || 1)
    const isSecondBatch = batchNo === 2
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet(TAX_IMPORT_SHEET_NAME)
    worksheet.getRow(1).values = TAX_IMPORT_HEADERS

    let rowIndex = 2 // 模板第 1 行是表头
    for (const item of rows) {
      const employeeName = String(item?.employeeName ?? item?.name ?? '').trim()
      if (!employeeName) continue

      const idCard = String(item?.idCard ?? '').trim()
      const pensionInsuranceFee = toNumberOrZero(item?.pensionInsuranceFee)
      const medicalInsuranceFee = toNumberOrZero(item?.medicalInsuranceFee)
      const unemploymentInsuranceFee = toNumberOrZero(item?.unemploymentInsuranceFee)

      // 第一批：若三项保险费都为 0，则整行不导出
      if (
        !isSecondBatch &&
        pensionInsuranceFee === 0 &&
        medicalInsuranceFee === 0 &&
        unemploymentInsuranceFee === 0
      ) {
        continue
      }

      worksheet.getCell(`B${rowIndex}`).value = employeeName
      worksheet.getCell(`C${rowIndex}`).value = '居民身份证'
      worksheet.getCell(`D${rowIndex}`).value = idCard

      // E 列：第一批/第二批工资
      worksheet.getCell(`E${rowIndex}`).value = toNumberOrZero(item?.firstPay)

      // 第二批：三项保险费固定填 0；第一批：填实际值
      worksheet.getCell(`G${rowIndex}`).value = isSecondBatch ? 0 : pensionInsuranceFee
      worksheet.getCell(`H${rowIndex}`).value = isSecondBatch ? 0 : medicalInsuranceFee
      worksheet.getCell(`I${rowIndex}`).value = isSecondBatch ? 0 : unemploymentInsuranceFee

      rowIndex += 1
    }

    const filePrefix = isSecondBatch ? '第二批工资' : '第一批工资'
    const fileName = `${filePrefix}_个税导入_${String(month || '').trim() || '模板'}.xlsx`
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`
    )
    await workbook.xlsx.write(res)
    res.end()
  } catch (error) {
    console.error('生成个税导入模板失败:', error)
    res.status(500).json({ code: 500, message: error.message || '生成个税导入模板失败' })
  }
})

// 个税导入：读取外部 Excel（步骤3按身份证号+姓名匹配回填个税）
router.post('/tax-import/read', uploadTaxFile.single('file'), async (req, res) => {
  try {
    const file = req.file
    if (!file) return res.status(400).json({ code: 400, message: '缺少上传文件' })

    const originalName = String(file.originalname || '').toLowerCase()
    if (!originalName.endsWith('.xls') && !originalName.endsWith('.xlsx')) {
      return res.status(400).json({ code: 400, message: '仅支持 .xls 或 .xlsx 文件' })
    }

    const workbook = XLSX.read(file.buffer, { type: 'buffer' })
    const targetSheetName = '个人所得税扣缴申报表'
    const sheetName =
      workbook.SheetNames?.find((n) => String(n || '').trim() === targetSheetName) || null
    if (!sheetName) {
      return res.status(400).json({
        code: 400,
        message: `未找到工作表：${targetSheetName}`,
        data: { sheetNames: workbook.SheetNames || [] }
      })
    }

    const worksheet = workbook.Sheets[sheetName]
    const ref = worksheet?.['!ref']
    if (!worksheet || !ref) return res.status(400).json({ code: 400, message: 'Excel 工作表为空' })

    const range = XLSX.utils.decode_range(ref)
    const normalizeText = (val) => String(val ?? '').trim()
    const getCellText = (c, r) => {
      const cell = worksheet[XLSX.utils.encode_cell({ c, r })]
      if (!cell) return ''
      return normalizeText(cell.w ?? cell.v)
    }
    const parseMoney = (val) => {
      if (val === null || val === undefined || val === '') return null
      if (typeof val === 'number') return Number.isFinite(val) ? val : null
      const text = String(val).trim()
      if (!text) return null
      const num = Number(text.replace(/,/g, ''))
      return Number.isNaN(num) ? null : num
    }

    const items = []
    const START_ROW_NUMBER = 9
    const rStart = Math.max(range.s.r, START_ROW_NUMBER - 1)

    // B=姓名(1), D=身份证(3), AO=个税(40)
    for (let r = rStart; r <= range.e.r; r += 1) {
      const employeeName = getCellText(1, r)
      const idCard = getCellText(3, r)
      const incomeTaxRawCell = worksheet[XLSX.utils.encode_cell({ c: 40, r })]
      const incomeTax = parseMoney(
        incomeTaxRawCell ? (incomeTaxRawCell.w ?? incomeTaxRawCell.v) : ''
      )

      if (!employeeName && !idCard) continue
      if (!employeeName || !idCard) continue
      items.push({ employeeName, idCard, incomeTax })
    }

    res.json({ code: 0, data: items })
  } catch (error) {
    console.error('读取个税Excel失败:', error)
    res.status(500).json({ code: 500, message: error.message || '读取个税Excel失败' })
  }
})

module.exports = router
