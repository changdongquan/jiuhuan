import { request } from '@/axios'

export interface SalarySummaryRow {
  id: number
  month: string // YYYY-MM
  step: number
  status: string
  employeeCount: number
  overtimePayTotal: number | null
  doubleOvertimePayTotal: number | null
  tripleOvertimePayTotal: number | null
  pensionInsuranceFeeTotal?: number | null
  medicalInsuranceFeeTotal?: number | null
  unemploymentInsuranceFeeTotal?: number | null
  incomeTaxTotal?: number | null
  currentSalaryTotal: number | null
  firstActualTotal: number | null
  secondActualTotal: number | null
  twoActualTotal: number | null
  createdAt?: string
  updatedAt?: string
}

export interface SalaryListResponse {
  list: SalarySummaryRow[]
  total: number
  page: number
  pageSize: number
}

export interface SalaryDraftRow {
  employeeId: number
  employeeName: string
  employeeNumber: string
  idCard?: string | null
  entryDate?: string | null
  level?: number | null

  baseSalary: number | null
  socialInsuranceBase?: number | null
  overtimePay?: number | null
  doubleOvertimePay?: number | null
  tripleOvertimePay?: number | null
  nightShiftSubsidy?: number | null
  mealSubsidy?: number | null
  fullAttendanceBonus?: number | null
  seniorityPay?: number | null

  lateDeduction?: number | null
  newOrPersonalLeaveDeduction?: number | null
  sickLeaveDeduction?: number | null
  absenceDeduction?: number | null
  hygieneFee?: number | null
  waterFee?: number | null
  electricityFee?: number | null

  pensionInsuranceFee?: number | null
  medicalInsuranceFee?: number | null
  unemploymentInsuranceFee?: number | null

  firstPay?: number | null
  secondPay?: number | null
  incomeTax?: number | null

  bonus?: number | null
  deduction?: number | null
  total: number | null
  remark: string
}

export interface SalaryDraft {
  id: number
  month: string
  step: number
  status: string
  employeeCount?: number
  overtimePayTotal?: number | null
  doubleOvertimePayTotal?: number | null
  tripleOvertimePayTotal?: number | null
  currentSalaryTotal?: number | null
  firstActualTotal?: number | null
  secondActualTotal?: number | null
  twoActualTotal?: number | null
  createdAt?: string
  updatedAt?: string
  rows: SalaryDraftRow[]
}

export const getSalaryListApi = (params: Record<string, any> = {}) => {
  return request({
    url: '/api/salary/list',
    method: 'get',
    params
  })
}

export const getSalarySummaryByMonthApi = (month: string) => {
  return request({
    url: '/api/salary/by-month',
    method: 'get',
    params: { month }
  })
}

export const saveSalaryDraftStep1Api = (data: { month: string; employeeIds?: number[] }) => {
  return request({
    url: '/api/salary/draft/step1',
    method: 'post',
    data
  })
}

export const getSalaryDraftApi = (id: number) => {
  return request({
    url: `/api/salary/draft/${id}`,
    method: 'get'
  })
}

export const saveSalaryDraftStep2Api = (id: number, data: { rows: SalaryDraftRow[] }) => {
  return request({
    url: `/api/salary/draft/${id}/step2`,
    method: 'put',
    data
  })
}

export const saveSalaryDraftStep3Api = (id: number) => {
  return request({
    url: `/api/salary/draft/${id}/step3`,
    method: 'put'
  })
}

export const completeSalaryApi = (id: number) => {
  return request({
    url: `/api/salary/complete/${id}`,
    method: 'put'
  })
}

export const deleteSalaryApi = (id: number) => {
  return request({
    url: `/api/salary/${id}`,
    method: 'delete'
  })
}

export const exportSalaryTaxImportTemplateApi = (data: {
  month: string
  rows: Array<{
    employeeName: string
    idCard: string
    firstPay: number
    pensionInsuranceFee: number
    medicalInsuranceFee: number
    unemploymentInsuranceFee: number
  }>
  batch?: 1 | 2
}) => {
  return request({
    url: '/api/salary/tax-import/export',
    method: 'post',
    data,
    responseType: 'blob',
    timeout: 180000
  })
}

export const exportSalaryPayrollApi = (data: { id: number; batch: 1 | 2 }) => {
  return request({
    url: '/api/salary/payroll/export',
    method: 'post',
    data,
    responseType: 'blob',
    timeout: 180000
  })
}

export const unlockSalaryAttendanceApi = (id: number, reason: string) => {
  return request({
    url: `/api/salary/${id}/unlock-attendance`,
    method: 'post',
    data: { reason }
  })
}

export const readSalaryIncomeTaxApi = (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  return request({
    url: '/api/salary/tax-import/read',
    method: 'post',
    data: formData
  })
}
