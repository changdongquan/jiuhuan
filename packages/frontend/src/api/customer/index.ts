import request from '@/axios'

// 客户信息类型定义
export interface CustomerInfo {
  id: number
  customerName: string // 客户名称
  contact?: string // 联系人
  phone?: string // 电话
  address?: string // 地址
  email?: string // 邮箱
  status: 'active' | 'inactive' // 客户状态
  seqNumber: number // 序号
}

// 地址用途枚举（参考 SAP Address Usage）
export type AddressUsage = 'SHIP_TO' | 'BILL_TO' | 'DELIVER_TO'

// 客户收货地址接口
export interface CustomerDeliveryAddress {
  id: number // 收货地址ID
  customerId: number // 客户ID
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
  addressUsage: AddressUsage
  isDefault: boolean
  sortOrder: number
  isEnabled: boolean
  备注?: string
  createdAt?: string
  updatedAt?: string
  createdBy?: string
  updatedBy?: string
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

export type CustomerCreateReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface CustomerCreateReviewTask {
  id: number
  customer_name: string
  status: CustomerCreateReviewStatus
  status_text?: string | null
  request_reason?: string | null
  review_reason?: string | null
  created_by?: string | null
  approved_by?: string | null
  rejected_by?: string | null
  created_at?: string | null
  updated_at?: string | null
  approved_at?: string | null
  rejected_at?: string | null
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

export const createCustomerReviewRequestApi = (data: {
  customerName: string
  requestReason?: string
}) => {
  return request.post<{ code: number; success: boolean; data: CustomerCreateReviewTask | null }>({
    url: '/api/customer/review-request',
    data
  })
}

export const getCustomerReviewTasksApi = (params: {
  page?: number
  pageSize?: number
  status?: '' | 'PENDING' | 'APPROVED' | 'REJECTED'
  keyword?: string
}) => {
  return request.get<{
    code: number
    success: boolean
    data: {
      page: number
      pageSize: number
      total: number
      list: CustomerCreateReviewTask[]
    }
  }>({
    url: '/api/customer/review-tasks',
    params
  })
}

export const approveCustomerReviewApi = (data: { requestId: number }) => {
  return request.post<{ code: number; success: boolean; message?: string }>({
    url: '/api/customer/review/approve',
    data
  })
}

export const rejectCustomerReviewApi = (data: { requestId: number; reason: string }) => {
  return request.post<{ code: number; success: boolean; message?: string }>({
    url: '/api/customer/review/reject',
    data
  })
}

// 获取客户统计信息
export const getCustomerStatisticsApi = () => {
  return request.get({ url: '/api/customer/statistics' })
}

// ============================================
// 客户收货地址管理 API
// ============================================

// 获取客户的收货地址列表
export const getCustomerDeliveryAddressesApi = (
  customerId: number,
  addressUsage?: AddressUsage
) => {
  return request.get({
    url: `/api/customer/${customerId}/delivery-addresses`,
    params: addressUsage ? { addressUsage } : undefined
  })
}

// 获取单个收货地址详情
export const getCustomerDeliveryAddressApi = (addressId: number) => {
  return request.get({ url: `/api/customer/delivery-addresses/${addressId}` })
}

// 新增收货地址
export const createCustomerDeliveryAddressApi = (
  customerId: number,
  data: Partial<CustomerDeliveryAddress>
) => {
  return request.post({ url: `/api/customer/${customerId}/delivery-addresses`, data })
}

// 更新收货地址
export const updateCustomerDeliveryAddressApi = (
  addressId: number,
  data: Partial<CustomerDeliveryAddress>
) => {
  return request.put({ url: `/api/customer/delivery-addresses/${addressId}`, data })
}

// 删除收货地址
export const deleteCustomerDeliveryAddressApi = (addressId: number) => {
  return request.delete({ url: `/api/customer/delivery-addresses/${addressId}` })
}

// 设置默认收货地址
export const setDefaultDeliveryAddressApi = (addressId: number) => {
  return request.put({ url: `/api/customer/delivery-addresses/${addressId}/set-default` })
}
