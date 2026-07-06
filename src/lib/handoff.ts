import type { Prospect } from '@/types/prospect'
import type { LivePlaceData } from '@/types/google'

export function buildRecapText(prospect: Prospect, live: LivePlaceData | null): string {
  const lines: string[] = []

  lines.push('=== RADAR — SCHEDA PROSPECT ===')
  lines.push('')

  // Identità
  if (live) {
    lines.push(`**Nome:** ${live.name}`)
    lines.push(`**Indirizzo:** ${live.formatted_address}`)
    if (live.phone) lines.push(`**Telefono:** ${live.phone}`)
    if (live.rating) lines.push(`**Rating:** ${live.rating}/5 (${live.user_ratings_total} recensioni)`)
    if (live.website) lines.push(`**Sito attuale:** ${live.website}`)
    if (live.maps_url) lines.push(`**Google Maps:** ${live.maps_url}`)
  }
  lines.push(`**Comune:** ${prospect.comune ?? '—'}`)
  lines.push(`**Categoria:** ${prospect.categoria ?? '—'}`)
  lines.push(`**Canale consigliato:** ${prospect.canale_consigliato ?? '—'}`)
  lines.push('')

  // Stato sito
  lines.push('**Presenza web:**')
  const s = prospect.signals
  if (!s.has_website) {
    lines.push('- Nessun sito web trovato')
    if (s.social_only) lines.push('- Ha presenza social (FB/IG)')
  } else {
    lines.push(`- Sito: ${prospect.website_url ?? '—'} (${prospect.website_status ?? '?'})`)
    if (s.https === false) lines.push('- SENZA HTTPS (sito non sicuro)')
    if (s.mobile_viewport === false) lines.push('- Non ottimizzato per smartphone')
    if (s.copyright_year) lines.push(`- Copyright/data contenuto: ${s.copyright_year}`)
    if (s.tech_stack?.length) lines.push(`- Tech: ${s.tech_stack.join(', ')}`)
    if (s.lang_versions?.length) lines.push(`- Lingue: ${s.lang_versions.join(', ')}`)
    if (s.psi_performance !== null && s.psi_performance !== undefined) {
      lines.push(`- Performance mobile (PSI): ${s.psi_performance}/100`)
    }
    // Solo assenze VERIFICATE (false), mai dedotte da mancata verifica (null)
    if (s.has_contact_form === false) lines.push('- Nessun modulo di contatto')
    if (s.has_booking === false) lines.push('- Nessun sistema di prenotazione')
    if (s.has_ecommerce === false) lines.push('- Nessun e-commerce')
    if (s.seo_description === false && s.seo_h1 === false) {
      lines.push('- SEO base assente (manca meta description e H1): poco leggibile da Google')
    }
    if (s.pages_fetched?.length) lines.push(`- Pagine analizzate: ${s.pages_fetched.length}`)
    if (s.fetch_error) lines.push(`- Nota analisi: ${s.fetch_error}`)
  }
  lines.push('')

  // Email e contatti
  lines.push('**Contatti trovati:**')
  if (prospect.email_generic) lines.push(`- Email generica: ${prospect.email_generic} [generic]`)
  if (prospect.email_nominative) lines.push(`- Email nominativa: ${prospect.email_nominative} [nominative — usare con cautela]`)
  if (!prospect.email_generic && !prospect.email_nominative) lines.push('- Nessuna email trovata')
  lines.push('')

  // Score e angolo
  lines.push(`**Weakness score:** ${prospect.weakness_score}`)
  lines.push('')
  lines.push(`**Angolo suggerito:** ${prospect.angolo_suggerito ?? '—'}`)
  lines.push('')

  // Servizi scelti da Fabio
  if (prospect.servizi_proponibili?.length) {
    lines.push(`**Servizi da proporre:** ${prospect.servizi_proponibili.join(', ')}`)
    lines.push('')
  }

  // Note di Fabio
  if (prospect.note) {
    lines.push('**Note di Fabio (scoperture, visita, idee):**')
    lines.push(prospect.note)
    lines.push('')
  }

  // LIA note
  if (prospect.lia_note) {
    lines.push(`**Nota legittimo interesse:** ${prospect.lia_note}`)
    lines.push('')
  }

  // Recensioni salienti
  if (live?.reviews?.length) {
    lines.push('**Recensioni recenti (estratto):**')
    for (const r of live.reviews.slice(0, 3)) {
      lines.push(`- [${r.rating}/5] "${r.text.slice(0, 200)}"`)
    }
    lines.push('')
  }

  lines.push('===')

  return lines.join('\n')
}

export function buildMiniAudit(prospect: Prospect): string {
  const s = prospect.signals
  const items: string[] = []

  if (!s.has_website) {
    items.push('Nessun sito web: l\'attività non è trovabile su Google dai potenziali clienti')
  } else {
    if (s.mobile_viewport === false) {
      items.push('Il sito non è ottimizzato per smartphone — dove avvengono la maggior parte delle ricerche locali')
    }
    if (s.https === false) {
      items.push('Il sito non è sicuro (manca HTTPS): i browser mostrano avvisi che allontanano i visitatori')
    }
    const year = s.copyright_year ?? (s.last_content_date ? parseInt(s.last_content_date) : null)
    if (year && (new Date().getFullYear() - year) >= 3) {
      items.push(`Il sito risulta aggiornato l'ultima volta intorno al ${year}: un sito datato trasmette un'immagine che non rispecchia le capacità reali dell'attività`)
    }
    if (s.psi_performance !== null && s.psi_performance !== undefined && s.psi_performance < 50) {
      items.push(`Il sito è lento (${s.psi_performance}/100 su mobile): un visitatore su due abbandona se una pagina ci mette più di 3 secondi`)
    }
    // Solo assenze VERIFICATE (false): un'affermazione sbagliata nell'audit brucia il lead
    if (s.has_contact_form === false && s.has_booking === false) {
      items.push('Non c\'è un modulo di contatto né un sistema di prenotazione: le richieste arrivano solo per telefono e alcune si perdono')
    }
    if (s.seo_description === false && s.seo_h1 === false) {
      items.push('Il sito è poco leggibile da Google (manca la descrizione nei risultati di ricerca): chi cerca la categoria in zona fatica a trovarlo')
    }
    const isExport = ['marmo', 'nautica', 'marble', 'stone'].some(c => (prospect.categoria ?? '').toLowerCase().includes(c))
    if (isExport && s.lang_versions !== undefined && !s.lang_versions.some(l => l.startsWith('en') || l.startsWith('de'))) {
      items.push('Il sito è solo in italiano: manca la versione inglese o tedesca per intercettare clienti internazionali, rilevante per questo settore')
    }
  }

  if (items.length === 0) {
    return 'Il sito è in buone condizioni tecniche. Le opportunità di miglioramento riguardano principalmente contenuto e posizionamento.'
  }

  return items.map((item, i) => `${i + 1}. ${item}`).join('\n\n')
}
