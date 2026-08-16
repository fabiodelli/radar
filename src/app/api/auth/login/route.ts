import { NextRequest, NextResponse } from 'next/server'
import { sessionToken } from '@/lib/auth'

// Nessun default: senza RADAR_PASSWORD configurata il login e' impossibile (fail closed)
const ACCESS_PASSWORD = process.env.RADAR_PASSWORD

export async function POST(req: NextRequest) {
  const { password } = await req.json()

  if (!ACCESS_PASSWORD) {
    return NextResponse.json({ error: 'RADAR_PASSWORD non configurata' }, { status: 500 })
  }

  if (password !== ACCESS_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set('radar_session', await sessionToken(ACCESS_PASSWORD), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 30, // 30 giorni
    path: '/',
  })
  return res
}
