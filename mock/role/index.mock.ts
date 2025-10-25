import Mock from 'mockjs'
import { SUCCESS_CODE } from '@/constants'
import { toAnyString } from '@/utils'

const timeout = 1000

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))

const adminList = [
  {
    path: '/dashboard',
    component: '#',
    redirect: '/dashboard/analysis',
    name: 'Dashboard',
    meta: {
      title: 'router.dashboard',
      icon: 'vi-ant-design:dashboard-filled',
      alwaysShow: true
    },
    children: [
      {
        path: 'analysis',
        component: 'views/Dashboard/Analysis',
        name: 'Analysis',
        meta: {
          title: 'router.analysis',
          noCache: true,
          affix: true
        }
      },
      {
        path: 'workplace',
        component: 'views/Dashboard/Workplace',
        name: 'Workplace',
        meta: {
          title: 'router.workplace',
          noCache: true,
          affix: true
        }
      }
    ]
  },
  {
    path: '/sales-orders',
    component: '#',
    redirect: '/sales-orders/index',
    name: 'SalesOrders',
    meta: {
      title: 'router.salesOrders',
      icon: 'vi-ep:document'
    },
    children: [
      {
        path: 'index',
        component: 'views/SalesOrders/index',
        name: 'SalesOrdersIndex',
        meta: {
          title: 'router.salesOrders',
          icon: 'vi-ep:document',
          noCache: true
        }
      }
    ]
  },
  {
    path: '/project-management',
    component: '#',
    redirect: '/project-management/index',
    name: 'ProjectManagement',
    meta: {
      title: 'router.projectManagement',
      icon: 'vi-mdi:briefcase-outline'
    },
    children: [
      {
        path: 'index',
        component: 'views/ProjectManagement/index',
        name: 'ProjectManagementIndex',
        meta: {
          title: 'router.projectManagement',
          icon: 'vi-mdi:briefcase-outline',
          noCache: true
        }
      }
    ]
  },
  {
    path: '/production-tasks',
    component: '#',
    redirect: '/production-tasks/index',
    name: 'ProductionTasks',
    meta: {},
    children: [
      {
        path: 'index',
        component: 'views/ProductionTasks/index',
        name: 'ProductionTasksIndex',
        meta: {
          title: 'router.productionTasks',
          icon: 'vi-ep:operation',
          noCache: true
        }
      }
    ]
  },
  {
    path: '/financial-management',
    component: '#',
    redirect: '/financial-management/billing-documents',
    name: 'FinancialManagement',
    meta: {
      title: '财务管理',
      icon: 'vi-ep:coin',
      alwaysShow: true
    },
    children: [
      {
        path: 'billing-documents',
        component: 'views/BillingDocuments/index',
        name: 'BillingDocuments',
        meta: {
          title: '开票单据',
          icon: 'vi-ep:document-checked',
          noCache: true
        }
      },
      {
        path: 'receivable-documents',
        component: 'views/ReceivableDocuments/index',
        name: 'ReceivableDocuments',
        meta: {
          title: '回款单据',
          icon: 'vi-ep:wallet',
          noCache: true
        }
      },
      {
        path: 'comprehensive-query',
        component: 'views/ComprehensiveQuery/index',
        name: 'ComprehensiveQuery',
        meta: {
          title: '综合查询',
          icon: 'vi-ep:data-analysis',
          noCache: true
        }
      }
    ]
  },
  {
    path: '/procurement-outsourcing',
    component: '#',
    redirect: '/procurement-outsourcing/material-procurement',
    name: 'ProcurementOutsourcing',
    meta: {
      title: 'router.procurementOutsourcing',
      icon: 'vi-ep:shopping-cart'
    },
    children: [
      {
        path: 'material-procurement',
        component: 'views/ProcurementOutsourcing/MaterialProcurement',
        name: 'MaterialProcurement',
        meta: {
          title: 'router.materialProcurement',
          icon: 'vi-ep:goods',
          noCache: true
        }
      },
      {
        path: 'process-outsourcing',
        component: 'views/ProcurementOutsourcing/ProcessOutsourcing',
        name: 'ProcessOutsourcing',
        meta: {
          title: 'router.processOutsourcing',
          icon: 'vi-ep:operation',
          noCache: true
        }
      }
    ]
  },
  {
    path: '/inventory-management',
    component: '#',
    redirect: '/inventory-management/overview',
    name: 'InventoryManagement',
    meta: {
      title: 'router.inventoryManagement',
      icon: 'vi-ep:box',
      alwaysShow: true
    },
    children: [
      {
        path: 'overview',
        component: 'views/InventoryManagement/index',
        name: 'InventoryManagementOverview',
        meta: {
          title: 'router.inventoryOverview',
          icon: 'vi-ep:box',
          noCache: true
        }
      },
      {
        path: 'inbound',
        component: 'views/InventoryManagement/Inbound',
        name: 'InventoryInbound',
        meta: {
          title: 'router.inventoryInbound',
          icon: 'vi-ep:upload-filled',
          noCache: true
        }
      },
      {
        path: 'outbound',
        component: 'views/InventoryManagement/Outbound',
        name: 'InventoryOutbound',
        meta: {
          title: 'router.inventoryOutbound',
          icon: 'vi-ep:download',
          noCache: true
        }
      },
      {
        path: 'transfer',
        component: 'views/InventoryManagement/Transfer',
        name: 'InventoryTransfer',
        meta: {
          title: 'router.inventoryTransfer',
          icon: 'vi-ep:switch',
          noCache: true
        }
      },
      {
        path: 'stocktake',
        component: 'views/InventoryManagement/Stocktake',
        name: 'InventoryStocktake',
        meta: {
          title: 'router.inventoryStocktake',
          icon: 'vi-ep:scale-to-original',
          noCache: true
        }
      }
    ]
  },
  {
    path: '/project-info',
    component: '#',
    redirect: '/project-info/index',
    name: 'ProjectInfo',
    meta: {
      title: '项目信息',
      icon: 'vi-ep:folder-opened'
    },
    children: [
      {
        path: 'index',
        component: 'views/ProjectInfo/index',
        name: 'ProjectInfoIndex',
        meta: {
          title: '项目信息',
          icon: 'vi-ep:folder-opened',
          noCache: true
        }
      }
    ]
  },
  {
    path: '/customer-info',
    component: '#',
    redirect: '/customer-info/index',
    name: 'CustomerInfo',
    meta: {
      title: '客户信息',
      icon: 'vi-ep:user'
    },
    children: [
      {
        path: 'index',
        component: 'views/CustomerInfo/index',
        name: 'CustomerInfoIndex',
        meta: {
          title: '客户信息',
          icon: 'vi-ep:user',
          noCache: true
        }
      }
    ]
  },
  {
    path: '/supplier-info',
    component: '#',
    redirect: '/supplier-info/index',
    name: 'SupplierInfo',
    meta: {
      title: '供方信息',
      icon: 'vi-ep:user-filled'
    },
    children: [
      {
        path: 'index',
        component: 'views/SupplierInfo/index',
        name: 'SupplierInfoIndex',
        meta: {
          title: '供方信息',
          icon: 'vi-ep:user-filled',
          noCache: true
        }
      }
    ]
  },
  {
    path: '/employee-info',
    component: '#',
    redirect: '/employee-info/index',
    name: 'EmployeeInfo',
    meta: {},
    children: [
      {
        path: 'index',
        component: 'views/EmployeeInfo/index',
        name: 'EmployeeInfoIndex',
        meta: {
          title: 'router.employeeInfo',
          icon: 'vi-ep:user-filled',
          noCache: true
        }
      }
    ]
  },
  {
    path: '/authorization',
    component: '#',
    redirect: '/authorization/user',
    name: 'Authorization',
    meta: {
      title: 'router.authorization',
      icon: 'vi-eos-icons:role-binding',
      alwaysShow: true
    },
    children: [
      {
        path: 'department',
        component: 'views/Authorization/Department/Department',
        name: 'Department',
        meta: {
          title: 'router.department',
          noCache: true
        }
      },
      {
        path: 'user',
        component: 'views/Authorization/User/User',
        name: 'User',
        meta: {
          title: 'router.user',
          noCache: true
        }
      },
      {
        path: 'menu',
        component: 'views/Authorization/Menu/Menu',
        name: 'Menu',
        meta: {
          title: 'router.menuManagement',
          noCache: true
        }
      },
      {
        path: 'role',
        component: 'views/Authorization/Role/Role',
        name: 'Role',
        meta: {
          title: 'router.role',
          noCache: true
        }
      }
    ]
  }
]

