/**
 * 权限同步脚本
 * 从路由配置（asyncRouterMap）同步所有页面到 permissions 表
 *
 * 使用方法：
 * node backend/scripts/sync-routes-to-permissions.js
 */

const { query } = require('../database')
const { initDatabase } = require('../database')

// 路由配置（需要手动维护，或从前端代码提取）
// 这里列出所有需要同步的路由
const routesToSync = [
  // 销售订单
  {
    route_name: 'SalesOrdersIndex',
    route_path: '/sales-orders/index',
    page_title: '销售订单',
    parent_route: 'SalesOrders'
  },

  // 项目管理
  {
    route_name: 'ProjectManagementIndex',
    route_path: '/project-management/index',
    page_title: '项目管理',
    parent_route: 'ProjectManagement'
  },

  // 报价单（项目管理下）
  {
    route_name: 'QuotationIndex',
    route_path: '/project-management/quotation',
    page_title: '报价单',
    parent_route: 'ProjectManagement'
  },

  // 生产任务
  {
    route_name: 'ProductionTasksIndex',
    route_path: '/production-tasks/index',
    page_title: '生产任务',
    parent_route: 'ProductionTasks'
  },

  // 财务管理
  {
    route_name: 'BillingDocuments',
    route_path: '/financial-management/billing-documents',
    page_title: '开票单据',
    parent_route: 'FinancialManagement'
  },
  {
    route_name: 'ReceivableDocuments',
    route_path: '/financial-management/receivable-documents',
    page_title: '回款单据',
    parent_route: 'FinancialManagement'
  },

  // 库存管理
  {
    route_name: 'InventoryManagementOverview',
    route_path: '/inventory-management/overview',
    page_title: '库存概览',
    parent_route: 'InventoryManagement'
  },
  {
    route_name: 'InventoryInbound',
    route_path: '/inventory-management/inbound',
    page_title: '入库管理',
    parent_route: 'InventoryManagement'
  },
  {
    route_name: 'InventoryOutbound',
    route_path: '/inventory-management/outbound',
    page_title: '出库管理',
    parent_route: 'InventoryManagement'
  },
  {
    route_name: 'InventoryTransfer',
    route_path: '/inventory-management/transfer',
    page_title: '调拨管理',
    parent_route: 'InventoryManagement'
  },
  {
    route_name: 'InventoryStocktake',
    route_path: '/inventory-management/stocktake',
    page_title: '盘点管理',
    parent_route: 'InventoryManagement'
  },

  // 项目信息
  {
    route_name: 'ProjectInfoIndex',
    route_path: '/project-info/index',
    page_title: '项目信息',
    parent_route: 'ProjectInfo'
  },

  // 采购外协
  {
    route_name: 'MaterialProcurement',
    route_path: '/procurement-outsourcing/material-procurement',
    page_title: '材料采购',
    parent_route: 'ProcurementOutsourcing'
  },
  {
    route_name: 'ProcessOutsourcing',
    route_path: '/procurement-outsourcing/process-outsourcing',
    page_title: '工序外协',
    parent_route: 'ProcurementOutsourcing'
  },

  // 综合查询
  {
    route_name: 'ComprehensiveQuery',
    route_path: '/financial-management/comprehensive-query',
    page_title: '综合查询',
    parent_route: 'FinancialManagement'
  },

  // 客户信息
  {
    route_name: 'CustomerInfoIndex',
    route_path: '/customer-info/index',
    page_title: '客户信息',
    parent_route: 'CustomerInfo'
  },

  // 供方信息
  {
    route_name: 'SupplierInfoIndex',
    route_path: '/supplier-info/index',
    page_title: '供方信息',
    parent_route: 'SupplierInfo'
  },

  // 员工信息
  {
    route_name: 'EmployeeInfoIndex',
    route_path: '/employee-info/index',
    page_title: '员工信息',
    parent_route: 'EmployeeInfo'
  },

  // 考勤
  {
    route_name: 'AttendanceIndex',
    route_path: '/attendance/index',
    page_title: '考勤',
    parent_route: 'Attendance'
  },

  // 仪表盘
  {
    route_name: 'Analysis',
    route_path: '/dashboard/analysis',
    page_title: '分析页',
    parent_route: 'Dashboard'
  },
  {
    route_name: 'Workplace',
    route_path: '/dashboard/workplace',
    page_title: '工作台',
    parent_route: 'Dashboard'
  },

  // 授权管理
  {
    route_name: 'Department',
    route_path: '/authorization/department',
    page_title: '部门管理',
    parent_route: 'Authorization'
  },
  {
    route_name: 'User',
    route_path: '/authorization/user',
    page_title: '用户管理',
    parent_route: 'Authorization'
  },
  {
    route_name: 'Menu',
    route_path: '/authorization/menu',
    page_title: '菜单管理',
    parent_route: 'Authorization'
  },
  {
    route_name: 'Role',
    route_path: '/authorization/role',
    page_title: '角色管理',
    parent_route: 'Authorization'
  }
]

/**
 * 同步路由到权限表
 */
async function syncRoutesToPermissions() {
  try {
    console.log('开始同步路由到权限表...')

    // 初始化数据库连接
    await initDatabase()

    let newCount = 0
    let updateCount = 0
    let skipCount = 0

    for (const route of routesToSync) {
      try {
        // 检查是否已存在
        const existing = await query(`SELECT id FROM permissions WHERE route_name = @route_name`, {
          route_name: route.route_name
        })

        if (existing && existing.length > 0) {
          // 更新现有记录
          await query(
            `UPDATE permissions 
             SET route_path = @route_path, 
                 page_title = @page_title, 
                 parent_route = @parent_route,
                 updated_at = GETDATE()
             WHERE route_name = @route_name`,
            {
              route_path: route.route_path,
              page_title: route.page_title,
              parent_route: route.parent_route,
              route_name: route.route_name
            }
          )
          updateCount++
          console.log(`✓ 更新: ${route.route_name} - ${route.page_title}`)
        } else {
          // 插入新记录
          await query(
            `INSERT INTO permissions (route_name, route_path, page_title, parent_route)
             VALUES (@route_name, @route_path, @page_title, @parent_route)`,
            {
              route_name: route.route_name,
              route_path: route.route_path,
              page_title: route.page_title,
              parent_route: route.parent_route
            }
          )
          newCount++
          console.log(`+ 新增: ${route.route_name} - ${route.page_title}`)
        }
      } catch (err) {
        console.error(`✗ 处理路由失败 ${route.route_name}:`, err.message)
        skipCount++
      }
    }

    console.log('\n同步完成！')
    console.log(`新增: ${newCount} 条`)
    console.log(`更新: ${updateCount} 条`)
    console.log(`跳过: ${skipCount} 条`)
    console.log(`总计: ${routesToSync.length} 条`)
  } catch (error) {
    console.error('同步失败:', error)
    throw error
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  syncRoutesToPermissions()
    .then(() => {
      console.log('脚本执行完成')
      process.exit(0)
    })
    .catch((error) => {
      console.error('脚本执行失败:', error)
      process.exit(1)
    })
}

module.exports = { syncRoutesToPermissions }
