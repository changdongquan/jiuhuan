const sql = require('mssql')
const config = require('./config')

// 收货地址数据
const deliveryAddresses = [
  {
    收货方名称: '合肥长虹模塑',
    联系人: '许工',
    联系电话: '13645516370',
    收货地址: '安徽省合肥市经济开发区汤口路819号'
  },
  {
    收货方名称: '合肥华伟模塑',
    联系人: '陈震',
    联系电话: '15395151469',
    收货地址: '安徽省合肥市双凤开发区金川路28号'
  },
  {
    收货方名称: '合肥红旗模塑',
    联系人: '史工',
    联系电话: '13865512319',
    收货地址: '安徽省合肥市庐江县同大镇工业园西湾路'
  },
  {
    收货方名称: '合肥方菱模塑',
    联系人: '沈工',
    联系电话: '13966710760',
    收货地址: '安徽省合肥市肥西县严店镇严店工业园解放路与经一路交口1号'
  },
  {
    收货方名称: '江西长虹模塑',
    联系人: '程工',
    联系电话: '18279876826',
    收货地址: '江西省景德镇市高新区梧桐大道美菱路美菱工业园长虹模塑'
  },
  {
    收货方名称: '宁国卓尔电器',
    联系人: '王工',
    联系电话: '13965417025',
    收货地址: '安徽省宣城市宁国市宁国汪溪工业园'
  },
  {
    收货方名称: '肥东龙韵',
    联系人: '黄工',
    联系电话: '18019913205',
    收货地址: '安徽省合肥市肥东县经济开发区镇西路N1号'
  },
  {
    收货方名称: '芜湖爱迪亚实业',
    联系人: '周工',
    联系电话: '18119886353',
    收货地址: '安徽省芜湖市镜湖区银湖北路71号'
  },
  {
    收货方名称: '无锡大业电器',
    联系人: '吴工',
    联系电话: '15061526931',
    收货地址: '无锡市滨湖区钱胡路88号'
  },
  {
    收货方名称: '无锡海岚塑料',
    联系人: '李工',
    联系电话: '13861778171',
    收货地址: '无锡市新吴区锡鸿路31号/无锡市新吴区鸿山街道鸿昌路61号14栋'
  },
  {
    收货方名称: '常州天星电子',
    联系人: '王工',
    联系电话: '17712770866',
    收货地址: '常州市武进区南夏墅街道庙桥东环路75号'
  },
  {
    收货方名称: '无锡鹏得塑料',
    联系人: '蔡总',
    联系电话: '15852516778',
    收货地址: '无锡市新吴区新锦路118号'
  },
  {
    收货方名称: '苏州利来星辰塑业',
    联系人: '顾工',
    联系电话: '15195620853',
    收货地址: '苏州市吴中区江浦路40号'
  },
  {
    收货方名称: '南京华格电器',
    联系人: '王工',
    联系电话: '18851798814',
    收货地址: '南京市栖霞区恒通大道1号'
  },
  {
    收货方名称: '南京双星塑料',
    联系人: '沈工',
    联系电话: '15150557867',
    收货地址: '南京市江宁区麒麟路街道天旺路'
  },
  {
    收货方名称: '无锡同创塑胶科技有限公司',
    联系人: '曹工',
    联系电话: '15896372362',
    收货地址: '新吴区鸿福路10号'
  },
  {
    收货方名称: '佛山市诚丰模具塑料有限公司',
    联系人: '李小明',
    联系电话: '13923275720',
    收货地址: '广东省佛山市南海区里水镇邓岗工业区'
  },
  {
    收货方名称: '巢湖荣达塑业公司',
    联系人: '苏荣涛',
    联系电话: '13170259898',
    收货地址: '巢湖市半汤大道花山工业园荣达塑业公司'
  },
  {
    收货方名称: '雄峰注塑',
    联系人: '张国红',
    联系电话: '13955670218',
    收货地址: '安徽省安庆市潜山市经济开发区皖水路11号'
  },
  {
    收货方名称: '苏深注塑',
    联系人: '朱元波',
    联系电话: '13865928459',
    收货地址: '江苏省无锡市江阴市古塘巷182-3号'
  },
  {
    收货方名称: '精博注塑',
    联系人: '李',
    联系电话: '13645604032',
    收货地址: '安徽省合肥市经开区桃花工业园汤口路与文山路交口'
  },
  { 收货方名称: '万朗注塑', 联系人: '韩洋', 联系电话: '15555188171', 收货地址: 'test' },
  {
    收货方名称: '合肥新海塑胶',
    联系人: '刘兴炎',
    联系电话: '15555156016',
    收货地址: '安徽省合肥市瑶海区关井西路6号'
  },
  {
    收货方名称: '美斯杰',
    联系人: '王玉',
    联系电话: '15655151767',
    收货地址: '蜀山区合肥中力自动化设备有限公司(蓬莱路东)'
  },
  {
    收货方名称: '合肥航亚新材料科技有限公司',
    联系人: '杨国建',
    联系电话: '13865513785',
    收货地址: '安徽省合肥市肥东县撮镇镇龙塘新安社区和平路与共青路交口东北角'
  },
  {
    收货方名称: '金佰嘉注塑厂',
    联系人: '李学家',
    联系电话: '15551698670',
    收货地址: '安徽省合肥市经济技术开发区新港工业园云谷路5910号1号中间跨厂房'
  },
  {
    收货方名称: '浩然',
    联系人: '沈工',
    联系电话: '18949841802',
    收货地址: '安徽省合肥市肥西县桃花工业园迎江寺路与湖东路交口东北角'
  },
  {
    收货方名称: '荣达塑业有限公司',
    联系人: '金传杰',
    联系电话: '18226132787',
    收货地址: '安徽省合肥市巢湖市半汤大道花山工业园'
  }
]

