interface PsiResult {
  psi_performance: number | null
  psi_mobile_usability: boolean | null
  psi_seo: number | null
}

export async function fetchPageSpeed(url: string): Promise<PsiResult> {
  const key = process.env.GOOGLE_MAPS_API_KEY // Stessa key, PSI usa la stessa API key Google
  if (!key) return { psi_performance: null, psi_mobile_usability: null, psi_seo: null }

  const endpoint = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile&category=PERFORMANCE&category=SEO&key=${key}`

  try {
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(20000) })
    if (!res.ok) return { psi_performance: null, psi_mobile_usability: null, psi_seo: null }
    const json = await res.json()

    const cats = json.lighthouseResult?.categories
    const performance = cats?.performance?.score != null
      ? Math.round(cats.performance.score * 100)
      : null
    const seo = cats?.seo?.score != null
      ? Math.round(cats.seo.score * 100)
      : null

    // mobile_usability: controlla audits specifici
    const audits = json.lighthouseResult?.audits ?? {}
    const mobileIssues = [
      'viewport',
      'font-size',
      'tap-targets',
    ].some(k => audits[k]?.score === 0)

    return {
      psi_performance:      performance,
      psi_mobile_usability: !mobileIssues,
      psi_seo:              seo,
    }
  } catch {
    return { psi_performance: null, psi_mobile_usability: null, psi_seo: null }
  }
}
