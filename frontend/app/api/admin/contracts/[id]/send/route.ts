// ══════════════════════════════════════════════════════════════
//  ADMIN/AGENT — Envoi du contrat au client
//  DÉTECTION DE COMPTE : le système scanne l'email fourni.
//   - Compte existant  → email « Espace Client » (+ lien direct en secours)
//   - Aucun compte     → email avec lien de signature en ligne sécurisé
//                        + possibilité de télécharger le PDF à signer à la main
//  Chaque envoi est consigné dans audit_log avec le résultat du scan.
// ══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'
import { COMPANY } from '@/lib/company'
import { auditEntry, esc, fmtAmount, fmtDate, generateSignToken, SITE_URL, type AuditEntry, type ContractRow } from '@/lib/contracts'
import { requireStaff } from '@/lib/api-guard'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// ── Le client a-t-il un compte sur la plateforme ? (scan auth Supabase) ──
async function hasPlatformAccount(email: string): Promise<boolean> {
    const supabase = createClient(supabaseUrl, serviceKey)
    const target = email.trim().toLowerCase()
    for (let page = 1; page <= 25; page++) {
        const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
        if (error || !data?.users?.length) return false
        if (data.users.some(u => (u.email || '').toLowerCase() === target)) return true
        if (data.users.length < 200) return false
    }
    return false
}

