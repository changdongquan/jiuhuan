# 九环后端API服务

## 项目结构
```
backend/
├── package.json          # 项目配置和依赖
├── server.js            # 主服务器文件
├── config.js            # 数据库配置
├── database.js          # 数据库连接管理
├── routes/
│   └── goods.js         # 货物信息API路由
└── README.md           # 说明文档
```

## 安装依赖
```bash
cd backend
npm install
```

## 配置数据库
1. 复制 `.env.example` 为 `.env`
2. 修改 `.env` 文件中的数据库连接信息：
```
DB_SERVER=your_server_ip
DB_PORT=1433
DB_USERNAME=your_username
DB_PASSWORD=your_password
DB_DATABASE=your_database_name
```

## 运行服务
```bash
# 开发模式（自动重启）
npm run dev

# 生产模式
npm start
```

## API接口

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

## 注意事项
1. 确保SQL Server服务正在运行
2. 确保数据库用户有相应的权限
3. 如果使用SSL连接，请修改config.js中的encrypt选项
4. 生产环境请使用环境变量管理敏感信息
