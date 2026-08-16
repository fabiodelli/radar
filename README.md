# Radar — prospecting con human-in-the-loop

Gestionale di prospecting per outreach locale B2B. Cerca micro-attività su un
territorio, ne misura la presenza web con dati reali (non impressioni), e tiene
memoria dello stato mentre l'operatore le vaglia e le contatta.

L'idea di fondo: per le micro-attività locali il volume non funziona. Funziona una
lista stretta, qualificata da segnali oggettivi, con un passaggio umano nel mezzo.
Radar automatizza la raccolta dei segnali e la memoria — **non** l'invio.

## Il flusso

```
1. SCREENING     categoria + comune  →  attività candidate, arricchite e scorate
2. VAGLIO umano  scheda per scheda: scoperture, servizi proponibili, note, stato
3. HANDOFF       recap completo copiabile, per scrivere il messaggio altrove
4. MEMORIA       lo stato persiste: chi è visto/scartato/contattato non ritorna
```

Il passaggio 2 non è un collo di bottiglia da rimuovere: è ciò che tiene il
sistema nella corsia del contatto uno-a-uno personalizzato invece dell'invio
massivo.

## I due vincoli che disegnano l'architettura

Sono la parte interessante del progetto, più delle feature.

**Termini Google Places.** I contenuti Places (nome, indirizzo, telefono, rating,
orari) non possono essere memorizzati in modo persistente. L'unica eccezione è il
`place_id`. Conseguenza: il DB persiste il `place_id` come chiave stabile, più
tutto ciò che l'operatore produce e tutto ciò che si raccoglie dal sito
dell'attività; i campi volatili di Google si ri-scaricano live all'apertura della
scheda ([`LiveIdentity.tsx`](src/components/ProspectCard/LiveIdentity.tsx) via
[`/api/places`](src/app/api/places/route.ts), che tiene la chiave server-side).

**GDPR / outreach B2B.** Ogni dato raccolto porta con sé provenienza e data
([`provenance.ts`](src/lib/pipeline/provenance.ts)) — è la documentazione del
legittimo interesse. Le email sono etichettate come *generiche* (`info@`, persona
giuridica) o *nominative* (persona fisica, trattamento più cauto). Chi finisce in
suppression non ricompare mai più nei risultati di screening.

## Pipeline di screening

[`src/lib/pipeline/`](src/lib/pipeline/) — l'endpoint
[`/api/screening/run`](src/app/api/screening/run/route.ts) la esegue in streaming
SSE, così l'avanzamento è visibile mentre gira.

| Modulo | Ruolo |
|---|---|
| `places.ts` | Text Search + Place Details su Google Places |
| `site-fetcher.ts` | Scarica il sito dell'attività (cheerio): SSL, meta, CTA, contatti |
| `pagespeed.ts` | PageSpeed Insights: performance e mobile reali |
| `scorer.ts` | Sintetizza i segnali in un punteggio di *weakness* |
| `recommender.ts` | Suggerisce il canale: telefono/visita per chi non ha sito, email per gli altri |
| `provenance.ts` | Registra fonte e data di ogni campo |

Sopra la pipeline, due generatori Anthropic: la bozza mail
([`/api/generate/mail`](src/app/api/generate/mail/route.ts)) e il mini-audit del
sito ([`/api/generate/audit`](src/app/api/generate/audit/route.ts), con fallback
deterministico se l'API non risponde).

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind 4 · Supabase (Postgres)
· Anthropic SDK · Vitest · deploy Vercel.

Accesso protetto da un middleware con cookie di sessione (SHA-256 della password,
mai la password in chiaro) — [`src/middleware.ts`](src/middleware.ts).

## Setup

```bash
npm install
cp .env.example .env.local     # compila le chiavi
npm run dev                    # http://localhost:3000
```

Prima del primo avvio:

1. Esegui [`supabase/migration.sql`](supabase/migration.sql) nel SQL Editor del
   progetto Supabase, poi [`supabase/enable-rls.sql`](supabase/enable-rls.sql).
2. Abilita **Places API (New)** e **PageSpeed Insights API** su Google Cloud.
3. Imposta uno **spend limit** su Google Cloud prima di screening ampi: la
   pipeline chiama Places Details e PageSpeed per ogni candidato.

Variabili d'ambiente: vedi [`.env.example`](.env.example). `RADAR_PASSWORD` è
obbligatoria — senza, l'app resta chiusa.

## Comandi

| Comando | |
|---|---|
| `npm run dev` | sviluppo |
| `npm run build` | build di produzione |
| `npm test` | test della pipeline (Vitest) |
| `npm run build:exe` | eseguibile desktop standalone (`dist-app/`) |

## Stato

Build completa e funzionante — dettagli in [STATUS.md](STATUS.md).
Non costruito, ma predisposto: web search nella generazione mail, mappa
interattiva dei comuni, sequenze di follow-up.
