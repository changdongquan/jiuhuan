const express = require('express')
const { query } = require('../database')
const router = express.Router()

// 获取客户信息列表
router.get('/list', async (req, res) => {
  try {
    const { customerName, contact, status, page = 1, pageSize = 10 } = req.query

    let whereConditions = []
    let params = {}

    // 构建查询条件
    if (customerName) {
      whereConditions.push('客户名称 LIKE @customerName')
      params.customerName = `%${customerName}%`
    }

    if (contact) {
      whereConditions.push('联系人 LIKE @contact')
      params.contact = `%${contact}%`
    }

    if (status) {
      if (status === 'active') {
        whereConditions.push('(是否停用 = 0 OR 是否停用 IS NULL)')
      } else if (status === 'inactive') {
        whereConditions.push('是否停用 = 1')
      }
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

    // 计算分页
    const offset = (page - 1) * pageSize

    // 查询总数
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM 客户信息 
      ${whereClause}
    `
    const countResult = await query(countQuery, params)
    const total = countResult[0].total

    // 查询数据
    const dataQuery = `
      SELECT 
        客户ID as id,
        客户名称 as customerName,
        联系人 as contact,
        客户联系方式 as phone,
        客户地址 as address,
        客户邮箱 as email,
        CASE 
          WHEN 是否停用 = 1 THEN 'inactive'
          ELSE 'active'
        END as status,
        SeqNumber as seqNumber
      FROM 客户信息 
      ${whereClause}
      ORDER BY SeqNumber ASC
      OFFSET ${offset} ROWS
      FETCH NEXT ${pageSize} ROWS ONLY
    `

    const data = await query(dataQuery, params)

    res.json({
      code: 0,
      success: true,
      data: {
        list: data,
        total: total,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      }
    })
  } catch (error) {
    console.error('获取客户信息列表失败:', error)
    res.status(500).json({
      success: false,
      message: '获取客户信息列表失败',
      error: error.message
    })
  }
})

// 获取客户统计信息
router.get('/statistics', async (req, res) => {
  try {
    const queryString = `
      SELECT 
        COUNT(*) as totalCustomers,
        SUM(CASE WHEN 是否停用 = 0 OR 是否停用 IS NULL THEN 1 ELSE 0 END) as activeCustomers,
        SUM(CASE WHEN 是否停用 = 1 THEN 1 ELSE 0 END) as inactiveCustomers,
        SUM(CASE WHEN 客户联系方式 IS NOT NULL AND 客户联系方式 != '' THEN 1 ELSE 0 END) as withContact
      FROM 客户信息
    `

    const result = await query(queryString)

    res.json({
      code: 0,
      success: true,
      data: result[0]
    })
  } catch (error) {
    console.error('获取客户统计信息失败:', error)
    res.status(500).json({
      success: false,
      message: '获取客户统计信息失败',
      error: error.message
    })
  }
})

// 获取单个客户信息
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params

    const queryString = `
      SELECT 
        客户ID as id,
        客户名称 as customerName,
        联系人 as contact,
        客户联系方式 as phone,
        客户地址 as address,
        客户邮箱 as email,
        CASE 
          WHEN 是否停用 = 1 THEN 'inactive'
          ELSE 'active'
        END as status,
        SeqNumber as seqNumber
      FROM 客户信息 
      WHERE 客户ID = @id
    `

    const result = await query(queryString, { id: parseInt(id) })

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: '客户信息不存在'
      })
    }

    res.json({
      code: 0,
      success: true,
      data: result[0]
    })
  } catch (error) {
    console.error('获取客户信息失败:', error)
    res.status(500).json({
      success: false,
      message: '获取客户信息失败',
      error: error.message
    })
  }
})

// 新增客户信息
router.post('/', async (req, res) => {
  try {
    const {
      customerName,
      contact,
      phone,
      address,
      email,
      status = 'active',
      seqNumber = 0
    } = req.body

    const queryString = `
      INSERT INTO 客户信息 
      (客户名称, 联系人, 客户联系方式, 客户地址, 客户邮箱, 是否停用, SeqNumber)
      VALUES 
      (@customerName, @contact, @phone, @address, @email, @isDisabled, @seqNumber)
      SELECT SCOPE_IDENTITY() as id
    `

    const result = await query(queryString, {
      customerName,
      contact,
      phone,
      address,
      email,
      isDisabled: status === 'inactive' ? 1 : 0,
      seqNumber
    })

    res.json({
      code: 0,
      success: true,
      data: { id: result[0].id },
      message: '新增客户信息成功'
    })
  } catch (error) {
    console.error('新增客户信息失败:', error)
    res.status(500).json({
      success: false,
      message: '新增客户信息失败',
      error: error.message
    })
  }
})

// 更新客户信息
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { customerName, contact, phone, address, email, status, seqNumber } = req.body

    const queryString = `
      UPDATE 客户信息 SET
        客户名称 = @customerName,
        联系人 = @contact,
        客户联系方式 = @phone,
        客户地址 = @address,
        客户邮箱 = @email,
        是否停用 = @isDisabled,
        SeqNumber = @seqNumber
      WHERE 客户ID = @id
    `

    await query(queryString, {
      id: parseInt(id),
      customerName,
      contact,
      phone,
      address,
      email,
      isDisabled: status === 'inactive' ? 1 : 0,
      seqNumber
    })

    res.json({
      code: 0,
      success: true,
      message: '更新客户信息成功'
    })
  } catch (error) {
    console.error('更新客户信息失败:', error)
    res.status(500).json({
      success: false,
      message: '更新客户信息失败',
      error: error.message
    })
  }
})

// 删除客户信息
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params

    const queryString = `DELETE FROM 客户信息 WHERE 客户ID = @id`

    await query(queryString, { id: parseInt(id) })

    res.json({
      code: 0,
      success: true,
      message: '删除客户信息成功'
    })
  } catch (error) {
    console.error('删除客户信息失败:', error)
    res.status(500).json({
      success: false,
      message: '删除客户信息失败',
      error: error.message
    })
  }
})

// ============================================
// 客户收货地址管理 API
// ============================================

// 确保客户收货地址表存在
const ensureDeliveryAddressTable = async () => {
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
  await query(createSql)
}

// 获取客户的收货地址列表
router.get('/:customerId/delivery-addresses', async (req, res) => {
  try {
    await ensureDeliveryAddressTable()
    const { customerId } = req.params
    const { addressUsage } = req.query

    let whereConditions = ['客户ID = @customerId', '是否启用 = 1']
    let params = { customerId: parseInt(customerId) }

    if (addressUsage) {
      whereConditions.push('地址用途 = @addressUsage')
      params.addressUsage = addressUsage
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`

    const queryString = `
      SELECT 
        收货地址ID as id,
        客户ID as customerId,
        收货方名称,
        收货方简称,
        收货地址,
        邮政编码,
        所在地区,
        所在城市,
        所在省份,
        所在国家,
        联系人,
        联系电话,
        联系手机,
        电子邮箱,
        地址用途 as addressUsage,
        CASE WHEN 是否默认 = 1 THEN 1 ELSE 0 END as isDefault,
        排序号 as sortOrder,
        CASE WHEN 是否启用 = 1 THEN 1 ELSE 0 END as isEnabled,
        备注,
        创建时间 as createdAt,
        更新时间 as updatedAt,
        创建人 as createdBy,
        更新人 as updatedBy
      FROM 客户收货地址
      ${whereClause}
      ORDER BY 是否默认 DESC, 排序号 ASC, 创建时间 ASC
    `

    const result = await query(queryString, params)

    res.json({
      code: 0,
      success: true,
      data: result
    })
  } catch (error) {
    console.error('获取客户收货地址列表失败:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: '获取客户收货地址列表失败',
      error: error.message
    })
  }
})

