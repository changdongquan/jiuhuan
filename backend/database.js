const sql = require('mssql')
const config = require('./config')

// 数据库连接池
let pool = null

// 初始化数据库连接
const initDatabase = async () => {
  try {
    pool = await sql.connect(config)
    console.log('数据库连接成功')
    return pool
  } catch (err) {
    console.error('数据库连接失败:', err)
    throw err
  }
}

// 获取数据库连接
const getPool = async () => {
  if (!pool || pool.connected === false) {
    console.log('数据库连接已断开，正在重新连接...')
    try {
      await initDatabase()
    } catch (err) {
      console.error('重新连接数据库失败:', err)
      throw err
    }
  }
  return pool
}

// 执行查询
const query = async (queryString, params = {}) => {
  try {
    const pool = await getPool()
    const request = pool.request()
    
    // 绑定参数
    Object.keys(params).forEach(key => {
      request.input(key, params[key])
    })
    
    const result = await request.query(queryString)
    return result.recordset
  } catch (err) {
    console.error('查询执行失败:', err)
    throw err
  }
}

// 关闭数据库连接
const closeDatabase = async () => {
  if (pool) {
    await pool.close()
    pool = null
    console.log('数据库连接已关闭')
  }
}

module.exports = {
  initDatabase,
  getPool,
  query,
  closeDatabase
}
