import { NextRequest, NextResponse } from 'next/server'

const ACCESS_PASSWORD = process.env.RADAR_PASSWORD ?? 'radar2024'

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Bypass: pagina login, API pubbliche, e asset statici
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next()
  }

  // Verifica cookie di sessione semplice
  const session = req.cookies.get('radar_session')
  if (session?.value === ACCESS_PASSWORD) {
    return NextResponse.next()
  }

  // Redirect al login
  const loginUrl = req.nextUrl.clone()
  loginUrl.pathname = '/login'
  loginUrl.searchParams.set('from', pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
