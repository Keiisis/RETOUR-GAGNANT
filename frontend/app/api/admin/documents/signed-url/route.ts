// ══════════════════════════════════════════════════════════════
//  Ouverture d'une pièce client déposée depuis l'espace en ligne.
//
//  Le bucket `client-documents` est PRIVÉ — ce sont des pièces d'identité et
//  des justificatifs. On ne rend donc jamais d'URL publique : le personnel
//  authentifié obtient une adresse signée valable quelques minutes.
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

    const brut = new URL(request.url).searchParams.get('path') || ''
    if (!brut) return NextResponse.json({ error: 'Chemin manquant.' }, { status: 400 })

    // Anti-traversée : le chemin vient de la base, mais rien n'empêche un
    // appelant d'en forger un autre.
    if (brut.includes('..')) return NextResponse.json({ error: 'Chemin invalide.' }, { status: 400 })

    // Tolère les anciennes lignes en `/uploads/<nom>` (avant que le fichier ne
    // soit réellement téléversé) : elles n'ont pas d'objet en face.
    const chemin = brut.startsWith('/uploads/') ? brut.replace('/uploads/', '') : brut

    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(chemin, DUREE_SECONDES)

    if (error || !data?.signedUrl) {
        return NextResponse.json(
            {
                error: 'Fichier introuvable dans le coffre. '
                    + 'Les pièces déposées avant le 20/08/2026 n’ont jamais été téléversées : demandez au client de la redéposer.',
            },
            { status: 404 },
        )
    }

    return NextResponse.json({ url: data.signedUrl, expire_dans: DUREE_SECONDES })
}
