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
  processingDate: string
  changeOrderNo: string
  partName: string
  moldNo: string
  department: string
  applicant: string
  materials: QuotationMaterialItem[]
  processes: QuotationProcessItem[]
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

// 报价单记录（包含ID）
export interface QuotationRecord extends QuotationFormData {
  id: number
}
