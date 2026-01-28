const { query, closeDatabase } = require('../../database')

async function markProjectsMoved() {
  try {
    console.log('开始批量更新：将项目编号以 JH01-14 到 JH01-24 开头的项目标记为"已经移模"...')

    // 生成所有前缀
    const prefixes = []
    for (let i = 14; i <= 24; i++) {
      prefixes.push(`JH01-${i}%`)
    }

    console.log(`要更新的前缀: ${prefixes.join(', ')}`)

    // 构建查询条件
    const likeConditions = prefixes.map((_, index) => `项目编号 LIKE @prefix${index}`).join(' OR ')
    const params = {}
    prefixes.forEach((prefix, index) => {
      params[`prefix${index}`] = prefix
    })

    // 查询待更新数量
    const preview = await query(
      `SELECT COUNT(*) AS cnt FROM 项目管理 WHERE ${likeConditions}`,
      params
    )
    console.log(`待更新记录数: ${preview[0]?.cnt || 0}`)

    // 执行更新
    await query(`UPDATE 项目管理 SET 项目状态 = N'已经移模' WHERE ${likeConditions}`, params)

    // 确认更新结果
    const confirm = await query(
      `SELECT COUNT(*) AS moved FROM 项目管理 WHERE ${likeConditions} AND 项目状态 = N'已经移模'`,
      params
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
