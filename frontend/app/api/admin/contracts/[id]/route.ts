// ══════════════════════════════════════════════════════════════
//  ADMIN/AGENT : Contrat : édition (whitelist) + suppression
//  IMMUABLES : serial, created_at, agent_name, sign_token
//  (whitelist ici + trigger SQL en base = double verrou)
//  Chaque modification est consignée dans audit_log.
// ══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { auditEntry, type AuditEntry } from '@/lib/contracts'
import { requireStaff } from '@/lib/api-guard'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const EDITABLE = ['client_nom', 'client_email', 'title', 'content', 'amount', 'currency', 'expires_at'] as const

const FIELD_LABELS: Record<string, string> = {
    client_nom: 'nom du client', client_email: 'email du client', title: 'titre',
    content: 'contenu', amount: 'montant', currency: 'devise', expires_at: 'date de validité',
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const garde = await requireStaff(request, 'admin')
    if (!garde.ok) return garde.response!

    try {
        const { id } = await params
        const body = await request.json()
        const actor = String(body.actor || 'Admin').slice(0, 80)
        const supabase = createClient(supabaseUrl, serviceKey)

        const { data: existing, error: fetchErr } = await supabase
            .from('contracts').select('*').eq('id', id).single()
        if (fetchErr || !existing) return NextResponse.json({ error: 'Contrat introuvable' }, { status: 404 })

        const log: AuditEntry[] = Array.isArray(existing.audit_log) ? existing.audit_log : []
        const update: Record<string, unknown> = {}

        // ── Marquage manuel signé / non signé ──
        if (body.action === 'mark_signed') {
            const signedName = String(body.signed_name || existing.client_nom).slice(0, 120)
            update.status = 'signe'
            update.signed_at = new Date().toISOString()
            update.signed_name = signedName
            update.signature_method = 'manuel'
            update.signature_hash = crypto.createHash('sha256')
                .update(`${id}-manuel-${actor}-${update.signed_at}`).digest('hex')
            log.push(auditEntry('marquage_signe', actor, `Marqué signé manuellement (signataire : ${signedName})`))
        } else if (body.action === 'mark_unsigned') {
            update.status = 'envoye'
            update.signed_at = null
            update.signed_name = null
            update.signed_ip = null
            update.signature_method = null
            update.signature_hash = ''
            log.push(auditEntry('marquage_non_signe', actor, 'Signature retirée : repassé au statut « envoyé »'))
        } else {
            // ── Édition classique : uniquement les champs autorisés ──
            const changed: string[] = []
            for (const field of EDITABLE) {
                if (!(field in body)) continue
                let value = body[field]
                if (field === 'amount') value = Number(value) || 0
                if (field === 'client_email') value = String(value).trim().toLowerCase()
                if (typeof value === 'string' && field !== 'content') value = value.trim()
                if (value !== existing[field]) {
                    update[field] = value
                    changed.push(FIELD_LABELS[field] || field)
                }
            }
            if (changed.length === 0) {
                return NextResponse.json({ success: true, contract: existing, unchanged: true })
            }
            log.push(auditEntry('modification', actor, `Champs modifiés : ${changed.join(', ')}`))
        }

        update.audit_log = log
        const { data, error } = await supabase
            .from('contracts').update(update).eq('id', id).select().single()
        if (error) throw error

        return NextResponse.json({ success: true, contract: data })
    } catch (err) {
        console.error('[contracts PATCH]', err)
        return NextResponse.json({ error: 'Mise à jour impossible' }, { status: 500 })
    }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const garde = await requireStaff(request, 'admin')
    if (!garde.ok) return garde.response!

    try {
        const { id } = await params
        const supabase = createClient(supabaseUrl, serviceKey)
        const { error } = await supabase.from('contracts').delete().eq('id', id)
        if (error) throw error
        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('[contracts DELETE]', err)
        return NextResponse.json({ error: 'Suppression impossible' }, { status: 500 })
    }
}
