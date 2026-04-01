// ══════════════════════════════════════════════════════════════
// 🔍 WAF DECODER — Normalisation multi-couches des entrées
// Reproduit le moteur de décodage de ModSecurity :
// URL, double-URL, HTML entities, Unicode, null bytes, commentaires
// ══════════════════════════════════════════════════════════════

// ── 1. Suppression des null bytes ─────────────────────────────
function removeNullBytes(input: string): string {
    return input.replace(/\x00/g, '').replace(/%00/gi, '')
}

// ── 2. Décodage URL (simple) ──────────────────────────────────
function decodeUrl(input: string): string {
    try {
        return decodeURIComponent(input.replace(/\+/g, ' '))
    } catch {
        // Décodage partiel si malformé
        return input.replace(/%([0-9a-fA-F]{2})/g, (_, hex) => {
            try { return String.fromCharCode(parseInt(hex, 16)) } catch { return _ }
        })
    }
}

// ── 3. Décodage double-URL ────────────────────────────────────
function decodeDoubleUrl(input: string): string {
    // %2527 → %27 → '  (double encoded)
    // %2500 → %00 (double encoded null)
    return decodeUrl(decodeUrl(input))
}

// ── 4. Décodage HTML entities ─────────────────────────────────
const HTML_ENTITIES: Record<string, string> = {
    '&lt;': '<', '&gt;': '>', '&amp;': '&', '&quot;': '"',
    '&apos;': "'", '&#x3C;': '<', '&#x3E;': '>', '&#x22;': '"',
    '&#x27;': "'", '&#x2F;': '/', '&#60;': '<', '&#62;': '>',
    '&#34;': '"', '&#39;': "'", '&#47;': '/',
    '&nbsp;': ' ', '&ensp;': ' ', '&emsp;': ' ',
}

function decodeHtmlEntities(input: string): string {
    // Named entities
    let result = input
    for (const [entity, char] of Object.entries(HTML_ENTITIES)) {
        result = result.replace(new RegExp(entity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), char)
    }
    // Numeric decimal: &#60; &#x3C;
    result = result.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
    result = result.replace(/&#x([0-9a-fA-F]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    return result
}

// ── 5. Suppression commentaires SQL/HTML ──────────────────────
function removeComments(input: string): string {
    return input
        .replace(/\/\*[\s\S]*?\*\//g, ' ')  // /* ... */
        .replace(/--[^\r\n]*/g, ' ')        // -- commentaire
        .replace(/<!--[\s\S]*?-->/g, ' ')   // <!-- ... -->
        .replace(/#[^\r\n]*/g, ' ')         // # commentaire (MySQL)
}

// ── 6. Normalisation Unicode ──────────────────────────────────
function normalizeUnicode(input: string): string {
    // Convertir les variantes Unicode de caractères ASCII sensibles
    return input
        .replace(/\uFF1C/g, '<')  // ＜ fullwidth less-than
        .replace(/\uFF1E/g, '>')  // ＞ fullwidth greater-than
        .replace(/\uFF07/g, "'")  // ＇ fullwidth apostrophe
        .replace(/\uFF02/g, '"')  // ＂ fullwidth quotation
        .replace(/\uFF03/g, '#')  // ＃ fullwidth number sign
        .replace(/\u2018/g, "'")  // ' left single quotation
        .replace(/\u2019/g, "'")  // ' right single quotation
        .replace(/\u201C/g, '"')  // " left double quotation
        .replace(/\u201D/g, '"')  // " right double quotation
        .replace(/\u00AB/g, '"')  // « left-pointing double angle
        .replace(/\u00BB/g, '"')  // » right-pointing double angle
        // Espace unicode alternatives
        .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
        // Tab/newline variations
        .replace(/\u0009|\u000A|\u000D/g, ' ')
}

// ── 7. Suppression des espaces inutiles ───────────────────────
function collapseWhitespace(input: string): string {
    return input.replace(/\s+/g, ' ').trim()
}

// ── 8. Décodage Base64 partiel ────────────────────────────────
// Détecte et décode les séquences base64 dans l'URL
function decodeBase64Fragments(input: string): string {
    return input.replace(/[A-Za-z0-9+/]{20,}={0,2}/g, (match) => {
        try {
            const decoded = Buffer.from(match, 'base64').toString('utf8')
            // Seulement si le résultat est lisible ASCII
            if (/^[\x20-\x7E]+$/.test(decoded)) return decoded
        } catch { /* ignore */ }
        return match
    })
}

// ── 9. Suppression des séquences de path traversal ────────────
function normalizePaths(input: string): string {
    return input
        .replace(/\.\.\//g, '')
        .replace(/\.\.%2F/gi, '')
        .replace(/\.\.%5C/gi, '')
        .replace(/%2e%2e%2f/gi, '')
        .replace(/%2e%2e\//gi, '')
}

// ── 10. Suppression anti-evasion SQL ─────────────────────────
function removeSqlEvasions(input: string): string {
    // Supprimer les techniques d'évasion SQL communes
    return input
        .replace(/\/\*!\s*\d*\s*/g, '')   // MySQL version comments: /*!50000 */
        .replace(/\|\|/g, ' OR ')          // || → OR
        .replace(/&&/g, ' AND ')           // && → AND
        .replace(/\bUNION\s+ALL\s+SELECT/gi, 'UNION SELECT')
        .replace(/0x[0-9a-f]+/gi, (hex) => {  // 0x41 → A
            try { return Buffer.from(hex.slice(2), 'hex').toString('ascii') } catch { return hex }
        })
}

// ── PIPELINE DE DÉCODAGE COMPLET ──────────────────────────────
export interface DecodedInput {
    original:   string
    normalized: string
    layers:     string[]  // chaque étape pour debug
}

export function decode(input: string): DecodedInput {
    const layers: string[] = [input]

    let s = removeNullBytes(input)
    layers.push(s)

    s = normalizeUnicode(s)
    layers.push(s)

    s = decodeHtmlEntities(s)
    layers.push(s)

    // Décodage URL jusqu'à 3 couches (anti-double/triple encoding)
    let prev = ''
    let count = 0
    while (s !== prev && count < 3) {
        prev = s
        s = decodeUrl(s)
        count++
    }
    layers.push(s)

    s = decodeBase64Fragments(s)
    layers.push(s)

    s = removeComments(s)
    layers.push(s)

    s = removeSqlEvasions(s)
    layers.push(s)

    s = normalizePaths(s)
    layers.push(s)

    s = collapseWhitespace(s)
    layers.push(s)

    s = s.toLowerCase()
    layers.push(s)

    return { original: input, normalized: s, layers }
}

// ── Décoder toutes les parties d'une requête ──────────────────
export interface RequestParts {
    url:       string
    query:     string
    userAgent: string
    referer:   string
    cookie:    string
    body:      string
    allDecoded: string  // concaténation de tout pour scan rapide
}

export function decodeRequest(
    pathname: string,
    searchParams: string,
    headers: Headers,
    rawBody?: string
): RequestParts {
    const url       = decode(pathname).normalized
    const query     = decode(searchParams).normalized
    const userAgent = decode(headers.get('user-agent') || '').normalized
    const referer   = decode(headers.get('referer') || '').normalized
    const cookie    = decode(headers.get('cookie') || '').normalized
    const body      = rawBody ? decode(rawBody).normalized : ''

    return {
        url, query, userAgent, referer, cookie, body,
        allDecoded: [url, query, userAgent, referer, cookie, body].join(' '),
    }
}
