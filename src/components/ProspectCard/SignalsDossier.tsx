import type { Signals } from '@/types/prospect'

function Row({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <tr className={highlight ? 'bg-red-50' : ''}>
      <td className="py-1 pr-4 text-xs text-gray-500 whitespace-nowrap">{label}</td>
      <td className="py-1 text-sm text-gray-900">{value}</td>
    </tr>
  )
}

function Bool({ v }: { v: boolean | null | undefined }) {
  if (v === null || v === undefined) return <span className="text-gray-400">N/D</span>
  return v
    ? <span className="text-green-700 font-medium">Si</span>
    : <span className="text-red-600 font-medium">No</span>
}

interface SignalsDossierProps {
  signals: Partial<Signals>
  websiteUrl?: string | null
}

export function SignalsDossier({ signals: s, websiteUrl }: SignalsDossierProps) {
  const year = s.copyright_year ?? (s.last_content_date ? parseInt(s.last_content_date) : null)
  const isOld = year ? (new Date().getFullYear() - year) >= 3 : false

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-2">
        <h3 className="text-sm font-semibold text-gray-700">Dossier tecnico</h3>
      </div>
      <div className="px-4 py-3">
        <table className="w-full">
          <tbody className="divide-y divide-gray-50">
            {!s.has_website ? (
              <Row label="Sito web" value={<span className="font-semibold text-red-700">Nessun sito trovato</span>} highlight />
            ) : (
              <>
                <Row label="URL" value={
                  websiteUrl
                    ? <a href={websiteUrl} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">{websiteUrl}</a>
                    : '—'
                } />
                <Row label="HTTPS" value={<Bool v={s.https} />} highlight={s.https === false} />
                <Row label="Mobile-friendly (viewport)" value={<Bool v={s.mobile_viewport} />} highlight={s.mobile_viewport === false} />
                <Row label="Anno ultimo contenuto" value={year ? <span className={isOld ? 'text-orange-600 font-semibold' : ''}>{year}{isOld ? ' (datato)' : ''}</span> : '—'} highlight={isOld} />
                <Row label="Tech stack" value={s.tech_stack?.length ? s.tech_stack.join(', ') : '—'} />
                <Row label="Lingue" value={s.lang_versions?.length ? s.lang_versions.join(', ') : '—'} />
                <Row label="Performance mobile (PSI)" value={
                  s.psi_performance !== null && s.psi_performance !== undefined
                    ? <span className={s.psi_performance < 50 ? 'text-red-600 font-semibold' : s.psi_performance < 80 ? 'text-yellow-600' : 'text-green-700'}>
                        {s.psi_performance}/100
                      </span>
                    : '—'
                } highlight={(s.psi_performance ?? 100) < 50} />
                <Row label="SEO (PSI)" value={s.psi_seo !== null && s.psi_seo !== undefined ? `${s.psi_seo}/100` : '—'} />
                <Row label="Modulo contatto" value={<Bool v={s.has_contact_form} />} />
                <Row label="Sistema prenotazione" value={<Bool v={s.has_booking} />} />
                <Row label="E-commerce" value={<Bool v={s.has_ecommerce} />} />
                <Row label="Link social" value={s.social_links?.length ? s.social_links.map((l, i) => (
                  <a key={i} href={l} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs mr-2">{l.replace(/https?:\/\/(www\.)?/, '').split('/')[0]}</a>
                )) : '—'} />
                <Row label="Pagine interne (stima)" value={s.page_count_estimate ?? '—'} />
                <Row label="Email trovate sul sito" value={s.emails_found?.length ? s.emails_found.join(', ') : '—'} />
                <Row label="Telefoni trovati" value={s.phones_found?.length ? s.phones_found.join(', ') : '—'} />
              </>
            )}
            {s.fetch_error && (
              <Row label="Errore fetch" value={<span className="text-orange-600 text-xs">{s.fetch_error}</span>} />
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
