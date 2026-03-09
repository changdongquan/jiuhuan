import request from '@/axios'

export interface QuotationCustomerOption {
  id: number
  customerName: string
  status: 'active' | 'inactive'
}

export type QuotationInitiationStatus =
  | 'DRAFT'
  | 'WAIT_CUSTOMER_REVIEW'
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'WITHDRAWN'

export interface QuotationInitiationProjectDraft {
  projectCode: string
  sourceProjectCode?: string | null
  category?: string | null
  customerName?: string | null
  productName?: string | null
  productDrawing?: string | null
  customerModelNo?: string | null
}

export interface QuotationInitiationSalesOrderDetailDraft {
  key?: string
  name?: string | null
  itemCode?: string | null
  productName?: string | null
  productDrawingNo?: string | null
  customerPartNo?: string | null
  deliveryDate?: string | null
  quantity?: number | null
  unitPrice?: number | null
  totalAmount?: number | null
  remark?: string | null
  costSource?: string | null
  handler?: string | null
  isInStock?: boolean | null
  isShipped?: boolean | null
  shippingDate?: string | null
}

export interface QuotationInitiationSalesOrderDraft {
  orderDate?: string | null
  signDate?: string | null
  contractNo?: string | null
  customerId?: number | null
  details?: QuotationInitiationSalesOrderDetailDraft[]
}

export interface QuotationInitiationRequestRow {
  id: number
  quotation_id: number
  status: QuotationInitiationStatus
  status_text?: string | null
  customer_name?: string | null
  project_code_candidate?: string | null
  project_code_final?: string | null
  sales_order_no?: string | null
  project_draft?: QuotationInitiationProjectDraft | null
  sales_order_draft?: QuotationInitiationSalesOrderDraft | null
  initiation_rejected_reason?: string | null
  customer_review_rejected_reason?: string | null
  withdraw_reason?: string | null
  created_by?: string | null
  approved_by?: string | null
  created_at?: string | null
  updated_at?: string | null
  draft_saved_at?: string | null
  submitted_at?: string | null
  approved_at?: string | null
  rejected_at?: string | null
  withdrawn_at?: string | null
}

// 生成新的报价单编号
export const generateQuotationNoApi = () => {
  return request.get<{
    code: number
    success: boolean
    data: { quotationNo: string }
  }>({
    url: '/api/quotation/generate-no'
  })
}

export const getQuotationCustomerOptionsApi = (
  params: { status?: 'active' | 'inactive' | 'all' } = {}
) => {
  return request.get<{ list: QuotationCustomerOption[] }>({
    url: '/api/quotation/customer-options',
    params
  })
}

// 报价单材料明细项
export interface QuotationMaterialItem {
  name: string
  unitPrice: number
  quantity: number
}

// 报价单加工费用明细项
export interface QuotationProcessItem {
  key: string
  name: string
  unitPriceLabel: string
  unitPrice: number
  hours: number
}

// 报价单表单数据
export interface QuotationFormData {
  id?: number | null
  quotationNo: string
  quotationDate: string
  customerName: string
  quotationType?: 'mold' | 'part' | '塑胶模具' | '修改模具' | '零件加工'
  enableImage?: boolean
  processingDate: string
  changeOrderNo: string
  sourceProjectCode?: string
  partName: string
  moldNo: string
  department: string
  applicant: string
  contactName?: string
  contactPhone?: string
  operator?: string
  remark?: string
  deliveryTerms?: string
  paymentTerms?: string
  validityDays?: number | null
  materials: QuotationMaterialItem[]
  processes: QuotationProcessItem[]
  partItems?: Array<{
    partName: string
    drawingNo?: string
    material?: string
    process?: string
    imageUrl?: string
    imageScale?: number
    quantity: number
    unit?: string
    unitPrice: number
  }>
  otherFee: number
  transportFee: number
  quantity: number
}

// 创建报价单
export const createQuotationApi = (data: QuotationFormData) => {
  return request.post<{
    code: number
    success: boolean
    data: { id: number }
    message: string
  }>({
    url: '/api/quotation/create',
    data
  })
}

// 更新报价单
export const updateQuotationApi = (id: number, data: QuotationFormData) => {
  return request.put<{
    code: number
    success: boolean
    message: string
  }>({
    url: `/api/quotation/${id}`,
    data
  })
}

// 删除报价单
export const deleteQuotationApi = (id: number) => {
  return request.delete<{
    code: number
    success: boolean
    message: string
  }>({
    url: `/api/quotation/${id}`
  })
}

// 获取报价单列表
export const getQuotationListApi = (params?: {
  keyword?: string
  processingDate?: string
  quotationType?: 'mold' | 'part' | '塑胶模具' | '修改模具' | '零件加工' | ''
  initiationStatus?:
    | ''
    | '未发起'
    | '待客户审核'
    | '草稿'
    | '审核中'
    | '已通过'
    | '已驳回'
    | '已撤回'
  finalProjectCode?: string
  salesOrderNo?: string
  page?: number
  pageSize?: number
}) => {
  return request.get<{
    code: number
    success: boolean
    data: {
      list: QuotationRecord[]
      total: number
      page: number
      pageSize: number
    }
  }>({
    url: '/api/quotation/list',
    params
  })
}

