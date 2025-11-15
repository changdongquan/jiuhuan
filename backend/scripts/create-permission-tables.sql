-- 权限管理系统数据库表创建脚本
-- 创建时间: 2025-11-15

-- 1. 权限表：存储所有页面权限
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[permissions]') AND type in (N'U'))
BEGIN
    CREATE TABLE permissions (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        route_name VARCHAR(100) NOT NULL UNIQUE,  -- 路由名称（唯一标识，如：SalesOrdersIndex）
        route_path VARCHAR(200) NULL,              -- 路由路径（显示用，如：/sales-orders/index）
        page_title VARCHAR(100) NULL,               -- 页面标题（显示用，如：销售订单）
        parent_route VARCHAR(100) NULL,             -- 父路由（用于菜单分组，可选）
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE()
    )
    
    -- 创建索引
    CREATE INDEX idx_route_name ON permissions(route_name)
    CREATE INDEX idx_parent_route ON permissions(parent_route)
    
    PRINT '权限表 permissions 创建成功'
END
ELSE
BEGIN
    PRINT '权限表 permissions 已存在'
END
GO

-- 2. 用户权限表：用户-页面权限关系
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[user_permissions]') AND type in (N'U'))
BEGIN
    CREATE TABLE user_permissions (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        username VARCHAR(100) NOT NULL,            -- AD 用户名（sAMAccountName）
        permission_id BIGINT NOT NULL,             -- 权限ID
        created_at DATETIME2 DEFAULT GETDATE(),
        FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
        UNIQUE(username, permission_id)           -- 防止重复分配
    )
    
    -- 创建索引
    CREATE INDEX idx_username ON user_permissions(username)
    CREATE INDEX idx_permission_id ON user_permissions(permission_id)
    
    PRINT '用户权限表 user_permissions 创建成功'
END
ELSE
BEGIN
    PRINT '用户权限表 user_permissions 已存在'
END
GO

-- 3. 组权限表：组-页面权限关系
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[group_permissions]') AND type in (N'U'))
BEGIN
    CREATE TABLE group_permissions (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        group_dn VARCHAR(500) NOT NULL,            -- AD 组 DN（唯一标识，如：CN=模具组,OU=模具,DC=JIUHUAN,DC=LOCAL）
        group_name VARCHAR(100) NOT NULL,          -- 组名（显示用，如：模具组）
        permission_id BIGINT NOT NULL,            -- 权限ID
        created_at DATETIME2 DEFAULT GETDATE(),
        FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
        UNIQUE(group_dn, permission_id)            -- 防止重复分配
    )
    
    -- 创建索引
    CREATE INDEX idx_group_dn ON group_permissions(group_dn)
    CREATE INDEX idx_group_permission_id ON group_permissions(permission_id)
    
    PRINT '组权限表 group_permissions 创建成功'
END
ELSE
BEGIN
    PRINT '组权限表 group_permissions 已存在'
END
GO

-- 4. 创建更新触发器（自动更新 updated_at）
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[trg_permissions_update]') AND type = 'TR')
BEGIN
    DROP TRIGGER trg_permissions_update
END
GO

CREATE TRIGGER trg_permissions_update
ON permissions
AFTER UPDATE
AS
BEGIN
    UPDATE permissions
    SET updated_at = GETDATE()
    FROM permissions p
    INNER JOIN inserted i ON p.id = i.id
END
GO

PRINT '权限管理系统数据库表创建完成'
GO

