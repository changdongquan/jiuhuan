const sql = require('mssql')
const config = require('./config')

const TABLE_SUMMARY = '考勤汇总'
const TABLE_DETAIL = '考勤明细'
const TABLE_LOCK = '工资_考勤锁定'

async function ensureTables() {
  let pool = null
  try {
    console.log('正在连接数据库...')
    pool = await sql.connect(config)
    console.log('✅ 数据库连接成功\n')

    const summaryExists = await pool
      .request()
      .input('table', sql.NVarChar, TABLE_SUMMARY)
      .query(
        `
        SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = @table
      `
      )

    if (summaryExists.recordset.length === 0) {
      console.log(`创建表：${TABLE_SUMMARY}`)
      await pool.request().query(`
        CREATE TABLE ${TABLE_SUMMARY} (
          ID INT IDENTITY(1,1) PRIMARY KEY,
          月份 NVARCHAR(7) NOT NULL UNIQUE,
          人数 INT NOT NULL DEFAULT 0,
          加班小计_普通 DECIMAL(10,2) NULL,
          加班小计_两倍 DECIMAL(10,2) NULL,
          加班小计_三倍 DECIMAL(10,2) NULL,
          加班小计合计 DECIMAL(10,2) NULL,
          全勤人数 INT NULL,
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
      .query(
        `
        SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = @table
      `
      )

    if (detailExists.recordset.length === 0) {
      console.log(`创建表：${TABLE_DETAIL}`)
      await pool.request().query(`
        CREATE TABLE ${TABLE_DETAIL} (
          ID INT IDENTITY(1,1) PRIMARY KEY,
          汇总ID INT NOT NULL,
          员工ID INT NULL,
          姓名 NVARCHAR(50) NOT NULL,
          工号 NVARCHAR(50) NOT NULL,
          性别 NVARCHAR(10) NULL,
          部门 NVARCHAR(100) NULL,
          职级 NVARCHAR(50) NULL,
          入职时间 DATE NULL,
          加班小时 DECIMAL(10,1) NULL,
          两倍加班小时 DECIMAL(10,1) NULL,
          三倍加班小时 DECIMAL(10,1) NULL,
          夜班天数 INT NULL,
          加班小计 DECIMAL(10,2) NULL,
          工龄数 DECIMAL(4,1) NULL,
          全勤费 DECIMAL(10,2) NULL,
          误餐次数 INT NULL,
          补助小计 DECIMAL(10,2) NULL,
          迟到次数 INT NULL,
          新进及事假小时 DECIMAL(10,1) NULL,
          病假小时 DECIMAL(10,1) NULL,
          旷工小时 DECIMAL(10,1) NULL,
          卫生费 DECIMAL(10,2) NULL,
          水费 DECIMAL(10,2) NULL,
          电费 DECIMAL(10,2) NULL,
          扣款小计 DECIMAL(10,2) NULL,
          创建时间 DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
          更新时间 DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
          CONSTRAINT FK_考勤明细_汇总 FOREIGN KEY (汇总ID) REFERENCES ${TABLE_SUMMARY}(ID) ON DELETE CASCADE
        )
      `)

      console.log('创建索引：idx_考勤明细_汇总ID')
      await pool.request().query(`
        CREATE INDEX idx_考勤明细_汇总ID ON ${TABLE_DETAIL}(汇总ID)
      `)
    } else {
      console.log(`表已存在，跳过创建：${TABLE_DETAIL}`)
    }

    const lockExists = await pool
      .request()
      .input('table', sql.NVarChar, TABLE_LOCK)
      .query(`SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = @table`)

    if (lockExists.recordset.length === 0) {
      console.log(`创建表：${TABLE_LOCK}`)
      await pool.request().query(`
        CREATE TABLE ${TABLE_LOCK} (
          ID INT IDENTITY(1,1) PRIMARY KEY,
          月份 NVARCHAR(7) NOT NULL UNIQUE,
          工资汇总ID INT NOT NULL,
          是否锁定 BIT NOT NULL DEFAULT 1,
          锁定时间 DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
          解锁时间 DATETIME2 NULL,
          解锁原因 NVARCHAR(200) NULL
        )
      `)
      console.log('创建索引：idx_工资_考勤锁定_月份')
      await pool.request().query(`
        CREATE INDEX idx_工资_考勤锁定_月份 ON ${TABLE_LOCK}(月份)
      `)
    } else {
      console.log(`表已存在，跳过创建：${TABLE_LOCK}`)
    }

    console.log('\n✅ 表结构检查完成')
  } finally {
    if (pool) {
      await pool.close()
      console.log('数据库连接已关闭')
    }
  }
}

if (require.main === module) {
  ensureTables()
    .then(() => {
      console.log('脚本执行结束')
      process.exit(0)
    })
    .catch((err) => {
      console.error('脚本执行失败:', err)
      process.exit(1)
    })
}

module.exports = { ensureTables }
