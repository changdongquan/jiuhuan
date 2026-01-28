# 第三步：配置域用户自动登录（SSO）

## 概述

实现域用户自动登录需要配置 **Apache + Kerberos**，让域内用户在访问系统时自动使用 Windows 域凭据登录，无需手动输入密码。

## 架构说明

```
域用户浏览器 → Apache (Kerberos 认证) → Node.js 后端
              ↓
           读取 X-Remote-User 头部
```

## 配置步骤

### 步骤 1：安装必要软件

在 Ubuntu 服务器上执行：

```bash
sudo apt-get update
sudo apt-get install -y apache2 libapache2-mod-auth-gssapi krb5-user
```

### 步骤 2：配置 Kerberos

编辑 `/etc/krb5.conf`：

```bash
sudo nano /etc/krb5.conf
```

配置内容（根据实际域名修改）：

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

**重要**：将 `YOURDOMAIN.COM` 和 `yourdomain.com` 替换为实际的域名。

### 步骤 3：获取 Kerberos Keytab 文件

**需要在 Windows 域控制器上执行**（需要域管理员权限）：

#### 3.1 创建服务账号（如果还没有）

在 Active Directory 中创建一个服务账号，例如：`apache-jiuhuan@yourdomain.com`

#### 3.2 生成 Keytab 文件

在域控制器上打开 PowerShell（以管理员身份），执行：

```powershell
# 获取 Ubuntu 服务器的主机名
# 例如：ubuntu-server.yourdomain.com

# 生成 keytab 文件
ktpass -out C:\http.keytab `
  -princ HTTP/ubuntu-server.yourdomain.com@YOURDOMAIN.COM `
  -mapUser apache-jiuhuan@YOURDOMAIN.COM `
  -pass YourServiceAccountPassword `
  -crypto AES256-SHA1 -ptype KRB5_NT_PRINCIPAL
```

**注意**：

- `HTTP/ubuntu-server.yourdomain.com` 中的主机名需要是 Ubuntu 服务器的完整域名
- `apache-jiuhuan@YOURDOMAIN.COM` 是服务账号
- `YourServiceAccountPassword` 是服务账号密码

#### 3.3 传输 Keytab 文件到 Ubuntu 服务器

将生成的 `C:\http.keytab` 文件传输到 Ubuntu 服务器，并设置权限：

```bash
# 在 Ubuntu 服务器上
sudo mkdir -p /etc/apache2/keytab
sudo mv http.keytab /etc/apache2/keytab/
sudo chown root:www-data /etc/apache2/keytab/http.keytab
sudo chmod 640 /etc/apache2/keytab/http.keytab
```

### 步骤 4：配置 Apache

#### 4.1 启用必要的模块

```bash
sudo a2enmod proxy
sudo a2enmod proxy_http
sudo a2enmod headers
sudo a2enmod auth_gssapi
```

#### 4.2 创建 Apache 站点配置

创建 `/etc/apache2/sites-available/jiuhuan.conf`：

```bash
sudo nano /etc/apache2/sites-available/jiuhuan.conf
```

配置内容（根据实际情况修改路径和域名）：

```apache
<VirtualHost *:80>
    ServerName your-app.yourdomain.com

    # 启用代理
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

    # 前端静态文件（如果由 Apache 托管，否则使用 Nginx）
    # DocumentRoot /path/to/your/frontend/dist
    # <Directory /path/to/your/frontend/dist>
    #     Options -Indexes +FollowSymLinks
    #     AllowOverride None
    #     Require all granted
    # </Directory>

    # API 反向代理到 Node.js 后端
    ProxyPass /api http://localhost:3001/api
    ProxyPassReverse /api http://localhost:3001/api

    # 日志
    ErrorLog ${APACHE_LOG_DIR}/jiuhuan_error.log
    CustomLog ${APACHE_LOG_DIR}/jiuhuan_access.log combined
</VirtualHost>
```

**重要配置说明**：

- `ServerName`：改为实际的应用域名
- `keytab:/etc/apache2/keytab/http.keytab`：Keytab 文件路径
- `ProxyPass /api http://localhost:3001/api`：后端 API 地址

