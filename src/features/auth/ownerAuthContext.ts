import { createContext } from 'react'
import type { OwnerSession } from './ownerAuth'

export type OwnerAuthContextValue = {
  session: OwnerSession | null
  isLoading: boolean
  error: string
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

export const OwnerAuthContext = createContext<OwnerAuthContextValue | null>(null)
