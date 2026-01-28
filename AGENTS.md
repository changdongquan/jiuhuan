# 仓库协作规范（给 AI/自动化代理）

本文件用于约束后续自动化代理（Codex/ChatGPT 等）对仓库的修改方式，避免目录再次变乱。

## 总体原则

- 不要把临时文件、随手脚本、图片/附件直接放在仓库根目录。
- 修改前先用 `rg` 搜索引用；移动文件后要同步更新引用路径。
- 本仓库当前约定：**前端使用 pnpm**；**后端暂时保持 npm（不做 pnpm 化）**。
- `package-lock.json`（根目录）当前先保留，后续如要统一以 pnpm 为准，再单独讨论处理策略。

## 目录职责（约定）

- `packages/frontend/`：前端工程（pnpm）
- `packages/frontend/src/`：前端业务代码
- `packages/backend/`：后端 API（Node/Express，npm）
- `docs/`：项目说明文档（除根目录 `README*`/`CHANGELOG.md`/`LICENSE`）
- `docs/dev/`：开发说明（测试、集成、实现摘要等）
- `tools/`：一次性/辅助脚本（不参与应用运行与构建）
- `sql/`：非迁移用途 SQL（参考脚本、临时查询等）
- `ops/`：部署/运维相关脚本（不参与应用运行）
- `packages/backend/migrations/`：数据库迁移 SQL（按日期命名）
- `packages/backend/docs/`：后端/部署相关文档（按子目录分类）
- `packages/backend/ops/`：后端部署/运维相关脚本与配置样例（systemd/nginx/apache/kerberos 等）

## 新增文件放置规则

- 新增文档：放 `docs/`（或 `packages/backend/docs/`）
- 新增一次性脚本：放 `tools/`（或后端相关则放 `packages/backend/scripts/` / `packages/backend/ops/`）
- 后端相关脚本（迁移后）：放 `packages/backend/scripts/` / `packages/backend/ops/`
- 新增 SQL：
  - 迁移：`packages/backend/migrations/`
  - 参考/临时：`sql/`
