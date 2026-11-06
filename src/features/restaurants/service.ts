import { apiRequest } from '../../lib/api/client'
import type { Reservation, ReservationInput, Restaurant, RestaurantFilters, RestaurantReview } from '../../types'
import { restaurantReviews, restaurants } from './data'
import { getStoredNearbyPlace } from './nearby'
import { publicAsset } from '../../lib/publicAsset'

const demoMode = import.meta.env.VITE_DEMO_MODE !== 'false'
const ownerSettingsStorageKey = 'mesa-owner-settings'
type RestaurantOwnerSettings = Pick<Restaurant, 'hours' | 'availableTimes' | 'reservationPolicy' | 'pricePerPerson' | 'menuHighlights'> & {
  tableAvailability: Record<string, number>
}
type PublicRestaurantSettings = Partial<RestaurantOwnerSettings> & { id: string }
const defaultTablesPerTurn = 8

export function findRestaurantById(id: string): Restaurant | null {
  return restaurants.find((item) => item.id === id) ?? getStoredNearbyPlace(id)
}

function getDemoOwnerSettings(): Record<string, Partial<RestaurantOwnerSettings>> {
  const savedSettings = localStorage.getItem(ownerSettingsStorageKey)
  return savedSettings ? JSON.parse(savedSettings) as Record<string, Partial<RestaurantOwnerSettings>> : {}
}

function withDemoSettings(restaurant: Restaurant): Restaurant {
  const settings = getDemoOwnerSettings()[restaurant.id]
  const availableTimes = settings?.availableTimes ?? restaurant.availableTimes
  return {
    ...restaurant,
    ...settings,
    tableAvailability: Object.fromEntries(availableTimes.map((time) => [
      time,
      settings?.tableAvailability?.[time] ?? restaurant.tableAvailability?.[time] ?? defaultTablesPerTurn,
    ])),
    pricePerPerson: settings?.pricePerPerson ?? restaurant.pricePerPerson,
    menuHighlights: settings?.menuHighlights ?? restaurant.menuHighlights,
  }
}

function mergeSettings(
  restaurant: Restaurant,
  settings: PublicRestaurantSettings | undefined,
  hideUnpublishedAvailability = false,
): Restaurant {
  const availableTimes = settings?.availableTimes ?? restaurant.availableTimes
  return {
    ...restaurant,
    ...settings,
    tableAvailability: Object.fromEntries(availableTimes.map((time) => [
      time,
      settings?.tableAvailability?.[time] ?? restaurant.tableAvailability?.[time] ?? defaultTablesPerTurn,
    ])),
    ...(hideUnpublishedAvailability && !settings?.availableTimes ? { availableTimes: [] } : {}),
    id: restaurant.id,
  }
}

function getUserReviews(id: string): RestaurantReview[] {
  const savedReviews = localStorage.getItem(`mesa-reviews-${id}`)
  if (!savedReviews) return []
  const parsedReviews: unknown = JSON.parse(savedReviews)
  if (!Array.isArray(parsedReviews)) return []
  return parsedReviews.filter((review): review is RestaurantReview =>
    typeof review === 'object' &&
    review !== null &&
    'id' in review && typeof review.id === 'string' &&
    'restaurantId' in review && review.restaurantId === id &&
    'author' in review && typeof review.author === 'string' &&
    'date' in review && typeof review.date === 'string' &&
    'rating' in review && typeof review.rating === 'number' &&
    'comment' in review && typeof review.comment === 'string' &&
    'visit' in review && typeof review.visit === 'string',
  )
}

