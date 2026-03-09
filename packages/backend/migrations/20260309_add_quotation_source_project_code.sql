IF COL_LENGTH(N'报价单', N'来源项目编号') IS NULL
BEGIN
  ALTER TABLE 报价单
    ADD 来源项目编号 NVARCHAR(50) NULL;
END
GO

;WITH mold_quotations AS (
  SELECT
    q.报价单ID AS quotationId,
    LTRIM(RTRIM(ISNULL(q.模具编号, N''))) AS moldNo
  FROM 报价单 q
  WHERE (q.报价类型 = N'mold' OR q.报价类型 = N'修改模具')
    AND LTRIM(RTRIM(ISNULL(q.模具编号, N''))) <> N''
),
matched_projects AS (
  SELECT
    mq.quotationId,
    p.项目编号 AS projectCode,
    ROW_NUMBER() OVER (
      PARTITION BY mq.quotationId
      ORDER BY
        CASE
          WHEN LTRIM(RTRIM(ISNULL(p.客户模号, N''))) = mq.moldNo THEN 0
          ELSE 1
        END,
        p.项目编号 DESC
    ) AS rn
  FROM mold_quotations mq
  INNER JOIN 项目管理 p
    ON p.客户模号 IS NOT NULL
   AND LTRIM(RTRIM(p.客户模号)) <> N''
   AND (
        LTRIM(RTRIM(p.客户模号)) = mq.moldNo
        OR p.客户模号 LIKE N'%' + mq.moldNo + N'%'
       )
)
UPDATE q
SET q.来源项目编号 = mp.projectCode
FROM 报价单 q
INNER JOIN matched_projects mp
  ON mp.quotationId = q.报价单ID
 AND mp.rn = 1
WHERE (q.来源项目编号 IS NULL OR LTRIM(RTRIM(q.来源项目编号)) = N'');
