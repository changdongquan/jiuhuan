-- 方案 A：初始化标记（历史数据默认 0，首次初始化后置 1）
-- 注意：若你们已经存在同名字段，请跳过此脚本。

ALTER TABLE 项目管理
ADD init_done BIT NOT NULL CONSTRAINT DF_项目管理_init_done DEFAULT (0);

-- 可选：记录初始化时间/操作者（如不需要可删除）
-- ALTER TABLE 项目管理 ADD init_done_at DATETIME NULL;
-- ALTER TABLE 项目管理 ADD init_done_by INT NULL;

