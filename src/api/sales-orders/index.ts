import request from '@/axios'

// 销售订单明细
export interface SalesOrderDetail {
  id: number
  itemCode: string
  productName?: string
  productDrawingNo?: string
  customerPartNo?: string
  orderDate?: string
  deliveryDate?: string
  signDate?: string
  totalAmount?: number
  unitPrice?: number
  quantity?: number
  remark?: string
  costSource?: string
  handler?: string
  isInStock?: boolean
  isShipped?: boolean
  shippingDate?: string
}

// 销售订单（按订单号分组）
export interface SalesOrder {
  orderNo: string
  customerId?: number
  customerName?: string
  orderDate?: string
  signDate?: string
  contractNo?: string
  details: SalesOrderDetail[]
  totalQuantity: number
  totalAmount: number
}

// 查询参数
export interface SalesOrderQueryParams {
  orderNo?: string
  customerId?: number
  customerName?: string
  itemCode?: string
  searchText?: string // 综合搜索：项目编号/订单编号/客户模号/产品图号/产品名称
  contractNo?: string
  orderDateStart?: string
  orderDateEnd?: string
  isInStock?: boolean
  isShipped?: boolean
  page?: number
  pageSize?: number
}

// 分页响应
export interface SalesOrderPageResponse {
  code: number
  success: boolean
  data: {
    list: SalesOrder[]
    total: number
    page: number
    pageSize: number
  }
  message?: string
}

// 统计信息
export interface SalesOrderStatistics {
  totalOrders: number
  totalAmount: number
  totalQuantity: number
  inStockCount: number
  shippedCount: number
  notInStockCount: number
  notShippedCount: number
}

// 获取销售订单列表（按订单号分组）
export const getSalesOrdersListApi = (params?: SalesOrderQueryParams) => {
  return request.get<SalesOrderPageResponse>({
    url: '/api/sales-orders/list',
    params
  })
}

// 获取单个销售订单信息（按ID）
export const getSalesOrderDetailApi = (id: number) => {
  return request.get({
    url: `/api/sales-orders/${id}`
  })
}

// 按订单号获取完整的销售订单信息（包括所有明细）
export const getSalesOrderByOrderNoApi = (orderNo: string) => {
  return request.get<{
    code: number
    success: boolean
    data: SalesOrder
  }>({
    url: `/api/sales-orders/by-orderNo/${encodeURIComponent(orderNo)}`
  })
}

// 更新销售订单
export interface UpdateSalesOrderPayload {
  orderNo: string
  orderDate?: string
  signDate?: string
  contractNo?: string
  customerId?: number
  details: Array<{
    id: number
    itemCode?: string
    deliveryDate?: string | null
    totalAmount?: number
    unitPrice?: number
    quantity?: number
    remark?: string | null
    costSource?: string | null
    handler?: string | null
    isInStock?: boolean
    isShipped?: boolean
    shippingDate?: string | null
  }>
}

export const updateSalesOrderApi = (data: UpdateSalesOrderPayload) => {
  return request.put<{
    code: number
    success: boolean
    message?: string
  }>({
    url: '/api/sales-orders/update',
    data
  })
}

// 获取销售订单统计信息
export const getSalesOrdersStatisticsApi = () => {
  return request.get<{
    code: number
    success: boolean
    data: SalesOrderStatistics
  }>({
    url: '/api/sales-orders/statistics'
  })
}
