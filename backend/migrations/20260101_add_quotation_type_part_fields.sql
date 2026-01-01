/*
  报价单：新增报价类型（改模/零件）并支持零件明细存储

  目标：
  - 报价单号仍全局唯一
  - 用“报价类型”区分：mold（改模），part（零件）
  - 零件报价使用“零件明细”JSON字段存行项目
  - 对于零件报价，原“模具编号/申请更改部门/申请更改人/加工零件名称”等字段允许为空
*/

SET NOCOUNT ON;
BEGIN TRY
  BEGIN TRAN;

  IF COL_LENGTH(N'报价单', N'报价类型') IS NULL
  BEGIN
    ALTER TABLE 报价单
    ADD 报价类型 NVARCHAR(20) NOT NULL
      CONSTRAINT DF_报价单_报价类型 DEFAULT (N'mold');
  END

  IF COL_LENGTH(N'报价单', N'零件明细') IS NULL
  BEGIN
    ALTER TABLE 报价单
    ADD 零件明细 NVARCHAR(MAX) NOT NULL
      CONSTRAINT DF_报价单_零件明细 DEFAULT (N'[]');
  END

  IF COL_LENGTH(N'报价单', N'联系人') IS NULL
  BEGIN
    ALTER TABLE 报价单 ADD 联系人 NVARCHAR(50) NULL;
  END

  IF COL_LENGTH(N'报价单', N'联系电话') IS NULL
  BEGIN
    ALTER TABLE 报价单 ADD 联系电话 NVARCHAR(50) NULL;
  END

  IF COL_LENGTH(N'报价单', N'交货方式') IS NULL
  BEGIN
    ALTER TABLE 报价单 ADD 交货方式 NVARCHAR(100) NULL;
  END

  IF COL_LENGTH(N'报价单', N'付款方式') IS NULL
  BEGIN
    ALTER TABLE 报价单 ADD 付款方式 NVARCHAR(100) NULL;
  END

  IF COL_LENGTH(N'报价单', N'报价有效期天数') IS NULL
  BEGIN
    ALTER TABLE 报价单 ADD 报价有效期天数 INT NULL;
  END

  -- 放宽“零件报价”不需要的字段（允许 NULL）
  -- 注意：如果列当前不是 NOT NULL，则不会报错；否则需要 ALTER COLUMN。
  IF EXISTS (
    SELECT 1
    FROM sys.columns c
    WHERE c.object_id = OBJECT_ID(N'报价单')
      AND c.name = N'加工零件名称'
      AND c.is_nullable = 0
  )
  BEGIN
    ALTER TABLE 报价单 ALTER COLUMN 加工零件名称 NVARCHAR(200) NULL;
  END

  IF EXISTS (
    SELECT 1
    FROM sys.columns c
    WHERE c.object_id = OBJECT_ID(N'报价单')
      AND c.name = N'模具编号'
      AND c.is_nullable = 0
  )
  BEGIN
    ALTER TABLE 报价单 ALTER COLUMN 模具编号 NVARCHAR(100) NULL;
  END

  IF EXISTS (
    SELECT 1
    FROM sys.columns c
    WHERE c.object_id = OBJECT_ID(N'报价单')
      AND c.name = N'申请更改部门'
      AND c.is_nullable = 0
  )
  BEGIN
    ALTER TABLE 报价单 ALTER COLUMN 申请更改部门 NVARCHAR(100) NULL;
  END

  IF EXISTS (
    SELECT 1
    FROM sys.columns c
    WHERE c.object_id = OBJECT_ID(N'报价单')
      AND c.name = N'申请更改人'
      AND c.is_nullable = 0
  )
  BEGIN
    ALTER TABLE 报价单 ALTER COLUMN 申请更改人 NVARCHAR(50) NULL;
  END

  COMMIT;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK;
  THROW;
END CATCH;

