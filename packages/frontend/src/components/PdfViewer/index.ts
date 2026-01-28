import { VNode, createVNode, render } from 'vue'
import PdfViewer from './src/PdfViewer.vue'
import { isClient } from '@/utils/is'
import { toAnyString } from '@/utils'

export { PdfViewer }

let instance: Nullable<VNode> = null

export function createPdfViewer(options: { url: string; fileName?: string; show?: boolean }) {
  if (!isClient) return
  const { url, fileName } = options

  const propsData: Partial<{
    url: string
    fileName?: string
    show: boolean
    id: string
  }> = {}
  const container = document.createElement('div')
  const id = toAnyString()
  container.id = id
  propsData.url = url
  propsData.fileName = fileName
  propsData.show = true
  propsData.id = id

  document.body.appendChild(container)
  instance = createVNode(PdfViewer, propsData)
  render(instance, container)
}
