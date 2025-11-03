#!/usr/bin/env bash

set -euo pipefail

# =========================
# 0) 目录就绪
# =========================

sudo mkdir -p /opt/deploy/jh-craftsys/{bin,conf,templates,logs}

sudo mkdir -p /opt/jh-craftsys/{source,releases,logs,runtime}

sudo chown -R "$USER":"$USER" /opt/deploy/jh-craftsys /opt/jh-craftsys

# =========================
# 1) 配置文件
# =========================

cat >/opt/deploy/jh-craftsys/conf/deploy.env <<'EOF'

# === 全局部署参数（只改这里，无需改脚本） ===

APP_ROOT="/opt/jh-craftsys"

SRC_DIR="$APP_ROOT/source"

REL_DIR="$APP_ROOT/releases"

CUR_LINK="$APP_ROOT/current"

LOG_DIR="$APP_ROOT/logs"

RUNTIME_DIR="$APP_ROOT/runtime"

# 仓库（HTTPS）

REPO_URL="https://gitee.com/changdongquan/jiuhuan.git"

# 代理（混合），部署期启用，结束关闭

PROXY_HOST="10.0.0.235"

PROXY_PORT="7890"

# 后端/网关

API_PORT="3001"

PM2_APP_NAME="jh-craftsys-api"

SITE_NAME="jh-craftsys"

# 前端构建

MAX_OLD_SPACE="6144"   # 6G

SWAP_SIZE_GB="6"       # 物理内存不足时创建的 swap 大小（GB）

DIST_DIR=""            # 留空=自动识别；若你想固定，可填 "dist-pro" / "dist"

# 内网访问 IP（仅提示）

INTRANET_IP="10.0.0.248"

EOF

cat >/opt/deploy/jh-craftsys/conf/backend.env <<'EOF'

DB_SERVER=10.0.0.8

DB_PORT=1433

DB_USERNAME=sa

DB_PASSWORD=Chang902

DB_DATABASE=jiuhuanDB

EOF

chmod 600 /opt/deploy/jh-craftsys/conf/backend.env

# =========================
# 2) Nginx 模板
# =========================

cat >/opt/deploy/jh-craftsys/templates/nginx_site.conf.tmpl <<'EOF'

server {

    listen 80;

    server_name _;

    # 前端根目录（软链 current 指向最新 releases/<TS>）

    root {{CUR_LINK}}/frontend;

    index index.html;

    # SPA 路由

    location / {

        try_files $uri $uri/ /index.html;

        access_log /var/log/nginx/{{SITE_NAME}}_access.log;

        error_log  /var/log/nginx/{{SITE_NAME}}_error.log;

    }

    # 后端 API 反代

    location /api {

        proxy_pass         http://127.0.0.1:{{API_PORT}};

        proxy_http_version 1.1;

        proxy_set_header   Upgrade $http_upgrade;

        proxy_set_header   Connection "upgrade";

        proxy_set_header   Host $host;

        proxy_set_header   X-Real-IP $remote_addr;

        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;

        proxy_set_header   X-Forwarded-Proto $scheme;

        proxy_read_timeout 120s;

        proxy_connect_timeout 10s;

    }

    # 静态资源缓存策略

    location ~* \.(?:js|css|png|jpg|jpeg|gif|svg|ico|woff2?)$ {

        expires 7d;

        add_header Cache-Control "public, max-age=604800, immutable";

    }

}

EOF

# =========================
# 3) 脚本生成（全部覆盖为最新版）
# =========================

# 00 代理开启

cat >/opt/deploy/jh-craftsys/bin/00_proxy_on.sh <<'EOF'

#!/usr/bin/env bash

set -euo pipefail

. /opt/deploy/jh-craftsys/conf/deploy.env

HTTP_PROXY_URL="http://${PROXY_HOST}:${PROXY_PORT}"

