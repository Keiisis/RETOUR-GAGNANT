// ══════════════════════════════════════════════════════════════
// 🔐 lib/waf/idor.ts — IDOR / BOLA Detection
// ══════════════════════════════════════════════════════════════
//
// Broken Object Level Authorization — l'attaque #1 de l'OWASP API
// Un utilisateur légitime (trust 100) qui accède à des objets
// qui ne lui appartiennent pas.
//
// Détection :
// - Énumération séquentielle d'IDs (1, 2, 3, 4...)
// - Accès rapide à de nombreux UUIDs différents
// - Parameter tampering (user_id, account_id modifiés)
// - Changements d'IDs dans les chemins API
//
// Usage : trackIDORAttempt(ip, path, fingerprintHash)
//         getIDORVerdict(ip)
// ══════════════════════════════════════════════════════════════

export interface IDORResult {
    suspicious: boolean
    confidence: number         // 0-100
    pattern: IDORPattern
    detail: string
    distinctIds: number
    endpointPattern: string
}

export type IDORPattern =
    | 'sequential_enumeration'
    | 'uuid_bruteforce'
    | 'parameter_tampering'
    | 'rapid_id_switching'
    | 'none'

// ── Endpoints sensibles à surveiller ─────────────────────────
// Ces patterns d'URL contiennent des IDs d'objets que l'utilisateur
// pourrait tenter de bruteforcer
const SENSITIVE_API_PATTERNS = [
    /^\/api\/(?:client|agent|admin|ceo)\/(?:dossier|documents?|payments?|invoices?|orders?|profiles?|users?)(?:\/|$)/i,
    /^\/api\/(?:client|agent|admin|ceo)\/.*\/[0-9a-f-]{36}(?:\/|$)/i,  // UUID dans le path
    /^\/api\/.*\?.*(?:id|user_id|account_id|order_id|dossier_id|doc_id)=/i,
]

// ── Extraction d'IDs depuis les chemins et query params ──────
const ID_EXTRACTORS = [
    // UUID v4 dans le path
    /\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi,
    // ID numérique dans le path (ex: /api/users/42)
    /\/(\d{1,10})(?:\/|$)/g,
    // ID dans les query params
    /(?:id|user_id|account_id|order_id|dossier_id|doc_id|client_id)=([^&]+)/gi,
]

// ── Structure de tracking en mémoire ────────────────────────
interface IDORTracker {
    endpoints: Map<string, {
        ids: Set<string>
        firstSeen: number
        lastSeen: number
        sequentialRuns: number  // nombre de runs séquentiels détectés
    }>
    totalDistinctIds: number
    lastCheck: number
}

const idorTracking = new Map<string, IDORTracker>()
const IDOR_WINDOW_MS = 5 * 60_000       // fenêtre de 5 minutes
const IDOR_MAX_IDS = 8                    // seuil de suspicion par endpoint
const IDOR_SEQUENTIAL_THRESHOLD = 4       // 4+ IDs séquentiels = énumération
const IDOR_RAPID_THRESHOLD = 15           // 15+ IDs différents en 5min = bruteforce
const IDOR_CLEANUP_INTERVAL = 10 * 60_000 // nettoyage toutes les 10 min
let lastCleanup = Date.now()

/**
 * Normalise un chemin API en pattern (remplace les IDs par un wildcard)
 */
function normalizeEndpoint(path: string): string {
    return path
        .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '*')
        .replace(/\/\d{1,10}(?=\/|$)/g, '/*')
}

/**
 * Extrait tous les IDs d'un chemin et query string
 */
function extractIds(path: string, queryString: string): string[] {
    const combined = path + '?' + queryString
    const ids: string[] = []
    for (const extractor of ID_EXTRACTORS) {
        const regex = new RegExp(extractor.source, extractor.flags)
        let match
        while ((match = regex.exec(combined)) !== null) {
            if (match[1] && match[1] !== '*') {
                ids.push(match[1])
            }
        }
    }
    return [...new Set(ids)]
}

/**
 * Détecte les patterns séquentiels dans un ensemble d'IDs numériques
 */
function detectSequentialPattern(ids: Set<string>): boolean {
    const numericIds = [...ids]
        .map(id => parseInt(id, 10))
        .filter(n => !isNaN(n) && n >= 0 && n < 1_000_000)
        .sort((a, b) => a - b)

    if (numericIds.length < IDOR_SEQUENTIAL_THRESHOLD) return false

    // Chercher des runs séquentiels (1,2,3,4 ou 100,101,102,103)
    let maxRun = 1
    let currentRun = 1
    for (let i = 1; i < numericIds.length; i++) {
        if (numericIds[i] === numericIds[i - 1] + 1) {
            currentRun++
            maxRun = Math.max(maxRun, currentRun)
        } else {
            currentRun = 1
        }
    }

    return maxRun >= IDOR_SEQUENTIAL_THRESHOLD
}

