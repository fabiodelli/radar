import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Radar — Prospecting Versilia',
  description: 'Gestionale di prospecting per outreach Versilia',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="min-h-full bg-gray-50 text-gray-900 antialiased">
        <nav className="border-b border-gray-200 bg-white px-6 py-3 flex items-center gap-6">
          <span className="font-semibold text-gray-900 tracking-tight">Radar</span>
          <a href="/" className="text-sm text-gray-600 hover:text-gray-900">Lista</a>
          <a href="/screening" className="text-sm text-gray-600 hover:text-gray-900">Screening</a>
        </nav>
        <main className="max-w-screen-xl mx-auto px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  )
}
