const sql = require('mssql')
const config = require('../../config')

const TABLE_DETAIL = '考勤明细'

async function splitUtilitiesFee() {
  let pool = null
  try {
    console.log('正在连接数据库...')
    pool = await sql.connect(config)
    console.log('✅ 数据库连接成功\n')

    const hasColumn = async (columnName) => {
      const result = await pool
        .request()
        .input('table', sql.NVarChar, TABLE_DETAIL)
        .input('column', sql.NVarChar, columnName)
        .query(
          `
          SELECT 1
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_NAME = @table AND COLUMN_NAME = @column
        `
        )
      return result.recordset.length > 0
    }

    const hasUtilitiesFee = await hasColumn('水电费')
    const hasWaterFee = await hasColumn('水费')
    const hasElectricityFee = await hasColumn('电费')

    if (!hasWaterFee) {
      console.log('添加字段：水费')
      await pool.request().query(`ALTER TABLE ${TABLE_DETAIL} ADD 水费 DECIMAL(10,2) NULL`)
    }

    if (!hasElectricityFee) {
      console.log('添加字段：电费')
      await pool.request().query(`ALTER TABLE ${TABLE_DETAIL} ADD 电费 DECIMAL(10,2) NULL`)
    }

    if (hasUtilitiesFee) {
      console.log('迁移历史数据：水电费 -> 水费（电费保持为空）')
      await pool.request().query(`
        UPDATE ${TABLE_DETAIL}
        SET 水费 = ISNULL(水费, 水电费)
        WHERE 水电费 IS NOT NULL
      `)

      console.log('删除旧字段：水电费')
      await pool.request().query(`ALTER TABLE ${TABLE_DETAIL} DROP COLUMN 水电费`)
    } else {
      console.log('未发现旧字段：水电费，跳过迁移与删除')
    }

    console.log('\n✅ 考勤明细字段调整完成')
  } finally {
    if (pool) {
      await pool.close()
      console.log('数据库连接已关闭')
    }
  }
}

if (require.main === module) {
  splitUtilitiesFee()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('脚本执行失败:', err)
      process.exit(1)
    })
}

module.exports = { splitUtilitiesFee }