// 获取单个收货地址详情
router.get('/delivery-addresses/:addressId', async (req, res) => {
  try {
    await ensureDeliveryAddressTable()
    const { addressId } = req.params

    const queryString = `
      SELECT 
        收货地址ID as id,
        客户ID as customerId,
        收货方名称,
        收货方简称,
        收货地址,
        邮政编码,
        所在地区,
        所在城市,
        所在省份,
        所在国家,
        联系人,
        联系电话,
        联系手机,
        电子邮箱,
        地址用途 as addressUsage,
        CASE WHEN 是否默认 = 1 THEN 1 ELSE 0 END as isDefault,
        排序号 as sortOrder,
        CASE WHEN 是否启用 = 1 THEN 1 ELSE 0 END as isEnabled,
        备注,
        创建时间 as createdAt,
        更新时间 as updatedAt,
        创建人 as createdBy,
        更新人 as updatedBy
      FROM 客户收货地址
      WHERE 收货地址ID = @addressId
    `

    const result = await query(queryString, { addressId: parseInt(addressId) })

    if (result.length === 0) {
      return res.status(404).json({
        code: 404,
        success: false,
        message: '收货地址不存在'
      })
    }

    res.json({
      code: 0,
      success: true,
      data: result[0]
    })
  } catch (error) {
    console.error('获取收货地址详情失败:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: '获取收货地址详情失败',
      error: error.message
    })
  }
})

