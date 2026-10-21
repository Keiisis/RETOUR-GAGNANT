import { supabase } from '@/lib/supabase'
import { natFetch } from '@/lib/nationality-flow'

// ══════════════════════════════════════════════════════════════
//  DÉPÔT D'UNE PIÈCE DANS `nationality_documents` (navigateur)
//  /api/nationality/upload-file plafonne le fichier à 4,4 Mo (corps de
//  requête Vercel ~4,5 Mo). Un scan PDF plus lourd y était refusé
//  (« Fichier trop volumineux pour le dépôt serveur. ») sans autre voie :
//  le client ne pouvait PAS transmettre ses pièces.
//   1) ≤ 4,4 Mo : voie serveur (service role, la plus fiable).
//   2) Au-delà, ou si le serveur refuse : URL signée par le serveur puis
//      transfert direct navigateur → Storage, sans plafond Vercel.
//  Renvoie le chemin Storage (`nat-…/…`) ; lève une erreur lisible sinon.
// ══════════════════════════════════════════════════════════════

const BUCKET = 'nationality_documents'
const SERVER_MAX = 4_400_000

export async function deposerPieceNationalite(file: File, key: string): Promise<string> {
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase()
    let motif = ''

    if (file.size <= SERVER_MAX) {
        try {
            const fd = new FormData()
            fd.append('file', file)
            fd.append('key', key)
            fd.append('ext', ext)
            const r = await natFetch('/api/nationality/upload-file', { method: 'POST', body: fd })
            const j = await r.json().catch(() => ({}))
            if (r.ok && j.path) return String(j.path)
            motif = j.error || `serveur HTTP ${r.status}`
        } catch (e) {
            motif = e instanceof Error ? e.message : 'réseau serveur'
        }
    }

    const r = await natFetch('/api/nationality/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: [{ key, ext }] }),
    })
    const j = await r.json().catch(() => ({}))
    const sig = Array.isArray(j.uploads) ? j.uploads[0] : null
    if (!r.ok || !sig?.path || !sig?.token) {
        throw new Error(j.error || motif || `Préparation du dépôt refusée (HTTP ${r.status}).`)
    }
    const { error } = await supabase.storage.from(BUCKET).uploadToSignedUrl(sig.path, sig.token, file)
    if (error) throw new Error(`Envoi refusé : ${error.message}`)
    return String(sig.path)
}
