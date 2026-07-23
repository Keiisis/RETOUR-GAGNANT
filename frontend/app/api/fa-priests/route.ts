// ══════════════════════════════════════════════════════════════
//  PUBLIC — Prêtres Fa : annuaire visible + dépôt d'avis
//  Ne renvoie QUE les prêtres actifs et les avis publiés.
//  Les coordonnées internes (téléphone / email) ne sortent jamais.
// ══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimit, getClientIp, rateLimitHeaders, CHECKOUT_LIMIT } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const db = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET() {
    const supabase = db()
    const { data, error } = await supabase
        .from('fa_priests')
        .select('id, nom, prenom, titre, localisation, bio, photo_url, prestations, gallery, certifications, langues, experience_ans, order_index')
        .eq('is_active', true)
        .order('order_index', { ascending: true })
    if (error) return NextResponse.json({ priests: [] })

    const { data: reviews } = await supabase
        .from('fa_priest_reviews')
        .select('priest_id, author_name, rating, comment, created_at')
        .eq('is_published', true)
        .order('created_at', { ascending: false })

    const byPriest: Record<string, Array<{ author_name: string; rating: number; comment: string | null; created_at: string }>> = {}
    for (const r of reviews || []) (byPriest[r.priest_id] ||= []).push(r)

    const priests = (data || []).map(p => {
        const rs = byPriest[p.id] || []
        const sum = rs.reduce((a, r) => a + (Number(r.rating) || 0), 0)
        return {
            ...p,
            rating_avg: rs.length ? Math.round((sum / rs.length) * 10) / 10 : 0,
            rating_count: rs.length,
            reviews: rs.slice(0, 20),
        }
    })
    return NextResponse.json({ priests })
}

// POST — dépôt d'un avis par un visiteur (NON publié : modération admin)
export async function POST(request: NextRequest) {
    const ip = getClientIp(request)
    const rl = rateLimit(`fa-review:${ip}`, CHECKOUT_LIMIT)
    if (!rl.allowed) {
        return NextResponse.json({ error: 'Trop de tentatives. Réessayez plus tard.' }, { status: 429, headers: rateLimitHeaders(rl) })
    }

    const body = await request.json().catch(() => ({}))
    const priest_id = String(body.priest_id || '')
    const author_name = String(body.author_name || '').trim().slice(0, 120)
    const rating = Number(body.rating)
    const comment = String(body.comment || '').trim().slice(0, 2000)

    if (!priest_id || !author_name) return NextResponse.json({ error: 'Votre nom et le prêtre concerné sont requis.' }, { status: 400 })
    if (!isFinite(rating) || rating < 1 || rating > 5) return NextResponse.json({ error: 'La note doit être comprise entre 1 et 5.' }, { status: 400 })

    const supabase = db()
    // Le prêtre doit exister et être actif
    const { data: priest } = await supabase
        .from('fa_priests').select('id').eq('id', priest_id).eq('is_active', true).maybeSingle()
    if (!priest) return NextResponse.json({ error: 'Prêtre introuvable.' }, { status: 404 })

    const { error } = await supabase.from('fa_priest_reviews').insert({
        priest_id,
        author_name,
        author_email: String(body.author_email || '').trim().toLowerCase() || null,
        rating: Math.round(rating),
        comment: comment || null,
        is_published: false, // modération obligatoire
    })
    if (error) return NextResponse.json({ error: 'Enregistrement impossible.' }, { status: 500 })

    return NextResponse.json({ success: true, message: 'Merci ! Votre avis sera publié après validation.' })
}
