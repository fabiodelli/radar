'use client'

import { useState, useCallback } from 'react'
import type { Prospect } from '@/types/prospect'
import type { LivePlaceData } from '@/types/google'
import { buildRecapText } from '@/lib/handoff'

interface ActionBarProps {
  prospect: Prospect
  liveData: LivePlaceData | null
}

export function ActionBar({ prospect, liveData }: ActionBarProps) {
  const [loadingMail, setLoadingMail] = useState(false)
  const [loadingAudit, setLoadingAudit] = useState(false)
  const [mailText, setMailText] = useState<string | null>(null)
  const [auditText, setAuditText] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

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
        body: JSON.stringify({ prospect, liveData }),
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

  function handleApriFirma() {
    const emailDest = prospect.email_generic ?? prospect.email_nominative ?? ''
    const oggetto = `Un'occhiata al vostro sito`
    const corpo = mailText ?? buildRecapText(prospect, liveData)
    const mailto = `mailto:${emailDest}?subject=${encodeURIComponent(oggetto)}&body=${encodeURIComponent(corpo)}`
    window.open(mailto, '_blank')
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

        <button
          onClick={handleGeneraMail}
          disabled={loadingMail}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loadingMail ? 'Generazione...' : 'Genera mail'}
        </button>

        <button
          onClick={handleGeneraAudit}
          disabled={loadingAudit}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {loadingAudit ? 'Generazione...' : 'Genera mini-audit'}
        </button>

        {(mailText || prospect.email_generic) && (
          <button
            onClick={handleApriFirma}
            className="rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100"
          >
            Apri nel client email
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
