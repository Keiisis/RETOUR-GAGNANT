import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { guardPublic, PUBLIC_FORM_LIMIT } from '@/lib/api-guard'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data, error } = await supabase
        .from('product_reviews')
        .select('*')
        .eq('product_id', id)
        .eq('is_approved', true)
        .order('created_at', { ascending: false })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ reviews: data || [] })
}

export async function POST(req: NextRequest,
    { params }: { params: Promise<{ id: string }> }) {
    const trop = guardPublic(req, 'products/[id]/reviews', PUBLIC_FORM_LIMIT)
    if (trop) return trop

    const { id } = await params
    const body = await req.json()
    const { reviewer_name, rating, comment } = body

    if (!reviewer_name || !rating) {
        return NextResponse.json(
            { error: 'Le nom et la note sont requis' },
            { status: 400 }
        )
    }

    if (rating < 1 || rating > 5) {
        return NextResponse.json(
            { error: 'La note doit être entre 1 et 5' },
            { status: 400 }
        )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { error } = await supabase
        .from('product_reviews')
        .insert({
            product_id: id,
            reviewer_name: reviewer_name.trim(),
            rating: Math.round(rating),
            comment: (comment || '').trim(),
            is_approved: true,
            is_verified: false,
        })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
}
