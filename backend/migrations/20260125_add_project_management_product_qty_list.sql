-- Add "产品数量列表" to 项目管理 (if missing)
IF COL_LENGTH('项目管理', '产品数量列表') IS NULL
BEGIN
  ALTER TABLE 项目管理
  ADD 产品数量列表 NVARCHAR(MAX) NULL;
END;

GO

-- Default to 0 when empty (optional normalization)
UPDATE 项目管理
SET 产品数量列表 = '[]'
WHERE 产品数量列表 IS NULL;

