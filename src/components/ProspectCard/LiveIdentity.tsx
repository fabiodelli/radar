'use client'

import { useEffect, useState } from 'react'
import type { LivePlaceData } from '@/types/google'

interface LiveIdentityProps {
  placeId: string
  onLoad?: (data: LivePlaceData) => void
}

export function LiveIdentity({ placeId, onLoad }: LiveIdentityProps) {
  const [data, setData] = useState<LivePlaceData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    fetch(`/api/places?place_id=${encodeURIComponent(placeId)}`)
      .then(r => r.json())
      .then(d => {
        if (cancelled) return
        if (d.error) { setError(d.error); setLoading(false); return }
        setData(d)
        setLoading(false)
        onLoad?.(d)
      })
      .catch(e => {
        if (!cancelled) { setError(e.message); setLoading(false) }
      })

    return () => { cancelled = true }
  }, [placeId, onLoad])

  if (loading) {
    return (
      <div className="animate-pulse space-y-2">
        <div className="h-6 bg-gray-200 rounded w-64" />
        <div className="h-4 bg-gray-200 rounded w-48" />
        <div className="h-4 bg-gray-200 rounded w-32" />
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-red-500">Impossibile caricare dati Google: {error}</p>
  }

  if (!data) return null

  return (
    <div className="space-y-1">
      <h1 className="text-2xl font-bold text-gray-900">{data.name}</h1>
      <p className="text-sm text-gray-600">{data.formatted_address}</p>
      <div className="flex flex-wrap gap-4 text-sm">
        {data.phone && (
          <a href={`tel:${data.phone}`} className="text-blue-700 hover:underline">{data.phone}</a>
        )}
        {data.website && (
          <a href={data.website} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline truncate max-w-xs">
            {data.website}
          </a>
        )}
        {data.rating && (
          <span className="text-yellow-600 font-medium">
            {data.rating} ★ ({data.user_ratings_total} rec.)
          </span>
        )}
        {data.maps_url && (
          <a href={data.maps_url} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-700 underline text-xs">
            Google Maps
          </a>
        )}
      </div>

      {/* Estratto recensioni (utile per individuare "dolori") */}
      {data.reviews && data.reviews.length > 0 && (
        <div className="mt-3 space-y-1">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Recensioni recenti</p>
          {data.reviews.slice(0, 3).map((r, i) => (
            <div key={i} className="rounded bg-gray-50 border border-gray-100 px-3 py-2 text-xs text-gray-700">
              <span className="text-yellow-600 font-semibold">{r.rating}/5</span>
              {' — '}
              {r.text.slice(0, 200)}{r.text.length > 200 ? '...' : ''}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
