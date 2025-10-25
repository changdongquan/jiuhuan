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
          title: 'router.salesOrders'
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
          title: 'router.projectManagement'
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
    path: '/billing-documents',
    component: '#',
    redirect: '/billing-documents/index',
    name: 'BillingDocuments',
    status: 1,
    type: 0,
    title: '开票单据',
    meta: {
      title: '开票单据',
      icon: 'vi-ep:document-checked'
    },
    children: [
      {
        id: 17,
        path: 'index',
        component: 'views/BillingDocuments/index',
        name: 'BillingDocumentsIndex',
        status: 1,
        type: 1,
        parentId: 16,
        title: '开票单据',
        meta: {
          title: '开票单据',
          icon: 'vi-ep:document-checked'
        }
      }
    ]
  },
  {
    id: 18,
    path: '/receivable-documents',
    component: '#',
    redirect: '/receivable-documents/index',
    name: 'ReceivableDocuments',
    status: 1,
    type: 0,
    title: '回款单据',
    meta: {
      title: '回款单据',
      icon: 'vi-ep:wallet'
    },
    children: [
      {
        id: 19,
        path: 'index',
        component: 'views/ReceivableDocuments/index',
        name: 'ReceivableDocumentsIndex',
        status: 1,
        type: 1,
        parentId: 18,
        title: '回款单据',
        meta: {
          title: '回款单据',
          icon: 'vi-ep:wallet'
        }
      }
    ]
  },
  {
    id: 20,
    path: '/comprehensive-query',
    component: '#',
    redirect: '/comprehensive-query/index',
    name: 'ComprehensiveQuery',
    status: 1,
    type: 0,
    title: '综合查询',
    meta: {
      title: '综合查询',
      icon: 'vi-ep:data-analysis'
    },
    children: [
      {
        id: 21,
        path: 'index',
        component: 'views/ComprehensiveQuery/index',
        name: 'ComprehensiveQueryIndex',
        status: 1,
        type: 1,
        parentId: 20,
        title: '综合查询',
        meta: {
          title: '综合查询',
          icon: 'vi-ep:data-analysis'
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
    id: 26,
    path: '/procurement-outsourcing',
    component: '#',
    redirect: '/procurement-outsourcing/index',
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
        path: 'index',
        component: 'views/ProcurementOutsourcing/index',
        name: 'ProcurementOutsourcingIndex',
        status: 1,
        type: 1,
        parentId: 26,
        title: '采购外协',
        meta: {
          title: '采购外协',
          icon: 'vi-ep:shopping-cart'
        }
      }
    ]
  },
  {
    id: 28,
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
        id: 29,
        path: 'overview',
        component: 'views/InventoryManagement/index',
        name: 'InventoryManagementOverview',
        status: 1,
        type: 1,
        parentId: 28,
        title: 'router.inventoryOverview',
        meta: {
          title: 'router.inventoryOverview',
          icon: 'vi-ep:box'
        }
      },
      {
        id: 30,
        path: 'inbound',
        component: 'views/InventoryManagement/Inbound',
        name: 'InventoryInbound',
        status: 1,
        type: 1,
        parentId: 28,
        title: 'router.inventoryInbound',
        meta: {
          title: 'router.inventoryInbound',
          icon: 'vi-ep:upload-filled'
        }
      },
      {
        id: 31,
        path: 'outbound',
        component: 'views/InventoryManagement/Outbound',
        name: 'InventoryOutbound',
        status: 1,
        type: 1,
        parentId: 28,
        title: 'router.inventoryOutbound',
        meta: {
          title: 'router.inventoryOutbound',
          icon: 'vi-ep:download'
        }
      },
      {
        id: 32,
        path: 'transfer',
        component: 'views/InventoryManagement/Transfer',
        name: 'InventoryTransfer',
        status: 1,
        type: 1,
        parentId: 28,
        title: 'router.inventoryTransfer',
        meta: {
          title: 'router.inventoryTransfer',
          icon: 'vi-ep:switch'
        }
      },
      {
        id: 33,
        path: 'stocktake',
        component: 'views/InventoryManagement/Stocktake',
        name: 'InventoryStocktake',
        status: 1,
        type: 1,
        parentId: 28,
        title: 'router.inventoryStocktake',
        meta: {
          title: 'router.inventoryStocktake',
          icon: 'vi-ep:scale-to-original'
        }
      }
    ]
  },
  {
    id: 30,
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
        id: 31,
        path: 'https://element-plus-admin-doc.cn/',
        component: '##',
        name: 'DocumentLink',
        status: 1,
        type: 1,
        parentId: 30,
        title: '文档',
        meta: {
          title: '文档'
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
