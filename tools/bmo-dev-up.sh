#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="${ROOT_DIR}/packages/backend"
PID_DIR="${ROOT_DIR}/tools/.run"
mkdir -p "${PID_DIR}"

BACKEND_PID_FILE="${PID_DIR}/bmo-backend.pid"
RELAY_BASE_URL="${RELAY_BASE_URL:-http://jiuhuan.net:18081}"
DEV_OCR_URL="${DEV_OCR_URL:-http://jiuhuan.net:18080}"
DEV_OCR_TIMEOUT_MS="${DEV_OCR_TIMEOUT_MS:-90000}"

BACKEND_PORT="${BACKEND_PORT:-3001}"
FORCE_RESTART="${FORCE_RESTART:-0}"

is_pid_running() {
  local pid="$1"
  [[ -n "${pid}" ]] && kill -0 "${pid}" >/dev/null 2>&1
}

read_pid() {
  local file="$1"
  [[ -f "${file}" ]] && cat "${file}" || true
}

cleanup_legacy_tunnel() {
  # 兼容早期方案：若存在本机 18081 的 SSH 隧道，主动清理，确保当前为直连方案。
  pkill -f 'ssh -f -N .*18081:10.0.0.48:18081 jiuhuan' >/dev/null 2>&1 || true
  pkill -f 'ssh -N .*18081:10.0.0.48:18081 jiuhuan' >/dev/null 2>&1 || true
}

ensure_backend() {
  local existing_pid
  existing_pid="$(read_pid "${BACKEND_PID_FILE}")"
  if is_pid_running "${existing_pid}"; then
    echo "[bmo-dev-up] backend already running (pid=${existing_pid})"
    return
  fi

  local listen_pid
  listen_pid="$(lsof -tiTCP:${BACKEND_PORT} -sTCP:LISTEN | head -n 1 || true)"
  if [[ -n "${listen_pid}" ]]; then
    if [[ "${FORCE_RESTART}" == "1" ]]; then
      echo "[bmo-dev-up] backend port ${BACKEND_PORT} in use (pid=${listen_pid}), force restart"
      kill "${listen_pid}" >/dev/null 2>&1 || true
      sleep 1
    else
      echo "[bmo-dev-up] backend port ${BACKEND_PORT} already in use (pid=${listen_pid}), skip starting backend"
      return
    fi
  fi

  echo "[bmo-dev-up] starting backend on :${BACKEND_PORT} (dev auto-login enabled)"
  (
    cd "${BACKEND_DIR}"
    nohup env \
      NODE_ENV=development \
      FORCE_DEV_AUTO_LOGIN=1 \
      BMO_RELAY_BASE_URL="${RELAY_BASE_URL}" \
      RELOCATION_OCR_URL="${DEV_OCR_URL}" \
      RELOCATION_OCR_TIMEOUT_MS="${DEV_OCR_TIMEOUT_MS}" \
      PORT="${BACKEND_PORT}" \
      node server.js \
      > /tmp/jh-backend-local.log 2>&1 &
    echo $! > "${BACKEND_PID_FILE}"
  )
}

health_checks() {
  echo "[bmo-dev-up] health checks..."
  if curl -fsS "${RELAY_BASE_URL}/health" >/dev/null; then
    echo "  relay health: ok"
  else
    echo "  relay health: failed"
  fi

  if curl -fsS "http://127.0.0.1:${BACKEND_PORT}/api/auth/auto-login" >/dev/null; then
    echo "  auth auto-login: ok"
  else
    echo "  auth auto-login: failed"
  fi

  if curl -fsS "http://127.0.0.1:${BACKEND_PORT}/api/bmo/session/ensure?maxWaitMs=2000&keeperTimeoutMs=60000" >/dev/null; then
    echo "  bmo session ensure: ok"
  else
    echo "  bmo session ensure: warning (endpoint unavailable or not ready)"
  fi

  echo "[bmo-dev-up] OK"
  echo "  relay:   ${RELAY_BASE_URL}/health"
  echo "  ocr:     ${DEV_OCR_URL}"
  echo "  ocrTimeoutMs: ${DEV_OCR_TIMEOUT_MS}"
  echo "  backend: http://127.0.0.1:${BACKEND_PORT}/api/auth/auto-login"
  echo "  frontend proxy check: http://localhost:4000/api/auth/auto-login"
}

cleanup_legacy_tunnel
ensure_backend
sleep 1
health_checks
