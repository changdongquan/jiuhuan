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

## 提交 / 发布（强约束）

> 目标：避免“远端 update.sh 才发现构建/校验失败”，避免夹带无关改动上线。

### 日常迭代（默认）

> 目标：加快开发迭代速度，同时保持基本质量门槛。

- 平时改代码默认只跑（前端）：`pnpm ts:check`
- 如涉及样式/ESLint 相关问题或准备收尾，再补跑：`pnpm lint:eslint`
- **仅在“准备提交/准备发版/准备部署”阶段**再跑完整构建：`pnpm build:pro`

- 提交前必须执行（前端）：
  - `pnpm ts:check`
  - `pnpm lint:eslint`（必要时可再跑 `pnpm lint:style` / `pnpm lint:format`）
  - `pnpm build:pro`
- 代码风格底线：
  - **禁止空 `catch {}`**。如需忽略异常，至少写 `catch (e) { /* ignore */ }` 或 `catch (e) { // ignore }`（满足 lint）。
- 提交范围：
  - **只提交本需求相关文件**；如工作区还有无关改动（例如 `.gitignore`、`package.json`、其它页面样式等），必须拆分到另一个明确的提交，或直接还原。
  - 尽量做到“一件事一个 commit”（或一组强相关 commit）。

## 数据库迁移（执行规范）

> 目标：迁移执行方式与后端一致，避免环境差异导致失败。

- 优先使用 **Node + mssql** 执行迁移（与后端运行时一致）。
- 迁移脚本来源：`packages/backend/migrations/`。
- 本机 DNS/网络不稳定时，改在 `ssh jiuhuan` 上执行。
- 不使用 `nc/ping` 作为 DB 可达性判断依据（本机可能被限制）。
- 推荐执行方式（示例）：
  - 本机执行示例：
```bash
node -e "const fs=require('fs');const path='packages/backend/migrations/<file>.sql';const {query,closeDatabase}=require('./packages/backend/database');const sql=fs.readFileSync(path,'utf8');const batches=sql.split(/^\\s*GO\\s*$/gmi).map(s=>s.trim()).filter(Boolean);(async()=>{for(const b of batches){await query(b);}await closeDatabase();console.log('✅ migration executed:', path);})().catch(async e=>{console.error('❌ migration failed:', e.message||e);try{await closeDatabase();}catch{}process.exit(1);});"
```
  - 远端执行示例（`ssh jiuhuan`）：
```bash
ssh jiuhuan "node -e \"const fs=require('fs');const path='/opt/jh-craftsys/source/packages/backend/migrations/<file>.sql';const {query,closeDatabase}=require('/opt/jh-craftsys/source/packages/backend/database');const sql=fs.readFileSync(path,'utf8');const batches=sql.split(/^\\\\s*GO\\\\s*$/gmi).map(s=>s.trim()).filter(Boolean);(async()=>{for(const b of batches){await query(b);}await closeDatabase();console.log('✅ migration executed:', path);})().catch(async e=>{console.error('❌ migration failed:', e.message||e);try{await closeDatabase();}catch{}process.exit(1);});\""
```

## 部署（jiuhuan）

> 目标：统一部署入口，减少跑错脚本/漏验收。

- 部署脚本路径（jiuhuan 机器）：
  - `/opt/deploy/jh-craftsys/bin/update.sh`
- 建议执行方式：
  - `ssh jiuhuan` 后执行：`sudo -n /opt/deploy/jh-craftsys/bin/update.sh`
- 部署后必须检查输出：
  - 是否切到 `origin/main` 最新 commit
  - 前端构建是否成功
  - `jiuhuan-backend.service` 是否重启成功
  - 冒烟测试（静态站点、`/api/health`）是否通过
