// Wipe totale del database Radar: cancella TUTTE le righe da prospects e screening_runs.
// Uso: node tools/wipe-db.mjs
// Legge le credenziali da .env.local (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dirname, '..', '.env.local')

// Mini-parser di .env.local (niente dipendenze extra)
const env = {}
for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m) env[m[1]] = m[2]
}

const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Credenziali Supabase mancanti in .env.local')
  process.exit(1)
}

const db = createClient(url, key, { auth: { persistSession: false } })

async function count(table) {
  const { count, error } = await db.from(table).select('*', { count: 'exact', head: true })
  if (error) throw new Error(`count ${table}: ${error.message}`)
  return count ?? 0
}

async function wipe(table) {
  // Filtro che matcha ogni riga (id non nullo): cancella tutto.
  const { error } = await db.from(table).delete().not('id', 'is', null)
  if (error) throw new Error(`delete ${table}: ${error.message}`)
}

for (const table of ['prospects', 'screening_runs']) {
  const before = await count(table)
  await wipe(table)
  const after = await count(table)
  console.log(`${table}: ${before} righe -> ${after} righe`)
}

console.log('Wipe completato.')
