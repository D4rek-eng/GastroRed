import type { Restaurant } from '../../types'
import { distanceBetweenLocations, formatDistance, type UserLocation } from '../location/location'

export const NEARBY_RADII = [200, 500, 1000] as const
export const DEFAULT_NEARBY_RADIUS = 200

const RESTAURANT_AMENITIES = new Set(['restaurant', 'cafe', 'fast_food', 'food_court', 'ice_cream'])
const QUERY_CACHE_PREFIX = 'mesa-nearby-v2:'
const PLACES_CACHE_KEY = 'mesa-osm-places-v2'
const WIKIDATA_CACHE_KEY = 'mesa-wikidata-images-v1'
const CACHE_TTL = 6 * 60 * 60 * 1000
const EMPTY_CACHE_TTL = 30 * 60 * 1000

type Origin = Pick<UserLocation, 'latitude' | 'longitude'> & Partial<Pick<UserLocation, 'district' | 'city' | 'region'>>

type RawOsmPlace = {
  type: 'node' | 'way' | 'relation'
  id: string
  latitude: number
  longitude: number
  tags: Record<string, string>
}

type CachedSearch = {
  savedAt: number
  radius: number
  places: Restaurant[]
}

export type NearbySearchResult = {
  places: Restaurant[]
  radiusUsed: number
  expanded: boolean
  fromCache: boolean
}

export class NearbyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NearbyError'
  }
}

const CUISINE_LABELS: Record<string, string> = {
  peruvian: 'Peruana',
  criolla: 'Criolla',
  seafood: 'Marina',
  fish: 'Marina',
  italian: 'Italiana',
  pizza: 'Pizzería',
  chinese: 'China',
  japanese: 'Japonesa',
  sushi: 'Sushi',
  chicken: 'Pollo',
  burger: 'Hamburguesas',
  coffee_shop: 'Café',
  coffee: 'Café',
  regional: 'Regional',
  mexican: 'Mexicana',
  vegetarian: 'Vegetariana',
  vegan: 'Vegana',
  ice_cream: 'Heladería',
  cake: 'Pastelería',
  sandwich: 'Sándwiches',
  breakfast: 'Desayuno',
  latin_american: 'Latinoamericana',
  american: 'Americana',
  spanish: 'Española',
  arab: 'Árabe',
  indian: 'India',
  thai: 'Tailandesa',
  asian: 'Asiática',
  french: 'Francesa',
  german: 'Alemana',
  greek: 'Griega',
  turkish: 'Turca',
  vietnamese: 'Vietnamita',
  korean: 'Coreana',
  grill: 'Parrilla',
  steak_house: 'Parrilla',
  barbecue: 'Parrilla',
  noodles: 'Fideos',
  ramen: 'Ramen',
  tapas: 'Tapas',
}

const AMENITY_LABELS: Record<string, string> = {
  restaurant: 'Restaurante',
  cafe: 'Cafetería',
  fast_food: 'Comida rápida',
  food_court: 'Patio de comidas',
  ice_cream: 'Heladería',
}

const DAY_LABELS: Record<string, string> = {
  Mo: 'Lun',
  Tu: 'Mar',
  We: 'Mié',
  Th: 'Jue',
  Fr: 'Vie',
  Sa: 'Sáb',
  Su: 'Dom',
  PH: 'Feriados',
}

function translateCuisine(tags: Record<string, string>) {
  const rawValues = (tags.cuisine ?? '')
    .split(/[;,]/)
    .map((value) => value.trim().toLocaleLowerCase('es'))
    .filter(Boolean)
  const translated = rawValues
    .slice(0, 2)
    .map((value) => CUISINE_LABELS[value] ?? value.charAt(0).toLocaleUpperCase('es') + value.slice(1))
  if (translated.length) return translated.join(' · ')
  return AMENITY_LABELS[tags.amenity] ?? 'Restaurante'
}

function buildAddress(tags: Record<string, string>) {
  const street = tags['addr:street']
  const number = tags['addr:housenumber']
  if (street) return [street, number].filter(Boolean).join(' ')
  return tags['addr:full'] || tags['addr:place'] || tags['addr:block'] || ''
}

function buildNeighborhood(tags: Record<string, string>, origin: Origin) {
  return tags['addr:suburb'] ||
    tags['addr:district'] ||
    tags['addr:city'] ||
    origin.district ||
    origin.city ||
    'Cerca de ti'
}

