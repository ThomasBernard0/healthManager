import axios, { type AxiosRequestConfig } from 'axios'
import { currentAccessKey, notifyUnauthorized } from '../core/access/accessKey'

// Empty in production: the API is served from the same origin under /api.
export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '',
})

// Every call carries the device's access key; a 401 brings up the key prompt.
http.interceptors.request.use((config) => {
  const key = currentAccessKey()
  if (key) config.headers.set('X-Access-Key', key)
  return config
})

http.interceptors.response.use(undefined, (error: unknown) => {
  if (axios.isAxiosError(error) && error.response?.status === 401) notifyUnauthorized()
  return Promise.reject(error)
})

/** Orval mutator: every generated endpoint goes through this instance. */
export const apiClient = <T>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig,
): Promise<T> => http.request<T>({ ...config, ...options }).then(({ data }) => data)
