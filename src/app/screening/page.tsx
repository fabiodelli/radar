import { ScreeningRunner } from '@/components/ScreeningRunner'
import { getScreeningRuns } from '@/lib/db/screening-runs'

export default async function ScreeningPage() {
  let runs: Awaited<ReturnType<typeof getScreeningRuns>> = []
  try {
    runs = await getScreeningRuns(10)
  } catch {
    // DB non configurato ancora
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Screening</h1>

      <ScreeningRunner />

      {/* Storico run */}
      {runs.length > 0 && (
        <div className="mt-8 max-w-3xl">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Storico screening</h2>
          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Data</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Query</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Trovati</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Nuovi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {runs.map(r => (
                  <tr key={r.id}>
                    <td className="px-4 py-2 text-gray-600">
                      {new Date(r.eseguita_at).toLocaleDateString('it-IT')}
                    </td>
                    <td className="px-4 py-2 text-gray-800 text-xs">
                      {(r.query.categorie ?? []).join(', ')} · {(r.query.comuni ?? []).join(', ')}
                    </td>
                    <td className="px-4 py-2 text-gray-600">{r.n_trovati}</td>
                    <td className="px-4 py-2 font-semibold text-green-700">{r.n_nuovi}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
