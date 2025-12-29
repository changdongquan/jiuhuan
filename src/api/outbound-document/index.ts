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

// 出库单查询参数
export interface OutboundDocumentQueryParams {
  keyword?: string // 出库单号/客户名称/项目编号
  status?: string // 审核状态
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
