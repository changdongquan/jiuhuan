import axios, { AxiosError } from 'axios'
import { defaultRequestInterceptors, defaultResponseInterceptors } from './config'

import { AxiosInstance, InternalAxiosRequestConfig, RequestConfig, AxiosResponse } from './types'
import { ElMessage } from 'element-plus'
import { REQUEST_TIMEOUT } from '@/constants'

export const PATH_URL = import.meta.env.VITE_API_BASE_PATH

const abortControllerMap: Map<string, AbortController> = new Map()

// 处理 baseURL：开发环境下强制使用相对路径以利用 Vite 代理
const getBaseURL = () => {
  // 开发环境下（vite dev模式），强制使用相对路径走代理
  if (import.meta.env.DEV || import.meta.env.MODE === 'base') {
    return '/'
  }
  // 生产环境使用配置的 baseURL
  return PATH_URL || '/'
}

const axiosInstance: AxiosInstance = axios.create({
  timeout: REQUEST_TIMEOUT,
  baseURL: getBaseURL()
})

axiosInstance.interceptors.request.use((res: InternalAxiosRequestConfig) => {
  const controller = new AbortController()
  const url = res.url || ''
  res.signal = controller.signal
  abortControllerMap.set(
    import.meta.env.VITE_USE_MOCK === 'true' ? url.replace('/mock', '') : url,
    controller
  )
  return res
})

axiosInstance.interceptors.response.use(
  (res: AxiosResponse) => {
    const url = res.config.url || ''
    abortControllerMap.delete(url)
    // 这里不能做任何处理，否则后面的 interceptors 拿不到完整的上下文了
    return res
  },
  async (error: AxiosError) => {
    const url = error.config?.url || ''

    // 对 Windows 域自动登录接口的 401 做静默处理（不弹错误），交由上层逻辑处理
    if (url.includes('/api/auth/auto-login') && error.response?.status === 401) {
      return Promise.reject(error)
    }

    const resolveErrorMessage = async () => {
      const data: any = error.response?.data
      if (!data) return error.message

      // 当 responseType = 'blob' 且服务端返回 JSON 错误时，data 会是 Blob，需要读取后再解析 message
      const isBlob =
        typeof Blob !== 'undefined' && typeof data === 'object' && typeof data.size === 'number'
      if (isBlob && typeof (data as Blob).text === 'function') {
        try {
          const text = await (data as Blob).text()
          if (!text) return error.message
          try {
            const parsed = JSON.parse(text)
            return parsed?.message || error.message
          } catch {
            return text
          }
        } catch {
          return error.message
        }
      }

      return data?.message || error.message
    }

    // 显示后端返回的具体错误消息，而不是通用的 HTTP 错误
    const errorMessage = await resolveErrorMessage()
    ElMessage.error(errorMessage)
    return Promise.reject(error)
  }
)

axiosInstance.interceptors.request.use(defaultRequestInterceptors)
axiosInstance.interceptors.response.use(defaultResponseInterceptors)

const service = {
  request: (config: RequestConfig) => {
    return new Promise((resolve, reject) => {
      if (config.interceptors?.requestInterceptors) {
        config = config.interceptors.requestInterceptors(config as any)
      }

      axiosInstance
        .request(config)
        .then((res) => {
          resolve(res)
        })
        .catch((err: any) => {
          reject(err)
        })
    })
  },
  cancelRequest: (url: string | string[]) => {
    const urlList = Array.isArray(url) ? url : [url]
    for (const _url of urlList) {
      abortControllerMap.get(_url)?.abort()
      abortControllerMap.delete(_url)
    }
  },
  cancelAllRequest() {
    for (const [_, controller] of abortControllerMap) {
      controller.abort()
    }
    abortControllerMap.clear()
  }
}

export default service
