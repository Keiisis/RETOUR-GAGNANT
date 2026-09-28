import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'
import { deposerCandidature } from '@/lib/partner-applications'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

function getSupabase() {
    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Variables Supabase manquantes')
    }
    return createClient(supabaseUrl, supabaseServiceKey)
}

// GET /api/admin/partner-applications : liste toutes les candidatures
export async function GET(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'agent')
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

// POST : le dépôt public passe par /api/partner-applications (plafond
// anti-abus). Ici, ce POST n'avait AUCUNE garde : seule la barrière du
// middleware le protégeait. Il est réservé au personnel (saisie manuelle
// d'une candidature reçue par un autre canal) et partage le même traitement.
export async function POST(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'agent')
    if (!auth.authenticated) return auth.error!
    return deposerCandidature(request)
}
