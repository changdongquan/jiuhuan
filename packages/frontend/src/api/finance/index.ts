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

export interface FinanceInvoiceCandidateQueryParams {
  filterType?: 'no_invoice' | 'prepaid_pending' | 'full'
  keyword?: string
  customerName?: string
  page?: number
  pageSize?: number
}

export interface FinanceReceiptCandidateQueryParams {
  sourceType?: 'all' | 'invoice_detail' | 'prepayment_order'
  keyword?: string
  customerName?: string
  page?: number
  pageSize?: number
}

export interface FinanceCustomerOption {
  id: number
  customerName: string
  status: 'active' | 'inactive'
}

export const getFinanceInvoiceListApi = (params?: FinanceInvoiceQueryParams) => {
  return request.get({ url: '/api/finance/invoices/list', params })
}

export const getFinanceCustomerOptionsApi = (
  params: { status?: 'active' | 'inactive' | 'all' } = {}
) => {
  return request.get<{ list: FinanceCustomerOption[] }>({
    url: '/api/finance/customer-options',
    params
  })
}

export const getFinanceInvoiceCandidatesApi = (params?: FinanceInvoiceCandidateQueryParams) => {
  return request.get({ url: '/api/finance/invoices/candidates', params })
}

export const createFinanceInvoiceApi = (data: any) => {
  return request.post({ url: '/api/finance/invoices', data })
}

export const updateFinanceInvoiceApi = (invoiceId: number, data: any) => {
  return request.put({ url: `/api/finance/invoices/${invoiceId}`, data })
}

export const deleteFinanceInvoiceApi = (invoiceId: number) => {
  return request.delete({ url: `/api/finance/invoices/${invoiceId}` })
}

export const getFinanceReceiptListApi = (params?: FinanceReceiptQueryParams) => {
  return request.get({ url: '/api/finance/receipts/list', params })
}

export const getFinanceReceiptCandidatesApi = (params?: FinanceReceiptCandidateQueryParams) => {
  return request.get({ url: '/api/finance/receipts/candidates', params })
}

export const createFinanceReceiptApi = (data: any) => {
  return request.post({ url: '/api/finance/receipts', data })
}

export const updateFinanceReceiptApi = (documentNo: string, data: any) => {
  return request.put({ url: `/api/finance/receipts/${encodeURIComponent(documentNo)}`, data })
}

export const deleteFinanceReceiptApi = (documentNo: string) => {
  return request.delete({ url: `/api/finance/receipts/${encodeURIComponent(documentNo)}` })
}
