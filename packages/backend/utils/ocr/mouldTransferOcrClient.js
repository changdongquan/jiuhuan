const http = require('http')

const postMultipartPng = async (urlString, pngBuffer, options = {}) => {
  const timeoutMs = Number(options.timeoutMs || 15000)
  const url = new URL(urlString)
  if (url.protocol !== 'http:') throw new Error(`仅支持 http 协议：${urlString}`)

  const boundary = `----JiuhuanOcr${Math.random().toString(16).slice(2)}`
  const head =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="image"; filename="page1.png"\r\n` +
    `Content-Type: image/png\r\n\r\n`
  const tail = `\r\n--${boundary}--\r\n`
  const body = Buffer.concat([Buffer.from(head), pngBuffer, Buffer.from(tail)])

  const requestOptions = {
    method: 'POST',
    hostname: url.hostname,
    port: url.port ? Number(url.port) : 80,
    path: url.pathname + url.search,
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': body.length
    }
  }

  return await new Promise((resolve, reject) => {
    const req = http.request(requestOptions, (res) => {
      const chunks = []
      res.on('data', (d) => chunks.push(d))
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8')
        let parsed = null
        try {
          parsed = JSON.parse(raw)
        } catch (e) {
          reject(new Error(`OCR 响应不是 JSON（HTTP ${res.statusCode}）：${raw.slice(0, 200)}`))
          return
        }
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(parsed?.message || `OCR 请求失败（HTTP ${res.statusCode}）`))
          return
        }
        resolve(parsed)
      })
    })
    req.on('error', reject)
    req.setTimeout(timeoutMs, () => req.destroy(new Error('OCR 请求超时')))
    req.write(body)
    req.end()
  })
}

async function ocrMouldTransferPng(pngBuffer, options = {}) {
  const baseUrl = String(options.baseUrl || '').trim().replace(/\/+$/, '')
  if (!baseUrl) throw new Error('OCR 服务地址未配置')
  const resp = await postMultipartPng(`${baseUrl}/ocr/mould-transfer`, pngBuffer, options)
  const data = resp?.data
  if (!resp?.success || !data) throw new Error(resp?.message || 'OCR 识别失败')
  return data
}

module.exports = { ocrMouldTransferPng }

