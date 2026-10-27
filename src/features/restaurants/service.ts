import { apiRequest } from '../../lib/api/client'
import type { Reservation, ReservationInput, Restaurant, RestaurantFilters, RestaurantReview } from '../../types'
import { restaurantReviews, restaurants } from './data'
import { getStoredNearbyPlace } from './nearby'

const demoMode = import.meta.env.VITE_DEMO_MODE !== 'false'
const ownerSettingsStorageKey = 'mesa-owner-settings'
type RestaurantOwnerSettings = Pick<Restaurant, 'hours' | 'availableTimes' | 'reservationPolicy'>

export function findRestaurantById(id: string): Restaurant | null {
  return restaurants.find((item) => item.id === id) ?? getStoredNearbyPlace(id)
}

function getDemoOwnerSettings(): Record<string, RestaurantOwnerSettings> {
  const savedSettings = localStorage.getItem(ownerSettingsStorageKey)
  return savedSettings ? JSON.parse(savedSettings) as Record<string, RestaurantOwnerSettings> : {}
}

function withDemoSettings(restaurant: Restaurant): Restaurant {
  return { ...restaurant, ...getDemoOwnerSettings()[restaurant.id] }
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
    if (demoMode) {
      await Promise.resolve()
      if (signal?.aborted) throw new DOMException('La solicitud fue cancelada.', 'AbortError')
      return filterRestaurants(restaurants.map(withDemoSettings), filters)
    }
    const params = new URLSearchParams({
      q: filters.query,
      cuisine: filters.cuisine,
      maxPrice: String(filters.maxPrice),
      minRating: String(filters.minRating),
      sort: filters.sort,
    })
    return apiRequest<Restaurant[]>(`/api/v1/restaurants?${params}`, { signal })
  },

  async listOwned(restaurantIds: string[], signal?: AbortSignal): Promise<Restaurant[]> {
    if (!demoMode) {
      return apiRequest<Restaurant[]>('/api/v1/owner/restaurants', { signal })
    }
    if (signal?.aborted) throw new DOMException('La solicitud fue cancelada.', 'AbortError')
    return restaurants
      .filter((restaurant) => restaurantIds.includes(restaurant.id))
      .map(withDemoSettings)
  },

  async getById(id: string, signal?: AbortSignal): Promise<Restaurant> {
    if (demoMode) {
      await Promise.resolve()
      if (signal?.aborted) throw new DOMException('La solicitud fue cancelada.', 'AbortError')
      const restaurant = findRestaurantById(id)
      if (!restaurant) throw new Error('No encontramos ese restaurante.')
      return restaurant.source === 'osm' ? restaurant : withDemoSettings(restaurant)
    }
    return apiRequest<Restaurant>(`/api/v1/restaurants/${encodeURIComponent(id)}`, { signal })
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
      return apiRequest<RestaurantReview>(
        `/api/v1/restaurants/${encodeURIComponent(input.restaurantId)}/reviews`,
        { method: 'POST', body: JSON.stringify({ ...input, author, comment }) },
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
      return apiRequest<Restaurant>(`/api/v1/owner/restaurants/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(settings),
      })
    }
    const restaurant = restaurants.find((item) => item.id === id)
    if (!restaurant) throw new Error('No encontramos ese restaurante.')
    const savedSettings = getDemoOwnerSettings()
    savedSettings[id] = settings
    localStorage.setItem(ownerSettingsStorageKey, JSON.stringify(savedSettings))
    return { ...restaurant, ...settings }
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
}
