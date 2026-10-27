import { useQuery } from '@tanstack/react-query'
import { ArrowRight, CalendarDays, Clock3, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Reservation } from '../types'

export function ReservationsPage() {
  const { data: reservations = [] } = useQuery<Reservation[]>({ queryKey: ['reservations'], queryFn: async () => [], initialData: [], staleTime: Infinity })
  return <div className="page-container listing-page reservations-page">
    <div className="breadcrumb"><Link to="/">Inicio</Link><span>/</span><span>Mis reservas</span></div>
    <div className="listing-heading"><div><span className="eyebrow"><span className="eyebrow-dot" /> TU HISTORIA EN LA MESA</span><h1>Mis <em>reservas.</em></h1><p>Tus próximos planes para disfrutar, todos en un solo lugar.</p></div><Link to="/restaurantes" className="button button-primary">Encontrar una mesa <ArrowRight size={15} /></Link></div>
    <div className="demo-note">Las solicitudes enviadas en esta sesión se guardan solo en memoria y son de demostración. No son reservas reales.</div>
    {reservations.length === 0 ? <div className="empty-reservations"><span className="empty-icon"><CalendarDays size={23} /></span><h2>Aún no hay planes en tu agenda.</h2><p>Cuando envíes una solicitud de reserva, la verás aquí.</p><Link className="button button-primary" to="/restaurantes">Explorar restaurantes <ArrowRight size={15} /></Link></div> : <div className="reservation-list">{reservations.map((reservation) => <article className="reservation-item" key={reservation.id}><img src={reservation.restaurantImage} alt="" /><div><span className="eyebrow">SOLICITUD DE RESERVA</span><h2>{reservation.restaurantName}</h2><p><CalendarDays size={14} /> {reservation.date} <Clock3 size={14} /> {reservation.time} <MapPin size={14} /> {reservation.guests} personas</p><span className="reservation-status">{reservation.status === 'confirmed' ? 'Confirmada' : 'Pendiente de confirmación'}</span></div><Link className="button button-outline" to={`/restaurantes/${reservation.restaurantId}`}>Ver restaurante</Link></article>)}</div>}
  </div>
}
