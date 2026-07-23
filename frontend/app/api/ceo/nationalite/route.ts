import { NextRequest, NextResponse } from 'next/server'
import { verifyApiAuth } from '@/lib/api-auth'
import { createClient } from '@supabase/supabase-js'

const sb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// GET /api/ceo/nationalite
export async function GET(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    try {
        const { data, error } = await sb()
            .from('nationalite_requests')
            .select('*')
            .order('created_at', { ascending: false })

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ requests: data || [] })
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
    }
}

// PATCH /api/ceo/nationalite — Update status
export async function PATCH(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    try {
        const { id, status, notes } = await request.json()
        if (!id) return NextResponse.json({ error: 'ID manquant' }, { status: 400 })
        const { error } = await sb()
            .from('nationalite_requests')
            .update({ status, notes, updated_at: new Date().toISOString() })
            .eq('id', id)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true })
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
    }
}
