const sql = require('mssql')
const config = require('./config')

async function createSupplierTable() {
  let pool = null
  
  try {
    console.log('正在连接数据库...')
    pool = await sql.connect(config)
    console.log('✅ 数据库连接成功')
    
    // 检查表是否已存在
    console.log('检查表是否已存在...')
    const checkTable = await pool.request().query(`
      SELECT COUNT(*) as table_count 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME = 'supplier_info'
    `)
    
    if (checkTable.recordset[0].table_count > 0) {
      console.log('⚠️  表已存在，是否删除重建？')
      await pool.request().query('DROP TABLE supplier_info')
      console.log('✅ 旧表已删除')
    }
    
    // 创建供方信息表
    console.log('正在创建供方信息表...')
    await pool.request().query(`
      CREATE TABLE supplier_info (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        supplier_code VARCHAR(50) NOT NULL UNIQUE,
        supplier_name VARCHAR(200) NOT NULL,
        level VARCHAR(1) NOT NULL DEFAULT 'A' CHECK (level IN ('A', 'B', 'C')),
        category VARCHAR(10) NOT NULL CHECK (category IN ('原料', '配件', '设备', '外协', '服务')),
        status VARCHAR(10) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
        contact VARCHAR(100) NOT NULL,
        phone VARCHAR(20) NOT NULL,
        email VARCHAR(100),
        region VARCHAR(100),
        address VARCHAR(500),
        purchase_amount DECIMAL(15,2) DEFAULT 0.00,
        last_cooperation_date DATE,
        remark TEXT,
        tax_number VARCHAR(20),
        bank_name VARCHAR(200),
        bank_account VARCHAR(30),
        bank_code VARCHAR(12),
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE(),
        created_by VARCHAR(50),
        updated_by VARCHAR(50),
        is_deleted BIT DEFAULT 0
      )
    `)
    console.log('✅ 供方信息表创建成功')
    
    // 创建索引
    console.log('正在创建索引...')
    const indexes = [
      'CREATE INDEX idx_supplier_code ON supplier_info(supplier_code)',
      'CREATE INDEX idx_supplier_name ON supplier_info(supplier_name)',
      'CREATE INDEX idx_category ON supplier_info(category)',
      'CREATE INDEX idx_status ON supplier_info(status)',
      'CREATE INDEX idx_level ON supplier_info(level)',
      'CREATE INDEX idx_region ON supplier_info(region)',
      'CREATE INDEX idx_created_at ON supplier_info(created_at)',
      'CREATE INDEX idx_is_deleted ON supplier_info(is_deleted)'
    ]
    
    for (const indexSQL of indexes) {
      try {
        await pool.request().query(indexSQL)
        console.log('✅ 索引创建成功')
      } catch (err) {
        console.log('⚠️  索引可能已存在:', err.message)
      }
    }
    
    // 插入示例数据
    console.log('正在插入示例数据...')
    await pool.request().query(`
      INSERT INTO supplier_info (
        supplier_code, supplier_name, level, category, status,
        contact, phone, email, region, address,
        purchase_amount, last_cooperation_date, remark,
        tax_number, bank_name, bank_account, bank_code,
        created_by
      ) VALUES 
      (
        'SUP-001', '华东材料有限公司', 'A', '原料', 'active',
        '王强', '021-62345678', 'supplier@hdmaterials.com', '上海市', '浦东新区张江高科产业园',
        450000.00, '2024-02-15', '优质材料供应商，年度框架协议',
        '91310000123456789X', '中国工商银行上海分行', '6222021234567890123', '102290000001',
        'system'
      ),
      (
        'SUP-008', '远航物流服务', 'B', '服务', 'active',
        '陈俊', '0755-86771234', 'service@yuahanglogistics.com', '深圳市', '南山区前海路弘毅中心18楼',
        186000.00, '2024-01-28', '物流服务供应商，付款周期 30 天',
        '91440300123456789Y', '中国建设银行深圳分行', '6217001234567890123', '105584000001',
        'system'
      ),
      (
        'SUP-015', '星辰设备', 'C', '设备', 'suspended',
        '王京', '010-66553322', 'info@xingchenequipment.com', '北京市', '亦庄经济开发区创新园B座',
        89000.00, '2023-12-12', '设备供应商，目前暂停大额采购',
        '91110000123456789Z', '中国银行北京分行', '6216601234567890123', '104100000001',
        'system'
      )
    `)
    console.log('✅ 示例数据插入成功')
    
    // 验证结果
    console.log('验证表创建结果...')
    const tableInfo = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'supplier_info'
      ORDER BY ORDINAL_POSITION
    `)
    
    console.log('\n📋 表结构信息:')
    console.table(tableInfo.recordset)
    
    const sampleData = await pool.request().query(`
      SELECT supplier_code, supplier_name, level, category, status, contact, phone
      FROM supplier_info
    `)
    
    console.log('\n📊 示例数据:')
    console.table(sampleData.recordset)
    
    console.log('\n🎉 供方信息表创建完成！')
    
  } catch (err) {
    console.error('❌ 创建表失败:', err)
  } finally {
    if (pool) {
      await pool.close()
      console.log('数据库连接已关闭')
    }
  }
}

createSupplierTable()
