/*
  目的：为“塑胶模具”项目补充模具信息字段（抽芯/顶出/复位）。
  表：项目管理

  字段说明：
  - 抽芯明细：JSON 字符串（NVARCHAR(MAX)），形如：
      [{"方式":"斜导柱","数量":2},{"方式":"油缸","数量":1}]
  - 顶出类型 / 顶出方式 / 复位方式：多选字符串（逗号分隔）
*/

SET NOCOUNT ON;
BEGIN TRY
  BEGIN TRAN;

  IF COL_LENGTH(N'项目管理', N'抽芯明细') IS NULL
    ALTER TABLE 项目管理 ADD 抽芯明细 NVARCHAR(MAX) NULL;

  IF COL_LENGTH(N'项目管理', N'顶出类型') IS NULL
    ALTER TABLE 项目管理 ADD 顶出类型 NVARCHAR(100) NULL;

  IF COL_LENGTH(N'项目管理', N'顶出方式') IS NULL
    ALTER TABLE 项目管理 ADD 顶出方式 NVARCHAR(100) NULL;

  IF COL_LENGTH(N'项目管理', N'复位方式') IS NULL
    ALTER TABLE 项目管理 ADD 复位方式 NVARCHAR(100) NULL;

  COMMIT;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK;
  THROW;
END CATCH;

