import { useQuery } from '@tanstack/react-query'
import { ArrowDown, ArrowRight, ArrowUpRight, Heart, MapPin, Search, Sparkles, Star, Utensils } from 'lucide-react'
import { Link } from 'react-router-dom'
import { restaurants } from '../features/restaurants/data'
import { DEFAULT_NEARBY_RADIUS, searchNearby } from '../features/restaurants/nearby'
import { formatDistance } from '../features/location/location'
import { useUserLocation } from '../features/location/useUserLocation'
import { PhotoPlaceholder } from '../components/PhotoPlaceholder'

export function HomePage() {
  const userLocation = useUserLocation()
  const location = userLocation.location
  const nearbyQuery = useQuery({
    queryKey: ['nearby-home', location?.latitude, location?.longitude],
    queryFn: ({ signal }) => searchNearby(location!, DEFAULT_NEARBY_RADIUS, { expand: true, signal }),
    enabled: Boolean(location),
    staleTime: 5 * 60_000,
  })

  const nearby = nearbyQuery.data?.places ?? []
  const cards = restaurants.slice(0, 3)
  const placeLabel = location?.shortLabel || 'tu zona'
  const radiusLabel = nearbyQuery.data?.radiusUsed ?? DEFAULT_NEARBY_RADIUS
  const whereLabel = location?.district || location?.city || ''

  return (
    <>
      <section className="hero">
        <div className="hero-image" role="img" aria-label="Interior de un restaurante con vistas al mar en Lima" />
        <div className="hero-shade" />
        <div className="hero-copy">
          <span className="eyebrow light"><Sparkles size={13} /> TU PRÓXIMA MESA FAVORITA</span>
          <h1>Hay un lugar<br />para cada <em>antojo.</em></h1>
          <p>Encuentra ese restaurante especial. Compara opciones, revisa la carta y reserva sin darle tantas vueltas.</p>
          <Link to="/restaurantes" className="button button-primary button-large">Encuentra tu mesa <ArrowRight size={17} /></Link>
        </div>
        <div className="hero-caption"><span className="caption-line" /> {location?.shortLabel ?? 'Perú'} <span>·</span> Una guía para saborear</div>
        <div className="hero-index">01 <span>/</span> 04</div>
      </section>

      <section className="search-panel page-container" aria-label="Buscar restaurantes">
        <form className="search-form" action="/restaurantes">
          <label className="search-field"><MapPin size={18} /><span><small>¿DÓNDE?</small><input aria-label="Distrito o ciudad" name="place" placeholder="Distrito o ciudad" defaultValue={whereLabel} key={whereLabel} /></span></label>
          <label className="search-field"><Utensils size={18} /><span><small>¿QUÉ SE TE ANTOJA?</small><input aria-label="Cocina o restaurante" name="q" placeholder="Cocina, plato o restaurante" /></span></label>
          <button className="button button-primary search-submit" type="submit"><Search size={17} /> Buscar restaurantes</button>
        </form>
        <div className="search-hint"><span>HOY SE COME BIEN</span><span>{location ? `Mostrando tu guía completa y locales a ${radiusLabel} m de ${placeLabel}.` : 'Activa tu ubicación y descubre qué hay a 200 metros a la redonda.'}</span></div>
      </section>

      <section className="section page-container">
        <div className="section-heading">
          <div>
            <span className="eyebrow"><span className="eyebrow-dot" /> UNA BUENA MESA, CERCA DE TI</span>
            <h2>Planazos para <em>hoy</em></h2>
            <p>Cartas con precios, opiniones y fotos para elegir con confianza.</p>
          </div>
          <Link className="text-link" to="/restaurantes">Ver todos <ArrowUpRight size={16} /></Link>
        </div>

        {!location && (
          <div className="location-banner">
            <MapPin size={18} />
            <div><strong>Activa tu ubicación para ordenar por distancia</strong><span>Tu navegador te pedirá permiso. Además de la guía completa, verás los locales reales que aparecen en el mapa cerca de ti.</span></div>
            <button className="button button-outline" type="button" onClick={userLocation.requestLocation} disabled={userLocation.isLocating}>
              {userLocation.isLocating ? 'Buscando…' : 'Usar mi ubicación'}
            </button>
          </div>
        )}

        <div className="restaurant-grid">
          {cards.map((restaurant, index) => (
            <article className="restaurant-card" key={restaurant.id}>
              <Link
                to={`/restaurantes/${restaurant.id}`}
                className={`restaurant-card-image${restaurant.image ? '' : ' is-empty'}`}
                style={restaurant.image ? { backgroundImage: `url("${restaurant.image}")` } : undefined}
                aria-label={`Ver ${restaurant.name}`}
              >
                {!restaurant.image && <PhotoPlaceholder name={restaurant.name} />}
                <span className="image-tag">{index === 0 ? 'FAVORITO LOCAL' : restaurant.cuisine.toUpperCase()}</span>
                <span className="image-favorite"><Heart size={17} /></span>
              </Link>
              <div className="restaurant-card-body">
                <div className="card-kicker">{restaurant.neighborhood} <span>·</span> {formatDistance(restaurant.distanceKm)}</div>
                <Link to={`/restaurantes/${restaurant.id}`} className="restaurant-card-title">{restaurant.name}</Link>
                <p>{restaurant.description}</p>
                <div className="card-meta">
                  <span className="rating"><Star size={14} fill="currentColor" /> {restaurant.rating.toFixed(1)} <small>({restaurant.reviewCount.toLocaleString('es-PE')})</small></span>
                  <span className="price">S/ {restaurant.pricePerPerson} <small>/ persona</small></span>
                </div>
                <div className="card-bottom">
                  <span>{restaurant.availableTimes[0] ? <><span className="availability-dot" /> {restaurant.availableTimes[0]} · Disponible</> : restaurant.hours}</span>
                  <Link to={`/restaurantes/${restaurant.id}`} aria-label={`Ver ${restaurant.name}`}><ArrowRight size={17} /></Link>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="demo-note">
          <Sparkles size={14} />
          <span>Datos de demostración: cartas, precios y reseñas ilustrativos. Fotografías reales de Wikimedia Commons con <Link to="/creditos">créditos</Link>.</span>
        </div>
      </section>

      {location && (
        <section className="section page-container nearby-home">
          <div className="section-heading">
            <div>
              <span className="eyebrow"><span className="eyebrow-dot" /> OPENSTREETMAP · {radiusLabel} M</span>
              <h2>Descubierto <em>cerca de ti.</em></h2>
              <p>Locales reales del mapa alrededor de {placeLabel}. Solo mostramos una foto cuando el local la publica.</p>
            </div>
            <Link className="text-link" to="/restaurantes">Ver en el mapa <ArrowUpRight size={16} /></Link>
          </div>

          {nearbyQuery.isLoading && (
            <div className="nearby-home-grid">{[1, 2, 3].map((item) => <div className="skeleton-card osm-skeleton" key={item}><div /><span /><span /></div>)}</div>
          )}

          {nearbyQuery.isError && (
            <div className="demo-note warning-note"><MapPin size={14} /> No pudimos consultar OpenStreetMap ahora mismo. La guía completa sigue disponible.</div>
          )}

          {!nearbyQuery.isLoading && !nearbyQuery.isError && nearby.length === 0 && (
            <div className="state-card">
              <strong>No hay locales de OpenStreetMap a {radiusLabel} m de {placeLabel}.</strong>
              <p>La guía completa sigue disponible en la sección de restaurantes, con cartas, precios y comentarios.</p>
              <Link className="button button-primary" to="/restaurantes">Explorar la guía <ArrowRight size={15} /></Link>
            </div>
          )}

          {nearby.length > 0 && (
            <div className="nearby-home-grid">
              {nearby.slice(0, 3).map((place) => (
                <article className="osm-card" key={place.id}>
                  <Link
                    to={`/restaurantes/${place.id}`}
                    className={`osm-card-image${place.image ? '' : ' is-empty'}`}
                    style={place.image ? { backgroundImage: `url("${place.image}")` } : undefined}
                    aria-label={`Ver ${place.name}`}
                  >
                    {!place.image && <PhotoPlaceholder name={place.name} compact />}
                    <span className="image-tag">EN EL MAPA</span>
                  </Link>
                  <div className="osm-card-body">
                    <div className="card-kicker"><MapPin size={12} /> {place.neighborhood} <span>·</span> {formatDistance(place.distanceKm)}</div>
                    <Link className="osm-card-title" to={`/restaurantes/${place.id}`}>{place.name}</Link>
                    <p>{place.cuisine} · {place.hours}</p>
                    <Link className="text-link" to={`/restaurantes/${place.id}`}>Ver ficha <ArrowRight size={14} /></Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="editorial-band">
        <div className="page-container editorial-inner">
          <span className="eyebrow light">UNA ELECCIÓN MÁS FÁCIL</span>
          <h2>¿Entre dos lugares?<br /><em>Que decida la mesa.</em></h2>
          <p>Compara precio, valoración y ubicación para encontrar el lugar perfecto para cada plan.</p>
          <Link to="/comparador" className="button button-light">Prueba el comparador <ArrowRight size={16} /></Link>
          <span className="editorial-number">M&S / 02</span>
        </div>
      </section>

      <section className="section page-container discover-strip">
        <div><span className="eyebrow"><span className="eyebrow-dot" /> TU PLAN, TU ELECCIÓN</span><h2>Elige por <em>antojo.</em></h2></div>
        <Link to="/restaurantes?cuisine=Marina" className="discover-tile seafood"><span>01 / SABOR A MAR</span><strong>La costa<br />en la mesa</strong><ArrowDown size={17} /></Link>
        <Link to="/restaurantes?cuisine=Criolla" className="discover-tile criollo"><span>02 / TRADICIÓN PERUANA</span><strong>Recetas con<br />historia</strong><ArrowDown size={17} /></Link>
        <Link to="/restaurantes" className="discover-tile all-dining"><span>03 / DESCUBRE SABORES</span><strong>Tu siguiente<br />gran plan</strong><ArrowDown size={17} /></Link>
      </section>
    </>
  )
}
