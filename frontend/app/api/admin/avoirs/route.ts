// ══════════════════════════════════════════════════════════════
//  AVOIRS / REMBOURSEMENTS (notes de crédit)
//  Un avoir annule tout ou partie d'une facture émise. Il porte sa
//  propre série officielle (AV-AAAA-NNNN), reprend la devise et le
//  taux de change FIGÉS de la facture d'origine, et déduit
//  proportionnellement la TVA collectée.
//
//  Garde-fous :
//   • cumul des avoirs ≤ total de la facture (jamais de sur-avoir)
//   • période comptable clôturée → refus
//   • facture d'origine obligatoire et de type « facture »
//   • suppression interdite dès que le remboursement est constaté
// ══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'
import { nextDocumentNumber } from '@/lib/document-numbering'
import { isPeriodLocked } from '@/lib/comptaLock'

export const dynamic = 'force-dynamic'

const db = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

/** Somme des avoirs déjà émis sur une facture. */
async function avoirsExistants(
    supabase: ReturnType<typeof db>, factureId: string,
): Promise<number> {
    const { data } = await supabase
        .from('documents_financiers')
        .select('total')
        .eq('type', 'avoir')
        .eq('avoir_de_facture_id', factureId)
    return (data || []).reduce((a, d) => a + (Number(d.total) || 0), 0)
}

// ─── GET : liste des avoirs (option ?facture_id=…) ────────────
export async function GET(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'agent')
    if (!auth.authenticated) return auth.error!

    const factureId = request.nextUrl.searchParams.get('facture_id')
    let q = db().from('documents_financiers')
        .select('id, numero, client_nom, client_prenom, total, currency, status, motif_avoir, avoir_de_facture_id, created_at, paid_at')
        .eq('type', 'avoir')
        .order('created_at', { ascending: false })
    if (factureId) q = q.eq('avoir_de_facture_id', factureId)

    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ avoirs: data || [] })
}

// ─── POST : émettre un avoir sur une facture ──────────────────
export async function POST(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    const body = await request.json().catch(() => ({}))
    const factureId = String(body.facture_id || '')
    const motif = String(body.motif || '').trim()
    const montantDemande = Number(body.montant)

    if (!factureId) return NextResponse.json({ error: 'Facture d’origine requise.' }, { status: 400 })
    if (!motif) return NextResponse.json({ error: 'Le motif de l’avoir est obligatoire.' }, { status: 400 })

    const supabase = db()

    const { data: facture } = await supabase
        .from('documents_financiers')
        .select('id, type, numero, client_nom, client_prenom, client_email, client_phone, client_adresse, client_ifu, total, total_tva, currency, exchange_rate_applied, agent_id, created_at')
        .eq('id', factureId)
        .maybeSingle()

    if (!facture) return NextResponse.json({ error: 'Facture introuvable.' }, { status: 404 })
    if (facture.type !== 'facture') {
        return NextResponse.json({ error: 'Un avoir ne peut porter que sur une facture.' }, { status: 400 })
    }

    // Verrou de clôture : sur la facture d'origine ET sur la date du jour
    if (await isPeriodLocked(supabase, facture.created_at)) {
        return NextResponse.json({ error: 'Période de la facture clôturée — avoir refusé.' }, { status: 423 })
    }
    if (await isPeriodLocked(supabase, new Date().toISOString())) {
        return NextResponse.json({ error: 'Période courante clôturée — avoir refusé.' }, { status: 423 })
    }

    const totalFacture = Number(facture.total) || 0
    const dejaAvoir = await avoirsExistants(supabase, factureId)
    const restant = Math.max(0, totalFacture - dejaAvoir)

    // Montant : par défaut l'avoir est TOTAL sur le restant
    const montant = isFinite(montantDemande) && montantDemande > 0 ? montantDemande : restant

    if (restant <= 0) {
        return NextResponse.json({ error: 'Cette facture est déjà intégralement avoirée.' }, { status: 400 })
    }
    if (montant > restant + 0.01) {
        return NextResponse.json(
            { error: `Montant trop élevé : ${restant.toLocaleString('fr-FR')} ${facture.currency || 'XOF'} restent avoirables.` },
            { status: 400 },
        )
    }

    // TVA déduite AU PRORATA du montant avoiré (cohérence déclaration DGI)
    const ratio = totalFacture > 0 ? montant / totalFacture : 0
    const tvaAvoir = Math.round((Number(facture.total_tva) || 0) * ratio * 100) / 100
    const sousTotal = Math.round((montant - tvaAvoir) * 100) / 100

    const numero = await nextDocumentNumber(supabase, 'avoir')

    const { data: created, error } = await supabase.from('documents_financiers').insert({
        type: 'avoir',
        numero,
        avoir_de_facture_id: facture.id,
        motif_avoir: motif,
        client_nom: facture.client_nom,
        client_prenom: facture.client_prenom,
        client_email: facture.client_email,
        client_phone: facture.client_phone,
        client_adresse: facture.client_adresse,
        client_ifu: facture.client_ifu,
        agent_id: facture.agent_id,
        // Devise ET taux FIGÉS de la facture : l'avoir doit annuler
        // exactement ce qui a été facturé, pas le cours du jour.
        currency: facture.currency || 'XOF',
        exchange_rate_applied: facture.exchange_rate_applied || 1,
        items: [{
            description: `Avoir sur facture ${facture.numero} — ${motif}`,
            quantity: 1,
            unit_price: montant,
            tva: 0,
        }],
        sous_total: sousTotal,
        total_tva: tvaAvoir,
        remise: 0,
        total: montant,
        status: 'valide',              // émis ; « payé » = remboursement effectué
        notes: `Avoir émis sur la facture ${facture.numero}.\nMotif : ${motif}`,
        conditions: 'Note de crédit — déduite du chiffre d’affaires et de la TVA collectée.',
        validite: 'Sans objet',
    }).select('id, numero').single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
        success: true,
        avoir: created,
        restant_avoirable: Math.max(0, restant - montant),
    })
}

// ─── PATCH : constater le remboursement ───────────────────────
export async function PATCH(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    const body = await request.json().catch(() => ({}))
    const id = String(body.id || '')
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const rembourse = body.rembourse !== false
    const { error } = await db().from('documents_financiers')
        .update({
            status: rembourse ? 'paye' : 'valide',
            paid_at: rembourse ? new Date().toISOString() : null,
        })
        .eq('id', id)
        .eq('type', 'avoir')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
}

// ─── DELETE : annuler un avoir non remboursé ──────────────────
export async function DELETE(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    const id = request.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const supabase = db()
    const { data: avoir } = await supabase
        .from('documents_financiers').select('id, type, status, created_at').eq('id', id).maybeSingle()
    if (!avoir || avoir.type !== 'avoir') return NextResponse.json({ error: 'Avoir introuvable.' }, { status: 404 })
    if (avoir.status === 'paye') {
        return NextResponse.json({ error: 'Avoir déjà remboursé — suppression interdite (traçabilité comptable).' }, { status: 400 })
    }
    if (await isPeriodLocked(supabase, avoir.created_at)) {
        return NextResponse.json({ error: 'Période clôturée — suppression refusée.' }, { status: 423 })
    }

    const { error } = await supabase.from('documents_financiers').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
}