export function filterRestaurants(
  items: Restaurant[],
  filters: RestaurantFilters,
): Restaurant[] {
  const query = filters.query.trim().toLocaleLowerCase('es')
  const filtered = items.filter((restaurant) => {
    const searchable = [
      restaurant.name,
      restaurant.cuisine,
      restaurant.neighborhood,
      restaurant.description,
      ...restaurant.menuHighlights.map((dish) => dish.name),
    ].join(' ').toLocaleLowerCase('es')
    return (
      (!query || searchable.includes(query)) &&
      (!filters.cuisine || restaurant.cuisine === filters.cuisine) &&
      restaurant.pricePerPerson <= filters.maxPrice &&
      restaurant.rating >= filters.minRating
    )
  })

  return filtered.sort((a, b) => {
    if (filters.sort === 'rating') return b.rating - a.rating
    if (filters.sort === 'price') {
      const priceA = a.pricePerPerson > 0 ? a.pricePerPerson : Number.POSITIVE_INFINITY
      const priceB = b.pricePerPerson > 0 ? b.pricePerPerson : Number.POSITIVE_INFINITY
      return priceA - priceB
    }
    if (filters.sort === 'distance') return a.distanceKm - b.distanceKm
    const score = (restaurant: Restaurant) => restaurant.reviewCount > 0
      ? restaurant.rating * 100 - restaurant.pricePerPerson
      : 500 - restaurant.distanceKm * 20
    return score(b) - score(a)
  })
}

