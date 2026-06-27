import { Suspense } from 'react'
import { getProspects, getComuni, getCategorie } from '@/lib/db/prospects'
import { ProspectTable } from '@/components/ProspectTable'
import { FilterBar } from '@/components/FilterBar'
import type { ProspectFilters, StatoProspect, FlagPotenziale, CanaleSuggerito } from '@/types/prospect'
import Link from 'next/link'

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function getString(v: string | string[] | undefined): string | undefined {
  if (!v) return undefined
  return Array.isArray(v) ? v[0] : v
}

export default async function HomePage({ searchParams }: PageProps) {
  const sp = await searchParams

  const filters: ProspectFilters = {}
  const stato = getString(sp.stato)
  if (stato) filters.stato = stato as StatoProspect

  const comune = getString(sp.comune)
  if (comune) filters.comune = comune

  const categoria = getString(sp.categoria)
  if (categoria) filters.categoria = categoria

  const flag = getString(sp.flag_potenziale)
  if (flag) filters.flag_potenziale = flag as FlagPotenziale

  const canale = getString(sp.canale_consigliato)
  if (canale) filters.canale_consigliato = canale as CanaleSuggerito

  if (sp.followup_dovuti === '1') filters.followup_dovuti = true

  const [prospects, comuni, categorie] = await Promise.all([
    getProspects(filters),
    getComuni(),
    getCategorie(),
  ])

  // Follow-up dovuti oggi
  const oggi = new Date().toISOString().split('T')[0]
  const followupCount = prospects.filter(
    p => p.prossimo_followup && p.prossimo_followup <= oggi &&
    !['cliente', 'scartato', 'suppression'].includes(p.stato)
  ).length

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Prospect</h1>
          <p className="text-sm text-gray-500">{prospects.length} risultati</p>
        </div>
        <div className="flex items-center gap-3">
          {followupCount > 0 && (
            <Link
              href="/?followup_dovuti=1"
              className="flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white"
            >
              {followupCount} follow-up dovut{followupCount === 1 ? 'o' : 'i'}
            </Link>
          )}
          <Link
            href="/screening"
            className="rounded-md bg-gray-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-700"
          >
            Nuovo screening
          </Link>
        </div>
      </div>

      <Suspense>
        <FilterBar comuni={comuni} categorie={categorie} />
      </Suspense>

      <ProspectTable prospects={prospects} />
    </div>
  )
}
