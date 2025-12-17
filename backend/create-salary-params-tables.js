const sql = require('mssql')
const config = require('./config')

const TABLE_SALARY_BASE = '工资_工资基数'
const TABLE_OVERTIME_BASE = '工资_加班费基数'
const TABLE_SUBSIDY = '工资_补助'

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
        调整日期 DATE NULL,
        创建时间 DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        更新时间 DATETIME2 NOT NULL DEFAULT SYSDATETIME()
      )
    `
    )

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

    // 初始化默认补助项（按次），若不存在则插入
    const defaults = ['夜班补助', '误餐补助', '全勤补助', '工龄补助']
    for (const name of defaults) {
      const exists = await pool
        .request()
        .input('name', sql.NVarChar, name)
        .query(`SELECT 1 FROM ${TABLE_SUBSIDY} WHERE 补助名称 = @name`)
      if (exists.recordset.length) continue
      await pool
        .request()
        .input('name', sql.NVarChar, name)
        .query(
          `INSERT INTO ${TABLE_SUBSIDY} (补助名称, 计量方式, 金额, 调整日期, 创建时间, 更新时间)
           VALUES (@name, N'按次', NULL, NULL, SYSDATETIME(), SYSDATETIME())`
        )
      console.log(`已初始化补助项：${name}`)
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
