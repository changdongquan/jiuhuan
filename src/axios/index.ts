import service from './service'
import { CONTENT_TYPE } from '@/constants'
import { useUserStoreWithOut } from '@/store/modules/user'

const request = (option: AxiosConfig) => {
  const { url, method, params, data, headers, responseType, withCredentials } = option

  const userStore = useUserStoreWithOut()
  const isFormData =
    typeof FormData !== 'undefined' &&
    data !== null &&
    data !== undefined &&
    data instanceof FormData

  const mergedHeaders: Record<string, any> = {
    [userStore.getTokenKey ?? 'Authorization']: userStore.getToken ?? '',
    'X-Username': userStore.getUserInfo?.username || '',
    ...headers
  }

  // 默认使用 JSON；若是 FormData 则不强制 Content-Type（让浏览器/axios 自动带 boundary）
  if (!isFormData && mergedHeaders['Content-Type'] === undefined) {
    mergedHeaders['Content-Type'] = CONTENT_TYPE
  }

  return service.request({
    url: url,
    method,
    params,
    data: data,
    responseType: responseType,
    withCredentials: withCredentials, // 支持携带凭据（用于 Kerberos SSO）
    headers: mergedHeaders
  })
}

const axiosInstance = {
  get: <T = any>(option: AxiosConfig) => {
    return request({ method: 'get', ...option }) as Promise<IResponse<T>>
  },
  post: <T = any>(option: AxiosConfig) => {
    return request({ method: 'post', ...option }) as Promise<IResponse<T>>
  },
  delete: <T = any>(option: AxiosConfig) => {
    return request({ method: 'delete', ...option }) as Promise<IResponse<T>>
  },
  put: <T = any>(option: AxiosConfig) => {
    return request({ method: 'put', ...option }) as Promise<IResponse<T>>
  },
  cancelRequest: (url: string | string[]) => {
    return service.cancelRequest(url)
  },
  cancelAllRequest: () => {
    return service.cancelAllRequest()
  }
}

export { request }
export default axiosInstance
