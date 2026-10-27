import { useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, LockKeyhole, Store } from 'lucide-react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useOwnerAuth } from '../features/auth/useOwnerAuth'

export function OwnerLoginPage() {
  const { session, signIn, isLoading: isCheckingSession, error: sessionError } = useOwnerAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const from = (location.state as { from?: string } | null)?.from ?? '/propietario'

  if (isCheckingSession) return <div className="page-container loading-copy">Verificando sesión…</div>
  if (session) return <Navigate to="/propietario" replace />

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setError('')
    try {
      await signIn(email, password)
      navigate(from, { replace: true })
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'No se pudo iniciar sesión.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="page-container owner-login-page">
      <Link className="owner-login-back" to="/"><ArrowLeft size={14} /> Volver al sitio</Link>
      <section className="owner-login-card">
        <span className="owner-icon"><Store size={21} /></span>
        <span className="eyebrow">PORTAL PARA RESTAURANTES</span>
        <h1>Acceso a tu <em>restaurante.</em></h1>
        <p>Inicia sesión para administrar tus horarios y disponibilidad.</p>
        <form className="owner-form" onSubmit={submit}>
          {sessionError && <p className="owner-message error" role="alert">{sessionError}</p>}
          <label className="contact-field">Correo electrónico
            <input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="tu@restaurante.com" />
          </label>
          <label className="contact-field">Contraseña
            <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required placeholder="Tu contraseña" />
          </label>
          {error && <p className="owner-message error" role="alert">{error}</p>}
          <button className="button button-primary" type="submit" disabled={isSubmitting}>
            <LockKeyhole size={15} /> {isSubmitting ? 'Ingresando…' : 'Iniciar sesión'} <ArrowRight size={15} />
          </button>
        </form>
        {import.meta.env.VITE_DEMO_MODE !== 'false' && (
          <div className="owner-demo-note">
            <strong>Credenciales de demostración</strong>
            <span>Correo: propietario@mesaysabor.demo</span>
            <span>Contraseña: MesaDemo2026!</span>
            <small>Esta cuenta de prueba solo administra Mérito. En producción, el acceso se valida en el servidor.</small>
          </div>
        )}
      </section>
    </div>
  )
}
