const sql = require('mssql')
const config = require('./config')

/**
 * 将生产任务单表的字段复制到生产任务表（排除任务ID、任务单编号、订单编号）
 */
async function copyFieldsToProductionTask() {
  let pool = null

  try {
    console.log('正在连接数据库...')
    pool = await sql.connect(config)
    console.log('✅ 数据库连接成功\n')

    // 1. 获取生产任务单表的所有字段
    console.log('='.repeat(60))
    console.log('📋 获取生产任务单表的字段结构')
    console.log('='.repeat(60))

    const columnsQuery = `
      SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        IS_NULLABLE,
        CHARACTER_MAXIMUM_LENGTH,
        NUMERIC_PRECISION,
        NUMERIC_SCALE,
        COLUMN_DEFAULT,
        ORDINAL_POSITION
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = '生产任务单'
      ORDER BY ORDINAL_POSITION
    `

    const columnsResult = await pool.request().query(columnsQuery)
    console.log(`✅ 获取到 ${columnsResult.recordset.length} 个字段`)

    // 2. 过滤掉不需要的字段
    const excludeFields = ['任务ID', '任务单编号', '订单编号', 'SSMA_TimeStamp']
    const fieldsToAdd = columnsResult.recordset.filter(
      (col) => !excludeFields.includes(col.COLUMN_NAME)
    )

    console.log(`\n📋 需要添加的字段（排除 ${excludeFields.join(', ')}）:`)
    console.table(
      fieldsToAdd.map((col) => ({
        字段名: col.COLUMN_NAME,
        数据类型: col.DATA_TYPE,
        允许NULL: col.IS_NULLABLE === 'YES' ? '是' : '否',
        长度: col.CHARACTER_MAXIMUM_LENGTH || col.NUMERIC_PRECISION || 'N/A'
      }))
    )

    // 3. 获取生产任务表的现有字段
    console.log('\n' + '='.repeat(60))
    console.log('📋 检查生产任务表的现有字段')
    console.log('='.repeat(60))

    const existingColumnsQuery = `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = '生产任务'
      ORDER BY ORDINAL_POSITION
    `
    const existingColumns = await pool.request().query(existingColumnsQuery)
    const existingFieldNames = existingColumns.recordset.map((r) => r.COLUMN_NAME)

    console.log(`✅ 生产任务表现有 ${existingFieldNames.length} 个字段`)
    if (existingFieldNames.length > 0) {
      console.log(`   现有字段: ${existingFieldNames.join(', ')}`)
    }

    // 4. 找出需要添加的字段（排除已存在的）
    const fieldsToActuallyAdd = fieldsToAdd.filter(
      (col) => !existingFieldNames.includes(col.COLUMN_NAME)
    )

    console.log(`\n📋 需要新增 ${fieldsToActuallyAdd.length} 个字段:`)
    if (fieldsToActuallyAdd.length > 0) {
      console.table(
        fieldsToActuallyAdd.map((col) => ({
          字段名: col.COLUMN_NAME,
          数据类型: col.DATA_TYPE,
          允许NULL: col.IS_NULLABLE === 'YES' ? '是' : '否'
        }))
      )
    } else {
      console.log('✅ 所有字段都已存在，无需添加')
    }

    // 5. 添加字段
    if (fieldsToActuallyAdd.length > 0) {
      console.log('\n' + '='.repeat(60))
      console.log('📝 开始添加字段到生产任务表')
      console.log('='.repeat(60))

      for (const col of fieldsToActuallyAdd) {
        try {
          let dataType = col.DATA_TYPE.toUpperCase()
          if (dataType === 'NVARCHAR' || dataType === 'VARCHAR') {
            const length =
              col.CHARACTER_MAXIMUM_LENGTH === -1 ? 'MAX' : col.CHARACTER_MAXIMUM_LENGTH
            dataType = `${dataType}(${length})`
          } else if (dataType === 'DECIMAL' || dataType === 'NUMERIC') {
            dataType = `${dataType}(${col.NUMERIC_PRECISION},${col.NUMERIC_SCALE})`
          }

          let alterSQL = `ALTER TABLE 生产任务 ADD ${col.COLUMN_NAME} ${dataType}`

          if (col.IS_NULLABLE === 'NO') {
            alterSQL += ' NOT NULL'
          }

          // 处理默认值
          if (col.COLUMN_DEFAULT) {
            if (col.COLUMN_DEFAULT.includes('GETDATE')) {
              alterSQL += ' DEFAULT GETDATE()'
            } else if (col.COLUMN_DEFAULT.includes('((0))')) {
              alterSQL += ' DEFAULT 0'
            }
          }

          await pool.request().query(alterSQL)
          console.log(`✅ 已添加字段: ${col.COLUMN_NAME} (${dataType})`)
        } catch (err) {
          console.error(`❌ 添加字段 ${col.COLUMN_NAME} 失败:`, err.message)
        }
      }
    }

    // 6. 验证最终结果
    console.log('\n' + '='.repeat(60))
    console.log('📋 验证最终结果')
    console.log('='.repeat(60))

    const finalColumns = await pool.request().query(existingColumnsQuery)
    console.log(`✅ 生产任务表现在有 ${finalColumns.recordset.length} 个字段:`)
    console.table(
      finalColumns.recordset.map((r, i) => ({
        序号: i + 1,
        字段名: r.COLUMN_NAME
      }))
    )

    console.log('\n' + '='.repeat(60))
    console.log('✅ 字段复制完成')
    console.log('='.repeat(60))
  } catch (err) {
    console.error('❌ 执行失败:', err)
    throw err
  } finally {
    if (pool) {
      await pool.close()
      console.log('\n数据库连接已关闭')
    }
  }
}

// 运行脚本
if (require.main === module) {
  console.log('⚠️  准备复制生产任务单的字段到生产任务表...')
  console.log('排除字段：任务ID, 任务单编号, 订单编号\n')

  copyFieldsToProductionTask()
    .then(() => {
      console.log('\n✅ 脚本执行完成')
      process.exit(0)
    })
    .catch((err) => {
      console.error('❌ 脚本执行失败:', err)
      process.exit(1)
    })
}

module.exports = { copyFieldsToProductionTask }