function buildCity(tags: Record<string, string>, origin: Origin) {
  return tags['addr:city'] || tags['addr:town'] || tags['addr:village'] || origin.city || origin.district || ''
}

function buildTags(tags: Record<string, string>, cuisine: string) {
  const result = [cuisine]
  if (tags.outdoor_seating === 'yes') result.push('Terraza')
  if (tags.takeaway === 'yes' || tags['takeaway:delivery'] === 'yes') result.push('Para llevar')
  if (tags.delivery === 'yes') result.push('Delivery')
  if (tags.wheelchair === 'yes') result.push('Accesible')
  result.push('Datos OSM')
  return result.slice(0, 4)
}

export function formatOpeningHours(raw?: string) {
  if (!raw) return 'Horario no registrado'
  const translated = raw
    .replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su|PH)\b/g, (day) => DAY_LABELS[day] ?? day)
    .replace(/(Lun|Mar|Mié|Jue|Vie|Sáb|Dom|Feriados)-(Lun|Mar|Mié|Jue|Vie|Sáb|Dom|Feriados)/g, '$1–$2')
    .replace(/(\b(?:Lun|Mar|Mié|Jue|Vie|Sáb|Dom|Feriados)(?:–(?:Lun|Mar|Mié|Jue|Vie|Sáb|Dom|Feriados))?)\s+(\d{1,2}:\d{2})/g, '$1 · $2')
    .replace(/(\d{1,2}:\d{2})-(\d{1,2}:\d{2})/g, '$1–$2')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim()
  return translated.length > 90 ? `${translated.slice(0, 87)}…` : translated
}

export function commonsFileUrl(file: string, width = 1200) {
  const name = file.replace(/^File:/i, '').trim()
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(name)}?width=${width}`
}

function directImageFromTags(tags: Record<string, string>) {
  const direct = tags.image || tags['image:url']
  if (direct && /^https?:\/\//i.test(direct)) return direct
  const commons = tags.wikimedia_commons
  if (commons && !/^Category:/i.test(commons)) return commonsFileUrl(commons)
  return null
}

function readImageCache(): Record<string, { url: string; savedAt: number }> {
  try {
    const parsed = JSON.parse(localStorage.getItem(WIKIDATA_CACHE_KEY) ?? '{}') as Record<string, { url: string; savedAt: number }>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

async function resolveWikidataImages(rawPlaces: RawOsmPlace[], signal?: AbortSignal) {
  const images = new Map<string, string>()
  const cached = readImageCache()
  const missing = new Set<string>()

  for (const place of rawPlaces) {
    if (directImageFromTags(place.tags)) continue
    for (const key of ['wikidata', 'brand:wikidata']) {
      const qid = place.tags[key]
      if (!qid || !/^Q\d+$/.test(qid)) continue
      const cachedImage = cached[qid]
      if (cachedImage && Date.now() - cachedImage.savedAt < CACHE_TTL * 24) {
        images.set(qid, cachedImage.url)
      } else {
        missing.add(qid)
      }
    }
  }

  if (!missing.size) return images

  try {
    const ids = [...missing].slice(0, 40)
    const url = new URL('https://www.wikidata.org/w/api.php')
    url.searchParams.set('action', 'wbgetentities')
    url.searchParams.set('format', 'json')
    url.searchParams.set('origin', '*')
    url.searchParams.set('props', 'claims')
    url.searchParams.set('ids', ids.join('|'))

    const response = await fetchWithTimeout(url.toString(), { signal, headers: { Accept: 'application/json' } }, 8_000)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = (await response.json()) as {
      entities?: Record<string, { claims?: Record<string, { mainsnak?: { datavalue?: { value?: unknown } } }[]> }>
    }

    for (const qid of ids) {
      const claim = data.entities?.[qid]?.claims?.P18?.[0]?.mainsnak?.datavalue?.value
      if (typeof claim === 'string') {
        images.set(qid, commonsFileUrl(claim))
        cached[qid] = { url: commonsFileUrl(claim), savedAt: Date.now() }
      }
    }
    localStorage.setItem(WIKIDATA_CACHE_KEY, JSON.stringify(cached))
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError' && signal?.aborted) throw error
    // Real photos are optional; venues without one get a neutral placeholder, never a fake photo.
  }

  return images
}

async function buildRestaurants(
  rawPlaces: RawOsmPlace[],
  origin: Origin,
  radius: number,
  signal?: AbortSignal,
): Promise<Restaurant[]> {
  const wikidataImages = await resolveWikidataImages(rawPlaces, signal)
  const result: Restaurant[] = []

  for (const place of rawPlaces) {
    const tags = place.tags
    const name = tags.name || tags['name:es'] || tags['name:en'] || tags.brand
    if (!name) continue

    const distanceKm = distanceBetweenLocations(origin, {
      latitude: place.latitude,
      longitude: place.longitude,
    })
    if (distanceKm * 1000 > radius) continue

    const cuisine = translateCuisine(tags)
    const amenity = tags.amenity
    if (!RESTAURANT_AMENITIES.has(amenity)) continue
    const realImage = directImageFromTags(tags) ||
      wikidataImages.get(tags.wikidata ?? '') ||
      wikidataImages.get(tags['brand:wikidata'] ?? '') ||
      null
    const address = buildAddress(tags)
    const neighborhood = buildNeighborhood(tags, origin)
    const hours = formatOpeningHours(tags.opening_hours)
    const distanceLabel = formatDistance(distanceKm)
    const description = [
      `${cuisine} a ${distanceLabel} de tu ubicación`,
      address ? `en ${address}` : `en ${neighborhood}`,
      'Información de OpenStreetMap.',
    ].join(' ')

    result.push({
      id: `osm-${place.type}-${place.id}`,
      name,
      cuisine,
      neighborhood,
      city: buildCity(tags, origin),
      latitude: place.latitude,
      longitude: place.longitude,
      description,
      image: realImage ?? '',
      photos: realImage
        ? [{ src: realImage, alt: `Fotografía de ${name}`, credit: 'Wikimedia Commons' }]
        : [],
      imageCredit: realImage ? 'Foto: Wikimedia Commons' : undefined,
      rating: 0,
      reviewCount: 0,
      pricePerPerson: 0,
      distanceKm,
      tags: buildTags(tags, cuisine),
      hours,
      availableTimes: [],
      menuHighlights: [],
      ambience: tags.outdoor_seating === 'yes' ? 'Terraza · Datos de OpenStreetMap' : 'Datos abiertos de OpenStreetMap',
      reservationPolicy: 'Reserva directamente con el restaurante',
      source: 'osm',
      address: address || undefined,
      website: tags.website || tags['contact:website'] || undefined,
      phone: tags.phone || tags['contact:phone'] || undefined,
      osmUrl: `https://www.openstreetmap.org/${place.type}/${place.id}`,
    })
  }

  return result.sort((a, b) => a.distanceKm - b.distanceKm)
}

