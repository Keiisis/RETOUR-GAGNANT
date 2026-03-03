import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

function getSupabase() {
    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Variables Supabase manquantes (SUPABASE_SERVICE_ROLE_KEY requis)')
    }
    return createClient(supabaseUrl, supabaseServiceKey)
}

// GET /api/admin/leads — liste tous les leads Oracle
export async function GET() {
    try {
        const supabase = getSupabase()

        const { data, error } = await supabase
            .from('eligibility_results')
            .select('*')
            .order('created_at', { ascending: false })

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ leads: data || [] })
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur serveur' }, { status: 500 })
    }
}