HTTPS_PROXY_URL="http://${PROXY_HOST}:${PROXY_PORT}"

ALL_PROXY_URL="socks5h://${PROXY_HOST}:${PROXY_PORT}"

echo "==> 开启临时全局代理 ${PROXY_HOST}:${PROXY_PORT}"

export http_proxy="$HTTP_PROXY_URL"

export https_proxy="$HTTPS_PROXY_URL"

export all_proxy="$ALL_PROXY_URL"

export HTTP_PROXY="$HTTP_PROXY_URL"

export HTTPS_PROXY="$HTTPS_PROXY_URL"

export ALL_PROXY="$ALL_PROXY_URL"

sudo sed -i '/http_proxy\|https_proxy\|all_proxy\|HTTP_PROXY\|HTTPS_PROXY\|ALL_PROXY/d' /etc/environment || true

{

  echo "http_proxy=$HTTP_PROXY_URL"

  echo "https_proxy=$HTTPS_PROXY_URL"

  echo "all_proxy=$ALL_PROXY_URL"

  echo "HTTP_PROXY=$HTTP_PROXY_URL"

  echo "HTTPS_PROXY=$HTTPS_PROXY_URL"

  echo "ALL_PROXY=$ALL_PROXY_URL"

} | sudo tee -a /etc/environment >/dev/null

sudo mkdir -p /etc/apt/apt.conf.d

cat <<APT | sudo tee /etc/apt/apt.conf.d/01proxy >/dev/null

Acquire::http::Proxy "$HTTP_PROXY_URL";

Acquire::https::Proxy "$HTTPS_PROXY_URL";

APT

git config --global http.proxy  "$HTTP_PROXY_URL" || true

git config --global https.proxy "$HTTPS_PROXY_URL" || true

npm  config set proxy "$HTTP_PROXY_URL"         || true

npm  config set https-proxy "$HTTPS_PROXY_URL"  || true

npm  config set strict-ssl false                || true

pnpm config set proxy "$HTTP_PROXY_URL"         || true

pnpm config set https-proxy "$HTTPS_PROXY_URL"  || true

EOF

# 10 代理关闭

cat >/opt/deploy/jh-craftsys/bin/10_proxy_off.sh <<'EOF'

#!/usr/bin/env bash

set -euo pipefail

echo "==> 关闭/清理全局代理"

unset http_proxy https_proxy all_proxy HTTP_PROXY HTTPS_PROXY ALL_PROXY || true

sudo sed -i '/http_proxy\|https_proxy\|all_proxy\|HTTP_PROXY\|HTTPS_PROXY\|ALL_PROXY/d' /etc/environment || true

sudo rm -f /etc/apt/apt.conf.d/01proxy || true

git config --global --unset http.proxy  || true

git config --global --unset https.proxy || true

npm  config delete proxy       || true

npm  config delete https-proxy || true

pnpm config delete proxy       || true

pnpm config delete https-proxy || true

EOF

# 01 安装依赖

cat >/opt/deploy/jh-craftsys/bin/01_install_prereqs.sh <<'EOF'

#!/usr/bin/env bash

set -euo pipefail

echo "==> 更新 apt & 安装系统依赖"

sudo apt-get update -y

sudo apt-get install -y \

  curl wget git ca-certificates software-properties-common \

  build-essential python3 make g++ zip unzip \

  nginx

echo "==> 安装 Node.js 20 LTS"

curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

sudo apt-get install -y nodejs

echo "==> 启用 corepack & 安装 pnpm 9"

sudo corepack enable

sudo corepack prepare pnpm@9 --activate

echo "==> 安装 pm2（全局）"

sudo npm i -g pm2

EOF

# 02 拉取/更新仓库（支持版本选择）

cat >/opt/deploy/jh-craftsys/bin/02_checkout_or_update.sh <<'EOF'

#!/usr/bin/env bash

set -euo pipefail

. /opt/deploy/jh-craftsys/conf/deploy.env

