import type { CanaleSuggerito, EmailType, Signals } from '@/types/prospect'

export function recommendChannel(
  signals: Partial<Signals>,
  emailGeneric: string | null
): CanaleSuggerito {
  if (!signals.has_website) {
    // Niente sito: canale primario è visita/telefono
    return emailGeneric ? 'telefono_e_email' : 'telefono'
  }
  if (emailGeneric) {
    return 'telefono_e_email'
  }
  return 'visita'
}

export function classifyEmailType(
  emailGeneric: string | null,
  emailNominative: string | null
): EmailType {
  if (emailGeneric) return 'generic'
  if (emailNominative) return 'nominative'
  return 'none'
}

export function generateAngolo(signals: Partial<Signals>, categoria: string, reviewText?: string): string {
  const angles: string[] = []

  if (!signals.has_website) {
    if (signals.social_only) {
      angles.push('è presente solo sui social (Facebook/Instagram), senza un sito proprio — uno spazio controllato da loro intercetterebbe chi cerca su Google')
    } else {
      angles.push('presenza online da costruire da zero — chi cerca questa attività non la trova sul web')
    }
  }

  if (signals.has_website) {
    if (signals.mobile_viewport === false) {
      angles.push('il sito non funziona bene da telefono, dove guarda la maggior parte dei clienti oggi')
    }
    if (signals.https === false) {
      angles.push('il sito non è sicuro (niente HTTPS): i browser moderni mostrano un avviso ai visitatori')
    }
    const year = signals.copyright_year ?? (signals.last_content_date ? parseInt(signals.last_content_date) : null)
    if (year && (new Date().getFullYear() - year) >= 3) {
      angles.push(`il sito appare datato (aggiornato l'ultima volta intorno al ${year})`)
    }
    if (signals.psi_performance !== null && signals.psi_performance !== undefined && signals.psi_performance < 50) {
      angles.push(`il sito è lento da caricare (score performance: ${signals.psi_performance}/100) — i visitatori abbandonano prima di leggere`)
    }
    if (!signals.has_contact_form && !signals.has_booking) {
      angles.push('i contatti arrivano solo per telefono — un modulo di contatto o un sistema di prenotazione potrebbe alleggerire il carico e non perdere richieste')
    }
    const isExport = ['marmo', 'nautica', 'yacht', 'marine', 'marble', 'stone'].some(c => categoria.toLowerCase().includes(c))
    if (isExport) {
      const hasIntl = (signals.lang_versions ?? []).some(l => l.startsWith('en') || l.startsWith('de'))
      if (!hasIntl) angles.push('manca la versione inglese (o tedesca) per i clienti internazionali — settore rilevante per l\'export')
    }
  }

  if (reviewText && /non rispond|irraggiungibile|impossible|difficile/i.test(reviewText)) {
    angles.push('diverse persone faticano a raggiungerli: un canale di contatto digitale ben visibile chiude questo buco')
  }

  if (angles.length === 0) {
    angles.push('presenza digitale da rafforzare e aggiornare per intercettare nuovi clienti online')
  }

  return angles.join('; ')
}