// 新增收货地址
router.post('/:customerId/delivery-addresses', async (req, res) => {
  try {
    await ensureDeliveryAddressTable()
    const { customerId } = req.params
    const {
      收货方名称,
      收货方简称,
      收货地址,
      邮政编码,
      所在地区,
      所在城市,
      所在省份,
      所在国家 = '中国',
      联系人,
      联系电话,
      联系手机,
      电子邮箱,
      地址用途 = 'SHIP_TO',
      是否默认 = false,
      排序号 = 0,
      备注,
      创建人
    } = req.body

    if (!收货方名称 || !收货地址) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '收货方名称和收货地址不能为空'
      })
    }

    const pool = await require('../database').getPool()
    const sql = require('mssql')
    const tx = new sql.Transaction(pool)
    await tx.begin()

    try {
      // 如果设置为默认地址，取消同客户同用途的其他默认地址
      if (是否默认) {
        const cancelDefaultReq = new sql.Request(tx)
        cancelDefaultReq.input('customerId', sql.Int, parseInt(customerId))
        cancelDefaultReq.input('addressUsage', sql.NVarChar, 地址用途)
        await cancelDefaultReq.query(`
          UPDATE 客户收货地址 
          SET 是否默认 = 0 
          WHERE 客户ID = @customerId 
            AND 地址用途 = @addressUsage 
            AND 是否默认 = 1
        `)
      }

      // 获取最大排序号
      const maxSortReq = new sql.Request(tx)
      maxSortReq.input('customerId', sql.Int, parseInt(customerId))
      const maxSortRes = await maxSortReq.query(`
        SELECT ISNULL(MAX(排序号), 0) as maxSort 
        FROM 客户收货地址 
        WHERE 客户ID = @customerId
      `)
      const finalSortOrder = 排序号 || (maxSortRes.recordset[0]?.maxSort || 0) + 1

      // 插入新地址
      const insertReq = new sql.Request(tx)
      insertReq.input('customerId', sql.Int, parseInt(customerId))
      insertReq.input('收货方名称', sql.NVarChar, 收货方名称)
      insertReq.input('收货方简称', sql.NVarChar, 收货方简称 || null)
      insertReq.input('收货地址', sql.NVarChar, 收货地址)
      insertReq.input('邮政编码', sql.NVarChar, 邮政编码 || null)
      insertReq.input('所在地区', sql.NVarChar, 所在地区 || null)
      insertReq.input('所在城市', sql.NVarChar, 所在城市 || null)
      insertReq.input('所在省份', sql.NVarChar, 所在省份 || null)
      insertReq.input('所在国家', sql.NVarChar, 所在国家 || '中国')
      insertReq.input('联系人', sql.NVarChar, 联系人 || null)
      insertReq.input('联系电话', sql.NVarChar, 联系电话 || null)
      insertReq.input('联系手机', sql.NVarChar, 联系手机 || null)
      insertReq.input('电子邮箱', sql.NVarChar, 电子邮箱 || null)
      insertReq.input('地址用途', sql.NVarChar, 地址用途 || 'SHIP_TO')
      insertReq.input('是否默认', sql.Bit, 是否默认 ? 1 : 0)
      insertReq.input('排序号', sql.Int, finalSortOrder)
      insertReq.input('备注', sql.NVarChar, 备注 || null)
      insertReq.input('创建人', sql.NVarChar, 创建人 || null)

      const insertResult = await insertReq.query(`
        INSERT INTO 客户收货地址 (
          客户ID, 收货方名称, 收货方简称, 收货地址, 邮政编码,
          所在地区, 所在城市, 所在省份, 所在国家,
          联系人, 联系电话, 联系手机, 电子邮箱,
          地址用途, 是否默认, 排序号, 备注, 创建人
        ) VALUES (
          @customerId, @收货方名称, @收货方简称, @收货地址, @邮政编码,
          @所在地区, @所在城市, @所在省份, @所在国家,
          @联系人, @联系电话, @联系手机, @电子邮箱,
          @地址用途, @是否默认, @排序号, @备注, @创建人
        )
        SELECT SCOPE_IDENTITY() as id
      `)

      await tx.commit()

      res.json({
        code: 0,
        success: true,
        data: { id: insertResult.recordset[0].id },
        message: '新增收货地址成功'
      })
    } catch (e) {
      await tx.rollback()
      throw e
    }
  } catch (error) {
    console.error('新增收货地址失败:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: '新增收货地址失败',
      error: error.message
    })
  }
})

