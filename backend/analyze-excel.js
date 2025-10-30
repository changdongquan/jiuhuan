const XLSX = require('xlsx')
const { query } = require('./database')
const fs = require('fs')
const path = require('path')

// 读取 Excel 文件并分析
async function analyzeExcel(filePath) {
  try {
    console.log('正在读取 Excel 文件:', filePath)

    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      console.error('文件不存在:', filePath)
      return
    }

    // 读取 Excel 文件
    const workbook = XLSX.readFile(filePath)
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]

    console.log('工作表名称:', sheetName)

    // 转换为 JSON 数组
    const data = XLSX.utils.sheet_to_json(worksheet, { raw: false })

    console.log('\n=== Excel 数据分析 ===')
    console.log('总行数:', data.length)
    console.log('\n列名:', Object.keys(data[0] || {}))

    // 验证数据格式
    const validData = []
    const errors = []

    data.forEach((row, index) => {
      const rowNum = index + 2 // Excel 行号（第1行是表头）

      // 验证必需字段：项目编号
      const projectCode = row['项目编号'] || row['projectCode']
      if (!projectCode) {
        errors.push({
          row: rowNum,
          message: '项目编号不能为空'
        })
        return
      }

      // 统一字段名（将可能的英文列名转为中文）
      const projectData = {}

      // 定义所有有效的数据库字段（根据 ProjectInfo 接口）
      const validFields = [
        '项目编号',
        '项目名称',
        '客户模号',
        '产品材质',
        '模具穴数',
        '项目状态',
        '设计师',
        '中标日期',
        '产品3D确认',
        '图纸下发时间',
        '计划首样日期',
        '首次送样日期',
        '移模日期',
        '制件厂家',
        '进度影响原因',
        '前模材质',
        '后模材质',
        '模具尺寸',
        '产品尺寸',
        '产品重量',
        '收缩率',
        '产品颜色',
        '模具重量',
        '流道类型',
        '机台吨位',
        '备注',
        '滑块材质',
        '锁模力',
        '定位圈',
        '容模量',
        '拉杆间距',
        '成型周期',
        '封样时间',
        '浇口类型',
        '浇口数量',
        '料柄重量',
        '流道数量',
        '费用出处'
      ]

      // 字段映射
      const fieldMap = {
        projectCode: '项目编号',
        projectName: '项目名称',
        productName: '产品名称',
        productDrawing: '产品图号',
        customerMold: '客户模号',
        productMaterial: '产品材质',
        moldCavity: '模具穴数',
        projectStatus: '项目状态',
        designer: '设计师',
        bidDate: '中标日期',
        product3D: '产品3D确认',
        drawingIssue: '图纸下发时间',
        plannedSample: '计划首样日期',
        firstSample: '首次送样日期',
        moldTransfer: '移模日期',
        manufacturer: '制件厂家',
        impactReason: '进度影响原因',
        frontMold: '前模材质',
        backMold: '后模材质',
        moldSize: '模具尺寸',
        productSize: '产品尺寸',
        productWeight: '产品重量',
        shrinkage: '收缩率',
        productColor: '产品颜色',
        moldWeight: '模具重量',
        runnerType: '流道类型',
        machineTon: '机台吨位',
        remarks: '备注',
        slideMaterial: '滑块材质',
        clampingForce: '锁模力',
        positionRing: '定位圈',
        moldCapacity: '容模量',
        tieBarDistance: '拉杆间距',
        cycleTime: '成型周期',
        runnerCount: '流道数量',
        gateType: '浇口类型',
        gateCount: '浇口数量',
        sprueWeight: '料柄重量',
        costSource: '费用出处',
        sampleTime: '封样时间'
      }

      Object.keys(row).forEach((key) => {
        const chineseField = fieldMap[key] || key

        // 只保留有效的数据库字段
        if (validFields.includes(chineseField)) {
          projectData[chineseField] = row[key]
        }
      })

      validData.push(projectData)
    })

    console.log('\n有效数据:', validData.length, '条')
    console.log('错误数据:', errors.length, '条')

    if (errors.length > 0) {
      console.log('\n错误详情:')
      errors.forEach((err) => {
        console.log(`  第 ${err.row} 行: ${err.message}`)
      })
    }

    // 显示前 5 条数据样例
    console.log('\n前 5 条数据样例:')
    validData.slice(0, 5).forEach((item, idx) => {
      console.log(`\n  ${idx + 1}. 项目编号: ${item.项目编号}`)
      console.log(`     项目名称: ${item.项目名称 || '-'}`)
      console.log(`     产品名称: ${item.产品名称 || '-'}`)
      console.log(`     项目状态: ${item.项目状态 || '-'}`)
    })

    return {
      validData,
      errors,
      total: validData.length,
      errorCount: errors.length
    }
  } catch (error) {
    console.error('分析 Excel 失败:', error)
    throw error
  }
}

