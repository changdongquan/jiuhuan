import { request } from '@/axios'

export interface SalaryRow {
  id: number
  month: string // YYYY-MM
  employeeName: string
  employeeNumber: string
  baseSalary?: number | null
  bonus?: number | null
  deduction?: number | null
  total?: number | null
  remark?: string | null
}

export interface SalaryListResponse {
  list: SalaryRow[]
  total: number
  page: number
  pageSize: number
}

export interface SalaryDraftRow {
  employeeId: number
  employeeName: string
  employeeNumber: string
  baseSalary: number | null
  bonus: number | null
  deduction: number | null
  total: number | null
  remark: string
}

export interface SalaryDraft {
  id: number
  month: string
  step: number
  status: string
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

export const saveSalaryDraftStep1Api = (data: { month: string; employeeIds: number[] }) => {
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
}) => {
  return request({
    url: '/api/salary/tax-import/export',
    method: 'post',
    data,
    responseType: 'blob'
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
