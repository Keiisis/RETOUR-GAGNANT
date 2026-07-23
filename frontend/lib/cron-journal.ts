// ══════════════════════════════════════════════════════════════
//  JOURNAL D'EXÉCUTION DES TÂCHES PLANIFIÉES
//
//  Problème résolu : « est-ce que tous les crons fonctionnent ? » n'avait
//  aucune réponse consultable. Un cron muet, un cron qui plante et un cron
//  qui n'est même pas déclaré se ressemblent tous — il fallait ouvrir les
//  journaux Vercel pour trancher, quand on y pense.
//
//  Chaque exécution laisse désormais une ligne : quand, combien de temps,
//  réussi ou non, et le message d'erreur le cas échéant. La question se
//  répond alors d'une requête, sans quitter la base.
//
//  Ne lève JAMAIS : un défaut de journalisation ne doit pas empêcher une
//  relance de facture de partir. Table absente (migration non appliquée)
//  → silencieux, la tâche s'exécute quand même.
// ══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireCron } from '@/lib/api-guard'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export type EtatCron = 'succes' | 'echec' | 'erreur'

interface Trace {
    tache: string
    etat: EtatCron
    duree_ms: number
    statut_http: number | null
    detail: string | null
}

async function ecrireTrace(t: Trace): Promise<void> {
    if (!supabaseUrl || !serviceKey) return
    try {
        const supabase = createClient(supabaseUrl, serviceKey)
        const { error } = await supabase.from('cron_runs').insert({
            tache: t.tache,
            etat: t.etat,
            duree_ms: t.duree_ms,
            statut_http: t.statut_http,
            detail: t.detail,
        })
        // 42P01 = table absente : la migration n'est pas encore passée.
        if (error && error.code !== '42P01') {
            console.error('[cron-journal]', error.message)
        }
    } catch (e) {
        console.error('[cron-journal]', e instanceof Error ? e.message : e)
    }
}

/** Extrait un message utile du corps d'une réponse en échec. */
async function detailReponse(res: Response): Promise<string | null> {
    try {
        const texte = await res.clone().text()
        return texte.slice(0, 500) || null
    } catch {
        return null
    }
}

/**
 * Exécute une tâche planifiée : garde du secret, puis journalisation.
 *
 * Remplace le couple `requireCron` + appel direct dans les routes cron.
 * Une requête refusée n'est PAS journalisée : le journal doit rester la
 * liste des exécutions réelles, pas un second journal de sécurité (celui-là
 * existe déjà côté WAF).
 *
 *   export async function GET(request: NextRequest) {
 *       return executerCron('cleanup', request, runPurge)
 *   }
 */
export async function executerCron(
    tache: string,
    request: Request,
    traitement: () => Promise<Response>,
): Promise<Response> {
    const refus = requireCron(request)
    if (refus) return refus

    const debut = Date.now()
    try {
        const res = await traitement()
        const duree = Date.now() - debut

        await ecrireTrace({
            tache,
            etat: res.ok ? 'succes' : 'echec',
            duree_ms: duree,
            statut_http: res.status,
            detail: res.ok ? null : await detailReponse(res),
        })
        return res
    } catch (e) {
        const duree = Date.now() - debut
        const message = e instanceof Error ? e.message : String(e)

        await ecrireTrace({
            tache, etat: 'erreur', duree_ms: duree,
            statut_http: null, detail: message.slice(0, 500),
        })

        // On répond 500 plutôt que de laisser l'exception remonter : Vercel
        // marquerait l'invocation en échec sans qu'on sache pourquoi.
        console.error(`[cron/${tache}]`, message)
        return NextResponse.json(
            { error: 'Échec de la tâche planifiée', tache, detail: message.slice(0, 200) },
            { status: 500 },
        )
    }
}
