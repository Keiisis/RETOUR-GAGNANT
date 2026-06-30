import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const sb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const type = searchParams.get('type') // 'partners' | 'applications'

        if (type === 'applications') {
            const status = searchParams.get('status')
            let query = sb().from('partner_applications').select('*').order('created_at', { ascending: false })
            if (status) query = query.eq('status', status)
            const { data, error } = await query
            if (error) return NextResponse.json({ error: error.message }, { status: 500 })
            return NextResponse.json({ applications: data || [] })
        }

        // Default: partners actifs
        const { data, error } = await sb()
            .from('partners')
            .select('*')
            .order('sort_order', { ascending: true })
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ partners: data || [] })
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const { id, table, ...updates } = await request.json()
        if (!id) return NextResponse.json({ error: 'ID manquant' }, { status: 400 })
        const t = table === 'applications' ? 'partner_applications' : 'partners'
        const { error } = await sb().from(t).update(updates).eq('id', id)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true })
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')
        const table = searchParams.get('table') === 'applications' ? 'partner_applications' : 'partners'
        if (!id) return NextResponse.json({ error: 'ID manquant' }, { status: 400 })
        const { error } = await sb().from(table).delete().eq('id', id)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true })
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
    }
}
