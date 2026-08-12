// ══════════════════════════════════════════════════════════════
//  INTÉGRITÉ DES PAIEMENTS : idempotence réelle & rejeu
//  • insertOnce  : l'unicité est garantie par la BASE (index unique sur
//    source_ref), plus par une comparaison de chaînes sujette aux
//    courses entre deux webhooks simultanés.
//  • logWebhookFailure : tout encaissement non enregistré laisse une
//    trace exploitable au lieu d'une simple ligne de log perdue.
//  Les deux fonctionnent AVANT l'application de la migration
//  (dégradation propre : on retombe sur l'ancien comportement).
// ══════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js'

const UNIQUE_VIOLATION = '23505'
const UNDEFINED_COLUMN = '42703'
const UNDEFINED_TABLE = '42P01'

export type InsertOnceResult =
    | { status: 'created'; id: string | null }
    | { status: 'duplicate' }
    | { status: 'error'; message: string }

/**
 * Insère une ligne UNE SEULE FOIS pour une origine donnée.
 * @param sourceRef clé d'origine stable, ex. « proposal:a976a4fc-0a2 »
 * @param legacyMatch repli si la colonne source_ref n'existe pas encore
 */
export async function insertOnce(
    supabase: SupabaseClient,
    table: string,
    row: Record<string, unknown>,
    sourceRef: string,
    legacyMatch?: { column: string; pattern: string },
): Promise<InsertOnceResult> {
    // 1) Voie nominale : contrainte d'unicité en base
    const first = await supabase.from(table).insert({ ...row, source_ref: sourceRef }).select('id').single()
    if (!first.error) return { status: 'created', id: first.data?.id ?? null }

    if (first.error.code === UNIQUE_VIOLATION) return { status: 'duplicate' }

    if (first.error.code !== UNDEFINED_COLUMN) {
        return { status: 'error', message: first.error.message }
    }

    // 2) Repli : colonne source_ref absente (migration non appliquée)
    if (legacyMatch) {
        const { data: existing } = await supabase
            .from(table).select('id').ilike(legacyMatch.column, legacyMatch.pattern).maybeSingle()
        if (existing) return { status: 'duplicate' }
    }
    const second = await supabase.from(table).insert(row).select('id').single()
    if (second.error) {
        return second.error.code === UNIQUE_VIOLATION
            ? { status: 'duplicate' }
            : { status: 'error', message: second.error.message }
    }
    return { status: 'created', id: second.data?.id ?? null }
}

/**
 * Journalise un encaissement qui n'a PAS pu être enregistré.
 * Ne lève jamais : un échec de journalisation ne doit pas masquer
 * l'erreur d'origine.
 */
export async function logWebhookFailure(
    supabase: SupabaseClient,
    p: {
        provider: string
        eventType?: string
        reference?: string
        payload?: unknown
        error: string
    },
): Promise<void> {
    try {
        const { error } = await supabase.from('webhook_failures').insert({
            provider: p.provider,
            event_type: p.eventType || null,
            reference: p.reference || null,
            payload: (p.payload as Record<string, unknown>) ?? {},
            error_message: p.error.slice(0, 2000),
        })
        if (error && error.code !== UNDEFINED_TABLE) {
            console.error('[webhook-failure] journalisation impossible:', error.message)
        }
        if (error?.code === UNDEFINED_TABLE) {
            console.error('[webhook-failure] table absente (migration 20260723_integrite_paiements.sql)-', p.provider, p.reference, p.error)
        }
    } catch (e) {
        console.error('[webhook-failure]', e instanceof Error ? e.message : e)
    }
}
