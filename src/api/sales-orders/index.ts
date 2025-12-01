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
  category?: string
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
  yearTotalAmount: number // 当年订单累计金额
  monthTotalAmount: number // 本月订单累计金额
  pendingInStock: number // 待入库数量
  pendingShipped: number // 待出运数量
}

// 明细附件
export interface SalesOrderAttachment {
  id: number
  orderId: number
  orderNo: string
  itemCode?: string
  originalName: string
  storedFileName: string
  relativePath: string
  fileSize: number
  contentType?: string
  uploadedAt: string
  uploadedBy?: string
}

export interface SalesOrderAttachmentSummary {
  orderId: number
  attachmentCount: number
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

// 生成新的订单编号
export const generateOrderNoApi = () => {
  return request.get<{
    code: number
    success: boolean
    data: { orderNo: string }
  }>({
    url: '/api/sales-orders/generate-order-no'
  })
}

// 创建销售订单
export interface CreateSalesOrderPayload {
  orderNo: string
  orderDate?: string
  signDate?: string
  contractNo?: string
  customerId: number
  details: Array<{
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

export const createSalesOrderApi = (data: CreateSalesOrderPayload) => {
  return request.post<{
    code: number
    success: boolean
    message?: string
    data?: { orderNo: string }
  }>({
    url: '/api/sales-orders/create',
    data
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

// 删除销售订单
export const deleteSalesOrderApi = (orderNo: string) => {
  return request.delete<{
    code: number
    success: boolean
    message?: string
  }>({
    url: `/api/sales-orders/delete/${encodeURIComponent(orderNo)}`
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

// 注意：这里导出时保持名称一致
export const getSalesOrderStatisticsApi = getSalesOrdersStatisticsApi

// 获取某订单下各明细的附件数量汇总
export const getSalesOrderAttachmentsSummaryApi = (orderNo: string) => {
  return request.get<{
    code: number
    success: boolean
    data: SalesOrderAttachmentSummary[]
  }>({
    url: `/api/sales-orders/${encodeURIComponent(orderNo)}/attachments/summary`
  })
}

// 获取某条明细下的附件列表
export const getSalesOrderDetailAttachmentsApi = (orderNo: string, detailId: number) => {
  return request.get<{
    code: number
    success: boolean
    data: SalesOrderAttachment[]
  }>({
    url: `/api/sales-orders/${encodeURIComponent(orderNo)}/details/${detailId}/attachments`
  })
}

// 删除附件
export const deleteSalesOrderAttachmentApi = (attachmentId: number) => {
  return request.delete<{
    code: number
    success: boolean
    message?: string
  }>({
    url: `/api/sales-orders/attachments/${attachmentId}`
  })
}

// 下载附件：返回文件流，由调用方处理
export const downloadSalesOrderAttachmentApi = (attachmentId: number) => {
  return request.get<Blob>({
    url: `/api/sales-orders/attachments/${attachmentId}/download`,
    responseType: 'blob'
  })
}
