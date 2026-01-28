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
    const sqlFilePath = path.join(
      __dirname,
      '../../migrations',
      '20260104_update_project_management_zero_to_null.sql'
    )
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

    // 验证更新结果：统计被更新的记录数
    console.log('验证更新结果...')
    const checkResult = await pool.request().query(`
      SELECT 
        COUNT(*) as total_count,
        SUM(CASE WHEN 料柄重量 IS NULL THEN 1 ELSE 0 END) as 料柄重量_null_count,
        SUM(CASE WHEN 流道数量 IS NULL THEN 1 ELSE 0 END) as 流道数量_null_count,
        SUM(CASE WHEN 浇口数量 IS NULL THEN 1 ELSE 0 END) as 浇口数量_null_count,
        SUM(CASE WHEN 机台吨位 IS NULL THEN 1 ELSE 0 END) as 机台吨位_null_count,
        SUM(CASE WHEN 锁模力 IS NULL THEN 1 ELSE 0 END) as 锁模力_null_count,
        SUM(CASE WHEN 定位圈 IS NULL THEN 1 ELSE 0 END) as 定位圈_null_count,
        SUM(CASE WHEN 拉杆间距 IS NULL THEN 1 ELSE 0 END) as 拉杆间距_null_count,
        SUM(CASE WHEN 成型周期 IS NULL THEN 1 ELSE 0 END) as 成型周期_null_count
      FROM 项目管理
    `)

    const stats = checkResult.recordset[0]
    console.log(`📊 更新结果统计（总计 ${stats.total_count} 条记录）:`)
    console.log(`   - 料柄重量为NULL: ${stats.料柄重量_null_count}`)
    console.log(`   - 流道数量为NULL: ${stats.流道数量_null_count}`)
    console.log(`   - 浇口数量为NULL: ${stats.浇口数量_null_count}`)
    console.log(`   - 机台吨位为NULL: ${stats.机台吨位_null_count}`)
    console.log(`   - 锁模力为NULL: ${stats.锁模力_null_count}`)
    console.log(`   - 定位圈为NULL: ${stats.定位圈_null_count}`)
    console.log(`   - 拉杆间距为NULL: ${stats.拉杆间距_null_count}`)
    console.log(`   - 成型周期为NULL: ${stats.成型周期_null_count}`)
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
