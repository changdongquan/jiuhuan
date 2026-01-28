# Ubuntu 部署环境配置清单

## 概述

本文档列出了在 Ubuntu 服务器上部署时，针对新增的 Windows 域用户登录功能需要进行的配置。

## ✅ 必须配置项

### 1. 设置生产环境标识

**重要**：必须设置 `NODE_ENV=production`，否则系统会使用 mock 验证（仅开发环境有效）。

```bash
# 方法1：在启动脚本中设置
export NODE_ENV=production
npm start

# 方法2：在 package.json 中修改启动脚本
"start": "NODE_ENV=production node server.js"

# 方法3：使用 PM2 等进程管理器
pm2 start server.js --env production
```

### 2. 安装依赖

确保 `ldapjs` 已安装（用于域用户 LDAP 验证）：

```bash
cd packages/backend
npm install
# 或单独安装
npm install ldapjs --save
```

### 3. 配置 LDAP 环境变量（仅域用户手动登录需要）

如果启用域用户手动登录功能，需要配置 LDAP 连接信息。

**创建 `.env` 文件**（或直接在系统环境变量中设置）：

```bash
cd packages/backend
cat > .env << EOF
# LDAP 配置（用于域用户验证）
LDAP_URL=ldap://your-ad-server.com:389
LDAP_BASE_DN=DC=yourdomain,DC=com

# 可选：服务账号（如果需要先绑定服务账号再查询用户）
LDAP_BIND_DN=CN=service-account,CN=Users,DC=yourdomain,DC=com
LDAP_BIND_PASSWORD=your-service-account-password

# Node.js 环境（重要！）
NODE_ENV=production
EOF
```

**注意**：

- `LDAP_URL`: 替换为实际的 Active Directory 服务器地址
- `LDAP_BASE_DN`: 替换为实际的域基础 DN（例如：`DC=company,DC=local`）
- `LDAP_BIND_DN` 和 `LDAP_BIND_PASSWORD` 是可选的，如果 AD 允许匿名绑定则不需要

### 4. 修改后端代码加载环境变量（如果使用 .env 文件）

在 `packages/backend/server.js` 开头添加：

```javascript
require('dotenv').config()
```

## ✅ 可选配置项

### 1. 自动登录（SSO）配置

如果需要实现域用户自动登录（无需输入密码），需要配置 Apache + mod_auth_gssapi。

**详细步骤**：请参考 `packages/backend/WINDOWS_DOMAIN_AUTH.md` 文档。

**简要步骤**：

1. 安装 Apache 和 Kerberos 模块
2. 配置 Kerberos（`/etc/krb5.conf`）
3. 配置 Apache（`/etc/apache2/sites-available/your-site.conf`）
4. 启用相关模块并重启 Apache

### 2. 普通账号数据库配置

当前普通账号（如 `admin`）使用硬编码验证。如果希望从数据库验证：

1. 创建用户表（如果不存在）
2. 修改 `packages/backend/routes/auth.js` 中的 `verifyLocalUser` 函数，从数据库查询用户

## 🔍 验证清单

部署后，请验证以下功能：

### 1. 检查环境变量

```bash
# 检查 NODE_ENV
echo $NODE_ENV
# 应该输出：production

# 检查 LDAP 配置（如果配置了）
echo $LDAP_URL
echo $LDAP_BASE_DN
```

### 2. 检查依赖

```bash
cd packages/backend
npm list ldapjs
# 应该显示 ldapjs 已安装
```

### 3. 测试接口

```bash
# 测试普通账号登录
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}'

# 测试域用户登录（需要配置 LDAP）
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"domain\\testuser","password":"password123"}'
```

### 4. 检查后端日志

启动后端服务后，查看日志输出：

- ✅ 如果看到 `[登录请求] 收到登录请求...`，说明接口正常
- ⚠️ 如果看到 `警告: ldapjs 未安装...`，说明需要安装 `ldapjs`
- ⚠️ 如果域用户登录失败，检查 LDAP 配置是否正确

## 📝 注意事项

1. **开发环境 vs 生产环境**：
   - 开发环境（`NODE_ENV=development` 或未设置）：使用 mock 验证
   - 生产环境（`NODE_ENV=production`）：使用真实 LDAP 验证

2. **自动登录 vs 手动登录**：
   - **自动登录**：需要配置 Apache + Kerberos（见 `WINDOWS_DOMAIN_AUTH.md`）
   - **手动登录**：只需要配置 LDAP 环境变量即可

3. **普通账号验证**：
   - 当前实现：硬编码 `admin/admin` 和 `test/test`
   - 建议：改为从数据库验证

4. **前端配置**：
   - 前端代码已强制使用真实后端接口（`/api/auth/login`）
   - 无需额外配置

## 🚀 快速部署步骤

1. **进入后端目录**

   ```bash
   cd packages/backend
   ```

2. **安装依赖**

   ```bash
   npm install
   ```

3. **设置环境变量**

   ```bash
   export NODE_ENV=production
   # 如果使用域用户登录，设置 LDAP 配置
   export LDAP_URL=ldap://your-ad-server.com:389
   export LDAP_BASE_DN=DC=yourdomain,DC=com
   ```

4. **启动服务**

   ```bash
   npm start
   ```

5. **验证功能**
   - 测试普通账号登录
   - 测试域用户登录（如果配置了 LDAP）

## 📚 相关文档

- `packages/backend/WINDOWS_DOMAIN_AUTH.md` - 详细的 Kerberos/SSO 配置指南
- `packages/backend/routes/auth.js` - 认证逻辑实现
- `packages/backend/README.md` - 后端服务说明
