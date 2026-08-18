// ══════════════════════════════════════════════════════════════
//  POST /api/mobile/proposals/[id]/sign — signer un devis depuis l'app.
//
//  Deux chemins, décidés par le SERVEUR :
//   · signature déjà enregistrée avec `auto_sign = 'auto'` → on l'applique
//     sans rien demander (c'est le sens du réglage : le client a déjà tranché) ;
//   · sinon → on exige un tracé transmis dans la requête.
//
//  Le client ne peut signer QUE la proposition qui lui est adressée : le
//  contrôle se fait sur client_id, ou sur l'email du profil rattaché au jeton.
//  Sans cela, il suffirait de connaître un identifiant pour signer à la place
//  d'un autre.
//
//  Idempotent : une proposition déjà signée n'est pas re-signée.
// ══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getMobileUserId } from '@/lib/mobile-auth'
import { guardPublic, PUBLIC_FORM_LIMIT } from '@/lib/api-guard'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const trop = guardPublic(req, 'mobile/proposals/sign', PUBLIC_FORM_LIMIT)
    if (trop) return trop

    const clientId = await getMobileUserId(req)
    if (!clientId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const { id } = await params
    const body = await req.json().catch(() => ({}))

    const { data: cp } = await supabase
        .from('client_profiles').select('email, nom, prenom').eq('id', clientId).maybeSingle()
    const email = String(cp?.email || '').trim().toLowerCase()

    const { data: prop, error } = await supabase
        .from('ai_client_proposals')
        .select('id, client_id, client_email, sent_to_mobile, signed_at, status, secret_key')
        .eq('id', id)
        .maybeSingle()

    if (error || !prop) return NextResponse.json({ error: 'Proposition introuvable.' }, { status: 404 })

    // Appartenance : identifiant OU email du profil.
    const mienne = prop.client_id === clientId
        || (prop.sent_to_mobile && String(prop.client_email || '').trim().toLowerCase() === email && !!email)
    if (!mienne) return NextResponse.json({ error: 'Proposition non autorisée.' }, { status: 403 })

    if (prop.signed_at) {
        return NextResponse.json({ success: true, deja_signee: true, signed_at: prop.signed_at })
    }

    // Signature enregistrée du client.
    const { data: sig } = await supabase
        .from('client_signatures')
        .select('signature_data, auto_sign')
        .eq('client_id', clientId)
        .maybeSingle()

    const traceFournie = String(body.signature_data || '').trim()
    // Valeurs autorisées : 'ask' | 'auto' | 'never' (cf. /api/mobile/signature).
    // 'never' interdit la signature automatique, même si un tracé est mémorisé.
    const automatique = !traceFournie && sig?.auto_sign === 'auto' && !!sig?.signature_data
    const trace = traceFournie || (automatique ? String(sig!.signature_data) : '')

    if (!trace) {
        return NextResponse.json(
            { error: 'Signature requise.', signature_enregistree: !!sig?.signature_data, auto_sign: sig?.auto_sign || 'ask' },
            { status: 400 },
        )
    }

    const nom = `${cp?.prenom || ''} ${cp?.nom || ''}`.trim() || String(body.signed_name || '').trim() || null
    const nowIso = new Date().toISOString()

    const { error: majErr } = await supabase
        .from('ai_client_proposals')
        .update({
            signed_at: nowIso,
            signature_data: trace,
            signed_name: nom,
            // Le devis passe « accepté » : le paiement devient l'étape suivante.
            status: prop.status === 'paid' ? prop.status : 'accepted',
            updated_at: nowIso,
        })
        .eq('id', id)
        // Garde anti-concurrence : deux signatures simultanées ne peuvent pas
        // toutes deux aboutir.
        .is('signed_at', null)

    if (majErr) return NextResponse.json({ error: majErr.message }, { status: 500 })

    // Mémorise la signature si le client l'a demandé pendant le tracé.
    if (traceFournie && body.memoriser === true) {
        await supabase.from('client_signatures').upsert({
            client_id: clientId,
            signature_data: traceFournie,
            auto_sign: String(body.auto_sign || 'ask'),
            updated_at: nowIso,
        }, { onConflict: 'client_id' }).then(() => undefined, () => undefined)
    }

    await supabase.from('notifications').insert({
        user_id: clientId,
        title: 'Devis signé',
        body: 'Votre devis est signé. Vous pouvez maintenant procéder au règlement depuis l’application.',
        type: 'devis',
        is_read: false,
        created_at: nowIso,
    }).then(() => undefined, () => undefined)

    return NextResponse.json({
        success: true,
        automatique,
        signed_at: nowIso,
        secret_key: prop.secret_key,
    })
}
