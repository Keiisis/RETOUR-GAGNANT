// ══════════════════════════════════════════════════════════════
//  CONTRATS — logique partagée (serveur)
//  Numéro de série immuable, journal d'audit, template A4 légal
// ══════════════════════════════════════════════════════════════

import crypto from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { COMPANY } from '@/lib/company'

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.retourgagnantbenin.bj'

export interface ContractRow {
    id: string
    serial: string | null
    client_nom: string
    client_email: string
    title: string
    content: string
    amount: number
    currency: string
    status: string
    signed_at: string | null
    signed_name: string | null
    signed_ip: string | null
    signature_method: string | null
    signature_hash: string | null
    sign_token: string | null
    agent_name: string
    audit_log: AuditEntry[] | null
    created_at: string
    updated_at: string | null
    expires_at: string | null
}

export interface AuditEntry {
    at: string
    action: string
    actor: string
    details?: string
}

export function auditEntry(action: string, actor: string, details?: string): AuditEntry {
    return { at: new Date().toISOString(), action, actor, ...(details ? { details } : {}) }
}

// ── Numéro de série : CTR-YYYYMM-XXXX (unique, vérifié en base) ──
export async function generateSerial(supabase: SupabaseClient): Promise<string> {
    const ym = new Date().toISOString().slice(0, 7).replace('-', '')
    for (let i = 0; i < 8; i++) {
        const serial = `CTR-${ym}-${crypto.randomInt(0, 10000).toString().padStart(4, '0')}`
        const { data } = await supabase.from('contracts').select('id').eq('serial', serial).limit(1)
        if (!data || data.length === 0) return serial
    }
    return `CTR-${ym}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`
}

export function generateSignToken(): string {
    return crypto.randomBytes(24).toString('hex')
}

