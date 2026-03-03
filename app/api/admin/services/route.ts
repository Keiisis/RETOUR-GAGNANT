import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

function getSupabase() {
    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Variables Supabase manquantes (SUPABASE_SERVICE_ROLE_KEY requis)')
    }
    return createClient(supabaseUrl, supabaseServiceKey)
}

// GET /api/admin/services — liste tous les services
export async function GET() {
    try {
        const supabase = getSupabase()
        const { data, error } = await supabase
            .from('services')
            .select('*')
            .order('order_index', { ascending: true })

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ services: data || [] })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur serveur' }, { status: 500 })
    }
}

// POST /api/admin/services — créer un service
export async function POST(request: NextRequest) {
    try {
        const supabase = getSupabase()
        const body = await request.json()

        const {
            title,
            slug,
            subtitle,
            description,
            features,
            pricing_options,
            color,
            icon_type,
            image_url,
            price_display,
            order_index,
            is_active,
        } = body

        if (!title || !slug) {
            return NextResponse.json({ error: 'title et slug sont obligatoires' }, { status: 400 })
        }

        const { data, error } = await supabase
            .from('services')
            .insert({
                title: title.trim(),
                slug: slug.trim().toLowerCase(),
                subtitle: subtitle || '',
                description: description || '',
                features: features || [],
                pricing_options: pricing_options || [],
                color: color || '#008751',
                icon_type: icon_type || 'shield',
                image_url: image_url || null,
                price_display: price_display || '',
                order_index: order_index ?? 0,
                is_active: is_active !== false,
            })
            .select()
            .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ service: data }, { status: 201 })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur serveur' }, { status: 500 })
    }
}
