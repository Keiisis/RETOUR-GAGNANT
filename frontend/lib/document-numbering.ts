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
        console.error('[numérotation] RPC next_document_number indisponible — numéro temporaire (appliquez la migration 20260720_facturation_conformite.sql) :', e instanceof Error ? e.message : e)
        const mn = String(when.getMonth() + 1).padStart(2, '0')
        const rand = String(when.getTime() % 10000).padStart(4, '0')
        return `${docPrefix(type)}-${year}${mn}-${rand}`
    }
}
