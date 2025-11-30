const sql = require('mssql')
const config = require('./config')

/**
 * 创建“销售订单附件”表：
 * - 按销售订单明细（订单ID）存多附件
 * - 文件实际存 NAS，通过相对路径+存储文件名定位
 */
async function createSalesOrderAttachmentsTable() {
  let pool = null

  try {
    console.log('正在连接数据库...')
    pool = await sql.connect(config)
    console.log('✅ 数据库连接成功\n')

    console.log('检查表【销售订单附件】是否已存在...')
    const checkTableResult = await pool.request().query(`
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME = N'销售订单附件'
    `)

    if (checkTableResult.recordset.length > 0) {
      console.log('⚠️  表【销售订单附件】已存在，跳过创建')
      return
    }

    console.log('表不存在，开始创建表【销售订单附件】...\n')

    const createTableSql = `
      CREATE TABLE dbo.销售订单附件 (
        附件ID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        订单ID INT NOT NULL,
        订单编号 NVARCHAR(50) NOT NULL,
        项目编号 NVARCHAR(50) NULL,
        原始文件名 NVARCHAR(255) NOT NULL,
        存储文件名 NVARCHAR(255) NOT NULL,
        相对路径 NVARCHAR(255) NOT NULL,
        文件大小 BIGINT NOT NULL,
        内容类型 NVARCHAR(100) NULL,
        上传时间 DATETIME2 NOT NULL CONSTRAINT DF_销售订单附件_上传时间 DEFAULT (GETDATE()),
        上传人 NVARCHAR(100) NULL
      );

      -- 按明细ID和订单编号建立索引，加快查询
      CREATE INDEX IX_销售订单附件_订单ID ON dbo.销售订单附件 (订单ID);
      CREATE INDEX IX_销售订单附件_订单编号 ON dbo.销售订单附件 (订单编号);

      -- 维护与销售订单明细的关系，删除订单时自动删除附件
      ALTER TABLE dbo.销售订单附件
      ADD CONSTRAINT FK_销售订单附件_销售订单
      FOREIGN KEY (订单ID) REFERENCES dbo.销售订单 (订单ID)
      ON DELETE CASCADE;
    `

    await pool.request().batch(createTableSql)
    console.log('✅ 表【销售订单附件】创建完成\n')

    console.log('验证表结构...')
    const columns = await pool.request().query(`
      SELECT 
        ORDINAL_POSITION as position,
        COLUMN_NAME as columnName,
        DATA_TYPE as dataType,
        CHARACTER_MAXIMUM_LENGTH as maxLength,
        IS_NULLABLE as isNullable
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = N'销售订单附件'
      ORDER BY ORDINAL_POSITION
    `)

    console.table(columns.recordset)
    console.log('\n✅ 数据库操作完成')
  } catch (err) {
    console.error('❌ 创建【销售订单附件】表失败:', err)
    throw err
  } finally {
    if (pool) {
      await pool.close()
      console.log('数据库连接已关闭')
    }
  }
}

// 直接运行脚本时执行
if (require.main === module) {
  console.log('⚠️ 即将创建表【销售订单附件】...')
  console.log('按 Ctrl+C 取消，或等待3 秒后继续。\n')

  setTimeout(() => {
    createSalesOrderAttachmentsTable()
      .then(() => {
        console.log('\n✅ 脚本执行完成')
        process.exit(0)
      })
      .catch((err) => {
        console.error('\n❌ 脚本执行失败:', err)
        process.exit(1)
      })
  }, 3000)
}

module.exports = { createSalesOrderAttachmentsTable }
