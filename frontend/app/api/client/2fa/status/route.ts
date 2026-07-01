import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getClientUser } from '@/lib/client-auth'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// GET /api/client/2fa/status → { enabled }
export async function GET(request: NextRequest) {
    const user = await getClientUser(request)
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const supabase = createClient(supabaseUrl, serviceKey)
    const { data } = await supabase
        .from('totp_secrets').select('enabled').eq('user_id', user.id).maybeSingle()
    return NextResponse.json({ enabled: !!data?.enabled })
}
