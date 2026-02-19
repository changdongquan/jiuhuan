# BMO 中转站（bmo-relay）运行手册

## 1. 角色与边界

- `craftsys backend`：业务编排层。负责立项业务逻辑、字段映射、鉴权、给前端提供统一 `/api/bmo/*` 接口。
- `bmo-relay`：BMO 连接执行层。负责采集、附件下载、回填调用、上传调用的异步任务执行。
- `BMO`：上游系统。`bmo-relay` 唯一直接访问对象。

原则：`frontend -> craftsys backend -> bmo-relay -> BMO`，前端不直连 BMO。

## 2. 三容器

- `bmo-relay-api`：任务入口与状态查询（FastAPI）
- `bmo-relay-worker`：任务执行器（采集/下载/回填/上传）
- `bmo-relay-redis`：任务队列与状态存储

## 3. 部署目录（OCR 服务器）

当前可用目录：`/opt/bmo-relay-test`

建议目录结构：

- `/opt/bmo-relay-test/docker-compose.yml`
- `/opt/bmo-relay-test/.env`
- `/opt/bmo-relay-test/app/*`
- `/mnt/jiuhuan-files/bmo-relay-files`（推荐，NAS 正式目录）
- `/opt/bmo-relay-test/data/redis`

## 4. 启停

```bash
cd /opt/bmo-relay-test
docker compose up -d --build
docker compose ps
docker compose logs -f --tail=200 api worker
```

发布（从 craftsys 仓库推送到 OCR 服务器）：

```bash
bash packages/backend/ops/bmo-relay/install-on-ocr.sh jiuhuan_ocr /opt/bmo-relay-test
ssh jiuhuan_ocr "cd /opt/bmo-relay-test && sudo docker compose up -d --build api worker"
```

## 5. 健康检查

```bash
curl -fsS http://127.0.0.1:18081/health
```

或使用仓库脚本：

```bash
bash packages/backend/ops/bmo-relay/healthcheck.sh http://127.0.0.1:18081
```

## 6. craftsys 对接

后端环境变量：

```bash
BMO_RELAY_BASE_URL=http://10.0.0.48:18081
```

启用后：

- `GET /api/bmo/mould-procurement/refresh` 优先走 relay `collect`
- `POST /api/bmo/download-jobs` 走 relay `download_attachment`
- `GET /api/bmo/download-jobs/:jobId`
- `GET /api/bmo/download-jobs/:jobId/file`
- `POST /api/bmo/relay/jobs`（通用任务：collect/download_attachment/writeback/upload_attachment）
- `GET /api/bmo/relay/jobs/:jobId`
- `POST /api/bmo/relay/jobs/:jobId/retry`
- `GET /api/bmo/relay/files/:fileId`
- `GET /api/bmo/relay/auth/status?probe=1`（会话状态/探活）
- `POST /api/bmo/relay/auth/login`（手动登录）
- `POST /api/bmo/relay/auth/logout`（断开会话）
- `POST /api/bmo/relay/auth/set`（手工写入 Cookie/Token）

## 7. 回填与上传流程

1. craftsys 生成回填 payload。
2. 调 `POST /api/bmo/relay/jobs`，`type=writeback`。
3. 轮询 `GET /api/bmo/relay/jobs/:jobId` 到 `success/failed`。
4. 如需上传附件，提交通用任务 `type=upload_attachment`。
5. 上传成功后再执行业务状态推进（例如立项单状态流转）。

## 8. 故障处理

- `401/403`：
  - 默认已启用自动续期（`BMO_AUTH_AUTO_REFRESH=1`），worker 会在收到 401/403 时自动 API 登录并重试当前请求。
  - 若仍持续 401：检查 `.env` 中 `BMO_USERNAME/BMO_PASSWORD` 是否正确，以及账号是否被锁定。
  - 验证命令：
    - `bash /opt/bmo-relay-test/healthcheck.sh http://127.0.0.1:18081`
    - `curl -fsS http://127.0.0.1:18081/jobs/<jobId>`
- `下载按钮不存在`：页面结构变化，优先走 API 下载链路，页面点击仅兜底。
- `timeout`：先看 relay `worker` 日志，再看 BMO 可达性与代理设置。
- `collect 500 paramsNotValid`：检查 `type=list`、`sorts/conditions/params` 是否为对象结构。

自动续期关键配置（`.env`）：

- `BMO_AUTH_AUTO_REFRESH=1`：开启 401/403 自动续期（建议保持开启）。
- `BMO_AUTH_REFRESH_COOLDOWN_SEC=15`：续期最小间隔，防止频繁登录。
- `BMO_LOGIN_PAGE_ENDPOINT=/data/sys-portal/sysPortalLoginPage/loginPage`
- `BMO_LOGIN_ENDPOINT=/data/sys-auth/login`
- `BMO_RSA_PADDING=pkcs1`（如上游变更可切 `oaep`）

## 9. 文件保留与清理

默认附件落地目录（推荐）：`/mnt/jiuhuan-files/bmo-relay-files`

推荐设置：

- `.env` 中 `BMO_RELAY_FILES_HOST_DIR=/mnt/jiuhuan-files/bmo-relay-files`
- compose 会将该目录挂载到容器内 `/data/files`

建议定时清理：

```bash
bash packages/backend/ops/bmo-relay/cleanup-files.sh /opt/bmo-relay-test
```

默认清理 24 小时前文件，可通过 `TTL_HOURS` 调整。

## 10. 安全建议

- `18081` 仅允许内网与 `craftsys backend` 访问。
- 通过 Nginx 或防火墙限制来源。
- `.env` 仅服务器可读，避免写入仓库。
