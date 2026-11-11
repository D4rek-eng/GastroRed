import { useState, type FormEvent } from 'react'
import { ArrowRight, Check, LockKeyhole, Mail, Store, UserRound } from 'lucide-react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useOwnerAuth } from '../features/auth/useOwnerAuth'
import type { AccountRole } from '../features/auth/ownerAuth'

const isDemo = import.meta.env.VITE_DEMO_MODE !== 'false'

export function LoginPage() {
  const { session, isLoading, error: sessionError, signInAccount, registerAccount, verifyEmail, resendVerification, startCheckout, signOut } = useOwnerAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [role, setRole] = useState<AccountRole>(searchParams.get('account') === 'restaurant' ? 'restaurant' : 'customer')
  const [isRegistering, setIsRegistering] = useState(searchParams.get('mode') === 'register' || searchParams.get('modo') === 'registro')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [domain, setDomain] = useState('')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [plan, setPlan] = useState<'free' | 'pro'>('free')
  const [verificationEmail, setVerificationEmail] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [developmentCode, setDevelopmentCode] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const returnTo = (location.state as { from?: string } | null)?.from
  const isRestaurantSession = session?.role === 'restaurant' || Boolean(session?.restaurantIds.length)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')
    setIsSubmitting(true)
    try {
      if (isRegistering) {
        if (role === 'restaurant') {
          const emailDomain = email.trim().toLowerCase().split('@').at(-1)
          const normalizedDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '')
          if (!emailDomain || emailDomain !== normalizedDomain) {
            throw new Error('El correo corporativo debe pertenecer al dominio de la empresa.')
          }
        }
        const result = await registerAccount({
          role,
          name: name.trim(),
          email: email.trim(),
          password,
          plan: role === 'restaurant' ? 'restaurant' : plan,
          ...(role === 'restaurant' ? { domain: domain.trim().toLowerCase() } : {}),
        })
        setVerificationEmail(result.email)
        setDevelopmentCode(result.verificationCode ?? '')
        setMessage('Te enviamos un código de verificación. Confirma tu correo para activar la cuenta.')
      } else {
        const nextSession = await signInAccount(role, identifier.trim(), password)
        if (role === 'restaurant' && (nextSession.role === 'restaurant' || nextSession.restaurantIds.length > 0) && nextSession.planStatus !== 'pending_payment') {
          navigate(returnTo ?? '/propietario', { replace: true })
        } else if (role === 'customer' && nextSession.role === 'customer' && nextSession.planStatus === 'active') {
          navigate(returnTo ?? '/perfil', { replace: true })
        } else {
          setMessage('Tu cuenta está creada. Completa el pago para activar el plan.')
        }
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No se pudo completar la solicitud.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function confirmEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)
    try {
      const verifiedSession = await verifyEmail(verificationEmail, verificationCode.trim())
      setMessage('Correo verificado. Tu cuenta ya está lista.')
      if (verifiedSession.planStatus === 'active') {
        navigate(returnTo ?? (verifiedSession.role === 'restaurant' ? '/propietario' : '/perfil'), { replace: true })
      }
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : 'No se pudo verificar el correo.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function resendCode() {
    setError('')
    setIsSubmitting(true)
    try {
      const result = await resendVerification(verificationEmail)
      setDevelopmentCode(result.verificationCode ?? '')
      setMessage('Enviamos un nuevo código a tu correo.')
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : 'No se pudo reenviar el código.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function continueToPayment() {
    setError('')
    setIsSubmitting(true)
    try {
      const checkout = await startCheckout(isRestaurantSession ? 'restaurant' : 'pro')
      window.location.assign(checkout.url)
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : 'No se pudo iniciar el pago.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) return <div className="page-container loading-copy">Verificando sesión…</div>

  if (session) {
    const needsPayment = session.planStatus === 'pending_payment'
    return (
      <div className="page-container owner-login-page">
        <section className="owner-login-card account-status-card">
          <span className="owner-icon">{isRestaurantSession ? <Store size={21} /> : <UserRound size={21} />}</span>
          <span className="eyebrow">{isRestaurantSession ? 'CUENTA DE RESTAURANTE' : 'TU CUENTA GASTRORED'}</span>
          <h1>Hola, <em>{session.name ?? session.email.split('@')[0]}.</em></h1>
          <p>{session.email}{session.domain ? ` · ${session.domain}` : ''}</p>
          <div className="account-plan-status">
            <strong>Plan {isRestaurantSession ? 'Restaurante' : session.plan === 'pro' ? 'Pro' : 'Free'}</strong>
            <span>{needsPayment ? 'Pago pendiente de confirmación' : 'Cuenta activa'}</span>
          </div>
          {needsPayment ? (
            <button className="button button-primary account-checkout" type="button" onClick={() => void continueToPayment()} disabled={isSubmitting}>
              {isSubmitting ? 'Conectando con Mercado Pago…' : `Pagar S/ ${isRestaurantSession ? '120' : '100'} al mes`}
              <ArrowRight size={15} />
            </button>
          ) : (
            <Link className="button button-primary account-checkout" to={isRestaurantSession ? '/propietario' : '/reservas'}>
              {isRestaurantSession ? 'Ir al portal' : 'Ver mis reservas'} <ArrowRight size={15} />
            </Link>
          )}
          {error && <p className="owner-message error" role="alert">{error}</p>}
          <button className="account-signout" type="button" onClick={() => void signOut()}>Cerrar sesión</button>
        </section>
      </div>
    )
  }

  return (
    <div className="page-container owner-login-page">
      <Link className="owner-login-back" to="/inicio"><ArrowRight size={14} /> Volver a GastroRed</Link>
      <section className="owner-login-card account-login-card">
        <span className="owner-icon">{role === 'restaurant' ? <Store size={21} /> : <UserRound size={21} />}</span>
        <span className="eyebrow">BIENVENIDO A GASTRORED</span>
        <h1>{isRegistering ? <>Crea tu <em>cuenta.</em></> : <>Qué bueno <em>verte.</em></>}</h1>
        <p>{isRegistering ? 'Regístrate para guardar tus planes y disfrutar más de cada salida.' : 'Inicia sesión o crea una cuenta para organizar tus próximos planes.'}</p>

        <div className="account-role-switch" role="tablist" aria-label="Tipo de cuenta">
          <button type="button" role="tab" aria-selected={role === 'customer'} className={role === 'customer' ? 'active' : ''} onClick={() => { setRole('customer'); setError(''); setVerificationEmail('') }}>
            <UserRound size={15} /> Cliente
          </button>
          <button type="button" role="tab" aria-selected={role === 'restaurant'} className={role === 'restaurant' ? 'active' : ''} onClick={() => { setRole('restaurant'); setError(''); setVerificationEmail('') }}>
            <Store size={15} /> Restaurante
          </button>
        </div>

        {verificationEmail ? (
          <form className="owner-form" onSubmit={confirmEmail}>
            <p className="verification-copy">Código enviado a <strong>{verificationEmail}</strong></p>
            <label className="contact-field">Código de verificación
              <input inputMode="numeric" autoComplete="one-time-code" value={verificationCode} onChange={(event) => setVerificationCode(event.target.value)} minLength={6} maxLength={6} required placeholder="••••••" />
            </label>
            {developmentCode && <p className="development-code">Código local de prueba: <strong>{developmentCode}</strong></p>}
            <button className="button button-primary" type="submit" disabled={isSubmitting}><Check size={15} /> {isSubmitting ? 'Verificando…' : 'Verificar correo'}</button>
            {message && <p className="owner-message" role="status">{message}</p>}
            {error && <p className="owner-message error" role="alert">{error}</p>}
            <button className="account-signout" type="button" onClick={() => void resendCode()} disabled={isSubmitting}>Reenviar código</button>
            <button className="account-signout" type="button" onClick={() => { setVerificationEmail(''); setVerificationCode(''); setDevelopmentCode('') }}>Usar otro correo</button>
          </form>
        ) : (
          <>
            <div className="account-mode-switch" aria-label="Acceso o registro">
              <button type="button" className={!isRegistering ? 'active' : ''} onClick={() => { setIsRegistering(false); setError('') }}>Iniciar sesión</button>
              <button type="button" className={isRegistering ? 'active' : ''} onClick={() => { setIsRegistering(true); setError('') }}>Registrarme</button>
            </div>
            <form className="owner-form" onSubmit={submit}>
              {isRegistering && <>
                <label className="contact-field">{role === 'restaurant' ? 'Nombre del restaurante o empresa' : 'Tu nombre'}
                  <input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} placeholder={role === 'restaurant' ? 'Restaurante Ejemplo' : 'Nombre y apellido'} />
                </label>
                {role === 'restaurant' && <label className="contact-field">Dominio de la empresa
                  <input autoComplete="url" value={domain} onChange={(event) => setDomain(event.target.value)} required maxLength={253} placeholder="restaurante.com" />
                  <small>Debe coincidir con el dominio de tu correo corporativo.</small>
                </label>}
              </>}
              {isRegistering ? (
                <label className="contact-field">{role === 'restaurant' ? 'Correo corporativo' : 'Correo electrónico'}
                  <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder={role === 'restaurant' ? 'tu@restaurante.com' : 'tu@correo.com'} />
                </label>
              ) : (
                <label className="contact-field">{role === 'restaurant' ? 'Dominio de la empresa' : 'Correo electrónico'}
                  <span className="account-input-icon">{role === 'restaurant' ? <Store size={15} /> : <Mail size={15} />}
                    <input type={role === 'restaurant' ? 'text' : 'email'} autoComplete="username" value={identifier} onChange={(event) => setIdentifier(event.target.value)} required placeholder={role === 'restaurant' ? 'restaurante.com' : 'tu@correo.com'} />
                  </span>
                </label>
              )}
              {isRegistering && role === 'customer' && (
                <fieldset className="account-plan-choice">
                  <legend>Elige tu plan</legend>
                  <label><input type="radio" name="plan" value="free" checked={plan === 'free'} onChange={() => setPlan('free')} /><span><strong>Free</strong><small>Gratis · descubre a 200 m</small></span></label>
                  <label><input type="radio" name="plan" value="pro" checked={plan === 'pro'} onChange={() => setPlan('pro')} /><span><strong>Pro · S/ 100 al mes</strong><small>Hasta 1 km · pago seguro en Mercado Pago</small></span></label>
                </fieldset>
              )}
              <label className="contact-field">Contraseña
                <input type="password" autoComplete={isRegistering ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={isRegistering ? 10 : undefined} maxLength={128} placeholder={isRegistering ? 'Mínimo 10 caracteres' : 'Tu contraseña'} />
              </label>
              {sessionError && <p className="owner-message error" role="alert">{sessionError}</p>}
              {error && <p className="owner-message error" role="alert">{error}</p>}
              {message && <p className="owner-message" role="status">{message}</p>}
              <button className="button button-primary" type="submit" disabled={isSubmitting}>
                {role === 'restaurant' ? <Store size={15} /> : <LockKeyhole size={15} />}
                {isSubmitting ? 'Un momento…' : isRegistering ? 'Crear cuenta' : 'Iniciar sesión'}
                <ArrowRight size={15} />
              </button>
            </form>
          </>
        )}

        {isDemo && !isRegistering && !verificationEmail && (
          <div className="owner-demo-note">
            <strong>Acceso de demostración</strong>
            {role === 'customer' ? (
              <>
                <span>Correo: cliente@gastrored.demo</span>
                <span>Contraseña: GastroDemo2026!</span>
              </>
            ) : (
              <>
                <span>Dominio: mesaysabor.demo</span>
                <span>Contraseña: MesaDemo2026!</span>
              </>
            )}
          </div>
        )}
        {isDemo && isRegistering && <p className="account-demo-notice">El registro real se habilita al configurar la API y MySQL. No guardamos contraseñas en este navegador.</p>}
      </section>
    </div>
  )
}
