/**
 * 提取 Word 文档的详细样式信息
 */

const path = require('path')
const fs = require('fs')
const JSZip = require('jszip')

const args = process.argv.slice(2)
const docPath = args[0] || '/Users/changun/Documents/模具试模记录表-模板.docx'

async function extractStyles() {
  try {
    const buffer = fs.readFileSync(docPath)
    const zip = await JSZip.loadAsync(buffer)

    // 提取页眉
    console.log('='.repeat(80))
    console.log('页眉信息:')
    console.log('-'.repeat(80))
    try {
      const headerXml = await zip.file('word/header1.xml').async('string')
      const headerTextMatches = headerXml.match(/<w:t[^>]*>([^<]*)<\/w:t>/gi)
      if (headerTextMatches) {
        const headerText = headerTextMatches
          .map((m) => m.replace(/<w:t[^>]*>|<\/w:t>/gi, ''))
          .join('')
          .trim()
        console.log('页眉内容:', headerText)
      }
    } catch (e) {
      console.log('未找到页眉文件')
    }

    // 提取文档样式
    console.log('\n' + '='.repeat(80))
    console.log('文档样式信息:')
    console.log('-'.repeat(80))

    const docXml = await zip.file('word/document.xml').async('string')

    // 提取表格样式
    const tableMatches = docXml.match(/<w:tbl[^>]*>[\s\S]*?<\/w:tbl>/gi)
    if (tableMatches && tableMatches.length > 0) {
      const firstTable = tableMatches[0]

      // 提取行样式
      const rowMatches = firstTable.match(/<w:tr[^>]*>[\s\S]*?<\/w:tr>/gi)
      if (rowMatches) {
        rowMatches.forEach((rowXml, rowIndex) => {
          // 提取行高
          const heightMatch = rowXml.match(/<w:trHeight[^>]*w:val=\"(\d+)\"/i)
          const height = heightMatch ? parseInt(heightMatch[1]) / 20 : null // twips to pt

          // 提取单元格
          const cellMatches = rowXml.match(/<w:tc[^>]*>[\s\S]*?<\/w:tc>/gi)
          if (cellMatches) {
            console.log(`\n第 ${rowIndex + 1} 行${height ? ` (高度: ${height}pt)` : ''}:`)

            cellMatches.forEach((cellXml, cellIndex) => {
              // 提取文本
              const textMatches = cellXml.match(/<w:t[^>]*>([^<]*)<\/w:t>/gi)
              const text = textMatches
                ? textMatches
                    .map((m) => m.replace(/<w:t[^>]*>|<\/w:t>/gi, ''))
                    .join('')
                    .trim()
                : ''

              // 提取字体样式
              const fontSizeMatch = cellXml.match(/<w:sz[^>]*w:val=\"(\d+)\"/i)
              const fontSize = fontSizeMatch ? parseInt(fontSizeMatch[1]) / 2 : null // half-points to points

              const fontNameMatch = cellXml.match(/<w:rFonts[^>]*w:ascii=\"([^\"]+)\"/i)
              const fontName = fontNameMatch ? fontNameMatch[1] : null

              const boldMatch = cellXml.match(/<w:b[^>]*\/>/i)
              const isBold = !!boldMatch

              // 提取对齐方式
              const alignMatch = cellXml.match(/<w:jc[^>]*w:val=\"([^\"]+)\"/i)
              const align = alignMatch ? alignMatch[1] : null

              // 提取背景色
              const fillMatch = cellXml.match(/<w:shd[^>]*w:fill=\"([^\"]+)\"/i)
              const fillColor = fillMatch ? fillMatch[1] : null

              if (text || fontSize || fontName) {
                console.log(`  单元格 ${cellIndex + 1}:`)
                if (text) console.log(`    文本: "${text}"`)
                if (fontSize) console.log(`    字体大小: ${fontSize}pt`)
                if (fontName) console.log(`    字体: ${fontName}`)
                if (isBold) console.log(`    加粗: 是`)
                if (align) console.log(`    对齐: ${align}`)
                if (fillColor) console.log(`    背景色: ${fillColor}`)
              }
            })
          }
        })
      }
    }

    // 提取样式定义
    console.log('\n' + '='.repeat(80))
    console.log('样式定义:')
    console.log('-'.repeat(80))
    try {
      const stylesXml = await zip.file('word/styles.xml').async('string')
      const styleMatches = stylesXml.match(
        /<w:style[^>]*w:styleId=\"([^\"]+)\"[\s\S]*?<\/w:style>/gi
      )
      if (styleMatches) {
        console.log(`找到 ${styleMatches.length} 个样式定义`)
      }
    } catch (e) {
      console.log('未找到样式文件')
    }
  } catch (error) {
    console.error('提取失败:', error.message)
    console.error(error.stack)
  }
}

extractStyles()
