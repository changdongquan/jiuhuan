# SSO 配置指南 - 完整版（一步一步操作）

## 📋 配置前准备

在开始配置之前，请确认以下信息：

### 需要准备的信息

1. **域名信息**
   - 域名（例如：`jiuhuan.local` 或 `company.com`）
   - 域名大写形式（例如：`JIUHUAN.LOCAL` 或 `COMPANY.COM`）

2. **域控制器信息**
   - 域控制器地址（例如：`AD2016-1.JIUHUAN.LOCAL` 或 `ad.company.com`）
   - 是否有域管理员权限

3. **Ubuntu 服务器信息**
   - 服务器完整主机名（FQDN）
   - 服务器 IP 地址
   - 应用访问地址（域名或 IP）

4. **服务账号信息**
   - 服务账号名称（例如：`apache-jiuhuan@jiuhuan.local`）
   - 服务账号密码

---

## 第一步：在 Ubuntu 服务器上安装必要软件

### 1.1 连接到服务器

```bash
ssh username@your-server-ip
```

### 1.2 更新软件包列表

```bash
sudo apt-get update
```

### 1.3 安装 Apache 和 Kerberos 相关软件

```bash
sudo apt-get install -y apache2 libapache2-mod-auth-gssapi krb5-user
```

**验证安装**：

```bash
# 检查 Apache 是否安装成功
apache2 -v

# 检查 Kerberos 是否安装成功
klist --version
```

**预期输出**：

- Apache 版本信息
- Kerberos 工具版本信息

---

## 第二步：配置 Kerberos

### 2.1 备份原有配置（可选但推荐）

```bash
sudo cp /etc/krb5.conf /etc/krb5.conf.backup
```

### 2.2 编辑 Kerberos 配置文件

```bash
sudo nano /etc/krb5.conf
```

### 2.3 替换为以下内容（根据实际情况修改）

**重要提示**：请将以下内容中的：

- `JIUHUAN.LOCAL` → 改为您的大写域名
- `jiuhuan.local` → 改为您的小写域名
- `AD2016-1.JIUHUAN.LOCAL` → 改为您的域控制器地址

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

### 2.4 保存并退出

- 按 `Ctrl + O` 保存
- 按 `Enter` 确认
- 按 `Ctrl + X` 退出

### 2.5 验证 Kerberos 配置

```bash
# 检查配置文件语法
cat /etc/krb5.conf

# 测试 DNS 查找（如果配置了 DNS）
nslookup AD2016-1.JIUHUAN.LOCAL
```

**预期结果**：

- 配置文件格式正确
- 能够解析域控制器地址

---

## 第三步：在 Windows 域控制器上生成 Keytab 文件

### 3.1 准备信息

在开始之前，需要确认：

1. **Ubuntu 服务器完整主机名**

   ```bash
   # 在 Ubuntu 服务器上执行
   hostname -f
   ```

   示例输出：`craftsys.jiuhuan.local`

2. **服务账号**
   - 如果还没有，需要在 Active Directory 中创建一个服务账号
   - 账号名称示例：`apache-jiuhuan@jiuhuan.local`

### 3.2 在域控制器上打开 PowerShell

**重要**：必须以管理员身份运行 PowerShell

### 3.3 执行 Keytab 生成命令

**方法一：使用提供的 PowerShell 脚本**

1. 将 `packages/backend/KTAB_COMMAND_JIUHUAN.ps1` 文件复制到域控制器
2. 编辑脚本，修改以下变量：
   ```powershell
   $ubuntuHostname = "craftsys.jiuhuan.local"  # 改为实际主机名
   $serviceAccount = "apache-jiuhuan@JIUHUAN.LOCAL"  # 改为实际服务账号
   $password = "YourServiceAccountPassword"  # 改为实际密码
   $domain = "JIUHUAN.LOCAL"  # 改为实际域名
   ```
3. 执行脚本：
   ```powershell
   .\KTAB_COMMAND_JIUHUAN.ps1
   ```

**方法二：直接执行命令**

在 PowerShell 中执行（替换为实际值）：

```powershell
# 设置变量（请根据实际情况修改）
$ubuntuHostname = "craftsys.jiuhuan.local"  # Ubuntu 服务器完整主机名
$domain = "JIUHUAN.LOCAL"                   # 大写域名
$serviceAccount = "apache-jiuhuan@JIUHUAN.LOCAL"  # 服务账号
$password = "YourServiceAccountPassword"    # 服务账号密码

# 生成 keytab 文件
ktpass -out C:\http.keytab `
  -princ HTTP/$ubuntuHostname@$domain `
  -mapUser $serviceAccount `
  -pass $password `
  -crypto AES256-SHA1 -ptype KRB5_NT_PRINCIPAL
```

