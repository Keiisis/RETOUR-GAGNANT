import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireStaff } from '@/lib/api-guard'

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY manquant')
}
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY
)

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// GET /api/community-manager/analyses?profile_id=xxx
export async function GET(request: NextRequest) {
    const garde = await requireStaff(request, 'agent')
    if (!garde.ok) return garde.response!

    try {
        const { searchParams } = new URL(request.url)
        const profileId = searchParams.get('profile_id')

        let query = supabaseAdmin
            .from('social_analyses')
            .select('id, profile_id, analysis_type, created_at, result')
            .order('created_at', { ascending: false })
            .limit(20)

        if (profileId) {
            if (!UUID_REGEX.test(profileId)) {
                return NextResponse.json({ error: 'profile_id invalide' }, { status: 400 })
            }
            query = query.eq('profile_id', profileId)
        }

        const { data, error } = await query
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json(data || [])
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
    }
}

// DELETE /api/community-manager/analyses?id=xxx
export async function DELETE(request: NextRequest) {
    const garde = await requireStaff(request, 'agent')
    if (!garde.ok) return garde.response!

    try {
        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')
        if (!id) return NextResponse.json({ error: 'ID manquant' }, { status: 400 })
        if (!UUID_REGEX.test(id)) return NextResponse.json({ error: 'ID invalide' }, { status: 400 })

        const { error } = await supabaseAdmin.from('social_analyses').delete().eq('id', id)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true })
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
    }
}
