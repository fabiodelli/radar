import type { Prospect } from './prospect'

export interface ScreeningQuery {
  categorie: string[]
  comuni: string[]
  threshold?: number // weakness score minimo per includere, default 2
  includePageSpeed?: boolean // se true esegue PageSpeed per ogni sito (più lento/costoso)
}

export interface ScreeningRun {
  id: string
  query: ScreeningQuery
  eseguita_at: string
  n_trovati: number
  n_nuovi: number
}

// Eventi SSE emessi durante lo screening
export type ScreeningEventType =
  | 'start'
  | 'found'       // places trovati dalla ricerca
  | 'progress'    // un prospect processato
  | 'skip'        // place_id già noto e in stato escluso
  | 'error'       // errore su un singolo prospect
  | 'complete'    // fine run

export interface ScreeningEvent {
  type: ScreeningEventType
  message?: string
  place_id?: string
  prospect?: Prospect
  api_calls?: number
  n_trovati?: number
  n_nuovi?: number
  error?: string
}
