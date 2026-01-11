-- 添加零件图示URL字段到项目管理表
-- 执行时间：2024-01-XX

-- 检查字段是否存在，如果不存在则添加
IF NOT EXISTS (
    SELECT * 
    FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'dbo.项目管理') 
    AND name = N'零件图示URL'
)
BEGIN
    ALTER TABLE 项目管理
    ADD 零件图示URL NVARCHAR(500) NULL
    
    PRINT '已添加字段：零件图示URL'
END
ELSE
BEGIN
    PRINT '字段 零件图示URL 已存在，跳过'
END

GO