// 导入数据到数据库
async function importToDatabase(data) {
  try {
    console.log('\n\n=== 开始导入数据到数据库 ===')

    const results = {
      success: [],
      failed: [],
      skipped: []
    }

    for (const item of data) {
      try {
        // 检查项目编号是否存在
        const checkQuery = `SELECT COUNT(*) as count FROM 项目管理 WHERE 项目编号 = @项目编号`
        const checkResult = await query(checkQuery, { 项目编号: item.项目编号 })

        if (checkResult[0].count > 0) {
          // 如果存在，则更新
          const updateFields = []
          const params = { 项目编号: item.项目编号 }

          Object.keys(item).forEach((key) => {
            if (
              key !== '项目编号' &&
              key !== 'SSMA_TimeStamp' &&
              item[key] !== undefined &&
              item[key] !== null &&
              item[key] !== ''
            ) {
              updateFields.push(`[${key}] = @${key}`)
              params[key] = item[key]
            }
          })

          if (updateFields.length > 0) {
            const updateQuery = `UPDATE 项目管理 SET ${updateFields.join(', ')} WHERE 项目编号 = @项目编号`
            await query(updateQuery, params)
            results.success.push({ 项目编号: item.项目编号, action: '更新' })
            console.log(`✓ 更新: ${item.项目编号}`)
          } else {
            results.skipped.push({ 项目编号: item.项目编号, reason: '无更新字段' })
            console.log(`○ 跳过: ${item.项目编号} (无更新字段)`)
          }
        } else {
          // 如果不存在，则插入
          const fields = []
          const values = []
          const params = {}

          Object.keys(item).forEach((key) => {
            if (
              key !== 'SSMA_TimeStamp' &&
              item[key] !== undefined &&
              item[key] !== null &&
              item[key] !== ''
            ) {
              fields.push(`[${key}]`)
              values.push(`@${key}`)
              params[key] = item[key]
            }
          })

          if (fields.length > 0) {
            const insertQuery = `INSERT INTO 项目管理 (${fields.join(', ')}) VALUES (${values.join(', ')})`
            await query(insertQuery, params)
            results.success.push({ 项目编号: item.项目编号, action: '新增' })
            console.log(`✓ 新增: ${item.项目编号}`)
          } else {
            results.skipped.push({ 项目编号: item.项目编号, reason: '无有效字段' })
            console.log(`○ 跳过: ${item.项目编号} (无有效字段)`)
          }
        }
      } catch (error) {
        results.failed.push({
          项目编号: item.项目编号,
          error: error.message
        })
        console.log(`✗ 失败: ${item.项目编号} - ${error.message}`)
      }
    }

    console.log('\n=== 导入完成 ===')
    console.log(`总计: ${data.length} 条`)
    console.log(`成功: ${results.success.length} 条`)
    console.log(`失败: ${results.failed.length} 条`)
    console.log(`跳过: ${results.skipped.length} 条`)

    if (results.failed.length > 0) {
      console.log('\n失败详情:')
      results.failed.forEach((item) => {
        console.log(`  ${item.项目编号}: ${item.error}`)
      })
    }

    return results
  } catch (error) {
    console.error('导入失败:', error)
    throw error
  }
}

// 主函数
async function main() {
  try {
    // 从命令行参数获取文件路径
    const filePath = process.argv[2]

    if (!filePath) {
      console.log('用法: node analyze-excel.js <Excel文件路径>')
      console.log('示例: node analyze-excel.js ../project-data.xlsx')
      process.exit(1)
    }

    // 分析 Excel
    const result = await analyzeExcel(filePath)

    if (!result) {
      return
    }

    // 如果有效数据为 0，退出
    if (result.total === 0) {
      console.log('\n没有有效数据可导入')
      return
    }

    // 如果有错误，询问是否继续
    if (result.errorCount > 0) {
      console.log('\n⚠️  注意：检测到错误数据，将跳过这些行')
    }

    console.log('\n准备导入', result.total, '条数据')
    console.log('提示：这只是预览分析，实际导入需要确认')
  } catch (error) {
    console.error('执行失败:', error)
    process.exit(1)
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main()
}

module.exports = { analyzeExcel, importToDatabase }
