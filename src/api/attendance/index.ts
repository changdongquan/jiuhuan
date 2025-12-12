import { request } from '@/axios'

// 考勤单元格状态
export type AttendanceCellStatus =
  | '出勤'
  | '休息'
  | '请假'
  | '加班'
  | '出差'
  | '迟到'
  | '早退'
  | '旷工'
  | ''

export interface AttendanceRecord {
  employeeId: number
  employeeName: string
  gender: string
  employeeNumber: number | string
  department: string
  level: string | number
  entryDate: string
  days: Record<number, AttendanceCellStatus>
}

export interface AttendanceSummary {
  id: number
  month: string // YYYY-MM
  employeeCount: number
  attendanceRate: number
  leaveDays: number
  overtimeHours: number
  absenceDays: number
  lateOrEarlyCount?: number
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
