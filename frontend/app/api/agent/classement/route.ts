import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'
import { categorize } from '@/lib/classement/categories'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// ══════════════════════════════════════════════════════════════
// Classement Client : API (accessible agents ET admins)
//   GET   → liste complète + stats par catégorie
//   PATCH → maj notes / statut / catégorie d'un client (+ last_review_at)
//   POST  → { action:'backfill' } import des clients existants
//           { action:'add', ... } ajout manuel
// ══════════════════════════════════════════════════════════════

function sb(): SupabaseClient { return createClient(supabaseUrl, serviceKey) }
const isEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)

export async function GET(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'agent')
    if (!auth.authenticated) return auth.error!

    const supabase = sb()
    // Les NOUVEAUX clients en premier (plus il est récent, plus il est haut)
    const { data, error } = await supabase
        .from('client_classement')
        .select('*')
        .order('first_contact_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const clients = data || []
    const stats: Record<string, number> = {}
    for (const c of clients) stats[c.service_category] = (stats[c.service_category] || 0) + 1

    return NextResponse.json({ clients, total: clients.length, stats })
}

export async function PATCH(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'agent')
    if (!auth.authenticated) return auth.error!

    const body = await request.json().catch(() => ({}))
    const id = String(body.id || '')
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const patch: Record<string, unknown> = { last_review_at: new Date().toISOString() }
    if (typeof body.notes === 'string') patch.notes = body.notes
    if (typeof body.status === 'string') patch.status = body.status
    if (typeof body.service_category === 'string') patch.service_category = body.service_category

    const supabase = sb()
    const { data, error } = await supabase
        .from('client_classement').update(patch).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, client: data })
}

