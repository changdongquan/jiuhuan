-- Add "产品名称列表" to 项目管理 (if missing)
IF COL_LENGTH('项目管理', '产品名称列表') IS NULL
BEGIN
  ALTER TABLE 项目管理
  ADD 产品名称列表 NVARCHAR(MAX) NULL;
END;

GO

-- Backfill from 货物信息.产品名称 (main product name) when 产品名称列表 empty
IF COL_LENGTH('货物信息', '产品名称') IS NOT NULL
BEGIN
  UPDATE p
  SET p.产品名称列表 = '["' + REPLACE(REPLACE(g.产品名称, '"', '""'), '''', '''''') + '"]'
  FROM 项目管理 p
  INNER JOIN (
    SELECT 项目编号,
           (SELECT TOP 1 产品名称
            FROM 货物信息
            WHERE 项目编号 = g1.项目编号
            ORDER BY 货物ID) as 产品名称
    FROM 货物信息 g1
    GROUP BY 项目编号
  ) g ON p.项目编号 = g.项目编号
  WHERE g.产品名称 IS NOT NULL
    AND g.产品名称 != ''
    AND (p.产品名称列表 IS NULL OR p.产品名称列表 = '' OR p.产品名称列表 = '[]');
END;
