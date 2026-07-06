import * as cheerio from 'cheerio'
import type { Signals } from '@/types/prospect'

const TIMEOUT_MS = 8000
// Percorsi di riserva se la discovery dei link del menu trova poco.
const FALLBACK_PATHS = ['/contatti', '/contact', '/chi-siamo']
const MAX_PAGES = 6 // home inclusa

// UA da browser reale: molti WAF (Cloudflare & co.) bloccano gli UA dichiaratamente bot,
// producendo falsi "sito non raggiungibile". Tool personale a basso volume.
const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept-Language': 'it-IT,it;q=0.9,en;q=0.6',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
}

type PageDoc = {
  $: cheerio.CheerioAPI
  finalUrl: string
  html: string
  fromContactLink: boolean
}

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

// Deoffusca email nascoste da entità HTML numeriche e concatenazioni di stringhe JS.
// Caso tipico: il plugin email-cloaking di Joomla scrive negli script
//   var addy = 'b&#97;cc&#105;' + '&#64;' + 'b&#97;cc&#105;m&#97;rm&#105;' + '&#46;' + '&#105;t';
// Copre anche le offuscazioni "umane": info [at] esempio [dot] it.
export function deobfuscateEmailText(html: string): string {
  return html
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/'\s*\+\s*'/g, '')
    .replace(/"\s*\+\s*"/g, '')
    .replace(/\s*[\[(]\s*(?:at|chiocciola)\s*[\])]\s*/gi, '@')
    .replace(/\s*[\[(]\s*(?:dot|punto)\s*[\])]\s*/gi, '.')
}

// Decodifica le email protette da Cloudflare (data-cfemail / /cdn-cgi/l/email-protection#hex):
// il primo byte è la chiave XOR dei successivi.
export function decodeCfEmail(hex: string): string | null {
  if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length < 4 || hex.length % 2 !== 0) return null
  const key = parseInt(hex.slice(0, 2), 16)
  let out = ''
  for (let i = 2; i < hex.length; i += 2) {
    out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key)
  }
  return out.includes('@') ? out : null
}

// --- Discovery dei link interni: naviga il menu del sito invece di indovinare i percorsi ---

const CONTACT_RE = /contatt|contact|dove[-_\s]?siamo|scriv[ie]|preventiv|richiedi|find[-_\s]?us/i
const ABOUT_RE = /chi[-_\s]?siamo|about|azienda|storia|company|la[-_\s]?nostra/i
const SKIP_EXT_RE = /\.(pdf|jpe?g|png|gif|webp|svg|zip|docx?|xlsx?|mp4)(\?|$)/i

export interface ScoredLink {
  url: string
  score: number
  isContact: boolean
}

// Estrae e scoralinka i link interni di una pagina: contatti > chi-siamo > resto.
export function scoreInternalLinks($: cheerio.CheerioAPI, pageUrl: string): ScoredLink[] {
  let base: URL
  try {
    base = new URL(pageUrl)
  } catch {
    return []
  }
  const seen = new Map<string, ScoredLink>()

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? ''
    if (!href || href.startsWith('#') || /^(mailto:|tel:|javascript:|whatsapp:)/i.test(href)) return
    let url: URL
    try {
      url = new URL(href, pageUrl)
    } catch {
      return
    }
    if (url.host !== base.host) return
    if (SKIP_EXT_RE.test(url.pathname)) return
    url.hash = ''
    const key = url.toString()
    if (key === base.toString()) return

    const haystack = `${url.pathname} ${$(el).text()} ${$(el).attr('title') ?? ''}`
    let score = 0
    let isContact = false
    if (CONTACT_RE.test(haystack)) { score += 10; isContact = true }
    if (ABOUT_RE.test(haystack)) score += 6
    if (score === 0) return

    const existing = seen.get(key)
    if (!existing || existing.score < score) seen.set(key, { url: key, score, isContact })
  })

  return [...seen.values()].sort((a, b) => b.score - a.score)
}

// --- Rilevamento lingue realistico: hreflang + pattern URL + bandierine + WPML/Polylang ---

