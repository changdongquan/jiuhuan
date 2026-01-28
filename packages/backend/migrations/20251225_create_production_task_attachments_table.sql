-- Create 生产任务附件 table
-- SQL Server / MSSQL

BEGIN TRY
  BEGIN TRAN;

  IF OBJECT_ID(N'dbo.生产任务附件', N'U') IS NULL
  BEGIN
    CREATE TABLE dbo.生产任务附件 (
      附件ID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
      项目编号 NVARCHAR(50) NOT NULL,
      附件类型 NVARCHAR(20) NOT NULL, -- photo | inspection
      附件标签 NVARCHAR(20) NULL, -- photo: appearance | nameplate
      原始文件名 NVARCHAR(255) NOT NULL,
      存储文件名 NVARCHAR(255) NOT NULL,
      相对路径 NVARCHAR(255) NOT NULL,
      文件大小 BIGINT NOT NULL,
      内容类型 NVARCHAR(100) NULL,
      上传时间 DATETIME2 NOT NULL CONSTRAINT DF_生产任务附件_上传时间 DEFAULT (SYSDATETIME()),
      上传人 NVARCHAR(100) NULL
    );

    CREATE INDEX IX_生产任务附件_项目编号 ON dbo.生产任务附件 (项目编号);
    CREATE INDEX IX_生产任务附件_项目编号_类型 ON dbo.生产任务附件 (项目编号, 附件类型, 上传时间 DESC, 附件ID DESC);
    CREATE INDEX IX_生产任务附件_项目编号_类型_标签 ON dbo.生产任务附件 (项目编号, 附件类型, 附件标签, 上传时间 DESC, 附件ID DESC);

    ALTER TABLE dbo.生产任务附件
    ADD CONSTRAINT FK_生产任务附件_生产任务
    FOREIGN KEY (项目编号) REFERENCES dbo.生产任务(项目编号)
    ON DELETE CASCADE;
  END

  COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH
