import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { CSSProperties } from 'react'
import { ArrowRight, Check, Clock3, MapPin, Plus, Star, Trash2, Utensils } from 'lucide-react'
import { Link } from 'react-router-dom'
import { calculateScore, weightsWithPriority } from '../features/comparison/score'
import { restaurantService } from '../features/restaurants/service'
import type { Restaurant } from '../types'

const initialSelection = ['la-mar', 'isolina']
const criteria = [
  { key: 'rating', label: 'Valoración', detail: 'Opiniones de comensales' },
  { key: 'price', label: 'Precio por persona', detail: 'Ticket promedio referencial' },
  { key: 'availability', label: 'Disponibilidad', detail: 'Horarios de ejemplo' },
  { key: 'distance', label: 'Ubicación y acceso', detail: 'Distancia referencial' },
] as const

export function ComparePage() {
  const { data: restaurants = [], isLoading, isError } = useQuery({
    queryKey: ['restaurants', 'compare'],
    queryFn: ({ signal }) => restaurantService.list({
      query: '',
      cuisine: '',
      maxPrice: Number.MAX_SAFE_INTEGER,
      minRating: 0,
      sort: 'recommended',
    }, signal),
  })
  const [selected, setSelected] = useState<string[]>(initialSelection)
  const [priority, setPriority] = useState<(typeof criteria)[number]['key']>('rating')
  const [plan, setPlan] = useState('Viernes · 2 personas')
  const items = useMemo(() => selected.map((id) => restaurants.find((restaurant) => restaurant.id === id)).filter((item) => item !== undefined), [selected, restaurants])
  const weights = useMemo(() => weightsWithPriority(priority), [priority])

  function toggleRestaurant(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 4 ? [...current, id] : current)
  }

  function scoreFor(item: Restaurant) {
    return calculateScore({
      rating: item.rating,
      price: item.pricePerPerson,
      distance: item.distanceKm,
      availability: item.availableTimes.length / 3,
    }, weights) ?? 0
  }
  const topChoice = items.toSorted((a, b) => scoreFor(b) - scoreFor(a))[0]

  return (
    <div className="page-container compare-page">
      <div className="breadcrumb"><Link to="/">Inicio</Link><span>/</span><span>Comparador</span></div>
      <div className="compare-intro">
        <div><span className="eyebrow"><span className="eyebrow-dot" /> UNA DECISIÓN CON BUEN SABOR</span><h1>Compara cara <em>a cara.</em></h1><p>Encuentra la mesa que va mejor con tu plan, sin perderte ningún detalle.</p></div>
        <label className="compare-date"><CalendarIcon /><span>Plan demo · no consulta disponibilidad<select value={plan} onChange={(event) => setPlan(event.target.value)}><option>Viernes · 2 personas</option><option>Sábado · 2 personas</option><option>Domingo · 4 personas</option></select></span></label>
      </div>
      <div className="compare-filter-bar"><strong>PRIORIZA LO QUE IMPORTA</strong>{criteria.map((item) => <button className={`priority-chip${priority === item.key ? ' active' : ''}`} key={item.key} onClick={() => setPriority(item.key)}>{item.label}</button>)}<span className="compare-count">{items.length} / 4 elegidos</span></div>
      {isLoading && <p className="reviews-state" role="status">Cargando datos para comparar…</p>}
      {isError && <p className="reviews-state reviews-error" role="alert">No se pudieron cargar los restaurantes para comparar.</p>}
      <div className="compare-restaurant-row">
        <div className="compare-label-block"><span className="eyebrow">TUS OPCIONES</span><h2>Una buena<br />decisión empieza <em>aquí.</em></h2><p>Compara hasta cuatro lugares.</p><span className="live-dot">Datos demo ilustrativos</span></div>
        {items.map((item) => <article className="compare-restaurant" key={item.id}>
          <button className="remove-compare" aria-label={`Quitar ${item.name}`} onClick={() => toggleRestaurant(item.id)}><Trash2 size={15} /></button>
          <Link to={`/restaurantes/${item.id}`} className="compare-image" style={{ backgroundImage: `url("${item.image}")` }} />
          <span className="compare-kicker">{item.cuisine} · {item.neighborhood}</span>
          <Link className="compare-title" to={`/restaurantes/${item.id}`}>{item.name}</Link>
          <div className="compare-rating"><Star size={14} fill="currentColor" /> <strong>{item.rating.toFixed(1)}</strong><small>{item.reviewCount.toLocaleString('es-PE')} reseñas demo</small></div>
          <Link className="button button-primary compare-book" to={`/restaurantes/${item.id}`}>Ver restaurante <ArrowRight size={14} /></Link>
        </article>)}
        {items.length < 4 && <div className="add-compare-card"><span className="add-compare-icon"><Plus size={19} /></span><strong>Añade otro lugar</strong><p>Compara más opciones para tu plan.</p><select aria-label="Añadir restaurante al comparador" value="" onChange={(event) => event.target.value && toggleRestaurant(event.target.value)}><option value="">Elegir restaurante</option>{restaurants.filter((item) => !selected.includes(item.id)).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></div>}
      </div>
      <div className="comparison-table">
        {criteria.map((criterion) => <div className="comparison-row" key={criterion.key}>
          <div className="comparison-criterion"><span className="criterion-icon">{criterion.key === 'rating' ? <Star size={16} /> : criterion.key === 'price' ? <span>S/</span> : criterion.key === 'availability' ? <Clock3 size={16} /> : <MapPin size={16} />}</span><span><strong>{criterion.label}</strong><small>{criterion.detail}</small></span></div>
          {items.map((item) => <div className={`comparison-value${priority === criterion.key ? ' priority-value' : ''}`} key={item.id}>
            {criterion.key === 'rating' && <><strong className="large-value">{item.rating.toFixed(1)} <Star size={16} fill="currentColor" /></strong><span>{item.reviewCount.toLocaleString('es-PE')} reseñas (demo)</span></>}
            {criterion.key === 'price' && <><strong className="large-value">S/ {item.pricePerPerson}</strong><span>Estimado por persona</span><span className="value-tag">Precios de ejemplo</span></>}
            {criterion.key === 'availability' && <><strong className="value-status"><span className="availability-dot" /> {item.availableTimes[0]} · {item.availableTimes.length} turnos demo</strong><span>Consultar disponibilidad real</span></>}
            {criterion.key === 'distance' && <><strong className="large-value">{item.distanceKm.toFixed(1)} km</strong><span>{item.neighborhood}, {item.city}</span><span className="value-tag"><MapPin size={12} /> Distancia referencial</span></>}
          </div>)}
        </div>)}
        <div className="comparison-row extra-row"><div className="comparison-criterion"><span className="criterion-icon"><Utensils size={16} /></span><span><strong>Ambiente y ocasión</strong><small>El lugar y su estilo</small></span></div>{items.map((item) => <div className="comparison-value" key={item.id}><strong>{item.ambience}</strong><span>{item.tags.join(' · ')}</span></div>)}</div>
        <div className="comparison-row extra-row"><div className="comparison-criterion"><span className="criterion-icon"><Check size={16} /></span><span><strong>Política de reserva</strong><small>Condiciones informativas demo</small></span></div>{items.map((item) => <div className="comparison-value" key={item.id}><strong>{item.reservationPolicy}</strong><span>No confirmada por el restaurante</span></div>)}</div>
        <div className="comparison-row score-row"><div className="comparison-criterion"><span className="criterion-icon"><Check size={16} /></span><span><strong>Puntuación integral</strong><small>Valoración, precio, acceso y turnos</small></span></div>{items.map((item) => <div className="comparison-value score-value" key={item.id}><span className="score-ring" style={{ '--score': `${scoreFor(item)}%` } as CSSProperties}><strong>{scoreFor(item)}</strong></span><small>/ 100 · puntuación ilustrativa</small>{topChoice?.id === item.id && <span className="best-choice">Mejor puntuación demo</span>}<span className="score-reason">{item.rating.toFixed(1)} estrellas · S/ {item.pricePerPerson}/persona · {item.distanceKm.toFixed(1)} km</span></div>)}</div>
      </div>
      <div className="score-explanation"><span className="eyebrow">CÓMO LEER ESTA COMPARACIÓN</span><p>La puntuación demo combina valoración ({Math.round(weights.rating * 100)}%), precio ({Math.round(weights.price * 100)}%), disponibilidad ({Math.round(weights.availability * 100)}%) y distancia ({Math.round(weights.distance * 100)}%). El criterio prioritario recibe el 55% del peso y el resto se redistribuye proporcionalmente; la fórmula se normaliza a 100 y omite datos que no estén disponibles. No representa disponibilidad confirmada ni datos de un backend.</p><Link to="/restaurantes" className="text-link">Seguir explorando <ArrowRight size={15} /></Link></div>
      {items.length < 2 && <div className="state-card"><strong>Añade al menos dos restaurantes para comparar.</strong><Link className="text-link" to="/restaurantes">Explorar restaurantes <ArrowRight size={15} /></Link></div>}
    </div>
  )
}

function CalendarIcon() {
  return <span className="calendar-mark">24</span>
}
