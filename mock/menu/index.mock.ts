import { SUCCESS_CODE } from '@/constants'

const timeout = 1000

interface MenuNode {
  id: number
  path: string
  name: string
  component: string
  status: number
  type: number
  parentId?: number
  title: string
  redirect?: string
  meta: {
    title: string
    icon?: string
    alwaysShow?: boolean
    noCache?: boolean
    permission?: string[]
  }
  children?: MenuNode[]
}

const businessMenus: MenuNode[] = [
  {
    id: 1,
    path: '/dashboard',
    component: '#',
    redirect: '/dashboard/analysis',
    name: 'Dashboard',
    status: 1,
    type: 0,
    title: '首页',
    meta: {
      title: '首页',
      icon: 'vi-ant-design:dashboard-filled',
      alwaysShow: true
    },
    children: [
      {
        id: 2,
        path: 'analysis',
        component: 'views/Dashboard/Analysis',
        name: 'Analysis',
        status: 1,
        type: 1,
        parentId: 1,
        title: '分析页',
        meta: {
          title: '分析页',
          noCache: true
        }
      },
      {
        id: 3,
        path: 'workplace',
        component: 'views/Dashboard/Workplace',
        name: 'Workplace',
        status: 1,
        type: 1,
        parentId: 1,
        title: '工作台',
        meta: {
          title: '工作台',
          noCache: true
        }
      }
    ]
  },
  {
    id: 10,
    path: '/sales-orders',
    component: '#',
    redirect: '/sales-orders/index',
    name: 'SalesOrders',
    status: 1,
    type: 0,
    title: 'router.salesOrders',
    meta: {
      title: 'router.salesOrders',
      icon: 'vi-ep:document'
    },
    children: [
      {
        id: 11,
        path: 'index',
        component: 'views/SalesOrders/index',
        name: 'SalesOrdersIndex',
        status: 1,
        type: 1,
        parentId: 10,
        title: 'router.salesOrders',
        meta: {
          title: 'router.salesOrders',
          icon: 'vi-ep:document'
        }
      }
    ]
  },
  {
    id: 12,
    path: '/project-management',
    component: '#',
    redirect: '/project-management/index',
    name: 'ProjectManagement',
    status: 1,
    type: 0,
    title: 'router.projectManagement',
    meta: {
      title: 'router.projectManagement',
      icon: 'vi-mdi:briefcase-outline'
    },
    children: [
      {
        id: 13,
        path: 'index',
        component: 'views/ProjectManagement/index',
        name: 'ProjectManagementIndex',
        status: 1,
        type: 1,
        parentId: 12,
        title: 'router.projectManagement',
        meta: {
          title: 'router.projectManagement',
          icon: 'vi-mdi:briefcase-outline'
        }
      }
    ]
  },
  {
    id: 14,
    path: '/production-tasks',
    component: '#',
    redirect: '/production-tasks/index',
    name: 'ProductionTasks',
    status: 1,
    type: 0,
    title: '生产任务',
    meta: {
      title: '生产任务',
      icon: 'vi-ep:operation'
    },
    children: [
      {
        id: 15,
        path: 'index',
        component: 'views/ProductionTasks/index',
        name: 'ProductionTasksIndex',
        status: 1,
        type: 1,
        parentId: 14,
        title: '生产任务',
        meta: {
          title: '生产任务',
          icon: 'vi-ep:operation'
        }
      }
    ]
  },
  {
    id: 16,
    path: '/financial-management',
    component: '#',
    redirect: '/financial-management/billing-documents',
    name: 'FinancialManagement',
    status: 1,
    type: 0,
    title: '财务管理',
    meta: {
      title: '财务管理',
      icon: 'vi-ep:coin',
      alwaysShow: true
    },
    children: [
      {
        id: 17,
        path: 'billing-documents',
        component: 'views/BillingDocuments/index',
        name: 'BillingDocuments',
        status: 1,
        type: 1,
        parentId: 16,
        title: '开票单据',
        meta: {
          title: '开票单据',
          icon: 'vi-ep:document-checked'
        }
      },
      {
        id: 18,
        path: 'receivable-documents',
        component: 'views/ReceivableDocuments/index',
        name: 'ReceivableDocuments',
        status: 1,
        type: 1,
        parentId: 16,
        title: '回款单据',
        meta: {
          title: '回款单据',
          icon: 'vi-ep:wallet'
        }
      },
      {
        id: 19,
        path: 'comprehensive-query',
        component: 'views/ComprehensiveQuery/index',
        name: 'ComprehensiveQuery',
        status: 1,
        type: 1,
        parentId: 16,
        title: '综合查询',
        meta: {
          title: '综合查询',
          icon: 'vi-ep:data-analysis'
        }
      }
    ]
  },
  {
    id: 26,
    path: '/procurement-outsourcing',
    component: '#',
    redirect: '/procurement-outsourcing/material-procurement',
    name: 'ProcurementOutsourcing',
    status: 1,
    type: 0,
    title: '采购外协',
    meta: {
      title: '采购外协',
      icon: 'vi-ep:shopping-cart'
    },
    children: [
      {
        id: 27,
        path: 'material-procurement',
        component: 'views/ProcurementOutsourcing/MaterialProcurement',
        name: 'MaterialProcurement',
        status: 1,
        type: 1,
        parentId: 26,
        title: '物料采购',
        meta: {
          title: '物料采购',
          icon: 'vi-ep:goods'
        }
      },
      {
        id: 28,
        path: 'process-outsourcing',
        component: 'views/ProcurementOutsourcing/ProcessOutsourcing',
        name: 'ProcessOutsourcing',
        status: 1,
        type: 1,
        parentId: 26,
        title: '工序外协',
        meta: {
          title: '工序外协',
          icon: 'vi-ep:operation'
        }
      }
    ]
  },
  {
    id: 29,
    path: '/inventory-management',
    component: '#',
    redirect: '/inventory-management/overview',
    name: 'InventoryManagement',
    status: 1,
    type: 0,
    title: 'router.inventoryManagement',
    meta: {
      title: 'router.inventoryManagement',
      icon: 'vi-ep:box'
    },
    children: [
      {
        id: 30,
        path: 'overview',
        component: 'views/InventoryManagement/index',
        name: 'InventoryManagementOverview',
        status: 1,
        type: 1,
        parentId: 29,
        title: 'router.inventoryOverview',
        meta: {
          title: 'router.inventoryOverview',
          icon: 'vi-ep:box'
        }
      },
      {
        id: 31,
        path: 'inbound',
        component: 'views/InventoryManagement/Inbound',
        name: 'InventoryInbound',
        status: 1,
        type: 1,
        parentId: 29,
        title: 'router.inventoryInbound',
        meta: {
          title: 'router.inventoryInbound',
          icon: 'vi-ep:upload-filled'
        }
      },
      {
        id: 32,
        path: 'outbound',
        component: 'views/InventoryManagement/Outbound',
        name: 'InventoryOutbound',
        status: 1,
        type: 1,
        parentId: 29,
        title: 'router.inventoryOutbound',
        meta: {
          title: 'router.inventoryOutbound',
          icon: 'vi-ep:download'
        }
      },
      {
        id: 33,
        path: 'transfer',
        component: 'views/InventoryManagement/Transfer',
        name: 'InventoryTransfer',
        status: 1,
        type: 1,
        parentId: 29,
        title: 'router.inventoryTransfer',
        meta: {
          title: 'router.inventoryTransfer',
          icon: 'vi-ep:switch'
        }
      },
      {
        id: 34,
        path: 'stocktake',
        component: 'views/InventoryManagement/Stocktake',
        name: 'InventoryStocktake',
        status: 1,
        type: 1,
        parentId: 29,
        title: 'router.inventoryStocktake',
        meta: {
          title: 'router.inventoryStocktake',
          icon: 'vi-ep:scale-to-original'
        }
      }
    ]
  },
  {
    id: 20,
    path: '/project-info',
    component: '#',
    redirect: '/project-info/index',
    name: 'ProjectInfo',
    status: 1,
    type: 0,
    title: '项目信息',
    meta: {
      title: '项目信息',
      icon: 'vi-ep:folder-opened'
    },
    children: [
      {
        id: 21,
        path: 'index',
        component: 'views/ProjectInfo/index',
        name: 'ProjectInfoIndex',
        status: 1,
        type: 1,
        parentId: 20,
        title: '项目信息',
        meta: {
          title: '项目信息',
          icon: 'vi-ep:folder-opened'
        }
      }
    ]
  },
  {
    id: 22,
    path: '/customer-info',
    component: '#',
    redirect: '/customer-info/index',
    name: 'CustomerInfo',
    status: 1,
    type: 0,
    title: '客户信息',
    meta: {
      title: '客户信息',
      icon: 'vi-ep:user'
    },
    children: [
      {
        id: 23,
        path: 'index',
        component: 'views/CustomerInfo/index',
        name: 'CustomerInfoIndex',
        status: 1,
        type: 1,
        parentId: 22,
        title: '客户信息',
        meta: {
          title: '客户信息',
          icon: 'vi-ep:user'
        }
      }
    ]
  },
  {
    id: 42,
    path: '/supplier-info',
    component: '#',
    redirect: '/supplier-info/index',
    name: 'SupplierInfo',
    status: 1,
    type: 0,
    title: '供方信息',
    meta: {
      title: '供方信息',
      icon: 'vi-ep:user-filled'
    },
    children: [
      {
        id: 43,
        path: 'index',
        component: 'views/SupplierInfo/index',
        name: 'SupplierInfoIndex',
        status: 1,
        type: 1,
        parentId: 42,
        title: '供方信息',
        meta: {
          title: '供方信息',
          icon: 'vi-ep:user-filled'
        }
      }
    ]
  },
  {
    id: 24,
    path: '/employee-info',
    component: '#',
    redirect: '/employee-info/index',
    name: 'EmployeeInfo',
    status: 1,
    type: 0,
    title: '员工信息',
    meta: {
      title: '员工信息',
      icon: 'vi-ep:user-filled'
    },
    children: [
      {
        id: 25,
        path: 'index',
        component: 'views/EmployeeInfo/index',
        name: 'EmployeeInfoIndex',
        status: 1,
        type: 1,
        parentId: 24,
        title: '员工信息',
        meta: {
          title: '员工信息',
          icon: 'vi-ep:user-filled'
        }
      }
    ]
  },
  {
    id: 35,
    path: '/external-link',
    component: '#',
    name: 'ExternalLink',
    status: 1,
    type: 0,
    title: '文档',
    meta: {
      title: '文档',
      icon: 'vi-clarity:document-solid'
    },
    children: [
      {
        id: 36,
        path: 'https://element-plus-admin-doc.cn/',
        component: '##',
        name: 'DocumentLink',
        status: 1,
        type: 1,
        parentId: 35,
        title: '文档',
        meta: {
          title: '文档'
        }
      }
    ]
  },
  {
    id: 37,
    path: '/authorization',
    component: '#',
    redirect: '/authorization/user',
    name: 'Authorization',
    status: 1,
    type: 0,
    title: 'router.authorization',
    meta: {
      title: 'router.authorization',
      icon: 'vi-eos-icons:role-binding',
      alwaysShow: true
    },
    children: [
      {
        id: 38,
        path: 'department',
        component: 'views/Authorization/Department/Department',
        name: 'Department',
        status: 1,
        type: 1,
        parentId: 37,
        title: 'router.department',
        meta: {
          title: 'router.department',
          noCache: true
        }
      },
      {
        id: 39,
        path: 'user',
        component: 'views/Authorization/User/User',
        name: 'User',
        status: 1,
        type: 1,
        parentId: 37,
        title: 'router.user',
        meta: {
          title: 'router.user',
          noCache: true
        }
      },
      {
        id: 40,
        path: 'menu',
        component: 'views/Authorization/Menu/Menu',
        name: 'Menu',
        status: 1,
        type: 1,
        parentId: 37,
        title: 'router.menuManagement',
        meta: {
          title: 'router.menuManagement',
          noCache: true
        }
      },
      {
        id: 41,
        path: 'role',
        component: 'views/Authorization/Role/Role',
        name: 'Role',
        status: 1,
        type: 1,
        parentId: 37,
        title: 'router.role',
        meta: {
          title: 'router.role',
          noCache: true
        }
      }
    ]
  }
]

export default [
  {
    url: '/mock/menu/list',
    method: 'get',
    timeout,
    response: () => {
      return {
        code: SUCCESS_CODE,
        data: {
          list: businessMenus
        }
      }
    }
  }
]
