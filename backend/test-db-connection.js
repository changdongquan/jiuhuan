const sql = require('mssql')
const config = require('./config')

async function testDatabaseConnection() {
  let pool = null
  
  try {
    console.log('正在连接数据库...')
    console.log('数据库配置:', {
      server: config.server,
      port: config.port,
      database: config.database,
      user: config.user
    })
    
    pool = await sql.connect(config)
    console.log('✅ 数据库连接成功')
    
    // 测试简单查询
    console.log('测试数据库查询...')
    const result = await pool.request().query('SELECT @@VERSION as version')
    console.log('数据库版本:', result.recordset[0].version)
    
    // 检查当前数据库
    const dbResult = await pool.request().query('SELECT DB_NAME() as current_database')
    console.log('当前数据库:', dbResult.recordset[0].current_database)
    
    // 检查用户权限
    const userResult = await pool.request().query('SELECT USER_NAME() as current_user')
    console.log('当前用户:', userResult.recordset[0].current_user)
    
    // 尝试创建简单表
    console.log('尝试创建测试表...')
    try {
      await pool.request().query(`
        IF OBJECT_ID('test_table', 'U') IS NOT NULL
          DROP TABLE test_table
      `)
      
      await pool.request().query(`
        CREATE TABLE test_table (
          id INT IDENTITY(1,1) PRIMARY KEY,
          name VARCHAR(50)
        )
      `)
      
      console.log('✅ 测试表创建成功')
      
      // 删除测试表
      await pool.request().query('DROP TABLE test_table')
      console.log('✅ 测试表删除成功')
      
    } catch (err) {
      console.error('❌ 创建测试表失败:', err.message)
    }
    
  } catch (err) {
    console.error('❌ 数据库连接失败:', err)
  } finally {
    if (pool) {
      await pool.close()
      console.log('数据库连接已关闭')
    }
  }
}

testDatabaseConnection()
