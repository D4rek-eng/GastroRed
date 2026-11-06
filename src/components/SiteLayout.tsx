import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { ArrowRight, Heart, LogIn, MapPin, Menu, Store, UserRound, X } from 'lucide-react'
import { getMillisecondsUntilThemeChange, getScheduledTheme } from '../lib/theme'
import { publicAsset } from '../lib/publicAsset'
import { formatAccuracy } from '../features/location/location'
import { useUserLocation } from '../features/location/useUserLocation'
import { useOwnerAuth } from '../features/auth/useOwnerAuth'
import { LocationPermissionPrompt } from './LocationPermissionPrompt'

const links = [
  { to: '/restaurantes', label: 'Explorar' },
  { to: '/comparador', label: 'Comparador' },
  { to: '/reservas', label: 'Mis reservas' },
  { to: '/favoritos', label: 'Favoritos' },
]

export function SiteLayout() {
  const location = useLocation()
  const [openPath, setOpenPath] = useState<string | null>(null)
  const menuOpen = openPath === location.pathname
  const userLocation = useUserLocation()
  const { session } = useOwnerAuth()
  const isRestaurantAccount = Boolean(session && (session.role === 'restaurant' || session.restaurantIds.length > 0))
  const closeMenu = () => setOpenPath(null)

  useEffect(() => {
    let timer: number
    const applyScheduledTheme = () => {
      const theme = getScheduledTheme()
      document.documentElement.dataset.theme = theme
      document.querySelector('meta[name="theme-color"]')?.setAttribute(
        'content',
        theme === 'dark' ? '#191816' : '#fbfaf8',
      )
      window.clearTimeout(timer)
      timer = window.setTimeout(applyScheduledTheme, getMillisecondsUntilThemeChange())
    }
    const refreshTheme = () => {
      if (document.visibilityState === 'visible') applyScheduledTheme()
    }

    applyScheduledTheme()
    document.addEventListener('visibilitychange', refreshTheme)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', refreshTheme)
    }
  }, [])

  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <Link className="brand" to="/inicio" aria-label="GastroRed, inicio" onClick={closeMenu}>
            <span className="brand-mark"><img src={publicAsset('/images/gastrored-symbol.png')} alt="" /></span>
            <span>GastroRed<small>BUENOS MOMENTOS, BUENA MESA</small></span>
          </Link>
          <button
            className="city-picker"
            type="button"
            onClick={userLocation.requestLocation}
            disabled={userLocation.isLocating}
            title={userLocation.location
              ? `${userLocation.location.label} · ${formatAccuracy(userLocation.location.accuracy)}`
              : (userLocation.error || 'Permitir acceso para mostrar tu ubicación')}
            aria-label={userLocation.isLocating ? 'Detectando ubicación' : 'Detectar mi ubicación'}
          >
            <MapPin size={15} />
            <span>{userLocation.isLocating ? 'Buscando…' : userLocation.location?.shortLabel ?? 'Mi ubicación'}</span>
            <span className="chevron">⌄</span>
          </button>
          <span className="visually-hidden" role="status" aria-live="polite">
            {userLocation.error || (userLocation.location ? `Ubicación actualizada: ${userLocation.location.label}` : '')}
          </span>
          <button className="mobile-menu-button icon-button" type="button" onClick={() => setOpenPath(menuOpen ? null : location.pathname)} aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={menuOpen} aria-controls="main-navigation">
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <nav className={`main-nav ${menuOpen ? 'is-open' : ''}`} id="main-navigation" aria-label="Navegación principal">
            {links.map((link) => (
              <NavLink key={link.to} to={link.to} onClick={closeMenu} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                {link.label}
              </NavLink>
            ))}
            <Link
              className="owner-nav-link"
              to={session ? (session.role === 'restaurant' || session.restaurantIds.length > 0 ? '/propietario' : '/perfil') : '/login'}
              onClick={closeMenu}
            >
              {session?.role === 'restaurant' || (session && session.restaurantIds.length > 0)
                ? <><Store size={14} /> Portal restaurantes</>
                : session
                  ? <><UserRound size={14} /> Mi cuenta</>
                  : <><LogIn size={14} /> Login</>}
            </Link>
            {!isRestaurantAccount && <Link className="button button-primary nav-cta" to="/restaurantes" onClick={closeMenu}>Reserva tu mesa <ArrowRight size={15} /></Link>}
          </nav>
        </div>
      </header>
      <main key={location.pathname} className="page-main"><Outlet /></main>
      <LocationPermissionPrompt />
      <footer className="site-footer">
        <div className="footer-grid">
          <div><Link className="brand footer-brand" to="/inicio"><span className="brand-mark"><img src={publicAsset('/images/gastrored-symbol.png')} alt="" /></span><span>GastroRed</span></Link><p>Descubre restaurantes que se sienten como tu lugar favorito.</p></div>
          <div><strong>Descubre</strong><Link to="/restaurantes">Restaurantes</Link><Link to="/comparador">Comparador</Link><Link to="/mapa">Explorar el mapa</Link></div>
          <div><strong>Tu cuenta</strong><Link to="/reservas">Mis reservas</Link><Link to="/favoritos">Mis favoritos</Link><Link to={session ? '/perfil' : '/login'}>{session ? 'Mi cuenta' : 'Login'}</Link></div>
          <div className="footer-note"><Heart size={16} /> Hecho para disfrutar mejor {userLocation.location?.region ?? 'el Perú'}.</div>
        </div>
        <div className="footer-bottom"><span>© 2026 GastroRed</span><Link to="/creditos">Créditos de las fotografías</Link><span>Una guía independiente de restaurantes</span></div>
      </footer>
    </>
  )
}
