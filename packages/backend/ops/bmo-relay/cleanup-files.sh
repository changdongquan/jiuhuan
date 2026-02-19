#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="${1:-$(cd "$(dirname "$0")" && pwd)}"
FILES_DIR="${FILES_DIR:-${ROOT_DIR}/data/files}"
TTL_HOURS="${TTL_HOURS:-24}"

if [[ ! -d "$FILES_DIR" ]]; then
  echo "files dir not found: $FILES_DIR"
  exit 0
fi

echo "cleanup files older than ${TTL_HOURS}h in ${FILES_DIR}"
find "$FILES_DIR" -type f -mmin +$((TTL_HOURS * 60)) -print -delete
