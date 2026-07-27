// Test de connexion e-MCF (GET /info) — valide le jeton avant normalisation.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireStaff } from '@/lib/api-guard'
import { getMecefConfig, getInfo } from '@/lib/mecef'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export async function POST(request: NextRequest) {
    const garde = await requireStaff(request, 'admin')
    if (!garde.ok) return garde.response!
    try {
        const supabase = createClient(supabaseUrl, serviceKey)
        const cfg = await getMecefConfig(supabase)
        const r = await getInfo(cfg)
        return NextResponse.json({ success: true, sandbox: r.sandbox, info: r.info })
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Test impossible'
        return NextResponse.json({ error: msg }, { status: 502 })
    }
}
