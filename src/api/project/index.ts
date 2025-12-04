import request from '@/axios'

// 项目信息类型定义
export interface ProjectInfo {
  项目编号: string
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
  机台吨位?: number
  备注?: string
  是否归档?: boolean
  归档日期?: string
  滑块材质?: string
  锁模力?: number
  定位圈?: number
  容模量?: string
  拉杆间距?: number
  封样时间?: string
  浇口类型?: string
  浇口数量?: number
  料柄重量?: number
  成型周期?: number
  流道数量?: number
  费用出处?: string
}

// 项目查询参数
export interface ProjectQueryParams {
  keyword?: string // 项目编号/项目名称
  status?: string // 项目状态
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