// 下载报价单对应的 Excel 文件
export const downloadQuotationExcelApi = (id: number) => {
  return request.get<Blob>({
    url: `/api/quotation/${id}/export-excel`,
    responseType: 'blob'
  })
}

// 下载报价单对应的 报价 PDF 文件
export const downloadQuotationPdfApi = (id: number) => {
  return request.get<Blob>({
    url: `/api/quotation/${id}/export-pdf`,
    responseType: 'blob'
  })
}

// 下载报价单对应的 完工单 PDF 文件
export const downloadQuotationCompletionPdfApi = (id: number) => {
  return request.get<Blob>({
    url: `/api/quotation/${id}/export-completion-pdf`,
    responseType: 'blob'
  })
}

// 上传零件报价单明细截图（匿名静态资源 URL）
export const uploadQuotationPartItemImageApi = (quotationNo: string, file: File) => {
  const formData = new FormData()
  formData.append('quotationNo', quotationNo)
  formData.append('file', file)
  return request.post<{
    code: number
    success: boolean
    data: { url: string }
    message?: string
  }>({
    url: '/api/quotation/upload-part-item-image',
    data: formData,
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

// 删除临时图示（取消/关闭弹窗时调用）
export const deleteQuotationTempPartItemImageApi = (url: string) => {
  return request.post<{
    code: number
    success: boolean
    message?: string
  }>({
    url: '/api/quotation/delete-temp-part-item-image',
    data: { url }
  })
}

// 报价单记录（包含ID）
export interface QuotationRecord extends QuotationFormData {
  id: number
  initiationStatus?: string
  finalProjectCode?: string | null
  salesOrderNo?: string | null
}

export const getQuotationInitiationRequestApi = (params: { quotationId: number }) => {
  return request.get<QuotationInitiationRequestRow | null>({
    url: '/api/quotation/initiation-request',
    params
  })
}

export const checkQuotationInitiationProjectCodeApi = (params: {
  quotationId: number
  projectCode: string
  quotationType: 'mold' | 'part' | '塑胶模具' | '修改模具' | '零件加工'
}) => {
  return request.get<{
    code: number
    success: boolean
    data: { category: string }
  }>({
    url: '/api/quotation/initiation-request/project-code-check',
    params
  })
}

export const saveQuotationInitiationDraftApi = (data: {
  quotationId: number
  projectDraft?: QuotationInitiationProjectDraft
  salesOrderDraft?: QuotationInitiationSalesOrderDraft
}) => {
  return request.post<{
    code: number
    success: boolean
    data: QuotationInitiationRequestRow | null
  }>({
    url: '/api/quotation/initiation-request/draft',
    data
  })
}

export const submitQuotationInitiationApi = (data: {
  quotationId: number
  projectDraft?: QuotationInitiationProjectDraft
  salesOrderDraft?: QuotationInitiationSalesOrderDraft
}) => {
  return request.post<{
    code: number
    success: boolean
    data: QuotationInitiationRequestRow | null
  }>({
    url: '/api/quotation/initiation-request/confirm',
    data
  })
}

export const withdrawQuotationInitiationApi = (data: { quotationId: number; reason?: string }) => {
  return request.post<{
    code: number
    success: boolean
    data: QuotationInitiationRequestRow | null
  }>({
    url: '/api/quotation/initiation-request/withdraw',
    data
  })
}

export const requestQuotationInitiationCustomerReviewApi = (data: {
  quotationId: number
  customerName: string
}) => {
  return request.post<{
    code: number
    success: boolean
    data: {
      request: QuotationInitiationRequestRow | null
    }
  }>({
    url: '/api/quotation/initiation-request/customer-review',
    data
  })
}

export const getQuotationInitiationReviewTasksApi = (params: {
  page?: number
  pageSize?: number
  status?: '' | QuotationInitiationStatus
  keyword?: string
}) => {
  return request.get<{
    page: number
    pageSize: number
    total: number
    list: Array<
      QuotationInitiationRequestRow & {
        quotation_no?: string | null
        quotation_customer_name?: string | null
        quotation_part_name?: string | null
        quotation_mold_no?: string | null
      }
    >
  }>({
    url: '/api/quotation/initiation-review/tasks',
    params
  })
}

export const approveAndApplyQuotationInitiationApi = (data: { quotationId: number }) => {
  return request.post<{
    code: number
    success: boolean
    data?: { projectCode: string; orderNo: string }
  }>({
    url: '/api/quotation/initiation-review/approve-and-apply',
    data
  })
}

export const rejectQuotationInitiationReviewApi = (data: {
  quotationId: number
  reason: string
}) => {
  return request.post<{ code: number; success: boolean }>({
    url: '/api/quotation/initiation-review/reject',
    data
  })
}
