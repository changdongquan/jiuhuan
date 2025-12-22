const sql = require('mssql')
const config = require('./config')

const TABLE_SALARY_BASE = '工资_工资基数'
const TABLE_OVERTIME_BASE = '工资_加班费基数'
const TABLE_SUBSIDY = '工资_补助'
const TABLE_PENALTY = '工资_罚扣'

async function ensureSalaryParamsTables() {
  let pool = null
  try {
    console.log('正在连接数据库...')
    pool = await sql.connect(config)
    console.log('✅ 数据库连接成功\n')

    const ensureTable = async (tableName, createSql) => {
      const exists = await pool
        .request()
        .input('table', sql.NVarChar, tableName)
        .query(`SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = @table`)
      if (exists.recordset.length > 0) {
        console.log(`表已存在，跳过创建：${tableName}`)
        return
      }
      console.log(`创建表：${tableName}`)
      await pool.request().query(createSql)
    }

    await ensureTable(
      TABLE_SALARY_BASE,
      `
      CREATE TABLE ${TABLE_SALARY_BASE} (
        ID INT IDENTITY(1,1) PRIMARY KEY,
        员工ID INT NOT NULL UNIQUE,
        工资基数 DECIMAL(12,2) NULL,
        社保基数 DECIMAL(12,2) NULL,
        基本养老保险费 DECIMAL(12,2) NULL,
        基本医疗保险费 DECIMAL(12,2) NULL,
        失业保险费 DECIMAL(12,2) NULL,
        调整日期 DATE NULL,
        创建时间 DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        更新时间 DATETIME2 NOT NULL DEFAULT SYSDATETIME()
      )
    `
    )

    // 兼容历史库：为工资基数表补齐新增字段
    const ensureColumn = async (tableName, columnName, columnSql) => {
      await pool.request().query(`
        IF COL_LENGTH(N'${tableName}', N'${columnName}') IS NULL
        BEGIN
          ALTER TABLE ${tableName} ADD ${columnSql};
        END
      `)
    }
    await ensureColumn(TABLE_SALARY_BASE, '社保基数', '社保基数 DECIMAL(12,2) NULL')
    await ensureColumn(TABLE_SALARY_BASE, '基本养老保险费', '基本养老保险费 DECIMAL(12,2) NULL')
    await ensureColumn(TABLE_SALARY_BASE, '基本医疗保险费', '基本医疗保险费 DECIMAL(12,2) NULL')
    await ensureColumn(TABLE_SALARY_BASE, '失业保险费', '失业保险费 DECIMAL(12,2) NULL')

    await ensureTable(
      TABLE_OVERTIME_BASE,
      `
      CREATE TABLE ${TABLE_OVERTIME_BASE} (
        ID INT IDENTITY(1,1) PRIMARY KEY,
        职级 INT NOT NULL UNIQUE,
        加班 DECIMAL(12,2) NULL,
        两倍加班 DECIMAL(12,2) NULL,
        三倍加班 DECIMAL(12,2) NULL,
        调整日期 DATE NULL,
        创建时间 DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        更新时间 DATETIME2 NOT NULL DEFAULT SYSDATETIME()
      )
    `
    )

    await ensureTable(
      TABLE_SUBSIDY,
      `
      CREATE TABLE ${TABLE_SUBSIDY} (
        ID INT IDENTITY(1,1) PRIMARY KEY,
        补助名称 NVARCHAR(50) NOT NULL UNIQUE,
        计量方式 NVARCHAR(20) NOT NULL DEFAULT N'按次',
        金额 DECIMAL(12,2) NULL,
        调整日期 DATE NULL,
        创建时间 DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        更新时间 DATETIME2 NOT NULL DEFAULT SYSDATETIME()
      )
    `
    )

    await ensureTable(
      TABLE_PENALTY,
      `
      CREATE TABLE ${TABLE_PENALTY} (
        ID INT IDENTITY(1,1) PRIMARY KEY,
        罚扣名称 NVARCHAR(50) NOT NULL UNIQUE,
        计量方式 NVARCHAR(20) NOT NULL DEFAULT N'按次',
        金额 DECIMAL(12,2) NULL,
        调整日期 DATE NULL,
        创建时间 DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        更新时间 DATETIME2 NOT NULL DEFAULT SYSDATETIME()
      )
    `
    )

    // 初始化默认补助项（按次），若不存在则插入
    const defaults = [
      { name: '夜班补助', amount: null },
      { name: '误餐补助', amount: null },
      { name: '全勤补助', amount: null },
      { name: '工龄补助', amount: null }
    ]
    for (const item of defaults) {
      const name = item.name
      const exists = await pool
        .request()
        .input('name', sql.NVarChar, name)
        .query(`SELECT 1 FROM ${TABLE_SUBSIDY} WHERE 补助名称 = @name`)
      if (exists.recordset.length) continue
      await pool
        .request()
        .input('name', sql.NVarChar, name)
        .input('amount', sql.Decimal(12, 2), item.amount)
        .query(
          `INSERT INTO ${TABLE_SUBSIDY} (补助名称, 计量方式, 金额, 调整日期, 创建时间, 更新时间)
           VALUES (@name, N'按次', @amount, NULL, SYSDATETIME(), SYSDATETIME())`
        )
      console.log(`已初始化补助项：${name}`)
    }

    // 清理历史补助项：拆分基数（已废弃）
    await pool.request().query(`DELETE FROM ${TABLE_SUBSIDY} WHERE 补助名称 = N'拆分基数'`)

    // 初始化默认罚扣项（按次），若不存在则插入
    const penaltyDefaults = [{ name: '迟到扣款', amount: null }]
    for (const item of penaltyDefaults) {
      const name = item.name
      const exists = await pool
        .request()
        .input('name', sql.NVarChar, name)
        .query(`SELECT 1 FROM ${TABLE_PENALTY} WHERE 罚扣名称 = @name`)
      if (exists.recordset.length) continue
      await pool
        .request()
        .input('name', sql.NVarChar, name)
        .input('amount', sql.Decimal(12, 2), item.amount)
        .query(
          `INSERT INTO ${TABLE_PENALTY} (罚扣名称, 计量方式, 金额, 调整日期, 创建时间, 更新时间)
           VALUES (@name, N'按次', @amount, NULL, SYSDATETIME(), SYSDATETIME())`
        )
      console.log(`已初始化罚扣项：${name}`)
    }

    console.log('\n✅ 工资参数表结构检查完成')
  } finally {
    if (pool) {
      await pool.close()
      console.log('数据库连接已关闭')
    }
  }
}

if (require.main === module) {
  ensureSalaryParamsTables()
    .then(() => {
      console.log('脚本执行结束')
      process.exit(0)
    })
    .catch((err) => {
      console.error('脚本执行失败:', err)
      process.exit(1)
    })
}

module.exports = { ensureSalaryParamsTables }
