import request from '@/axios'

// 生产任务信息类型定义（根据实际表的19个字段）
export interface ProductionTaskInfo {
  项目编号: string
  负责人?: string
  开始日期?: string
  结束日期?: string
  生产状态?: string
  优先级?: string
  订单数量?: number // 订单数量（从销售订单表汇总）
  交货日期?: string // 交货日期（从销售订单表获取最早的交货日期）
  投产数量?: number
  已完成数量?: number
  电极加工工时?: number
  下达日期?: string
  放电工时?: number
  检验工时?: number
  编程工时?: number
  试模工时?: number
  机加工时?: number
  装配工时?: number
  加工中心工时?: number
  线切割工时?: number
  抛光工时?: number
  productName?: string // 产品名称（从货物信息表获取）
  productDrawing?: string // 产品图号（从货物信息表获取）
  客户模号?: string // 客户模号（从项目管理表获取）
  产品材质?: string // 从项目管理表获取
  图纸下发日期?: string // 从项目管理表获取
  计划首样日期?: string // 从项目管理表获取
}

export type ProductionTaskAttachmentType = 'photo' | 'inspection'

export interface ProductionTaskAttachment {
  id: number
  projectCode: string
  type: ProductionTaskAttachmentType
  tag?: 'appearance' | 'nameplate' | null
  originalName: string
  storedFileName: string
  relativePath: string
  fileSize: number
  contentType?: string
  uploadedAt: string
  uploadedBy?: string
}

// 生产任务查询参数
export interface ProductionTaskQueryParams {
  keyword?: string // 项目编号/负责人
  status?: string // 生产状态
  category?: string // 分类
  page?: number
  pageSize?: number
  sortField?: string // 排序字段
  sortOrder?: string // 排序方向: 'asc' | 'desc'
}

// 获取生产任务列表
export const getProductionTaskListApi = (params?: ProductionTaskQueryParams) => {
  return request.get({
    url: '/api/production-task/list',
    params
  })
}

// 获取单个生产任务信息
export const getProductionTaskDetailApi = (projectCode: string) => {
  return request.get({ url: '/api/production-task/detail', params: { projectCode } })
}

// 更新生产任务信息
export const updateProductionTaskApi = (projectCode: string, data: Partial<ProductionTaskInfo>) => {
  return request.put({ url: `/api/production-task/update`, data: { ...data, projectCode } })
}

// 删除生产任务
export const deleteProductionTaskApi = (projectCode: string) => {
  return request.delete({ url: `/api/production-task/delete`, params: { projectCode } })
}

// 获取生产任务统计数据
export const getProductionTaskStatisticsApi = () => {
  return request.get({ url: '/api/production-task/statistics' })
}

// 获取生产任务附件列表
export const getProductionTaskAttachmentsApi = (
  projectCode: string,
  type?: ProductionTaskAttachmentType
) => {
  return request.get<{
    code: number
    success: boolean
    data: ProductionTaskAttachment[]
  }>({
    url: `/api/production-task/${encodeURIComponent(projectCode)}/attachments`,
    params: type ? { type } : undefined
  })
}

// 下载生产任务附件：返回文件流，由调用方处理
export const downloadProductionTaskAttachmentApi = (attachmentId: number) => {
  return request.get<Blob>({
    url: `/api/production-task/attachments/${attachmentId}/download`,
    responseType: 'blob'
  })
}

// 删除生产任务附件
export const deleteProductionTaskAttachmentApi = (attachmentId: number) => {
  return request.delete<{
    code: number
    success: boolean
    message?: string
  }>({
    url: `/api/production-task/attachments/${attachmentId}`
  })
}
