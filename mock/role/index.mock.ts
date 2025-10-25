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
    path: '/billing-documents',
    component: '#',
    redirect: '/billing-documents/index',
    name: 'BillingDocuments',
    meta: {},
    children: [
      {
        path: 'index',
        component: 'views/BillingDocuments/index',
        name: 'BillingDocumentsIndex',
        meta: {
          title: 'router.billingDocuments',
          icon: 'vi-ep:document-checked',
          noCache: true
        }
      }
    ]
  },
  {
    path: '/receivable-documents',
    component: '#',
    redirect: '/receivable-documents/index',
    name: 'ReceivableDocuments',
    meta: {},
    children: [
      {
        path: 'index',
        component: 'views/ReceivableDocuments/index',
        name: 'ReceivableDocumentsIndex',
        meta: {
          title: 'router.receivableDocuments',
          icon: 'vi-ep:wallet',
          noCache: true
        }
      }
    ]
  },
  {
    path: '/comprehensive-query',
    component: '#',
    redirect: '/comprehensive-query/index',
    name: 'ComprehensiveQuery',
    meta: {},
    children: [
      {
        path: 'index',
        component: 'views/ComprehensiveQuery/index',
        name: 'ComprehensiveQueryIndex',
        meta: {
          title: 'router.comprehensiveQuery',
          icon: 'vi-ep:data-analysis',
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
    meta: {},
    children: [
      {
        path: 'index',
        component: 'views/CustomerInfo/index',
        name: 'CustomerInfoIndex',
        meta: {
          title: 'router.customerInfo',
          icon: 'vi-ep:user',
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
    path: '/procurement-outsourcing',
    component: '#',
    redirect: '/procurement-outsourcing/index',
    name: 'ProcurementOutsourcing',
    meta: {
      title: 'router.procurementOutsourcing',
      icon: 'vi-ep:shopping-cart'
    },
    children: [
      {
        path: 'index',
        component: 'views/ProcurementOutsourcing/index',
        name: 'ProcurementOutsourcingIndex',
        meta: {
          title: 'router.procurementOutsourcing',
          icon: 'vi-ep:shopping-cart',
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
