const MODULE_CODE_TO_ROUTE_NAMES: Record<string, string[]> = {
  SALES_ORDERS: ['SalesOrdersIndex'],
  PROJECT_MANAGEMENT: ['ProjectManagementIndex', 'ProjectInfoIndex', 'ProjectInfo'],
  OUTBOUND_DOCUMENT: ['OutboundDocumentIndex'],
  PRODUCTION_TASKS: ['ProductionTasksIndex'],
  CUSTOMER_INFO: ['CustomerInfoIndex', 'CustomerInfo'],
  SUPPLIER_INFO: ['SupplierInfoIndex', 'SupplierInfo'],
  EMPLOYEE_INFO: ['EmployeeInfoIndex', 'EmployeeInfo'],
  QUOTATION: ['QuotationIndex'],
  BILLING_DOCUMENTS: ['BillingDocuments'],
  RECEIVABLE_DOCUMENTS: ['ReceivableDocuments'],
  COMPREHENSIVE_QUERY: ['ComprehensiveQuery'],
  ATTENDANCE: ['AttendanceIndex'],
  SALARY: ['Salary'],
  ANALYSIS: ['Analysis'],
  BMO_SYNC: ['BmoSync'],
  BMO_RELAY_MANAGE: ['BmoRelayManage'],
  BREAK_SNAKE_GAME: ['BreakSnakeGame']
}

const normalizeStringList = (value: unknown, upperCase = false): string[] => {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .map((item) => (upperCase ? item.toUpperCase() : item))
}

export const resolveAccessibleRouteNames = (
  permissions: unknown,
  capabilities: unknown
): string[] => {
  const routeNames = new Set(normalizeStringList(permissions))

  normalizeStringList(capabilities, true).forEach((capabilityKey) => {
    const moduleCode = capabilityKey.split('.')[0] || ''
    ;(MODULE_CODE_TO_ROUTE_NAMES[moduleCode] || []).forEach((routeName) => {
      routeNames.add(routeName)
    })
  })

  return Array.from(routeNames)
}
