import { ApiError, apiRequest } from '../../lib/api/client'

export type OwnerSession = {
  email: string
  restaurantIds: string[]
}

type OwnerCredentials = {
  email: string
  password: string
}

const demoMode = import.meta.env.VITE_DEMO_MODE !== 'false'
const demoEmail = 'propietario@mesaysabor.demo'
const demoPassword = 'MesaDemo2026!'
const demoSessionKey = 'mesa-demo-owner-session'

export const ownerAuthService = {
  async signIn(credentials: OwnerCredentials): Promise<OwnerSession> {
    if (!demoMode) {
      return apiRequest<OwnerSession>('/api/v1/auth/owner/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      })
    }

    await Promise.resolve()
    if (credentials.email.trim().toLocaleLowerCase('es') !== demoEmail || credentials.password !== demoPassword) {
      throw new Error('Correo o contraseña incorrectos.')
    }
    const session = { email: demoEmail, restaurantIds: ['central'] }
    localStorage.setItem(demoSessionKey, JSON.stringify(session))
    return session
  },

  async getSession(): Promise<OwnerSession | null> {
    if (!demoMode) {
      try {
        return await apiRequest<OwnerSession>('/api/v1/auth/owner/session')
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null
        throw error
      }
    }
    const savedSession = localStorage.getItem(demoSessionKey)
    if (!savedSession) return null
    try {
      const parsed: unknown = JSON.parse(savedSession)
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        !('email' in parsed) ||
        parsed.email !== demoEmail ||
        !('restaurantIds' in parsed) ||
        !Array.isArray(parsed.restaurantIds) ||
        !parsed.restaurantIds.every((id) => typeof id === 'string')
      ) return null
      return parsed as OwnerSession
    } catch {
      localStorage.removeItem(demoSessionKey)
      return null
    }
  },

  async signOut(): Promise<void> {
    if (!demoMode) {
      await apiRequest<void>('/api/v1/auth/owner/logout', { method: 'POST' })
      return
    }
    localStorage.removeItem(demoSessionKey)
  },
}
