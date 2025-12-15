const sql = require('mssql')
const config = require('./config')

const TABLE_SUMMARY = '工资汇总'
const TABLE_DETAIL = '工资明细'

async function ensureSalaryTables() {
  let pool = null
  try {
    console.log('正在连接数据库...')
    pool = await sql.connect(config)
    console.log('✅ 数据库连接成功\n')

    const summaryExists = await pool
      .request()
      .input('table', sql.NVarChar, TABLE_SUMMARY)
      .query(`SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = @table`)

    if (summaryExists.recordset.length === 0) {
      console.log(`创建表：${TABLE_SUMMARY}`)
      await pool.request().query(`
        CREATE TABLE ${TABLE_SUMMARY} (
          ID INT IDENTITY(1,1) PRIMARY KEY,
          月份 NVARCHAR(7) NOT NULL UNIQUE,
          步骤 INT NOT NULL DEFAULT 1,
          状态 NVARCHAR(20) NOT NULL DEFAULT N'草稿',
          创建时间 DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
          更新时间 DATETIME2 NOT NULL DEFAULT SYSDATETIME()
        )
      `)
    } else {
      console.log(`表已存在，跳过创建：${TABLE_SUMMARY}`)
    }

    const detailExists = await pool
      .request()
      .input('table', sql.NVarChar, TABLE_DETAIL)
      .query(`SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = @table`)

    if (detailExists.recordset.length === 0) {
      console.log(`创建表：${TABLE_DETAIL}`)
      await pool.request().query(`
        CREATE TABLE ${TABLE_DETAIL} (
          ID INT IDENTITY(1,1) PRIMARY KEY,
          汇总ID INT NOT NULL,
          员工ID INT NULL,
          姓名 NVARCHAR(50) NOT NULL,
          工号 NVARCHAR(50) NOT NULL,
          基本工资 DECIMAL(12,2) NULL,
          绩效奖金 DECIMAL(12,2) NULL,
          扣款 DECIMAL(12,2) NULL,
          合计 DECIMAL(12,2) NULL,
          备注 NVARCHAR(500) NULL,
          创建时间 DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
          更新时间 DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
          CONSTRAINT FK_工资明细_汇总 FOREIGN KEY (汇总ID) REFERENCES ${TABLE_SUMMARY}(ID) ON DELETE CASCADE
        )
      `)

      console.log('创建索引：idx_工资明细_汇总ID')
      await pool.request().query(`
        CREATE INDEX idx_工资明细_汇总ID ON ${TABLE_DETAIL}(汇总ID)
      `)
    } else {
      console.log(`表已存在，跳过创建：${TABLE_DETAIL}`)
    }

    console.log('\n✅ 工资表结构检查完成')
  } finally {
    if (pool) {
      await pool.close()
      console.log('数据库连接已关闭')
    }
  }
}

if (require.main === module) {
  ensureSalaryTables()
    .then(() => {
      console.log('脚本执行结束')
      process.exit(0)
    })
    .catch((err) => {
      console.error('脚本执行失败:', err)
      process.exit(1)
    })
}

module.exports = { ensureSalaryTables }
