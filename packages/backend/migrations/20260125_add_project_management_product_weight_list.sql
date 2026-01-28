-- Add "产品重量列表" to 项目管理 (if missing)
IF COL_LENGTH('项目管理', '产品重量列表') IS NULL
BEGIN
  ALTER TABLE 项目管理
  ADD 产品重量列表 NVARCHAR(MAX) NULL;
END;

GO

-- Default to [] when empty (optional normalization)
UPDATE 项目管理
SET 产品重量列表 = '[]'
WHERE 产品重量列表 IS NULL;

GO

-- Backfill from legacy column 产品重量 (single value) when 产品重量列表 empty
IF COL_LENGTH('项目管理', '产品重量') IS NOT NULL
BEGIN
  IF COL_LENGTH('项目管理', '产品列表') IS NOT NULL
  BEGIN
    UPDATE p
    SET p.产品重量列表 =
      CASE
        WHEN p.产品列表 IS NOT NULL AND ISJSON(p.产品列表) = 1 AND listCnt.cnt > 0 AND p.产品列表 != '[]'
          THEN '[' + STUFF(REPLICATE(',' + w.weight_str, listCnt.cnt), 1, 1, '') + ']'
        ELSE '[' + w.weight_str + ']'
      END
    FROM 项目管理 p
    CROSS APPLY (
      SELECT CAST(COALESCE(TRY_CONVERT(DECIMAL(18, 2), p.产品重量), 0) AS NVARCHAR(50)) as weight_str
    ) w
    OUTER APPLY (
      SELECT COUNT(1) as cnt
      FROM OPENJSON(CASE WHEN ISJSON(p.产品列表) = 1 THEN p.产品列表 ELSE '[]' END)
    ) listCnt
    WHERE (p.产品重量列表 IS NULL OR p.产品重量列表 = '' OR p.产品重量列表 = '[]')
      AND p.产品重量 IS NOT NULL
      AND TRY_CONVERT(DECIMAL(18, 2), p.产品重量) IS NOT NULL
      AND TRY_CONVERT(DECIMAL(18, 2), p.产品重量) > 0;
  END
  ELSE
  BEGIN
    UPDATE 项目管理
    SET 产品重量列表 =
      '[' + CAST(COALESCE(TRY_CONVERT(DECIMAL(18, 2), 产品重量), 0) AS NVARCHAR(50)) + ']'
    WHERE (产品重量列表 IS NULL OR 产品重量列表 = '' OR 产品重量列表 = '[]')
      AND 产品重量 IS NOT NULL
      AND TRY_CONVERT(DECIMAL(18, 2), 产品重量) IS NOT NULL
      AND TRY_CONVERT(DECIMAL(18, 2), 产品重量) > 0;
  END
END;
