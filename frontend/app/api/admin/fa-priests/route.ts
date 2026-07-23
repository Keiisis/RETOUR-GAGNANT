// ══════════════════════════════════════════════════════════════
//  ADMIN — Prêtres Fa (Bokonon) : CRUD complet
//  Toutes les écritures passent ici (service role) : la table est en
//  RLS lecture seule côté public. Aucune donnée codée en dur.
// ══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const db = () => createClient(supabaseUrl, serviceKey)

const MISSING_TABLE = "Table « fa_priests » absente. Exécutez la migration supabase/migrations/20260723_fa_priests.sql dans l'éditeur SQL Supabase."

/** Normalise un tableau JSON d'objets (prestations, certifications…). */
function arr<T>(v: unknown): T[] {
    return Array.isArray(v) ? (v as T[]) : []
}

/** Champs autorisés en écriture (liste blanche stricte). */
function sanitize(body: Record<string, unknown>) {
    const out: Record<string, unknown> = {}
    if (typeof body.nom === 'string') out.nom = body.nom.trim()
    if (typeof body.prenom === 'string') out.prenom = body.prenom.trim()
    if ('titre' in body) out.titre = String(body.titre || '').trim() || null
    if ('localisation' in body) out.localisation = String(body.localisation || '').trim() || null
    if ('bio' in body) out.bio = String(body.bio || '').trim() || null
    if ('photo_url' in body) out.photo_url = String(body.photo_url || '').trim() || null
    if ('telephone' in body) out.telephone = String(body.telephone || '').trim() || null
    if ('email' in body) out.email = String(body.email || '').trim().toLowerCase() || null
    if ('prestations' in body) out.prestations = arr(body.prestations)
    if ('gallery' in body) out.gallery = arr(body.gallery)
    if ('certifications' in body) out.certifications = arr(body.certifications)
    if ('langues' in body) out.langues = arr(body.langues)
    if ('experience_ans' in body) {
        const n = Number(body.experience_ans)
        out.experience_ans = isFinite(n) && n >= 0 ? Math.round(n) : null
    }
    if ('is_active' in body) out.is_active = !!body.is_active
    if ('order_index' in body) {
        const n = Number(body.order_index)
        out.order_index = isFinite(n) ? Math.round(n) : 0
    }
    return out
}

// GET — liste complète (actifs + inactifs) avec notes agrégées
export async function GET(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    const supabase = db()
    const { data, error } = await supabase
        .from('fa_priests').select('*')
        .order('order_index', { ascending: true })
        .order('created_at', { ascending: false })
    if (error) {
        const missing = error.message?.includes('fa_priests')
        return NextResponse.json({ error: missing ? MISSING_TABLE : error.message }, { status: missing ? 503 : 500 })
    }

    // Notes agrégées (avis publiés uniquement)
    const { data: reviews } = await supabase
        .from('fa_priest_reviews').select('priest_id, rating, is_published')
    const stats: Record<string, { sum: number; count: number; pending: number }> = {}
    for (const r of reviews || []) {
        const s = (stats[r.priest_id] ||= { sum: 0, count: 0, pending: 0 })
        if (r.is_published) { s.sum += Number(r.rating) || 0; s.count++ } else s.pending++
    }

    const priests = (data || []).map(p => {
        const s = stats[p.id] || { sum: 0, count: 0, pending: 0 }
        return {
            ...p,
            rating_avg: s.count ? Math.round((s.sum / s.count) * 10) / 10 : 0,
            rating_count: s.count,
            reviews_pending: s.pending,
        }
    })
    return NextResponse.json({ priests })
}

// POST — création
export async function POST(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    const body = await request.json().catch(() => ({}))
    const patch = sanitize(body)
    if (!patch.nom) return NextResponse.json({ error: 'Le nom est obligatoire.' }, { status: 400 })

    const { data, error } = await db().from('fa_priests').insert(patch).select('id').single()
    if (error) {
        const missing = error.message?.includes('fa_priests')
        return NextResponse.json({ error: missing ? MISSING_TABLE : error.message }, { status: missing ? 503 : 500 })
    }
    return NextResponse.json({ success: true, id: data.id })
}

// PATCH — mise à jour
export async function PATCH(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    const body = await request.json().catch(() => ({}))
    const id = String(body.id || '')
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const patch = sanitize(body)
    if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Rien à modifier' }, { status: 400 })

    const { error } = await db().from('fa_priests').update(patch).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
}

// DELETE — suppression (les avis liés partent en cascade)
export async function DELETE(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    const id = request.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const { error } = await db().from('fa_priests').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
}
