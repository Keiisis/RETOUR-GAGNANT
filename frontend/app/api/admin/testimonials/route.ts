import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

function getSupabase() {
    if (!supabaseUrl || !supabaseServiceKey) throw new Error('Variables Supabase manquantes')
    return createClient(supabaseUrl, supabaseServiceKey)
}

// GET /api/admin/testimonials — liste tous les témoignages
export async function GET(request: NextRequest) {
    try {
        const supabase = getSupabase()
        const { searchParams } = new URL(request.url)
        const status = searchParams.get('status') // 'approved' | 'pending' | null

        let query = supabase
            .from('testimonials')
            .select('*')
            .order('created_at', { ascending: false })

        if (status === 'approved') query = query.eq('approved', true)
        else if (status === 'pending') query = query.eq('approved', false)

        const { data, error } = await query
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        return NextResponse.json({ testimonials: data || [] })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur serveur' }, { status: 500 })
    }
}

// POST /api/admin/testimonials — créer un témoignage (depuis admin)
export async function POST(request: NextRequest) {
    try {
        const supabase = getSupabase()
        const body = await request.json()

        const { name, text, photo, location, rating, service, approved } = body

        if (!name?.trim() || !text?.trim()) {
            return NextResponse.json({ error: 'Le nom et le témoignage sont obligatoires' }, { status: 400 })
        }

        const { data, error } = await supabase
            .from('testimonials')
            .insert({
                name: name.trim(),
                text: text.trim(),
                photo: photo || null,
                location: location || null,
                rating: rating ?? 5,
                service: service || null,
                approved: approved ?? false,
                created_at: new Date().toISOString(),
            })
            .select()
            .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ testimonial: data }, { status: 201 })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur serveur' }, { status: 500 })
    }
}
