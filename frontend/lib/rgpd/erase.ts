// ══════════════════════════════════════════════════════════════
// RGPD : Moteur de collecte (droit d'accès) et d'effacement (droit à l'oubli)
// Utilisé par l'admin ET par le self-service public.
// Tolérant : table/colonne absente = ignorée silencieusement.
// ══════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js'
import { RGPD_TABLES, PII_COLUMNS, ANON, safePreviewRow, type RgpdKind } from './tables'

export interface PreviewSection {
    table: string
    label: string
    kind: RgpdKind
    count: number
    rows: Record<string, unknown>[] // vide pour kind 'document'
}

export interface PreviewResult {
    email: string
    found: boolean
    totalRecords: number
    documentCount: number
    sections: PreviewSection[]
    generatedAt: string
}

// ── Aperçu : ce qu'on détient (documents = comptés, jamais affichés) ──
export async function collectByEmail(supabase: SupabaseClient, email: string): Promise<PreviewResult> {
    const target = email.toLowerCase().trim()
    const sections: PreviewSection[] = []
    let totalRecords = 0
    let documentCount = 0

    for (const cfg of RGPD_TABLES) {
        const seen = new Map<string, Record<string, unknown>>() // dédoublonne si match multi-colonnes
        for (const col of cfg.emailCols) {
            try {
                const { data, error } = await supabase.from(cfg.table).select('*').ilike(col, target)
                if (error || !data) continue
                for (const row of data) {
                    const key = (row as Record<string, unknown>).id != null
                        ? String((row as Record<string, unknown>).id)
                        : JSON.stringify(row)
                    seen.set(key, row as Record<string, unknown>)
                }
            } catch { /* table/colonne absente */ }
        }
        const rows = [...seen.values()]
        if (rows.length === 0) continue

        totalRecords += rows.length
        if (cfg.kind === 'document') {
            documentCount += rows.length
            sections.push({ table: cfg.table, label: cfg.label, kind: 'document', count: rows.length, rows: [] })
        } else {
            sections.push({
                table: cfg.table, label: cfg.label, kind: 'data', count: rows.length,
                rows: rows.map(safePreviewRow).filter(r => Object.keys(r).length > 0),
            })
        }
    }

    return {
        email: target,
        found: totalRecords > 0,
        totalRecords,
        documentCount,
        sections,
        generatedAt: new Date().toISOString(),
    }
}

export interface EraseReport { [table: string]: string }

// ── Effacement : suppression OU anonymisation selon la table ──
export async function eraseByEmail(supabase: SupabaseClient, email: string): Promise<EraseReport> {
    const target = email.toLowerCase().trim()
    const report: EraseReport = {}

    for (const cfg of RGPD_TABLES) {
        let affected = 0
        let touched = false
        for (const col of cfg.emailCols) {
            try {
                if (cfg.mode === 'delete') {
                    const { data, error } = await supabase.from(cfg.table).delete().ilike(col, target).select('id')
                    if (!error && data) { affected += data.length; touched = true }
                } else {
                    // Anonymisation : neutralise les champs PII présents
                    const patch: Record<string, string> = {}
                    for (const f of PII_COLUMNS) patch[f] = ANON
                    const { data, error } = await supabase.from(cfg.table).update(patch).ilike(col, target).select('id')
                    if (!error && data) { affected += data.length; touched = true }
                    else if (error) {
                        // repli minimal : n'anonymiser que la colonne email connue
                        const { data: d2 } = await supabase.from(cfg.table).update({ [col]: ANON }).ilike(col, target).select('id')
                        if (d2) { affected += d2.length; touched = true }
                    }
                }
            } catch { /* table/colonne absente */ }
        }
        if (touched) {
            report[cfg.label] = cfg.mode === 'delete' ? `supprimé (${affected})` : `anonymisé (${affected})`
        }
    }

    return report
}
