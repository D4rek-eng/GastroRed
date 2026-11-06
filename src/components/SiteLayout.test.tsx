import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { OwnerAuthProvider } from '../features/auth/OwnerAuthProvider'
import { LocationProvider } from '../features/location/LocationProvider'
import { SiteLayout } from './SiteLayout'

describe('application navigation', () => {
  afterEach(() => {
    cleanup()
    localStorage.clear()
  })

  it('offers one general Login entry and closes the mobile menu after navigation', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/inicio']}>
        <OwnerAuthProvider>
          <LocationProvider>
            <Routes>
              <Route element={<SiteLayout />}>
                <Route path="/inicio" element={<p>Inicio de GastroRed</p>} />
                <Route path="/restaurantes" element={<p>Guía de restaurantes</p>} />
              </Route>
            </Routes>
          </LocationProvider>
        </OwnerAuthProvider>
      </MemoryRouter>,
    )

    const navigation = screen.getByRole('navigation', { name: 'Navegación principal' })
    expect(screen.getByRole('link', { name: 'GastroRed, inicio' }).querySelector('.brand-mark img')).toHaveAttribute('src', expect.stringMatching(/\/images\/gastrored-symbol\.png$/))
    expect(screen.getByRole('link', { name: 'GastroRed' }).querySelector('.brand-mark img')).toHaveAttribute('src', expect.stringMatching(/\/images\/gastrored-symbol\.png$/))
    expect(navigation.querySelector('a[href="/login"]')).toHaveTextContent('Login')
    expect(navigation.querySelector('a[href="/propietario/login"]')).not.toBeInTheDocument()

    const menuButton = screen.getByRole('button', { name: 'Abrir menú' })
    await user.click(menuButton)
    expect(menuButton).toHaveAttribute('aria-expanded', 'true')

    await user.click(screen.getByRole('link', { name: 'Explorar' }))
    expect(await screen.findByText('Guía de restaurantes')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Abrir menú' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('hides the reservation call-to-action for a restaurant account', async () => {
    localStorage.setItem('mesa-demo-owner-session', JSON.stringify({
      email: 'propietario@mesaysabor.demo',
      role: 'restaurant',
      restaurantIds: ['central'],
    }))

    render(
      <MemoryRouter initialEntries={['/inicio']}>
        <OwnerAuthProvider>
          <LocationProvider>
            <Routes>
              <Route element={<SiteLayout />}>
                <Route path="/inicio" element={<p>Inicio de GastroRed</p>} />
              </Route>
            </Routes>
          </LocationProvider>
        </OwnerAuthProvider>
      </MemoryRouter>,
    )

    const navigation = screen.getByRole('navigation', { name: 'Navegación principal' })
    expect(await screen.findByRole('link', { name: 'Portal restaurantes' })).toBeInTheDocument()
    expect(navigation.querySelector('.nav-cta')).not.toBeInTheDocument()
  })
})
