# Soft Delete 规范（项目/货物 及关联单据）

目标：

- 不做物理删除，统一改为“阻止删除 + 软删除”
- 支持按项目编号一键连带软删、一键恢复整套项目
- 所有列表/详情/统计接口默认不返回已删除数据，必要时支持“查看已删除/查看全部”
- 软删记录可恢复，并恢复到“删除前状态”

## 1. 字段约定（所有参与软删的表）

统一使用如下 4 个字段（SQL Server）：

- `状态` `NVARCHAR(20) NULL`
- `删除前状态` `NVARCHAR(20) NULL`
- `删除时间` `DATETIME2 NULL`
- `删除人` `NVARCHAR(100) NULL`

状态取值约定：

- 正常数据：`状态 IS NULL` 或 `状态 <> N'已删除'`
- 已删除数据：`状态 = N'已删除'`

软删写入规则（Update）：

- `删除前状态 = 状态`
- `状态 = N'已删除'`
- `删除时间 = SYSDATETIME()`
- `删除人 = <当前登录用户>`

恢复写入规则（Update）：

- `状态 = 删除前状态`
- `删除前状态 = NULL`
- `删除时间 = NULL`
- `删除人 = NULL`

说明：

- 使用 `删除前状态` 是为了“恢复到删除前状态”，避免只能恢复到默认状态或空状态。
- 若某些老数据本来 `状态` 为 `NULL`，恢复后 `状态` 也会回到 `NULL`，这符合“回到删除前”的定义。

## 2. 删除人与来源

后端从请求头提取操作人（按优先级）：

- `X-Display-Name`（URL-encoded，前端可传中文显示名）
- `X-Username`（登录账号或标识）

字段落库：`删除人`。

相关实现位置：

- 后端：`/Users/changun/work/jiuhuan/packages/backend/utils/actor.js`
- 前端 axios header 注入：`/Users/changun/work/jiuhuan/packages/frontend/src/axios/index.ts`

## 3. 连带范围（以 项目编号 为根）

一键软删与一键恢复以 `项目编号(projectCode)` 为根键，连带覆盖：

- `货物信息`
- `项目管理`
- `生产任务`
- `销售订单`（含其附件表）
- `出库单明细`（含其附件表）
- `试模过程`（含其附件表）
- 附件类表：`项目管理附件`、`生产任务附件`、`销售订单附件`、`出库单附件`、`试模过程附件`

对应服务封装：

- `/Users/changun/work/jiuhuan/packages/backend/services/projectSoftDelete.js`
  - `softDeleteByProjectCode({ pool, tx, projectCode, actor })`
  - `restoreByProjectCode({ pool, tx, projectCode })`

约束：

- 删除与恢复都必须走事务（同一 `tx`），确保不会出现“主表删了但关联表没删”的残留。

## 4. API 行为约定

### 4.1 默认过滤规则（所有查询接口）

所有 “列表/详情/统计/聚合/库存/已出运数量/联表查询” 必须追加过滤条件：

```sql
(t.状态 IS NULL OR t.状态 <> N'已删除')
```

联表时也要过滤被联表的软删数据，例如：

```sql
LEFT JOIN 项目管理 p
  ON od.项目编号 = p.项目编号
 AND (p.状态 IS NULL OR p.状态 <> N'已删除')
```

### 4.2 “查看已删除/查看全部” 的接口参数约定（示例：货物信息）

建议对 list 类接口增加 `status` 参数：

- 不传或传空：仅正常（默认）
- `status=已删除`：仅已删除
- `status=all`：全部（含已删除）

对应实现与前端接入示例：

- 后端：`/Users/changun/work/jiuhuan/packages/backend/routes/goods.js` `GET /api/goods/list`
- 前端：`/Users/changun/work/jiuhuan/packages/frontend/src/api/goods/index.ts`
- 页面：`/Users/changun/work/jiuhuan/packages/frontend/src/views/ProjectInfo/index.vue`

### 4.3 删除接口约定

所有 delete 类接口必须满足：

- 不允许 `DELETE FROM ...` 物理删除业务数据
- 改为执行软删 update
- 若属于项目根对象（例如：货物信息、项目信息、生产任务入口等），必须走 “按项目编号连带软删”

当前入口点（已经改为软删）：

- `DELETE /api/goods/:id`：软删并按项目编号连带软删
- `DELETE /api/project/delete`：软删并按项目编号连带软删
- `DELETE /api/production-task/delete`：软删并按项目编号连带软删
- `DELETE /api/sales-orders/delete/:orderNo`：软删该销售订单及其附件
- `DELETE /api/outbound-document/delete`：软删该出库单明细及其附件

附件删除约定：

- “删除附件”只软删 DB 记录，不 unlink 物理文件（避免误删共享文件，且便于恢复）

## 5. 恢复流程约定（一键恢复整套项目）

恢复入口：

- `POST /api/goods/restore` body: `{ projectCode }`

恢复规则：

- 按项目编号将上述连带范围内所有 `状态 = N'已删除'` 的记录恢复
- 恢复到 `删除前状态`，并清空删除痕迹字段
- 事务执行，保证整套一致性

前端交互建议：

- 在列表中允许切换：`正常 / 已删除 / 全部`
- 当行状态为已删除时显示“恢复”按钮，二次确认后调用恢复接口

## 6. 表清单（已加软删字段）

迁移文件：

- `/Users/changun/work/jiuhuan/packages/backend/migrations/20260209_add_soft_delete_status_columns.sql`

包含表：

- `货物信息`
- `项目管理`
- `生产任务`
- `销售订单`
- `销售订单附件`
- `出库单明细`
- `出库单附件`
- `项目管理附件`
- `生产任务附件`
- `试模过程`
- `试模过程附件`

## 7. 新增页面/新增表 Checklist（照此做即可）

新增一个“有删除/恢复需求”的业务实体时：

1. DB
   - 为该表增加 4 个软删字段（推荐走迁移）。
   - 若表是运行时自动创建的（ensureTable/ensureAttachmentsTable），也必须同步补齐软删字段创建逻辑。
2. 后端
   - 所有查询 SQL 默认追加 `状态` 过滤。
   - 删除接口改为软删 update。
   - 若该实体属于项目域数据，删除应调用 `softDeleteByProjectCode`（事务内）。
   - 恢复接口按需加入：优先复用 `restoreByProjectCode`（事务内）。
3. 前端
   - 列表默认不展示已删除数据。
   - 如业务需要“可查看已删除”，加入 `status` 筛选并在已删除行展示“恢复”按钮。
   - 请求头确保带上 `X-Display-Name` 或 `X-Username`（用于 `删除人`）。

