import axios, { type AxiosRequestConfig } from 'axios'

// Empty in production: the API is served from the same origin under /api.
export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '',
})

/** Orval mutator: every generated endpoint goes through this instance. */
export const apiClient = <T>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig,
): Promise<T> => http.request<T>({ ...config, ...options }).then(({ data }) => data)
