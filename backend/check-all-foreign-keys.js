const sql = require('mssql')
const config = require('./config')

/**
 * 全面检查数据库外键约束（只读查询，不修改数据库）
 *
 * 检查以下表的外键关系：
 * - 货物信息
 * - 项目管理
 * - 客户信息
 * - 销售订单
 */
async function checkAllForeignKeys() {
  let pool = null

  try {
    console.log('正在连接数据库...')
    pool = await sql.connect(config)
    console.log('✅ 数据库连接成功\n')

    // 查询所有相关表的外键约束
    const tablesToCheck = ['货物信息', '项目管理', '客户信息', '销售订单']

    for (const tableName of tablesToCheck) {
      console.log('\n' + '='.repeat(60))
      console.log(`📋 检查表: ${tableName}`)
      console.log('='.repeat(60))

      // 1. 查询该表作为父表的外键约束（该表引用其他表）
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
        WHERE OBJECT_NAME(fk.parent_object_id) = @tableName
        ORDER BY fk.name
      `

      const fkResult = await pool
        .request()
        .input('tableName', sql.NVarChar, tableName)
        .query(fkQuery)

      if (fkResult.recordset.length > 0) {
        console.log(`\n✅ 找到 ${fkResult.recordset.length} 个外键约束（${tableName} 引用其他表）:`)
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

        // 详细信息
        for (const fk of fkResult.recordset) {
          console.log(`\n  约束详情: ${fk.FK_Name}`)
          console.log(
            `  - ${tableName}.${fk.Parent_Column} → ${fk.Referenced_Table}.${fk.Referenced_Column}`
          )
          console.log(`  - 删除时: ${fk.Delete_Action}`)
          console.log(`  - 更新时: ${fk.Update_Action}`)
          console.log(`  - 状态: ${fk.Status}`)
        }
      } else {
        console.log(`\n⚠️  未找到外键约束（${tableName} 没有引用其他表的外键）`)
      }

      // 2. 查询该表作为被引用表的外键约束（其他表引用该表）
      const referencedByQuery = `
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
        WHERE OBJECT_NAME(fk.referenced_object_id) = @tableName
        ORDER BY fk.name
      `

      const referencedByResult = await pool
        .request()
        .input('tableName', sql.NVarChar, tableName)
        .query(referencedByQuery)

      if (referencedByResult.recordset.length > 0) {
        console.log(
          `\n✅ 找到 ${referencedByResult.recordset.length} 个外键约束（其他表引用 ${tableName}）:`
        )
        console.table(
          referencedByResult.recordset.map((fk) => ({
            约束名称: fk.FK_Name,
            引用表: fk.Parent_Table,
            引用字段: fk.Parent_Column,
            被引用字段: fk.Referenced_Column,
            删除操作: fk.Delete_Action,
            更新操作: fk.Update_Action,
            状态: fk.Status
          }))
        )
      } else {
        console.log(`\n⚠️  没有其他表引用 ${tableName}`)
      }
    }

    // 3. 特别检查：货物信息 ↔ 项目管理 的关系
    console.log('\n' + '='.repeat(60))
    console.log('📋 特别检查：货物信息 ↔ 项目管理 关系')
    console.log('='.repeat(60))

    const goodsProjectQuery = `
      SELECT 
        fk.name AS FK_Name,
        OBJECT_NAME(fk.parent_object_id) AS Parent_Table,
        COL_NAME(fc.parent_object_id, fc.parent_column_id) AS Parent_Column,
        OBJECT_NAME(fk.referenced_object_id) AS Referenced_Table,
        COL_NAME(fc.referenced_object_id, fc.referenced_column_id) AS Referenced_Column,
        CASE WHEN fk.is_disabled = 1 THEN '已禁用' ELSE '已启用' END AS Status
      FROM sys.foreign_keys AS fk
      INNER JOIN sys.foreign_key_columns AS fc ON fk.object_id = fc.constraint_object_id
      WHERE (OBJECT_NAME(fk.parent_object_id) = '货物信息' AND OBJECT_NAME(fk.referenced_object_id) = '项目管理')
         OR (OBJECT_NAME(fk.parent_object_id) = '项目管理' AND OBJECT_NAME(fk.referenced_object_id) = '货物信息')
    `

    const goodsProjectResult = await pool.request().query(goodsProjectQuery)

    if (goodsProjectResult.recordset.length > 0) {
      console.log('\n✅ 货物信息和项目管理之间存在外键约束:')
      console.table(
        goodsProjectResult.recordset.map((fk) => ({
          约束名称: fk.FK_Name,
          父表: fk.Parent_Table,
          父字段: fk.Parent_Column,
          引用表: fk.Referenced_Table,
          引用字段: fk.Referenced_Column,
          状态: fk.Status
        }))
      )
    } else {
      console.log('\n⚠️  货物信息和项目管理之间没有外键约束')
    }

    // 4. 检查字段属性（是否允许NULL）
    console.log('\n' + '='.repeat(60))
    console.log('📋 检查关键字段属性（是否允许NULL）')
    console.log('='.repeat(60))

    const columnCheckQuery = `
      SELECT 
        TABLE_NAME,
        COLUMN_NAME,
        DATA_TYPE,
        IS_NULLABLE,
        CHARACTER_MAXIMUM_LENGTH
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE (TABLE_NAME = '货物信息' AND COLUMN_NAME = '项目编号')
         OR (TABLE_NAME = '项目管理' AND COLUMN_NAME = '项目编号')
         OR (TABLE_NAME = '项目管理' AND COLUMN_NAME = '客户ID')
         OR (TABLE_NAME = '销售订单' AND COLUMN_NAME LIKE '%项目编号%')
         OR (TABLE_NAME = '销售订单' AND COLUMN_NAME LIKE '%客户ID%')
      ORDER BY TABLE_NAME, COLUMN_NAME
    `

    const columnResult = await pool.request().query(columnCheckQuery)

    if (columnResult.recordset.length > 0) {
      console.log('\n关键字段属性:')
      console.table(
        columnResult.recordset.map((col) => ({
          表名: col.TABLE_NAME,
          字段名: col.COLUMN_NAME,
          数据类型: col.DATA_TYPE,
          允许NULL: col.IS_NULLABLE === 'YES' ? '是' : '否',
          最大长度: col.CHARACTER_MAXIMUM_LENGTH || 'N/A'
        }))
      )
    }

    // 5. 总结报告
    console.log('\n' + '='.repeat(60))
    console.log('📊 外键约束检查总结')
    console.log('='.repeat(60))

    const allFKQuery = `
      SELECT 
        OBJECT_NAME(fk.parent_object_id) AS Parent_Table,
        OBJECT_NAME(fk.referenced_object_id) AS Referenced_Table,
        fk.name AS FK_Name,
        CASE WHEN fk.is_disabled = 1 THEN '已禁用' ELSE '已启用' END AS Status
      FROM sys.foreign_keys AS fk
      WHERE OBJECT_NAME(fk.parent_object_id) IN ('货物信息', '项目管理', '客户信息', '销售订单')
         OR OBJECT_NAME(fk.referenced_object_id) IN ('货物信息', '项目管理', '客户信息', '销售订单')
      ORDER BY Parent_Table, Referenced_Table
    `

    const allFKResult = await pool.request().query(allFKQuery)

    if (allFKResult.recordset.length > 0) {
      console.log('\n所有相关外键约束:')
      console.table(
        allFKResult.recordset.map((fk) => ({
          父表: fk.Parent_Table,
          引用表: fk.Referenced_Table,
          约束名称: fk.FK_Name,
          状态: fk.Status
        }))
      )
    } else {
      console.log('\n⚠️  未找到任何相关的外键约束')
      console.log('   这可能意味着：')
      console.log('   1. 外键约束已被删除')
      console.log('   2. 表之间通过代码逻辑维护关系，而非数据库外键约束')
    }

    console.log('\n' + '='.repeat(60))
    console.log('✅ 检查完成（数据库未被修改）')
    console.log('='.repeat(60))
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
  checkAllForeignKeys()
    .then(() => {
      console.log('\n✅ 检查完成')
      process.exit(0)
    })
    .catch((err) => {
      console.error('❌ 执行失败:', err)
      process.exit(1)
    })
}

module.exports = { checkAllForeignKeys }
