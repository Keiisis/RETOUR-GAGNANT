// ══════════════════════════════════════════════════════════════
// 🔍 WAF FINGERPRINT : Empreinte navigateur côté serveur
// Identifie les attaquants même après changement d'IP
//
// NOTE : Ce module tourne dans le Edge Runtime (middleware Next.js)
// → Pas d'accès à Node.js 'crypto'. On utilise un hash FNV-1a
//   qui est rapide, déterministe, et sans dépendance.
// ══════════════════════════════════════════════════════════════

// ── Composants extraits des headers HTTP ──────────────────────
export interface FingerprintComponents {
    ua_family:      string   // User-Agent simplifié (navigateur + version majeure)
    os:             string   // Système d'exploitation détecté
    accept_lang:    string   // Accept-Language (ordre des langues)
    accept_enc:     string   // Accept-Encoding (gzip, br, etc.)
    sec_ch_ua:      string   // Client Hints: marques navigateur
    sec_ch_platform: string  // Client Hints: plateforme OS
    sec_ch_mobile:  string   // Client Hints: mobile ?
    connection:     string   // Connection header (keep-alive, etc.)
    dnt:            string   // Do Not Track
    sec_fetch_mode: string   // Sec-Fetch-Mode
    sec_fetch_site: string   // Sec-Fetch-Site
}

// ── Extraction des composants depuis les headers ──────────────
export function extractFingerprintComponents(headers: Headers): FingerprintComponents {
    const ua = headers.get('user-agent') || ''

    return {
        ua_family:       simplifyUserAgent(ua),
        os:              extractOS(ua),
        accept_lang:     normalizeAcceptLang(headers.get('accept-language') || ''),
        accept_enc:      headers.get('accept-encoding') || '',
        sec_ch_ua:       headers.get('sec-ch-ua') || '',
        sec_ch_platform: headers.get('sec-ch-ua-platform') || '',
        sec_ch_mobile:   headers.get('sec-ch-ua-mobile') || '',
        connection:      headers.get('connection') || '',
        dnt:             headers.get('dnt') || '',
        sec_fetch_mode:  headers.get('sec-fetch-mode') || '',
        sec_fetch_site:  headers.get('sec-fetch-site') || '',
    }
}

// ── Générer un hash stable depuis les composants ──────────────
// Le hash est déterministe : même navigateur + même config → même hash
// Utilise FNV-1a (rapide, sans dépendance, Edge Runtime compatible)
export function generateFingerprintHash(components: FingerprintComponents): string {
    const normalized = [
        components.ua_family,
        components.os,
        components.accept_lang,
        components.accept_enc,
        components.sec_ch_ua,
        components.sec_ch_platform,
        components.sec_ch_mobile,
        components.connection,
        components.dnt,
        components.sec_fetch_mode,
        components.sec_fetch_site,
    ].join('|')

    return fnv1aHash(normalized)
}

// ── FNV-1a Hash (32 chars hex, Edge Runtime compatible) ───────
// Produit un hash de 128 bits en combinant 4 passes FNV-1a 32-bit
// avec des seeds différents. Résultat : 32 caractères hex stables.
function fnv1aHash(str: string): string {
    const seeds = [0x811c9dc5, 0x050c5d1f, 0x1234abcd, 0xdeadbeef]
    let result = ''

    for (const seed of seeds) {
        let hash = seed
        for (let i = 0; i < str.length; i++) {
            hash ^= str.charCodeAt(i)
            hash = Math.imul(hash, 0x01000193)
        }
        result += (hash >>> 0).toString(16).padStart(8, '0')
    }

    return result // 32 chars hex
}

// ── Extraire l'empreinte complète (composants + hash) ─────────
export function extractFingerprint(headers: Headers): {
    hash: string
    components: FingerprintComponents
} {
    const components = extractFingerprintComponents(headers)
    const hash = generateFingerprintHash(components)
    return { hash, components }
}

