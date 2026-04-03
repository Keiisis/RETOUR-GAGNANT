// ══════════════════════════════════════════════════════════════
// ⚙️ WAF ENGINE — Moteur d'analyse principal
// Système de scoring d'anomalies (inspiré OWASP CRS ModSecurity)
// Analyse multi-cibles, règles custom DB, géo-blocage, body inspection
// ══════════════════════════════════════════════════════════════

import { decodeRequest, type RequestParts } from './decoder'
import {
    ALL_RULES, SEVERITY_SCORES, BLOCK_THRESHOLDS,
    type WafRule, type RuleCategory, type Severity
} from './rules'

// ── Types publics ─────────────────────────────────────────────
export type ThreatType =
    | RuleCategory
    | 'rate_limit'
    | 'blocked_ip'
    | 'geo_block'
    | 'custom_rule'

export interface RuleMatch {
    ruleId:      number
    category:    ThreatType
    description: string
    severity:    Severity
    score:       number
    target:      string
    snippet:     string   // extrait suspect (tronqué)
}

export interface WafVerdict {
    blocked:      boolean
    score:        number
    threshold:    number
    matches:      RuleMatch[]
    topThreat:    ThreatType | null
    paranoiaLevel: number
}

// ── Règles custom depuis DB (cache mémoire) ───────────────────
export interface CustomRule {
    id:          string
    pattern:     string
    category:    string
    description: string
    severity:    number
    enabled:     boolean
    targets:     string[]
}

let customRulesCache: CustomRule[] = []
let customRulesCacheTs = 0
const CUSTOM_RULES_TTL = 60_000 // 1 minute

export function setCustomRulesCache(rules: CustomRule[]): void {
    customRulesCache = rules
    customRulesCacheTs = Date.now()
}

export function getCustomRulesCache(): { rules: CustomRule[]; stale: boolean } {
    return {
        rules: customRulesCache,
        stale: Date.now() - customRulesCacheTs > CUSTOM_RULES_TTL,
    }
}

// ── Config WAF (cache mémoire) ────────────────────────────────
interface WafConfig {
    paranoiaLevel:    number  // 1-4
    blockedCountries: string[]
    whitelistedIps:   string[]
    whitelistedPaths: string[]
    enabled:          boolean
}

let wafConfigCache: WafConfig = {
    paranoiaLevel: 1,
    blockedCountries: [],
    whitelistedIps: [],
    whitelistedPaths: [],
    enabled: true,
}
let wafConfigCacheTs = 0

export function setWafConfig(config: Partial<WafConfig>): void {
    wafConfigCache = { ...wafConfigCache, ...config }
    wafConfigCacheTs = Date.now()
}

export function getWafConfig(): WafConfig {
    return wafConfigCache
}

// ── Extraire un snippet sûr (max 120 chars) ───────────────────
function safeSnippet(input: string, match: RegExpExecArray): string {
    const start = Math.max(0, match.index - 20)
    const end   = Math.min(input.length, match.index + 100)
    return input.slice(start, end).replace(/[\x00-\x1f]/g, '?')
}

// ── Tester une règle sur une valeur ──────────────────────────
function testRule(rule: WafRule, value: string, targetName: string): RuleMatch | null {
    const regex = new RegExp(rule.pattern.source, rule.pattern.flags)
    const match = regex.exec(value)
    if (!match) return null

    return {
        ruleId:      rule.id,
        category:    rule.category,
        description: rule.description,
        severity:    rule.severity,
        score:       SEVERITY_SCORES[rule.severity],
        target:      targetName,
        snippet:     safeSnippet(value, match),
    }
}

// ── Tester une règle custom ───────────────────────────────────
function testCustomRule(rule: CustomRule, value: string, targetName: string): RuleMatch | null {
    try {
        const regex = new RegExp(rule.pattern, 'i')
        const match = regex.exec(value)
        if (!match) return null
        const sev = Math.min(5, Math.max(1, rule.severity)) as Severity
        return {
            ruleId:      parseInt(rule.id) || 999000,
            category:    'custom_rule',
            description: rule.description || rule.pattern,
            severity:    sev,
            score:       SEVERITY_SCORES[sev],
            target:      targetName,
            snippet:     safeSnippet(value, match),
        }
    } catch {
        return null
    }
}

