/**
 * 显示占位符映射关系
 */

const fs = require('fs')
const path = require('path')

const args = process.argv.slice(2)
const mapFilePath = args[0] || '/Users/changun/Documents/word-template-data-map_optimized.json'

if (!fs.existsSync(mapFilePath)) {
  console.error(`错误: 文件不存在: ${mapFilePath}`)
  process.exit(1)
}

const dataMap = JSON.parse(fs.readFileSync(mapFilePath, 'utf-8'))

console.log('\n' + '='.repeat(100))
console.log('占位符映射关系表')
console.log('='.repeat(100))
console.log('')

const entries = Object.entries(dataMap)

entries.forEach(([placeholder, actualValue], index) => {
  console.log(`${index + 1}. 占位符: {{${placeholder}}}`)
  console.log(`   实际内容: "${actualValue}"`)
  console.log(`   内容长度: ${String(actualValue).length} 字符`)
  console.log('')
})

console.log('='.repeat(100))
console.log(`\n总计: ${entries.length} 个占位符`)
console.log('\n请确认：')
console.log('  1. 每个占位符对应的实际内容是否正确？')
console.log('  2. 占位符名称是否符合你的命名规范？')
console.log('  3. 是否有遗漏的红色文本？')
console.log('  4. 是否有不需要替换的内容？')
console.log('\n如需修改，请编辑 JSON 文件后重新运行模板生成脚本。')