export const restaurantService = {
  async list(filters: RestaurantFilters, signal?: AbortSignal): Promise<Restaurant[]> {
    await Promise.resolve()
    if (signal?.aborted) throw new DOMException('La solicitud fue cancelada.', 'AbortError')
    if (demoMode) return filterRestaurants(restaurants.map(withDemoSettings), filters)
    const settings = await apiRequest<PublicRestaurantSettings[]>('/api/v1/restaurants/settings', { signal })
    const settingsById = new Map(settings.map((item) => [item.id, item]))
    return filterRestaurants(restaurants.map((restaurant) => mergeSettings(restaurant, settingsById.get(restaurant.id), true)), filters)
  },

  async listOwned(restaurantIds: string[], signal?: AbortSignal): Promise<Restaurant[]> {
    if (!demoMode) {
      const owned = await apiRequest<PublicRestaurantSettings[]>('/api/v1/owner/restaurants', { signal })
      const settingsById = new Map(owned.map((item) => [item.id, item]))
      return restaurants
        .filter((restaurant) => settingsById.has(restaurant.id))
        .map((restaurant) => mergeSettings(restaurant, settingsById.get(restaurant.id)))
    }
    if (signal?.aborted) throw new DOMException('La solicitud fue cancelada.', 'AbortError')
    return restaurants
      .filter((restaurant) => restaurantIds.includes(restaurant.id))
      .map(withDemoSettings)
  },

  async getById(id: string, signal?: AbortSignal, date?: string): Promise<Restaurant> {
    await Promise.resolve()
    if (signal?.aborted) throw new DOMException('La solicitud fue cancelada.', 'AbortError')
    const restaurant = findRestaurantById(id)
    if (!restaurant) throw new Error('No encontramos ese restaurante.')
    if (restaurant.source === 'osm') return restaurant
    if (demoMode) return withDemoSettings(restaurant)
    const search = date ? `?date=${encodeURIComponent(date)}` : ''
    const settings = await apiRequest<PublicRestaurantSettings>(`/api/v1/restaurants/${encodeURIComponent(id)}${search}`, { signal })
    return mergeSettings(restaurant, settings, true)
  },

  async listReviews(id: string, signal?: AbortSignal): Promise<RestaurantReview[]> {
    if (demoMode) {
      await Promise.resolve()
      if (signal?.aborted) throw new DOMException('La solicitud fue cancelada.', 'AbortError')
      return [
        ...getUserReviews(id),
        ...restaurantReviews.filter((review) => review.restaurantId === id),
      ]
    }
    return apiRequest<RestaurantReview[]>(
      `/api/v1/restaurants/${encodeURIComponent(id)}/reviews`,
      { signal },
    )
  },

  async createReview(
    input: Omit<RestaurantReview, 'id' | 'date' | 'visit'>,
  ): Promise<RestaurantReview> {
    const comment = input.comment.trim()
    const author = input.author.trim()
    if (!author || author.length > 80) throw new Error('Escribe un nombre de hasta 80 caracteres.')
    if (!comment || comment.length > 1000) throw new Error('El comentario debe tener entre 1 y 1000 caracteres.')
    if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
      throw new Error('La valoración debe estar entre 1 y 5 estrellas.')
    }

    if (!demoMode) {
      const restaurant = findRestaurantById(input.restaurantId)
      return apiRequest<RestaurantReview>(
        `/api/v1/restaurants/${encodeURIComponent(input.restaurantId)}/reviews`,
        { method: 'POST', body: JSON.stringify({ ...input, author, comment, restaurantName: restaurant?.name }) },
      )
    }
    if (!restaurants.some((restaurant) => restaurant.id === input.restaurantId)) {
      if (!getStoredNearbyPlace(input.restaurantId)) {
        throw new Error('No encontramos ese restaurante.')
      }
    }
    const review: RestaurantReview = {
      ...input,
      author,
      comment,
      id: `demo-review-${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
      visit: 'Comentario de la comunidad',
    }
    const userReviews = getUserReviews(input.restaurantId)
    localStorage.setItem(`mesa-reviews-${input.restaurantId}`, JSON.stringify([review, ...userReviews]))
    return review
  },

  async updateOwnerSettings(
    id: string,
    settings: RestaurantOwnerSettings,
  ): Promise<Restaurant> {
    if (!demoMode) {
      const savedSettings = await apiRequest<RestaurantOwnerSettings>(`/api/v1/owner/restaurants/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(settings),
      })
      const restaurant = restaurants.find((item) => item.id === id)
      if (!restaurant) throw new Error('No encontramos ese restaurante.')
      return mergeSettings(restaurant, { id, ...savedSettings })
    }
    const restaurant = restaurants.find((item) => item.id === id)
    if (!restaurant) throw new Error('No encontramos ese restaurante.')
    const savedSettings = getDemoOwnerSettings()
    savedSettings[id] = settings
    localStorage.setItem(ownerSettingsStorageKey, JSON.stringify(savedSettings))
    return withDemoSettings({ ...restaurant, ...settings })
  },

  async createReservation(input: ReservationInput): Promise<Reservation> {
    if (!demoMode) {
      return apiRequest<Reservation>('/api/v1/reservations', {
        method: 'POST',
        body: JSON.stringify(input),
      })
    }
    const restaurant = findRestaurantById(input.restaurantId)
    if (!restaurant) throw new Error('No encontramos ese restaurante.')
    if (restaurant.source === 'osm') {
      throw new Error('Este restaurante no recibe reservas en GastroRed. Contacta directamente con el local.')
    }
    return {
      ...input,
      id: `demo-${Date.now()}`,
      status: 'pending',
      restaurantName: restaurant.name,
      restaurantImage: restaurant.image,
    }
  },

  async listReservations(signal?: AbortSignal): Promise<Reservation[]> {
    if (demoMode) return []
    const reservations = await apiRequest<Reservation[]>('/api/v1/reservations', { signal })
    return reservations.map((reservation) => {
      const restaurant = findRestaurantById(reservation.restaurantId)
      return {
        ...reservation,
        restaurantName: restaurant?.name ?? reservation.restaurantName,
        restaurantImage: restaurant?.image ?? publicAsset(reservation.restaurantImage),
      }
    })
  },

  async listOwnerReservations(signal?: AbortSignal): Promise<Reservation[]> {
    if (demoMode) return []
    const reservations = await apiRequest<Reservation[]>('/api/v1/owner/reservations', { signal })
    return reservations.map((reservation) => {
      const restaurant = findRestaurantById(reservation.restaurantId)
      return {
        ...reservation,
        restaurantName: restaurant?.name ?? reservation.restaurantName,
        restaurantImage: restaurant?.image ?? publicAsset(reservation.restaurantImage),
      }
    })
  },

  async updateReservationStatus(id: string, status: 'confirmed' | 'completed' | 'cancelled'): Promise<Reservation> {
    if (demoMode) throw new Error('La gestión de reservas requiere conectar la API y MySQL.')
    return apiRequest<Reservation>(`/api/v1/owner/reservations/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
  },
}
