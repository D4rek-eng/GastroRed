import { useQuery } from '@tanstack/react-query'
import { ArrowRight, CalendarDays, Clock3, MapPin } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useOwnerAuth } from '../features/auth/useOwnerAuth'
import { restaurantService } from '../features/restaurants/service'
import type { Reservation } from '../types'

export function ReservationsPage() {
  const isDemo = import.meta.env.VITE_DEMO_MODE !== 'false'
  const { session, isLoading: isSessionLoading } = useOwnerAuth()
  const location = useLocation()
  const { data: reservations = [], isLoading, isError, refetch } = useQuery<Reservation[]>({
    queryKey: ['reservations', session?.id],
    queryFn: ({ signal }) => restaurantService.listReservations(signal),
    enabled: session?.role === 'customer',
    initialData: isDemo ? [] : undefined,
    staleTime: isDemo ? Infinity : 30_000,
  })
  return <div className="page-container listing-page reservations-page">
    <div className="breadcrumb"><Link to="/inicio">Inicio</Link><span>/</span><span>Mis reservas</span></div>
    <div className="listing-heading"><div><span className="eyebrow"><span className="eyebrow-dot" /> TU HISTORIA EN LA MESA</span><h1>Mis <em>reservas.</em></h1><p>Tus próximos planes para disfrutar, todos en un solo lugar.</p></div><Link to="/restaurantes" className="button button-primary">Encontrar una mesa <ArrowRight size={15} /></Link></div>
    {isDemo && <div className="demo-note">Las solicitudes enviadas en esta sesión se guardan solo en memoria y son de demostración. No son reservas reales.</div>}
    {isSessionLoading ? <p className="reviews-state" role="status">Verificando tu cuenta…</p>
      : session?.role !== 'customer' ? <div className="empty-reservations"><span className="empty-icon"><CalendarDays size={23} /></span><h2>Inicia sesión para consultar tus reservas.</h2><p>Las solicitudes se guardan en tu cuenta de cliente.</p><Link className="button button-primary" to="/login" state={{ from: location.pathname }}>Login o crear cuenta <ArrowRight size={15} /></Link></div>
      : isLoading ? <p className="reviews-state" role="status">Cargando tus reservas…</p>
        : isError ? <div className="state-card" role="alert"><strong>No se pudieron cargar tus reservas.</strong><p>Revisa tu conexión e inténtalo nuevamente.</p><button className="button button-outline" type="button" onClick={() => void refetch()}>Intentar de nuevo</button></div>
          : reservations.length === 0 ? <div className="empty-reservations"><span className="empty-icon"><CalendarDays size={23} /></span><h2>Aún no hay planes en tu agenda.</h2><p>Cuando envíes una solicitud de reserva, la verás aquí.</p><Link className="button button-primary" to="/restaurantes">Explorar restaurantes <ArrowRight size={15} /></Link></div>
            : <div className="reservation-list">{reservations.map((reservation) => <article className="reservation-item" key={reservation.id}><img src={reservation.restaurantImage} alt="" /><div><span className="eyebrow">SOLICITUD DE RESERVA</span><h2>{reservation.restaurantName}</h2><p><CalendarDays size={14} /> {reservation.date} <Clock3 size={14} /> {reservation.time} <MapPin size={14} /> {reservation.guests} personas</p><span className="reservation-status">{reservation.status === 'completed' ? 'Finalizada' : reservation.status === 'confirmed' ? 'Confirmada' : reservation.status === 'cancelled' ? 'Cancelada' : 'Pendiente de confirmación'}</span></div><Link className="button button-outline" to={`/restaurantes/${reservation.restaurantId}`}>Ver restaurante</Link></article>)}</div>}
  </div>
}
