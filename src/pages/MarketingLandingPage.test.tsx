import { cleanup, render, screen, within } from '@testing-library/react'
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
    const { container } = render(<MemoryRouter><MarketingLandingPage /></MemoryRouter>)

    expect(screen.getByRole('heading', { name: 'Tu próximo lugar favorito está cerca' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /descubrir restaurantes/i })).toHaveAttribute('href', '/restaurantes')
    const navigation = screen.getByRole('navigation', { name: 'Navegación de GastroRed' })
    expect(within(navigation).getByRole('link', { name: /entrar a gastrored/i })).toHaveAttribute('href', '/inicio')
    expect(screen.getByText(/200 m a la redonda/)).toBeInTheDocument()
    expect(container.querySelector('.pro-option > strong')).toHaveTextContent('S/ 100 al mes')
    expect(screen.getByText(/todavía no hay suscripciones, cobros ni límites por plan activos/)).toBeInTheDocument()
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

  it('lets visitors switch the restaurant shown in the animated phone preview', async () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }))
    const user = userEvent.setup()
    render(<MemoryRouter><MarketingLandingPage /></MemoryRouter>)

    await user.click(screen.getByRole('button', { name: 'Mostrar La Mar Cebichería' }))

    expect(screen.getByRole('img', { name: 'Fotografía de La Mar Cebichería' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver restaurante' })).toHaveAttribute('href', '/restaurantes/la-mar')
  })
})
