import { createServerClient } from '@/lib/supabase/server'
import type { ScreeningRun, ScreeningQuery } from '@/types/screening'

export async function insertScreeningRun(query: ScreeningQuery): Promise<ScreeningRun> {
  const db = createServerClient()
  const { data, error } = await db
    .from('screening_runs')
    .insert({ query })
    .select()
    .single()
  if (error) throw new Error(`insertScreeningRun: ${error.message}`)
  return data as ScreeningRun
}

export async function updateScreeningRun(
  id: string,
  patch: { n_trovati?: number; n_nuovi?: number }
): Promise<void> {
  const db = createServerClient()
  await db.from('screening_runs').update(patch).eq('id', id)
}

export async function getScreeningRuns(limit = 20): Promise<ScreeningRun[]> {
  const db = createServerClient()
  const { data, error } = await db
    .from('screening_runs')
    .select('*')
    .order('eseguita_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`getScreeningRuns: ${error.message}`)
  return (data ?? []) as ScreeningRun[]
}
