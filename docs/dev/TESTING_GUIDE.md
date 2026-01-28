# Windows 域登录功能测试指南

## 快速测试步骤

### 1. 启动后端服务

```bash
cd backend
npm start
```

后端会在 `http://localhost:3001` 启动。

### 2. 启动前端服务

```bash
npm run dev
```

前端会在 `http://localhost:4000` 启动。

### 3. 测试自动登录（开发环境）

1. 打开浏览器访问 `http://localhost:4000`
2. **应该自动登录**，无需输入密码
3. 检查浏览器控制台，应该看到自动登录成功的日志

**预期结果**：

- 自动跳转到系统首页
- 用户信息显示为：`dev-user` / `开发测试用户`

### 4. 测试普通账号登录

1. 退出登录（点击右上角用户菜单 → 退出）
2. 在登录页面输入：
   - 用户名：`admin`
   - 密码：`admin`
3. 点击登录

**预期结果**：

- 登录成功，进入系统
- 用户信息显示为：`admin`

### 5. 测试域用户手动登录（开发环境模拟）

1. 退出登录
2. 在登录页面输入：
   - 用户名：`domain\testuser` 或 `testuser@domain.com`
   - 密码：`password123`
3. 点击登录

**预期结果**：

- 登录成功，进入系统
- 用户信息显示为：`domain\testuser` 或 `testuser@domain.com`

### 6. 测试登录失败场景

1. 退出登录
2. 输入错误的用户名或密码
3. 点击登录

**预期结果**：

- 显示错误提示："用户名或密码错误"

## API 接口测试

### 测试自动登录接口

```bash
# 开发环境应该返回模拟数据
curl http://localhost:3001/api/auth/auto-login
```

**预期响应**：

```json
{
  "code": 0,
  "success": true,
  "data": {
    "username": "dev-user",
    "displayName": "开发测试用户",
    "domain": "DEV",
    "roles": [],
    "role": "test",
    "roleId": "2"
  },
  "token": "DEV_AUTO_LOGIN"
}
```

### 测试手动登录接口 - 普通账号

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}'
```

**预期响应**：

```json
{
  "code": 0,
  "success": true,
  "data": {
    "username": "admin",
    "displayName": "admin",
    "domain": null,
    "roles": [],
    "role": "admin",
    "roleId": "1"
  },
  "token": "LOCAL_LOGIN"
}
```

### 测试手动登录接口 - 域用户（开发环境）

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"domain\\testuser","password":"password123"}'
```

**预期响应**：

```json
{
  "code": 0,
  "success": true,
  "data": {
    "username": "domain\\testuser",
    "displayName": "testuser",
    "domain": "domain",
    "roles": [],
    "role": "user",
    "roleId": "3"
  },
  "token": "DOMAIN_LOGIN"
}
```

### 测试登录失败

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"wrongpassword"}'
```

**预期响应**：

```json
{
  "code": 401,
  "success": false,
  "message": "用户名或密码错误"
}
```

## 浏览器控制台检查

打开浏览器开发者工具（F12），检查以下内容：

### 自动登录成功时

- Network 标签：应该看到 `/api/auth/auto-login` 请求返回 200
- Console 标签：应该看到自动登录的相关日志（如果有）

### 手动登录时

- Network 标签：应该看到 `/api/auth/login` 请求返回 200
- Application/Storage 标签：应该看到用户信息被存储

## 常见问题排查

### 问题 1：自动登录不工作

**检查项**：

1. 后端服务是否正常运行？
2. 浏览器控制台是否有错误？
3. 检查 `packages/frontend/src/permission.ts` 中的自动登录逻辑是否正确执行

**解决方案**：

- 检查后端日志
- 检查前端路由守卫是否正确触发
- 确认 `userStore.autoTried` 状态是否正确

### 问题 2：登录接口返回 404

**检查项**：

1. 后端路由是否正确注册？
2. 检查 `backend/server.js` 中是否添加了 `app.use('/api/auth', authRoutes)`

**解决方案**：

- 重启后端服务
- 检查后端日志，确认路由已注册

### 问题 3：域用户登录失败

**开发环境**：

- 检查是否使用了正确的测试账号：`domain\testuser` / `password123`
- 检查后端 `mockVerifyDomainUser` 函数中的测试账号配置

**生产环境**：

- 检查 LDAP 配置是否正确
- 检查 `ldapjs` 是否已安装
- 检查网络连接是否正常（能否访问域控制器）

### 问题 4：普通账号登录失败

**检查项**：

1. 是否使用了正确的账号密码（admin/admin 或 test/test）？
2. 检查后端 `verifyLocalUser` 函数中的账号配置

## 生产环境测试

### 前提条件

1. ✅ Ubuntu 服务器已配置 Apache + Kerberos
2. ✅ 已获取 Kerberos keytab 文件
3. ✅ 已配置 LDAP 连接信息
4. ✅ 浏览器已配置域白名单

### 测试步骤

1. **测试自动登录**：
   - 在域内电脑上访问应用
   - 应该自动登录，无需输入密码

2. **测试域用户手动登录**：
   - 退出登录
   - 输入真实的域用户名和密码
   - 应该成功登录

3. **测试普通账号登录**：
   - 退出登录
   - 输入 admin 账号和密码
   - 应该成功登录

## 调试技巧

### 后端调试

在后端代码中添加日志：

```javascript
// backend/routes/auth.js
console.log('收到登录请求:', { username, isDomainUser: parsed.isDomainUser })
```

### 前端调试

在浏览器控制台检查：

```javascript
// 检查用户状态
localStorage.getItem('user')
// 检查自动登录标记
localStorage.getItem('user.autoTried')
```

## 下一步

完成测试后，可以：

1. **配置生产环境**：参考 `backend/WINDOWS_DOMAIN_AUTH.md`
2. **优化用户体验**：添加登录提示、错误处理等
3. **创建用户表**：将普通账号从硬编码改为数据库存储
4. **添加角色映射**：将域用户与系统角色进行映射
