// Signatures HMAC-SHA256 du serveur (Web Crypto : middleware et routes).
// Secret dédié SIGNATURE_SECRET, sinon dérivé de la clé serveur Supabase (jamais exposée au navigateur).
// Aucun secret = signature impossible et toute vérification refusée.

const enc = new TextEncoder()
const cles = new Map<string, Promise<CryptoKey | null>>()

function cle(usage: string): Promise<CryptoKey | null> {
    const brut = process.env.SIGNATURE_SECRET || process.env.TOTP_COOKIE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!brut) return Promise.resolve(null)
    const id = `${usage}|${brut.length}|${brut.slice(-6)}`
    if (!cles.has(id)) cles.set(id, (async () => {
        const base = await crypto.subtle.importKey('raw', enc.encode(brut), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
        const derive = await crypto.subtle.sign('HMAC', base, enc.encode(usage))   // une clé distincte par usage
        return crypto.subtle.importKey('raw', derive, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
    })())
    return cles.get(id)!
}

const b64url = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
function deB64url(s: string): Uint8Array<ArrayBuffer> {
    const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4))
    const out = new Uint8Array(b.length)
    for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i)
    return out
}

/** Jeton « échéance.signature » pour `message`, valable `dureeS` secondes. */
export async function signerJeton(usage: string, message: string, dureeS: number, maintenantMs = Date.now()): Promise<string> {
    const k = await cle(usage)
    if (!k) throw new Error('Secret de signature indisponible')
    const exp = Math.floor(maintenantMs / 1000) + dureeS
    return `${exp}.${b64url(await crypto.subtle.sign('HMAC', k, enc.encode(`${message}|${exp}`)))}`
}

/** Vrai seulement si le jeton a été signé par le serveur pour ce message et cet usage, et n'a pas expiré. */
export async function verifierJeton(usage: string, message: string, jeton: string | null | undefined, maintenantMs = Date.now()): Promise<boolean> {
    if (!jeton || !message) return false
    const [expTxt, sig] = jeton.split('.')
    const exp = Number(expTxt)
    if (!sig || !Number.isInteger(exp) || exp * 1000 <= maintenantMs) return false
    const k = await cle(usage)
    if (!k) return false
    try {
        return await crypto.subtle.verify('HMAC', k, deB64url(sig), enc.encode(`${message}|${exp}`))
    } catch {
        return false
    }
}
