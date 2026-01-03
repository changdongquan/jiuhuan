import request from '@/axios'

// 项目信息类型定义
export interface ProjectInfo {
  项目编号: string
  分类?: string
  产品名称?: string
  产品图号?: string
  productName?: string // 产品名称（从货物信息表获取）
  productDrawing?: string // 产品图号（从货物信息表获取）
  客户ID?: number
  客户模号?: string
  产品材质?: string
  模具穴数?: string
  设计师?: string
  项目名称?: string
  中标日期?: string
  产品3D确认?: string
  图纸下发日期?: string
  计划首样日期?: string
  首次送样日期?: string
  项目状态?: string
  移模日期?: string
  制件厂家?: string
  进度影响原因?: string
  前模材质?: string
  后模材质?: string
  总成本?: number
  完成百分比?: number
  模具尺寸?: string
  产品尺寸?: string
  产品重量?: number
  收缩率?: number
  产品颜色?: string
  模具重量?: number
  流道类型?: string
  抽芯明细?: string | null
  顶出类型?: string | null
  顶出方式?: string | null
  复位方式?: string | null
  机台吨位?: number
  备注?: string
  是否归档?: boolean
  归档日期?: string
  滑块材质?: string
  锁模力?: number
  定位圈?: number
  容模量?: string
  拉杆间距?: string | number
  封样时间?: string
  浇口类型?: string
  浇口数量?: number | null
  料柄重量?: number
  成型周期?: number
  流道数量?: number | null
  费用出处?: string
}

// 项目查询参数
export interface ProjectQueryParams {
  keyword?: string // 项目编号/项目名称
  status?: string // 项目状态
  category?: string // 项目分类（例如：塑胶模具）
  sortField?: string // 排序字段
  sortOrder?: string // 排序方向 asc/desc
  page?: number
  pageSize?: number
}

// 获取项目信息列表
export const getProjectListApi = (params?: ProjectQueryParams) => {
  return request.get({
    url: '/api/project/list',
    params
  })
}

// 获取单个项目信息
export const getProjectDetailApi = (projectCode: string) => {
  return request.get({ url: `/api/project/detail`, params: { projectCode } })
}

// 新增项目信息
export const createProjectApi = (data: ProjectInfo) => {
  return request.post({ url: '/api/project', data })
}

// 更新项目信息
export const updateProjectApi = (projectCode: string, data: Partial<ProjectInfo>) => {
  return request.put({ url: `/api/project/update`, data: { ...data, projectCode } })
}

// 删除项目信息
export const deleteProjectApi = (projectCode: string) => {
  return request.delete({ url: `/api/project/delete`, params: { projectCode } })
}

// 根据项目编号获取货物信息
export const getProjectGoodsApi = (projectCode: string) => {
  return request.get({
    url: '/api/project/goods',
    params: { projectCode }
  })
}

// 获取项目统计信息
export const getProjectStatisticsApi = () => {
  return request.get({ url: '/api/project/statistics' })
}

// 项目管理附件类型
export type ProjectAttachmentType =
  | 'relocation-process' // 移模流程单
  | 'trial-record' // 试模记录表
  | 'tripartite-agreement' // 三方协议
  | 'trial-form' // 试模单

// 项目管理附件接口
export interface ProjectAttachment {
  id: number
  projectCode: string
  type: ProjectAttachmentType
  originalName: string
  storedFileName: string
  relativePath: string
  fileSize: number
  contentType?: string
  uploadedAt: string
  uploadedBy?: string
}

// 获取项目管理附件列表
export const getProjectAttachmentsApi = (projectCode: string, type?: ProjectAttachmentType) => {
  return request.get<{
    code: number
    success: boolean
    data: ProjectAttachment[]
  }>({
    url: `/api/project/${encodeURIComponent(projectCode)}/attachments`,
    params: type ? { type } : undefined
  })
}

// 下载项目管理附件：返回文件流，由调用方处理
export const downloadProjectAttachmentApi = (attachmentId: number) => {
  return request.get<Blob>({
    url: `/api/project/attachments/${attachmentId}/download`,
    responseType: 'blob'
  })
}

// 删除项目管理附件
export const deleteProjectAttachmentApi = (attachmentId: number) => {
  return request.delete<{
    code: number
    success: boolean
    message?: string
  }>({
    url: `/api/project/attachments/${attachmentId}`
  })
}
