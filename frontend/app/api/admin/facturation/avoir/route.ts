// ══════════════════════════════════════════════════════════════
//  AVOIR / NOTE DE CRÉDIT
//  En comptabilité normée (OHADA), une facture émise ne se supprime
//  JAMAIS : on émet un avoir qui la crédite. L'avoir porte son propre
//  numéro de série (AV-YYYY-XXXX), référence la facture d'origine et
//  reprend ses montants (crédités). Il entre en comptabilité en
//  contre-passation (voir lib/fec-syscohada + page comptabilité).
// ══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { nextDocumentNumber } from '@/lib/document-numbering'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const factureId = String(body.facture_id || '')
        const motif = String(body.motif || '').trim()
        if (!factureId) return NextResponse.json({ error: 'facture_id requis' }, { status: 400 })
        if (!motif) return NextResponse.json({ error: "Le motif de l'avoir est obligatoire." }, { status: 400 })

        const supabase = createClient(supabaseUrl, serviceKey)

        const { data: facture, error: fErr } = await supabase
            .from('documents_financiers')
            .select('*')
            .eq('id', factureId)
            .single()
        if (fErr || !facture) return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })
        if (facture.type !== 'facture') {
            return NextResponse.json({ error: 'Un avoir ne peut être émis que sur une facture.' }, { status: 400 })
        }

        // Un seul avoir total par facture — évite le double-crédit
        const { data: existing } = await supabase
            .from('documents_financiers')
            .select('id, numero')
            .eq('avoir_de_facture_id', factureId)
            .limit(1)
        if (existing && existing.length > 0) {
            return NextResponse.json({ error: `Un avoir existe déjà pour cette facture (${existing[0].numero}).` }, { status: 400 })
        }

        const numero = await nextDocumentNumber(supabase, 'avoir')
        const now = new Date().toISOString()

        const { data: avoir, error: insErr } = await supabase
            .from('documents_financiers')
            .insert({
                type: 'avoir',
                numero,
                avoir_de_facture_id: facture.id,
                motif_avoir: motif,
                agent_id: facture.agent_id,
                client_nom: facture.client_nom,
                client_prenom: facture.client_prenom,
                client_email: facture.client_email,
                client_phone: facture.client_phone,
                client_adresse: facture.client_adresse,
                client_ifu: facture.client_ifu ?? null,
                items: facture.items,
                currency: facture.currency || 'XOF',
                exchange_rate_applied: facture.exchange_rate_applied ?? 1,
                sous_total: facture.sous_total,
                total_tva: facture.total_tva,
                remise: facture.remise,
                total: facture.total,
                status: 'valide',
                notes: `Avoir annulant la facture N° ${facture.numero}. Motif : ${motif}`,
                conditions: `Le présent avoir crédite intégralement la facture N° ${facture.numero} émise le ${new Date(facture.created_at).toLocaleDateString('fr-FR')}.`,
                validite: now.slice(0, 10),
            })
            .select()
            .single()
        if (insErr) throw insErr

        return NextResponse.json({ success: true, avoir })
    } catch (err) {
        console.error('[avoir POST]', err)
        const msg = err instanceof Error ? err.message : 'Création impossible'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
