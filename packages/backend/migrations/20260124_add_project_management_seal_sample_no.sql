-- Add "封样单号" to 项目管理 (if missing)
IF COL_LENGTH('项目管理', '封样单号') IS NULL
BEGIN
  ALTER TABLE 项目管理
  ADD 封样单号 NVARCHAR(200) NULL;
END;

