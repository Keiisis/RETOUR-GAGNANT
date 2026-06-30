import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'
import { isPeriodLocked } from '@/lib/comptaLock'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'agent')
    if (!auth.authenticated) return auth.error!

    const body = await request.json()
    const { document_id, agent_id, type, montant, date_paiement, reference, notes } = body

    if (!document_id || !montant || !type) {
        return NextResponse.json({ error: 'Champs requis manquants' }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    // LOT 3 — Verrou période clôturée
    const datePaiement = date_paiement || new Date().toISOString().split('T')[0]
    if (await isPeriodLocked(supabase, datePaiement)) {
        return NextResponse.json(
            { error: 'Période clôturée — paiement refusé. Rouvrez la clôture pour modifier.' },
            { status: 423 }
        )
    }

    const { error } = await supabase.from('paiements_manuels').insert({
        document_id,
        agent_id: agent_id || null,
        type,
        montant: Number(montant),
        date_paiement: datePaiement,
        reference: reference || null,
        notes: notes || null,
    })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
}
