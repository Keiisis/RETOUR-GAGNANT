// ══════════════════════════════════════════════════════════════
//  NUMÉROTATION DES DOCUMENTS FINANCIERS
//  Séquentielle, chronologique, continue, sans rupture ni doublon
//  (exigence OHADA / DGI Bénin). Le compteur atomique vit en base
//  (RPC next_document_number). Format : FAC-2026-0001, DEV-2026-0001,
//  AV-2026-0001 — remet à 0001 au 1er janvier.
// ══════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js'

export type DocType = 'facture' | 'devis' | 'avoir'

export function docPrefix(type: DocType): string {
    return type === 'facture' ? 'FAC' : type === 'avoir' ? 'AV' : 'DEV'
}

export function formatDocNumber(type: DocType, year: number, seq: number): string {
    return `${docPrefix(type)}-${year}-${String(seq).padStart(4, '0')}`
}

// Renvoie le prochain numéro séquentiel officiel du document.
// Le compteur en base garantit l'atomicité (aucune collision, aucun
// doublon même sous créations concurrentes). En cas d'indisponibilité
// de la RPC (migration non encore appliquée), on bascule sur un numéro
// temporaire NON séquentiel horodaté — mode dégradé, jamais bloquant.
export async function nextDocumentNumber(
    supabase: SupabaseClient,
    type: DocType,
    when: Date = new Date(),
): Promise<string> {
    const year = when.getFullYear()
    try {
        const { data, error } = await supabase.rpc('next_document_number', { p_type: type, p_year: year })
        if (error) throw error
        const seq = Number(data)
        if (!Number.isFinite(seq) || seq <= 0) throw new Error('Séquence invalide')
        return formatDocNumber(type, year, seq)
    } catch (e) {
        // ── REPLI DÉTERMINISTE (jamais aléatoire) ─────────────────────
        // Un numéro aléatoire brise la continuité exigée par l'OHADA/DGI
        // (trous et ordre incohérent dans la séquence). On lit donc le
        // dernier numéro de l'année et on incrémente. Ce repli n'est pas
        // atomique : il ne doit servir QUE si la RPC est indisponible.
        console.error(
            '[numérotation] RPC next_document_number indisponible — repli séquentiel par lecture du dernier numéro. ' +
            'Appliquez/rétablissez la migration 20260720_facturation_conformite.sql :',
            e instanceof Error ? e.message : e,
        )
        const prefix = docPrefix(type)
        try {
            const { data } = await supabase
                .from('documents_financiers')
                .select('numero')
                .like('numero', `${prefix}-${year}-%`)
                .order('numero', { ascending: false })
                .limit(1)
            const last = data?.[0]?.numero as string | undefined
            const lastSeq = last ? Number(last.split('-').pop()) : 0
            const next = (isFinite(lastSeq) && lastSeq > 0 ? lastSeq : 0) + 1
            return formatDocNumber(type, year, next)
        } catch {
            // Dernier recours : séquence 1 — un doublon éventuel sera visible
            // et corrigeable, contrairement à un numéro aléatoire silencieux.
            return formatDocNumber(type, year, 1)
        }
    }
}
