import * as cheerio from 'cheerio'
import type { Signals } from '@/types/prospect'

const TIMEOUT_MS = 8000
const PAGES_TO_TRY = ['/', '/contatti', '/chi-siamo', '/contact', '/about']

function isNominativeEmail(email: string): boolean {
  const local = email.split('@')[0].toLowerCase()
  const genericPrefixes = [
    'info', 'contatti', 'contact', 'amministrazione', 'admin',
    'reception', 'segreteria', 'prenotazioni', 'booking', 'commerciale',
    'vendite', 'marketing', 'hello', 'ciao', 'support', 'supporto', 'web',
  ]
  return !genericPrefixes.some(p => local === p || local.startsWith(p + '.') || local.startsWith(p + '_'))
}

function extractYear(text: string): number | null {
  const m = text.match(/\b(19|20)\d{2}\b/g)
  if (!m) return null
  return Math.max(...m.map(Number))
}

function resolveUrl(url: string, base: string): string {
  try {
    return new URL(url, base).toString()
  } catch {
    return url
  }
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RadarBot/1.0)' },
      redirect: 'follow',
    })
    if (!res.ok) return null
    const ct = res.headers.get('content-type') ?? ''
    if (!ct.includes('text/html')) return null
    return await res.text()
  } catch {
    return null
  }
}

export async function fetchSiteSignals(websiteUrl: string): Promise<Partial<Signals>> {
  let baseUrl: URL
  try {
    baseUrl = new URL(websiteUrl)
  } catch {
    return { has_website: false, fetch_error: 'URL non valida' }
  }

  const https = baseUrl.protocol === 'https:'
  const htmlPages: string[] = []

  for (const path of PAGES_TO_TRY) {
    const html = await fetchPage(baseUrl.origin + path)
    if (html) htmlPages.push(html)
    if (htmlPages.length >= 3) break
  }

  if (htmlPages.length === 0) {
    return {
      has_website: true,
      https,
      fetch_error: 'Sito non raggiungibile',
      mobile_viewport: null,
    }
  }

  const mainHtml = htmlPages[0]
  const $ = cheerio.load(mainHtml)

  // Viewport / responsive
  const viewport = $('meta[name="viewport"]').attr('content') ?? null
  const mobile_viewport = !!viewport

  // Tech stack
  const tech_stack: string[] = []
  const generator = $('meta[name="generator"]').attr('content') ?? ''
  if (/wordpress/i.test(generator)) tech_stack.push('WordPress')
  if (/wix/i.test(mainHtml)) tech_stack.push('Wix')
  if (/squarespace/i.test(mainHtml)) tech_stack.push('Squarespace')
  if (/shopify/i.test(mainHtml)) tech_stack.push('Shopify')
  if (/joomla/i.test(generator)) tech_stack.push('Joomla')
  if (/<object.*?swf|\.swf/i.test(mainHtml)) tech_stack.push('Flash (residui!)')

  // Lingue
  const lang_versions: string[] = []
  $('a[hreflang], link[hreflang]').each((_, el) => {
    const lang = $(el).attr('hreflang')
    if (lang && !lang_versions.includes(lang)) lang_versions.push(lang)
  })
  const htmlLang = $('html').attr('lang') ?? ''
  if (htmlLang && !lang_versions.includes(htmlLang)) lang_versions.unshift(htmlLang)

  // Contact form
  const has_contact_form = $('form').length > 0 ||
    /contattaci|contact us|invia messaggio/i.test(mainHtml)

  // Booking
  const has_booking = /prenota|booking|reservation|calendly|prenotazione/i.test(mainHtml)

  // E-commerce
  const has_ecommerce = /cart|carrello|shop|woocommerce|shopify|acquista|e-commerce/i.test(mainHtml)

  // Social links
  const social_links: string[] = []
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? ''
    if (/facebook\.com|fb\.com/.test(href) && !social_links.some(s => /facebook/.test(s))) {
      social_links.push(href)
    }
    if (/instagram\.com/.test(href) && !social_links.some(s => /instagram/.test(s))) {
      social_links.push(href)
    }
    if (/linkedin\.com/.test(href) && !social_links.some(s => /linkedin/.test(s))) {
      social_links.push(href)
    }
  })

  // Email addresses
  const allText = htmlPages.join(' ')
  const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g
  const emails_found = [...new Set(allText.match(emailRegex) ?? [])]
    .filter(e => !e.endsWith('.png') && !e.endsWith('.jpg'))

  // Phone numbers — preferisci i link tel: (affidabili), poi un fallback ristretto sul testo
  const phoneSet = new Set<string>()
  $('a[href^="tel:"]').each((_, el) => {
    const raw = ($(el).attr('href') ?? '').replace(/^tel:/, '').trim()
    if (raw) phoneSet.add(raw)
  })
  // Fallback testuale: numeri italiani plausibili (prefisso +39 o 0/3 iniziale, 8-11 cifre)
  const phoneRegex = /(?:\+39[\s.\-]?)?(?:0\d{1,3}|3\d{2})[\s.\-]?\d{5,8}/g
  for (const m of allText.match(phoneRegex) ?? []) {
    const digits = m.replace(/\D/g, '')
    if (digits.length >= 8 && digits.length <= 13) phoneSet.add(m.trim())
  }
  const phones_found = [...phoneSet].slice(0, 5)

  // Copyright year (per staleness)
  const footerText = $('footer').text() + $('[class*="footer"]').text()
  const copyright_year = extractYear(footerText) ?? extractYear(allText)

  // Data contenuto più recente
  const datePatterns = [
    ...(allText.match(/\b(20\d{2})\b/g) ?? []),
  ]
  const last_content_date = datePatterns.length > 0
    ? String(Math.max(...datePatterns.map(Number)))
    : null

  // Stima pagine (conteggio link interni unici)
  const internalLinks = new Set<string>()
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? ''
    if (href.startsWith('/') && href.length > 1 && !href.includes('#')) {
      internalLinks.add(href.split('?')[0])
    }
  })
  const page_count_estimate = internalLinks.size

  return {
    has_website:       true,
    https,
    mobile_viewport,
    copyright_year,
    tech_stack,
    lang_versions,
    has_contact_form,
    has_booking,
    has_ecommerce,
    social_links,
    page_count_estimate,
    last_content_date,
    emails_found,
    phones_found,
    fetch_error:       null,
    social_only:       false,
    social_fb:         null,
    social_ig:         null,
    directory_listing: null,
  }
}

