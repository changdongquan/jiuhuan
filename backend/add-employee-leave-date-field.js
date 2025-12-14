const sql = require('mssql')
const config = require('./config')

/**
 * 为【员工信息】表新增“离职日期”字段
 */
async function addEmployeeLeaveDateField() {
  let pool = null

  try {
    console.log('正在连接数据库...')
    pool = await sql.connect(config)
    console.log('✅ 数据库连接成功\n')

    console.log('='.repeat(60))
    console.log('检查字段是否已存在...')
    console.log('='.repeat(60))

    const checkFieldQuery = `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = '员工信息'
        AND COLUMN_NAME = '离职日期'
    `
    const fieldCheck = await pool.request().query(checkFieldQuery)

    if (fieldCheck.recordset.length > 0) {
      console.log('⚠️ 字段“离职日期”已存在，跳过添加')
      return
    }

    console.log('✅ 字段不存在，准备添加...')

    console.log('\n' + '='.repeat(60))
    console.log('添加“离职日期”字段到员工信息表...')
    console.log('='.repeat(60))

    const addFieldQuery = `
      ALTER TABLE 员工信息
      ADD 离职日期 DATE NULL
    `

    await pool.request().query(addFieldQuery)
    console.log('✅ 字段“离职日期”添加成功')

    console.log('\n' + '='.repeat(60))
    console.log('验证添加结果...')
    console.log('='.repeat(60))

    const verifyQuery = `
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = '员工信息'
        AND COLUMN_NAME = '离职日期'
    `
    const verifyResult = await pool.request().query(verifyQuery)

    if (verifyResult.recordset.length > 0) {
      console.log('✅ 字段验证成功:')
      console.table(verifyResult.recordset)
    } else {
      console.log('⚠️ 字段验证失败：未找到添加的字段')
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

// 直接运行脚本
if (require.main === module) {
  console.log('⚠️ 准备为员工信息表添加“离职日期”字段...')
  console.log('按 Ctrl+C 取消，或等待3 秒后继续...\n')

  setTimeout(async () => {
    addEmployeeLeaveDateField()
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

module.exports = { addEmployeeLeaveDateField }
