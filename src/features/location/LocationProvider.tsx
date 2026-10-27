import { useMemo, useRef, useState, type ReactNode } from 'react'
import { LocationContext, type UserLocation } from './location'
import { reverseGeocode } from './reverseGeocode'

const GENERIC_LABEL = 'Mi ubicación'

export function LocationProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState<UserLocation | null>(null)
  const [isLocating, setIsLocating] = useState(false)
  const [error, setError] = useState('')
  const requestId = useRef(0)

  function clearLocation() {
    requestId.current += 1
    setLocation(null)
    setError('')
  }

  function requestLocation() {
    if (!window.isSecureContext) {
      setError('Para solicitar el permiso de ubicación, abre el sitio mediante HTTPS.')
      return
    }
    if (!navigator.geolocation) {
      setError('Este navegador no permite compartir la ubicación.')
      return
    }

    const currentRequest = requestId.current + 1
    requestId.current = currentRequest
    setIsLocating(true)
    setError('')

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const coordinates = {
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: Number.isFinite(coords.accuracy) ? coords.accuracy : 0,
        }
        const baseLocation: UserLocation = {
          ...coordinates,
          label: 'Ubicando tu zona…',
          shortLabel: GENERIC_LABEL,
        }
        setLocation(baseLocation)
        setIsLocating(false)

        reverseGeocode(coords.latitude, coords.longitude)
          .then((place) => {
            if (requestId.current !== currentRequest) return
            setLocation({
              ...baseLocation,
              ...place,
              label: place.label || GENERIC_LABEL,
              shortLabel: place.shortLabel || GENERIC_LABEL,
            })
          })
          .catch(() => {
            if (requestId.current !== currentRequest) return
            setLocation((current) => current
              ? { ...current, label: GENERIC_LABEL, shortLabel: GENERIC_LABEL }
              : current)
            setError('Se obtuvo tu ubicación, pero no se pudo identificar el distrito. Puedes seguir buscando restaurantes cercanos.')
          })
      },
      (geolocationError) => {
        if (requestId.current !== currentRequest) return
        setIsLocating(false)
        setError(
          geolocationError.code === geolocationError.PERMISSION_DENIED
            ? 'El permiso de ubicación está bloqueado. Cambia Ubicación a “Permitir” en los ajustes del sitio de tu navegador y vuelve a intentarlo.'
            : geolocationError.code === geolocationError.POSITION_UNAVAILABLE
              ? 'No se pudo determinar tu ubicación. Revisa que la ubicación precisa del dispositivo esté activa.'
              : 'La solicitud de ubicación tardó demasiado. Inténtalo de nuevo.',
        )
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    )
  }

  const value = useMemo(
    () => ({ location, isLocating, error, requestLocation, clearLocation }),
    [location, isLocating, error],
  )

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>
}
