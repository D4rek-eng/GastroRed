import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { OwnerAuthContext, type OwnerAuthContextValue } from './ownerAuthContext'
import { ownerAuthService, type OwnerSession } from './ownerAuth'

export function OwnerAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<OwnerSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    void ownerAuthService.getSession().then(
      (savedSession) => {
        if (!active) return
        setSession(savedSession)
        setIsLoading(false)
      },
      () => {
        if (!active) return
        setSession(null)
        setError('No se pudo verificar la sesión. Revisa tu conexión e inténtalo de nuevo.')
        setIsLoading(false)
      },
    )
    return () => { active = false }
  }, [])

  async function signIn(email: string, password: string) {
    const nextSession = await ownerAuthService.signIn({ email, password })
    setSession(nextSession)
    setError('')
  }

  async function signInAccount(role: 'customer' | 'restaurant', identifier: string, password: string) {
    const nextSession = await ownerAuthService.signInAccount(role, identifier, password)
    setSession(nextSession)
    setError('')
    return nextSession
  }

  function registerAccount(input: Parameters<typeof ownerAuthService.registerAccount>[0]) {
    return ownerAuthService.registerAccount(input)
  }

  async function verifyEmail(email: string, code: string) {
    const nextSession = await ownerAuthService.verifyEmail(email, code)
    setSession(nextSession)
    setError('')
    return nextSession
  }

  function resendVerification(email: string) {
    return ownerAuthService.resendVerification(email)
  }

  function startCheckout(plan: 'pro' | 'restaurant') {
    return ownerAuthService.startCheckout(plan)
  }

  async function signOut() {
    await ownerAuthService.signOut()
    setSession(null)
  }

  const value = useMemo<OwnerAuthContextValue>(
    () => ({ session, isLoading, error, signIn, signInAccount, registerAccount, verifyEmail, resendVerification, startCheckout, signOut }),
    [session, isLoading, error],
  )
  return <OwnerAuthContext.Provider value={value}>{children}</OwnerAuthContext.Provider>
}
