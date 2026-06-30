import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient, getAuthUserId } from '@/lib/genealogy/api-auth'

// PATCH /api/genealogie/persons/[id]/comments/[commentId]
//   Body : { body?: string, resolved?: boolean }
//   - body : modifie le texte (auteur uniquement)
//   - resolved=true : marque comme résolu (owner/staff/auteur)
//
// DELETE /api/genealogie/persons/[id]/comments/[commentId]
//   Supprime un commentaire (auteur OR owner tree OR staff via RLS)
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; commentId: string }> }
) {
    try {
        const { commentId } = await params
        const userId = await getAuthUserId(request)
        if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

        const body = await request.json()
        const updates: Record<string, unknown> = {}

        if (typeof body.body === 'string') {
            const text = body.body.trim()
            if (!text) return NextResponse.json({ error: 'Texte requis' }, { status: 400 })
            if (text.length > 4000) return NextResponse.json({ error: 'Texte trop long' }, { status: 400 })
            updates.body = text
        }

        if (body.resolved === true) {
            updates.resolved_at = new Date().toISOString()
            updates.resolved_by = userId
        } else if (body.resolved === false) {
            updates.resolved_at = null
            updates.resolved_by = null
        }

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: 'Aucune mise à jour' }, { status: 400 })
        }

        const supabase = getServiceClient()
        // RLS s'applique : auteur ou staff. On utilise service_role mais on
        // re-vérifie côté lecture pour ne pas court-circuiter.
        const { data: existing } = await supabase
            .from('person_comments').select('author_id, tree_id').eq('id', commentId).single()
        if (!existing) return NextResponse.json({ error: 'Commentaire introuvable' }, { status: 404 })

        // Si on modifie le body, c'est forcément l'auteur
        if (updates.body !== undefined && existing.author_id !== userId) {
            // Sauf staff
            const { data: profile } = await supabase
                .from('user_profiles').select('role').eq('id', userId).single()
            const isStaff = ['admin','super_admin','superadmin','ceo','agent'].includes(profile?.role || '')
            if (!isStaff) {
                return NextResponse.json({ error: 'Seul l\'auteur peut modifier ce commentaire' }, { status: 403 })
            }
        }

        const { data: updated, error } = await supabase
            .from('person_comments').update(updates).eq('id', commentId).select().single()
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        return NextResponse.json({ comment: updated })
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Erreur serveur' },
            { status: 500 }
        )
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; commentId: string }> }
) {
    try {
        const { commentId } = await params
        const userId = await getAuthUserId(request)
        if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

        const supabase = getServiceClient()
        const { data: existing } = await supabase
            .from('person_comments').select('author_id, tree_id').eq('id', commentId).single()
        if (!existing) return NextResponse.json({ error: 'Commentaire introuvable' }, { status: 404 })

        // Auteur OU owner du tree OU staff
        let authorized = existing.author_id === userId
        if (!authorized) {
            const { data: tree } = await supabase.from('trees').select('user_id').eq('id', existing.tree_id).single()
            authorized = tree?.user_id === userId
        }
        if (!authorized) {
            const { data: profile } = await supabase
                .from('user_profiles').select('role').eq('id', userId).single()
            authorized = ['admin','super_admin','superadmin','ceo','agent'].includes(profile?.role || '')
        }
        if (!authorized) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

        const { error } = await supabase.from('person_comments').delete().eq('id', commentId)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        return NextResponse.json({ ok: true })
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Erreur serveur' },
            { status: 500 }
        )
    }
}
