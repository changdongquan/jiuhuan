/**
 * 一次性导入“历史已出货完”项目到出库单明细：
 * - 出库单号：HIS-20260101-001（可通过环境变量 OUTBOUND_HISTORY_DOCUMENT_NO 覆盖）
 * - 出库日期：2026-01-01（可通过环境变量 OUTBOUND_HISTORY_DATE 覆盖）
 * - 仓库：成品仓（可通过环境变量 OUTBOUND_HISTORY_WAREHOUSE 覆盖）
 * - 经办人/创建人/更新人：admin（可通过环境变量 OUTBOUND_HISTORY_OPERATOR 覆盖）
 * - 备注：历史导入
 *
 * 导入范围（既成事实）：
 * - 项目管理.项目状态 = 已经移模
 * - 生产任务.已完成数量 为正整数
 *
 * 使用：
 *   node backend/scripts/import-outbound-history-20260101.js
 *   DRY_RUN=1 node backend/scripts/import-outbound-history-20260101.js
 */
const sql = require('mssql')
const { getPool, query } = require('../database')

const DOCUMENT_NO = process.env.OUTBOUND_HISTORY_DOCUMENT_NO || 'HIS-20260101-001'
const OUTBOUND_DATE = process.env.OUTBOUND_HISTORY_DATE || '2026-01-01'
const WAREHOUSE = process.env.OUTBOUND_HISTORY_WAREHOUSE || '成品仓'
const OPERATOR = process.env.OUTBOUND_HISTORY_OPERATOR || 'admin'
const OUTBOUND_TYPE = process.env.OUTBOUND_HISTORY_TYPE || '历史导入'
const REMARK = process.env.OUTBOUND_HISTORY_REMARK || '历史导入'
const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true'

const toPositiveIntOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null
  const num = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(num) || !Number.isInteger(num) || num <= 0) return null
  return num
}

const ensureOutboundTables = async () => {
  await query(`
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
  `)
}

const main = async () => {
  console.log('准备导入历史出库单...')
  console.log('documentNo:', DOCUMENT_NO)
  console.log('outboundDate:', OUTBOUND_DATE)
  console.log('warehouse:', WAREHOUSE)
  console.log('operator:', OPERATOR)
  console.log('dryRun:', DRY_RUN)

  await ensureOutboundTables()

  const existed = await query(`SELECT TOP 1 1 as ok FROM 出库单明细 WHERE 出库单号 = @documentNo`, {
    documentNo: DOCUMENT_NO
  })
  if (existed?.length) {
    console.log(`已存在出库单号 ${DOCUMENT_NO}，为避免重复导入已中止。`)
    process.exit(0)
  }

  const candidates = await query(
    `
      SELECT
        p.项目编号,
        p.客户ID,
        c.客户名称,
        p.客户模号,
        g_pick.产品名称,
        g_pick.产品图号,
        pt.已完成数量
      FROM 项目管理 p
      INNER JOIN 生产任务 pt ON pt.项目编号 = p.项目编号
      LEFT JOIN 客户信息 c ON p.客户ID = c.客户ID
      OUTER APPLY (
        SELECT TOP 1
          g.产品名称,
          g.产品图号
        FROM 货物信息 g
        WHERE g.项目编号 = p.项目编号
        ORDER BY
          CASE WHEN CAST(ISNULL(g.IsNew, 0) AS INT) = 1 THEN 1 ELSE 0 END ASC,
          g.货物ID DESC
      ) g_pick
      WHERE p.项目状态 = N'已经移模'
        AND pt.已完成数量 IS NOT NULL
        AND pt.已完成数量 > 0
      ORDER BY p.项目编号 ASC
    `
  )

  const rows = Array.isArray(candidates) ? candidates : []
  const toInsert = rows
    .map((r) => ({
      项目编号: String(r.项目编号 || '').trim(),
      客户ID: r.客户ID ?? null,
      客户名称: r.客户名称 ?? null,
      客户模号: r.客户模号 ?? null,
      产品名称: r.产品名称 ?? null,
      产品图号: r.产品图号 ?? null,
      出库数量: toPositiveIntOrNull(r.已完成数量)
    }))
    .filter((r) => r.项目编号 && r.出库数量)

  console.log(`候选项目 ${rows.length} 条，可导入 ${toInsert.length} 条`)
  if (!toInsert.length) {
    console.log('无可导入记录，结束。')
    process.exit(0)
  }

  if (DRY_RUN) {
    console.log('DRY_RUN=1，仅打印前 20 条：')
    console.table(toInsert.slice(0, 20))
    process.exit(0)
  }

  const pool = await getPool()
  const tx = new sql.Transaction(pool)
  await tx.begin()
  try {
    for (const r of toInsert) {
      const req = new sql.Request(tx)
      req.input('documentNo', sql.NVarChar, DOCUMENT_NO)
      req.input('outboundDate', sql.NVarChar, OUTBOUND_DATE)
      req.input('customerId', sql.Int, r.客户ID ?? null)
      req.input('customerName', sql.NVarChar, r.客户名称 ?? null)
      req.input('projectCode', sql.NVarChar, r.项目编号)
      req.input('productName', sql.NVarChar, r.产品名称 ?? null)
      req.input('productDrawing', sql.NVarChar, r.产品图号 ?? null)
      req.input('customerPartNo', sql.NVarChar, r.客户模号 ?? null)
      req.input('quantity', sql.Int, r.出库数量)
      req.input('outboundType', sql.NVarChar, OUTBOUND_TYPE)
      req.input('warehouse', sql.NVarChar, WAREHOUSE)
      req.input('handler', sql.NVarChar, OPERATOR)
      req.input('remark', sql.NVarChar, REMARK)
      req.input('creator', sql.NVarChar, OPERATOR)
      req.input('updater', sql.NVarChar, OPERATOR)

      await req.query(`
        INSERT INTO 出库单明细 (
          出库单号, 出库日期, 客户ID, 客户名称,
          项目编号, 产品名称, 产品图号, 客户模号, 出库数量,
          出库类型, 仓库, 经办人, 备注, 创建人, 更新人
        ) VALUES (
          @documentNo, @outboundDate, @customerId, @customerName,
          @projectCode, @productName, @productDrawing, @customerPartNo, @quantity,
          @outboundType, @warehouse, @handler, @remark, @creator, @updater
        )
      `)
    }

    await tx.commit()
    console.log(`✅ 导入完成：${DOCUMENT_NO}（${toInsert.length} 条明细）`)
  } catch (err) {
    await tx.rollback()
    throw err
  }
}

main().catch((err) => {
  console.error('❌ 导入失败:', err)
  process.exit(1)
})
