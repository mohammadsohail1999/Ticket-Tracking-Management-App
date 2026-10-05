import axios from 'axios'

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

// Relative /api/... paths only — Vite proxies them to the backend, so no baseURL.
// Cookies are same-origin, so no withCredentials either.
export const api = axios.create()

// Normalise every failure to ApiError. `status` is 0 when there was no response
// (network error), which the query client treats as retryable.
api.interceptors.response.use(undefined, (error: unknown) => {
  if (axios.isAxiosError<{ error?: string }>(error)) {
    throw new ApiError(
      error.response?.data?.error ?? error.message,
      error.response?.status ?? 0,
    )
  }
  throw error
})
