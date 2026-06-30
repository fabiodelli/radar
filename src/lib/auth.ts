// Token di sessione = SHA-256 della password, così il cookie non contiene mai la password in chiaro.
// Web Crypto è disponibile sia su Edge (middleware) sia su Node (route handler).
export async function sessionToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(`radar:${password}`)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}
