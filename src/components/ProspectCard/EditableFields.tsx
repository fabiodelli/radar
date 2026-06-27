'use client'

import { useState } from 'react'
import type { Prospect, ProspectPatch, FlagPotenziale, StatoProspect, ServiziProponibili } from '@/types/prospect'

const STATI: StatoProspect[] = [
  'nuovo', 'da_vagliare', 'vagliato', 'da_contattare',
  'contattato', 'follow_up', 'in_trattativa', 'cliente', 'scartato', 'suppression',
]

const STATI_LABEL: Record<StatoProspect, string> = {
  nuovo:          'Nuovo',
  da_vagliare:    'Da vagliare',
  vagliato:       'Vagliato',
  da_contattare:  'Da contattare',
  contattato:     'Contattato',
  follow_up:      'Follow-up',
  in_trattativa:  'In trattativa',
  cliente:        'Cliente',
  scartato:       'Scartato',
  suppression:    'Suppression',
}

const SERVIZI: Array<{ value: ServiziProponibili; label: string }> = [
  { value: 'sito',          label: 'Sito web' },
  { value: 'ecommerce',     label: 'E-commerce' },
  { value: 'multilingua',   label: 'Multilingua' },
  { value: 'assistente_ai', label: 'Assistente AI' },
  { value: 'prenotazioni',  label: 'Prenotazioni online' },
  { value: 'altro',         label: 'Altro' },
]

interface EditableFieldsProps {
  prospect: Prospect
}

export function EditableFields({ prospect }: EditableFieldsProps) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [fields, setFields] = useState<ProspectPatch>({
    flag_potenziale:    prospect.flag_potenziale ?? undefined,
    servizi_proponibili: prospect.servizi_proponibili ?? [],
    note:               prospect.note ?? '',
    stato:              prospect.stato,
    prossimo_followup:  prospect.prossimo_followup ?? '',
    lia_note:           prospect.lia_note ?? '',
    email_generic:      prospect.email_generic ?? '',
    email_nominative:   prospect.email_nominative ?? '',
  })

  async function save(patch: ProspectPatch) {
    setSaving(true)
    setSaved(false)
    try {
      const res = await fetch(`/api/prospects/${prospect.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error(await res.text())
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      alert('Errore salvataggio: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setSaving(false)
    }
  }

  function update<K extends keyof ProspectPatch>(key: K, value: ProspectPatch[K]) {
    setFields(prev => ({ ...prev, [key]: value }))
  }

  function toggleServizio(s: ServiziProponibili) {
    const current = (fields.servizi_proponibili ?? []) as ServiziProponibili[]
    const next = current.includes(s) ? current.filter(x => x !== s) : [...current, s]
    update('servizi_proponibili', next)
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Scheda Fabio</h3>
        <div className="flex items-center gap-2">
          {saved && <span className="text-xs text-green-600">Salvato</span>}
          <button
            onClick={() => save(fields)}
            disabled={saving}
            className="rounded-md bg-gray-900 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
          >
            {saving ? 'Salvataggio...' : 'Salva'}
          </button>
        </div>
      </div>

      {/* Stato */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Stato</label>
        <select
          value={fields.stato}
          onChange={e => update('stato', e.target.value as StatoProspect)}
          className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
        >
          {STATI.map(s => <option key={s} value={s}>{STATI_LABEL[s]}</option>)}
        </select>
      </div>

      {/* Flag potenziale */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Potenziale</label>
        <div className="flex gap-2">
          {(['basso', 'medio', 'alto'] as FlagPotenziale[]).map(f => (
            <button
              key={f}
              onClick={() => update('flag_potenziale', f)}
              className={`rounded-full px-3 py-0.5 text-xs font-medium border capitalize ${
                fields.flag_potenziale === f
                  ? f === 'alto' ? 'bg-green-600 text-white border-green-600'
                  : f === 'medio' ? 'bg-yellow-400 text-gray-900 border-yellow-400'
                  : 'bg-gray-300 text-gray-700 border-gray-300'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-500'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Servizi proponibili */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Servizi da proporre</label>
        <div className="flex flex-wrap gap-2">
          {SERVIZI.map(s => {
            const checked = (fields.servizi_proponibili as string[] ?? []).includes(s.value)
            return (
              <button
                key={s.value}
                onClick={() => toggleServizio(s.value)}
                className={`rounded-full px-2.5 py-0.5 text-xs border transition-colors ${
                  checked ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-500'
                }`}
              >
                {s.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Note */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Note (scoperture, visita, idee)</label>
        <textarea
          value={fields.note ?? ''}
          onChange={e => update('note', e.target.value)}
          rows={4}
          className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm resize-y"
          placeholder="Annotazioni libere: cosa hai visto di persona, idee di servizio, scoperture..."
        />
      </div>

      {/* Email (correzione manuale) */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Email generica</label>
          <input
            type="email"
            value={fields.email_generic ?? ''}
            onChange={e => update('email_generic', e.target.value)}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            placeholder="info@..."
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Email nominativa <span className="text-orange-500">(cautela)</span></label>
          <input
            type="email"
            value={fields.email_nominative ?? ''}
            onChange={e => update('email_nominative', e.target.value)}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            placeholder="mario.rossi@..."
          />
        </div>
      </div>

      {/* Follow-up */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Prossimo follow-up</label>
        <input
          type="date"
          value={fields.prossimo_followup ?? ''}
          onChange={e => update('prossimo_followup', e.target.value)}
          className="rounded border border-gray-300 px-2 py-1.5 text-sm"
        />
      </div>

      {/* LIA note */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Nota legittimo interesse (GDPR)
        </label>
        <input
          type="text"
          value={fields.lia_note ?? ''}
          onChange={e => update('lia_note', e.target.value)}
          className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          placeholder="Es: sito datato, operante nel settore X, rilevante per servizi digitali"
        />
      </div>
    </div>
  )
}
