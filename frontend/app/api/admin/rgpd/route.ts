import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'
import { collectByEmail, eraseByEmail } from '@/lib/rgpd/erase'
import { isEmail } from '@/lib/rgpd/tables'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// ══════════════════════════════════════════════════════════════
// RGPD (admin) — Droit d'accès (GET) & droit à l'effacement (POST).
// Outil interne réservé à l'administration pour honorer une demande,
// identifié par email. Moteur partagé : lib/rgpd/erase.ts.
// ══════════════════════════════════════════════════════════════

// GET /api/admin/rgpd?email=… → aperçu complet des données liées
export async function GET(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    const email = (new URL(request.url).searchParams.get('email') || '').toLowerCase().trim()
    if (!isEmail(email)) return NextResponse.json({ error: 'Email invalide' }, { status: 400 })

    const supabase: SupabaseClient = createClient(supabaseUrl, serviceKey)
    const preview = await collectByEmail(supabase, email)
    return NextResponse.json(preview)
}

// POST /api/admin/rgpd { email, confirm: true } → efface/anonymise
export async function POST(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    const body = await request.json().catch(() => ({}))
    const email = String(body.email || '').toLowerCase().trim()
    if (!isEmail(email)) return NextResponse.json({ error: 'Email invalide' }, { status: 400 })
    if (body.confirm !== true) {
        return NextResponse.json({ error: 'Confirmation requise (confirm: true).' }, { status: 400 })
    }

    const supabase: SupabaseClient = createClient(supabaseUrl, serviceKey)
    const report = await eraseByEmail(supabase, email)

    // Journalise la demande (preuve de traitement RGPD)
    try {
        await supabase.from('security_logs').insert({
            action: 'rgpd_erasure_admin',
            details: { email, report, by: auth.userId, at: new Date().toISOString() },
        })
    } catch { /* table de logs optionnelle */ }

    return NextResponse.json({ success: true, email, report })
}
