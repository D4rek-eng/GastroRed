import type { ApiErrorBody } from '../../types'

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

export class ApiError extends Error {
  readonly status: number
  readonly details?: Record<string, string[]>

  constructor(
    message: string,
    status: number,
    details?: Record<string, string[]>,
  ) {
    super(message)
    this.status = status
    this.details = details
    this.name = 'ApiError'
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  if (!apiBaseUrl) {
    throw new ApiError('La API no está configurada. Activa el modo demo o configura VITE_API_BASE_URL.', 0)
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
    credentials: 'include',
  })

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody
    throw new ApiError(
      body.message ?? `La solicitud no pudo completarse (HTTP ${response.status}).`,
      response.status,
      body.errors,
    )
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}
