// ══════════════════════════════════════════════════════════════
//  CONTRAT — Signature électronique
//  Deux parcours :
//   - token (lien sécurisé, client sans compte) : GET consultation + POST signature
//   - contractId + clientEmail (Espace Client, rétro-compatible)
//  La signature marque AUTOMATIQUEMENT le contrat « signé » avec
//  horodatage, empreinte SHA-256, IP et entrée d'audit.
// ══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { auditEntry, type AuditEntry } from '@/lib/contracts'
import { sendEmail, getEmailConfig } from '@/lib/email'
import { COMPANY } from '@/lib/company'
import { guardPublic, PUBLIC_FORM_LIMIT } from '@/lib/api-guard'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// Consultation publique du contrat via son token (page /contrat/[token])
export async function GET(request: NextRequest) {
    const token = request.nextUrl.searchParams.get('token')
    if (!token || !/^[a-f0-9]{16,128}$/i.test(token)) {
        return NextResponse.json({ error: 'Lien invalide' }, { status: 400 })
    }
    const supabase = createClient(supabaseUrl, serviceKey)
    const { data, error } = await supabase
        .from('contracts')
        .select('id, serial, client_nom, client_email, title, content, amount, currency, status, signed_at, signed_name, signature_method, signature_hash, agent_name, created_at, expires_at')
        .eq('sign_token', token)
        .single()
    if (error || !data) return NextResponse.json({ error: 'Contrat introuvable' }, { status: 404 })
    return NextResponse.json({ contract: data })
}

export async function POST(req: NextRequest) {
    const trop = guardPublic(req, 'contracts/sign', PUBLIC_FORM_LIMIT)
    if (trop) return trop

    try {
        const body = await req.json()
        const { token, contractId, clientEmail, signedName, consent } = body
        const supabase = createClient(supabaseUrl, serviceKey)

        // ── Récupération : par token (public) ou par id+email (Espace Client) ──
        let contract: Record<string, unknown> | null = null
        if (token) {
            if (!/^[a-f0-9]{16,128}$/i.test(String(token))) {
                return NextResponse.json({ error: 'Lien invalide.' }, { status: 400 })
            }
            const { data } = await supabase.from('contracts').select('*').eq('sign_token', token).single()
            contract = data
        } else if (contractId && clientEmail) {
            const { data } = await supabase.from('contracts').select('*')
                .eq('id', contractId).eq('client_email', String(clientEmail).toLowerCase()).single()
            contract = data
        } else {
            return NextResponse.json({ error: 'Paramètres manquants.' }, { status: 400 })
        }

        if (!contract) return NextResponse.json({ error: 'Contrat introuvable.' }, { status: 404 })
        if (contract.status === 'signe') {
            return NextResponse.json({ error: 'Ce contrat est déjà signé.', alreadySigned: true }, { status: 400 })
        }
        if (contract.expires_at && new Date(String(contract.expires_at)).getTime() < Date.now()) {
            return NextResponse.json({ error: 'Ce contrat a expiré. Contactez-nous pour une nouvelle version.' }, { status: 400 })
        }
        if (token && consent !== true) {
            return NextResponse.json({ error: 'Vous devez accepter les termes du contrat pour signer.' }, { status: 400 })
        }

        const id = String(contract.id)
        const now = new Date().toISOString()
        const name = String(signedName || contract.client_nom).trim().slice(0, 120)
        const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'inconnue'
        const signatureHash = crypto.createHash('sha256')
            .update(`${id}-${contract.client_email}-${name}-${ip}-${now}`)
            .digest('hex')

        const log: AuditEntry[] = Array.isArray(contract.audit_log) ? contract.audit_log as AuditEntry[] : []
        log.push(auditEntry('signature_en_ligne', name,
            `Signé en ligne (${token ? 'lien sécurisé' : 'Espace Client'}) — IP ${ip} — empreinte ${signatureHash.slice(0, 16)}…`))

        // Garde atomique : ne signe que si pas déjà signé (double-clic, doublon)
        const { data: updated, error } = await supabase
            .from('contracts')
            .update({
                status: 'signe',
                signed_at: now,
                signed_name: name,
                signed_ip: ip,
                signature_method: 'en_ligne',
                signature_hash: signatureHash,
                audit_log: log,
            })
            .eq('id', id)
            .neq('status', 'signe')
            .select()
        if (error) throw error
        if (!updated || updated.length === 0) {
            return NextResponse.json({ error: 'Ce contrat est déjà signé.', alreadySigned: true }, { status: 400 })
        }

        // ── Notification staff (best-effort, ne bloque jamais la signature) ──
        try {
            const config = await getEmailConfig()
            const staffTo = [...new Set([COMPANY.email, ...(config.adminEmail ? [config.adminEmail] : [])])].join(', ')
            await sendEmail({
                to: staffTo,
                subject: `Contrat signé — ${contract.serial || ''} ${contract.title}`,
                html: `<div style="font-family:Arial;max-width:560px;margin:0 auto;border:1px solid #eef2f1;border-radius:12px;padding:24px">
                    <p style="margin:0 0 8px;color:#047857;font-weight:800;font-size:14px">Signature électronique confirmée</p>
                    <p style="margin:0;color:#1B2A4A;font-size:13px;line-height:1.8">
                    Contrat <strong style="font-family:monospace">${contract.serial || id}</strong> — ${String(contract.title)}<br/>
                    Signataire : <strong>${name}</strong> (${String(contract.client_email)})<br/>
                    Le ${new Date(now).toLocaleString('fr-FR')} — IP ${ip}<br/>
                    Empreinte : <span style="font-family:monospace;font-size:11px">${signatureHash.slice(0, 32)}…</span></p>
                </div>`,
                context: 'contract_signed',
                relatedId: id,
            })
        } catch { /* non bloquant */ }

        return NextResponse.json({ success: true, signatureHash, signedAt: now })
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
