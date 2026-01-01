import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import type { App } from 'vue'
import { Layout, getParentLayout } from '@/utils/routerHelper'
import { useI18n } from '@/hooks/web/useI18n'
import { NO_RESET_WHITE_LIST } from '@/constants'

const { t } = useI18n()

export const constantRouterMap: AppRouteRecordRaw[] = [
  {
    path: '/',
    component: Layout,
    redirect: '/dashboard/analysis',
    name: 'Root',
    meta: {
      hidden: true
    }
  },
  {
    path: '/redirect',
    component: Layout,
    name: 'RedirectWrap',
    children: [
      {
        path: '/redirect/:path(.*)',
        name: 'Redirect',
        component: () => import('@/views/Redirect/Redirect.vue'),
        meta: {}
      }
    ],
    meta: {
      hidden: true,
      noTagsView: true
    }
  },
  {
    path: '/login',
    component: () => import('@/views/Login/Login.vue'),
    name: 'Login',
    meta: {
      hidden: true,
      title: t('router.login'),
      noTagsView: true
    }
  },
  {
    path: '/personal',
    component: Layout,
    redirect: '/personal/personal-center',
    name: 'Personal',
    meta: {
      title: t('router.personal'),
      hidden: true,
      canTo: true
    },
    children: [
      {
        path: 'personal-center',
        component: () => import('@/views/Personal/PersonalCenter/PersonalCenter.vue'),
        name: 'PersonalCenter',
        meta: {
          title: t('router.personalCenter'),
          hidden: true,
          canTo: true
        }
      }
    ]
  },
  {
    path: '/404',
    component: () => import('@/views/Error/404.vue'),
    name: 'NoFind',
    meta: {
      hidden: true,
      title: '404',
      noTagsView: true
    }
  },
  {
    path: '/403',
    component: () => import('@/views/Error/403.vue'),
    name: '403',
    meta: {
      hidden: true,
      title: '403',
      noTagsView: true
    }
  }
]

