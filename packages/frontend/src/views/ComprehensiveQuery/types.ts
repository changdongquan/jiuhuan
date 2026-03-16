export interface QueryForm {
  keyword: string
  customerName: string
  category: string
  settlementStatus: string
  invoiceStatus: string
  receiptStatus: string
  progressType: string
  progressMin: string
  progressMax: string
  dateRange: [string, string] | []
}

export type QuerySnapshot = QueryForm

export type TableMode = 'overview' | 'finance' | 'full'
