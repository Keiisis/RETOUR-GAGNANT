import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

function getSupabase() {
    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Variables Supabase manquantes')
    }
    return createClient(supabaseUrl, supabaseServiceKey)
}

/**
 * Enregistre une candidature partenaire. Appelé par la route PUBLIQUE
 * /api/partner-applications (après plafond anti-abus) et par la route
 * personnel /api/admin/partner-applications (après garde).
 * Sorti du fichier route.ts : Next.js n'y admet que des handlers, et la
 * route publique importait le POST admin, sans garde, pour cette raison.
 */
export async function deposerCandidature(request: NextRequest) {
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
        // Types et format : un nombre ou un objet cassait `.trim()` en 500.
        if ([company_name, contact_name, email, location].some(v => typeof v !== 'string')
            || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
            return NextResponse.json({ error: 'Champs invalides' }, { status: 400 })
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
