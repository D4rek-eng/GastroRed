import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { RequireOwnerAuth } from './components/RequireOwnerAuth'
import { SiteLayout } from './components/SiteLayout'
import { OwnerAuthProvider } from './features/auth/OwnerAuthProvider'
import { LocationProvider } from './features/location/LocationProvider'
import { ComparePage } from './pages/ComparePage'
import { HomePage } from './pages/HomePage'
import { InfoPage } from './pages/InfoPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { OwnerLoginPage } from './pages/OwnerLoginPage'
import { OwnerPortalPage } from './pages/OwnerPortalPage'
import { PhotoCreditsPage } from './pages/PhotoCreditsPage'
import { ReservationsPage } from './pages/ReservationsPage'
import { RestaurantDetailPage } from './pages/RestaurantDetailPage'
import { RestaurantsPage } from './pages/RestaurantsPage'
import { SavedPage } from './pages/SavedPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 },
    mutations: { retry: 0 },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LocationProvider>
        <OwnerAuthProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<SiteLayout />}>
                <Route index element={<HomePage />} />
                <Route path="restaurantes" element={<RestaurantsPage />} />
                <Route path="restaurantes/:id" element={<RestaurantDetailPage />} />
                <Route path="comparador" element={<ComparePage />} />
                <Route path="mapa" element={<InfoPage />} />
                <Route path="reservas" element={<ReservationsPage />} />
                <Route path="favoritos" element={<SavedPage />} />
                <Route path="creditos" element={<PhotoCreditsPage />} />
                <Route path="login" element={<InfoPage />} />
                <Route path="registro" element={<InfoPage />} />
                <Route path="perfil" element={<InfoPage />} />
                <Route path="propietario/login" element={<OwnerLoginPage />} />
                <Route path="propietario" element={<RequireOwnerAuth><OwnerPortalPage /></RequireOwnerAuth>} />
                <Route path="propietario/restaurantes" element={<InfoPage />} />
                <Route path="propietario/menu" element={<InfoPage />} />
                <Route path="propietario/reservas" element={<InfoPage />} />
                <Route path="admin" element={<InfoPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </OwnerAuthProvider>
      </LocationProvider>
    </QueryClientProvider>
  )
}