const LANG_CODES = ['en', 'de', 'fr', 'es'] as const
const LANG_WORDS: Record<string, string> = {
  english: 'en', inglese: 'en',
  deutsch: 'de', german: 'de', tedesco: 'de',
  français: 'fr', francais: 'fr', french: 'fr', francese: 'fr',
  español: 'es', espanol: 'es', spanish: 'es', spagnolo: 'es',
  italiano: 'it', italian: 'it',
}

function normLang(raw: string): string | null {
  const code = raw.trim().toLowerCase().split(/[-_]/)[0]
  return /^[a-z]{2}$/.test(code) ? code : null
}

// Rileva le versioni linguistiche di una pagina come le implementano davvero i siti
// (bandierine /en/, ?lang=en, sottodomini, WPML/Polylang), non solo l'hreflang SEO.
export function detectLanguages($: cheerio.CheerioAPI, pageUrl: string): string[] {
  const found = new Set<string>()
  let base: URL | null = null
  try {
    base = new URL(pageUrl)
  } catch {
    // pageUrl non parsabile: salta i check basati sull'host
  }
  const baseHost = base?.host.replace(/^www\./, '') ?? ''

  // 1. hreflang (SEO) + <html lang>
  $('a[hreflang], link[hreflang]').each((_, el) => {
    const l = normLang($(el).attr('hreflang') ?? '')
    if (l) found.add(l)
  })
  const htmlLang = normLang($('html').attr('lang') ?? '')
  if (htmlLang) found.add(htmlLang)

  // 2. Link interni con pattern lingua (path /en/, ?lang=en, sottodominio en.)
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? ''
    if (!href || href.startsWith('#') || /^(mailto:|tel:|javascript:)/i.test(href)) return
    let url: URL
    try {
      url = new URL(href, pageUrl)
    } catch {
      return
    }
    const sameSite = baseHost !== '' && url.host.replace(/^www\./, '').endsWith(baseHost)

    if (sameSite) {
      const firstSeg = url.pathname.split('/').filter(Boolean)[0]?.toLowerCase()
      if (firstSeg && (LANG_CODES as readonly string[]).includes(firstSeg)) found.add(firstSeg)
      const qLang = normLang(url.searchParams.get('lang') ?? '')
      if (qLang && (LANG_CODES as readonly string[]).includes(qLang)) found.add(qLang)
      const sub = url.host.match(/^([a-z]{2})\./)?.[1]
      if (sub && (LANG_CODES as readonly string[]).includes(sub) && url.host !== base?.host) found.add(sub)
    }

    // 3. Testo/title del link: bandierine "EN", "English", "Deutsch"...
    const label = `${$(el).text()} ${$(el).attr('title') ?? ''}`.trim()
    if (/^(EN|DE|FR|ES|ENG)$/.test(label)) found.add(label.slice(0, 2).toLowerCase())
    const word = label.toLowerCase()
    if (LANG_WORDS[word]) found.add(LANG_WORDS[word])

    // 4. Marker WPML / Polylang nelle classi
    const cls = $(el).attr('class') ?? $(el).parent().attr('class') ?? ''
    const m = cls.match(/(?:lang-item|wpml-ls(?:-slug)?)-([a-z]{2})\b/)
    if (m) found.add(m[1])
  })

  return [...found]
}

// --- Fetch ---

async function fetchPage(url: string): Promise<{ html: string; finalUrl: string } | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: FETCH_HEADERS,
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

// Testo visibile (senza script/style): sotto soglia = sito renderizzato via JavaScript,
// i segnali di assenza non sono affermabili.
function visibleTextLength($: cheerio.CheerioAPI): number {
  const body = $('body').clone()
  body.find('script, style, noscript').remove()
  return body.text().replace(/\s+/g, ' ').trim().length
}