export const asyncRouterMap: AppRouteRecordRaw[] = [
  {
    path: '/outbound-document/print/:documentNo',
    component: () => import('@/views/OutboundDocument/PrintPreview.vue'),
    name: 'OutboundDocumentPrint',
    meta: {
      title: '出库单打印预览',
      hidden: true,
      noTagsView: true,
      noCache: true,
      canTo: true,
      roles: ['*']
    }
  },
  {
    path: '/sales-orders',
    component: Layout,
    redirect: '/sales-orders/index',
    name: 'SalesOrders',
    meta: {
      title: t('router.salesOrders'),
      icon: 'vi-ep:document'
    },
    children: [
      {
        path: 'index',
        name: 'SalesOrdersIndex',
        component: () => import('@/views/SalesOrders/index.vue'),
        meta: {
          title: t('router.salesOrders'),
          icon: 'vi-ep:document',
          roles: ['*'],
          noCache: true
        }
      }
    ]
  },
  {
    path: '/project-management',
    component: Layout,
    redirect: '/project-management/index',
    name: 'ProjectManagement',
    meta: {
      title: t('router.projectManagement'),
      icon: 'vi-mdi:briefcase-outline'
    },
    children: [
      {
        path: 'index',
        name: 'ProjectManagementIndex',
        component: () => import('@/views/ProjectManagement/index.vue'),
        meta: {
          title: t('router.projectManagement'),
          icon: 'vi-mdi:briefcase-outline',
          roles: ['*'],
          noCache: true
        }
      },
      {
        path: 'quotation',
        name: 'QuotationIndex',
        component: () => import('@/views/Quotation/index.vue'),
        meta: {
          title: '报价单',
          icon: 'vi-ep:document-checked',
          roles: ['*'],
          noCache: true
        }
      },
      {
        path: 'quotation-part-demo',
        name: 'QuotationPartDemo',
        component: () => import('@/views/Quotation/PartPrintPreview.vue'),
        meta: {
          hidden: true,
          title: '零件报价单预览',
          canTo: true,
          activeMenu: '/project-management/quotation'
        }
      }
    ]
  },
  {
    path: '/production-tasks',
    component: Layout,
    redirect: '/production-tasks/index',
    name: 'ProductionTasks',
    meta: {},
    children: [
      {
        path: 'index',
        name: 'ProductionTasksIndex',
        component: () => import('@/views/ProductionTasks/index.vue'),
        meta: {
          title: t('router.productionTasks'),
          icon: 'vi-ep:operation',
          roles: ['*'],
          noCache: true
        }
      }
    ]
  },
  {
    path: '/financial-management',
    component: Layout,
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
        name: 'BillingDocuments',
        component: () => import('@/views/BillingDocuments/index.vue'),
        meta: {
          title: '开票单据',
          icon: 'vi-ep:document-checked',
          roles: ['*'],
          noCache: true
        }
      },
      {
        path: 'receivable-documents',
        name: 'ReceivableDocuments',
        component: () => import('@/views/ReceivableDocuments/index.vue'),
        meta: {
          title: '回款单据',
          icon: 'vi-ep:wallet',
          roles: ['*'],
          noCache: true
        }
      },
      {
        path: 'salary',
        name: 'Salary',
        component: () => import('@/views/Salary/index.vue'),
        meta: {
          title: '工资',
          icon: 'vi-ep:money',
          roles: ['*'],
          noCache: true
        }
      },
      {
        path: 'comprehensive-query',
        name: 'ComprehensiveQuery',
        component: () => import('@/views/ComprehensiveQuery/index.vue'),
        meta: {
          title: '综合查询',
          icon: 'vi-ep:data-analysis',
          roles: ['*'],
          noCache: true
        }
      }
    ]
  },
  {
    path: '/procurement-outsourcing',
    component: Layout,
    redirect: '/procurement-outsourcing/material-procurement',
    name: 'ProcurementOutsourcing',
    meta: {
      title: t('router.procurementOutsourcing'),
      icon: 'vi-ep:shopping-cart',
      alwaysShow: true
    },
    children: [
      {
        path: 'material-procurement',
        name: 'MaterialProcurement',
        component: () => import('@/views/ProcurementOutsourcing/MaterialProcurement.vue'),
        meta: {
          title: t('router.materialProcurement'),
          icon: 'vi-ep:goods',
          roles: ['*'],
          noCache: true
        }
      },
      {
        path: 'process-outsourcing',
        name: 'ProcessOutsourcing',
        component: () => import('@/views/ProcurementOutsourcing/ProcessOutsourcing.vue'),
        meta: {
          title: t('router.processOutsourcing'),
          icon: 'vi-ep:operation',
          roles: ['*'],
          noCache: true
        }
      }
    ]
  },
  {
    path: '/outbound-document',
    component: Layout,
    redirect: '/outbound-document/index',
    name: 'OutboundDocument',
    meta: {
      title: '出库单',
      icon: 'vi-ep:document-remove'
    },
    children: [
      {
        path: 'index',
        name: 'OutboundDocumentIndex',
        component: () => import('@/views/OutboundDocument/index.vue'),
        meta: {
          title: '出库单',
          icon: 'vi-ep:document-remove',
          roles: ['*'],
          noCache: true
        }
      }
    ]
  },
  {
    path: '/inventory-management',
    component: Layout,
    redirect: '/inventory-management/overview',
    name: 'InventoryManagement',
    meta: {
      title: t('router.inventoryManagement'),
      icon: 'vi-ep:box',
      alwaysShow: true
    },
    children: [
      {
        path: 'overview',
        name: 'InventoryManagementOverview',
        component: () => import('@/views/InventoryManagement/index.vue'),
        meta: {
          title: t('router.inventoryOverview'),
          icon: 'vi-ep:box',
          roles: ['*'],
          noCache: true
        }
      },
      {
        path: 'inbound',
        name: 'InventoryInbound',
        component: () => import('@/views/InventoryManagement/Inbound.vue'),
        meta: {
          title: t('router.inventoryInbound'),
          icon: 'vi-ep:upload-filled',
          roles: ['*'],
          noCache: true
        }
      },
      {
        path: 'outbound',
        name: 'InventoryOutbound',
        component: () => import('@/views/InventoryManagement/Outbound.vue'),
        meta: {
          title: t('router.inventoryOutbound'),
          icon: 'vi-ep:download',
          roles: ['*'],
          noCache: true
        }
      },
      {
        path: 'transfer',
        name: 'InventoryTransfer',
        component: () => import('@/views/InventoryManagement/Transfer.vue'),
        meta: {
          title: t('router.inventoryTransfer'),
          icon: 'vi-ep:switch',
          roles: ['*'],
          noCache: true
        }
      },
      {
        path: 'stocktake',
        name: 'InventoryStocktake',
        component: () => import('@/views/InventoryManagement/Stocktake.vue'),
        meta: {
          title: t('router.inventoryStocktake'),
          icon: 'vi-ep:scale-to-original',
          roles: ['*'],
          noCache: true
        }
      }
    ]
  },
  {
    path: '/project-info',
    component: Layout,
    redirect: '/project-info/index',
    name: 'ProjectInfo',
    meta: {
      title: '项目信息',
      icon: 'vi-ep:folder-opened'
    },
    children: [
      {
        path: 'index',
        name: 'ProjectInfoIndex',
        component: () => import('@/views/ProjectInfo/index.vue'),
        meta: {
          title: '项目信息',
          icon: 'vi-ep:folder-opened',
          roles: ['*'],
          noCache: true
        }
      }
    ]
  },
  {
    path: '/customer-info',
    component: Layout,
    redirect: '/customer-info/index',
    name: 'CustomerInfo',
    meta: {
      title: '客户信息',
      icon: 'vi-ep:user'
    },
    children: [
      {
        path: 'index',
        name: 'CustomerInfoIndex',
        component: () => import('@/views/CustomerInfo/index.vue'),
        meta: {
          title: '客户信息',
          icon: 'vi-ep:user',
          roles: ['*'],
          noCache: true
        }
      }
    ]
  },
  {
    path: '/supplier-info',
    component: Layout,
    redirect: '/supplier-info/index',
    name: 'SupplierInfo',
    meta: {
      title: '供方信息',
      icon: 'vi-ep:user-filled'
    },
    children: [
      {
        path: 'index',
        name: 'SupplierInfoIndex',
        component: () => import('@/views/SupplierInfo/index.vue'),
        meta: {
          title: '供方信息',
          icon: 'vi-ep:user-filled',
          roles: ['*'],
          noCache: true
        }
      }
    ]
  },
  {
    path: '/employee-info',
    component: Layout,
    redirect: '/employee-info/index',
    name: 'EmployeeInfo',
    meta: {},
    children: [
      {
        path: 'index',
        name: 'EmployeeInfoIndex',
        component: () => import('@/views/EmployeeInfo/index.vue'),
        meta: {
          title: t('router.employeeInfo'),
          icon: 'vi-ep:user-filled',
          roles: ['*'],
          noCache: true
        }
      }
    ]
  },
  {
    path: '/attendance',
    component: Layout,
    redirect: '/attendance/index',
    name: 'Attendance',
    meta: {
      title: t('router.attendance'),
      icon: 'vi-ep:calendar'
    },
    children: [
      {
        path: 'index',
        name: 'AttendanceIndex',
        component: () => import('@/views/Attendance/index.vue'),
        meta: {
          title: t('router.attendance'),
          icon: 'vi-ep:calendar',
          roles: ['*'],
          noCache: true
        }
      }
    ]
  },
  {
    path: '/dashboard',
    component: Layout,
    redirect: '/dashboard/analysis',
    name: 'Dashboard',
    meta: {
      title: t('router.dashboard'),
      icon: 'vi-ant-design:dashboard-filled',
      alwaysShow: true
    },
    children: [
      {
        path: 'analysis',
        component: () => import('@/views/Dashboard/Analysis.vue'),
        name: 'Analysis',
        meta: {
          title: t('router.analysis'),
          noCache: true,
          affix: true
        }
      },
      {
        path: 'workplace',
        component: () => import('@/views/Dashboard/Workplace.vue'),
        name: 'Workplace',
        meta: {
          title: t('router.workplace'),
          noCache: true
        }
      }
    ]
  },
  {
    path: '/external-link',
    component: Layout,
    meta: {},
    name: 'ExternalLink',
    children: [
      {
        path: 'https://element-plus-admin-doc.cn/',
        name: 'DocumentLink',
        meta: {
          title: t('router.document'),
          icon: 'vi-clarity:document-solid'
        }
      }
    ]
  },
  {
    path: '/guide',
    component: Layout,
    name: 'Guide',
    meta: {},
    children: [
      {
        path: 'index',
        component: () => import('@/views/Guide/Guide.vue'),
        name: 'GuideDemo',
        meta: {
          title: t('router.guide'),
          icon: 'vi-cib:telegram-plane'
        }
      }
    ]
  },
  {
    path: '/components',
    component: Layout,
    name: 'ComponentsDemo',
    meta: {
      title: t('router.component'),
      icon: 'vi-bx:bxs-component',
      alwaysShow: true
    },
    children: [
      {
        path: 'form',
        component: getParentLayout(),
        redirect: '/components/form/default-form',
        name: 'Form',
        meta: {
          title: t('router.form'),
          alwaysShow: true
        },
        children: [
          {
            path: 'default-form',
            component: () => import('@/views/Components/Form/DefaultForm.vue'),
            name: 'DefaultForm',
            meta: {
              title: t('router.defaultForm')
            }
          },
          {
            path: 'use-form',
            component: () => import('@/views/Components/Form/UseFormDemo.vue'),
            name: 'UseForm',
            meta: {
              title: 'UseForm'
            }
          }
        ]
      },
      {
        path: 'table',
        component: getParentLayout(),
        redirect: '/components/table/default-table',
        name: 'TableDemo',
        meta: {
          title: t('router.table'),
          alwaysShow: true
        },
        children: [
          {
            path: 'default-table',
            component: () => import('@/views/Components/Table/DefaultTable.vue'),
            name: 'DefaultTable',
            meta: {
              title: t('router.defaultTable')
            }
          },
          {
            path: 'use-table',
            component: () => import('@/views/Components/Table/UseTableDemo.vue'),
            name: 'UseTable',
            meta: {
              title: 'UseTable'
            }
          },
          {
            path: 'tree-table',
            component: () => import('@/views/Components/Table/TreeTable.vue'),
            name: 'TreeTable',
            meta: {
              title: t('router.treeTable')
            }
          },
          {
            path: 'table-image-preview',
            component: () => import('@/views/Components/Table/TableImagePreview.vue'),
            name: 'TableImagePreview',
            meta: {
              title: t('router.PicturePreview')
            }
          },
          {
            path: 'table-video-preview',
            component: () => import('@/views/Components/Table/TableVideoPreview.vue'),
            name: 'TableVideoPreview',
            meta: {
              title: t('router.tableVideoPreview')
            }
          },
          {
            path: 'card-table',
            component: () => import('@/views/Components/Table/CardTable.vue'),
            name: 'CardTable',
            meta: {
              title: t('router.cardTable')
            }
          }
        ]
      },
      {
        path: 'editor-demo',
        component: getParentLayout(),
        redirect: '/components/editor-demo/editor',
        name: 'EditorDemo',
        meta: {
          title: t('router.editor'),
          alwaysShow: true
        },
        children: [
          {
            path: 'editor',
            component: () => import('@/views/Components/Editor/Editor.vue'),
            name: 'Editor',
            meta: {
              title: t('router.richText')
            }
          },
          {
            path: 'json-editor',
            component: () => import('@/views/Components/Editor/JsonEditor.vue'),
            name: 'JsonEditor',
            meta: {
              title: t('router.jsonEditor')
            }
          }
        ]
      },
      {
        path: 'search',
        component: () => import('@/views/Components/Search.vue'),
        name: 'Search',
        meta: {
          title: t('router.search')
        }
      },
      {
        path: 'descriptions',
        component: () => import('@/views/Components/Descriptions.vue'),
        name: 'Descriptions',
        meta: {
          title: t('router.descriptions')
        }
      },
      {
        path: 'image-viewer',
        component: () => import('@/views/Components/ImageViewer.vue'),
        name: 'ImageViewer',
        meta: {
          title: t('router.imageViewer')
        }
      },
      {
        path: 'dialog',
        component: () => import('@/views/Components/Dialog.vue'),
        name: 'Dialog',
        meta: {
          title: t('router.dialog')
        }
      },
      {
        path: 'icon',
        component: () => import('@/views/Components/Icon.vue'),
        name: 'Icon',
        meta: {
          title: t('router.icon')
        }
      },
      {
        path: 'icon-picker',
        component: () => import('@/views/Components/IconPicker.vue'),
        name: 'IconPicker',
        meta: {
          title: t('router.iconPicker')
        }
      },
      {
        path: 'echart',
        component: () => import('@/views/Components/Echart.vue'),
        name: 'Echart',
        meta: {
          title: t('router.echart')
        }
      },
      {
        path: 'count-to',
        component: () => import('@/views/Components/CountTo.vue'),
        name: 'CountTo',
        meta: {
          title: t('router.countTo')
        }
      },
      {
        path: 'qrcode',
        component: () => import('@/views/Components/Qrcode.vue'),
        name: 'Qrcode',
        meta: {
          title: t('router.qrcode')
        }
      },
      {
        path: 'highlight',
        component: () => import('@/views/Components/Highlight.vue'),
        name: 'Highlight',
        meta: {
          title: t('router.highlight')
        }
      },
      {
        path: 'infotip',
        component: () => import('@/views/Components/Infotip.vue'),
        name: 'Infotip',
        meta: {
          title: t('router.infotip')
        }
      },
      {
        path: 'input-password',
        component: () => import('@/views/Components/InputPassword.vue'),
        name: 'InputPassword',
        meta: {
          title: t('router.inputPassword')
        }
      },
      {
        path: 'waterfall',
        component: () => import('@/views/Components/Waterfall.vue'),
        name: 'waterfall',
        meta: {
          title: t('router.waterfall')
        }
      },
      {
        path: 'image-cropping',
        component: () => import('@/views/Components/ImageCropping.vue'),
        name: 'ImageCropping',
        meta: {
          title: t('router.imageCropping')
        }
      },
      {
        path: 'video-player',
        component: () => import('@/views/Components/VideoPlayer.vue'),
        name: 'VideoPlayer',
        meta: {
          title: t('router.videoPlayer')
        }
      },
      {
        path: 'avatars',
        component: () => import('@/views/Components/Avatars.vue'),
        name: 'Avatars',
        meta: {
          title: t('router.avatars')
        }
      },
      {
        path: 'i-agree',
        component: () => import('@/views/Components/IAgree.vue'),
        name: 'IAgree',
        meta: {
          title: t('router.iAgree')
        }
      }
    ]
  },
  {
    path: '/function',
    component: Layout,
    redirect: '/function/multipleTabs',
    name: 'Function',
    meta: {
      title: t('router.function'),
      icon: 'vi-ri:function-fill',
      alwaysShow: true
    },
    children: [
      {
        path: 'multiple-tabs',
        component: () => import('@/views/Function/MultipleTabs.vue'),
        name: 'MultipleTabs',
        meta: {
          title: t('router.multipleTabs')
        }
      },
      {
        path: 'multiple-tabs-demo/:id',
        component: () => import('@/views/Function/MultipleTabsDemo.vue'),
        name: 'MultipleTabsDemo',
        meta: {
          hidden: true,
          title: t('router.details'),
          canTo: true,
          activeMenu: '/function/multiple-tabs'
        }
      },
      {
        path: 'request',
        component: () => import('@/views/Function/Request.vue'),
        name: 'Request',
        meta: {
          title: t('router.request')
        }
      },
      {
        path: 'test',
        component: () => import('@/views/Function/Test.vue'),
        name: 'Test',
        meta: {
          title: t('router.permission'),
          permission: ['add', 'edit', 'delete']
        }
      }
    ]
  },
  {
    path: '/hooks',
    component: Layout,
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
        component: () => import('@/views/hooks/useWatermark.vue'),
        name: 'UseWatermark',
        meta: {
          title: 'useWatermark'
        }
      },
      {
        path: 'useTagsView',
        component: () => import('@/views/hooks/useTagsView.vue'),
        name: 'UseTagsView',
        meta: {
          title: 'useTagsView'
        }
      },
      {
        path: 'useValidator',
        component: () => import('@/views/hooks/useValidator.vue'),
        name: 'UseValidator',
        meta: {
          title: 'useValidator'
        }
      },
      {
        path: 'useCrudSchemas',
        component: () => import('@/views/hooks/useCrudSchemas.vue'),
        name: 'UseCrudSchemas',
        meta: {
          title: 'useCrudSchemas'
        }
      },
      {
        path: 'useClipboard',
        component: () => import('@/views/hooks/useClipboard.vue'),
        name: 'UseClipboard',
        meta: {
          title: 'useClipboard'
        }
      },
      {
        path: 'useNetwork',
        component: () => import('@/views/hooks/useNetwork.vue'),
        name: 'UseNetwork',
        meta: {
          title: 'useNetwork'
        }
      }
    ]
  },
  {
    path: '/level',
    component: Layout,
    redirect: '/level/menu1/menu1-1/menu1-1-1',
    name: 'Level',
    meta: {
      title: t('router.level'),
      icon: 'vi-carbon:skill-level-advanced'
    },
    children: [
      {
        path: 'menu1',
        name: 'Menu1',
        component: getParentLayout(),
        redirect: '/level/menu1/menu1-1/menu1-1-1',
        meta: {
          title: t('router.menu1')
        },
        children: [
          {
            path: 'menu1-1',
            name: 'Menu11',
            component: getParentLayout(),
            redirect: '/level/menu1/menu1-1/menu1-1-1',
            meta: {
              title: t('router.menu11'),
              alwaysShow: true
            },
            children: [
              {
                path: 'menu1-1-1',
                name: 'Menu111',
                component: () => import('@/views/Level/Menu111.vue'),
                meta: {
                  title: t('router.menu111')
                }
              }
            ]
          },
          {
            path: 'menu1-2',
            name: 'Menu12',
            component: () => import('@/views/Level/Menu12.vue'),
            meta: {
              title: t('router.menu12')
            }
          }
        ]
      },
      {
        path: 'menu2',
        name: 'Menu2',
        component: () => import('@/views/Level/Menu2.vue'),
        meta: {
          title: t('router.menu2')
        }
      }
    ]
  },
  {
    path: '/example',
    component: Layout,
    redirect: '/example/example-dialog',
    name: 'Example',
    meta: {
      title: t('router.example'),
      icon: 'vi-ep:management',
      alwaysShow: true
    },
    children: [
      {
        path: 'example-dialog',
        component: () => import('@/views/Example/Dialog/ExampleDialog.vue'),
        name: 'ExampleDialog',
        meta: {
          title: t('router.exampleDialog')
        }
      },
      {
        path: 'example-page',
        component: () => import('@/views/Example/Page/ExamplePage.vue'),
        name: 'ExamplePage',
        meta: {
          title: t('router.examplePage')
        }
      },
      {
        path: 'example-add',
        component: () => import('@/views/Example/Page/ExampleAdd.vue'),
        name: 'ExampleAdd',
        meta: {
          title: t('router.exampleAdd'),
          noTagsView: true,
          noCache: true,
          hidden: true,
          canTo: true,
          activeMenu: '/example/example-page'
        }
      },
      {
        path: 'example-edit',
        component: () => import('@/views/Example/Page/ExampleEdit.vue'),
        name: 'ExampleEdit',
        meta: {
          title: t('router.exampleEdit'),
          noTagsView: true,
          noCache: true,
          hidden: true,
          canTo: true,
          activeMenu: '/example/example-page'
        }
      },
      {
        path: 'example-detail',
        component: () => import('@/views/Example/Page/ExampleDetail.vue'),
        name: 'ExampleDetail',
        meta: {
          title: t('router.exampleDetail'),
          noTagsView: true,
          noCache: true,
          hidden: true,
          canTo: true,
          activeMenu: '/example/example-page'
        }
      }
    ]
  },
  {
    path: '/error',
    component: Layout,
    redirect: '/error/404',
    name: 'Error',
    meta: {
      title: t('router.errorPage'),
      icon: 'vi-ci:error',
      alwaysShow: true
    },
    children: [
      {
        path: '404-demo',
        component: () => import('@/views/Error/404.vue'),
        name: '404Demo',
        meta: {
          title: '404'
        }
      },
      {
        path: '403-demo',
        component: () => import('@/views/Error/403.vue'),
        name: '403Demo',
        meta: {
          title: '403'
        }
      },
      {
        path: '500-demo',
        component: () => import('@/views/Error/500.vue'),
        name: '500Demo',
        meta: {
          title: '500'
        }
      }
    ]
  },
  {
    path: '/authorization',
    component: Layout,
    redirect: '/authorization/user',
    name: 'Authorization',
    meta: {
      title: t('router.authorization'),
      icon: 'vi-eos-icons:role-binding',
      alwaysShow: true
    },
    children: [
      {
        path: 'department',
        component: () => import('@/views/Authorization/Department/Department.vue'),
        name: 'Department',
        meta: {
          title: t('router.department')
        }
      },
      {
        path: 'user',
        component: () => import('@/views/Authorization/User/User.vue'),
        name: 'User',
        meta: {
          title: t('router.user')
        }
      },
      {
        path: 'menu',
        component: () => import('@/views/Authorization/Menu/Menu.vue'),
        name: 'Menu',
        meta: {
          title: t('router.menuManagement')
        }
      },
      {
        path: 'role',
        component: () => import('@/views/Authorization/Role/Role.vue'),
        name: 'Role',
        meta: {
          title: t('router.role')
        }
      },
      {
        path: 'permission',
        component: () => import('@/views/Authorization/Permission/Permission.vue'),
        name: 'Permission',
        meta: {
          title: '权限管理'
        }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  strict: true,
  routes: [...(constantRouterMap as RouteRecordRaw[]), ...(asyncRouterMap as RouteRecordRaw[])],
  scrollBehavior: () => ({ left: 0, top: 0 })
})

export const resetRouter = (): void => {
  router.getRoutes().forEach((route) => {
    const { name } = route
    if (name && !NO_RESET_WHITE_LIST.includes(name as string)) {
      router.hasRoute(name) && router.removeRoute(name)
    }
  })
}

export const setupRouter = (app: App<Element>) => {
  app.use(router)
  // ✅ 动态挂载异步路由（包含你的“销售订单”）
  asyncRouterMap.forEach((r) => {
    router.addRoute(r as unknown as RouteRecordRaw)
  })
}

export default router
