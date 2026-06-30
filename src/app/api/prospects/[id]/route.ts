import { NextRequest, NextResponse } from 'next/server'
import { getProspect, updateProspect } from '@/lib/db/prospects'
import { classifyEmailType } from '@/lib/pipeline/recommender'
import type { ProspectPatch } from '@/types/prospect'

// Solo i campi gestiti da Fabio sono modificabili via PATCH (whitelist a runtime).
const ALLOWED_FIELDS: (keyof ProspectPatch)[] = [
  'flag_potenziale',
  'note',
  'servizi_proponibili',
  'stato',
  'prossimo_followup',
  'lia_note',
  'email_generic',
  'email_nominative',
  'email_type',
  'canale_consigliato',
]

// Normalizza i valori in arrivo dal form: stringhe vuote -> null
// (evita errori su colonne come DATE e non salva email "" al posto di null).
function normalizeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed === '' ? null : trimmed
  }
  return value
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const prospect = await getProspect(id)
  if (!prospect) return NextResponse.json({ error: 'Non trovato' }, { status: 404 })
  return NextResponse.json(prospect)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = (await req.json()) as Record<string, unknown>

  // Tieni solo i campi ammessi e normalizza le stringhe vuote.
  const patch: Record<string, unknown> = {}
  for (const key of ALLOWED_FIELDS) {
    if (key in body) patch[key] = normalizeValue(body[key])
  }

  // Se cambiano le email, ricalcola email_type per coerenza con canale/tipo.
  if ('email_generic' in patch || 'email_nominative' in patch) {
    patch.email_type = classifyEmailType(
      (patch.email_generic as string | null) ?? null,
      (patch.email_nominative as string | null) ?? null,
    )
  }

  try {
    const updated = await updateProspect(id, patch as ProspectPatch)
    return NextResponse.json(updated)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Errore update' }, { status: 500 })
  }
}
