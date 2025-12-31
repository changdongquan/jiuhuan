/*
  目的：去掉“生产任务”表中若干数量字段的默认值 ((0))
  现象：新建生产任务未填写字段时，数据库默认写入 0，页面编辑时看到很多 0。
  处理：删除默认约束后，新增未传值将保持 NULL。

  影响范围：
  - 仅影响【新增时未传该字段】的默认行为
  - 不会自动改动历史数据（如需把历史 0 归一为 NULL，请另行确认后再做）
*/

SET NOCOUNT ON;
BEGIN TRY
  BEGIN TRAN;

  DECLARE @cols TABLE (ColumnName NVARCHAR(128) NOT NULL PRIMARY KEY);
  INSERT INTO @cols (ColumnName)
  VALUES
    (N'投产数量'),
    (N'已完成数量');

  DECLARE @sql NVARCHAR(MAX) = N'';

  SELECT @sql = @sql + N'ALTER TABLE 生产任务 DROP CONSTRAINT [' + dc.name + N'];' + CHAR(10)
  FROM sys.default_constraints dc
  INNER JOIN sys.columns c
    ON c.object_id = dc.parent_object_id
   AND c.column_id = dc.parent_column_id
  INNER JOIN @cols col
    ON col.ColumnName = c.name
  WHERE dc.parent_object_id = OBJECT_ID(N'生产任务');

  IF (@sql <> N'')
  BEGIN
    EXEC sp_executesql @sql;
  END

  COMMIT;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK;
  THROW;
END CATCH;

/*
  可选（需确认后再执行）：将历史 “0” 视作“未填写”，统一转为 NULL。
  注意：如果业务上确实存在合法的 0（例如已完成数量=0 有意义），不要执行这段。

  UPDATE 生产任务
  SET
    投产数量 = NULLIF(投产数量, 0),
    已完成数量 = NULLIF(已完成数量, 0);
*/

