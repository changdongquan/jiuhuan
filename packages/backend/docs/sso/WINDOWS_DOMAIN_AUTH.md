# Windows 域用户自动登录配置指南

## 概述

本系统支持三种登录方式：

1. **域自动登录**：域内电脑自动使用 Windows 域凭据登录（无需输入密码）
2. **域用户手动登录**：域用户手动输入 `DOMAIN\username` 或 `username@domain.com` + 密码
3. **普通账号登录**：管理员账号 `admin` 等普通账号登录

## 后端配置

### 1. 安装依赖

如果需要域用户手动登录功能（LDAP 验证），需要安装 `ldapjs`：

```bash
cd packages/backend
npm install ldapjs --save
```

### 2. 环境变量配置

在 `packages/backend/.env` 文件中配置（或直接在 `packages/backend/routes/auth.js` 中修改）：

```env
# LDAP 配置（用于域用户验证）
LDAP_URL=ldap://ad.yourdomain.com:389
LDAP_BASE_DN=DC=yourdomain,DC=com
LDAP_BIND_DN=CN=service-account,CN=Users,DC=yourdomain,DC=com  # 可选
LDAP_BIND_PASSWORD=your-password  # 可选

# Node.js 环境
NODE_ENV=production  # 生产环境设置为 production
```

### 3. 普通账号配置

普通账号（如 `admin`）的验证逻辑在 `packages/backend/routes/auth.js` 的 `verifyLocalUser` 函数中。

**当前实现**：硬编码了 `admin/admin` 和 `test/test` 两个测试账号。

**建议**：创建数据库用户表，从数据库验证普通账号。

## 生产环境部署（Ubuntu + Apache + Kerberos）

### 1. 安装 Apache 和 Kerberos 模块

```bash
sudo apt-get update
sudo apt-get install -y apache2 libapache2-mod-auth-gssapi krb5-user
```

### 2. 配置 Kerberos

编辑 `/etc/krb5.conf`：

```ini
[libdefaults]
    default_realm = YOURDOMAIN.COM
    dns_lookup_realm = true
    dns_lookup_kdc = true
    ticket_lifetime = 24h
    renew_lifetime = 7d

[realms]
    YOURDOMAIN.COM = {
        kdc = ad.yourdomain.com  # Windows 域控制器地址
        admin_server = ad.yourdomain.com
        default_domain = yourdomain.com
    }

[domain_realm]
    .yourdomain.com = YOURDOMAIN.COM
    yourdomain.com = YOURDOMAIN.COM
```

### 3. 获取 Kerberos Keytab

**需要域管理员在 Windows 域控制器上执行**：

```powershell
# 创建服务账号（用于 Apache 认证）
# 在 AD 中创建一个服务账号，例如：apache-jiuhuan@yourdomain.com

# 生成 keytab 文件
ktpass -out C:\http.keytab ^
  -princ HTTP/your-ubuntu-hostname.yourdomain.com@YOURDOMAIN.COM ^
  -mapUser apache-jiuhuan@YOURDOMAIN.COM ^
  -pass YourServiceAccountPassword ^
  -crypto AES256-SHA1 -ptype KRB5_NT_PRINCIPAL

# 将生成的 http.keytab 文件传输到 Ubuntu 服务器
# 建议放在 /etc/apache2/keytab/ 目录
```

### 4. 配置 Apache

创建 `/etc/apache2/sites-available/jiuhuan.conf`：

```apache
<VirtualHost *:80>
    ServerName your-app.yourdomain.com

    # 如果是 HTTPS，改为 *:443 并配置 SSL
    # <VirtualHost *:443>
    #     SSLEngine on
    #     SSLCertificateFile /path/to/cert.pem
    #     SSLCertificateKeyFile /path/to/key.pem

    # 启用代理模块
    ProxyPreserveHost On
    ProxyRequests Off

    # Kerberos 认证 - 只对自动登录接口启用
    <Location /api/auth/auto-login>
        AuthType GSSAPI
        AuthName "Windows Domain Authentication"
        GssapiCredStore keytab:/etc/apache2/keytab/http.keytab
        GssapiLocalName On
        Require valid-user

        # 将认证后的用户名传递给后端
        RequestHeader set X-Remote-User "%{REMOTE_USER}e" env=REMOTE_USER
    </Location>

    # 前端静态文件（如果由 Apache 托管）
    DocumentRoot /path/to/your/frontend/dist
    <Directory /path/to/your/frontend/dist>
        Options -Indexes +FollowSymLinks
        AllowOverride None
        Require all granted
    </Directory>

    # API 反向代理到 Node.js
    ProxyPass /api http://localhost:3001/api
    ProxyPassReverse /api http://localhost:3001/api

    # 日志
    ErrorLog ${APACHE_LOG_DIR}/jiuhuan_error.log
    CustomLog ${APACHE_LOG_DIR}/jiuhuan_access.log combined
</VirtualHost>
```

