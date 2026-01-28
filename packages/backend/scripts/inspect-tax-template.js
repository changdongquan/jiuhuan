const ExcelJS = require('exceljs')
const path = require('path')

async function inspectTaxTemplate() {
  const templatePath = path.join(__dirname, '..', 'templates', 'salary', '个税导入模板01.xlsx')
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(templatePath)
  const worksheet = workbook.worksheets[0]
  if (!worksheet) {
    console.error('模板中未找到工作表')
    process.exit(1)
  }

  const headers = []
  for (let col = 1; col <= worksheet.columnCount; col += 1) {
    headers.push(worksheet.getRow(1).getCell(col).value)
  }

  console.log('模板文件:', templatePath)
  console.log('工作表名称:', worksheet.name)
  console.log('首行表头:', headers)
}

if (require.main === module) {
  inspectTaxTemplate().catch((err) => {
    console.error('读取模板失败:', err)
    process.exit(1)
  })
}
