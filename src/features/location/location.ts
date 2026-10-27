import { createContext } from 'react'

export type UserLocation = {
  latitude: number
  longitude: number
  /** Accuracy radius reported by the browser, in meters. */
  accuracy: number
  label: string
  /** Short label for compact UI, e.g. "Sullana, Piura". */
  shortLabel: string
  district?: string
  city?: string
  region?: string
  country?: string
}

export type LocationContextValue = {
  location: UserLocation | null
  isLocating: boolean
  error: string
  requestLocation: () => void
  clearLocation: () => void
}

export const LocationContext = createContext<LocationContextValue | null>(null)

export function formatAccuracy(accuracy: number) {
  if (!Number.isFinite(accuracy) || accuracy <= 0) return ''
  if (accuracy < 1000) return `±${Math.round(accuracy)} m`
  return `±${(accuracy / 1000).toLocaleString('es-PE', { maximumFractionDigits: 1 })} km`
}

export function distanceBetweenLocations(
  origin: Pick<UserLocation, 'latitude' | 'longitude'>,
  destination: Pick<UserLocation, 'latitude' | 'longitude'>,
) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180
  const latitudeDifference = radians(destination.latitude - origin.latitude)
  const longitudeDifference = radians(destination.longitude - origin.longitude)
  const haversine =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(radians(origin.latitude)) *
      Math.cos(radians(destination.latitude)) *
      Math.sin(longitudeDifference / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
}

/** Distance in a human-friendly unit: meters under 1 km, kilometers above. */
export function formatDistance(km: number) {
  if (!Number.isFinite(km)) return 'Distancia no disponible'
  if (km < 1) return `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m`
  return `${km.toFixed(km < 10 ? 1 : 0)} km`
}
