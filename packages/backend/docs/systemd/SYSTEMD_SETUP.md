# Systemd 服务配置指南

## 步骤 1：创建 systemd 服务文件

### 1.1 复制服务文件到系统目录

```bash
# 将服务文件复制到 systemd 目录
sudo cp /path/to/jiuhuan/packages/backend/ops/systemd/jiuhuan-backend.service /etc/systemd/system/
```

**注意**：将 `/path/to/jiuhuan/backend` 替换为实际的项目路径，例如：

- `/home/user/jiuhuan/backend`
- `/opt/jiuhuan/backend`
- `/var/www/jiuhuan/backend`

### 1.2 修改服务文件中的路径

编辑服务文件：

```bash
sudo nano /etc/systemd/system/jiuhuan-backend.service
```

**必须修改以下内容**：

1. **WorkingDirectory**：修改为实际的项目路径

   ```ini
   WorkingDirectory=/home/user/jiuhuan/backend
   ```

2. **User**：修改为运行服务的用户（通常使用 `www-data` 或 `node`）

   ```ini
   User=www-data
   ```

3. **Node.js 路径**：确认 Node.js 的路径

   ```bash
   which node
   # 如果输出是 /usr/bin/node，则无需修改
   # 否则修改 ExecStart 中的路径
   ```

4. **环境变量（可选）**：如果需要域用户登录，取消注释并配置 LDAP 信息
   ```ini
   Environment=LDAP_URL=ldap://your-ad-server.com:389
   Environment=LDAP_BASE_DN=DC=yourdomain,DC=com
   ```

### 1.3 完整的服务文件示例

假设项目路径是 `/opt/jiuhuan/backend`，用户是 `www-data`：

```ini
[Unit]
Description=九环后端API服务
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/jiuhuan/backend
Environment=NODE_ENV=production
Environment=PORT=3001
# 如果需要域用户登录，取消下面的注释并配置 LDAP 信息
# Environment=LDAP_URL=ldap://your-ad-server.com:389
# Environment=LDAP_BASE_DN=DC=yourdomain,DC=com
# Environment=LDAP_BIND_DN=CN=service-account,CN=Users,DC=yourdomain,DC=com
# Environment=LDAP_BIND_PASSWORD=your-password
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

## 步骤 2：重新加载 systemd 配置

```bash
sudo systemctl daemon-reload
```

## 步骤 3：启用服务（开机自启）

```bash
sudo systemctl enable jiuhuan-backend.service
```

## 步骤 4：启动服务

```bash
sudo systemctl start jiuhuan-backend.service
```

## 步骤 5：检查服务状态

```bash
# 查看服务状态
sudo systemctl status jiuhuan-backend.service

# 查看服务日志
sudo journalctl -u jiuhuan-backend.service -f

# 查看最近的日志
sudo journalctl -u jiuhuan-backend.service -n 50
```

## 常用管理命令

```bash
# 启动服务
sudo systemctl start jiuhuan-backend.service

# 停止服务
sudo systemctl stop jiuhuan-backend.service

# 重启服务
sudo systemctl restart jiuhuan-backend.service

# 查看服务状态
sudo systemctl status jiuhuan-backend.service

# 禁用开机自启
sudo systemctl disable jiuhuan-backend.service

# 启用开机自启
sudo systemctl enable jiuhuan-backend.service

# 查看服务日志
sudo journalctl -u jiuhuan-backend.service -f
```

## 验证

### 1. 检查服务是否运行

```bash
sudo systemctl status jiuhuan-backend.service
```

应该看到：

- ✅ `Active: active (running)`
- ✅ `Loaded: loaded (/etc/systemd/system/jiuhuan-backend.service; enabled)`

### 2. 检查环境变量

```bash
# 查看服务环境变量
sudo systemctl show jiuhuan-backend.service | grep Environment
```

应该看到：

- `Environment=NODE_ENV=production`
- `Environment=PORT=3001`

### 3. 测试 API 接口

```bash
curl http://localhost:3001/health
# 或
curl http://localhost:3001/api/auth/login
```

### 4. 测试重启后自动启动

```bash
# 重启服务器
sudo reboot

# 重启后，检查服务是否自动启动
sudo systemctl status jiuhuan-backend.service
```

## 故障排查

### 问题 1：服务启动失败

```bash
# 查看详细错误信息
sudo journalctl -u jiuhuan-backend.service -n 50

# 检查常见问题：
# - 路径是否正确
# - Node.js 是否安装
# - 权限是否正确
# - 依赖是否安装
```

### 问题 2：权限问题

```bash
# 确保服务文件权限正确
sudo chmod 644 /etc/systemd/system/jiuhuan-backend.service

# 确保项目目录权限正确
sudo chown -R www-data:www-data /path/to/jiuhuan/backend
```

### 问题 3：端口被占用

```bash
# 检查端口是否被占用
sudo netstat -tlnp | grep 3001

# 或修改服务文件中的 PORT 环境变量
```

### 问题 4：环境变量未生效

```bash
# 检查环境变量
sudo systemctl show jiuhuan-backend.service | grep Environment

# 修改服务文件后，需要重新加载并重启
sudo systemctl daemon-reload
sudo systemctl restart jiuhuan-backend.service
```

## 注意事项

1. **路径**：确保 `WorkingDirectory` 和 `ExecStart` 中的路径都是绝对路径
2. **用户**：确保运行服务的用户有权限访问项目目录
3. **Node.js**：确保系统 PATH 中有 Node.js，或使用完整路径
4. **依赖**：确保在项目目录中已运行 `npm install`
5. **环境变量**：所有环境变量都在服务文件中设置，不需要在 `.env` 文件中设置（但如果使用 `.env`，也可以）

## 下一步

配置完成后，服务将在系统重启后自动启动，并且 `NODE_ENV=production` 会自动设置。

如果需要配置域用户登录，请参考 `../deploy/DEPLOYMENT_CHECKLIST.md`。
