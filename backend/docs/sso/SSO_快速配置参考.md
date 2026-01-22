# SSO 快速配置参考（命令清单）

> 这是一个快速参考指南，包含所有关键命令。详细说明请参考 `SSO_配置指南_完整版.md`

## 📝 配置前信息收集

在开始之前，请记录以下信息：

```bash
# 1. 查看 Ubuntu 服务器主机名
hostname -f

# 2. 记录以下信息（请填入实际值）：
# - 域名：_____________
# - 域名大写：_____________
# - 域控制器地址：_____________
# - 服务账号：_____________
# - 服务账号密码：_____________
```

---

## 🔧 第一步：安装软件（Ubuntu 服务器）

```bash
sudo apt-get update
sudo apt-get install -y apache2 libapache2-mod-auth-gssapi krb5-user

# 验证安装
apache2 -v
klist --version
```

---

## 🔧 第二步：配置 Kerberos（Ubuntu 服务器）

```bash
# 备份原配置
sudo cp /etc/krb5.conf /etc/krb5.conf.backup

# 编辑配置
sudo nano /etc/krb5.conf

# 验证配置
cat /etc/krb5.conf
nslookup AD2016-1.JIUHUAN.LOCAL  # 替换为实际域控制器地址
```

**配置文件内容**（请根据实际情况修改）：

```ini
[libdefaults]
    default_realm = JIUHUAN.LOCAL
    dns_lookup_realm = true
    dns_lookup_kdc = true
    ticket_lifetime = 24h
    renew_lifetime = 7d

[realms]
    JIUHUAN.LOCAL = {
        kdc = AD2016-1.JIUHUAN.LOCAL
        admin_server = AD2016-1.JIUHUAN.LOCAL
        default_domain = jiuhuan.local
    }

[domain_realm]
    .jiuhuan.local = JIUHUAN.LOCAL
    jiuhuan.local = JIUHUAN.LOCAL
    .JIUHUAN.LOCAL = JIUHUAN.LOCAL
    JIUHUAN.LOCAL = JIUHUAN.LOCAL
```

---

## 🔧 第三步：生成 Keytab（Windows 域控制器）

### 在域控制器上执行（PowerShell，管理员权限）

```powershell
# 设置变量（请修改为实际值）
$ubuntuHostname = "craftsys.jiuhuan.local"
$domain = "JIUHUAN.LOCAL"
$serviceAccount = "apache-jiuhuan@JIUHUAN.LOCAL"
$password = "YourServiceAccountPassword"

# 生成 keytab
ktpass -out C:\http.keytab `
  -princ HTTP/$ubuntuHostname@$domain `
  -mapUser $serviceAccount `
  -pass $password `
  -crypto AES256-SHA1 -ptype KRB5_NT_PRINCIPAL

# 验证文件
Test-Path C:\http.keytab
```

### 传输文件到 Ubuntu 服务器

```bash
# 在 Ubuntu 服务器上
# 方法1：使用 scp（从 Windows）
scp C:\http.keytab username@ubuntu-server:/home/username/

# 方法2：如果已上传到用户目录
# 继续执行下面的步骤
```

---

## 🔧 第四步：配置 Keytab（Ubuntu 服务器）

```bash
# 创建目录
sudo mkdir -p /etc/apache2/keytab

# 移动文件
sudo mv ~/http.keytab /etc/apache2/keytab/http.keytab

# 设置权限
sudo chown root:www-data /etc/apache2/keytab/http.keytab
sudo chmod 640 /etc/apache2/keytab/http.keytab

# 验证权限
ls -lh /etc/apache2/keytab/http.keytab

# 测试 keytab（替换为实际值）
sudo kinit -k -t /etc/apache2/keytab/http.keytab HTTP/craftsys.jiuhuan.local@JIUHUAN.LOCAL
klist
```

---

## 🔧 第五步：配置 Apache（Ubuntu 服务器）

```bash
# 启用模块
sudo a2enmod proxy
sudo a2enmod proxy_http
sudo a2enmod headers
sudo a2enmod auth_gssapi

# 验证模块
apache2ctl -M | grep -E "proxy|headers|auth_gssapi"

# 创建配置文件
sudo nano /etc/apache2/sites-available/jiuhuan.conf
```

