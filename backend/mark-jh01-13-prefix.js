const { query, closeDatabase } = require('./database')

async function markProjectsMoved() {
  try {
    console.log('开始批量更新：将项目编号以 JH01-13 开头的项目标记为"已经移模"...')

    const preview = await query(
      `SELECT COUNT(*) AS cnt FROM 项目管理 WHERE 项目编号 LIKE @prefix`,
      { prefix: 'JH01-13%' }
    )
    console.log(`待更新记录数: ${preview[0]?.cnt || 0}`)

    const result = await query(
      `UPDATE 项目管理 SET 项目状态 = N'已经移模' WHERE 项目编号 LIKE @prefix`,
      { prefix: 'JH01-13%' }
    )

    // 由于 query 返回的是 recordset，更新行数无法直接读取，这里再次查询确认
    const confirm = await query(
      `SELECT COUNT(*) AS moved FROM 项目管理 WHERE 项目编号 LIKE @prefix AND 项目状态 = N'已经移模'`,
      { prefix: 'JH01-13%' }
    )

    console.log(`更新完成，当前已标记为"已经移模"的数量: ${confirm[0]?.moved || 0}`)
  } catch (err) {
    console.error('批量更新失败:', err)
    process.exitCode = 1
  } finally {
    await closeDatabase().catch(() => {})
  }
}

if (require.main === module) {
  markProjectsMoved()
}

module.exports = { markProjectsMoved }
