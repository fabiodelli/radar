export type WebsiteStatus = 'none' | 'social_only' | 'dated' | 'decent' | 'recent'
export type EmailType = 'generic' | 'nominative' | 'none'
export type CanaleSuggerito = 'email' | 'visita' | 'telefono' | 'telefono_e_email'
export type FlagPotenziale = 'basso' | 'medio' | 'alto'
export type StatoProspect =
  | 'nuovo'
  | 'da_vagliare'
  | 'vagliato'
  | 'da_contattare'
  | 'contattato'
  | 'follow_up'
  | 'in_trattativa'
  | 'cliente'
  | 'scartato'
  | 'suppression'

export type ServiziProponibili =
  | 'sito'
  | 'ecommerce'
  | 'multilingua'
  | 'assistente_ai'
  | 'prenotazioni'
  | 'altro'

export interface ProvenanceEntry {
  campo: string
  fonte: string
  data: string // ISO date
}

export interface Signals {
  // Website analysis
  has_website: boolean
  https: boolean | null
  mobile_viewport: boolean | null
  copyright_year: number | null
  tech_stack: string[]
  lang_versions: string[]
  has_contact_form: boolean | null
  has_booking: boolean | null
  has_ecommerce: boolean | null
  social_links: string[]
  page_count_estimate: number | null
  last_content_date: string | null
  emails_found: string[]
  phones_found: string[]
  fetch_error: string | null

  // PageSpeed Insights
  psi_performance: number | null
  psi_mobile_usability: boolean | null
  psi_seo: number | null

  // Social presence (when no website)
  social_only: boolean
  social_fb: string | null
  social_ig: string | null
  directory_listing: string | null
}

export interface Prospect {
  id: string
  place_id: string
  comune: string | null
  categoria: string | null
  website_url: string | null
  website_status: WebsiteStatus | null
  email_generic: string | null
  email_nominative: string | null
  email_type: EmailType | null
  canale_consigliato: CanaleSuggerito | null
  weakness_score: number
  angolo_suggerito: string | null
  signals: Partial<Signals>
  flag_potenziale: FlagPotenziale | null
  note: string | null
  servizi_proponibili: ServiziProponibili[]
  stato: StatoProspect
  prossimo_followup: string | null // date string YYYY-MM-DD
  provenienza: ProvenanceEntry[]
  lia_note: string | null
  screenshot_url: string | null
  created_at: string
  updated_at: string
  last_screened_at: string | null
  last_checked_at: string | null
}

export type ProspectPatch = Partial<
  Pick<
    Prospect,
    | 'flag_potenziale'
    | 'note'
    | 'servizi_proponibili'
    | 'stato'
    | 'prossimo_followup'
    | 'lia_note'
    | 'email_generic'
    | 'email_nominative'
    | 'email_type'
    | 'canale_consigliato'
  >
>

export interface ProspectFilters {
  stato?: StatoProspect | StatoProspect[]
  comune?: string
  categoria?: string
  flag_potenziale?: FlagPotenziale
  canale_consigliato?: CanaleSuggerito
  followup_dovuti?: boolean
  search?: string
}
