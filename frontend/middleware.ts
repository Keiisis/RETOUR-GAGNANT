import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
    extractIp,
    checkRateLimit,
    getRateLimitCategory,
    analyzeRequestFast,
    checkGeoBlock,
    getCachedIpBlock,
    setCachedIpBlock,
    logWafEvent,
    trackViolation,
    setWafConfig,
    getWafConfig,
    setCustomRulesCache,
    getCustomRulesCache,
    checkIpTrustScore,
    checkSubnetBanned,
    recordLocalViolation,
    isLocallyBlocked,
    isHoneypotPath,
    updateIpMemory,
    createAlert,
    // ── Modules Défense Active ──
    extractFingerprint,
    registerFingerprint,
    detectHeadlessBrowser,
    identifierRobot,
    evaluateRequestRPC,
    getDeceptionPayload,
    buildDeceptionResponse,
    refreshDeceptionPayloads,
    logDeceptionInteraction,
    applyTarpit,
    // ── Modules Système Immunitaire ──
    scanForSmuggling,
    scanForSSRF,
    scanForRCE,
    trackIDORAttempt,
    persistIDORAttempt,
    checkParameterTampering,
    checkCanaryInRequest,
    refreshCanaryCache,
    reportCanaryTriggered,
    type ThreatType,
} from '@/lib/waf'

// ═══════════════════════════════════════════════════════════════
// 🛡️ MIDDLEWARE — WAF ULTIME · Défense Active · Cyber-Déception
// ═══════════════════════════════════════════════════════════════
//
// ARCHITECTURE DE SÉCURITÉ (ordre strict) :
//
//  0. WAF_EMERGENCY_BYPASS → passe auth uniquement, WAF désactivé
//  1. Chemins login/reset/2fa → accès immédiat, zéro check
//  2. Fingerprint extraction (headers HTTP → hash stable)
//  2b. REQUEST SMUGGLING check (headers uniquement, ultra-rapide)
//  3. Honeypot → faux payload WordPress/PHP crédible (déception)
//  4. WAF SENTINEL RPC → waf_evaluate_request() retourne:
//     - 'allow'   → continuer normalement
//     - 'tarpit'  → appliquer un délai, puis continuer
//     - 'deceive' → retourner un faux payload crédible (200 OK)
//     - 'block'   → retourner 403
//     - 'honeypot'→ retourner un faux formulaire WordPress
//  4b. SYSTÈME IMMUNITAIRE (post-RPC, routes publiques) :
//     - SSRF scan (query params + path → IPs internes, cloud metadata)
//     - RCE scan (désérialisation, injection de commandes)
//     - IDOR tracking (énumération séquentielle d'IDs)
//     - CANARY tokens (réutilisation d'infos volées)
//  5. FALLBACK CRS JS (si RPC échoue) :
//     - IP bloquée / Trust score → 403
//     - Géo-blocage → 403
//     - Rate Limiting → 429
//     - WAF CRS OWASP → scan regex (non-panel uniquement)
//  6. Auth Supabase + rôles (inchangé)
//
// PANELS INTERNES : /admin/*, /agent/*, /client/*
//   → Jamais bloqués par WAF CRS (URL générée par l'app)
//   → Protégés par l'auth Supabase (étape 6)
//
// FAIL-OPEN : Si Supabase est injoignable, toutes les requêtes
//   passent (l'auth protège les panels, le site public est ouvert)
// ═══════════════════════════════════════════════════════════════

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL  || ''
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// ── Chemins qui bypass ABSOLUMENT tout (même IP bloquée) ──────
const ABSOLUTE_BYPASS = [
    '/admin/login',
    '/admin/reset-password',
    '/admin/2fa',
    '/agent/login',
    '/agent/reset-password',
    '/client/login',
    '/client/register',
    '/client/reset-password',
    '/client/forgot-password',
]

function isAbsoluteBypass(pathname: string): boolean {
    return ABSOLUTE_BYPASS.some(p => pathname === p || pathname.startsWith(p + '?'))
}

// ── Charger config WAF + règles custom depuis Supabase ────────
async function refreshWafConfig(): Promise<void> {
    const { stale } = getCustomRulesCache()
    if (!stale || !SUPA_URL || !SUPA_KEY) return

    try {
        const [configRes, rulesRes] = await Promise.all([
            fetch(`${SUPA_URL}/rest/v1/waf_config?select=key,value`, {
                headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
            }),
            fetch(`${SUPA_URL}/rest/v1/waf_rules?enabled=eq.true&select=*`, {
                headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
            }),
        ])

        if (configRes.ok) {
            const rows = await configRes.json() as Array<{ key: string; value: string }>
            if (Array.isArray(rows)) {
                const map = Object.fromEntries(rows.map(r => [r.key, r.value]))
                setWafConfig({
                    paranoiaLevel:    parseInt(map['paranoia_level'] || '1') || 1,
                    blockedCountries: map['blocked_countries'] ? JSON.parse(map['blocked_countries']) : [],
                    whitelistedIps:   map['whitelisted_ips']   ? JSON.parse(map['whitelisted_ips'])   : [],
                    whitelistedPaths: map['whitelisted_paths'] ? JSON.parse(map['whitelisted_paths']) : [],
                    enabled:          map['enabled'] !== 'false',
                    // Plages des robots d'indexation, alimentées par le cron
                    // waf-maintenance depuis les listes publiées par Google
                    // et Bing (voir lib/waf/crawlers.ts).
                    crawlerRanges:    map['crawler_ranges'] ? JSON.parse(map['crawler_ranges']) : [],
                })
            }
        }

        if (rulesRes.ok) {
            const rules = await rulesRes.json()
            if (Array.isArray(rules)) setCustomRulesCache(rules)
        }
    } catch { /* silencieux */ }
}