**重要提示**：

- `HTTP/` 前缀不能省略
- 主机名必须使用完整域名（FQDN）
- 域名必须使用大写

### 3.4 验证 Keytab 文件生成

```powershell
# 检查文件是否存在
Test-Path C:\http.keytab

# 应该返回 True
```

### 3.5 传输 Keytab 文件到 Ubuntu 服务器

**方法一：使用 SCP（推荐）**

在 Windows 上（如果有 OpenSSH 客户端）：

```powershell
scp C:\http.keytab username@ubuntu-server-ip:/home/username/
```

**方法二：使用 WinSCP 或其他 SFTP 工具**

1. 使用 WinSCP 连接到 Ubuntu 服务器
2. 将 `C:\http.keytab` 上传到用户主目录

**方法三：使用共享文件夹**

1. 将文件放在共享文件夹中
2. 在 Ubuntu 服务器上通过 Samba 访问

---

## 第四步：在 Ubuntu 服务器上配置 Keytab 文件

### 4.1 创建 Keytab 目录

```bash
sudo mkdir -p /etc/apache2/keytab
```

### 4.2 移动 Keytab 文件

```bash
# 假设文件在用户主目录
sudo mv ~/http.keytab /etc/apache2/keytab/http.keytab
```

### 4.3 设置文件权限

```bash
sudo chown root:www-data /etc/apache2/keytab/http.keytab
sudo chmod 640 /etc/apache2/keytab/http.keytab
```

### 4.4 验证权限

```bash
ls -lh /etc/apache2/keytab/http.keytab
```

**预期输出**：

```
-rw-r----- 1 root www-data 1234 Jan  1 12:00 /etc/apache2/keytab/http.keytab
```

### 4.5 测试 Keytab 文件

```bash
# 替换为实际的主机名和域名
sudo kinit -k -t /etc/apache2/keytab/http.keytab HTTP/craftsys.jiuhuan.local@JIUHUAN.LOCAL

# 如果成功，应该没有错误输出
# 查看票据
klist
```

**预期输出**：

```
Ticket cache: FILE:/tmp/krb5cc_0
Default principal: HTTP/craftsys.jiuhuan.local@JIUHUAN.LOCAL

Valid starting     Expires            Service principal
01/01/24 12:00:00  01/02/24 12:00:00  krbtgt/JIUHUAN.LOCAL@JIUHUAN.LOCAL
```

**如果测试失败**：

- 检查主机名是否正确
- 检查域名是否正确（必须大写）
- 检查 Keytab 文件是否损坏
- 检查网络连接是否正常

---

## 第五步：配置 Apache

### 5.1 启用必要的 Apache 模块

```bash
sudo a2enmod proxy
sudo a2enmod proxy_http
sudo a2enmod headers
sudo a2enmod auth_gssapi
```

**验证模块已启用**：

```bash
apache2ctl -M | grep -E "proxy|headers|auth_gssapi"
```

**预期输出**：

```
proxy_module (shared)
proxy_http_module (shared)
headers_module (shared)
auth_gssapi_module (shared)
```

### 5.2 创建 Apache 站点配置文件

```bash
sudo nano /etc/apache2/sites-available/jiuhuan.conf
```

### 5.3 复制以下配置内容

**重要提示**：请根据实际情况修改以下内容：

- `ServerName`：改为实际的应用域名或 IP
- `ProxyPass`：确认后端端口是否为 3001

```apache
<VirtualHost *:80>
    ServerName your-app.jiuhuan.local
    # 或者使用 IP 地址
    # ServerName 10.0.0.xxx

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

    # API 反向代理到 Node.js 后端
    ProxyPass /api http://localhost:3001/api
    ProxyPassReverse /api http://localhost:3001/api

    # 日志
    ErrorLog ${APACHE_LOG_DIR}/jiuhuan_error.log
    CustomLog ${APACHE_LOG_DIR}/jiuhuan_access.log combined
</VirtualHost>
```

### 5.4 保存并退出

- 按 `Ctrl + O` 保存
- 按 `Enter` 确认
- 按 `Ctrl + X` 退出

### 5.5 启用站点

```bash
sudo a2ensite jiuhuan.conf
```

### 5.6 禁用默认站点（如果需要）

```bash
sudo a2dissite 000-default.conf
```

### 5.7 测试 Apache 配置

```bash
sudo apache2ctl configtest
```

**预期输出**：

```
Syntax OK
```

**如果出现错误**：

