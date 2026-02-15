import request from '@/axios'

export interface BmoSyncPayload {
  pageSize?: number
  maxPages?: number
  dryRun?: boolean
  conditions?: Record<string, unknown>
  sorts?: Record<string, string>
}

export interface BmoSyncResult {
  taskId: number
  success: boolean
  fetched: number
  upserted: number
  pageCount: number
  totalSize: number | null
  pageSize: number
  traceId: string | null
  syncedAt: string
}

export interface BmoMouldProcurementRow {
  id?: number
  seq?: number
  bmo_record_id?: string | null
  project_manager: string | null
  part_no: string | null
  part_name: string | null
  model: string | null
  mold_number: string | null
  project_code?: string | null
  project_status?: string | null
  initiation_status?: string | null
  bid_price_tax_incl: number | null
  bid_time: string | null
}

export interface BmoMouldProcurementDetailField {
  name: string
  label: string
  value: string | number | null
}

export interface BmoMouldProcurementDetailAttachment {
  id: string | null
  fileName: string | null
  fileExt: string | null
  fileSize: number | null
  createdAt: string | null
}

export interface BmoMouldProcurementDetail {
  fdId: string
  demandType: string | number | null
  designer: string | number | null
  tech: {
    tableName: string
    fields: BmoMouldProcurementDetailField[]
    attachments: BmoMouldProcurementDetailAttachment[]
  }
}

export type BmoInitiationStatus = 'DRAFT' | 'PM_CONFIRMED' | 'REJECTED' | 'APPLIED' | string

export interface BmoInitiationGoodsDraft {
  projectCode: string
  productDrawing?: string | null
  productName?: string | null
  category?: string | null
  remarks?: string | null
  customerName?: string | null
  customerModelNo?: string | null
}

export interface BmoInitiationSalesOrderDraft {
  orderDate?: string | null
  signDate?: string | null
  contractNo?: string | null
  customerId?: number | null
  details?: Array<{
    itemCode?: string | null
    customerPartNo?: string | null
    deliveryDate?: string | null
    totalAmount?: number | null
    unitPrice?: number | null
    quantity?: number | null
    remark?: string | null
    costSource?: string | null
    handler?: string | null
    isInStock?: boolean | null
    isShipped?: boolean | null
    shippingDate?: string | null
  }>
}

export interface BmoInitiationRequestRow {
  id: number
  bmo_record_id: string
  status: BmoInitiationStatus
  project_code_candidate?: string | null
  project_code_final?: string | null
  sales_order_no?: string | null
  goods_draft?: BmoInitiationGoodsDraft | null
  sales_order_draft?: BmoInitiationSalesOrderDraft | null
  tech_snapshot?: any
  created_by?: string | null
  confirmed_by?: string | null
  approved_by?: string | null
  rejected_reason?: string | null
  created_at?: string | null
  updated_at?: string | null
  confirmed_at?: string | null
  approved_at?: string | null
}

export interface BmoLatestRecord {
  id: number
  bmo_record_id: string
  mold_number: string
  part_no: string
  part_name: string
  mold_type: string
  model: string
  budget_wan_tax_incl: number | null
  bid_price_tax_incl: number | null
  supplier: string
  project_manager: string
  mold_engineer: string
  designer: string
  project_no: string
  process_no: string
  asset_no: string
  progress_days: number | null
  bid_time: string | null
  project_end_time: string | null
  source_updated_at: string
  updated_at: string
}

export interface BmoTaskLog {
  id: number
  status: 'running' | 'success' | 'failed' | string
  triggered_by: string
  rows_fetched: number | null
  rows_upserted: number | null
  started_at: string | null
  finished_at: string | null
  created_at: string
  error_message: string | null
}

export interface BmoConnectionStatus {
  lastLiveOkAt: string | null
  lastLiveErrorAt: string | null
  lastLiveErrorMessage: string | null
  lastPersistStartedAt: string | null
  lastPersistFinishedAt: string | null
  lastPersistUpserted: number | null
  lastPersistErrorAt: string | null
  lastPersistErrorMessage: string | null
}

export interface BmoMouldProcurementRefreshResult {
  source: 'live' | 'db'
  connection: { state: 'connected' | 'expired' | 'error'; message?: string }
  list: BmoMouldProcurementRow[]
  count: number
  offset?: number
  pageSize?: number
  totalSize?: number | null
  traceId?: string | null
  fetchedAt?: string
}

export const syncBmoApi = (data: BmoSyncPayload) => {
  return request.post<BmoSyncResult>({
    url: '/api/bmo/sync',
    data
  })
}

