import { ApiError, apiRequest } from '../../lib/api/client'

export type OwnerSession = {
  email: string
  restaurantIds: string[]
  id?: string
  name?: string
  role?: 'customer' | 'restaurant'
  domain?: string
  plan?: 'free' | 'pro' | 'restaurant'
  planStatus?: 'active' | 'pending_payment' | 'cancelled'
}

type OwnerCredentials = {
  email: string
  password: string
}

export type AccountRole = 'customer' | 'restaurant'
export type AccountRegistration = {
  role: AccountRole
  name: string
  email: string
  password: string
  plan: 'free' | 'pro' | 'restaurant'
  domain?: string
}

const demoMode = import.meta.env.VITE_DEMO_MODE !== 'false'
const demoEmail = 'propietario@mesaysabor.demo'
const demoPassword = 'MesaDemo2026!'
const demoCustomerEmail = 'cliente@gastrored.demo'
const demoCustomerPassword = 'GastroDemo2026!'
const demoSessionKey = 'mesa-demo-owner-session'

export const ownerAuthService = {
  async signInAccount(role: AccountRole, identifier: string, password: string): Promise<OwnerSession> {
    if (demoMode) {
      const normalizedIdentifier = identifier.trim().toLocaleLowerCase('es')
      if (role === 'customer') {
        if (normalizedIdentifier !== demoCustomerEmail || password !== demoCustomerPassword) {
          throw new Error('Correo o contraseña incorrectos.')
        }
        const session: OwnerSession = {
          id: '00000000-0000-4000-8000-000000000001',
          email: demoCustomerEmail,
          name: 'Cliente de demostración',
          role: 'customer',
          plan: 'free',
          planStatus: 'active',
          restaurantIds: [],
        }
        localStorage.setItem(demoSessionKey, JSON.stringify(session))
        return session
      }
      const email = normalizedIdentifier === 'mesaysabor.demo' ? demoEmail : identifier
      return this.signIn({ email, password })
    }
    return apiRequest<OwnerSession>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ role, identifier, password }),
    })
  },

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
        return await apiRequest<OwnerSession>('/api/v1/auth/session')
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
        !('restaurantIds' in parsed) ||
        !Array.isArray(parsed.restaurantIds) ||
        !parsed.restaurantIds.every((id) => typeof id === 'string')
      ) return null
      if (parsed.email === demoEmail) return parsed as OwnerSession
      if (
        parsed.email === demoCustomerEmail &&
        'role' in parsed &&
        parsed.role === 'customer' &&
        'plan' in parsed &&
        parsed.plan === 'free' &&
        'planStatus' in parsed &&
        parsed.planStatus === 'active' &&
        parsed.restaurantIds.length === 0
      ) return parsed as OwnerSession
      return null
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

  async registerAccount(input: AccountRegistration): Promise<{ email: string; verificationCode?: string }> {
    if (demoMode) {
      throw new Error('El registro requiere configurar la API y MySQL; el modo demo no almacena contraseñas.')
    }
    return apiRequest<{ email: string; verificationCode?: string }>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  async verifyEmail(email: string, code: string): Promise<OwnerSession> {
    if (demoMode) {
      throw new Error('La verificación de correo requiere configurar la API.')
    }
    return apiRequest<OwnerSession>('/api/v1/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    })
  },

  async resendVerification(email: string): Promise<{ verificationCode?: string }> {
    if (demoMode) {
      throw new Error('La verificación de correo requiere configurar la API.')
    }
    return apiRequest<{ verificationCode?: string }>('/api/v1/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })
  },

  async startCheckout(plan: 'pro' | 'restaurant'): Promise<{ url: string }> {
    if (demoMode) {
      throw new Error('Los pagos requieren configurar la API y las credenciales de Mercado Pago.')
    }
    return apiRequest<{ url: string }>('/api/v1/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ plan }),
    })
  },
}
