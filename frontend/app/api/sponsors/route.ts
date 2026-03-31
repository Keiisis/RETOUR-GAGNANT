import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

// GET — liste des sponsors (publique: is_active=true, admin: tous)
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const isAdmin = searchParams.get('admin') === 'true'

        let query = supabase
            .from('sponsors')
            .select('*')
            .order('sort_order', { ascending: true })

        if (!isAdmin) {
            query = query.eq('is_active', true)
        }

        const { data, error } = await query
        if (error) throw error

        return NextResponse.json({ sponsors: data || [] })
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Erreur serveur' },
            { status: 500 }
        )
    }
}

// POST — créer un sponsor (admin)
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { name, logo_url, website_url, sort_order, is_active } = body

        if (!name?.trim()) {
            return NextResponse.json({ error: 'Nom requis' }, { status: 400 })
        }

        const { data, error } = await supabase
            .from('sponsors')
            .insert({
                name: name.trim(),
                logo_url: logo_url || null,
                website_url: website_url || null,
                sort_order: sort_order ?? 0,
                is_active: is_active !== false,
            })
            .select()
            .single()

        if (error) throw error
        return NextResponse.json({ sponsor: data }, { status: 201 })
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Erreur serveur' },
            { status: 500 }
        )
    }
}
