import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!

// PATCH /api/admin/waf/rules/[id] : Modifier une règle
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    const { id } = await params
    const body = await request.json().catch(() => ({}))

    // Valider le regex si fourni
    if (body.pattern) {
        try { new RegExp(body.pattern) } catch {
            return NextResponse.json({ error: 'Pattern regex invalide' }, { status: 400 })
        }
    }

    const allowed = ['name', 'pattern', 'category', 'description', 'severity', 'targets', 'enabled']
    const update: Record<string, unknown> = {}
    for (const key of allowed) {
        if (body[key] !== undefined) update[key] = body[key]
    }
    if (update.severity) update.severity = Math.min(5, Math.max(1, parseInt(String(update.severity)) || 2))

    const supabase = createClient(supabaseUrl, serviceKey)
    const { data, error } = await supabase
        .from('waf_rules')
        .update(update)
        .eq('id', id)
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ rule: data })
}

// DELETE /api/admin/waf/rules/[id] : Supprimer une règle
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    const { id } = await params
    const supabase = createClient(supabaseUrl, serviceKey)
    const { error } = await supabase.from('waf_rules').delete().eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
}
