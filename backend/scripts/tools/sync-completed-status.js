const { query, closeDatabase } = require('../../database')

async function syncCompletedStatus() {
  try {
    console.log('开始同步：将项目管理表中"已经移模"的项目，在生产任务表中标记为"已完成"...')

    // 先查询有多少条记录需要更新
    const preview = await query(`
      SELECT COUNT(*) AS cnt
      FROM 生产任务 pt
      INNER JOIN 项目管理 pm ON pt.项目编号 = pm.项目编号
      WHERE pm.项目状态 = N'已经移模'
        AND (pt.生产状态 IS NULL OR pt.生产状态 <> N'已完成')
    `)
    console.log(`待更新记录数: ${preview[0]?.cnt || 0}`)

    // 执行更新
    await query(`
      UPDATE 生产任务
      SET 生产状态 = N'已完成'
      FROM 生产任务 pt
      INNER JOIN 项目管理 pm ON pt.项目编号 = pm.项目编号
      WHERE pm.项目状态 = N'已经移模'
        AND (pt.生产状态 IS NULL OR pt.生产状态 <> N'已完成')
    `)

    // 确认更新结果
    const confirm = await query(`
      SELECT COUNT(*) AS completed
      FROM 生产任务 pt
      INNER JOIN 项目管理 pm ON pt.项目编号 = pm.项目编号
      WHERE pm.项目状态 = N'已经移模'
        AND pt.生产状态 = N'已完成'
    `)

    console.log(`更新完成，当前已标记为"已完成"的数量: ${confirm[0]?.completed || 0}`)
  } catch (err) {
    console.error('同步失败:', err)
    process.exitCode = 1
  } finally {
    await closeDatabase().catch(() => {})
  }
}

if (require.main === module) {
  syncCompletedStatus()
}

module.exports = { syncCompletedStatus }