- 检查配置文件语法
- 检查模块是否已启用
- 查看错误信息并修复

### 5.8 重启 Apache

```bash
sudo systemctl restart apache2
```

### 5.9 检查 Apache 状态

```bash
sudo systemctl status apache2
```

**预期输出**：

```
● apache2.service - The Apache HTTP Server
     Loaded: loaded (/lib/systemd/system/apache2.service; enabled)
     Active: active (running) since ...
```

---

## 第六步：配置浏览器（Windows 域内电脑）

### 6.1 Chrome/Edge 配置

**方法一：组策略（推荐，适用于域环境）**

1. 在域控制器上打开"组策略管理"
2. 编辑相应的组策略对象（GPO）
3. 导航到：`计算机配置` → `管理模板` → `Google Chrome` → `配置身份验证服务器白名单`
4. 添加应用域名：`your-app.jiuhuan.local`

**方法二：注册表（单机配置）**

在域内电脑上，以管理员身份运行 PowerShell：

```powershell
# 创建 Chrome 策略注册表项
New-Item -Path "HKLM:\SOFTWARE\Policies\Google\Chrome" -Force | Out-Null

# 设置身份验证服务器白名单
Set-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Google\Chrome" `
  -Name "AuthServerWhitelist" `
  -Value "your-app.jiuhuan.local"
```

**方法三：Edge 浏览器配置**

```powershell
# 创建 Edge 策略注册表项
New-Item -Path "HKLM:\SOFTWARE\Policies\Microsoft\Edge" -Force | Out-Null

# 设置身份验证服务器白名单
Set-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Edge" `
  -Name "AuthServerWhitelist" `
  -Value "your-app.jiuhuan.local"
```

### 6.2 IE/旧版 Edge 配置

1. 打开 Internet 选项
2. 安全 → 本地 Intranet → 站点
3. 添加：`http://your-app.jiuhuan.local`

---

## 第七步：验证 SSO 配置

### 7.1 检查 Apache 日志

```bash
# 实时查看错误日志
sudo tail -f /var/log/apache2/jiuhuan_error.log

# 实时查看访问日志
sudo tail -f /var/log/apache2/jiuhuan_access.log
```

### 7.2 检查后端日志

```bash
# 如果使用 systemd 服务
sudo journalctl -u jiuhuan-backend.service -f

# 或者查看日志文件（如果使用文件日志）
tail -f /path/to/packages/backend/logs/server.log
```

### 7.3 在域内电脑上测试

1. **打开浏览器**（Chrome/Edge）
2. **访问自动登录接口**：
   ```
   http://your-app.jiuhuan.local/api/auth/auto-login
   ```

**预期结果**：

- ✅ **成功**：自动返回 JSON 格式的用户信息，无需输入密码

  ```json
  {
    "code": 0,
    "success": true,
    "data": {
      "username": "username",
      "displayName": "username",
      "domain": "JIUHUAN",
      "roles": [],
      "role": "user",
      "roleId": "3"
    },
    "token": "SSO_AUTO_LOGIN"
  }
  ```

- ❌ **失败情况**：
  - 提示输入 Windows 凭据 → 可能未配置浏览器白名单
  - 返回 401 错误 → 检查 Apache 配置和 Keytab 文件
  - 网络错误 → 检查网络连接和后端服务

### 7.4 测试完整应用

1. **访问应用首页**：

   ```
   http://your-app.jiuhuan.local
   ```

2. **预期行为**：
   - 自动跳转并登录（无需输入密码）
   - 显示域用户信息
   - 可以正常使用系统功能

---

## 第八步：故障排查

### 问题 1：Keytab 文件权限错误

**症状**：Apache 日志显示无法读取 Keytab 文件

**解决方法**：

```bash
# 检查权限
ls -lh /etc/apache2/keytab/http.keytab

# 修复权限
sudo chown root:www-data /etc/apache2/keytab/http.keytab
sudo chmod 640 /etc/apache2/keytab/http.keytab
```

### 问题 2：Kerberos 认证失败

**症状**：浏览器提示输入凭据或返回 401 错误

**排查步骤**：

1. **检查 Kerberos 配置**：

   ```bash
   cat /etc/krb5.conf
   ```

2. **检查 Keytab 文件**：

   ```bash
   sudo kinit -k -t /etc/apache2/keytab/http.keytab HTTP/hostname@DOMAIN
   klist
   ```

3. **检查 DNS 解析**：

   ```bash
   nslookup AD2016-1.JIUHUAN.LOCAL
   ```

