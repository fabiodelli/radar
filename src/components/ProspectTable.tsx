'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { Prospect } from '@/types/prospect'
import { StatoBadge } from './StatoBadge'
import { WeaknessBar } from './WeaknessBar'

// Cache di sessione dei nomi live (TOS: nessuna persistenza in DB, solo sessionStorage volatile)
const NAME_CACHE_KEY = 'radar_live_names'

function readNameCache(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(sessionStorage.getItem(NAME_CACHE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

// Carica i nomi live via Place Details, con cache di sessione e concorrenza limitata.
function useLiveNames(placeIds: string[]): Record<string, string> {
  // Inizializza vuoto (deve combaciare col render server per evitare hydration mismatch);
  // la cache di sessione viene letta dentro l'effect, lato client.
  const [names, setNames] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    const cache = readNameCache()
    const missing = placeIds.filter(id => !cache[id])
    if (missing.length === 0) {
      setNames(cache)
      return
    }
    // Mostra subito ciò che è già in cache, poi completa i mancanti
    setNames(cache)

    async function run() {
      const updated = { ...cache }
      // Concorrenza limitata: 4 richieste per volta
      const BATCH = 4
      for (let i = 0; i < missing.length && !cancelled; i += BATCH) {
        const slice = missing.slice(i, i + BATCH)
        await Promise.all(
          slice.map(async id => {
            try {
              const r = await fetch(`/api/places?place_id=${encodeURIComponent(id)}`)
              const d = await r.json()
              if (d?.name) updated[id] = d.name
            } catch {
              // ignora: resta il fallback place_id
            }
          })
        )
        if (!cancelled) {
          setNames({ ...updated })
          try { sessionStorage.setItem(NAME_CACHE_KEY, JSON.stringify(updated)) } catch {}
        }
      }
    }
    run()

    return () => { cancelled = true }
  }, [placeIds.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  return names
}

const CANALE_LABEL: Record<string, string> = {
  email:            'Email',
  visita:           'Visita',
  telefono:         'Telefono',
  telefono_e_email: 'Tel + Email',
}

const WEB_STATUS_LABEL: Record<string, string> = {
  none:        'Nessun sito',
  social_only: 'Solo social',
  dated:       'Datato',
  decent:      'Discreto',
  recent:      'Recente',
}

const FLAG_LABEL: Record<string, string> = {
  basso: 'Basso',
  medio: 'Medio',
  alto:  'Alto',
}

interface ProspectTableProps {
  prospects: Prospect[]
  // placeNames: record di nomi live (place_id → nome)
  // In v1 non carichiamo i nomi live nella lista per rispettare le TOS (nessuna persistenza)
  // Usiamo comune+categoria come label
}

export function ProspectTable({ prospects }: ProspectTableProps) {
  const liveNames = useLiveNames(prospects.map(p => p.place_id))

  if (prospects.length === 0) {
    return <p className="text-gray-500 text-sm py-8 text-center">Nessun prospect. Esegui uno screening.</p>
  }

  // Raggruppa per comune
  const byComune: Record<string, Prospect[]> = {}
  for (const p of prospects) {
    const key = p.comune ?? 'N/D'
    if (!byComune[key]) byComune[key] = []
    byComune[key].push(p)
  }

  return (
    <div className="space-y-6">
      {Object.entries(byComune).map(([comune, items]) => (
        <div key={comune}>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
            {comune} <span className="font-normal normal-case text-gray-400">({items.length})</span>
          </h3>
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Attività</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Categoria</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Web</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Canale</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Pot.</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Stato</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Follow-up</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2">
                      <Link href={`/prospect/${p.id}`} className="text-blue-700 hover:underline font-medium">
                        {liveNames[p.place_id] ?? p.website_url ?? p.place_id.slice(0, 12) + '…'}
                      </Link>
                      {liveNames[p.place_id] && p.website_url && (
                        <span className="ml-2 text-xs text-gray-400 truncate">{p.website_url}</span>
                      )}
                      {p.email_generic && (
                        <span className="ml-2 text-xs text-gray-400">{p.email_generic}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-gray-600">{p.categoria ?? '—'}</td>
                    <td className="px-4 py-2"><WeaknessBar score={p.weakness_score} /></td>
                    <td className="px-4 py-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        p.website_status === 'none' ? 'bg-red-100 text-red-700' :
                        p.website_status === 'social_only' ? 'bg-orange-100 text-orange-700' :
                        p.website_status === 'dated' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {WEB_STATUS_LABEL[p.website_status ?? ''] ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-600 text-xs">{CANALE_LABEL[p.canale_consigliato ?? ''] ?? '—'}</td>
                    <td className="px-4 py-2">
                      {p.flag_potenziale && (
                        <span className={`text-xs font-medium ${
                          p.flag_potenziale === 'alto' ? 'text-green-700' :
                          p.flag_potenziale === 'medio' ? 'text-yellow-700' :
                          'text-gray-500'
                        }`}>
                          {FLAG_LABEL[p.flag_potenziale]}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2"><StatoBadge stato={p.stato} /></td>
                    <td className="px-4 py-2 text-xs text-gray-500">
                      {p.prossimo_followup
                        ? <span className={new Date(p.prossimo_followup) <= new Date() ? 'text-red-600 font-semibold' : ''}>
                            {p.prossimo_followup}
                          </span>
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}
