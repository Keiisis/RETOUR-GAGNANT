// ══════════════════════════════════════════════════════════════
//  Pièces d'un récap de dossier — côté panel.
//
//  ?id=<recap>    → la liste des pièces de cette demande
//  ?piece=<id>    → une adresse SIGNÉE pour ouvrir la pièce
//
//  Le bucket `client-documents` est privé : ce sont des captures de dossiers
//  administratifs et parfois des actes d'état civil. Aucune adresse permanente
//  n'est jamais rendue, seulement un lien de quelques minutes.
// ══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireStaff } from '@/lib/api-guard'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const BUCKET = 'client-documents'
const DUREE_SECONDES = 300

export async function GET(request: NextRequest) {
    const garde = await requireStaff(request, 'agent')
    if (!garde.ok) return garde.response!

    const p = new URL(request.url).searchParams
    const pieceId = p.get('piece')
    const recapId = p.get('id')

    // ── Ouverture d'une pièce ──
    if (pieceId) {
        const { data: piece } = await supabase
            .from('client_documents')
            .select('file_url, storage_path, file_name')
            .eq('id', pieceId)
            .maybeSingle()

        const chemin = piece?.storage_path || piece?.file_url
        if (!chemin) return NextResponse.json({ error: 'Pièce introuvable.' }, { status: 404 })
        if (String(chemin).includes('..')) {
            return NextResponse.json({ error: 'Chemin invalide.' }, { status: 400 })
        }

        const { data, error } = await supabase.storage
            .from(BUCKET)
            .createSignedUrl(String(chemin).replace(/^\/uploads\//, ''), DUREE_SECONDES)

        if (error || !data?.signedUrl) {
            return NextResponse.json({ error: 'Fichier absent du coffre.' }, { status: 404 })
        }
        return NextResponse.json({ url: data.signedUrl })
    }

    // ── Liste des pièces d'une demande ──
    if (!recapId) return NextResponse.json({ error: 'Demande manquante.' }, { status: 400 })

    const { data, error } = await supabase
        .from('client_documents')
        .select('id, file_name, file_type, file_size, status, source, created_at')
        .eq('recap_id', recapId)
        .order('created_at', { ascending: false })

    if (error) {
        // Colonne absente tant que la migration 20260821 n'est pas exécutée :
        // on le dit, plutôt que d'afficher « aucune pièce » à tort.
        return NextResponse.json({
            pieces: [],
            migration_requise: /column .* does not exist|schema cache/i.test(error.message),
        })
    }

    return NextResponse.json({ pieces: data || [] })
}
