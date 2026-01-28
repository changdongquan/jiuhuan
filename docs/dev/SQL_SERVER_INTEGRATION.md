# SQL Server 数据库集成说明

## 概述
本项目已经集成了SQL Server数据库支持，可以连接您的现有数据库并展示"货物信息"表中的数据。

## 数据库表结构
假设您的SQL Server数据库中有以下表结构：

```sql
CREATE TABLE 货物信息 (
    ID INT IDENTITY(1,1) PRIMARY KEY,
    项目编号 NVARCHAR(50),
    产品图号 NVARCHAR(50),
    产品名称 NVARCHAR(100),
    分类 NVARCHAR(20),
    备注 NVARCHAR(500),
    客户名称 NVARCHAR(100),
    客户模号 NVARCHAR(50)
)
```

## 后端服务配置

### 1. 安装后端依赖
```bash
cd packages/backend
npm install
```

### 2. 配置数据库连接
复制 `config.example.js` 为 `config.js`，并修改数据库连接信息：

```javascript
const config = {
  server: 'your_server_ip',        // 您的SQL Server IP地址
  port: 1433,                      // SQL Server端口
  user: 'your_username',           // 数据库用户名
  password: 'your_password',       // 数据库密码
  database: 'your_database_name',  // 数据库名称
  options: {
    encrypt: false,                // 如果使用Azure SQL，设置为true
    trustServerCertificate: true   // 本地开发时设置为true
  },
  connectionTimeout: 30000,
  requestTimeout: 30000
}
```

### 3. 启动后端服务
```bash
npm start
```

服务将在端口3001上运行，API地址为：`http://localhost:3001`

## 前端配置

### 1. 修改API基础路径
在项目根目录的 `.env` 文件中添加：
```
VITE_API_BASE_PATH=http://localhost:3001
VITE_USE_MOCK=false
```

### 2. 启动前端服务
```bash
npm run dev
```

## API接口说明

### 货物信息相关接口

#### 获取货物信息列表
- **URL**: `GET /api/goods/list`
- **参数**:
  - `keyword`: 模糊查询关键词（项目编号/产品名称/产品图号）
  - `customerName`: 客户名称
  - `category`: 分类
  - `page`: 页码（默认1）
  - `pageSize`: 每页大小（默认10）

#### 获取单个货物信息
- **URL**: `GET /api/goods/:id`

#### 新增货物信息
- **URL**: `POST /api/goods`
- **Body**: 
```json
{
  "projectCode": "项目编号",
  "productDrawing": "产品图号",
  "productName": "产品名称",
  "category": "分类",
  "remarks": "备注",
  "customerName": "客户名称",
  "customerModelNo": "客户模号"
}
```

#### 更新货物信息
- **URL**: `PUT /api/goods/:id`
- **Body**: 同新增接口

#### 删除货物信息
- **URL**: `DELETE /api/goods/:id`

#### 批量删除货物信息
- **URL**: `DELETE /api/goods/batch`
- **Body**: 
```json
{
  "ids": [1, 2, 3]
}
```

## 功能特性

### 1. 项目编号自动生成
- 支持三种分类：JH01（塑胶模具）、JH03（零件加工）、JH05（修改模具）
- 自动生成格式：`JH01-25-001` 或 `JH03-25-001/01`（零件加工带零件号）
- 年份默认为当前年份的后两位

### 2. 智能聚焦
- 选择类别后自动聚焦到序号输入框
- 输入序号后根据类别自动聚焦到相应输入框
- 零件加工类别会聚焦到零件号输入框，其他类别聚焦到产品名称

### 3. 数据查询
- 支持模糊查询：项目编号、产品名称、产品图号
- 支持按客户名称查询
- 支持分页显示

### 4. 数据管理
- 新增、编辑、删除货物信息
- 实时数据同步
- 表单验证

## 测试步骤

### 1. 测试数据库连接
访问：`http://localhost:3001/health`
应该返回：
```json
{
  "success": true,
  "message": "服务运行正常",
  "timestamp": "2025-01-27T..."
}
```

### 2. 测试API接口
访问：`http://localhost:3001/api/goods/list`
应该返回货物信息列表

### 3. 测试前端页面
访问前端页面，检查：
- 数据是否正确加载
- 查询功能是否正常
- 新增/编辑/删除功能是否正常

## 故障排除

### 1. 数据库连接失败
- 检查SQL Server服务是否运行
- 检查网络连接
- 检查用户名密码是否正确
- 检查数据库名称是否正确

### 2. API接口错误
- 检查后端服务是否启动
- 检查端口是否被占用
- 查看后端控制台错误信息

### 3. 前端页面错误
- 检查前端是否连接到正确的API地址
- 检查浏览器控制台错误信息
- 确保后端服务正常运行

## 注意事项

1. 确保SQL Server服务正在运行
2. 确保数据库用户有相应的权限
3. 如果使用SSL连接，请修改config.js中的encrypt选项
4. 生产环境请使用环境变量管理敏感信息
5. 建议在生产环境中使用连接池来管理数据库连接

## 扩展功能

如果需要扩展功能，可以：
1. 添加更多字段到数据库表
2. 修改API接口以支持新字段
3. 更新前端表单和表格显示
4. 添加数据验证和业务逻辑
