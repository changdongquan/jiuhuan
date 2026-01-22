/**
 * 从 Word 文档中提取红色文本并生成占位符
 *
 * 使用方法：
 * node extract-red-text-from-word.js <Word文档路径>
 */

const path = require('path')
const fs = require('fs')
const fsp = fs.promises
const JSZip = require('jszip')

const args = process.argv.slice(2)

if (args.length < 1) {
  console.error('使用方法: node extract-red-text-from-word.js <Word文档路径>')
  process.exit(1)
}

const docPath = path.resolve(args[0])

/**
 * 提取红色文本内容
 * Word XML 中，红色文本的格式通常是：
 * <w:r>
 *   <w:rPr>
 *     <w:color w:val="FF0000"/>  <!-- 红色 -->
 *   </w:rPr>
 *   <w:t>文本内容</w:t>
 * </w:r>
 */
async function extractRedText(docXml) {
  const redTexts = []

  // 匹配包含红色格式的文本运行（run）
  // 红色在 Word XML 中通常是 w:val="FF0000" 或 w:val="FF0000"（RGB红色）
  // 也可能有其他红色变体，如 "FF0000", "FF0000", "DC143C" 等

  // 匹配模式：查找包含红色颜色的 <w:r> 标签块
  const redRunPattern = /<w:r[^>]*>[\s\S]*?<\/w:r>/gi

  let match
  while ((match = redRunPattern.exec(docXml)) !== null) {
    const runXml = match[0]

    // 检查是否包含红色
    const isRed =
      /<w:color[^>]*w:val="(FF0000|DC143C|C00000|FF0000)"[^>]*>/i.test(runXml) ||
      /<w:color[^>]*w:themeColor="accent2"[^>]*>/i.test(runXml) // 主题红色

    if (isRed) {
      // 提取文本内容
      const textMatches = runXml.match(/<w:t[^>]*>([^<]*)<\/w:t>/gi)
      if (textMatches) {
        textMatches.forEach((textMatch) => {
          const textContent = textMatch.replace(/<w:t[^>]*>|<\/w:t>/gi, '').trim()
          if (textContent) {
            redTexts.push({
              text: textContent,
              fullXml: runXml.substring(0, 200) // 保存部分 XML 用于调试
            })
          }
        })
      }
    }
  }

  // 也尝试匹配可能跨多个 <w:r> 的红色文本
  // 有些情况下，一个词可能被分割成多个运行

  return redTexts
}

/**
 * 生成占位符名称
 */
function generatePlaceholderName(text, index) {
  // 清理文本，生成合适的占位符名称
  let name = text
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9_]/g, '_') // 非中文、字母、数字、下划线替换为下划线
    .replace(/_+/g, '_') // 多个下划线合并为一个
    .replace(/^_|_$/g, '') // 去除首尾下划线

  // 如果清理后为空，使用索引
  if (!name) {
    name = `field_${index + 1}`
  }

  // 如果太长，截断
  if (name.length > 50) {
    name = name.substring(0, 50)
  }

  return name
}

/**
 * 主函数
 */
async function main() {
  try {
    // 检查文件是否存在
    if (!fs.existsSync(docPath)) {
      console.error(`错误: 文件不存在: ${docPath}`)
      process.exit(1)
    }

    console.log(`\n读取 Word 文档: ${docPath}`)

    // 读取 Word 文档
    const docBuffer = await fsp.readFile(docPath)
    const zip = await JSZip.loadAsync(docBuffer)

    // 读取 document.xml
    const docXml = await zip.file('word/document.xml').async('string')

    console.log('提取红色文本...')

    // 提取红色文本
    const redTexts = await extractRedText(docXml)

    if (redTexts.length === 0) {
      console.log('\n⚠️  未找到红色文本！')
      console.log('\n可能的原因：')
      console.log('  1. 文档中没有红色文本')
      console.log('  2. 红色使用了不同的颜色代码')
      console.log('  3. 文本格式不是标准的红色格式')
      console.log('\n尝试检查文档中的颜色格式...')

      // 尝试查找所有颜色定义
      const colorMatches = docXml.match(/<w:color[^>]*>/gi)
      if (colorMatches) {
        console.log(`\n找到 ${colorMatches.length} 个颜色定义，示例：`)
        colorMatches.slice(0, 10).forEach((m, i) => {
          console.log(`  ${i + 1}. ${m}`)
        })
      }

      return
    }

    console.log(`\n找到 ${redTexts.length} 个红色文本片段\n`)
    console.log('='.repeat(80))

    // 去重并生成数据映射
    const uniqueTexts = []
    const seenTexts = new Set()

    redTexts.forEach((item, index) => {
      const normalizedText = item.text.trim()
      if (normalizedText && !seenTexts.has(normalizedText)) {
        seenTexts.add(normalizedText)
        uniqueTexts.push({
          text: normalizedText,
          placeholder: generatePlaceholderName(normalizedText, uniqueTexts.length),
          index: uniqueTexts.length + 1
        })
      }
    })

    // 显示提取结果
    uniqueTexts.forEach((item, index) => {
      console.log(`${index + 1}. "${item.text}"`)
      console.log(`   占位符: {{${item.placeholder}}}`)
      console.log('')
    })

    console.log('='.repeat(80))

    // 生成数据映射对象
    const dataMap = {}
    uniqueTexts.forEach((item) => {
      dataMap[item.placeholder] = item.text
    })

    // 保存数据映射到文件
    const mapFilePath = path.join(path.dirname(docPath), 'word-template-data-map.json')
    await fsp.writeFile(mapFilePath, JSON.stringify(dataMap, null, 2), 'utf-8')

    console.log(`\n✅ 数据映射已保存到: ${mapFilePath}`)
    console.log(`\n共提取 ${uniqueTexts.length} 个唯一红色文本`)
    console.log('\n下一步：')
    console.log(`  1. 检查生成的数据映射文件: ${mapFilePath}`)
    console.log('  2. 根据需要修改占位符名称')
    console.log('  3. 运行 create-word-template.js 生成模板：')
    console.log(`     node create-word-template.js "${docPath}" "模板.docx" "${mapFilePath}"`)
  } catch (error) {
    console.error('\n❌ 处理失败:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

main()
