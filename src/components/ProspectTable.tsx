'use client'

import Link from 'next/link'
import type { Prospect } from '@/types/prospect'
import { StatoBadge } from './StatoBadge'
import { WeaknessBar } from './WeaknessBar'

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
                        {p.website_url ?? p.place_id.slice(0, 12) + '...'}
                      </Link>
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
