import request from '@/axios'

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
  quotationType?: 'mold' | 'part'
  processingDate: string
  changeOrderNo: string
  partName: string
  moldNo: string
  department: string
  applicant: string
  contactName?: string
  contactPhone?: string
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
export const uploadQuotationPartItemImageApi = (file: File) => {
  const formData = new FormData()
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

// 报价单记录（包含ID）
export interface QuotationRecord extends QuotationFormData {
  id: number
}
