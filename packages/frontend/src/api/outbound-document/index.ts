import request from '@/axios'

// 出库单信息类型定义
export interface OutboundDocument {
  出库单号: string
  出库日期?: string
  客户名称?: string
  客户ID?: number
  项目编号?: string
  产品名称?: string
  产品图号?: string
  客户模号?: string
  模具穴数?: string
  产品材质?: string
  模具尺寸?: string
  模具重量?: number
  流道类型?: string
  流道数量?: number
  出库类型?: string // 销售出库、生产出库、调拨出库等
  仓库?: string
  出库数量?: number
  单位?: string
  单价?: number
  金额?: number
  经办人?: string
  审核人?: string
  审核状态?: string // 待审核、已审核、已驳回
  备注?: string
  创建时间?: string
  更新时间?: string
  创建人?: string
  更新人?: string
  detailCount?: number
  totalQuantity?: number
  totalAmount?: number
  details?: Array<Partial<OutboundDocument> & Record<string, any>>
  // 收货地址相关字段
  收货地址ID?: number
  收货方名称?: string
  收货地址?: string
  收货联系人?: string
  收货联系电话?: string
  地址用途?: string
}

export interface OutboundDocumentAttachment {
  id: number
  documentNo: string
  itemCode: string
  originalName: string
  storedFileName: string
  relativePath: string
  fileSize?: number
  contentType?: string
  uploadedAt?: string
  uploadedBy?: string | null
}

export interface OutboundDocumentAttachmentSummary {
  itemCode: string
  attachmentCount: number
}

export interface OutboundInventoryItem {
  项目编号: string
  客户ID?: number
  客户名称?: string
  客户模号?: string
  产品名称?: string
  产品图号?: string
  已完成数量: number
  已出货数量: number
  剩余可出货: number
}

export interface OutboundCustomerOption {
  id: number
  customerName: string
  status: 'active' | 'inactive'
}

export interface OutboundCustomerDeliveryAddress {
  id: number
  customerId: number
  收货方名称: string
  收货方简称?: string
  收货地址: string
  邮政编码?: string
  所在地区?: string
  所在城市?: string
  所在省份?: string
  所在国家?: string
  联系人?: string
  联系电话?: string
  联系手机?: string
  电子邮箱?: string
  addressUsage: string
  isDefault: boolean
  sortOrder: number
  isEnabled: boolean
  备注?: string
  createdAt?: string
  updatedAt?: string
  createdBy?: string
  updatedBy?: string
}

// 出库单查询参数
export interface OutboundDocumentQueryParams {
  keyword?: string // 出库单号/客户名称/项目编号
  outboundType?: string // 出库类型
  startDate?: string // 开始日期
  endDate?: string // 结束日期
  sortField?: string // 排序字段
  sortOrder?: string // 排序方向 asc/desc
  page?: number
  pageSize?: number
}

// 获取出库单列表
export const getOutboundDocumentListApi = (params?: OutboundDocumentQueryParams) => {
  return request.get({
    url: '/api/outbound-document/list',
    params
  })
}

// 获取单个出库单信息
export const getOutboundDocumentDetailApi = (documentNo: string) => {
  return request.get({ url: `/api/outbound-document/detail`, params: { documentNo } })
}

// 新增出库单
export const createOutboundDocumentApi = (data: OutboundDocument) => {
  return request.post({ url: '/api/outbound-document', data })
}

// 更新出库单
export const updateOutboundDocumentApi = (documentNo: string, data: Partial<OutboundDocument>) => {
  return request.put({ url: `/api/outbound-document/update`, data: { ...data, documentNo } })
}

// 删除出库单
export const deleteOutboundDocumentApi = (documentNo: string) => {
  return request.delete({ url: `/api/outbound-document/delete`, params: { documentNo } })
}

// 获取出库单统计信息
export const getOutboundDocumentStatisticsApi = () => {
  return request.get({ url: '/api/outbound-document/statistics' })
}

export interface OutboundInventoryQueryParams {
  customerId?: number | string
  keyword?: string
  page?: number
  pageSize?: number
  sortOrder?: 'asc' | 'desc'
}

export const getOutboundInventoryListApi = (params?: OutboundInventoryQueryParams) => {
  return request.get({
    url: '/api/outbound-document/inventory',
    params
  })
}

export const getOutboundCustomerOptionsApi = (
  params: { status?: 'active' | 'inactive' | 'all' } = {}
) => {
  return request.get<{ list: OutboundCustomerOption[] }>({
    url: '/api/outbound-document/customer-options',
    params
  })
}

export const getOutboundCustomerDeliveryAddressesApi = (
  customerId: number,
  addressUsage?: string
) => {
  return request.get<OutboundCustomerDeliveryAddress[]>({
    url: `/api/outbound-document/customer/${customerId}/delivery-addresses`,
    params: addressUsage ? { addressUsage } : undefined
  })
}

// 获取某出库单某项目编号的附件列表
export const getOutboundDocumentItemAttachmentsApi = (documentNo: string, itemCode: string) => {
  return request.get({
    url: `/api/outbound-document/${encodeURIComponent(documentNo)}/items/${encodeURIComponent(itemCode)}/attachments`
  })
}

// 获取某出库单下各项目编号的附件数量汇总
export const getOutboundDocumentAttachmentsSummaryApi = (documentNo: string) => {
  return request.get({
    url: `/api/outbound-document/${encodeURIComponent(documentNo)}/attachments/summary`
  })
}

// 下载出库单附件
export const downloadOutboundDocumentAttachmentApi = (attachmentId: number) => {
  return request.get({
    url: `/api/outbound-document/attachments/${attachmentId}/download`,
    responseType: 'blob'
  })
}

// 删除出库单附件
export const deleteOutboundDocumentAttachmentApi = (attachmentId: number) => {
  return request.delete({ url: `/api/outbound-document/attachments/${attachmentId}` })
}
