import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'
import { daysSince, dueMilestones, isRelanceEligible } from '@/lib/classement/categories'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// GET /api/agent/classement/count → nombre de relances à faire (badge nav)
export async function GET(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'agent')
    if (!auth.authenticated) return auth.error!

    try {
        const supabase = createClient(supabaseUrl, serviceKey)
        const { data } = await supabase
            .from('client_classement')
            .select('status, first_contact_at, relances_sent')
        let due = 0
        for (const c of data || []) {
            if (!isRelanceEligible(c.status)) continue
            const sent = Array.isArray(c.relances_sent) ? c.relances_sent : []
            if (dueMilestones(daysSince(c.first_contact_at), sent).length > 0) due++
        }
        return NextResponse.json({ due })
    } catch {
        return NextResponse.json({ due: 0 })
    }
}
