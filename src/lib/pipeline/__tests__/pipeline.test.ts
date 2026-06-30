import { describe, it, expect } from 'vitest'
import { normalizeWebsiteUrl, extractYear, isPlausibleItalianPhone, classifyEmails } from '../site-fetcher'
import { computeWeaknessScore, computeWebsiteStatus } from '../scorer'

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
