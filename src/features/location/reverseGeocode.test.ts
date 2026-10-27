import { afterEach, describe, expect, it, vi } from 'vitest'
import { reverseGeocode } from './reverseGeocode'

describe('reverse geocoding', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows Sullana and Piura instead of a generic Lima label', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        locality: 'Sullana',
        city: 'Sullana',
        principalSubdivision: 'Piura',
        countryName: 'Perú',
      }),
    }))

    const place = await reverseGeocode(-4.9039, -80.6853)
    expect(place.label).toBe('Sullana, Piura, Perú')
    expect(place.shortLabel).toBe('Sullana, Piura')
    expect(place.district).toBe('Sullana')
    expect(place.region).toBe('Piura')
  })

  it('uses the district and deduplicates repeated names', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        locality: 'Distrito de Miraflores',
        city: 'Lima',
        principalSubdivision: 'Lima',
        countryName: 'Perú',
      }),
    }))

    const place = await reverseGeocode(-12.1219, -77.0296)
    expect(place.label).toBe('Miraflores, Lima, Perú')
    expect(place.shortLabel).toBe('Miraflores, Lima')
  })
})
