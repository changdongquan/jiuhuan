// 数据库配置示例
const config = {
  server: process.env.DB_SERVER || 'jiuhuan.net',
  port: parseInt(process.env.DB_PORT) || 3001,
  user: process.env.DB_USERNAME || 'sa',
  password: process.env.DB_PASSWORD || 'Chang902',
  database: process.env.DB_DATABASE || 'jiuhuanDB',
  options: {
    encrypt: false, // 如果使用Azure SQL，设置为true
    trustServerCertificate: true, // 本地开发时设置为true
    enableArithAbort: true,
    connectionRetryInterval: 5000,
    maxRetriesOnFailure: 3
  },
  connectionTimeout: 60000, // 增加到60秒
  requestTimeout: 60000, // 增加到60秒
  pool: {
    max: 10, // 最大连接数
    min: 0, // 最小连接数
    idleTimeoutMillis: 30000, // 空闲连接超时时间
    acquireTimeoutMillis: 60000 // 获取连接超时时间
  }
}

module.exports = config
