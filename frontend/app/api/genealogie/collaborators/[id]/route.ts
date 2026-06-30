import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

async function getAuthUserId(req: NextRequest): Promise<string | null> {
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) return null
    const supa = createClient(supabaseUrl, supabaseAnonKey)
    const { data } = await supa.auth.getUser(token)
    return data?.user?.id || null
}

// PATCH /api/genealogie/collaborators/[id]
// Body : { action: 'accept' } pour accepter l'invitation
//        | { role: 'editor'|'viewer' } pour changer le rôle (owner only)
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const userId = await getAuthUserId(request)
        if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

        const { id } = await params
        const body = await request.json()

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // Charger l'invitation
        const { data: collab, error: fetchErr } = await supabase
            .from('tree_collaborators')
            .select('id, tree_id, user_id, role, accepted_at')
            .eq('id', id)
            .single()
        if (fetchErr || !collab) {
            return NextResponse.json({ error: 'Invitation introuvable' }, { status: 404 })
        }

        // Action : accepter l'invitation (par le collaborateur lui-même)
        if (body.action === 'accept') {
            if (collab.user_id !== userId) {
                return NextResponse.json({ error: 'Seul le destinataire peut accepter' }, { status: 403 })
            }
            const { error } = await supabase
                .from('tree_collaborators')
                .update({ accepted_at: new Date().toISOString() })
                .eq('id', id)
            if (error) return NextResponse.json({ error: error.message }, { status: 500 })
            return NextResponse.json({ ok: true, accepted: true })
        }

        // Changement de rôle : owner du tree seulement
        if (body.role === 'editor' || body.role === 'viewer') {
            const { data: tree } = await supabase
                .from('trees').select('user_id').eq('id', collab.tree_id).single()
            if (tree?.user_id !== userId) {
                const { data: profile } = await supabase
                    .from('user_profiles').select('role').eq('id', userId).single()
                const isStaff = ['admin', 'super_admin', 'superadmin', 'ceo', 'agent'].includes(profile?.role || '')
                if (!isStaff) {
                    return NextResponse.json(
                        { error: 'Seul l\'owner peut changer le rôle d\'un collaborateur' },
                        { status: 403 }
                    )
                }
            }
            const { error } = await supabase
                .from('tree_collaborators')
                .update({ role: body.role })
                .eq('id', id)
            if (error) return NextResponse.json({ error: error.message }, { status: 500 })
            return NextResponse.json({ ok: true, role: body.role })
        }

        return NextResponse.json({ error: 'Action ou role invalide' }, { status: 400 })
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Erreur serveur' },
            { status: 500 }
        )
    }
}

// DELETE /api/genealogie/collaborators/[id]
// L'owner peut révoquer ; le collaborateur peut quitter de lui-même.
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const userId = await getAuthUserId(request)
        if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

        const { id } = await params

        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        const { data: collab } = await supabase
            .from('tree_collaborators')
            .select('id, tree_id, user_id')
            .eq('id', id)
            .single()
        if (!collab) return NextResponse.json({ error: 'Invitation introuvable' }, { status: 404 })

        const isCollabSelf = collab.user_id === userId
        let isAuthorized = isCollabSelf
        if (!isAuthorized) {
            const { data: tree } = await supabase
                .from('trees').select('user_id').eq('id', collab.tree_id).single()
            isAuthorized = tree?.user_id === userId
        }
        if (!isAuthorized) {
            const { data: profile } = await supabase
                .from('user_profiles').select('role').eq('id', userId).single()
            isAuthorized = ['admin', 'super_admin', 'superadmin', 'ceo', 'agent'].includes(profile?.role || '')
        }
        if (!isAuthorized) {
            return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
        }

        const { error } = await supabase.from('tree_collaborators').delete().eq('id', id)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        return NextResponse.json({ ok: true })
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Erreur serveur' },
            { status: 500 }
        )
    }
}
