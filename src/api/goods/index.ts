import request from '@/axios'

// 货物信息类型定义
export interface GoodsInfo {
  id: number
  projectCode: string // 项目编号
  productDrawing: string // 产品图号
  productName: string // 产品名称
  category: string // 分类
  remarks: string // 备注
  customerName?: string // 客户名称
  customerModelNo?: string // 客户模号
}

// 查询参数类型
export interface GoodsQueryParams {
  keyword?: string // 模糊查询关键词
  customerName?: string // 客户名称
  category?: string // 分类
  page?: number // 页码
  pageSize?: number // 每页大小
}

// 分页响应类型
export interface GoodsPageResponse {
  success: boolean
  data: {
    list: GoodsInfo[]
    total: number
    page: number
    pageSize: number
  }
  message?: string
}

// 获取货物信息列表
export const getGoodsListApi = (params: GoodsQueryParams) => {
  return request.get({
    url: '/api/goods/list',
    params
  })
}

// 获取单个货物信息
export const getGoodsDetailApi = (id: number) => {
  return request.get({ url: `/api/goods/${id}` })
}

// 新增货物信息
export const createGoodsApi = (data: Omit<GoodsInfo, 'id'>) => {
  return request.post({ url: '/api/goods', data })
}

// 更新货物信息
export const updateGoodsApi = (id: number, data: Partial<GoodsInfo>) => {
  return request.put({ url: `/api/goods/${id}`, data })
}

// 删除货物信息
export const deleteGoodsApi = (id: number) => {
  return request.delete({ url: `/api/goods/${id}` })
}

// 批量删除货物信息
export const batchDeleteGoodsApi = (ids: number[]) => {
  return request.delete({ url: '/api/goods/batch', data: { ids } })
}

// 获取指定分类的最大序号
export const getMaxSerialApi = (category: string) => {
  return request.get({ url: `/api/goods/max-serial/${category}` })
}

// 根据项目编号获取货物信息
export const getGoodsByProjectCodeApi = (projectCode: string) => {
  return request.get({ url: `/api/goods/by-project/${projectCode}` })
}
