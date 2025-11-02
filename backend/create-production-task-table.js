const sql = require('mssql')
const config = require('./config')

/**
 * 创建生产任务表和相关的索引、外键约束
 */
async function createProductionTaskTable() {
  let pool = null

  try {
    console.log('正在连接数据库...')
    pool = await sql.connect(config)
    console.log('✅ 数据库连接成功\n')

    // 步骤1：创建唯一索引（如果不存在）
    console.log('='.repeat(60))
    console.log('步骤1：创建货物信息.项目编号的唯一索引')
    console.log('='.repeat(60))

    try {
      // 先检查索引是否已存在
      const checkIndexQuery = `
        SELECT name
        FROM sys.indexes
        WHERE name = 'idx_货物信息_项目编号'
          AND object_id = OBJECT_ID('货物信息')
      `
      const indexCheck = await pool.request().query(checkIndexQuery)

      if (indexCheck.recordset.length > 0) {
        console.log('✅ 唯一索引已存在，跳过创建')
      } else {
        await pool.request().query(`
          CREATE UNIQUE INDEX idx_货物信息_项目编号 
          ON 货物信息(项目编号)
          WHERE 项目编号 IS NOT NULL
        `)
        console.log('✅ 唯一索引创建成功')
      }
    } catch (err) {
      if (err.message.includes('already exists') || err.message.includes('已经存在')) {
        console.log('✅ 唯一索引已存在，跳过创建')
      } else {
        throw err
      }
    }

    // 步骤2：获取项目管理表的字段结构
    console.log('\n' + '='.repeat(60))
    console.log('步骤2：获取项目管理表的字段结构')
    console.log('='.repeat(60))

    const columnsQuery = `
      SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        IS_NULLABLE,
        CHARACTER_MAXIMUM_LENGTH,
        NUMERIC_PRECISION,
        NUMERIC_SCALE,
        COLUMN_DEFAULT,
        ORDINAL_POSITION
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = '项目管理'
      ORDER BY ORDINAL_POSITION
    `

    const columnsResult = await pool.request().query(columnsQuery)
    console.log(`✅ 获取到 ${columnsResult.recordset.length} 个字段`)

    // 步骤3：构建CREATE TABLE语句
    console.log('\n' + '='.repeat(60))
    console.log('步骤3：创建生产任务表')
    console.log('='.repeat(60))

    // 检查表是否已存在
    const tableExistsQuery = `
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME = '生产任务'
    `
    const tableExists = await pool.request().query(tableExistsQuery)

    if (tableExists.recordset.length > 0) {
      console.log('⚠️  生产任务表已存在，将删除后重建...')
      await pool.request().query('DROP TABLE 生产任务')
      console.log('✅ 已删除旧表')
    }

    // 构建字段定义
    const fieldDefinitions = []
    for (const col of columnsResult.recordset) {
      // 跳过SSMA_TimeStamp系统字段
      if (col.COLUMN_NAME === 'SSMA_TimeStamp') {
        continue
      }

      let fieldDef = `    ${col.COLUMN_NAME}`

      // 数据类型
      let dataType = col.DATA_TYPE.toUpperCase()
      if (dataType === 'NVARCHAR' || dataType === 'VARCHAR') {
        const length = col.CHARACTER_MAXIMUM_LENGTH === -1 ? 'MAX' : col.CHARACTER_MAXIMUM_LENGTH
        dataType = `${dataType}(${length})`
      } else if (dataType === 'DECIMAL' || dataType === 'NUMERIC') {
        dataType = `${dataType}(${col.NUMERIC_PRECISION},${col.NUMERIC_SCALE})`
      } else if (dataType === 'MONEY') {
        dataType = 'MONEY'
      } else if (dataType === 'FLOAT') {
        dataType = 'FLOAT'
      }

      fieldDef += ` ${dataType}`

      // 项目编号字段特殊处理：作为主键，NOT NULL
      if (col.COLUMN_NAME === '项目编号') {
        fieldDef += ' NOT NULL'
      } else if (col.IS_NULLABLE === 'NO') {
        fieldDef += ' NOT NULL'
      }

      // 默认值处理
      if (col.COLUMN_DEFAULT) {
        if (col.COLUMN_DEFAULT.includes('GETDATE')) {
          fieldDef += ' DEFAULT GETDATE()'
        } else if (col.COLUMN_DEFAULT.includes('((0))')) {
          fieldDef += ' DEFAULT 0'
        }
      }

      fieldDefinitions.push(fieldDef)
    }

    // 构建完整的CREATE TABLE语句
    const createTableSQL = `
CREATE TABLE 生产任务 (
${fieldDefinitions.join(',\n')},
    PRIMARY KEY (项目编号)
)
    `.trim()

    console.log('执行建表SQL...')
    await pool.request().query(createTableSQL)
    console.log('✅ 生产任务表创建成功')

    // 步骤4：创建外键约束
    console.log('\n' + '='.repeat(60))
    console.log('步骤4：创建外键约束')
    console.log('='.repeat(60))

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
      if (err.message.includes('already exists') || err.message.includes('已经存在')) {
        console.log('✅ 外键约束已存在')
      } else {
        throw err
      }
    }

    // 步骤5：创建其他索引
    console.log('\n' + '='.repeat(60))
    console.log('步骤5：创建其他索引')
    console.log('='.repeat(60))

    const indexes = [{ name: 'idx_生产任务_客户ID', column: '客户ID' }]

    for (const idx of indexes) {
      try {
        await pool.request().query(`
          CREATE INDEX ${idx.name} ON 生产任务(${idx.column})
        `)
        console.log(`✅ 索引 ${idx.name} 创建成功`)
      } catch (err) {
        if (err.message.includes('already exists') || err.message.includes('已经存在')) {
          console.log(`✅ 索引 ${idx.name} 已存在`)
        } else {
          console.warn(`⚠️  创建索引 ${idx.name} 失败: ${err.message}`)
        }
      }
    }

    // 步骤6：验证
    console.log('\n' + '='.repeat(60))
    console.log('步骤6：验证创建结果')
    console.log('='.repeat(60))

    // 检查表是否存在
    const verifyTable = await pool.request().query(tableExistsQuery)
    if (verifyTable.recordset.length > 0) {
      console.log('✅ 生产任务表已创建')
    }

    // 检查外键约束
    const verifyFK = await pool.request().query(`
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

    if (verifyFK.recordset.length > 0) {
      console.log('✅ 外键约束已创建:')
      console.table(verifyFK.recordset)
    }

    console.log('\n' + '='.repeat(60))
    console.log('✅ 所有数据库操作完成！')
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
  console.log('⚠️  准备创建生产任务表...')
  console.log('按 Ctrl+C 取消，或等待3秒后继续...\n')

  setTimeout(async () => {
    createProductionTaskTable()
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

module.exports = { createProductionTaskTable }
