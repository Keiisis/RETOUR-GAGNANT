// ══════════════════════════════════════════════════════════════
//  JOURNAL D'AUDIT COMPTABLE
//  Trace QUI a modifié QUOI sur les écritures (dépenses, paiements,
//  avoirs), avec les valeurs avant/après. Ne lève jamais : un échec
//  de journalisation ne doit pas bloquer l'opération métier, mais il
//  est signalé dans les logs.
// ══════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js'

export type AuditTable =
    | 'depenses'
    | 'paiements_manuels'
    | 'documents_financiers'
    /** Taux de change : modifier une ligne modifie tous les encaissements. */
    | 'currencies'
export type AuditAction = 'create' | 'update' | 'delete'

/** Ne conserve que les champs réellement modifiés (avant ≠ après). */
function diff(
    avant: Record<string, unknown> | null,
    apres: Record<string, unknown> | null,
): { avant: Record<string, unknown>; apres: Record<string, unknown> } {
    if (!avant) return { avant: {}, apres: apres || {} }
    if (!apres) return { avant, apres: {} }
    const a: Record<string, unknown> = {}
    const b: Record<string, unknown> = {}
    for (const k of Object.keys(apres)) {
        if (JSON.stringify(avant[k]) !== JSON.stringify(apres[k])) {
            a[k] = avant[k] ?? null
            b[k] = apres[k] ?? null
        }
    }
    return { avant: a, apres: b }
}

export async function logAudit(
    supabase: SupabaseClient,
    p: {
        table: AuditTable
        recordId: string
        action: AuditAction
        acteur?: { userId?: string; email?: string | null; role?: string | null }
        avant?: Record<string, unknown> | null
        apres?: Record<string, unknown> | null
        motif?: string | null
    },
): Promise<void> {
    try {
        const d = p.action === 'update'
            ? diff(p.avant || null, p.apres || null)
            : { avant: p.avant || {}, apres: p.apres || {} }

        // Rien n'a changé → aucune trace inutile
        if (p.action === 'update' && Object.keys(d.apres).length === 0) return

        const { error } = await supabase.from('audit_compta').insert({
            table_cible: p.table,
            record_id: p.recordId,
            action: p.action,
            acteur_id: p.acteur?.userId || null,
            acteur_email: p.acteur?.email || null,
            acteur_role: p.acteur?.role || null,
            avant: d.avant,
            apres: d.apres,
            motif: p.motif || null,
        })
        // Table absente (migration non appliquée) : on le signale sans bruit
        if (error && error.code !== '42P01') {
            console.error('[audit-compta]', error.message)
        }
    } catch (e) {
        console.error('[audit-compta]', e instanceof Error ? e.message : e)
    }
}
