import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { OwnerAuthProvider } from '../features/auth/OwnerAuthProvider'
import { LoginPage } from './LoginPage'

describe('account login page', () => {
  afterEach(() => {
    cleanup()
    localStorage.clear()
  })

  it('lets customers choose between signing in and creating a free or Pro account', async () => {
    const user = userEvent.setup()
    render(<OwnerAuthProvider><MemoryRouter><LoginPage /></MemoryRouter></OwnerAuthProvider>)

    expect(await screen.findByText(/cliente@gastrored\.demo/)).toBeInTheDocument()
    expect(screen.getByText(/GastroDemo2026!/)).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: 'Registrarme' }))

    expect(screen.getByLabelText('Tu nombre')).toBeInTheDocument()
    expect(screen.getByLabelText('Correo electrónico')).toHaveAttribute('type', 'email')
    expect(screen.getByRole('radio', { name: /free/i })).toBeChecked()
    expect(screen.getByRole('radio', { name: /pro/i })).toBeInTheDocument()
  })

  it('lets the seeded demo customer sign in with the documented credentials', async () => {
    const user = userEvent.setup()
    render(<OwnerAuthProvider><MemoryRouter><LoginPage /></MemoryRouter></OwnerAuthProvider>)

    await user.type(await screen.findByLabelText('Correo electrónico'), 'cliente@gastrored.demo')
    await user.type(screen.getByLabelText('Contraseña'), 'GastroDemo2026!')
    const loginForm = screen.getByLabelText('Contraseña').closest('form')
    if (!loginForm) throw new Error('No se encontró el formulario de inicio de sesión.')
    await user.click(within(loginForm).getByRole('button', { name: 'Iniciar sesión' }))

    expect(await screen.findByText('cliente@gastrored.demo')).toBeInTheDocument()
    expect(screen.getByText('Plan Free')).toBeInTheDocument()
    expect(localStorage.getItem('mesa-demo-owner-session')).toContain('"role":"customer"')
  })

  it('requires a company email whose domain matches the restaurant login domain', async () => {
    const user = userEvent.setup()
    render(<OwnerAuthProvider><MemoryRouter><LoginPage /></MemoryRouter></OwnerAuthProvider>)
    await user.click(await screen.findByRole('tab', { name: 'Restaurante' }))
    await user.click(screen.getByRole('button', { name: 'Registrarme' }))
    await user.type(screen.getByLabelText('Nombre del restaurante o empresa'), 'Restaurante Ejemplo')
    await user.type(screen.getByLabelText(/Dominio de la empresa/), 'restaurante.com')
    await user.type(screen.getByLabelText('Correo corporativo'), 'dueno@otro.com')
    await user.type(screen.getByLabelText('Contraseña'), 'UnaClaveLarga123')
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('El correo corporativo debe pertenecer al dominio de la empresa.')
    expect(localStorage.getItem('mesa-demo-owner-session')).toBeNull()
  })

  it('does not store a password in the browser in demo mode', async () => {
    const user = userEvent.setup()
    render(<OwnerAuthProvider><MemoryRouter><LoginPage /></MemoryRouter></OwnerAuthProvider>)
    await user.click(await screen.findByRole('button', { name: 'Registrarme' }))
    await user.type(screen.getByLabelText('Tu nombre'), 'Ana Prueba')
    await user.type(screen.getByLabelText('Correo electrónico'), 'ana@example.com')
    await user.type(screen.getByLabelText('Contraseña'), 'UnaClaveLarga123')
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('El registro requiere configurar la API y MySQL')
    expect(localStorage.getItem('mesa-demo-owner-session')).toBeNull()
  })
})
