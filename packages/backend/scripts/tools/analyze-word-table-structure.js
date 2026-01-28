/**
 * 分析 Word 模板的表格结构
 */

const path = require('path')
const fs = require('fs')
const JSZip = require('jszip')

const args = process.argv.slice(2)
const docPath = args[0] || '/Users/changun/Documents/模具试模记录表-模板.docx'

async function analyzeTableStructure() {
  try {
    const buffer = fs.readFileSync(docPath)
    const zip = await JSZip.loadAsync(buffer)
    const docXml = await zip.file('word/document.xml').async('string')

    // 提取表格
    const tableMatches = docXml.match(/<w:tbl[^>]*>[\s\S]*?<\/w:tbl>/gi)
    if (!tableMatches || tableMatches.length === 0) {
      console.log('未找到表格')
      return
    }

    console.log(`找到 ${tableMatches.length} 个表格\n`)
    console.log('='.repeat(80))

    tableMatches.forEach((tableXml, tableIndex) => {
      console.log(`\n表格 ${tableIndex + 1}:`)
      console.log('-'.repeat(80))

      // 提取行
      const rowMatches = tableXml.match(/<w:tr[^>]*>[\s\S]*?<\/w:tr>/gi)
      if (!rowMatches) {
        console.log('  未找到行')
        return
      }

      console.log(`  总行数: ${rowMatches.length}\n`)

      rowMatches.forEach((rowXml, rowIndex) => {
        // 提取单元格
        const cellMatches = rowXml.match(/<w:tc[^>]*>[\s\S]*?<\/w:tc>/gi)
        if (!cellMatches) return

        // 提取单元格文本
        const cellTexts = cellMatches.map((cellXml) => {
          const textMatches = cellXml.match(/<w:t[^>]*>([^<]*)<\/w:t>/gi)
          if (!textMatches) return ''
          return textMatches
            .map((m) => m.replace(/<w:t[^>]*>|<\/w:t>/gi, ''))
            .join('')
            .trim()
        })

        // 过滤空单元格
        const nonEmptyCells = cellTexts.filter((t) => t)

        if (nonEmptyCells.length > 0) {
          console.log(`  第 ${rowIndex + 1} 行 (${cellMatches.length} 个单元格):`)
          cellTexts.forEach((text, cellIndex) => {
            if (text) {
              console.log(`    [${cellIndex + 1}] ${text}`)
            }
          })
          console.log('')
        }
      })
    })

    console.log('='.repeat(80))
  } catch (error) {
    console.error('分析失败:', error.message)
    console.error(error.stack)
  }
}

analyzeTableStructure()
