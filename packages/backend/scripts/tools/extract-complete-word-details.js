/**
 * 提取 Word 文档的完整细节信息
 */

const path = require('path')
const fs = require('fs')
const JSZip = require('jszip')

const args = process.argv.slice(2)
const docPath = args[0] || '/Users/changun/Documents/模具试模记录表-模板.docx'

async function extractCompleteDetails() {
  try {
    const buffer = fs.readFileSync(docPath)
    const zip = await JSZip.loadAsync(buffer)

    console.log('='.repeat(100))
    console.log('完整细节提取')
    console.log('='.repeat(100))

    // 提取页眉
    console.log('\n【页眉信息】')
    console.log('-'.repeat(100))
    try {
      const headerFiles = Object.keys(zip.files).filter((f) => f.includes('header'))
      for (const headerFile of headerFiles) {
        const headerXml = await zip.file(headerFile).async('string')
        const textMatches = headerXml.match(/<w:t[^>]*>([^<]*)<\/w:t>/gi)
        if (textMatches) {
          const text = textMatches
            .map((m) => m.replace(/<w:t[^>]*>|<\/w:t>/gi, ''))
            .join('')
            .trim()
          if (text) {
            console.log(`${headerFile}: "${text}"`)
          }
        }
      }
    } catch (e) {
      console.log('未找到页眉文件')
    }

    // 提取文档内容
    const docXml = await zip.file('word/document.xml').async('string')

    // 提取标题
    console.log('\n【标题信息】')
    console.log('-'.repeat(100))
    const titleMatch = docXml.match(
      /<w:p[^>]*>[\s\S]*?长虹美菱股份有限公司[\s\S]*?模具试模记录表[\s\S]*?<\/w:p>/i
    )
    if (titleMatch) {
      const textMatches = titleMatch[0].match(/<w:t[^>]*>([^<]*)<\/w:t>/gi)
      if (textMatches) {
        const title = textMatches
          .map((m) => m.replace(/<w:t[^>]*>|<\/w:t>/gi, ''))
          .join('')
          .trim()
        console.log(`标题: "${title}"`)

        // 检查字体大小
        const fontSizeMatch = titleMatch[0].match(/<w:sz[^>]*w:val=\"(\d+)\"/i)
        if (fontSizeMatch) {
          console.log(`标题字体大小: ${parseInt(fontSizeMatch[1]) / 2}pt`)
        }

        // 检查是否加粗
        const boldMatch = titleMatch[0].match(/<w:b[^>]*\/>/i)
        console.log(`标题是否加粗: ${boldMatch ? '是' : '否'}`)
      }
    }

    // 提取表格详细信息
    console.log('\n【表格详细信息】')
    console.log('-'.repeat(100))

    const tableMatches = docXml.match(/<w:tbl[^>]*>[\s\S]*?<\/w:tbl>/gi)
    if (tableMatches && tableMatches.length > 0) {
      const tableXml = tableMatches[0]

      // 提取列宽
      const gridColMatches = tableXml.match(/<w:gridCol[^>]*w:w=\"(\d+)\"/gi)
      if (gridColMatches) {
        const widths = gridColMatches.map((m) => {
          const match = m.match(/w:w=\"(\d+)\"/)
          return match ? parseInt(match[1]) : 0
        })
        const total = widths.reduce((a, b) => a + b, 0)
        console.log('\n列宽（twips）:', widths)
        console.log('列宽百分比:')
        widths.forEach((w, i) => {
          console.log(`  列${i + 1}: ${((w / total) * 100).toFixed(2)}%`)
        })
      }

      // 提取每一行的详细信息
      const rowMatches = tableXml.match(/<w:tr[^>]*>[\s\S]*?<\/w:tr>/gi)
      if (rowMatches) {
        rowMatches.forEach((rowXml, rowIndex) => {
          // 提取行高
          const heightMatch = rowXml.match(/<w:trHeight[^>]*w:val=\"(\d+)\"/i)
          const height = heightMatch ? parseInt(heightMatch[1]) / 20 : null

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
              const fontSize = fontSizeMatch ? parseInt(fontSizeMatch[1]) / 2 : null

              const fontNameMatch = cellXml.match(/<w:rFonts[^>]*w:ascii=\"([^\"]+)\"/i)
              const fontName = fontNameMatch ? fontNameMatch[1] : null

              const boldMatch = cellXml.match(/<w:b[^>]*\/>/i)
              const isBold = !!boldMatch

              // 提取对齐方式
              const alignMatch = cellXml.match(/<w:jc[^>]*w:val=\"([^\"]+)\"/i)
              const align = alignMatch ? alignMatch[1] : null

              // 提取垂直对齐
              const vAlignMatch = cellXml.match(/<w:vAlign[^>]*w:val=\"([^\"]+)\"/i)
              const vAlign = vAlignMatch ? vAlignMatch[1] : null

              // 提取背景色
              const fillMatch = cellXml.match(/<w:shd[^>]*w:fill=\"([^\"]+)\"/i)
              const fillColor = fillMatch ? fillMatch[1] : null

              // 提取合并单元格
              const gridSpanMatch = cellXml.match(/<w:gridSpan[^>]*w:val=\"(\d+)\"/i)
              const gridSpan = gridSpanMatch ? parseInt(gridSpanMatch[1]) : null

              // 提取内边距
              const topMatch = cellXml.match(/<w:top[^>]*w:w=\"(\d+)\"/i)
              const rightMatch = cellXml.match(/<w:right[^>]*w:w=\"(\d+)\"/i)
              const bottomMatch = cellXml.match(/<w:bottom[^>]*w:w=\"(\d+)\"/i)
              const leftMatch = cellXml.match(/<w:left[^>]*w:w=\"(\d+)\"/i)

              if (text || fontSize || align || gridSpan) {
                console.log(`  单元格 ${cellIndex + 1}:`)
                if (text) console.log(`    文本: "${text}"`)
                if (fontSize) console.log(`    字体大小: ${fontSize}pt`)
                if (fontName) console.log(`    字体: ${fontName}`)
                if (isBold) console.log(`    加粗: 是`)
                if (align) console.log(`    水平对齐: ${align}`)
                if (vAlign) console.log(`    垂直对齐: ${vAlign}`)
                if (fillColor && fillColor !== 'FFFFFF') console.log(`    背景色: ${fillColor}`)
                if (gridSpan) console.log(`    合并列数: ${gridSpan}`)
                if (topMatch || rightMatch || bottomMatch || leftMatch) {
                  const padding = {
                    top: topMatch ? parseInt(topMatch[1]) / 20 : 0,
                    right: rightMatch ? parseInt(rightMatch[1]) / 20 : 0,
                    bottom: bottomMatch ? parseInt(bottomMatch[1]) / 20 : 0,
                    left: leftMatch ? parseInt(leftMatch[1]) / 20 : 0
                  }
                  console.log(
                    `    内边距: ${padding.top}pt ${padding.right}pt ${padding.bottom}pt ${padding.left}pt`
                  )
                }
              }
            })
          }
        })
      }
    }

    // 提取页脚
    console.log('\n【页脚信息】')
    console.log('-'.repeat(100))
    const footerMatches = docXml.match(/记录日期[\s\S]*?编号:/i)
    if (footerMatches) {
      const textMatches = footerMatches[0].match(/<w:t[^>]*>([^<]*)<\/w:t>/gi)
      if (textMatches) {
        const footer = textMatches
          .map((m) => m.replace(/<w:t[^>]*>|<\/w:t>/gi, ''))
          .join('')
          .trim()
        console.log(`页脚内容: "${footer}"`)
      }
    }
  } catch (error) {
    console.error('提取失败:', error.message)
    console.error(error.stack)
  }
}

extractCompleteDetails()