export async function POST(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'agent')
    if (!auth.authenticated) return auth.error!

    const body = await request.json().catch(() => ({}))
    const supabase = sb()

    // ── Ajout manuel d'un client ──
    if (body.action === 'add') {
        const email = String(body.email || '').toLowerCase().trim()
        if (!isEmail(email)) return NextResponse.json({ error: 'Email invalide' }, { status: 400 })
        const { data: existing } = await supabase.from('client_classement').select('id').eq('email', email).maybeSingle()
        if (existing) return NextResponse.json({ error: 'Ce client existe déjà.' }, { status: 409 })
        const { data, error } = await supabase.from('client_classement').insert({
            email,
            full_name: body.full_name || null,
            phone: body.phone || null,
            service_category: categorize(body.service_category || body.service_label),
            service_label: body.service_label || null,
            source: 'manuel',
            status: 'nouveau',
            notes: body.notes || null,
            first_contact_at: body.first_contact_at || new Date().toISOString(),
        }).select().single()
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true, client: data })
    }

    // ── Backfill : importe les clients existants des autres tables ──
    if (body.action === 'backfill') {
        const { data: existingRows } = await supabase.from('client_classement').select('email')
        const known = new Set((existingRows || []).map(r => (r.email || '').toLowerCase()))
        const toInsert = new Map<string, Record<string, unknown>>()

        // Ajoute/fusionne : conserve la date la plus ANCIENNE (ancienneté réelle),
        // complète les champs manquants, et améliore la catégorie si « autres ».
        const add = (email: string, row: Record<string, unknown>) => {
            const e = (email || '').toLowerCase().trim()
            if (!e || !isEmail(e) || known.has(e)) return
            const prev = toInsert.get(e)
            if (!prev) { toInsert.set(e, { ...row, email: e }); return }
            const merged: Record<string, unknown> = { ...prev }
            const prevDate = prev.first_contact_at ? new Date(String(prev.first_contact_at)).getTime() : Infinity
            const newDate = row.first_contact_at ? new Date(String(row.first_contact_at)).getTime() : Infinity
            if (newDate < prevDate) merged.first_contact_at = row.first_contact_at
            if (!prev.full_name && row.full_name) merged.full_name = row.full_name
            if (!prev.phone && row.phone) merged.phone = row.phone
            if ((!prev.service_category || prev.service_category === 'autres') && row.service_category && row.service_category !== 'autres') {
                merged.service_category = row.service_category
                merged.service_label = row.service_label || prev.service_label
            }
            toInsert.set(e, merged)
        }

        // 1) Prospects nationalité / éligibilité
        try {
            const { data } = await supabase.from('eligibility_results')
                .select('client_nom, client_prenom, client_email, client_whatsapp, recommended_service, objective, created_at')
            for (const r of data || []) {
                add(r.client_email, {
                    full_name: `${r.client_prenom || ''} ${r.client_nom || ''}`.trim() || null,
                    phone: r.client_whatsapp || null,
                    service_category: categorize(r.recommended_service || r.objective),
                    service_label: r.recommended_service || r.objective || null,
                    source: 'backfill', status: 'nouveau',
                    first_contact_at: r.created_at || new Date().toISOString(),
                })
            }
        } catch { /* table absente */ }

        // 2) Rendez-vous
        try {
            const { data } = await supabase.from('rdv_requests')
                .select('client_email, motif, notes, created_at')
            for (const r of data || []) {
                const notes = String(r.notes || '')
                const nameMatch = notes.match(/__VISITOR__:\s*([^|]+)/)
                const telMatch = notes.match(/Tel:\s*([^\n|]+)/)
                add(r.client_email, {
                    full_name: nameMatch ? nameMatch[1].trim() : null,
                    phone: telMatch ? telMatch[1].trim() : null,
                    service_category: categorize(r.motif),
                    service_label: r.motif || null,
                    source: 'backfill', status: 'nouveau',
                    first_contact_at: r.created_at || new Date().toISOString(),
                })
            }
        } catch { /* table absente */ }

        // 3) Messages de contact
        try {
            const { data } = await supabase.from('messages')
                .select('nom, prenom, email, sujet, created_at')
            for (const r of data || []) {
                add(r.email, {
                    full_name: `${r.prenom || ''} ${r.nom || ''}`.trim() || null,
                    phone: null,
                    service_category: categorize(r.sujet),
                    service_label: r.sujet || null,
                    source: 'backfill', status: 'nouveau',
                    first_contact_at: r.created_at || new Date().toISOString(),
                })
            }
        } catch { /* table absente */ }

        // 4) Suivi de dossiers : service_type bien catégorisable
        try {
            const { data } = await supabase.from('dossier_tracking')
                .select('client_nom, client_prenom, client_email, service_type, service, created_at')
            for (const r of data || []) {
                add(r.client_email, {
                    full_name: `${r.client_prenom || ''} ${r.client_nom || ''}`.trim() || null,
                    phone: null,
                    service_category: categorize(r.service_type || r.service),
                    service_label: r.service_type || r.service || null,
                    source: 'backfill', status: 'nouveau',
                    first_contact_at: r.created_at || new Date().toISOString(),
                })
            }
        } catch { /* table absente */ }

        // 5) Commandes boutique (clients ayant acheté)
        try {
            const { data } = await supabase.from('orders')
                .select('customer_email, customer_name, email, full_name, phone, created_at')
            for (const r of data || []) {
                add(r.customer_email || r.email, {
                    full_name: r.customer_name || r.full_name || null,
                    phone: r.phone || null,
                    service_category: 'autres',
                    service_label: 'Commande boutique',
                    source: 'backfill', status: 'converti',
                    first_contact_at: r.created_at || new Date().toISOString(),
                })
            }
        } catch { /* table absente */ }

        // 6) Profils clients (comptes créés)
        try {
            const { data } = await supabase.from('client_profiles')
                .select('email, full_name, first_name, last_name, phone, created_at')
            for (const r of data || []) {
                add(r.email, {
                    full_name: r.full_name || `${r.first_name || ''} ${r.last_name || ''}`.trim() || null,
                    phone: r.phone || null,
                    service_category: 'autres',
                    service_label: 'Compte client',
                    source: 'backfill', status: 'en_cours',
                    first_contact_at: r.created_at || new Date().toISOString(),
                })
            }
        } catch { /* table absente */ }

        // 7) Inscriptions aux événements
        try {
            const { data } = await supabase.from('event_registrations')
                .select('email, full_name, phone, whatsapp, created_at')
            for (const r of data || []) {
                add(r.email, {
                    full_name: r.full_name || null,
                    phone: r.phone || r.whatsapp || null,
                    service_category: 'culture',
                    service_label: 'Événement communautaire',
                    source: 'backfill', status: 'nouveau',
                    first_contact_at: r.created_at || new Date().toISOString(),
                })
            }
        } catch { /* table absente */ }

        const rows = [...toInsert.values()]
        if (rows.length === 0) return NextResponse.json({ success: true, imported: 0 })

        // Insertion par lots de 200
        let imported = 0
        for (let i = 0; i < rows.length; i += 200) {
            const chunk = rows.slice(i, i + 200)
            const { data, error } = await supabase.from('client_classement').insert(chunk).select('id')
            if (!error && data) imported += data.length
        }
        return NextResponse.json({ success: true, imported })
    }

    return NextResponse.json({ error: 'Action inconnue' }, { status: 400 })
}

// DELETE /api/agent/classement : supprime un client du classement (id requis).
export async function DELETE(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'agent')
    if (!auth.authenticated) return auth.error!

    const body = await request.json().catch(() => ({}))
    const id = String(body.id || '')
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const supabase = sb()
    const { error } = await supabase.from('client_classement').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
}
