const sql = require('mssql')
const config = require('./config')

/**
 * 检查生产任务单表的外键约束和字段结构
 * （只读查询，不修改数据库）
 */
async function checkProductionOrderForeignKeys() {
  let pool = null

  try {
    console.log('正在连接数据库...')
    pool = await sql.connect(config)
    console.log('✅ 数据库连接成功\n')

    // 1. 检查生产任务单表的现有外键约束
    console.log('='.repeat(60))
    console.log('📋 检查生产任务单表的外键约束')
    console.log('='.repeat(60))

    const fkQuery = `
      SELECT 
        fk.name AS FK_Name,
        OBJECT_NAME(fk.parent_object_id) AS Parent_Table,
        COL_NAME(fc.parent_object_id, fc.parent_column_id) AS Parent_Column,
        OBJECT_NAME(fk.referenced_object_id) AS Referenced_Table,
        COL_NAME(fc.referenced_object_id, fc.referenced_column_id) AS Referenced_Column,
        fk.delete_referential_action_desc AS Delete_Action,
        fk.update_referential_action_desc AS Update_Action,
        CASE WHEN fk.is_disabled = 1 THEN '已禁用' ELSE '已启用' END AS Status
      FROM sys.foreign_keys AS fk
      INNER JOIN sys.foreign_key_columns AS fc ON fk.object_id = fc.constraint_object_id
      WHERE OBJECT_NAME(fk.parent_object_id) = '生产任务单'
      ORDER BY fk.name
    `

    const fkResult = await pool.request().query(fkQuery)

    if (fkResult.recordset.length > 0) {
      console.log(`\n✅ 找到 ${fkResult.recordset.length} 个外键约束:`)
      console.table(
        fkResult.recordset.map((fk) => ({
          约束名称: fk.FK_Name,
          本表字段: fk.Parent_Column,
          引用表: fk.Referenced_Table,
          引用字段: fk.Referenced_Column,
          删除操作: fk.Delete_Action,
          更新操作: fk.Update_Action,
          状态: fk.Status
        }))
      )
    } else {
      console.log('\n⚠️  未找到外键约束')
    }

    // 2. 检查生产任务单表的字段结构
    console.log('\n' + '='.repeat(60))
    console.log('📋 检查生产任务单表的字段结构')
    console.log('='.repeat(60))

    const columnQuery = `
      SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        IS_NULLABLE,
        CHARACTER_MAXIMUM_LENGTH,
        NUMERIC_PRECISION,
        NUMERIC_SCALE,
        COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = '生产任务单'
      ORDER BY ORDINAL_POSITION
    `

    const columnResult = await pool.request().query(columnQuery)

    if (columnResult.recordset.length > 0) {
      console.log(`\n✅ 找到 ${columnResult.recordset.length} 个字段:`)
      console.table(
        columnResult.recordset.map((col) => ({
          字段名: col.COLUMN_NAME,
          数据类型: col.DATA_TYPE,
          允许NULL: col.IS_NULLABLE === 'YES' ? '是' : '否',
          '长度/精度': col.CHARACTER_MAXIMUM_LENGTH || col.NUMERIC_PRECISION || 'N/A',
          默认值: col.COLUMN_DEFAULT || '无'
        }))
      )

      // 查找可能关联其他表的字段
      console.log('\n📋 可能的外键字段分析:')
      const potentialFKFields = columnResult.recordset.filter(
        (col) =>
          col.COLUMN_NAME.includes('ID') ||
          col.COLUMN_NAME.includes('编号') ||
          col.COLUMN_NAME.includes('项目') ||
          col.COLUMN_NAME.includes('货物')
      )

      if (potentialFKFields.length > 0) {
        console.log('\n可能的外键候选字段:')
        console.table(
          potentialFKFields.map((col) => ({
            字段名: col.COLUMN_NAME,
            数据类型: col.DATA_TYPE,
            允许NULL: col.IS_NULLABLE === 'YES' ? '是' : '否'
          }))
        )
      }
    }

    // 3. 检查生产任务单是否有字段可以关联到货物信息表
    console.log('\n' + '='.repeat(60))
    console.log('📋 检查是否存在可关联货物信息的字段')
    console.log('='.repeat(60))

    // 检查是否有货物ID或类似的字段
    const goodsRelatedFields = columnResult.recordset.filter(
      (col) =>
        col.COLUMN_NAME.toLowerCase().includes('货物') ||
        col.COLUMN_NAME.toLowerCase().includes('goods') ||
        col.COLUMN_NAME === '货物ID' ||
        col.COLUMN_NAME === '产品编号'
    )

    if (goodsRelatedFields.length > 0) {
      console.log('\n✅ 找到可能关联货物信息的字段:')
      console.table(
        goodsRelatedFields.map((col) => ({
          字段名: col.COLUMN_NAME,
          数据类型: col.DATA_TYPE,
          允许NULL: col.IS_NULLABLE === 'YES' ? '是' : '否'
        }))
      )

      // 检查这些字段的数据是否真的存在于货物信息表中
      for (const field of goodsRelatedFields) {
        console.log(`\n检查字段 "${field.COLUMN_NAME}" 的数据完整性:`)

        // 检查是否有NULL值
        const nullCheckQuery = `
          SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN [${field.COLUMN_NAME}] IS NULL THEN 1 ELSE 0 END) as nullCount
          FROM 生产任务单
        `
        const nullResult = await pool.request().query(nullCheckQuery)
        console.log(`  总记录数: ${nullResult.recordset[0].total}`)
        console.log(`  NULL值数量: ${nullResult.recordset[0].nullCount}`)

        // 如果字段名可能是货物ID，检查是否可以匹配货物信息表
        if (field.COLUMN_NAME.includes('货物') || field.COLUMN_NAME === '货物ID') {
          const integrityQuery = `
            SELECT 
              COUNT(*) as orphanCount
            FROM 生产任务单 pt
            WHERE pt.[${field.COLUMN_NAME}] IS NOT NULL
              AND NOT EXISTS (
                SELECT 1 
                FROM 货物信息 g 
                WHERE g.货物ID = pt.[${field.COLUMN_NAME}]
              )
          `
          try {
            const integrityResult = await pool.request().query(integrityQuery)
            const orphanCount = integrityResult.recordset[0].orphanCount
            if (orphanCount > 0) {
              console.log(
                `  ⚠️  发现 ${orphanCount} 条记录的 ${field.COLUMN_NAME} 在货物信息表中不存在`
              )
            } else {
              console.log(`  ✅ 所有非NULL值都在货物信息表中存在（可以创建外键）`)
            }
          } catch (err) {
            console.log(`  ⚠️  无法检查数据完整性: ${err.message}`)
          }
        }
      }
    } else {
      console.log('\n⚠️  未找到明显关联货物信息的字段')
      console.log('   建议：如果生产任务单需要关联货物信息，可以添加"货物ID"字段')
    }

    // 4. 检查项目编号字段的数据完整性
    console.log('\n' + '='.repeat(60))
    console.log('📋 检查项目编号字段的数据完整性')
    console.log('='.repeat(60))

    // 分别查询统计信息
    const totalQuery = `SELECT COUNT(*) as total FROM 生产任务单`
    const totalResult = await pool.request().query(totalQuery)
    const total = totalResult.recordset[0].total

    const nullQuery = `SELECT COUNT(*) as nullCount FROM 生产任务单 WHERE 项目编号 IS NULL`
    const nullResult = await pool.request().query(nullQuery)
    const nullCount = nullResult.recordset[0].nullCount

    const orphanQuery = `
      SELECT COUNT(*) as orphanCount
      FROM 生产任务单 pt
      WHERE pt.项目编号 IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM 项目管理 p WHERE p.项目编号 = pt.项目编号
        )
    `
    const orphanResult = await pool.request().query(orphanQuery)
    const orphanCount = orphanResult.recordset[0].orphanCount

    console.log(`\n项目编号字段统计:`)
    console.log(`  总记录数: ${total}`)
    console.log(`  NULL值数量: ${nullCount}`)
    console.log(`  孤立记录数（在项目管理表中不存在）: ${orphanCount}`)

    if (orphanCount > 0) {
      console.log(`\n  ⚠️  警告：有 ${orphanCount} 条记录的项目编号在项目管理表中不存在`)
      console.log(`     这些记录无法通过外键约束（如果字段不允许NULL）`)
    } else {
      console.log(`\n  ✅ 所有非NULL的项目编号都在项目管理表中存在`)
    }

    // 5. 总结和建议
    console.log('\n' + '='.repeat(60))
    console.log('📊 总结和建议')
    console.log('='.repeat(60))

    console.log(`
当前状态：
1. 生产任务单表已经通过"项目编号"外键关联到项目管理表
2. 项目管理表通过"项目编号"被货物信息表引用

建议添加外键约束的场景：
1. 如果生产任务单有"货物ID"字段 → 可以添加外键关联到货物信息表
2. 如果生产任务单需要直接关联货物信息 → 可以添加"货物ID"字段并创建外键

外键约束的好处：
- 保证数据完整性
- 防止插入无效的引用数据
- 提供明确的数据关系文档

注意事项：
- 添加外键前需要确保数据完整性（所有引用值都存在）
- 如果字段允许NULL，外键只对非NULL值生效
- NO_ACTION策略意味着删除/更新父表数据时不会自动处理子表数据
    `)
  } catch (err) {
    console.error('❌ 查询失败:', err)
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
  checkProductionOrderForeignKeys()
    .then(() => {
      console.log('\n✅ 检查完成（数据库未被修改）')
      process.exit(0)
    })
    .catch((err) => {
      console.error('❌ 执行失败:', err)
      process.exit(1)
    })
}

module.exports = { checkProductionOrderForeignKeys }
