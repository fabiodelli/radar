import { NextRequest, NextResponse } from 'next/server'
import { getProspects } from '@/lib/db/prospects'
import type { ProspectFilters } from '@/types/prospect'

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const filters: ProspectFilters = {}

  const stato = sp.get('stato')
  if (stato) filters.stato = stato as ProspectFilters['stato']

  const comune = sp.get('comune')
  if (comune) filters.comune = comune

  const categoria = sp.get('categoria')
  if (categoria) filters.categoria = categoria

  const flag = sp.get('flag_potenziale')
  if (flag) filters.flag_potenziale = flag as ProspectFilters['flag_potenziale']

  const canale = sp.get('canale_consigliato')
  if (canale) filters.canale_consigliato = canale as ProspectFilters['canale_consigliato']

  if (sp.get('followup_dovuti') === '1') filters.followup_dovuti = true

  try {
    const prospects = await getProspects(filters)
    return NextResponse.json(prospects)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Errore DB' }, { status: 500 })
  }
}
