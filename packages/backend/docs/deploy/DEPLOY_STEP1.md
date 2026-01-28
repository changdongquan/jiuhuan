# 第一步：配置 Systemd 服务（设置 NODE_ENV=production 并自动启动）

## 准备工作

✅ **服务器后端路径**：`/opt/jh-craftsys/source/packages/backend`

## 在 Ubuntu 服务器上执行以下命令

### 步骤 1：确认 Node.js 路径

```bash
which node
```

**记录输出结果**，例如：

- `/usr/bin/node` （最常见）
- `/usr/local/bin/node`
- `/opt/nodejs/bin/node`

### 步骤 2：上传服务文件到服务器

将 `packages/backend/ops/systemd/jiuhuan-backend.service` 文件上传到服务器的 `/opt/jh-craftsys/source/packages/backend/ops/systemd/` 目录。

### 步骤 3：检查并修改服务文件（如果需要）

```bash
cd /opt/jh-craftsys/source/packages/backend
nano jiuhuan-backend.service
```

**检查以下内容**：

1. ✅ `WorkingDirectory=/opt/jh-craftsys/source/packages/backend` （已正确）
2. ⚠️ `ExecStart=/usr/bin/node server.js` - 如果步骤1中 `which node` 的输出不是 `/usr/bin/node`，需要修改这一行
3. ⚠️ `User=www-data` - 确认运行服务的用户（通常是 `www-data` 或你的用户名）

**示例**：如果 Node.js 路径是 `/usr/local/bin/node`，则修改为：

```ini
ExecStart=/usr/local/bin/node server.js
```

### 步骤 4：复制服务文件到系统目录

```bash
sudo cp /opt/jh-craftsys/source/packages/backend/ops/systemd/jiuhuan-backend.service /etc/systemd/system/
```

### 步骤 5：重新加载 systemd 配置

```bash
sudo systemctl daemon-reload
```

### 步骤 6：启用服务（开机自启）

```bash
sudo systemctl enable jiuhuan-backend.service
```

### 步骤 7：启动服务

```bash
sudo systemctl start jiuhuan-backend.service
```

### 步骤 8：检查服务状态

```bash
sudo systemctl status jiuhuan-backend.service
```

**预期输出**：

- ✅ `Active: active (running)`
- ✅ `Loaded: loaded (/etc/systemd/system/jiuhuan-backend.service; enabled)`

### 步骤 9：验证环境变量

```bash
sudo systemctl show jiuhuan-backend.service | grep Environment
```

**预期输出**：

```
Environment=NODE_ENV=production
Environment=PORT=3001
```

### 步骤 10：测试 API 接口

```bash
curl http://localhost:3001/health
# 或
curl http://localhost:3001/api/auth/login
```

## 完整命令序列（复制粘贴执行）

```bash
# 1. 确认 Node.js 路径
which node

# 2. 进入项目目录
cd /opt/jh-craftsys/source/packages/backend

# 3. 检查并修改服务文件（如果需要）
nano jiuhuan-backend.service

# 4. 复制服务文件到系统目录
sudo cp jiuhuan-backend.service /etc/systemd/system/

# 5. 重新加载配置
sudo systemctl daemon-reload

# 6. 启用服务
sudo systemctl enable jiuhuan-backend.service

# 7. 启动服务
sudo systemctl start jiuhuan-backend.service

# 8. 检查状态
sudo systemctl status jiuhuan-backend.service

# 9. 验证环境变量
sudo systemctl show jiuhuan-backend.service | grep Environment

# 10. 测试接口
curl http://localhost:3001/health
```

## 验证清单

- [ ] 服务状态显示 `active (running)`
- [ ] 服务已启用（`enabled`）
- [ ] 环境变量包含 `NODE_ENV=production`
- [ ] API 接口可以正常访问

## 如果遇到问题

### 问题：服务启动失败

```bash
# 查看详细错误日志
sudo journalctl -u jiuhuan-backend.service -n 50
```

### 问题：权限问题

```bash
# 确保项目目录权限正确
sudo chown -R www-data:www-data /opt/jh-craftsys/source/packages/backend
```

### 问题：Node.js 路径错误

```bash
# 查找 Node.js 实际路径
which node
# 然后修改服务文件中的 ExecStart 路径
```

## 完成后的下一步

完成第一步后，服务将：

- ✅ 自动设置 `NODE_ENV=production`
- ✅ 服务器重启后自动启动

**完成第一步后，告诉我结果，我们继续下一步！**
