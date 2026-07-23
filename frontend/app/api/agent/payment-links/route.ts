// ══════════════════════════════════════════════════════════════
//  LIENS DE PAIEMENT — accès AGENT (et ADMIN)
//  Le middleware bloque /api/admin/* aux agents : sans cette route,
//  l'onglet « Liens de paiement » de l'espace agent était inutilisable
//  (403) — donc aucun lien agent n'existait, et l'admin n'en voyait aucun.
//
//  CLOISONNEMENT (strict) :
//    - ADMIN  : voit / supprime TOUS les liens (y compris ceux des agents)
//    - AGENT  : voit / supprime UNIQUEMENT les siens ([BY:<son id>])
//  Le marqueur [BY:<userId>] est posé CÔTÉ SERVEUR depuis la session —
//  jamais transmis par le client.
// ══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'
import {
    GET as adminGET,
    POST as adminPOST,
    DELETE as adminDELETE,
} from '@/app/api/admin/payment-links/route'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const ADMIN_ROLES = ['admin', 'super_admin', 'superadmin', 'ceo']
const isAdminRole = (role?: string) => !!role && ADMIN_ROLES.includes(role)

interface LinkRow { id: string; notes?: string | null }

export async function GET(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'agent')
    if (!auth.authenticated) return auth.error!

    const res = await adminGET()
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return NextResponse.json(data, { status: res.status })

    const links: LinkRow[] = data.links || []
    // Admin : tout. Agent : uniquement ses propres liens.
    const scoped = isAdminRole(auth.role)
        ? links
        : links.filter(l => String(l.notes || '').includes(`[BY:${auth.userId}]`))

    return NextResponse.json({ links: scoped })
}

export async function POST(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'agent')
    if (!auth.authenticated) return auth.error!

    const body = await request.json().catch(() => ({}))
    // by_user_id imposé par le serveur (jamais celui du client)
    const forwarded = new Request(request.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, by_user_id: auth.userId }),
    })
    return adminPOST(forwarded as unknown as NextRequest)
}

export async function DELETE(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'agent')
    if (!auth.authenticated) return auth.error!

    const id = request.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    // Un agent ne peut supprimer QUE ses propres liens
    if (!isAdminRole(auth.role)) {
        const supabase = createClient(supabaseUrl, serviceKey)
        const { data: link } = await supabase
            .from('ai_client_proposals').select('notes').eq('id', id).maybeSingle()
        if (!link || !String(link.notes || '').includes(`[BY:${auth.userId}]`)) {
            return NextResponse.json({ error: 'Ce lien ne vous appartient pas.' }, { status: 403 })
        }
    }
    return adminDELETE(request)
}
