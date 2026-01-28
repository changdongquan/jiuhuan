# PowerShell 脚本：生成 Keytab 文件 - JIUHUAN.LOCAL 域
# 在域控制器上以管理员身份执行

# ============================================
# 配置信息（请根据实际情况修改）
# ============================================

# Ubuntu 服务器的主机名（完整域名）
$ubuntuHostname = "craftsys.jiuhuan.local"  # ⚠️ 请改为实际的 Ubuntu 服务器主机名

# 服务账号（用于 Apache 认证）
$serviceAccount = "apache-jiuhuan@JIUHUAN.LOCAL"  # ⚠️ 请改为实际的服务账号

# 服务账号密码
$password = "YourServiceAccountPassword"  # ⚠️ 请改为实际的服务账号密码

# 域名（大写）
$domain = "JIUHUAN.LOCAL"

# ============================================
# 生成 Keytab 文件
# ============================================

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "生成 Keytab 文件" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "配置信息：" -ForegroundColor Yellow
Write-Host "  Ubuntu 主机名: $ubuntuHostname" -ForegroundColor Green
Write-Host "  服务账号: $serviceAccount" -ForegroundColor Green
Write-Host "  域名: $domain" -ForegroundColor Green
Write-Host ""

# 检查 ktpass 命令是否存在
if (-not (Get-Command ktpass -ErrorAction SilentlyContinue)) {
    Write-Host "错误: 未找到 ktpass 命令" -ForegroundColor Red
    Write-Host "请安装 Windows 支持工具或使用域控制器" -ForegroundColor Red
    exit 1
}

# 生成 Keytab 文件
Write-Host "正在生成 Keytab 文件..." -ForegroundColor Yellow

$principal = "HTTP/$ubuntuHostname@$domain"
$outputFile = "C:\http.keytab"

try {
    ktpass -out $outputFile `
        -princ $principal `
        -mapUser $serviceAccount `
        -pass $password `
        -crypto AES256-SHA1 -ptype KRB5_NT_PRINCIPAL

    Write-Host ""
    Write-Host "✅ Keytab 文件生成成功！" -ForegroundColor Green
    Write-Host "   文件位置: $outputFile" -ForegroundColor Green
    Write-Host ""
    Write-Host "下一步：" -ForegroundColor Yellow
    Write-Host "1. 将 $outputFile 文件传输到 Ubuntu 服务器" -ForegroundColor Cyan
    Write-Host "2. 在 Ubuntu 服务器上执行：" -ForegroundColor Cyan
    Write-Host "   sudo mkdir -p /etc/apache2/keytab" -ForegroundColor White
    Write-Host "   sudo mv http.keytab /etc/apache2/keytab/" -ForegroundColor White
    Write-Host "   sudo chown root:www-data /etc/apache2/keytab/http.keytab" -ForegroundColor White
    Write-Host "   sudo chmod 640 /etc/apache2/keytab/http.keytab" -ForegroundColor White
    Write-Host ""
} catch {
    Write-Host ""
    Write-Host "❌ Keytab 文件生成失败！" -ForegroundColor Red
    Write-Host "错误信息: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "可能的原因：" -ForegroundColor Yellow
    Write-Host "1. 服务账号不存在或密码错误" -ForegroundColor White
    Write-Host "2. 主机名不正确" -ForegroundColor White
    Write-Host "3. 权限不足" -ForegroundColor White
    Write-Host ""
    exit 1
}

