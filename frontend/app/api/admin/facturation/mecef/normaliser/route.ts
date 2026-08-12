// ══════════════════════════════════════════════════════════════
//  NORMALISATION AUTOMATIQUE e-MCF / MECeF (DGI Bénin)
//  Appelle l'API DGI pour normaliser une facture et enregistre les champs
//  fiscaux (NIM, code, compteurs, QR, date) sur le document : plus de saisie
//  manuelle. En cas d'échec, renvoie le message exact de la DGI.
// ══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireStaff } from '@/lib/api-guard'
import { getMecefConfig, normalizeInvoice } from '@/lib/mecef'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export async function POST(request: NextRequest) {
    const garde = await requireStaff(request, 'admin')
    if (!garde.ok) return garde.response!

    try {
        const body = await request.json().catch(() => ({}))
        const id = String(body.id || '')
        if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

        const supabase = createClient(supabaseUrl, serviceKey)

        const cfg = await getMecefConfig(supabase)
        if (!cfg.enabled) {
            return NextResponse.json({ error: 'Intégration e-MCF désactivée (Réglages → e-MCF).' }, { status: 400 })
        }

        const { data: doc, error: fetchErr } = await supabase
            .from('documents_financiers')
            .select('*')
            .eq('id', id)
            .maybeSingle()
        if (fetchErr || !doc) return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })
        if (doc.type !== 'facture' && doc.type !== 'avoir') {
            return NextResponse.json({ error: 'Seules les factures et avoirs sont normalisables.' }, { status: 400 })
        }
        if (doc.mecef_nim || doc.mecef_code) {
            return NextResponse.json({ error: 'Cette facture est déjà certifiée.' }, { status: 409 })
        }

        // Appel réel à la DGI (peut lever une erreur avec le message DGI).
        const r = await normalizeInvoice(doc, cfg)

        const { data: updated, error: updErr } = await supabase
            .from('documents_financiers')
            .update({
                mecef_nim: r.nim || null,
                mecef_code: r.code || null,
                mecef_counters: r.counters || null,
                mecef_qr: r.qr || null,
                mecef_datetime: r.datetime,
            })
            .eq('id', id)
            .select()
            .single()
        if (updErr) throw updErr

        return NextResponse.json({ success: true, document: updated, sandbox: cfg.sandbox })
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Normalisation impossible'
        console.error('[mecef normaliser]', msg)
        return NextResponse.json({ error: msg }, { status: 502 })
    }
}
