import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Client avec service role key — bypasse RLS pour les opérations admin
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// GET /api/settings/currency — Lire tous les taux depuis la DB
export async function GET() {
    try {
        const { data, error } = await supabaseAdmin
            .from('currencies')
            .select('code, name, symbol, exchange_rate_to_base, is_base, updated_at')
            .order('is_base', { ascending: false })

        if (error) {
            console.error('[currency GET] Supabase error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json(data || [])
    } catch (err) {
        console.error('[currency GET] Exception:', err)
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
}

// PUT /api/settings/currency — Mettre à jour les taux (service role bypasse RLS)
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json()
        // body: [{ code, exchange_rate_to_base }, ...]
        if (!Array.isArray(body)) {
            return NextResponse.json({ error: 'Format invalide, tableau attendu' }, { status: 400 })
        }

        const now = new Date().toISOString()
        const errors: string[] = []

        for (const item of body) {
            if (!item.code || item.exchange_rate_to_base === undefined) continue
            if (item.is_base) continue // Ne jamais modifier la devise de base (XOF)

            const { error } = await supabaseAdmin
                .from('currencies')
                .update({
                    exchange_rate_to_base: Number(item.exchange_rate_to_base),
                    updated_at: now,
                })
                .eq('code', item.code)

            if (error) {
                console.error(`[currency PUT] Erreur mise à jour ${item.code}:`, error)
                errors.push(`${item.code}: ${error.message}`)
            }
        }

        if (errors.length > 0) {
            return NextResponse.json(
                { error: 'Certains taux n\'ont pas pu être mis à jour', details: errors },
                { status: 500 }
            )
        }

        // Relire les taux après sauvegarde pour confirmer
        const { data: updated } = await supabaseAdmin
            .from('currencies')
            .select('code, name, symbol, exchange_rate_to_base, is_base, updated_at')
            .order('is_base', { ascending: false })

        return NextResponse.json({ success: true, currencies: updated || [] })
    } catch (err) {
        console.error('[currency PUT] Exception:', err)
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
}