async function batchImportDeliveryAddresses() {
  let pool = null

  try {
    console.log('正在连接数据库...')
    pool = await sql.connect(config)
    console.log('✅ 数据库连接成功')

    // 确保表存在
    const createSql = `
      IF OBJECT_ID(N'客户收货地址', N'U') IS NULL
      BEGIN
        CREATE TABLE 客户收货地址 (
          收货地址ID INT IDENTITY(1,1) PRIMARY KEY,
          客户ID INT NOT NULL,
          收货方名称 NVARCHAR(200) NOT NULL,
          收货方简称 NVARCHAR(100) NULL,
          收货地址 NVARCHAR(500) NOT NULL,
          邮政编码 NVARCHAR(20) NULL,
          所在地区 NVARCHAR(100) NULL,
          所在城市 NVARCHAR(100) NULL,
          所在省份 NVARCHAR(100) NULL,
          所在国家 NVARCHAR(100) NULL DEFAULT '中国',
          联系人 NVARCHAR(100) NULL,
          联系电话 NVARCHAR(50) NULL,
          联系手机 NVARCHAR(20) NULL,
          电子邮箱 NVARCHAR(100) NULL,
          地址用途 NVARCHAR(50) NOT NULL DEFAULT 'SHIP_TO',
          是否默认 BIT NOT NULL DEFAULT 0,
          排序号 INT NOT NULL DEFAULT 0,
          是否启用 BIT NOT NULL DEFAULT 1,
          备注 NVARCHAR(500) NULL,
          创建时间 DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
          更新时间 DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
          创建人 NVARCHAR(100) NULL,
          更新人 NVARCHAR(100) NULL,
          CONSTRAINT FK_客户收货地址_客户ID 
            FOREIGN KEY (客户ID) REFERENCES 客户信息(客户ID)
            ON DELETE CASCADE
        )

        CREATE INDEX IX_客户收货地址_客户ID ON 客户收货地址(客户ID)
        CREATE INDEX IX_客户收货地址_是否默认 ON 客户收货地址(客户ID, 是否默认)
        CREATE INDEX IX_客户收货地址_地址用途 ON 客户收货地址(客户ID, 地址用途)
        CREATE INDEX IX_客户收货地址_排序号 ON 客户收货地址(客户ID, 排序号)
      END
    `
    await pool.request().query(createSql)
    console.log('✅ 确认客户收货地址表存在')

    // 查找客户ID
    console.log('正在查找客户"长虹美菱股份有限公司"...')
    const customerQuery = `
      SELECT 客户ID as id
      FROM 客户信息
      WHERE 客户名称 = @customerName
    `
    const customerRequest = pool.request()
    customerRequest.input('customerName', sql.NVarChar, '长虹美菱股份有限公司')
    const customerResult = await customerRequest.query(customerQuery)

    if (customerResult.recordset.length === 0) {
      console.error('❌ 未找到客户"长虹美菱股份有限公司"，请先创建该客户')
      return
    }

    const customerId = customerResult.recordset[0].id
    console.log(`✅ 找到客户ID: ${customerId}`)

    // 检查是否已存在收货地址
    const checkQuery = `
      SELECT COUNT(*) as count
      FROM 客户收货地址
      WHERE 客户ID = @customerId
    `
    const checkRequest = pool.request()
    checkRequest.input('customerId', sql.Int, customerId)
    const checkResult = await checkRequest.query(checkQuery)
    const existingCount = checkResult.recordset[0].count

    if (existingCount > 0) {
      console.log(`⚠️  该客户已有 ${existingCount} 个收货地址`)
      console.log('是否继续添加？(Y/N) - 由于是非交互式，将直接继续...')
    }

    // 获取最大排序号
    const maxSortQuery = `
      SELECT ISNULL(MAX(排序号), 0) as maxSort
      FROM 客户收货地址
      WHERE 客户ID = @customerId
    `
    const maxSortRequest = pool.request()
    maxSortRequest.input('customerId', sql.Int, customerId)
    const maxSortResult = await maxSortRequest.query(maxSortQuery)
    let currentSortOrder = maxSortResult.recordset[0]?.maxSort || 0

    // 开始事务批量插入
    const tx = new sql.Transaction(pool)
    await tx.begin()

    console.log(`开始批量导入 ${deliveryAddresses.length} 个收货地址...`)

    let successCount = 0
    let skipCount = 0
    let errorCount = 0

    try {
      for (let i = 0; i < deliveryAddresses.length; i++) {
        const addr = deliveryAddresses[i]

        // 跳过收货地址为空的记录
        if (!addr.收货地址 || addr.收货地址.trim() === '') {
          console.log(`⚠️  跳过 ${addr.收货方名称}：收货地址为空`)
          skipCount++
          continue
        }

        // 检查是否已存在相同的收货地址
        const existRequest = new sql.Request(tx)
        existRequest.input('customerId', sql.Int, customerId)
        existRequest.input('收货方名称', sql.NVarChar, addr.收货方名称)
        existRequest.input('收货地址', sql.NVarChar, addr.收货地址)
        const existResult = await existRequest.query(`
          SELECT COUNT(*) as count
          FROM 客户收货地址
          WHERE 客户ID = @customerId 
            AND 收货方名称 = @收货方名称 
            AND 收货地址 = @收货地址
        `)

        if (existResult.recordset[0].count > 0) {
          console.log(`⚠️  跳过 ${addr.收货方名称}：已存在相同收货地址`)
          skipCount++
          continue
        }

        currentSortOrder++

        // 插入地址
        const insertRequest = new sql.Request(tx)
        insertRequest.input('customerId', sql.Int, customerId)
        insertRequest.input('收货方名称', sql.NVarChar, addr.收货方名称)
        insertRequest.input('收货地址', sql.NVarChar, addr.收货地址)
        insertRequest.input('联系人', sql.NVarChar, addr.联系人 || null)
        insertRequest.input('联系电话', sql.NVarChar, addr.联系电话 || null)
        insertRequest.input('地址用途', sql.NVarChar, 'SHIP_TO')
        insertRequest.input('是否默认', sql.Bit, i === 0 ? 1 : 0) // 第一条设为默认
        insertRequest.input('排序号', sql.Int, currentSortOrder)
        insertRequest.input('所在国家', sql.NVarChar, '中国')

        // 从收货地址中提取城市信息（简单处理，优先匹配更具体的城市）
        let city = null
        if (addr.收货地址.includes('江阴')) city = '江阴市'
        else if (addr.收货地址.includes('合肥')) city = '合肥市'
        else if (addr.收货地址.includes('景德镇')) city = '景德镇市'
        else if (addr.收货地址.includes('宁国')) city = '宁国市'
        else if (addr.收货地址.includes('芜湖')) city = '芜湖市'
        else if (addr.收货地址.includes('无锡')) city = '无锡市'
        else if (addr.收货地址.includes('常州')) city = '常州市'
        else if (addr.收货地址.includes('苏州')) city = '苏州市'
        else if (addr.收货地址.includes('南京')) city = '南京市'
        else if (addr.收货地址.includes('佛山')) city = '佛山市'
        else if (addr.收货地址.includes('巢湖')) city = '巢湖市'
        else if (addr.收货地址.includes('潜山')) city = '潜山市'
        else if (addr.收货地址.includes('宣城')) city = '宣城市'
        // 对于"test"等测试地址不提取城市
        if (addr.收货地址.toLowerCase() === 'test') city = null

        // 根据是否有城市信息构建不同的SQL
        let insertFields = [
          '客户ID',
          '收货方名称',
          '收货地址',
          '联系人',
          '联系电话',
          '地址用途',
          '是否默认',
          '排序号',
          '所在国家'
        ]
        let insertValues = [
          '@customerId',
          '@收货方名称',
          '@收货地址',
          '@联系人',
          '@联系电话',
          '@地址用途',
          '@是否默认',
          '@排序号',
          '@所在国家'
        ]

        if (city) {
          insertFields.push('所在城市')
          insertValues.push('@所在城市')
          insertRequest.input('所在城市', sql.NVarChar, city)
        }

        await insertRequest.query(`
          INSERT INTO 客户收货地址 (
            ${insertFields.join(', ')}
          ) VALUES (
            ${insertValues.join(', ')}
          )
        `)

        successCount++
        console.log(`✅ [${i + 1}/${deliveryAddresses.length}] 已添加: ${addr.收货方名称}`)
      }

      await tx.commit()
      console.log('\n✅ 批量导入完成！')
      console.log(`   成功: ${successCount} 条`)
      console.log(`   跳过: ${skipCount} 条`)
      console.log(`   失败: ${errorCount} 条`)
    } catch (error) {
      await tx.rollback()
      throw error
    }
  } catch (error) {
    console.error('❌ 批量导入失败:', error)
    if (error.message) {
      console.error('错误详情:', error.message)
    }
    process.exit(1)
  } finally {
    if (pool) {
      await pool.close()
      console.log('数据库连接已关闭')
    }
  }
}

// 运行脚本
batchImportDeliveryAddresses()
  .then(() => {
    console.log('脚本执行完成')
    process.exit(0)
  })
  .catch((error) => {
    console.error('脚本执行失败:', error)
    process.exit(1)
  })