### 5. 启用 Apache 模块和站点

```bash
# 启用必要的 Apache 模块
sudo a2enmod auth_gssapi
sudo a2enmod proxy
sudo a2enmod proxy_http
sudo a2enmod headers

# 启用站点
sudo a2ensite jiuhuan.conf

# 禁用默认站点（如果存在）
sudo a2dissite 000-default.conf

# 测试配置
sudo apache2ctl configtest

# 重启 Apache
sudo systemctl restart apache2
```

## 浏览器配置（Windows 域内电脑）

### Chrome/Edge（Chromium）

**方法 1：组策略（推荐，适用于域环境）**

通过域策略配置：

- `计算机配置` → `管理模板` → `Google Chrome` → `配置身份验证服务器白名单`
- 添加应用域名：`your-app.yourdomain.com`

**方法 2：注册表**

```powershell
# 以管理员身份运行 PowerShell
New-Item -Path "HKLM:\SOFTWARE\Policies\Google\Chrome" -Force
Set-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Google\Chrome" -Name "AuthServerWhitelist" -Value "your-app.yourdomain.com"
```

### IE/旧版 Edge

1. 打开 Internet 选项
2. 安全 → 本地 Intranet → 站点
3. 添加：`http://your-app.yourdomain.com`

## 开发环境（Mac/本地）

开发环境下：

- **自动登录**：返回模拟用户数据（无需真实 Kerberos）
- **域用户登录**：使用模拟验证（测试账号：`domain\testuser` / `password123`）
- **普通账号登录**：验证 `admin/admin` 和 `test/test`

可以在 `packages/backend/routes/auth.js` 的 `mockVerifyDomainUser` 函数中修改模拟账号。

## 测试验证

### 1. 测试自动登录

在域内电脑上访问应用，应该自动登录，无需输入密码。

### 2. 测试域用户手动登录

1. 退出登录
2. 输入：`DOMAIN\username` 或 `username@domain.com`
3. 输入域用户密码
4. 应该成功登录

### 3. 测试普通账号登录

1. 输入：`admin`
2. 输入：`admin`（或其他配置的密码）
3. 应该成功登录

## 故障排查

### 自动登录不工作

1. 检查 Apache 日志：`tail -f /var/log/apache2/jiuhuan_error.log`
2. 测试 Kerberos：`klist -k /etc/apache2/keytab/http.keytab`
3. 检查浏览器是否在域内且已配置白名单
4. 检查后端日志：查看是否有 `x-remote-user` 头部

### 域用户手动登录失败

1. 检查 LDAP 配置是否正确
2. 测试 LDAP 连接：`ldapsearch -x -H ldap://ad.yourdomain.com -b "DC=yourdomain,DC=com"`
3. 检查后端日志：查看 LDAP 验证错误信息
4. 确认域用户名格式正确（`DOMAIN\username` 或 `username@domain.com`）

### 普通账号登录失败

1. 检查 `packages/backend/routes/auth.js` 中的 `verifyLocalUser` 函数
2. 确认账号密码匹配
3. 检查数据库用户表（如果已创建）

## API 接口说明

### GET /api/auth/auto-login

自动登录接口，从 Apache 传递的头部读取域用户信息。

**请求头**（由 Apache 自动添加）：

- `X-Remote-User`: 域用户名（格式：`DOMAIN\username` 或 `username@domain.com`）

**响应**：

```json
{
  "code": 0,
  "success": true,
  "data": {
    "username": "username",
    "displayName": "username",
    "domain": "DOMAIN",
    "roles": [],
    "role": "user",
    "roleId": "3"
  },
  "token": "SSO_AUTO_LOGIN"
}
```

### POST /api/auth/login

手动登录接口，支持普通账号和域用户。

**请求体**：

```json
{
  "username": "admin" | "DOMAIN\\username" | "username@domain.com",
  "password": "password"
}
```

**响应**：

```json
{
  "code": 0,
  "success": true,
  "data": {
    "username": "username",
    "displayName": "username",
    "domain": "DOMAIN" | null,
    "roles": [],
    "role": "admin" | "user",
    "roleId": "1" | "3"
  },
  "token": "LOCAL_LOGIN" | "DOMAIN_LOGIN"
}
```

## 安全注意事项

1. **HTTPS**：生产环境强烈建议使用 HTTPS
2. **头部验证**：后端应该验证 `X-Remote-User` 头部来自可信的 Apache（建议通过内部 IP 验证）
3. **LDAP 连接**：建议使用 LDAPS（LDAP over SSL）提高安全性
4. **Keytab 文件权限**：确保 keytab 文件权限设置为 600（仅所有者可读写）

## 后续优化建议

1. **创建用户表**：在数据库中创建用户表，统一管理普通账号
2. **用户角色映射**：将域用户与系统角色进行映射
3. **登录日志**：记录所有登录操作（自动登录、手动登录）
4. **Token 管理**：使用 JWT token 替代简单的字符串 token