# 版本参数：支持 tag、commit hash 或分支名
TARGET_VERSION="${1:-latest}"

mkdir -p "$SRC_DIR"

if [ -d "$SRC_DIR/.git" ]; then

  echo "==> 更新仓库：$REPO_URL"

  cd "$SRC_DIR"

  git remote set-url origin "$REPO_URL" || true

  git fetch --all --prune --tags

  git rev-parse --verify origin/main >/dev/null 2>&1 && MAIN="main" || MAIN="master"

  

  if [ "$TARGET_VERSION" = "latest" ]; then

    echo "==> 切换到最新版本：origin/$MAIN"

    git reset --hard "origin/$MAIN"

  else

    echo "==> 切换到指定版本：$TARGET_VERSION"

    # 尝试作为 tag 检出

    if git rev-parse --verify "refs/tags/$TARGET_VERSION" >/dev/null 2>&1; then

      git checkout "$TARGET_VERSION"

      echo "==> 已检出 tag: $TARGET_VERSION"

    # 尝试作为远程分支检出

    elif git rev-parse --verify "origin/$TARGET_VERSION" >/dev/null 2>&1; then

      git reset --hard "origin/$TARGET_VERSION"

      echo "==> 已检出分支: $TARGET_VERSION"

    # 尝试作为 commit hash 检出

    elif git rev-parse --verify "$TARGET_VERSION" >/dev/null 2>&1; then

      git checkout "$TARGET_VERSION"

      echo "==> 已检出 commit: $TARGET_VERSION"

    else

      echo "ERROR: 未找到版本 '$TARGET_VERSION'（tag、分支或 commit）"

      echo "提示：运行 'git tag' 查看可用标签，或运行 'git log --oneline -20' 查看最近提交"

      exit 1

    fi

  fi

else

  echo "==> 克隆仓库到：$SRC_DIR"

  git clone "$REPO_URL" "$SRC_DIR"

  cd "$SRC_DIR"

  git fetch --all --prune --tags

  

  if [ "$TARGET_VERSION" != "latest" ]; then

    if git rev-parse --verify "refs/tags/$TARGET_VERSION" >/dev/null 2>&1; then

      git checkout "$TARGET_VERSION"

    elif git rev-parse --verify "origin/$TARGET_VERSION" >/dev/null 2>&1; then

      git checkout -b "$TARGET_VERSION" "origin/$TARGET_VERSION"

    elif git rev-parse --verify "$TARGET_VERSION" >/dev/null 2>&1; then

      git checkout "$TARGET_VERSION"

    else

      echo "WARN: 版本 '$TARGET_VERSION' 不存在，将使用默认分支"

    fi

  fi

fi

git rev-parse HEAD > /opt/deploy/jh-craftsys/logs/last_commit.txt

echo "==> 当前版本：$(git rev-parse --short HEAD) ($(git describe --tags --always 2>/dev/null || echo 'no-tag'))"

EOF

# 列出可用版本

cat >/opt/deploy/jh-craftsys/bin/list_versions.sh <<'EOF'

#!/usr/bin/env bash

set -euo pipefail

. /opt/deploy/jh-craftsys/conf/deploy.env

echo "==> 可用版本列表"

echo ""

echo "--- Git Tags（推荐使用标签） ---"

if [ -d "$SRC_DIR/.git" ]; then

  cd "$SRC_DIR"

  git fetch --all --prune --tags >/dev/null 2>&1 || true

  git tag -l --sort=-version:refname | head -20 | nl

else

  echo "仓库未克隆，无法列出标签"

fi

echo ""

echo "--- 最近提交（前20条） ---"

if [ -d "$SRC_DIR/.git" ]; then

  cd "$SRC_DIR"

  git log --oneline --decorate -20 | nl

else

  echo "仓库未克隆，无法列出提交"

fi

echo ""

echo "--- 远程分支 ---"

