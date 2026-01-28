const sql = require('mssql')
const config = require('../../config')
const fs = require('fs')
const path = require('path')

// 执行迁移脚本
const runMigration = async () => {
  let pool = null

  try {
    console.log('正在连接数据库...')
    pool = await sql.connect(config)
    console.log('✅ 数据库连接成功')

    // 读取SQL脚本
    const sqlFilePath = path.join(__dirname, '../../migrations', 'add_part_image_url.sql')
    if (!fs.existsSync(sqlFilePath)) {
      console.error('❌ SQL脚本文件不存在:', sqlFilePath)
      process.exit(1)
    }

    let sqlScript = fs.readFileSync(sqlFilePath, 'utf8')
    // 移除 GO 命令（GO 是 SSMS 的批处理分隔符，不是 SQL 语句）
    sqlScript = sqlScript.replace(/^\s*GO\s*$/gim, '').trim()
    console.log('正在执行迁移脚本...')

    // 执行SQL脚本
    const result = await pool.request().query(sqlScript)

    console.log('✅ 迁移脚本执行成功')

    // 验证字段是否添加成功
    console.log('验证字段是否添加成功...')
    const checkResult = await pool.request().query(`
      SELECT COUNT(*) as column_count 
      FROM sys.columns 
      WHERE object_id = OBJECT_ID(N'dbo.项目管理') 
        AND name = N'零件图示URL'
    `)

    if (checkResult.recordset[0].column_count > 0) {
      console.log('✅ 字段 零件图示URL 已成功添加到 项目管理 表')
    } else {
      console.warn('⚠️  警告：字段 零件图示URL 未找到，可能添加失败')
    }
  } catch (error) {
    console.error('❌ 迁移脚本执行失败:', error.message)
    console.error('错误详情:', error)
    process.exit(1)
  } finally {
    if (pool) {
      await pool.close()
      console.log('数据库连接已关闭')
    }
  }
}

// 运行迁移
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('✅ 迁移完成')
      process.exit(0)
    })
    .catch((err) => {
      console.error('❌ 迁移失败:', err)
      process.exit(1)
    })
}

module.exports = { runMigration }