// ── Vérifier blocage IP ───────────────────────────────────────
async function isIpBlocked(ip: string): Promise<boolean> {
    const cached = getCachedIpBlock(ip)
    if (cached !== null) return cached
    if (!SUPA_URL || !SUPA_KEY) return false
    try {
        const res = await fetch(
            `${SUPA_URL}/rest/v1/ip_blocks?ip=eq.${encodeURIComponent(ip)}&unblocked_at=is.null&select=ip&limit=1`,
            { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` } }
        )
        const rows = await res.json() as Array<unknown>
        const blocked = Array.isArray(rows) && rows.length > 0
        setCachedIpBlock(ip, blocked)
        return blocked
    } catch { return false }
}

function wafBlock(reason: string, status = 403): NextResponse {
    return new NextResponse(JSON.stringify({ error: reason }), {
        status,
        headers: { 'Content-Type': 'application/json' },
    })
}

// ══════════════════════════════════════════════════════════════
export async function middleware(request: NextRequest) {
    const response = NextResponse.next({ request: { headers: request.headers } })

    // ─── Security Headers (toujours appliqués) ───────────────
    const secHeaders: Record<string, string> = {
        'X-Content-Type-Options':    'nosniff',
        'X-Frame-Options':           'SAMEORIGIN',
        'X-XSS-Protection':          '1; mode=block',
        'Referrer-Policy':           'strict-origin-when-cross-origin',
        'Permissions-Policy':        'camera=(), microphone=(self), geolocation=()',
    }
    Object.entries(secHeaders).forEach(([k, v]) => response.headers.set(k, v))

    const pathname  = request.nextUrl.pathname
    const ip        = extractIp(request.headers)
    const userAgent = request.headers.get('user-agent') || ''
    const method    = request.method

    // ─── 0. WAF EMERGENCY BYPASS ─────────────────────────────
    // Définir WAF_EMERGENCY_BYPASS=true dans Vercel → désactive tout le WAF
    // L'auth Supabase reste active pour protéger les données
    const emergencyBypass = process.env.WAF_EMERGENCY_BYPASS === 'true'

    // ─── Refresh config WAF (AWAIT pour garantir que la whitelist est chargée) ─
    if (!emergencyBypass) {
        await refreshWafConfig().catch(() => {})
    }

    // ─── Vérifier si l'IP est dans la liste blanche ──────────
    // Les IPs whitelistées sont exemptées des contrôles de BLOCAGE :
    //   - IP bloquée, trust score, rate limiting, géo-blocage
    // Mais RESTENT soumises aux contrôles de DÉTECTION :
    //   - Honeypot (accès à des chemins malveillants = toujours suspect)
    //   - WAF CRS (détection d'attaques dans les requêtes)
    const wafConfig = getWafConfig()

    // ── Robots d'indexation vérifiés ──────────────────────────
    // Googlebot annonce « Chrome » sans envoyer accept-language ni
    // sec-ch-ua : la détection de navigateur sans interface le classait
    // comme bot malveillant, dégradant la confiance de son IP à chaque
    // passage jusqu'au blocage — donc jusqu'à la désindexation.
    //
    // La preuve n'est PAS le User-Agent (n'importe qui peut l'écrire)
    // mais l'appartenance de l'adresse aux plages publiées par le moteur.
    // Un imposteur reste traité comme un visiteur suspect ordinaire.
    const robot = identifierRobot(userAgent, ip, wafConfig.crawlerRanges || [])
    const isVerifiedCrawler = !emergencyBypass && robot.verifie

    const isIpWhitelisted = !emergencyBypass && (
        isVerifiedCrawler
        || (wafConfig.whitelistedIps && wafConfig.whitelistedIps.includes(ip))
    )

    // ── Chemins publics protégés par un jeton/secret ou une vérification
    //    serveur propre — exemptés du SCAN DE CONTENU (CRS/RPC) uniquement.
    // Pourquoi : le WAF peut bloquer à tort (403 « Accès refusé ») des jetons
    // signés, des secrets d'URL ou les serveurs des prestataires de paiement.
    //  • /nationalite/formulaire + resume/complete : jeton HMAC vérifié serveur
    //  • /api/webhooks/* : serveurs Kkiapay/FedaPay/Stripe/PayPal — chaque
    //    webhook re-vérifie la transaction/signature ; un blocage WAF ici
    //    détruirait tout le filet de sécurité paiement
    //  • /portail/[id] et /p/[secret] : liens de paiement devis/factures dont
    //    l'URL EST le secret ; confirmation vérifiée côté serveur
    //  • /api/documents/confirm-payment : l'autorisation EST la vérification
    //    de la transaction chez le provider
    const isTokenAuthedPublic = (
        pathname === '/nationalite/formulaire' ||
        pathname.startsWith('/api/nationality/resume') ||
        pathname.startsWith('/api/nationality/complete') ||
        pathname.startsWith('/api/webhooks/') ||
        pathname.startsWith('/portail/') ||
        pathname.startsWith('/p/') ||
        pathname.startsWith('/api/documents/confirm-payment') ||
        // /contrat/[token] + /api/contracts : signature en ligne — l'URL EST le
        // secret (token hex), signature re-vérifiée côté serveur
        pathname.startsWith('/contrat/') ||
        pathname.startsWith('/api/contracts/')
    )

    // ── Définir si on est sur un panel interne ────────────────
    //
    // /api/nationality/download est un point d'accès RÉSERVÉ au personnel
    // (il vérifie lui-même session + rôle admin/agent), mais il vit hors de
    // /api/admin et /api/agent : il échappait donc à cette exemption.
    //
    // Conséquence observée en production : la page /admin/nationalite
    // s'affichait normalement — elle commence par /admin, donc exemptée —
    // tandis que SON PROPRE téléchargement était refusé par le WAF avec
    // « Accès refusé ». L'administrateur était bloqué dans son back-office
    // par sa seule adresse IP, dont la réputation avait chuté après un
    // changement d'IP opérateur.
    //
    // Le cercle était vicieux : chaque tentative refusée enregistrait une
    // violation de plus, ce qui dégradait encore la réputation de l'IP.
    //
    // Il n'est pas déplacé sous /api/admin car un agent l'utilise aussi
    // (app/agent/nationalite), et le garde du middleware n'y accepte que
    // les rôles administrateurs.
    const isInternalPanelPath = (
        pathname.startsWith('/admin') ||
        pathname.startsWith('/agent') ||
        pathname.startsWith('/client') ||
        pathname.startsWith('/api/admin') ||
        pathname.startsWith('/api/agent') ||
        pathname.startsWith('/api/client') ||
        pathname.startsWith('/api/nationality/download') ||
        isTokenAuthedPublic
    )

    // ─── 1b. COURT-CIRCUIT ANTI-DoS (avant tout appel Supabase) ───
    // Si l'IP est déjà bloquée localement (récidiviste prouvé via violations),
    // on renvoie 403 IMMÉDIATEMENT, sans toucher à Supabase (ni RPC, ni log,
    // ni fingerprint). Effet : sous flood, après quelques hits l'attaquant est
    // servi 100% depuis la RAM → la DB n'est plus saturée (corrige le DoS qui
    // menait au fail-open) et le TTFB reste minimal.
    if (!emergencyBypass && !isIpWhitelisted && !isInternalPanelPath && ip !== 'unknown' && isLocallyBlocked(ip)) {
        return wafBlock('Accès refusé.', 403)
    }

    // ─── 2. FINGERPRINT EXTRACTION ─────────────────────────────
    // Extraire l'empreinte navigateur depuis les headers HTTP
    // Utilisé pour traquer les attaquants même après changement d'IP
    let fingerprintHash = ''
    if (!emergencyBypass && ip !== 'unknown') {
        try {
            const fp = extractFingerprint(request.headers)
            fingerprintHash = fp.hash

            // Enregistrer le fingerprint en arrière-plan (fire-and-forget)
            if (SUPA_URL && SUPA_KEY) {
                registerFingerprint({
                    ip, hash: fp.hash, components: fp.components,
                    supabaseUrl: SUPA_URL, serviceKey: SUPA_KEY,
                })
            }

            // Détection heuristique de navigateurs headless (bots)
            // ── Durcissement : on ne se contente plus d'une alerte 'info'.
            // On DÉGRADE le trust score (l'IP escalade vers tarpit/déception au
            // fil des requêtes via le RPC) ET on applique un tarpit léger immédiat.
            // On ne BLOQUE pas (faux positifs possibles : crawlers SEO légitimes,
            // monitoring) — on ralentit + on laisse le scoring comportemental décider.
            // Un robot VÉRIFIÉ est exempté ici : c'est précisément lui que
            // l'heuristique confondait avec un bot malveillant. Le tarpit de
            // 1,2 s appliqué à chaque page ralentissait en prime l'exploration.
            const headless = detectHeadlessBrowser(request.headers)
            if (headless.isHeadless && !isInternalPanelPath && !isIpWhitelisted && !isVerifiedCrawler) {
                if (SUPA_URL && SUPA_KEY) {
                    // Se déclarer Googlebot depuis une adresse qui n'est pas la
                    // sienne n'est pas une maladresse : on le nomme comme tel.
                    const motif = robot.usurpation
                        ? `USURPATION de ${robot.nom} depuis ${ip}`
                        : `Navigateur headless détecté: IP ${ip} — ${headless.indicators.join(', ')}`
                    createAlert({
                        level: robot.usurpation ? 'critical' : 'warning',
                        message: motif,
                        context: {
                            ip,
                            indicators: headless.indicators,
                            fingerprint: fp.hash,
                            robotRevendique: robot.nom,
                            usurpation: robot.usurpation,
                        },
                        supabaseUrl: SUPA_URL, serviceKey: SUPA_KEY,
                    })
                    // Trust decay : marque l'IP comme suspecte (escalade progressive)
                    updateIpMemory({
                        ip, isAttack: true,
                        attackType: robot.usurpation ? 'crawler_spoofing' : 'headless_browser',
                        supabaseUrl: SUPA_URL, serviceKey: SUPA_KEY,
                    })
                }
                // Tarpit léger (1.2s) — coûteux pour un bot qui scanne en masse,
                // imperceptible pour un crawler légitime occasionnel.
                await applyTarpit(1200)
            }
        } catch { /* fingerprint extraction non-critique */ }
    }

    // ─── 2b. REQUEST SMUGGLING — Headers conflictuels ────────
    // Détecte CL/TE conflicts, TE obfuscation, double CL, CRLF injection
    // C'est TOUJOURS malveillant → blocage immédiat, aucun bypass
    if (!emergencyBypass && ip !== 'unknown') {
        try {
            const smuggling = scanForSmuggling(request.headers)
            if (smuggling.detected) {
                if (SUPA_URL && SUPA_KEY) {
                    logWafEvent({
                        ip, method, path: pathname, userAgent,
                        threatType: 'protocol_attack',
                        detail: `REQUEST SMUGGLING [${smuggling.pattern}]: ${smuggling.detail} (confidence=${smuggling.confidence})`,
                        fingerprintHash,
                        action: 'block',
                        score: smuggling.confidence,
                        supabaseUrl: SUPA_URL, serviceKey: SUPA_KEY,
                    })
                    createAlert({
                        level: 'nuclear',
 message: `HTTP REQUEST SMUGGLING: IP ${ip} — ${smuggling.detail}`,
                        context: { ip, pattern: smuggling.pattern, detail: smuggling.detail, fingerprint: fingerprintHash },
                        supabaseUrl: SUPA_URL, serviceKey: SUPA_KEY,
                    })
                    trackViolation(ip, SUPA_URL, SUPA_KEY, { threatType: 'protocol_attack' })
                    recordLocalViolation(ip)
                }
                return wafBlock('Requête invalide.', 400)
            }
        } catch { /* non-critique */ }
    }

    // ─── 3. HONEYPOT — Déception active sur chemins pièges ───
    // Au lieu de retourner un simple 404, on retourne un faux
    // formulaire WordPress/PHP crédible pour piéger l'attaquant
    if (!emergencyBypass && isHoneypotPath(pathname)) {
        if (SUPA_URL && SUPA_KEY) {
            // Ban immédiat + log
            setCachedIpBlock(ip, true)
            updateIpMemory({ ip, isAttack: true, attackType: 'honeypot', supabaseUrl: SUPA_URL, serviceKey: SUPA_KEY })
            createAlert({
                level: 'critical',
 message: `HONEYPOT : IP ${ip} a tenté d'accéder à ${pathname} — déception activée`,
                context: { ip, path: pathname, fingerprint: fingerprintHash },
                supabaseUrl: SUPA_URL, serviceKey: SUPA_KEY,
            })
            logWafEvent({
                ip, method, path: pathname, userAgent,
                threatType: 'honeypot',
                detail: `Accès au leurre honeypot : ${pathname}`,
                supabaseUrl: SUPA_URL, serviceKey: SUPA_KEY,
            })
            logDeceptionInteraction({
                ip, path: pathname, method,
                attackType: 'honeypot', payloadName: 'fake_wp_login',
                fingerprintHash,
                supabaseUrl: SUPA_URL, serviceKey: SUPA_KEY,
            })

            // Auto-block IP dans ip_blocks
            fetch(`${SUPA_URL}/rest/v1/ip_blocks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`,
                    Prefer: 'resolution=merge-duplicates,return=minimal',
                },
                body: JSON.stringify({
                    ip, reason: `Honeypot déclenché : ${pathname}`,
                    blocked_by: 'auto', violation_count: 5,
                }),
            }).catch(() => {})
        }

        // Retourner un faux payload WordPress crédible
        const honeypotPayload = getDeceptionPayload('honeypot')
        return buildDeceptionResponse(honeypotPayload)
    }

    // ─── 4. WAF SENTINEL RPC — Cerveau décisionnel SQL ───────
    // Appelle waf_evaluate_request() qui retourne l'action optimale
    // basée sur trust score IP + fingerprint + historique
    let rpcHandled = false
    if (!emergencyBypass && !isIpWhitelisted && !isInternalPanelPath && SUPA_URL && SUPA_KEY && ip !== 'unknown') {
        // Refresh le cache des payloads de déception (fire-and-forget)
        refreshDeceptionPayloads(SUPA_URL, SUPA_KEY).catch(() => {})

        const evalResult = await evaluateRequestRPC({
            ip, path: pathname, fingerprintHash, userAgent,
            method,
            supabaseUrl: SUPA_URL, serviceKey: SUPA_KEY,
        })

        if (evalResult) {
            rpcHandled = true

            // Normaliser les actions de l'ENUM WAF Ultimate v2 pour rétrocompatibilité
            let normalizedAction = evalResult.action as string
            if (normalizedAction === 'ban') normalizedAction = 'block'
            if (normalizedAction === 'shadowban') normalizedAction = 'deceive'
            if (normalizedAction === 'challenge') normalizedAction = 'tarpit'
            if (normalizedAction === 'monitor') normalizedAction = 'allow'

            switch (normalizedAction) {
                case 'block': {
                    logWafEvent({
                        ip, method, path: pathname, userAgent,
                        threatType: 'blocked_ip',
                        detail: `WAF Sentinel: ${evalResult.reason} (trust=${evalResult.trust_score}, risk=${evalResult.risk_score || 0})`,
                        fingerprintHash,
                        action: 'block',
                        score: evalResult.risk_score ? Math.round(evalResult.risk_score) : 0,
                        supabaseUrl: SUPA_URL, serviceKey: SUPA_KEY,
                    })
                    recordLocalViolation(ip) // escalade RAM → court-circuit anti-DoS
                    return wafBlock('Accès refusé.', 403)
                }

                case 'deceive': {
                    // ── CORRECTION 3 : Déception contextuelle ──────────
                    // On lance le CRS pour identifier le TYPE d'attaque exact
                    // puis on choisit le payload de déception correspondant
                    // SQLi → faux MySQL, XSS → faux cookie, LFI → faux passwd
                    const searchParams = request.nextUrl.searchParams.toString()
                    const deceiveVerdict = analyzeRequestFast(method, pathname, searchParams, userAgent)
                    const detectedType = deceiveVerdict.topThreat || 'scanner_detection'

                    // Mapper le type CRS vers le type de déception
                    type DeceptionType = 'sql_injection' | 'xss' | 'lfi' | 'rce' | 'scanner_detection' | 'honeypot'
                    const typeMap: Record<string, DeceptionType> = {
                        sql_injection: 'sql_injection',
                        xss: 'xss',
                        lfi: 'lfi',
                        rce: 'rce',
                        command_injection: 'rce',
                        scanner_detection: 'scanner_detection',
                        protocol_attack: 'scanner_detection',
                    }
                    const attackType: DeceptionType = typeMap[detectedType] || 'scanner_detection'

                    // Utiliser le payload RPC si fourni, sinon payload contextuel
                    const payload = evalResult.payload
                        ? {
                            status_code:      evalResult.payload.status_code,
                            content_type:     evalResult.payload.content_type,
                            response_body:    evalResult.payload.response_body,
                            response_headers: evalResult.payload.response_headers || {},
                        }
                        : getDeceptionPayload(attackType)

                    logWafEvent({
                        ip, method, path: pathname, userAgent,
                        threatType: detectedType,
                        detail: `WAF Sentinel DECEIVE [${attackType}]: ${evalResult.reason} (trust=${evalResult.trust_score}, risk=${evalResult.risk_score || 0})`,
                        fingerprintHash,
                        action: 'deceive',
                        score: evalResult.risk_score ? Math.round(evalResult.risk_score) : 0,
                        supabaseUrl: SUPA_URL, serviceKey: SUPA_KEY,
                    })
                    logDeceptionInteraction({
                        ip, path: pathname, method,
                        attackType, payloadName: `sentinel_${attackType}`,
                        fingerprintHash,
                        supabaseUrl: SUPA_URL, serviceKey: SUPA_KEY,
                    })

                    // Nourrir l'apprentissage avec les détails CRS
                    if (deceiveVerdict.blocked && deceiveVerdict.matches[0]?.snippet) {
                        trackViolation(ip, SUPA_URL, SUPA_KEY, {
                            threatType: detectedType,
                            snippet: deceiveVerdict.matches[0].snippet.slice(0, 120),
                        })
                    }

                    return buildDeceptionResponse(payload)
                }

                case 'tarpit': {
                    // Ralentir la réponse pour épuiser les ressources de l'attaquant
                    const delayMs = Math.max(0, Math.min(8000, evalResult.delay_ms || 2000))
                    await applyTarpit(delayMs)

                    logWafEvent({
                        ip, method, path: pathname, userAgent,
                        threatType: 'rate_limit',
                        detail: `WAF Sentinel TARPIT: ${delayMs}ms (trust=${evalResult.trust_score}, risk=${evalResult.risk_score || 0})`,
                        fingerprintHash,
                        action: 'tarpit',
                        responseDelayMs: delayMs,
                        score: evalResult.risk_score ? Math.round(evalResult.risk_score) : 0,
                        supabaseUrl: SUPA_URL, serviceKey: SUPA_KEY,
                    })

                    // ── CORRECTION 4 : Trust decay sur tarpit ─────────
                    // Chaque requête tarpitée dégrade le trust score (-3)
                    // Ça fait progresser l'attaquant vers le blocage/déception
                    updateIpMemory({
                        ip, isAttack: true,
                        attackType: 'tarpit_escalation',
                        supabaseUrl: SUPA_URL, serviceKey: SUPA_KEY,
                    })

                    // Après le tarpit, continuer le traitement normal
                    break
                }

                case 'honeypot': {
                    const hpPayload = getDeceptionPayload('honeypot')
                    logDeceptionInteraction({
                        ip, path: pathname, method,
                        attackType: 'honeypot', payloadName: 'sentinel_honeypot',
                        fingerprintHash,
                        supabaseUrl: SUPA_URL, serviceKey: SUPA_KEY,
                    })
                    return buildDeceptionResponse(hpPayload)
                }

                case 'allow':
                default:
                    // Requête autorisée — continuer normalement
                    break
            }
        }
    }

    // ─── 4b. SYSTÈME IMMUNITAIRE (post-RPC) ───────────────────
    // Couches de détection avancées qui complètent le RPC :
    //   - SSRF, RCE, IDOR, Canary tokens
    //   - CRS observation mode (apprentissage)
    if (rpcHandled && !emergencyBypass && !isAbsoluteBypass(pathname) && !isInternalPanelPath && SUPA_URL && SUPA_KEY) {
        const searchParamsObs = request.nextUrl.searchParams.toString()

        // ── 4b.1 SSRF Detection ──────────────────────────────
        // Scanne les query params et le path pour des IPs internes,
        // cloud metadata endpoints, et schémas dangereux
        try {
            const ssrf = scanForSSRF(pathname, searchParamsObs)
            if (ssrf.detected && ssrf.confidence >= 80) {
                logWafEvent({
                    ip, method, path: pathname, userAgent,
                    threatType: 'ssrf' as ThreatType,
                    detail: `SSRF [${ssrf.category}]: ${ssrf.detail} (confidence=${ssrf.confidence})`,
                    fingerprintHash,
                    action: 'block',
                    score: ssrf.confidence,
                    supabaseUrl: SUPA_URL, serviceKey: SUPA_KEY,
                })
                createAlert({
                    level: ssrf.confidence >= 95 ? 'nuclear' : 'critical',
 message: `SSRF BLOQUÉ: IP ${ip} — ${ssrf.detail}`,
                    context: { ip, category: ssrf.category, pattern: ssrf.pattern, fingerprint: fingerprintHash },
                    supabaseUrl: SUPA_URL, serviceKey: SUPA_KEY,
                })
                trackViolation(ip, SUPA_URL, SUPA_KEY, { threatType: 'ssrf' })
                recordLocalViolation(ip)
                return wafBlock('Requête bloquée par le pare-feu applicatif.', 403)
            }
        } catch { /* non-critique */ }

        // ── 4b.2 RCE Detection ───────────────────────────────
        // Scanne pour désérialisation malveillante, injection shell,
        // SSTI, et expression language injection
        try {
            const rce = scanForRCE(pathname, searchParamsObs)
            if (rce.detected && rce.confidence >= 80) {
                logWafEvent({
                    ip, method, path: pathname, userAgent,
                    threatType: 'command_injection' as ThreatType,
                    detail: `RCE [${rce.category}]: ${rce.detail} (confidence=${rce.confidence})`,
                    fingerprintHash,
                    action: 'block',
                    score: rce.confidence,
                    supabaseUrl: SUPA_URL, serviceKey: SUPA_KEY,
                })
                createAlert({
                    level: rce.confidence >= 95 ? 'nuclear' : 'critical',
 message: `RCE BLOQUÉ [${rce.category}]: IP ${ip} — ${rce.pattern}`,
                    context: { ip, category: rce.category, pattern: rce.pattern, fingerprint: fingerprintHash },
                    supabaseUrl: SUPA_URL, serviceKey: SUPA_KEY,
                })
                trackViolation(ip, SUPA_URL, SUPA_KEY, { threatType: 'command_injection' })
                recordLocalViolation(ip)
                return wafBlock('Requête bloquée par le pare-feu applicatif.', 403)
            }
        } catch { /* non-critique */ }

        // ── 4b.3 IDOR / BOLA Tracking ────────────────────────
        // Surveille l'accès à des IDs différents sur les endpoints API
        // Détecte l'énumération séquentielle et le bruteforce d'UUIDs
        if (pathname.startsWith('/api/')) {
            try {
                const idor = trackIDORAttempt(ip, pathname, searchParamsObs, fingerprintHash)
                if (idor.suspicious && idor.confidence >= 80) {
                    logWafEvent({
                        ip, method, path: pathname, userAgent,
                        threatType: 'scanner_detection' as ThreatType,
                        detail: `IDOR [${idor.pattern}]: ${idor.detail} (${idor.distinctIds} IDs)`,
                        fingerprintHash,
                        action: 'block',
                        score: idor.confidence,
                        supabaseUrl: SUPA_URL, serviceKey: SUPA_KEY,
                    })
                    createAlert({
                        level: 'critical',
 message: `IDOR DÉTECTÉ [${idor.pattern}]: IP ${ip} — ${idor.distinctIds} IDs sur ${idor.endpointPattern}`,
                        context: { ip, pattern: idor.pattern, distinctIds: idor.distinctIds, endpoint: idor.endpointPattern, fingerprint: fingerprintHash },
                        supabaseUrl: SUPA_URL, serviceKey: SUPA_KEY,
                    })
                    trackViolation(ip, SUPA_URL, SUPA_KEY, { threatType: 'enumeration' })
                    recordLocalViolation(ip)
                    return wafBlock('Accès refusé — activité suspecte détectée.', 403)
                }

                // ── Corrélation cross-instance (serverless-safe) ──────
                // Le détecteur mémoire ci-dessus n'a pas flaggé, mais un
                // attaquant réparti sur plusieurs instances Vercel y échappe.
                // persistIDORAttempt agrège l'état dans waf_idor_tracking
                // (TOUTES instances) et renvoie le verdict global.
                const crossInstance = await persistIDORAttempt({
                    ip, fingerprintHash, path: pathname, queryString: searchParamsObs,
                    supabaseUrl: SUPA_URL, serviceKey: SUPA_KEY,
                })
                if (crossInstance && (crossInstance.isSuspicious || crossInstance.rapid)) {
                    logWafEvent({
                        ip, method, path: pathname, userAgent,
                        threatType: 'scanner_detection' as ThreatType,
                        detail: `IDOR cross-instance: ${crossInstance.distinctIds} IDs distincts (DB-agrégé)`,
                        fingerprintHash,
                        action: 'block',
                        score: crossInstance.rapid ? 95 : 85,
                        supabaseUrl: SUPA_URL, serviceKey: SUPA_KEY,
                    })
                    createAlert({
                        level: 'critical',
 message: `IDOR CROSS-INSTANCE: IP ${ip} — ${crossInstance.distinctIds} IDs (agrégé multi-instances)`,
                        context: { ip, distinctIds: crossInstance.distinctIds, fingerprint: fingerprintHash },
                        supabaseUrl: SUPA_URL, serviceKey: SUPA_KEY,
                    })
                    trackViolation(ip, SUPA_URL, SUPA_KEY, { threatType: 'enumeration' })
                    recordLocalViolation(ip)
                    return wafBlock('Accès refusé — activité suspecte détectée.', 403)
                }

                // Parameter tampering check (mass assignment)
                const tampering = checkParameterTampering(searchParamsObs)
                if (tampering.detected) {
                    logWafEvent({
                        ip, method, path: pathname, userAgent,
                        threatType: 'scanner_detection' as ThreatType,
                        detail: `PARAMETER TAMPERING: ${tampering.detail}`,
                        fingerprintHash,
                        action: 'tarpit',
                        supabaseUrl: SUPA_URL, serviceKey: SUPA_KEY,
                    })
                    // Ne bloque pas mais dégrade le trust
                    updateIpMemory({ ip, isAttack: true, attackType: 'mass_assignment', supabaseUrl: SUPA_URL, serviceKey: SUPA_KEY })
                }
            } catch { /* non-critique */ }
        }

        // ── 4b.4 Canary Token Detection ───────────────────────
        // Vérifie si la requête contient un canary token réutilisé
        // (info volée d'un faux payload de déception)
        try {
            refreshCanaryCache(SUPA_URL, SUPA_KEY).catch(() => {})
            const canary = checkCanaryInRequest(pathname, searchParamsObs)
            if (canary.triggered) {
                logWafEvent({
                    ip, method, path: pathname, userAgent,
                    threatType: 'honeypot' as ThreatType,
                    detail: `🐦 CANARY TOKEN: ${canary.detail}`,
                    fingerprintHash,
                    action: 'block',
                    score: 100,
                    supabaseUrl: SUPA_URL, serviceKey: SUPA_KEY,
                })
                createAlert({
                    level: 'nuclear',
 message: `CANARY TOKEN RÉUTILISÉ: IP ${ip} a utilisé des infos volées — ${canary.tokens.join(', ')}`,
                    context: { ip, tokens: canary.tokens, path: pathname, fingerprint: fingerprintHash },
                    supabaseUrl: SUPA_URL, serviceKey: SUPA_KEY,
                })
                // Rapporter chaque token déclenché
                for (const token of canary.tokens) {
                    reportCanaryTriggered({
                        token, ip, path: pathname,
                        context: { userAgent, fingerprint: fingerprintHash },
                        supabaseUrl: SUPA_URL, serviceKey: SUPA_KEY,
                    })
                }
                setCachedIpBlock(ip, true)
                return wafBlock('Accès refusé.', 403)
            }
        } catch { /* non-critique */ }

        // ── 4b.5 CRS OBSERVATION MODE ────────────────────────
        // Le CRS en mode observation (pas de blocage) pour :
        //   - Nourrir l'apprentissage automatique
        //   - Détecter les campagnes
        //   - Récompenser les IPs légitimes
        const obsVerdict = analyzeRequestFast(method, pathname, searchParamsObs, userAgent)

        if (obsVerdict.blocked && obsVerdict.matches.length > 0) {
            const topMatch = obsVerdict.matches[0]
            const isInternalApi = pathname.startsWith('/api/analytics') ||
                                  pathname.startsWith('/api/cron')
            if (!isInternalApi) {
                trackViolation(ip, SUPA_URL, SUPA_KEY, {
                    threatType: obsVerdict.topThreat || 'waf_observe',
                    snippet: topMatch?.snippet?.slice(0, 120),
                })
            }
        } else if (ip !== 'unknown') {
            updateIpMemory({ ip, isAttack: false, supabaseUrl: SUPA_URL, serviceKey: SUPA_KEY })
        }
    }

    // ─── 5. FALLBACK CRS JS (si RPC n'a pas répondu) ─────────
    // Si waf_evaluate_request() n'est pas disponible (DB down, pas de résultat),
    // on utilise la logique CRS JavaScript existante comme filet de sécurité
    if (!rpcHandled && !emergencyBypass) {

        // 5a. Check sous-réseau banni + IP bloquée + trust score
        if (!isIpWhitelisted && !isInternalPanelPath) {
            // ── Fail-safe : blocage LOCAL des récidivistes (Supabase down) ──
            // Même sans DB, un attaquant qui a déjà multiplié les violations sur
            // cette instance est bloqué via la mémoire comportementale RAM.
            if (isLocallyBlocked(ip)) {
                return wafBlock('Accès refusé.', 403)
            }
            if (checkSubnetBanned(ip)) {
                recordLocalViolation(ip)
                return wafBlock('Accès refusé.', 403)
            }
            if (ip !== 'unknown' && await isIpBlocked(ip)) {
                if (SUPA_URL && SUPA_KEY) logWafEvent({
                    ip, method, path: pathname, userAgent,
                    threatType: 'blocked_ip', detail: 'IP dans la liste de blocage (fallback)',
                    supabaseUrl: SUPA_URL, serviceKey: SUPA_KEY,
                })
                return wafBlock('Accès refusé.', 403)
            }
            if (ip !== 'unknown' && SUPA_URL && SUPA_KEY) {
                const { trusted } = await checkIpTrustScore(ip, SUPA_URL, SUPA_KEY)
                if (!trusted) {
                    logWafEvent({
                        ip, method, path: pathname, userAgent,
                        threatType: 'blocked_ip', detail: 'Trust score insuffisant (fallback)',
                        supabaseUrl: SUPA_URL, serviceKey: SUPA_KEY,
                    })
                    return wafBlock('Accès refusé.', 403)
                }
            }
        } else if (!isIpWhitelisted && isInternalPanelPath) {
            if (checkSubnetBanned(ip)) {
                return wafBlock('Accès refusé.', 403)
            }
        }

        // 5b. Géo-blocage
        if (!isIpWhitelisted) {
            const geo = checkGeoBlock(request.headers)
            if (geo.blocked) {
                if (SUPA_URL && SUPA_KEY) logWafEvent({
                    ip, method, path: pathname, userAgent,
                    threatType: 'geo_block', detail: `Pays bloqué: ${geo.country}`,
                    supabaseUrl: SUPA_URL, serviceKey: SUPA_KEY,
                })
                return wafBlock('Accès non autorisé depuis votre région.', 403)
            }
        }

        // 5c. Rate Limiting
        if (!isIpWhitelisted) {
            const rlCategory = getRateLimitCategory(pathname)
            if (checkRateLimit(ip, rlCategory)) {
                if (SUPA_URL && SUPA_KEY) {
                    logWafEvent({
                        ip, method, path: pathname, userAgent,
                        threatType: 'rate_limit', detail: `Catégorie: ${rlCategory}`,
                        supabaseUrl: SUPA_URL, serviceKey: SUPA_KEY,
                    })
                    if (rlCategory !== 'login') {
                        trackViolation(ip, SUPA_URL, SUPA_KEY, { threatType: 'rate_limit' })
                    }
                }
                return wafBlock('Trop de requêtes. Réessayez dans quelques instants.', 429)
            }
        }

        // 5d. WAF CRS OWASP Analysis (fallback)
        if (!isAbsoluteBypass(pathname)) {
            if (isInternalPanelPath) {
                // Panels internes : scanner le User-Agent uniquement
                const verdict = analyzeRequestFast(method, '', '', userAgent)
                if (verdict.blocked) {
                    if (SUPA_URL && SUPA_KEY) {
                        logWafEvent({
                            ip, method, path: pathname, userAgent,
                            threatType: verdict.topThreat as ThreatType || 'scanner_detection',
                            detail: verdict.matches.slice(0, 3).map(m =>
                                `[R${m.ruleId}:${m.target}] ${m.description} — "${m.snippet}"`
                            ).join(' | '),
                            score: verdict.score,
                            supabaseUrl: SUPA_URL, serviceKey: SUPA_KEY,
                        })
                    }
                    return wafBlock('Accès refusé — outil de scanning détecté.', 403)
                }
            } else {
                // Chemins publics : scan complet
                const searchParams = request.nextUrl.searchParams.toString()
                const verdict = analyzeRequestFast(method, pathname, searchParams, userAgent)
                if (verdict.blocked) {
                    const topMatch  = verdict.matches[0]
                    const detailStr = verdict.matches.slice(0, 3).map(m =>
                        `[R${m.ruleId}:${m.target}] ${m.description} — "${m.snippet}"`
                    ).join(' | ')

                    if (SUPA_URL && SUPA_KEY) {
                        logWafEvent({
                            ip, method, path: pathname, userAgent,
                            threatType: verdict.topThreat as ThreatType || 'sql_injection',
                            detail: detailStr,
                            score: verdict.score,
                            supabaseUrl: SUPA_URL, serviceKey: SUPA_KEY,
                        })
                        const isInternalApi = pathname.startsWith('/api/analytics') ||
                                              pathname.startsWith('/api/cron')
                        if (!isInternalApi) {
                            trackViolation(ip, SUPA_URL, SUPA_KEY, {
                                threatType:  verdict.topThreat || 'waf_block',
                                payloadHash: topMatch?.snippet
                                    ? Buffer.from(topMatch.snippet.slice(0, 64)).toString('base64').slice(0, 32)
                                    : undefined,
                                snippet:     topMatch?.snippet?.slice(0, 120),
                            })
                        }
                    }
                    // Fail-safe : compte la violation en RAM (récidive bloquée même DB down)
                    recordLocalViolation(ip)
                    return wafBlock('Requête bloquée par le pare-feu applicatif.', 403)
                }

                // Récompenser les IPs légitimes (trust score +1 en arrière-plan)
                if (SUPA_URL && SUPA_KEY && ip !== 'unknown') {
                    updateIpMemory({ ip, isAttack: false, supabaseUrl: SUPA_URL, serviceKey: SUPA_KEY })
                }
            }
        }
    }

    // ─── 5bis. AUTH DES API DE PANELS (admin / agent) ─────────────
    // Ces routes utilisent la service role key (bypass RLS) et n'étaient PAS
    // protégées par le bloc page-auth ci-dessous (qui ne cible que /admin, /agent…
    // et pas /api/admin…). Sans ce garde, n'importe qui pouvait lire/écrire des
    // données sensibles (messages clients, dossiers, sécurité…) via /api/admin/*.
    // On exige une session valide + le bon rôle, sinon 401/403 JSON.
    // /api/client reste PUBLIC (register, resend-confirmation, etc.).
    const isAdminApi = pathname.startsWith('/api/admin')
    const isAgentApi = pathname.startsWith('/api/agent')
    if ((isAdminApi || isAgentApi) && SUPA_URL && SUPA_KEY) {
        try {
            const supaApi = createServerClient(
                SUPA_URL,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                { cookies: { getAll: () => request.cookies.getAll(), setAll: () => {} } }
            )
            const { data: { user: apiUser } } = await supaApi.auth.getUser()
            if (!apiUser) {
                return new NextResponse(JSON.stringify({ error: 'Non authentifié' }), {
                    status: 401, headers: { 'Content-Type': 'application/json' },
                })
            }
            const adminApi = createClient(SUPA_URL, SUPA_KEY)
            const { data: prof } = await adminApi
                .from('user_profiles').select('role').eq('id', apiUser.id).maybeSingle()
            const apiRole = prof?.role || ''
            const ADMIN_ROLES = ['admin', 'super_admin', 'superadmin']
            const apiOk = isAgentApi
                ? (apiRole === 'agent' || ADMIN_ROLES.includes(apiRole))
                : ADMIN_ROLES.includes(apiRole)
            if (!apiOk) {
                return new NextResponse(JSON.stringify({ error: 'Accès non autorisé' }), {
                    status: 403, headers: { 'Content-Type': 'application/json' },
                })
            }
            return response
        } catch {
            // Fail-closed sur ces routes sensibles : on bloque en cas de doute.
            return new NextResponse(JSON.stringify({ error: 'Erreur d\'authentification' }), {
                status: 401, headers: { 'Content-Type': 'application/json' },
            })
        }
    }

    // ─── 6. AUTH SUPABASE ─────────────────────────────────────
    const isAgentRoute  = pathname.startsWith('/agent')
    const isAdminRoute  = pathname.startsWith('/admin')
    const isClientRoute = pathname.startsWith('/client')
    if (!isAgentRoute && !isAdminRoute && !isClientRoute) return response

    // Pages de login/register/reset : accès public, pas de check auth
    // Sans ça → boucle de redirection infinie (pas de session → redirect login → pas de session → ...)
    if (isAbsoluteBypass(pathname)) return response

    let supabaseResponse = response

    try {
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll: () => request.cookies.getAll(),
                    setAll: (cookiesToSet) => {
                        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                        supabaseResponse = NextResponse.next({ request })
                        Object.entries(secHeaders).forEach(([k, v]) => supabaseResponse.headers.set(k, v))
                        cookiesToSet.forEach(({ name, value, options }) =>
                            supabaseResponse.cookies.set(name, value, options))
                    },
                },
            }
        )

        const { data: { user }, error: userError } = await supabase.auth.getUser()

        const redirectTo = (url: URL) => {
            const redirectRes = NextResponse.redirect(url)
            if (url.pathname.includes('/login')) {
                request.cookies.getAll()
                    .filter(c => c.name.startsWith('sb-'))
                    .forEach(cookie => redirectRes.cookies.delete(cookie.name))
            }
            supabaseResponse.cookies.getAll().forEach(cookie => {
                redirectRes.cookies.set(cookie.name, cookie.value, cookie)
            })
            return redirectRes
        }

        if (userError || !user) {
            const loginUrl = isAdminRoute ? '/admin/login'
                : isClientRoute ? '/client/login'
                : '/agent/login'
            return redirectTo(new URL(loginUrl, request.url))
        }

        // Fix Vercel httpOnly cookie
        request.cookies.getAll()
            .filter(c => c.name.startsWith('sb-'))
            .forEach(cookie => {
                supabaseResponse.cookies.set(cookie.name, cookie.value, {
                    path: '/', httpOnly: false, secure: true,
                    sameSite: 'lax' as const, maxAge: 60 * 60 * 24 * 7,
                })
            })

        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (!serviceKey) return supabaseResponse

        const adminSupabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey)

        const [clientRes, agentRes] = await Promise.all([
            adminSupabase.from('client_profiles').select('id').eq('id', user.id).maybeSingle(),
            adminSupabase.from('user_profiles').select('role').eq('id', user.id).maybeSingle(),
        ])
        const clientProfile = clientRes.data
        const agentProfile  = agentRes.data

        // Espace Client
        if (isClientRoute) {
            if (agentProfile) return redirectTo(new URL('/client/login?error=unauthorized', request.url))
            if (!clientProfile) return redirectTo(new URL('/client/login?error=no-profile', request.url))

            // ─── 2FA Client ───────────────────────────────────
            // Si le client a activé la 2FA et n'a pas encore validé le code
            // pour cette session, on le renvoie vers le défi /client/2fa.
            const is2FAPage = pathname.startsWith('/client/2fa')
            const clientTotpVerified = request.cookies.get('client_totp_verified')?.value
            if (!is2FAPage && clientTotpVerified !== 'true') {
                const { data: totpRow } = await adminSupabase
                    .from('totp_secrets')
                    .select('enabled')
                    .eq('user_id', user.id)
                    .maybeSingle()
                if (totpRow?.enabled) {
                    const redirect2FA = new URL('/client/2fa', request.url)
                    const safeNext = /^\/client\/[a-zA-Z0-9/_-]*$/.test(pathname) ? pathname : '/client/dashboard'
                    redirect2FA.searchParams.set('next', safeNext)
                    return redirectTo(redirect2FA)
                }
            }
            return supabaseResponse
        }

        if (!agentProfile) {
            const loginUrl = isAdminRoute ? '/admin/login?error=unauthorized'
                : '/agent/login?error=unauthorized'
            return redirectTo(new URL(loginUrl, request.url))
        }

        // Isolation stricte des rôles
        const role = agentProfile.role
        const ADMIN_ROLES = ['admin', 'super_admin', 'superadmin']

        if (isAdminRoute && !ADMIN_ROLES.includes(role)) {
            return redirectTo(new URL('/admin/login?error=unauthorized', request.url))
        }
        if (isAgentRoute && role !== 'agent') {
            return redirectTo(new URL('/agent/login?error=unauthorized', request.url))
        }

        // ─── 2FA Check admins ────────────────────────────────
        if (isAdminRoute && ADMIN_ROLES.includes(role)) {
            const totpVerified = request.cookies.get('totp_verified')?.value
            const is2FAPage    = pathname.startsWith('/admin/2fa')

            if (!is2FAPage && totpVerified !== 'true') {
                const { data: totpRow } = await adminSupabase
                    .from('totp_secrets')
                    .select('enabled')
                    .eq('user_id', user.id)
                    .maybeSingle()

                if (totpRow?.enabled) {
                    const redirect2FA = new URL('/admin/2fa', request.url)
                    // next validé côté client dans /admin/2fa/page.tsx
                    const safeNext = /^\/admin\/[a-zA-Z0-9/_-]*$/.test(pathname) ? pathname : '/admin/dashboard'
                    redirect2FA.searchParams.set('next', safeNext)
                    return redirectTo(redirect2FA)
                }
            }
        }

        return supabaseResponse
    } catch (err: unknown) {
        console.error('Middleware catch:', err instanceof Error ? err.message : err)
        return response
    }
}

export const config = {
    matcher: [
        /*
         * Match ALL routes EXCEPT:
         * - _next/static (fichiers statiques Next.js)
         * - _next/image (optimisation images)
         * - favicon.ico, sw.js, robots.txt, sitemap.xml
         * - Fichiers statiques publics (images, fonts, icons)
         */
        '/((?!_next/static|_next/image|favicon\\.ico|sw\\.js|robots\\.txt|sitemap\\.xml|manifest\\.json|icons/|images/|fonts/|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff|woff2|ttf|eot|mp4|webm|mp3|pdf)$).*)',
    ],
}
