/*
  目的：方案 1 —— 去掉“项目管理”表中若干数值字段的默认值 ((0))
  现象：新建项目未填写这些字段时，数据库默认写入 0，导致编辑弹窗看到很多 0。
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
    (N'成型周期'),
    (N'定位圈'),
    (N'机台吨位'),
    (N'浇口数量'),
    (N'拉杆间距'),
    (N'料柄重量'),
    (N'流道数量'),
    (N'锁模力');

  DECLARE @sql NVARCHAR(MAX) = N'';

  SELECT @sql = @sql + N'ALTER TABLE 项目管理 DROP CONSTRAINT [' + dc.name + N'];' + CHAR(10)
  FROM sys.default_constraints dc
  INNER JOIN sys.columns c
    ON c.object_id = dc.parent_object_id
   AND c.column_id = dc.parent_column_id
  INNER JOIN @cols col
    ON col.ColumnName = c.name
  WHERE dc.parent_object_id = OBJECT_ID(N'项目管理');

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
  注意：如果业务上确实存在合法的 0（例如某些数量字段），不要执行这段。

  UPDATE 项目管理
  SET
    成型周期 = NULLIF(成型周期, 0),
    定位圈 = NULLIF(定位圈, 0),
    机台吨位 = NULLIF(机台吨位, 0),
    浇口数量 = NULLIF(浇口数量, 0),
    拉杆间距 = NULLIF(拉杆间距, 0),
    料柄重量 = NULLIF(料柄重量, 0),
    流道数量 = NULLIF(流道数量, 0),
    锁模力 = NULLIF(锁模力, 0);
*/
