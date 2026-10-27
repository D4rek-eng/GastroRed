import { Heart, MapPin, Star, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Restaurant } from '../types'
import { findRestaurantById } from '../features/restaurants/service'
import { formatDistance } from '../features/location/location'

export function SavedPage() {
  const savedIds = JSON.parse(localStorage.getItem('mesa-favorites') ?? '[]') as string[]
  const saved = savedIds
    .map((id) => findRestaurantById(id))
    .filter((restaurant): restaurant is Restaurant => Boolean(restaurant))
  return <div className="page-container listing-page">
    <div className="breadcrumb"><Link to="/">Inicio</Link><span>/</span><span>Favoritos</span></div>
    <div className="listing-heading"><div><span className="eyebrow"><span className="eyebrow-dot" /> TU COLECCIÓN PERSONAL</span><h1>Lugares para <em>volver.</em></h1><p>Guarda aquí los restaurantes que quieres disfrutar próximamente.</p></div></div>
    {saved.length === 0 ? <div className="empty-reservations"><span className="empty-icon"><Heart size={23} /></span><h2>Tu lista está esperando ese primer favorito.</h2><p>Encuentra un lugar que te encante y guárdalo para después.</p><Link className="button button-primary" to="/restaurantes">Descubrir restaurantes <ArrowRight size={15} /></Link></div> : <div className="restaurant-grid">{saved.map((restaurant) => <article className="restaurant-card" key={restaurant.id}><Link to={`/restaurantes/${restaurant.id}`} className="restaurant-card-image" style={{ backgroundImage: `url("${restaurant.image}")` }} /><div className="restaurant-card-body"><div className="card-kicker"><MapPin size={12} /> {restaurant.neighborhood} <span>·</span> {formatDistance(restaurant.distanceKm)}</div><Link to={`/restaurantes/${restaurant.id}`} className="restaurant-card-title">{restaurant.name}</Link><div className="card-meta">{restaurant.reviewCount > 0 ? <span className="rating"><Star size={14} fill="currentColor" /> {restaurant.rating}</span> : <span className="rating data-rating">Datos OSM</span>}{restaurant.pricePerPerson > 0 ? <span className="price">S/ {restaurant.pricePerPerson} <small>/ persona</small></span> : <span className="price data-price">Precio no disponible</span>}</div><div className="card-bottom"><span>Guardado en este dispositivo</span><Heart size={16} fill="currentColor" /></div></div></article>)}</div>}
  </div>
}
