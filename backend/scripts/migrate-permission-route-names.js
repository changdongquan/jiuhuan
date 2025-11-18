/**
 * 一次性迁移 permissions 表中部分路由名称和路径，
 * 使其与前端路由 name/path 保持一致。
 *
 * 使用方法（在服务器上执行）：
 *   cd /opt/jh-craftsys/source/backend
 *   node scripts/migrate-permission-route-names.js
 */

const sql = require('mssql')
const config = require('../config')

const MAPPINGS = [
  {
    oldName: 'ProjectInfo',
    newName: 'ProjectInfoIndex',
    routePath: '/project-info/index',
    parentRoute: 'ProjectInfo'
  },
  {
    oldName: 'CustomerInfo',
    newName: 'CustomerInfoIndex',
    routePath: '/customer-info/index',
    parentRoute: 'CustomerInfo'
  },
  {
    oldName: 'SupplierInfo',
    newName: 'SupplierInfoIndex',
    routePath: '/supplier-info/index',
    parentRoute: 'SupplierInfo'
  },
  {
    oldName: 'EmployeeInfo',
    newName: 'EmployeeInfoIndex',
    routePath: '/employee-info/index',
    parentRoute: 'EmployeeInfo'
  },
  {
    oldName: 'ComprehensiveQuery',
    newName: 'ComprehensiveQuery',
    routePath: '/financial-management/comprehensive-query',
    parentRoute: 'FinancialManagement'
  }
]

async function migratePermissionRouteNames() {
  let pool

  try {
    console.log('正在连接数据库以迁移 permissions 路由名称...')
    console.log('数据库配置:', {
      server: config.server,
      database: config.database,
      user: config.user
    })

    pool = await sql.connect(config)
    console.log('✅ 数据库连接成功')

    for (const m of MAPPINGS) {
      console.log(
        `\n处理权限路由: ${m.oldName} -> ${m.newName}, path=${m.routePath}, parent=${m.parentRoute}`
      )

      // 如果已经是新名称，则只更新 path/parent
      const result = await pool.request().query(`
        IF EXISTS (SELECT 1 FROM permissions WHERE route_name = '${m.newName}')
        BEGIN
          UPDATE permissions
          SET route_path = '${m.routePath}',
              parent_route = '${m.parentRoute}'
          WHERE route_name = '${m.newName}';
          SELECT '${m.newName}' AS route_name, 'updated-existing' AS action;
        END
        ELSE IF EXISTS (SELECT 1 FROM permissions WHERE route_name = '${m.oldName}')
        BEGIN
          UPDATE permissions
          SET route_name = '${m.newName}',
              route_path = '${m.routePath}',
              parent_route = '${m.parentRoute}'
          WHERE route_name = '${m.oldName}';
          SELECT '${m.oldName}' AS route_name, 'renamed' AS action;
        END
        ELSE
        BEGIN
          SELECT '${m.oldName}' AS route_name, 'not-found' AS action;
        END
      `)

      const info = result.recordset && result.recordset[0]
      if (info) {
        console.log(`➡ 结果: ${info.route_name} - ${info.action}`)
      }
    }

    console.log('\n🎉 路由名称迁移完成')
  } catch (err) {
    console.error('💥 路由名称迁移失败:', err)
    throw err
  } finally {
    if (pool) {
      await pool.close()
      console.log('数据库连接已关闭')
    }
  }
}

if (require.main === module) {
  migratePermissionRouteNames()
    .then(() => process.exit(0))
    .catch(() => process.exit(1))
}

module.exports = { migratePermissionRouteNames }
