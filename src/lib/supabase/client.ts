'use client'

import { createClient } from '@supabase/supabase-js'

let _client: ReturnType<typeof createClient> | null = null

// Client browser (anon key, solo lettura per componenti client se necessario)
export function getSupabaseBrowserClient() {
  if (_client) return _client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  _client = createClient(url, key)
  return _client
}
