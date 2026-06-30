// ══════════════════════════════════════════════════════════════
// 🐦 lib/waf/canary.ts — Canary Tokens & Honey-Records
// ══════════════════════════════════════════════════════════════
//
// Système de tokens traçables injectés dans les payloads de déception.
// Si un attaquant RÉUTILISE une info volée (faux nom de serveur,
// fausse clé API, faux email), le canary token le trahit.
//
// Honey-Records : enregistrements piégés dans la base de données.
// Tout accès à ces enregistrements = alerte immédiate.
//
// Usage :
//   generateCanaryToken('api_key') → token unique
//   checkCanaryInRequest(path, queryString, body) → triggered?
//   registerHoneyAccess(table, recordId, ip) → log + alert
// ══════════════════════════════════════════════════════════════

export type CanaryTokenType =
    | 'data_leak'     // info générique qui ne devrait jamais apparaître
    | 'api_key'       // fausse clé API
    | 'email'         // faux email de contact
    | 'url'           // fausse URL interne
    | 'credential'    // faux username/password
    | 'dns'           // faux hostname
    | 'hostname'      // faux nom de serveur (ex: db-replica-03.internal.corp)
    | 'db_name'       // faux nom de base de données

export interface CanaryToken {
    token: string
    tokenType: CanaryTokenType
    embeddedIn: string          // description du contexte
}

export interface CanaryCheckResult {
    triggered: boolean
    tokens: string[]
    detail: string
}

// ── Canary tokens connus (injectés dans les payloads de déception) ──
// Ces tokens sont extraits des bait_tokens dans waf_deception_payloads
// et mis en cache ici pour une détection ultra-rapide dans chaque requête
const KNOWN_CANARIES: Map<string, CanaryToken> = new Map()
let canaryCacheTs = 0
const CANARY_CACHE_TTL = 5 * 60_000  // 5 min

// ── Canaries hardcodés (ceux dans les payloads SQL existants) ──
// Ces valeurs sont injectées dans les faux payloads de déception.
// Si un attaquant les réutilise dans une requête future, il se trahit.
const HARDCODED_CANARIES: CanaryToken[] = [
    { token: 'db-replica-03.internal.corp', tokenType: 'hostname', embeddedIn: 'fake_mysql_error' },
    { token: 'webapp_prod', tokenType: 'credential', embeddedIn: 'fake_mysql_error' },
    { token: '10.0.3.42', tokenType: 'dns', embeddedIn: 'fake_mysql_error' },
]

// Initialiser les canaries hardcodés
for (const c of HARDCODED_CANARIES) {
    KNOWN_CANARIES.set(c.token.toLowerCase(), c)
}

/**
 * Génère un token canary unique
 */
export function generateCanaryToken(
    tokenType: CanaryTokenType,
    embeddedIn: string = ''
): CanaryToken {
    // Générer un token qui ressemble à une vraie valeur selon le type
    const token = (() => {
        switch (tokenType) {
            case 'api_key':
                return `sk_live_${randomHex(24)}`
            case 'email':
                return `admin_${randomHex(6)}@internal-corp.net`
            case 'url':
                return `https://api-internal-${randomHex(8)}.corp.local/v2`
            case 'credential':
                return `svc_${randomHex(8)}`
            case 'dns':
                return `db-${randomHex(4)}.internal.${randomHex(4)}.corp`
            case 'hostname':
                return `srv-${randomHex(6)}.dc${Math.floor(Math.random() * 9) + 1}.internal`
            case 'db_name':
                return `prod_db_${randomHex(6)}`
            default:
                return `canary_${randomHex(16)}`
        }
    })()

    const canary: CanaryToken = { token, tokenType, embeddedIn }
    KNOWN_CANARIES.set(token.toLowerCase(), canary)
    return canary
}

/**
 * Rafraîchit le cache des canary tokens depuis Supabase
 */
