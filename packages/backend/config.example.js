// 数据库配置示例
const config = {
  server: process.env.DB_SERVER || 'localhost',
  port: parseInt(process.env.DB_PORT) || 1433,
  user: process.env.DB_USERNAME || 'sa',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'test',
  options: {
    encrypt: false, // 如果使用Azure SQL，设置为true
    trustServerCertificate: true // 本地开发时设置为true
  },
  connectionTimeout: 30000,
  requestTimeout: 30000
}

module.exports = config