function bboxAround(origin: Origin, radiusMeters: number) {
  const latitudeDelta = radiusMeters / 111_320
  const longitudeDelta = radiusMeters / (111_320 * Math.cos((origin.latitude * Math.PI) / 180))
  return [
    origin.longitude - longitudeDelta,
    origin.latitude - latitudeDelta,
    origin.longitude + longitudeDelta,
    origin.latitude + latitudeDelta,
  ].map((value) => value.toFixed(7)).join(',')
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number) {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  const signal = options.signal
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    window.clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }
}

function parseOsmXml(xml: string): RawOsmPlace[] {
  const document = new DOMParser().parseFromString(xml, 'application/xml')
  if (document.querySelector('parsererror')) {
    throw new NearbyError('OpenStreetMap devolvió una respuesta que no pudimos leer.')
  }

  const nodes = new Map<string, { latitude: number; longitude: number }>()
  const allWays = new Map<string, { latitude: number; longitude: number }[]>()

  for (const node of document.querySelectorAll('node')) {
    const id = node.getAttribute('id')
    const latitude = Number(node.getAttribute('lat'))
    const longitude = Number(node.getAttribute('lon'))
    if (id && Number.isFinite(latitude) && Number.isFinite(longitude)) {
      nodes.set(id, { latitude, longitude })
    }
  }

  for (const way of document.querySelectorAll('way')) {
    const id = way.getAttribute('id')
    if (!id) continue
    const coordinates = [...way.querySelectorAll('nd')]
      .map((node) => nodes.get(node.getAttribute('ref') ?? ''))
      .filter((point): point is { latitude: number; longitude: number } => Boolean(point))
    allWays.set(id, coordinates)
  }

  const places: RawOsmPlace[] = []
  const pushPlace = (type: RawOsmPlace['type'], id: string, latitude: number, longitude: number, tags: Record<string, string>) => {
    if (!RESTAURANT_AMENITIES.has(tags.amenity)) return
    places.push({ type, id, latitude, longitude, tags })
  }
  const readTags = (element: Element) => {
    const tags: Record<string, string> = {}
    for (const tag of element.querySelectorAll('tag')) {
      const key = tag.getAttribute('k')
      const value = tag.getAttribute('v')
      if (key && value) tags[key] = value
    }
    return tags
  }
  const average = (points: { latitude: number; longitude: number }[]) => {
    if (!points.length) return null
    return {
      latitude: points.reduce((total, point) => total + point.latitude, 0) / points.length,
      longitude: points.reduce((total, point) => total + point.longitude, 0) / points.length,
    }
  }

  for (const node of document.querySelectorAll('node')) {
    const id = node.getAttribute('id')
    const point = id ? nodes.get(id) : null
    if (!id || !point) continue
    pushPlace('node', id, point.latitude, point.longitude, readTags(node))
  }

  for (const way of document.querySelectorAll('way')) {
    const id = way.getAttribute('id')
    const center = average(id ? allWays.get(id) ?? [] : [])
    if (!id || !center) continue
    pushPlace('way', id, center.latitude, center.longitude, readTags(way))
  }

  for (const relation of document.querySelectorAll('relation')) {
    const id = relation.getAttribute('id')
    if (!id) continue
    const points: { latitude: number; longitude: number }[] = []
    for (const member of relation.querySelectorAll('member')) {
      const ref = member.getAttribute('ref')
      if (!ref) continue
      if (member.getAttribute('type') === 'node') {
        const point = nodes.get(ref)
        if (point) points.push(point)
      } else if (member.getAttribute('type') === 'way') {
        points.push(...(allWays.get(ref) ?? []))
      }
    }
    const center = average(points)
    if (center) pushPlace('relation', id, center.latitude, center.longitude, readTags(relation))
  }

  return places
}

