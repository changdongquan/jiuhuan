const { query, closeDatabase } = require('../../database')

async function markSpecificRange() {
  try {
    const codes = Array.from({ length: 12 }, (_, i) => `JH01-${13 + i}`)
    console.log('准备更新以下项目编号为“已经移模”:', codes.join(', '))

    const preview = await query(
      `SELECT COUNT(*) AS cnt FROM 项目管理 WHERE 项目编号 IN (${codes.map((_, i) => `@c${i}`).join(', ')})`,
      Object.fromEntries(codes.map((c, i) => [`c${i}`, c]))
    )
    console.log(`命中记录数: ${preview[0]?.cnt || 0}`)

    await query(
      `UPDATE 项目管理 SET 项目状态 = N'已经移模' WHERE 项目编号 IN (${codes.map((_, i) => `@u${i}`).join(', ')})`,
      Object.fromEntries(codes.map((c, i) => [`u${i}`, c]))
    )

    const confirm = await query(
      `SELECT COUNT(*) AS moved FROM 项目管理 WHERE 项目编号 IN (${codes.map((_, i) => `@v${i}`).join(', ')}) AND 项目状态 = N'已经移模'`,
      Object.fromEntries(codes.map((c, i) => [`v${i}`, c]))
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
  markSpecificRange()
}

module.exports = { markSpecificRange }
