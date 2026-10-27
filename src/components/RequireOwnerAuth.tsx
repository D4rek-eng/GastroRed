import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useOwnerAuth } from '../features/auth/useOwnerAuth'

export function RequireOwnerAuth({ children }: { children: ReactNode }) {
  const { session, isLoading, error } = useOwnerAuth()
  const location = useLocation()

  if (isLoading) return <div className="page-container loading-copy">Verificando acceso…</div>
  if (error) return <div className="page-container state-card" role="alert"><strong>{error}</strong></div>
  if (!session) {
    return <Navigate to="/propietario/login" replace state={{ from: location.pathname }} />
  }
  return children
}