export async function fetchSiteSignals(websiteUrl: string): Promise<Partial<Signals>> {
  const baseUrl = normalizeWebsiteUrl(websiteUrl)
  if (!baseUrl) {
    return { has_website: false, fetch_error: 'URL non valida' }
  }

  // 1. Home: prova SEMPRE prima HTTPS (molti siti servono http 200 senza redirect pur
  //    avendo https), poi http. Rispetta l'eventuale path dichiarato da Places.
  const homePaths = [...new Set([baseUrl.pathname + baseUrl.search, '/'])]
  let home: { html: string; finalUrl: string } | null = null
  let https: boolean | null = null
  for (const scheme of ['https', 'http'] as const) {
    for (const path of homePaths) {
      home = await fetchPage(`${scheme}://${baseUrl.host}${path}`)
      if (home) {
        https = scheme === 'https'
        break
      }
    }
    if (home) break
  }

  if (!home) {
    return {
      has_website: true,
      https: null, // mai avuto risposta: non penalizziamo un sito solo lento/blindato
      fetch_error: 'Sito non raggiungibile',
      mobile_viewport: null,
    }
  }

  const home$ = cheerio.load(home.html)
  const docs: PageDoc[] = [{ $: home$, finalUrl: home.finalUrl, html: home.html, fromContactLink: false }]

  // 2. Discovery: segui i link reali del menu (contatti, chi-siamo...) invece di indovinare.
  const scored = scoreInternalLinks(home$, home.finalUrl)
  const toFetch: { url: string; isContact: boolean }[] = scored
    .slice(0, MAX_PAGES - 1)
    .map(s => ({ url: s.url, isContact: s.isContact }))

  // Fallback sui percorsi classici se la discovery ha trovato poco
  if (toFetch.length < 2) {
    const origin = new URL(home.finalUrl).origin
    for (const p of FALLBACK_PATHS) {
      if (toFetch.length >= MAX_PAGES - 1) break
      const u = origin + p
      if (!toFetch.some(t => t.url === u)) {
        toFetch.push({ url: u, isContact: p.includes('conta') })
      }
    }
  }

  const fetched = await Promise.all(toFetch.map(async t => ({ t, page: await fetchPage(t.url) })))
  for (const { t, page } of fetched) {
    if (!page) continue
    if (docs.some(d => d.finalUrl === page.finalUrl)) {
      // Pagina duplicata (redirect sulla stessa): conserva comunque l'indizio "contatti"
      if (t.isContact) {
        const dup = docs.find(d => d.finalUrl === page.finalUrl)
        if (dup) dup.fromContactLink = true
      }
      continue
    }
    docs.push({
      $: cheerio.load(page.html),
      finalUrl: page.finalUrl,
      html: page.html,
      fromContactLink: t.isContact || CONTACT_RE.test(new URL(page.finalUrl).pathname),
    })
  }

  const pages_fetched = docs.map(d => d.finalUrl)
  const allHtml = docs.map(d => d.html).join(' ')

  // 3. Home leggibile? Se il sito è client-rendered l'HTML è un guscio vuoto:
  //    i segnali di ASSENZA non sono affermabili (null, non false).
  const homeReadable = visibleTextLength(home$) >= 200
  const sawContactPage = docs.some(d => d.fromContactLink)

  // Viewport / responsive — escludi viewport con larghezza fissa "desktop" (es. width=1024)
  const viewport = home$('meta[name="viewport"]').attr('content') ?? null
  let mobile_viewport = !!viewport
  if (viewport) {
    const fixedWidth = viewport.match(/width\s*=\s*(\d+)/i)
    if (fixedWidth && Number(fixedWidth[1]) >= 1000) mobile_viewport = false
  }

  // Tech stack — meta generator + marker di asset specifici (no falsi positivi da keyword)
  const tech_stack: string[] = []
  const generator = home$('meta[name="generator"]').attr('content') ?? ''
  const htmlLower = home.html.toLowerCase()
  if (/wordpress/i.test(generator) || htmlLower.includes('/wp-content/') || htmlLower.includes('/wp-includes/')) {
    tech_stack.push('WordPress')
  }
  if (/wix\.com/i.test(generator) || htmlLower.includes('static.wixstatic.com') || htmlLower.includes('static.parastorage.com')) {
    tech_stack.push('Wix')
  }
  if (/squarespace/i.test(generator) || htmlLower.includes('static1.squarespace.com') || htmlLower.includes('squarespace.com/universal')) {
    tech_stack.push('Squarespace')
  }
  if (/shopify/i.test(generator) || htmlLower.includes('cdn.shopify.com') || htmlLower.includes('myshopify.com')) {
    tech_stack.push('Shopify')
  }
  if (/joomla/i.test(generator) || htmlLower.includes('/media/jui/') || htmlLower.includes('option=com_')) {
    tech_stack.push('Joomla')
  }
  if (/\.swf(["'?\s]|$)/i.test(home.html)) tech_stack.push('Flash (residui!)')

  // Lingue: unione su tutte le pagine, con euristiche realistiche.
  // Se la home non è leggibile, il dato non è affermabile → undefined (omesso).
  let lang_versions: string[] | undefined
  if (homeReadable) {
    const langSet = new Set<string>()
    for (const d of docs) for (const l of detectLanguages(d.$, d.finalUrl)) langSet.add(l)
    if (langSet.size === 0) langSet.add('it') // nessun indizio multilingua con menu visibile = solo italiano
    lang_versions = [...langSet]
  }

  // Form / booking / e-commerce: cercati su TUTTE le pagine.
  // true = trovato; false = assenza affermabile (visto abbastanza); null = non verificabile.
  const formFound = docs.some(d =>
    d.$('form').length > 0 || /contattaci|contact us|invia messaggio|wpcf7|wpforms/i.test(d.html))
  const has_contact_form = formFound ? true
    : (sawContactPage || docs.length >= 3) ? false
    : null

  const bookingFound = /prenota|booking|reservation|calendly|prenotazione/i.test(allHtml)
  const has_booking = bookingFound ? true : homeReadable ? false : null

  const ecommerceFound = /carrello|woocommerce|shopify|add to cart|aggiungi al carrello|checkout/i.test(allHtml)
  const has_ecommerce = ecommerceFound ? true : homeReadable ? false : null

  // SEO base (home): argomenti credibili di scopertura. null se home non leggibile.
  const seo_title = homeReadable ? (home$('title').first().text().trim().length >= 4) : null
  const seo_description = homeReadable
    ? ((home$('meta[name="description"]').attr('content') ?? '').trim().length >= 30)
    : null
  const seo_h1 = homeReadable ? home$('h1').length > 0 : null

  // Social links: su tutte le pagine
  const social_links: string[] = []
  for (const d of docs) {
    d.$('a[href]').each((_, el) => {
      const href = d.$(el).attr('href') ?? ''
      if (/facebook\.com|fb\.com/.test(href) && !social_links.some(s => /facebook|fb\./.test(s))) {
        social_links.push(href)
      }
      if (/instagram\.com/.test(href) && !social_links.some(s => /instagram/.test(s))) {
        social_links.push(href)
      }
      if (/linkedin\.com/.test(href) && !social_links.some(s => /linkedin/.test(s))) {
        social_links.push(href)
      }
    })
  }

  // Email: mailto su tutte le pagine + decodifica Cloudflare + regex deoffuscata
  const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g
  const emailSet = new Set<string>()

  for (const d of docs) {
    d.$('a[href^="mailto:"]').each((_, el) => {
      const addr = (d.$(el).attr('href') ?? '').replace(/^mailto:/i, '').split('?')[0].trim()
      if (addr && emailRegex.test(addr)) emailSet.add(addr.toLowerCase())
      emailRegex.lastIndex = 0
    })
    // Cloudflare email protection: attributo data-cfemail e link /cdn-cgi/l/email-protection#hex
    d.$('[data-cfemail]').each((_, el) => {
      const decoded = decodeCfEmail(d.$(el).attr('data-cfemail') ?? '')
      if (decoded) emailSet.add(decoded.toLowerCase())
    })
  }
  for (const m of allHtml.match(/\/cdn-cgi\/l\/email-protection#([0-9a-fA-F]+)/g) ?? []) {
    const decoded = decodeCfEmail(m.split('#')[1])
    if (decoded) emailSet.add(decoded.toLowerCase())
  }

  // Email offuscate: entità HTML, concatenazioni JS (Joomla cloak), [at]/[dot]
  const deobfuscated = deobfuscateEmailText(allHtml)
  for (const e of deobfuscated.match(emailRegex) ?? []) emailSet.add(e.toLowerCase())

  const EMAIL_JUNK = /\.(png|jpe?g|gif|webp|svg)$|@(example\.|sentry\.io|sentry-next\.|wixpress\.com|domain\.com|email\.com|yourdomain\.)/i
  const emails_found = [...emailSet].filter(e => !EMAIL_JUNK.test(e))

  // Telefoni: tel: su tutte le pagine + fallback testuale, sempre validati.
  // Dedup per cifre (stesso numero scritto in formati diversi conta una volta).
  const phoneKey = (raw: string) => raw.replace(/\D/g, '').replace(/^(?:0039|39)(?=\d{9,})/, '')
  const phoneMap = new Map<string, string>()
  for (const d of docs) {
    d.$('a[href^="tel:"]').each((_, el) => {
      const raw = (d.$(el).attr('href') ?? '').replace(/^tel:/, '').trim()
      if (raw && isPlausibleItalianPhone(raw) && !phoneMap.has(phoneKey(raw))) {
        phoneMap.set(phoneKey(raw), raw)
      }
    })
  }
  const phoneRegex = /(?:\+39[\s.\-]?)?(?:0\d{1,3}|3\d{2})[\s.\-]?\d{5,8}/g
  const VAT_CONTEXT_RE = /(?:p\.?\s*iva|partita\s+iva|c\.?\s*f\.?|cod(?:ice)?\s*fisc\w*|vat|rea)\W{0,10}$/i
  let pm: RegExpExecArray | null
  while ((pm = phoneRegex.exec(allHtml)) !== null) {
    const m = pm[0]
    // Escludi P.IVA / codici fiscali: 11 cifre che iniziano per 0, come i fissi
    if (VAT_CONTEXT_RE.test(allHtml.slice(Math.max(0, pm.index - 30), pm.index))) continue
    if (isPlausibleItalianPhone(m) && !phoneMap.has(phoneKey(m))) {
      phoneMap.set(phoneKey(m), m.trim())
    }
  }
  const phones_found = [...phoneMap.values()].slice(0, 5)

  // Copyright year (per staleness): footer della home, poi tutto il testo
  const footerText = home$('footer').text() + home$('[class*="footer"]').text()
  const copyright_year = extractYear(footerText) ?? extractYear(allHtml)

  // Data contenuto più recente — stesso cap di extractYear (ignora anni futuri)
  const latestYear = extractYear(allHtml)
  const last_content_date = latestYear ? String(latestYear) : null

  // Stima pagine: link interni unici (per path) aggregati su tutte le pagine
  const internalPaths = new Set<string>()
  for (const d of docs) {
    let dBase: URL
    try {
      dBase = new URL(d.finalUrl)
    } catch {
      continue
    }
    d.$('a[href]').each((_, el) => {
      const href = d.$(el).attr('href') ?? ''
      if (!href || href.startsWith('#') || /^(mailto:|tel:|javascript:)/i.test(href)) return
      try {
        const u = new URL(href, d.finalUrl)
        if (u.host === dBase.host && u.pathname.length > 1) internalPaths.add(u.pathname)
      } catch { /* href malformato */ }
    })
  }
  const page_count_estimate = internalPaths.size

  return {
    has_website:       true,
    https,
    mobile_viewport,
    copyright_year,
    tech_stack,
    ...(lang_versions !== undefined ? { lang_versions } : {}),
    has_contact_form,
    has_booking,
    has_ecommerce,
    seo_title,
    seo_description,
    seo_h1,
    social_links,
    page_count_estimate,
    last_content_date,
    emails_found,
    phones_found,
    pages_fetched,
    fetch_error:       homeReadable ? null : 'Sito renderizzato via JavaScript: analisi parziale',
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
        headers: FETCH_HEADERS,
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
