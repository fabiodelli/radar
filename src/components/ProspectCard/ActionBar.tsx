'use client'

import { useState, useCallback } from 'react'
import type { Prospect } from '@/types/prospect'
import type { LivePlaceData } from '@/types/google'
import { buildRecapText } from '@/lib/handoff'

// Numero in formato internazionale per wa.me (solo cifre, con prefisso 39).
// Ritorna null se non c'è un numero italiano plausibile.
function waDigits(live: LivePlaceData | null): string | null {
  if (!live) return null
  let digits: string
  if (live.phone_intl) {
    digits = live.phone_intl.replace(/\D/g, '')      // già internazionale (+39…)
  } else if (live.phone) {
    digits = '39' + live.phone.replace(/\D/g, '')     // nazionale → anteponi il prefisso Italia
  } else {
    return null
  }
  if (!/^39\d{9,11}$/.test(digits)) return null       // formato italiano plausibile
  if (/^(\d)\1+$/.test(digits)) return null           // scarta cifre tutte uguali
  return digits
}

// Suggerimento: WhatsApp è più probabile sui cellulari (3xx) che sui fissi (0xx).
function phoneHint(live: LivePlaceData | null): 'cellulare' | 'fisso' | null {
  const d = waDigits(live)
  if (!d) return null
  const national = d.slice(2)
  if (national.startsWith('3')) return 'cellulare'
  if (national.startsWith('0')) return 'fisso'
  return null
}

interface ActionBarProps {
  prospect: Prospect
  liveData: LivePlaceData | null
}

