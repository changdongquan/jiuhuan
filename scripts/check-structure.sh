#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

echo "==> 结构检查"

# 1) 根目录不应再出现 *.sh（应放在 ops/）
if ls ./*.sh >/dev/null 2>&1; then
  fail "根目录存在 .sh 脚本，请移动到 ops/（例如 ops/local 或 ops/server）"
fi

# 2) tools/sql/docs/ops 目录应存在
for d in docs tools sql ops; do
  [ -d "$d" ] || fail "缺少目录：$d"
done

# 3) 防止误提交后端 secrets

# 3) 后端保持 npm：禁止提交 backend/pnpm-lock.yaml
if [ -f backend/pnpm-lock.yaml ]; then
  fail "后端保持 npm：请删除 backend/pnpm-lock.yaml（只保留 backend/package-lock.json）"
fi

if [ -f backend/local-users.json ]; then
  if git ls-files --error-unmatch backend/local-users.json >/dev/null 2>&1; then
    fail "backend/local-users.json 不应被纳入版本控制（请确保 .gitignore 生效）"
  fi
fi

echo "OK"

