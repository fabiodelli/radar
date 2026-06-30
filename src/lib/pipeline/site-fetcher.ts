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

export function extractYear(text: string): number | null {
  const m = text.match(/\b(19|20)\d{2}\b/g)
  if (!m) return null
  // Ignora anni futuri (date errate, script, JSON-LD): tieni solo <= anno corrente.
  const currentYear = new Date().getFullYear()
  const valid = m.map(Number).filter(y => y >= 1990 && y <= currentYear)
  if (valid.length === 0) return null
  return Math.max(...valid)
}

// Valida un numero come telefono italiano plausibile, scartando spazzatura
// (segnaposto 000000001, ID/codici a 12+ cifre, sequenze di sole cifre uguali).
export function isPlausibleItalianPhone(raw: string): boolean {
  const digits = raw.replace(/\D/g, '').replace(/^(?:0039|39)(?=\d{9,})/, '')
  if (!/^[03]/.test(digits)) return false          // fisso (0) o mobile (3)
  if (digits.length < 9 || digits.length > 11) return false
  if (digits.startsWith('00')) return false         // i numeri italiani non iniziano per 00
  if (/^(\d)\1+$/.test(digits) || /^0+\d?$/.test(digits)) return false // tutte uguali / quasi-zero
  return true
}

// Normalizza la URL che arriva da Google Places: spesso è senza schema (www.esempio.it)
// o dichiarata http:// anche se il sito serve https. Default https:// se manca lo schema.
export function normalizeWebsiteUrl(raw: string): URL | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    return new URL(withScheme)
  } catch {
    return null
  }
}

// Fetch di una pagina seguendo i redirect. Ritorna anche la URL finale (res.url),
// indispensabile per sapere se il sito serve davvero HTTPS dopo l'eventuale redirect.
async function fetchPage(url: string): Promise<{ html: string; finalUrl: string } | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RadarBot/1.0)' },
      redirect: 'follow',
    })
    if (!res.ok) return null
    const ct = res.headers.get('content-type') ?? ''
    if (!ct.includes('text/html')) return null
    return { html: await res.text(), finalUrl: res.url || url }
  } catch {
    return null
  }
}

// Prova a recuperare le pagine candidate da un dato origin (in parallelo).
// Ritorna gli HTML utili e la URL finale della prima risposta valida (per il check HTTPS).
async function fetchPagesFrom(origin: string): Promise<{ htmlPages: string[]; finalUrl: string | null }> {
  const results = await Promise.all(PAGES_TO_TRY.map(path => fetchPage(origin + path)))
  const htmlPages: string[] = []
  let finalUrl: string | null = null
  for (const r of results) {
    if (!r) continue
    if (!finalUrl) finalUrl = r.finalUrl
    htmlPages.push(r.html)
    if (htmlPages.length >= 3) break
  }
  return { htmlPages, finalUrl }
}

