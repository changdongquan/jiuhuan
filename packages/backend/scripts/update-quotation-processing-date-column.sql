-- 更新 报价单 表字段：
-- 1. 将「加工周期」列重命名为「加工日期」
-- 2. 同时将相关索引名称从 IX_报价单_加工周期 重命名为 IX_报价单_加工日期（如果存在）
--
-- 注意：
-- - 请在执行前确认应用代码已经更新为使用「加工日期」这一列名。
-- - 建议先在测试库执行验证，再在正式库执行。

-- 1) 将列「加工周期」重命名为「加工日期」
IF EXISTS (
  SELECT 1
  FROM sys.columns
  WHERE Name = N'加工周期'
    AND Object_ID = Object_ID(N'报价单')
) AND NOT EXISTS (
  SELECT 1
  FROM sys.columns
  WHERE Name = N'加工日期'
    AND Object_ID = Object_ID(N'报价单')
)
BEGIN
  EXEC sp_rename N'报价单.加工周期', N'加工日期', 'COLUMN';
END

-- 2) 将索引 IX_报价单_加工周期 重命名为 IX_报价单_加工日期（如果存在）
IF EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = N'IX_报价单_加工周期'
    AND object_id = OBJECT_ID(N'报价单')
)
BEGIN
  EXEC sp_rename N'报价单.IX_报价单_加工周期', N'IX_报价单_加工日期', 'INDEX';
END