#### 4.3 启用站点并重启 Apache

```bash
# 启用站点
sudo a2ensite jiuhuan.conf

# 禁用默认站点（如果需要）
sudo a2dissite 000-default.conf

# 测试配置
sudo apache2ctl configtest

# 重启 Apache
sudo systemctl restart apache2
```

### 步骤 5：验证配置

#### 5.1 测试 Kerberos 认证

```bash
# 测试 keytab 文件
sudo kinit -k -t /etc/apache2/keytab/http.keytab HTTP/ubuntu-server.yourdomain.com@YOURDOMAIN.COM

# 如果成功，应该没有错误输出
# 查看票据
klist
```

#### 5.2 测试自动登录接口

在域内的 Windows 电脑上，使用浏览器访问：

```
http://your-app.yourdomain.com/api/auth/auto-login
```

**预期结果**：

- 如果配置正确，应该自动返回用户信息（无需输入密码）
- 如果配置错误，可能会提示输入 Windows 凭据或返回 401 错误

#### 5.3 查看日志

```bash
# 查看 Apache 错误日志
sudo tail -f /var/log/apache2/jiuhuan_error.log

# 查看后端日志
sudo journalctl -u jiuhuan-backend.service -f
```

## 常见问题排查

### 问题 1：Keytab 文件权限错误

```bash
# 检查权限
ls -lh /etc/apache2/keytab/http.keytab

# 应该显示：-rw-r----- 1 root www-data ...
# 如果不对，修复权限
sudo chown root:www-data /etc/apache2/keytab/http.keytab
sudo chmod 640 /etc/apache2/keytab/http.keytab
```

### 问题 2：Kerberos 认证失败

1. 检查 `/etc/krb5.conf` 配置是否正确
2. 检查 Keytab 文件是否正确生成
3. 检查域名解析是否正确（DNS）
4. 检查防火墙是否开放必要端口（88, 389, 636）

### 问题 3：Apache 无法读取 Keytab

```bash
# 检查 Apache 错误日志
sudo tail -f /var/log/apache2/error.log

# 检查 SELinux（如果启用）
sudo getenforce
```

### 问题 4：后端无法获取用户名

检查 Apache 是否正确传递 `X-Remote-User` 头部：

```bash
# 在 Apache 配置中添加日志
LogLevel debug
```

## HTTPS 配置（推荐）

如果使用 HTTPS，需要修改 Apache 配置：

```apache
<VirtualHost *:443>
    ServerName your-app.yourdomain.com

    SSLEngine on
    SSLCertificateFile /path/to/cert.pem
    SSLCertificateKeyFile /path/to/key.pem

    # ... 其他配置同上
</VirtualHost>
```

## 完整配置检查清单

- [ ] 已安装 Apache 和 Kerberos 模块
- [ ] `/etc/krb5.conf` 已正确配置
- [ ] Keytab 文件已生成并传输到服务器
- [ ] Keytab 文件权限正确（640, root:www-data）
- [ ] Apache 模块已启用（proxy, proxy_http, headers, auth_gssapi）
- [ ] Apache 站点配置已创建并启用
- [ ] Apache 配置测试通过
- [ ] Apache 已重启
- [ ] 可以从域内电脑访问自动登录接口

## 工作原理

1. 域用户访问 `/api/auth/auto-login` 接口
2. Apache 使用 Kerberos 验证用户身份（使用用户的 Windows 域凭据）
3. 验证成功后，Apache 将用户名通过 `X-Remote-User` 头部传递给后端
4. 后端读取头部，返回用户信息并自动登录

## 下一步

配置完成后，域用户在访问系统时会自动登录，无需手动输入密码。

如果还有问题，请查看：

- `packages/backend/WINDOWS_DOMAIN_AUTH.md` - 详细配置文档
- Apache 错误日志：`/var/log/apache2/jiuhuan_error.log`
- 后端日志：`sudo journalctl -u jiuhuan-backend.service -f`
