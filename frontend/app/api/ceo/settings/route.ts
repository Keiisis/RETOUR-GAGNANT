import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function sb() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    )
}

// GET /api/ceo/settings
export async function GET() {
    const supabase = sb()
    const { data, error } = await supabase
        .from('settings')
        .select('key, value, category')
        .order('key', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ settings: data || [] })
}

// PATCH /api/ceo/settings
export async function PATCH(request: NextRequest) {
    const body = await request.json()
    const { key, value, category } = body
    if (!key) return NextResponse.json({ error: 'key requis' }, { status: 400 })

    const supabase = sb()
    const { data, error } = await supabase
        .from('settings')
        .upsert({ key, value: value ?? '', category: category || 'general' }, { onConflict: 'key' })
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ setting: data })
}
