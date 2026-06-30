@AGENTS.md

# Radar — Prospecting tool per Fabio (uso personale)

## Vincoli architetturali CRITICI

### Google Places TOS
- **MAI** persistere in DB: nome, indirizzo, telefono, rating, recensioni (dati volatili Google).
- **Unico campo Google persistibile**: `place_id` (text, chiave stabile).
- I dati live (nome/tel/rating) si caricano via `/api/places?place_id=X` a runtime, vivono solo in React state.

### Upsert sicura
- L'upsert su `place_id` NON sovrascrive mai i campi di Fabio: `stato`, `note`, `flag_potenziale`, `servizi_proponibili`, `lia_note`, `prossimo_followup`.
- La pipeline esclude dallo screening record con stato: `scartato`, `contattato`, `in_trattativa`, `cliente`, `suppression`.

### GDPR
- `provenienza` jsonb traccia fonte+data per ogni dato raccolto.
- Email classificate: `generic` (info@, contatti@) vs `nominative` (mario.rossi@).
- Suppression list: stato = `suppression` → mai più in screening.

## Stack
- Next.js App Router + TypeScript + Tailwind CSS
- Supabase (Postgres) — service role key solo server-side
- Anthropic SDK: `claude-sonnet-4-6` per mail e mini-audit (Haiku selezionabile per la mail). Model id centralizzati in `src/lib/models.ts`.

## Struttura chiave
- `src/lib/pipeline/` — moduli screening (places, site-fetcher, pagespeed, scorer, recommender)
- `src/lib/db/` — accesso Supabase (prospects, screening-runs)
- `src/app/api/screening/run/route.ts` — endpoint SSE per la pipeline
- `src/app/api/places/route.ts` — proxy Places Details (GET `?place_id=`, chiave mai esposta al browser)

## Fase 2 (NON costruire ora)
- Invio email automatico
- Sequenze follow-up automatiche
- Mappa interattiva
- Web search nella generazione mail (struttura già predisposta con flag `useWebSearch`)
