const sql = require('mssql')
const config = require('./config')

/**
 * 修复并创建生产任务表和外键约束
 */
async function fixAndCreateProductionTaskTable() {
  let pool = null

  try {
    console.log('正在连接数据库...')
    pool = await sql.connect(config)
    console.log('✅ 数据库连接成功\n')

    // 步骤1：删除可能存在的唯一索引，改用UNIQUE约束
    console.log('='.repeat(60))
    console.log('步骤1：检查并创建唯一约束')
    console.log('='.repeat(60))

    // 检查是否已有唯一索引或约束
    const checkIndexQuery = `
      SELECT 
        i.name AS IndexName,
        t.name AS TableName,
        i.is_unique_constraint
      FROM sys.indexes i
      INNER JOIN sys.tables t ON i.object_id = t.object_id
      WHERE t.name = '货物信息'
        AND i.name = 'idx_货物信息_项目编号'
    `
    const indexCheck = await pool.request().query(checkIndexQuery)

    if (indexCheck.recordset.length > 0) {
      console.log('⚠️  已存在唯一索引，删除后改用UNIQUE约束...')
      try {
        await pool.request().query('DROP INDEX idx_货物信息_项目编号 ON 货物信息')
        console.log('✅ 已删除旧索引')
      } catch (err) {
        console.log('删除索引时出错（可能不存在）:', err.message)
      }
    }

    // 检查是否已有UNIQUE约束
    const checkConstraintQuery = `
      SELECT 
        CONSTRAINT_NAME
      FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
      WHERE TABLE_NAME = '货物信息'
        AND CONSTRAINT_TYPE = 'UNIQUE'
        AND CONSTRAINT_NAME LIKE '%项目编号%'
    `
    const constraintCheck = await pool.request().query(checkConstraintQuery)

    if (constraintCheck.recordset.length === 0) {
      // 创建UNIQUE约束（这是外键需要的）
      await pool.request().query(`
        ALTER TABLE 货物信息
        ADD CONSTRAINT UQ_货物信息_项目编号 UNIQUE (项目编号)
      `)
      console.log('✅ UNIQUE约束创建成功')
    } else {
      console.log('✅ UNIQUE约束已存在')
    }

    // 步骤2：检查并创建生产任务表
    console.log('\n' + '='.repeat(60))
    console.log('步骤2：检查生产任务表')
    console.log('='.repeat(60))

    const tableExistsQuery = `
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME = '生产任务'
    `
    const tableExists = await pool.request().query(tableExistsQuery)

    if (tableExists.recordset.length === 0) {
      console.log('⚠️  生产任务表不存在，需要创建...')
      console.log('   由于表结构复杂，请手动执行建表SQL')
      console.log('   或者使用之前分析得到的建表语句')
    } else {
      console.log('✅ 生产任务表已存在')
    }

    // 步骤3：创建外键约束
    console.log('\n' + '='.repeat(60))
    console.log('步骤3：创建外键约束')
    console.log('='.repeat(60))

    // 先检查外键是否已存在
    const checkFKQuery = `
      SELECT 
        fk.name AS FK_Name
      FROM sys.foreign_keys AS fk
      WHERE fk.name = 'FK_生产任务_项目编号'
    `
    const fkCheck = await pool.request().query(checkFKQuery)

    if (fkCheck.recordset.length > 0) {
      console.log('✅ 外键约束已存在')
    } else {
      // 确保生产任务表存在
      const tableCheck = await pool.request().query(tableExistsQuery)
      if (tableCheck.recordset.length === 0) {
        console.log('❌ 生产任务表不存在，无法创建外键')
        console.log('   请先创建生产任务表')
      } else {
        try {
          await pool.request().query(`
            ALTER TABLE 生产任务
            ADD CONSTRAINT FK_生产任务_项目编号
            FOREIGN KEY (项目编号) 
            REFERENCES 货物信息(项目编号)
            ON DELETE NO ACTION
            ON UPDATE NO ACTION
          `)
          console.log('✅ 外键约束创建成功')
        } catch (err) {
          console.error('❌ 创建外键约束失败:', err.message)
          throw err
        }
      }
    }

    console.log('\n' + '='.repeat(60))
    console.log('✅ 数据库准备完成')
    console.log('='.repeat(60))
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
  fixAndCreateProductionTaskTable()
    .then(() => {
      console.log('\n✅ 脚本执行完成')
      process.exit(0)
    })
    .catch((err) => {
      console.error('❌ 脚本执行失败:', err)
      process.exit(1)
    })
}

module.exports = { fixAndCreateProductionTaskTable }
