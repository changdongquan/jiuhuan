const sql = require('mssql')
const config = require('../../config')
const fs = require('fs')
const path = require('path')

// 读取SQL脚本文件
const readSQLFile = (filePath) => {
  try {
    return fs.readFileSync(filePath, 'utf8')
  } catch (err) {
    console.error('读取SQL文件失败:', err)
    throw err
  }
}

// 执行SQL脚本
const executeSQLScript = async () => {
  let pool = null

  try {
    console.log('正在连接数据库...')
    pool = await sql.connect(config)
    console.log('数据库连接成功')

    // 读取SQL脚本
    const sqlFilePath = path.join(__dirname, '../../../sql/supplier_info_table.sql')
    const sqlScript = readSQLFile(sqlFilePath)

    console.log('正在执行SQL脚本...')

    // 分割SQL语句（按分号分割）
    const statements = sqlScript
      .split(';')
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0 && !stmt.startsWith('--'))

    // 逐个执行SQL语句
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      if (statement.trim()) {
        try {
          console.log(`执行第 ${i + 1} 条SQL语句...`)
          await pool.request().query(statement)
          console.log(`第 ${i + 1} 条SQL语句执行成功`)
        } catch (err) {
          console.error(`第 ${i + 1} 条SQL语句执行失败:`, err.message)
          // 继续执行下一条语句
        }
      }
    }

    console.log('SQL脚本执行完成！')

    // 验证表是否创建成功
    console.log('验证表是否创建成功...')
    const result = await pool.request().query(`
      SELECT COUNT(*) as table_count 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME = 'supplier_info'
    `)

    if (result.recordset[0].table_count > 0) {
      console.log('✅ 供方信息表创建成功！')

      // 查询表结构
      const tableInfo = await pool.request().query(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'supplier_info'
        ORDER BY ORDINAL_POSITION
      `)

      console.log('\n📋 表结构信息:')
      console.table(tableInfo.recordset)

      // 查询示例数据
      const sampleData = await pool.request().query(`
        SELECT supplier_code, supplier_name, level, category, status, contact, phone
        FROM supplier_info
      `)

      console.log('\n📊 示例数据:')
      console.table(sampleData.recordset)
    } else {
      console.log('❌ 供方信息表创建失败')
    }
  } catch (err) {
    console.error('执行SQL脚本失败:', err)
  } finally {
    if (pool) {
      await pool.close()
      console.log('数据库连接已关闭')
    }
  }
}

// 运行脚本
if (require.main === module) {
  executeSQLScript()
    .then(() => {
      console.log('脚本执行完成')
      process.exit(0)
    })
    .catch((err) => {
      console.error('脚本执行失败:', err)
      process.exit(1)
    })
}

module.exports = { executeSQLScript }
