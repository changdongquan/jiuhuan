#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PID_DIR="${ROOT_DIR}/tools/.run"

BACKEND_PID_FILE="${PID_DIR}/bmo-backend.pid"

BACKEND_PORT="${BACKEND_PORT:-3001}"
RELAY_BASE_URL="${RELAY_BASE_URL:-http://jiuhuan.net:18081}"

show_pid_file() {
  local file="$1"
  local name="$2"
  if [[ -f "${file}" ]]; then
    local pid
    pid="$(cat "${file}")"
    if [[ -n "${pid}" ]] && kill -0 "${pid}" >/dev/null 2>&1; then
      echo "[status] ${name}: running (pid=${pid})"
    else
      echo "[status] ${name}: pid file exists but process not running"
    fi
  else
    echo "[status] ${name}: not managed by script"
  fi
}

echo "[status] listeners"
lsof -iTCP:${BACKEND_PORT} -sTCP:LISTEN -n -P || true
echo

show_pid_file "${BACKEND_PID_FILE}" "backend"
echo

echo "[status] health"
curl -sS "${RELAY_BASE_URL}/health" || true
echo
curl -sS "http://127.0.0.1:${BACKEND_PORT}/api/auth/auto-login" || true
echo
curl -sS "http://127.0.0.1:${BACKEND_PORT}/api/bmo/session/ensure?maxWaitMs=2000&keeperTimeoutMs=60000" || true
echo
curl -sS "http://localhost:4000/api/auth/auto-login" || true
echo
