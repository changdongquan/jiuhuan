// 加载环境变量（如果使用 .env 文件）
try {
  require('dotenv').config()
} catch (e) {
  // dotenv 未安装或 .env 文件不存在，使用系统环境变量
}

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
const quotationRoutes = require('./routes/quotation')
const productionTaskRoutes = require('./routes/production-task')
const authRoutes = require('./routes/auth')
const analysisRoutes = require('./routes/analysis')
const permissionRoutes = require('./routes/permission')
const userRoutes = require('./routes/user')
const attendanceRoutes = require('./routes/attendance')

const app = express()
const PORT = process.env.PORT || 3001

// CORS 设置：允许域内站点和浏览器携带 Kerberos 凭据
const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV

const allowOriginList = [
  /\.jiuhuan\.local$/i,
  /^https?:\/\/10\.0\.0\.248(:[0-9]+)?$/i,
  /^https?:\/\/craftsys\.jiuhuan\.local$/i,
  /^https?:\/\/jiuhuan.net(:[0-9]+)?$/i,
  // 本地 / 内网调试前端（如 http://10.0.0.67:4000）
  /^https?:\/\/10\.0\.0\.67(:[0-9]+)?$/i
]

// 开发环境：允许 localhost 和 127.0.0.1
if (isDev) {
  allowOriginList.push(/^https?:\/\/localhost(:\d+)?$/i)
  allowOriginList.push(/^https?:\/\/127\.0\.0\.1(:\d+)?$/i)
  console.log('开发环境：已添加 localhost 和 127.0.0.1 到 CORS 白名单')
}

const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      // 同源请求（如服务器内部调用）没有 Origin，直接放行
      return callback(null, true)
    }

    const matched = allowOriginList.some((rule) =>
      rule instanceof RegExp ? rule.test(origin) : rule === origin
    )

    if (matched) {
      return callback(null, true)
    }

    return callback(new Error(`Origin ${origin} not allowed by CORS policy`))
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}

app.use(cors(corsOptions))
app.options('*', cors(corsOptions))

// 中间件
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
app.use('/api/quotation', quotationRoutes)
app.use('/api/production-task', productionTaskRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/analysis', analysisRoutes)
app.use('/api/permission', permissionRoutes)
app.use('/api/user', userRoutes)
app.use('/api/attendance', attendanceRoutes)

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
  console.error('错误详情:', {
    message: err.message,
    stack: err.stack,
    name: err.name,
    code: err.code,
    url: req.url,
    method: req.method,
    body: req.body,
    headers: req.headers
  })
  res.status(500).json({
    code: 500,
    success: false,
    message: '服务器内部错误: ' + (err.message || '未知错误'),
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
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
