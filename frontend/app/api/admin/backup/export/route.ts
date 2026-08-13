import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'
import type { SupabaseClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'
import {
    getAdminClient, loadAllClients, toSummary, matchesKey,
    type ClientRecord,
} from '@/lib/backup/aggregate'
import { generateInvoicePdf, type InvoicePdfData, type InvoicePdfItem } from '@/lib/invoice-pdf-generator'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

/* ═══════════════════════════════════════════════════════════
   EXPORT SAUVEGARDE — 100 % lisible par une personne non technique.

   GET /api/admin/backup/export            → ZIP de TOUS les clients
   GET /api/admin/backup/export?client=KEY → ZIP d'un seul client

   Chaque client a un dossier lisible contenant :
     • FICHE CLIENT.html      → toute l'information, mise en page propre
     • Factures/<num>.pdf     → factures en PDF
     • Devis/<num>.pdf        → devis (EN ATTENTE bien identifiés)
     • Documents/…            → les VRAIS fichiers téléversés (pas de JSON)
   Racine : _SOMMAIRE.html (index cliquable) + Liste_clients.csv + LISEZ-MOI.txt
═══════════════════════════════════════════════════════════ */

type Row = Record<string, unknown>

const s = (v: unknown): string => (v === null || v === undefined ? '' : String(v))
const num = (v: unknown): number => { const n = Number(v); return isFinite(n) ? n : 0 }
const money = (v: unknown, cur: unknown): string =>
    new Intl.NumberFormat('fr-FR').format(num(v)) + ' ' + (s(cur) || 'XOF')
const fdate = (v: unknown): string => {
    const d = new Date(s(v))
    return isNaN(d.getTime()) ? s(v) : d.toLocaleString('fr-FR')
}
const fday = (v: unknown): string => {
    const d = new Date(s(v))
    return isNaN(d.getTime()) ? s(v) : d.toLocaleDateString('fr-FR')
}
const esc = (v: unknown): string =>
    s(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Nom de fichier/dossier lisible : conserve accents/espaces, retire l'illégal. */
const readableName = (v: string): string =>
    (v || '').replace(/[\/\\:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90) || 'client'

function folderName(rec: ClientRecord): string {
    const name = [rec.nom, rec.prenom].filter(Boolean).join(' ') || rec.email.split('@')[0] || 'Client'
    return readableName(name + (rec.email ? ` (${rec.email})` : ''))
}

const paidWords = ['paye', 'payee', 'payé', 'payée', 'paid', 'completed', 'complete', 'succes', 'success', 'reglee', 'réglée', 'reglé']
const isPaid = (v: unknown): boolean => paidWords.includes(s(v).toLowerCase())
const isPending = (v: unknown): boolean => {
    const t = s(v).toLowerCase()
    return t.includes('attente') || t.includes('pending') || t.includes('brouillon') || t.includes('draft') || t.includes('envoye') || t.includes('envoyé') || t.includes('sent')
}
const statusBadge = (v: unknown): string => {
    const t = s(v)
    if (!t) return ''
    const cls = isPaid(t) ? 'ok' : isPending(t) ? 'warn' : 'muted'
    return `<span class="badge ${cls}">${esc(t)}</span>`
}

/* ─────────────── Téléchargement des fichiers Storage ─────────────── */

function parseBucketPath(url: string): { bucket: string; path: string } | null {
    for (const seg of ['/storage/v1/object/public/', '/storage/v1/object/sign/', '/storage/v1/object/']) {
        const i = url.indexOf(seg)
        if (i >= 0) {
            const rest = url.slice(i + seg.length).replace(/^authenticated\//, '')
            const slash = rest.indexOf('/')
            if (slash < 0) continue
            const bucket = rest.slice(0, slash)
            const path = decodeURIComponent(rest.slice(slash + 1).split('?')[0])
            if (bucket && path) return { bucket, path }
        }
    }
    return null
}

async function fromStorage(sb: SupabaseClient, bucket: string, path: string): Promise<Buffer | null> {
    try {
        const { data, error } = await sb.storage.from(bucket).download(path)
        if (error || !data) return null
        return Buffer.from(await data.arrayBuffer())
    } catch { return null }
}
async function fromUrl(url: string): Promise<Buffer | null> {
    try {
        const r = await fetch(url)
        if (!r.ok) return null
        return Buffer.from(await r.arrayBuffer())
    } catch { return null }
}

/** Récupère les octets d'un fichier depuis un chemin storage et/ou une URL. */
async function resolveBytes(
    sb: SupabaseClient,
    opts: { storage_path?: string; url?: string; bucketHint?: string }
): Promise<Buffer | null> {
    const { storage_path, url, bucketHint } = opts
    if (storage_path && bucketHint) {
        const b = await fromStorage(sb, bucketHint, storage_path)
        if (b) return b
    }
    if (url) {
        const bp = parseBucketPath(url)
        if (bp) {
            const b = await fromStorage(sb, bp.bucket, bp.path)
            if (b) return b
        }
        const direct = await fromUrl(url)
        if (direct) return direct
    }
    if (storage_path) {
        for (const bucket of ['client-documents', 'dossier-documents', 'nationality_documents', 'agent-documents']) {
            const b = await fromStorage(sb, bucket, storage_path)
            if (b) return b
        }
    }
    return null
}

/** Ajoute tous les vrais fichiers du client dans Documents/, sans doublon de nom.
    Retourne la liste des noms de fichiers effectivement inclus. */
async function addRealFiles(sb: SupabaseClient, dir: JSZip, rec: ClientRecord): Promise<string[]> {
    const docsFolder = dir.folder('Documents')!
    const used = new Set<string>()
    const names: string[] = []

    const put = (name: string, bytes: Buffer) => {
        let clean = readableName(name)
        if (!/\.[a-z0-9]{1,5}$/i.test(clean)) clean += '.pdf'
        let final = clean
        let i = 2
        while (used.has(final.toLowerCase())) {
            const dot = clean.lastIndexOf('.')
            final = dot > 0 ? `${clean.slice(0, dot)} (${i})${clean.slice(dot)}` : `${clean} (${i})`
            i++
        }
        used.add(final.toLowerCase())
        docsFolder.file(final, bytes)
        names.push(final)
    }

    // 1) Pièces client (client_documents)
    for (const d of rec.data['documents'] || []) {
        const bytes = await resolveBytes(sb, {
            storage_path: s(d.storage_path) || undefined,
            url: s(d.url) || s(d.file_url) || undefined,
            bucketHint: 'client-documents',
        })
        if (bytes) put(s(d.nom_fichier) || s(d.name) || 'document', bytes)
    }

    // 2) Pièces de nationalité (nationality_applications.documents_uploaded = "Label: chemin")
    for (const app of rec.data['nationalite'] || []) {
        const uploaded = app.documents_uploaded
        if (Array.isArray(uploaded)) {
            for (const line of uploaded) {
                const str = s(line)
                const idx = str.indexOf(': ')
                if (idx === -1) continue
                const label = str.slice(0, idx).trim()
                const path = str.slice(idx + 2).trim()
                if (!path || path.startsWith('[') || path.toLowerCase().includes('échoué')) continue
                const bytes = await resolveBytes(sb, { storage_path: path, bucketHint: 'nationality_documents' })
                if (bytes) put(`Nationalité - ${label}`, bytes)
            }
        }
    }
    // Table nationality_documents (si utilisée)
    for (const d of rec.data['nationalite_documents'] || []) {
        const bytes = await resolveBytes(sb, {
            storage_path: s(d.storage_path) || s(d.file_path) || undefined,
            url: s(d.file_url) || s(d.url) || undefined,
            bucketHint: 'nationality_documents',
        })
        if (bytes) put(`Nationalité - ${s(d.doc_type) || s(d.label) || s(d.nom_fichier) || 'document'}`, bytes)
    }

    if (names.length === 0) docsFolder.file('(aucune piece televersee).txt',
        'Ce client n\'a téléversé aucune pièce jointe à ce jour.')
    return names
}

/* ─────────────── Rendu HTML lisible d'un client ─────────────── */

const CSS = `
:root{--g:#008751;--gd:#00643C;--y:#FCD116;--r:#E8112D;--ink:#2b2b2b;--mut:#6b6b6b;--line:#e8e8e8;--soft:#f6f8f7}
*{box-sizing:border-box}
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:var(--ink);background:#fff;line-height:1.5}
.flag{height:6px;display:flex}.flag i{flex:1}.flag i:nth-child(1){background:var(--g)}.flag i:nth-child(2){background:var(--y)}.flag i:nth-child(3){background:var(--r)}
.wrap{max-width:900px;margin:0 auto;padding:32px 28px 60px}
.head{display:flex;align-items:center;gap:14px;margin-bottom:8px}
.logo{width:46px;height:46px;border-radius:12px;background:var(--g);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px}
.brand small{display:block;color:var(--mut);font-size:11px;letter-spacing:.18em;text-transform:uppercase;font-weight:700}
.brand b{font-size:18px}
h1{font-size:28px;margin:18px 0 2px}
.sub{color:var(--mut);margin:0 0 18px}
.card{border:1px solid var(--line);border-radius:16px;padding:18px 20px;margin:14px 0;background:#fff}
.card.grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 24px}
.card.grid .row{display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid var(--line);padding:6px 0}
.card.grid .row b{color:var(--mut);font-weight:600}
h2{font-size:13px;text-transform:uppercase;letter-spacing:.14em;color:var(--gd);margin:28px 0 8px;display:flex;align-items:center;gap:8px}
h2:before{content:"";width:16px;height:3px;background:var(--y);border-radius:2px}
table{width:100%;border-collapse:collapse;font-size:14px}
th{text-align:left;color:var(--mut);font-size:11px;text-transform:uppercase;letter-spacing:.06em;padding:8px 10px;border-bottom:2px solid var(--line)}
td{padding:9px 10px;border-bottom:1px solid var(--line);vertical-align:top}
td.amount{text-align:right;font-weight:700;color:var(--gd);white-space:nowrap}
.badge{display:inline-block;font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px}
.badge.ok{background:#e6f3ed;color:var(--gd)}
.badge.warn{background:#fef7dc;color:#8a6d08}
.badge.muted{background:#f0f0f0;color:#666}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 0}
.chip{background:#e6f3ed;color:var(--gd);font-weight:700;font-size:12px;padding:4px 10px;border-radius:20px}
.empty{color:var(--mut);font-style:italic;font-size:13px}
.chat{display:flex;flex-direction:column;gap:8px}
.thread{border:1px solid var(--line);border-radius:12px;padding:12px;margin-bottom:10px}
.thread .t{font-weight:700;margin-bottom:8px}
.msg{max-width:82%;padding:8px 12px;border-radius:12px;font-size:13.5px;white-space:pre-wrap;word-break:break-word}
.msg .who{display:block;font-size:9px;font-weight:800;text-transform:uppercase;opacity:.6;margin-bottom:2px}
.me{align-self:flex-end;background:#e6f3ed}
.them{align-self:flex-start;background:#f2f2f2}
.files li{margin:3px 0}
.foot{margin-top:40px;padding-top:16px;border-top:1px solid var(--line);color:var(--mut);font-size:12px;text-align:center}
@media print{.wrap{max-width:none}}
`

function table(headers: string[], rows: string[][]): string {
    if (!rows.length) return '<p class="empty">Aucun élément.</p>'
    const th = headers.map(h => `<th>${esc(h)}</th>`).join('')
    const tr = rows.map(r => `<tr>${r.join('')}</tr>`).join('')
    return `<table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>`
}
const td = (v: unknown) => `<td>${esc(v)}</td>`
const tdAmount = (v: string) => `<td class="amount">${v}</td>`
const tdRaw = (html: string) => `<td>${html}</td>`

function renderClientHtml(rec: ClientRecord, fileNames: string[]): string {
    const d = rec.data
    const sm = toSummary(rec)
    const dfRows = d.documents_financiers || []
    const factures = dfRows.filter(r => s(r.type).toLowerCase() === 'facture')
    const devis = dfRows.filter(r => s(r.type).toLowerCase() === 'devis')
    const nomComplet = [rec.prenom, rec.nom].filter(Boolean).join(' ') || rec.email || 'Client'
    const initial = (rec.prenom?.[0] || rec.nom?.[0] || rec.email?.[0] || '?').toUpperCase()

    const P: string[] = []
    P.push(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fiche client - ${esc(nomComplet)}</title><style>${CSS}</style></head><body>`)
    P.push('<div class="flag"><i></i><i></i><i></i></div>')
    P.push('<div class="wrap">')
    P.push(`<div class="head"><div class="logo">${esc(initial)}</div><div class="brand"><small>Retour Gagnant Bénin — Fiche client</small><b>${esc(nomComplet)}</b></div></div>`)
    P.push(`<h1>${esc(nomComplet)}</h1>`)
    P.push(`<p class="sub">${rec.hasAccount ? 'Client avec compte' : 'Client sans compte'} · Dossier généré le ${new Date().toLocaleString('fr-FR')}</p>`)

    // Identité
    P.push('<div class="card grid">')
    const idRow = (k: string, v: string) => P.push(`<div class="row"><b>${esc(k)}</b><span>${esc(v || '—')}</span></div>`)
    idRow('E-mail', rec.email)
    idRow('Téléphone', rec.phone)
    idRow('Ville / Pays', [rec.ville, rec.pays].filter(Boolean).join(', '))
    idRow('Inscrit le', rec.created_at ? fdate(rec.created_at) : '')
    idRow('Compte', rec.hasAccount ? 'Oui' : 'Non')
    idRow('Identifiant', rec.id || '—')
    P.push('</div>')

    if (sm.services.length) {
        P.push('<h2>Services demandés</h2>')
        P.push('<div class="chips">' + sm.services.map(sv => `<span class="chip">${esc(sv)}</span>`).join('') + '</div>')
    }

    // Dossiers
    if ((d.dossiers || []).length) {
        P.push('<h2>Dossiers</h2>')
        P.push(table(['N° / Service', 'Statut', 'Ouvert le', 'Notes'],
            (d.dossiers || []).map(r => [
                td(s(r.num_dossier) || s(r.service_type) || 'Dossier'),
                tdRaw(statusBadge(r.statut || r.status)),
                td(fday(r.created_at)),
                td(s(r.notes) || s(r.commentaire) || ''),
            ])))
    }

    // Nationalité
    if ((d.nationalite || []).length) {
        P.push('<h2>Demandes de nationalité</h2>')
        P.push(table(['Référence', 'Statut', 'Paiement', 'Montant', 'Date'],
            (d.nationalite || []).map(r => [
                td(s(r.reference) || 'Demande'),
                tdRaw(statusBadge(r.status)),
                tdRaw(statusBadge(r.payment_status)),
                tdAmount(money(r.amount, r.currency)),
                td(fday(r.created_at)),
            ])))
    }

    // Achats boutique
    if ((d.commandes || []).length) {
        P.push('<h2>Achats boutique</h2>')
        P.push(table(['Produit', 'Statut', 'Montant', 'Date'],
            (d.commandes || []).map(r => [
                td(s(r.product_title) || 'Commande'),
                tdRaw(statusBadge(r.payment_status)),
                tdAmount(money(r.amount, r.currency)),
                td(fday(r.created_at)),
            ])))
    }

    // Devis (dont EN ATTENTE)
    if (devis.length) {
        P.push('<h2>Devis</h2>')
        P.push(table(['Numéro', 'Statut', 'Montant', 'Date', 'PDF'],
            devis.map(r => [
                td(s(r.numero) || 'Devis'),
                tdRaw(isPending(r.status) ? '<span class="badge warn">EN ATTENTE</span>' : statusBadge(r.status)),
                tdAmount(money(r.total, r.currency)),
                td(fday(r.created_at)),
                td('Devis/' + readableName(s(r.numero) || s(r.id)) + '.pdf'),
            ])))
    }

    // Factures
    if (factures.length) {
        P.push('<h2>Factures</h2>')
        P.push(table(['Numéro', 'Statut', 'Montant', 'Date', 'PDF'],
            factures.map(r => [
                td(s(r.numero) || 'Facture'),
                tdRaw(statusBadge(r.status)),
                tdAmount(money(r.total, r.currency)),
                td(fday(r.created_at)),
                td('Factures/' + readableName(s(r.numero) || s(r.id)) + '.pdf'),
            ])))
    }

    // Paiements
    const paie = [...(d.paiements || []), ...(d.paiements_manuels || [])]
    if (paie.length) {
        P.push('<h2>Historique des paiements</h2>')
        P.push(table(['Montant', 'Moyen', 'Statut', 'Date'],
            paie.map(r => [
                tdAmount(money(r.montant ?? r.amount, r.currency)),
                td(s(r.provider) || s(r.methode) || s(r.moyen) || s(r.type) || ''),
                tdRaw(statusBadge(r.status || r.statut)),
                td(fday(r.created_at)),
            ])))
    }

    // Rendez-vous
    if ((d.rendez_vous || []).length) {
        P.push('<h2>Rendez-vous</h2>')
        P.push(table(['Date', 'Heure', 'Type', 'Statut'],
            (d.rendez_vous || []).map(r => [
                td(fday(r.date)), td(s(r.heure)), td(s(r.type)), tdRaw(statusBadge(r.statut)),
            ])))
    }

    // Logement / Événements / Contrats
    if ((d.logements || []).length) {
        P.push('<h2>Logement</h2>')
        P.push(table(['Programme / Type', 'Statut', 'Date'],
            (d.logements || []).map(r => [
                td(s(r.programme) || s(r.type) || 'Demande logement'),
                tdRaw(statusBadge(r.statut || r.status)),
                td(fday(r.created_at)),
            ])))
    }
    if ((d.evenements || []).length) {
        P.push('<h2>Événements</h2>')
        P.push(table(['Événement', 'Statut', 'Date'],
            (d.evenements || []).map(r => [
                td(s(r.event_title) || s(r.event_id) || 'Inscription'),
                tdRaw(statusBadge(r.statut || r.payment_status)),
                td(fday(r.created_at)),
            ])))
    }
    if ((d.contrats || []).length) {
        P.push('<h2>Contrats</h2>')
        P.push(table(['Référence', 'Statut', 'Date'],
            (d.contrats || []).map(r => [
                td(s(r.serial) || s(r.titre) || 'Contrat'),
                tdRaw(statusBadge(r.status)),
                td(fday(r.created_at)),
            ])))
    }

    // Documents joints
    P.push('<h2>Documents joints</h2>')
    if (fileNames.length) {
        P.push('<p>Les fichiers ci-dessous se trouvent dans le sous-dossier <b>Documents/</b> :</p>')
        P.push('<ul class="files">' + fileNames.map(f => `<li>${esc(f)}</li>`).join('') + '</ul>')
    } else {
        P.push('<p class="empty">Aucune pièce téléversée.</p>')
    }

    // Discussions
    P.push(`<h2>Discussions (${rec.discussions.length})</h2>`)
    if (!rec.discussions.length && !(d.messages || []).length) {
        P.push('<p class="empty">Aucune discussion.</p>')
    } else {
        for (const t of rec.discussions) {
            P.push('<div class="thread">')
            P.push(`<div class="t">${esc(s(t.thread.sujet) || 'Sans sujet')} <span class="badge muted">${esc(s(t.thread.type) || 'general')}</span></div>`)
            P.push('<div class="chat">')
            if (s(t.thread.message)) {
                P.push(`<div class="msg them"><span class="who">Client · ${esc(fdate(t.thread.created_at))}</span>${esc(t.thread.message)}</div>`)
            }
            for (const m of t.messages) {
                const mine = s(m.role).toLowerCase() !== 'client'
                P.push(`<div class="msg ${mine ? 'me' : 'them'}"><span class="who">${mine ? 'Équipe RGB' : 'Client'} · ${esc(fdate(m.created_at))}</span>${esc(m.content)}</div>`)
            }
            P.push('</div></div>')
        }
    }

    P.push(`<div class="foot">Retour Gagnant Bénin · Sauvegarde confidentielle · ${new Date().toLocaleString('fr-FR')}</div>`)
    P.push('</div></body></html>')
    return P.join('\n')
}

/* ─────────────── PDF factures & devis ─────────────── */

function toInvoiceData(row: Row): InvoicePdfData {
    const rawItems = Array.isArray(row.items) ? (row.items as Row[]) : []
    const items: InvoicePdfItem[] = rawItems.map(it => ({
        description: s(it.description) || s(it.designation) || 'Prestation',
        quantity: num(it.quantity ?? it.quantite ?? 1) || 1,
        unit_price: num(it.unit_price ?? it.prix_unitaire ?? 0),
        tva: num(it.tva ?? 0),
    }))
    return {
        invoiceRef: s(row.numero) || s(row.id),
        date: s(row.created_at),
        paidAt: s(row.paid_at) || undefined,
        isPaid: isPaid(row.status),
        clientName: [s(row.client_prenom), s(row.client_nom)].filter(Boolean).join(' ') || 'Client',
        clientEmail: s(row.client_email) || undefined,
        clientPhone: s(row.client_phone) || undefined,
        clientAddress: s(row.client_adresse) || undefined,
        items,
        currency: s(row.currency) || 'XOF',
        sous_total: num(row.sous_total),
        total_tva: num(row.total_tva),
        remise: num(row.remise),
        total: num(row.total),
        notes: s(row.notes) || undefined,
        docType: s(row.type).toLowerCase() === 'devis' ? 'devis' : 'facture',
    }
}

function addInvoicePdfs(dir: JSZip, folder: string, rows: Row[], pendingPrefix = false) {
    if (!rows.length) return
    const f = dir.folder(folder)!
    const used = new Set<string>()
    for (const row of rows) {
        try {
            const b64 = generateInvoicePdf(toInvoiceData(row))
            let ref = readableName(s(row.numero) || s(row.id))
            if (pendingPrefix && isPending(row.status)) ref = 'EN ATTENTE - ' + ref
            let name = `${ref}.pdf`, i = 2
            while (used.has(name.toLowerCase())) { name = `${ref} (${i}).pdf`; i++ }
            used.add(name.toLowerCase())
            f.file(name, Buffer.from(b64, 'base64'))
        } catch { /* données incomplètes : ignore ce PDF */ }
    }
}

/* ─────────────── Assemblage d'un dossier client ─────────────── */

async function fillClientFolder(sb: SupabaseClient, zip: JSZip, rec: ClientRecord) {
    const dir = zip.folder(folderName(rec))!
    const d = rec.data

    // 1) Vrais fichiers téléversés
    const fileNames = await addRealFiles(sb, dir, rec)

    // 2) PDF factures & devis
    const dfRows = d.documents_financiers || []
    addInvoicePdfs(dir, 'Factures', dfRows.filter(r => s(r.type).toLowerCase() === 'facture'))
    addInvoicePdfs(dir, 'Devis', dfRows.filter(r => s(r.type).toLowerCase() === 'devis'), true)

    // 3) Fiche client lisible (le document central)
    dir.file('FICHE CLIENT.html', renderClientHtml(rec, fileNames))
}

/* ─────────────── Sommaire global + CSV ─────────────── */

function sommaireHtml(recs: ClientRecord[]): string {
    const rows = recs.map(rec => {
        const c = toSummary(rec).counts
        const nom = [rec.prenom, rec.nom].filter(Boolean).join(' ') || rec.email || 'Client'
        const href = encodeURI('./' + folderName(rec) + '/FICHE CLIENT.html')
        return `<tr><td><a href="${href}">${esc(nom)}</a></td><td>${esc(rec.email)}</td><td>${esc(rec.phone)}</td><td>${c.dossiers}</td><td>${c.commandes}</td><td>${c.factures}</td><td>${c.devis}</td><td>${c.paiements}</td></tr>`
    }).join('')
    return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Sauvegarde clients - Sommaire</title><style>${CSS}</style></head><body>
<div class="flag"><i></i><i></i><i></i></div>
<div class="wrap">
<div class="head"><div class="logo">RG</div><div class="brand"><small>Retour Gagnant Bénin</small><b>Sauvegarde des clients</b></div></div>
<h1>Sommaire</h1>
<p class="sub">${recs.length} client(s) · généré le ${new Date().toLocaleString('fr-FR')}</p>
<p>Cliquez sur un nom pour ouvrir sa fiche complète. Chaque dossier contient aussi les factures, devis et pièces téléversées.</p>
<table><thead><tr><th>Client</th><th>E-mail</th><th>Téléphone</th><th>Dossiers</th><th>Achats</th><th>Factures</th><th>Devis</th><th>Paiements</th></tr></thead><tbody>${rows}</tbody></table>
<div class="foot">Document confidentiel · Retour Gagnant Bénin</div>
</div></body></html>`
}

function csvIndex(recs: ClientRecord[]): string {
    const head = ['Nom', 'Prenom', 'Email', 'Telephone', 'Ville', 'Pays', 'Compte', 'Dossiers', 'Nationalite', 'Achats', 'Factures', 'Devis', 'Paiements', 'Messages', 'Inscrit_le']
    const q = (v: string) => `"${(v || '').replace(/"/g, '""')}"`
    const lines = [head.join(';')]
    for (const rec of recs) {
        const c = toSummary(rec).counts
        lines.push([
            rec.nom, rec.prenom, rec.email, rec.phone, rec.ville, rec.pays,
            rec.hasAccount ? 'oui' : 'non',
            c.dossiers, c.nationalite, c.commandes, c.factures, c.devis, c.paiements, c.messages,
            rec.created_at ? fdate(rec.created_at) : '',
        ].map(v => q(s(v))).join(';'))
    }
    return '﻿' + lines.join('\r\n')
}

export async function GET(req: NextRequest) {
    const auth = await verifyApiAuth(req, 'admin')
    if (!auth.authenticated) return auth.error!

    try {
        const sb = getAdminClient()
        const all = await loadAllClients(sb)

        const key = req.nextUrl.searchParams.get('client')
        const targets = key ? all.filter(r => matchesKey(r, key)) : all
        if (!targets.length) return NextResponse.json({ error: 'Aucun client à exporter' }, { status: 404 })

        const zip = new JSZip()
        const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')

        zip.file('LISEZ-MOI.txt', [
            'SAUVEGARDE DES CLIENTS — RETOUR GAGNANT BÉNIN',
            '',
            `Générée le : ${new Date().toLocaleString('fr-FR')}`,
            `Nombre de clients : ${targets.length}`,
            '',
            'COMMENT LIRE CETTE SAUVEGARDE',
            '1. Ouvrez « _SOMMAIRE.html » (double-clic) pour voir la liste de tous',
            '   les clients et cliquer sur un nom.',
            '2. Chaque client a son dossier « Nom Prénom (email) » contenant :',
            '     • FICHE CLIENT.html  → toutes ses informations, bien présentées',
            '     • Factures/          → ses factures en PDF',
            '     • Devis/             → ses devis en PDF (EN ATTENTE identifiés)',
            '     • Documents/         → les vrais fichiers qu\'il a téléversés',
            '3. « Liste_clients.csv » s\'ouvre dans Excel pour une vue tableau.',
            '',
            'Aucune connaissance technique n\'est nécessaire : tout est en PDF, HTML',
            'et fichiers d\'origine.',
        ].join('\n'))

        zip.file('_SOMMAIRE.html', sommaireHtml(targets))
        zip.file('Liste_clients.csv', csvIndex(targets))

        for (const rec of targets) {
            try { await fillClientFolder(sb, zip, rec) } catch { /* un client en échec ne bloque pas le reste */ }
        }

        const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } })
        const body = new Uint8Array(buffer)
        const filename = key
            ? `sauvegarde-${readableName(targets[0].nom || targets[0].email || 'client')}-${stamp}.zip`
            : `sauvegarde-clients-RGB-${stamp}.zip`

        return new NextResponse(body, {
            status: 200,
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Content-Length': String(body.length),
                'Cache-Control': 'no-store',
            },
        })
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Erreur inconnue'
        return NextResponse.json({ error: `Échec de l'export : ${msg}` }, { status: 500 })
    }
}
