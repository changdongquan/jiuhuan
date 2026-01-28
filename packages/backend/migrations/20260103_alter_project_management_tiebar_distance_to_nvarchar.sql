/*
  目的：允许“拉杆间距”录入类似 70x70 的文本（不再强制纯数字）。
  处理：将 项目管理.拉杆间距 列类型改为 NVARCHAR(50) NULL。

  备注：
  - 该列历史若为数字，改类型后会以字符串形式保留（例如 0/120 等）。
  - 如仍存在默认约束，会先删除默认约束再改列类型。
*/

SET NOCOUNT ON;
BEGIN TRY
  BEGIN TRAN;

  IF COL_LENGTH(N'项目管理', N'拉杆间距') IS NOT NULL
  BEGIN
    DECLARE @objectId INT = OBJECT_ID(N'项目管理');
    DECLARE @columnId INT = (
      SELECT column_id FROM sys.columns WHERE object_id = @objectId AND name = N'拉杆间距'
    );

    -- 删除默认约束（若存在）
    DECLARE @dcName NVARCHAR(128) = (
      SELECT dc.name
      FROM sys.default_constraints dc
      WHERE dc.parent_object_id = @objectId
        AND dc.parent_column_id = @columnId
    );

    IF @dcName IS NOT NULL
    BEGIN
      EXEC (N'ALTER TABLE 项目管理 DROP CONSTRAINT [' + @dcName + N'];');
    END

    -- 如果当前不是 NVARCHAR，则改为 NVARCHAR(50)
    IF NOT EXISTS (
      SELECT 1
      FROM sys.columns c
      JOIN sys.types t ON c.user_type_id = t.user_type_id
      WHERE c.object_id = @objectId
        AND c.column_id = @columnId
        AND t.name = N'nvarchar'
    )
    BEGIN
      ALTER TABLE 项目管理 ALTER COLUMN 拉杆间距 NVARCHAR(50) NULL;
    END
  END

  COMMIT;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK;
  THROW;
END CATCH;

