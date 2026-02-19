#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PID_DIR="${ROOT_DIR}/tools/.run"

BACKEND_PID_FILE="${PID_DIR}/bmo-backend.pid"

kill_by_pid_file() {
  local file="$1"
  local name="$2"
  if [[ ! -f "${file}" ]]; then
    echo "[bmo-dev-down] ${name}: pid file not found"
    return
  fi

  local pid
  pid="$(cat "${file}")"
  if [[ -n "${pid}" ]] && kill -0 "${pid}" >/dev/null 2>&1; then
    kill "${pid}" >/dev/null 2>&1 || true
    echo "[bmo-dev-down] ${name} stopped (pid=${pid})"
  else
    echo "[bmo-dev-down] ${name}: process not running"
  fi
  rm -f "${file}"
}

kill_by_pid_file "${BACKEND_PID_FILE}" "backend"

# 兼容早期方案：顺手清理旧的 relay SSH 隧道进程
pkill -f 'ssh -f -N .*18081:10.0.0.48:18081 jiuhuan' >/dev/null 2>&1 || true
pkill -f 'ssh -N .*18081:10.0.0.48:18081 jiuhuan' >/dev/null 2>&1 || true
