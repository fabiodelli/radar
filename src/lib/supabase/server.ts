import { createClient } from '@supabase/supabase-js'

// Client server-side con service role key (mai esposta al browser)
// Usato per tutte le operazioni server: pipeline, API routes, Server Actions
export function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Variabili Supabase mancanti (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)')
  }
  return createClient(url, key, {
    auth: { persistSession: false },
  })
}
