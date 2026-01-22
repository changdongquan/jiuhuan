const sql = require('mssql')
const config = require('../../config')

/**
 * 检查货物信息和项目管理表之间的同步关系
 * （只读查询，不修改数据库）
 */
async function checkCascadeRelationship() {
  let pool = null

  try {
    console.log('正在连接数据库...')
    pool = await sql.connect(config)
    console.log('✅ 数据库连接成功\n')

    // 1. 检查外键约束的级联操作设置
    console.log('='.repeat(60))
    console.log('📋 检查外键约束的级联操作')
    console.log('='.repeat(60))

    const fkQuery = `
      SELECT 
        fk.name AS FK_Name,
        OBJECT_NAME(fk.parent_object_id) AS Parent_Table,
        COL_NAME(fc.parent_object_id, fc.parent_column_id) AS Parent_Column,
        OBJECT_NAME(fk.referenced_object_id) AS Referenced_Table,
        COL_NAME(fc.referenced_object_id, fc.referenced_column_id) AS Referenced_Column,
        fk.delete_referential_action_desc AS Delete_Action,
        fk.update_referential_action_desc AS Update_Action
      FROM sys.foreign_keys AS fk
      INNER JOIN sys.foreign_key_columns AS fc ON fk.object_id = fc.constraint_object_id
      WHERE OBJECT_NAME(fk.parent_object_id) = '货物信息'
        AND COL_NAME(fc.parent_object_id, fc.parent_column_id) = '项目编号'
    `

    const fkResult = await pool.request().query(fkQuery)

    if (fkResult.recordset.length > 0) {
      const fk = fkResult.recordset[0]
      console.log('\n✅ 外键约束信息:')
      console.log(`  约束名称: ${fk.FK_Name}`)
      console.log(
        `  关系: ${fk.Parent_Table}.${fk.Parent_Column} → ${fk.Referenced_Table}.${fk.Referenced_Column}`
      )
      console.log(`  删除操作: ${fk.Delete_Action}`)
      console.log(`  更新操作: ${fk.Update_Action}`)

      console.log('\n📋 级联操作说明:')
      if (fk.Delete_Action === 'NO_ACTION') {
        console.log(`
  ⚠️  删除操作：NO_ACTION
     - 如果删除项目管理中的记录，而货物信息中还在引用这个项目编号
     - 删除操作会失败，并报错
     - 必须先删除或更新所有引用该记录的货物信息，才能删除项目管理记录
        `)
      } else if (fk.Delete_Action === 'CASCADE') {
        console.log(`
  ✅ 删除操作：CASCADE（级联删除）
     - 如果删除项目管理中的记录
     - 所有引用该记录的货物信息记录会自动删除
        `)
      } else if (fk.Delete_Action === 'SET_NULL') {
        console.log(`
  ℹ️  删除操作：SET_NULL
     - 如果删除项目管理中的记录
     - 所有引用该记录的货物信息.项目编号会被设置为NULL
        `)
      }

      if (fk.Update_Action === 'NO_ACTION') {
        console.log(`
  ⚠️  更新操作：NO_ACTION
     - 如果更新项目管理的项目编号，而货物信息中还在引用旧的编号
     - 更新操作会失败，并报错
     - 必须先更新所有引用该记录的货物信息，才能更新项目管理记录
        `)
      } else if (fk.Update_Action === 'CASCADE') {
        console.log(`
  ✅ 更新操作：CASCADE（级联更新）
     - 如果更新项目管理的项目编号
     - 所有引用该记录的货物信息.项目编号会自动更新
        `)
      }
    }

    // 2. 检查反向关系（是否有从项目管理到货物信息的外键）
    console.log('\n' + '='.repeat(60))
    console.log('📋 检查反向关系')
    console.log('='.repeat(60))

    const reverseFKQuery = `
      SELECT 
        fk.name AS FK_Name,
        OBJECT_NAME(fk.parent_object_id) AS Parent_Table,
        COL_NAME(fc.parent_object_id, fc.parent_column_id) AS Parent_Column,
        OBJECT_NAME(fk.referenced_object_id) AS Referenced_Table,
        COL_NAME(fc.referenced_object_id, fc.referenced_column_id) AS Referenced_Column
      FROM sys.foreign_keys AS fk
      INNER JOIN sys.foreign_key_columns AS fc ON fk.object_id = fc.constraint_object_id
      WHERE OBJECT_NAME(fk.parent_object_id) = '项目管理'
        AND OBJECT_NAME(fk.referenced_object_id) = '货物信息'
    `

    const reverseFKResult = await pool.request().query(reverseFKQuery)

    if (reverseFKResult.recordset.length > 0) {
      console.log('\n⚠️  发现反向外键约束（项目管理引用货物信息）:')
      console.table(reverseFKResult.recordset)
    } else {
      console.log('\n✅ 没有反向外键约束')
      console.log('   - 货物信息的操作不会自动影响项目管理表')
      console.log('   - 项目管理表是"被引用"的表，不会因为货物信息的操作而改变')
    }

    // 3. 总结操作影响
    console.log('\n' + '='.repeat(60))
    console.log('📊 操作影响总结')
    console.log('='.repeat(60))

    console.log(`
当前外键关系：货物信息.项目编号 → 项目管理.项目编号

【货物信息的操作对项目管理的影响】：
1. ✅ 新增货物信息：
   - 必须在项目管理表中先存在对应的项目编号
   - 如果项目管理中没有该项目编号，插入会失败
   - 代码逻辑：会自动检查并在项目管理中创建记录（见goods.js）

2. ✅ 删除货物信息：
   - 不会影响项目管理表
   - 项目管理中的记录保持不变
   - 因为外键是单向的（货物信息引用项目管理）

3. ✅ 更新货物信息.项目编号：
   - 新值必须在项目管理中存在
   - 如果新项目编号不存在，更新会失败

【项目管理的操作对货物信息的影响】：
1. ⚠️  删除项目管理记录：
   - 如果货物信息中还有记录引用这个项目编号
   - 删除会失败（NO_ACTION策略）
   - 必须先删除所有相关的货物信息记录

2. ⚠️  更新项目管理.项目编号：
   - 如果货物信息中还有记录引用旧的项目编号
   - 更新会失败（NO_ACTION策略）
   - 必须先更新所有相关的货物信息记录

总结：
- ❌ 货物信息的操作不会自动同步到项目管理
- ✅ 但货物信息的操作必须符合项目管理的数据约束
- ✅ 代码中有逻辑自动在项目管理中创建记录（新增货物信息时）
    `)

    // 4. 检查代码中的自动创建逻辑
    console.log('\n' + '='.repeat(60))
    console.log('📋 代码中的自动同步逻辑')
    console.log('='.repeat(60))

    console.log(`
在 backend/routes/goods.js 中：

新增货物信息时（POST /api/goods）：
  - 第227-274行：会检查项目管理表中是否存在项目编号
  - 如果不存在，会自动创建项目管理记录
  - 这样确保了数据完整性，避免外键约束错误

这个逻辑是：
  货物信息新增 → 检查项目管理 → 自动创建（如不存在）

所以实际情况：
  ✅ 新增货物信息：会自动在项目管理中创建对应记录
  ❌ 删除货物信息：不会删除项目管理中的记录
  ❌ 更新货物信息：不会更新项目管理中的记录
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
  checkCascadeRelationship()
    .then(() => {
      console.log('\n✅ 检查完成（数据库未被修改）')
      process.exit(0)
    })
    .catch((err) => {
      console.error('❌ 执行失败:', err)
      process.exit(1)
    })
}

module.exports = { checkCascadeRelationship }
