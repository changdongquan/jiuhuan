-- Add "合计工时" to 生产任务 (if missing)
IF COL_LENGTH('生产任务', '合计工时') IS NULL
BEGIN
  ALTER TABLE 生产任务
  ADD 合计工时 DECIMAL(10, 1) NULL;
END;

GO

-- Backfill total hours (if any hour field exists)
UPDATE 生产任务
SET 合计工时 = CASE
  WHEN 电极加工工时 IS NULL
    AND 加工中心工时 IS NULL
    AND 线切割工时 IS NULL
    AND 放电工时 IS NULL
    AND 机加工时 IS NULL
    AND 抛光工时 IS NULL
    AND 装配工时 IS NULL
    AND 试模工时 IS NULL
    THEN NULL
  ELSE
    ISNULL(电极加工工时, 0)
    + ISNULL(加工中心工时, 0)
    + ISNULL(线切割工时, 0)
    + ISNULL(放电工时, 0)
    + ISNULL(机加工时, 0)
    + ISNULL(抛光工时, 0)
    + ISNULL(装配工时, 0)
    + ISNULL(试模工时, 0)
END;
