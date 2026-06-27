import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getProspect } from '@/lib/db/prospects'
import { ProspectCard } from '@/components/ProspectCard'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ProspectPage({ params }: PageProps) {
  const { id } = await params
  const prospect = await getProspect(id)

  if (!prospect) notFound()

  return (
    <div>
      <div className="mb-4">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-900">← Lista prospect</Link>
      </div>
      <ProspectCard prospect={prospect} />
    </div>
  )
}
