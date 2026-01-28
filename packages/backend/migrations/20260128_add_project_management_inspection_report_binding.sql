/*
  目的：为「项目管理附件」增加“检验报告”更稳定的绑定字段

  绑定规则：
  - 项目编号 + 绑定产品图号（产品图号为空时使用 绑定行序号 rowIndex）
  - 支持多文件
  - 支持孤儿：当图号为空且该行被删除时，将附件标记为未绑定/已删除行，便于后续查找/迁移
*/

SET NOCOUNT ON;
BEGIN TRY
  BEGIN TRAN;

  IF OBJECT_ID(N'dbo.项目管理附件', N'U') IS NOT NULL
  BEGIN
    IF COL_LENGTH(N'dbo.项目管理附件', N'绑定产品图号') IS NULL
      ALTER TABLE dbo.项目管理附件 ADD 绑定产品图号 NVARCHAR(150) NULL;

    IF COL_LENGTH(N'dbo.项目管理附件', N'绑定行序号') IS NULL
      ALTER TABLE dbo.项目管理附件 ADD 绑定行序号 INT NULL;

    IF COL_LENGTH(N'dbo.项目管理附件', N'是否孤儿') IS NULL
      ALTER TABLE dbo.项目管理附件 ADD 是否孤儿 BIT NOT NULL CONSTRAINT DF_项目管理附件_是否孤儿 DEFAULT (0);

    IF COL_LENGTH(N'dbo.项目管理附件', N'孤儿原因') IS NULL
      ALTER TABLE dbo.项目管理附件 ADD 孤儿原因 NVARCHAR(50) NULL;

    IF COL_LENGTH(N'dbo.项目管理附件', N'孤儿行序号') IS NULL
      ALTER TABLE dbo.项目管理附件 ADD 孤儿行序号 INT NULL;

    IF NOT EXISTS (
      SELECT 1
      FROM sys.indexes
      WHERE name = N'IX_项目管理附件_检验报告_绑定'
        AND object_id = OBJECT_ID(N'dbo.项目管理附件')
    )
    BEGIN
      CREATE INDEX IX_项目管理附件_检验报告_绑定
      ON dbo.项目管理附件 (项目编号, 附件类型, 绑定产品图号, 绑定行序号, 是否孤儿, 上传时间 DESC, 附件ID DESC);
    END
  END

  COMMIT;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK;
  THROW;
END CATCH;

