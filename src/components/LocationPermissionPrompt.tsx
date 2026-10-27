import { useEffect, useState } from 'react'
import { MapPin, X } from 'lucide-react'
import { useUserLocation } from '../features/location/useUserLocation'

const DISMISS_KEY = 'mesa-location-prompt-dismissed'

export function LocationPermissionPrompt() {
  const { location, isLocating, error, requestLocation } = useUserLocation()
  const [isOpen, setIsOpen] = useState(false)
  const [wasDismissed, setWasDismissed] = useState(false)

  useEffect(() => {
    if (wasDismissed || location) return
    if (sessionStorage.getItem(DISMISS_KEY) === '1') return
    if (!('geolocation' in navigator)) return

    let cancelled = false
    let timer = 0

    const showPrompt = () => {
      timer = window.setTimeout(() => {
        if (!cancelled) setIsOpen(true)
      }, 1_200)
    }

    if ('permissions' in navigator) {
      navigator.permissions
        .query({ name: 'geolocation' })
        .then((status) => {
          if (cancelled || status.state === 'granted' || status.state === 'denied') return
          showPrompt()
        })
        .catch(showPrompt)
    } else {
      showPrompt()
    }

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [location, wasDismissed])

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, '1')
    setWasDismissed(true)
    setIsOpen(false)
  }

  if (!isOpen || location) return null

  return (
    <aside
      className="location-prompt"
      role="dialog"
      aria-labelledby="location-prompt-title"
      aria-describedby="location-prompt-description"
    >
      <button className="location-prompt-close" type="button" aria-label="Cerrar aviso de ubicación" onClick={dismiss}>
        <X size={16} />
      </button>
      <span className="location-prompt-icon"><MapPin size={20} /></span>
      <div>
        <strong id="location-prompt-title">¿Activo tu ubicación?</strong>
        <p id="location-prompt-description">
          Así ordenamos los restaurantes por distancia y te mostramos los locales que hay cerca de ti.
          Tu navegador te pedirá permiso y luego podrás desactivarlo cuando quieras. No guardamos tus coordenadas.
        </p>
        {error && <p className="location-prompt-error" role="alert">{error}</p>}
        <div className="location-prompt-actions">
          <button className="button button-primary" type="button" onClick={requestLocation} disabled={isLocating}>
            <MapPin size={15} /> {isLocating ? 'Buscando…' : 'Permitir ubicación'}
          </button>
          <button className="button button-outline" type="button" onClick={dismiss}>Ahora no</button>
        </div>
      </div>
    </aside>
  )
}
