import { createServerClient } from '@/lib/supabase/server'
import type { Prospect, ProspectFilters, ProspectPatch } from '@/types/prospect'

const EXCLUDED_STATI = ['scartato', 'contattato', 'in_trattativa', 'cliente', 'suppression']

export async function getProspects(filters: ProspectFilters = {}): Promise<Prospect[]> {
  const db = createServerClient()
  let q = db.from('prospects').select('*')

  if (filters.stato) {
    const stati = Array.isArray(filters.stato) ? filters.stato : [filters.stato]
    q = q.in('stato', stati)
  }
  if (filters.comune) q = q.eq('comune', filters.comune)
  if (filters.categoria) q = q.eq('categoria', filters.categoria)
  if (filters.flag_potenziale) q = q.eq('flag_potenziale', filters.flag_potenziale)
  if (filters.canale_consigliato) q = q.eq('canale_consigliato', filters.canale_consigliato)
  if (filters.followup_dovuti) {
    const today = new Date().toISOString().split('T')[0]
    q = q.lte('prossimo_followup', today).not('stato', 'in', `(${EXCLUDED_STATI.join(',')})`)
  }

  q = q.order('weakness_score', { ascending: false }).order('comune', { ascending: true })

  const { data, error } = await q
  if (error) throw new Error(`getProspects: ${error.message}`)
  return (data ?? []) as Prospect[]
}

export async function getProspect(id: string): Promise<Prospect | null> {
  const db = createServerClient()
  const { data, error } = await db.from('prospects').select('*').eq('id', id).single()
  if (error) return null
  return data as Prospect
}

export async function updateProspect(id: string, patch: ProspectPatch): Promise<Prospect> {
  const db = createServerClient()
  const { data, error } = await db
    .from('prospects')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(`updateProspect: ${error.message}`)
  return data as Prospect
}

// Upsert pipeline: inserisce o aggiorna solo i campi tecnici, MAI i campi Fabio
export async function upsertProspectFromPipeline(
  pipelineData: Omit<
    Prospect,
    | 'id'
    | 'flag_potenziale'
    | 'note'
    | 'servizi_proponibili'
    | 'stato'
    | 'prossimo_followup'
    | 'lia_note'
    | 'created_at'
    | 'updated_at'
    | 'last_checked_at'
  >
): Promise<{ prospect: Prospect; isNew: boolean }> {
  const db = createServerClient()

  // Controlla se esiste già
  const { data: existing } = await db
    .from('prospects')
    .select('id, stato')
    .eq('place_id', pipelineData.place_id)
    .single()

  if (existing && EXCLUDED_STATI.includes(existing.stato)) {
    // Non toccare record già lavorati
    const { data } = await db.from('prospects').select('*').eq('id', existing.id).single()
    return { prospect: data as Prospect, isNew: false }
  }

  const row = {
    place_id:            pipelineData.place_id,
    comune:              pipelineData.comune,
    categoria:           pipelineData.categoria,
    website_url:         pipelineData.website_url,
    website_status:      pipelineData.website_status,
    email_generic:       pipelineData.email_generic,
    email_nominative:    pipelineData.email_nominative,
    email_type:          pipelineData.email_type,
    canale_consigliato:  pipelineData.canale_consigliato,
    weakness_score:      pipelineData.weakness_score,
    angolo_suggerito:    pipelineData.angolo_suggerito,
    signals:             pipelineData.signals,
    screenshot_url:      pipelineData.screenshot_url,
    provenienza:         pipelineData.provenienza,
    last_screened_at:    new Date().toISOString(),
  }
  const { data, error } = await db
    .from('prospects')
    .upsert(
      row,
      {
        onConflict: 'place_id',
        // I campi Fabio (stato, note, flag_potenziale, ecc.) non sono inclusi:
        // in caso di conflitto vengono preservati i valori esistenti
        ignoreDuplicates: false,
      }
    )
    .select()
    .single()

  if (error) throw new Error(`upsertProspect: ${error.message}`)
  return { prospect: data as Prospect, isNew: !existing }
}

// Ritorna i place_id da escludere dallo screening (stati già lavorati + suppression)
export async function getExcludedPlaceIds(): Promise<Set<string>> {
  const db = createServerClient()
  const { data } = await db
    .from('prospects')
    .select('place_id')
    .in('stato', EXCLUDED_STATI)
  return new Set((data ?? []).map((r: { place_id: string }) => r.place_id))
}

// Ritorna i comuni distinti presenti
export async function getComuni(): Promise<string[]> {
  const db = createServerClient()
  const { data } = await db
    .from('prospects')
    .select('comune')
    .not('comune', 'is', null)
    .order('comune')
  const set = new Set((data ?? []).map((r: { comune: string }) => r.comune).filter(Boolean))
  return Array.from(set) as string[]
}

// Ritorna le categorie distinte presenti
export async function getCategorie(): Promise<string[]> {
  const db = createServerClient()
  const { data } = await db
    .from('prospects')
    .select('categoria')
    .not('categoria', 'is', null)
    .order('categoria')
  const set = new Set((data ?? []).map((r: { categoria: string }) => r.categoria).filter(Boolean))
  return Array.from(set) as string[]
}
