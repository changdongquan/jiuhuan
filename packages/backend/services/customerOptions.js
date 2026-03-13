const { query } = require('../database')

const normalizeStatus = (status) => String(status || 'active').trim().toLowerCase()

const buildCustomerStatusWhereParts = (status, alias = '') => {
  const prefix = alias ? `${alias}.` : ''
  const whereParts = [`ISNULL(${prefix}是否删除, 0) = 0`]
  const normalized = normalizeStatus(status)

  if (normalized === 'active') {
    whereParts.push(`(${prefix}是否停用 = 0 OR ${prefix}是否停用 IS NULL)`)
  } else if (normalized === 'inactive') {
    whereParts.push(`${prefix}是否停用 = 1`)
  }

  return whereParts
}

const listCustomerOptions = async ({ status = 'active' } = {}) => {
  const whereParts = buildCustomerStatusWhereParts(status)
  return query(`
    SELECT
      客户ID as id,
      客户名称 as customerName,
      CASE WHEN 是否停用 = 1 THEN 'inactive' ELSE 'active' END as status
    FROM 客户信息
    WHERE ${whereParts.join(' AND ')}
    ORDER BY ISNULL(SeqNumber, 2147483647) ASC, 客户ID ASC
  `)
}

const listProjectCustomerOptions = async ({ keyword = '' } = {}) => {
  const params = {}
  const whereParts = [
    `(p.状态 IS NULL OR p.状态 <> N'已删除')`,
    `c.客户名称 IS NOT NULL`,
    `LTRIM(RTRIM(c.客户名称)) <> ''`
  ]

  const keywordText = String(keyword || '').trim()
  if (keywordText) {
    whereParts.push(`c.客户名称 LIKE @keyword`)
    params.keyword = `%${keywordText}%`
  }

  return query(
    `
      SELECT
        c.客户ID as customerId,
        LTRIM(RTRIM(c.客户名称)) as customerName,
        ISNULL(c.SeqNumber, 2147483647) as seqNumber
      FROM 项目管理 p
      LEFT JOIN 客户信息 c ON c.客户ID = p.客户ID
      WHERE ${whereParts.join(' AND ')}
      GROUP BY c.客户ID, c.客户名称, c.SeqNumber
      ORDER BY ISNULL(c.SeqNumber, 2147483647) ASC, c.客户ID ASC
    `,
    params
  )
}

module.exports = {
  buildCustomerStatusWhereParts,
  listCustomerOptions,
  listProjectCustomerOptions
}
