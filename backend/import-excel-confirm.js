const { analyzeExcel, importToDatabase } = require('./analyze-excel')
const readline = require('readline')

// 创建 readline 接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

// 询问确认
function askConfirm(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.toLowerCase())
    })
  })
}

// 主函数
async function main() {
  try {
    const filePath = process.argv[2]
    
    if (!filePath) {
      console.log('用法: node import-excel-confirm.js <Excel文件路径>')
      process.exit(1)
    }
    
    // 分析 Excel
    console.log('正在分析 Excel 文件...\n')
    const result = await analyzeExcel(filePath)
    
    if (!result || result.total === 0) {
      console.log('\n没有有效数据可导入')
      rl.close()
      return
    }
    
    // 询问是否导入
    console.log('\n' + '='.repeat(50))
    const answer = await askConfirm(`\n确认导入 ${result.total} 条数据到数据库？(yes/no): `)
    
    if (answer === 'yes' || answer === 'y') {
      console.log('\n开始导入...')
      await importToDatabase(result.validData)
      console.log('\n✓ 导入完成！')
    } else {
      console.log('\n取消导入')
    }
    
    rl.close()
  } catch (error) {
    console.error('执行失败:', error)
    rl.close()
    process.exit(1)
  }
}

main()