export async function fetchSiteSignals(websiteUrl: string): Promise<Partial<Signals>> {
  const baseUrl = normalizeWebsiteUrl(websiteUrl)
  if (!baseUrl) {
    return { has_website: false, fetch_error: 'URL non valida' }
  }

  // Prova SEMPRE prima HTTPS, ignorando lo schema dichiarato da Google Places:
  // molti siti servono http 200 senza redirect pur avendo https disponibile.
  // Solo se https non risponde affatto si ricade su http (siti solo-http, rari).
  let https: boolean | null
  let htmlPages = (await fetchPagesFrom(`https://${baseUrl.host}`)).htmlPages
  if (htmlPages.length > 0) {
    https = true
  } else {
    htmlPages = (await fetchPagesFrom(`http://${baseUrl.host}`)).htmlPages
    https = htmlPages.length > 0 ? false : null
  }

  if (htmlPages.length === 0) {
    return {
      has_website: true,
      https, // null se non abbiamo mai avuto una risposta: non penalizziamo un sito solo lento
      fetch_error: 'Sito non raggiungibile',
      mobile_viewport: null,
    }
  }

  const mainHtml = htmlPages[0]
  const $ = cheerio.load(mainHtml)

  // Viewport / responsive — escludi viewport con larghezza fissa "desktop" (es. width=1024)
  const viewport = $('meta[name="viewport"]').attr('content') ?? null
  let mobile_viewport = !!viewport
  if (viewport) {
    const fixedWidth = viewport.match(/width\s*=\s*(\d+)/i)
    if (fixedWidth && Number(fixedWidth[1]) >= 1000) mobile_viewport = false
  }

  // Tech stack — rileva da meta generator + marker di asset specifici (path/CDN reali),
  // non dalla semplice parola nell'HTML (evita falsi positivi).
  const tech_stack: string[] = []
  const generator = $('meta[name="generator"]').attr('content') ?? ''
  const html = mainHtml.toLowerCase()
  if (/wordpress/i.test(generator) || html.includes('/wp-content/') || html.includes('/wp-includes/')) {
    tech_stack.push('WordPress')
  }
  if (/wix\.com/i.test(generator) || html.includes('static.wixstatic.com') || html.includes('static.parastorage.com')) {
    tech_stack.push('Wix')
  }
  if (/squarespace/i.test(generator) || html.includes('static1.squarespace.com') || html.includes('squarespace.com/universal')) {
    tech_stack.push('Squarespace')
  }
  if (/shopify/i.test(generator) || html.includes('cdn.shopify.com') || html.includes('myshopify.com')) {
    tech_stack.push('Shopify')
  }
  if (/joomla/i.test(generator) || html.includes('/media/jui/') || html.includes('option=com_')) {
    tech_stack.push('Joomla')
  }
  if (/\.swf(["'?\s]|$)/i.test(mainHtml)) tech_stack.push('Flash (residui!)')

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

  // 1. Link mailto: (fonte più affidabile)
  const emailSet = new Set<string>()
  $('a[href^="mailto:"]').each((_, el) => {
    const addr = ($(el).attr('href') ?? '').replace(/^mailto:/i, '').split('?')[0].trim()
    if (addr && emailRegex.test(addr)) emailSet.add(addr.toLowerCase())
    emailRegex.lastIndex = 0
  })

  // 2. Email offuscate: normalizza i pattern comuni prima del match (nome [at] dominio [dot] it, &#64;)
  const deobfuscated = allText
    .replace(/&#64;|&#x40;/gi, '@')
    .replace(/\s*[\[(]\s*(?:at|chiocciola)\s*[\])]\s*/gi, '@')
    .replace(/\s*[\[(]\s*(?:dot|punto)\s*[\])]\s*/gi, '.')

  // 3. Regex su testo deoffuscato
  for (const e of deobfuscated.match(emailRegex) ?? []) emailSet.add(e.toLowerCase())

  const emails_found = [...emailSet]
    .filter(e => !e.endsWith('.png') && !e.endsWith('.jpg') && !e.endsWith('.gif'))

  // Phone numbers — link tel: e fallback testuale, entrambi validati (anche i tel: possono
  // contenere segnaposto tipo 000000001).
  const phoneSet = new Set<string>()
  $('a[href^="tel:"]').each((_, el) => {
    const raw = ($(el).attr('href') ?? '').replace(/^tel:/, '').trim()
    if (raw && isPlausibleItalianPhone(raw)) phoneSet.add(raw)
  })
  const phoneRegex = /(?:\+39[\s.\-]?)?(?:0\d{1,3}|3\d{2})[\s.\-]?\d{5,8}/g
  for (const m of allText.match(phoneRegex) ?? []) {
    if (isPlausibleItalianPhone(m)) phoneSet.add(m.trim())
  }
  const phones_found = [...phoneSet].slice(0, 5)

  // Copyright year (per staleness)
  const footerText = $('footer').text() + $('[class*="footer"]').text()
  const copyright_year = extractYear(footerText) ?? extractYear(allText)

  // Data contenuto più recente — stesso cap di extractYear (ignora anni futuri tipo 2099/2048)
  const latestYear = extractYear(allText)
  const last_content_date = latestYear ? String(latestYear) : null

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
