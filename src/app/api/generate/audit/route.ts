import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { Prospect } from '@/types/prospect'
import { buildMiniAudit } from '@/lib/handoff'
import { resolveModel } from '@/lib/models'

// Il mini-audit parte dai fatti deterministici (buildMiniAudit) e li fa riscrivere
// da Sonnet 4.6: ordinati per impatto, inquadrati come opportunità, tono "servire non vendere".
// I fatti restano la sola fonte di verità; in caso di errore API si torna al testo deterministico.
const SYSTEM_PROMPT = `Sei un consulente digitale che aiuta imprenditori locali italiani in Versilia.
Ti vengono forniti i PUNTI OGGETTIVI emersi da un'analisi tecnica del sito di un'attività.

Compito: riscrivere questi punti come un mini-audit chiaro e persuasivo per il titolare.

Regole ferme:
- Usa SOLO i fatti forniti. NON inventare problemi, dati o numeri non presenti.
- Ordina i punti dal più impattante per il business al meno rilevante.
- Inquadra ogni punto come OPPORTUNITÀ concreta, mai come colpa o critica.
- Tono calmo, diretto, concreto. Servire, non vendere.
- NON usare trattini lunghi (—), NON inventare percentuali o numeri.
- Massimo una frase per punto, linguaggio comprensibile a un non tecnico.
- Restituisci una lista numerata, senza introduzione né conclusione.
- Se i fatti indicano che il sito è in buone condizioni, dillo in una frase senza forzare problemi.`

export async function POST(req: NextRequest) {
  const { prospect }: { prospect: Prospect } = await req.json()

  // Fonte di verità + fallback deterministico
  const deterministicAudit = buildMiniAudit(prospect)

  try {
    const client = new Anthropic()
    const msg = await client.messages.create({
      model: resolveModel('sonnet'),
      max_tokens: 600,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Categoria attività: ${prospect.categoria ?? 'non specificata'}\n\nPunti oggettivi rilevati:\n${deterministicAudit}`,
        },
      ],
    })

    // Sonnet 5 usa thinking adattivo: prendi il testo dai blocchi 'text', non da content[0].
    const text = msg.content
      .filter(b => b.type === 'text')
      .map(b => (b.type === 'text' ? b.text : ''))
      .join('')
      .trim()
    return NextResponse.json({ text: text || deterministicAudit })
  } catch {
    // Errore API (rete, quota, chiave): nessun blocco, si usa il testo deterministico.
    return NextResponse.json({ text: deterministicAudit })
  }
}
