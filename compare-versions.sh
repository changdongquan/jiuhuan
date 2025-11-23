#!/usr/bin/env bash

set -euo pipefail

# =========================
# 三地代码版本对比脚本
# =========================

echo "=========================================="
echo "    三地代码版本对比"
echo "=========================================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 获取本机版本信息
echo -e "${BLUE}1. 本机代码版本${NC}"
echo "----------------------------------------"
cd "$(dirname "$0")"
LOCAL_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "N/A")
LOCAL_BRANCH=$(git branch --show-current 2>/dev/null || echo "N/A")
LOCAL_MESSAGE=$(git log -1 --pretty=format:"%s" 2>/dev/null || echo "N/A")
LOCAL_DATE=$(git log -1 --pretty=format:"%ar" 2>/dev/null || echo "N/A")
LOCAL_TAG=$(git describe --tags --exact-match HEAD 2>/dev/null || echo "no-tag")

echo "  分支: $LOCAL_BRANCH"
echo "  提交: $LOCAL_COMMIT"
echo "  标签: $LOCAL_TAG"
echo "  信息: $LOCAL_MESSAGE"
echo "  时间: $LOCAL_DATE"
echo ""

# 获取 Gitee 仓库版本信息
echo -e "${BLUE}2. Gitee 仓库版本${NC}"
echo "----------------------------------------"
git fetch gitee >/dev/null 2>&1 || true
GITEE_COMMIT=$(git rev-parse --short gitee/main 2>/dev/null || echo "N/A")
GITEE_MESSAGE=$(git log -1 --pretty=format:"%s" gitee/main 2>/dev/null || echo "N/A")
GITEE_DATE=$(git log -1 --pretty=format:"%ar" gitee/main 2>/dev/null || echo "N/A")
GITEE_TAG=$(git describe --tags --exact-match gitee/main 2>/dev/null || echo "no-tag")

echo "  提交: $GITEE_COMMIT"
echo "  标签: $GITEE_TAG"
echo "  信息: $GITEE_MESSAGE"
echo "  时间: $GITEE_DATE"
echo ""

# 比较本机和 Gitee
echo -e "${BLUE}3. 本机 vs Gitee 差异${NC}"
echo "----------------------------------------"
LOCAL_AHEAD=$(git rev-list --count HEAD..gitee/main 2>/dev/null || echo "0")
GITEE_AHEAD=$(git rev-list --count gitee/main..HEAD 2>/dev/null || echo "0")

if [ "$LOCAL_COMMIT" = "$GITEE_COMMIT" ]; then
  echo -e "  ${GREEN}✓ 版本一致${NC}"
elif [ "$LOCAL_AHEAD" -gt 0 ]; then
  echo -e "  ${YELLOW}⚠ 本机落后 Gitee $LOCAL_AHEAD 个提交${NC}"
  echo ""
  echo "  Gitee 有但本机缺失的提交："
  git log HEAD..gitee/main --oneline --no-decorate 2>/dev/null | head -5 | sed 's/^/    /'
  [ "$LOCAL_AHEAD" -gt 5 ] && echo "    ... (还有 $((LOCAL_AHEAD - 5)) 个)"
elif [ "$GITEE_AHEAD" -gt 0 ]; then
  echo -e "  ${YELLOW}⚠ 本机领先 Gitee $GITEE_AHEAD 个提交${NC}"
  echo ""
  echo "  本机有但 Gitee 缺失的提交："
  git log gitee/main..HEAD --oneline --no-decorate 2>/dev/null | head -5 | sed 's/^/    /'
  [ "$GITEE_AHEAD" -gt 5 ] && echo "    ... (还有 $((GITEE_AHEAD - 5)) 个)"
fi
echo ""

# 服务端版本（需要 SSH 连接）
echo -e "${BLUE}4. 服务端代码版本${NC}"
echo "----------------------------------------"

# 检查是否有服务器连接配置
# 默认服务器配置（可通过环境变量覆盖）
SERVER_PATH="/opt/jh-craftsys/source"
SSH_HOST="${SSH_HOST:-jiuhuan.net}"
SSH_USER="${SSH_USER:-changyun}"
SSH_PORT="${SSH_PORT:-222}"
SSH_PASSWORD="${SSH_PASSWORD:-Chang902}"  # 默认密码（可通过环境变量覆盖）
USE_SSHPASS="${USE_SSHPASS:-false}"

