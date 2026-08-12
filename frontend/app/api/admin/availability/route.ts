// ══════════════════════════════════════════════════════════════
//  ADMIN : Horaires d'ouverture & fermetures exceptionnelles
//  GET     → règles + exceptions
//  POST    → { kind: 'rule' | 'exception', ... }
//  PATCH   → mise à jour d'une règle
//  DELETE  → ?kind=rule|exception&id=…
// ══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

const db = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const MISSING = "Tables de disponibilités absentes. Exécutez supabase/migrations/20260723_disponibilites.sql."
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export async function GET(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'agent')
    if (!auth.authenticated) return auth.error!

    const supabase = db()
    const [rules, exceptions] = await Promise.all([
        supabase.from('availability_rules').select('*').order('weekday').order('start_time'),
        supabase.from('availability_exceptions').select('*').gte('date', new Date().toISOString().slice(0, 10)).order('date'),
    ])
    if (rules.error) {
        const missing = rules.error.message?.includes('availability_rules')
        return NextResponse.json({ error: missing ? MISSING : rules.error.message }, { status: missing ? 503 : 500 })
    }
    return NextResponse.json({ rules: rules.data || [], exceptions: exceptions.data || [] })
}

export async function POST(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    const body = await request.json().catch(() => ({}))
    const supabase = db()

    if (body.kind === 'exception') {
        const date = String(body.date || '')
        if (!ISO_DATE.test(date)) return NextResponse.json({ error: 'Date invalide.' }, { status: 400 })
        const type = body.exception_kind === 'open' ? 'open' : 'closed'
        const start = body.start_time ? String(body.start_time).slice(0, 5) : null
        const end = body.end_time ? String(body.end_time).slice(0, 5) : null
        if (start && !HHMM.test(start)) return NextResponse.json({ error: 'Heure de début invalide.' }, { status: 400 })
        if (end && !HHMM.test(end)) return NextResponse.json({ error: 'Heure de fin invalide.' }, { status: 400 })
        if (start && end && end <= start) return NextResponse.json({ error: 'La fin doit suivre le début.' }, { status: 400 })
        if (type === 'open' && (!start || !end)) {
            return NextResponse.json({ error: 'Une ouverture exceptionnelle exige une plage horaire.' }, { status: 400 })
        }

        const { error } = await supabase.from('availability_exceptions').insert({
            date, kind: type, start_time: start, end_time: end,
            slot_minutes: Number(body.slot_minutes) || 30,
            capacity: Number(body.capacity) || 1,
            service: body.service ? String(body.service) : null,
            reason: body.reason ? String(body.reason).slice(0, 200) : null,
        })
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true })
    }

    // Règle récurrente
    const weekday = Number(body.weekday)
    const start = String(body.start_time || '').slice(0, 5)
    const end = String(body.end_time || '').slice(0, 5)
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
        return NextResponse.json({ error: 'Jour de semaine invalide.' }, { status: 400 })
    }
    if (!HHMM.test(start) || !HHMM.test(end)) return NextResponse.json({ error: 'Horaires invalides.' }, { status: 400 })
    if (end <= start) return NextResponse.json({ error: 'La fin doit suivre le début.' }, { status: 400 })

    const { error } = await supabase.from('availability_rules').insert({
        weekday, start_time: start, end_time: end,
        slot_minutes: Number(body.slot_minutes) || 30,
        capacity: Number(body.capacity) || 1,
        service: body.service ? String(body.service) : null,
        is_active: body.is_active !== false,
    })
    if (error) {
        const missing = error.message?.includes('availability_rules')
        return NextResponse.json({ error: missing ? MISSING : error.message }, { status: missing ? 503 : 500 })
    }
    return NextResponse.json({ success: true })
}

export async function PATCH(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    const body = await request.json().catch(() => ({}))
    const id = String(body.id || '')
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const patch: Record<string, unknown> = {}
    if ('is_active' in body) patch.is_active = !!body.is_active
    if (body.start_time && HHMM.test(String(body.start_time).slice(0, 5))) patch.start_time = String(body.start_time).slice(0, 5)
    if (body.end_time && HHMM.test(String(body.end_time).slice(0, 5))) patch.end_time = String(body.end_time).slice(0, 5)
    if (body.slot_minutes) patch.slot_minutes = Number(body.slot_minutes)
    if (body.capacity) patch.capacity = Number(body.capacity)
    if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Rien à modifier' }, { status: 400 })

    const { error } = await db().from('availability_rules').update(patch).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!

    const id = request.nextUrl.searchParams.get('id')
    const kind = request.nextUrl.searchParams.get('kind') === 'exception'
        ? 'availability_exceptions' : 'availability_rules'
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const { error } = await db().from(kind).delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
}
