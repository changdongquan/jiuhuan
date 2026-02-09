-- Soft delete support: 状态/删除前状态/删除时间/删除人
-- Convention:
-- - 状态 = N'已删除' means soft-deleted
-- - 删除前状态 stores previous 状态 value for restore

-- dbo.货物信息
IF OBJECT_ID(N'dbo.货物信息', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.货物信息', N'状态') IS NULL
    ALTER TABLE dbo.货物信息 ADD 状态 NVARCHAR(20) NULL;
  IF COL_LENGTH(N'dbo.货物信息', N'删除前状态') IS NULL
    ALTER TABLE dbo.货物信息 ADD 删除前状态 NVARCHAR(20) NULL;
  IF COL_LENGTH(N'dbo.货物信息', N'删除时间') IS NULL
    ALTER TABLE dbo.货物信息 ADD 删除时间 DATETIME2 NULL;
  IF COL_LENGTH(N'dbo.货物信息', N'删除人') IS NULL
    ALTER TABLE dbo.货物信息 ADD 删除人 NVARCHAR(100) NULL;
END;

GO

-- dbo.项目管理
IF OBJECT_ID(N'dbo.项目管理', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.项目管理', N'状态') IS NULL
    ALTER TABLE dbo.项目管理 ADD 状态 NVARCHAR(20) NULL;
  IF COL_LENGTH(N'dbo.项目管理', N'删除前状态') IS NULL
    ALTER TABLE dbo.项目管理 ADD 删除前状态 NVARCHAR(20) NULL;
  IF COL_LENGTH(N'dbo.项目管理', N'删除时间') IS NULL
    ALTER TABLE dbo.项目管理 ADD 删除时间 DATETIME2 NULL;
  IF COL_LENGTH(N'dbo.项目管理', N'删除人') IS NULL
    ALTER TABLE dbo.项目管理 ADD 删除人 NVARCHAR(100) NULL;
END;

GO

-- dbo.生产任务
IF OBJECT_ID(N'dbo.生产任务', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.生产任务', N'状态') IS NULL
    ALTER TABLE dbo.生产任务 ADD 状态 NVARCHAR(20) NULL;
  IF COL_LENGTH(N'dbo.生产任务', N'删除前状态') IS NULL
    ALTER TABLE dbo.生产任务 ADD 删除前状态 NVARCHAR(20) NULL;
  IF COL_LENGTH(N'dbo.生产任务', N'删除时间') IS NULL
    ALTER TABLE dbo.生产任务 ADD 删除时间 DATETIME2 NULL;
  IF COL_LENGTH(N'dbo.生产任务', N'删除人') IS NULL
    ALTER TABLE dbo.生产任务 ADD 删除人 NVARCHAR(100) NULL;
END;

GO

-- dbo.销售订单
IF OBJECT_ID(N'dbo.销售订单', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.销售订单', N'状态') IS NULL
    ALTER TABLE dbo.销售订单 ADD 状态 NVARCHAR(20) NULL;
  IF COL_LENGTH(N'dbo.销售订单', N'删除前状态') IS NULL
    ALTER TABLE dbo.销售订单 ADD 删除前状态 NVARCHAR(20) NULL;
  IF COL_LENGTH(N'dbo.销售订单', N'删除时间') IS NULL
    ALTER TABLE dbo.销售订单 ADD 删除时间 DATETIME2 NULL;
  IF COL_LENGTH(N'dbo.销售订单', N'删除人') IS NULL
    ALTER TABLE dbo.销售订单 ADD 删除人 NVARCHAR(100) NULL;
END;

GO

-- dbo.销售订单附件
IF OBJECT_ID(N'dbo.销售订单附件', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.销售订单附件', N'状态') IS NULL
    ALTER TABLE dbo.销售订单附件 ADD 状态 NVARCHAR(20) NULL;
  IF COL_LENGTH(N'dbo.销售订单附件', N'删除前状态') IS NULL
    ALTER TABLE dbo.销售订单附件 ADD 删除前状态 NVARCHAR(20) NULL;
  IF COL_LENGTH(N'dbo.销售订单附件', N'删除时间') IS NULL
    ALTER TABLE dbo.销售订单附件 ADD 删除时间 DATETIME2 NULL;
  IF COL_LENGTH(N'dbo.销售订单附件', N'删除人') IS NULL
    ALTER TABLE dbo.销售订单附件 ADD 删除人 NVARCHAR(100) NULL;
END;

GO

-- dbo.出库单明细
IF OBJECT_ID(N'dbo.出库单明细', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.出库单明细', N'状态') IS NULL
    ALTER TABLE dbo.出库单明细 ADD 状态 NVARCHAR(20) NULL;
  IF COL_LENGTH(N'dbo.出库单明细', N'删除前状态') IS NULL
    ALTER TABLE dbo.出库单明细 ADD 删除前状态 NVARCHAR(20) NULL;
  IF COL_LENGTH(N'dbo.出库单明细', N'删除时间') IS NULL
    ALTER TABLE dbo.出库单明细 ADD 删除时间 DATETIME2 NULL;
  IF COL_LENGTH(N'dbo.出库单明细', N'删除人') IS NULL
    ALTER TABLE dbo.出库单明细 ADD 删除人 NVARCHAR(100) NULL;
END;

GO

-- dbo.出库单附件
IF OBJECT_ID(N'dbo.出库单附件', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.出库单附件', N'状态') IS NULL
    ALTER TABLE dbo.出库单附件 ADD 状态 NVARCHAR(20) NULL;
  IF COL_LENGTH(N'dbo.出库单附件', N'删除前状态') IS NULL
    ALTER TABLE dbo.出库单附件 ADD 删除前状态 NVARCHAR(20) NULL;
  IF COL_LENGTH(N'dbo.出库单附件', N'删除时间') IS NULL
    ALTER TABLE dbo.出库单附件 ADD 删除时间 DATETIME2 NULL;
  IF COL_LENGTH(N'dbo.出库单附件', N'删除人') IS NULL
    ALTER TABLE dbo.出库单附件 ADD 删除人 NVARCHAR(100) NULL;
END;

GO

-- dbo.项目管理附件
IF OBJECT_ID(N'dbo.项目管理附件', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.项目管理附件', N'状态') IS NULL
    ALTER TABLE dbo.项目管理附件 ADD 状态 NVARCHAR(20) NULL;
  IF COL_LENGTH(N'dbo.项目管理附件', N'删除前状态') IS NULL
    ALTER TABLE dbo.项目管理附件 ADD 删除前状态 NVARCHAR(20) NULL;
  IF COL_LENGTH(N'dbo.项目管理附件', N'删除时间') IS NULL
    ALTER TABLE dbo.项目管理附件 ADD 删除时间 DATETIME2 NULL;
  IF COL_LENGTH(N'dbo.项目管理附件', N'删除人') IS NULL
    ALTER TABLE dbo.项目管理附件 ADD 删除人 NVARCHAR(100) NULL;
END;

GO

-- dbo.生产任务附件
IF OBJECT_ID(N'dbo.生产任务附件', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.生产任务附件', N'状态') IS NULL
    ALTER TABLE dbo.生产任务附件 ADD 状态 NVARCHAR(20) NULL;
  IF COL_LENGTH(N'dbo.生产任务附件', N'删除前状态') IS NULL
    ALTER TABLE dbo.生产任务附件 ADD 删除前状态 NVARCHAR(20) NULL;
  IF COL_LENGTH(N'dbo.生产任务附件', N'删除时间') IS NULL
    ALTER TABLE dbo.生产任务附件 ADD 删除时间 DATETIME2 NULL;
  IF COL_LENGTH(N'dbo.生产任务附件', N'删除人') IS NULL
    ALTER TABLE dbo.生产任务附件 ADD 删除人 NVARCHAR(100) NULL;
END;

GO

-- dbo.试模过程
IF OBJECT_ID(N'dbo.试模过程', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.试模过程', N'状态') IS NULL
    ALTER TABLE dbo.试模过程 ADD 状态 NVARCHAR(20) NULL;
  IF COL_LENGTH(N'dbo.试模过程', N'删除前状态') IS NULL
    ALTER TABLE dbo.试模过程 ADD 删除前状态 NVARCHAR(20) NULL;
  IF COL_LENGTH(N'dbo.试模过程', N'删除时间') IS NULL
    ALTER TABLE dbo.试模过程 ADD 删除时间 DATETIME2 NULL;
  IF COL_LENGTH(N'dbo.试模过程', N'删除人') IS NULL
    ALTER TABLE dbo.试模过程 ADD 删除人 NVARCHAR(100) NULL;
END;

GO

-- dbo.试模过程附件
IF OBJECT_ID(N'dbo.试模过程附件', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.试模过程附件', N'状态') IS NULL
    ALTER TABLE dbo.试模过程附件 ADD 状态 NVARCHAR(20) NULL;
  IF COL_LENGTH(N'dbo.试模过程附件', N'删除前状态') IS NULL
    ALTER TABLE dbo.试模过程附件 ADD 删除前状态 NVARCHAR(20) NULL;
  IF COL_LENGTH(N'dbo.试模过程附件', N'删除时间') IS NULL
    ALTER TABLE dbo.试模过程附件 ADD 删除时间 DATETIME2 NULL;
  IF COL_LENGTH(N'dbo.试模过程附件', N'删除人') IS NULL
    ALTER TABLE dbo.试模过程附件 ADD 删除人 NVARCHAR(100) NULL;
END;

