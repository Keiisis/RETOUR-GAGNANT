// ══════════════════════════════════════════════════════════════
//  ADMIN : Avis sur les Prêtres Fa : lecture + modération
//  Un avis déposé publiquement arrive NON publié : il n'apparaît sur
//  le site qu'après validation ici.
// ══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

const db = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// GET ?priest_id=… : avis d'un prêtre (ou tous si non précisé)
export async function GET(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    const priestId = request.nextUrl.searchParams.get('priest_id')
    let q = db().from('fa_priest_reviews')
        .select('id, priest_id, author_name, author_email, rating, comment, is_published, created_at')
        .order('created_at', { ascending: false })
    if (priestId) q = q.eq('priest_id', priestId)

    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ reviews: data || [] })
}

// POST : avis ajouté par l'équipe (publié d'office)
export async function POST(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    const body = await request.json().catch(() => ({}))
    const priest_id = String(body.priest_id || '')
    const author_name = String(body.author_name || '').trim()
    const rating = Number(body.rating)
    if (!priest_id || !author_name) return NextResponse.json({ error: 'Prêtre et auteur requis.' }, { status: 400 })
    if (!isFinite(rating) || rating < 1 || rating > 5) return NextResponse.json({ error: 'Note entre 1 et 5.' }, { status: 400 })

    const { error } = await db().from('fa_priest_reviews').insert({
        priest_id,
        author_name,
        author_email: String(body.author_email || '').trim().toLowerCase() || null,
        rating: Math.round(rating),
        comment: String(body.comment || '').trim() || null,
        is_published: body.is_published !== false,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
}

// PATCH : publier / dépublier
export async function PATCH(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    const body = await request.json().catch(() => ({}))
    const id = String(body.id || '')
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const { error } = await db().from('fa_priest_reviews')
        .update({ is_published: !!body.is_published }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
}

// DELETE : suppression d'un avis
export async function DELETE(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    const id = request.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const { error } = await db().from('fa_priest_reviews').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
}
