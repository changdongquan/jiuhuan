import { request } from '@/axios'

// 员工信息接口
export interface EmployeeInfo {
  id: number
  employeeName: string
  employeeNumber: number
  gender: string
  level: number
  entryDate: string
  idCard: string
  department: string
  position: string
  phone: string
  emergencyContact: string
  status: string
  confirmDate?: string
  bankName?: string
  bankAccount?: string
  bankBranch?: string
}

// 员工查询参数
export interface EmployeeQueryParams {
  employeeName?: string
  employeeNumber?: string
  department?: string
  status?: string
  page?: number
  pageSize?: number
}

// 员工列表响应
export interface EmployeeListResponse {
  list: EmployeeInfo[]
  total: number
  page: number
  pageSize: number
}

// 员工统计信息
export interface EmployeeStatistics {
  totalEmployees: number
  activeEmployees: number
  inactiveEmployees: number
  leaveEmployees: number
}

// 获取员工列表
export const getEmployeeListApi = (params: EmployeeQueryParams = {}) => {
  return request({
    url: '/api/employee/list',
    method: 'get',
    params
  })
}

// 获取员工详情
export const getEmployeeDetailApi = (id: number) => {
  return request({
    url: `/api/employee/${id}`,
    method: 'get'
  })
}

// 创建员工
export const createEmployeeApi = (data: Omit<EmployeeInfo, 'id'>) => {
  return request({
    url: '/api/employee',
    method: 'post',
    data
  })
}

// 更新员工
export const updateEmployeeApi = (id: number, data: Partial<EmployeeInfo>) => {
  return request({
    url: `/api/employee/${id}`,
    method: 'put',
    data
  })
}

// 删除员工
export const deleteEmployeeApi = (id: number) => {
  return request({
    url: `/api/employee/${id}`,
    method: 'delete'
  })
}

// 获取员工统计信息
export const getEmployeeStatisticsApi = () => {
  return request({
    url: '/api/employee/statistics',
    method: 'get'
  })
}