function emailShell(inner: string): string {
    return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;background:#fff;border:1px solid #eef2f1;border-radius:14px;overflow:hidden">
      <div style="height:5px;background:linear-gradient(90deg,#008751 0 33%,#FCD116 33% 66%,#E8112D 66% 100%)"></div>
      <div style="padding:28px 30px">
        <table style="border-collapse:collapse;margin:0 0 18px"><tr>
          <td><img src="${SITE_URL}/logo.jpg" alt="Retour Gagnant" style="width:46px;height:46px;border-radius:10px;object-fit:cover"/></td>
          <td style="padding-left:12px">
            <p style="margin:0;color:#1B2A4A;font-size:15px;font-weight:800">${esc(COMPANY.name)}</p>
            <p style="margin:1px 0 0;color:#8B94A6;font-size:11px">Accompagnement de la diaspora — Cotonou, Bénin</p>
          </td>
        </tr></table>
        ${inner}
        <p style="margin:22px 0 0;color:#5B6474;font-size:12px;line-height:1.7">Une question ? Écrivez-nous à <a href="mailto:${COMPANY.email}" style="color:#008751;font-weight:700;text-decoration:none">${COMPANY.email}</a> ou par WhatsApp au ${esc(COMPANY.phone)}.</p>
        <p style="margin:16px 0 0;color:#9aa5b1;font-size:10.5px;text-align:center;border-top:1px solid #eef1f0;padding-top:14px">${esc(COMPANY.name)} — RCCM ${esc(COMPANY.rccm)} — IFU ${esc(COMPANY.ifu)}<br/>${esc(COMPANY.address)}</p>
      </div>
    </div>`
}

function contractSummaryTable(c: ContractRow): string {
    return `
    <table style="width:100%;border-collapse:collapse;background:#F8FAF9;border-radius:10px;overflow:hidden;margin:0 0 20px">
      <tr><td style="padding:10px 14px;color:#8B94A6;font-size:12px;width:130px">Référence</td><td style="padding:10px 14px;color:#047857;font-size:13px;font-weight:800;font-family:monospace">${esc(c.serial)}</td></tr>
      <tr><td style="padding:10px 14px;color:#8B94A6;font-size:12px">Objet</td><td style="padding:10px 14px;color:#1B2A4A;font-size:13px;font-weight:700">${esc(c.title)}</td></tr>
      <tr><td style="padding:10px 14px;color:#8B94A6;font-size:12px">Montant</td><td style="padding:10px 14px;color:#1B2A4A;font-size:13px;font-weight:700">${fmtAmount(c.amount, c.currency)}</td></tr>
      <tr><td style="padding:10px 14px;color:#8B94A6;font-size:12px">Valable jusqu'au</td><td style="padding:10px 14px;color:#1B2A4A;font-size:13px">${fmtDate(c.expires_at)}</td></tr>
    </table>`
}

function buildAccountEmail(c: ContractRow, signUrl: string): string {
    return emailShell(`
        <h1 style="margin:0 0 6px;color:#1B2A4A;font-size:19px;font-weight:800">Votre contrat est prêt à être signé</h1>
        <p style="margin:0 0 18px;color:#5B6474;font-size:13.5px;line-height:1.7">Bonjour ${esc(c.client_nom)},<br/>Nous avons le plaisir de vous transmettre votre contrat. Vous pouvez le consulter et le signer électroniquement depuis votre Espace Client.</p>
        ${contractSummaryTable(c)}
        <div style="text-align:center;margin:0 0 14px">
          <a href="${SITE_URL}/mon-compte" style="display:inline-block;background:#10B981;color:#fff;text-decoration:none;padding:14px 30px;border-radius:12px;font-weight:800;font-size:14px">Ouvrir mon Espace Client</a>
        </div>
        <p style="margin:0;color:#8B94A6;font-size:11.5px;text-align:center;line-height:1.7">Vous pouvez aussi <a href="${signUrl}" style="color:#047857;font-weight:700">consulter et signer le contrat directement en ligne</a>, sans connexion.</p>`)
}

function buildNoAccountEmail(c: ContractRow, signUrl: string): string {
    return emailShell(`
        <h1 style="margin:0 0 6px;color:#1B2A4A;font-size:19px;font-weight:800">Votre contrat est prêt à être signé</h1>
        <p style="margin:0 0 18px;color:#5B6474;font-size:13.5px;line-height:1.7">Bonjour ${esc(c.client_nom)},<br/>Nous avons le plaisir de vous transmettre votre contrat. Aucun compte n'est nécessaire : le lien sécurisé ci-dessous vous permet de le consulter puis de le signer électroniquement en quelques secondes.</p>
        ${contractSummaryTable(c)}
        <div style="text-align:center;margin:0 0 16px">
          <a href="${signUrl}" style="display:inline-block;background:#10B981;color:#fff;text-decoration:none;padding:14px 30px;border-radius:12px;font-weight:800;font-size:14px">Consulter et signer le contrat en ligne</a>
        </div>
        <div style="background:#FAF8F1;border:1px solid #EDE4CB;border-radius:10px;padding:12px 16px">
          <p style="margin:0;color:#5B6474;font-size:12px;line-height:1.7"><strong style="color:#1B2A4A">Vous préférez signer à la main ?</strong> Depuis cette même page, téléchargez le contrat en PDF, imprimez-le, signez-le puis retournez-le-nous à <a href="mailto:${COMPANY.email}" style="color:#008751;font-weight:700;text-decoration:none">${COMPANY.email}</a>.</p>
        </div>`)
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const garde = await requireStaff(request, 'admin')
    if (!garde.ok) return garde.response!

    try {
        const { id } = await params
        const body = await request.json().catch(() => ({}))
        const actor = String(body.actor || 'Admin').slice(0, 80)
        const supabase = createClient(supabaseUrl, serviceKey)

        const { data: contract, error } = await supabase.from('contracts').select('*').eq('id', id).single()
        if (error || !contract) return NextResponse.json({ error: 'Contrat introuvable' }, { status: 404 })
        if (contract.status === 'signe') {
            return NextResponse.json({ error: 'Ce contrat est déjà signé — renvoi impossible.' }, { status: 400 })
        }

        // Filet : token manquant (contrat créé avant la v2 et migration non backfillée)
        let token: string = contract.sign_token
        if (!token) {
            token = generateSignToken()
            await supabase.from('contracts').update({ sign_token: token }).eq('id', id)
        }

        const signUrl = `${SITE_URL}/contrat/${token}`
        const hasAccount = await hasPlatformAccount(contract.client_email)
        const c = { ...contract, sign_token: token } as ContractRow

        const result = await sendEmail({
            to: contract.client_email,
            subject: `${COMPANY.name} — Contrat à signer : ${contract.title} (${contract.serial})`,
            html: hasAccount ? buildAccountEmail(c, signUrl) : buildNoAccountEmail(c, signUrl),
            context: 'contract_notification',
            relatedId: contract.id,
        })
        if (!result.success) {
            return NextResponse.json({ error: result.error || 'Envoi email impossible' }, { status: 500 })
        }

        const log: AuditEntry[] = Array.isArray(contract.audit_log) ? contract.audit_log : []
        const resend = contract.status === 'envoye'
        log.push(auditEntry(
            resend ? 'renvoi' : 'envoi',
            actor,
            `Email ${resend ? 'renvoyé' : 'envoyé'} à ${contract.client_email} — compte plateforme : ${hasAccount ? 'détecté (parcours Espace Client)' : 'aucun (parcours lien sécurisé + PDF)'}`
        ))
        await supabase.from('contracts').update({ status: 'envoye', audit_log: log }).eq('id', id)

        return NextResponse.json({ success: true, hasAccount, signUrl })
    } catch (err) {
        console.error('[contracts send]', err)
        return NextResponse.json({ error: 'Envoi impossible' }, { status: 500 })
    }
}
