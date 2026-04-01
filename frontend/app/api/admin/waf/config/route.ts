import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!

const ALLOWED_KEYS = ['enabled', 'paranoia_level', 'blocked_countries', 'whitelisted_ips', 'whitelisted_paths']

// GET /api/admin/waf/config
export async function GET(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    const supabase = createClient(supabaseUrl, serviceKey)
    const { data, error } = await supabase
        .from('waf_config')
        .select('key, value, description, updated_at')
        .in('key', ALLOWED_KEYS)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const config: Record<string, string> = {}
    for (const row of (data || [])) config[row.key] = row.value

    return NextResponse.json({ config })
}

// PATCH /api/admin/waf/config
// Body: { paranoia_level: 2, blocked_countries: ["KP","IR"], ... }
export async function PATCH(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    const body = await request.json().catch(() => ({}))
    const supabase = createClient(supabaseUrl, serviceKey)

    const updates: PromiseLike<unknown>[] = []

    for (const key of ALLOWED_KEYS) {
        if (body[key] === undefined) continue

        let value: string
        if (key === 'paranoia_level') {
            value = String(Math.min(4, Math.max(1, parseInt(body[key]) || 1)))
        } else if (key === 'enabled') {
            value = body[key] === true || body[key] === 'true' ? 'true' : 'false'
        } else if (Array.isArray(body[key])) {
            value = JSON.stringify(body[key])
        } else {
            value = String(body[key])
        }

        updates.push(
            supabase.from('waf_config')
                .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
                .then(() => {})
        )
    }

    await Promise.all(updates)
    return NextResponse.json({ success: true })
}
