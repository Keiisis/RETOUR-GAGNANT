// ══════════════════════════════════════════════════════════════
//  Lecture d'un LIEN DE REPRISE MyAfroOrigins (envoyé par l'équipe).
//
//  Le navigateur ne décode plus le jeton lui-même : il le demande ici. C'est
//  le serveur, qui connaît le secret, qui dit si le lien est valide et si le
//  règlement est déjà fait — un jeton recopié à la main et modifié ne peut
//  donc pas faire disparaître l'étape de paiement.
//
//  GET ?t=<jeton> → { valide, prepaye, facture, email, nom, tarif }
// ══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { guardPublic } from '@/lib/api-guard'
import { decodeMyafroToken } from '@/lib/nationality-token'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

/* Lecture seule, appelée à chaque ouverture de la page : un client qui
   recharge dix fois n'est pas un attaquant. Le plafond des formulaires
   (5 par 10 min) le bloquerait. */
const LECTURE_LIEN = { limit: 30, window: 10 * 60_000, blockDuration: 15 * 60_000, blockMultiplier: 2, maxBlockDuration: 2 * 60 * 60_000 }

export async function GET(request: NextRequest) {
    const trop = guardPublic(request, 'recap-myafro/reprise', LECTURE_LIEN)
    if (trop) return trop

    const jeton = new URL(request.url).searchParams.get('t') || ''
    const r = decodeMyafroToken(jeton)
    if (!r) {
        return NextResponse.json(
            { valide: false, error: 'Ce lien a expiré ou n’est pas valide. Demandez-en un nouveau à votre conseiller.' },
            { status: 400 },
        )
    }

    const { data: reglage } = await supabase
        .from('page_sections').select('content')
        .eq('page', 'recap-myafroorigins').eq('section_key', 'form_settings').maybeSingle()
    const c = (reglage?.content || {}) as Record<string, unknown>
    const tarif = { montant: Number(c.amount) > 0 ? Number(c.amount) : 50, devise: String(c.currency || 'EUR').toUpperCase() }

    /* Règlement annoncé : on vérifie DÈS L'OUVERTURE que la facture tient
       toujours, pour que le client ne remplisse pas tout un formulaire avant
       d'apprendre que son lien ne vaut plus rien. Le dépôt revérifie. */
    let facture: { numero: string } | null = null
    let dejaUtilise = false
    if (r.paid) {
        const { data: f } = r.invoice_id
            ? await supabase.from('documents_financiers')
                .select('id, numero, type, status, source_ref').eq('id', r.invoice_id).maybeSingle()
            : { data: null }
        if (!f || f.type !== 'facture' || f.status !== 'paye' || f.source_ref) {
            return NextResponse.json(
                { valide: false, error: 'Le règlement associé à ce lien est introuvable. Contactez votre conseiller.' },
                { status: 409 },
            )
        }
        const { data: deja } = await supabase
            .from('myafro_recap_requests').select('id').eq('facture_id', f.id).limit(1)
        dejaUtilise = !!(deja && deja.length)
        facture = { numero: f.numero }
    }

    return NextResponse.json({
        valide: true,
        prepaye: r.paid,
        facture,
        deja_utilise: dejaUtilise,
        email: r.email,
        nom: r.nom,
        tarif,
    })
}
