import { NextRequest, NextResponse } from 'next/server'
import { getPlaceDetails } from '@/lib/pipeline/places'

// Proxy server-side per Place Details: la chiave API non viene mai esposta al browser
export async function GET(req: NextRequest) {
  const placeId = req.nextUrl.searchParams.get('place_id')
  if (!placeId) {
    return NextResponse.json({ error: 'place_id richiesto' }, { status: 400 })
  }

  try {
    const data = await getPlaceDetails(placeId)
    return NextResponse.json(data)
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Errore Places API' },
      { status: 500 }
    )
  }
}
