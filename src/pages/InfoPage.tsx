import { ArrowLeft, ArrowRight, Compass, LockKeyhole, MapPinned, ShieldCheck, UserRound } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

const content: Record<string, { title: string; description: string; icon: 'account' | 'map' | 'secure'; action: string }> = {
  '/mapa': { title: 'Tu zona, a tu manera.', description: 'Activa tu ubicación y explora los restaurantes que aparecen en el mapa a 200 metros a la redonda. Los datos provienen de OpenStreetMap.', icon: 'map', action: 'Explorar restaurantes' },
  '/login': { title: 'Qué bueno verte.', description: 'El inicio de sesión requiere un servicio de autenticación configurado. La app demo no solicita ni guarda contraseñas.', icon: 'account', action: 'Volver al inicio' },
  '/registro': { title: 'Siempre hay lugar para ti.', description: 'El registro de cuentas se conectará cuando esté disponible el backend de autenticación.', icon: 'account', action: 'Explorar restaurantes' },
  '/perfil': { title: 'Tu perfil GastroRed.', description: 'Las preferencias y datos de cuenta se mostrarán aquí cuando inicies sesión con el proveedor configurado.', icon: 'account', action: 'Explorar restaurantes' },
  '/propietario': { title: 'Portal para restaurantes.', description: 'Las herramientas de propietario requieren una sesión y permisos confirmados por el backend.', icon: 'secure', action: 'Volver al inicio' },
  '/propietario/restaurantes': { title: 'Tus restaurantes.', description: 'La gestión de locales se conectará al API de propietario cuando el backend esté disponible.', icon: 'secure', action: 'Volver al portal' },
  '/propietario/menu': { title: 'Tu carta, siempre al día.', description: 'La gestión de platos, precios y promociones requiere acceso autorizado desde el backend.', icon: 'secure', action: 'Volver al portal' },
  '/propietario/reservas': { title: 'Reservas de tu local.', description: 'La gestión de disponibilidad y reservas necesita autorización y datos reales del backend.', icon: 'secure', action: 'Volver al portal' },
  '/admin': { title: 'Administración segura.', description: 'El panel administrativo está protegido por diseño. Se habilitará al conectar roles y permisos del servidor.', icon: 'secure', action: 'Volver al inicio' },
}

export function InfoPage() {
  const { pathname } = useLocation()
  const page = content[pathname] ?? { title: 'Esta mesa aún no está lista.', description: 'Esta función necesita una integración de backend antes de poder habilitarse.', icon: 'secure' as const, action: 'Volver al inicio' }
  const Icon = page.icon === 'map' ? MapPinned : page.icon === 'account' ? UserRound : ShieldCheck
  const actionTo = pathname === '/propietario/restaurantes' || pathname === '/propietario/menu' || pathname === '/propietario/reservas' ? '/propietario' : page.action === 'Volver al inicio' ? '/' : '/restaurantes'
  return <div className="page-container info-page"><div className="info-card"><span className="info-icon"><Icon size={22} /></span><span className="eyebrow"><span className="eyebrow-dot" /> GASTRORED</span><h1>{page.title}</h1><p>{page.description}</p><Link className="button button-primary" to={actionTo}><ArrowLeft size={15} /> {page.action}</Link>{page.icon === 'map' && <Link className="text-link" to="/restaurantes">Elegir un distrito <ArrowRight size={15} /></Link>}{page.icon === 'secure' && <span className="secure-note"><LockKeyhole size={13} /> No se muestra información protegida en modo demo.</span>}{page.icon === 'map' && <Compass className="info-watermark" size={90} />}</div></div>
}
