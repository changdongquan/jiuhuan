#!/usr/bin/env bash
set -euo pipefail

TARGET_HOST="${1:-jiuhuan_ocr}"
TARGET_DIR="${2:-/opt/bmo-relay-test}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "sync to ${TARGET_HOST}:${TARGET_DIR}"
ssh "$TARGET_HOST" "mkdir -p '${TARGET_DIR}/app' '${TARGET_DIR}/data/files' '${TARGET_DIR}/data/redis'"
rsync -av --delete "${SCRIPT_DIR}/docker-compose.yml" "${TARGET_HOST}:${TARGET_DIR}/docker-compose.yml"
rsync -av --delete --exclude '__pycache__/' "${SCRIPT_DIR}/app/" "${TARGET_HOST}:${TARGET_DIR}/app/"
rsync -av --delete "${SCRIPT_DIR}/healthcheck.sh" "${TARGET_HOST}:${TARGET_DIR}/healthcheck.sh"
rsync -av --delete "${SCRIPT_DIR}/cleanup-files.sh" "${TARGET_HOST}:${TARGET_DIR}/cleanup-files.sh"
rsync -av --delete "${SCRIPT_DIR}/.env.sample" "${TARGET_HOST}:${TARGET_DIR}/.env.sample"

chmod +x "${SCRIPT_DIR}/healthcheck.sh" "${SCRIPT_DIR}/cleanup-files.sh" "${SCRIPT_DIR}/install-on-ocr.sh"

echo "done. then on remote:"
echo "  cd ${TARGET_DIR}"
echo "  cp -n .env.sample .env"
echo "  # edit .env: BMO_COOKIE / BMO_X_AUTH_TOKEN"
echo "  docker compose up -d --build"
