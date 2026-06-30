'use client'

import { useState, useRef } from 'react'
import type { ScreeningEvent, ScreeningQuery } from '@/types/screening'
import type { Prospect } from '@/types/prospect'
import Link from 'next/link'

const COMUNI_VERSILIA = [
  'Viareggio', 'Forte dei Marmi', 'Camaiore', 'Pietrasanta',
  'Massa', 'Carrara', 'Seravezza', 'Stazzema',
]

const CATEGORIE_SUGGERITE = [
  'marmo', 'nautica', 'cantiere navale', 'estetica', 'parrucchiere',
  'ristorante', 'albergo', 'negozio', 'officina', 'carpentiere',
  'geometra', 'architetto', 'avvocato', 'dentista', 'medico',
]

interface LogEntry {
  id: number
  type: ScreeningEvent['type']
  message: string
  prospect?: Prospect
}

export function ScreeningRunner() {
  const [categorie, setCategorie] = useState<string[]>([])
  const [comuni, setComuni] = useState<string[]>([])
  const [threshold, setThreshold] = useState(2)
  const [includePageSpeed, setIncludePageSpeed] = useState(false)
  const [categoriaCustom, setCategoriaCustom] = useState('')
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)
  const [apiCalls, setApiCalls] = useState(0)
  const [log, setLog] = useState<LogEntry[]>([])
  const [stats, setStats] = useState<{ n_trovati: number; n_nuovi: number } | null>(null)
  const logRef = useRef<HTMLDivElement>(null)
  const logId = useRef(0)
  const abortRef = useRef<AbortController | null>(null)

  function stopScreening() {
    abortRef.current?.abort()
  }

  function addLog(entry: Omit<LogEntry, 'id'>) {
    logId.current++
    setLog(prev => [...prev, { ...entry, id: logId.current }])
    setTimeout(() => logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' }), 50)
  }

  function toggleCategoria(c: string) {
    setCategorie(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])
  }

  function toggleComune(c: string) {
    setComuni(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])
  }

  function addCustomCategoria() {
    const val = categoriaCustom.trim()
    if (!val || categorie.includes(val)) return
    setCategorie(prev => [...prev, val])
    setCategoriaCustom('')
  }

  async function startScreening() {
    if (!categorie.length || !comuni.length) {
      alert('Seleziona almeno una categoria e un comune')
      return
    }

    setRunning(true)
    setDone(false)
    setLog([])
    setApiCalls(0)
    setStats(null)

    const body: ScreeningQuery = { categorie, comuni, threshold, includePageSpeed }

    const ac = new AbortController()
    abortRef.current = ac

    try {
      const res = await fetch('/api/screening/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: ac.signal,
      })

      if (!res.body) throw new Error('No response body')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done: streamDone, value } = await reader.read()
        if (streamDone) break

        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''

        for (const part of parts) {
          if (!part.startsWith('data: ')) continue
          try {
            const event: ScreeningEvent = JSON.parse(part.slice(6))

            if (event.api_calls !== undefined) setApiCalls(event.api_calls)

            if (event.type === 'complete') {
              setStats({ n_trovati: event.n_trovati ?? 0, n_nuovi: event.n_nuovi ?? 0 })
              setDone(true)
            }

            addLog({
              type: event.type,
              message: event.message ?? event.error ?? '',
              prospect: event.prospect,
            })
          } catch {}
        }
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        addLog({ type: 'complete', message: 'Screening interrotto' })
      } else {
        addLog({ type: 'error', message: 'Errore connessione: ' + (e instanceof Error ? e.message : String(e)) })
      }
    } finally {
      setRunning(false)
      abortRef.current = null
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Form */}
      <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-5">
        <h2 className="font-semibold text-gray-800">Configura screening</h2>

        {/* Categorie */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Categorie</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {CATEGORIE_SUGGERITE.map(c => (
              <button
                key={c}
                onClick={() => toggleCategoria(c)}
                className={`rounded-full px-3 py-0.5 text-xs border transition-colors ${
                  categorie.includes(c)
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-gray-600'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={categoriaCustom}
              onChange={e => setCategoriaCustom(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCustomCategoria()}
              placeholder="Categoria custom..."
              className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
            />
            <button onClick={addCustomCategoria} className="rounded border border-gray-300 px-2 py-1 text-sm hover:bg-gray-50">
              +
            </button>
          </div>
          {categorie.length > 0 && (
            <p className="text-xs text-gray-500 mt-1">Selezionate: {categorie.join(', ')}</p>
          )}
        </div>

        {/* Comuni */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Comuni</label>
          <div className="flex flex-wrap gap-2">
            {COMUNI_VERSILIA.map(c => (
              <button
                key={c}
                onClick={() => toggleComune(c)}
                className={`rounded-full px-3 py-0.5 text-xs border transition-colors ${
                  comuni.includes(c)
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-gray-600'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Soglia weakness score */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Soglia score minimo: <span className="font-semibold">{threshold}</span>
          </label>
          <input
            type="range"
            min={0}
            max={8}
            value={threshold}
            onChange={e => setThreshold(Number(e.target.value))}
            className="w-48"
          />
          <p className="text-xs text-gray-400 mt-0.5">Solo i prospect con score ≥ {threshold} entrano in lista</p>
        </div>

        {/* Toggle PageSpeed */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={includePageSpeed}
              onChange={e => setIncludePageSpeed(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            Includi analisi PageSpeed
          </label>
          <p className="text-xs text-gray-400 mt-0.5 ml-6">
            Misura velocità/SEO di ogni sito. Più lento e costoso (una chiamata API in più per sito): tienilo spento per i giri ampi, accendilo per liste corte.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={startScreening}
            disabled={running || !categorie.length || !comuni.length}
            className="rounded-md bg-gray-900 px-5 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {running ? 'Screening in corso...' : 'Avvia screening'}
          </button>
          {running && (
            <button
              onClick={stopScreening}
              className="rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Stop
            </button>
          )}
        </div>
      </div>

      {/* Contatore chiamate API */}
      {(running || apiCalls > 0) && (
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-500">Chiamate API sessione:</span>
          <span className={`font-semibold ${apiCalls > 100 ? 'text-red-600' : apiCalls > 50 ? 'text-orange-500' : 'text-gray-900'}`}>
            {apiCalls}
          </span>
          {apiCalls > 80 && (
            <span className="text-xs text-orange-600">Attenzione ai costi — controlla lo spend limit su Google Cloud</span>
          )}
        </div>
      )}

      {/* Log live */}
      {log.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-700">Log screening</h3>
            {done && stats && (
              <div className="flex items-center gap-3 text-sm">
                <span className="text-gray-600">{stats.n_trovati} trovati</span>
                <span className="font-semibold text-green-700">{stats.n_nuovi} nuovi</span>
                <Link href="/" className="text-blue-600 hover:underline">Vai alla lista →</Link>
              </div>
            )}
          </div>
          <div
            ref={logRef}
            className="h-64 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-1 font-mono text-xs"
          >
            {log.map(entry => (
              <div
                key={entry.id}
                className={`${
                  entry.type === 'error' ? 'text-red-600' :
                  entry.type === 'complete' ? 'text-green-700 font-semibold' :
                  entry.type === 'skip' ? 'text-gray-400' :
                  entry.type === 'found' ? 'text-blue-700 font-medium' :
                  'text-gray-700'
                }`}
              >
                [{entry.type}] {entry.message}
                {entry.prospect && (
                  <Link
                    href={`/prospect/${entry.prospect.id}`}
                    className="ml-2 text-blue-600 underline"
                  >
                    apri
                  </Link>
                )}
              </div>
            ))}
            {running && (
              <div className="text-gray-400 animate-pulse">...</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
