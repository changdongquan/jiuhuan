import { request } from '@/axios'

export type SalaryBaseParamRow = {
  employeeId: number
  salaryBase: number | null
  adjustDate: string | null
  updatedAt?: string
}

export type OvertimeBaseParamRow = {
  level: number
  overtime: number | null
  doubleOvertime: number | null
  tripleOvertime: number | null
  adjustDate: string | null
  updatedAt?: string
}

export type SubsidyParamRow = {
  name: string
  unit?: string
  amount: number | null
  adjustDate: string | null
  updatedAt?: string
}

export type PenaltyParamRow = {
  name: string
  unit?: string
  amount: number | null
  adjustDate: string | null
  updatedAt?: string
}

export const getSalaryBaseParamsApi = () => {
  return request({
    url: '/api/salary/params/salary-base',
    method: 'get'
  })
}

export const saveSalaryBaseParamsApi = (rows: SalaryBaseParamRow[]) => {
  return request({
    url: '/api/salary/params/salary-base',
    method: 'put',
    data: { rows }
  })
}

export const getOvertimeBaseParamsApi = () => {
  return request({
    url: '/api/salary/params/overtime-base',
    method: 'get'
  })
}

export const saveOvertimeBaseParamsApi = (rows: OvertimeBaseParamRow[]) => {
  return request({
    url: '/api/salary/params/overtime-base',
    method: 'put',
    data: { rows }
  })
}

export const getSubsidyParamsApi = () => {
  return request({
    url: '/api/salary/params/subsidy',
    method: 'get'
  })
}

export const saveSubsidyParamsApi = (rows: SubsidyParamRow[]) => {
  return request({
    url: '/api/salary/params/subsidy',
    method: 'put',
    data: { rows }
  })
}

export const getPenaltyParamsApi = () => {
  return request({
    url: '/api/salary/params/penalty',
    method: 'get'
  })
}

export const savePenaltyParamsApi = (rows: PenaltyParamRow[]) => {
  return request({
    url: '/api/salary/params/penalty',
    method: 'put',
    data: { rows }
  })
}