// Classifica email trovate in generic vs nominative
export function classifyEmails(emails: string[]): {
  email_generic: string | null
  email_nominative: string | null
} {
  const generic = emails.find(e => !isNominativeEmail(e))
  const nominative = emails.find(e => isNominativeEmail(e))
  return {
    email_generic:    generic ?? null,
    email_nominative: nominative ?? null,
  }
}

// Cerca presenza social quando non c'è sito (best-effort, fallback silenzioso).
// Usa la ricerca HTML di DuckDuckGo per trovare una pagina FB/IG dell'attività.
export async function findSocialPresence(
  businessName: string,
  comune?: string
): Promise<{
  social_only: boolean
  social_fb: string | null
  social_ig: string | null
}> {
  const empty = { social_only: false, social_fb: null, social_ig: null }
  const q = `${businessName} ${comune ?? ''}`.trim()
  if (!q) return empty

  async function search(domain: string): Promise<string | null> {
    try {
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`site:${domain} ${q}`)}`
      const res = await fetch(url, {
        signal: AbortSignal.timeout(6000),
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RadarBot/1.0)' },
      })
      if (!res.ok) return null
      const html = await res.text()
      const $ = cheerio.load(html)
      let found: string | null = null
      $('a.result__a, a[href]').each((_, el) => {
        if (found) return
        let href = $(el).attr('href') ?? ''
        // DuckDuckGo incapsula i link: estrai uddg= se presente
        const m = href.match(/[?&]uddg=([^&]+)/)
        if (m) href = decodeURIComponent(m[1])
        if (href.includes(domain)) found = href
      })
      return found
    } catch {
      return null
    }
  }

  const [fb, ig] = await Promise.all([search('facebook.com'), search('instagram.com')])
  const hasSocial = !!(fb || ig)
  return {
    social_only: hasSocial, // chiamata solo quando non c'è sito → social = unica presenza
    social_fb:   fb,
    social_ig:   ig,
  }
}
