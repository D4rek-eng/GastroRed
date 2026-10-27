import { useContext } from 'react'
import { LocationContext } from './location'

export function useUserLocation() {
  const context = useContext(LocationContext)
  if (!context) throw new Error('useUserLocation debe usarse dentro de LocationProvider.')
  return context
}
