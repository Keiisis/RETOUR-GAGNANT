// ══════════════════════════════════════════════════════════════
//  ADMIN/AGENT — Contrats : liste + création
//  Le numéro de série et le token de signature sont générés ici,
//  côté serveur, et ne peuvent plus jamais être modifiés ensuite.
// ══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateSerial, generateSignToken, auditEntry } from '@/lib/contracts'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export async function GET() {
    try {
        const supabase = createClient(supabaseUrl, serviceKey)
        const { data, error } = await supabase
            .from('contracts')
            .select('*')
            .order('created_at', { ascending: false })
        if (error) throw error
        return NextResponse.json({ contracts: data || [] })
    } catch (err) {
        console.error('[contracts GET]', err)
        return NextResponse.json({ error: 'Chargement impossible' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { client_nom, client_email, title, content, amount, currency, expires_at, actor } = body

        if (!client_nom?.trim() || !client_email?.trim() || !title?.trim() || !content?.trim()) {
            return NextResponse.json({ error: 'Nom, email, titre et contenu sont requis.' }, { status: 400 })
        }

        const supabase = createClient(supabaseUrl, serviceKey)
        const serial = await generateSerial(supabase)
        const actorName = String(actor || 'Admin').slice(0, 80)

        const { data, error } = await supabase.from('contracts').insert({
            serial,
            sign_token: generateSignToken(),
            client_nom: String(client_nom).trim(),
            client_email: String(client_email).trim().toLowerCase(),
            title: String(title).trim(),
            content: String(content),
            amount: Number(amount) || 0,
            currency: ['XOF', 'EUR', 'USD'].includes(currency) ? currency : 'XOF',
            status: 'brouillon',
            agent_name: actorName,
            signature_hash: '',
            ...(expires_at ? { expires_at } : {}),
            audit_log: [auditEntry('creation', actorName, `Contrat ${serial} créé (brouillon)`)],
        }).select().single()

        if (error) throw error
        return NextResponse.json({ success: true, contract: data })
    } catch (err) {
        console.error('[contracts POST]', err)
        const msg = err instanceof Error ? err.message : 'Création impossible'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
