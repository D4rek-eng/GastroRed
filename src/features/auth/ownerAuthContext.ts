import { createContext } from 'react'
import type { AccountRegistration, AccountRole, OwnerSession } from './ownerAuth'

export type OwnerAuthContextValue = {
  session: OwnerSession | null
  isLoading: boolean
  error: string
  signIn: (email: string, password: string) => Promise<void>
  signInAccount: (role: AccountRole, identifier: string, password: string) => Promise<OwnerSession>
  registerAccount: (input: AccountRegistration) => Promise<{ email: string; verificationCode?: string }>
  verifyEmail: (email: string, code: string) => Promise<OwnerSession>
  resendVerification: (email: string) => Promise<{ verificationCode?: string }>
  startCheckout: (plan: 'pro' | 'restaurant') => Promise<{ url: string }>
  signOut: () => Promise<void>
}

export const OwnerAuthContext = createContext<OwnerAuthContextValue | null>(null)
