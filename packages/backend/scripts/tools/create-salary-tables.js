const sql = require('mssql')
const config = require('../../config')

const TABLE_SUMMARY = '工资汇总'
const TABLE_DETAIL = '工资明细'

async function ensureSalaryTables() {
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
        return false
      }
      console.log(`创建表：${tableName}`)
      await pool.request().query(createSql)
      return true
    }

    const ensureColumn = async (tableName, columnName, columnSql) => {
      await pool.request().query(`
        IF COL_LENGTH(N'${tableName}', N'${columnName}') IS NULL
        BEGIN
          ALTER TABLE ${tableName} ADD ${columnSql};
        END
      `)
    }

    const renameColumn = async (tableName, oldName, newName) => {
      await pool.request().query(`
        IF COL_LENGTH(N'${tableName}', N'${oldName}') IS NOT NULL
           AND COL_LENGTH(N'${tableName}', N'${newName}') IS NULL
        BEGIN
          EXEC sp_rename N'${tableName}.${oldName}', N'${newName}', 'COLUMN';
        END
      `)
    }

    const ensureIndex = async (tableName, indexName, indexSql) => {
      await pool.request().query(`
        IF NOT EXISTS (
          SELECT 1 FROM sys.indexes
          WHERE name = N'${indexName}' AND object_id = OBJECT_ID(N'${tableName}')
        )
        BEGIN
          ${indexSql}
        END
      `)
    }

    await ensureTable(
      TABLE_SUMMARY,
      `
      CREATE TABLE ${TABLE_SUMMARY} (
        ID INT IDENTITY(1,1) PRIMARY KEY,
        月份 NVARCHAR(7) NOT NULL UNIQUE,
        步骤 INT NOT NULL DEFAULT 1,
        状态 NVARCHAR(20) NOT NULL DEFAULT N'草稿',
        人数 INT NOT NULL DEFAULT 0,
        加班费合计 DECIMAL(12,2) NULL,
        两倍加班费合计 DECIMAL(12,2) NULL,
        三倍加班费合计 DECIMAL(12,2) NULL,
        本期工资合计 DECIMAL(12,2) NULL,
        第一批实发合计 DECIMAL(12,2) NULL,
        第二批实发合计 DECIMAL(12,2) NULL,
        两次实发合计 DECIMAL(12,2) NULL,
        备注 NVARCHAR(500) NULL,
        创建时间 DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        更新时间 DATETIME2 NOT NULL DEFAULT SYSDATETIME()
      )
    `
    )

    // 兼容历史库：补齐汇总新增字段
    await ensureColumn(TABLE_SUMMARY, '人数', '人数 INT NOT NULL DEFAULT 0')
    await ensureColumn(TABLE_SUMMARY, '加班费合计', '加班费合计 DECIMAL(12,2) NULL')
    await ensureColumn(TABLE_SUMMARY, '两倍加班费合计', '两倍加班费合计 DECIMAL(12,2) NULL')
    await ensureColumn(TABLE_SUMMARY, '三倍加班费合计', '三倍加班费合计 DECIMAL(12,2) NULL')
    await ensureColumn(TABLE_SUMMARY, '本期工资合计', '本期工资合计 DECIMAL(12,2) NULL')
    await renameColumn(TABLE_SUMMARY, '第一次应发合计', '第一次实发合计')
    await renameColumn(TABLE_SUMMARY, '第二次应发合计', '第二次实发合计')
    await renameColumn(TABLE_SUMMARY, '两次应发合计', '两次实发合计')
    await renameColumn(TABLE_SUMMARY, '第一次实发合计', '第一批实发合计')
    await renameColumn(TABLE_SUMMARY, '第二次实发合计', '第二批实发合计')
    await ensureColumn(TABLE_SUMMARY, '第一批实发合计', '第一批实发合计 DECIMAL(12,2) NULL')
    await ensureColumn(TABLE_SUMMARY, '第二批实发合计', '第二批实发合计 DECIMAL(12,2) NULL')
    await ensureColumn(TABLE_SUMMARY, '两次实发合计', '两次实发合计 DECIMAL(12,2) NULL')
    await ensureColumn(TABLE_SUMMARY, '备注', '备注 NVARCHAR(500) NULL')

    await ensureTable(
      TABLE_DETAIL,
      `
      CREATE TABLE ${TABLE_DETAIL} (
        ID INT IDENTITY(1,1) PRIMARY KEY,
        汇总ID INT NOT NULL,
        员工ID INT NULL,
        姓名 NVARCHAR(50) NOT NULL,
        工号 NVARCHAR(50) NOT NULL,
        身份证号 NVARCHAR(30) NULL,
        入职日期 DATE NULL,
        职级 INT NULL,

        基本工资 DECIMAL(12,2) NULL,
        加班费 DECIMAL(12,2) NULL,
        两倍加班费 DECIMAL(12,2) NULL,
        三倍加班费 DECIMAL(12,2) NULL,
        夜班补助 DECIMAL(12,2) NULL,
        误餐补助 DECIMAL(12,2) NULL,
        全勤 DECIMAL(12,2) NULL,
        工龄工资 DECIMAL(12,2) NULL,

        迟到扣款 DECIMAL(12,2) NULL,
        新进及事假 DECIMAL(12,2) NULL,
        病假 DECIMAL(12,2) NULL,
        旷工扣款 DECIMAL(12,2) NULL,
        卫生费 DECIMAL(12,2) NULL,
        水费 DECIMAL(12,2) NULL,
        电费 DECIMAL(12,2) NULL,

        基本养老保险费 DECIMAL(12,2) NULL,
        基本医疗保险费 DECIMAL(12,2) NULL,
        失业保险费 DECIMAL(12,2) NULL,

        第一批工资 DECIMAL(12,2) NULL,
        第二批工资 DECIMAL(12,2) NULL,
        第一批实发 DECIMAL(12,2) NULL,
        个税 DECIMAL(12,2) NULL,
        第二批实发 DECIMAL(12,2) NULL,
        两次实发合计 DECIMAL(12,2) NULL,
        本期工资 DECIMAL(12,2) NULL,

        绩效奖金 DECIMAL(12,2) NULL,
        扣款 DECIMAL(12,2) NULL,
        合计 DECIMAL(12,2) NULL,
        备注 NVARCHAR(500) NULL,

        创建时间 DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        更新时间 DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT FK_工资明细_汇总 FOREIGN KEY (汇总ID) REFERENCES ${TABLE_SUMMARY}(ID) ON DELETE CASCADE
      )
    `
    )

    // 兼容历史库：补齐明细新增字段
    await ensureColumn(TABLE_DETAIL, '身份证号', '身份证号 NVARCHAR(30) NULL')
    await ensureColumn(TABLE_DETAIL, '入职日期', '入职日期 DATE NULL')
    await ensureColumn(TABLE_DETAIL, '职级', '职级 INT NULL')
    await ensureColumn(TABLE_DETAIL, '加班费', '加班费 DECIMAL(12,2) NULL')
    await ensureColumn(TABLE_DETAIL, '两倍加班费', '两倍加班费 DECIMAL(12,2) NULL')
    await ensureColumn(TABLE_DETAIL, '三倍加班费', '三倍加班费 DECIMAL(12,2) NULL')
    await ensureColumn(TABLE_DETAIL, '夜班补助', '夜班补助 DECIMAL(12,2) NULL')
    await ensureColumn(TABLE_DETAIL, '误餐补助', '误餐补助 DECIMAL(12,2) NULL')
    await ensureColumn(TABLE_DETAIL, '全勤', '全勤 DECIMAL(12,2) NULL')
    await ensureColumn(TABLE_DETAIL, '工龄工资', '工龄工资 DECIMAL(12,2) NULL')
    await ensureColumn(TABLE_DETAIL, '迟到扣款', '迟到扣款 DECIMAL(12,2) NULL')
    await ensureColumn(TABLE_DETAIL, '新进及事假', '新进及事假 DECIMAL(12,2) NULL')
    await ensureColumn(TABLE_DETAIL, '病假', '病假 DECIMAL(12,2) NULL')
    await ensureColumn(TABLE_DETAIL, '旷工扣款', '旷工扣款 DECIMAL(12,2) NULL')
    await ensureColumn(TABLE_DETAIL, '卫生费', '卫生费 DECIMAL(12,2) NULL')
    await ensureColumn(TABLE_DETAIL, '水费', '水费 DECIMAL(12,2) NULL')
    await ensureColumn(TABLE_DETAIL, '电费', '电费 DECIMAL(12,2) NULL')
    await ensureColumn(TABLE_DETAIL, '基本养老保险费', '基本养老保险费 DECIMAL(12,2) NULL')
    await ensureColumn(TABLE_DETAIL, '基本医疗保险费', '基本医疗保险费 DECIMAL(12,2) NULL')
    await ensureColumn(TABLE_DETAIL, '失业保险费', '失业保险费 DECIMAL(12,2) NULL')
    await ensureColumn(TABLE_DETAIL, '第一批工资', '第一批工资 DECIMAL(12,2) NULL')
    await ensureColumn(TABLE_DETAIL, '第二批工资', '第二批工资 DECIMAL(12,2) NULL')
    await renameColumn(TABLE_DETAIL, '第一次应发', '第一次实发')
    await ensureColumn(TABLE_DETAIL, '个税', '个税 DECIMAL(12,2) NULL')
    await renameColumn(TABLE_DETAIL, '第二次应发', '第二次实发')
    await renameColumn(TABLE_DETAIL, '两次应发合计', '两次实发合计')
    await renameColumn(TABLE_DETAIL, '第一次实发', '第一批实发')
    await renameColumn(TABLE_DETAIL, '第二次实发', '第二批实发')
    await ensureColumn(TABLE_DETAIL, '第一批实发', '第一批实发 DECIMAL(12,2) NULL')
    await ensureColumn(TABLE_DETAIL, '第二批实发', '第二批实发 DECIMAL(12,2) NULL')
    await ensureColumn(TABLE_DETAIL, '两次实发合计', '两次实发合计 DECIMAL(12,2) NULL')
    await ensureColumn(TABLE_DETAIL, '本期工资', '本期工资 DECIMAL(12,2) NULL')

    await ensureIndex(
      TABLE_DETAIL,
      'idx_工资明细_汇总ID',
      `CREATE INDEX idx_工资明细_汇总ID ON ${TABLE_DETAIL}(汇总ID)`
    )
    await ensureIndex(
      TABLE_DETAIL,
      'idx_工资明细_汇总ID_工号',
      `CREATE INDEX idx_工资明细_汇总ID_工号 ON ${TABLE_DETAIL}(汇总ID, 工号)`
    )

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
