#!/bin/bash

# 九环后端服务启动脚本

echo "正在启动九环后端服务..."

# 检查是否安装了Node.js
if ! command -v node &> /dev/null; then
    echo "错误: 未安装Node.js，请先安装Node.js"
    exit 1
fi

# 检查是否安装了npm
if ! command -v npm &> /dev/null; then
    echo "错误: 未安装npm，请先安装npm"
    exit 1
fi

# 安装依赖
echo "正在安装依赖..."
npm install

# 检查配置文件
if [ ! -f "config.js" ]; then
    echo "警告: 未找到config.js文件，请复制config.example.js为config.js并配置数据库连接信息"
    echo "cp config.example.js config.js"
fi

# 启动服务
echo "正在启动服务..."
npm start
