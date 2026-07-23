// ══════════════════════════════════════════════════════════════
//  CERTIFICATION e-MCF / MECeF (DGI Bénin)
//  Enregistre sur un document financier les données de certification
//  fiscale : NIM, code de contrôle, compteurs, horodatage, contenu du
//  QR (URL de vérification DGI) + IFU du client.
//  Saisie manuelle aujourd'hui ; une intégration directe à l'API DGI
//  e-MCF pourra alimenter ces mêmes champs automatiquement plus tard.
// ══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireStaff } from '@/lib/api-guard'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const str = (v: unknown) => (v == null ? null : String(v).trim() || null)

export async function POST(request: NextRequest) {
    const garde = await requireStaff(request, 'admin')
    if (!garde.ok) return garde.response!

    try {
        const body = await request.json()
        const id = String(body.id || '')
        if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

        const supabase = createClient(supabaseUrl, serviceKey)
        const update: Record<string, unknown> = {}
        if ('mecef_nim' in body) update.mecef_nim = str(body.mecef_nim)
        if ('mecef_code' in body) update.mecef_code = str(body.mecef_code)
        if ('mecef_counters' in body) update.mecef_counters = str(body.mecef_counters)
        if ('mecef_qr' in body) update.mecef_qr = str(body.mecef_qr)
        if ('client_ifu' in body) update.client_ifu = str(body.client_ifu)
        if ('mecef_datetime' in body) {
            const d = str(body.mecef_datetime)
            update.mecef_datetime = d ? new Date(d).toISOString() : null
        }
        if (Object.keys(update).length === 0) {
            return NextResponse.json({ error: 'Aucun champ à mettre à jour' }, { status: 400 })
        }

        const { data, error } = await supabase
            .from('documents_financiers')
            .update(update)
            .eq('id', id)
            .select()
            .single()
        if (error) throw error
        return NextResponse.json({ success: true, document: data })
    } catch (err) {
        console.error('[mecef POST]', err)
        return NextResponse.json({ error: 'Mise à jour impossible' }, { status: 500 })
    }
}
