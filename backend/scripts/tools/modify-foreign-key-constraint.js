const sql = require('mssql')
const config = require('../../config')

/**
 * 方案B：修改外键约束，允许 项目编号 为 NULL
 *
 * 这个脚本会：
 * 1. 删除现有的外键约束
 * 2. 修改 货物信息.项目编号 字段，允许为 NULL（如果当前不允许）
 * 3. 不重新创建外键约束，让两个表独立（或者根据需要可选重新创建）
 */
async function modifyForeignKeyConstraint() {
  let pool = null

  try {
    console.log('正在连接数据库...')
    pool = await sql.connect(config)
    console.log('✅ 数据库连接成功\n')

    // 步骤1: 查询外键约束名称
    console.log('📋 步骤1: 查询外键约束信息...')
    const fkQuery = `
      SELECT 
        fk.name AS FK_Name,
        OBJECT_NAME(fk.parent_object_id) AS Parent_Table,
        COL_NAME(fc.parent_object_id, fc.parent_column_id) AS Parent_Column
      FROM sys.foreign_keys AS fk
      INNER JOIN sys.foreign_key_columns AS fc ON fk.object_id = fc.constraint_object_id
      WHERE OBJECT_NAME(fk.parent_object_id) = '货物信息'
        AND COL_NAME(fc.parent_object_id, fc.parent_column_id) = '项目编号'
    `

    const fkResult = await pool.request().query(fkQuery)

    if (fkResult.recordset.length === 0) {
      console.log('⚠️  未找到外键约束，可能已经被删除')
      console.log('检查字段是否允许 NULL...')
    } else {
      const fkName = fkResult.recordset[0].FK_Name
      console.log(`找到外键约束: ${fkName}`)

      // 步骤2: 删除外键约束
      console.log(`\n📋 步骤2: 删除外键约束 "${fkName}"...`)
      try {
        await pool.request().query(`
          ALTER TABLE 货物信息
          DROP CONSTRAINT ${fkName}
        `)
        console.log('✅ 外键约束删除成功')
      } catch (err) {
        console.error('❌ 删除外键约束失败:', err.message)
        throw err
      }
    }

    // 步骤3: 检查字段是否允许 NULL
    console.log('\n📋 步骤3: 检查并修改字段属性...')
    const columnQuery = `
      SELECT 
        IS_NULLABLE as IsNullable
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = '货物信息'
        AND COLUMN_NAME = '项目编号'
    `

    const columnResult = await pool.request().query(columnQuery)

    if (columnResult.recordset.length > 0) {
      const isNullable = columnResult.recordset[0].IsNullable
      console.log(`当前 项目编号 字段是否允许 NULL: ${isNullable}`)

      if (isNullable === 'NO') {
        // 步骤4: 修改字段，允许为 NULL
        console.log('\n📋 步骤4: 修改字段，允许为 NULL...')
        try {
          await pool.request().query(`
            ALTER TABLE 货物信息
            ALTER COLUMN 项目编号 NVARCHAR(50) NULL
          `)
          console.log('✅ 字段修改成功，现在允许 NULL 值')
        } catch (err) {
          console.error('❌ 修改字段失败:', err.message)
          throw err
        }
      } else {
        console.log('✅ 字段已经允许 NULL，无需修改')
      }
    }

    // 验证修改结果
    console.log('\n📋 验证修改结果...')
    const verifyQuery = `
      SELECT 
        c.COLUMN_NAME,
        c.IS_NULLABLE,
        COUNT(fk.name) as FK_Count
      FROM INFORMATION_SCHEMA.COLUMNS c
      LEFT JOIN sys.foreign_keys fk 
        ON OBJECT_ID(c.TABLE_NAME) = fk.parent_object_id
      WHERE c.TABLE_NAME = '货物信息'
        AND c.COLUMN_NAME = '项目编号'
      GROUP BY c.COLUMN_NAME, c.IS_NULLABLE
    `

    const verifyResult = await pool.request().query(verifyQuery)
    console.log('✅ 验证结果:')
    console.table(verifyResult.recordset)

    console.log('\n' + '='.repeat(60))
    console.log('✅ 方案B实施完成！')
    console.log('='.repeat(60))
    console.log(`
现在：
1. ✅ 外键约束已删除
2. ✅ 货物信息.项目编号 字段允许为 NULL
3. ✅ 可以在不检查项目管理表的情况下插入货物信息

注意：
- 现在插入货物信息时，项目编号可以为 NULL 或任何值
- 不再有外键约束限制
- 如果需要，可以修改后端代码，允许项目编号为 NULL
    `)
  } catch (err) {
    console.error('❌ 执行失败:', err)
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
  console.log('⚠️  警告：此操作将删除外键约束，请确认！')
  console.log('按 Ctrl+C 取消，或者继续执行...\n')

  // 等待3秒，给用户时间取消
  setTimeout(async () => {
    modifyForeignKeyConstraint()
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

module.exports = { modifyForeignKeyConstraint }
