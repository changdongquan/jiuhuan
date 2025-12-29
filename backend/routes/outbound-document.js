const express = require('express')
const sql = require('mssql')
const { getPool, query } = require('../database')

const router = express.Router()

let tablesReady = false

const ensureTables = async () => {
  if (tablesReady) return

  const createSql = `
    IF OBJECT_ID(N'出库单明细', N'U') IS NULL
    BEGIN
      CREATE TABLE 出库单明细 (
        id INT IDENTITY(1,1) PRIMARY KEY,
        出库单号 NVARCHAR(50) NOT NULL,
        出库日期 DATE NULL,
        客户ID INT NULL,
        客户名称 NVARCHAR(200) NULL,
        项目编号 NVARCHAR(100) NULL,
        产品名称 NVARCHAR(200) NULL,
        产品图号 NVARCHAR(200) NULL,
        客户模号 NVARCHAR(200) NULL,
        出库数量 DECIMAL(18,2) NULL,
        单位 NVARCHAR(50) NULL,
        单价 DECIMAL(18,2) NULL,
        金额 DECIMAL(18,2) NULL,
        出库类型 NVARCHAR(50) NULL,
        仓库 NVARCHAR(50) NULL,
        经办人 NVARCHAR(100) NULL,
        审核人 NVARCHAR(100) NULL,
        审核状态 NVARCHAR(50) NULL,
        备注 NVARCHAR(500) NULL,
        创建人 NVARCHAR(100) NULL,
        更新人 NVARCHAR(100) NULL,
        创建时间 DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        更新时间 DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
      )

      CREATE INDEX IX_出库单明细_出库单号 ON 出库单明细(出库单号)
      CREATE INDEX IX_出库单明细_客户ID ON 出库单明细(客户ID)
    END
  `

  await query(createSql)
  tablesReady = true
}

const bindParams = (request, params) => {
  Object.keys(params).forEach((key) => {
    const value = params[key]
    if (value === null || value === undefined) {
      request.input(key, sql.NVarChar, null)
    } else if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        request.input(key, sql.Int, value)
      } else {
        request.input(key, sql.Float, value)
      }
    } else if (typeof value === 'boolean') {
      request.input(key, sql.Bit, value)
    } else if (value instanceof Date) {
      request.input(key, sql.DateTime2, value)
    } else {
      request.input(key, sql.NVarChar, value)
    }
  })
}