# 检查是否安装了 sshpass
if command -v sshpass >/dev/null 2>&1 && [ -n "$SSH_PASSWORD" ]; then
  USE_SSHPASS=true
  SSH_CMD="sshpass -p '$SSH_PASSWORD' ssh -p $SSH_PORT -o StrictHostKeyChecking=no"
elif command -v sshpass >/dev/null 2>&1; then
  USE_SSHPASS=true
  SSH_CMD="sshpass -p '${SSH_PASSWORD:-}' ssh -p $SSH_PORT -o StrictHostKeyChecking=no"
else
  SSH_CMD="ssh"
fi

if [ -n "$SSH_HOST" ] && [ -n "$SSH_USER" ]; then
  echo "  正在连接服务器: $SSH_USER@$SSH_HOST:$SSH_PORT"
  echo ""
  
  if [ "$USE_SSHPASS" = "true" ] && [ -n "$SSH_PASSWORD" ]; then
    SERVER_COMMIT=$(eval "$SSH_CMD $SSH_USER@$SSH_HOST 'cd $SERVER_PATH && git rev-parse --short HEAD 2>/dev/null || echo N/A'" 2>/dev/null || echo "连接失败")
    SERVER_MESSAGE=$(eval "$SSH_CMD $SSH_USER@$SSH_HOST 'cd $SERVER_PATH && git log -1 --pretty=format:\"%s\" 2>/dev/null || echo N/A'" 2>/dev/null || echo "N/A")
    SERVER_DATE=$(eval "$SSH_CMD $SSH_USER@$SSH_HOST 'cd $SERVER_PATH && git log -1 --pretty=format:\"%ar\" 2>/dev/null || echo N/A'" 2>/dev/null || echo "N/A")
    SERVER_TAG=$(eval "$SSH_CMD $SSH_USER@$SSH_HOST 'cd $SERVER_PATH && git describe --tags --exact-match HEAD 2>/dev/null || echo no-tag'" 2>/dev/null || echo "no-tag")
  else
    SERVER_COMMIT=$(ssh -p "$SSH_PORT" "$SSH_USER@$SSH_HOST" "cd $SERVER_PATH && git rev-parse --short HEAD 2>/dev/null || echo 'N/A'" 2>/dev/null || echo "连接失败")
    SERVER_MESSAGE=$(ssh -p "$SSH_PORT" "$SSH_USER@$SSH_HOST" "cd $SERVER_PATH && git log -1 --pretty=format:'%s' 2>/dev/null || echo 'N/A'" 2>/dev/null || echo "N/A")
    SERVER_DATE=$(ssh -p "$SSH_PORT" "$SSH_USER@$SSH_HOST" "cd $SERVER_PATH && git log -1 --pretty=format:'%ar' 2>/dev/null || echo 'N/A'" 2>/dev/null || echo "N/A")
    SERVER_TAG=$(ssh -p "$SSH_PORT" "$SSH_USER@$SSH_HOST" "cd $SERVER_PATH && git describe --tags --exact-match HEAD 2>/dev/null || echo 'no-tag'" 2>/dev/null || echo "no-tag")
  fi
  
  echo "  提交: $SERVER_COMMIT"
  echo "  标签: $SERVER_TAG"
  echo "  信息: $SERVER_MESSAGE"
  echo "  时间: $SERVER_DATE"
  echo ""
  
  # 比较服务端和 Gitee
  if [ "$SERVER_COMMIT" != "连接失败" ] && [ "$SERVER_COMMIT" != "N/A" ]; then
    echo -e "${BLUE}5. 服务端 vs Gitee 差异${NC}"
    echo "----------------------------------------"
    if [ "$USE_SSHPASS" = "true" ] && [ -n "$SSH_PASSWORD" ]; then
      eval "$SSH_CMD $SSH_USER@$SSH_HOST 'cd $SERVER_PATH && git fetch gitee >/dev/null 2>&1 || true'" 2>/dev/null || true
      SERVER_AHEAD=$(eval "$SSH_CMD $SSH_USER@$SSH_HOST 'cd $SERVER_PATH && git rev-list --count HEAD..gitee/main 2>/dev/null || echo 0'" 2>/dev/null || echo "0")
      GITEE_AHEAD_SERVER=$(eval "$SSH_CMD $SSH_USER@$SSH_HOST 'cd $SERVER_PATH && git rev-list --count gitee/main..HEAD 2>/dev/null || echo 0'" 2>/dev/null || echo "0")
    else
      ssh -p "$SSH_PORT" "$SSH_USER@$SSH_HOST" "cd $SERVER_PATH && git fetch gitee >/dev/null 2>&1 || true" 2>/dev/null || true
      SERVER_AHEAD=$(ssh -p "$SSH_PORT" "$SSH_USER@$SSH_HOST" "cd $SERVER_PATH && git rev-list --count HEAD..gitee/main 2>/dev/null || echo '0'" 2>/dev/null || echo "0")
      GITEE_AHEAD_SERVER=$(ssh -p "$SSH_PORT" "$SSH_USER@$SSH_HOST" "cd $SERVER_PATH && git rev-list --count gitee/main..HEAD 2>/dev/null || echo '0'" 2>/dev/null || echo "0")
    fi
    
    if [ "$SERVER_COMMIT" = "$GITEE_COMMIT" ]; then
      echo -e "  ${GREEN}✓ 版本一致${NC}"
    elif [ "$SERVER_AHEAD" != "0" ] && [ "$SERVER_AHEAD" != "连接失败" ]; then
      echo -e "  ${YELLOW}⚠ 服务端落后 Gitee $SERVER_AHEAD 个提交${NC}"
    elif [ "$GITEE_AHEAD_SERVER" != "0" ] && [ "$GITEE_AHEAD_SERVER" != "连接失败" ]; then
      echo -e "  ${YELLOW}⚠ 服务端领先 Gitee $GITEE_AHEAD_SERVER 个提交${NC}"
    fi
    echo ""
  fi
