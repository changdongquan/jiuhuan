const sql = require('mssql')
const config = require('./config')

async function updateSupplierTable() {
  let pool = null
  
  try {
    console.log('正在连接数据库...')
    pool = await sql.connect(config)
    console.log('✅ 数据库连接成功')
    
    // 删除现有表
    console.log('正在删除现有表...')
    await pool.request().query('DROP TABLE IF EXISTS supplier_info')
    console.log('✅ 旧表已删除')
    
    // 创建新的供方信息表（中文字段名）
    console.log('正在创建新的供方信息表...')
    await pool.request().query(`
      CREATE TABLE supplier_info (
        供方ID BIGINT IDENTITY(1,1) PRIMARY KEY,
        供方编码 VARCHAR(50) NOT NULL UNIQUE,
        供方名称 VARCHAR(200) NOT NULL,
        供方等级 VARCHAR(1) NOT NULL DEFAULT 'A' CHECK (供方等级 IN ('A', 'B', 'C')),
        分类 VARCHAR(10) NOT NULL CHECK (分类 IN ('原料', '配件', '设备', '外协', '服务')),
        供方状态 VARCHAR(10) NOT NULL DEFAULT 'active' CHECK (供方状态 IN ('active', 'suspended')),
        联系人 VARCHAR(100) NOT NULL,
        联系电话 VARCHAR(20) NOT NULL,
        电子邮箱 VARCHAR(100),
        所在地区 VARCHAR(100),
        详细地址 VARCHAR(500),
        备注信息 TEXT,
        纳税人识别号 VARCHAR(20),
        开户银行 VARCHAR(200),
        银行账号 VARCHAR(30),
        银行行号 VARCHAR(12),
        创建时间 DATETIME2 DEFAULT GETDATE(),
        更新时间 DATETIME2 DEFAULT GETDATE(),
        创建人 VARCHAR(50),
        更新人 VARCHAR(50),
        是否删除 BIT DEFAULT 0
      )
    `)
    console.log('✅ 供方信息表创建成功')
    
    // 创建索引
    console.log('正在创建索引...')
    const indexes = [
      'CREATE INDEX idx_供方编码 ON supplier_info(供方编码)',
      'CREATE INDEX idx_供方名称 ON supplier_info(供方名称)',
      'CREATE INDEX idx_分类 ON supplier_info(分类)',
      'CREATE INDEX idx_供方状态 ON supplier_info(供方状态)',
      'CREATE INDEX idx_供方等级 ON supplier_info(供方等级)',
      'CREATE INDEX idx_所在地区 ON supplier_info(所在地区)',
      'CREATE INDEX idx_创建时间 ON supplier_info(创建时间)',
      'CREATE INDEX idx_是否删除 ON supplier_info(是否删除)'
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
        供方编码, 供方名称, 供方等级, 分类, 供方状态,
        联系人, 联系电话, 电子邮箱, 所在地区, 详细地址,
        备注信息, 纳税人识别号, 开户银行, 银行账号, 银行行号,
        创建人
      ) VALUES 
      (
        'SUP-001', '华东材料有限公司', 'A', '原料', 'active',
        '王强', '021-62345678', 'supplier@hdmaterials.com', '上海市', '浦东新区张江高科产业园',
        '优质材料供应商，年度框架协议',
        '91310000123456789X', '中国工商银行上海分行', '6222021234567890123', '102290000001',
        'system'
      ),
      (
        'SUP-008', '远航物流服务', 'B', '服务', 'active',
        '陈俊', '0755-86771234', 'service@yuahanglogistics.com', '深圳市', '南山区前海路弘毅中心18楼',
        '物流服务供应商，付款周期 30 天',
        '91440300123456789Y', '中国建设银行深圳分行', '6217001234567890123', '105584000001',
        'system'
      ),
      (
        'SUP-015', '星辰设备', 'C', '设备', 'suspended',
        '王京', '010-66553322', 'info@xingchenequipment.com', '北京市', '亦庄经济开发区创新园B座',
        '设备供应商，目前暂停大额采购',
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
      SELECT 供方编码, 供方名称, 供方等级, 分类, 供方状态, 联系人, 联系电话
      FROM supplier_info
    `)
    
    console.log('\n📊 示例数据:')
    console.table(sampleData.recordset)
    
    console.log('\n🎉 供方信息表更新完成！')
    console.log('✅ ID字段已改为"供方ID"')
    console.log('✅ 已删除"年度采购额"和"上次合作日期"字段')
    console.log('✅ 所有字段名已改为中文')
    
  } catch (err) {
    console.error('❌ 更新表失败:', err)
  } finally {
    if (pool) {
      await pool.close()
      console.log('数据库连接已关闭')
    }
  }
}

updateSupplierTable()
