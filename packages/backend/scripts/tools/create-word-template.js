/**
 * Word 文档模板生成工具
 *
 * 功能：将已填充的 Word 文档中的实际内容替换成占位符
 *
 * 使用方法：
 * node create-word-template.js <已填充文档路径> <输出模板路径> <数据映射JSON文件路径>
 *
 * 数据映射JSON格式示例：
 * {
 *   "mould_no": "JH01-001",
 *   "part_name": "产品名称示例",
 *   "customer_name": "客户名称示例"
 * }
 *
 * 或者直接在代码中修改 dataMap 对象
 */

const path = require('path')
const fs = require('fs')
const fsp = fs.promises
const JSZip = require('jszip')

// 从命令行参数获取文件路径
const args = process.argv.slice(2)

if (args.length < 2) {
  console.error(
    '使用方法: node create-word-template.js <已填充文档路径> <输出模板路径> [数据映射JSON文件路径]'
  )
  console.error('')
  console.error('示例:')
  console.error('  node create-word-template.js filled.docx template.docx data-map.json')
  console.error('')
  console.error('或者直接在代码中修改 dataMap 对象')
  process.exit(1)
}

const filledDocPath = path.resolve(args[0])
const outputTemplatePath = path.resolve(args[1])
const dataMapPath = args[2] ? path.resolve(args[2]) : null

/**
 * 转义 XML 特殊字符
 */
function escapeXml(text) {
  if (typeof text !== 'string') return ''
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * 反转义 XML 特殊字符
 */
function unescapeXml(text) {
  if (typeof text !== 'string') return ''
  return text
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
}

/**
 * 将已填充的内容替换成占位符（安全版本，只替换 <w:t> 标签内的文本）
 * 参考三方协议的实现方式，但只替换文本节点内的内容
 *
 * @param {string} docXml - Word 文档的 XML 内容
 * @param {Object} dataMap - 数据映射对象，键为占位符名称，值为文档中的实际内容
 * @returns {string} 替换后的 XML 内容
 */
function replaceContentWithPlaceholders(docXml, dataMap) {
  let result = docXml

  // 按值长度从长到短排序，避免短值先匹配导致长值无法匹配
  const sortedEntries = Object.entries(dataMap)
    .filter(([key, value]) => value !== null && value !== undefined && String(value).trim() !== '')
    .sort((a, b) => String(b[1]).length - String(a[1]).length)

  console.log(`\n开始替换，共 ${sortedEntries.length} 个占位符:`)
  console.log('='.repeat(60))

  for (const [placeholderKey, actualValue] of sortedEntries) {
    const valueStr = String(actualValue).trim()
    if (!valueStr) continue

    // 创建占位符
    const placeholder = `{{${placeholderKey}}}`
    let count = 0

    // 转义特殊字符用于正则表达式
    const escapedValue = valueStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

    // 安全替换：只替换 <w:t>...</w:t> 标签内的文本内容
    // 使用正则表达式匹配 <w:t> 标签内的文本，并替换匹配的内容
    const textTagPattern = new RegExp(`(<w:t[^>]*>)([^<]*?)${escapedValue}([^<]*?)(</w:t>)`, 'g')

    result = result.replace(textTagPattern, (match, openTag, before, target, after, closeTag) => {
      count++
      // 保留标签结构，只替换文本内容
      return `${openTag}${before}${placeholder}${after}${closeTag}`
    })

    if (count > 0) {
      console.log(`✓ ${placeholderKey}: "${valueStr}" -> ${placeholder} (替换 ${count} 次)`)
    } else {
      console.log(`✗ ${placeholderKey}: "${valueStr}" -> 未找到匹配内容`)
    }
  }

  console.log('='.repeat(60))
  return result
}

/**
 * 转义正则表达式特殊字符
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 主函数
 */
async function main() {
  try {
    // 1. 检查输入文件是否存在
    if (!fs.existsSync(filledDocPath)) {
      console.error(`错误: 文件不存在: ${filledDocPath}`)
      process.exit(1)
    }

    // 2. 读取数据映射
    let dataMap = {}

    if (dataMapPath && fs.existsSync(dataMapPath)) {
      console.log(`\n从文件读取数据映射: ${dataMapPath}`)
      const mapContent = await fsp.readFile(dataMapPath, 'utf-8')
      dataMap = JSON.parse(mapContent)
    } else {
      // 如果没有提供映射文件，使用示例数据（用户需要修改这里）
      console.log('\n⚠️  未提供数据映射文件，使用示例数据')
      console.log('请在代码中修改 dataMap 对象，或提供 JSON 映射文件')
      console.log('')

      // ========== 在这里修改你的数据映射 ==========
      dataMap = {
        // 示例：将文档中的 "JH01-001" 替换成 {{mould_no}}
        // mould_no: "JH01-001",
        // part_name: "产品名称示例",
        // customer_name: "客户名称示例",
        // 添加你的实际数据映射...
      }
      // ===========================================
    }

    if (Object.keys(dataMap).length === 0) {
      console.error('\n错误: 数据映射为空！')
      console.error('请提供数据映射文件，或在代码中修改 dataMap 对象')
      process.exit(1)
    }

    console.log(`\n数据映射内容:`)
    console.log(JSON.stringify(dataMap, null, 2))

    // 3. 读取 Word 文档
    console.log(`\n读取已填充的 Word 文档: ${filledDocPath}`)
    const docBuffer = await fsp.readFile(filledDocPath)
    const zip = await JSZip.loadAsync(docBuffer)

    // 4. 读取并处理 document.xml
    console.log('处理文档内容...')
    const docXml = await zip.file('word/document.xml').async('string')

    // 5. 替换内容为占位符
    const templateXml = replaceContentWithPlaceholders(docXml, dataMap)

    // 6. 写回 XML
    zip.file('word/document.xml', templateXml)

    // 7. 生成新的模板文件
    console.log(`\n生成模板文件: ${outputTemplatePath}`)
    const outputBuffer = await zip.generateAsync({ type: 'nodebuffer' })
    await fsp.writeFile(outputTemplatePath, outputBuffer)

    console.log('\n✅ 模板生成成功！')
    console.log(`\n输出文件: ${outputTemplatePath}`)
    console.log('\n提示: 打开生成的模板文件，检查占位符是否正确替换')
    console.log('如果某些内容未被替换，请检查：')
    console.log('  1. 数据映射中的值是否与文档中的内容完全一致（包括空格、标点）')
    console.log('  2. 文本是否被 Word 分割成多个片段')
    console.log('  3. 是否包含特殊字符或格式')
  } catch (error) {
    console.error('\n❌ 处理失败:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

// 运行主函数
main()
