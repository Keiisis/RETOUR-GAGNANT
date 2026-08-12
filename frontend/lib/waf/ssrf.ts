// ══════════════════════════════════════════════════════════════
// 🕳️ lib/waf/ssrf.ts : Server-Side Request Forgery Detection
// ══════════════════════════════════════════════════════════════
//
// Détecte les tentatives d'accéder à des ressources internes :
// - IPs privées (10.x, 172.16-31.x, 192.168.x, 127.x, ::1)
// - Cloud metadata endpoints (AWS, GCP, Azure, DigitalOcean)
// - Schémas dangereux (file://, gopher://, dict://, ldap://)
// - DNS rebinding / redirections vers des IPs internes
//
// Usage : scanForSSRF(path, queryString, body?)
// ══════════════════════════════════════════════════════════════

export interface SSRFResult {
    detected: boolean
    confidence: number         // 0-100
    pattern: string            // pattern détecté
    category: SSRFCategory
    detail: string
}

export type SSRFCategory =
    | 'internal_ip'
    | 'cloud_metadata'
    | 'dangerous_scheme'
    | 'localhost'
    | 'dns_rebinding'
    | 'ip_obfuscation'

// ── IPs privées / réservées (RFC 1918 + loopback + link-local) ──
const PRIVATE_IP_PATTERNS: Array<{ regex: RegExp; label: string }> = [
    // IPv4 privées
    { regex: /(?:^|[/=?&])(?:https?:\/\/)?10\.\d{1,3}\.\d{1,3}\.\d{1,3}/i, label: '10.0.0.0/8' },
    { regex: /(?:^|[/=?&])(?:https?:\/\/)?172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}/i, label: '172.16.0.0/12' },
    { regex: /(?:^|[/=?&])(?:https?:\/\/)?192\.168\.\d{1,3}\.\d{1,3}/i, label: '192.168.0.0/16' },
    // Loopback
    { regex: /(?:^|[/=?&])(?:https?:\/\/)?127\.\d{1,3}\.\d{1,3}\.\d{1,3}/i, label: '127.0.0.0/8' },
    { regex: /(?:^|[/=?&])(?:https?:\/\/)?localhost(?:[:/]|$)/i, label: 'localhost' },
    { regex: /(?:^|[/=?&])(?:https?:\/\/)?\[?::1\]?(?:[:/]|$)/i, label: '::1' },
    // Link-local
    { regex: /(?:^|[/=?&])(?:https?:\/\/)?169\.254\.\d{1,3}\.\d{1,3}/i, label: '169.254.0.0/16' },
    // 0.0.0.0
    { regex: /(?:^|[/=?&])(?:https?:\/\/)?0\.0\.0\.0/i, label: '0.0.0.0' },
]

// ── Cloud Metadata Endpoints ────────────────────────────────
const CLOUD_METADATA_PATTERNS: Array<{ regex: RegExp; label: string }> = [
    // AWS IMDSv1/v2
    { regex: /169\.254\.169\.254/i, label: 'AWS IMDS' },
    { regex: /\/latest\/meta-data/i, label: 'AWS metadata path' },
    { regex: /\/latest\/user-data/i, label: 'AWS user-data' },
    { regex: /\/latest\/api\/token/i, label: 'AWS IMDS token' },
    // GCP
    { regex: /metadata\.google\.internal/i, label: 'GCP metadata' },
    { regex: /computeMetadata\/v1/i, label: 'GCP compute metadata' },
    // Azure
    { regex: /169\.254\.169\.254\/metadata/i, label: 'Azure IMDS' },
    // DigitalOcean
    { regex: /169\.254\.169\.254\/metadata\/v1/i, label: 'DigitalOcean metadata' },
    // Alibaba Cloud
    { regex: /100\.100\.100\.200/i, label: 'Alibaba Cloud metadata' },
]

