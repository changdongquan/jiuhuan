import request from '@/axios'

// 货物信息类型定义
export interface GoodsInfo {
  id: number
  projectCode: string // 项目编号
  productDrawing: string // 产品图号
  productName: string // 产品名称
  category: string // 分类
  remarks: string // 备注
  status?: string // 状态（软删：已删除）
  hardDeleteReviewStatus?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELED' | string // 硬删除审核状态
  hardDeleteReviewComment?: string // 硬删除审核意见
  hardDeleteReviewUpdatedAt?: string // 硬删除审核更新时间
  customerName?: string // 客户名称
  customerModelNo?: string // 客户模号
}

// 查询参数类型
export interface GoodsQueryParams {
  keyword?: string // 模糊查询关键词
  customerName?: string // 客户名称
  category?: string // 分类
  status?: string // 记录状态：已删除 / all / (默认不传=排除已删除)
  page?: number // 页码
  pageSize?: number // 每页大小
  sortField?: string // 排序字段
  sortOrder?: string // 排序方向 asc/desc
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

// 硬删除货物信息（仅已删除状态）
export const deleteGoodsPermanentApi = (id: number) => {
  return request.delete({
    url: `/api/goods/permanent/${id}`
  })
}

// 恢复整套项目（按项目编号）
export const restoreGoodsProjectApi = (projectCode: string) => {
  return request.post({ url: `/api/goods/restore`, data: { projectCode } })
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

export interface HardDeleteReviewTask {
  id: number
  projectCode: string | null
  goodsId: number | null
  productName: string | null
  productDrawing: string | null
  category: string | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELED' | string | null
  statusText: string
  requesterName: string | null
  requestSource: string | null
  requestReason: string | null
  reviewerName: string | null
  reviewComment: string | null
  approvedAt: string | null
  rejectedAt: string | null
  canceledAt: string | null
  executedAt: string | null
  executionAuditId: number | null
  executionError: string | null
  createdAt: string | null
  updatedAt: string | null
}

export const getHardDeleteReviewPendingCountApi = (params: { timeout?: number } = {}) => {
  return request.get<{ pendingCount: number }>({
    url: '/api/goods/hard-delete-review/pending-count',
    timeout: params.timeout
  })
}

export const getHardDeleteReviewTasksApi = (params: {
  status?: 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELED'
  keyword?: string
  page?: number
  pageSize?: number
}) => {
  return request.get<{ list: HardDeleteReviewTask[]; total: number }>({
    url: '/api/goods/hard-delete-review/tasks',
    params
  })
}

export const approveHardDeleteReviewApi = (data: { requestId: number }) => {
  return request.post({
    url: '/api/goods/hard-delete-review/approve',
    data
  })
}

export const rejectHardDeleteReviewApi = (data: { requestId: number; reason: string }) => {
  return request.post({
    url: '/api/goods/hard-delete-review/reject',
    data
  })
}

// 获取新品货物列表（isNew=1）
export interface NewProductInfo {
  id: number
  itemCode: string // 项目编号
  productDrawingNo: string // 产品图号
  productName: string // 产品名称
  category: string // 分类
  remarks: string // 备注
  customerName?: string // 客户名称
  customerPartNo?: string // 客户模号
}

export const getNewProductsApi = () => {
  return request.get<{
    code: number
    success: boolean
    data: {
      list: NewProductInfo[]
    }
  }>({
    url: '/api/goods/new-products'
  })
}
