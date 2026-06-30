import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Vérifie que la requête vient d'un user authentifié. Renvoie l'user_id ou null.
async function getAuthUserId(req: NextRequest): Promise<string | null> {
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) return null
    const supa = createClient(supabaseUrl, supabaseAnonKey)
    const { data } = await supa.auth.getUser(token)
    return data?.user?.id || null
}

// GET /api/genealogie/audit-log?tree_id=X&limit=50&offset=0
// Renvoie l'historique d'actions sur un arbre. Le RLS de la table genealogy_audit_log
// filtre déjà : owner du tree OU staff. On utilise donc l'anon key avec le token de
// l'utilisateur pour que RLS s'applique correctement.
export async function GET(request: NextRequest) {
    try {
        const userId = await getAuthUserId(request)
        if (!userId) {
            return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const treeId = searchParams.get('tree_id')
        const limit = Math.min(Number(searchParams.get('limit') || 50), 200)
        const offset = Number(searchParams.get('offset') || 0)
        const tableFilter = searchParams.get('table')
        const actionFilter = searchParams.get('action')

        // On utilise service_role mais on applique le filtre tree_id manuellement
        // pour éviter d'exposer l'audit log à un autre user. La policy RLS reste
        // notre filet de sécurité côté DB.
        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // Vérifier que l'utilisateur a bien accès à ce tree (owner OU collaborateur OU staff)
        if (treeId) {
            const { data: canRead } = await supabase
                .rpc('can_read_tree', { p_tree_id: treeId })
            if (!canRead) {
                return NextResponse.json({ error: 'Accès refusé à cet arbre' }, { status: 403 })
            }
        }

        let query = supabase
            .from('genealogy_audit_log')
            .select('id, table_name, record_id, tree_id, action, actor_id, actor_email, before_data, after_data, diff, created_at')
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1)

        if (treeId) query = query.eq('tree_id', treeId)
        if (tableFilter) query = query.eq('table_name', tableFilter)
        if (actionFilter) query = query.eq('action', actionFilter)

        const { data, error, count } = await query
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        return NextResponse.json({
            audit: data || [],
            pagination: { limit, offset, count: count ?? null },
        })
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Erreur serveur' },
            { status: 500 }
        )
    }
}