export async function refreshCanaryCache(
    supabaseUrl: string,
    serviceKey: string
): Promise<void> {
    if (Date.now() - canaryCacheTs < CANARY_CACHE_TTL) return
    canaryCacheTs = Date.now()

    try {
        // Récupérer les canary tokens actifs
        const res = await fetch(
            `${supabaseUrl}/rest/v1/waf_canary_tokens?is_active=eq.true&select=token,token_type,embedded_in`,
            { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
        )
        if (!res.ok) return

        const rows = await res.json() as Array<{
            token: string; token_type: string; embedded_in: string
        }>
        if (!Array.isArray(rows)) return

        for (const row of rows) {
            KNOWN_CANARIES.set(row.token.toLowerCase(), {
                token: row.token,
                tokenType: row.token_type as CanaryTokenType,
                embeddedIn: row.embedded_in,
            })
        }

        // Récupérer aussi les bait_tokens depuis les payloads de déception
        const payloadRes = await fetch(
            `${supabaseUrl}/rest/v1/waf_deception_payloads?enabled=eq.true&select=payload_name,bait_tokens`,
            { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
        )
        if (payloadRes.ok) {
            const payloads = await payloadRes.json() as Array<{
                payload_name: string; bait_tokens: string[]
            }>
            if (Array.isArray(payloads)) {
                for (const p of payloads) {
                    if (Array.isArray(p.bait_tokens)) {
                        for (const t of p.bait_tokens) {
                            if (t && !KNOWN_CANARIES.has(t.toLowerCase())) {
                                KNOWN_CANARIES.set(t.toLowerCase(), {
                                    token: t,
                                    tokenType: 'data_leak',
                                    embeddedIn: p.payload_name,
                                })
                            }
                        }
                    }
                }
            }
        }
    } catch { /* silencieux */ }
}

/**
 * Vérifie si la requête contient un canary token
 * Un attaquant qui réutilise une info volée dans un faux payload se trahit
 */
export function checkCanaryInRequest(
    path: string,
    queryString: string,
    body?: string
): CanaryCheckResult {
    const combined = [path, queryString, body || ''].join(' ').toLowerCase()

    if (combined.length < 5 || KNOWN_CANARIES.size === 0) {
        return { triggered: false, tokens: [], detail: '' }
    }

    const triggeredTokens: string[] = []
    const details: string[] = []

    for (const [tokenLower, canary] of KNOWN_CANARIES) {
        if (tokenLower.length >= 6 && combined.includes(tokenLower)) {
            triggeredTokens.push(canary.token)
            details.push(`Canary [${canary.tokenType}] "${canary.token}" détecté (source: ${canary.embeddedIn})`)
        }
    }

    return {
        triggered: triggeredTokens.length > 0,
        tokens: triggeredTokens,
        detail: details.join(' | '),
    }
}

/**
 * Enregistre l'accès à un honey-record dans Supabase
 */
export function registerHoneyAccess(opts: {
    tableName: string
    recordId: string
    ip: string
    fingerprintHash?: string
    supabaseUrl: string
    serviceKey: string
}): void {
    const { tableName, recordId, ip, fingerprintHash, supabaseUrl, serviceKey } = opts

    // Mettre à jour le honey-record
    fetch(`${supabaseUrl}/rest/v1/waf_honey_records?table_name=eq.${encodeURIComponent(tableName)}&record_id=eq.${encodeURIComponent(recordId)}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            Prefer: 'return=minimal',
        },
        body: JSON.stringify({
            access_count: 'access_count + 1',  // Note: requires SQL function
            last_accessed_by: ip,
            last_accessed_at: new Date().toISOString(),
            alerted: true,
        }),
    }).catch(() => {})

    // Log l'accès en tant qu'interaction honeypot
    fetch(`${supabaseUrl}/rest/v1/waf_honeypot_interactions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            Prefer: 'return=minimal',
        },
        body: JSON.stringify({
            ip,
            fingerprint_hash: fingerprintHash || '',
            path: `honey-record:${tableName}/${recordId}`,
            method: 'SELECT',
            attack_class: 'honeypot',
            payload_used: `honey_record:${tableName}`,
        }),
    }).catch(() => {})
}

/**
 * Enregistre le déclenchement d'un canary token dans Supabase
 */
export function reportCanaryTriggered(opts: {
    token: string
    ip: string
    path: string
    context?: Record<string, unknown>
    supabaseUrl: string
    serviceKey: string
}): void {
    const { token, ip, path, context, supabaseUrl, serviceKey } = opts

    fetch(`${supabaseUrl}/rest/v1/rpc/waf_check_canary_token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
            p_token: token,
            p_ip: ip,
            p_path: path,
            p_context: context || {},
        }),
    }).catch(() => {})
}

// ── Utilitaire : hex aléatoire ──────────────────────────────
function randomHex(length: number): string {
    const chars = '0123456789abcdef'
    let result = ''
    for (let i = 0; i < length; i++) {
        result += chars[Math.floor(Math.random() * chars.length)]
    }
    return result
}
