const { initDatabase, query, closeDatabase } = require('./database')

async function listSalesOrdersFields() {
  try {
    // 初始化数据库连接
    await initDatabase()
    console.log('数据库连接成功\n')

    // 查询销售订单表的所有字段信息
    console.log('销售订单表字段信息:')
    console.log('='.repeat(80))
    
    const columns = await query(`
      SELECT 
        ORDINAL_POSITION as position,
        COLUMN_NAME as columnName,
        DATA_TYPE as dataType,
        CHARACTER_MAXIMUM_LENGTH as maxLength,
        NUMERIC_PRECISION as precision,
        NUMERIC_SCALE as scale,
        IS_NULLABLE as nullable,
        COLUMN_DEFAULT as defaultValue,
        COLUMNPROPERTY(OBJECT_ID('销售订单'), COLUMN_NAME, 'IsIdentity') as isIdentity
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = '销售订单'
      ORDER BY ORDINAL_POSITION
    `)
    
    console.log(`\n共 ${columns.length} 个字段:\n`)
    
    columns.forEach((col, index) => {
      console.log(`${index + 1}. ${col.columnName}`)
      console.log(`   类型: ${col.dataType}${col.maxLength ? `(${col.maxLength})` : ''}${col.precision ? `(${col.precision},${col.scale})` : ''}`)
      console.log(`   位置: ${col.position}`)
      console.log(`   允许空值: ${col.nullable === 'YES' ? '是' : '否'}`)
      console.log(`   默认值: ${col.defaultValue || '无'}`)
      console.log(`   自增: ${col.isIdentity ? '是' : '否'}`)
      console.log('')
    })
    
    // 显示字段的中英文对照（基于数据库字段和常用映射）
    console.log('\n字段中英文对照:')
    console.log('='.repeat(80))
    
    const fieldMapping = [
      { chinese: '订单ID', english: 'id', type: 'int', desc: '主键，自增' },
      { chinese: '订单编号', english: 'orderNo', type: 'nvarchar(50)', desc: '订单编号，唯一标识' },
      { chinese: '客户ID', english: 'customerId', type: 'int', desc: '关联客户信息表' },
      { chinese: '项目编号', english: 'itemCode', type: 'nvarchar(50)', desc: '项目编号' },
      { chinese: '订单日期', english: 'orderDate', type: 'datetime2', desc: '下单日期' },
      { chinese: '交货日期', english: 'deliveryDate', type: 'datetime2', desc: '预计交货日期' },
      { chinese: '签订日期', english: 'signDate', type: 'datetime2', desc: '合同签订日期' },
      { chinese: '合同号', english: 'contractNo', type: 'nvarchar(100)', desc: '合同编号' },
      { chinese: '总金额', english: 'totalAmount', type: 'money', desc: '订单总金额' },
      { chinese: '单价', english: 'unitPrice', type: 'money', desc: '单价，默认0' },
      { chinese: '数量', english: 'quantity', type: 'int', desc: '数量，默认0' },
      { chinese: '备注', english: 'remark', type: 'nvarchar(255)', desc: '备注信息' },
      { chinese: '费用出处', english: 'costSource', type: 'nvarchar(255)', desc: '费用来源' },
      { chinese: '经办人', english: 'handler', type: 'nvarchar(255)', desc: '经办人姓名' },
      { chinese: '是否入库', english: 'isInStock', type: 'bit', desc: '是否已入库，默认false' },
      { chinese: '是否出运', english: 'isShipped', type: 'bit', desc: '是否已出运，默认false' },
      { chinese: '出运日期', english: 'shippingDate', type: 'datetime2', desc: '实际出运日期' },
      { chinese: 'SSMA_TimeStamp', english: 'timestamp', type: 'timestamp', desc: '系统时间戳（SSMA迁移字段）' }
    ]
    
    fieldMapping.forEach((field, index) => {
      console.log(`${index + 1}. ${field.chinese} (${field.english})`)
      console.log(`   字段类型: ${field.type}`)
      console.log(`   说明: ${field.desc}`)
      console.log('')
    })
    
    // 显示示例数据的一条记录
    console.log('\n示例数据 (第一条记录):')
    console.log('='.repeat(80))
    const sample = await query(`
      SELECT TOP 1 * FROM 销售订单 ORDER BY 订单ID
    `)
    
    if (sample.length > 0) {
      const record = sample[0]
      Object.keys(record).forEach(key => {
        const value = record[key]
        let displayValue = value
        
        if (value === null || value === undefined) {
          displayValue = '(NULL)'
        } else if (typeof value === 'boolean') {
          displayValue = value ? 'true' : 'false'
        } else if (value instanceof Date) {
          displayValue = value.toISOString()
        } else if (Buffer.isBuffer(value)) {
          displayValue = '<Buffer>'
        }
        
        console.log(`  ${key}: ${displayValue}`)
      })
    }

  } catch (error) {
    console.error('执行失败:', error)
  } finally {
    await closeDatabase()
  }
}

listSalesOrdersFields()

