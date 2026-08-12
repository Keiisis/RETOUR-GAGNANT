// ══════════════════════════════════════════════════════════════
// 🔀 lib/waf/smuggling.ts : HTTP Request Smuggling Detection
// ══════════════════════════════════════════════════════════════
//
// Détecte les attaques de type HTTP Request Smuggling (CL/TE) :
// - Headers conflictuels Transfer-Encoding + Content-Length
// - Transfer-Encoding mal formé ou obfusqué
// - Double Content-Length
// - Caractères de contrôle injectés dans les headers
// - Headers invalides qui exploitent les différences proxy/backend
//
// Usage : scanForSmuggling(headers)
// ══════════════════════════════════════════════════════════════

export interface SmugglingResult {
    detected: boolean
    confidence: number         // 0-100
    pattern: SmugglingPattern
    detail: string
}

export type SmugglingPattern =
    | 'cl_te_conflict'
    | 'te_obfuscation'
    | 'double_content_length'
    | 'header_injection'
    | 'malformed_chunked'
    | 'none'

/**
 * Scanne les headers HTTP pour détecter les tentatives de Request Smuggling
 */
export function scanForSmuggling(headers: Headers): SmugglingResult {
    const noResult: SmugglingResult = {
        detected: false, confidence: 0, pattern: 'none', detail: '',
    }

    // ── 1. CL/TE Conflict ───────────────────────────────────
    // Le duo mortel : Transfer-Encoding + Content-Length simultanés
    const hasTE = headers.has('transfer-encoding')
    const hasCL = headers.has('content-length')
    const teValue = headers.get('transfer-encoding') || ''
    const clValue = headers.get('content-length') || ''

    if (hasTE && hasCL) {
        // HTTP/1.1 RFC dit que TE a priorité, mais certains serveurs
        // interprètent CL → c'est exactement ce que l'attaquant exploite
        return {
            detected: true,
            confidence: 95,
            pattern: 'cl_te_conflict',
            detail: `CL/TE conflict: Transfer-Encoding="${teValue}" + Content-Length="${clValue}"`,
        }
    }

    // ── 2. Transfer-Encoding obfusqué ────────────────────────
    // Les attaquants obfusquent "chunked" pour bypasser les proxies
    if (hasTE) {
        const teNormalized = teValue.toLowerCase().trim()

        // Variantes d'obfuscation connues
        const obfuscationPatterns = [
            /chunked\s*,\s*identity/i,       // chunked, identity
            /identity\s*,\s*chunked/i,        // identity, chunked
            /chunked\s*;\s*/i,               // chunked; (avec paramètre)
            /\bchunke[d]?\s/i,               // chunke d (espace dans le mot)
            /\bchunk\b/i,                    // chunk (incomplet)
            /transfer-encoding\s*:\s*/i,     // header dans la valeur
        ]

        for (const pattern of obfuscationPatterns) {
            if (pattern.test(teValue)) {
                return {
                    detected: true,
                    confidence: 90,
                    pattern: 'te_obfuscation',
                    detail: `TE obfuscation: "${teValue}"`,
                }
            }
        }

        // TE avec des caractères invalides (tab, CR, LF, null)
        if (/[\x00\x0d\x0a\x09]/.test(teValue)) {
            return {
                detected: true,
                confidence: 95,
                pattern: 'te_obfuscation',
                detail: `TE contient des caractères de contrôle`,
            }
        }

        // TE avec valeur non-standard (ni "chunked" ni "identity" ni "gzip" etc.)
        const validTE = ['chunked', 'compress', 'deflate', 'gzip', 'identity', 'br']
        const teValues = teNormalized.split(',').map(v => v.trim().split(';')[0].trim())
        for (const val of teValues) {
            if (val && !validTE.includes(val)) {
                return {
                    detected: true,
                    confidence: 75,
                    pattern: 'te_obfuscation',
                    detail: `TE valeur non-standard: "${val}"`,
                }
            }
        }
    }

    // ── 3. Double Content-Length ──────────────────────────────
    // Certains serveurs prennent le premier, d'autres le dernier
    if (hasCL) {
        // Vérifier si la valeur contient plusieurs nombres (double CL injecté)
        const clParts = clValue.split(',').map(v => v.trim())
        if (clParts.length > 1) {
            return {
                detected: true,
                confidence: 95,
                pattern: 'double_content_length',
                detail: `Double Content-Length: "${clValue}"`,
            }
        }

        // CL négatif ou non-numérique
        if (!/^\d+$/.test(clValue.trim())) {
            return {
                detected: true,
                confidence: 85,
                pattern: 'malformed_chunked',
                detail: `Content-Length invalide: "${clValue}"`,
            }
        }

        // CL énorme (> 10MB pour une requête de page) : potentiel smuggling
        const clNum = parseInt(clValue, 10)
        if (clNum > 10_000_000) {
            return {
                detected: true,
                confidence: 60,
                pattern: 'malformed_chunked',
                detail: `Content-Length suspect: ${clNum} bytes (>10MB)`,
            }
        }
    }

    // ── 4. Header Injection (CRLF dans les valeurs) ──────────
    // Injecter \r\n dans un header pour créer de faux headers
    const suspiciousHeaders = [
        'host', 'x-forwarded-for', 'x-forwarded-host',
        'x-original-url', 'x-rewrite-url', 'x-custom-ip-authorization',
        'referer', 'origin', 'user-agent',
    ]

    for (const headerName of suspiciousHeaders) {
        const value = headers.get(headerName)
        if (value && /[\x00\x0d\x0a]/.test(value)) {
            return {
                detected: true,
                confidence: 95,
                pattern: 'header_injection',
                detail: `CRLF injection dans header "${headerName}"`,
            }
        }
    }

    // ── 5. Host header manipulation (request routing attack) ─
    const host = headers.get('host') || ''
    if (host) {
        // Multiple @ signs (authentication bypass)
        if ((host.match(/@/g) || []).length > 0) {
            return {
                detected: true,
                confidence: 80,
                pattern: 'header_injection',
                detail: `Host header avec @ (auth bypass tentative): "${host}"`,
            }
        }
        // Absolute URL in Host header
        if (/^https?:\/\//i.test(host)) {
            return {
                detected: true,
                confidence: 75,
                pattern: 'header_injection',
                detail: `Absolute URL dans Host header: "${host}"`,
            }
        }
    }

    return noResult
}
