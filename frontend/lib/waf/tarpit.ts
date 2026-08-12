// ══════════════════════════════════════════════════════════════
// ⏳ WAF TARPIT : Ralentissement progressif des attaquants
// Les IPs suspectes reçoivent des réponses avec un délai
// artificiel proportionnel à leur niveau de menace
// ══════════════════════════════════════════════════════════════

// ── Types ────────────────────────────────────────────────────
export interface TarpitDecision {
    shouldTarpit: boolean
    delayMs:      number
    trustScore:   number
    level:        number  // 0=aucun, 1=léger, 2=modéré, 3=sévère, 4=max
}

// ── Configuration locale (fallback si DB indisponible) ────────
interface TarpitTier {
    trustMin:    number
    trustMax:    number
    delayMs:     number
    jitterMs:    number
    level:       number
}

const DEFAULT_TIERS: TarpitTier[] = [
    { trustMin: 40, trustMax: 50, delayMs: 0,    jitterMs: 0,    level: 0 },
    { trustMin: 30, trustMax: 40, delayMs: 500,  jitterMs: 200,  level: 1 },
    { trustMin: 20, trustMax: 30, delayMs: 2000, jitterMs: 500,  level: 2 },
    { trustMin: 10, trustMax: 20, delayMs: 5000, jitterMs: 1000, level: 3 },
    { trustMin: 0,  trustMax: 10, delayMs: 8000, jitterMs: 2000, level: 4 },
]

// Max absolu pour fonctions serverless (Vercel = 10-30s timeout)
const MAX_TARPIT_MS = 8000

// Plafond de tarpits SIMULTANÉS par instance : anti auto-DoS.
// Un await sleep occupe la fonction serverless (concurrence + facturation).
// Sous flood, sans plafond, on saturerait notre propre concurrence.
const MAX_CONCURRENT_TARPITS = 50
let activeTarpits = 0

// ── Métriques de tarpitting ──────────────────────────────────
let totalTarpitRequests = 0
let totalTarpitDelayMs  = 0
let maxTarpitDelayMs    = 0
let skippedTarpits      = 0

export function getTarpitMetrics(): {
    totalRequests: number
    totalDelayMs:  number
    maxDelayMs:    number
    avgDelayMs:    number
    active:        number
    skipped:       number
} {
    return {
        totalRequests: totalTarpitRequests,
        totalDelayMs:  totalTarpitDelayMs,
        maxDelayMs:    maxTarpitDelayMs,
        avgDelayMs:    totalTarpitRequests > 0
            ? Math.round(totalTarpitDelayMs / totalTarpitRequests)
            : 0,
        active:        activeTarpits,
        skipped:       skippedTarpits,
    }
}

// ── Calculer le délai de tarpit selon le trust score ──────────
export function calculateTarpitDelay(trustScore: number): TarpitDecision {
    // Trust score >= 50 → aucun tarpit
    if (trustScore >= 50) {
        return { shouldTarpit: false, delayMs: 0, trustScore, level: 0 }
    }

    // Trouver le tier correspondant
    const tier = DEFAULT_TIERS.find(
        t => trustScore >= t.trustMin && trustScore < t.trustMax
    )

    if (!tier || tier.delayMs === 0) {
        return { shouldTarpit: false, delayMs: 0, trustScore, level: 0 }
    }

    // Appliquer le jitter (variation aléatoire ±jitter)
    const jitter = Math.floor(Math.random() * tier.jitterMs * 2) - tier.jitterMs
    const delay = Math.max(0, Math.min(MAX_TARPIT_MS, tier.delayMs + jitter))

    return {
        shouldTarpit: delay > 0,
        delayMs:      delay,
        trustScore,
        level:        tier.level,
    }
}

// ── Appliquer le tarpit (promesse qui dort) ──────────────────
// Retourne une promesse qui résout après le délai spécifié
// Utilisé dans le middleware : await applyTarpit(delay)
export async function applyTarpit(delayMs: number): Promise<void> {
    if (delayMs <= 0) return

    // ── Plafond de concurrence : anti auto-DoS ──
    // Si trop de tarpits sont déjà actifs sur cette instance, on renonce au
    // délai (la requête reste traitée/bloquée par ailleurs) plutôt que de
    // saturer notre propre concurrence serverless.
    if (activeTarpits >= MAX_CONCURRENT_TARPITS) {
        skippedTarpits++
        return
    }

    // Métriques
    totalTarpitRequests++
    totalTarpitDelayMs += delayMs
    if (delayMs > maxTarpitDelayMs) maxTarpitDelayMs = delayMs

    activeTarpits++
    try {
        await new Promise<void>(resolve => setTimeout(resolve, delayMs))
    } finally {
        activeTarpits--
    }
}

// ── Décision de tarpit depuis les données RPC ────────────────
// Utilisé quand waf_evaluate_request retourne action='tarpit'
export function parseTarpitFromRPC(rpcResult: {
    action: string
    delay_ms?: number
    trust_score?: number
}): TarpitDecision {
    if (rpcResult.action !== 'tarpit') {
        return { shouldTarpit: false, delayMs: 0, trustScore: rpcResult.trust_score ?? 50, level: 0 }
    }

    const delay = Math.max(0, Math.min(MAX_TARPIT_MS, rpcResult.delay_ms ?? 0))
    const trust = rpcResult.trust_score ?? 30

    return {
        shouldTarpit: delay > 0,
        delayMs:      delay,
        trustScore:   trust,
        level:        delay >= 5000 ? 4 : delay >= 2000 ? 3 : delay >= 500 ? 2 : 1,
    }
}
