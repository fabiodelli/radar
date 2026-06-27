import { NextRequest, NextResponse } from 'next/server'
import type { Prospect } from '@/types/prospect'
import { buildMiniAudit } from '@/lib/handoff'

// Genera il mini-audit deterministicamente dai signals (no LLM, rapido e gratuito)
export async function POST(req: NextRequest) {
  const { prospect }: { prospect: Prospect } = await req.json()

  const audit = buildMiniAudit(prospect)
  return NextResponse.json({ text: audit })
}
