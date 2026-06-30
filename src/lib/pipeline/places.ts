import type { PlacesTextSearchResult, LivePlaceData, PlaceDetailsResult } from '@/types/google'

const PLACES_BASE = 'https://maps.googleapis.com/maps/api/place'

function apiKey() {
  const key = process.env.GOOGLE_MAPS_API_KEY
  if (!key) throw new Error('GOOGLE_MAPS_API_KEY non configurata')
  return key
}

export interface SearchPlacesResult {
  results: PlacesTextSearchResult[]
  apiCalls: number
}

const MAX_PAGES = 3 // Google offre fino a 3 pagine (~60 risultati) via next_page_token

function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

// Text Search: restituisce lista di attività per categoria + comune.
// Segue next_page_token fino a ~60 risultati (Google richiede una breve attesa
// prima che il token diventi valido).
export async function searchPlaces(
  categoria: string,
  comune: string
): Promise<SearchPlacesResult> {
  const query = encodeURIComponent(`${categoria} ${comune} Italia`)
  const results: PlacesTextSearchResult[] = []
  let apiCalls = 0
  let pageToken: string | undefined

  for (let page = 0; page < MAX_PAGES; page++) {
    const url = pageToken
      ? `${PLACES_BASE}/textsearch/json?pagetoken=${pageToken}&key=${apiKey()}`
      : `${PLACES_BASE}/textsearch/json?query=${query}&language=it&region=it&key=${apiKey()}`

    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    const json = await res.json()
    apiCalls += 1

    if (json.status !== 'OK' && json.status !== 'ZERO_RESULTS') {
      // Token non ancora valido o altro errore su pagine successive: ferma e restituisci quanto raccolto.
      if (page > 0) break
      throw new Error(`Places Text Search: ${json.status} — ${json.error_message ?? ''}`)
    }

    results.push(...((json.results ?? []) as PlacesTextSearchResult[]))

    pageToken = json.next_page_token
    if (!pageToken) break

    // Il next_page_token diventa valido solo dopo un breve ritardo lato Google.
    await delay(2000)
  }

  return { results, apiCalls }
}

// Place Details: usato per arricchire la card a runtime (MAI persistito)
export async function getPlaceDetails(placeId: string): Promise<LivePlaceData> {
  const fields = [
    'place_id',
    'name',
    'formatted_address',
    'formatted_phone_number',
    'international_phone_number',
    'website',
    'rating',
    'user_ratings_total',
    'business_status',
    'price_level',
    'reviews',
    'url',
  ].join(',')

  const url = `${PLACES_BASE}/details/json?place_id=${placeId}&fields=${fields}&language=it&key=${apiKey()}`
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
  const json = await res.json()

  if (json.status !== 'OK') {
    throw new Error(`Place Details: ${json.status}`)
  }

  const r: PlaceDetailsResult = json.result
  return {
    place_id:           placeId,
    name:               r.name,
    formatted_address:  r.formatted_address,
    phone:              r.formatted_phone_number ?? r.international_phone_number ?? null,
    website:            r.website ?? null,
    rating:             r.rating ?? null,
    user_ratings_total: r.user_ratings_total ?? null,
    business_status:    r.business_status ?? null,
    reviews:            r.reviews?.map(rv => ({ rating: rv.rating, text: rv.text, author_name: rv.author_name })) ?? null,
    maps_url:           r.url ?? null,
  }
}
