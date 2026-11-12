import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
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

    expect(screen.getByRole('img', { name: 'GastroRed' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'GastroRed Food Platform' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Tu próximo lugar favorito está cerca' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Mapa ilustrativo con un radio cercano de 200 metros' })).toBeInTheDocument()
    expect(container.querySelectorAll('.landing-map-buildings rect')).toHaveLength(24)
    expect(container.querySelector('.landing-map-labels')).toHaveTextContent('AV. PRINCIPAL')
    expect(screen.getByRole('link', { name: /descubrir restaurantes/i })).toHaveAttribute('href', '/restaurantes')
    expect(screen.getAllByRole('link', { name: 'Buscar restaurantes' })).toHaveLength(1)
    expect(screen.queryByRole('link', { name: 'Explorar restaurantes' })).not.toBeInTheDocument()
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

  it('collapses the floating menu to its logo while scrolling down and expands it on the way back up', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }))
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 })
    render(<MemoryRouter><MarketingLandingPage /></MemoryRouter>)

    const header = screen.getByRole('banner')
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 160 })
    fireEvent.scroll(window)
    expect(header).toHaveClass('is-collapsed')
    expect(within(header).getByRole('img', { name: 'GastroRed' })).toBeInTheDocument()
    expect(within(header).getByRole('navigation', { name: 'Navegación de GastroRed' })).toHaveAttribute('inert')

    Object.defineProperty(window, 'scrollY', { configurable: true, value: 120 })
    fireEvent.scroll(window)
    expect(header).not.toHaveClass('is-collapsed')
    expect(within(header).getByRole('navigation', { name: 'Navegación de GastroRed' })).not.toHaveAttribute('inert')
  })

  it('lets visitors switch the restaurant shown in the animated phone preview', async () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }))
    const user = userEvent.setup()
    render(<MemoryRouter><MarketingLandingPage /></MemoryRouter>)

    expect(document.querySelector('.landing-phone-brand img')).not.toBeInTheDocument()
    expect(screen.getByText('GastroRed')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Mostrar La Mar Cebichería' }))

    expect(screen.getByRole('img', { name: 'Fotografía de La Mar Cebichería' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver restaurante' })).toHaveAttribute('href', '/restaurantes/la-mar')
  })
})