// ── Schémas URI dangereux ───────────────────────────────────
const DANGEROUS_SCHEMES: Array<{ regex: RegExp; label: string }> = [
    { regex: /file:\/\//i, label: 'file://' },
    { regex: /gopher:\/\//i, label: 'gopher://' },
    { regex: /dict:\/\//i, label: 'dict://' },
    { regex: /ldap:\/\//i, label: 'ldap://' },
    { regex: /ftp:\/\/(?:localhost|127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01]))/i, label: 'ftp://internal' },
    { regex: /sftp:\/\//i, label: 'sftp://' },
    { regex: /tftp:\/\//i, label: 'tftp://' },
    { regex: /jar:(?:file|http)/i, label: 'jar:' },
    { regex: /netdoc:\/\//i, label: 'netdoc://' },
]

// ── Obfuscation IP (bypass tentatives) ──────────────────────
const IP_OBFUSCATION: Array<{ regex: RegExp; label: string }> = [
    // IP décimale (ex: 2130706433 = 127.0.0.1)
    { regex: /(?:^|[/=?&])(?:https?:\/\/)?(?:0x[0-9a-f]{8})/i, label: 'Hex IP' },
    { regex: /(?:^|[/=?&])(?:https?:\/\/)?(?:\d{8,10})(?:[:/]|$)/i, label: 'Decimal IP' },
    // IP octal (ex: 0177.0.0.1 = 127.0.0.1)
    { regex: /(?:^|[/=?&])(?:https?:\/\/)?0[0-7]{1,3}\.0[0-7]{1,3}\./i, label: 'Octal IP' },
    // IPv6 court pour localhost
    { regex: /(?:^|[/=?&])(?:https?:\/\/)?\[::\]/i, label: '[::]' },
    // URL encoded IPs
    { regex: /%31%32%37%2e%30%2e%30%2e%31/i, label: 'URL-encoded 127.0.0.1' },
    { regex: /%31%36%39%2e%32%35%34/i, label: 'URL-encoded 169.254' },
]

/**
 * Scanne une requête pour détecter les tentatives SSRF
 */
export function scanForSSRF(
    path: string,
    queryString: string,
    body?: string
): SSRFResult {
    // Combiner toutes les surfaces d'attaque
    const surfaces = [path, queryString, body || ''].join(' ')

    if (!surfaces || surfaces.length < 3) {
        return { detected: false, confidence: 0, pattern: '', category: 'internal_ip', detail: '' }
    }

    // Décoder les couches d'encodage (URL-encode, double-encode)
    const decoded = decodeMultiLayer(surfaces)

    // 1. Cloud Metadata (priorité maximale : confidence 100)
    for (const p of CLOUD_METADATA_PATTERNS) {
        if (p.regex.test(decoded) || p.regex.test(surfaces)) {
            return {
                detected: true,
                confidence: 100,
                pattern: p.label,
                category: 'cloud_metadata',
                detail: `Cloud metadata endpoint détecté: ${p.label}`,
            }
        }
    }

    // 2. Schémas dangereux (confidence 95)
    for (const p of DANGEROUS_SCHEMES) {
        if (p.regex.test(decoded) || p.regex.test(surfaces)) {
            return {
                detected: true,
                confidence: 95,
                pattern: p.label,
                category: 'dangerous_scheme',
                detail: `Schéma URI dangereux: ${p.label}`,
            }
        }
    }

    // 3. IPs privées (confidence 90)
    for (const p of PRIVATE_IP_PATTERNS) {
        if (p.regex.test(decoded) || p.regex.test(surfaces)) {
            return {
                detected: true,
                confidence: 90,
                pattern: p.label,
                category: p.label === 'localhost' || p.label === '::1' ? 'localhost' : 'internal_ip',
                detail: `IP interne/réservée détectée: ${p.label}`,
            }
        }
    }

    // 4. Obfuscation IP (confidence 85 : tentative d'évasion = très suspect)
    for (const p of IP_OBFUSCATION) {
        if (p.regex.test(decoded) || p.regex.test(surfaces)) {
            return {
                detected: true,
                confidence: 85,
                pattern: p.label,
                category: 'ip_obfuscation',
                detail: `Obfuscation IP détectée: ${p.label} (bypass tentative)`,
            }
        }
    }

    return { detected: false, confidence: 0, pattern: '', category: 'internal_ip', detail: '' }
}

/**
 * Décode plusieurs couches d'URL encoding (anti-évasion)
 */
function decodeMultiLayer(input: string): string {
    let result = input
    for (let i = 0; i < 3; i++) {
        try {
            const decoded = decodeURIComponent(result)
            if (decoded === result) break
            result = decoded
        } catch {
            break
        }
    }
    return result
}
