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

// GET /api/genealogie/collaborators?tree_id=X
// Liste les collaborateurs d'un arbre. Réservé à l'owner et au staff.
export async function GET(request: NextRequest) {
    try {
        const userId = await getAuthUserId(request)
        if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

        const { searchParams } = new URL(request.url)
        const treeId = searchParams.get('tree_id')
        if (!treeId) return NextResponse.json({ error: 'tree_id requis' }, { status: 400 })

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // Vérifier que userId est owner ou staff (lecture des collaborateurs)
        const { data: tree } = await supabase
            .from('trees')
            .select('user_id')
            .eq('id', treeId)
            .single()
        const isOwner = tree?.user_id === userId

        if (!isOwner) {
            const { data: profile } = await supabase
                .from('user_profiles')
                .select('role')
                .eq('id', userId)
                .single()
            const isStaff = ['admin', 'super_admin', 'superadmin', 'ceo', 'agent'].includes(profile?.role || '')
            if (!isStaff) {
                return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
            }
        }

        // Joindre l'email du user invité depuis auth.users via une requête séparée
        const { data: collabs, error } = await supabase
            .from('tree_collaborators')
            .select('id, tree_id, user_id, role, invited_by, accepted_at, created_at')
            .eq('tree_id', treeId)
            .order('created_at', { ascending: false })

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        // Enrichir avec les emails
        const userIds = Array.from(new Set([
            ...(collabs || []).map(c => c.user_id),
            ...(collabs || []).map(c => c.invited_by).filter(Boolean),
        ])) as string[]

        const emails: Record<string, string> = {}
        if (userIds.length > 0) {
            for (const uid of userIds) {
                const { data: u } = await supabase.auth.admin.getUserById(uid)
                if (u?.user?.email) emails[uid] = u.user.email
            }
        }

        const enriched = (collabs || []).map(c => ({
            ...c,
            user_email: emails[c.user_id] || null,
            invited_by_email: c.invited_by ? emails[c.invited_by] || null : null,
        }))

        return NextResponse.json({ collaborators: enriched })
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Erreur serveur' },
            { status: 500 }
        )
    }
}

// POST /api/genealogie/collaborators
// Body : { tree_id, email, role: 'viewer'|'editor' }
// Invite un utilisateur (par email) à collaborer sur un arbre.
export async function POST(request: NextRequest) {
    try {
        const userId = await getAuthUserId(request)
        if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

        const body = await request.json()
        const treeId = String(body.tree_id || '')
        const email = String(body.email || '').trim().toLowerCase()
        const role = body.role === 'editor' ? 'editor' : 'viewer'

        if (!treeId || !email) {
            return NextResponse.json({ error: 'tree_id et email requis' }, { status: 400 })
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // Vérifier que l'utilisateur courant est owner du tree (RLS-equivalent)
        const { data: tree } = await supabase
            .from('trees')
            .select('user_id')
            .eq('id', treeId)
            .single()
        if (!tree) return NextResponse.json({ error: 'Arbre introuvable' }, { status: 404 })

        const isOwner = tree.user_id === userId
        if (!isOwner) {
            const { data: profile } = await supabase
                .from('user_profiles')
                .select('role')
                .eq('id', userId)
                .single()
            const isStaff = ['admin', 'super_admin', 'superadmin', 'ceo', 'agent'].includes(profile?.role || '')
            if (!isStaff) {
                return NextResponse.json({ error: 'Seul l\'owner peut inviter des collaborateurs' }, { status: 403 })
            }
        }

        // Chercher l'user_id à partir de l'email
        const { data: users } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
        const targetUser = users?.users.find(u => u.email?.toLowerCase() === email)
        if (!targetUser) {
            return NextResponse.json(
                { error: `Aucun compte trouvé pour ${email}. L'utilisateur doit d'abord créer un compte.` },
                { status: 404 }
            )
        }

        // Empêcher d'inviter soi-même
        if (targetUser.id === tree.user_id) {
            return NextResponse.json({ error: 'L\'owner ne peut pas être son propre collaborateur' }, { status: 400 })
        }

        // Insérer (unique constraint sur tree_id + user_id empêche les doublons)
        const { data: collab, error } = await supabase
            .from('tree_collaborators')
            .insert({
                tree_id: treeId,
                user_id: targetUser.id,
                role,
                invited_by: userId,
            })
            .select()
            .single()

        if (error) {
            if (error.code === '23505') {
                return NextResponse.json(
                    { error: 'Cet utilisateur est déjà invité sur cet arbre' },
                    { status: 409 }
                )
            }
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ collaborator: { ...collab, user_email: email } })
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Erreur serveur' },
            { status: 500 }
        )
    }
}
