import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

function getSupabase() {
    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Variables Supabase manquantes')
    }
    return createClient(supabaseUrl, supabaseServiceKey)
}

// GET /api/admin/partner-applications — liste toutes les candidatures
export async function GET(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!
    try {
        const supabase = getSupabase()
        const { searchParams } = new URL(request.url)
        const status = searchParams.get('status') // pending | contacted | confirmed | rejected

        let query = supabase
            .from('partner_applications')
            .select('*')
            .order('created_at', { ascending: false })

        if (status) query = query.eq('status', status)

        const { data, error } = await query
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        return NextResponse.json({ applications: data || [] })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur serveur' }, { status: 500 })
    }
}

// POST /api/admin/partner-applications — soumettre une candidature (public)
export async function POST(request: NextRequest) {
    try {
        const supabase = getSupabase()
        const body = await request.json()

        const {
            company_name, contact_name, email, phone, whatsapp,
            website, category, location, activity_description,
            target_audience, years_in_business, team_size, revenue_range,
            why_partner, what_offer, partnership_types,
            logo_url, cover_image_url,
            facebook_url, instagram_url, linkedin_url,
        } = body

        if (!company_name || !contact_name || !email || !category || !location || !activity_description || !why_partner) {
            return NextResponse.json({ error: 'Champs obligatoires manquants' }, { status: 400 })
        }

        const now = new Date().toISOString()
        const { data, error } = await supabase
            .from('partner_applications')
            .insert({
                company_name: company_name.trim(),
                contact_name: contact_name.trim(),
                email: email.trim().toLowerCase(),
                phone: phone || null,
                whatsapp: whatsapp || null,
                website: website || null,
                category,
                location: location.trim(),
                activity_description,
                target_audience: target_audience || null,
                years_in_business: years_in_business || null,
                team_size: team_size || null,
                revenue_range: revenue_range || null,
                why_partner,
                what_offer: what_offer || null,
                partnership_types: partnership_types || [],
                logo_url: logo_url || null,
                cover_image_url: cover_image_url || null,
                facebook_url: facebook_url || null,
                instagram_url: instagram_url || null,
                linkedin_url: linkedin_url || null,
                status: 'pending',
                is_read: false,
                created_at: now,
                updated_at: now,
            })
            .select()
            .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ application: data }, { status: 201 })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur serveur' }, { status: 500 })
    }
}
