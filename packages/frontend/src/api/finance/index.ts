import request from '@/axios'

export interface FinanceListResponse<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

export interface FinanceInvoiceQueryParams {
  page?: number
  pageSize?: number
  itemCode?: string
  customerName?: string
  status?: 'normal' | 'red'
  invoiceDateStart?: string
  invoiceDateEnd?: string
}

export interface FinanceReceiptQueryParams {
  page?: number
  pageSize?: number
  itemCode?: string
  customerName?: string
  status?: 'pending' | 'received'
  receiptDateStart?: string
  receiptDateEnd?: string
}

export const getFinanceInvoiceListApi = (params?: FinanceInvoiceQueryParams) => {
  return request.get({ url: '/api/finance/invoices/list', params })
}

export const createFinanceInvoiceApi = (data: any) => {
  return request.post({ url: '/api/finance/invoices', data })
}

export const getFinanceReceiptListApi = (params?: FinanceReceiptQueryParams) => {
  return request.get({ url: '/api/finance/receipts/list', params })
}

export const createFinanceReceiptApi = (data: any) => {
  return request.post({ url: '/api/finance/receipts', data })
}