export function esc(s: unknown): string {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function fmtAmount(amount: number, currency: string): string {
    const n = Number(amount || 0).toLocaleString('fr-FR')
    if (currency === 'XOF') return `${n} FCFA`
    if (currency === 'EUR') return `${n} €`
    if (currency === 'USD') return `$${n}`
    return `${n} ${currency}`
}

export function fmtDate(d: string | null | undefined): string {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function fmtDateTime(d: string | null | undefined): string {
    if (!d) return '—'
    return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ══════════════════════════════════════════════════════════════
//  TEMPLATE A4 — document contractuel professionnel
//  Utilisé pour : aperçu admin/agent, PDF téléchargeable,
//  page publique de signature (mode embed)
// ══════════════════════════════════════════════════════════════

export function contractDocumentHtml(c: ContractRow, opts: { embed?: boolean } = {}): string {
    const signed = c.status === 'signe'
    const paragraphs = String(c.content || '')
        .split(/\r?\n/)
        .map(l => l.trim())
        .map(l => l === '' ? '<div style="height:8px"></div>' : `<p style="margin:0 0 8px;color:#2A3448;font-size:12.5px;line-height:1.75;text-align:justify">${esc(l)}</p>`)
        .join('')

    const signatureClientBlock = signed
        ? `<p style="margin:0 0 2px;font-family:'Playfair Display',Georgia,serif;font-style:italic;font-size:19px;color:#1B2A4A">${esc(c.signed_name || c.client_nom)}</p>
           <p style="margin:0 0 2px;color:#047857;font-size:10.5px;font-weight:700">Signé électroniquement le ${fmtDateTime(c.signed_at)}</p>
           ${c.signature_method === 'manuel'
            ? '<p style="margin:0;color:#8B94A6;font-size:9.5px">Signature recueillie manuellement — enregistrée par l\'agence</p>'
            : `<p style="margin:0;color:#8B94A6;font-size:9.5px;font-family:monospace">Empreinte SHA-256 : ${esc((c.signature_hash || '').slice(0, 32))}…</p>`}`
        : `<div style="height:58px;border-bottom:1px dotted #B9C2CF"></div>
           <p style="margin:6px 0 0;color:#8B94A6;font-size:10px">Signature précédée de la mention « Lu et approuvé »</p>`

    const doc = `
    <div class="contract-sheet" style="max-width:794px;margin:0 auto;background:#fff;color:#1B2A4A;font-family:Arial,Helvetica,sans-serif">
      <div style="height:6px;background:linear-gradient(90deg,#008751 0 33%,#FCD116 33% 66%,#E8112D 66% 100%)"></div>
      <div style="padding:34px 44px 30px">

        <!-- En-tête société -->
        <table style="width:100%;border-collapse:collapse;margin:0 0 26px"><tr>
          <td style="vertical-align:middle;width:76px"><img src="${SITE_URL}/logo.jpg" alt="Logo" style="width:64px;height:64px;border-radius:12px;object-fit:cover"/></td>
          <td style="vertical-align:middle;padding-left:14px">
            <p style="margin:0;font-size:16px;font-weight:800;color:#1B2A4A;letter-spacing:.02em">${esc(COMPANY.name)}</p>
            <p style="margin:2px 0 0;font-size:9.5px;color:#5B6474">RCCM : ${esc(COMPANY.rccm)} &nbsp;|&nbsp; IFU : ${esc(COMPANY.ifu)}</p>
            <p style="margin:1px 0 0;font-size:9.5px;color:#5B6474">${esc(COMPANY.address)} &nbsp;|&nbsp; ${esc(COMPANY.phone)}</p>
            <p style="margin:1px 0 0;font-size:9.5px;color:#5B6474">${esc(COMPANY.email)} &nbsp;|&nbsp; ${esc(COMPANY.website)}</p>
          </td>
          <td style="vertical-align:top;text-align:right;white-space:nowrap">
            <p style="margin:0;font-size:9px;color:#8B94A6;text-transform:uppercase;letter-spacing:.2em;font-weight:800">Contrat</p>
            <p style="margin:3px 0 0;font-size:13px;font-weight:800;color:#047857;font-family:monospace">${esc(c.serial || '—')}</p>
            <p style="margin:5px 0 0;font-size:9.5px;color:#5B6474">Émis le ${fmtDate(c.created_at)}</p>
            ${c.expires_at ? `<p style="margin:1px 0 0;font-size:9.5px;color:#5B6474">Valable jusqu'au ${fmtDate(c.expires_at)}</p>` : ''}
          </td>
        </tr></table>

        <!-- Titre -->
        <div style="text-align:center;margin:0 0 24px">
          <h1 style="margin:0;font-size:20px;font-weight:800;color:#1B2A4A;text-transform:uppercase;letter-spacing:.04em">${esc(c.title)}</h1>
          <div style="width:70px;height:3px;background:#C9A84C;margin:10px auto 0;border-radius:2px"></div>
        </div>

        <!-- Parties -->
        <p style="margin:0 0 10px;font-size:12.5px;color:#2A3448;font-weight:800;text-transform:uppercase;letter-spacing:.08em">Entre les soussignés :</p>
        <table style="width:100%;border-collapse:separate;border-spacing:0 8px;margin:0 0 18px">
          <tr><td style="background:#F4FAF6;border:1px solid #DCEDE4;border-radius:10px;padding:12px 16px">
            <p style="margin:0;font-size:12px;color:#1B2A4A;line-height:1.7"><strong>${esc(COMPANY.name)}</strong>, société immatriculée au RCCM sous le n° ${esc(COMPANY.rccm)}, IFU ${esc(COMPANY.ifu)}, dont le siège est situé ${esc(COMPANY.address)}, représentée par <strong>${esc(c.agent_name || 'la Direction')}</strong>, dûment habilité(e),</p>
            <p style="margin:4px 0 0;font-size:11px;color:#5B6474">ci-après dénommée <strong>« le Prestataire »</strong>, d'une part,</p>
          </td></tr>
          <tr><td style="background:#FAF8F1;border:1px solid #EDE4CB;border-radius:10px;padding:12px 16px">
            <p style="margin:0;font-size:12px;color:#1B2A4A;line-height:1.7"><strong>${esc(c.client_nom)}</strong>, joignable à l'adresse électronique <strong>${esc(c.client_email)}</strong>,</p>
            <p style="margin:4px 0 0;font-size:11px;color:#5B6474">ci-après dénommé(e) <strong>« le Client »</strong>, d'autre part.</p>
          </td></tr>
        </table>

        <p style="margin:0 0 18px;font-size:12.5px;color:#2A3448;font-weight:800;text-transform:uppercase;letter-spacing:.08em">Il a été convenu ce qui suit :</p>

        <!-- Corps du contrat -->
        <div style="margin:0 0 18px">${paragraphs}</div>

        <!-- Conditions financières -->
        <div style="background:#F8FAF9;border:1px solid #E5EBE8;border-radius:10px;padding:14px 18px;margin:0 0 18px">
          <p style="margin:0 0 4px;font-size:10px;font-weight:800;color:#8B94A6;text-transform:uppercase;letter-spacing:.15em">Conditions financières</p>
          <p style="margin:0;font-size:13px;color:#1B2A4A">Montant total de la prestation : <strong style="color:#047857;font-size:15px">${fmtAmount(c.amount, c.currency)}</strong></p>
        </div>

        <!-- Clauses légales -->
        <div style="margin:0 0 26px">
          <p style="margin:0 0 6px;font-size:11px;font-weight:800;color:#1B2A4A;text-transform:uppercase;letter-spacing:.08em">Dispositions générales</p>
          <p style="margin:0 0 5px;font-size:10.5px;color:#5B6474;line-height:1.7;text-align:justify"><strong>Validité.</strong> La présente offre contractuelle est valable jusqu'au ${fmtDate(c.expires_at)}. Passé ce délai et à défaut de signature, elle devient caduque.</p>
          <p style="margin:0 0 5px;font-size:10.5px;color:#5B6474;line-height:1.7;text-align:justify"><strong>Signature électronique.</strong> Conformément aux dispositions du Code du numérique de la République du Bénin (loi n° 2017-20), les parties reconnaissent à la signature électronique apposée sur le présent contrat la même valeur probante qu'une signature manuscrite. Chaque signature en ligne est horodatée et scellée par une empreinte cryptographique SHA-256 conservée par le Prestataire.</p>
          <p style="margin:0 0 5px;font-size:10.5px;color:#5B6474;line-height:1.7;text-align:justify"><strong>Droit applicable — litiges.</strong> Le présent contrat est régi par le droit béninois. À défaut de règlement amiable, tout litige relatif à sa validité, son interprétation ou son exécution relèvera de la compétence des juridictions de Cotonou (République du Bénin).</p>
          <p style="margin:0;font-size:10.5px;color:#5B6474;line-height:1.7;text-align:justify"><strong>Intégralité.</strong> Le présent document, identifié par le numéro ${esc(c.serial || '—')}, exprime l'intégralité de l'accord des parties sur son objet et prévaut sur tout échange antérieur.</p>
        </div>

        <!-- Signatures -->
        <table style="width:100%;border-collapse:separate;border-spacing:14px 0;margin:0 -14px 10px"><tr>
          <td style="width:50%;vertical-align:top;border:1px solid #E5EBE8;border-radius:12px;padding:14px 16px">
            <p style="margin:0 0 10px;font-size:10px;font-weight:800;color:#8B94A6;text-transform:uppercase;letter-spacing:.12em">Pour le Prestataire</p>
            <p style="margin:0 0 2px;font-family:'Playfair Display',Georgia,serif;font-style:italic;font-size:19px;color:#1B2A4A">${esc(c.agent_name || COMPANY.name)}</p>
            <p style="margin:0;color:#8B94A6;font-size:9.5px">Fait à Cotonou, le ${fmtDate(c.created_at)}</p>
          </td>
          <td style="width:50%;vertical-align:top;border:1px solid ${signed ? '#BFE3D2' : '#E5EBE8'};border-radius:12px;padding:14px 16px;background:${signed ? '#F4FAF6' : '#fff'}">
            <p style="margin:0 0 10px;font-size:10px;font-weight:800;color:#8B94A6;text-transform:uppercase;letter-spacing:.12em">Pour le Client</p>
            ${signatureClientBlock}
          </td>
        </tr></table>

        <!-- Pied -->
        <div style="border-top:1px solid #EEF1F0;padding-top:10px;margin-top:8px">
          <p style="margin:0;font-size:8.5px;color:#9AA5B1;text-align:center;line-height:1.6">
            ${esc(COMPANY.name)} — RCCM ${esc(COMPANY.rccm)} — IFU ${esc(COMPANY.ifu)} — ${esc(COMPANY.address)}<br/>
            Document n° ${esc(c.serial || '—')} émis le ${fmtDateTime(c.created_at)}${signed ? ` — signé le ${fmtDateTime(c.signed_at)}` : ''} — retourgagnantbenin.bj
          </p>
        </div>
      </div>
    </div>`

    if (opts.embed) return doc

    return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(c.serial || 'Contrat')} — ${esc(c.title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital@0;1&display=swap" rel="stylesheet"/>
<style>
  *{box-sizing:border-box} body{margin:0;background:#EDF1EF;padding:28px 12px}
  .toolbar{max-width:794px;margin:0 auto 14px;display:flex;justify-content:flex-end;gap:10px}
  .toolbar button{background:#047857;color:#fff;border:0;border-radius:10px;padding:11px 22px;font-weight:800;font-size:13px;cursor:pointer;font-family:Arial}
  .contract-sheet{box-shadow:0 10px 40px rgba(27,42,74,.12);border-radius:4px;overflow:hidden}
  @media print{ body{background:#fff;padding:0} .toolbar{display:none} .contract-sheet{box-shadow:none} }
</style></head>
<body>
  <div class="toolbar"><button onclick="window.print()">Imprimer / Enregistrer en PDF</button></div>
  ${doc}
</body></html>`
}