if [ -d "$SRC_DIR/.git" ]; then

  cd "$SRC_DIR"

  git branch -r | grep -v HEAD | sed 's/origin\///' | nl

else

  echo "仓库未克隆，无法列出分支"

fi

echo ""

echo "提示：使用特定版本升级：sudo /opt/deploy/jh-craftsys/bin/update.sh <tag|commit|branch>"

echo "     例如：sudo /opt/deploy/jh-craftsys/bin/update.sh v1.0.0"

EOF

# 03 写后端 env

cat >/opt/deploy/jh-craftsys/bin/03_backend_env_write.sh <<'EOF'

#!/usr/bin/env bash

set -euo pipefail

. /opt/deploy/jh-craftsys/conf/deploy.env

set -a

. /opt/deploy/jh-craftsys/conf/backend.env

set +a

mkdir -p "$SRC_DIR/backend"

cat > "$SRC_DIR/backend/.env" <<ENV

DB_SERVER=${DB_SERVER}

DB_PORT=${DB_PORT}

DB_USERNAME=${DB_USERNAME}

DB_PASSWORD=${DB_PASSWORD}

DB_DATABASE=${DB_DATABASE}

ENV

echo "==> 已写入 $SRC_DIR/backend/.env"

EOF

# 04 安装后端依赖

cat >/opt/deploy/jh-craftsys/bin/04_install_backend_deps.sh <<'EOF'

#!/usr/bin/env bash

set -euo pipefail

. /opt/deploy/jh-craftsys/conf/deploy.env

cd "$SRC_DIR/backend"

echo "==> 安装后端依赖（优先 npm ci）"

export npm_config_audit=false

export npm_config_engine_strict=false

if [ -f package-lock.json ]; then

  npm ci || npm i

else

  npm i

fi

EOF

# 05 前端依赖 + 6G 构建（最新版：自动识别构建脚本 & 产物目录）

cat >/opt/deploy/jh-craftsys/bin/05_install_frontend_deps_build.sh <<'EOF'

#!/usr/bin/env bash

set -euo pipefail

. /opt/deploy/jh-craftsys/conf/deploy.env

echo "==> 安装前端依赖（pnpm）"

cd "$SRC_DIR"

pnpm install --frozen-lockfile || pnpm install

echo "==> 检查内存/交换分区"

MEM_GB=$(( $(grep MemTotal /proc/meminfo | awk '{print $2}') / 1024 / 1024 ))

SWAP_KB=$(grep SwapTotal /proc/meminfo | awk '{print $2}')

NEED_MB=${MAX_OLD_SPACE}

NEED_GB=$(( (NEED_MB + 1023) / 1024 ))

if [ "$MEM_GB" -lt "$NEED_GB" ] && [ "$SWAP_KB" -lt $(( SWAP_SIZE_GB * 1024 * 1024 )) ]; then

  echo "==> 物理内存 ${MEM_GB}G < 需 ${NEED_GB}G，创建 ${SWAP_SIZE_GB}G swap"

  sudo fallocate -l ${SWAP_SIZE_GB}G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1G count=${SWAP_SIZE_GB}

  sudo chmod 600 /swapfile

  sudo mkswap /swapfile

  sudo swapon /swapfile

  grep -q "^/swapfile" /etc/fstab || echo "/swapfile swap swap defaults 0 0" | sudo tee -a /etc/fstab >/dev/null

else

  echo "==> 内存/交换分区充足，跳过创建 swap"

fi

echo "==> 识别构建脚本名"

SCRIPTS_JSON=$(node -e 'try{console.log(JSON.stringify(require("./package.json").scripts||{}))}catch(e){console.log("{}")}')

has_script() { node -e "const s=$SCRIPTS_JSON;process.exit(s['$1']?0:1)"; }

BUILD_CMD=""

for name in build build:pro build:prod build:release; do

  if has_script "$name"; then BUILD_CMD="$name"; break; fi

