import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, ArrowRight, CalendarDays, Check, Clock3, ExternalLink, Heart, MapPin, Minus, Plus, Star, Utensils, Users } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link, useParams } from 'react-router-dom'
import { PhotoPlaceholder } from '../components/PhotoPlaceholder'
import { restaurantService } from '../features/restaurants/service'
import { reservationContactSchema } from '../features/reservations/validation'
import { distanceBetweenLocations, formatDistance } from '../features/location/location'
import { useUserLocation } from '../features/location/useUserLocation'
import type { Reservation, ReservationInput, Restaurant, RestaurantReview, RestaurantReviewInput } from '../types'

const today = new Date()
const todayLocal = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
const isDemo = import.meta.env.VITE_DEMO_MODE !== 'false'

export function RestaurantDetailPage() {
  const { id = '' } = useParams()
  const queryClient = useQueryClient()
  const { data: restaurant, isLoading, isError } = useQuery({ queryKey: ['restaurant', id], queryFn: ({ signal }) => restaurantService.getById(id, signal) })
  const { data: reviews = [], isLoading: reviewsLoading, isError: reviewsError, refetch: refetchReviews } = useQuery({
    queryKey: ['restaurant-reviews', id],
    queryFn: ({ signal }) => restaurantService.listReviews(id, signal),
  })
  const userLocation = useUserLocation()
  const [savedFavorites, setSavedFavorites] = useState<string[]>(() => JSON.parse(localStorage.getItem('mesa-favorites') ?? '[]') as string[])
  const [selectedTime, setSelectedTime] = useState('')
  const [reviewAuthor, setReviewAuthor] = useState('')
  const [reviewComment, setReviewComment] = useState('')
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewFilter, setReviewFilter] = useState(0)
  const [reviewMessage, setReviewMessage] = useState('')
  const [guests, setGuests] = useState(2)
  const [date, setDate] = useState(todayLocal)
  const [message, setMessage] = useState('')
  const { register, handleSubmit, formState: { errors } } = useForm<{ name: string; email: string }>({
    resolver: zodResolver(reservationContactSchema),
    defaultValues: { name: '', email: '' },
  })
  const isFavorite = restaurant ? savedFavorites.includes(restaurant.id) : false
  const isOsm = restaurant?.source === 'osm'
  const distanceKm = restaurant && userLocation.location
    ? distanceBetweenLocations(userLocation.location, restaurant)
    : restaurant?.distanceKm
  const mapUrl = restaurant
    ? `https://maps.google.com/maps?q=${restaurant.latitude},${restaurant.longitude}&z=${restaurant.source === 'osm' ? 17 : 15}&output=embed`
    : ''
  const directionsUrl = restaurant
    ? `https://www.google.com/maps/dir/?api=1&destination=${restaurant.latitude},${restaurant.longitude}${userLocation.location ? `&origin=${userLocation.location.latitude},${userLocation.location.longitude}` : ''}`
    : ''

  const mutation = useMutation({
    mutationFn: (reservation: ReservationInput) => restaurantService.createReservation(reservation),
    onSuccess: (reservation) => {
      queryClient.setQueryData<Reservation[]>(['reservations'], (previous = []) => [...previous, reservation])
      setMessage('Solicitud recibida. La mesa aún debe ser confirmada por el restaurante.')
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : 'No se pudo enviar la solicitud.'),
  })
  const reviewMutation = useMutation({
    mutationFn: (review: RestaurantReviewInput) => restaurantService.createReview(review),
    onSuccess: (review) => {
      queryClient.setQueryData<RestaurantReview[]>(['restaurant-reviews', id], (previous = []) => [
        review,
        ...previous.filter((item) => item.id !== review.id),
      ])
      setReviewAuthor('')
      setReviewComment('')
      setReviewRating(5)
      setReviewMessage('¡Gracias! Tu comentario ya aparece en las reseñas.')
    },
    onError: (error) => setReviewMessage(error instanceof Error ? error.message : 'No se pudo publicar el comentario.'),
  })

  function submitReservation(contact: { name: string; email: string }) {
    if (!restaurant || !selectedTime) {
      setMessage('Elige uno de los horarios disponibles para continuar.')
      return
    }
    setMessage('')
    mutation.mutate({ restaurantId: restaurant.id, date, time: selectedTime, guests, ...contact })
  }

  function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!restaurant) return
    setReviewMessage('')
    reviewMutation.mutate({
      restaurantId: restaurant.id,
      author: reviewAuthor,
      rating: reviewRating,
      comment: reviewComment,
    })
  }

  const visibleReviews = reviews.filter((review) => !reviewFilter || review.rating === reviewFilter)
  const communityRating = reviews.length
    ? reviews.reduce((total, review) => total + review.rating, 0) / reviews.length
    : 0
  const ratingBreakdown = [5, 4, 3, 2, 1].map((rating) => {
    const count = reviews.filter((review) => review.rating === rating).length
    return { rating, count, percent: reviews.length ? (count / reviews.length) * 100 : 0 }
  })

  if (isLoading) return <div className="page-container loading-copy">Cargando restaurante…</div>
  if (isError || !restaurant) return <div className="page-container state-card"><strong>No encontramos ese restaurante.</strong><Link className="text-link" to="/restaurantes"><ArrowLeft size={15} /> Volver a explorar</Link></div>
  function toggleFavorite(restaurantItem: Restaurant) {
    const updated = isFavorite ? savedFavorites.filter((favorite) => favorite !== restaurantItem.id) : [...savedFavorites, restaurantItem.id]
    localStorage.setItem('mesa-favorites', JSON.stringify(updated))
    setSavedFavorites(updated)
    setMessage(isFavorite ? 'Restaurante eliminado de tus favoritos.' : 'Restaurante guardado en tus favoritos.')
  }

  const photos = restaurant.photos ?? []
  const summaryRating = isOsm ? communityRating : restaurant.rating

  return (
    <div className="page-container detail-page">
      <div className="breadcrumb"><Link to="/restaurantes"><ArrowLeft size={14} /> Explorar</Link><span>/</span><span>{restaurant.neighborhood}</span><span>/</span><span>{restaurant.name}</span></div>
      <div className="detail-badges"><span className="badge-dark">{isOsm ? 'OPENSTREETMAP' : 'ELECCIÓN DE LA CASA'}</span><span>{restaurant.cuisine}</span><span>{restaurant.tags[0]}</span></div>
      <div className="detail-title-row"><div><h1>{restaurant.name}</h1><div className="detail-subtitle">{restaurant.reviewCount > 0 ? <><span className="rating"><Star size={15} fill="currentColor" /> {restaurant.rating.toFixed(1)}</span><span>({restaurant.reviewCount.toLocaleString('es-PE')} reseñas {isDemo ? 'de ejemplo' : 'de clientes'})</span></> : <span className="rating data-rating">Datos de OpenStreetMap</span>}<span>·</span>{restaurant.pricePerPerson > 0 ? <span>S/ {restaurant.pricePerPerson} por persona</span> : <span className="data-price">Precio no disponible</span>}<span>·</span><span><MapPin size={14} /> {isOsm && restaurant.address ? restaurant.address : `${restaurant.neighborhood}, ${restaurant.city}`}</span>{isOsm && <><span>·</span><span>{formatDistance(restaurant.distanceKm)} de ti</span></>}</div></div><button className={`button button-outline${isFavorite ? ' selected' : ''}`} onClick={() => toggleFavorite(restaurant)}><Heart size={15} fill={isFavorite ? 'currentColor' : 'none'} /> {isFavorite ? 'Guardado' : 'Guardar'}</button></div>

      {photos.length > 0 ? (
        <div className={`detail-gallery${photos.length === 1 ? ' single' : ''}`}>
          <figure className="gallery-main">
            <img src={photos[0].src} alt={photos[0].alt} />
            <figcaption>{photos[0].credit}</figcaption>
          </figure>
          {photos.length > 1 && (
            <div className="gallery-side">
              {photos.slice(1, 3).map((photo) => (
                <figure key={photo.src}>
                  <img src={photo.src} alt={photo.alt} loading="lazy" />
                </figure>
              ))}
              {photos.length === 2 && <div className="gallery-info"><UtensilsLabel /><strong>{restaurant.cuisine}</strong><span>{restaurant.ambience}</span></div>}
            </div>
          )}
        </div>
      ) : (
        <div className="detail-gallery empty">
          <PhotoPlaceholder name={restaurant.name} />
          <p>Este local no publica una foto propia. Preferimos no mostrar una imagen que no le corresponda.</p>
        </div>
      )}
      {photos.length > 0 && (
        <p className="gallery-credit-line">
          Fotografías reales de Wikimedia Commons, con licencia abierta. <Link to="/creditos">Ver autores y licencias</Link>
        </p>
      )}

      <div className="detail-columns">
        <div className="detail-content">
          <section className="detail-section intro-section"><span className="eyebrow">{isOsm ? 'DATOS ABIERTOS DEL MAPA' : 'SABORES DEL PERÚ'}</span><h2>Una mesa para <em>disfrutar.</em></h2><p>{restaurant.description}</p>{isOsm ? <p>Horario registrado en el mapa: {restaurant.hours}. La disponibilidad y la carta deben confirmarse directamente con el restaurante.</p> : <p>{restaurant.hours}. Reserva con anticipación para una mejor experiencia. Los detalles de disponibilidad se confirman con el restaurante.</p>}<div className="detail-facts"><span><Clock3 size={16} /><strong>Horario</strong>{restaurant.hours}</span><span><MapPin size={16} /><strong>Ubicación</strong>{isOsm && restaurant.address ? restaurant.address : `${restaurant.neighborhood}, ${restaurant.city}`}</span>{isOsm ? <span><Utensils size={16} /><strong>Fuente</strong>{restaurant.osmUrl ? <a href={restaurant.osmUrl} target="_blank" rel="noreferrer">Ver ficha en OpenStreetMap</a> : 'OpenStreetMap'}</span> : <span><Users size={16} /><strong>Ambiente</strong>{restaurant.ambience}</span>}</div>{isOsm && restaurant.website && <a className="text-link detail-website" href={restaurant.website} target="_blank" rel="noreferrer">Sitio web del restaurante <ExternalLink size={14} /></a>}</section>
          <section className="detail-section"><div className="menu-heading"><div><span className="eyebrow">PARA EMPEZAR A ELEGIR</span><h2>Platos <em>destacados.</em></h2></div><span className="demo-label">{isOsm ? 'Datos OSM' : 'Precios en soles'}</span></div>{restaurant.menuHighlights.length > 0 ? <div className="menu-list">{restaurant.menuHighlights.map((dish) => <div className="menu-item" key={dish.name}>{dish.image ? <img className="menu-item-image" src={dish.image} alt={dish.name} loading="lazy" /> : <span className="menu-item-image menu-item-image-empty"><Utensils size={16} /></span>}<div className="menu-item-copy"><strong>{dish.name}</strong><p>{dish.description}</p></div><span className="menu-item-price">S/ {dish.price}</span></div>)}</div> : <div className="menu-unavailable"><strong>La carta no está publicada en el mapa.</strong><p>Este local aparece en OpenStreetMap, pero no incluye su menú ni sus precios. Confírmalos directamente con el restaurante antes de tu visita.</p>{restaurant.website && <a className="text-link" href={restaurant.website} target="_blank" rel="noreferrer">Visitar el sitio web <ExternalLink size={14} /></a>}</div>}</section>
          <section className="detail-section review-section">
            <span className="eyebrow">OPINIONES DE LA COMUNIDAD</span>
            <h2>Lo que dicen quienes <em>ya vinieron.</em></h2>
            <div className="review-summary">
              <div className="review-score">
                <strong>{summaryRating ? summaryRating.toFixed(1) : '—'}</strong>
                <span className="stars" aria-label={summaryRating ? `${summaryRating.toFixed(1)} de 5 estrellas` : 'Sin valoración'}>★★★★★</span>
                <span>{isOsm ? (reviews.length ? `${reviews.length} ${reviews.length === 1 ? 'comentario' : 'comentarios'} de la comunidad · no verificados por el restaurante.` : 'Sin reseñas verificadas.') : `${restaurant.reviewCount.toLocaleString('es-PE')} opiniones · ${isDemo ? 'reseñas de ejemplo' : 'reseñas de clientes'}`}</span>
              </div>
              {reviews.length > 0 && (
                <div className="review-bars" aria-label="Distribución de las reseñas publicadas">
                  {ratingBreakdown.map((item) => (
                    <div key={item.rating}>
                      <span>{item.rating} ★ <small>({item.count})</small></span>
                      <div><i style={{ width: `${item.percent}%` }} /></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <form className="review-form" onSubmit={submitReview}>
              <strong>Comparte tu experiencia</strong>
              <label className="contact-field">Tu nombre
                <input value={reviewAuthor} onChange={(event) => setReviewAuthor(event.target.value)} maxLength={80} required placeholder="Nombre y apellido" />
              </label>
              <fieldset className="review-rating-picker">
                <legend>Tu valoración</legend>
                <div role="group" aria-label="Valora de 1 a 5 estrellas">
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <button
                      key={rating}
                      type="button"
                      aria-label={`${rating} ${rating === 1 ? 'estrella' : 'estrellas'}`}
                      aria-pressed={reviewRating === rating}
                      className={reviewRating >= rating ? 'selected' : ''}
                      onClick={() => setReviewRating(rating)}
                    ><Star size={19} fill="currentColor" /></button>
                  ))}
                </div>
              </fieldset>
              <label className="contact-field">Tu comentario
                <textarea value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} maxLength={1000} required rows={3} placeholder="¿Qué te pareció la comida y el servicio?" />
                <small>{reviewComment.length}/1000 caracteres</small>
              </label>
              <button className="button button-primary" type="submit" disabled={reviewMutation.isPending}>
                {reviewMutation.isPending ? 'Publicando…' : 'Publicar comentario'}
              </button>
              {reviewMessage && <p className={`review-form-message${reviewMutation.isError ? ' error' : ''}`} role="status">{reviewMessage}</p>}
            </form>
            {reviewsLoading && <p className="reviews-state" role="status">Cargando comentarios…</p>}
            {reviewsError && <div className="reviews-state reviews-error" role="alert">No se pudieron cargar los comentarios. <button type="button" onClick={() => void refetchReviews()}>Intentar de nuevo</button></div>}
            <div className="review-filter" aria-label="Filtrar reseñas por valoración">
              <strong>Filtrar:</strong>
              {[0, 5, 4, 3, 2, 1].map((rating) => (
                <button
                  key={rating}
                  type="button"
                  className={reviewFilter === rating ? 'active' : ''}
                  aria-pressed={reviewFilter === rating}
                  onClick={() => setReviewFilter(rating)}
                >{rating ? `${rating} ★` : 'Todas'}</button>
              ))}
            </div>
            {!reviewsLoading && !reviewsError && visibleReviews.length === 0 && (
              <p className="reviews-state">{reviews.length ? 'No hay comentarios con esa valoración.' : 'Todavía no hay comentarios para este restaurante.'}</p>
            )}
            <div className="review-list">
              {visibleReviews.map((review) => (
                <article className="review-card" key={review.id}>
                  <div className="review-card-heading">
                    <span className="review-avatar" aria-hidden="true">{review.author.charAt(0).toLocaleUpperCase('es')}</span>
                    <div><strong>{review.author}</strong><small>{review.visit}</small></div>
                    <span className="review-rating"><Star size={13} fill="currentColor" /> {review.rating.toFixed(1)}</span>
                  </div>
                  <p>{review.comment}</p>
                  <time dateTime={review.date}>{new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium' }).format(new Date(`${review.date}T12:00:00`))}</time>
                </article>
              ))}
            </div>
          </section>
          <section className="detail-section map-preview">
            <span className="eyebrow">CÓMO LLEGAR</span>
            <h2>En el corazón de <em>{restaurant.neighborhood}.</em></h2>
            <div className="map-canvas">
              <iframe
                title={`Mapa de ${restaurant.name} en Google Maps`}
                src={mapUrl}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
              <div className="map-location-card">
                <MapPin size={20} />
                <span>
                  <strong>{isOsm && restaurant.address ? restaurant.address : `${restaurant.neighborhood}, ${restaurant.city}`}</strong>
                  <small>{userLocation.location && distanceKm !== undefined ? `${formatDistance(distanceKm)} desde ${userLocation.location.label}` : isOsm ? 'Ubicación exacta según OpenStreetMap' : 'Ubicación del restaurante · Activa tu ubicación para calcular la distancia'}</small>
                </span>
              </div>
            </div>
            <a href={directionsUrl} target="_blank" rel="noreferrer" className="text-link">Cómo llegar con Google Maps <ExternalLink size={14} /></a>
          </section>
        </div>
        <aside className="booking-card">
          {isOsm ? (
            <div className="booking-form booking-osm">
              <span className="eyebrow"><MapPin size={13} /> INFORMACIÓN DEL LOCAL</span>
              <h2>Antes de <em>ir.</em></h2>
              <div className="booking-osm-facts">
                <span><Clock3 size={15} /><strong>Horario</strong>{restaurant.hours}</span>
                <span><MapPin size={15} /><strong>Dirección</strong>{restaurant.address || `${restaurant.neighborhood}, ${restaurant.city}`}</span>
                {restaurant.phone && <span><Users size={15} /><strong>Teléfono</strong><a href={`tel:${restaurant.phone}`}>{restaurant.phone}</a></span>}
              </div>
              {restaurant.website && <a className="text-link booking-osm-link" href={restaurant.website} target="_blank" rel="noreferrer">Sitio web del restaurante <ExternalLink size={14} /></a>}
              {restaurant.osmUrl && <a className="text-link booking-osm-link" href={restaurant.osmUrl} target="_blank" rel="noreferrer">Ver ficha en OpenStreetMap <ExternalLink size={14} /></a>}
              <p className="booking-osm-note">Este restaurante no gestiona reservas en GastroRed. Llama o visítalo directamente para confirmar disponibilidad.</p>
              <a className="button button-primary booking-submit" href={directionsUrl} target="_blank" rel="noreferrer">Cómo llegar <ArrowRight size={16} /></a>
            </div>
          ) : (
          <form className="booking-form" onSubmit={handleSubmit(submitReservation)}>
            <span className="eyebrow"><span className="availability-dot" /> RESERVA TU MESA</span><h2>¿Cuándo <em>nos vemos?</em></h2>
            <label className="booking-field"><span><CalendarDays size={15} /> Fecha</span><input type="date" value={date} min={todayLocal} onChange={(event) => setDate(event.target.value)} /></label>
            <div className="booking-field"><span><Users size={15} /> Comensales</span><div className="guest-stepper"><button type="button" aria-label="Quitar comensales" onClick={() => setGuests((count) => Math.max(1, count - 1))}><Minus size={14} /></button><strong>{guests} personas</strong><button type="button" aria-label="Añadir comensales" onClick={() => setGuests((count) => Math.min(12, count + 1))}><Plus size={14} /></button></div></div>
            <div className="booking-times"><span><Clock3 size={15} /> Horarios de demostración</span><div>{restaurant.availableTimes.map((time) => <button type="button" key={time} className={`time-chip${selectedTime === time ? ' active' : ''}`} aria-pressed={selectedTime === time} onClick={() => { setSelectedTime(time); setMessage('') }}>{time}</button>)}</div></div>
            {selectedTime && <div className="availability-callout"><Check size={15} /> Horario de ejemplo. La disponibilidad real debe confirmarla el restaurante.</div>}
            <label className="contact-field">Tu nombre<input autoComplete="name" {...register('name')} placeholder="Nombre y apellido" />{errors.name && <span className="field-error">{errors.name.message}</span>}</label>
            <label className="contact-field">Correo electrónico<input type="email" autoComplete="email" {...register('email')} placeholder="tu@correo.com" />{errors.email && <span className="field-error">{errors.email.message}</span>}</label>
            <button className="button button-primary booking-submit" type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Enviando solicitud…' : 'Solicitar reserva'} <ArrowRight size={16} /></button>
            {message && <p className={`booking-message${mutation.isError ? ' error' : ''}`} role="status">{message}</p>}
            <small className="booking-footnote">Modo demostración · No se envía ninguna reserva real.</small>
          </form>
          )}
        </aside>
      </div>
    </div>
  )
}

function UtensilsLabel() {
  return <span className="detail-illustration"><Utensils size={18} /></span>
}
