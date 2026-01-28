import { request } from '@/axios'

export interface Supplier {
  供方ID: number
  供方名称: string
  供方等级: 'A' | 'B' | 'C'
  分类: '原料' | '配件' | '设备' | '外协' | '服务'
  供方状态: 'active' | 'suspended'
  联系人: string
  联系电话: string
  电子邮箱?: string
  所在地区?: string
  详细地址?: string
  备注信息?: string
  纳税人识别号?: string
  开户银行?: string
  银行账号?: string
  银行行号?: string
  创建时间?: string
  更新时间?: string
  创建人?: string
  更新人?: string
  是否删除?: boolean
}

export interface SupplierQuery {
  page?: number
  size?: number
  supplierName?: string
  category?: string
  status?: string
}

export interface SupplierCreate {
  供方名称: string
  供方等级?: 'A' | 'B' | 'C'
  分类: '原料' | '配件' | '设备' | '外协' | '服务'
  供方状态?: 'active' | 'suspended'
  联系人: string
  联系电话: string
  电子邮箱?: string
  所在地区?: string
  详细地址?: string
  备注信息?: string
  纳税人识别号?: string
  开户银行?: string
  银行账号?: string
  银行行号?: string
  创建人?: string
}

export interface SupplierUpdate extends SupplierCreate {
  供方ID: number
  更新人?: string
}

export interface SupplierListResponse {
  code: number
  message: string
  data: {
    list: Supplier[]
    total: number
    page: number
    size: number
  }
}

export interface SupplierDetailResponse {
  code: number
  message: string
  data: Supplier
}

export interface SupplierStatistics {
  totalSuppliers: number
  activeSuppliers: number
  materialSuppliers: number
  partsSuppliers: number
  equipmentSuppliers: number
  outsourcingSuppliers: number
  serviceSuppliers: number
}

export interface SupplierStatisticsResponse {
  code: number
  message: string
  data: SupplierStatistics
}

// 获取供方信息列表
export const getSupplierList = (params: SupplierQuery) => {
  return request({
    url: '/api/supplier/list',
    method: 'get',
    params
  })
}

// 获取供方信息详情
export const getSupplierDetail = (id: number) => {
  return request({
    url: `/api/supplier/detail/${id}`,
    method: 'get'
  })
}

// 新增供方信息
export const createSupplier = (data: SupplierCreate) => {
  return request({
    url: '/api/supplier/create',
    method: 'post',
    data
  })
}

// 更新供方信息
export const updateSupplier = (id: number, data: SupplierUpdate) => {
  return request({
    url: `/api/supplier/update/${id}`,
    method: 'put',
    data
  })
}

// 删除供方信息
export const deleteSupplier = (id: number) => {
  return request({
    url: `/api/supplier/delete/${id}`,
    method: 'delete'
  })
}

// 获取统计信息
export const getSupplierStatistics = () => {
  return request({
    url: '/api/supplier/statistics',
    method: 'get'
  })
}
