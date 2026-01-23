#!/usr/bin/env bash

set -euo pipefail

echo "==> 最小化升级：仅更新版本选择相关脚本"
echo ""

# 备份现有脚本
BACKUP_DIR="/opt/deploy/jh-craftsys/bin.backup-$(date +%Y%m%d-%H%M%S)"
if [ -d /opt/deploy/jh-craftsys/bin ]; then
  echo "==> 备份现有脚本到: $BACKUP_DIR"
  sudo cp -a /opt/deploy/jh-craftsys/bin "$BACKUP_DIR" || true
fi

# 确保目录存在
sudo mkdir -p /opt/deploy/jh-craftsys/bin

# =========================
# 1) 更新 02_checkout_or_update.sh（支持版本参数）
# =========================

cat > /tmp/02_checkout_or_update.sh <<'EOF'
#!/usr/bin/env bash

set -euo pipefail

. /opt/deploy/jh-craftsys/conf/deploy.env

# 版本参数：支持 tag、commit hash 或分支名
TARGET_VERSION="${1:-latest}"

mkdir -p "$SRC_DIR"

# 若使用 SSH 仓库地址，确保 known_hosts 已包含 gitee.com（避免首次连接交互确认）
if [[ "${REPO_URL:-}" == git@* ]]; then
  mkdir -p ~/.ssh
  chmod 700 ~/.ssh
  touch ~/.ssh/known_hosts
  chmod 600 ~/.ssh/known_hosts
  ssh-keygen -F gitee.com >/dev/null 2>&1 || ssh-keyscan -t rsa,ed25519 gitee.com >> ~/.ssh/known_hosts 2>/dev/null || true
  export GIT_SSH_COMMAND="ssh -o BatchMode=yes -o StrictHostKeyChecking=yes"
fi

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

mkdir -p /opt/deploy/jh-craftsys/logs
git rev-parse HEAD > /opt/deploy/jh-craftsys/logs/last_commit.txt 2>/dev/null || true

echo "==> 当前版本：$(git rev-parse --short HEAD) ($(git describe --tags --always 2>/dev/null || echo 'no-tag'))"

EOF

sudo cp /tmp/02_checkout_or_update.sh /opt/deploy/jh-craftsys/bin/02_checkout_or_update.sh
sudo chmod +x /opt/deploy/jh-craftsys/bin/02_checkout_or_update.sh
echo "✓ 已更新: 02_checkout_or_update.sh"

# =========================
# 2) 更新 update.sh（支持版本参数和交互选择）
# =========================

cat > /tmp/update.sh <<'EOF'
#!/usr/bin/env bash

set -euo pipefail

. /opt/deploy/jh-craftsys/conf/deploy.env

DIR="/opt/deploy/jh-craftsys/bin"

# 如果用 sudo/root 执行，切回原用户（确保 git/ssh 使用该用户的密钥，避免 root 无 key 导致拉取失败）
if [ "$(id -u)" -eq 0 ]; then
  if [ -n "${SUDO_USER:-}" ] && [ "${SUDO_USER}" != "root" ]; then
    exec sudo -u "$SUDO_USER" -H "$0" "$@"
  fi
  echo "ERROR: 请不要以 root 直接运行 update.sh；请使用普通用户运行（或用 sudo 从普通用户触发）。" >&2
  exit 1
fi

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

sudo cp /tmp/update.sh /opt/deploy/jh-craftsys/bin/update.sh
sudo chmod +x /opt/deploy/jh-craftsys/bin/update.sh
echo "✓ 已更新: update.sh"

# =========================
# 3) 新增 list_versions.sh（查看可用版本）
# =========================

cat > /tmp/list_versions.sh <<'EOF'
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

sudo cp /tmp/list_versions.sh /opt/deploy/jh-craftsys/bin/list_versions.sh
sudo chmod +x /opt/deploy/jh-craftsys/bin/list_versions.sh
echo "✓ 已新增: list_versions.sh"

# 清理临时文件
rm -f /tmp/02_checkout_or_update.sh /tmp/update.sh /tmp/list_versions.sh

echo ""
echo "========== 最小化升级完成 =========="
echo "✓ 更新了 2 个现有脚本"
echo "✓ 新增了 1 个版本查看脚本"
echo ""
echo "使用方法："
echo "  查看可用版本:  sudo /opt/deploy/jh-craftsys/bin/list_versions.sh"
echo "  升级（交互式）: sudo /opt/deploy/jh-craftsys/bin/update.sh"
echo "  升级到指定版:  sudo /opt/deploy/jh-craftsys/bin/update.sh <tag|commit|branch>"
echo "  升级到最新版:  sudo /opt/deploy/jh-craftsys/bin/update.sh latest"
echo ""
echo "备份位置: $BACKUP_DIR"
echo "===================================="