/**
 * Nettoyage périodique des trackers expirés
 */
function cleanupTrackers(): void {
    const now = Date.now()
    if (now - lastCleanup < IDOR_CLEANUP_INTERVAL) return
    lastCleanup = now

    for (const [key, tracker] of idorTracking) {
        // Supprimer les endpoints expirés
        for (const [endpoint, data] of tracker.endpoints) {
            if (now - data.lastSeen > IDOR_WINDOW_MS) {
                tracker.endpoints.delete(endpoint)
            }
        }
        // Supprimer les trackers vides
        if (tracker.endpoints.size === 0) {
            idorTracking.delete(key)
        }
    }
}

/**
 * Vérifie si le chemin est un endpoint sensible à surveiller
 */
function isSensitiveEndpoint(path: string): boolean {
    return SENSITIVE_API_PATTERNS.some(p => p.test(path))
}

/**
 * Enregistre un accès et vérifie le pattern IDOR
 * Appelé à chaque requête API contenant un ID
 */
export function trackIDORAttempt(
    ip: string,
    path: string,
    queryString: string,
    fingerprintHash: string = ''
): IDORResult {
    const noResult: IDORResult = {
        suspicious: false, confidence: 0,
        pattern: 'none', detail: '', distinctIds: 0,
        endpointPattern: '',
    }

    // Ne surveiller que les endpoints sensibles
    if (!isSensitiveEndpoint(path + '?' + queryString)) return noResult

    // Extraire les IDs
    const ids = extractIds(path, queryString)
    if (ids.length === 0) return noResult

    const trackKey = fingerprintHash || ip
    const endpointPattern = normalizeEndpoint(path)
    const now = Date.now()

    // Nettoyage périodique
    cleanupTrackers()

    // Initialiser le tracker
    if (!idorTracking.has(trackKey)) {
        idorTracking.set(trackKey, {
            endpoints: new Map(),
            totalDistinctIds: 0,
            lastCheck: now,
        })
    }
    const tracker = idorTracking.get(trackKey)!

    // Initialiser l'endpoint
    if (!tracker.endpoints.has(endpointPattern)) {
        tracker.endpoints.set(endpointPattern, {
            ids: new Set(),
            firstSeen: now,
            lastSeen: now,
            sequentialRuns: 0,
        })
    }
    const epData = tracker.endpoints.get(endpointPattern)!

    // Expiration de la fenêtre
    if (now - epData.firstSeen > IDOR_WINDOW_MS) {
        epData.ids.clear()
        epData.firstSeen = now
        epData.sequentialRuns = 0
    }

    // Enregistrer les IDs
    const previousSize = epData.ids.size
    for (const id of ids) {
        if (epData.ids.size < 50) {  // cap pour éviter la fuite mémoire
            epData.ids.add(id)
        }
    }
    epData.lastSeen = now

    // Mise à jour total
    tracker.totalDistinctIds = 0
    for (const [, ep] of tracker.endpoints) {
        tracker.totalDistinctIds += ep.ids.size
    }

    // ── Analyse des patterns ─────────────────────────────────

    // 1. Énumération séquentielle (IDs numériques 1,2,3,4...)
    if (detectSequentialPattern(epData.ids)) {
        return {
            suspicious: true,
            confidence: 95,
            pattern: 'sequential_enumeration',
            detail: `Énumération séquentielle détectée sur ${endpointPattern}: ${epData.ids.size} IDs (${[...epData.ids].slice(0, 5).join(',')})`,
            distinctIds: epData.ids.size,
            endpointPattern,
        }
    }

    // 2. Accès rapide à trop d'IDs différents sur un même endpoint
    if (epData.ids.size >= IDOR_MAX_IDS) {
        const elapsed = (now - epData.firstSeen) / 1000
        const rate = epData.ids.size / Math.max(elapsed, 1)

        return {
            suspicious: true,
            confidence: Math.min(95, 70 + epData.ids.size * 2),
            pattern: rate > 0.5 ? 'rapid_id_switching' : 'uuid_bruteforce',
            detail: `${epData.ids.size} IDs distincts accédés sur ${endpointPattern} en ${Math.round(elapsed)}s (${rate.toFixed(2)}/s)`,
            distinctIds: epData.ids.size,
            endpointPattern,
        }
    }

    // 3. Accès global à trop d'IDs sur différents endpoints
    if (tracker.totalDistinctIds >= IDOR_RAPID_THRESHOLD) {
        return {
            suspicious: true,
            confidence: Math.min(90, 60 + tracker.totalDistinctIds * 2),
            pattern: 'uuid_bruteforce',
            detail: `${tracker.totalDistinctIds} IDs distincts accédés sur ${tracker.endpoints.size} endpoints`,
            distinctIds: tracker.totalDistinctIds,
            endpointPattern: 'multi-endpoint',
        }
    }

    // 4. Parameter tampering : même requête mais ID change à chaque fois
    if (epData.ids.size > previousSize && epData.ids.size >= 3) {
        const elapsed = (now - epData.firstSeen) / 1000
        if (elapsed < 10 && epData.ids.size >= 4) {
            return {
                suspicious: true,
                confidence: 80,
                pattern: 'parameter_tampering',
                detail: `ID change rapide sur ${endpointPattern}: ${epData.ids.size} IDs en ${Math.round(elapsed)}s`,
                distinctIds: epData.ids.size,
                endpointPattern,
            }
        }
    }

    return noResult
}

