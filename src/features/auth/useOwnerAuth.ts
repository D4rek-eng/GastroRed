import { useContext } from 'react'
import { OwnerAuthContext } from './ownerAuthContext'

export function useOwnerAuth() {
  const context = useContext(OwnerAuthContext)
  if (!context) throw new Error('useOwnerAuth debe usarse dentro de OwnerAuthProvider.')
  return context
}
