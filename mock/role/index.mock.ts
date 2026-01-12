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
      },
      {
        path: 'quotation',
        component: 'views/Quotation/index',
        name: 'QuotationIndex',
        meta: {
          title: '报价单',
          icon: 'vi-ep:document-checked',
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
      icon: 'vi-ep:shop'
    },
    children: [
      {
        path: 'index',
        component: 'views/SupplierInfo/index',
        name: 'SupplierInfoIndex',
        meta: {
          title: '供方信息',
          icon: 'vi-ep:shop',
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
  },
  {
    path: '/guide',
    component: '#',
    name: 'Guide',
    meta: {},
    children: [
      {
        path: 'index',
        component: 'views/Guide/Guide',
        name: 'GuideDemo',
        meta: {
          title: 'router.guide',
          icon: 'vi-cib:telegram-plane'
        }
      }
    ]
  },
  {
    path: '/components',
    component: '#',
    name: 'ComponentsDemo',
    meta: {
      title: 'router.component',
      icon: 'vi-bx:bxs-component',
      alwaysShow: true
    },
    children: [
      {
        path: 'form',
        component: '#',
        redirect: '/components/form/default-form',
        name: 'Form',
        meta: {
          title: 'router.form',
          alwaysShow: true
        },
        children: [
          {
            path: 'default-form',
            component: 'views/Components/Form/DefaultForm',
            name: 'DefaultForm',
            meta: {
              title: 'router.defaultForm'
            }
          },
          {
            path: 'use-form',
            component: 'views/Components/Form/UseFormDemo',
            name: 'UseForm',
            meta: {
              title: 'UseForm'
            }
          }
        ]
      },
      {
        path: 'table',
        component: '#',
        redirect: '/components/table/default-table',
        name: 'TableDemo',
        meta: {
          title: 'router.table',
          alwaysShow: true
        },
        children: [
          {
            path: 'default-table',
            component: 'views/Components/Table/DefaultTable',
            name: 'DefaultTable',
            meta: {
              title: 'router.defaultTable'
            }
          },
          {
            path: 'use-table',
            component: 'views/Components/Table/UseTableDemo',
            name: 'UseTable',
            meta: {
              title: 'UseTable'
            }
          },
          {
            path: 'tree-table',
            component: 'views/Components/Table/TreeTable',
            name: 'TreeTable',
            meta: {
              title: 'router.treeTable'
            }
          },
          {
            path: 'table-image-preview',
            component: 'views/Components/Table/TableImagePreview',
            name: 'TableImagePreview',
            meta: {
              title: 'router.PicturePreview'
            }
          },
          {
            path: 'table-video-preview',
            component: 'views/Components/Table/TableVideoPreview',
            name: 'TableVideoPreview',
            meta: {
              title: 'router.tableVideoPreview'
            }
          },
          {
            path: 'card-table',
            component: 'views/Components/Table/CardTable',
            name: 'CardTable',
            meta: {
              title: 'router.cardTable'
            }
          }
        ]
      },
      {
        path: 'editor-demo',
        component: '#',
        redirect: '/components/editor-demo/editor',
        name: 'EditorDemo',
        meta: {
          title: 'router.editor',
          alwaysShow: true
        },
        children: [
          {
            path: 'editor',
            component: 'views/Components/Editor/Editor',
            name: 'Editor',
            meta: {
              title: 'router.richText'
            }
          },
          {
            path: 'json-editor',
            component: 'views/Components/Editor/JsonEditor',
            name: 'JsonEditor',
            meta: {
              title: 'router.jsonEditor'
            }
          }
        ]
      },
      {
        path: 'search',
        component: 'views/Components/Search',
        name: 'Search',
        meta: {
          title: 'router.search'
        }
      },
      {
        path: 'descriptions',
        component: 'views/Components/Descriptions',
        name: 'Descriptions',
        meta: {
          title: 'router.descriptions'
        }
      },
      {
        path: 'image-viewer',
        component: 'views/Components/ImageViewer',
        name: 'ImageViewer',
        meta: {
          title: 'router.imageViewer'
        }
      },
      {
        path: 'dialog',
        component: 'views/Components/Dialog',
        name: 'Dialog',
        meta: {
          title: 'router.dialog'
        }
      },
      {
        path: 'icon',
        component: 'views/Components/Icon',
        name: 'Icon',
        meta: {
          title: 'router.icon'
        }
      },
      {
        path: 'icon-picker',
        component: 'views/Components/IconPicker',
        name: 'IconPicker',
        meta: {
          title: 'router.iconPicker'
        }
      },
      {
        path: 'echart',
        component: 'views/Components/Echart',
        name: 'Echart',
        meta: {
          title: 'router.echart'
        }
      },
      {
        path: 'count-to',
        component: 'views/Components/CountTo',
        name: 'CountTo',
        meta: {
          title: 'router.countTo'
        }
      },
      {
        path: 'qrcode',
        component: 'views/Components/Qrcode',
        name: 'Qrcode',
        meta: {
          title: 'router.qrcode'
        }
      },
      {
        path: 'highlight',
        component: 'views/Components/Highlight',
        name: 'Highlight',
        meta: {
          title: 'router.highlight'
        }
      },
      {
        path: 'infotip',
        component: 'views/Components/Infotip',
        name: 'Infotip',
        meta: {
          title: 'router.infotip'
        }
      },
      {
        path: 'input-password',
        component: 'views/Components/InputPassword',
        name: 'InputPassword',
        meta: {
          title: 'router.inputPassword'
        }
      },
      {
        path: 'waterfall',
        component: 'views/Components/Waterfall',
        name: 'waterfall',
        meta: {
          title: 'router.waterfall'
        }
      },
      {
        path: 'image-cropping',
        component: 'views/Components/ImageCropping',
        name: 'ImageCropping',
        meta: {
          title: 'router.imageCropping'
        }
      },
      {
        path: 'video-player',
        component: 'views/Components/VideoPlayer',
        name: 'VideoPlayer',
        meta: {
          title: 'router.videoPlayer'
        }
      },
      {
        path: 'avatars',
        component: 'views/Components/Avatars',
        name: 'Avatars',
        meta: {
          title: 'router.avatars'
        }
      },
      {
        path: 'i-agree',
        component: 'views/Components/IAgree',
        name: 'IAgree',
        meta: {
          title: 'router.iAgree'
        }
      }
    ]
  },
  {
    path: '/function',
    component: '#',
    redirect: '/function/multipleTabs',
    name: 'Function',
    meta: {
      title: 'router.function',
      icon: 'vi-ri:function-fill',
      alwaysShow: true
    },
    children: [
      {
        path: 'multiple-tabs',
        component: 'views/Function/MultipleTabs',
        name: 'MultipleTabs',
        meta: {
          title: 'router.multipleTabs'
        }
      },
      {
        path: 'request',
        component: 'views/Function/Request',
        name: 'Request',
        meta: {
          title: 'router.request'
        }
      },
      {
        path: 'test',
        component: 'views/Function/Test',
        name: 'Test',
        meta: {
          title: 'router.permission',
          permission: ['add', 'edit', 'delete']
        }
      }
    ]
  },
  {
    path: '/hooks',
    component: '#',
    redirect: '/hooks/useWatermark',
    name: 'Hooks',
    meta: {
      title: 'hooks',
      icon: 'vi-ic:outline-webhook',
      alwaysShow: true
    },
    children: [
      {
        path: 'useWatermark',
        component: 'views/hooks/useWatermark',
        name: 'UseWatermark',
        meta: {
          title: 'useWatermark'
        }
      },
      {
        path: 'useTagsView',
        component: 'views/hooks/useTagsView',
        name: 'UseTagsView',
        meta: {
          title: 'useTagsView'
        }
      },
      {
        path: 'useValidator',
        component: 'views/hooks/useValidator',
        name: 'UseValidator',
        meta: {
          title: 'useValidator'
        }
      }
    ]
  },
  {
    path: '/level',
    component: '#',
    redirect: '/level/menu1',
    name: 'Level',
    meta: {
      title: 'router.level',
      icon: 'vi-ant-design:fund-projection-screen-outlined',
      alwaysShow: true
    },
    children: [
      {
        path: 'menu1',
        component: '#',
        redirect: '/level/menu1/menu1-1',
        name: 'Menu1',
        meta: {
          title: 'router.menu1',
          alwaysShow: true
        },
        children: [
          {
            path: 'menu1-1',
            component: '#',
            redirect: '/level/menu1/menu1-1/menu1-1-1',
            name: 'Menu11',
            meta: {
              title: 'router.menu11',
              alwaysShow: true
            },
            children: [
              {
                path: 'menu1-1-1',
                component: 'views/Level/Menu111',
                name: 'Menu111',
                meta: {
                  title: 'router.menu111'
                }
              }
            ]
          },
          {
            path: 'menu1-2',
            component: 'views/Level/Menu12',
            name: 'Menu12',
            meta: {
              title: 'router.menu12'
            }
          }
        ]
      },
      {
        path: 'menu2',
        component: 'views/Level/Menu2',
        name: 'Menu2',
        meta: {
          title: 'router.menu2'
        }
      }
    ]
  },
  {
    path: '/example',
    component: '#',
    redirect: '/example/example-dialog',
    name: 'Example',
    meta: {
      title: 'router.example',
      icon: 'vi-ep:management',
      alwaysShow: true
    },
    children: [
      {
        path: 'example-dialog',
        component: 'views/Example/Dialog/ExampleDialog',
        name: 'ExampleDialog',
        meta: {
          title: 'router.exampleDialog'
        }
      },
      {
        path: 'example-page',
        component: 'views/Example/Page/ExamplePage',
        name: 'ExamplePage',
        meta: {
          title: 'router.examplePage'
        }
      }
    ]
  },
  {
    path: '/error',
    component: '#',
    redirect: '/error/404',
    name: 'Error',
    meta: {
      title: 'router.errorPage',
      icon: 'vi-ci:error',
      alwaysShow: true
    },
    children: [
      {
        path: '404-demo',
        component: 'views/Error/404',
        name: '404Demo',
        meta: {
          title: '404'
        }
      },
      {
        path: '403-demo',
        component: 'views/Error/403',
        name: '403Demo',
        meta: {
          title: '403'
        }
      },
      {
        path: '500-demo',
        component: 'views/Error/500',
        name: '500Demo',
        meta: {
          title: '500'
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

      // 域用户 role 为 'user' 时，也返回完整路由（可根据实际需求调整）
      if (query?.role === 'user') {
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
