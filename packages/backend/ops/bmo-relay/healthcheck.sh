#!/usr/bin/env bash
set -euo pipefail
BASE_URL="${1:-http://127.0.0.1:18081}"

echo "[health] ${BASE_URL}/health"
curl -fsS "${BASE_URL}/health" | sed -n '1,120p'

echo
echo "[collect] submit"
job_json=$(curl -fsS -X POST "${BASE_URL}/jobs" -H 'content-type: application/json' \
  -d '{"type":"collect","payload":{"pageSize":3,"offset":0}}')
job_id=$(printf '%s' "$job_json" | sed -n 's/.*"id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1)
if [[ -z "$job_id" ]]; then
  echo "collect create failed: $job_json"
  exit 1
fi

echo "job_id=${job_id}"
for _ in $(seq 1 20); do
  sleep 1
  st=$(curl -fsS "${BASE_URL}/jobs/${job_id}")
  status=$(printf '%s' "$st" | sed -n 's/.*"status"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1)
  if [[ "$status" == "success" || "$status" == "failed" ]]; then
    echo "$st" | sed -n '1,200p'
    [[ "$status" == "success" ]] || exit 1
    exit 0
  fi
done

echo "collect timeout"
exit 1