**配置文件内容**（请根据实际情况修改）：

```apache
<VirtualHost *:80>
    ServerName your-app.jiuhuan.local

    ProxyPreserveHost On
    ProxyRequests Off

    <Location /api/auth/auto-login>
        AuthType GSSAPI
        AuthName "Windows Domain Authentication"
        GssapiCredStore keytab:/etc/apache2/keytab/http.keytab
        GssapiLocalName On
        Require valid-user
        RequestHeader set X-Remote-User "%{REMOTE_USER}e" env=REMOTE_USER
    </Location>

    ProxyPass /api http://localhost:3001/api
    ProxyPassReverse /api http://localhost:3001/api

    ErrorLog ${APACHE_LOG_DIR}/jiuhuan_error.log
    CustomLog ${APACHE_LOG_DIR}/jiuhuan_access.log combined
</VirtualHost>
```

```bash
# 启用站点
sudo a2ensite jiuhuan.conf

# 禁用默认站点（可选）
sudo a2dissite 000-default.conf

# 测试配置
sudo apache2ctl configtest

# 重启 Apache
sudo systemctl restart apache2

# 检查状态
sudo systemctl status apache2
```

---

## 🔧 第六步：配置浏览器（Windows 域内电脑）

### Chrome/Edge（注册表方式）

```powershell
# 以管理员身份运行 PowerShell

# Chrome
New-Item -Path "HKLM:\SOFTWARE\Policies\Google\Chrome" -Force
Set-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Google\Chrome" `
  -Name "AuthServerWhitelist" `
  -Value "your-app.jiuhuan.local"

# Edge
New-Item -Path "HKLM:\SOFTWARE\Policies\Microsoft\Edge" -Force
Set-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Edge" `
  -Name "AuthServerWhitelist" `
  -Value "your-app.jiuhuan.local"
```

---

## ✅ 第七步：验证配置

```bash
# 1. 查看 Apache 日志
sudo tail -f /var/log/apache2/jiuhuan_error.log

# 2. 查看后端日志
sudo journalctl -u jiuhuan-backend.service -f

# 3. 在域内电脑浏览器访问
# http://your-app.jiuhuan.local/api/auth/auto-login
```

**预期结果**：自动返回 JSON 格式的用户信息，无需输入密码

---

## 🔍 常见问题快速修复

### Keytab 权限错误

```bash
sudo chown root:www-data /etc/apache2/keytab/http.keytab
sudo chmod 640 /etc/apache2/keytab/http.keytab
```

### Apache 配置错误

```bash
sudo apache2ctl configtest
sudo systemctl restart apache2
```

### 测试 Keytab 文件

```bash
sudo kinit -k -t /etc/apache2/keytab/http.keytab HTTP/hostname@DOMAIN
klist
```

### 检查防火墙

```bash
sudo ufw allow 88/tcp   # Kerberos
sudo ufw allow 389/tcp  # LDAP
sudo ufw allow 636/tcp  # LDAPS
```

---

## 📋 配置检查清单

- [ ] Apache 和 Kerberos 已安装
- [ ] `/etc/krb5.conf` 已配置
- [ ] Keytab 文件已生成并传输
- [ ] Keytab 文件权限正确（640, root:www-data）
- [ ] Apache 模块已启用
- [ ] Apache 站点配置已创建并启用
- [ ] Apache 配置测试通过
- [ ] Apache 服务正常运行
- [ ] 浏览器已配置白名单
- [ ] 自动登录功能测试通过

---

## 📞 获取帮助

**查看日志**：

```bash
# Apache 错误日志
sudo tail -f /var/log/apache2/jiuhuan_error.log

# 后端日志
sudo journalctl -u jiuhuan-backend.service -f
```

**参考文档**：

- `SSO_配置指南_完整版.md` - 详细配置说明
- `WINDOWS_DOMAIN_AUTH.md` - 完整技术文档
- `DEPLOY_STEP3_SSO.md` - SSO 配置步骤
