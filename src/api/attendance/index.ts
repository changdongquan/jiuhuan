import { request } from '@/axios'

// 对齐 /Users/changun/Desktop/考勤表.xlsx 模板的 F-S 列
export interface AttendanceRecord {
  employeeId: number
  employeeName: string
  gender: string
  employeeNumber: number | string
  department: string
  level: string | number
  entryDate: string

  overtimeHours: number // 加班时
  nightShiftCount: number // 夜班45/次
  overtimeSubtotal: number // 加班小计

  seniorityYears: number // 工龄数
  fullAttendanceBonus: number // 全勤费

  mealAllowanceCount: number // 误餐15/次
  subsidySubtotal: number // 补助小计

  lateCount: number // 迟到次
  newOrPersonalLeaveHours: number // 新进及事假时
  sickLeaveHours: number // 病假时
  absenceHours: number // 旷工时

  hygieneFee: number // 卫生费
  utilitiesFee: number // 水电费
  deductionSubtotal: number // 扣款小计
}

export interface AttendanceSummary {
  id: number
  month: string // YYYY-MM
  employeeCount: number
  overtimeSubtotalTotal: number
  subsidySubtotalTotal: number
  deductionSubtotalTotal: number
  lateCountTotal?: number
  updatedAt?: string
  remark?: string
}

export interface AttendanceDetail {
  id?: number
  month: string
  remark?: string
  records: AttendanceRecord[]
}

export const getAttendanceListApi = (params: Record<string, any> = {}) => {
  return request({
    url: '/api/attendance/list',
    method: 'get',
    params
  })
}

export const getAttendanceDetailApi = (id: number) => {
  return request({
    url: `/api/attendance/${id}`,
    method: 'get'
  })
}

export const saveAttendanceApi = (data: AttendanceDetail) => {
  return request({
    url: '/api/attendance',
    method: data.id ? 'put' : 'post',
    data
  })
}
