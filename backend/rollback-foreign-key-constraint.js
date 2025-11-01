const sql = require('mssql')
const config = require('./config')

/**
 * 回退方案B的修改
 *
 * 这个脚本会：
 * 1. 恢复 货物信息.项目编号 字段为 NOT NULL
 * 2. 重新创建外键约束，关联到 项目管理 表
 */
async function rollbackForeignKeyConstraint() {
  let pool = null

  try {
    console.log('正在连接数据库...')
    pool = await sql.connect(config)
    console.log('✅ 数据库连接成功\n')

    // 步骤1: 检查当前状态
    console.log('📋 步骤1: 检查当前数据库状态...')

    // 检查字段是否允许 NULL
    const columnQuery = `
      SELECT 
        IS_NULLABLE as IsNullable
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = '货物信息'
        AND COLUMN_NAME = '项目编号'
    `

    const columnResult = await pool.request().query(columnQuery)
    const isNullable = columnResult.recordset[0]?.IsNullable

    console.log(`当前 项目编号 字段是否允许 NULL: ${isNullable}`)

    // 检查是否已存在外键约束
    const fkQuery = `
      SELECT 
        fk.name AS FK_Name
      FROM sys.foreign_keys AS fk
      INNER JOIN sys.foreign_key_columns AS fc ON fk.object_id = fc.constraint_object_id
      WHERE OBJECT_NAME(fk.parent_object_id) = '货物信息'
        AND COL_NAME(fc.parent_object_id, fc.parent_column_id) = '项目编号'
    `

    const fkResult = await pool.request().query(fkQuery)
    const hasFK = fkResult.recordset.length > 0

    console.log(`当前是否已有外键约束: ${hasFK ? '是' : '否'}`)

    // 检查数据完整性：确保所有货物信息的项目编号都在项目管理表中存在
    console.log('\n📋 步骤2: 检查数据完整性...')
    const integrityQuery = `
      SELECT COUNT(*) as orphanCount
      FROM 货物信息 g
      WHERE g.项目编号 IS NOT NULL
        AND g.项目编号 != ''
        AND NOT EXISTS (
          SELECT 1 
          FROM 项目管理 p 
          WHERE p.项目编号 = g.项目编号
        )
    `

    const integrityResult = await pool.request().query(integrityQuery)
    const orphanCount = integrityResult.recordset[0].orphanCount

    if (orphanCount > 0) {
      console.log(`⚠️  警告：发现 ${orphanCount} 条货物信息记录的项目编号在项目管理表中不存在`)
      console.log('   这些记录将无法通过外键约束验证')

      // 询问是否要继续
      console.log('\n选择处理方式：')
      console.log('1. 为这些记录自动创建项目管理记录（推荐）')
      console.log('2. 跳过这些记录，只修复能修复的')
      console.log('3. 取消操作')

      // 自动选择方案1：为孤立记录创建项目管理记录
      console.log('\n自动选择方案1：为孤立记录创建项目管理记录...')

      const orphanQuery = `
        SELECT DISTINCT g.项目编号
        FROM 货物信息 g
        WHERE g.项目编号 IS NOT NULL
          AND g.项目编号 != ''
          AND NOT EXISTS (
            SELECT 1 
            FROM 项目管理 p 
            WHERE p.项目编号 = g.项目编号
          )
      `

      const orphanRecords = await pool.request().query(orphanQuery)

      if (orphanRecords.recordset.length > 0) {
        console.log(`正在为 ${orphanRecords.recordset.length} 个项目编号创建项目管理记录...`)

        for (const record of orphanRecords.recordset) {
          const projectCode = record.项目编号
          try {
            await pool.request().input('projectCode', sql.NVarChar, projectCode).query(`
                IF NOT EXISTS (SELECT 1 FROM 项目管理 WHERE 项目编号 = @projectCode)
                BEGIN
                  INSERT INTO 项目管理 (项目编号)
                  VALUES (@projectCode)
                END
              `)
            console.log(`  ✅ 已创建: ${projectCode}`)
          } catch (err) {
            console.error(`  ❌ 创建失败 ${projectCode}:`, err.message)
          }
        }

        console.log('✅ 数据完整性修复完成\n')
      }
    } else {
      console.log('✅ 数据完整性检查通过\n')
    }

    // 步骤3: 修改字段为 NOT NULL（如果当前允许 NULL）
    if (isNullable === 'YES') {
      console.log('📋 步骤3: 修改字段为 NOT NULL...')

      // 先确保所有记录的项目编号都不为 NULL
      const nullCountQuery = `
        SELECT COUNT(*) as nullCount
        FROM 货物信息
        WHERE 项目编号 IS NULL
      `
      const nullCountResult = await pool.request().query(nullCountQuery)
      const nullCount = nullCountResult.recordset[0].nullCount

      if (nullCount > 0) {
        console.log(`⚠️  发现 ${nullCount} 条记录的项目编号为 NULL`)
        console.log('   这些记录需要先设置项目编号才能恢复 NOT NULL 约束')
        console.log('   可以选择：')
        console.log('   1. 将这些记录的项目编号设置为空字符串')
        console.log('   2. 删除这些记录')
        console.log('   3. 保持允许 NULL（不建议）')

        // 自动选择：将 NULL 设置为空字符串（如果需要，可以改为其他处理方式）
        console.log('\n自动处理：将 NULL 项目编号设置为空字符串...')
        await pool.request().query(`
          UPDATE 货物信息
          SET 项目编号 = ''
          WHERE 项目编号 IS NULL
        `)
        console.log(`✅ 已将 ${nullCount} 条记录的 NULL 项目编号设置为空字符串`)
      }

      // 修改字段为 NOT NULL
      try {
        await pool.request().query(`
          ALTER TABLE 货物信息
          ALTER COLUMN 项目编号 NVARCHAR(50) NOT NULL
        `)
        console.log('✅ 字段修改成功，现在不允许 NULL 值')
      } catch (err) {
        console.error('❌ 修改字段失败:', err.message)
        throw err
      }
    } else {
      console.log('✅ 字段已经是 NOT NULL，无需修改')
    }

    // 步骤4: 重新创建外键约束（如果不存在）
    if (!hasFK) {
      console.log('\n📋 步骤4: 重新创建外键约束...')
      try {
        await pool.request().query(`
          ALTER TABLE 货物信息
          ADD CONSTRAINT FK_货物信息_项目编号 
          FOREIGN KEY (项目编号) 
          REFERENCES 项目管理(项目编号)
        `)
        console.log('✅ 外键约束创建成功')
      } catch (err) {
        console.error('❌ 创建外键约束失败:', err.message)
        console.log('   可能原因：')
        console.log('   1. 存在不符合约束的数据')
        console.log('   2. 约束名称已存在')

        // 尝试使用原来的约束名称
        try {
          await pool.request().query(`
            ALTER TABLE 货物信息
            ADD CONSTRAINT [货物信息$Rel_F712F4DF_0312_4AC5]
            FOREIGN KEY (项目编号) 
            REFERENCES 项目管理(项目编号)
          `)
          console.log('✅ 使用原约束名称创建成功')
        } catch (err2) {
          console.error('❌ 使用原约束名称也失败:', err2.message)
          throw err2
        }
      }
    } else {
      console.log('✅ 外键约束已存在，无需创建')
    }

    // 验证回退结果
    console.log('\n📋 验证回退结果...')
    const verifyQuery = `
      SELECT 
        c.COLUMN_NAME,
        c.IS_NULLABLE,
        COUNT(fk.name) as FK_Count,
        fk.name as FK_Name
      FROM INFORMATION_SCHEMA.COLUMNS c
      LEFT JOIN sys.foreign_keys fk 
        ON OBJECT_ID(QUOTENAME(c.TABLE_SCHEMA) + '.' + QUOTENAME(c.TABLE_NAME)) = fk.parent_object_id
        AND EXISTS (
          SELECT 1 FROM sys.foreign_key_columns fc
          WHERE fc.constraint_object_id = fk.object_id
            AND COL_NAME(fc.parent_object_id, fc.parent_column_id) = c.COLUMN_NAME
        )
      WHERE c.TABLE_NAME = '货物信息'
        AND c.COLUMN_NAME = '项目编号'
      GROUP BY c.COLUMN_NAME, c.IS_NULLABLE, fk.name
    `

    const verifyResult = await pool.request().query(verifyQuery)
    console.log('✅ 验证结果:')
    console.table(verifyResult.recordset)

    console.log('\n' + '='.repeat(60))
    console.log('✅ 回退完成！')
    console.log('='.repeat(60))
    console.log(`
已恢复：
1. ✅ 货物信息.项目编号 字段不允许 NULL
2. ✅ 外键约束已重新创建
3. ✅ 数据完整性已修复

现在：
- 插入货物信息时，项目编号必须在项目管理表中存在
- 需要恢复代码中的检查和自动创建逻辑
    `)
  } catch (err) {
    console.error('❌ 回退失败:', err)
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
  console.log('⚠️  警告：此操作将恢复外键约束，请确认！')
  console.log('按 Ctrl+C 取消，或者继续执行...\n')

  // 等待3秒，给用户时间取消
  setTimeout(async () => {
    rollbackForeignKeyConstraint()
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

module.exports = { rollbackForeignKeyConstraint }
