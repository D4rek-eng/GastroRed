export type ReverseGeocodedPlace = {
  label: string
  shortLabel: string
  district?: string
  city?: string
  region?: string
  country?: string
}

type BigDataCloudResponse = {
  city?: string
  locality?: string
  principalSubdivision?: string
  countryName?: string
  localityInfo?: {
    administrative?: { name?: string; adminLevel?: number; order?: number }[]
  }
}

type NominatimResponse = {
  display_name?: string
  address?: Record<string, string | undefined>
}

const uniqueParts = (parts: (string | undefined)[]) => {
  const seen = new Set<string>()
  return parts.filter((part): part is string => {
    const value = part?.trim()
    if (!value) return false
    const key = value.toLocaleLowerCase('es')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function cleanAdministrativeName(value?: string) {
  return value
    ?.replace(/^distrito\s+de\s+/i, '')
    .replace(/^provincia\s+de\s+/i, '')
    .replace(/^municipalidad\s+(metropolitana\s+)?de\s+/i, '')
    .trim()
}

function buildPlace(input: {
  district?: string
  city?: string
  region?: string
  country?: string
}): ReverseGeocodedPlace {
  const district = cleanAdministrativeName(input.district)
  const city = cleanAdministrativeName(input.city)
  const region = cleanAdministrativeName(input.region)
  const country = input.country?.trim()

  const locality = district && district.toLocaleLowerCase('es') !== city?.toLocaleLowerCase('es')
    ? district
    : city
  const labelParts = uniqueParts([locality, city, region, country])
  const shortParts = uniqueParts([locality, region]).slice(0, 2)

  return {
    label: labelParts.join(', '),
    shortLabel: shortParts.join(', '),
    district,
    city,
    region,
    country,
  }
}

async function fetchJson<T>(url: string, signal: AbortSignal | undefined, timeoutMs: number): Promise<T> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })

  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return (await response.json()) as T
  } finally {
    window.clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }
}

async function reverseWithBigDataCloud(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<ReverseGeocodedPlace | null> {
  const url = new URL('https://api.bigdatacloud.net/data/reverse-geocode-client')
  url.searchParams.set('latitude', String(latitude))
  url.searchParams.set('longitude', String(longitude))
  url.searchParams.set('localityLanguage', 'es')

  const place = await fetchJson<BigDataCloudResponse>(url.toString(), signal, 7_000)
  if (!place.locality && !place.city && !place.principalSubdivision) return null

  const districtName = place.localityInfo?.administrative
    ?.filter((item) => (item.adminLevel ?? 0) >= 7)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .at(-1)?.name

  return buildPlace({
    district: place.locality ?? districtName,
    city: place.city,
    region: place.principalSubdivision,
    country: place.countryName,
  })
}

async function reverseWithNominatim(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<ReverseGeocodedPlace | null> {
  const url = new URL('https://nominatim.openstreetmap.org/reverse')
  url.searchParams.set('lat', String(latitude))
  url.searchParams.set('lon', String(longitude))
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('zoom', '16')
  url.searchParams.set('addressdetails', '1')
  url.searchParams.set('accept-language', 'es')

  const place = await fetchJson<NominatimResponse>(url.toString(), signal, 7_000)
  const address = place.address
  if (!address) return null

  const district = address.city_district || address.district || address.suburb || address.neighbourhood || address.borough
  const city = address.city || address.town || address.municipality || address.village
  const region = address.state || address.region || address.county
  const result = buildPlace({ district, city, region, country: address.country })

  if (!result.label && place.display_name) {
    const fallback = place.display_name.split(',').map((part) => part.trim()).filter(Boolean)
    return {
      ...result,
      label: fallback.slice(0, 3).join(', '),
      shortLabel: fallback.slice(0, 2).join(', '),
    }
  }
  return result.label ? result : null
}

/**
 * Resolves the coordinates to a readable district/city label.
 * BigDataCloud is faster; Nominatim is the fallback and tends to expose
 * district-level names (for example "Sullana" instead of a generic region).
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<ReverseGeocodedPlace> {
  for (const resolver of [reverseWithBigDataCloud, reverseWithNominatim]) {
    try {
      const result = await resolver(latitude, longitude, signal)
      if (result?.label) return result
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError' && signal?.aborted) {
        throw error
      }
    }
  }
  return { label: '', shortLabel: '', district: undefined, city: undefined, region: undefined, country: undefined }
}
