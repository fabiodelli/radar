import type { Signals, WebsiteStatus } from '@/types/prospect'

const EXPORT_CATEGORIES = ['marmo', 'nautica', 'yacht', 'marine', 'marble', 'stone']
const CURRENT_YEAR = new Date().getFullYear()

export function computeWeaknessScore(
  signals: Partial<Signals>,
  categoria: string,
  reviewText?: string
): number {
  let score = 0

  // Niente sito: +3
  if (!signals.has_website) {
    score += 3
  } else {
    // Solo social (nessun sito proprio): +2
    if (signals.social_only) score += 2

    // Sito senza HTTPS: +2
    if (signals.has_website && signals.https === false) score += 2

    // Non mobile/responsive (no viewport): +2
    if (signals.mobile_viewport === false) score += 2

    // Copyright o ultimo contenuto vecchio 3+ anni: +1
    const year = signals.copyright_year ?? (signals.last_content_date ? parseInt(signals.last_content_date) : null)
    if (year && (CURRENT_YEAR - year) >= 3) score += 1

    // PSI performance < 50: +1
    if (signals.psi_performance !== null && signals.psi_performance !== undefined && signals.psi_performance < 50) score += 1

    // Nessuna versione EN/DE su settore export: +1 (solo se le lingue sono state verificate)
    const isExport = EXPORT_CATEGORIES.some(c => categoria.toLowerCase().includes(c))
    if (isExport) {
      if (signals.lang_versions !== undefined) {
        const hasIntl = signals.lang_versions.some(l => l.startsWith('en') || l.startsWith('de'))
        if (!hasIntl) score += 1
      }
      // Bonus settore export: +1
      score += 1
    }

    // SEO base assente (né meta description né H1, verificati): +1 — sito trascurato
    if (signals.seo_description === false && signals.seo_h1 === false) score += 1

    // Footprint minimo (sito sottile, poche pagine): +1
    if ((signals.page_count_estimate ?? 10) < 4) score += 1
  }

  // Bonus "dolore documentato" nelle recensioni: +2
  if (reviewText && /non rispond|irraggiungibile|impossible|difficile|non si trovano|nessuno risponde/i.test(reviewText)) {
    score += 2
  }

  return score
}

export function computeWebsiteStatus(signals: Partial<Signals>): WebsiteStatus {
  if (!signals.has_website) return signals.social_only ? 'social_only' : 'none'
  if (signals.social_only) return 'social_only'

  const year = signals.copyright_year ?? (signals.last_content_date ? parseInt(signals.last_content_date) : null)
  const isOld = year ? (CURRENT_YEAR - year) >= 3 : false

  if (isOld || signals.mobile_viewport === false || signals.https === false) return 'dated'
  if ((signals.psi_performance ?? 100) >= 80 && signals.mobile_viewport) return 'recent'
  return 'decent'
}
