import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { eraseByEmail, collectByEmail } from '@/lib/rgpd/erase'
import { verifyRgpdToken } from '@/lib/rgpd/token'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// ══════════════════════════════════════════════════════════════
// POST /api/rgpd/delete  { token }
// Efface/anonymise les données de l'email VÉRIFIÉ par le jeton.
// Retourne le rapport + un nouvel aperçu (devrait être vide) pour
// permettre au client de constater immédiatement l'effacement.
// ══════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
    const body = await request.json().catch(() => ({}))
    const verified = verifyRgpdToken(String(body.token || ''))
    if (!verified) {
        return NextResponse.json({ error: 'Lien invalide ou expiré. Refaites une demande depuis la page « Mes données ».' }, { status: 401 })
    }

    const supabase = createClient(supabaseUrl, serviceKey)
    const report = await eraseByEmail(supabase, verified.email)

    // Preuve de traitement RGPD (sans stocker l'email en clair dans un champ public)
    try {
        await supabase.from('security_logs').insert({
            action: 'rgpd_erasure_self',
            details: { email: verified.email, report, at: new Date().toISOString(), source: 'self-service' },
        })
    } catch { /* table optionnelle */ }

    // Re-collecte pour confirmer
    const after = await collectByEmail(supabase, verified.email)

    return NextResponse.json({
        success: true,
        report,
        cleared: !after.found, // les lignes anonymisées ne matchent plus l'email
        remaining: after.totalRecords,
    })
}