done

[ -n "$BUILD_CMD" ] || { echo "ERROR: 未找到构建脚本（尝试了 build / build:pro / build:prod / build:release）"; exit 1; }

echo "==> 使用脚本：pnpm run $BUILD_CMD（内存 ${MAX_OLD_SPACE}MB）"

export NODE_OPTIONS="--max-old-space-size=${MAX_OLD_SPACE}"

pnpm run "$BUILD_CMD"

unset NODE_OPTIONS

echo "==> 定位构建产物目录"

CANDIDATES=()

[ -n "${DIST_DIR:-}" ] && CANDIDATES+=("$DIST_DIR")

CANDIDATES+=("dist-pro" "dist" "build" "frontend/dist")

OUT_DIR=""

for d in "${CANDIDATES[@]}"; do

  if [ -d "$SRC_DIR/$d" ]; then OUT_DIR="$SRC_DIR/$d"; break; fi

done

[ -n "$OUT_DIR" ] || { echo "ERROR: 未找到构建产物目录。尝试过：${CANDIDATES[*]}"; exit 1; }

echo "==> 发现产物目录：$OUT_DIR"

TS=$(date +%Y%m%d-%H%M%S)

TARGET="$REL_DIR/$TS/frontend"

mkdir -p "$TARGET"

rsync -a --delete "$OUT_DIR/" "$TARGET/"

echo "$TS" > "$REL_DIR/.last_build"

echo "==> 构建产物已发布：$TARGET"

EOF

# 06 Nginx 配置（最新版：default_server + 禁用默认站点）

cat >/opt/deploy/jh-craftsys/bin/06_nginx_setup.sh <<'EOF'

#!/usr/bin/env bash

set -euo pipefail

. /opt/deploy/jh-craftsys/conf/deploy.env

SITE_FILE="/etc/nginx/sites-available/${SITE_NAME}"

ENABLED_LINK="/etc/nginx/sites-enabled/${SITE_NAME}"

echo "==> 写入 Nginx 站点：$SITE_FILE"

sudo bash -c "sed -e 's#{{CUR_LINK}}#'"$CUR_LINK"'#g' \

                  -e 's#{{SITE_NAME}}#'"$SITE_NAME"'#g' \

                  -e 's#{{API_PORT}}#'"$API_PORT"'#g' \

  /opt/deploy/jh-craftsys/templates/nginx_site.conf.tmpl > \"$SITE_FILE\""

# 设置为默认站点，避免与其它 server_name "_" 冲突

sudo sed -i 's/^ *listen 80;$/    listen 80 default_server;/' "$SITE_FILE"

# 禁用系统默认站点，消除冲突

sudo rm -f /etc/nginx/sites-enabled/default || true

sudo ln -sf "$SITE_FILE" "$ENABLED_LINK"

sudo nginx -t

sudo systemctl enable nginx

sudo systemctl reload nginx

echo "==> Nginx 已启用站点（default_server）：$SITE_NAME"

EOF

# 07 PM2 后端（最新版：不再 eval，去掉 $: command not found）

cat >/opt/deploy/jh-craftsys/bin/07_pm2_bootstrap.sh <<'EOF'

#!/usr/bin/env bash

set -euo pipefail

. /opt/deploy/jh-craftsys/conf/deploy.env

echo "==> 启动/守护后端（PM2）"

cd "$SRC_DIR"

pm2 delete "$PM2_APP_NAME" >/dev/null 2>&1 || true

pm2 start "$SRC_DIR/backend/server.js" --name "$PM2_APP_NAME" --cwd "$SRC_DIR/backend" --time

pm2 save

# 直接调用，不 eval 返回字符串，避免 '$: command not found'

pm2 startup systemd -u "$USER" --hp "$HOME" >/dev/null 2>&1 || true

mkdir -p "$LOG_DIR/pm2"

