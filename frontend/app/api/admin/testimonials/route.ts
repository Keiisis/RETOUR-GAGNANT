import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

function getSupabase() {
    if (!supabaseUrl || !supabaseServiceKey) throw new Error('Variables Supabase manquantes')
    return createClient(supabaseUrl, supabaseServiceKey)
}

// GET /api/admin/testimonials : liste tous les témoignages
export async function GET(request: NextRequest) {
    try {
        const auth = await verifyApiAuth(request, 'admin')
        if (!auth.authenticated) return auth.error!
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

        const testimonials = (data || []).map(t => {
            let location = t.location || '';
            let role = t.role || '';
            if (!role && location.includes(' | ')) {
                const parts = location.split(' | ');
                location = parts[0];
                role = parts[1];
            }
            return {
                ...t,
                location: location || 'Bénin',
                role: role || 'Client',
                photo_url: t.photo
            };
        })

        return NextResponse.json({ testimonials })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur serveur' }, { status: 500 })
    }
}

// POST /api/admin/testimonials : créer un témoignage (depuis admin)
export async function POST(request: NextRequest) {
    try {
        const auth = await verifyApiAuth(request, 'admin')
        if (!auth.authenticated) return auth.error!
        const supabase = getSupabase()
        const body = await request.json()

        const { name, text, photo_url, photo, location, role, rating, service, approved } = body

        if (!name?.trim() || !text?.trim()) {
            return NextResponse.json({ error: 'Le nom et le témoignage sont obligatoires' }, { status: 400 })
        }

        const combinedLocation = role ? `${location || ''} | ${role}` : (location || null);

        const { data, error } = await supabase
            .from('testimonials')
            .insert({
                name: name.trim(),
                text: text.trim(),
                photo: photo_url || photo || null,
                location: combinedLocation,
                rating: rating ?? 5,
                service: service || null,
                approved: approved ?? false,
                created_at: new Date().toISOString(),
            })
            .select()
            .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        const testimonial = data ? {
            ...data,
            location: data.location && data.location.includes(' | ') ? data.location.split(' | ')[0] : (data.location || 'Bénin'),
            role: data.location && data.location.includes(' | ') ? data.location.split(' | ')[1] : 'Client',
            photo_url: data.photo
        } : null
        return NextResponse.json({ testimonial }, { status: 201 })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur serveur' }, { status: 500 })
    }
}