function parseOverpassJson(data: {
  elements?: {
    type: 'node' | 'way' | 'relation'
    id: number
    lat?: number
    lon?: number
    center?: { lat?: number; lon?: number }
    tags?: Record<string, string>
  }[]
}): RawOsmPlace[] {
  return (data.elements ?? [])
    .map((element) => {
      const latitude = element.lat ?? element.center?.lat
      const longitude = element.lon ?? element.center?.lon
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !element.tags) return null
      return {
        type: element.type,
        id: String(element.id),
        latitude: latitude as number,
        longitude: longitude as number,
        tags: element.tags,
      }
    })
    .filter((place): place is RawOsmPlace => Boolean(place))
}

async function fetchOsmApi(origin: Origin, radius: number, signal?: AbortSignal) {
  const url = new URL('https://api.openstreetmap.org/api/0.6/map')
  url.searchParams.set('bbox', bboxAround(origin, radius))
  const response = await fetchWithTimeout(url.toString(), {
    signal,
    headers: { Accept: 'application/xml' },
  }, 20_000)
  if (!response.ok) throw new NearbyError(`OpenStreetMap respondió HTTP ${response.status}.`)
  return parseOsmXml(await response.text())
}

async function fetchOverpass(origin: Origin, radius: number, signal?: AbortSignal) {
  const query = `[out:json][timeout:20];(nwr["amenity"~"^(restaurant|cafe|fast_food|food_court|ice_cream)$"](around:${radius},${origin.latitude},${origin.longitude}););out center tags;`
  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
  ]
  let lastError: unknown = null

  for (const endpoint of endpoints) {
    try {
      const response = await fetchWithTimeout(endpoint, {
        signal,
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ data: query }),
      }, 12_000)
      if (!response.ok) throw new NearbyError(`Overpass respondió HTTP ${response.status}.`)
      const data = await response.json() as Parameters<typeof parseOverpassJson>[0]
      return parseOverpassJson(data)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError' && signal?.aborted) throw error
      lastError = error
    }
  }

  throw new NearbyError(
    lastError instanceof Error
      ? `No pudimos consultar los mapas abiertos: ${lastError.message}`
      : 'No pudimos consultar los mapas abiertos.',
  )
}

