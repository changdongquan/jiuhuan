const sql = require('mssql')
const config = require('./config')

/**
 * 分析生产任务表自动同步方案
 * （只读查询，不修改数据库）
 */
async function planProductionTaskSync() {
  let pool = null

  try {
    console.log('正在连接数据库...')
    pool = await sql.connect(config)
    console.log('✅ 数据库连接成功\n')

    // 1. 检查生产任务表是否存在
    console.log('='.repeat(60))
    console.log('📋 检查生产任务表状态')
    console.log('='.repeat(60))

    const tableExistsQuery = `
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME = '生产任务'
    `
    const tableResult = await pool.request().query(tableExistsQuery)

    if (tableResult.recordset.length > 0) {
      console.log('\n✅ 生产任务表已存在')

      // 检查现有结构
      const columnsQuery = `
        SELECT 
          COLUMN_NAME,
          DATA_TYPE,
          IS_NULLABLE,
          CHARACTER_MAXIMUM_LENGTH
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = '生产任务'
        ORDER BY ORDINAL_POSITION
      `
      const columnsResult = await pool.request().query(columnsQuery)
      console.log('\n现有字段结构:')
      console.table(columnsResult.recordset.slice(0, 10)) // 显示前10个

      // 检查是否已有外键
      const existingFKQuery = `
        SELECT 
          fk.name AS FK_Name,
          OBJECT_NAME(fk.parent_object_id) AS Parent_Table,
          COL_NAME(fc.parent_object_id, fc.parent_column_id) AS Parent_Column,
          OBJECT_NAME(fk.referenced_object_id) AS Referenced_Table,
          COL_NAME(fc.referenced_object_id, fc.referenced_column_id) AS Referenced_Column
        FROM sys.foreign_keys AS fk
        INNER JOIN sys.foreign_key_columns AS fc ON fk.object_id = fc.constraint_object_id
        WHERE OBJECT_NAME(fk.parent_object_id) = '生产任务'
          AND COL_NAME(fc.parent_object_id, fc.parent_column_id) = '项目编号'
      `
      const fkResult = await pool.request().query(existingFKQuery)

      if (fkResult.recordset.length > 0) {
        console.log('\n✅ 已存在外键约束:')
        console.table(fkResult.recordset)
      } else {
        console.log('\n⚠️  未找到外键约束（需要创建）')
      }
    } else {
      console.log('\n⚠️  生产任务表不存在（需要先创建）')
    }

    // 2. 检查货物信息表的唯一索引（外键必需）
    console.log('\n' + '='.repeat(60))
    console.log('📋 检查货物信息表的唯一索引')
    console.log('='.repeat(60))

    const uniqueIndexQuery = `
      SELECT 
        i.name AS IndexName,
        COL_NAME(ic.object_id, ic.column_id) AS ColumnName,
        i.is_unique AS IsUnique
      FROM sys.indexes i
      INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
      WHERE OBJECT_NAME(i.object_id) = '货物信息'
        AND COL_NAME(ic.object_id, ic.column_id) = '项目编号'
        AND i.is_unique = 1
    `
    const indexResult = await pool.request().query(uniqueIndexQuery)

    if (indexResult.recordset.length > 0) {
      console.log('\n✅ 已存在唯一索引:')
      console.table(indexResult.recordset)
    } else {
      console.log('\n⚠️  未找到唯一索引（创建外键前需要先创建）')
    }

    // 3. 分析方案
    console.log('\n' + '='.repeat(60))
    console.log('📊 实现方案分析')
    console.log('='.repeat(60))

    console.log(`
要实现的效果：
  货物信息新增项目编号 → 生产任务自动创建对应记录

需要做的工作：
  1. 数据库层面：创建外键约束
  2. 代码层面：在货物信息新增/更新时自动创建生产任务记录

实现方式（参考货物信息 → 项目管理的逻辑）：
  - 在 goods.js 的新增接口中添加逻辑
  - 在 goods.js 的更新接口中添加逻辑
  - 检查生产任务表是否存在该项目编号
  - 如果不存在，自动创建记录
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
  planProductionTaskSync()
    .then(() => {
      console.log('\n✅ 分析完成（数据库未被修改）')
      process.exit(0)
    })
    .catch((err) => {
      console.error('❌ 执行失败:', err)
      process.exit(1)
    })
}

module.exports = { planProductionTaskSync }
