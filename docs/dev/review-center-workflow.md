# 审核中心流程规范（MVP）

## 目标

- 将“提交审核 / 驳回 / 审核通过并入库”从业务编辑页中解耦，统一到审核中心处理。
- 形成可扩展的审核框架，后续其它表单可按同一协议接入。

## 当前接入范围

- 单据类型：`BMO立项`（`bmo_initiation_requests`）
- 审核中心页面：`/review-center/index`

## 角色与职责

- 申请人（业务角色）
  - 可在业务页编辑草稿、提交审核。
  - 不在业务页执行“驳回/通过并入库”。
- 审核人（审核角色）
  - 在审核中心处理“审核中”任务。
  - 仅可执行：驳回、审核通过并入库。

## 状态机

- `DRAFT`：草稿，可编辑。
- `PM_CONFIRMED`：审核中（待审核），不可编辑。
- `REJECTED`：已驳回，可再次编辑并重新提交。
- `APPLIED`：已入库，不可编辑。

## 后端接口（审核中心）

- 列表：`GET /api/bmo/initiation-review/tasks`
  - 参数：`page`、`pageSize`、`status`、`keyword`
- 驳回：`POST /api/bmo/initiation-review/reject`
  - 参数：`bmo_record_id`、`reason`
- 通过并入库：`POST /api/bmo/initiation-review/approve-and-apply`
  - 参数：`bmo_record_id`

## 权限控制

- 页面权限：`ReviewCenter` 路由权限。
- 接口权限（后端兜底）：
  - 环境变量 `BMO_INITIATION_REVIEWERS`（逗号分隔用户名/显示名）用于审核人白名单。
  - 若未配置该变量，为兼容历史行为，接口不拦截（默认放行）。

## 关键约束

- 驳回仅允许在 `PM_CONFIRMED` 状态执行。
- 已入库（`APPLIED`）禁止驳回。
- 审核动作必须由审核中心执行，业务页只保留“去审核中心处理”引导。

## 扩展规范（未来接入其它表单）

- 每个表单保持自身业务表，不强制迁移到统一大表。
- 对外统一审核中心协议：列表、驳回、通过动作。
- 每个表单提供状态映射到统一显示文本（草稿/审核中/已驳回/已生效）。
- 每个表单的审核动作必须具备后端权限兜底，不依赖前端按钮显隐。
