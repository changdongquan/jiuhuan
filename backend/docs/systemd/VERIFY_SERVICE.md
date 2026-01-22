# 验证服务配置

## ✅ 环境变量已正确设置

- `NODE_ENV=production` ✅
- `PORT=3001` ✅

## 验证服务状态

执行以下命令验证服务是否正常运行：

```bash
# 1. 检查服务状态
sudo systemctl status jiuhuan-backend.service

# 2. 检查服务是否正在运行
sudo systemctl is-active jiuhuan-backend.service

# 3. 检查服务是否已启用（开机自启）
sudo systemctl is-enabled jiuhuan-backend.service

# 4. 测试 API 接口
curl http://localhost:3001/health
# 或
curl http://localhost:3001/api/auth/login
```

## 预期结果

- 服务状态：`active (running)`
- 服务已启用：`enabled`
- API 接口：可以正常访问

## 测试服务器重启后自动启动

```bash
# 重启服务器（谨慎操作）
sudo reboot

# 重启后，检查服务是否自动启动
sudo systemctl status jiuhuan-backend.service
```

## 完成！

第一步已完成：

- ✅ 服务文件已创建
- ✅ systemd 服务已配置
- ✅ 环境变量已设置（NODE_ENV=production）
- ✅ 服务已启用（开机自启）

## 下一步

如果需要配置域用户登录功能，需要：

1. 配置 LDAP 环境变量（在服务文件中）
2. 或者配置 Apache + Kerberos（自动登录）

参考：`../deploy/DEPLOYMENT_CHECKLIST.md`