// 更新收货地址
router.put('/delivery-addresses/:addressId', async (req, res) => {
  try {
    await ensureDeliveryAddressTable()
    const { addressId } = req.params
    const {
      收货方名称,
      收货方简称,
      收货地址,
      邮政编码,
      所在地区,
      所在城市,
      所在省份,
      所在国家,
      联系人,
      联系电话,
      联系手机,
      电子邮箱,
      地址用途,
      是否默认,
      排序号,
      备注,
      更新人
    } = req.body

    if (!收货方名称 || !收货地址) {
      return res.status(400).json({
        code: 400,
        success: false,
        message: '收货方名称和收货地址不能为空'
      })
    }

    const pool = await require('../database').getPool()
    const sql = require('mssql')
    const tx = new sql.Transaction(pool)
    await tx.begin()

    try {
      // 先查询当前地址信息
      const currentReq = new sql.Request(tx)
      currentReq.input('addressId', sql.Int, parseInt(addressId))
      const currentRes = await currentReq.query(`
        SELECT 客户ID, 地址用途, 是否默认 
        FROM 客户收货地址 
        WHERE 收货地址ID = @addressId
      `)

      if (currentRes.recordset.length === 0) {
        await tx.rollback()
        return res.status(404).json({
          code: 404,
          success: false,
          message: '收货地址不存在'
        })
      }

      const current = currentRes.recordset[0]
      const customerId = current.客户ID
      const currentAddressUsage = 地址用途 || current.地址用途

      // 如果设置为默认地址，取消同客户同用途的其他默认地址
      if (是否默认 !== undefined && 是否默认) {
        const cancelDefaultReq = new sql.Request(tx)
        cancelDefaultReq.input('customerId', sql.Int, customerId)
        cancelDefaultReq.input('addressUsage', sql.NVarChar, currentAddressUsage)
        cancelDefaultReq.input('addressId', sql.Int, parseInt(addressId))
        await cancelDefaultReq.query(`
          UPDATE 客户收货地址 
          SET 是否默认 = 0 
          WHERE 客户ID = @customerId 
            AND 地址用途 = @addressUsage 
            AND 是否默认 = 1
            AND 收货地址ID != @addressId
        `)
      }

      // 更新地址
      const updateReq = new sql.Request(tx)
      updateReq.input('addressId', sql.Int, parseInt(addressId))
      updateReq.input('收货方名称', sql.NVarChar, 收货方名称)
      updateReq.input('收货方简称', sql.NVarChar, 收货方简称 || null)
      updateReq.input('收货地址', sql.NVarChar, 收货地址)
      updateReq.input('邮政编码', sql.NVarChar, 邮政编码 || null)
      updateReq.input('所在地区', sql.NVarChar, 所在地区 || null)
      updateReq.input('所在城市', sql.NVarChar, 所在城市 || null)
      updateReq.input('所在省份', sql.NVarChar, 所在省份 || null)
      if (所在国家 !== undefined) {
        updateReq.input('所在国家', sql.NVarChar, 所在国家 || '中国')
      }
      updateReq.input('联系人', sql.NVarChar, 联系人 || null)
      updateReq.input('联系电话', sql.NVarChar, 联系电话 || null)
      updateReq.input('联系手机', sql.NVarChar, 联系手机 || null)
      updateReq.input('电子邮箱', sql.NVarChar, 电子邮箱 || null)
      if (地址用途 !== undefined) {
        updateReq.input('地址用途', sql.NVarChar, 地址用途)
      }
      if (是否默认 !== undefined) {
        updateReq.input('是否默认', sql.Bit, 是否默认 ? 1 : 0)
      }
      if (排序号 !== undefined) {
        updateReq.input('排序号', sql.Int, 排序号)
      }
      updateReq.input('备注', sql.NVarChar, 备注 || null)
      updateReq.input('更新人', sql.NVarChar, 更新人 || null)

      const updateFields = [
        '收货方名称 = @收货方名称',
        '收货方简称 = @收货方简称',
        '收货地址 = @收货地址',
        '邮政编码 = @邮政编码',
        '所在地区 = @所在地区',
        '所在城市 = @所在城市',
        '联系人 = @联系人',
        '联系电话 = @联系电话',
        '联系手机 = @联系手机',
        '电子邮箱 = @电子邮箱',
        '备注 = @备注',
        '更新人 = @更新人',
        '更新时间 = SYSUTCDATETIME()'
      ]

      if (所在省份 !== undefined) {
        updateFields.push('所在省份 = @所在省份')
      }
      if (所在国家 !== undefined) {
        updateFields.push('所在国家 = @所在国家')
      }
      if (地址用途 !== undefined) {
        updateFields.push('地址用途 = @地址用途')
      }
      if (是否默认 !== undefined) {
        updateFields.push('是否默认 = @是否默认')
      }
      if (排序号 !== undefined) {
        updateFields.push('排序号 = @排序号')
      }

      await updateReq.query(`
        UPDATE 客户收货地址 
        SET ${updateFields.join(', ')}
        WHERE 收货地址ID = @addressId
      `)

      await tx.commit()

      res.json({
        code: 0,
        success: true,
        message: '更新收货地址成功'
      })
    } catch (e) {
      await tx.rollback()
      throw e
    }
  } catch (error) {
    console.error('更新收货地址失败:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: '更新收货地址失败',
      error: error.message
    })
  }
})

