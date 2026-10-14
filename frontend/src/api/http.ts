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

/** The body of a 409 answer (the API says why it refused), else null. */
export function conflictBody<T>(error: unknown): T | null {
  return axios.isAxiosError<T>(error) && error.response?.status === 409 ? error.response.data : null
}

/** Orval mutator: every generated endpoint goes through this instance. */
export const apiClient = <T>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig,
): Promise<T> => http.request<T>({ ...config, ...options }).then(({ data }) => data)

/** The request never got an answer: no connection, or too weak. */
export function isNetworkError(error: unknown): boolean {
  return axios.isAxiosError(error) && !error.response && error.code !== 'ERR_CANCELED'
}

/** The API answered 404 (gone, e.g. finished or discarded on another device). */
export function isNotFound(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 404
}

/** The status the API answered with (undefined: no answer). */
export function httpStatus(error: unknown): number | undefined {
  return axios.isAxiosError(error) ? error.response?.status : undefined
}
