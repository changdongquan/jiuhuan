const sql = require('mssql')
const config = require('../../config')

async function createQuotationTable() {
  let pool = null

  try {
    console.log('正在连接数据库...')
    pool = await sql.connect(config)
    console.log('✅ 数据库连接成功')

    // 检查表是否已存在
    console.log('检查表是否已存在...')
    const checkTable = await pool.request().query(`
      SELECT COUNT(*) as table_count 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME = '报价单'
    `)

    if (checkTable.recordset[0].table_count > 0) {
      console.log('⚠️  表已存在，是否删除重建？')
      // 删除索引（如果存在）
      try {
        await pool.request().query('DROP INDEX IF EXISTS IX_报价单_报价日期 ON 报价单')
        await pool.request().query('DROP INDEX IF EXISTS IX_报价单_客户名称 ON 报价单')
        await pool.request().query('DROP INDEX IF EXISTS IX_报价单_加工周期 ON 报价单')
        await pool.request().query('DROP INDEX IF EXISTS IX_报价单_加工日期 ON 报价单')
      } catch (err) {
        console.log('⚠️  删除索引时出错（可能不存在）:', err.message)
      }
      await pool.request().query('DROP TABLE 报价单')
      console.log('✅ 旧表已删除')
    }

    // 创建报价单表
    console.log('正在创建报价单表...')
    await pool.request().query(`
      CREATE TABLE 报价单 (
        报价单ID INT IDENTITY(1,1) PRIMARY KEY,
        报价单号 NVARCHAR(50) NOT NULL UNIQUE,
        报价日期 DATE NOT NULL,
        客户名称 NVARCHAR(200) NOT NULL,
        加工日期 DATE NOT NULL,
        更改通知单号 NVARCHAR(50) NULL,
        加工零件名称 NVARCHAR(200) NOT NULL,
        模具编号 NVARCHAR(100) NOT NULL,
        申请更改部门 NVARCHAR(100) NOT NULL,
        申请更改人 NVARCHAR(50) NOT NULL,
        材料明细 NVARCHAR(MAX) NOT NULL DEFAULT '[]',
        加工费用明细 NVARCHAR(MAX) NOT NULL DEFAULT '[]',
        其他费用 DECIMAL(18,2) NOT NULL DEFAULT 0,
        运输费用 DECIMAL(18,2) NOT NULL DEFAULT 0,
        加工数量 INT NOT NULL DEFAULT 1,
        含税价格 DECIMAL(18,2) NOT NULL DEFAULT 0,
        创建时间 DATETIME NOT NULL DEFAULT GETDATE(),
        更新时间 DATETIME NOT NULL DEFAULT GETDATE()
      )
    `)
    console.log('✅ 报价单表创建成功')

    // 创建索引
    console.log('正在创建索引...')
    const indexes = [
      'CREATE INDEX IX_报价单_报价日期 ON 报价单(报价日期)',
      'CREATE INDEX IX_报价单_客户名称 ON 报价单(客户名称)',
      'CREATE INDEX IX_报价单_加工日期 ON 报价单(加工日期)'
    ]

    for (const indexSQL of indexes) {
      try {
        await pool.request().query(indexSQL)
        console.log('✅ 索引创建成功:', indexSQL)
      } catch (err) {
        console.log('⚠️  索引可能已存在:', err.message)
      }
    }

    // 验证结果
    console.log('\n验证表创建结果...')
    const tableInfo = await pool.request().query(`
      SELECT 
        COLUMN_NAME as 字段名,
        DATA_TYPE as 数据类型,
        CHARACTER_MAXIMUM_LENGTH as 长度,
        IS_NULLABLE as 是否可空,
        COLUMN_DEFAULT as 默认值
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = '报价单'
      ORDER BY ORDINAL_POSITION
    `)

    console.log('\n📋 表结构信息:')
    console.table(tableInfo.recordset)

    // 验证索引
    const indexInfo = await pool.request().query(`
      SELECT 
        i.name AS 索引名称,
        i.type_desc AS 索引类型,
        STRING_AGG(c.name, ', ') WITHIN GROUP (ORDER BY ic.key_ordinal) AS 字段列表
      FROM sys.indexes i
      INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
      INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
      WHERE i.object_id = OBJECT_ID('报价单')
        AND i.name IS NOT NULL
      GROUP BY i.name, i.type_desc
      ORDER BY i.name
    `)

    console.log('\n📊 索引信息:')
    console.table(indexInfo.recordset)

    console.log('\n🎉 报价单表创建完成！')
  } catch (err) {
    console.error('❌ 创建表失败:', err)
    if (err.message) {
      console.error('错误信息:', err.message)
    }
    if (err.stack) {
      console.error('错误堆栈:', err.stack)
    }
  } finally {
    if (pool) {
      await pool.close()
      console.log('\n数据库连接已关闭')
    }
  }
}

// 执行创建表操作
createQuotationTable()
