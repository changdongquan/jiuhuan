const express = require('express')
const cors = require('cors')
const { initDatabase } = require('./database')
const goodsRoutes = require('./routes/goods')
const customerRoutes = require('./routes/customer')
const supplierRoutes = require('./routes/supplier')
const employeeRoutes = require('./routes/employee')
const databaseRoutes = require('./routes/database')
const projectRoutes = require('./routes/project')
const salesOrdersRoutes = require('./routes/sales-orders')

const app = express()
const PORT = process.env.PORT || 3001

// 中间件
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// 路由
app.use('/api/goods', goodsRoutes)
app.use('/api/customer', customerRoutes)
app.use('/api/supplier', supplierRoutes)
app.use('/api/employee', employeeRoutes)
app.use('/api/database', databaseRoutes)
app.use('/api/project', projectRoutes)
app.use('/api/sales-orders', salesOrdersRoutes)

// 健康检查
app.get('/health', (req, res) => {
  res.json({ 
    code: 0,
    success: true, 
    message: '服务运行正常',
    timestamp: new Date().toISOString()
  })
})

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('服务器错误:', err)
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    error: err.message
  })
})

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: '接口不存在'
  })
})

// 启动服务器
const startServer = async () => {
  try {
    // 初始化数据库连接
    await initDatabase()
    
    // 启动HTTP服务器
    app.listen(PORT, () => {
      console.log(`服务器运行在端口 ${PORT}`)
      console.log(`API地址: http://localhost:${PORT}`)
      console.log(`健康检查: http://localhost:${PORT}/health`)
    })
  } catch (error) {
    console.error('服务器启动失败:', error)
    process.exit(1)
  }
}

// 优雅关闭
process.on('SIGINT', async () => {
  console.log('正在关闭服务器...')
  const { closeDatabase } = require('./database')
  await closeDatabase()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('正在关闭服务器...')
  const { closeDatabase } = require('./database')
  await closeDatabase()
  process.exit(0)
})

startServer()