const normalUserList = [
  {
    path: '/dashboard',
    component: '#',
    redirect: '/dashboard/analysis',
    name: 'Dashboard',
    children: [
      {
        path: 'analysis',
        component: 'views/Dashboard/Analysis',
        name: 'Analysis',
        meta: {
          title: 'router.dashboard',
          noCache: true,
          breadcrumb: false
        }
      }
    ]
  }
]

export default [
  {
    url: '/mock/role/list',
    method: 'get',
    timeout,
    response: () => {
      return {
        code: SUCCESS_CODE,
        data: {
          list: [
            {
              id: '1',
              roleName: '超级管理员',
              roleValue: 'super',
              status: 1,
              remark: '唯一账号，拥有全部访问权限',
              createTime: '2020-11-18 15:12:21',
              updateTime: '2020-11-18 15:12:21'
            },
            {
              id: '1',
              roleName: '管理员',
              roleValue: 'admin',
              status: 1,
              remark: '默认角色，拥有所有操作权限',
              createTime: '2020-11-18 15:12:21',
              updateTime: '2020-11-18 15:12:21'
            }
          ]
        }
      }
    }
  },
  {
    url: '/mock/role/routes',
    method: 'get',
    timeout,
    response: ({ query }) => {
      if (query?.role === 'super') {
        return {
          code: SUCCESS_CODE,
          data: clone(adminList)
        }
      }

      if (query?.role === 'admin') {
        return {
          code: SUCCESS_CODE,
          data: clone(adminList)
        }
      }

      return {
        code: SUCCESS_CODE,
        data: clone(normalUserList)
      }
    }
  },
  {
    url: '/mock/role/save',
    method: 'post',
    timeout,
    response: () => {
      return {
        code: SUCCESS_CODE,
        data: {
          id: toAnyString()
        },
        message: '保存成功'
      }
    }
  }
]
