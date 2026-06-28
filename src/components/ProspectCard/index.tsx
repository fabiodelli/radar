'use client'

import { useState, useCallback } from 'react'
import type { Prospect } from '@/types/prospect'
import type { LivePlaceData } from '@/types/google'
import { LiveIdentity } from './LiveIdentity'
import { SignalsDossier } from './SignalsDossier'
import { EditableFields } from './EditableFields'
import { ActionBar } from './ActionBar'
import { WeaknessBar } from '../WeaknessBar'
import { StatoBadge } from '../StatoBadge'

interface ProspectCardProps {
  prospect: Prospect
}

export function ProspectCard({ prospect }: ProspectCardProps) {
  const [liveData, setLiveData] = useState<LivePlaceData | null>(null)

  const handleLiveLoad = useCallback((data: LivePlaceData) => {
    setLiveData(data)
  }, [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <LiveIdentity placeId={prospect.place_id} onLoad={handleLiveLoad} />
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <StatoBadge stato={prospect.stato} />
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Score:</span>
            <WeaknessBar score={prospect.weakness_score} />
          </div>
          <div className="text-xs text-gray-500">
            {prospect.comune} · {prospect.categoria}
          </div>
        </div>
      </div>

      {/* Angolo suggerito */}
      {prospect.angolo_suggerito && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-1">Angolo suggerito</p>
          <p className="text-sm text-amber-900">{prospect.angolo_suggerito}</p>
        </div>
      )}

      {/* Layout a due colonne */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Dossier tecnico */}
        <SignalsDossier signals={prospect.signals} websiteUrl={prospect.website_url} screenshotUrl={prospect.screenshot_url} />

        {/* Campi Fabio */}
        <EditableFields prospect={prospect} />
      </div>

      {/* Azioni */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Azioni</h3>
        <ActionBar prospect={prospect} liveData={liveData} />
      </div>

      {/* Provenienza dati */}
      {prospect.provenienza?.length > 0 && (
        <details className="rounded-lg border border-gray-100 bg-gray-50 p-3">
          <summary className="text-xs font-medium text-gray-500 cursor-pointer">
            Provenienza dati ({prospect.provenienza.length} campi tracciati) — GDPR
          </summary>
          <div className="mt-2 space-y-1">
            {prospect.provenienza.map((p, i) => (
              <div key={i} className="text-xs text-gray-600 font-mono">
                <span className="text-gray-900 font-semibold">{p.campo}</span>
                {' ← '}
                {p.fonte}
                {' · '}
                {p.data}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
