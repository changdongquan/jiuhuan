#!/bin/bash

# 九环系统启动脚本

echo "=== 九环系统启动脚本 ==="
echo ""

# 检查Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未安装Node.js，请先安装Node.js"
    exit 1
fi

echo "✅ Node.js 已安装: $(node --version)"

# 启动后端服务
echo ""
echo "🚀 启动后端服务..."
cd packages/backend

# 检查是否已安装依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装后端依赖..."
    npm install
fi

# 启动后端服务（后台运行）
echo "🔄 启动后端服务..."
npm start &
BACKEND_PID=$!

# 等待后端服务启动
echo "⏳ 等待后端服务启动..."
sleep 5

# 检查后端服务是否启动成功
if curl -s http://localhost:3001/health > /dev/null; then
    echo "✅ 后端服务启动成功"
else
    echo "❌ 后端服务启动失败"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

# 返回项目根目录
cd ../..

# 启动前端服务
echo ""
echo "🚀 启动前端服务..."
echo "📦 检查前端依赖..."

cd packages/frontend
if [ ! -d "node_modules" ]; then
    echo "📦 安装前端依赖..."
    pnpm install
fi

echo "🔄 启动前端服务..."
echo ""
echo "=== 服务启动完成 ==="
echo "后端服务: http://localhost:3001"
echo "前端服务: http://localhost:4000"
echo "健康检查: http://localhost:3001/health"
echo ""
echo "按 Ctrl+C 停止所有服务"

# 启动前端服务
pnpm run dev

# 清理函数
cleanup() {
    echo ""
    echo "🛑 正在停止服务..."
    kill $BACKEND_PID 2>/dev/null
    exit 0
}

# 捕获中断信号
trap cleanup SIGINT SIGTERM
