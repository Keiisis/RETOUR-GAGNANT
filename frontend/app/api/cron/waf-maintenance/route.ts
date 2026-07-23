// ══════════════════════════════════════════════════════════════
//  CRON — Maintenance quotidienne du WAF
// ──────────────────────────────────────────────────────────────
// S'exécute chaque nuit via Vercel Cron (voir vercel.json).
//
// Appelle la RPC waf_daily_maintenance() qui :
//   • fait décroître les threat scores (decay) — sinon une IP bannie le reste
//     éternellement et la défense ne se concentre jamais sur les menaces vives
//   • purge logs/alertes/campagnes/fingerprints/honeypot/IDOR expirés
//   • réhabilite graduellement les IP inactives + auto-unblock
//   • RAFRAÎCHIT la vue matérialisée waf_threat_dashboard (sinon données figées)
//
//  SUPABASE_SERVICE_ROLE_KEY requis (la fonction est SECURITY DEFINER,
//    GRANT EXECUTE TO service_role).
// ══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { requireCron } from '@/lib/api-guard'
import { recupererPlagesOfficielles, ipDansCidr } from '@/lib/waf'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!


/**
 * Rafraîchit les plages d'adresses des robots d'indexation.
 *
 * Google et Bing publient et modifient ces listes ; les recopier dans le
 * code garantirait qu'elles soient périmées un jour. On les récupère ici,
 * une fois par nuit, pour que le middleware n'ait qu'à lire `waf_config`.
 *
 * Un échec n'interrompt pas la maintenance : les anciennes plages restent
 * en base et continuent de servir.
 */
async function rafraichirPlagesRobots(
    supabase: SupabaseClient,
): Promise<{ total: number; sources: Record<string, number>; erreurs: string[] }> {
    const { plages, sources, erreurs } = await recupererPlagesOfficielles()

    // Aucune plage récupérée : on GARDE la liste existante. Écraser par un
    // tableau vide ferait retomber tous les robots dans l'heuristique
    // headless — exactement le défaut qu'on corrige.
    if (plages.length === 0) {
        return { total: 0, sources, erreurs: [...erreurs, 'aucune plage récupérée — liste conservée'] }
    }

    const { error } = await supabase.from('waf_config').upsert(
        { key: 'crawler_ranges', value: JSON.stringify(plages) },
        { onConflict: 'key' },
    )
    if (error) erreurs.push(`écriture waf_config: ${error.message}`)

    return { total: plages.length, sources, erreurs }
}

/** Score rendu à un robot vérifié injustement pénalisé. */
const SCORE_ROBOT = 90

/**
 * Réhabilite les robots d'indexation dont la confiance a été dégradée.
 *
 * L'heuristique « navigateur sans interface » a fait chuter à 0 des
 * centaines d'adresses Googlebot et Bingbot. Corriger la détection empêche
 * de nouvelles pénalités, mais ne répare pas les anciennes : sans ce
 * rattrapage, ces robots resteraient bloqués indéfiniment.
 *
 * Tourne chaque nuit : si une adresse de robot est pénalisée à tort par un
 * autre chemin du WAF, elle se rétablit d'elle-même sous 24 h.
 */
async function rehabiliterRobots(
    supabase: SupabaseClient,
    plages: string[],
): Promise<{ examinees: number; rehabilitees: number; erreurs: string[] }> {
    const erreurs: string[] = []
    if (plages.length === 0) return { examinees: 0, rehabilitees: 0, erreurs: ['aucune plage connue'] }

    const aReparer: string[] = []
    let examinees = 0
    const TAILLE = 1000

    // Pagination : la table peut contenir des dizaines de milliers d'adresses.
    for (let debut = 0; ; debut += TAILLE) {
        const { data, error } = await supabase
            .from('waf_ip_memory')
            .select('ip, trust_score')
            .lt('trust_score', SCORE_ROBOT)
            .range(debut, debut + TAILLE - 1)

        if (error) {
            erreurs.push(`lecture: ${error.message}`)
            break
        }
        const lignes = (data || []) as Array<{ ip: string; trust_score: number }>
        if (lignes.length === 0) break

        examinees += lignes.length
        for (const l of lignes) {
            if (l.ip && plages.some(p => ipDansCidr(l.ip, p))) aReparer.push(l.ip)
        }
        if (lignes.length < TAILLE) break
    }

    // Mise à jour par lots : une requête par adresse saturerait la base.
    let rehabilitees = 0
    for (let i = 0; i < aReparer.length; i += 100) {
        const lot = aReparer.slice(i, i + 100)
        const { error } = await supabase
            .from('waf_ip_memory')
            .update({
                trust_score: SCORE_ROBOT,
                blocked_count: 0,
                attack_types: [],
                is_trusted: true,
            })
            .in('ip', lot)
        if (error) erreurs.push(`écriture: ${error.message}`)
        else rehabilitees += lot.length
    }

    return { examinees, rehabilitees, erreurs }
}

async function runMaintenance() {
    if (!serviceKey) {
        return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquante' }, { status: 500 })
    }
    const supabase = createClient(supabaseUrl, serviceKey)

    const { data, error } = await supabase.rpc('waf_daily_maintenance')

    if (error) {
        console.error('[CRON/waf-maintenance]', error.message)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const robots = await rafraichirPlagesRobots(supabase)
    if (robots.erreurs.length) {
        console.warn('[CRON/waf-maintenance] plages robots:', robots.erreurs.join(' | '))
    }

    // On relit les plages effectivement en base : si le rafraîchissement a
    // échoué, on réhabilite avec la liste précédente plutôt qu'avec rien.
    const { data: ligneplages } = await supabase
        .from('waf_config').select('value').eq('key', 'crawler_ranges').maybeSingle()
    let plages: string[] = []
    try {
        plages = JSON.parse((ligneplages as { value?: string } | null)?.value || '[]')
    } catch { plages = [] }

    const rehab = await rehabiliterRobots(supabase, plages)
    if (rehab.erreurs.length) {
        console.warn('[CRON/waf-maintenance] réhabilitation robots:', rehab.erreurs.join(' | '))
    }

    return NextResponse.json({
        success: true,
        triggered_at: new Date().toISOString(),
        report: data,
        plages_robots: robots,
        robots_rehabilites: rehab,
    })
}

export async function GET(request: NextRequest) {
    const refus = requireCron(request)
    if (refus) return refus
    return runMaintenance()
}

export async function POST(request: NextRequest) {
    return GET(request)
}
