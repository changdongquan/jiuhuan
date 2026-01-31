/**
 * PDF 转图片工具
 * 将 PDF 首页渲染为 PNG 图片 buffer
 * 
 * 使用 pdftoppm 命令行工具（来自 poppler-utils）
 * macOS: brew install poppler
 * Ubuntu/Debian: apt-get install poppler-utils
 */

const { execFile } = require('child_process')
const { promisify } = require('util')
const fs = require('fs')
const fsp = fs.promises
const path = require('path')
const os = require('os')

const execFileAsync = promisify(execFile)

/**
 * 将 PDF 首页转换为 PNG buffer
 * @param {Buffer|Uint8Array} pdfBuffer - PDF 文件内容
 * @param {Object} options - 可选配置
 * @param {number} options.scale - 渲染缩放比例，默认 2（提高清晰度，对应 DPI = 150）
 * @param {number} options.page - 要渲染的页码，默认 1（首页）
 * @returns {Promise<Buffer>} PNG 图片 buffer
 */
const pdfFirstPageToPngBuffer = async (pdfBuffer, options = {}) => {
  const { scale = 2, page: pageNum = 1 } = options
  
  // scale 2 对应 DPI 约 150（默认 72 * 2）
  const dpi = Math.round(72 * scale)
  
  // 创建临时目录和文件
  const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'pdf2png-'))
  const tmpPdfPath = path.join(tmpDir, 'input.pdf')
  const tmpOutputPrefix = path.join(tmpDir, 'output')
  
  try {
    // 写入临时 PDF 文件
    await fsp.writeFile(tmpPdfPath, pdfBuffer)
    
    // 使用 pdftoppm 转换
    // -png: 输出 PNG 格式
    // -f <page>: 起始页
    // -l <page>: 结束页
    // -r <dpi>: 分辨率
    // -singlefile: 单页输出（不添加页码后缀）
    await execFileAsync('pdftoppm', [
      '-png',
      '-f', String(pageNum),
      '-l', String(pageNum),
      '-r', String(dpi),
      '-singlefile',
      tmpPdfPath,
      tmpOutputPrefix
    ])
    
    // 读取生成的 PNG 文件
    const outputPngPath = `${tmpOutputPrefix}.png`
    const pngBuffer = await fsp.readFile(outputPngPath)
    
    return pngBuffer
  } finally {
    // 清理临时文件
    try {
      await fsp.rm(tmpDir, { recursive: true, force: true })
    } catch (e) {
      // 忽略清理错误
    }
  }
}

module.exports = {
  pdfFirstPageToPngBuffer
}
