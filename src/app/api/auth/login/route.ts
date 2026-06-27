import { NextRequest, NextResponse } from 'next/server'

const ACCESS_PASSWORD = process.env.RADAR_PASSWORD ?? 'radar2024'

export async function POST(req: NextRequest) {
  const { password } = await req.json()

  if (password !== ACCESS_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set('radar_session', ACCESS_PASSWORD, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 30, // 30 giorni
    path: '/',
  })
  return res
}
