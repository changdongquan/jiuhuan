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

- **默认禁止自动提交/推送**：未收到用户明确指令（例如“提交并推送到 Gitee/main”）前，代理不得执行 `git commit`、`git push`、`git merge`、`git rebase`、`git reset` 等会改变提交历史或远端状态的操作。
- 如需提交，必须先由用户明确确认提交范围与目标分支；未确认时仅保留本地工作区改动并汇报变更内容。
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

## 开发端登录（强约束）

> 目标：开发环境始终保持“开发测试用户默认登录”，避免因 AI/自动化改动导致本机调试被迫输入账号密码。

- **开发端（尤其 macOS 本机）必须默认自动登录为 `dev-user`**。
- 不允许将开发端逻辑改回“必须手动输入用户名/密码”才能进入系统。
- 如需调整登录相关逻辑，必须同时满足：
  - 不影响生产（Ubuntu/systemd/Apache Kerberos）路径；
  - 本机未设置 `NODE_ENV` 时仍能自动登录 `dev-user`；
  - 变更原因与验证步骤写清楚。
- 相关代码位置（修改前先 `rg` 搜索引用并理解影响范围）：
  - 后端：`packages/backend/routes/auth.js` 的 `/api/auth/auto-login` 与开发环境判断。

## 显示名称使用（强约束）

> 目标：全系统对“人名”统一优先使用显示名称（display name），避免页面和审核记录退化为登录账号（username）。

- 适用范围：
  - 顶部右上角用户信息显示
  - 业务单据中的 `经办人/申请人/审核人/批准人`
  - 审核中心各类 `申请人/审核人` 展示与记录
  - 新增页面中任何“人员名称”展示字段
- 强制要求：
  - 前端展示统一优先顺序：`realName -> displayName -> username`。
  - 后端写入“操作人/申请人/审核人”时，优先使用 `displayName`（或等价显示名），禁止默认写入 `username`。
  - 仅当确实无法获取显示名称时，才允许回退 `username`，且应保留可补齐路径（例如后续可通过当前用户接口或 AD 查询补齐）。
  - 任何与显示名相关的兼容修改，不得影响现有业务接口可用性与权限校验链路。
- 开发约束：
  - 不允许通过“仅管理员可见”的方式实现通用显示名补齐（普通登录用户也必须可获取自身显示名称）。
  - 修改登录/认证头/操作人解析逻辑时，必须验证“页面显示”和“写库字段”两条链路都优先显示名称。

## 删除流程（强约束）

> 目标：统一“删除确认 -> 软删除 -> 审核中心 -> 硬删除/驳回恢复”闭环，避免各页面删除行为不一致。

- 适用范围：`销售订单/开票单据/回款单据/工资/出库单/项目信息/客户信息/供方信息/员工信息` 页面的主数据删除按钮。
- 未来新增的任何“删除按钮/删除入口”（含新页面、新模块、批量删除）默认自动纳入本规范，除非用户明确批准例外方案并在文档中注明原因。
- 前端交互强制要求：
  - 删除前必须弹出输入框确认，不允许仅 `confirm` 二次确认。
  - 用户必须输入 `"Y"`（大小写 `Y/y` 均可）才能继续删除。
  - 推荐统一文案：`请输入 "Y" 确认删除（不可恢复）`。
- 业务删除强制要求：
  - 页面删除按钮只做**软删除**，不得直接物理删除。
  - 软删除后，系统必须自动在审核中心创建“硬删除申请”。
  - 审核通过后才执行硬删除；审核驳回必须自动恢复软删除状态（记录恢复成功/失败原因）。
- 审核记录强制要求：
  - 审核中心需可区分来源，`审核内容来源` 应明确到模块与动作（示例：`销售订单删除`、`供方信息删除`）。
  - 审核弹窗应展示本次待审删除的关键内容，避免“只看 ID”无法判断。
- 开发约束：
  - 新增页面或重构删除逻辑时，必须复用上述流程，不得引入旁路删除接口。
  - 修改删除相关代码后，至少验证“提交删除申请、审批通过、审批驳回恢复”三条链路。

## 时间轴视图开关位置（强约束）

> 目标：所有含“时间轴/表格”切换的页面，视图开关位置与交互保持一致，避免页面间漂移。

- 适用范围：现有与后续新增的所有包含时间轴视图的页面（含新模块、新页面、重构页面）。
- 位置强制要求：
  - PC 端视图开关必须放在**最上方标题栏**，且位于“项目配置”按钮左侧（与销售订单页面一致）。
  - 页面内容区（筛选区、表格区、时间轴区）不得再单独放置 PC 端视图开关。
- 实现强制要求：
  - 统一在 `packages/frontend/src/layout/components/ToolHeader.vue` 中接入页面路由并渲染视图开关。
  - 新增页面时，复用同一套 `视图 + ElRadioGroup(表格/时间轴)` 结构与样式类，不得复制出新样式分支。
  - 视图切换统一通过路由 `query.view` 与页面状态同步，保证标签页切换和刷新后行为一致。
- 移动端要求：
  - 移动端可在页面内保留移动端专用视图切换，不受 PC 顶栏位置约束。

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
