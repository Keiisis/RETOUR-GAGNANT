'use client'
// ══════════════════════════════════════════════════════════════
//  Ouverture d'une pièce stockée dans Supabase Storage (panels admin/agent).
//
//  L'app mobile enregistre une URL SIGNÉE valable 1 h dans `file_url` : au-delà,
//  le lien des onglets Dossiers ne s'ouvrait plus (audit 29/09/2026). On
//  retrouve le bucket et le chemin depuis l'URL, puis on signe à la demande.
// ══════════════════════════════════════════════════════════════
import { supabase } from '@/lib/supabase'

const BUCKETS = ['dossier-documents', 'client-documents', 'nationality_documents', 'agent-documents', 'genealogia-docs']

/** { bucket, chemin } d'une URL Supabase Storage (publique ou signée), sinon null. */
export function emplacementStockage(url: string): { bucket: string; chemin: string } | null {
    const m = url.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/([^?#]+)/)
    if (m) return { bucket: m[1], chemin: decodeURIComponent(m[2]) }
    for (const b of BUCKETS) {
        const i = url.indexOf(`/${b}/`)
        if (i >= 0) return { bucket: b, chemin: decodeURIComponent(url.slice(i + b.length + 2).split(/[?#]/)[0]) }
    }
    return null
}

/** Ouvre la pièce dans un nouvel onglet avec un lien signé de 5 minutes. */
export async function ouvrirPiece(url: string): Promise<void> {
    // Onglet ouvert tout de suite (clic utilisateur) : sinon le navigateur bloque la fenêtre.
    const fenetre = window.open('', '_blank')
    let lien = url
    const e = emplacementStockage(url)
    if (e) {
        const { data } = await supabase.storage.from(e.bucket).createSignedUrl(e.chemin, 300)
        if (data?.signedUrl) lien = data.signedUrl
    }
    if (fenetre) fenetre.location.href = lien
    else window.location.href = lien
}
