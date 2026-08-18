// ══════════════════════════════════════════════════════════════
//  GET /api/mobile/proposals — les Smart Slides reçus par le client.
//
//  Une proposition apparaît dans l'application quand elle lui est
//  explicitement adressée : `client_id` rempli, ou `sent_to_mobile` avec un
//  email correspondant à son compte. Le rattachement par EMAIL est le repli
//  qui compte : la majorité des enregistrements du projet ne portent pas
//  d'identifiant client (constat mesuré sur dossier_tracking et rdv_requests).
//
//  L'identité vient du JETON. On ne lit jamais un email fourni en paramètre :
//  ce serait ouvrir les propositions d'autrui.
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
    if (!clientId) return NextResponse.json({ error: 'Non authentifié', proposals: [] }, { status: 401 })

    const { data: cp } = await supabase
        .from('client_profiles').select('email').eq('id', clientId).maybeSingle()
    const email = String(cp?.email || '').trim().toLowerCase()

    const criteres = [`client_id.eq.${clientId}`]
    if (email) criteres.push(`and(sent_to_mobile.eq.true,client_email.eq.${email})`)

    const { data, error } = await supabase
        .from('ai_client_proposals')
        .select(`
            id, secret_key, client_name, destination, start_date, end_date,
            total_amount, currency, status, notes,
            sent_at, signed_at, signed_name, view_count, last_viewed_at, created_at
        `)
        .or(criteres.join(','))
        .order('created_at', { ascending: false })
        .limit(50)

    if (error) {
        console.error('[mobile/proposals]', error)
        return NextResponse.json({ error: error.message, proposals: [] }, { status: 500 })
    }

    // Statut d'affichage : ce que le client doit comprendre d'un coup d'œil.
    const proposals = (data || []).map(p => ({
        ...p,
        etat: p.signed_at
            ? (p.status === 'paid' ? 'payee' : 'signee')
            : (p.last_viewed_at ? 'vue' : 'nouvelle'),
    }))

    return NextResponse.json({ proposals })
}