else
  echo "  ${YELLOW}需要 SSH 连接信息${NC}"
  echo ""
  echo "  使用方法（支持 sshpass）："
  echo "    # 方式1：使用环境变量（推荐）"
  echo "    export SSH_HOST='jiuhuan.net'"
  echo "    export SSH_USER='changyun'"
  echo "    export SSH_PORT='222'"
  echo "    export SSH_PASSWORD='your-password'"
  echo "    $0"
  echo ""
  echo "    # 方式2：使用 SSH 密钥（无需密码）"
  echo "    export SSH_HOST='jiuhuan.net'"
  echo "    export SSH_USER='changyun'"
  echo "    export SSH_PORT='222'"
  echo "    $0"
  echo ""
  echo "  默认配置（可在脚本中修改）："
  echo "    SSH_HOST=jiuhuan.net"
  echo "    SSH_USER=changyun"
  echo "    SSH_PORT=222"
  echo ""
  echo "  或者手动检查服务端版本："
  echo "    sshpass -p 'password' ssh -p 222 user@server 'cd /opt/jh-craftsys/source && git log -1 --oneline'"
  echo ""
fi

# 总结
echo "=========================================="
echo -e "${BLUE}版本对比总结${NC}"
echo "=========================================="
echo ""

# 创建对比表格
printf "%-15s %-10s %-20s %-15s\n" "位置" "提交" "标签" "状态"
printf "%-15s %-10s %-20s %-15s\n" "-------------" "----------" "--------------------" "---------------"
printf "%-15s %-10s %-20s %-15s\n" "本机" "$LOCAL_COMMIT" "$LOCAL_TAG" "$([ "$LOCAL_COMMIT" = "$GITEE_COMMIT" ] && echo -e "${GREEN}同步${NC}" || echo -e "${YELLOW}不同步${NC}")"
printf "%-15s %-10s %-20s %-15s\n" "Gitee" "$GITEE_COMMIT" "$GITEE_TAG" "-"
if [ -n "${SERVER_COMMIT:-}" ] && [ "$SERVER_COMMIT" != "连接失败" ] && [ "$SERVER_COMMIT" != "N/A" ]; then
  printf "%-15s %-10s %-20s %-15s\n" "服务端" "$SERVER_COMMIT" "$SERVER_TAG" "$([ "$SERVER_COMMIT" = "$GITEE_COMMIT" ] && echo -e "${GREEN}同步${NC}" || echo -e "${YELLOW}不同步${NC}")"
fi
echo ""

echo "=========================================="

