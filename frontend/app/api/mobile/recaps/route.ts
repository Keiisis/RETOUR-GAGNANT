// ══════════════════════════════════════════════════════════════
//  Mes récaps de dossier MyAfroOrigins — côté application.
//
//  Le client retrouve ses demandes sans avoir à ressaisir sa référence : son
//  compte porte déjà son email, et c'est cet email qui lie la demande. Il peut
//  alors déposer ses pièces depuis son téléphone, là où elles se trouvent
//  vraiment (photo d'un courrier, capture d'écran).
// ══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getMobileUserId } from '@/lib/mobile-auth'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET(req: NextRequest) {
    const clientId = await getMobileUserId(req)
    if (!clientId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const { data: profil } = await supabase
        .from('client_profiles').select('email').eq('id', clientId).maybeSingle()
    const email = String(profil?.email || '').trim().toLowerCase()
    if (!email) return NextResponse.json({ recaps: [] })

    const { data, error } = await supabase
        .from('myafro_recap_requests')
        .select('id, reference, email, statut, situation, recap_ia, montant, devise, created_at')
        .ilike('email', email)
        .order('created_at', { ascending: false })

    if (error) {
        // Table absente tant que la migration 20260820 n'est pas exécutée.
        return NextResponse.json({
            recaps: [],
            migration_requise: /does not exist|schema cache/i.test(error.message),
        })
    }

    const recaps = data || []
    if (recaps.length === 0) return NextResponse.json({ recaps: [] })

    // Les pièces déjà déposées, pour que l'écran ne propose pas un dépôt à
    // l'aveugle et que le client voie ce qu'il a déjà envoyé.
    const { data: pieces } = await supabase
        .from('client_documents')
        .select('id, recap_id, file_name, file_size, created_at')
        .in('recap_id', recaps.map(r => r.id))
        .order('created_at', { ascending: false })

    const parRecap = new Map<string, unknown[]>()
    for (const p of pieces || []) {
        const cle = String(p.recap_id)
        if (!parRecap.has(cle)) parRecap.set(cle, [])
        parRecap.get(cle)!.push(p)
    }

    return NextResponse.json({
        recaps: recaps.map(r => ({ ...r, pieces: parRecap.get(r.id) || [] })),
    })
}
