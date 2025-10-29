const { initDatabase, query, closeDatabase } = require('./database')

async function testSalesOrdersTable() {
  try {
    // 初始化数据库连接
    await initDatabase()
    console.log('数据库连接成功\n')

    // 查找可能的销售订单表名
    console.log('查找所有表...')
    const tables = await query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE'
      AND (TABLE_NAME LIKE '%订单%' OR TABLE_NAME LIKE '%order%' OR TABLE_NAME LIKE '%sales%')
      ORDER BY TABLE_NAME
    `)
    console.log('可能的销售订单表:')
    tables.forEach(table => {
      console.log(`  - ${table.TABLE_NAME}`)
    })

    if (tables.length === 0) {
      console.log('\n未找到名称包含"订单"的表，查看所有表:')
      const allTables = await query(`
        SELECT TABLE_NAME 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_TYPE = 'BASE TABLE'
        ORDER BY TABLE_NAME
      `)
      allTables.forEach(table => {
        console.log(`  - ${table.TABLE_NAME}`)
      })
    }

    // 假设表名为"销售订单"，查看表结构
    console.log('\n尝试查看"销售订单"表结构...')
    try {
      const columns = await query(`
        SELECT 
          COLUMN_NAME as columnName,
          DATA_TYPE as dataType,
          CHARACTER_MAXIMUM_LENGTH as maxLength,
          IS_NULLABLE as nullable,
          COLUMN_DEFAULT as defaultValue
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = '销售订单'
        ORDER BY ORDINAL_POSITION
      `)
      
      if (columns.length > 0) {
        console.log('\n销售订单表结构:')
        console.table(columns)
        
        // 查看数据样例
        console.log('\n查看前5条数据:')
        const sampleData = await query(`
          SELECT TOP 5 * FROM 销售订单
        `)
        console.table(sampleData)
      } else {
        console.log('未找到"销售订单"表')
      }
    } catch (err) {
      console.log(`查看"销售订单"表失败: ${err.message}`)
    }

  } catch (error) {
    console.error('执行失败:', error)
  } finally {
    await closeDatabase()
  }
}

testSalesOrdersTable()

