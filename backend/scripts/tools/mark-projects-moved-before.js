const { query, closeDatabase } = require('../../database')

// 将 项目编号 形如 JH01-XX 且 XX < 25 的记录标记为 已经移模
async function markProjectsMovedBefore25() {
  try {
    console.log("开始批量更新：将项目编号以 'JH01-' 开头且数字部分 < 25 的项目标记为‘已经移模’...")

    const preview = await query(
      `SELECT COUNT(*) AS cnt
       FROM 项目管理
       WHERE 项目编号 LIKE N'JH01-%'
         AND TRY_CONVERT(INT, SUBSTRING(项目编号, CHARINDEX('-', 项目编号) + 1, 32)) < 25`
    )
    console.log(`待更新记录数: ${preview[0]?.cnt || 0}`)

    await query(
      `UPDATE 项目管理
       SET 项目状态 = N'已经移模'
       WHERE 项目编号 LIKE N'JH01-%'
         AND TRY_CONVERT(INT, SUBSTRING(项目编号, CHARINDEX('-', 项目编号) + 1, 32)) < 25`
    )

    const confirm = await query(
      `SELECT COUNT(*) AS moved
       FROM 项目管理
       WHERE 项目编号 LIKE N'JH01-%'
         AND TRY_CONVERT(INT, SUBSTRING(项目编号, CHARINDEX('-', 项目编号) + 1, 32)) < 25
         AND 项目状态 = N'已经移模'`
    )

    console.log(`更新完成，当前已标记为“已经移模”的数量: ${confirm[0]?.moved || 0}`)
  } catch (err) {
    console.error('批量更新失败:', err)
    process.exitCode = 1
  } finally {
    await closeDatabase().catch(() => {})
  }
}

if (require.main === module) {
  markProjectsMovedBefore25()
}

module.exports = { markProjectsMovedBefore25 }
