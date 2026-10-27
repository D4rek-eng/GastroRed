import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getStoredNearbyPlace, searchNearby } from './nearby'

const osmXml = `<?xml version="1.0" encoding="UTF-8"?>
<osm version="0.6">
  <node id="1" lat="-4.9029" lon="-80.6853">
    <tag k="amenity" v="restaurant"/>
    <tag k="name" v="Chifles Marisol"/>
    <tag k="cuisine" v="seafood"/>
    <tag k="opening_hours" v="Mo-Sa 08:00-20:00"/>
  </node>
  <node id="3" lat="-4.9046" lon="-80.6846"/>
  <node id="4" lat="-4.9044" lon="-80.6844"/>
  <way id="10">
    <nd ref="3"/>
    <nd ref="4"/>
    <tag k="amenity" v="restaurant"/>
    <tag k="name" v="Restaurante Mi Perlita"/>
    <tag k="cuisine" v="peruvian"/>
    <tag k="addr:street" v="Calle Santa Cruz"/>
    <tag k="addr:housenumber" v="821"/>
  </way>
  <node id="99" lat="-4.95" lon="-80.75">
    <tag k="amenity" v="restaurant"/>
    <tag k="name" v="Demasiado lejos"/>
  </node>
</osm>`

const origin = {
  latitude: -4.9039,
  longitude: -80.6853,
  district: 'Sullana',
  city: 'Sullana',
  region: 'Piura',
}

describe('nearby restaurants', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('parses named restaurants from OpenStreetMap, filters by radius and caches them', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => osmXml,
      json: async () => ({}),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await searchNearby(origin, 500)

    expect(result.places).toHaveLength(2)
    expect(result.places.map((place) => place.name)).toEqual(['Restaurante Mi Perlita', 'Chifles Marisol'])
    expect(result.places.every((place) => place.source === 'osm')).toBe(true)
    expect(result.places.every((place) => place.image === '')).toBe(true)
    expect(result.places.every((place) => place.photos?.length === 0)).toBe(true)
    const chifles = result.places.find((place) => place.name === 'Chifles Marisol')!
    expect(chifles.distanceKm).toBeLessThan(0.2)
    expect(chifles.hours).toBe('Lun–Sáb · 08:00–20:00')
    expect(result.places[0].address).toBe('Calle Santa Cruz 821')
    expect(result.places.some((place) => place.name === 'Demasiado lejos')).toBe(false)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('api.openstreetmap.org/api/0.6/map'),
      expect.anything(),
    )

    expect(getStoredNearbyPlace('osm-node-1')?.name).toBe('Chifles Marisol')
  })

  it('expands only when the requested radius has no restaurants', async () => {
    const emptyMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '<osm version="0.6"></osm>',
      json: async () => ({}),
    })
    vi.stubGlobal('fetch', emptyMock)

    const strict = await searchNearby(origin, 200)
    expect(strict.places).toHaveLength(0)
    expect(emptyMock).toHaveBeenCalledTimes(1)

    localStorage.clear()
    let call = 0
    const expandingMock = vi.fn().mockImplementation(() => {
      call += 1
      return Promise.resolve({
        ok: true,
        status: 200,
        text: async () => call === 1
          ? '<osm version="0.6"></osm>'
          : `<osm version="0.6"><node id="1" lat="-4.9029" lon="-80.6853"><tag k="amenity" v="restaurant"/><tag k="name" v="Cerca"/></node></osm>`,
        json: async () => ({}),
      })
    })
    vi.stubGlobal('fetch', expandingMock)

    const expanded = await searchNearby(origin, 200, { expand: true })
    expect(expanded.radiusUsed).toBe(500)
    expect(expanded.expanded).toBe(true)
    expect(expanded.places).toHaveLength(1)
  })
})