// ── Vérifier si un chemin est en whitelist ────────────────────
function isPathWhitelisted(pathname: string, whitelist: string[]): boolean {
    return whitelist.some(p => pathname.startsWith(p) || pathname === p)
}

// ── Analyser une requête complète ─────────────────────────────
export function analyzeRequest(
    method: string,
    pathname: string,
    searchParams: string,
    headers: Headers,
    rawBody?: string,
    paranoiaOverride?: number
): WafVerdict {
    const config = getWafConfig()
    const paranoia = paranoiaOverride ?? config.paranoiaLevel
    const threshold = BLOCK_THRESHOLDS[paranoia] ?? 5

    // Whitelisting de chemin
    if (isPathWhitelisted(pathname, config.whitelistedPaths)) {
        return { blocked: false, score: 0, threshold, matches: [], topThreat: null, paranoiaLevel: paranoia }
    }

    // Décodage multi-couches de toutes les parties
    const parts: RequestParts = decodeRequest(pathname, searchParams, headers, rawBody)

    // Mapping targets → valeurs décodées
    // urlPath séparé de dataDecoded pour éviter faux positifs SQL sur /admin/create
    const targetValues: Record<string, string> = {
        urlPath:     parts.urlPath,
        query:       parts.query,
        userAgent:   parts.userAgent,
        referer:     parts.referer,
        cookie:      parts.cookie,
        body:        parts.body,
        dataDecoded: parts.dataDecoded,  // query+cookie+referer+body (sans urlPath)
        allDecoded:  parts.allDecoded,   // tout y compris urlPath
    }

    const matches: RuleMatch[] = []
    let totalScore = 0

    // ── Règles OWASP CRS ─────────────────────────────────────
    for (const rule of ALL_RULES) {
        // Filtrer par niveau de paranoia
        if (rule.paranoia > paranoia) continue

        // Skip body scan si pas de body
        if (!rawBody && rule.targets.every(t => t === 'body')) continue

        for (const target of rule.targets) {
            const value = targetValues[target]
            if (!value) continue

            const match = testRule(rule, value, target)
            if (match) {
                // Éviter les doublons (même règle, cible différente)
                if (!matches.find(m => m.ruleId === rule.id)) {
                    matches.push(match)
                    totalScore += match.score
                }
                break // une seule cible suffit pour scorer la règle
            }
        }

        // Arrêt anticipé si score dépasse largement le seuil (optimisation)
        if (totalScore >= threshold * 3) break
    }

    // ── Règles custom DB ─────────────────────────────────────
    const { rules: customRules } = getCustomRulesCache()
    for (const rule of customRules) {
        if (!rule.enabled) continue
        for (const target of rule.targets) {
            const value = targetValues[target] || targetValues.all
            if (!value) continue
            const match = testCustomRule(rule, value, target)
            if (match) {
                matches.push(match)
                totalScore += match.score
                break
            }
        }
    }

    // Trier par score décroissant
    matches.sort((a, b) => b.score - a.score)

    const topThreat = matches[0]?.category ?? null
    const blocked = totalScore >= threshold

    return { blocked, score: totalScore, threshold, matches, topThreat, paranoiaLevel: paranoia }
}

// ── Analyse lightweight pour le middleware (sans body) ────────
export function analyzeRequestFast(
    method: string,
    pathname: string,
    searchParams: string,
    userAgent: string,
    paranoia?: number
): WafVerdict {
    const fakeHeaders = new Headers({ 'user-agent': userAgent })
    return analyzeRequest(method, pathname, searchParams, fakeHeaders, undefined, paranoia)
}

// ── Géo-blocage (Vercel injecte x-vercel-ip-country) ─────────
export function checkGeoBlock(headers: Headers): { blocked: boolean; country: string } {
    const country = headers.get('x-vercel-ip-country') || headers.get('cf-ipcountry') || ''
    const config = getWafConfig()
    const blocked = config.blockedCountries.length > 0 && config.blockedCountries.includes(country.toUpperCase())
    return { blocked, country }
}

// ── Résumé textuel du verdict pour les logs ──────────────────
export function verdictSummary(verdict: WafVerdict): string {
    if (!verdict.blocked) return 'PASS'
    return `BLOCK score=${verdict.score}/${verdict.threshold} top=${verdict.topThreat} rules=[${verdict.matches.slice(0, 3).map(m => m.ruleId).join(',')}]`
}
