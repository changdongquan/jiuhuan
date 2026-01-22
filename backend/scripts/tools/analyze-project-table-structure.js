const sql = require('mssql')
const config = require('../../config')

/**
 * 分析项目管理表的完整结构
 * （只读查询，不修改数据库）
 */
async function analyzeProjectTableStructure() {
  let pool = null

  try {
    console.log('正在连接数据库...')
    pool = await sql.connect(config)
    console.log('✅ 数据库连接成功\n')

    // 1. 查询项目管理表的完整字段结构
    console.log('='.repeat(60))
    console.log('📋 项目管理表的完整结构')
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

    if (columnsResult.recordset.length > 0) {
      console.log(`\n✅ 找到 ${columnsResult.recordset.length} 个字段:`)
      console.table(
        columnsResult.recordset.map((col) => ({
          序号: col.ORDINAL_POSITION,
          字段名: col.COLUMN_NAME,
          数据类型: col.DATA_TYPE,
          允许NULL: col.IS_NULLABLE === 'YES' ? '是' : '否',
          '长度/精度': col.CHARACTER_MAXIMUM_LENGTH || col.NUMERIC_PRECISION || 'N/A',
          默认值: col.COLUMN_DEFAULT || '无'
        }))
      )

      // 2. 生成类似结构的CREATE TABLE SQL
      console.log('\n' + '='.repeat(60))
      console.log('📝 基于项目管理表结构的"生产任务"表设计')
      console.log('='.repeat(60))

      console.log('\n-- 生产任务表（参考项目管理表结构）')
      console.log('CREATE TABLE 生产任务 (')

      let firstField = true
      const fieldDefinitions = []

      for (const col of columnsResult.recordset) {
        // 跳过SSMA_TimeStamp这种系统字段
        if (col.COLUMN_NAME === 'SSMA_TimeStamp') {
          continue
        }

        let fieldDef = `    ${col.COLUMN_NAME}`

        // 数据类型转换
        let dataType = col.DATA_TYPE.toUpperCase()
        if (dataType === 'NVARCHAR' || dataType === 'VARCHAR') {
          const length = col.CHARACTER_MAXIMUM_LENGTH === -1 ? 'MAX' : col.CHARACTER_MAXIMUM_LENGTH
          dataType = `${dataType}(${length})`
        } else if (dataType === 'DECIMAL' || dataType === 'NUMERIC') {
          dataType = `${dataType}(${col.NUMERIC_PRECISION},${col.NUMERIC_SCALE})`
        } else if (dataType === 'INT' || dataType === 'BIGINT' || dataType === 'SMALLINT') {
          // 保持不变
        } else if (dataType === 'DATETIME2') {
          // 保持不变
        } else if (dataType === 'BIT') {
          // 保持不变
        }

        fieldDef += ` ${dataType}`

        // NULL约束
        if (col.IS_NULLABLE === 'NO') {
          fieldDef += ' NOT NULL'
        }

        // 默认值
        if (col.COLUMN_DEFAULT) {
          // 处理默认值格式
          let defaultValue = col.COLUMN_DEFAULT
          if (defaultValue.includes('GETDATE()')) {
            defaultValue = 'DEFAULT GETDATE()'
          } else if (defaultValue.includes('(') && defaultValue.includes(')')) {
            // 处理 ((0)) 这种格式
            defaultValue = defaultValue.replace(/[()]/g, '')
            if (defaultValue !== '') {
              fieldDef += ` DEFAULT ${defaultValue}`
            }
          }
        }

        fieldDefinitions.push(fieldDef)
      }

      // 输出字段定义
      fieldDefinitions.forEach((fieldDef, index) => {
        if (index < fieldDefinitions.length - 1) {
          console.log(fieldDef + ',')
        } else {
          console.log(fieldDef)
        }
      })

      console.log(');')

      // 3. 生成完整的建表SQL（包括外键）
      console.log('\n' + '='.repeat(60))
      console.log('📝 完整的建表SQL脚本（包含外键约束）')
      console.log('='.repeat(60))

      console.log(`
-- ============================================
-- 步骤1：为货物信息.项目编号创建唯一索引（必需）
-- ============================================
CREATE UNIQUE INDEX idx_货物信息_项目编号 
ON 货物信息(项目编号)
WHERE 项目编号 IS NOT NULL;

-- ============================================
-- 步骤2：创建"生产任务"表（参考项目管理表结构）
-- ============================================
CREATE TABLE 生产任务 (`)

      // 重新构建字段定义（修改项目编号字段）
      const modifiedFieldDefs = []
      for (const col of columnsResult.recordset) {
        if (col.COLUMN_NAME === 'SSMA_TimeStamp') {
          continue
        }

        let fieldDef = `    ${col.COLUMN_NAME}`

        let dataType = col.DATA_TYPE.toUpperCase()
        if (dataType === 'NVARCHAR' || dataType === 'VARCHAR') {
          const length = col.CHARACTER_MAXIMUM_LENGTH === -1 ? 'MAX' : col.CHARACTER_MAXIMUM_LENGTH
          dataType = `${dataType}(${length})`
        } else if (dataType === 'DECIMAL' || dataType === 'NUMERIC') {
          dataType = `${dataType}(${col.NUMERIC_PRECISION},${col.NUMERIC_SCALE})`
        }

        fieldDef += ` ${dataType}`

        // 项目编号字段特殊处理：设置为NOT NULL（因为是外键）
        if (col.COLUMN_NAME === '项目编号') {
          fieldDef += ' NOT NULL'
        } else if (col.IS_NULLABLE === 'NO') {
          fieldDef += ' NOT NULL'
        }

        // 默认值处理（简化）
        if (col.COLUMN_DEFAULT && col.COLUMN_DEFAULT.includes('GETDATE')) {
          fieldDef += ' DEFAULT GETDATE()'
        } else if (col.COLUMN_DEFAULT && col.COLUMN_DEFAULT.includes('((0))')) {
          fieldDef += ' DEFAULT 0'
        }

        modifiedFieldDefs.push(fieldDef)
      }

      modifiedFieldDefs.forEach((fieldDef, index) => {
        if (index < modifiedFieldDefs.length - 1) {
          console.log(fieldDef + ',')
        } else {
          console.log(fieldDef)
        }
      })

      console.log(`);

-- ============================================
-- 步骤3：创建外键约束
-- ============================================
ALTER TABLE 生产任务
ADD CONSTRAINT FK_生产任务_项目编号
FOREIGN KEY (项目编号) 
REFERENCES 货物信息(项目编号)
ON DELETE NO ACTION
ON UPDATE NO ACTION;

-- ============================================
-- 步骤4：创建索引（提升查询性能）
-- ============================================
CREATE INDEX idx_生产任务_项目编号 ON 生产任务(项目编号);

-- ============================================
-- 步骤5：验证外键约束
-- ============================================
SELECT 
    fk.name AS FK_Name,
    OBJECT_NAME(fk.parent_object_id) AS Parent_Table,
    COL_NAME(fc.parent_object_id, fc.parent_column_id) AS Parent_Column,
    OBJECT_NAME(fk.referenced_object_id) AS Referenced_Table,
    COL_NAME(fc.referenced_object_id, fc.referenced_column_id) AS Referenced_Column
FROM sys.foreign_keys AS fk
INNER JOIN sys.foreign_key_columns AS fc ON fk.object_id = fc.constraint_object_id
WHERE OBJECT_NAME(fk.parent_object_id) = '生产任务';
      `)

      // 4. 说明字段差异
      console.log('\n' + '='.repeat(60))
      console.log('📋 字段差异说明')
      console.log('='.repeat(60))
      console.log(`
主要差异：
1. 项目编号字段：
   - 项目管理表：项目编号是主键或唯一标识，关联客户信息
   - 生产任务表：项目编号是外键，关联货物信息.项目编号（NOT NULL）

2. 客户相关字段：
   - 项目管理表：有客户ID、客户模号等客户相关字段
   - 生产任务表：保留这些字段（如果需要），或者可以删除

3. 业务字段：
   - 可以保留项目管理表中的所有业务字段
   - 或者根据"生产任务"的业务需求调整字段

建议：
- 如果需要完整的项目管理信息，可以保留所有字段
- 如果只需要部分字段，可以在建表后删除不需要的字段
      `)
    } else {
      console.log('\n⚠️  未找到项目管理表')
    }
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
  analyzeProjectTableStructure()
    .then(() => {
      console.log('\n✅ 分析完成（数据库未被修改）')
      process.exit(0)
    })
    .catch((err) => {
      console.error('❌ 执行失败:', err)
      process.exit(1)
    })
}

module.exports = { analyzeProjectTableStructure }
