// Tipi Google Places — solo per uso runtime, MAI persistiti in DB

export interface PlacesTextSearchResult {
  place_id: string
  name: string
  formatted_address: string
  website?: string
  types: string[]
  business_status: string
  opening_hours?: { open_now: boolean }
  rating?: number
  user_ratings_total?: number
}

export interface PlacesTextSearchResponse {
  results: PlacesTextSearchResult[]
  status: string
  next_page_token?: string
}

export interface PlaceDetailsResult {
  place_id: string
  name: string
  formatted_address: string
  formatted_phone_number?: string
  international_phone_number?: string
  website?: string
  rating?: number
  user_ratings_total?: number
  business_status?: string
  price_level?: number
  types?: string[]
  opening_hours?: {
    open_now?: boolean
    weekday_text?: string[]
  }
  reviews?: Array<{
    author_name: string
    rating: number
    text: string
    time: number
  }>
  url?: string
}

export interface PlaceDetailsResponse {
  result: PlaceDetailsResult
  status: string
}

// Questo è l'oggetto che vive in React state nella card (mai persistito)
export interface LivePlaceData {
  place_id: string
  name: string
  formatted_address: string
  phone: string | null
  phone_intl: string | null
  website: string | null
  rating: number | null
  user_ratings_total: number | null
  business_status: string | null
  reviews: Array<{ rating: number; text: string; author_name: string }> | null
  maps_url: string | null
}
