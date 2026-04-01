import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!

// GET /api/admin/2fa/status
export async function GET(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    const supabase = createClient(supabaseUrl, serviceKey)
    const { data } = await supabase
        .from('totp_secrets')
        .select('enabled, verified_at')
        .eq('user_id', auth.userId!)
        .maybeSingle()

    return NextResponse.json({
        enabled:     data?.enabled    ?? false,
        verifiedAt:  data?.verified_at ?? null,
    })
}
