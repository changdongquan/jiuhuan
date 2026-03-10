const sql = require('mssql')
const { query, getPool } = require('../database')
const { assertReviewPermission } = require('./reviewAcl')

const QUOTATION_INITIATION_REVIEW_ACTION = 'QUOTATION_INITIATION.REVIEW'

const STATUS = {
  DRAFT: 'DRAFT',
  WAIT_CUSTOMER_REVIEW: 'WAIT_CUSTOMER_REVIEW',
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  WITHDRAWN: 'WITHDRAWN'
}

const normalizeStatus = (value) => {
  const status = String(value || '')
    .trim()
    .toUpperCase()
  if (status === STATUS.WAIT_CUSTOMER_REVIEW) return STATUS.WAIT_CUSTOMER_REVIEW
  if (status === STATUS.PENDING) return STATUS.PENDING
  if (status === STATUS.APPROVED) return STATUS.APPROVED
  if (status === STATUS.REJECTED) return STATUS.REJECTED
  if (status === STATUS.WITHDRAWN) return STATUS.WITHDRAWN
  return STATUS.DRAFT
}

const getStatusText = (value) => {
  const status = normalizeStatus(value)
  if (status === STATUS.WAIT_CUSTOMER_REVIEW) return '待客户审核'
  if (status === STATUS.PENDING) return '审核中'
  if (status === STATUS.APPROVED) return '已通过'
  if (status === STATUS.REJECTED) return '已驳回'
  if (status === STATUS.WITHDRAWN) return '已撤回'
  return '草稿'
}

const normalizeQuotationBusinessType = (value) => {
  const raw = String(value || '').trim()
  if (raw === '塑胶模具') return '塑胶模具'
  if (raw === '修改模具' || raw === 'mold') return '修改模具'
  if (raw === '零件加工' || raw === 'part') return '零件加工'
  return raw
}

const getCategoryFromProjectCode = (projectCode) => {
  const code = String(projectCode || '')
    .trim()
    .toUpperCase()
  if (code.startsWith('JH01')) return '塑胶模具'
  if (code.startsWith('JH03')) return '零件加工'
  if (code.startsWith('JH05')) return '修改模具'
  return ''
}

const assertProjectCodeValid = ({ projectCode, quotationType }) => {
  const code = String(projectCode || '').trim().toUpperCase()
  if (!code) throw new Error('项目编号不能为空')
  if (!/^JH(01|03|05)-\d{2}-\d{3}(\/\d{2})?$/.test(code)) {
    throw new Error('项目编号格式不合法')
  }
  const expectedCategory = normalizeQuotationBusinessType(quotationType)
  const category = getCategoryFromProjectCode(code)
  if (!category) throw new Error('项目编号格式不合法')
  if (expectedCategory && category !== expectedCategory) {
    throw new Error('项目编号与报价单分类不一致')
  }
  return category
}

const ensureQuotationInitiationTable = async (poolOrTx) => {
  const req = new sql.Request(poolOrTx)
  await req.batch(`
    IF OBJECT_ID(N'dbo.quotation_initiation_requests', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.quotation_initiation_requests (
        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        quotation_id INT NOT NULL,
        status NVARCHAR(40) NOT NULL CONSTRAINT DF_quotation_initiation_requests_status DEFAULT (N'DRAFT'),
        customer_name NVARCHAR(200) NULL,
        project_code_candidate NVARCHAR(50) NULL,
        project_code_final NVARCHAR(50) NULL,
        sales_order_no NVARCHAR(50) NULL,
        project_draft_json NVARCHAR(MAX) NULL,
        sales_order_draft_json NVARCHAR(MAX) NULL,
        initiation_rejected_reason NVARCHAR(500) NULL,
        customer_review_rejected_reason NVARCHAR(500) NULL,
        withdraw_reason NVARCHAR(500) NULL,
        created_by NVARCHAR(100) NULL,
        approved_by NVARCHAR(100) NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_quotation_initiation_requests_created_at DEFAULT (SYSDATETIME()),
        updated_at DATETIME2 NOT NULL CONSTRAINT DF_quotation_initiation_requests_updated_at DEFAULT (SYSDATETIME()),
        draft_saved_at DATETIME2 NULL,
        submitted_at DATETIME2 NULL,
        approved_at DATETIME2 NULL,
        rejected_at DATETIME2 NULL,
        withdrawn_at DATETIME2 NULL
      );

      CREATE UNIQUE INDEX UX_quotation_initiation_requests_quotation
        ON dbo.quotation_initiation_requests(quotation_id);
      CREATE INDEX IX_quotation_initiation_requests_status
        ON dbo.quotation_initiation_requests(status, updated_at DESC, id DESC);
      CREATE INDEX IX_quotation_initiation_requests_customer_name
        ON dbo.quotation_initiation_requests(customer_name, updated_at DESC, id DESC);
    END
  `)
}

const safeJsonParse = (value, fallback = null) => {
  if (value === null || value === undefined || value === '') return fallback
  try {
    return JSON.parse(value)
  } catch (_e) {
    return fallback
  }
}

