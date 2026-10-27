import { beforeEach, describe, expect, it } from 'vitest'
import { ownerAuthService } from './ownerAuth'

describe('owner authentication demo', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('authenticates the documented demo owner and restores the session', async () => {
    const session = await ownerAuthService.signIn({
      email: 'propietario@mesaysabor.demo',
      password: 'MesaDemo2026!',
    })

    expect(session).toEqual({
      email: 'propietario@mesaysabor.demo',
      restaurantIds: ['central'],
    })
    expect(await ownerAuthService.getSession()).toEqual(session)
  })

  it('rejects invalid credentials and does not create a session', async () => {
    await expect(ownerAuthService.signIn({
      email: 'persona@example.com',
      password: 'incorrecta',
    })).rejects.toThrow('Correo o contraseña incorrectos.')
    expect(await ownerAuthService.getSession()).toBeNull()
  })

  it('clears the owner session on logout', async () => {
    await ownerAuthService.signIn({
      email: 'propietario@mesaysabor.demo',
      password: 'MesaDemo2026!',
    })

    await ownerAuthService.signOut()

    expect(await ownerAuthService.getSession()).toBeNull()
  })
})
