import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export function getServiceClient(): SupabaseClient {
    return createClient(supabaseUrl, supabaseServiceKey)
}

/** Récupère l'user_id à partir d'un header Authorization: Bearer <token>. */
export async function getAuthUserId(req: NextRequest): Promise<string | null> {
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) return null
    const supa = createClient(supabaseUrl, supabaseAnonKey)
    const { data } = await supa.auth.getUser(token)
    return data?.user?.id || null
}

/** Vérifie que l'user peut lire un arbre, sinon NextResponse 401/403. */
export async function requireReadTree(
    req: NextRequest,
    treeId: string
): Promise<{ userId: string } | NextResponse> {
    const userId = await getAuthUserId(req)
    if (!userId) {
        return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    const supabase = getServiceClient()
    const { data: canRead } = await supabase.rpc('can_read_tree', { p_tree_id: treeId })
    if (!canRead) {
        return NextResponse.json({ error: 'Accès en lecture refusé' }, { status: 403 })
    }
    return { userId }
}

/** Vérifie que l'user peut écrire dans un arbre, sinon NextResponse 401/403. */
export async function requireWriteTree(
    req: NextRequest,
    treeId: string
): Promise<{ userId: string } | NextResponse> {
    const userId = await getAuthUserId(req)
    if (!userId) {
        return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    const supabase = getServiceClient()
    const { data: canWrite } = await supabase.rpc('can_write_tree', { p_tree_id: treeId })
    if (!canWrite) {
        return NextResponse.json({ error: 'Accès en écriture refusé' }, { status: 403 })
    }
    return { userId }
}

/** Helper pour récupérer le tree_id depuis une person, document, etc. */
export async function getTreeIdForPerson(personId: string): Promise<string | null> {
    const { data } = await getServiceClient().from('persons').select('tree_id').eq('id', personId).single()
    return data?.tree_id || null
}

export async function getTreeIdForDocument(docId: string): Promise<string | null> {
    const { data } = await getServiceClient().from('genealogy_documents').select('tree_id').eq('id', docId).single()
    return data?.tree_id || null
}
