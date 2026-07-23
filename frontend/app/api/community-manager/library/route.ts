import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireStaff } from '@/lib/api-guard'

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY manquant — impossible de bypasser RLS')
}
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY
)

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// GET /api/community-manager/library
export async function GET(request: NextRequest) {
    const garde = await requireStaff(request, 'agent')
    if (!garde.ok) return garde.response!

    try {
        const { data, error } = await supabaseAdmin
            .from('content_library')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json(data || [])
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
    }
}

// POST /api/community-manager/library — Sauvegarder un contenu
export async function POST(request: NextRequest) {
    const garde = await requireStaff(request, 'agent')
    if (!garde.ok) return garde.response!

    try {
        const body = await request.json()
        const { platform, content_type = 'post', text, hashtags, style_inspiration, viral_score = 0 } = body
        if (!text?.trim()) return NextResponse.json({ error: 'Le texte est obligatoire.' }, { status: 400 })

        // Normaliser hashtags : toujours un tableau de strings
        const safeHashtags: string[] = Array.isArray(hashtags)
            ? hashtags.map(String).filter(Boolean)
            : typeof hashtags === 'string'
            ? hashtags.split(/[\s,]+/).filter(Boolean)
            : []

        const { data, error } = await supabaseAdmin
            .from('content_library')
            .insert({ platform, content_type, text: text.trim(), hashtags: safeHashtags, style_inspiration, viral_score })
            .select()
            .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json(data)
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
    }
}

// PATCH /api/community-manager/library — Toggle favori
export async function PATCH(request: NextRequest) {
    const garde = await requireStaff(request, 'agent')
    if (!garde.ok) return garde.response!

    try {
        const { id, is_favorite } = await request.json()
        if (!id) return NextResponse.json({ error: 'ID manquant.' }, { status: 400 })

        const { error } = await supabaseAdmin
            .from('content_library')
            .update({ is_favorite })
            .eq('id', id)

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true })
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
    }
}

// DELETE /api/community-manager/library?id=xxx
export async function DELETE(request: NextRequest) {
    const garde = await requireStaff(request, 'agent')
    if (!garde.ok) return garde.response!

    try {
        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')
        if (!id) return NextResponse.json({ error: 'ID manquant.' }, { status: 400 })
        if (!UUID_REGEX.test(id)) return NextResponse.json({ error: 'ID invalide.' }, { status: 400 })

        const { error } = await supabaseAdmin.from('content_library').delete().eq('id', id)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true })
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
    }
}
