# STATUS.md — Radar

## Build completata — 2026-06-27

### Checklist spec (SPEC_RADAR.md §11)

- [x] Schema Supabase creato (prospects, screening_runs) — `supabase/migration.sql`
- [x] Screening end-to-end: da query a record arricchiti con dossier e score
- [x] Persistenza conforme: salva place_id + dati propri/del sito; NON persiste contenuti Google volatili
- [x] Dedup (place_id unique) + esclusione stati lavorati + suppression funzionante
- [x] Vista lista (ordinamento weakness/comune, filtri rapidi, raggruppamento per comune)
- [x] Vista scheda (dossier tecnico + campi editabili Fabio + azioni)
- [x] "Copia recap" genera l'handoff completo — `src/lib/handoff.ts`
- [x] "Genera mail" chiama Anthropic API (claude-sonnet-4-6; Haiku selezionabile)
- [x] "Genera mini-audit" — Sonnet 4.6 sui signals, con fallback deterministico
- [x] "Apri in Gmail" — apre la composizione Gmail (delli.fabio@gmail.com) precompilata
- [x] Provenienza dati registrata; etichetta generic/nominative sulle email
- [x] Contatore chiamate API sessione visibile nello screening runner
- [x] Auth gate (cookie = hash SHA-256 della password, middleware Next.js)

### Prerequisiti da completare PRIMA di usare

1. **Supabase**: esegui `supabase/migration.sql` nel SQL Editor del progetto
2. **Variabili d'ambiente**: compila `.env.local` con le chiavi reali:
   - `GOOGLE_MAPS_API_KEY` (abilita Places API + PageSpeed Insights API su Google Cloud)
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ANTHROPIC_API_KEY`
   - `RADAR_PASSWORD` (opzionale, default: `radar2024`)
3. **Spend limit Google Cloud**: impostalo prima di screening ampi

### Struttura file chiave

```
src/
  lib/
    pipeline/    — places, site-fetcher, pagespeed, scorer, recommender, provenance
    db/          — prospects, screening-runs (Supabase)
    handoff.ts   — buildRecapText, buildMiniAudit
  app/
    api/
      screening/run/  — SSE pipeline endpoint
      places/         — proxy Place Details (chiave server-side)
      generate/mail   — Anthropic Sonnet 4.6 (Haiku selezionabile)
      generate/audit  — Anthropic Sonnet 4.6 (fallback deterministico)
      prospects/      — CRUD
      auth/login      — cookie session
    page.tsx          — lista con filtri
    prospect/[id]/    — card dossier
    screening/        — form + log live
  components/
    ProspectCard/     — LiveIdentity, SignalsDossier, EditableFields, ActionBar
    ProspectTable.tsx
    FilterBar.tsx
    ScreeningRunner.tsx
```

### Fase 2 (non costruita, struttura predisposta)
- Web search nella generazione mail: parametro `useWebSearch` già nell'API route
- Mappa interattiva comuni
- Sequenze follow-up automatiche