export const getBmoStatusApi = () => {
  return request.get<BmoConnectionStatus>({
    url: '/api/bmo/status'
  })
}

export const ensureBmoSessionApi = (
  params: { maxWaitMs?: number; keeperTimeoutMs?: number } = {}
) => {
  return request.post<{
    state: 'connected' | 'expired' | 'error'
    source: 'live' | 'db'
    message?: string
  }>({
    url: '/api/bmo/session/ensure',
    params
  })
}

export const getBmoLatestApi = (params: { limit?: number } = {}) => {
  return request.get<{ list: BmoLatestRecord[]; count: number }>({
    url: '/api/bmo/latest',
    params
  })
}

export const getBmoTasksApi = (params: { limit?: number } = {}) => {
  return request.get<{ list: BmoTaskLog[] }>({
    url: '/api/bmo/tasks',
    params
  })
}

export const retryBmoSyncApi = (taskId: number) => {
  return request.post<BmoSyncResult>({
    url: `/api/bmo/sync/retry/${taskId}`
  })
}

export const getBmoMouldProcurementApi = (params: { limit?: number; timeout?: number } = {}) => {
  return request.get<{ list: BmoMouldProcurementRow[]; count: number }>({
    url: '/api/bmo/mould-procurement',
    params: { limit: params.limit },
    timeout: params.timeout
  })
}

export const getBmoMouldProcurementLiveApi = (
  params: {
    pageSize?: number
    offset?: number
    conditions?: Record<string, unknown>
    sorts?: Record<string, string>
    timeout?: number
  } = {}
) => {
  return request.get<{
    list: BmoMouldProcurementRow[]
    count: number
    offset: number
    pageSize: number
    totalSize: number | null
    traceId: string | null
    fetchedAt: string
  }>({
    url: '/api/bmo/mould-procurement/live',
    params: {
      ...params,
      conditions: params.conditions ? JSON.stringify(params.conditions) : undefined,
      sorts: params.sorts ? JSON.stringify(params.sorts) : undefined
    },
    timeout: params.timeout
  })
}

export const getBmoMouldProcurementRefreshApi = (
  params: {
    pageSize?: number
    offset?: number
    maxWaitMs?: number
    conditions?: Record<string, unknown>
    sorts?: Record<string, string>
    timeout?: number
  } = {}
) => {
  return request.get<BmoMouldProcurementRefreshResult>({
    url: '/api/bmo/mould-procurement/refresh',
    params: {
      ...params,
      conditions: params.conditions ? JSON.stringify(params.conditions) : undefined,
      sorts: params.sorts ? JSON.stringify(params.sorts) : undefined
    },
    timeout: params.timeout
  })
}

export const getBmoMouldProcurementDetailApi = (params: { fdId: string }) => {
  return request.get<BmoMouldProcurementDetail>({
    url: '/api/bmo/mould-procurement/detail',
    params,
    timeout: 15000
  })
}

export const getBmoInitiationRequestApi = (params: { bmo_record_id: string }) => {
  return request.get<BmoInitiationRequestRow | null>({
    url: '/api/bmo/initiation-request',
    params
  })
}

export const saveBmoInitiationDraftApi = (data: {
  bmo_record_id: string
  project_code_candidate?: string | null
  goods_draft?: BmoInitiationGoodsDraft | null
  sales_order_draft?: BmoInitiationSalesOrderDraft | null
  tech_snapshot?: any
}) => {
  return request.post<BmoInitiationRequestRow | null>({
    url: '/api/bmo/initiation-request/draft',
    data
  })
}

export const confirmBmoInitiationRequestApi = (data: {
  bmo_record_id: string
  project_code_candidate?: string | null
  goods_draft?: BmoInitiationGoodsDraft | null
  sales_order_draft?: BmoInitiationSalesOrderDraft | null
  tech_snapshot?: any
}) => {
  return request.post<BmoInitiationRequestRow | null>({
    url: '/api/bmo/initiation-request/confirm',
    data
  })
}

export const rejectBmoInitiationRequestApi = (data: { bmo_record_id: string; reason: string }) => {
  return request.post<{ code: number; success: boolean; message?: string }>({
    url: '/api/bmo/initiation-request/reject',
    data
  })
}

export const approveAndApplyBmoInitiationRequestApi = (data: { bmo_record_id: string }) => {
  return request.post<{ projectCode: string; orderNo: string }>({
    url: '/api/bmo/initiation-request/approve-and-apply',
    data,
    timeout: 60000
  })
}
