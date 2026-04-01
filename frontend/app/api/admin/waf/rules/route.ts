import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!

// GET /api/admin/waf/rules — Liste toutes les règles custom
export async function GET(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    const supabase = createClient(supabaseUrl, serviceKey)
    const { data, error } = await supabase
        .from('waf_rules')
        .select('*')
        .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ rules: data || [] })
}

// POST /api/admin/waf/rules — Créer une règle custom
// Body: { name, pattern, category, description, severity, targets, enabled }
export async function POST(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    const body = await request.json().catch(() => ({}))
    const { name, pattern, category, description, severity, targets, enabled } = body

    if (!name || !pattern) {
        return NextResponse.json({ error: 'Nom et pattern requis' }, { status: 400 })
    }

    // Valider que le regex est syntaxiquement correct
    try { new RegExp(pattern) } catch {
        return NextResponse.json({ error: 'Pattern regex invalide' }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, serviceKey)
    const { data, error } = await supabase.from('waf_rules').insert({
        name:        name.slice(0, 100),
        pattern:     pattern.slice(0, 500),
        category:    category || 'custom',
        description: description?.slice(0, 300) || null,
        severity:    Math.min(5, Math.max(1, parseInt(severity) || 2)),
        targets:     Array.isArray(targets) ? targets : ['all'],
        enabled:     enabled !== false,
        created_by:  auth.userId,
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ rule: data }, { status: 201 })
}