export function ActionBar({ prospect, liveData }: ActionBarProps) {
  const [loadingMail, setLoadingMail] = useState(false)
  const [loadingAudit, setLoadingAudit] = useState(false)
  const [mailText, setMailText] = useState<string | null>(null)
  const [auditText, setAuditText] = useState<string | null>(null)
  const [waText, setWaText] = useState<string | null>(null)
  const [loadingWa, setLoadingWa] = useState(false)
  const [copied, setCopied] = useState(false)
  const [mailModel, setMailModel] = useState<'haiku' | 'sonnet'>('sonnet')

  async function handleCopyRecap() {
    const text = buildRecapText(prospect, liveData)
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleGeneraMail() {
    setLoadingMail(true)
    setMailText(null)
    try {
      const res = await fetch('/api/generate/mail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospect, liveData, model: mailModel }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setMailText(json.text)
    } catch (e) {
      alert('Errore generazione mail: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setLoadingMail(false)
    }
  }

  async function handleGeneraAudit() {
    setLoadingAudit(true)
    setAuditText(null)
    try {
      const res = await fetch('/api/generate/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospect }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setAuditText(json.text)
    } catch (e) {
      alert('Errore generazione audit: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setLoadingAudit(false)
    }
  }

  async function handleGeneraWhatsApp() {
    setLoadingWa(true)
    setWaText(null)
    try {
      const res = await fetch('/api/generate/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospect, liveData }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setWaText(json.text)
    } catch (e) {
      alert('Errore generazione messaggio WhatsApp: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setLoadingWa(false)
    }
  }

  function handleApriWhatsApp() {
    const digits = waDigits(liveData)
    if (!digits) {
      alert('Numero non disponibile per WhatsApp')
      return
    }
    const url = `https://wa.me/${digits}${waText ? `?text=${encodeURIComponent(waText)}` : ''}`
    window.open(url, '_blank')
  }

  // Account Gmail di Fabio (mittente)
  const GMAIL_ACCOUNT = 'delli.fabio@gmail.com'

  // Estrae oggetto e corpo dalla bozza generata (prima riga "Oggetto: ...").
  function splitDraft(draft: string): { subject: string; body: string } {
    const lines = draft.split('\n')
    const idx = lines.findIndex(l => /^\s*oggetto\s*:/i.test(l))
    if (idx === -1) {
      return { subject: "Un'occhiata al vostro sito", body: draft.trim() }
    }
    const subject = lines[idx].replace(/^\s*oggetto\s*:/i, '').trim()
    const body = lines.slice(idx + 1).join('\n').trim()
    return { subject, body: body || draft.trim() }
  }

  function handleApriFirma() {
    const emailDest = prospect.email_generic ?? prospect.email_nominative ?? ''
    const draft = mailText ?? buildRecapText(prospect, liveData)
    const { subject, body } = mailText
      ? splitDraft(mailText)
      : { subject: "Un'occhiata al vostro sito", body: draft }

    // Apre direttamente la finestra di composizione Gmail sull'account di Fabio
    const gmailUrl =
      `https://mail.google.com/mail/?authuser=${encodeURIComponent(GMAIL_ACCOUNT)}` +
      `&view=cm&fs=1&tf=1` +
      `&to=${encodeURIComponent(emailDest)}` +
      `&su=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(body)}`
    window.open(gmailUrl, '_blank')
  }

  async function handleSuppression() {
    if (!confirm('Mettere in suppression? Non riapparirà mai più negli screening.')) return
    await fetch(`/api/prospects/${prospect.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stato: 'suppression' }),
    })
    window.location.href = '/'
  }

  const waNum = waDigits(liveData)
  const waLabel = phoneHint(liveData)

  return (
    <div className="space-y-4">
      {/* Azioni principali */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleCopyRecap}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          {copied ? 'Copiato!' : 'Copia recap'}
        </button>

        <div className="flex items-stretch rounded-md overflow-hidden border border-blue-600">
          <button
            onClick={handleGeneraMail}
            disabled={loadingMail}
            className="bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loadingMail ? 'Generazione...' : 'Genera mail'}
          </button>
          <select
            value={mailModel}
            onChange={e => setMailModel(e.target.value as 'haiku' | 'sonnet')}
            title="Modello per la scrittura della mail"
            className="border-l border-blue-500 bg-blue-50 px-2 text-xs font-medium text-blue-800 focus:outline-none cursor-pointer"
          >
            <option value="sonnet">Sonnet (qualità)</option>
            <option value="haiku">Haiku (economico)</option>
          </select>
        </div>

        <button
          onClick={handleGeneraAudit}
          disabled={loadingAudit}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {loadingAudit ? 'Generazione...' : 'Genera mini-audit'}
        </button>

        {waNum && (
          <button
            onClick={handleGeneraWhatsApp}
            disabled={loadingWa}
            className="rounded-md border border-green-600 bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {loadingWa ? 'Generazione...' : 'Genera messaggio WhatsApp'}
          </button>
        )}

        {(mailText || prospect.email_generic) && (
          <button
            onClick={handleApriFirma}
            className="rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100"
          >
            Apri in Gmail
          </button>
        )}

        {waNum && (
          <button
            onClick={handleApriWhatsApp}
            title={waLabel ? `Numero ${waLabel} — WhatsApp è più probabile sui cellulari` : undefined}
            className="rounded-md border border-green-300 bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-100"
          >
            Apri WhatsApp{waLabel ? ` (${waLabel})` : ''}
          </button>
        )}

        <button
          onClick={handleSuppression}
          className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 ml-auto"
        >
          Metti in suppression
        </button>
      </div>

      {/* Mail generata */}
      {mailText && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-blue-900">Bozza email</h4>
            <button
              onClick={() => navigator.clipboard.writeText(mailText)}
              className="text-xs text-blue-600 hover:underline"
            >
              Copia testo
            </button>
          </div>
          <pre className="text-sm text-gray-800 whitespace-pre-wrap font-sans">{mailText}</pre>
        </div>
      )}

      {/* Messaggio WhatsApp generato */}
      {waText && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-green-900">Messaggio WhatsApp</h4>
            <button
              onClick={() => navigator.clipboard.writeText(waText)}
              className="text-xs text-green-700 hover:underline"
            >
              Copia testo
            </button>
          </div>
          <pre className="text-sm text-gray-800 whitespace-pre-wrap font-sans">{waText}</pre>
        </div>
      )}

      {/* Mini-audit generato */}
      {auditText && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-amber-900">Mini-audit</h4>
            <button
              onClick={() => navigator.clipboard.writeText(auditText)}
              className="text-xs text-amber-600 hover:underline"
            >
              Copia testo
            </button>
          </div>
          <pre className="text-sm text-gray-800 whitespace-pre-wrap font-sans">{auditText}</pre>
        </div>
      )}
    </div>
  )
}
