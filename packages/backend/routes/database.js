const express = require('express')
const { query } = require('../database')
const router = express.Router()

// 获取数据库所有表信息
router.get('/tables', async (req, res) => {
  try {
    const queryString = `
      SELECT 
        TABLE_NAME as tableName,
        TABLE_TYPE as tableType
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `
    
    const tables = await query(queryString)
    
    res.json({
      code: 0,
      success: true,
      data: tables
    })
  } catch (error) {
    console.error('获取表信息失败:', error)
    res.status(500).json({
      success: false,
      message: '获取表信息失败',
      error: error.message
    })
  }
})

// 获取指定表的结构信息
router.get('/table/:tableName', async (req, res) => {
  try {
    const { tableName } = req.params
    
    const queryString = `
      SELECT 
        COLUMN_NAME as columnName,
        DATA_TYPE as dataType,
        CHARACTER_MAXIMUM_LENGTH as maxLength,
        IS_NULLABLE as isNullable,
        COLUMN_DEFAULT as defaultValue,
        COLUMNPROPERTY(OBJECT_ID(@tableName), COLUMN_NAME, 'IsIdentity') as isIdentity
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = @tableName
      ORDER BY ORDINAL_POSITION
    `
    
    const columns = await query(queryString, { tableName })
    
    res.json({
      code: 0,
      success: true,
      data: {
        tableName,
        columns
      }
    })
  } catch (error) {
    console.error('获取表结构失败:', error)
    res.status(500).json({
      success: false,
      message: '获取表结构失败',
      error: error.message
    })
  }
})

// 获取数据库统计信息
router.get('/statistics', async (req, res) => {
  try {
    const queryString = `
      SELECT 
        COUNT(*) as tableCount
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE'
    `
    
    const result = await query(queryString)
    
    res.json({
      code: 0,
      success: true,
      data: {
        tableCount: result[0].tableCount
      }
    })
  } catch (error) {
    console.error('获取统计信息失败:', error)
    res.status(500).json({
      success: false,
      message: '获取统计信息失败',
      error: error.message
    })
  }
})

module.exports = router
