export type RestaurantSource = 'demo' | 'osm'

/** A real photograph with the attribution required by its license. */
export type RestaurantPhoto = {
  src: string
  alt: string
  credit: string
}

export type MenuHighlight = {
  name: string
  description: string
  price: number
  image?: string
}

export type Restaurant = {
  id: string
  name: string
  cuisine: string
  neighborhood: string
  city: string
  latitude: number
  longitude: number
  description: string
  /** Cover photo. Empty when the venue has no photo of its own. */
  image: string
  photos?: RestaurantPhoto[]
  rating: number
  reviewCount: number
  pricePerPerson: number
  distanceKm: number
  tags: string[]
  hours: string
  availableTimes: string[]
  menuHighlights: MenuHighlight[]
  ambience: string
  reservationPolicy: string
  /** `osm` marks places discovered from OpenStreetMap near the user. */
  source?: RestaurantSource
  address?: string
  website?: string
  phone?: string
  osmUrl?: string
  imageCredit?: string
}

export type RestaurantReview = {
  id: string
  restaurantId: string
  author: string
  date: string
  rating: number
  comment: string
  visit: string
}

export type RestaurantReviewInput = Pick<RestaurantReview, 'restaurantId' | 'author' | 'rating' | 'comment'>

export type RestaurantFilters = {
  query: string
  cuisine: string
  maxPrice: number
  minRating: number
  sort: 'recommended' | 'rating' | 'price' | 'distance'
}

export type ReservationInput = {
  restaurantId: string
  date: string
  time: string
  guests: number
  name: string
  email: string
}

export type Reservation = ReservationInput & {
  id: string
  status: 'pending' | 'confirmed'
  restaurantName: string
  restaurantImage: string
}

export type ApiErrorBody = {
  message?: string
  errors?: Record<string, string[]>
}
