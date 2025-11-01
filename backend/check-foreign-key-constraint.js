const sql = require('mssql')
const config = require('./config')

async function checkForeignKeyConstraint() {
  let pool = null

  try {
    console.log('正在连接数据库...')
    pool = await sql.connect(config)
    console.log('✅ 数据库连接成功\n')

    // 1. 查询外键约束信息
    console.log('📋 查询外键约束信息...')
    const fkQuery = `
      SELECT 
        fk.name AS FK_Name,
        OBJECT_NAME(fk.parent_object_id) AS Parent_Table,
        COL_NAME(fc.parent_object_id, fc.parent_column_id) AS Parent_Column,
        OBJECT_NAME(fk.referenced_object_id) AS Referenced_Table,
        COL_NAME(fc.referenced_object_id, fc.referenced_column_id) AS Referenced_Column,
        fk.delete_referential_action_desc AS Delete_Action,
        fk.update_referential_action_desc AS Update_Action,
        fk.is_disabled AS Is_Disabled
      FROM sys.foreign_keys AS fk
      INNER JOIN sys.foreign_key_columns AS fc ON fk.object_id = fc.constraint_object_id
      WHERE OBJECT_NAME(fk.parent_object_id) = '货物信息'
        AND COL_NAME(fc.parent_object_id, fc.parent_column_id) = '项目编号'
    `

    const fkResult = await pool.request().query(fkQuery)

    if (fkResult.recordset.length > 0) {
      console.log('✅ 找到外键约束:')
      console.table(fkResult.recordset)
      console.log('\n外键约束名称:', fkResult.recordset[0].FK_Name)
      console.log('父表:', fkResult.recordset[0].Parent_Table)
      console.log('父列:', fkResult.recordset[0].Parent_Column)
      console.log('引用表:', fkResult.recordset[0].Referenced_Table)
      console.log('引用列:', fkResult.recordset[0].Referenced_Column)
    } else {
      console.log('⚠️  未找到相关外键约束')
    }

    // 2. 查询 货物信息 表的 项目编号 字段属性
    console.log('\n📋 查询货物信息表的项目编号字段属性...')
    const columnQuery = `
      SELECT 
        COLUMN_NAME as ColumnName,
        DATA_TYPE as DataType,
        IS_NULLABLE as IsNullable,
        CHARACTER_MAXIMUM_LENGTH as MaxLength
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = '货物信息'
        AND COLUMN_NAME = '项目编号'
    `

    const columnResult = await pool.request().query(columnQuery)

    if (columnResult.recordset.length > 0) {
      console.log('✅ 字段属性:')
      console.table(columnResult.recordset)
      const isNullable = columnResult.recordset[0].IsNullable
      console.log('\n当前 项目编号 字段是否允许 NULL:', isNullable)
    }

    // 3. 查询 项目管理 表的 项目编号 字段属性
    console.log('\n📋 查询项目管理表的项目编号字段属性...')
    const projectColumnQuery = `
      SELECT 
        COLUMN_NAME as ColumnName,
        DATA_TYPE as DataType,
        IS_NULLABLE as IsNullable,
        CHARACTER_MAXIMUM_LENGTH as MaxLength
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = '项目管理'
        AND COLUMN_NAME = '项目编号'
    `

    const projectColumnResult = await pool.request().query(projectColumnQuery)

    if (projectColumnResult.recordset.length > 0) {
      console.log('✅ 项目管理表字段属性:')
      console.table(projectColumnResult.recordset)
    }

    console.log('\n' + '='.repeat(60))
    console.log('📝 建议的修改方案:')
    console.log('='.repeat(60))

    if (fkResult.recordset.length > 0) {
      const fkName = fkResult.recordset[0].FK_Name
      const isNullable = columnResult.recordset[0].IsNullable

      if (isNullable === 'NO') {
        console.log(`
方案B实现步骤：
1. 删除现有外键约束: ${fkName}
2. 修改 货物信息.项目编号 字段，允许为 NULL
3. 重新创建外键约束（可选，如果允许 NULL，则不需要强制外键）

或者更简单的方案：
1. 删除外键约束，让两个表完全独立
        `)
      } else {
        console.log(`
好消息！货物信息.项目编号 字段已经允许 NULL。
但外键约束仍然存在，这意味着非 NULL 值仍然必须存在于项目管理表中。

建议：
1. 删除外键约束，让两个表完全独立
2. 或者保持约束，但修改代码逻辑，允许插入 NULL 值
        `)
      }
    } else {
      console.log('\n未找到外键约束，可能已经被删除。')
    }
  } catch (err) {
    console.error('❌ 查询失败:', err)
  } finally {
    if (pool) {
      await pool.close()
      console.log('\n数据库连接已关闭')
    }
  }
}

// 运行脚本
if (require.main === module) {
  checkForeignKeyConstraint()
    .then(() => {
      console.log('\n✅ 检查完成')
      process.exit(0)
    })
    .catch((err) => {
      console.error('❌ 执行失败:', err)
      process.exit(1)
    })
}

module.exports = { checkForeignKeyConstraint }