const getProjectManagementProductListColumns = async (poolOrTx) => {
  const req = new sql.Request(poolOrTx)
  const rows = await req.query(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = N'项目管理'
      AND COLUMN_NAME IN (N'产品列表', N'产品名称列表')
  `)
  const cols = new Set((rows.recordset || []).map((row) => String(row.COLUMN_NAME || '').trim()))
  return {
    hasProductList: cols.has('产品列表'),
    hasProductNameList: cols.has('产品名称列表')
  }
}

const toSingleItemJsonList = (value) => {
  const text = String(value || '').trim()
  return text ? JSON.stringify([text]) : null
}

const customerExistsByName = async (poolOrTx, customerName) => {
  const req = new sql.Request(poolOrTx)
  req.input('customerName', sql.NVarChar(200), String(customerName || '').trim())
  const rows = await req.query(`
    SELECT TOP 1 客户ID as customerId
    FROM 客户信息
    WHERE 客户名称 = @customerName
      AND ISNULL(是否删除, 0) = 0
  `)
  return Number(rows.recordset?.[0]?.customerId || 0) || null
}

const getQuotationRow = async (poolOrTx, quotationId) => {
  const req = new sql.Request(poolOrTx)
  req.input('quotationId', sql.Int, Number(quotationId) || 0)
  const rows = await req.query(`
    SELECT TOP 1
      报价单ID as id,
      报价单号 as quotationNo,
      报价日期 as quotationDate,
      客户名称 as customerName,
      报价类型 as quotationType,
      来源项目编号 as sourceProjectCode,
      加工零件名称 as partName,
      模具编号 as moldNo,
      经办人 as operator,
      备注 as remark,
      材料明细 as materialsJson,
      加工费用明细 as processesJson,
      零件明细 as partItemsJson,
      其他费用 as otherFee,
      运输费用 as transportFee,
      加工数量 as quantity,
      含税价格 as taxIncludedPrice
    FROM 报价单
    WHERE 报价单ID = @quotationId
  `)
  const row = rows.recordset?.[0] || null
  if (!row) return null
  return {
    ...row,
    quotationType: normalizeQuotationBusinessType(row.quotationType),
    materials: safeJsonParse(row.materialsJson, []),
    processes: safeJsonParse(row.processesJson, []),
    partItems: safeJsonParse(row.partItemsJson, [])
  }
}

const buildDefaultSalesOrderDetails = (quotationRow, projectCode, existingDetails = []) => {
  const normalizedType = normalizeQuotationBusinessType(quotationRow?.quotationType)
  const defaultRemark = String(quotationRow?.remark || '').trim() || null
  const defaultHandler = String(quotationRow?.operator || '').trim() || null
  const formatItemCode = (index, total) => {
    const baseCode = String(projectCode || '').trim() || null
    if (!baseCode) return null
    if (normalizedType !== '零件加工') return baseCode
    if (total <= 1) return baseCode
    return `${baseCode}/${String(index + 1).padStart(2, '0')}`
  }

  if (normalizedType === '零件加工') {
    const items = Array.isArray(quotationRow?.partItems) ? quotationRow.partItems : []
    const details = items.map((item, index) => ({
      key: `part-${index + 1}`,
      name:
        String((existingDetails[index] || {}).name || '').trim() ||
        String(item?.productName || '').trim() ||
        String(item?.partName || '').trim() ||
        null,
      itemCode:
        String((existingDetails[index] || {}).itemCode || '').trim() || formatItemCode(index, items.length),
      productName:
        String((existingDetails[index] || {}).productName || '').trim() ||
        String(item?.productName || '').trim() ||
        String(item?.partName || '').trim() ||
        null,
      productDrawingNo:
        String((existingDetails[index] || {}).productDrawingNo || '').trim() ||
        String(item?.drawingNo || '').trim() ||
        null,
      customerPartNo:
        String((existingDetails[index] || {}).customerPartNo || '').trim() ||
        String(quotationRow?.moldNo || '').trim() ||
        null,
      deliveryDate: null,
      quantity: Number(item?.quantity || 0) || 0,
      unitPrice: Number(item?.unitPrice || 0) || 0,
      totalAmount: (Number(item?.quantity || 0) || 0) * (Number(item?.unitPrice || 0) || 0),
      remark: defaultRemark,
      costSource: null,
      handler: defaultHandler,
      isInStock: false,
      isShipped: false,
      shippingDate: null
    }))
    return details
  }

  const name =
    String((existingDetails[0] || {}).name || '').trim() ||
    String(quotationRow?.partName || '').trim() ||
    null
  const quantity = Number(quotationRow?.quantity || 0) || 0
  const totalAmount = Number(quotationRow?.taxIncludedPrice || 0)
  const detail = {
    key: 'summary-1',
    name,
    itemCode: formatItemCode(0, 1),
    productName:
      String((existingDetails[0] || {}).productName || '').trim() ||
      String(quotationRow?.partName || '').trim() ||
      null,
    productDrawingNo: String((existingDetails[0] || {}).productDrawingNo || '').trim() || null,
    customerPartNo: String(quotationRow?.moldNo || '').trim() || null,
    deliveryDate: null,
    quantity,
    unitPrice: quantity > 0 ? Number((totalAmount / quantity).toFixed(2)) : 0,
    totalAmount,
    remark: defaultRemark,
    costSource: null,
    handler: defaultHandler,
    isInStock: false,
    isShipped: false,
    shippingDate: null
  }
  return [detail]
}

const buildDefaultProjectDetails = (quotationRow, projectCode, existingProjectDetails = []) => {
  const normalizedType = normalizeQuotationBusinessType(quotationRow?.quotationType)
  if (normalizedType === '零件加工') {
    const items = Array.isArray(quotationRow?.partItems) ? quotationRow.partItems : []
    return items.map((item, index) => ({
      key: String((existingProjectDetails[index] || {}).key || `project-${index + 1}`),
      projectCode:
        String((existingProjectDetails[index] || {}).projectCode || '').trim() ||
        `${String(projectCode || '').trim()}${items.length > 1 ? `/${String(index + 1).padStart(2, '0')}` : ''}`,
      productName:
        String((existingProjectDetails[index] || {}).productName || '').trim() ||
        String(item?.partName || '').trim() ||
        String(quotationRow?.partName || '').trim() ||
        null,
      productDrawing:
        String((existingProjectDetails[index] || {}).productDrawing || '').trim() ||
        String(item?.drawingNo || '').trim() ||
        null,
      customerModelNo:
        String((existingProjectDetails[index] || {}).customerModelNo || '').trim() ||
        String(quotationRow?.moldNo || '').trim() ||
        null
    }))
  }
  return [
    {
      key: 'project-1',
      projectCode: String(projectCode || '').trim(),
      productName:
        String((existingProjectDetails[0] || {}).productName || '').trim() ||
        String(quotationRow?.partName || '').trim() ||
        null,
      productDrawing: String((existingProjectDetails[0] || {}).productDrawing || '').trim() || null,
      customerModelNo:
        String((existingProjectDetails[0] || {}).customerModelNo || '').trim() ||
        String(quotationRow?.moldNo || '').trim() ||
        null
    }
  ]
}

const buildDraftsFromQuotation = (quotationRow, existingProjectDraft = {}, existingSalesOrderDraft = {}) => {
  const existingDetails = Array.isArray(existingSalesOrderDraft?.details) ? existingSalesOrderDraft.details : []
  const existingProjectDetails = Array.isArray(existingProjectDraft?.projectDetails)
    ? existingProjectDraft.projectDetails
    : []
  const projectCode =
    String(existingProjectDraft?.projectCode || '').trim() ||
    String(existingProjectDetails[0]?.projectCode || existingDetails[0]?.itemCode || '').trim()
  const inferredCategory = projectCode ? getCategoryFromProjectCode(projectCode) : ''
  const projectDraft = {
    projectCode,
    sourceProjectCode:
      String(existingProjectDraft?.sourceProjectCode || '').trim() ||
      String(quotationRow?.sourceProjectCode || '').trim() ||
      null,
    category: inferredCategory || normalizeQuotationBusinessType(quotationRow?.quotationType) || null,
    customerName: String(quotationRow?.customerName || '').trim() || null,
    productName:
      String(existingProjectDraft?.productName || '').trim() ||
      String(quotationRow?.partName || '').trim() ||
      null,
    productDrawing: String(existingProjectDraft?.productDrawing || '').trim() || null,
    customerModelNo:
      String(existingProjectDraft?.customerModelNo || '').trim() ||
      String(quotationRow?.moldNo || '').trim() ||
      null,
    projectDetails: buildDefaultProjectDetails(quotationRow, projectCode, existingProjectDetails)
  }

  const salesOrderDraft = {
    orderDate: existingSalesOrderDraft?.orderDate || null,
    signDate: existingSalesOrderDraft?.signDate || null,
    contractNo: existingSalesOrderDraft?.contractNo || null,
    customerId: existingSalesOrderDraft?.customerId ?? null,
    details: buildDefaultSalesOrderDetails(quotationRow, projectDraft.projectCode, existingDetails)
  }

  return { projectDraft, salesOrderDraft }
}

const getProjectEntriesFromDrafts = ({ quotationType, projectDraft, salesOrderDraft }) => {
  const normalizedType = normalizeQuotationBusinessType(quotationType)
  const projectDetails = Array.isArray(projectDraft?.projectDetails) ? projectDraft.projectDetails : []
  if (normalizedType !== '零件加工') {
    return [
      {
        projectCode: String(projectDraft?.projectCode || '').trim(),
        customerModelNo: projectDraft?.customerModelNo || null,
        productDrawing: projectDraft?.productDrawing || null,
        productName: projectDraft?.productName || null
      }
    ].filter((item) => item.projectCode)
  }
  if (projectDetails.length) {
    return projectDetails
      .map((detail) => ({
        projectCode: String(detail?.projectCode || '').trim(),
        customerModelNo: detail?.customerModelNo || null,
        productDrawing: detail?.productDrawing || null,
        productName: detail?.productName || null
      }))
      .filter((item) => item.projectCode)
  }
  const details = Array.isArray(salesOrderDraft?.details) ? salesOrderDraft.details : []
  return details
    .map((detail) => ({
      projectCode: String(detail?.itemCode || '').trim(),
      customerModelNo: detail?.customerPartNo || null,
      productDrawing: detail?.productDrawingNo || null,
      productName: detail?.productName || detail?.name || null
    }))
    .filter((item) => item.projectCode)
}

const toResponseRow = (row) => {
  if (!row) return null
  return {
    ...row,
    status: normalizeStatus(row.status),
    status_text: getStatusText(row.status),
    project_draft: safeJsonParse(row.project_draft_json, null),
    sales_order_draft: safeJsonParse(row.sales_order_draft_json, null)
  }
}

const updateRequestStatusByCustomerAvailability = async (poolOrTx, row) => {
  const requestRow = toResponseRow(row)
  if (!requestRow) return null
  const customerName = String(requestRow.customer_name || requestRow.project_draft?.customerName || '').trim()
  const customerId = customerName ? await customerExistsByName(poolOrTx, customerName) : null
  const isCustomerRejected =
    !!String(requestRow.customer_review_rejected_reason || '').trim() &&
    !String(requestRow.initiation_rejected_reason || '').trim()

  let nextStatus = requestRow.status
  if (requestRow.status === STATUS.WAIT_CUSTOMER_REVIEW && customerId) {
    nextStatus = STATUS.DRAFT
  } else if (requestRow.status === STATUS.REJECTED && isCustomerRejected && customerId) {
    nextStatus = STATUS.DRAFT
  }
  if (nextStatus === requestRow.status) return requestRow

  const req = new sql.Request(poolOrTx)
  req.input('id', sql.Int, Number(requestRow.id) || 0)
  req.input('status', sql.NVarChar(40), nextStatus)
  await req.query(`
    UPDATE dbo.quotation_initiation_requests
    SET status = @status,
        customer_review_rejected_reason = NULL,
        updated_at = SYSDATETIME()
    WHERE id = @id
  `)
  const rows = await query(
    `SELECT TOP 1 * FROM dbo.quotation_initiation_requests WHERE id = @id`,
    { id: Number(requestRow.id) || 0 }
  )
  return toResponseRow(rows?.[0] || null)
}

const loadRequestByQuotationId = async (quotationId) => {
  const pool = await getPool()
  await ensureQuotationInitiationTable(pool)
  const rows = await query(
    `SELECT TOP 1 * FROM dbo.quotation_initiation_requests WHERE quotation_id = @quotationId`,
    { quotationId: Number(quotationId) || 0 }
  )
  const row = rows?.[0] || null
  if (!row) return null
  return await updateRequestStatusByCustomerAvailability(pool, row)
}

const checkProjectCodeAvailability = async ({ quotationId, projectCode, quotationType }) => {
  const pool = await getPool()
  await ensureQuotationInitiationTable(pool)
  const category = assertProjectCodeValid({ projectCode, quotationType })
  await ensureProjectCodeAvailable({ tx: pool, projectCode, quotationId })
  return { category }
}

const splitProjectCodeFamily = (projectCode) => {
  const code = String(projectCode || '').trim().toUpperCase()
  const match = code.match(/^(.*?)(\/\d{2})$/)
  return {
    code,
    familyBase: match ? match[1] : code,
    hasSuffix: !!match
  }
}

const assertEditableStatus = (status) => {
  const normalized = normalizeStatus(status)
  if (normalized === STATUS.PENDING || normalized === STATUS.APPROVED) {
    throw new Error('当前状态不可修改')
  }
}

const ensureProjectCodeAvailable = async ({ tx, projectCode, quotationId }) => {
  const { code, familyBase } = splitProjectCodeFamily(projectCode)
  if (!code) throw new Error('项目编号不能为空')

  const projectReq = new sql.Request(tx)
  projectReq.input('projectCode', sql.NVarChar(50), code)
  projectReq.input('familyBase', sql.NVarChar(50), familyBase)
  const existingProjectManageRows = await projectReq.query(`
    SELECT TOP 1 项目编号 as projectCode
    FROM 项目管理
    WHERE 项目编号 = @projectCode
       OR (@projectCode <> @familyBase AND 项目编号 = @familyBase)
       OR (@projectCode = @familyBase AND 项目编号 LIKE @familyBase + N'/%')
  `)
  if (existingProjectManageRows.recordset?.[0]?.projectCode) {
    throw new Error(`项目编号 "${code}" 已存在`)
  }

  const goodsReq = new sql.Request(tx)
  goodsReq.input('projectCode', sql.NVarChar(50), code)
  goodsReq.input('familyBase', sql.NVarChar(50), familyBase)
  const existingProjectRows = await goodsReq.query(`
    SELECT TOP 1 项目编号 as projectCode
    FROM 货物信息
    WHERE 项目编号 = @projectCode
       OR (@projectCode <> @familyBase AND 项目编号 = @familyBase)
       OR (@projectCode = @familyBase AND 项目编号 LIKE @familyBase + N'/%')
  `)
  if (existingProjectRows.recordset?.[0]?.projectCode) {
    throw new Error(`项目编号 "${code}" 已存在`)
  }

  const req = new sql.Request(tx)
  req.input('projectCode', sql.NVarChar(50), code)
  req.input('familyBase', sql.NVarChar(50), familyBase)
  req.input('projectCodeDraftToken', sql.NVarChar(100), `"projectCode":"${code}"`)
  req.input('familyBaseDraftToken', sql.NVarChar(100), `"projectCode":"${familyBase}"`)
  req.input('familyPrefixDraftToken', sql.NVarChar(100), `"projectCode":"${familyBase}/`)
  req.input('projectCodeJsonToken', sql.NVarChar(100), `"itemCode":"${code}"`)
  req.input('familyBaseJsonToken', sql.NVarChar(100), `"itemCode":"${familyBase}"`)
  req.input('familyPrefixJsonToken', sql.NVarChar(100), `"itemCode":"${familyBase}/`)
  req.input('quotationId', sql.Int, Number(quotationId) || 0)
  const rows = await req.query(`
    SELECT TOP 1 id
    FROM dbo.quotation_initiation_requests
    WHERE (
      project_code_candidate = @projectCode
      OR (@projectCode <> @familyBase AND project_code_candidate = @familyBase)
      OR (@projectCode = @familyBase AND project_code_candidate LIKE @familyBase + N'/%')
      OR project_code_final = @projectCode
      OR (@projectCode <> @familyBase AND project_code_final = @familyBase)
      OR (@projectCode = @familyBase AND project_code_final LIKE @familyBase + N'/%')
      OR JSON_VALUE(project_draft_json, '$.projectCode') = @projectCode
      OR (@projectCode <> @familyBase AND JSON_VALUE(project_draft_json, '$.projectCode') = @familyBase)
      OR (@projectCode = @familyBase AND JSON_VALUE(project_draft_json, '$.projectCode') LIKE @familyBase + N'/%')
      OR CHARINDEX(@projectCodeDraftToken, ISNULL(project_draft_json, N'')) > 0
      OR (
        @projectCode <> @familyBase
        AND CHARINDEX(@familyBaseDraftToken, ISNULL(project_draft_json, N'')) > 0
      )
      OR (
        @projectCode = @familyBase
        AND CHARINDEX(@familyPrefixDraftToken, ISNULL(project_draft_json, N'')) > 0
      )
      OR CHARINDEX(@projectCodeJsonToken, ISNULL(sales_order_draft_json, N'')) > 0
      OR (
        @projectCode <> @familyBase
        AND CHARINDEX(@familyBaseJsonToken, ISNULL(sales_order_draft_json, N'')) > 0
      )
      OR (
        @projectCode = @familyBase
        AND CHARINDEX(@familyPrefixJsonToken, ISNULL(sales_order_draft_json, N'')) > 0
      )
    )
      AND quotation_id <> @quotationId
      AND status <> N'WITHDRAWN'
      AND status <> N'REJECTED'
    ORDER BY updated_at DESC, id DESC
  `)
  if (rows.recordset?.[0]?.id) {
    throw new Error(`项目编号 "${code}" 已被其他立项单占用`)
  }
}

const upsertDraft = async ({ quotationId, actor, projectDraftInput, salesOrderDraftInput }) => {
  const pool = await getPool()
  await ensureQuotationInitiationTable(pool)
  const tx = new sql.Transaction(pool)
  await tx.begin()
  try {
    const quotationRow = await getQuotationRow(tx, quotationId)
    if (!quotationRow) throw new Error('报价单不存在')

    const existingReq = new sql.Request(tx)
    existingReq.input('quotationId', sql.Int, Number(quotationId) || 0)
    const existingRows = await existingReq.query(
      `SELECT TOP 1 * FROM dbo.quotation_initiation_requests WHERE quotation_id = @quotationId`
    )
    const existing = existingRows.recordset?.[0] || null
    assertEditableStatus(existing?.status)

    const currentProjectDraft = safeJsonParse(existing?.project_draft_json, {})
    const currentSalesDraft = safeJsonParse(existing?.sales_order_draft_json, {})
    const mergedProjectDraft = { ...currentProjectDraft, ...(projectDraftInput || {}) }
    const mergedSalesOrderDraft = { ...currentSalesDraft, ...(salesOrderDraftInput || {}) }
    const syncedDrafts = buildDraftsFromQuotation(quotationRow, mergedProjectDraft, mergedSalesOrderDraft)

    const projectEntries = getProjectEntriesFromDrafts({
      quotationType: quotationRow.quotationType,
      projectDraft: syncedDrafts.projectDraft,
      salesOrderDraft: syncedDrafts.salesOrderDraft
    })
    if (!projectEntries.length) throw new Error('项目信息不能为空')
    if (new Set(projectEntries.map((item) => item.projectCode)).size !== projectEntries.length) {
      throw new Error('项目信息中的项目编号不能重复')
    }
    for (const entry of projectEntries) {
      assertProjectCodeValid({ projectCode: entry.projectCode, quotationType: quotationRow.quotationType })
      await ensureProjectCodeAvailable({ tx, projectCode: entry.projectCode, quotationId })
    }
    const projectCodeSet = new Set(projectEntries.map((item) => item.projectCode))
    const salesDetails = Array.isArray(syncedDrafts.salesOrderDraft?.details) ? syncedDrafts.salesOrderDraft.details : []
    const missingReferencedCode = salesDetails.find(
      (detail) => !projectCodeSet.has(String(detail?.itemCode || '').trim())
    )
    if (missingReferencedCode) {
      throw new Error(`销售订单项目编号未在项目信息中创建：${String(missingReferencedCode.itemCode || '').trim()}`)
    }

    const customerName = String(quotationRow.customerName || '').trim()
    const customerId = customerName ? await customerExistsByName(tx, customerName) : null
    const nextStatus = customerId ? STATUS.DRAFT : STATUS.WAIT_CUSTOMER_REVIEW

    const req = new sql.Request(tx)
    req.input('quotationId', sql.Int, Number(quotationId) || 0)
    req.input('status', sql.NVarChar(40), nextStatus)
    req.input('customerName', sql.NVarChar(200), customerName || null)
    req.input(
      'projectCodeCandidate',
      sql.NVarChar(50),
      String(projectEntries[0]?.projectCode || syncedDrafts.projectDraft.projectCode || '').trim() ||
        null
    )
    req.input('projectDraftJson', sql.NVarChar(sql.MAX), JSON.stringify(syncedDrafts.projectDraft))
    req.input('salesOrderDraftJson', sql.NVarChar(sql.MAX), JSON.stringify(syncedDrafts.salesOrderDraft))
    req.input('actor', sql.NVarChar(100), actor || null)
    await req.query(`
      MERGE dbo.quotation_initiation_requests AS target
      USING (SELECT @quotationId AS quotation_id) AS src
      ON target.quotation_id = src.quotation_id
      WHEN MATCHED THEN
        UPDATE SET
          status = @status,
          customer_name = @customerName,
          project_code_candidate = @projectCodeCandidate,
          project_draft_json = @projectDraftJson,
          sales_order_draft_json = @salesOrderDraftJson,
          customer_review_rejected_reason = CASE WHEN @status = N'DRAFT' THEN NULL ELSE target.customer_review_rejected_reason END,
          updated_at = SYSDATETIME(),
          draft_saved_at = SYSDATETIME()
      WHEN NOT MATCHED THEN
        INSERT (
          quotation_id, status, customer_name, project_code_candidate, project_draft_json, sales_order_draft_json,
          created_by, created_at, updated_at, draft_saved_at
        ) VALUES (
          @quotationId, @status, @customerName, @projectCodeCandidate, @projectDraftJson, @salesOrderDraftJson,
          @actor, SYSDATETIME(), SYSDATETIME(), SYSDATETIME()
        );
    `)

    const finalReq = new sql.Request(tx)
    finalReq.input('quotationId', sql.Int, Number(quotationId) || 0)
    const finalRowsResult = await finalReq.query(
      `SELECT TOP 1 * FROM dbo.quotation_initiation_requests WHERE quotation_id = @quotationId`
    )
    await tx.commit()
    return toResponseRow(finalRowsResult.recordset?.[0] || null)
  } catch (e) {
    try {
      await tx.rollback()
    } catch {}
    throw e
  }
}

const syncDraftFromQuotation = async (quotationId) => {
  const pool = await getPool()
  await ensureQuotationInitiationTable(pool)
  const rows = await query(
    `SELECT TOP 1 * FROM dbo.quotation_initiation_requests WHERE quotation_id = @quotationId`,
    { quotationId: Number(quotationId) || 0 }
  )
  const row = rows?.[0] || null
  if (!row) return null
  const status = normalizeStatus(row.status)
  if (![STATUS.DRAFT, STATUS.WAIT_CUSTOMER_REVIEW, STATUS.REJECTED, STATUS.WITHDRAWN].includes(status)) {
    return toResponseRow(row)
  }
  const quotationRow = await getQuotationRow(pool, quotationId)
  if (!quotationRow) return toResponseRow(row)
  const currentProjectDraft = safeJsonParse(row.project_draft_json, {})
  const currentSalesDraft = safeJsonParse(row.sales_order_draft_json, {})
  const syncedDrafts = buildDraftsFromQuotation(quotationRow, currentProjectDraft, currentSalesDraft)
  await query(
    `
      UPDATE dbo.quotation_initiation_requests
      SET customer_name = @customerName,
          project_draft_json = @projectDraftJson,
          sales_order_draft_json = @salesOrderDraftJson,
          project_code_candidate = @projectCodeCandidate,
          updated_at = SYSDATETIME()
      WHERE quotation_id = @quotationId
    `,
    {
      quotationId: Number(quotationId) || 0,
      customerName: String(quotationRow.customerName || '').trim() || null,
      projectDraftJson: JSON.stringify(syncedDrafts.projectDraft),
      salesOrderDraftJson: JSON.stringify(syncedDrafts.salesOrderDraft),
      projectCodeCandidate: String(syncedDrafts.projectDraft.projectCode || '').trim() || null
    }
  )
  const refreshedRows = await query(
    `SELECT TOP 1 * FROM dbo.quotation_initiation_requests WHERE quotation_id = @quotationId`,
    { quotationId: Number(quotationId) || 0 }
  )
  return await updateRequestStatusByCustomerAvailability(pool, refreshedRows?.[0] || null)
}

const generateSalesOrderNo = async (tx) => {
  const now = new Date()
  const chinaTimestamp = now.getTime() + 8 * 60 * 60 * 1000
  const chinaTime = new Date(chinaTimestamp)
  const year = chinaTime.getUTCFullYear()
  const month = String(chinaTime.getUTCMonth() + 1).padStart(2, '0')
  const day = String(chinaTime.getUTCDate()).padStart(2, '0')
  const orderDate = `${year}${month}${day}`
  const req = new sql.Request(tx)
  const result = await req.query(`
    SELECT TOP 1 订单编号 as orderNo
    FROM 销售订单
    WHERE 订单编号 LIKE 'XS-%'
    ORDER BY 订单编号 DESC
  `)
  let serialNumber = 1
  if (result.recordset?.[0]?.orderNo) {
    const match = String(result.recordset[0].orderNo).match(/^XS-(\d{8})-(\d{3})$/)
    if (match) {
      if (match[1] === orderDate) serialNumber = Number(match[2]) + 1
    }
  }
  return `XS-${orderDate}-${String(serialNumber).padStart(3, '0')}`
}

const createGoodsAndScaffold = async ({ tx, projectCode, customerName, customerModelNo, productDrawing, productName, category, remarks }) => {
  const customerId = customerName ? await customerExistsByName(tx, customerName) : null
  const checkReq = new sql.Request(tx)
  checkReq.input('projectCode', sql.NVarChar(50), projectCode)
  const checkRows = await checkReq.query(`SELECT COUNT(*) as cnt FROM 货物信息 WHERE 项目编号 = @projectCode`)
  if ((checkRows.recordset?.[0]?.cnt || 0) > 0) throw new Error(`项目编号 "${projectCode}" 已存在`)

  const projectReq = new sql.Request(tx)
  projectReq.input('projectCode', sql.NVarChar(50), projectCode)
  const projectRows = await projectReq.query(`SELECT COUNT(*) as cnt FROM 项目管理 WHERE 项目编号 = @projectCode`)
  const projectExists = (projectRows.recordset?.[0]?.cnt || 0) > 0
  if (projectExists) throw new Error(`项目编号 "${projectCode}" 已存在`)
  if (!projectExists) {
    const ins = new sql.Request(tx)
    const columns = ['项目编号']
    const values = ['@projectCode']
    ins.input('projectCode', sql.NVarChar(50), projectCode)
    if (customerId) {
      columns.push('客户ID', '客户模号')
      values.push('@customerId', '@customerModelNo')
      ins.input('customerId', sql.Int, customerId)
      ins.input('customerModelNo', sql.NVarChar(100), customerModelNo || null)
    }

    const productListColumns = await getProjectManagementProductListColumns(tx)
    const productListJson = toSingleItemJsonList(productDrawing)
    const productNameListJson = toSingleItemJsonList(productName)
    if (productListColumns.hasProductList && productListJson) {
      columns.push('产品列表')
      values.push('@productListJson')
      ins.input('productListJson', sql.NVarChar(sql.MAX), productListJson)
    }
    if (productListColumns.hasProductNameList && productNameListJson) {
      columns.push('产品名称列表')
      values.push('@productNameListJson')
      ins.input('productNameListJson', sql.NVarChar(sql.MAX), productNameListJson)
    }

    await ins.query(`
      INSERT INTO 项目管理 (${columns.join(', ')})
      VALUES (${values.join(', ')})
    `)
  }

  const goodsReq = new sql.Request(tx)
  goodsReq.input('projectCode', sql.NVarChar(50), projectCode)
  goodsReq.input('productDrawing', sql.NVarChar(200), productDrawing || null)
  goodsReq.input('productName', sql.NVarChar(200), productName || null)
  goodsReq.input('category', sql.NVarChar(50), category || null)
  goodsReq.input('remarks', sql.NVarChar(sql.MAX), remarks || null)
  await goodsReq.query(`
    INSERT INTO 货物信息 (项目编号, 产品图号, 产品名称, 分类, 备注, IsNew)
    VALUES (@projectCode, @productDrawing, @productName, @category, @remarks, 1)
  `)

  const taskReq = new sql.Request(tx)
  taskReq.input('projectCode', sql.NVarChar(50), projectCode)
  const taskRows = await taskReq.query(`SELECT COUNT(*) as cnt FROM 生产任务 WHERE 项目编号 = @projectCode`)
  if ((taskRows.recordset?.[0]?.cnt || 0) <= 0) {
    const insTask = new sql.Request(tx)
    insTask.input('projectCode', sql.NVarChar(50), projectCode)
    await insTask.query(`INSERT INTO 生产任务 (项目编号) VALUES (@projectCode)`)
  }
}

const createSalesOrderRecords = async ({ tx, customerId, orderNo, salesOrderDraft }) => {
  const details = Array.isArray(salesOrderDraft?.details) ? salesOrderDraft.details : []
  if (!details.length) throw new Error('订单明细不能为空')
  for (const detail of details) {
    const itemCode = String(detail?.itemCode || '').trim()
    if (!itemCode) throw new Error('订单明细项目编号不能为空')
    if (!(Number(detail?.quantity || 0) > 0)) throw new Error('订单明细数量不能为空')
    const insertReq = new sql.Request(tx)
    insertReq.input('orderNo', sql.NVarChar(50), orderNo)
    insertReq.input('customerId', sql.Int, customerId)
    insertReq.input('itemCode', sql.NVarChar(50), itemCode)
    insertReq.input('orderDate', sql.NVarChar(20), salesOrderDraft?.orderDate || null)
    insertReq.input('deliveryDate', sql.NVarChar(20), detail?.deliveryDate || null)
    insertReq.input('signDate', sql.NVarChar(20), salesOrderDraft?.signDate || null)
    insertReq.input('contractNo', sql.NVarChar(100), salesOrderDraft?.contractNo || null)
    insertReq.input('totalAmount', sql.Float, Number(detail?.totalAmount || 0))
    insertReq.input('unitPrice', sql.Float, Number(detail?.unitPrice || 0))
    insertReq.input('quantity', sql.Int, Number(detail?.quantity || 0))
    insertReq.input('remark', sql.NVarChar(500), detail?.remark || null)
    insertReq.input('costSource', sql.NVarChar(200), detail?.costSource || null)
    insertReq.input('handler', sql.NVarChar(100), detail?.handler || null)
    insertReq.input('isInStock', sql.Bit, detail?.isInStock ? 1 : 0)
    insertReq.input('isShipped', sql.Bit, detail?.isShipped ? 1 : 0)
    insertReq.input('shippingDate', sql.NVarChar(20), detail?.shippingDate || null)
    await insertReq.query(`
      INSERT INTO 销售订单 (
        订单编号, 客户ID, 项目编号, 订单日期, 交货日期, 签订日期, 合同号,
        总金额, 单价, 数量, 备注, 费用出处, 经办人, 是否入库, 是否出运, 出运日期
      ) VALUES (
        @orderNo, @customerId, @itemCode,
        @orderDate, @deliveryDate, @signDate, @contractNo,
        @totalAmount, @unitPrice, @quantity, @remark, @costSource, @handler, @isInStock, @isShipped, @shippingDate
      )
    `)
  }
}

const approveAndApply = async ({ req, quotationId, resolveActorFromReq }) => {
  await assertReviewPermission({
    req,
    actionKey: QUOTATION_INITIATION_REVIEW_ACTION,
    resolveActorFromReq,
    legacyAllowWhenEmpty: true
  })
  const actor = resolveActorFromReq(req)
  const pool = await getPool()
  await ensureQuotationInitiationTable(pool)
  const tx = new sql.Transaction(pool)
  await tx.begin()
  try {
    const reqLock = new sql.Request(tx)
    reqLock.input('quotationId', sql.Int, Number(quotationId) || 0)
    const requestRows = await reqLock.query(`
      SELECT TOP 1 *
      FROM dbo.quotation_initiation_requests WITH (UPDLOCK, HOLDLOCK)
      WHERE quotation_id = @quotationId
    `)
    const requestRow = requestRows.recordset?.[0] || null
    if (!requestRow) {
      const err = new Error('立项申请单不存在')
      err.statusCode = 404
      throw err
    }
    if (normalizeStatus(requestRow.status) !== STATUS.PENDING) {
      const err = new Error('仅审核中状态可通过')
      err.statusCode = 400
      throw err
    }
    const projectDraft = safeJsonParse(requestRow.project_draft_json, {})
    const salesOrderDraft = safeJsonParse(requestRow.sales_order_draft_json, {})
    const quotationRow = await getQuotationRow(tx, quotationId)
    if (!quotationRow) {
      const err = new Error('报价单不存在')
      err.statusCode = 404
      throw err
    }

    const projectEntries = getProjectEntriesFromDrafts({
      quotationType: quotationRow.quotationType,
      projectDraft,
      salesOrderDraft
    })
    if (!projectEntries.length) {
      const err = new Error('项目信息不能为空')
      err.statusCode = 400
      throw err
    }
    if (new Set(projectEntries.map((item) => item.projectCode)).size !== projectEntries.length) {
      const err = new Error('项目信息中的项目编号不能重复')
      err.statusCode = 400
      throw err
    }
    const projectCodeSet = new Set(projectEntries.map((item) => item.projectCode))
    const salesDetails = Array.isArray(salesOrderDraft?.details) ? salesOrderDraft.details : []
    const missingReferencedCode = salesDetails.find(
      (detail) => !projectCodeSet.has(String(detail?.itemCode || '').trim())
    )
    if (missingReferencedCode) {
      const err = new Error(`销售订单项目编号未在项目信息中创建：${String(missingReferencedCode.itemCode || '').trim()}`)
      err.statusCode = 400
      throw err
    }
    const category = assertProjectCodeValid({
      projectCode: projectEntries[0].projectCode,
      quotationType: quotationRow.quotationType
    })
    for (const entry of projectEntries) {
      assertProjectCodeValid({
        projectCode: entry.projectCode,
        quotationType: quotationRow.quotationType
      })
    }
    const customerName = String(projectDraft.customerName || quotationRow.customerName || '').trim()
    const customerId = customerName ? await customerExistsByName(tx, customerName) : null
    if (!customerId) {
      const err = new Error('客户不存在，无法入库')
      err.statusCode = 400
      throw err
    }

    const orderNo = await generateSalesOrderNo(tx)
    for (const entry of projectEntries) {
      await createGoodsAndScaffold({
        tx,
        projectCode: entry.projectCode,
        customerName,
        customerModelNo: entry.customerModelNo,
        productDrawing: entry.productDrawing,
        productName: entry.productName,
        category,
        remarks: quotationRow.remark
      })
    }
    await createSalesOrderRecords({
      tx,
      customerId,
      orderNo,
      salesOrderDraft
    })

    const updateReq = new sql.Request(tx)
    updateReq.input('quotationId', sql.Int, Number(quotationId) || 0)
    updateReq.input('projectCode', sql.NVarChar(50), String(projectEntries[0]?.projectCode || '').trim())
    updateReq.input('orderNo', sql.NVarChar(50), orderNo)
    updateReq.input('actor', sql.NVarChar(100), actor || null)
    await updateReq.query(`
      UPDATE dbo.quotation_initiation_requests
      SET status = N'APPROVED',
          project_code_final = @projectCode,
          sales_order_no = @orderNo,
          approved_by = @actor,
          approved_at = SYSDATETIME(),
          updated_at = SYSDATETIME(),
          initiation_rejected_reason = NULL,
          customer_review_rejected_reason = NULL,
          withdraw_reason = NULL
      WHERE quotation_id = @quotationId
    `)

    await tx.commit()
    return { projectCode: String(projectEntries[0]?.projectCode || '').trim(), orderNo }
  } catch (e) {
    try {
      await tx.rollback()
    } catch {}
    throw e
  }
}

const listReviewTasks = async ({ page = 1, pageSize = 20, status = '', keyword = '', req, resolveActorFromReq }) => {
  await assertReviewPermission({
    req,
    actionKey: QUOTATION_INITIATION_REVIEW_ACTION,
    resolveActorFromReq,
    legacyAllowWhenEmpty: true
  })
  const pool = await getPool()
  await ensureQuotationInitiationTable(pool)

  const whereParts = ['1=1']
  const params = {
    offset: (page - 1) * pageSize,
    pageSize
  }
  if (status) {
    whereParts.push('r.status = @status')
    params.status = status
  }
  if (keyword) {
    whereParts.push(`(
      q.报价单号 LIKE @keyword
      OR q.客户名称 LIKE @keyword
      OR r.project_code_candidate LIKE @keyword
      OR r.project_code_final LIKE @keyword
      OR r.sales_order_no LIKE @keyword
      OR q.加工零件名称 LIKE @keyword
      OR q.模具编号 LIKE @keyword
    )`)
    params.keyword = `%${keyword}%`
  }
  const whereSql = whereParts.join(' AND ')

  const rows = await query(
    `
      WITH ordered AS (
        SELECT
          r.*,
          q.报价单号 as quotation_no,
          q.客户名称 as quotation_customer_name,
          q.加工零件名称 as quotation_part_name,
          q.模具编号 as quotation_mold_no,
          ROW_NUMBER() OVER (
            ORDER BY
              CASE r.status
                WHEN N'PENDING' THEN 0
                WHEN N'WAIT_CUSTOMER_REVIEW' THEN 1
                WHEN N'DRAFT' THEN 2
                WHEN N'REJECTED' THEN 3
                WHEN N'WITHDRAWN' THEN 4
                WHEN N'APPROVED' THEN 5
                ELSE 9
              END ASC,
              r.updated_at DESC,
              r.id DESC
          ) AS rn
        FROM dbo.quotation_initiation_requests r
        INNER JOIN 报价单 q ON q.报价单ID = r.quotation_id
        WHERE ${whereSql}
      )
      SELECT *
      FROM ordered
      WHERE rn > @offset AND rn <= (@offset + @pageSize)
      ORDER BY rn ASC
    `,
    params
  )
  const totalRows = await query(
    `
      SELECT COUNT(1) AS total
      FROM dbo.quotation_initiation_requests r
      INNER JOIN 报价单 q ON q.报价单ID = r.quotation_id
      WHERE ${whereSql}
    `,
    params
  )
  return {
    page,
    pageSize,
    total: Number(totalRows?.[0]?.total || 0) || 0,
    list: (rows || []).map((row) => ({
      ...toResponseRow(row),
      quotation_no: row.quotation_no,
      quotation_customer_name: row.quotation_customer_name,
      quotation_part_name: row.quotation_part_name,
      quotation_mold_no: row.quotation_mold_no
    }))
  }
}

module.exports = {
  STATUS,
  normalizeStatus,
  getStatusText,
  normalizeQuotationBusinessType,
  getCategoryFromProjectCode,
  assertProjectCodeValid,
  ensureQuotationInitiationTable,
  loadRequestByQuotationId,
  checkProjectCodeAvailability,
  upsertDraft,
  syncDraftFromQuotation,
  toResponseRow,
  approveAndApply,
  listReviewTasks
}
