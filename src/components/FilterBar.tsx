'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import type { StatoProspect, FlagPotenziale, CanaleSuggerito } from '@/types/prospect'

interface FilterBarProps {
  comuni: string[]
  categorie: string[]
}

const QUICK_FILTERS: Array<{ label: string; params: Record<string, string> }> = [
  { label: 'Da vagliare',    params: { stato: 'da_vagliare' } },
  { label: 'Alto potenziale', params: { flag_potenziale: 'alto' } },
  { label: 'Canale visita',  params: { canale_consigliato: 'visita' } },
  { label: 'Follow-up dovuti', params: { followup_dovuti: '1' } },
  { label: 'Tutti',          params: {} },
]

export function FilterBar({ comuni, categorie }: FilterBarProps) {
  const router = useRouter()
  const sp = useSearchParams()

  function apply(overrides: Record<string, string>) {
    const next = new URLSearchParams(sp.toString())
    // Reset filtri vecchi
    for (const k of ['stato', 'flag_potenziale', 'canale_consigliato', 'followup_dovuti', 'comune', 'categoria']) {
      next.delete(k)
    }
    for (const [k, v] of Object.entries(overrides)) {
      if (v) next.set(k, v)
    }
    router.push(`/?${next.toString()}`)
  }

  return (
    <div className="flex flex-wrap gap-3 items-center mb-4">
      {/* Quick filter chips */}
      <div className="flex flex-wrap gap-2">
        {QUICK_FILTERS.map(f => {
          const isActive = Object.entries(f.params).every(([k, v]) => sp.get(k) === v)
            && (Object.keys(f.params).length === 0
              ? !['stato','flag_potenziale','canale_consigliato','followup_dovuti'].some(k => sp.has(k))
              : true)
          return (
            <button
              key={f.label}
              onClick={() => apply(f.params)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors border ${
                isActive
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-500'
              }`}
            >
              {f.label}
            </button>
          )
        })}
      </div>

      {/* Comune select */}
      <select
        value={sp.get('comune') ?? ''}
        onChange={e => apply({ ...Object.fromEntries(sp.entries()), comune: e.target.value })}
        className="rounded border border-gray-300 px-2 py-1 text-sm text-gray-700 bg-white"
      >
        <option value="">Tutti i comuni</option>
        {comuni.map(c => <option key={c} value={c}>{c}</option>)}
      </select>

      {/* Categoria select */}
      <select
        value={sp.get('categoria') ?? ''}
        onChange={e => apply({ ...Object.fromEntries(sp.entries()), categoria: e.target.value })}
        className="rounded border border-gray-300 px-2 py-1 text-sm text-gray-700 bg-white"
      >
        <option value="">Tutte le categorie</option>
        {categorie.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
    </div>
  )
}
