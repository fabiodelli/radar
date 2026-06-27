import type { ProvenanceEntry } from '@/types/prospect'

export function prov(campo: string, fonte: string): ProvenanceEntry {
  return { campo, fonte, data: new Date().toISOString().split('T')[0] }
}

export function buildProvenanceList(
  signals: Record<string, unknown>,
  websiteUrl: string | null
): ProvenanceEntry[] {
  const entries: ProvenanceEntry[] = []
  const siteFonte = websiteUrl ? `fetch: ${websiteUrl}` : 'analisi diretta'

  const siteFields = [
    'has_website', 'https', 'mobile_viewport', 'copyright_year', 'tech_stack',
    'lang_versions', 'has_contact_form', 'has_booking', 'has_ecommerce',
    'social_links', 'page_count_estimate', 'last_content_date',
    'emails_found', 'phones_found',
  ]
  for (const f of siteFields) {
    if (f in signals && signals[f] !== null && signals[f] !== undefined) {
      entries.push(prov(f, siteFonte))
    }
  }

  if ('psi_performance' in signals) entries.push(prov('psi_performance', 'PageSpeed Insights API'))
  if ('psi_seo' in signals) entries.push(prov('psi_seo', 'PageSpeed Insights API'))
  if ('psi_mobile_usability' in signals) entries.push(prov('psi_mobile_usability', 'PageSpeed Insights API'))

  return entries
}
