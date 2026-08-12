import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { SUPPORTED_LANGUAGES, type LangCode } from '@/lib/translation'
import { requireStaff } from '@/lib/api-guard'

// ═══════════════════════════════════════════════════════
// Admin Translation Management API
// Routes: GET (list+stats), PUT (update), DELETE (remove)
// Requires SUPABASE_SERVICE_ROLE_KEY : admin use only.
// ═══════════════════════════════════════════════════════

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// ─── GET : Stats par langue + liste paginée ──────────
export async function GET(request: Request) {
    const garde = await requireStaff(request, 'admin')
    if (!garde.ok) return garde.response!

    try {
        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json({ error: 'Configuration serveur manquante' }, { status: 503 })
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        const { searchParams } = new URL(request.url)
        const lang = searchParams.get('lang') || 'all'
        const search = searchParams.get('search') || ''
        const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
        const limit = 50
        const offset = (page - 1) * limit

        // Stats par langue (nombre de traductions en DB)
        const stats: Record<string, number> = {}
        for (const l of SUPPORTED_LANGUAGES.filter(l => l.code !== 'fr')) {
            const { count } = await supabase
                .from('translations')
                .select('*', { count: 'exact', head: true })
                .eq('lang', l.code)
            stats[l.code] = count ?? 0
        }

        // Construire la requête de liste
        let query = supabase
            .from('translations')
            .select('source_text, source_hash, lang, translated_text, context', { count: 'exact' })
            .order('source_text', { ascending: true })
            .range(offset, offset + limit - 1)

        if (lang !== 'all') {
            query = query.eq('lang', lang as LangCode)
        }

        if (search.trim()) {
            query = query.or(
                `source_text.ilike.%${search.trim()}%,translated_text.ilike.%${search.trim()}%`
            )
        }

        const { data: translations, count: total, error } = await query

        if (error) {
            console.error('[Admin/Translations GET]', error.message)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({
            stats,
            translations: translations || [],
            total: total ?? 0,
            page,
            limit,
            pages: Math.ceil((total ?? 0) / limit),
        })
    } catch (err: unknown) {
        console.error('[Admin/Translations GET] Exception:', err)
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
}

// ─── PUT : Modifier une traduction ──────────────────
export async function PUT(request: Request) {
    const garde = await requireStaff(request, 'admin')
    if (!garde.ok) return garde.response!

    try {
        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json({ error: 'Configuration serveur manquante' }, { status: 503 })
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        const body = await request.json()
        const { source_hash, lang, translated_text } = body

        if (!source_hash || !lang || translated_text === undefined) {
            return NextResponse.json({ error: 'source_hash, lang et translated_text requis' }, { status: 400 })
        }

        if (!SUPPORTED_LANGUAGES.find(l => l.code === lang && l.code !== 'fr')) {
            return NextResponse.json({ error: 'Langue invalide' }, { status: 400 })
        }

        const { error } = await supabase
            .from('translations')
            .update({
                translated_text: String(translated_text).trim(),
                context: 'manual',
            })
            .eq('source_hash', source_hash)
            .eq('lang', lang)

        if (error) {
            console.error('[Admin/Translations PUT]', error.message)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ ok: true })
    } catch (err: unknown) {
        console.error('[Admin/Translations PUT] Exception:', err)
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
}

// ─── DELETE : Supprimer une traduction ──────────────
export async function DELETE(request: Request) {
    const garde = await requireStaff(request, 'admin')
    if (!garde.ok) return garde.response!

    try {
        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json({ error: 'Configuration serveur manquante' }, { status: 503 })
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        const body = await request.json()
        const { source_hash, lang } = body

        if (!source_hash || !lang) {
            return NextResponse.json({ error: 'source_hash et lang requis' }, { status: 400 })
        }

        // Permettre "all" pour supprimer toutes les traductions d'un texte
        let error
        if (lang === 'all') {
            const result = await supabase
                .from('translations')
                .delete()
                .eq('source_hash', source_hash)
            error = result.error
        } else {
            const result = await supabase
                .from('translations')
                .delete()
                .eq('source_hash', source_hash)
                .eq('lang', lang)
            error = result.error
        }

        if (error) {
            console.error('[Admin/Translations DELETE]', error.message)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ ok: true })
    } catch (err: unknown) {
        console.error('[Admin/Translations DELETE] Exception:', err)
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
}
