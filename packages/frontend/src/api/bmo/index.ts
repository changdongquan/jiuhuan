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
  bid_price_tax_incl: number | null
  bid_time: string | null
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

export const syncBmoApi = (data: BmoSyncPayload) => {
  return request.post<BmoSyncResult>({
    url: '/api/bmo/sync',
    data
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

export const getBmoMouldProcurementApi = (params: { limit?: number } = {}) => {
  return request.get<{ list: BmoMouldProcurementRow[]; count: number }>({
    url: '/api/bmo/mould-procurement',
    params
  })
}

export const getBmoMouldProcurementLiveApi = (
  params: {
    pageSize?: number
    offset?: number
    conditions?: Record<string, unknown>
    sorts?: Record<string, string>
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
    }
  })
}
