import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { LocationProvider } from '../features/location/LocationProvider'
import { HomePage } from './HomePage'

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

describe('home page', () => {
  it('introduces the service and links to restaurant discovery', () => {
    render(<QueryClientProvider client={queryClient}><LocationProvider><MemoryRouter><HomePage /></MemoryRouter></LocationProvider></QueryClientProvider>)
    expect(screen.getByRole('heading', { name: /hay un lugar/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /encuentra tu mesa/i })).toHaveAttribute('href', '/restaurantes')
  })
})