async function fetchRawPlaces(origin: Origin, radius: number, signal?: AbortSignal) {
  if (radius <= 500) {
    try {
      return await fetchOsmApi(origin, radius, signal)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError' && signal?.aborted) throw error
    }
  }
  return fetchOverpass(origin, radius, signal)
}

function cacheKey(origin: Origin, radius: number) {
  return `${QUERY_CACHE_PREFIX}${origin.latitude.toFixed(4)}:${origin.longitude.toFixed(4)}:${radius}`
}

function readSearchCache(key: string, maxAge: number): CachedSearch | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? 'null') as CachedSearch | null
    if (!parsed || !Array.isArray(parsed.places) || Date.now() - parsed.savedAt > maxAge) return null
    return parsed
  } catch {
    return null
  }
}

function writeSearchCache(key: string, radius: number, places: Restaurant[]) {
  try {
    localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), radius, places }))
  } catch {
    // Storage may be full or disabled; nearby search still works.
  }
}

export function rememberNearbyPlaces(places: Restaurant[]) {
  try {
    const parsed = JSON.parse(localStorage.getItem(PLACES_CACHE_KEY) ?? '{}') as Record<string, Restaurant>
    for (const place of places) parsed[place.id] = place
    const entries = Object.entries(parsed)
      .sort(([, a], [, b]) => a.distanceKm - b.distanceKm)
      .slice(0, 200)
    localStorage.setItem(PLACES_CACHE_KEY, JSON.stringify(Object.fromEntries(entries)))
  } catch {
    // Ignore storage errors.
  }
}

export function getStoredNearbyPlace(id: string): Restaurant | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(PLACES_CACHE_KEY) ?? '{}') as Record<string, Restaurant>
    return parsed[id] ?? null
  } catch {
    return null
  }
}

export function getStoredNearbyPlaces(): Restaurant[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(PLACES_CACHE_KEY) ?? '{}') as Record<string, Restaurant>
    return Object.values(parsed)
  } catch {
    return []
  }
}

/**
 * Finds restaurants around the user coordinates.
 * `expand` widens the radius only when the original radius has no results.
 */
export async function searchNearby(
  origin: Origin,
  radius: number,
  options: { expand?: boolean; signal?: AbortSignal } = {},
): Promise<NearbySearchResult> {
  const attempts = options.expand
    ? [...new Set([radius, ...NEARBY_RADII.filter((candidate) => candidate > radius && candidate <= 1000)])]
    : [radius]
  let lastError: unknown = null

  for (const attempt of attempts) {
    const key = cacheKey(origin, attempt)
    const cached = readSearchCache(key, CACHE_TTL)
    if (cached && (cached.places.length > 0 || Date.now() - cached.savedAt < EMPTY_CACHE_TTL)) {
      if (cached.places.length > 0 || !options.expand) {
        rememberNearbyPlaces(cached.places)
        return {
          places: cached.places,
          radiusUsed: attempt,
          expanded: attempt !== radius,
          fromCache: true,
        }
      }
      if (attempt === attempts[attempts.length - 1]) {
        return {
          places: [],
          radiusUsed: attempt,
          expanded: attempt !== radius,
          fromCache: true,
        }
      }
      continue
    }

    try {
      const rawPlaces = await fetchRawPlaces(origin, attempt, options.signal)
      const places = await buildRestaurants(rawPlaces, origin, attempt, options.signal)
      writeSearchCache(key, attempt, places)
      rememberNearbyPlaces(places)
      if (places.length || !options.expand) {
        return {
          places,
          radiusUsed: attempt,
          expanded: attempt !== radius,
          fromCache: false,
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError' && options.signal?.aborted) {
        throw error
      }
      lastError = error
      const stale = readSearchCache(key, CACHE_TTL * 7)
      if (stale) {
        rememberNearbyPlaces(stale.places)
        return {
          places: stale.places,
          radiusUsed: attempt,
          expanded: attempt !== radius,
          fromCache: true,
        }
      }
      break
    }
  }

  if (lastError) {
    throw lastError instanceof Error
      ? lastError
      : new NearbyError('No pudimos consultar los restaurantes cercanos.')
  }

  return {
    places: [],
    radiusUsed: radius,
    expanded: false,
    fromCache: false,
  }
}

/** Returns nearby places already fetched, useful for favorites and detail pages. */
export function mergeNearbyWithDemo(demo: Restaurant[]) {
  return [...demo, ...getStoredNearbyPlaces()]
}
