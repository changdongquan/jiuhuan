# 第二步：配置 LDAP 环境变量（域用户手动登录）

## 概述

配置 LDAP 环境变量后，域用户可以通过手动输入 `domain\username` + 密码的方式登录。

## 需要的信息

在配置之前，请准备以下信息：

1. **LDAP 服务器地址**：例如 `ldap://ad.example.com:389` 或 `ldaps://ad.example.com:636`
2. **Base DN**：例如 `DC=example,DC=com` 或 `DC=company,DC=local`
3. **服务账号（可选）**：如果需要先绑定服务账号再查询用户
   - Bind DN：例如 `CN=service-account,CN=Users,DC=example,DC=com`
   - Bind Password：服务账号密码

## 配置步骤

### 方法 1：编辑服务文件（推荐）

```bash
# 1. 编辑服务文件
sudo nano /etc/systemd/system/jiuhuan-backend.service
```

在服务文件的 `[Service]` 部分，找到以下注释行并取消注释，填入实际值：

```ini
[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/jh-craftsys/source/packages/backend
Environment=NODE_ENV=production
Environment=PORT=3001

# 取消下面的注释并填入实际的 LDAP 配置
Environment=LDAP_URL=ldap://your-ad-server.com:389
Environment=LDAP_BASE_DN=DC=yourdomain,DC=com
# Environment=LDAP_BIND_DN=CN=service-account,CN=Users,DC=yourdomain,DC=com  # 可选
# Environment=LDAP_BIND_PASSWORD=your-password  # 可选

ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
```

**示例配置**：

```ini
Environment=LDAP_URL=ldap://ad.company.com:389
Environment=LDAP_BASE_DN=DC=company,DC=local
```

### 方法 2：使用 sed 命令修改（如果知道具体值）

```bash
# 替换 LDAP_URL（示例）
sudo sed -i 's|# Environment=LDAP_URL=.*|Environment=LDAP_URL=ldap://ad.company.com:389|g' /etc/systemd/system/jiuhuan-backend.service

# 替换 LDAP_BASE_DN（示例）
sudo sed -i 's|# Environment=LDAP_BASE_DN=.*|Environment=LDAP_BASE_DN=DC=company,DC=local|g' /etc/systemd/system/jiuhuan-backend.service

# 如果使用服务账号，取消注释并设置
# sudo sed -i 's|# Environment=LDAP_BIND_DN=.*|Environment=LDAP_BIND_DN=CN=service-account,CN=Users,DC=company,DC=local|g' /etc/systemd/system/jiuhuan-backend.service
# sudo sed -i 's|# Environment=LDAP_BIND_PASSWORD=.*|Environment=LDAP_BIND_PASSWORD=your-password|g' /etc/systemd/system/jiuhuan-backend.service
```

## 重新加载并重启服务

配置完成后，需要重新加载 systemd 并重启服务：

```bash
# 1. 重新加载 systemd 配置
sudo systemctl daemon-reload

# 2. 重启服务
sudo systemctl restart jiuhuan-backend.service

# 3. 检查服务状态
sudo systemctl status jiuhuan-backend.service

# 4. 验证环境变量
sudo systemctl show jiuhuan-backend.service | grep Environment
```

应该看到：

```
Environment=NODE_ENV=production
Environment=PORT=3001
Environment=LDAP_URL=ldap://ad.company.com:389
Environment=LDAP_BASE_DN=DC=company,DC=local
```

## 测试域用户登录

配置完成后，可以在前端测试域用户登录：

1. 打开登录页面
2. 输入用户名：`domain\username` 或 `username@domain.com`
3. 输入密码
4. 点击登录

## 如何获取 LDAP 配置信息

### LDAP_URL

- 通常是 Active Directory 服务器的地址
- 格式：`ldap://域名或IP:389` 或 `ldaps://域名或IP:636`（SSL）
- 示例：`ldap://ad.company.com:389`

### LDAP_BASE_DN

- 通常是域的根 DN
- 格式：`DC=域名第一段,DC=域名第二段`
- 例如：如果域名是 `company.local`，则 Base DN 是 `DC=company,DC=local`
- 例如：如果域名是 `example.com`，则 Base DN 是 `DC=example,DC=com`

### 如何查找 Base DN

在 Windows 域控制器上，可以运行：

```powershell
Get-ADDomain | Select-Object DistinguishedName
```

或者在 Linux 上使用 ldapsearch：

```bash
ldapsearch -x -H ldap://ad.company.com -s base -b "" namingContexts
```

## 故障排查

### 问题：LDAP 连接失败

1. 检查 LDAP 服务器是否可访问：

   ```bash
   telnet ad.company.com 389
   # 或
   nc -zv ad.company.com 389
   ```

2. 检查防火墙是否开放 LDAP 端口（389 或 636）

3. 查看后端日志：
   ```bash
   sudo journalctl -u jiuhuan-backend.service -f
   ```

### 问题：用户验证失败

1. 确认用户名格式正确：`domain\username` 或 `username@domain.com`
2. 确认密码正确
3. 检查 Base DN 是否正确
4. 查看后端日志中的详细错误信息

## 下一步

配置完成后，域用户可以通过手动输入用户名和密码登录。

如果需要实现自动登录（SSO），需要配置 Apache + Kerberos，参考 `WINDOWS_DOMAIN_AUTH.md`。
