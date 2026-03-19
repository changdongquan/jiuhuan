const normalizeImageUrl = (input: unknown) => String(input || '').trim()

const isDirectImageUrl = (url: string) => /^(data:|blob:|https?:\/\/)/i.test(url)

export const buildProjectPartImageDisplayUrl = (input: unknown) => {
  const url = normalizeImageUrl(input)
  if (!url) return ''
  if (isDirectImageUrl(url)) return url
  return `/api/project/part-image?url=${encodeURIComponent(url)}`
}

export const buildQuotationPartImageDisplayUrl = (input: unknown) => {
  const url = normalizeImageUrl(input)
  if (!url) return ''
  if (isDirectImageUrl(url)) return url
  return `/api/quotation/part-item-image?url=${encodeURIComponent(url)}`
}
