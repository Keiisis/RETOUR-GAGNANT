// GET   /api/mon-compte/notifications — 20 dernières notifications de l'email PROUVÉ.
// PATCH /api/mon-compte/notifications — { id? } marque lue(s).
// Remplace la lecture/écriture en clé publique de ClientBell, qui prenait
// l'email dans le localStorage (audit 25/09/2026).
import { NextRequest, NextResponse } from 'next/server'
import { supabaseServeur } from '@/lib/supabase-serveur'
import { emailProuve } from '@/lib/espace-email'

const motif = (email: string) => email.replace(/[\\%_]/g, c => '\\' + c)

export async function GET(req: NextRequest) {
    const email = await emailProuve(req)
    if (!email) return NextResponse.json({ error: 'Session expirée.' }, { status: 401 })
    const { data, error } = await supabaseServeur
        .from('client_notifications')
        .select('id, title, message, type, is_read, link, created_at')
        .ilike('client_email', motif(email))
        .order('created_at', { ascending: false })
        .limit(20)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ notifications: data || [] })
}

export async function PATCH(req: NextRequest) {
    const email = await emailProuve(req)
    if (!email) return NextResponse.json({ error: 'Session expirée.' }, { status: 401 })
    const body = await req.json().catch(() => ({}))
    let q = supabaseServeur.from('client_notifications').update({ is_read: true }).ilike('client_email', motif(email))
    if (body?.id) q = q.eq('id', String(body.id))
    const { error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
}
