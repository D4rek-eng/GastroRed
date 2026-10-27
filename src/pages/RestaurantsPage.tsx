import { lazy, Suspense, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Check, MapPin, Search, SlidersHorizontal, Sparkles, Star, X } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { restaurantService, filterRestaurants } from '../features/restaurants/service'
import {
  DEFAULT_NEARBY_RADIUS,
  NEARBY_RADII,
  searchNearby,
} from '../features/restaurants/nearby'
import { distanceBetweenLocations, formatAccuracy, formatDistance } from '../features/location/location'
import { useUserLocation } from '../features/location/useUserLocation'
import { PhotoPlaceholder } from '../components/PhotoPlaceholder'
import type { RestaurantFilters } from '../types'

const NearbyMap = lazy(() => import('../components/NearbyMap').then((module) => ({ default: module.NearbyMap })))

const initialFilters: RestaurantFilters = { query: '', cuisine: '', maxPrice: 200, minRating: 0, sort: 'recommended' }

export function RestaurantsPage() {
  const [params, setParams] = useSearchParams()
  const [filters, setFilters] = useState<RestaurantFilters>({
    ...initialFilters,
    query: params.get('q') ?? '',
    cuisine: params.get('cuisine') ?? '',
  })
  const [showFilters, setShowFilters] = useState(false)
  const userLocation = useUserLocation()
  const location = userLocation.location

  const requestedRadius = Number(params.get('radio'))
  const radius = NEARBY_RADII.includes(requestedRadius as (typeof NEARBY_RADII)[number])
    ? requestedRadius
    : DEFAULT_NEARBY_RADIUS

  const nearbyQuery = useQuery({
    queryKey: ['nearby-restaurants', location?.latitude, location?.longitude, radius],
    queryFn: ({ signal }) => searchNearby(location!, radius, { expand: radius === DEFAULT_NEARBY_RADIUS, signal }),
    enabled: Boolean(location),
    staleTime: 5 * 60_000,
  })
  const demoQuery = useQuery({
    queryKey: ['restaurants', filters],
    queryFn: ({ signal }) => restaurantService.list(filters, signal),
  })

  const catalog = useMemo(
    () => (demoQuery.data ?? []).map((restaurant) => location
      ? { ...restaurant, distanceKm: distanceBetweenLocations(location, restaurant) }
      : restaurant),
    [demoQuery.data, location],
  )
  const results = useMemo(() => filterRestaurants(catalog, filters), [catalog, filters])
  const nearbyPlaces = useMemo(() => nearbyQuery.data?.places ?? [], [nearbyQuery.data])
  const visibleNearby = useMemo(() => {
    const query = filters.query.trim().toLocaleLowerCase('es')
    if (!query) return nearbyPlaces
    return nearbyPlaces.filter((place) => `${place.name} ${place.cuisine} ${place.neighborhood}`.toLocaleLowerCase('es').includes(query))
  }, [nearbyPlaces, filters.query])
  const cuisines = useMemo(
    () => [...new Set(catalog.map((restaurant) => restaurant.cuisine))].sort((a, b) => a.localeCompare(b, 'es')),
    [catalog],
  )
  const radiusUsed = nearbyQuery.data?.radiusUsed ?? radius
  const expanded = nearbyQuery.data?.expanded ?? false
  const activeFilters = useMemo(() => [
    ...(filters.cuisine ? [filters.cuisine] : []),
    ...(filters.maxPrice < 200 ? [`Hasta S/ ${filters.maxPrice}`] : []),
    ...(filters.minRating > 0 ? [`${filters.minRating}+ estrellas`] : []),
  ], [filters])

  function updateFilter<K extends keyof RestaurantFilters>(key: K, value: RestaurantFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value }))
    if (key === 'query') {
      const next = new URLSearchParams(params)
      if (value) next.set('q', String(value))
      else next.delete('q')
      setParams(next, { replace: true })
    }
  }

  function updateRadius(value: (typeof NEARBY_RADII)[number]) {
    const next = new URLSearchParams(params)
    if (value === DEFAULT_NEARBY_RADIUS) next.delete('radio')
    else next.set('radio', String(value))
    setParams(next, { replace: true })
  }

  function clearFilters() {
    setFilters(initialFilters)
    const next = new URLSearchParams()
    if (radius !== DEFAULT_NEARBY_RADIUS) next.set('radio', String(radius))
    setParams(next, { replace: true })
  }

  const placeLabel = location?.shortLabel || 'tu zona'
  const accuracyWarning = location && location.accuracy > 500
    ? `La ubicación que entregó tu navegador es aproximada (${formatAccuracy(location.accuracy)}). Si no corresponde a tu distrito, activa la “ubicación precisa” del dispositivo y vuelve a intentarlo.`
    : ''
  const locationMessage = userLocation.error || (location
    ? `Usamos tu ubicación solo para calcular distancias y descubrir locales en OpenStreetMap alrededor de ${location.label}. Precisión ${formatAccuracy(location.accuracy) || 'no informada'}. No guardamos tus coordenadas.`
    : 'Activa tu ubicación para ver distancias reales y descubrir locales de OpenStreetMap. La guía con precios y comentarios está disponible siempre.')

  return (
    <div className="page-container listing-page">
      <div className="breadcrumb"><Link to="/">Inicio</Link><span>/</span><span>Restaurantes</span></div>
      <div className="listing-heading">
        <div>
          <span className="eyebrow"><span className="eyebrow-dot" /> {location ? `A ${radiusUsed} M DE ${placeLabel.toLocaleUpperCase('es')}` : 'UNA GUÍA COMPLETA PARA ELEGIR'}</span>
          <h1>Restaurantes con <em>sabor.</em></h1>
          <p>Cartas, precios por plato, opiniones y fotos reales. {location ? `Además, locales del mapa alrededor de ${placeLabel}.` : 'Activa tu ubicación para sumar los locales que hay cerca de ti.'}</p>
        </div>
        <button
          className="location-chip"
          type="button"
          onClick={userLocation.requestLocation}
          disabled={userLocation.isLocating}
          title={location ? `${location.label} · ${formatAccuracy(location.accuracy)} · ${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}` : (userLocation.error || 'Al pulsar, tu navegador solicitará permiso para usar tu ubicación')}
          aria-label={userLocation.isLocating ? 'Detectando ubicación' : 'Permitir al navegador usar mi ubicación'}
        >
          <MapPin size={15} />
          <span>{userLocation.isLocating ? 'Buscando…' : location?.shortLabel ?? 'Mi ubicación'}</span>
          <span className="location-chevron" aria-hidden="true">⌄</span>
        </button>
      </div>
      <p className={`location-message${userLocation.error ? ' has-error' : ''}${accuracyWarning && !userLocation.error ? ' has-warning' : ''}`} role={userLocation.error ? 'alert' : 'status'}>
        {locationMessage}
        {accuracyWarning && !userLocation.error && <><br /><span className="location-warning">{accuracyWarning}</span></>}
        {location && <span className="location-coordinates">{location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}</span>}
      </p>

      <div className="listing-toolbar">
        <label className="listing-search"><Search size={17} /><input value={filters.query} onChange={(event) => updateFilter('query', event.target.value)} placeholder="Busca por restaurante, plato o cocina" aria-label="Buscar restaurantes" /><kbd>⌘ K</kbd></label>
        <button className={`button button-outline filter-toggle${showFilters ? ' selected' : ''}`} onClick={() => setShowFilters((visible) => !visible)}><SlidersHorizontal size={16} /> Filtros <span className="filter-count">{activeFilters.length}</span></button>
        <label className="sort-select"><span>Ordenar por</span><select value={filters.sort} onChange={(event) => updateFilter('sort', event.target.value as RestaurantFilters['sort'])}><option value="recommended">Recomendados</option><option value="rating">Mejor valorados</option><option value="price">Menor precio</option><option value="distance">Más cercanos</option></select></label>
      </div>
      {showFilters && <div className="filter-panel">
        <fieldset><legend>Tipo de cocina</legend><div className="filter-chips">{cuisines.map((cuisine) => <button key={cuisine} className={`filter-chip${filters.cuisine === cuisine ? ' active' : ''}`} onClick={() => updateFilter('cuisine', filters.cuisine === cuisine ? '' : cuisine)}>{filters.cuisine === cuisine && <Check size={13} />}{cuisine}</button>)}</div></fieldset>
        <label className="range-filter">Precio máximo por persona <strong>S/ {filters.maxPrice}</strong><input type="range" min="30" max="200" step="10" value={filters.maxPrice} onChange={(event) => updateFilter('maxPrice', Number(event.target.value))} /></label>
        <label className="select-filter">Valoración mínima<select value={filters.minRating} onChange={(event) => updateFilter('minRating', Number(event.target.value))}><option value="0">Cualquier valoración</option><option value="4">4.0 estrellas</option><option value="4.5">4.5 estrellas</option><option value="4.8">4.8 estrellas</option></select></label>
      </div>}
      <div className="results-summary">
        <div><strong>{results.length}</strong> restaurantes con carta y precios</div>
        <div className="active-filter-list">{activeFilters.map((filter) => <button className="active-filter" key={filter} onClick={() => filter === filters.cuisine ? updateFilter('cuisine', '') : filter.includes('S/') ? updateFilter('maxPrice', 200) : updateFilter('minRating', 0)}>{filter}<X size={12} /></button>)}{activeFilters.length > 0 && <button className="clear-filters" onClick={clearFilters}>Limpiar todo</button>}</div>
        <span className="results-city"><MapPin size={13} /> {location ? `Distancias desde ${location.shortLabel}` : 'Guía de Lima'}</span>
      </div>

      {demoQuery.isLoading && <div className="restaurant-grid restaurant-grid">{[1, 2, 3].map((item) => <div className="skeleton-card" key={item}><div /><span /><span /><span /></div>)}</div>}
      {demoQuery.isError && <div className="state-card"><strong>No pudimos cargar los restaurantes.</strong><p>{demoQuery.error instanceof Error ? demoQuery.error.message : 'Inténtalo de nuevo en un momento.'}</p></div>}
      {!demoQuery.isLoading && !demoQuery.isError && results.length === 0 && (
        <div className="state-card">
          <strong>No encontramos resultados con esos filtros.</strong>
          <p>Prueba cambiando el tipo de cocina o el rango de precio.</p>
          <button className="button button-outline" onClick={clearFilters}>Quitar filtros</button>
        </div>
      )}
      {!demoQuery.isLoading && results.length > 0 && <div className="restaurant-grid listing-grid">{results.map((restaurant) => (
        <article className="restaurant-card" key={restaurant.id}>
          <div
            className={`restaurant-card-image${restaurant.image ? '' : ' is-empty'}`}
            style={restaurant.image ? { backgroundImage: `url("${restaurant.image}")` } : undefined}
          >
            {!restaurant.image && <PhotoPlaceholder name={restaurant.name} />}
            <Link to={`/restaurantes/${restaurant.id}`} className="image-tag">{restaurant.cuisine.toUpperCase()}</Link>
            <button className="image-favorite" aria-label={`Guardar ${restaurant.name}`} onClick={() => { const saved = JSON.parse(localStorage.getItem('mesa-favorites') ?? '[]') as string[]; localStorage.setItem('mesa-favorites', JSON.stringify(saved.includes(restaurant.id) ? saved.filter((id) => id !== restaurant.id) : [...saved, restaurant.id])) }}><span aria-hidden="true">♡</span></button>
          </div>
          <div className="restaurant-card-body">
            <div className="card-kicker"><MapPin size={12} /> {restaurant.neighborhood} <span>·</span> {formatDistance(restaurant.distanceKm)}</div>
            <Link to={`/restaurantes/${restaurant.id}`} className="restaurant-card-title">{restaurant.name}</Link>
            <p>{restaurant.description}</p>
            <div className="card-meta">
              <span className="rating"><Star size={14} fill="currentColor" /> {restaurant.rating.toFixed(1)} <small>({restaurant.reviewCount.toLocaleString('es-PE')})</small></span>
              <span className="price">S/ {restaurant.pricePerPerson} <small>/ persona</small></span>
            </div>
            <div className="card-tags">{restaurant.tags.slice(0, 2).map((tag) => <span key={tag}>{tag}</span>)}</div>
            <div className="card-bottom"><span>{restaurant.availableTimes[0] ? `Hoy · ${restaurant.availableTimes.slice(0, 2).join(' · ')}` : restaurant.hours}</span><Link to={`/restaurantes/${restaurant.id}`} aria-label={`Ver ${restaurant.name}`}><ArrowRight size={17} /></Link></div>
          </div>
        </article>
      ))}</div>}
      <div className="demo-note">
        <Sparkles size={14} />
        <span>Cartas, precios y reseñas de demostración. Fotografías reales de Wikimedia Commons con <Link to="/creditos">créditos</Link>.</span>
      </div>

      {location && (
        <section className="nearby-discovery">
          <div className="section-heading">
            <div>
              <span className="eyebrow"><span className="eyebrow-dot" /> OPENSTREETMAP · DATOS ABIERTOS</span>
              <h2>También <em>cerca de ti.</em></h2>
              <p>Locales reales del mapa a {radiusUsed} m de {placeLabel}{expanded ? ` (ampliamos desde ${radius} m porque no había resultados)` : ''}. Sin precios ni reseñas inventadas.</p>
            </div>
          </div>
          <div className="radius-picker" aria-label="Radio de búsqueda en OpenStreetMap">
            <span>RADIO</span>
            {NEARBY_RADII.map((value) => (
              <button
                key={value}
                type="button"
                className={radius === value ? 'active' : ''}
                aria-pressed={radius === value}
                onClick={() => updateRadius(value)}
              >{value < 1000 ? `${value} m` : `${value / 1000} km`}</button>
            ))}
            <span className="radius-note">Solo para los locales de OpenStreetMap</span>
          </div>

          {!nearbyQuery.isLoading && !nearbyQuery.isError && nearbyPlaces.length > 0 && (
            <Suspense fallback={<div className="nearby-map nearby-map-loading" role="status">Cargando mapa…</div>}>
              <NearbyMap location={location} places={nearbyPlaces} radius={radiusUsed} />
            </Suspense>
          )}

          {nearbyQuery.isLoading && <div className="nearby-home-grid">{[1, 2, 3].map((item) => <div className="skeleton-card osm-skeleton" key={item}><div /><span /><span /></div>)}</div>}
          {nearbyQuery.isError && <div className="demo-note warning-note"><MapPin size={14} /> No pudimos consultar OpenStreetMap ahora mismo. La guía de restaurantes sigue disponible.</div>}
          {!nearbyQuery.isLoading && !nearbyQuery.isError && nearbyPlaces.length === 0 && (
            <div className="state-card">
              <strong>No hay restaurantes registrados a {radiusUsed} m de {placeLabel}.</strong>
              <p>OpenStreetMap todavía no tiene locales con nombre en este radio. Prueba con un radio mayor o explora la guía completa.</p>
              <div className="state-actions">
                {NEARBY_RADII.filter((value) => value > radius).map((value) => (
                  <button key={value} className="button button-primary" type="button" onClick={() => updateRadius(value)}>
                    Ampliar a {value < 1000 ? `${value} m` : `${value / 1000} km`} <ArrowRight size={15} />
                  </button>
                ))}
              </div>
            </div>
          )}
          {visibleNearby.length > 0 && (
            <div className="nearby-home-grid">
              {visibleNearby.map((place) => (
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
          <div className="demo-note">
            <MapPin size={14} />
            <span>Datos de OpenStreetMap (ODbL). Cuando el local no publica una foto propia mostramos un espacio sin fotografía, no una imagen referencial.</span>
          </div>
        </section>
      )}
    </div>
  )
}
