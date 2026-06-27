import type { StatoProspect } from '@/types/prospect'

const STATO_CONFIG: Record<StatoProspect, { label: string; className: string }> = {
  nuovo:          { label: 'Nuovo',          className: 'bg-blue-100 text-blue-800' },
  da_vagliare:    { label: 'Da vagliare',    className: 'bg-yellow-100 text-yellow-800' },
  vagliato:       { label: 'Vagliato',       className: 'bg-purple-100 text-purple-800' },
  da_contattare:  { label: 'Da contattare',  className: 'bg-orange-100 text-orange-800' },
  contattato:     { label: 'Contattato',     className: 'bg-teal-100 text-teal-800' },
  follow_up:      { label: 'Follow-up',      className: 'bg-indigo-100 text-indigo-800' },
  in_trattativa:  { label: 'In trattativa',  className: 'bg-green-100 text-green-800' },
  cliente:        { label: 'Cliente',        className: 'bg-green-700 text-white' },
  scartato:       { label: 'Scartato',       className: 'bg-gray-200 text-gray-500' },
  suppression:    { label: 'Suppression',    className: 'bg-red-100 text-red-700' },
}

export function StatoBadge({ stato }: { stato: StatoProspect }) {
  const { label, className } = STATO_CONFIG[stato] ?? { label: stato, className: 'bg-gray-100 text-gray-700' }
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}