echo "==> PM2 已启动：$PM2_APP_NAME"

EOF

# 08 切换与冒烟

cat >/opt/deploy/jh-craftsys/bin/08_deploy_switch_and_smoke.sh <<'EOF'

#!/usr/bin/env bash

set -euo pipefail

. /opt/deploy/jh-craftsys/conf/deploy.env

echo "==> 原子切换 current → 最新构建"

LAST=$(cat "$REL_DIR/.last_build" 2>/dev/null || true)

if [ -z "$LAST" ] || [ ! -d "$REL_DIR/$LAST/frontend" ]; then

  LAST=$(ls -1 "$REL_DIR" | grep -E '^[0-9]{8}-[0-9]{6}$' | sort -r | head -n1)

fi

[ -n "$LAST" ] || { echo "ERROR: 未找到可用版本"; exit 1; }

ln -sfn "$REL_DIR/$LAST" "$CUR_LINK"

echo "==> 已切换到版本：$LAST"

echo "==> 冒烟测试"

set +e

curl -sSf "http://127.0.0.1" >/dev/null && echo "[OK] 静态站点可访问" || echo "[WARN] 静态站点访问异常"

curl -sSf "http://127.0.0.1/api/health" >/dev/null && echo "[OK] API /api/health 正常" || echo "[INFO] 若未实现 /api/health 可忽略"

set -e

echo "==> 访问地址（内网）：http://${INTRANET_IP}"

EOF

# 09 状态与诊断

cat >/opt/deploy/jh-craftsys/bin/09_status_and_diag.sh <<'EOF'

#!/usr/bin/env bash

set -euo pipefail

. /opt/deploy/jh-craftsys/conf/deploy.env

echo "==> 版本与路径"

node -v; npm -v; pnpm -v

echo "APP_ROOT=$APP_ROOT"

echo "SRC_DIR=$SRC_DIR"

echo "REL_DIR=$REL_DIR"

echo "CUR_LINK -> $(readlink -f "$CUR_LINK" || echo '未设置')"

if [ -d "$SRC_DIR/.git" ]; then

  cd "$SRC_DIR"

  echo "当前代码版本：$(git rev-parse --short HEAD) ($(git describe --tags --always 2>/dev/null || echo 'no-tag'))"

fi

echo "==> 服务状态"

systemctl --no-pager status nginx | sed -n '1,8p' || true

pm2 ls || true

echo "==> 端口监听"

ss -ltnp | grep -E ':80|:443|:'"$API_PORT"'' || true

echo "==> 最近 Nginx 错误日志"

sudo tail -n 100 /var/log/nginx/${SITE_NAME}_error.log 2>/dev/null || true

EOF

# rollback 回滚

cat >/opt/deploy/jh-craftsys/bin/rollback.sh <<'EOF'

#!/usr/bin/env bash

set -euo pipefail

. /opt/deploy/jh-craftsys/conf/deploy.env

echo "==> 可回滚版本："

ls -1 "$REL_DIR" | grep -E '^[0-9]{8}-[0-9]{6}$' | sort -r | nl

read -rp "输入要切换的序号: " IDX

TS=$(ls -1 "$REL_DIR" | grep -E '^[0-9]{8}-[0-9]{6}$' | sort -r | sed -n "${IDX}p")

[ -n "$TS" ] || { echo "无效序号"; exit 1; }

ln -sfn "$REL_DIR/$TS" "$CUR_LINK"

pm2 reload "$PM2_APP_NAME" || true

echo "==> 已切换到 $TS 并重载后端"

EOF

# update 串联（升级常用，支持版本参数）

cat >/opt/deploy/jh-craftsys/bin/update.sh <<'EOF'

#!/usr/bin/env bash

set -euo pipefail

. /opt/deploy/jh-craftsys/conf/deploy.env

DIR="/opt/deploy/jh-craftsys/bin"

