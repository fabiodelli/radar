import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { Prospect } from '@/types/prospect'
import type { LivePlaceData } from '@/types/google'
import { buildRecapText } from '@/lib/handoff'
import { resolveModel } from '@/lib/models'

// Messaggio WhatsApp di primo contatto: molto più breve e diretto di una email.
const SYSTEM_PROMPT = `Scrivi un breve messaggio WhatsApp di primo contatto B2B per conto di Fabio Delli, verso un'attività locale italiana.

Chi è Fabio (usa per tono e posizionamento, non elencarlo):
- Professionista digitale indipendente della Versilia, NON un'agenzia. Interlocutore unico: segue ogni progetto in diretta.
- Si occupa di siti web e soluzioni digitali, incluse integrazioni AI (assistenti multilingue, automazioni), quando portano valore.

Regole ferme:
- È WhatsApp, NON una email: molto breve (2-4 frasi corte). Tono cortese, diretto, per niente commerciale. Servire, non vendere.
- NIENTE oggetto, niente formule da lettera ("Gentile…", "Cordiali saluti"). Apri con un saluto semplice e presentati in una riga.
- Spiega in una frase perché scrivi a LORO, collegandoti alla loro attività o settore.
- Descrivi l'eventuale spunto SOLO come opportunità concreta, in positivo. NON usare mai parole come "critica", "colpa", "problema", "difetto", "errore" — nemmeno negate.
- NON pre-impegnarti sull'entità dell'intervento (non dire "non serve rifare tutto" o "solo ritocchi"). NON parlare di costi, prezzi o budget.
- NON usare trattini lunghi (—), NON usare numeri o percentuali, NON usare emoji.
- Chiudi con un invito leggero a sentirsi, senza pressione.
- Firma con "Fabio Delli" e, a capo, www.fabiodelli.com. NON scrivere numeri di telefono.
- Restituisci SOLO il messaggio, senza spiegazioni.`

export async function POST(req: NextRequest) {
  const { prospect, liveData }: {
    prospect: Prospect
    liveData: LivePlaceData | null
  } = await req.json()

  const recap = buildRecapText(prospect, liveData)

  const client = new Anthropic()

  try {
    const msg = await client.messages.create({
      model: resolveModel('sonnet'),
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Scrivi il messaggio WhatsApp per questo prospect:\n\n${recap}`,
        },
      ],
    })

    // Sonnet 5 usa thinking adattivo: prendi il testo dai blocchi 'text', non da content[0].
    const text = msg.content
      .filter(b => b.type === 'text')
      .map(b => (b.type === 'text' ? b.text : ''))
      .join('')
      .trim()
    return NextResponse.json({ text })
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Errore generazione' },
      { status: 500 }
    )
  }
}
