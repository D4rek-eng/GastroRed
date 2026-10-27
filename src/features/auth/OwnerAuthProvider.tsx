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

  async function signOut() {
    await ownerAuthService.signOut()
    setSession(null)
  }

  const value = useMemo<OwnerAuthContextValue>(
    () => ({ session, isLoading, error, signIn, signOut }),
    [session, isLoading, error],
  )
  return <OwnerAuthContext.Provider value={value}>{children}</OwnerAuthContext.Provider>
}
