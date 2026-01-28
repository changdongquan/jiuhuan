# PowerShell 脚本：获取 Windows 域信息
# 在域控制器或域内电脑上执行

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Windows 域信息查询" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# 1. 获取当前域名
Write-Host "1. 当前域名：" -ForegroundColor Yellow
try {
    $domain = (Get-WmiObject Win32_ComputerSystem).Domain
    Write-Host "   $domain" -ForegroundColor Green
} catch {
    Write-Host "   无法获取域名（可能不在域环境中）" -ForegroundColor Red
}
Write-Host ""

# 2. 获取域控制器信息
Write-Host "2. 域控制器信息：" -ForegroundColor Yellow
try {
    $domainControllers = Get-ADDomainController -Filter * | Select-Object Name, IPv4Address, Site, OperatingSystem
    if ($domainControllers) {
        foreach ($dc in $domainControllers) {
            Write-Host "   名称: $($dc.Name)" -ForegroundColor Green
            Write-Host "   IP: $($dc.IPv4Address)" -ForegroundColor Green
            Write-Host "   站点: $($dc.Site)" -ForegroundColor Green
            Write-Host "   操作系统: $($dc.OperatingSystem)" -ForegroundColor Green
            Write-Host ""
        }
    } else {
        Write-Host "   无法获取域控制器信息" -ForegroundColor Red
    }
} catch {
    Write-Host "   尝试使用 nltest 命令..." -ForegroundColor Yellow
    try {
        $nltest = nltest /dsgetdc:$env:USERDOMAIN
        Write-Host "   $nltest" -ForegroundColor Green
    } catch {
        Write-Host "   无法获取域控制器信息" -ForegroundColor Red
    }
}
Write-Host ""

# 3. 获取域详细信息
Write-Host "3. 域详细信息：" -ForegroundColor Yellow
try {
    $domainInfo = Get-ADDomain | Select-Object Name, DNSRoot, DistinguishedName, Forest
    Write-Host "   域名: $($domainInfo.Name)" -ForegroundColor Green
    Write-Host "   DNS根: $($domainInfo.DNSRoot)" -ForegroundColor Green
    Write-Host "   Distinguished Name: $($domainInfo.DistinguishedName)" -ForegroundColor Green
    Write-Host "   林名称: $($domainInfo.Forest)" -ForegroundColor Green
} catch {
    Write-Host "   无法获取域详细信息（需要 ActiveDirectory 模块）" -ForegroundColor Red
}
Write-Host ""

# 4. 获取当前电脑信息
Write-Host "4. 当前电脑信息：" -ForegroundColor Yellow
$computerInfo = Get-WmiObject Win32_ComputerSystem
Write-Host "   计算机名: $($computerInfo.Name)" -ForegroundColor Green
Write-Host "   完整域名: $($computerInfo.Name).$($computerInfo.Domain)" -ForegroundColor Green
Write-Host "   域: $($computerInfo.Domain)" -ForegroundColor Green
Write-Host "   工作组: $($computerInfo.Workgroup)" -ForegroundColor Green
Write-Host ""

# 5. 获取 Kerberos 配置信息
Write-Host "5. Kerberos 配置建议：" -ForegroundColor Yellow
if ($domainInfo) {
    $domainUpper = $domainInfo.Name.ToUpper()
    $domainLower = $domainInfo.Name.ToLower()
    Write-Host "   default_realm = $domainUpper" -ForegroundColor Cyan
    Write-Host "   kdc = $($domainControllers[0].Name)" -ForegroundColor Cyan
    Write-Host "   admin_server = $($domainControllers[0].Name)" -ForegroundColor Cyan
    Write-Host "   default_domain = $domainLower" -ForegroundColor Cyan
} else {
    Write-Host "   无法生成 Kerberos 配置（需要先获取域信息）" -ForegroundColor Red
}
Write-Host ""

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "完成！" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

