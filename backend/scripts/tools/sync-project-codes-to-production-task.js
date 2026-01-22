const sql = require('mssql')
const config = require('../../config')

/**
 * 将项目管理表中的项目编号同步到生产任务表
 */
async function syncProjectCodesToProductionTask() {
  let pool = null

  try {
    console.log('正在连接数据库...')
    pool = await sql.connect(config)
    console.log('✅ 数据库连接成功\n')

    // 1. 获取项目管理表中的所有项目编号（且必须在货物信息表中存在，因为外键约束）
    console.log('='.repeat(60))
    console.log('📋 获取项目管理表中的项目编号（且必须在货物信息表中存在）')
    console.log('='.repeat(60))

    const projectCodesQuery = `
      SELECT DISTINCT p.项目编号
      FROM 项目管理 p
      INNER JOIN 货物信息 g ON p.项目编号 = g.项目编号
      WHERE p.项目编号 IS NOT NULL AND p.项目编号 != ''
        AND CAST(g.IsNew AS INT) != 1
      ORDER BY p.项目编号
    `

    const projectCodesResult = await pool.request().query(projectCodesQuery)
    const projectCodes = projectCodesResult.recordset.map((r) => r.项目编号)

    console.log(`✅ 找到 ${projectCodes.length} 个项目编号（在货物信息表中存在）`)

    if (projectCodes.length === 0) {
      console.log('⚠️  项目管理表中没有项目编号，无需同步')
      return
    }

    // 2. 检查生产任务表中已存在的项目编号
    console.log('\n' + '='.repeat(60))
    console.log('📋 检查生产任务表中已存在的项目编号')
    console.log('='.repeat(60))

    const existingCodesQuery = `
      SELECT 项目编号
      FROM 生产任务
      WHERE 项目编号 IS NOT NULL AND 项目编号 != ''
    `

    const existingCodesResult = await pool.request().query(existingCodesQuery)
    const existingCodes = new Set(existingCodesResult.recordset.map((r) => r.项目编号))

    console.log(`✅ 生产任务表中已有 ${existingCodes.size} 个项目编号`)

    // 3. 找出需要添加的项目编号
    const codesToAdd = projectCodes.filter((code) => !existingCodes.has(code))

    console.log('\n' + '='.repeat(60))
    console.log('📋 需要同步的项目编号')
    console.log('='.repeat(60))
    console.log(`   总计: ${projectCodes.length} 个`)
    console.log(`   已存在: ${existingCodes.size} 个`)
    console.log(`   需要添加: ${codesToAdd.length} 个`)

    if (codesToAdd.length === 0) {
      console.log('\n✅ 所有项目编号都已存在于生产任务表中，无需同步')
      return
    }

    // 显示前10个需要添加的项目编号
    if (codesToAdd.length > 0) {
      console.log('\n前10个需要添加的项目编号:')
      codesToAdd.slice(0, 10).forEach((code, i) => {
        console.log(`   ${i + 1}. ${code}`)
      })
      if (codesToAdd.length > 10) {
        console.log(`   ... 还有 ${codesToAdd.length - 10} 个`)
      }
    }

    // 4. 批量插入项目编号到生产任务表
    console.log('\n' + '='.repeat(60))
    console.log('📝 开始同步项目编号到生产任务表')
    console.log('='.repeat(60))

    let successCount = 0
    let failCount = 0
    const failedCodes = []

    for (const projectCode of codesToAdd) {
      try {
        const insertRequest = pool.request()
        insertRequest.input('projectCode', sql.NVarChar, projectCode)

        await insertRequest.query(`
          INSERT INTO 生产任务 (项目编号)
          VALUES (@projectCode)
        `)
        successCount++

        if (successCount % 100 === 0) {
          console.log(`   已同步 ${successCount}/${codesToAdd.length} 个...`)
        }
      } catch (err) {
        failCount++
        failedCodes.push({ code: projectCode, error: err.message })
        console.error(`   ❌ 同步失败: ${projectCode} - ${err.message}`)
      }
    }

    // 5. 验证结果
    console.log('\n' + '='.repeat(60))
    console.log('📋 同步结果')
    console.log('='.repeat(60))
    console.log(`   成功: ${successCount} 个`)
    console.log(`   失败: ${failCount} 个`)

    if (failedCodes.length > 0) {
      console.log('\n失败的项目编号:')
      failedCodes.forEach((item) => {
        console.log(`   - ${item.code}: ${item.error}`)
      })
    }

    // 6. 最终统计
    const finalCountQuery = `
      SELECT COUNT(*) as count
      FROM 生产任务
      WHERE 项目编号 IS NOT NULL AND 项目编号 != ''
    `
    const finalCountResult = await pool.request().query(finalCountQuery)
    const finalCount = finalCountResult.recordset[0].count

    console.log('\n' + '='.repeat(60))
    console.log('📊 最终统计')
    console.log('='.repeat(60))
    console.log(`   项目管理表项目编号数: ${projectCodes.length}`)
    console.log(`   生产任务表项目编号数: ${finalCount}`)

    if (finalCount === projectCodes.length) {
      console.log('\n✅ 同步完成！所有项目编号都已同步到生产任务表')
    } else {
      console.log(
        `\n⚠️  同步完成，但数量不匹配（相差 ${Math.abs(finalCount - projectCodes.length)} 个）`
      )
    }
  } catch (err) {
    console.error('❌ 同步失败:', err)
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
  console.log('⚠️  准备同步项目管理表的项目编号到生产任务表...')
  console.log('按 Ctrl+C 取消，或等待3秒后继续...\n')

  setTimeout(async () => {
    syncProjectCodesToProductionTask()
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

module.exports = { syncProjectCodesToProductionTask }
