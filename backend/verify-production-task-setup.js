const sql = require('mssql')
const config = require('./config')

/**
 * 验证生产任务表的设置是否正确
 */
async function verifyProductionTaskSetup() {
  let pool = null

  try {
    console.log('正在连接数据库...')
    pool = await sql.connect(config)
    console.log('✅ 数据库连接成功\n')

    console.log('='.repeat(60))
    console.log('📋 验证生产任务表设置')
    console.log('='.repeat(60))

    // 1. 检查表是否存在
    const tableCheck = await pool.request().query(`
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME = '生产任务'
    `)

    if (tableCheck.recordset.length > 0) {
      console.log('✅ 生产任务表已存在')
    } else {
      console.log('❌ 生产任务表不存在')
      return
    }

    // 2. 检查唯一约束
    const constraintCheck = await pool.request().query(`
      SELECT CONSTRAINT_NAME
      FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
      WHERE TABLE_NAME = '货物信息'
        AND CONSTRAINT_TYPE = 'UNIQUE'
        AND CONSTRAINT_NAME LIKE '%项目编号%'
    `)

    if (constraintCheck.recordset.length > 0) {
      console.log('✅ 货物信息.项目编号的唯一约束已创建')
      console.log(`   约束名称: ${constraintCheck.recordset[0].CONSTRAINT_NAME}`)
    } else {
      console.log('❌ 货物信息.项目编号的唯一约束不存在')
    }

    // 3. 检查外键约束
    const fkCheck = await pool.request().query(`
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
    `)

    if (fkCheck.recordset.length > 0) {
      console.log('✅ 外键约束已创建')
      console.log(`   约束名称: ${fkCheck.recordset[0].FK_Name}`)
      console.log(
        `   关系: ${fkCheck.recordset[0].Parent_Table}.${fkCheck.recordset[0].Parent_Column} → ${fkCheck.recordset[0].Referenced_Table}.${fkCheck.recordset[0].Referenced_Column}`
      )
    } else {
      console.log('❌ 外键约束不存在')
    }

    // 4. 检查主键
    const pkCheck = await pool.request().query(`
      SELECT 
        COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_NAME = '生产任务'
        AND CONSTRAINT_NAME LIKE 'PK%'
    `)

    if (pkCheck.recordset.length > 0) {
      console.log('✅ 生产任务表主键已设置')
      console.log(`   主键字段: ${pkCheck.recordset[0].COLUMN_NAME}`)
    } else {
      console.log('⚠️  生产任务表主键未设置')
    }

    // 5. 统计记录数
    const countCheck = await pool.request().query(`
      SELECT COUNT(*) as count FROM 生产任务
    `)
    console.log(`\n📊 生产任务表记录数: ${countCheck.recordset[0].count}`)

    console.log('\n' + '='.repeat(60))
    console.log('✅ 验证完成')
    console.log('='.repeat(60))
  } catch (err) {
    console.error('❌ 验证失败:', err)
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
  verifyProductionTaskSetup()
    .then(() => {
      console.log('\n✅ 验证脚本执行完成')
      process.exit(0)
    })
    .catch((err) => {
      console.error('❌ 执行失败:', err)
      process.exit(1)
    })
}

module.exports = { verifyProductionTaskSetup }
