import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireLogementManager } from '@/lib/api-guard'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
)

const EMPTY = { stats: [], temoignages: [], faq: [], rarete_active: false, rarete_texte: '' }

// GET : contenu marketing (public).
export async function GET() {
    const { data } = await supabase.from('logement_content').select('*').eq('id', 'main').maybeSingle()
    return NextResponse.json({ content: data || EMPTY })
}

// PATCH : mise à jour (admin). { stats?, temoignages?, faq?, rarete_active?, rarete_texte? }
export async function PATCH(request: NextRequest) {
    const garde = await requireLogementManager(request)
    if (!garde.ok) return garde.response!
    const body = await request.json().catch(() => ({}))
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const k of ['stats', 'temoignages', 'faq', 'rarete_active', 'rarete_texte']) {
        if (k in body) patch[k] = body[k]
    }
    const { data, error } = await supabase
        .from('logement_content')
        .upsert({ id: 'main', ...patch }, { onConflict: 'id' })
        .select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, content: data })
}
