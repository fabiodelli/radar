import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { Prospect } from '@/types/prospect'
import type { LivePlaceData } from '@/types/google'
import { buildRecapText } from '@/lib/handoff'
import { resolveModel } from '@/lib/models'

const SYSTEM_PROMPT = `Scrivi una email di outreach B2B a freddo per conto di Fabio Delli, rivolta a imprenditori locali italiani.

Chi è Fabio (usa per tono e posizionamento, non elencarlo meccanicamente):
- Professionista digitale indipendente della Versilia, NON un'agenzia.
- Interlocutore unico: segue ogni progetto in diretta dall'inizio alla fine, senza catene di referenti o account manager.
- Niente pacchetti in serie: ogni intervento parte da un problema reale dell'attività.
- Si occupa di siti web e soluzioni digitali, incluse integrazioni AI (assistenti multilingue, automazioni) quando portano valore concreto.

Regole ferme:
- Tono calmo, diretto, non commerciale. Servire, non vendere.
- NON usare trattini lunghi (—), NON usare numeri o percentuali nel corpo.
- NON usare la parola "artigiano" o "artigianale". NON definire mai Fabio un'agenzia.
- Descrivi il divario SOLO come opportunità concreta, in positivo. NON usare mai parole come "critica", "colpa", "problema", "giudizio", "difetto", "errore" — nemmeno per negarle: scrivere "non è una critica" evoca comunque l'idea di critica. Non nominare ciò che il messaggio NON è; punta dritto a ciò che si può guadagnare.
- Nella prima email NON parlare di costi, prezzo, budget né di "dove va l'investimento": il focus è il valore per LORO (es. più clienti raggiunti), non il modello di lavoro di Fabio. La leva economica si usa più avanti, di persona o nei follow-up.
- Oggetto: breve, specifico, non generico.
- Corpo: max 4 paragrafi corti. Primo paragrafo: chi è Fabio e perché scrive QUESTA email a LORO.
- Chiudi con un invito al confronto senza impegno: una risposta a questa email o una breve telefonata, come preferiscono. Ricorda con naturalezza che il numero di telefono e gli altri contatti sono sul sito, per rendere facile mettersi in contatto. NON inserire il numero di telefono nel testo della mail.
- Firma esattamente così, su righe separate:
Fabio Delli
www.fabiodelli.com
- Restituisci SOLO l'email (oggetto + corpo + firma), senza spiegazioni.`

export async function POST(req: NextRequest) {
  // Flag fase 2: useWebSearch (non attivo in v1, struttura predisposta)
  const { prospect, liveData, model }: {
    prospect: Prospect
    liveData: LivePlaceData | null
    model?: string
  } = await req.json()

  const recap = buildRecapText(prospect, liveData)
  const modelId = resolveModel(model)

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

    // Sonnet 5 usa thinking adattivo: la risposta può iniziare con un blocco 'thinking'.
    // Prendi il testo dai blocchi 'text', non da content[0].
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
