import axios, { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'

const ACCESS_TOKEN_KEY = 'auth_access_token'
const REFRESH_TOKEN_KEY = 'auth_refresh_token'

let unauthorizedHandler: (() => void) | null = null
let tokenRefreshedHandler: ((tokens: {
  accessToken: string
  refreshToken: string
}) => void) | null = null

type RetriableRequestConfig = InternalAxiosRequestConfig & { _retry?: boolean }

let refreshPromise: Promise<string | null> | null = null

export const authTokenStorage = {
  get(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY)
  },
  set(token: string): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, token)
  },
  clear(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY)
  },
}

export const refreshTokenStorage = {
  get(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY)
  },
  set(token: string): void {
    localStorage.setItem(REFRESH_TOKEN_KEY, token)
  },
  clear(): void {
    localStorage.removeItem(REFRESH_TOKEN_KEY)
  },
}

export function clearStoredTokens(): void {
  authTokenStorage.clear()
  refreshTokenStorage.clear()
}

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler
}

export function setTokenRefreshedHandler(
  handler:
    | ((tokens: { accessToken: string; refreshToken: string }) => void)
    | null,
): void {
  tokenRefreshedHandler = handler
}

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  timeout: 15000,
})

apiClient.interceptors.request.use((config) => {
  const token = authTokenStorage.get()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config as RetriableRequestConfig | undefined
    const isUnauthorized = error?.response?.status === 401
    const requestUrl =
      typeof error?.config?.url === 'string' ? error.config.url : ''
    const isAuthEndpoint =
      typeof error?.config?.url === 'string' &&
      (requestUrl.includes('/auth/login') ||
        requestUrl.includes('/auth/refresh') ||
        requestUrl.includes('/auth/logout'))

    if (isUnauthorized && originalRequest && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true

      if (!refreshPromise) {
        refreshPromise = (async () => {
          const refreshToken = refreshTokenStorage.get()
          if (!refreshToken) {
            return null
          }

          try {
            const refreshResponse = await apiClient.post<{
              accessToken: string
              refreshToken: string
            }>('/auth/refresh', { refreshToken })

            authTokenStorage.set(refreshResponse.data.accessToken)
            refreshTokenStorage.set(refreshResponse.data.refreshToken)
            tokenRefreshedHandler?.({
              accessToken: refreshResponse.data.accessToken,
              refreshToken: refreshResponse.data.refreshToken,
            })
            return refreshResponse.data.accessToken
          } catch {
            return null
          }
        })().finally(() => {
          refreshPromise = null
        })
      }

      const newAccessToken = await refreshPromise
      if (newAccessToken) {
        originalRequest.headers = AxiosHeaders.from(originalRequest.headers)
        originalRequest.headers.set('Authorization', `Bearer ${newAccessToken}`)
        return apiClient.request(originalRequest)
      }

      clearStoredTokens()
      unauthorizedHandler?.()
    } else if (
      isUnauthorized &&
      isAuthEndpoint &&
      (requestUrl.includes('/auth/refresh') || requestUrl.includes('/auth/logout'))
    ) {
      clearStoredTokens()
      unauthorizedHandler?.()
    }

    const message =
      error?.response?.data?.message ?? 'Có lỗi xảy ra, vui lòng thử lại.'

    return Promise.reject(new Error(message))
  },
)
