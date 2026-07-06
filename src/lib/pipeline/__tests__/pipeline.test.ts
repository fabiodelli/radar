import { describe, it, expect } from 'vitest'
import * as cheerio from 'cheerio'
import {
  normalizeWebsiteUrl, extractYear, isPlausibleItalianPhone, classifyEmails,
  decodeCfEmail, detectLanguages, scoreInternalLinks, deobfuscateEmailText,
} from '../site-fetcher'
import { computeWeaknessScore, computeWebsiteStatus } from '../scorer'
import { generateAngolo } from '../recommender'

describe('normalizeWebsiteUrl', () => {
  it('antepone https:// se manca lo schema', () => {
    expect(normalizeWebsiteUrl('www.esempio.it')?.origin).toBe('https://www.esempio.it')
  })
  it('mantiene lo schema esistente', () => {
    expect(normalizeWebsiteUrl('http://esempio.it')?.protocol).toBe('http:')
  })
  it('ritorna null su input vuoto o invalido', () => {
    expect(normalizeWebsiteUrl('   ')).toBeNull()
    expect(normalizeWebsiteUrl('http://')).toBeNull()
  })
})

describe('extractYear', () => {
  it('prende l\'anno più recente valido', () => {
    expect(extractYear('© 2018 - aggiornato 2021')).toBe(2021)
  })
  it('ignora anni futuri (date errate, script)', () => {
    expect(extractYear('copyright 2099 e 2048')).toBeNull()
    expect(extractYear('nel 2020 e poi 2099')).toBe(2020)
  })
  it('ritorna null se non ci sono anni plausibili', () => {
    expect(extractYear('nessun anno qui')).toBeNull()
  })
})

describe('isPlausibleItalianPhone', () => {
  it('accetta numeri italiani validi', () => {
    expect(isPlausibleItalianPhone('+39 0584 790193')).toBe(true)
    expect(isPlausibleItalianPhone('340 2791466')).toBe(true)
    expect(isPlausibleItalianPhone('0584757537')).toBe(true)
  })
  it('scarta la spazzatura', () => {
    expect(isPlausibleItalianPhone('000000001')).toBe(false)   // inizia per 00
    expect(isPlausibleItalianPhone('023120109504')).toBe(false) // 12 cifre
    expect(isPlausibleItalianPhone('12345')).toBe(false)        // non inizia per 0/3, troppo corto
    expect(isPlausibleItalianPhone('00000000')).toBe(false)     // tutti zeri
  })
})

describe('classifyEmails', () => {
  it('separa generiche e nominative', () => {
    const { email_generic, email_nominative } = classifyEmails(['info@x.it', 'mario.rossi@x.it'])
    expect(email_generic).toBe('info@x.it')
    expect(email_nominative).toBe('mario.rossi@x.it')
  })
  it('riconosce i prefissi generici comuni', () => {
    const { email_generic } = classifyEmails(['contatti@x.it'])
    expect(email_generic).toBe('contatti@x.it')
  })
})

describe('computeWeaknessScore', () => {
  it('assegna +3 quando non c\'è sito', () => {
    expect(computeWeaknessScore({ has_website: false }, 'ristorante')).toBe(3)
  })
  it('somma le debolezze del sito (no https + no viewport)', () => {
    const score = computeWeaknessScore(
      { has_website: true, https: false, mobile_viewport: false },
      'ristorante',
    )
    expect(score).toBe(4) // +2 https +2 viewport
  })
  it('non penalizza un sito sano', () => {
    const score = computeWeaknessScore(
      { has_website: true, https: true, mobile_viewport: true, page_count_estimate: 10 },
      'ristorante',
    )
    expect(score).toBe(0)
  })
})

describe('decodeCfEmail', () => {
  it('decodifica un hash Cloudflare valido', () => {
    // "info@x.it" XOR chiave 0x42
    expect(decodeCfEmail('422b2c242d023a6c2b36')).toBe('info@x.it')
  })
  it('ritorna null su input non valido o senza @', () => {
    expect(decodeCfEmail('zz')).toBeNull()
    expect(decodeCfEmail('42')).toBeNull()
    expect(decodeCfEmail('422b2c')).toBeNull() // decodifica ma non contiene @
  })
})

describe('deobfuscateEmailText', () => {
  const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g
  it('decodifica il cloak Joomla (entità HTML + concatenazioni JS) — caso reale baccimarmi.it', () => {
    const js = "var addy = 'b&#97;cc&#105;' + '&#64;' + 'b&#97;cc&#105;m&#97;rm&#105;' + '&#46;' + '&#105;t';"
    expect(deobfuscateEmailText(js).match(EMAIL_RE)).toContain('bacci@baccimarmi.it')
  })
  it('decodifica le offuscazioni umane [at]/[dot]', () => {
    expect(deobfuscateEmailText('info [at] esempio [dot] it').match(EMAIL_RE)).toContain('info@esempio.it')
  })
  it('decodifica le entità esadecimali', () => {
    expect(deobfuscateEmailText('info&#x40;esempio&#x2E;it').match(EMAIL_RE)).toContain('info@esempio.it')
  })
})

