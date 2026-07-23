import { NextRequest, NextResponse } from 'next/server'
import { verifyApiAuth } from '@/lib/api-auth'
import { createClient } from '@supabase/supabase-js'

const sb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// GET /api/ceo/temoignages — List all testimonials mapped to frontend naming structure
export async function GET(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    try {
        const { data, error } = await sb()
            .from('testimonials')
            .select('*')
            .order('created_at', { ascending: false })
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        const mapped = (data || []).map(t => {
            let location = t.location || '';
            let role = t.role || '';
            if (!role && location.includes(' | ')) {
                const parts = location.split(' | ');
                location = parts[0];
                role = parts[1];
            }
            return {
                id: t.id,
                author_name: t.name || '',
                author_title: t.service || '',
                author_company: location || '',
                content: t.text || '',
                rating: t.rating || 5,
                avatar_url: t.photo || '',
                is_published: t.approved ?? false,
                created_at: t.created_at
            };
        })

        return NextResponse.json({ testimonials: mapped })
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
    }
}


// POST /api/ceo/temoignages — Create a testimonial mapping keys to DB columns
export async function POST(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    try {
        const body = await request.json()
        const { author_name, author_title, author_company, content, rating, avatar_url, is_published } = body

        const { data, error } = await sb().from('testimonials').insert({
            name: author_name || '',
            service: author_title || null,
            location: author_company || null,
            text: content || '',
            rating: rating || 5,
            photo: avatar_url || null,
            approved: is_published ?? true,
            created_at: new Date().toISOString()
        }).select().single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        const mapped = data ? {
            id: data.id,
            author_name: data.name,
            author_title: data.service,
            author_company: data.location,
            content: data.text,
            rating: data.rating,
            avatar_url: data.photo,
            is_published: data.approved,
            created_at: data.created_at
        } : null

        return NextResponse.json(mapped)
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
    }
}

// PATCH /api/ceo/temoignages — Update testimonial properties mapping keys to DB columns
export async function PATCH(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    try {
        const { id, ...updates } = await request.json()
        if (!id) return NextResponse.json({ error: 'ID manquant' }, { status: 400 })

        const dbUpdates: Record<string, unknown> = {}
        if ('author_name' in updates) dbUpdates.name = updates.author_name
        if ('author_title' in updates) dbUpdates.service = updates.author_title
        if ('author_company' in updates) dbUpdates.location = updates.author_company
        if ('content' in updates) dbUpdates.text = updates.content
        if ('rating' in updates) dbUpdates.rating = updates.rating
        if ('avatar_url' in updates) dbUpdates.photo = updates.avatar_url
        if ('is_published' in updates) dbUpdates.approved = updates.is_published

        const { error } = await sb().from('testimonials').update(dbUpdates).eq('id', id)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true })
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
    }
}

// DELETE /api/ceo/temoignages — Delete a testimonial
export async function DELETE(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    try {
        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')
        if (!id) return NextResponse.json({ error: 'ID manquant' }, { status: 400 })
        const { error } = await sb().from('testimonials').delete().eq('id', id)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true })
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
    }
}
