/**
 * 优化占位符名称的工具
 * 根据提取的文本内容，生成更有意义的占位符名称
 */

const fs = require('fs')
const fsp = require('fs').promises
const path = require('path')

/**
 * 根据文本内容推断占位符名称
 */
function inferPlaceholderName(text, index) {
  const textLower = text.toLowerCase().trim()

  // 常见字段模式识别
  const patterns = [
    // 产品相关
    { pattern: /^[A-Z]\d+\.\d+\.\d+\.\d+\/\d+\.\d+$/i, name: 'product_drawing' }, // 产品图号格式
    { pattern: /^[A-Z]{2}\d+$/i, name: 'mould_no' }, // 模具编号格式 ML01230272
    { pattern: /^[\u4e00-\u9fa5]{2,10}$/, name: 'product_name' }, // 中文产品名

    // 日期相关
    { pattern: /^\d{4}$/, name: 'year' }, // 年份
    { pattern: /^\d{1,2}$/, name: 'day' }, // 日期中的日

    // 客户相关
    { pattern: /^[\u4e00-\u9fa5]{2,4}$/, name: 'customer_name' } // 短中文可能是客户名
  ]

  // 尝试匹配模式
  for (const { pattern, name } of patterns) {
    if (pattern.test(text)) {
      return name
    }
  }

  // 如果包含特定关键词
  if (text.includes('盖') || text.includes('件') || text.includes('品')) {
    return 'product_name'
  }

  if (text.includes('模')) {
    return 'mould_no'
  }

  // 默认生成
  return generatePlaceholderName(text, index)
}

function generatePlaceholderName(text, index) {
  let name = text
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')

  if (!name) {
    name = `field_${index + 1}`
  }

  if (name.length > 50) {
    name = name.substring(0, 50)
  }

  return name
}

async function main() {
  const args = process.argv.slice(2)

  if (args.length < 1) {
    console.error('使用方法: node optimize-placeholder-names.js <数据映射JSON文件路径>')
    process.exit(1)
  }

  const mapFilePath = path.resolve(args[0])

  if (!fs.existsSync(mapFilePath)) {
    console.error(`错误: 文件不存在: ${mapFilePath}`)
    process.exit(1)
  }

  const dataMap = JSON.parse(await fsp.readFile(mapFilePath, 'utf-8'))

  console.log('\n优化占位符名称...\n')
  console.log('='.repeat(80))

  const optimizedMap = {}
  const entries = Object.entries(dataMap)

  entries.forEach(([oldKey, value], index) => {
    const newKey = inferPlaceholderName(value, index)

    // 如果新键已存在，添加后缀
    let finalKey = newKey
    let suffix = 1
    while (optimizedMap[finalKey] !== undefined) {
      finalKey = `${newKey}_${suffix}`
      suffix++
    }

    optimizedMap[finalKey] = value

    if (oldKey !== finalKey) {
      console.log(`"${value}"`)
      console.log(`  旧占位符: {{${oldKey}}}`)
      console.log(`  新占位符: {{${finalKey}}}`)
      console.log('')
    } else {
      console.log(`"${value}" -> {{${finalKey}}} (保持不变)`)
      console.log('')
    }
  })

  console.log('='.repeat(80))

  // 保存优化后的映射
  const outputPath = mapFilePath.replace('.json', '_optimized.json')
  await fsp.writeFile(outputPath, JSON.stringify(optimizedMap, null, 2), 'utf-8')

  console.log(`\n✅ 优化后的数据映射已保存到: ${outputPath}`)
  console.log('\n优化后的占位符：')
  Object.entries(optimizedMap).forEach(([key, value]) => {
    console.log(`  {{${key}}}: "${value}"`)
  })
}

main()
