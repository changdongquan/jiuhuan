import request from '@/axios'

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

export interface BmoMouldProcurementByProjectRow {
  id?: number
  bmo_record_id?: string | null
  project_manager?: string | null
  part_no?: string | null
  part_name?: string | null
  model?: string | null
  mold_number?: string | null
  project_code?: string | null
  project_status?: string | null
  bid_price_tax_incl?: number | null
  bid_time?: string | null
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
  rawDownloadPath?: string | null
  downloadUrl?: string | null
  _rawKeys?: string[]
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

export interface BmoInitiationCustomerOption {
  id: number
  customerName: string
  status: 'active' | 'inactive'
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
  status_text?: string | null
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

export interface BmoInitiationReviewTask extends BmoInitiationRequestRow {
  part_no?: string | null
  part_name?: string | null
  model?: string | null
  mold_number?: string | null
  project_manager?: string | null
  bid_price_tax_incl?: number | null
  bid_time?: string | null
}

export interface BmoInitiationTechSnapshot {
  demandType?: string | number | null
  designer?: string | number | null
  fdId?: string | null
  cavitySnapshot?: {
    candidates?: {
      bmo14?: Array<{ source?: string | null; value?: string | null }>
      techSpec?: Array<{ source?: string | null; value?: string | null }>
    }
    final?: {
      value?: string | null
      counts?: number[]
      source?: string | null
    }
    analyzedAt?: string | null
  } | null
  tech?: {
    tableName?: string
    fields?: BmoMouldProcurementDetailField[]
    attachments?: BmoMouldProcurementDetailAttachment[]
  } | null
}

export interface BmoTechSpecParsedCache {
  fdId: string
  attachmentId: string
  fileName: string | null
  parsedData: any
  parsedMeta?: Record<string, any> | null
  updatedAt?: string | null
}

export interface BmoRelayJob {
  id: string
  type: string | null
  status: string
  payload: Record<string, any>
  createdAt: string | null
  startedAt: string | null
  finishedAt: string | null
  error: string | null
  result: Record<string, any> | null
}

export interface BmoRelayAuthStatus {
  source: string
  updatedAt: number | null
  hasCookie: boolean
  hasToken: boolean
  cookiePreview: string
  tokenPreview: string
  probe?: {
    ok: boolean
    status: number
    message?: string
  }
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

export const getBmoMouldProcurementApi = (params: { limit?: number; timeout?: number } = {}) => {
  return request.get<{ list: BmoMouldProcurementRow[]; count: number }>({
    url: '/api/bmo/mould-procurement',
    params: { limit: params.limit },
    timeout: params.timeout
  })
}

export const getBmoPendingInitiationCountApi = (params: { timeout?: number } = {}) => {
  return request.get<{ pendingCount: number }>({
    url: '/api/bmo/mould-procurement/pending-count',
    timeout: params.timeout
  })
}

export const getBmoPendingReviewCountApi = (params: { timeout?: number } = {}) => {
  return request.get<{ pendingCount: number }>({
    url: '/api/bmo/initiation-review/pending-count',
    timeout: params.timeout
  })
}

export const getBmoMouldProcurementByProjectApi = (params: { projectCode: string }) => {
  return request.get<BmoMouldProcurementByProjectRow | null>({
    url: '/api/bmo/mould-procurement/by-project',
    params
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

export const getBmoTechSpecParsedCacheApi = (params: { fdId: string; attachmentId: string }) => {
  return request.get<BmoTechSpecParsedCache | null>({
    url: '/api/bmo/tech-spec/parsed-cache',
    params,
    timeout: 10000
  })
}

export const saveBmoTechSpecParsedCacheApi = (data: {
  fdId: string
  attachmentId: string
  fileName?: string
  parsedData: any
  parsedMeta?: Record<string, any>
}) => {
  return request.post<BmoTechSpecParsedCache | null>({
    url: '/api/bmo/tech-spec/parsed-cache',
    data,
    timeout: 15000
  })
}

export const refreshBmoInitiationCavitySnapshotApi = (data: {
  fdId?: string
  bmoRecordId?: string
  bmo_record_id?: string
}) => {
  return request.post<BmoInitiationTechSnapshot | null>({
    url: '/api/bmo/initiation-request/cavity-snapshot/refresh',
    data,
    timeout: 15000
  })
}

export const getBmoInitiationRequestApi = (params: { bmo_record_id: string }) => {
  return request.get<BmoInitiationRequestRow | null>({
    url: '/api/bmo/initiation-request',
    params
  })
}

export const getBmoInitiationCustomersApi = (
  params: { status?: 'active' | 'inactive' | 'all' } = {}
) => {
  return request.get<{ list: BmoInitiationCustomerOption[] }>({
    url: '/api/bmo/initiation/customers',
    params
  })
}

export const getBmoInitiationRequestByProjectApi = (params: { projectCode: string }) => {
  return request.get<
    (BmoInitiationRequestRow & { tech_snapshot?: BmoInitiationTechSnapshot }) | null
  >({
    url: '/api/bmo/initiation-request/by-project',
    params
  })
}

export const getBmoInitiationReviewTasksApi = (params: {
  page?: number
  pageSize?: number
  status?: 'ALL' | 'DRAFT' | 'PM_CONFIRMED' | 'REJECTED' | 'APPLIED'
  keyword?: string
}) => {
  return request.get<{
    page: number
    pageSize: number
    total: number
    list: BmoInitiationReviewTask[]
  }>({
    url: '/api/bmo/initiation-review/tasks',
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

export const rejectBmoInitiationReviewApi = (data: { bmo_record_id: string; reason: string }) => {
  return request.post<{ code: number; success: boolean; message?: string }>({
    url: '/api/bmo/initiation-review/reject',
    data
  })
}

export const approveAndApplyBmoInitiationReviewApi = (data: { bmo_record_id: string }) => {
  return request.post<{ projectCode: string; orderNo: string }>({
    url: '/api/bmo/initiation-review/approve-and-apply',
    data,
    timeout: 60000
  })
}

export const createBmoRelayJobApi = (data: {
  type: 'collect' | 'download_attachment' | 'writeback' | 'upload_attachment' | string
  payload?: Record<string, any>
}) => {
  return request.post<BmoRelayJob>({
    url: '/api/bmo/relay/jobs',
    data
  })
}

export const getBmoRelayJobApi = (jobId: string) => {
  return request.get<BmoRelayJob>({
    url: `/api/bmo/relay/jobs/${encodeURIComponent(jobId)}`
  })
}

export const retryBmoRelayJobApi = (jobId: string) => {
  return request.post<{ id: string; status: string }>({
    url: `/api/bmo/relay/jobs/${encodeURIComponent(jobId)}/retry`
  })
}

export const downloadBmoRelayFileApi = (fileId: string) => {
  return request.get<Blob>({
    url: `/api/bmo/relay/files/${encodeURIComponent(fileId)}`,
    responseType: 'blob'
  })
}

export const getBmoRelayAuthStatusApi = (params: { probe?: 0 | 1 } = {}) => {
  return request.get<BmoRelayAuthStatus>({
    url: '/api/bmo/relay/auth/status',
    params
  })
}

export const loginBmoRelayAuthApi = (data: { username?: string; password?: string } = {}) => {
  return request.post<{
    hasCookie: boolean
    hasToken: boolean
    probe?: { ok: boolean; status: number; message?: string }
  }>({
    url: '/api/bmo/relay/auth/login',
    data
  })
}

export const logoutBmoRelayAuthApi = () => {
  return request.post<{ loggedOut: true }>({
    url: '/api/bmo/relay/auth/logout',
    data: {}
  })
}

export const setBmoRelayAuthApi = (data: { cookie?: string; token?: string }) => {
  return request.post<{ hasCookie: boolean; hasToken: boolean }>({
    url: '/api/bmo/relay/auth/set',
    data
  })
}
