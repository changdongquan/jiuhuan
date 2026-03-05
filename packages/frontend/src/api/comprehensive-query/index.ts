import request from '@/axios'

export interface ComprehensiveQueryListParams {
  keyword?: string
  customerName?: string
  category?: string
  startDate?: string
  endDate?: string
  anomalyType?: string
  projectStatus?: string
  productionStatus?: string
  page?: number
  pageSize?: number
}

export interface ComprehensiveQueryRow {
  projectCode: string
  customerName: string
  productName: string
  productDrawing: string
  category: string
  owner: string
  salesOrderCount: number
  salesAmount: number
  projectStatus: string
  productionStatus: string
  completedQty: number
  outboundDocCount: number
  outboundQty: number
  invoiceCount: number
  invoiceAmount: number
  receiptCount: number
  receiptAmount: number
  uninvoicedAmount: number
  unreceivedAmount: number
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
  completedQty: number
  outboundQty: number
  uninvoicedAmount: number
  unreceivedAmount: number
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
  return request.get({
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
