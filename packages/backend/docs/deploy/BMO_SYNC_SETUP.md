# BMO 采集配置（craftsys backend）

本文档说明如何在 `packages/backend` 启用 BMO 数据采集接口。

## 1. 执行迁移

先执行迁移文件：

- `packages/backend/migrations/20260212_create_bmo_sync_tables.sql`

按仓库规范，推荐使用 Node + mssql 执行迁移脚本。

## 2. 环境变量

至少配置以下变量：

- `BMO_BASE_URL`（可选，默认 `https://bmo.meiling.com:8023`）
- `BMO_DATA_ENDPOINT`（可选，默认 `/data/sys-modeling/sysModelingMain/data`）
- `BMO_RELAY_BASE_URL`（可选，示例 `http://10.0.0.48:18081`；配置后 `refresh/download-jobs` 优先走中转）

认证二选一：

1) 静态会话（推荐先用于联调）

- `BMO_COOKIE`
- `BMO_X_AUTH_TOKEN`（可选）

2) 后端自动登录（不保证稳定）

- `BMO_USERNAME`
- `BMO_PASSWORD`
- `BMO_LOGIN_ENDPOINT`（可选，默认 `/data/sys-auth/login`）
- `BMO_LOGIN_PAYLOAD_TEMPLATE`（可选，JSON 字符串，支持占位符；若不提供，将尝试按 BMO 前端一致的 RSA 表单登录）
- `BMO_LOGIN_PAGE_ENDPOINT`（可选，默认 `/data/sys-portal/sysPortalLoginPage/loginPage`，用于拉取 RSA 公钥）
- `BMO_RSA_PADDING`（可选，默认 `pkcs1`；可设为 `oaep`）

`BMO_LOGIN_PAYLOAD_TEMPLATE` 示例（按实际登录接口字段调整）：

```json
{"loginName":"{{username}}","password":"{{password}}"}
```

注意：

- 不要把用户名/密码写入代码仓库。
- 不要把明文密码写入日志。

### 2.1 免维护推荐：Headless 会话续期（session keeper）

如果你希望“打开 BMO 采集页 3 秒内拿到最新数据”，后端不能在请求里现场登录（可能卡住/超时），建议使用 headless Chromium/Playwright 在后台续期会话，并把最新 `BMO_COOKIE/BMO_X_AUTH_TOKEN` 写回到一个可热加载的 env 文件。

后端支持从 `BMO_AUTH_FILE` 读取并热加载：

- `BMO_AUTH_FILE=/etc/jh-craftsys/secrets/bmo.env`（示例）

会话续期脚本：

- `packages/backend/scripts/bmo-session-keeper.js`

systemd 样例：

- `packages/backend/ops/systemd/bmo-session-keeper.service`

依赖：

- 在 `packages/backend` 安装 `playwright-core`（并确保服务器有可用的 Chromium/Chrome；可通过 `BMO_KEEPER_CHROME_PATH` 指定路径）

推荐配置（你当前选择：开发端 + 服务端都用账号密码续期；keeper 每 60 分钟续期一次，打开页面时仍会兜底触发一次 ensure）：

- 在会话文件中配置（不要提交到仓库）：
  - `BMO_USERNAME`
  - `BMO_PASSWORD`
- keeper 频率（可写进 `bmo.env`，也可由 systemd unit 提供默认值）：
  - `BMO_KEEPER_INTERVAL_MS=3600000`（60 分钟）
- 后端热加载会话文件：
  - `BMO_AUTH_FILE=/etc/jh-craftsys/secrets/bmo.env`（服务端示例）
  - 开发端默认会自动使用 `packages/backend/.env`（如果该文件存在且未显式设置 `BMO_AUTH_FILE`）

## 3. 后端接口

### 3.1 触发同步

- `POST /api/bmo/sync`

请求体（可选）：

```json
{
  "pageSize": 25,
  "maxPages": 20,
  "dryRun": false,
  "conditions": {},
  "sorts": {"fd_create_time":"desc"}
}
```

### 3.2 查询最新数据

- `GET /api/bmo/latest?limit=50`

### 3.3 查询同步任务

- `GET /api/bmo/tasks?limit=20`

### 3.4 打开页面：3 秒内尝试实时并自动入库

- `GET /api/bmo/mould-procurement/refresh?pageSize=200&offset=0&maxWaitMs=3000`

返回 `data.source`：

- `live`：实时成功（后台自动 upsert 入库）
- `db`：实时失败，回退库内数据（同时返回 `data.connection` 状态）

### 3.5 连接/入库状态

- `GET /api/bmo/status`

### 3.6 打开页面前的会话确保（过期自动续期一次）

- `POST /api/bmo/session/ensure?maxWaitMs=2000&keeperTimeoutMs=60000`

返回：

- `state=connected`：已连接（不会重复登录）
- `state=expired`：会话过期且续期失败
- `state=error`：非 401 错误（网络/接口异常等）

## 4. 采集策略

- 分页使用 BMO 接口的 `offset + pageSize`。
- 入库按 `bmo_record_id` 做幂等 upsert。
- 同步日志写入 `bmo_sync_task_logs`，用于追踪成功/失败。
