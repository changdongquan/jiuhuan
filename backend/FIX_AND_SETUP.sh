#!/bin/bash

# 修复权限并配置服务的命令
# 在服务器终端粘贴执行

# 进入项目目录
cd /opt/jh-craftsys/source/backend

# 检查当前目录
echo "当前目录: $(pwd)"
echo ""

# 检查文件是否存在
if [ -f "jiuhuan-backend.service" ]; then
    echo "✅ jiuhuan-backend.service 文件存在"
else
    echo "❌ jiuhuan-backend.service 文件不存在，重新创建..."
    cat > jiuhuan-backend.service << 'EOF'
[Unit]
Description=久环后端API服务
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/jh-craftsys/source/backend
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
EOF
    echo "✅ 服务文件已创建"
fi

if [ -f "setup-systemd.sh" ]; then
    echo "✅ setup-systemd.sh 文件存在"
else
    echo "❌ setup-systemd.sh 文件不存在，重新创建..."
    cat > setup-systemd.sh << 'EOFSCRIPT'
#!/bin/bash
set -e
echo "=========================================="
echo "久环后端 Systemd 服务配置脚本"
echo "=========================================="
echo ""
PROJECT_DIR="/opt/jh-craftsys/source/backend"
SERVICE_NAME="jiuhuan-backend.service"
SYSTEMD_DIR="/etc/systemd/system"
if [ "$EUID" -ne 0 ]; then 
    echo "❌ 错误: 请使用 sudo 运行此脚本"
    exit 1
fi
echo "📁 步骤 1: 检查项目目录..."
if [ ! -d "$PROJECT_DIR" ]; then
    echo "❌ 错误: 项目目录不存在: $PROJECT_DIR"
    exit 1
fi
echo "✅ 项目目录存在: $PROJECT_DIR"
echo ""
echo "🔍 步骤 2: 检查 Node.js..."
NODE_PATH=$(which node 2>/dev/null || echo "")
if [ -z "$NODE_PATH" ]; then
    echo "❌ 错误: 未找到 Node.js，请先安装 Node.js"
    exit 1
fi
echo "✅ Node.js 路径: $NODE_PATH"
echo ""
echo "📄 步骤 3: 检查服务文件..."
SERVICE_FILE="$PROJECT_DIR/$SERVICE_NAME"
if [ ! -f "$SERVICE_FILE" ]; then
    echo "❌ 错误: 服务文件不存在: $SERVICE_FILE"
    exit 1
fi
echo "✅ 服务文件存在: $SERVICE_FILE"
echo ""
echo "⚙️  步骤 4: 更新服务文件配置..."
sed -i "s|ExecStart=.*node|ExecStart=$NODE_PATH|g" "$SERVICE_FILE"
echo "✅ 已更新 Node.js 路径为: $NODE_PATH"
echo ""
echo "📋 步骤 5: 复制服务文件到 systemd 目录..."
cp "$SERVICE_FILE" "$SYSTEMD_DIR/$SERVICE_NAME"
echo "✅ 服务文件已复制到: $SYSTEMD_DIR/$SERVICE_NAME"
echo ""
echo "🔄 步骤 6: 重新加载 systemd 配置..."
systemctl daemon-reload
echo "✅ systemd 配置已重新加载"
echo ""
echo "🔌 步骤 7: 启用服务（开机自启）..."
systemctl enable "$SERVICE_NAME"
echo "✅ 服务已启用（开机自启）"
echo ""
echo "🛑 步骤 8: 检查并重启服务..."
if systemctl is-active --quiet "$SERVICE_NAME"; then
    echo "服务正在运行，先停止..."
    systemctl stop "$SERVICE_NAME"
fi
echo "启动服务..."
systemctl start "$SERVICE_NAME"
sleep 2
if systemctl is-active --quiet "$SERVICE_NAME"; then
    echo "✅ 服务启动成功"
else
    echo "❌ 服务启动失败，查看日志:"
    journalctl -u "$SERVICE_NAME" -n 20 --no-pager
    exit 1
fi
echo ""
echo "📊 步骤 9: 服务状态..."
systemctl status "$SERVICE_NAME" --no-pager -l
echo ""
echo "🔍 步骤 10: 验证环境变量..."
ENV_VARS=$(systemctl show "$SERVICE_NAME" | grep -E "^Environment=")
echo "$ENV_VARS"
if echo "$ENV_VARS" | grep -q "NODE_ENV=production"; then
    echo "✅ NODE_ENV=production 已设置"
else
    echo "⚠️  警告: NODE_ENV 未正确设置"
fi
echo ""
echo "🌐 步骤 11: 测试 API 接口..."
sleep 1
if curl -s -f http://localhost:3001/health > /dev/null 2>&1; then
    echo "✅ API 接口可访问: http://localhost:3001/health"
elif curl -s -f http://localhost:3001/api/auth/login > /dev/null 2>&1; then
    echo "✅ API 接口可访问: http://localhost:3001/api/auth/login"
else
    echo "⚠️  警告: API 接口可能无法访问，请检查服务日志"
fi
echo ""
echo "=========================================="
echo "✅ 配置完成！"
echo "=========================================="
echo ""
echo "常用管理命令："
echo "  查看状态: sudo systemctl status $SERVICE_NAME"
echo "  查看日志: sudo journalctl -u $SERVICE_NAME -f"
echo "  重启服务: sudo systemctl restart $SERVICE_NAME"
echo ""
echo "服务将在服务器重启后自动启动！"
echo ""
EOFSCRIPT
    echo "✅ 配置脚本已创建"
fi

# 设置脚本执行权限（只对 .sh 文件设置）
chmod +x setup-systemd.sh
echo "✅ 已设置 setup-systemd.sh 执行权限"

# 显示文件列表
echo ""
echo "当前目录文件："
ls -lh *.service *.sh 2>/dev/null || echo "文件列表："
ls -lh jiuhuan-backend.service setup-systemd.sh 2>/dev/null

echo ""
echo "=========================================="
echo "✅ 文件准备完成！"
echo "=========================================="
echo ""
echo "下一步：执行配置脚本（需要 sudo 权限）"
echo "  sudo bash setup-systemd.sh"
echo ""
echo "注意：jiuhuan-backend.service 是配置文件，不需要执行权限"
echo "     只有 setup-systemd.sh 脚本需要执行权限"
echo ""

