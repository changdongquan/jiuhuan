/**
 * 删除旧版角色/用户相关的遗留表
 * 仅适用于当前 CraftSys 权限系统（已经改用 permissions / user_permissions / group_permissions）
 *
 * 使用方法（在服务器上执行）：
 *   cd /opt/jh-craftsys/source/backend
 *   node scripts/drop-legacy-role-tables.js
 */

const sql = require('mssql')
const config = require('../config')

// 注意：顺序按「关系表 -> 主表」排列，尽量避免外键依赖问题
const LEGACY_TABLES = ['domain_group_roles', 'user_roles', 'domain_groups', 'roles', 'users']

async function dropLegacyTables() {
  let pool

  try {
    console.log('正在连接数据库以删除遗留表...')
    console.log('数据库配置:', {
      server: config.server,
      database: config.database,
      user: config.user
    })

    pool = await sql.connect(config)
    console.log('✅ 数据库连接成功')

    for (const tableName of LEGACY_TABLES) {
      console.log(`\n检查并删除表: ${tableName}`)
      try {
        const result = await pool.request().query(`
          IF OBJECT_ID(N'[dbo].[${tableName}]', N'U') IS NOT NULL
          BEGIN
            DROP TABLE [dbo].[${tableName}];
            SELECT '${tableName}' AS TableName, 1 AS Dropped;
          END
          ELSE
          BEGIN
            SELECT '${tableName}' AS TableName, 0 AS Dropped;
          END
        `)

        const info = result.recordset && result.recordset[0]
        if (info && info.Dropped === 1) {
          console.log(`✅ 已删除表: ${info.TableName}`)
        } else {
          console.log(`ℹ️  表不存在或已删除: ${tableName}`)
        }
      } catch (err) {
        console.error(`❌ 删除表失败 ${tableName}:`, err.message)
      }
    }

    console.log('\n🎉 遗留表删除脚本执行完成')
  } catch (err) {
    console.error('💥 执行删除脚本失败:', err)
    throw err
  } finally {
    if (pool) {
      await pool.close()
      console.log('数据库连接已关闭')
    }
  }
}

if (require.main === module) {
  dropLegacyTables()
    .then(() => {
      process.exit(0)
    })
    .catch(() => {
      process.exit(1)
    })
}

module.exports = { dropLegacyTables }
