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

认证二选一：

1) 静态会话（推荐先用于联调）

- `BMO_COOKIE`
- `BMO_X_AUTH_TOKEN`（可选）

2) 后端自动登录（生产建议）

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

## 4. 采集策略

- 分页使用 BMO 接口的 `offset + pageSize`。
- 入库按 `bmo_record_id` 做幂等 upsert。
- 同步日志写入 `bmo_sync_task_logs`，用于追踪成功/失败。
