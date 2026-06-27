import { NextRequest } from 'next/server'
import { searchPlaces } from '@/lib/pipeline/places'
import { fetchSiteSignals, classifyEmails, findSocialPresence } from '@/lib/pipeline/site-fetcher'
import { fetchPageSpeed } from '@/lib/pipeline/pagespeed'
import { computeWeaknessScore, computeWebsiteStatus } from '@/lib/pipeline/scorer'
import { recommendChannel, classifyEmailType, generateAngolo } from '@/lib/pipeline/recommender'
import { buildProvenanceList } from '@/lib/pipeline/provenance'
import { upsertProspectFromPipeline, getExcludedPlaceIds } from '@/lib/db/prospects'
import { insertScreeningRun, updateScreeningRun } from '@/lib/db/screening-runs'
import type { ScreeningQuery, ScreeningEvent } from '@/types/screening'

function sseChunk(event: ScreeningEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`
}

async function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

export async function POST(req: NextRequest) {
  const body: ScreeningQuery = await req.json()
  const { categorie, comuni, threshold = 2 } = body

  if (!categorie?.length || !comuni?.length) {
    return new Response('categorie e comuni richiesti', { status: 400 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let apiCalls = 0
      let n_trovati = 0
      let n_nuovi = 0

      const emit = (event: ScreeningEvent) => {
        controller.enqueue(encoder.encode(sseChunk(event)))
      }

      // Inserisci run nel DB
      let runId: string | null = null
      try {
        const run = await insertScreeningRun(body)
        runId = run.id
      } catch (e) {
        // non bloccare se il run tracking fallisce
      }

      emit({ type: 'start', message: `Avvio screening: ${categorie.join(', ')} in ${comuni.join(', ')}` })

      // Carica exclusion list
      const excluded = await getExcludedPlaceIds()

      for (const comune of comuni) {
        for (const categoria of categorie) {
          emit({ type: 'start', message: `Ricerca: ${categoria} a ${comune}...` })

          let searchResults
          try {
            const result = await searchPlaces(categoria, comune)
            searchResults = result.results
            apiCalls += result.apiCalls
          } catch (e: unknown) {
            emit({ type: 'error', error: `Ricerca Places fallita: ${e instanceof Error ? e.message : String(e)}` })
            continue
          }

          emit({ type: 'found', message: `${searchResults.length} attività trovate per ${categoria} a ${comune}`, api_calls: apiCalls })
          n_trovati += searchResults.length

          for (const place of searchResults) {
            // Salta se in exclusion list
            if (excluded.has(place.place_id)) {
              emit({ type: 'skip', place_id: place.place_id, message: `Saltato (già lavorato): ${place.name}` })
              continue
            }

            emit({ type: 'progress', place_id: place.place_id, message: `Analisi: ${place.name}...`, api_calls: apiCalls })

            try {
              // Fetch sito
              let signals: Awaited<ReturnType<typeof fetchSiteSignals>> = { has_website: false }
              const websiteUrl = place.website ?? null // viene da Text Search, non da Details
              // Nota: place.website non è sempre disponibile in Text Search; si fa senza per ora
              // Il website viene estratto dal sito stesso oppure lasciato null
              const websiteFromSearch: string | undefined = (place as { website?: string }).website

              if (websiteFromSearch) {
                signals = await fetchSiteSignals(websiteFromSearch)
              } else {
                // Niente sito nella ricerca: segna come assente
                signals = {
                  has_website: false,
                  social_only: false,
                  social_fb: null,
                  social_ig: null,
                  directory_listing: null,
                }
                const social = await findSocialPresence(place.name)
                signals = { ...signals, ...social }
              }

              // PageSpeed (solo se c'è sito, con throttle 500ms)
              let psiData: { psi_performance: number | null; psi_mobile_usability: boolean | null; psi_seo: number | null } = { psi_performance: null, psi_mobile_usability: null, psi_seo: null }
              if (websiteFromSearch && signals.has_website) {
                await delay(500)
                psiData = await fetchPageSpeed(websiteFromSearch)
                apiCalls += 1
              }

              const fullSignals = { ...signals, ...psiData }

              // Clasifica email
              const emailsFound = signals.emails_found ?? []
              const { email_generic, email_nominative } = classifyEmails(emailsFound)
              const email_type = classifyEmailType(email_generic, email_nominative)

              // Calcola score e status
              const weakness_score = computeWeaknessScore(fullSignals, categoria)
              const website_status = computeWebsiteStatus(fullSignals)

              // Salta se sotto soglia
              if (weakness_score < threshold) {
                emit({ type: 'skip', place_id: place.place_id, message: `Sotto soglia (score ${weakness_score}): ${place.name}` })
                continue
              }

              // Canale e angolo
              const canale_consigliato = recommendChannel(fullSignals, email_generic)
              const angolo_suggerito = generateAngolo(fullSignals, categoria)

              // Provenienza
              const provenienza = buildProvenanceList(fullSignals as Record<string, unknown>, websiteFromSearch ?? null)

              // Upsert
              const { prospect, isNew } = await upsertProspectFromPipeline({
                place_id:           place.place_id,
                comune,
                categoria,
                website_url:        websiteFromSearch ?? null,
                website_status,
                email_generic,
                email_nominative,
                email_type,
                canale_consigliato,
                weakness_score,
                angolo_suggerito,
                signals:            fullSignals,
                screenshot_url:     null,
                provenienza,
                last_screened_at:   new Date().toISOString(),
              })

              if (isNew) n_nuovi++

              emit({
                type: 'progress',
                place_id: place.place_id,
                message: `${isNew ? 'Nuovo' : 'Aggiornato'}: ${place.name} (score: ${weakness_score})`,
                prospect,
                api_calls: apiCalls,
              })

              // Breve pausa per non martellare le API
              await delay(200)
            } catch (e: unknown) {
              emit({
                type: 'error',
                place_id: place.place_id,
                error: `Errore su ${place.name}: ${e instanceof Error ? e.message : String(e)}`,
                api_calls: apiCalls,
              })
            }
          }
        }
      }

      // Aggiorna run stats
      if (runId) {
        await updateScreeningRun(runId, { n_trovati, n_nuovi }).catch(() => {})
      }

      emit({
        type: 'complete',
        message: `Screening completato: ${n_trovati} trovati, ${n_nuovi} nuovi, ${apiCalls} chiamate API`,
        n_trovati,
        n_nuovi,
        api_calls: apiCalls,
      })

      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
