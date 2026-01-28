const sql = require('mssql')
const config = require('../../config')

/**
 * 分析新建"生产任务"表的方案
 * （只读查询，不修改数据库）
 */
async function analyzeNewTablePlan() {
  let pool = null

  try {
    console.log('正在连接数据库...')
    pool = await sql.connect(config)
    console.log('✅ 数据库连接成功\n')

    // 1. 检查货物信息表的结构
    console.log('='.repeat(60))
    console.log('📋 检查货物信息表结构')
    console.log('='.repeat(60))

    // 检查主键
    const pkQuery = `
      SELECT 
        COLUMN_NAME,
        ORDINAL_POSITION
      FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
      INNER JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
        ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
      WHERE tc.TABLE_NAME = '货物信息'
        AND tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
      ORDER BY kcu.ORDINAL_POSITION
    `
    const pkResult = await pool.request().query(pkQuery)
    console.log('\n主键字段:')
    if (pkResult.recordset.length > 0) {
      console.table(pkResult.recordset)
    } else {
      console.log('  未找到主键')
    }

    // 检查唯一索引/约束
    const uniqueQuery = `
      SELECT 
        kcu.COLUMN_NAME,
        tc.CONSTRAINT_NAME
      FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
      INNER JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
        ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
      WHERE tc.TABLE_NAME = '货物信息'
        AND tc.CONSTRAINT_TYPE = 'UNIQUE'
      ORDER BY kcu.COLUMN_NAME
    `
    const uniqueResult = await pool.request().query(uniqueQuery)
    console.log('\n唯一约束字段:')
    if (uniqueResult.recordset.length > 0) {
      console.table(uniqueResult.recordset)
    } else {
      console.log('  未找到唯一约束')
    }

    // 检查项目编号字段的实际情况
    console.log('\n📋 检查项目编号字段的唯一性')
    const projectCodeUniquenessQuery = `
      SELECT 
        COUNT(*) as total,
        COUNT(DISTINCT 项目编号) as distinctCount,
        SUM(CASE WHEN 项目编号 IS NULL THEN 1 ELSE 0 END) as nullCount
      FROM 货物信息
    `
    const uniquenessResult = await pool.request().query(projectCodeUniquenessQuery)
    const stats = uniquenessResult.recordset[0]
    console.log(`\n项目编号统计:`)
    console.log(`  总记录数: ${stats.total}`)
    console.log(`  唯一值数量: ${stats.distinctCount}`)
    console.log(`  NULL值数量: ${stats.nullCount}`)
    console.log(`  重复值数量: ${stats.total - stats.distinctCount - stats.nullCount}`)

    if (stats.total === stats.distinctCount + stats.nullCount) {
      console.log(`\n  ✅ 项目编号在非NULL值中是唯一的（可以创建外键）`)
    } else {
      console.log(`\n  ⚠️  项目编号存在重复值，无法直接作为外键引用`)
      console.log(`     重复记录数: ${stats.total - stats.distinctCount - stats.nullCount}`)
    }

    // 检查是否有多个货物信息记录使用同一个项目编号
    const duplicateQuery = `
      SELECT 
        项目编号,
        COUNT(*) as count
      FROM 货物信息
      WHERE 项目编号 IS NOT NULL
      GROUP BY 项目编号
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
    `
    const duplicateResult = await pool.request().query(duplicateQuery)
    if (duplicateResult.recordset.length > 0) {
      console.log(`\n  ⚠️  以下项目编号存在多条货物信息记录:`)
      console.table(duplicateResult.recordset.slice(0, 10)) // 只显示前10个
      if (duplicateResult.recordset.length > 10) {
        console.log(`  ... 还有 ${duplicateResult.recordset.length - 10} 个项目编号有重复`)
      }
    }

    // 2. 检查是否已经存在"生产任务"表
    console.log('\n' + '='.repeat(60))
    console.log('📋 检查是否已存在"生产任务"表')
    console.log('='.repeat(60))

    const tableExistsQuery = `
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME = '生产任务'
    `
    const tableResult = await pool.request().query(tableExistsQuery)

    if (tableResult.recordset.length > 0) {
      console.log('\n  ⚠️  表"生产任务"已存在！')

      // 如果表已存在，检查其结构
      const existingTableColumnsQuery = `
        SELECT 
          COLUMN_NAME,
          DATA_TYPE,
          IS_NULLABLE,
          CHARACTER_MAXIMUM_LENGTH
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = '生产任务'
        ORDER BY ORDINAL_POSITION
      `
      const columnsResult = await pool.request().query(existingTableColumnsQuery)
      console.log('\n现有表结构:')
      console.table(columnsResult.recordset)
    } else {
      console.log('\n  ✅ 表"生产任务"不存在，可以新建')
    }

    // 3. 检查生产任务单表的结构（作为参考）
    console.log('\n' + '='.repeat(60))
    console.log('📋 参考：生产任务单表的结构（已存在）')
    console.log('='.repeat(60))

    const taskTableColumnsQuery = `
      SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        IS_NULLABLE,
        CHARACTER_MAXIMUM_LENGTH
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = '生产任务单'
      ORDER BY ORDINAL_POSITION
    `
    const taskColumnsResult = await pool.request().query(taskTableColumnsQuery)
    if (taskColumnsResult.recordset.length > 0) {
      console.log('\n生产任务单表字段（可作为新表设计参考）:')
      console.table(taskColumnsResult.recordset.slice(0, 15)) // 显示前15个字段
    }

    // 4. 分析方案
    console.log('\n' + '='.repeat(60))
    console.log('📊 方案分析')
    console.log('='.repeat(60))

    const hasDuplicates = duplicateResult.recordset.length > 0
    const tableExists = tableResult.recordset.length > 0

    console.log(`
当前情况：
1. 货物信息表的主键：货物ID
2. 货物信息表.项目编号：${hasDuplicates ? '存在重复值' : '在非NULL值中唯一'}
3. "生产任务"表：${tableExists ? '已存在' : '不存在'}

${
  hasDuplicates
    ? `
⚠️  关键问题：
- 货物信息表中存在多个记录使用同一个项目编号
- 如果创建外键到项目编号，无法确定引用哪条货物信息记录

建议方案：
方案A：外键关联到货物信息.货物ID（推荐）
  - 优点：货物ID是主键，保证唯一性
  - 缺点：生产任务表中需要同时存储项目编号和货物ID

方案B：外键关联到货物信息.项目编号（如果业务逻辑允许）
  - 优点：直接关联项目编号，语义清晰
  - 缺点：必须确保一个项目编号只对应一条货物信息
  - 需要先清理重复数据

方案C：不创建外键，只在应用层维护关系
  - 优点：灵活性高，不受唯一性限制
  - 缺点：无法在数据库层面保证数据完整性
`
    : `
✅ 可以创建外键：
- 项目编号在货物信息表中是唯一的（非NULL值）
- 可以直接创建外键约束：生产任务.项目编号 → 货物信息.项目编号
`
}
    `)

    // 5. 提供具体的建表SQL示例
    console.log('\n' + '='.repeat(60))
    console.log('📝 建表SQL示例（方案A：关联货物ID）')
    console.log('='.repeat(60))
    console.log(`
-- 方案A：关联货物ID（推荐）
CREATE TABLE 生产任务 (
    任务ID INT IDENTITY(1,1) PRIMARY KEY,
    任务编号 NVARCHAR(50) NOT NULL,
    货物ID INT NOT NULL,  -- 外键关联到货物信息.货物ID
    项目编号 NVARCHAR(50),  -- 冗余字段，便于查询（可选）
    任务名称 NVARCHAR(200),
    负责人 NVARCHAR(100),
    开始日期 DATETIME2,
    结束日期 DATETIME2,
    任务状态 NVARCHAR(50),
    备注 NVARCHAR(MAX),
    创建时间 DATETIME2 DEFAULT GETDATE(),
    更新时间 DATETIME2 DEFAULT GETDATE()
);

-- 创建外键约束
ALTER TABLE 生产任务
ADD CONSTRAINT FK_生产任务_货物ID
FOREIGN KEY (货物ID) 
REFERENCES 货物信息(货物ID);

-- 创建索引
CREATE INDEX idx_生产任务_货物ID ON 生产任务(货物ID);
CREATE INDEX idx_生产任务_项目编号 ON 生产任务(项目编号);
    `)

    if (!hasDuplicates) {
      console.log('\n' + '='.repeat(60))
      console.log('📝 建表SQL示例（方案B：关联项目编号）')
      console.log('='.repeat(60))
      console.log(`
-- 方案B：关联项目编号（如果项目编号唯一）
CREATE TABLE 生产任务 (
    任务ID INT IDENTITY(1,1) PRIMARY KEY,
    任务编号 NVARCHAR(50) NOT NULL,
    项目编号 NVARCHAR(50) NOT NULL,  -- 外键关联到货物信息.项目编号
    任务名称 NVARCHAR(200),
    负责人 NVARCHAR(100),
    开始日期 DATETIME2,
    结束日期 DATETIME2,
    任务状态 NVARCHAR(50),
    备注 NVARCHAR(MAX),
    创建时间 DATETIME2 DEFAULT GETDATE(),
    更新时间 DATETIME2 DEFAULT GETDATE()
);

-- 创建外键约束（需要先确保货物信息.项目编号有唯一约束）
-- 如果项目编号没有唯一约束，需要先创建唯一索引
CREATE UNIQUE INDEX idx_货物信息_项目编号 ON 货物信息(项目编号)
WHERE 项目编号 IS NOT NULL;

-- 然后创建外键
ALTER TABLE 生产任务
ADD CONSTRAINT FK_生产任务_项目编号
FOREIGN KEY (项目编号) 
REFERENCES 货物信息(项目编号);

-- 创建索引
CREATE INDEX idx_生产任务_项目编号 ON 生产任务(项目编号);
      `)
    }

    console.log('\n' + '='.repeat(60))
    console.log('⚠️  注意事项')
    console.log('='.repeat(60))
    console.log(`
1. 方案A（推荐）：
   - 需要确定业务逻辑：一个生产任务对应一个具体的货物信息记录
   - 数据完整性最好，因为引用主键

2. 方案B（如果项目编号唯一）：
   - 需要先检查并确保货物信息表中项目编号的唯一性
   - 可能需要清理重复数据
   - 需要创建唯一索引才能创建外键

3. 如果表已存在：
   - 需要先确认是否需要删除重建
   - 或者添加字段和外键约束

4. 字段设计：
   - 根据实际业务需求确定需要哪些字段
   - 可以参考"生产任务单"表的设计
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
  analyzeNewTablePlan()
    .then(() => {
      console.log('\n✅ 分析完成（数据库未被修改）')
      process.exit(0)
    })
    .catch((err) => {
      console.error('❌ 执行失败:', err)
      process.exit(1)
    })
}

module.exports = { analyzeNewTablePlan }