router.get('/list', async (req, res) => {
  try {
    await ensureTables()
    const {
      keyword = '',
      status = '',
      outboundType = '',
      sortField = '',
      sortOrder = '',
      page = 1,
      pageSize = 20
    } = req.query

    const pageNum = Math.max(parseInt(page, 10) || 1, 1)
    const sizeNum = Math.max(parseInt(pageSize, 10) || 20, 1)
    const offset = (pageNum - 1) * sizeNum

    const params = { offset, size: sizeNum }
    const where = []

    if (keyword) {
      where.push(`(
        出库单号 LIKE @kw OR 客户名称 LIKE @kw OR 项目编号 LIKE @kw OR 产品名称 LIKE @kw OR 产品图号 LIKE @kw OR 客户模号 LIKE @kw
      )`)
      params.kw = `%${keyword}%`
    }
    if (status) {
      where.push('审核状态 = @status')
      params.status = status
    }
    if (outboundType) {
      where.push('出库类型 = @outboundType')
      params.outboundType = outboundType
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

    const sortMap = {
      出库单号: '出库单号',
      出库日期: '出库日期',
      创建时间: '创建时间',
      更新时间: '更新时间'
    }
    const safeSortField = sortMap[String(sortField)] || '创建时间'
    const safeSortOrder = String(sortOrder).toLowerCase() === 'asc' ? 'ASC' : 'DESC'

    const totalSql = `SELECT COUNT(1) as total FROM 出库单明细 ${whereSql}`
    const listSql = `
      SELECT *
      FROM 出库单明细
      ${whereSql}
      ORDER BY ${safeSortField} ${safeSortOrder}
      OFFSET @offset ROWS
      FETCH NEXT @size ROWS ONLY
    `

    const [totalRow] = await query(totalSql, params)
    const list = await query(listSql, params)

    res.json({
      code: 0,
      success: true,
      data: {
        list,
        total: totalRow?.total || 0,
        page: pageNum,
        pageSize: sizeNum
      }
    })
  } catch (error) {
    console.error('获取出库单列表失败:', error)
    res.status(500).json({ code: 500, success: false, message: '获取出库单列表失败' })
  }
})

router.get('/detail', async (req, res) => {
  try {
    await ensureTables()
    const documentNo = String(req.query.documentNo || '').trim()
    if (!documentNo) {
      res.status(400).json({ code: 400, success: false, message: 'documentNo 不能为空' })
      return
    }

    const rows = await query(
      `SELECT * FROM 出库单明细 WHERE 出库单号 = @documentNo ORDER BY id ASC`,
      { documentNo }
    )
    const header = rows[0] || null
    res.json({ code: 0, success: true, data: header ? { ...header, details: rows } : null })
  } catch (error) {
    console.error('获取出库单详情失败:', error)
    res.status(500).json({ code: 500, success: false, message: '获取出库单详情失败' })
  }
})

router.post('/', async (req, res) => {
  try {
    await ensureTables()
    const body = req.body || {}
    const documentNo = String(body.出库单号 || '').trim()
    if (!documentNo) {
      res.status(400).json({ code: 400, success: false, message: '出库单号不能为空' })
      return
    }

    const details = Array.isArray(body.details) ? body.details : [body]
    if (!details.length) {
      res.status(400).json({ code: 400, success: false, message: '明细不能为空' })
      return
    }

    const pool = await getPool()
    const tx = new sql.Transaction(pool)
    await tx.begin()
    try {
      // 同一出库单号不允许重复创建
      const existsReq = new sql.Request(tx)
      existsReq.input('documentNo', sql.NVarChar, documentNo)
      const existsRes = await existsReq.query(
        `SELECT TOP 1 1 as ok FROM 出库单明细 WHERE 出库单号 = @documentNo`
      )
      if (existsRes.recordset?.length) {
        await tx.rollback()
        res.status(409).json({ code: 409, success: false, message: '出库单号已存在' })
        return
      }

      for (const d of details) {
        const req1 = new sql.Request(tx)
        const params = {
          出库单号: documentNo,
          出库日期: body.出库日期 || null,
          客户ID: body.客户ID || null,
          客户名称: body.客户名称 || null,
          项目编号: d.项目编号 || body.项目编号 || null,
          产品名称: d.产品名称 || body.产品名称 || null,
          产品图号: d.产品图号 || body.产品图号 || null,
          客户模号: d.客户模号 || body.客户模号 || null,
          出库数量: d.出库数量 ?? body.出库数量 ?? null,
          单位: body.单位 || null,
          单价: body.单价 ?? null,
          金额: body.金额 ?? null,
          出库类型: body.出库类型 || null,
          仓库: body.仓库 || null,
          经办人: body.经办人 || null,
          审核人: body.审核人 || null,
          审核状态: body.审核状态 || null,
          备注: d.备注 || body.备注 || null,
          创建人: body.创建人 || null,
          更新人: body.更新人 || null
        }
        bindParams(req1, params)
        await req1.query(`
          INSERT INTO 出库单明细 (
            出库单号, 出库日期, 客户ID, 客户名称,
            项目编号, 产品名称, 产品图号, 客户模号, 出库数量,
            单位, 单价, 金额, 出库类型, 仓库,
            经办人, 审核人, 审核状态, 备注, 创建人, 更新人
          ) VALUES (
            @出库单号, @出库日期, @客户ID, @客户名称,
            @项目编号, @产品名称, @产品图号, @客户模号, @出库数量,
            @单位, @单价, @金额, @出库类型, @仓库,
            @经办人, @审核人, @审核状态, @备注, @创建人, @更新人
          )
        `)
      }

      await tx.commit()
      res.json({ code: 0, success: true, message: '创建成功', data: { documentNo } })
    } catch (e) {
      await tx.rollback()
      throw e
    }
  } catch (error) {
    console.error('创建出库单失败:', error)
    res.status(500).json({ code: 500, success: false, message: '创建出库单失败' })
  }
})

router.put('/update', async (req, res) => {
  try {
    await ensureTables()
    const documentNo = String(req.body?.documentNo || '').trim()
    if (!documentNo) {
      res.status(400).json({ code: 400, success: false, message: 'documentNo 不能为空' })
      return
    }

    // 仅更新头字段（同一出库单号下所有行同步）
    const data = req.body || {}
    const params = {
      documentNo,
      出库日期: data.出库日期 ?? null,
      客户ID: data.客户ID ?? null,
      客户名称: data.客户名称 ?? null,
      单位: data.单位 ?? null,
      单价: data.单价 ?? null,
      金额: data.金额 ?? null,
      出库类型: data.出库类型 ?? null,
      仓库: data.仓库 ?? null,
      经办人: data.经办人 ?? null,
      审核人: data.审核人 ?? null,
      审核状态: data.审核状态 ?? null,
      备注: data.备注 ?? null,
      更新人: data.更新人 ?? null
    }

    await query(
      `
        UPDATE 出库单明细
        SET
          出库日期 = COALESCE(@出库日期, 出库日期),
          客户ID = COALESCE(@客户ID, 客户ID),
          客户名称 = COALESCE(@客户名称, 客户名称),
          单位 = COALESCE(@单位, 单位),
          单价 = COALESCE(@单价, 单价),
          金额 = COALESCE(@金额, 金额),
          出库类型 = COALESCE(@出库类型, 出库类型),
          仓库 = COALESCE(@仓库, 仓库),
          经办人 = COALESCE(@经办人, 经办人),
          审核人 = COALESCE(@审核人, 审核人),
          审核状态 = COALESCE(@审核状态, 审核状态),
          备注 = COALESCE(@备注, 备注),
          更新人 = COALESCE(@更新人, 更新人),
          更新时间 = SYSUTCDATETIME()
        WHERE 出库单号 = @documentNo
      `,
      params
    )

    res.json({ code: 0, success: true, message: '更新成功' })
  } catch (error) {
    console.error('更新出库单失败:', error)
    res.status(500).json({ code: 500, success: false, message: '更新出库单失败' })
  }
})

router.delete('/delete', async (req, res) => {
  try {
    await ensureTables()
    const documentNo = String(req.query.documentNo || '').trim()
    if (!documentNo) {
      res.status(400).json({ code: 400, success: false, message: 'documentNo 不能为空' })
      return
    }
    await query(`DELETE FROM 出库单明细 WHERE 出库单号 = @documentNo`, { documentNo })
    res.json({ code: 0, success: true, message: '删除成功' })
  } catch (error) {
    console.error('删除出库单失败:', error)
    res.status(500).json({ code: 500, success: false, message: '删除出库单失败' })
  }
})

router.get('/statistics', async (_req, res) => {
  try {
    await ensureTables()
    const rows = await query(`
      SELECT
        COUNT(DISTINCT 出库单号) as totalDocuments,
        SUM(CASE WHEN 审核状态 = N'待审核' THEN 1 ELSE 0 END) as pendingDocuments,
        SUM(CASE WHEN 审核状态 = N'已审核' THEN 1 ELSE 0 END) as approvedDocuments,
        SUM(CASE WHEN 审核状态 = N'已驳回' THEN 1 ELSE 0 END) as rejectedDocuments
      FROM 出库单明细
    `)
    const s = rows[0] || {}
    res.json({ code: 0, success: true, data: s })
  } catch (error) {
    console.error('获取出库单统计失败:', error)
    res.status(500).json({ code: 500, success: false, message: '获取出库单统计失败' })
  }
})

module.exports = router