4. **检查防火墙**：
   ```bash
   # 确保开放以下端口
   # 88 (Kerberos)
   # 389 (LDAP)
   # 636 (LDAPS)
   sudo ufw allow 88/tcp
   sudo ufw allow 389/tcp
   sudo ufw allow 636/tcp
   ```

### 问题 3：Apache 无法读取 Keytab

**症状**：Apache 日志显示 "GSSAPI: Could not read keytab"

**解决方法**：

1. **检查文件是否存在**：

   ```bash
   ls -lh /etc/apache2/keytab/http.keytab
   ```

2. **检查文件权限**：

   ```bash
   sudo chown root:www-data /etc/apache2/keytab/http.keytab
   sudo chmod 640 /etc/apache2/keytab/http.keytab
   ```

3. **检查 SELinux**（如果启用）：
   ```bash
   sudo getenforce
   # 如果返回 Enforcing，可能需要设置 SELinux 上下文
   ```

### 问题 4：后端无法获取用户名

**症状**：自动登录接口返回 401，提示"未获取到域用户信息"

**排查步骤**：

1. **检查 Apache 是否传递头部**：

   ```bash
   # 在 Apache 配置中临时添加调试日志
   LogLevel debug
   ```

2. **检查后端日志**：

   ```bash
   # 查看后端是否收到 X-Remote-User 头部
   sudo journalctl -u jiuhuan-backend.service -f
   ```

3. **验证 Apache 配置**：
   ```bash
   # 确保 RequestHeader 配置正确
   sudo apache2ctl configtest
   ```

### 问题 5：浏览器不发送 Kerberos 票据

**症状**：浏览器提示输入凭据，而不是自动认证

**解决方法**：

1. **检查浏览器白名单配置**：
   - Chrome：检查注册表或组策略
   - Edge：检查注册表或组策略

2. **检查应用 URL**：
   - 确保使用完整域名（不是 IP）
   - 确保在域内环境中访问

3. **清除浏览器缓存和 Cookie**：
   - 清除缓存
   - 清除 Cookie
   - 重新访问

### 问题 6：跨域问题（CORS）

**症状**：浏览器控制台显示 CORS 错误

**解决方法**：

如果前端和后端不在同一域名，需要配置 CORS：

1. **在后端添加 CORS 支持**：

   ```javascript
   // 在 packages/backend/server.js 中添加
   app.use(
     cors({
       origin: 'http://your-app.jiuhuan.local',
       credentials: true // 重要：允许携带凭据
     })
   )
   ```

2. **确保前端请求携带凭据**：
   - 已在前端代码中配置 `withCredentials: true`

---

## 配置检查清单

在完成配置后，请逐项检查：

- [ ] Apache 和 Kerberos 模块已安装
- [ ] `/etc/krb5.conf` 已正确配置
- [ ] Keytab 文件已生成并传输到服务器
- [ ] Keytab 文件权限正确（640, root:www-data）
- [ ] Apache 模块已启用（proxy, proxy_http, headers, auth_gssapi）
- [ ] Apache 站点配置已创建并启用
- [ ] Apache 配置测试通过
- [ ] Apache 服务正常运行
- [ ] 浏览器已配置身份验证服务器白名单
- [ ] 可以从域内电脑访问自动登录接口
- [ ] 自动登录功能正常工作

---

## 后续优化建议

1. **HTTPS 配置**（推荐）
   - 配置 SSL 证书
   - 修改 Apache 配置为 `*:443`
   - 更新浏览器白名单为 HTTPS URL

2. **日志监控**
   - 设置日志轮转
   - 配置日志监控告警

3. **安全加固**
   - 限制 Keytab 文件访问权限
   - 定期更新服务账号密码
   - 使用 LDAPS（LDAP over SSL）

4. **性能优化**
   - 启用 GSSAPI 会话缓存
   - 配置适当的超时时间

---

## 获取帮助

如果遇到问题，请检查：

1. **Apache 错误日志**：`/var/log/apache2/jiuhuan_error.log`
2. **后端日志**：`sudo journalctl -u jiuhuan-backend.service -f`
3. **浏览器控制台**：F12 打开开发者工具，查看网络请求和错误信息
4. **相关文档**：
   - `packages/backend/WINDOWS_DOMAIN_AUTH.md` - 详细配置文档
   - `packages/backend/DEPLOY_STEP3_SSO.md` - SSO 配置步骤
   - `packages/backend/docs/sso/SSO_CONFIG_STEPS.txt` - 快速配置步骤

---

## 配置完成！

恭喜！如果所有步骤都成功完成，您的系统现在已支持域用户自动登录（SSO）。

域内用户在访问系统时会自动使用 Windows 域凭据登录，无需手动输入密码。
