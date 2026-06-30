import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Service role — bypasse RLS (obligatoire)
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY manquant — impossible de bypasser RLS')
}
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY
)

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// GET /api/community-manager/profiles
export async function GET() {
    try {
        const { data, error } = await supabaseAdmin
            .from('social_profiles')
            .select('*')
            .order('created_at', { ascending: false })

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json(data || [])
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
    }
}

// POST /api/community-manager/profiles — Créer un profil
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { platform, profile_url, username, notes } = body

        if (!profile_url?.trim() || !username?.trim()) {
            return NextResponse.json({ error: 'URL et nom d\'utilisateur obligatoires.' }, { status: 400 })
        }
        if (!['facebook', 'instagram', 'tiktok', 'linkedin', 'twitter', 'google_maps'].includes(platform)) {
            return NextResponse.json({ error: 'Plateforme invalide.' }, { status: 400 })
        }

        const { data, error } = await supabaseAdmin
            .from('social_profiles')
            .insert({ platform, profile_url: profile_url.trim(), username: username.trim(), notes: notes?.trim() || null })
            .select()
            .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json(data)
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
    }
}

// PATCH /api/community-manager/profiles — Mettre à jour last_analyzed_at
export async function PATCH(request: NextRequest) {
    try {
        const { id, last_analyzed_at } = await request.json()
        if (!id) return NextResponse.json({ error: 'ID manquant.' }, { status: 400 })

        const { error } = await supabaseAdmin
            .from('social_profiles')
            .update({ last_analyzed_at: last_analyzed_at || new Date().toISOString() })
            .eq('id', id)

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true })
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
    }
}

// DELETE /api/community-manager/profiles?id=xxx
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')
        if (!id) return NextResponse.json({ error: 'ID manquant.' }, { status: 400 })
        if (!UUID_REGEX.test(id)) return NextResponse.json({ error: 'ID invalide.' }, { status: 400 })

        const { error } = await supabaseAdmin.from('social_profiles').delete().eq('id', id)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true })
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
    }
}
