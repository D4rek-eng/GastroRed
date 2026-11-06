import { useState } from 'react'
import { ArrowRight, BadgeCheck, LogOut, UserRound } from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'
import { useOwnerAuth } from '../features/auth/useOwnerAuth'

export function AccountPage() {
  const { session, isLoading, signOut, startCheckout } = useOwnerAuth()
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (isLoading) return <div className="page-container loading-copy">Verificando sesión…</div>
  if (!session) return <Navigate to="/login" replace />
  if (session.role === 'restaurant' || session.restaurantIds.length > 0) return <Navigate to="/propietario" replace />

  async function upgrade() {
    setError('')
    setIsSubmitting(true)
    try {
      const checkout = await startCheckout('pro')
      window.location.assign(checkout.url)
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : 'No se pudo iniciar el pago.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="page-container owner-login-page">
      <section className="owner-login-card account-status-card">
        <span className="owner-icon"><UserRound size={21} /></span>
        <span className="eyebrow">TU CUENTA GASTRORED</span>
        <h1>Hola, <em>{session.name ?? session.email.split('@')[0]}.</em></h1>
        <p>{session.email}</p>
        <div className="account-plan-status">
          <strong>Plan {session.plan === 'pro' ? 'Pro' : 'Free'}</strong>
          <span>{session.planStatus === 'active' ? 'Cuenta activa' : 'Pago pendiente de confirmación'}</span>
        </div>
        {(session.plan !== 'pro' || session.planStatus !== 'active') && <button className="button button-primary account-checkout" type="button" onClick={() => void upgrade()} disabled={isSubmitting}>
          {isSubmitting ? 'Conectando con Mercado Pago…' : session.plan === 'pro' ? 'Completar pago · S/ 100 al mes' : 'Ampliar búsqueda · S/ 100 al mes'} <ArrowRight size={15} />
        </button>}
        {error && <p className="owner-message error" role="alert">{error}</p>}
        <Link className="account-activity-link" to="/reservas"><BadgeCheck size={15} /> Consultar mis reservas <ArrowRight size={14} /></Link>
        <button className="account-signout" type="button" onClick={() => void signOut()}><LogOut size={14} /> Cerrar sesión</button>
      </section>
    </div>
  )
}
