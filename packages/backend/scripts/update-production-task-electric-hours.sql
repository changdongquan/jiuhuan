-- 更新 生产任务 表字段：
-- 1. 将「批次完成数量」重命名为「电极加工工时」
-- 2. 删除「批次完成时间」字段
--
-- 注意：
-- - 请在执行前确认没有依赖旧字段的其他程序。
-- - 建议先在测试库执行验证，再在正式库执行。

-- 1) 将批次完成数量列重命名为 电极加工工时
EXEC sp_rename N'生产任务.批次完成数量', N'电极加工工时', 'COLUMN';

-- 2) 删除批次完成时间列
IF EXISTS (
  SELECT 1
  FROM sys.columns
  WHERE Name = N'批次完成时间'
    AND Object_ID = Object_ID(N'生产任务')
)
BEGIN
  ALTER TABLE 生产任务 DROP COLUMN 批次完成时间;
END