# 获取版本参数，如果没有提供则交互式选择
TARGET_VERSION="${1:-}"

if [ -z "$TARGET_VERSION" ]; then

  echo "==> 未指定版本，将显示可用版本供选择"

  echo ""

  "$DIR/list_versions.sh"

  echo ""

  echo "选项："

  echo "  1) 升级到最新版本（latest/main/master）"

  echo "  2) 输入特定版本（tag/commit/branch）"

  echo "  3) 退出"

  read -rp "请选择 [1-3]: " CHOICE

  case "$CHOICE" in

    1)

      TARGET_VERSION="latest"

      ;;

    2)

      read -rp "请输入版本（tag/commit/branch）: " TARGET_VERSION

      [ -n "$TARGET_VERSION" ] || { echo "ERROR: 版本不能为空"; exit 1; }

      ;;

    3)

      echo "已取消"

      exit 0

      ;;

    *)

      echo "ERROR: 无效选择"

      exit 1

      ;;

  esac

fi

echo "==> 开始升级到版本: ${TARGET_VERSION:-latest}"

"$DIR/00_proxy_on.sh"

"$DIR/02_checkout_or_update.sh" "$TARGET_VERSION"

"$DIR/04_install_backend_deps.sh"

"$DIR/05_install_frontend_deps_build.sh"

"$DIR/07_pm2_bootstrap.sh"

"$DIR/08_deploy_switch_and_smoke.sh"

"$DIR/10_proxy_off.sh"

echo ""

echo "==> 升级完成！当前版本："

if [ -d "$SRC_DIR/.git" ]; then

  cd "$SRC_DIR"

  echo "   $(git rev-parse --short HEAD) ($(git describe --tags --always 2>/dev/null || echo 'no-tag'))"

fi

EOF

# first_deploy 串联（从裸机开始）

cat >/opt/deploy/jh-craftsys/bin/first_deploy.sh <<'EOF'

#!/usr/bin/env bash

set -euo pipefail

DIR="/opt/deploy/jh-craftsys/bin"

# 获取版本参数（可选）

TARGET_VERSION="${1:-latest}"

echo "==> 首次部署，版本: ${TARGET_VERSION}"

"$DIR/00_proxy_on.sh"

"$DIR/01_install_prereqs.sh"

"$DIR/02_checkout_or_update.sh" "$TARGET_VERSION"

"$DIR/03_backend_env_write.sh"

"$DIR/04_install_backend_deps.sh"

"$DIR/05_install_frontend_deps_build.sh"

"$DIR/06_nginx_setup.sh"

"$DIR/07_pm2_bootstrap.sh"

"$DIR/08_deploy_switch_and_smoke.sh"

"$DIR/09_status_and_diag.sh"

"$DIR/10_proxy_off.sh"

EOF

# 执行权限

chmod +x /opt/deploy/jh-craftsys/bin/*.sh

echo

echo "========== 全部脚本已生成/覆盖（支持版本选择） =========="

echo "首次部署（最新版）：  sudo /opt/deploy/jh-craftsys/bin/first_deploy.sh"

echo "首次部署（指定版）：  sudo /opt/deploy/jh-craftsys/bin/first_deploy.sh <tag|commit|branch>"

echo "后续升级（最新版）：  sudo /opt/deploy/jh-craftsys/bin/update.sh"

echo "后续升级（指定版）：  sudo /opt/deploy/jh-craftsys/bin/update.sh <tag|commit|branch>"

echo "查看可用版本：        sudo /opt/deploy/jh-craftsys/bin/list_versions.sh"

echo "回    滚：            sudo /opt/deploy/jh-craftsys/bin/rollback.sh"

echo "自    检：            sudo /opt/deploy/jh-craftsys/bin/09_status_and_diag.sh"

echo "配置文件：            /opt/deploy/jh-craftsys/conf/deploy.env  与  backend.env"

echo "==============================================================="

