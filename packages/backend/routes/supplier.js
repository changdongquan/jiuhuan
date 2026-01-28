const express = require('express')
const sql = require('mssql')
const config = require('../config')

const router = express.Router()

// 获取供方信息列表
router.get('/list', async (req, res) => {
  let pool = null
  try {
    pool = await sql.connect(config)
    
    const { page = 1, size = 10, supplierName = '', category = '', status = '' } = req.query
    
    // 构建查询条件
    let whereConditions = []
    let params = {}
    
    if (supplierName) {
      whereConditions.push('供方名称 LIKE @supplierName')
      params.supplierName = `%${supplierName}%`
    }
    
    if (category) {
      whereConditions.push('分类 = @category')
      params.category = category
    }
    
    if (status) {
      whereConditions.push('供方状态 = @status')
      params.status = status
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''
    
    // 查询总数
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM 供方信息 
      ${whereClause}
    `
    const countRequest = pool.request()
    Object.keys(params).forEach(key => {
      countRequest.input(key, params[key])
    })
    const countResult = await countRequest.query(countQuery)
    const total = countResult.recordset[0].total
    
    // 查询数据
    const dataQuery = `
      SELECT 
        供方ID,
        供方名称,
        供方等级,
        分类,
        供方状态,
        联系人,
        联系电话,
        电子邮箱,
        所在地区,
        详细地址,
        备注信息,
        纳税人识别号,
        开户银行,
        银行账号,
        银行行号,
        创建时间,
        更新时间,
        创建人,
        更新人,
        是否删除
      FROM 供方信息 
      ${whereClause}
      ORDER BY 创建时间 DESC
      OFFSET @offset ROWS
      FETCH NEXT @size ROWS ONLY
    `
    
    const dataRequest = pool.request()
    Object.keys(params).forEach(key => {
      dataRequest.input(key, params[key])
    })
    dataRequest.input('offset', sql.Int, (page - 1) * size)
    dataRequest.input('size', sql.Int, parseInt(size))
    
    const dataResult = await dataRequest.query(dataQuery)
    
    res.json({
      code: 200,
      message: '查询成功',
      data: {
        list: dataResult.recordset,
        total: total,
        page: parseInt(page),
        size: parseInt(size)
      }
    })
    
  } catch (error) {
    console.error('查询供方信息失败:', error)
    res.status(500).json({
      code: 500,
      message: '查询失败',
      error: error.message
    })
  } finally {
    if (pool) {
      await pool.close()
    }
  }
})

// 获取供方信息详情
router.get('/detail/:id', async (req, res) => {
  let pool = null
  try {
    pool = await sql.connect(config)
    const { id } = req.params
    
    const query = `
      SELECT 
        供方ID,
        供方名称,
        供方等级,
        分类,
        供方状态,
        联系人,
        联系电话,
        电子邮箱,
        所在地区,
        详细地址,
        备注信息,
        纳税人识别号,
        开户银行,
        银行账号,
        银行行号,
        创建时间,
        更新时间,
        创建人,
        更新人,
        是否删除
      FROM 供方信息 
      WHERE 供方ID = @id AND 是否删除 = 0
    `
    
    const request = pool.request()
    request.input('id', sql.BigInt, id)
    const result = await request.query(query)
    
    if (result.recordset.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '供方信息不存在'
      })
    }
    
    res.json({
      code: 200,
      message: '查询成功',
      data: result.recordset[0]
    })
    
  } catch (error) {
    console.error('查询供方信息详情失败:', error)
    res.status(500).json({
      code: 500,
      message: '查询失败',
      error: error.message
    })
  } finally {
    if (pool) {
      await pool.close()
    }
  }
})

// 新增供方信息
router.post('/create', async (req, res) => {
  let pool = null
  try {
    pool = await sql.connect(config)
    
    const {
      供方名称,
      供方等级,
      分类,
      供方状态,
      联系人,
      联系电话,
      电子邮箱,
      所在地区,
      详细地址,
      备注信息,
      纳税人识别号,
      开户银行,
      银行账号,
      银行行号,
      创建人 = 'system'
    } = req.body
    
    // 验证必填字段
    if (!供方名称 || !分类 || !联系人 || !联系电话) {
      return res.status(400).json({
        code: 400,
        message: '必填字段不能为空'
      })
    }
    
    const query = `
      INSERT INTO 供方信息 (
        供方名称, 供方等级, 分类, 供方状态,
        联系人, 联系电话, 电子邮箱, 所在地区, 详细地址,
        备注信息, 纳税人识别号, 开户银行, 银行账号, 银行行号,
        创建人
      ) VALUES (
        @供方名称, @供方等级, @分类, @供方状态,
        @联系人, @联系电话, @电子邮箱, @所在地区, @详细地址,
        @备注信息, @纳税人识别号, @开户银行, @银行账号, @银行行号,
        @创建人
      )
    `
    
    const request = pool.request()
    request.input('供方名称', sql.VarChar, 供方名称)
    request.input('供方等级', sql.VarChar, 供方等级 || 'A')
    request.input('分类', sql.VarChar, 分类)
    request.input('供方状态', sql.VarChar, 供方状态 || 'active')
    request.input('联系人', sql.VarChar, 联系人)
    request.input('联系电话', sql.VarChar, 联系电话)
    request.input('电子邮箱', sql.VarChar, 电子邮箱 || null)
    request.input('所在地区', sql.VarChar, 所在地区 || null)
    request.input('详细地址', sql.VarChar, 详细地址 || null)
    request.input('备注信息', sql.Text, 备注信息 || null)
    request.input('纳税人识别号', sql.VarChar, 纳税人识别号 || null)
    request.input('开户银行', sql.VarChar, 开户银行 || null)
    request.input('银行账号', sql.VarChar, 银行账号 || null)
    request.input('银行行号', sql.VarChar, 银行行号 || null)
    request.input('创建人', sql.VarChar, 创建人)
    
    await request.query(query)
    
    res.json({
      code: 200,
      message: '新增成功'
    })
    
  } catch (error) {
    console.error('新增供方信息失败:', error)
    res.status(500).json({
      code: 500,
      message: '新增失败',
      error: error.message
    })
  } finally {
    if (pool) {
      await pool.close()
    }
  }
})

// 更新供方信息
router.put('/update/:id', async (req, res) => {
  let pool = null
  try {
    pool = await sql.connect(config)
    const { id } = req.params
    
    const {
      供方名称,
      供方等级,
      分类,
      供方状态,
      联系人,
      联系电话,
      电子邮箱,
      所在地区,
      详细地址,
      备注信息,
      纳税人识别号,
      开户银行,
      银行账号,
      银行行号,
      更新人 = 'system'
    } = req.body
    
    // 验证必填字段
    if (!供方名称 || !分类 || !联系人 || !联系电话) {
      return res.status(400).json({
        code: 400,
        message: '必填字段不能为空'
      })
    }
    
    // 检查记录是否存在
    const checkQuery = `SELECT 供方ID FROM 供方信息 WHERE 供方ID = @id AND 是否删除 = 0`
    const checkRequest = pool.request()
    checkRequest.input('id', sql.BigInt, id)
    const checkResult = await checkRequest.query(checkQuery)
    
    if (checkResult.recordset.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '供方信息不存在'
      })
    }
    
    const updateQuery = `
      UPDATE 供方信息 SET
        供方名称 = @供方名称,
        供方等级 = @供方等级,
        分类 = @分类,
        供方状态 = @供方状态,
        联系人 = @联系人,
        联系电话 = @联系电话,
        电子邮箱 = @电子邮箱,
        所在地区 = @所在地区,
        详细地址 = @详细地址,
        备注信息 = @备注信息,
        纳税人识别号 = @纳税人识别号,
        开户银行 = @开户银行,
        银行账号 = @银行账号,
        银行行号 = @银行行号,
        更新时间 = GETDATE(),
        更新人 = @更新人
      WHERE 供方ID = @id
    `
    
    const request = pool.request()
    request.input('id', sql.BigInt, id)
    request.input('供方名称', sql.VarChar, 供方名称)
    request.input('供方等级', sql.VarChar, 供方等级)
    request.input('分类', sql.VarChar, 分类)
    request.input('供方状态', sql.VarChar, 供方状态)
    request.input('联系人', sql.VarChar, 联系人)
    request.input('联系电话', sql.VarChar, 联系电话)
    request.input('电子邮箱', sql.VarChar, 电子邮箱 || null)
    request.input('所在地区', sql.VarChar, 所在地区 || null)
    request.input('详细地址', sql.VarChar, 详细地址 || null)
    request.input('备注信息', sql.Text, 备注信息 || null)
    request.input('纳税人识别号', sql.VarChar, 纳税人识别号 || null)
    request.input('开户银行', sql.VarChar, 开户银行 || null)
    request.input('银行账号', sql.VarChar, 银行账号 || null)
    request.input('银行行号', sql.VarChar, 银行行号 || null)
    request.input('更新人', sql.VarChar, 更新人)
    
    await request.query(updateQuery)
    
    res.json({
      code: 200,
      message: '更新成功'
    })
    
  } catch (error) {
    console.error('更新供方信息失败:', error)
    res.status(500).json({
      code: 500,
      message: '更新失败',
      error: error.message
    })
  } finally {
    if (pool) {
      await pool.close()
    }
  }
})

// 删除供方信息（软删除）
router.delete('/delete/:id', async (req, res) => {
  let pool = null
  try {
    pool = await sql.connect(config)
    const { id } = req.params
    
    // 检查记录是否存在
    const checkQuery = `SELECT 供方ID FROM 供方信息 WHERE 供方ID = @id AND 是否删除 = 0`
    const checkRequest = pool.request()
    checkRequest.input('id', sql.BigInt, id)
    const checkResult = await checkRequest.query(checkQuery)
    
    if (checkResult.recordset.length === 0) {
      return res.status(404).json({
        code: 404,
        message: '供方信息不存在'
      })
    }
    
    const deleteQuery = `
      UPDATE 供方信息 SET
        是否删除 = 1,
        更新时间 = GETDATE(),
        更新人 = @更新人
      WHERE 供方ID = @id
    `
    
    const request = pool.request()
    request.input('id', sql.BigInt, id)
    request.input('更新人', sql.VarChar, 'system')
    
    await request.query(deleteQuery)
    
    res.json({
      code: 200,
      message: '删除成功'
    })
    
  } catch (error) {
    console.error('删除供方信息失败:', error)
    res.status(500).json({
      code: 500,
      message: '删除失败',
      error: error.message
    })
  } finally {
    if (pool) {
      await pool.close()
    }
  }
})

// 获取统计信息
router.get('/statistics', async (req, res) => {
  let pool = null
  try {
    pool = await sql.connect(config)
    
    const query = `
      SELECT 
        COUNT(*) as totalSuppliers,
        SUM(CASE WHEN 供方状态 = 'active' THEN 1 ELSE 0 END) as activeSuppliers,
        SUM(CASE WHEN 分类 = '原料' THEN 1 ELSE 0 END) as materialSuppliers,
        SUM(CASE WHEN 分类 = '配件' THEN 1 ELSE 0 END) as partsSuppliers,
        SUM(CASE WHEN 分类 = '设备' THEN 1 ELSE 0 END) as equipmentSuppliers,
        SUM(CASE WHEN 分类 = '外协' THEN 1 ELSE 0 END) as outsourcingSuppliers,
        SUM(CASE WHEN 分类 = '服务' THEN 1 ELSE 0 END) as serviceSuppliers
      FROM 供方信息 
      WHERE 是否删除 = 0
    `
    
    const result = await pool.request().query(query)
    
    res.json({
      code: 200,
      message: '查询成功',
      data: result.recordset[0]
    })
    
  } catch (error) {
    console.error('查询统计信息失败:', error)
    res.status(500).json({
      code: 500,
      message: '查询失败',
      error: error.message
    })
  } finally {
    if (pool) {
      await pool.close()
    }
  }
})

module.exports = router
