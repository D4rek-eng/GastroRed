import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from './client'

describe('API client', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses the same-origin API when no separate API base URL is configured', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'ok' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiRequest('/api/v1/auth/session')).resolves.toEqual({ status: 'ok' })
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/auth/session', expect.objectContaining({
      credentials: 'include',
    }))
  })
})
