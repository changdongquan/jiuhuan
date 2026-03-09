import request from '@/axios'

export type CustomerCreateReviewTask = {
  id: number
  customer_name: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  status_text?: string | null
  request_reason?: string | null
  review_reason?: string | null
  created_by?: string | null
  approved_by?: string | null
  rejected_by?: string | null
  created_at?: string | null
  updated_at?: string | null
  approved_at?: string | null
  rejected_at?: string | null
}

export const getCustomerCreateReviewTasksForReviewCenterApi = (params: {
  page?: number
  pageSize?: number
  status?: '' | 'PENDING' | 'APPROVED' | 'REJECTED'
  keyword?: string
}) => {
  return request.get<{
    page: number
    pageSize: number
    total: number
    list: CustomerCreateReviewTask[]
  }>({
    url: '/api/customer/review-tasks',
    params
  })
}

export const approveCustomerCreateReviewForReviewCenterApi = (data: { requestId: number }) => {
  return request.post<{ code: number; success: boolean; message?: string }>({
    url: '/api/customer/review/approve',
    data
  })
}

export const rejectCustomerCreateReviewForReviewCenterApi = (data: {
  requestId: number
  reason: string
}) => {
  return request.post<{ code: number; success: boolean; message?: string }>({
    url: '/api/customer/review/reject',
    data
  })
}
