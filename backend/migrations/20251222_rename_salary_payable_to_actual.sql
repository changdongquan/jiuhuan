-- Rename salary columns: 应发 -> 实发
-- SQL Server / MSSQL
-- Run in the target database.

BEGIN TRY
  BEGIN TRAN;

  -- 工资汇总
  IF COL_LENGTH(N'工资汇总', N'第一次应发合计') IS NOT NULL
     AND COL_LENGTH(N'工资汇总', N'第一次实发合计') IS NULL
    EXEC sp_rename N'工资汇总.第一次应发合计', N'第一次实发合计', 'COLUMN';

  IF COL_LENGTH(N'工资汇总', N'第二次应发合计') IS NOT NULL
     AND COL_LENGTH(N'工资汇总', N'第二次实发合计') IS NULL
    EXEC sp_rename N'工资汇总.第二次应发合计', N'第二次实发合计', 'COLUMN';

  IF COL_LENGTH(N'工资汇总', N'两次应发合计') IS NOT NULL
     AND COL_LENGTH(N'工资汇总', N'两次实发合计') IS NULL
    EXEC sp_rename N'工资汇总.两次应发合计', N'两次实发合计', 'COLUMN';

  IF COL_LENGTH(N'工资汇总', N'第一次实发合计') IS NOT NULL
     AND COL_LENGTH(N'工资汇总', N'第一批实发合计') IS NULL
    EXEC sp_rename N'工资汇总.第一次实发合计', N'第一批实发合计', 'COLUMN';

  IF COL_LENGTH(N'工资汇总', N'第二次实发合计') IS NOT NULL
     AND COL_LENGTH(N'工资汇总', N'第二批实发合计') IS NULL
    EXEC sp_rename N'工资汇总.第二次实发合计', N'第二批实发合计', 'COLUMN';

  -- 工资明细
  IF COL_LENGTH(N'工资明细', N'第一次应发') IS NOT NULL
     AND COL_LENGTH(N'工资明细', N'第一次实发') IS NULL
    EXEC sp_rename N'工资明细.第一次应发', N'第一次实发', 'COLUMN';

  IF COL_LENGTH(N'工资明细', N'第二次应发') IS NOT NULL
     AND COL_LENGTH(N'工资明细', N'第二次实发') IS NULL
    EXEC sp_rename N'工资明细.第二次应发', N'第二次实发', 'COLUMN';

  IF COL_LENGTH(N'工资明细', N'两次应发合计') IS NOT NULL
     AND COL_LENGTH(N'工资明细', N'两次实发合计') IS NULL
    EXEC sp_rename N'工资明细.两次应发合计', N'两次实发合计', 'COLUMN';

  IF COL_LENGTH(N'工资明细', N'第一次实发') IS NOT NULL
     AND COL_LENGTH(N'工资明细', N'第一批实发') IS NULL
    EXEC sp_rename N'工资明细.第一次实发', N'第一批实发', 'COLUMN';

  IF COL_LENGTH(N'工资明细', N'第二次实发') IS NOT NULL
     AND COL_LENGTH(N'工资明细', N'第二批实发') IS NULL
    EXEC sp_rename N'工资明细.第二次实发', N'第二批实发', 'COLUMN';

  COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH
