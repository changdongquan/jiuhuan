/**
 * 执行权限表创建脚本
 * 使用方法：node backend/scripts/create-permission-tables-run.js
 */

const sql = require('mssql')
const config = require('../config')
const fs = require('fs')
const path = require('path')

async function createPermissionTables() {
  let pool = null

  try {
    console.log('正在连接数据库...')
    console.log('数据库配置:', {
      server: config.server,
      database: config.database,
      user: config.user
    })

    pool = await sql.connect(config)
    console.log('✅ 数据库连接成功')

    console.log('\n正在执行 SQL 脚本...')

    // 1. 创建权限表
    console.log('创建权限表 permissions...')
    try {
      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[permissions]') AND type in (N'U'))
        BEGIN
            CREATE TABLE permissions (
                id BIGINT IDENTITY(1,1) PRIMARY KEY,
                route_name VARCHAR(100) NOT NULL UNIQUE,
                route_path VARCHAR(200) NULL,
                page_title VARCHAR(100) NULL,
                parent_route VARCHAR(100) NULL,
                created_at DATETIME2 DEFAULT GETDATE(),
                updated_at DATETIME2 DEFAULT GETDATE()
            )
            
            CREATE INDEX idx_route_name ON permissions(route_name)
            CREATE INDEX idx_parent_route ON permissions(parent_route)
        END
      `)
      console.log('✅ 权限表 permissions 创建成功')
    } catch (err) {
      if (err.message.includes('already exists') || err.message.includes('已存在')) {
        console.log('⚠️  权限表 permissions 已存在')
      } else {
        console.error('❌ 创建权限表失败:', err.message)
        throw err
      }
    }

    // 2. 创建用户权限表
    console.log('创建用户权限表 user_permissions...')
    try {
      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[user_permissions]') AND type in (N'U'))
        BEGIN
            CREATE TABLE user_permissions (
                id BIGINT IDENTITY(1,1) PRIMARY KEY,
                username VARCHAR(100) NOT NULL,
                permission_id BIGINT NOT NULL,
                created_at DATETIME2 DEFAULT GETDATE(),
                FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
                UNIQUE(username, permission_id)
            )
            
            CREATE INDEX idx_username ON user_permissions(username)
            CREATE INDEX idx_permission_id ON user_permissions(permission_id)
        END
      `)
      console.log('✅ 用户权限表 user_permissions 创建成功')
    } catch (err) {
      if (err.message.includes('already exists') || err.message.includes('已存在')) {
        console.log('⚠️  用户权限表 user_permissions 已存在')
      } else {
        console.error('❌ 创建用户权限表失败:', err.message)
        throw err
      }
    }

    // 3. 创建组权限表
    console.log('创建组权限表 group_permissions...')
    try {
      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[group_permissions]') AND type in (N'U'))
        BEGIN
            CREATE TABLE group_permissions (
                id BIGINT IDENTITY(1,1) PRIMARY KEY,
                group_dn VARCHAR(500) NOT NULL,
                group_name VARCHAR(100) NOT NULL,
                permission_id BIGINT NOT NULL,
                created_at DATETIME2 DEFAULT GETDATE(),
                FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
                UNIQUE(group_dn, permission_id)
            )
            
            CREATE INDEX idx_group_dn ON group_permissions(group_dn)
            CREATE INDEX idx_group_permission_id ON group_permissions(permission_id)
        END
      `)
      console.log('✅ 组权限表 group_permissions 创建成功')
    } catch (err) {
      if (err.message.includes('already exists') || err.message.includes('已存在')) {
        console.log('⚠️  组权限表 group_permissions 已存在')
      } else {
        console.error('❌ 创建组权限表失败:', err.message)
        throw err
      }
    }

    // 4. 创建更新触发器
    console.log('创建更新触发器...')
    try {
      await pool.request().query(`
        IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[trg_permissions_update]') AND type = 'TR')
        BEGIN
            DROP TRIGGER trg_permissions_update
        END
      `)

      await pool.request().query(`
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
      `)
      console.log('✅ 更新触发器创建成功')
    } catch (err) {
      console.warn('⚠️  创建触发器失败（继续）:', err.message)
    }

    console.log('\n✅ SQL 脚本执行完成！')

    // 验证表是否创建成功
    console.log('\n验证表是否创建成功...')
    const result = await pool.request().query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME IN ('permissions', 'user_permissions', 'group_permissions')
      ORDER BY TABLE_NAME
    `)

    const createdTables = result.recordset.map((r) => r.TABLE_NAME)
    console.log('已创建的表:', createdTables)

    if (createdTables.length === 3) {
      console.log('✅ 所有权限表创建成功！')

      // 查询表结构
      console.log('\n📋 表结构信息:')
      for (const tableName of createdTables) {
        const tableInfo = await pool.request().query(`
          SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_NAME = '${tableName}'
          ORDER BY ORDINAL_POSITION
        `)
        console.log(`\n表 ${tableName}:`)
        console.table(tableInfo.recordset)
      }
    } else {
      console.log('⚠️  部分表可能未创建成功')
    }
  } catch (err) {
    console.error('❌ 执行 SQL 脚本失败:', err)
    throw err
  } finally {
    if (pool) {
      await pool.close()
      console.log('\n数据库连接已关闭')
    }
  }
}

// 运行脚本
if (require.main === module) {
  createPermissionTables()
    .then(() => {
      console.log('\n🎉 脚本执行完成')
      process.exit(0)
    })
    .catch((err) => {
      console.error('\n💥 脚本执行失败:', err)
      process.exit(1)
    })
}

module.exports = { createPermissionTables }
