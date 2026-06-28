import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { Prospect } from '@/types/prospect'
import type { LivePlaceData } from '@/types/google'
import { buildRecapText } from '@/lib/handoff'

// Modelli selezionabili dalla scheda. Haiku = default economico; Sonnet = prosa più curata.
const MODELS: Record<string, string> = {
  haiku:  'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-4-6',
}
const DEFAULT_MODEL = 'sonnet'

const SYSTEM_PROMPT = `Sei un consulente digitale che aiuta imprenditori locali italiani.
Scrivi una email di outreach B2B a freddo per Fabio, titolare di un'agenzia web in Versilia.

Regole ferme:
- Tono calmo, diretto, non commerciale. Servire, non vendere.
- NON usare trattini lunghi (—), NON usare numeri o percentuali nel corpo.
- NON usare la parola "artigiano" o "artigianale".
- Inquadra sempre il divario come OPPORTUNITÀ, mai come colpa o critica.
- Oggetto: breve, specifico, non generico.
- Corpo: max 4 paragrafi corti. Primo paragrafo: chi sei e perché scrivi QUESTA email a LORO.
- Firma: Fabio Delli — Agenzia web Versilia.
- Restituisci SOLO l'email (oggetto + corpo), senza spiegazioni.`

export async function POST(req: NextRequest) {
  // Flag fase 2: useWebSearch (non attivo in v1, struttura predisposta)
  const { prospect, liveData, model }: {
    prospect: Prospect
    liveData: LivePlaceData | null
    model?: string
  } = await req.json()

  const recap = buildRecapText(prospect, liveData)
  const modelId = MODELS[model ?? DEFAULT_MODEL] ?? MODELS[DEFAULT_MODEL]

  const client = new Anthropic()

  try {
    const msg = await client.messages.create({
      model: modelId,
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Scrivi l'email per questo prospect:\n\n${recap}`,
        },
      ],
    })

    const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
    return NextResponse.json({ text })
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Errore generazione' },
      { status: 500 }
    )
  }
}
