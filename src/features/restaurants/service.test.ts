import { beforeEach, describe, expect, it } from 'vitest'
import { calculateScore, defaultWeights, weightsWithPriority } from '../comparison/score'
import { restaurants } from './data'
import { filterRestaurants, restaurantService } from './service'

describe('restaurant filtering', () => {
  const defaults = { query: '', cuisine: '', maxPrice: 200, minRating: 0, sort: 'recommended' as const }

  beforeEach(() => {
    localStorage.clear()
  })

  it('searches restaurant, dish, cuisine and neighborhood names', () => {
    expect(filterRestaurants(restaurants, { ...defaults, query: 'lomo saltado' }).map((item) => item.id)).toContain('isolina')
    expect(filterRestaurants(restaurants, { ...defaults, query: 'Barranco' })).toHaveLength(2)
  })

  it('applies price, cuisine and minimum rating filters together', () => {
    expect(filterRestaurants(restaurants, { ...defaults, cuisine: 'Criolla', maxPrice: 70, minRating: 4.7 }).map((item) => item.id)).toEqual(['isolina'])
  })

  it('sorts by the selected field', () => {
    expect(filterRestaurants(restaurants, { ...defaults, sort: 'price' })[0].id).toBe('pan-de-la-chola')
    expect(filterRestaurants(restaurants, { ...defaults, sort: 'distance' })[0].id).toBe('la-mar')
  })

  it('returns the example comments for the selected restaurant', async () => {
    const reviews = await restaurantService.listReviews('central')
    expect(reviews).toHaveLength(4)
    expect(reviews.every((review) => review.restaurantId === 'central')).toBe(true)
  })

  it('saves a user review and includes it in the restaurant comments', async () => {
    const review = await restaurantService.createReview({
      restaurantId: 'central',
      author: 'Camila R.',
      rating: 3,
      comment: 'Buena experiencia, volvería.',
    })
    expect(review.rating).toBe(3)
    expect(await restaurantService.listReviews('central')).toContainEqual(review)
  })

  it('rejects review ratings outside the one-to-five range', async () => {
    await expect(restaurantService.createReview({
      restaurantId: 'central',
      author: 'Camila R.',
      rating: 6,
      comment: 'Comentario de prueba',
    })).rejects.toThrow('entre 1 y 5 estrellas')
  })

  it('persists owner hours and available time changes in demo mode', async () => {
    const updated = await restaurantService.updateOwnerSettings('central', {
      hours: 'Mié–dom · 14:00–23:00',
      availableTimes: ['14:00', '20:00'],
      reservationPolicy: 'Reserva previa',
    })
    expect(updated.hours).toBe('Mié–dom · 14:00–23:00')
    expect((await restaurantService.getById('central')).availableTimes).toEqual(['14:00', '20:00'])
    expect((await restaurantService.list({ ...defaults, query: 'Mérito' }))[0].hours).toBe('Mié–dom · 14:00–23:00')
  })
})

describe('comparison score', () => {
  it('normalizes values onto a 100-point scale', () => {
    expect(calculateScore({ rating: 5, price: 0, availability: 1, distance: 0 }, defaultWeights)).toBe(100)
    expect(calculateScore({ rating: 0, price: 200, availability: 0, distance: 10 }, defaultWeights)).toBe(0)
  })

  it('renormalizes available criteria and returns null when all values are missing', () => {
    expect(calculateScore({ rating: 5 })).toBe(100)
    expect(calculateScore({})).toBeNull()
  })

  it('rejects invalid criteria weights', () => {
    expect(() => calculateScore({ rating: 4 }, { ...defaultWeights, price: -1 })).toThrow(RangeError)
  })

  it('increases the selected criterion while keeping all weights normalized', () => {
    const weights = weightsWithPriority('price')
    expect(weights.price).toBe(0.55)
    expect(Object.values(weights).reduce((total, weight) => total + weight, 0)).toBeCloseTo(1)
  })
})
