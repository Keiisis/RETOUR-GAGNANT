// ══════════════════════════════════════════════════════════════
//  Le PDF d'un rapport hebdomadaire.
//
//  Même cloisonnement que la liste : un agent ne télécharge que les siens.
//  La règle est appliquée dans la REQUÊTE (`.eq('auteur_id', …)`) et non après
//  coup — un rapport qui ne lui appartient pas n'est jamais chargé en mémoire,
//  et la réponse est « introuvable » plutôt qu'« interdit » : on ne confirme
//  pas l'existence d'un document qu'on n'a pas le droit de lire.
// ══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireStaff } from '@/lib/api-guard'
import { normaliserContenu } from '@/lib/rapport-hebdo'
import { rapportHebdoPdf } from '@/lib/rapport-hebdo-pdf'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET(request: NextRequest) {
    const garde = await requireStaff(request, 'agent')
    if (!garde.ok) return garde.response!

    const id = new URL(request.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Rapport manquant.' }, { status: 400 })

    let req = supabase.from('rapports_hebdo').select('*').eq('id', id)
    if (!garde.isAdmin) req = req.eq('auteur_id', garde.userId!)

    const { data, error } = await req.maybeSingle()
    if (error || !data) return NextResponse.json({ error: 'Rapport introuvable.' }, { status: 404 })

    const pdf = rapportHebdoPdf(
        {
            auteur_nom: String(data.auteur_nom || ''),
            auteur_role: data.auteur_role,
            destinataire: String(data.destinataire || 'Madame la Directrice Générale'),
            semaine_du: String(data.semaine_du),
            semaine_au: data.semaine_au,
            titre: data.titre,
        },
        normaliserContenu(data.contenu),
    )

    const nom = `Rapport_Hebdo_${String(data.auteur_nom || 'RGB').replace(/[^A-Za-z0-9]+/g, '_')}_${data.semaine_du}`
    return new NextResponse(new Uint8Array(pdf), {
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${nom}.pdf"`,
            'Cache-Control': 'private, no-store',
        },
    })
}