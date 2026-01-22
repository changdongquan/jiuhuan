const sql = require('mssql')
const config = require('../../config')

// 执行数据迁移脚本
const executeMigration = async () => {
  let pool = null

  try {
    console.log('正在连接数据库...')
    pool = await sql.connect(config)
    console.log('数据库连接成功')

    console.log('开始执行数据迁移...')

    // 1. 检查字段是否存在
    console.log('1. 检查字段是否存在...')
    const checkColumns = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = '项目管理'
      AND COLUMN_NAME IN ('产品图号列表', '产品尺寸')
    `)

    const existingColumns = checkColumns.recordset.map((r) => r.COLUMN_NAME)
    console.log('现有字段:', existingColumns)

    // 2. 新增产品图号列表字段
    if (!existingColumns.includes('产品图号列表')) {
      console.log('2. 新增产品图号列表字段...')
      await pool.request().query(`
        ALTER TABLE 项目管理
        ADD 产品图号列表 NVARCHAR(MAX) NULL
      `)
      console.log('✓ 产品图号列表字段已添加')
    } else {
      console.log('✓ 产品图号列表字段已存在')
    }

    // 3. 修改产品尺寸字段类型
    const productSizeColumn = checkColumns.recordset.find((r) => r.COLUMN_NAME === '产品尺寸')
    if (productSizeColumn) {
      if (
        productSizeColumn.DATA_TYPE !== 'nvarchar' ||
        productSizeColumn.CHARACTER_MAXIMUM_LENGTH !== -1
      ) {
        console.log('3. 修改产品尺寸字段类型为 NVARCHAR(MAX)...')
        await pool.request().query(`
          ALTER TABLE 项目管理
          ALTER COLUMN 产品尺寸 NVARCHAR(MAX) NULL
        `)
        console.log('✓ 产品尺寸字段类型已修改为 NVARCHAR(MAX)')
      } else {
        console.log('✓ 产品尺寸字段类型已经是 NVARCHAR(MAX)')
      }
    } else {
      console.log('⚠ 产品尺寸字段不存在，跳过修改')
    }

    // 4. 数据迁移：将现有的产品尺寸（字符串格式）转换为 JSON 数组格式
    console.log('4. 迁移产品尺寸数据（字符串转JSON数组）...')
    const migrateSizeResult = await pool.request().query(`
      UPDATE 项目管理
      SET 产品尺寸 = 
        CASE 
          WHEN 产品尺寸 IS NULL OR 产品尺寸 = '' THEN '[]'
          WHEN 产品尺寸 LIKE '[%' AND 产品尺寸 LIKE '%]' THEN 产品尺寸  -- 已经是JSON格式，跳过
          ELSE '["' + REPLACE(REPLACE(产品尺寸, '"', '""'), '''', '''''') + '"]'  -- 转为JSON数组，处理引号转义
        END
      WHERE 产品尺寸 IS NOT NULL
        AND 产品尺寸 != ''
        AND NOT (产品尺寸 LIKE '[%' AND 产品尺寸 LIKE '%]')  -- 排除已经是JSON格式的
    `)
    console.log(`✓ 产品尺寸数据迁移完成，影响 ${migrateSizeResult.rowsAffected[0]} 行`)

    // 5. 初始化产品图号列表（从货物信息表关联获取主图号）
    console.log('5. 初始化产品图号列表（从货物信息表）...')
    const initDrawingListResult = await pool.request().query(`
      UPDATE p
      SET p.产品图号列表 = '["' + REPLACE(REPLACE(g.产品图号, '"', '""'), '''', '''''') + '"]'
      FROM 项目管理 p
      INNER JOIN (
        SELECT 项目编号, 
               (SELECT TOP 1 产品图号 
                FROM 货物信息 
                WHERE 项目编号 = g1.项目编号 
                ORDER BY 货物ID) as 产品图号
        FROM 货物信息 g1
        GROUP BY 项目编号
      ) g ON p.项目编号 = g.项目编号
      WHERE g.产品图号 IS NOT NULL 
        AND g.产品图号 != ''
        AND (p.产品图号列表 IS NULL OR p.产品图号列表 = '' OR p.产品图号列表 = '[]')
    `)
    console.log(`✓ 产品图号列表初始化完成，影响 ${initDrawingListResult.rowsAffected[0]} 行`)

    // 6. 验证迁移结果
    console.log('6. 验证迁移结果...')
    const verifyResult = await pool.request().query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN 产品尺寸 IS NULL OR 产品尺寸 = '' OR 产品尺寸 = '[]' THEN 1 ELSE 0 END) as empty_size,
        SUM(CASE WHEN 产品尺寸 LIKE '[%' AND 产品尺寸 LIKE '%]' THEN 1 ELSE 0 END) as json_size,
        SUM(CASE WHEN 产品图号列表 IS NOT NULL AND 产品图号列表 != '' AND 产品图号列表 != '[]' THEN 1 ELSE 0 END) as has_drawing_list
      FROM 项目管理
    `)

    const stats = verifyResult.recordset[0]
    console.log('迁移统计:')
    console.log(`  总记录数: ${stats.total}`)
    console.log(`  空尺寸记录: ${stats.empty_size}`)
    console.log(`  JSON格式尺寸: ${stats.json_size}`)
    console.log(`  有图号列表记录: ${stats.has_drawing_list}`)

    console.log('\n✅ 数据迁移完成！')
  } catch (err) {
    console.error('❌ 数据迁移失败:', err)
    throw err
  } finally {
    if (pool) {
      await pool.close()
      console.log('数据库连接已关闭')
    }
  }
}

// 运行脚本
if (require.main === module) {
  executeMigration()
    .then(() => {
      console.log('脚本执行完成')
      process.exit(0)
    })
    .catch((err) => {
      console.error('脚本执行失败:', err)
      process.exit(1)
    })
}

module.exports = { executeMigration }