describe('detectLanguages', () => {
  const base = 'https://www.miosito.it/'
  it('rileva hreflang e html lang', () => {
    const $ = cheerio.load('<html lang="it"><body><a hreflang="en-US" href="/en/">EN</a></body></html>')
    const langs = detectLanguages($, base)
    expect(langs).toContain('it')
    expect(langs).toContain('en')
  })
  it('rileva la bandierina /en/ senza hreflang (caso reale dei piccoli siti)', () => {
    const $ = cheerio.load('<html lang="it"><body><a href="/en/">English</a></body></html>')
    expect(detectLanguages($, base)).toContain('en')
  })
  it('rileva ?lang=de e i marker WPML', () => {
    const $ = cheerio.load('<html><body><a class="wpml-ls-slug-de" href="/?lang=de">DE</a></body></html>')
    expect(detectLanguages($, base)).toContain('de')
  })
  it('rileva il sottodominio en.', () => {
    const $ = cheerio.load('<html lang="it"><body><a href="https://en.miosito.it/">EN</a></body></html>')
    expect(detectLanguages($, base)).toContain('en')
  })
  it('non scambia /menu/ per una lingua', () => {
    const $ = cheerio.load('<html lang="it"><body><a href="/menu/">Menù</a></body></html>')
    expect(detectLanguages($, base)).toEqual(['it'])
  })
})

describe('scoreInternalLinks', () => {
  it('ordina contatti > chi-siamo ed esclude esterni/file/generici', () => {
    const $ = cheerio.load(`
      <a href="/chi-siamo">Chi siamo</a>
      <a href="/contatti/">Contatti</a>
      <a href="/prodotti">Prodotti</a>
      <a href="https://facebook.com/x">FB</a>
      <a href="/brochure.pdf">Contattaci</a>
    `)
    const links = scoreInternalLinks($, 'https://www.miosito.it/')
    expect(links[0].url).toBe('https://www.miosito.it/contatti/')
    expect(links[0].isContact).toBe(true)
    expect(links[1].url).toBe('https://www.miosito.it/chi-siamo')
    expect(links.some(l => l.url.includes('facebook'))).toBe(false)
    expect(links.some(l => l.url.includes('.pdf'))).toBe(false)
    expect(links.some(l => l.url.includes('prodotti'))).toBe(false)
  })
})

describe('qualità angolo: solo fatti confermati', () => {
  it('non afferma assenze non verificate (null)', () => {
    const angolo = generateAngolo(
      { has_website: true, https: true, has_contact_form: null, has_booking: null, has_ecommerce: null },
      'ristorante',
    )
    expect(angolo).not.toMatch(/solo per telefono|prenotazione online/)
  })
  it('propone la leva di settore su assenza verificata (ristorante senza booking)', () => {
    const angolo = generateAngolo(
      { has_website: true, has_booking: false, has_contact_form: true },
      'ristorante',
    )
    expect(angolo).toMatch(/prenotazione online/)
  })
  it('non parla di lingue se non verificate (export)', () => {
    const angolo = generateAngolo({ has_website: true }, 'marmo')
    expect(angolo).not.toMatch(/versione inglese/)
  })
  it('segnala la SEO base assente solo se verificata', () => {
    const conSeo = generateAngolo({ has_website: true, seo_description: false, seo_h1: false }, 'officina')
    expect(conSeo).toMatch(/Google/)
    const senzaDati = generateAngolo({ has_website: true, seo_description: null, seo_h1: null }, 'officina')
    expect(senzaDati).not.toMatch(/Google/)
  })
})

describe('scorer: gating lingue e SEO', () => {
  it('non penalizza le lingue non verificate su settore export', () => {
    const score = computeWeaknessScore(
      { has_website: true, https: true, mobile_viewport: true, page_count_estimate: 10 },
      'marmo',
    )
    expect(score).toBe(1) // solo bonus export, nessuna penalità lingue
  })
  it('penalizza lingue verificate solo-italiano su export', () => {
    const score = computeWeaknessScore(
      { has_website: true, https: true, mobile_viewport: true, page_count_estimate: 10, lang_versions: ['it'] },
      'marmo',
    )
    expect(score).toBe(2) // bonus export + penalità lingue
  })
  it('aggiunge +1 se SEO base assente verificata', () => {
    const score = computeWeaknessScore(
      { has_website: true, https: true, mobile_viewport: true, page_count_estimate: 10, seo_description: false, seo_h1: false },
      'officina',
    )
    expect(score).toBe(1)
  })
})

describe('computeWebsiteStatus', () => {
  it('none senza sito', () => {
    expect(computeWebsiteStatus({ has_website: false })).toBe('none')
  })
  it('dated se manca https', () => {
    expect(computeWebsiteStatus({ has_website: true, https: false, mobile_viewport: true })).toBe('dated')
  })
  it('recent se moderno e veloce', () => {
    expect(computeWebsiteStatus({ has_website: true, https: true, mobile_viewport: true, psi_performance: 90 })).toBe('recent')
  })
})
