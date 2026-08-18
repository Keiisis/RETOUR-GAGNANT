// ══════════════════════════════════════════════════════════════
//  Envoyer un Smart Slide DANS L'APPLICATION d'un client.
//
//  Jusqu'ici une proposition ne se partageait que par lien secret : rien ne la
//  rattachait à un compte, donc rien ne pouvait l'afficher dans l'application,
//  et les panels ne distinguaient pas « partagé par lien » de « envoyé à un
//  client ». C'est cette route qui crée le rattachement.
//
//  GET  ?q=…  → recherche d'un compte client (nom, prénom, email)
//  POST       → rattache la proposition au compte + notifie le client
//  DELETE     → détache (la proposition redevient un simple lien secret)
//
//  Réservé au personnel.
// ══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireStaff } from '@/lib/api-guard'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

/** Recherche de comptes clients pour le sélecteur du panel. */
export async function GET(request: NextRequest) {
    const garde = await requireStaff(request, 'agent')
    if (!garde.ok) return garde.response!

    const q = (new URL(request.url).searchParams.get('q') || '').trim()

    let req = supabase
        .from('client_profiles')
        .select('id, nom, prenom, email, phone')
        .order('created_at', { ascending: false })
        .limit(20)

    if (q) {
        const motif = `%${q}%`
        req = req.or(`nom.ilike.${motif},prenom.ilike.${motif},email.ilike.${motif}`)
    }

    const { data, error } = await req
    if (error) return NextResponse.json({ error: error.message, clients: [] }, { status: 500 })
    return NextResponse.json({ clients: data || [] })
}

export async function POST(request: NextRequest) {
    const garde = await requireStaff(request, 'agent')
    if (!garde.ok) return garde.response!

    const body = await request.json().catch(() => ({}))
    const proposalId = String(body.proposal_id || '').trim()
    let clientId = String(body.client_id || '').trim() || null

    if (!proposalId) return NextResponse.json({ error: 'Proposition manquante.' }, { status: 400 })

    const { data: prop } = await supabase
        .from('ai_client_proposals')
        .select('id, client_email, client_name')
        .eq('id', proposalId)
        .maybeSingle()
    if (!prop) return NextResponse.json({ error: 'Proposition introuvable.' }, { status: 404 })

    // Rattachement AUTOMATIQUE par email quand aucun compte n'est désigné :
    // l'agent saisit souvent l'email du client sans penser à le relier.
    let auto = false
    if (!clientId) {
        const email = String(prop.client_email || '').trim().toLowerCase()
        if (!email) {
            return NextResponse.json(
                { error: 'Choisissez un client, ou renseignez son email sur la proposition.' },
                { status: 400 },
            )
        }
        const { data: cp } = await supabase
            .from('client_profiles').select('id').ilike('email', email).maybeSingle()
        if (!cp) {
            return NextResponse.json(
                { error: `Aucun compte ne correspond à ${email}. Choisissez un client dans la liste.` },
                { status: 404 },
            )
        }
        clientId = cp.id
        auto = true
    }

    const nowIso = new Date().toISOString()
    const { error } = await supabase
        .from('ai_client_proposals')
        .update({ client_id: clientId, sent_to_mobile: true, sent_at: nowIso, updated_at: nowIso })
        .eq('id', proposalId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Le client est prévenu dans l'application : sans notification, la
    // proposition attendrait qu'il pense à aller regarder.
    await supabase.from('notifications').insert({
        user_id: clientId,
        title: 'Votre proposition est arrivée',
        body: 'Un conseiller vous a envoyé une proposition illustrée. Consultez-la, signez le devis et réglez depuis l’application.',
        type: 'proposition',
        is_read: false,
        created_at: nowIso,
    }).then(() => undefined, () => undefined)

    return NextResponse.json({ success: true, client_id: clientId, rattachement_auto: auto })
}

/** Détache : la proposition redevient accessible par lien secret uniquement. */
export async function DELETE(request: NextRequest) {
    const garde = await requireStaff(request, 'agent')
    if (!garde.ok) return garde.response!

    const proposalId = new URL(request.url).searchParams.get('proposal_id')
    if (!proposalId) return NextResponse.json({ error: 'Proposition manquante.' }, { status: 400 })

    const { error } = await supabase
        .from('ai_client_proposals')
        .update({ client_id: null, sent_to_mobile: false, sent_at: null })
        .eq('id', proposalId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
}