// ── Détection heuristique de bots/headless ────────────────────
export function detectHeadlessBrowser(headers: Headers): {
    isHeadless: boolean
    indicators: string[]
} {
    const indicators: string[] = []
    const ua = (headers.get('user-agent') || '').toLowerCase()

    // Indicateurs classiques de navigateurs headless
    if (ua.includes('headlesschrome') || ua.includes('headless')) {
        indicators.push('headless_ua')
    }
    if (ua.includes('phantomjs')) indicators.push('phantomjs')
    if (ua.includes('selenium')) indicators.push('selenium')
    if (ua.includes('puppeteer')) indicators.push('puppeteer')
    if (ua.includes('playwright')) indicators.push('playwright')

    // Absence de headers normalement présents dans un vrai navigateur
    if (!headers.get('accept-language')) indicators.push('no_accept_lang')
    if (!headers.get('accept-encoding')) indicators.push('no_accept_enc')
    if (!headers.get('sec-fetch-mode') && ua.includes('chrome')) {
        indicators.push('no_sec_fetch_chrome')
    }

    // User-Agent trop court ou trop générique
    if (ua.length < 30) indicators.push('short_ua')
    if (ua === 'mozilla/5.0') indicators.push('generic_ua')

    // Combinaison incohérente
    const secChUa = headers.get('sec-ch-ua') || ''
    if (ua.includes('chrome') && !secChUa && !ua.includes('mobile')) {
        indicators.push('chrome_no_client_hints')
    }

    return {
        isHeadless: indicators.length >= 2,
        indicators,
    }
}

// ── Enregistrer le fingerprint via RPC Supabase ───────────────
export function registerFingerprint(opts: {
    ip: string
    hash: string
    components: FingerprintComponents
    supabaseUrl: string
    serviceKey: string
}): void {
    const { ip, hash, components, supabaseUrl, serviceKey } = opts
    if (!supabaseUrl || !serviceKey || ip === 'unknown' || !hash) return

    fetch(`${supabaseUrl}/rest/v1/rpc/waf_register_fingerprint`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
            p_ip: ip,
            p_hash: hash,
            p_components: components,
        }),
    }).catch(() => {})
}

// ── Helpers internes ──────────────────────────────────────────

function simplifyUserAgent(ua: string): string {
    // Extraire navigateur + version majeure
    const browsers = [
        { name: 'Chrome',  regex: /Chrome\/(\d+)/ },
        { name: 'Firefox', regex: /Firefox\/(\d+)/ },
        { name: 'Safari',  regex: /Version\/(\d+).*Safari/ },
        { name: 'Edge',    regex: /Edg\/(\d+)/ },
        { name: 'Opera',   regex: /OPR\/(\d+)/ },
    ]
    for (const b of browsers) {
        const match = ua.match(b.regex)
        if (match) return `${b.name}/${match[1]}`
    }
    // Bots/outils
    if (/curl/i.test(ua)) return 'curl'
    if (/python/i.test(ua)) return 'python'
    if (/go-http/i.test(ua)) return 'go-http'
    if (/java/i.test(ua)) return 'java'
    if (/node/i.test(ua)) return 'node'
    return 'unknown'
}

function extractOS(ua: string): string {
    if (/Windows NT 10/i.test(ua)) return 'Windows 10/11'
    if (/Windows NT/i.test(ua)) return 'Windows'
    if (/Mac OS X/i.test(ua)) return 'macOS'
    if (/Linux/i.test(ua)) return 'Linux'
    if (/Android/i.test(ua)) return 'Android'
    if (/iPhone|iPad/i.test(ua)) return 'iOS'
    return 'unknown'
}

function normalizeAcceptLang(lang: string): string {
    // Garder uniquement les langues principales (pas les q-values)
    return lang
        .split(',')
        .map(l => l.trim().split(';')[0].trim().toLowerCase())
        .slice(0, 5)
        .join(',')
}
