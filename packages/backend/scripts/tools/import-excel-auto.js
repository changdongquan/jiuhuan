const { analyzeExcel, importToDatabase } = require('./analyze-excel')

async function main() {
  try {
    const filePath = process.argv[2]

    if (!filePath) {
      console.log('用法: node import-excel-auto.js <Excel文件路径>')
      process.exit(1)
    }

    // 分析 Excel
    console.log('正在分析 Excel 文件...\n')
    const result = await analyzeExcel(filePath)

    if (!result || result.total === 0) {
      console.log('\n没有有效数据可导入')
      return
    }

    // 直接导入
    console.log('\n开始导入数据...\n')
    await importToDatabase(result.validData)
    console.log('\n✓ 导入完成！')
  } catch (error) {
    console.error('执行失败:', error)
    process.exit(1)
  }
}

main()
