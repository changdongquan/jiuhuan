-- Add "产品列表" to 项目管理 (if missing)
-- Note: 兼容旧字段“产品图号列表”，会自动回填到“产品列表”
IF COL_LENGTH('项目管理', '产品列表') IS NULL
BEGIN
  ALTER TABLE 项目管理
  ADD 产品列表 NVARCHAR(MAX) NULL;
END;

GO

-- Backfill from legacy column 产品图号列表 (if present)
IF COL_LENGTH('项目管理', '产品图号列表') IS NOT NULL
BEGIN
  UPDATE 项目管理
  SET 产品列表 = 产品图号列表
  WHERE (产品列表 IS NULL OR 产品列表 = '' OR 产品列表 = '[]')
    AND 产品图号列表 IS NOT NULL
    AND 产品图号列表 != ''
    AND 产品图号列表 != '[]';
END;

GO

-- Backfill from 货物信息.产品图号 (main drawing) when 产品列表 still empty
IF COL_LENGTH('货物信息', '产品图号') IS NOT NULL
BEGIN
  UPDATE p
  SET p.产品列表 = '["' + REPLACE(REPLACE(g.产品图号, '"', '""'), '''', '''''') + '"]'
  FROM 项目管理 p
  INNER JOIN (
    SELECT 项目编号,
           (SELECT TOP 1 产品图号
            FROM 货物信息
            WHERE 项目编号 = g1.项目编号
            ORDER BY 货物ID) as 产品图号
    FROM 货物信息 g1
    GROUP BY 项目编号
  ) g ON p.项目编号 = g.项目编号
  WHERE g.产品图号 IS NOT NULL
    AND g.产品图号 != ''
    AND (p.产品列表 IS NULL OR p.产品列表 = '' OR p.产品列表 = '[]');
END;
