import request from '@/axios'

export interface ComprehensiveQueryListParams {
  keyword?: string
  customerName?: string
  category?: string
  settlementStatus?: string
  invoiceStatus?: string
  startDate?: string
  endDate?: string
  anomalyType?: string
  progressType?: string
  progressRange?: string
  progressFilters?: string
  progressMin?: number
  progressMax?: number
  projectStatus?: string
  productionStatus?: string
  sortField?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

export interface ComprehensiveQueryRow {
  projectCode: string
  customerName: string
  productName: string
  productDrawing: string
  customerModelNo: string
  category: string
  owner: string
  salesOrderCount: number
  salesAmount: number
  projectStatus: string
  productionStatus: string
  orderQuantity: number
  unitPrice: number
  contractNo: string
  remark: string
  costSource: string
  completedQty: number
  outboundDocCount: number
  outboundQty: number
  invoiceCount: number
  invoiceAmount: number
  invoiceProgress: number
  receiptCount: number
  receiptAmount: number
  discountAmount: number
  receiptProgress: number
  settlementStatus: string
  settlementSource?: string
  uninvoicedAmount: number
  unreceivedAmount: number
  orderArrearsAmount: number
  anomalyType: string
  latestOrderDate: string
  latestOutboundDate: string
  latestInvoiceDate: string
  latestReceiptDate: string
}

export interface ComprehensiveQuerySummary {
  projectCount: number
  salesAmount: number
  invoiceAmount: number
  receiptAmount: number
  discountAmount: number
  completedQty: number
  outboundQty: number
  uninvoicedAmount: number
  unreceivedAmount: number
  orderArrearsAmount: number
}

export interface ComprehensiveQueryListResponse {
  list: ComprehensiveQueryRow[]
  total: number
  page: number
  pageSize: number
  summary: ComprehensiveQuerySummary
}

export interface ComprehensiveQueryCustomerOption {
  customerName: string
}

export interface ComprehensiveQueryFilterOptions {
  customers: string[]
  categories: string[]
}

export interface JourneyStage {
  key: string
  name: string
  status: 'pending' | 'in_progress' | 'completed' | string
  summary: string
  metrics?: Record<string, unknown>
  dates?: Record<string, string>
}

export interface JourneyEvent {
  stage: string
  title: string
  date: string
  detail: string
}

export interface ProjectJourney {
  projectCode: string
  stages: JourneyStage[]
  events: JourneyEvent[]
  summary?: Record<string, unknown>
}

export const getComprehensiveQueryListApi = (params?: ComprehensiveQueryListParams) => {
  return request.get<ComprehensiveQueryListResponse>({
    url: '/api/comprehensive-query/list',
    params
  })
}

export const getProjectJourneyApi = (projectCode: string) => {
  return request.get({
    url: '/api/comprehensive-query/project-journey',
    params: { projectCode }
  })
}

export const getComprehensiveQuerySummaryApi = (params?: ComprehensiveQueryListParams) => {
  return request.get({
    url: '/api/comprehensive-query/summary',
    params
  })
}

export const exportComprehensiveQueryApi = (params?: ComprehensiveQueryListParams) => {
  return request.get<Blob>({
    url: '/api/comprehensive-query/export',
    params,
    responseType: 'blob'
  })
}

export const getComprehensiveQueryCustomerOptionsApi = (params?: { keyword?: string }) => {
  return request.get<{ list: ComprehensiveQueryCustomerOption[] }>({
    url: '/api/comprehensive-query/customer-options',
    params
  })
}

export const getComprehensiveQueryFilterOptionsApi = () => {
  return request.get<ComprehensiveQueryFilterOptions>({
    url: '/api/comprehensive-query/filter-options'
  })
}
