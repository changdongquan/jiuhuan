const sql = require('mssql')
const config = require('./config')

/**
 * 为生产任务表添加"抛光工时"字段
 */
async function addPolishHoursField() {
  let pool = null

  try {
    console.log('正在连接数据库...')
    pool = await sql.connect(config)
    console.log('✅ 数据库连接成功\n')

    console.log('='.repeat(60))
    console.log('检查字段是否已存在...')
    console.log('='.repeat(60))

    // 检查字段是否已存在
    const checkFieldQuery = `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = '生产任务'
        AND COLUMN_NAME = '抛光工时'
    `
    const fieldCheck = await pool.request().query(checkFieldQuery)

    if (fieldCheck.recordset.length > 0) {
      console.log('⚠️  字段"抛光工时"已存在，跳过添加')
      return
    }

    console.log('✅ 字段不存在，准备添加...')

    console.log('\n' + '='.repeat(60))
    console.log('添加"抛光工时"字段到生产任务表...')
    console.log('='.repeat(60))

    // 添加字段：使用FLOAT类型，允许NULL，与其它工时字段保持一致
    const addFieldQuery = `
      ALTER TABLE 生产任务
      ADD 抛光工时 FLOAT NULL
    `

    await pool.request().query(addFieldQuery)
    console.log('✅ 字段"抛光工时"添加成功')

    console.log('\n' + '='.repeat(60))
    console.log('验证添加结果...')
    console.log('='.repeat(60))

    // 验证字段是否添加成功
    const verifyQuery = `
      SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = '生产任务'
        AND COLUMN_NAME = '抛光工时'
    `
    const verifyResult = await pool.request().query(verifyQuery)

    if (verifyResult.recordset.length > 0) {
      console.log('✅ 字段验证成功:')
      console.table(verifyResult.recordset)
    } else {
      console.log('⚠️  字段验证失败：未找到添加的字段')
    }

    console.log('\n' + '='.repeat(60))
    console.log('✅ 数据库操作完成！')
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
  console.log('⚠️  准备为生产任务表添加"抛光工时"字段...')
  console.log('按 Ctrl+C 取消，或等待3秒后继续...\n')

  setTimeout(async () => {
    addPolishHoursField()
      .then(() => {
        console.log('\n✅ 脚本执行完成')
        process.exit(0)
      })
      .catch((err) => {
        console.error('❌ 脚本执行失败:', err)
        process.exit(1)
      })
  }, 3000)
}

module.exports = { addPolishHoursField }
