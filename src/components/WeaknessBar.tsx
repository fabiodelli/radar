const MAX_SCORE = 12

export function WeaknessBar({ score }: { score: number }) {
  const pct = Math.min((score / MAX_SCORE) * 100, 100)
  const color =
    score >= 7 ? 'bg-red-500' :
    score >= 4 ? 'bg-orange-400' :
    'bg-yellow-300'

  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-20 rounded-full bg-gray-200 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold text-gray-700">{score}</span>
    </div>
  )
}