// 删除收货地址（软删除：标记为已停用）
router.delete('/delivery-addresses/:addressId', async (req, res) => {
  try {
    await ensureDeliveryAddressTable()
    const { addressId } = req.params

    // 检查是否被出库单使用
    const checkUsageQuery = `
      SELECT COUNT(*) as usageCount 
      FROM 出库单明细 
      WHERE 收货地址ID = @addressId
    `
    const usageResult = await query(checkUsageQuery, { addressId: parseInt(addressId) })
    const usageCount = usageResult[0]?.usageCount || 0

    if (usageCount > 0) {
      // 如果被使用，软删除（标记为已停用）
      const softDeleteQuery = `
        UPDATE 客户收货地址 
        SET 是否启用 = 0, 更新时间 = SYSUTCDATETIME()
        WHERE 收货地址ID = @addressId
      `
      await query(softDeleteQuery, { addressId: parseInt(addressId) })

      res.json({
        code: 0,
        success: true,
        message: `收货地址已被 ${usageCount} 个出库单使用，已标记为停用`,
        data: { usageCount }
      })
    } else {
      // 如果未被使用，物理删除
      const deleteQuery = `DELETE FROM 客户收货地址 WHERE 收货地址ID = @addressId`
      await query(deleteQuery, { addressId: parseInt(addressId) })

      res.json({
        code: 0,
        success: true,
        message: '删除收货地址成功'
      })
    }
  } catch (error) {
    console.error('删除收货地址失败:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: '删除收货地址失败',
      error: error.message
    })
  }
})

// 设置默认收货地址
router.put('/delivery-addresses/:addressId/set-default', async (req, res) => {
  try {
    await ensureDeliveryAddressTable()
    const { addressId } = req.params

    const pool = await require('../database').getPool()
    const sql = require('mssql')
    const tx = new sql.Transaction(pool)
    await tx.begin()

    try {
      // 查询当前地址信息
      const currentReq = new sql.Request(tx)
      currentReq.input('addressId', sql.Int, parseInt(addressId))
      const currentRes = await currentReq.query(`
        SELECT 客户ID, 地址用途 
        FROM 客户收货地址 
        WHERE 收货地址ID = @addressId AND 是否启用 = 1
      `)

      if (currentRes.recordset.length === 0) {
        await tx.rollback()
        return res.status(404).json({
          code: 404,
          success: false,
          message: '收货地址不存在或已停用'
        })
      }

      const current = currentRes.recordset[0]
      const customerId = current.客户ID
      const addressUsage = current.地址用途

      // 取消同客户同用途的其他默认地址
      const cancelDefaultReq = new sql.Request(tx)
      cancelDefaultReq.input('customerId', sql.Int, customerId)
      cancelDefaultReq.input('addressUsage', sql.NVarChar, addressUsage)
      cancelDefaultReq.input('addressId', sql.Int, parseInt(addressId))
      await cancelDefaultReq.query(`
        UPDATE 客户收货地址 
        SET 是否默认 = 0 
        WHERE 客户ID = @customerId 
          AND 地址用途 = @addressUsage 
          AND 收货地址ID != @addressId
      `)

      // 设置当前地址为默认
      const setDefaultReq = new sql.Request(tx)
      setDefaultReq.input('addressId', sql.Int, parseInt(addressId))
      await setDefaultReq.query(`
        UPDATE 客户收货地址 
        SET 是否默认 = 1, 更新时间 = SYSUTCDATETIME()
        WHERE 收货地址ID = @addressId
      `)

      await tx.commit()

      res.json({
        code: 0,
        success: true,
        message: '设置默认地址成功'
      })
    } catch (e) {
      await tx.rollback()
      throw e
    }
  } catch (error) {
    console.error('设置默认地址失败:', error)
    res.status(500).json({
      code: 500,
      success: false,
      message: '设置默认地址失败',
      error: error.message
    })
  }
})

module.exports = router
