const sql = require('mssql')
const config = require('../../config')

/**
 * 获取生产任务表的所有字段
 */
async function getProductionTaskColumns() {
  let pool = null

  try {
    console.log('正在连接数据库...')
    pool = await sql.connect(config)
    console.log('✅ 数据库连接成功\n')

    const columnsQuery = `
      SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        IS_NULLABLE,
        CHARACTER_MAXIMUM_LENGTH,
        NUMERIC_PRECISION,
        ORDINAL_POSITION
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = '生产任务'
      ORDER BY ORDINAL_POSITION
    `

    const result = await pool.request().query(columnsQuery)

    console.log(`\n生产任务表共有 ${result.recordset.length} 个字段:\n`)
    console.table(
      result.recordset.map((col) => ({
        序号: col.ORDINAL_POSITION,
        字段名: col.COLUMN_NAME,
        数据类型: col.DATA_TYPE,
        允许NULL: col.IS_NULLABLE === 'YES' ? '是' : '否',
        长度: col.CHARACTER_MAXIMUM_LENGTH || col.NUMERIC_PRECISION || 'N/A'
      }))
    )
  } catch (err) {
    console.error('❌ 查询失败:', err)
  } finally {
    if (pool) {
      await pool.close()
    }
  }
}

if (require.main === module) {
  getProductionTaskColumns()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}

module.exports = { getProductionTaskColumns }
