import request from '@/axios'

// 客户信息类型定义
export interface CustomerInfo {
  id: number
  customerName: string    // 客户名称
  contact?: string       // 联系人
  phone?: string         // 电话
  address?: string       // 地址
  email?: string         // 邮箱
  status: 'active' | 'inactive'  // 客户状态
  seqNumber: number       // 序号
}

// 客户查询参数
export interface CustomerQueryParams {
  customerName?: string
  contact?: string
  status?: string
  page?: number
  pageSize?: number
}

// 客户列表响应
export interface CustomerListResponse {
  list: CustomerInfo[]
  total: number
  page: number
  pageSize: number
}

// 客户统计信息
export interface CustomerStatistics {
  totalCustomers: number
  activeCustomers: number
  inactiveCustomers: number
  withContact: number
}

// 获取客户信息列表
export const getCustomerListApi = (params?: CustomerQueryParams) => {
  return request.get({ 
    url: '/api/customer/list',
    params
  })
}

// 获取单个客户信息
export const getCustomerDetailApi = (id: number) => {
  return request.get({ url: `/api/customer/${id}` })
}

// 新增客户信息
export const createCustomerApi = (data: Omit<CustomerInfo, 'id'>) => {
  return request.post({ url: '/api/customer', data })
}

// 更新客户信息
export const updateCustomerApi = (id: number, data: Partial<CustomerInfo>) => {
  return request.put({ url: `/api/customer/${id}`, data })
}

// 删除客户信息
export const deleteCustomerApi = (id: number) => {
  return request.delete({ url: `/api/customer/${id}` })
}

// 获取客户统计信息
export const getCustomerStatisticsApi = () => {
  return request.get({ url: '/api/customer/statistics' })
}
