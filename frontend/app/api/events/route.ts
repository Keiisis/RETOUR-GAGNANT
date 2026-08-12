import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

function getSupabase() {
    if (!supabaseUrl || !supabaseKey) throw new Error('Supabase config missing')
    return createClient(supabaseUrl, supabaseKey)
}

function slugify(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 80)
}

// GET /api/events : list events
export async function GET(req: NextRequest) {
    try {
        const supabase = getSupabase()
        const { searchParams } = new URL(req.url)
        const admin = searchParams.get('admin') === 'true'
        const featured = searchParams.get('featured')

        let query = supabase
            .from('events')
            .select('*, event_images(id, url, alt_text, sort_order)')
            .order('start_date', { ascending: true })

        if (!admin) query = query.eq('status', 'published')
        if (featured === 'true') query = query.eq('is_featured', true)

        const { data, error } = await query
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        return NextResponse.json({ events: data || [] })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur serveur' }, { status: 500 })
    }
}

// POST /api/events : create event
export async function POST(req: NextRequest) {
    const auth = await verifyApiAuth(req, 'admin')
    if (!auth.authenticated) return auth.error!
    try {
        const supabase = getSupabase()
        const body = await req.json()

        const {
            title, description, short_description, location, location_map_url,
            start_date, end_date, price_standard, price_vip, currency,
            max_capacity, max_vip_seats, status, cover_image_url,
            category, is_featured, created_by
        } = body

        if (!title || !start_date) {
            return NextResponse.json({ error: 'Titre et date de début requis' }, { status: 400 })
        }

        const baseSlug = slugify(title)
        const slug = `${baseSlug}-${Date.now().toString(36)}`

        const { data, error } = await supabase
            .from('events')
            .insert({
                title, slug, description, short_description,
                location, location_map_url,
                start_date, end_date,
                price_standard: price_standard || 0,
                price_vip: price_vip || 0,
                currency: currency || 'XOF',
                max_capacity: max_capacity || 0,
                max_vip_seats: max_vip_seats || 0,
                status: status || 'draft',
                cover_image_url, category: category || 'conference',
                is_featured: is_featured || false,
                created_by,
            })
            .select()
            .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ event: data }, { status: 201 })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur serveur' }, { status: 500 })
    }
}
