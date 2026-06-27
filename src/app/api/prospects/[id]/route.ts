import { NextRequest, NextResponse } from 'next/server'
import { getProspect, updateProspect } from '@/lib/db/prospects'
import type { ProspectPatch } from '@/types/prospect'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const prospect = await getProspect(id)
  if (!prospect) return NextResponse.json({ error: 'Non trovato' }, { status: 404 })
  return NextResponse.json(prospect)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const patch: ProspectPatch = await req.json()

  try {
    const updated = await updateProspect(id, patch)
    return NextResponse.json(updated)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Errore update' }, { status: 500 })
  }
}
