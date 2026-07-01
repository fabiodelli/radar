// Model id Anthropic centralizzati, usati da mail e mini-audit.
// Haiku = economico; Sonnet 5 = miglior rapporto qualità/prezzo per compiti con ragionamento.
export const MODELS: Record<string, string> = {
  haiku:  'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-5',
}

export const DEFAULT_MODEL = 'sonnet'

// Risolve la chiave logica (haiku/sonnet) nel model id, con fallback al default.
export function resolveModel(key?: string): string {
  return MODELS[key ?? DEFAULT_MODEL] ?? MODELS[DEFAULT_MODEL]
}
