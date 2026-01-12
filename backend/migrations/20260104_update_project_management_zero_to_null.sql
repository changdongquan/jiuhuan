/*
  目的：将"项目管理"表中指定字段的值为 0 的记录更新为 NULL
  字段：
    - 料柄重量
    - 流道数量
    - 浇口数量
    - 机台吨位
    - 锁模力
    - 定位圈
    - 拉杆间距
    - 成型周期

  注意：
    - 拉杆间距字段类型为 NVARCHAR(50)，需要同时处理字符串 '0' 和数值 0
    - 其他字段为数值类型，直接使用 NULLIF 处理
*/

SET NOCOUNT ON;
BEGIN TRY
  BEGIN TRAN;

  -- 更新数值类型字段，将值为 0 的记录更新为 NULL
  UPDATE 项目管理
  SET
    料柄重量 = NULLIF(料柄重量, 0),
    流道数量 = NULLIF(流道数量, 0),
    浇口数量 = NULLIF(浇口数量, 0),
    机台吨位 = NULLIF(机台吨位, 0),
    锁模力 = NULLIF(锁模力, 0),
    定位圈 = NULLIF(定位圈, 0),
    成型周期 = NULLIF(成型周期, 0);

  -- 更新拉杆间距（NVARCHAR 类型），将字符串 '0' 的记录更新为 NULL
  UPDATE 项目管理
  SET 拉杆间距 = NULL
  WHERE 拉杆间距 = '0'
     OR 拉杆间距 = '0.0'
     OR 拉杆间距 = '0.00'
     OR LTRIM(RTRIM(拉杆间距)) = '0';  -- 去除前后空格后比较

  COMMIT;
  PRINT '✅ 成功将项目管理表中指定字段的值为 0 的记录更新为 NULL';
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK;
  DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
  DECLARE @ErrorSeverity INT = ERROR_SEVERITY();
  DECLARE @ErrorState INT = ERROR_STATE();
  PRINT '❌ 更新失败: ' + @ErrorMessage;
  RAISERROR(@ErrorMessage, @ErrorSeverity, @ErrorState);
END CATCH;

