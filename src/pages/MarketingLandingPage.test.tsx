import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MarketingLandingPage } from './MarketingLandingPage'

describe('marketing landing page', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('explains GastroRed and links to the existing app and restaurant guide', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }))
    render(<MemoryRouter><MarketingLandingPage /></MemoryRouter>)

    expect(screen.getByRole('heading', { name: 'Tu próximo lugar favorito está cerca' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /descubrir restaurantes/i })).toHaveAttribute('href', '/restaurantes')
    expect(screen.getByRole('link', { name: /entrar a gastrored/i })).toHaveAttribute('href', '/inicio')
    expect(screen.getByText('200 m a la redonda')).toBeInTheDocument()
    expect(screen.getByText('Hasta 1 km a la redonda')).toBeInTheDocument()
    expect(screen.getByText(/Sin precio publicado todavía/)).toBeInTheDocument()
  })

  it('opens the compact navigation on small screens', async () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }))
    const user = userEvent.setup()
    render(<MemoryRouter><MarketingLandingPage /></MemoryRouter>)

    const menuButton = screen.getByRole('button', { name: 'Abrir menú' })
    await user.click(menuButton)

    expect(screen.getByRole('button', { name: 'Cerrar menú' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('navigation', { name: 'Navegación de GastroRed' })).toBeInTheDocument()
  })
})
