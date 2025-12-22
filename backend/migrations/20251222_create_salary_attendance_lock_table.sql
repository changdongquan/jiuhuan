-- 工资步骤3保存后锁定考勤：锁表（按月份）
IF OBJECT_ID(N'工资_考勤锁定', N'U') IS NULL
BEGIN
  CREATE TABLE 工资_考勤锁定 (
    ID INT IDENTITY(1,1) PRIMARY KEY,
    月份 NVARCHAR(7) NOT NULL UNIQUE,
    工资汇总ID INT NOT NULL,
    是否锁定 BIT NOT NULL DEFAULT 1,
    锁定时间 DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    解锁时间 DATETIME2 NULL,
    解锁原因 NVARCHAR(200) NULL
  );

  CREATE INDEX idx_工资_考勤锁定_月份 ON 工资_考勤锁定(月份);
END