/**
 * Persiste l'attaque IDOR en base (cross-instance, serverless-safe).
 *
 * Le tracking en mémoire (trackIDORAttempt) reste le fast-path temps réel
 * pour bloquer dans un même burst. CETTE fonction écrit l'état dans
 * waf_idor_tracking via la RPC waf_track_idor() pour que :
 *   - l'état survive aux cold starts / instances multiples Vercel
 *   - la corrélation se fasse TOUS instances confondues
 *   - le job d'auto-block et le dashboard voient l'historique
 *
 * Fire-and-forget : on n'attend pas (pas de latence ajoutée sur la requête).
 * Renvoie une Promise pour les appelants qui VEULENT le verdict cross-instance.
 */
export async function persistIDORAttempt(args: {
    ip: string
    fingerprintHash: string
    path: string
    queryString: string
    supabaseUrl: string
    serviceKey: string
}): Promise<{ distinctIds: number; isSuspicious: boolean; rapid: boolean } | null> {
    const ids = extractIds(args.path, args.queryString)
    if (ids.length === 0) return null
    if (!isSensitiveEndpoint(args.path + '?' + args.queryString)) return null

    const endpointPattern = normalizeEndpoint(args.path)
    try {
        const res = await fetch(`${args.supabaseUrl}/rest/v1/rpc/waf_track_idor`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                apikey: args.serviceKey,
                Authorization: `Bearer ${args.serviceKey}`,
            },
            body: JSON.stringify({
                p_ip: args.ip,
                p_fingerprint: args.fingerprintHash || '',
                p_endpoint_pattern: endpointPattern,
                p_ids: ids,
            }),
        })
        if (!res.ok) return null
        const data = await res.json() as { distinct_ids?: number; is_suspicious?: boolean; rapid?: boolean }
        return {
            distinctIds: data?.distinct_ids ?? 0,
            isSuspicious: !!data?.is_suspicious,
            rapid: !!data?.rapid,
        }
    } catch {
        return null
    }
}

/**
 * Vérifie le paramètre tampering dans les query params
 * Détecte si un user_id/account_id est présent et différent du contexte
 */
export function checkParameterTampering(
    queryString: string,
    body?: string
): { detected: boolean; params: string[]; detail: string } {
    const suspicious = [
        'user_id', 'account_id', 'owner_id', 'admin',
        'role', 'is_admin', 'is_superadmin', 'privilege',
        'access_level', 'permission', 'group_id',
    ]

    const combined = queryString + '&' + (body || '')
    const found: string[] = []

    for (const param of suspicious) {
        const regex = new RegExp(`(?:^|[&?])${param}=`, 'i')
        if (regex.test(combined)) {
            found.push(param)
        }
    }

    // Mass assignment : champs sensibles dans un POST body
    if (body) {
        try {
            const parsed = JSON.parse(body)
            const massAssignKeys = ['role', 'is_admin', 'trust_score', 'verified',
                'email_verified', 'permissions', 'access_level', 'privilege']
            for (const key of massAssignKeys) {
                if (key in parsed && !found.includes(key)) {
                    found.push(`body.${key}`)
                }
            }
        } catch { /* pas du JSON */ }
    }

    return {
        detected: found.length > 0,
        params: found,
        detail: found.length > 0
            ? `Paramètres sensibles détectés: ${found.join(', ')}`
            : '',
    }
}
