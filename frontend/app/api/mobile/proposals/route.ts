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
import { motifEmailExact } from '@/lib/email-motif'

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

    /* DEUX lectures plutôt qu'un `.or()` : l'email était injecté brut dans le
       filtre PostgREST (séparateurs non échappés) et comparé à la casse près. */
    const CHAMPS = `
        id, secret_key, client_name, destination, start_date, end_date,
        total_amount, currency, status, notes,
        sent_at, signed_at, signed_name, view_count, last_viewed_at, created_at
    `
    const [parCompte, parEmail] = await Promise.all([
        supabase.from('ai_client_proposals').select(CHAMPS)
            .eq('client_id', clientId).order('created_at', { ascending: false }).limit(50),
        email
            ? supabase.from('ai_client_proposals').select(CHAMPS)
                .eq('sent_to_mobile', true).ilike('client_email', motifEmailExact(email) ?? '\u0000')
                .order('created_at', { ascending: false }).limit(50)
            : Promise.resolve({ data: [], error: null }),
    ])
    const error = parCompte.error || parEmail.error
    const vus = new Set<string>()
    const data = [...(parCompte.data || []), ...(parEmail.data || [])]
        .filter(p => (vus.has(p.id) ? false : (vus.add(p.id), true)))
        .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
        .slice(0, 50)

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
