/* ═══════════════════════════════════════════════════════════════════════
   DOSSIER D'UN CLIENT DANS LA SAUVEGARDE — lisible par une personne non
   technique, complet pour une personne technique.

   Chaque client a un dossier « Nom Prénom (e-mail) » contenant :
     • FICHE CLIENT.html        → tout, mis en page, puis une ANNEXE qui
                                  affiche chaque champ de chaque ligne : ce que
                                  les sections lisibles ne montrent pas y est
     • Factures/ Devis/ Avoirs/ → PDF générés depuis la base
     • Documents/               → les VRAIS fichiers (pièces, pièces de
                                  dossiers, généalogie, signature…)
     • Contrats/ Récaps/        → textes signés et fiches d'analyse
     • donnees-completes.json   → toutes les lignes brutes, pour restauration

   Construit ici, et non dans la route d'export, pour que la collecte
   nocturne fabrique EXACTEMENT le même dossier que le bouton « Exporter ».
═══════════════════════════════════════════════════════════════════════ */
import JSZip from 'jszip'
import type { SupabaseClient } from '@supabase/supabase-js'
import { generateInvoicePdf, type InvoicePdfData, type InvoicePdfItem } from '@/lib/invoice-pdf-generator'
import { toSummary, SOURCES, type ClientRecord, type Collecte, type Row } from './aggregate'
import { lireLigneDocument } from '@/lib/nationality-docs'

const s = (v: unknown): string => (v === null || v === undefined ? '' : String(v))
const num = (v: unknown): number => { const n = Number(v); return isFinite(n) ? n : 0 }
const money = (v: unknown, cur: unknown): string =>
    new Intl.NumberFormat('fr-FR').format(num(v)) + ' ' + (s(cur) || 'XOF')
const fdate = (v: unknown): string => {
    const d = new Date(s(v))
    return isNaN(d.getTime()) ? s(v) : d.toLocaleString('fr-FR', { timeZone: 'Africa/Porto-Novo' })
}
const fday = (v: unknown): string => {
    const d = new Date(s(v))
    return isNaN(d.getTime()) ? s(v) : d.toLocaleDateString('fr-FR', { timeZone: 'Africa/Porto-Novo' })
}
const esc = (v: unknown): string =>
    s(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Nom de fichier/dossier lisible : conserve accents/espaces, retire l'illégal. */
export const readableName = (v: string): string =>
    (v || '').replace(/[/\\:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90) || 'client'

export function folderName(rec: ClientRecord): string {
    const name = [rec.nom, rec.prenom].filter(Boolean).join(' ') || rec.email.split('@')[0] || 'Client'
    const suffixe = rec.email || rec.phone
    return readableName(name + (suffixe ? ` (${suffixe})` : ''))
}

/* ─────────────── Secrets : jamais dans une archive ───────────────
   Jetons de signature, clés de lien de paiement, jetons de désinscription :
   ils OUVRENT quelque chose. Une sauvegarde égarée ne doit ouvrir aucune
   porte — la valeur est remplacée, le champ reste visible. */
const CHAMP_SECRET = /(token|secret|password|passwd|signature_hash|qr_data|push_token|api_key|sign_token|secret_key)$/i

export function masquer<T>(v: T): T {
    if (Array.isArray(v)) return v.map(masquer) as T
    if (v && typeof v === 'object') {
        const out: Row = {}
        for (const [k, val] of Object.entries(v as Row)) {
            out[k] = CHAMP_SECRET.test(k) && val !== null && val !== '' ? '••• masqué dans la sauvegarde' : masquer(val)
        }
        return out as T
    }
    return v
}

const paidWords = ['paye', 'payee', 'payé', 'payée', 'paid', 'completed', 'complete', 'succes', 'success', 'reglee', 'réglée', 'reglé', 'successful']
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
    if (!/^https?:\/\//i.test(url)) return null
    try {
        const r = await fetch(url, { signal: AbortSignal.timeout(20_000) })
        if (!r.ok) return null
        return Buffer.from(await r.arrayBuffer())
    } catch { return null }
}

const BUCKETS_CONNUS = ['client-documents', 'dossier-documents', 'nationality_documents', 'genealogia-docs', 'agent-documents']

/** Récupère les octets d'un fichier depuis un chemin storage et/ou une URL. */
async function resolveBytes(
    sb: SupabaseClient,
    opts: { storage_path?: string; url?: string; bucketHint?: string },
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
        // Chemin relatif rangé dans la colonne « url » : on le tente comme chemin.
        if (!/^https?:/i.test(url)) {
            for (const bucket of BUCKETS_CONNUS) {
                const b = await fromStorage(sb, bucket, url.replace(/^\/+/, ''))
                if (b) return b
            }
        }
    }
    if (storage_path) {
        for (const bucket of BUCKETS_CONNUS) {
            const b = await fromStorage(sb, bucket, storage_path)
            if (b) return b
        }
    }
    return null
}

export interface ResultatFichiers {
    inclus: string[]
    /** Fichiers référencés en base mais introuvables : nommés, jamais tus. */
    manquants: { libelle: string; source: string }[]
}

/** Ajoute tous les vrais fichiers du client, sans doublon de nom ni de contenu. */
async function addRealFiles(sb: SupabaseClient, dir: JSZip, rec: ClientRecord): Promise<ResultatFichiers> {
    const docsFolder = dir.folder('Documents')!
    const usedNames = new Set<string>()
    const dejaVus = new Set<string>()
    const res: ResultatFichiers = { inclus: [], manquants: [] }
    const d = rec.data

    const put = (name: string, bytes: Buffer, ext?: string) => {
        let clean = readableName(name)
        if (!/\.[a-z0-9]{1,5}$/i.test(clean)) clean += `.${ext || 'pdf'}`
        let final = clean
        let i = 2
        while (usedNames.has(final.toLowerCase())) {
            const dot = clean.lastIndexOf('.')
            final = dot > 0 ? `${clean.slice(0, dot)} (${i})${clean.slice(dot)}` : `${clean} (${i})`
            i++
        }
        usedNames.add(final.toLowerCase())
        docsFolder.file(final, bytes)
        res.inclus.push(final)
    }
    const extDe = (p: string) => (p.split('?')[0].split('.').pop() || '').toLowerCase().slice(0, 5)

    const prendre = async (libelle: string, source: string, opts: { storage_path?: string; url?: string; bucketHint?: string }) => {
        const cle = `${opts.bucketHint || ''}|${opts.storage_path || ''}|${(opts.url || '').split('?')[0]}`
        if (dejaVus.has(cle)) return
        dejaVus.add(cle)
        const bytes = await resolveBytes(sb, opts)
        const ext = extDe(opts.storage_path || opts.url || '')
        if (bytes) put(libelle, bytes, ext)
        else res.manquants.push({ libelle, source })
    }

    // 1) Pièces déposées (client_documents) — intitulé d'abord, puis nom de fichier.
    for (const doc of d.documents || []) {
        const libelle = [s(doc.titre), s(doc.file_name)].filter(Boolean).join(' - ') || 'document'
        await prendre(libelle, 'Pièces déposées', {
            storage_path: s(doc.storage_path) || undefined,
            url: s(doc.file_url) || s(doc.url) || undefined,
            bucketHint: 'client-documents',
        })
    }

    // 2) Pièces de nationalité (nationality_applications.documents_uploaded = "Label: chemin")
    for (const app of d.nationalite || []) {
        const uploaded = app.documents_uploaded
        if (!Array.isArray(uploaded)) continue
        for (const line of uploaded) {
            const lu = lireLigneDocument(line)
            if (!lu?.ok) continue
            const { label, path } = lu
            await prendre(`Nationalité ${s(app.application_ref)} - ${label}`, 'Demande de nationalité',
                { storage_path: path, bucketHint: 'nationality_documents' })
        }
    }

    // 3) Pièces des dossiers de suivi (dossier_documents, puis l'ancienne table)
    for (const [section, source] of [['dossiers_pieces', 'Pièces des dossiers'], ['dossiers_pieces_anciennes', 'Pièces des dossiers (ancien)']] as const) {
        for (const doc of d[section] || []) {
            await prendre(`Dossier - ${s(doc.file_name) || 'pièce'}`, source, {
                url: s(doc.file_url) || undefined, bucketHint: 'dossier-documents',
            })
        }
    }

    // 4) Documents généalogiques
    for (const doc of d.genealogie_documents || []) {
        await prendre(`Généalogie - ${s(doc.title) || s(doc.doc_type) || 'document'}`, 'Documents généalogiques', {
            storage_path: s(doc.file_path) || undefined, url: s(doc.file_url) || undefined, bucketHint: 'genealogia-docs',
        })
    }

    // 5) Signature enregistrée (data URL) → image.
    for (const sig of d.signatures || []) {
        const m = /^data:image\/(png|jpe?g|webp|svg\+xml);base64,(.+)$/i.exec(s(sig.signature_data))
        if (m) put('Signature du client', Buffer.from(m[2], 'base64'), m[1].replace('+xml', '').replace('jpeg', 'jpg'))
    }

    if (!res.inclus.length && !res.manquants.length) {
        docsFolder.file('(aucune piece televersee).txt', 'Ce client n\'a téléversé aucune pièce jointe à ce jour.')
    }
    return res
}

/* ─────────────── Rendu HTML lisible d'un client ─────────────── */

export const CSS = `
:root{--g:#008751;--gd:#00643C;--y:#FCD116;--r:#E8112D;--ink:#2b2b2b;--mut:#6b6b6b;--line:#e8e8e8;--soft:#f6f8f7}
*{box-sizing:border-box}
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:var(--ink);background:#fff;line-height:1.5}
.flag{height:6px;display:flex}.flag i{flex:1}.flag i:nth-child(1){background:var(--g)}.flag i:nth-child(2){background:var(--y)}.flag i:nth-child(3){background:var(--r)}
.wrap{max-width:960px;margin:0 auto;padding:32px 28px 60px}
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
h3{font-size:14px;margin:18px 0 6px}
table{width:100%;border-collapse:collapse;font-size:14px}
th{text-align:left;color:var(--mut);font-size:11px;text-transform:uppercase;letter-spacing:.06em;padding:8px 10px;border-bottom:2px solid var(--line)}
td{padding:9px 10px;border-bottom:1px solid var(--line);vertical-align:top}
td.amount{text-align:right;font-weight:700;color:var(--gd);white-space:nowrap}
.badge{display:inline-block;font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px}
.badge.ok{background:#e6f3ed;color:var(--gd)}
.badge.warn{background:#fef7dc;color:#8a6d08}
.badge.bad{background:#fde8eb;color:#a30d22}
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
.warnbox{background:#fef7dc;border:1px solid #f1dc8a;border-radius:12px;padding:12px 16px;font-size:13px;color:#6b5306}
details{border:1px solid var(--line);border-radius:12px;padding:10px 14px;margin:8px 0}
summary{cursor:pointer;font-weight:700}
dl{display:grid;grid-template-columns:minmax(140px,220px) 1fr;gap:4px 14px;margin:10px 0 0;font-size:12.5px}
dt{color:var(--mut);font-family:ui-monospace,Menlo,Consolas,monospace}
dd{margin:0;white-space:pre-wrap;word-break:break-word}
.rec{border-top:1px dashed var(--line);padding-top:8px;margin-top:8px}
.foot{margin-top:40px;padding-top:16px;border-top:1px solid var(--line);color:var(--mut);font-size:12px;text-align:center}
@media print{.wrap{max-width:none}details{break-inside:avoid}}
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
const long = (v: unknown, max = 600) => { const t = s(v); return t.length > max ? t.slice(0, max) + '…' : t }

/** Affichage d'une valeur quelconque dans l'annexe. */
function valeurAnnexe(v: unknown): string {
    if (v === null || v === undefined || v === '') return '<span class="empty">—</span>'
    if (typeof v === 'object') return esc(JSON.stringify(v, null, 1).slice(0, 4000))
    const t = s(v)
    if (/^data:[a-z]+\/[a-z0-9.+-]+;base64,/i.test(t)) return '<span class="empty">(fichier intégré — voir Documents/)</span>'
    return esc(t.length > 4000 ? t.slice(0, 4000) + '… (texte complet dans donnees-completes.json)' : t)
}

const LIBELLES: Record<string, string> = Object.fromEntries(SOURCES.map(x => [x.section, x.libelle]))

export function renderClientHtml(rec: ClientRecord, fichiers: ResultatFichiers): string {
    const d = rec.data
    const sm = toSummary(rec)
    const dfRows = d.documents_financiers || []
    const parType = (t: string) => dfRows.filter(r => s(r.type).toLowerCase() === t)
    const factures = parType('facture'), devis = parType('devis'), avoirs = parType('avoir')
    const nomComplet = [rec.prenom, rec.nom].filter(Boolean).join(' ') || rec.email || rec.phone || 'Client'
    const initial = (rec.prenom?.[0] || rec.nom?.[0] || rec.email?.[0] || '?').toUpperCase()

    const P: string[] = []
    const section = (titre: string, rows: Row[] | undefined, headers: string[], ligne: (r: Row) => string[]) => {
        if (!rows?.length) return
        P.push(`<h2>${esc(titre)} (${rows.length})</h2>`)
        P.push(table(headers, rows.map(ligne)))
    }

    P.push(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fiche client - ${esc(nomComplet)}</title><style>${CSS}</style></head><body>`)
    P.push('<div class="flag"><i></i><i></i><i></i></div>')
    P.push('<div class="wrap">')
    P.push(`<div class="head"><div class="logo">${esc(initial)}</div><div class="brand"><small>Retour Gagnant Bénin — Fiche client</small><b>${esc(nomComplet)}</b></div></div>`)
    P.push(`<h1>${esc(nomComplet)}</h1>`)
    P.push(`<p class="sub">${rec.hasAccount ? 'Client avec compte' : 'Client sans compte'} · ${sm.counts.total} élément(s) sauvegardé(s) · généré le ${fdate(new Date().toISOString())}</p>`)

    // Identité
    P.push('<div class="card grid">')
    const idRow = (k: string, v: string) => P.push(`<div class="row"><b>${esc(k)}</b><span>${esc(v || '—')}</span></div>`)
    idRow('E-mail', rec.email)
    idRow('Téléphone', rec.phone)
    idRow('Ville / Pays', [rec.ville, rec.pays].filter(Boolean).join(', '))
    idRow('Adresse', s(rec.profile?.adresse))
    idRow('Inscrit le', rec.created_at ? fdate(rec.created_at) : '')
    idRow('Compte', rec.hasAccount ? 'Oui' : 'Non')
    idRow('Identifiant', rec.id || '—')
    idRow('Genre', s(rec.profile?.genre))
    P.push('</div>')

    if (sm.services.length) {
        P.push('<h2>Services demandés</h2>')
        P.push('<div class="chips">' + sm.services.map(sv => `<span class="chip">${esc(sv)}</span>`).join('') + '</div>')
    }

    // ── Démarches ─────────────────────────────────────────────
    section('Dossiers', d.dossiers, ['N° / Service', 'Statut', 'Ouvert le', 'Notes'], r => [
        td(s(r.num_dossier) || s(r.service_type) || 'Dossier'), tdRaw(statusBadge(r.statut || r.status)),
        td(fday(r.created_at)), td(long(r.notes || r.commentaire || r.notes_internes)),
    ])
    section('Demandes de nationalité', d.nationalite, ['Référence', 'Statut', 'Paiement', 'Montant', 'Date'], r => [
        td(s(r.application_ref) || 'Demande'), tdRaw(statusBadge(r.status)),
        tdRaw(statusBadge(r.payment_status) + (s(r.payment_method) ? ` <span class="badge muted">${esc(r.payment_method)}</span>` : '')),
        tdAmount(money(r.amount, r.currency)), td(fday(r.created_at)),
    ])
    section('Prises de contact nationalité', d.nationalite_contacts, ['Nationalité actuelle', 'Motivation', 'Statut', 'Date'], r => [
        td(r.nationalite_actuelle), td(long(r.motivation, 400)), tdRaw(statusBadge(r.statut)), td(fday(r.created_at)),
    ])
    section('Récaps MyAfroOrigins', d.recaps_myafro, ['Référence', 'Statut', 'Paiement', 'Montant', 'Date'], r => [
        td(r.reference), tdRaw(statusBadge(r.statut)), tdRaw(statusBadge(r.paiement_statut)),
        tdAmount(money(r.montant, r.devise)), td(fday(r.created_at)),
    ])
    section('Demandes de logement', d.logements, ['Logement / Programme', 'Formule', 'Statut', 'Date'], r => [
        td(s(r.logement_nom) || s(r.programme) || 'Demande'), td(r.formule_souhaitee), tdRaw(statusBadge(r.statut || r.status)), td(fday(r.created_at)),
    ])
    section('Propositions de séjour', d.propositions_sejour, ['Destination', 'Dates', 'Montant', 'Statut'], r => [
        td(r.destination), td(`${fday(r.start_date)} → ${fday(r.end_date)}`), tdAmount(money(r.total_amount, r.currency)), tdRaw(statusBadge(r.status)),
    ])
    section('Itinéraires de séjour', d.itineraires, ['Villes', 'Dates', 'Voyageurs', 'Budget', 'Statut'], r => [
        td(Array.isArray(r.villes) ? (r.villes as unknown[]).join(', ') : s(r.villes)), td(`${fday(r.date_debut)} → ${fday(r.date_fin)}`),
        td(r.voyageurs), tdAmount(money(r.budget, r.devise)), tdRaw(statusBadge(r.statut)),
    ])
    section('Tests d’éligibilité', d.eligibilite, ['Service recommandé', 'Score', 'Objectif', 'Date'], r => [
        td(r.recommended_service), td(r.eligibility_score), td(r.objective), td(fday(r.created_at)),
    ])

    // ── Argent ───────────────────────────────────────────────
    section('Devis', devis, ['Numéro', 'Statut', 'Montant', 'Date', 'PDF'], r => [
        td(s(r.numero) || 'Devis'),
        tdRaw(isPending(r.status) ? '<span class="badge warn">EN ATTENTE</span>' : statusBadge(r.status)),
        tdAmount(money(r.total, r.currency)), td(fday(r.created_at)),
        td('Devis/' + readableName(s(r.numero) || s(r.id)) + '.pdf'),
    ])
    section('Factures', factures, ['Numéro', 'Statut', 'Montant', 'Date', 'PDF'], r => [
        td(s(r.numero) || 'Facture'), tdRaw(statusBadge(r.status)), tdAmount(money(r.total, r.currency)),
        td(fday(r.created_at)), td('Factures/' + readableName(s(r.numero) || s(r.id)) + '.pdf'),
    ])
    section('Avoirs', avoirs, ['Numéro', 'Motif', 'Montant', 'Date'], r => [
        td(r.numero), td(r.motif_avoir), tdAmount(money(r.total, r.currency)), td(fday(r.created_at)),
    ])
    section('Devis d’agent', d.devis_agent, ['Numéro', 'Statut', 'Montant', 'Date'], r => [
        td(s(r.numero) || 'Devis'), tdRaw(statusBadge(r.status)), tdAmount(money(r.total, 'XOF')), td(fday(r.created_at)),
    ])
    section('Devis intelligents', d.devis_smart, ['Titre', 'Statut', 'Montant', 'Date'], r => [
        td(s(r.title) || s(r.titre) || s(r.destination) || 'Proposition'), tdRaw(statusBadge(r.status)),
        tdAmount(money(r.total_amount ?? r.total, r.currency)), td(fday(r.created_at)),
    ])
    section('Lignes des devis intelligents', d.devis_smart_lignes, ['Prestation', 'Lieu', 'Prix'], r => [
        td(s(r.title) || s(r.type)), td(r.location), tdAmount(money(r.selling_price, '')),
    ])
    section('Liens de paiement', d.liens_paiement, ['Objet', 'Montant', 'Statut', 'Date'], r => [
        td(s(r.destination) || 'Lien'), tdAmount(money(r.total_amount, r.currency)), tdRaw(statusBadge(r.status)), td(fday(r.created_at)),
    ])
    const paie = [...(d.paiements || []), ...(d.paiements_manuels || [])]
    if (paie.length) {
        P.push(`<h2>Historique des paiements (${paie.length})</h2>`)
        P.push(table(['Montant', 'Moyen', 'Référence', 'Statut', 'Date'], paie.map(r => [
            tdAmount(money(r.montant ?? r.amount, r.currency)),
            td(s(r.gateway) || s(r.provider) || s(r.type) || s(r.moyen) || ''),
            td(s(r.reference) || s(r.transaction_id)),
            tdRaw(statusBadge(r.status || r.statut || 'enregistré')),
            td(fday(r.date_paiement || r.created_at)),
        ])))
    }
    section('Commandes boutique', d.commandes, ['Produit', 'Paiement', 'Livraison', 'Montant', 'Date'], r => [
        td(s(r.product_title) || 'Commande'), tdRaw(statusBadge(r.payment_status)), tdRaw(statusBadge(r.shipping_status)),
        tdAmount(money(r.amount, r.currency)), td(fday(r.created_at)),
    ])
    section('Suivi des commandes', d.commandes_suivi, ['Étape', 'Détail', 'Lieu', 'Date'], r => [
        td(s(r.label) || s(r.status)), td(r.description), td(r.location), td(fdate(r.created_at)),
    ])
    section('Contrats', d.contrats, ['Référence', 'Titre', 'Statut', 'Signé le'], r => [
        td(r.serial), td(r.title), tdRaw(statusBadge(r.status)), td(r.signed_at ? fdate(r.signed_at) : '—'),
    ])

    // ── Rendez-vous, événements ─────────────────────────────
    section('Demandes de rendez-vous', d.rendez_vous, ['Date', 'Heure', 'Type', 'Motif', 'Statut'], r => [
        td(fday(r.date)), td(r.heure), td(r.type), td(long(r.motif, 300)), tdRaw(statusBadge(r.statut)),
    ])
    section('Rendez-vous planifiés', d.rendez_vous_agenda, ['Date', 'Service', 'Agent', 'Statut'], r => [
        td(fdate(r.scheduled_at || r.date)), td(s(r.service) || s(r.type)), td(r.agent_name), tdRaw(statusBadge(r.status)),
    ])
    section('Inscriptions aux événements', d.evenements, ['Événement', 'Billet', 'Montant', 'Paiement', 'Date'], r => [
        td(s(r.event_title) || s(r.event_id)), td(r.ticket_type), tdAmount(money(r.amount_paid, r.currency)),
        tdRaw(statusBadge(r.payment_status)), td(fday(r.created_at)),
    ])
    section('Billets', d.evenements_billets, ['Code', 'Type', 'Utilisé', 'Émis le'], r => [
        td(r.ticket_code), td(r.ticket_type), td(r.is_used ? `Oui (${fdate(r.used_at)})` : 'Non'), td(fday(r.created_at)),
    ])

    // ── Généalogie ─────────────────────────────────────────
    section('Arbres généalogiques', d.genealogie_arbres, ['Nom de l’arbre', 'Créé le'], r => [td(r.name), td(fday(r.created_at))])
    section('Personnes de l’arbre', d.genealogie_personnes, ['Nom', 'Naissance', 'Décès', 'Rôle'], r => [
        td([s(r.first_name), s(r.last_name)].filter(Boolean).join(' ')),
        td([fday(r.birth_date), s(r.birth_place)].filter(Boolean).join(' · ')),
        td([fday(r.death_date), s(r.death_place)].filter(Boolean).join(' · ')),
        td(s(r.relation_role) || (r.is_self ? 'Le client' : '')),
    ])

    // ── Échanges ───────────────────────────────────────────
    section('Messages vocaux', d.messages_vocaux, ['Transcription', 'Durée', 'Réponse', 'Date'], r => [
        td(long(r.transcript, 800)), td(r.duration_seconds ? `${r.duration_seconds} s` : ''), td(long(r.agent_response, 400)), td(fdate(r.created_at)),
    ])
    section('Appels', d.appels, ['Sujet', 'Agent', 'Statut', 'Durée', 'Date'], r => [
        td(r.sujet), td(r.agent_nom), tdRaw(statusBadge(r.statut)), td(r.duree_secondes ? `${r.duree_secondes} s` : ''), td(fdate(r.created_at)),
    ])
    section('E-mails envoyés au client', d.emails_envoyes, ['Objet', 'Contexte', 'État', 'Date'], r => [
        td(r.subject), td(r.context), tdRaw(statusBadge(r.status)), td(fdate(r.created_at)),
    ])
    section('Notifications', [...(d.notifications || []), ...(d.notifications_client || [])], ['Titre', 'Message', 'Lu', 'Date'], r => [
        td(r.title), td(long(r.message || r.body, 300)), td(r.is_read ? 'Oui' : 'Non'), td(fdate(r.created_at)),
    ])
    section('Newsletter', d.newsletter, ['État', 'Source', 'Inscrit le', 'Désinscrit le'], r => [
        td(r.status), td(r.source), td(fday(r.subscribed_at || r.created_at)), td(r.unsubscribed_at ? fday(r.unsubscribed_at) : '—'),
    ])

    // Documents joints
    P.push('<h2>Documents joints</h2>')
    if (fichiers.inclus.length) {
        P.push('<p>Les fichiers ci-dessous se trouvent dans le sous-dossier <b>Documents/</b> :</p>')
        P.push('<ul class="files">' + fichiers.inclus.map(f => `<li>${esc(f)}</li>`).join('') + '</ul>')
    } else {
        P.push('<p class="empty">Aucune pièce téléversée.</p>')
    }
    if (fichiers.manquants.length) {
        P.push(`<div class="warnbox"><b>${fichiers.manquants.length} fichier(s) référencé(s) mais introuvable(s) dans le stockage</b> — la ligne existe en base, le fichier non :<ul class="files">`
            + fichiers.manquants.map(m => `<li>${esc(m.libelle)} <span class="badge muted">${esc(m.source)}</span></li>`).join('') + '</ul></div>')
    }

    // Discussions
    P.push(`<h2>Discussions (${rec.discussions.length})</h2>`)
    if (!rec.discussions.length) {
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

    /* ── ANNEXE : chaque champ de chaque ligne. Les sections ci-dessus
       choisissent quoi montrer ; l'annexe ne choisit rien. C'est elle qui
       garantit qu'aucune information n'est omise de la fiche. */
    P.push('<h2>Annexe — toutes les données enregistrées</h2>')
    P.push('<p class="sub">Chaque rubrique se déplie. Les codes d’accès (jetons, clés de lien) sont masqués par sécurité.</p>')
    if (rec.profile) {
        P.push(`<details><summary>Profil du compte</summary><dl>${Object.entries(masquer(rec.profile)).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${valeurAnnexe(v)}</dd>`).join('')}</dl></details>`)
    }
    for (const [cle, rows] of Object.entries(d)) {
        if (!rows.length) continue
        P.push(`<details><summary>${esc(LIBELLES[cle] || cle)} — ${rows.length} ligne(s)</summary>`)
        for (const r of masquer(rows)) {
            P.push(`<div class="rec"><dl>${Object.entries(r).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${valeurAnnexe(v)}</dd>`).join('')}</dl></div>`)
        }
        P.push('</details>')
    }

    P.push(`<div class="foot">Retour Gagnant Bénin · Sauvegarde confidentielle · ${fdate(new Date().toISOString())}</div>`)
    P.push('</div></body></html>')
    return P.join('\n')
}

/* ─────────────── PDF factures, devis, avoirs ─────────────── */

function toInvoiceData(row: Row, signature?: string): InvoicePdfData {
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
        conditions: s(row.conditions) || undefined,
        validite: s(row.validite) || undefined,
        docType: s(row.type).toLowerCase() === 'devis' ? 'devis' : 'facture',
        clientSignatureDataUrl: signature,
    }
}

function addInvoicePdfs(dir: JSZip, folder: string, rows: Row[], echecs: string[], pendingPrefix = false, signature?: string) {
    if (!rows.length) return
    const f = dir.folder(folder)!
    const used = new Set<string>()
    for (const row of rows) {
        let ref = readableName(s(row.numero) || s(row.id))
        try {
            const b64 = generateInvoicePdf(toInvoiceData(row, signature))
            if (pendingPrefix && isPending(row.status)) ref = 'EN ATTENTE - ' + ref
            let name = `${ref}.pdf`, i = 2
            while (used.has(name.toLowerCase())) { name = `${ref} (${i}).pdf`; i++ }
            used.add(name.toLowerCase())
            f.file(name, Buffer.from(b64, 'base64'))
        } catch (e) {
            // Le PDF manque : on le dit, et la ligne reste dans l'annexe et le JSON.
            echecs.push(`${folder}/${ref}.pdf — ${e instanceof Error ? e.message : 'génération impossible'}`)
        }
    }
}

/* ─────────────── Assemblage d'un dossier client ─────────────── */

export interface BilanDossier {
    fichiers: ResultatFichiers
    pdfEchoues: string[]
}

export async function fillClientFolder(sb: SupabaseClient, dir: JSZip, rec: ClientRecord): Promise<BilanDossier> {
    const d = rec.data
    const pdfEchoues: string[] = []

    // 1) Vrais fichiers téléversés
    const fichiers = await addRealFiles(sb, dir, rec)

    // 2) PDF factures, devis, avoirs, devis d'agent — avec le paraphe du client s'il existe.
    const signature = (d.signatures || []).map(x => s(x.signature_data)).find(v => v.startsWith('data:image'))
    const dfRows = d.documents_financiers || []
    const parType = (t: string) => dfRows.filter(r => s(r.type).toLowerCase() === t)
    addInvoicePdfs(dir, 'Factures', parType('facture'), pdfEchoues, false, signature)
    addInvoicePdfs(dir, 'Devis', parType('devis'), pdfEchoues, true, signature)
    addInvoicePdfs(dir, 'Avoirs', parType('avoir'), pdfEchoues)
    addInvoicePdfs(dir, 'Devis', (d.devis_agent || []).map(r => ({ ...r, type: 'devis', currency: r.currency || 'XOF' })), pdfEchoues, true)

    // 3) Contrats : le texte signé tel qu'il a été présenté.
    for (const c of d.contrats || []) {
        const titre = readableName(`${s(c.serial) || s(c.id)} - ${s(c.title) || 'Contrat'}`)
        const corps = s(c.content)
        const html = /<\w+[^>]*>/.test(corps) ? corps : `<pre style="white-space:pre-wrap;font-family:inherit">${esc(corps)}</pre>`
        dir.folder('Contrats')!.file(`${titre}.html`,
            `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(titre)}</title><style>${CSS}</style></head><body><div class="wrap"><h1>${esc(s(c.title) || 'Contrat')}</h1><p class="sub">${esc(s(c.serial))} · ${c.signed_at ? `signé le ${esc(fdate(c.signed_at))} par ${esc(s(c.signed_name))}` : 'non signé'}</p><div class="card">${html}</div></div></body></html>`)
    }

    // 4) Fiches d'analyse des récaps MyAfroOrigins.
    for (const r of d.recaps_myafro || []) {
        if (!s(r.recap_ia)) continue
        dir.folder('Récaps')!.file(`${readableName(s(r.reference) || s(r.id))}.html`,
            `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(r.reference)}</title><style>${CSS}</style></head><body><div class="wrap"><h1>Récap ${esc(r.reference)}</h1><p class="sub">Généré le ${esc(fdate(r.recap_genere_le))}</p><div class="card" style="white-space:pre-wrap">${esc(r.recap_ia)}</div><h2>Situation décrite</h2><div class="card" style="white-space:pre-wrap">${esc(r.situation)}</div></div></body></html>`)
    }

    // 5) Fiche lisible + données complètes.
    dir.file('FICHE CLIENT.html', renderClientHtml(rec, fichiers))
    dir.file('donnees-completes.json', JSON.stringify(masquer({
        identite: { id: rec.id, email: rec.email, nom: rec.nom, prenom: rec.prenom, telephone: rec.phone, ville: rec.ville, pays: rec.pays, compte: rec.hasAccount, cree_le: rec.created_at },
        profil: rec.profile,
        donnees: rec.data,
        discussions: rec.discussions,
        fichiers_manquants: fichiers.manquants,
        pdf_non_generes: pdfEchoues,
        exporte_le: new Date().toISOString(),
    }), null, 2))

    return { fichiers, pdfEchoues }
}

/** Un client seul, dans une archive autonome dont la racine est son dossier. */
export async function construireZipClient(sb: SupabaseClient, rec: ClientRecord): Promise<{ zip: Buffer; bilan: BilanDossier }> {
    const zip = new JSZip()
    const bilan = await fillClientFolder(sb, zip.folder(folderName(rec))!, rec)
    const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } })
    return { zip: buf, bilan }
}

/* ─────────────── Documents de la racine de l'archive ─────────────── */

export function sommaireHtml(recs: ClientRecord[], dossiers: Map<ClientRecord, string>, parties?: Map<ClientRecord, string>): string {
    const rows = recs.map(rec => {
        const c = toSummary(rec).counts
        const nom = [rec.prenom, rec.nom].filter(Boolean).join(' ') || rec.email || rec.phone || 'Client'
        const href = encodeURI('./' + (dossiers.get(rec) || folderName(rec)) + '/FICHE CLIENT.html')
        const partie = parties ? `<td>${esc(parties.get(rec) || '')}</td>` : ''
        return `<tr><td><a href="${href}">${esc(nom)}</a></td><td>${esc(rec.email)}</td><td>${esc(rec.phone)}</td><td>${c.dossiers}</td><td>${c.commandes}</td><td>${c.factures}</td><td>${c.devis}</td><td>${c.paiements}</td><td>${c.total}</td>${partie}</tr>`
    }).join('')
    return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Sauvegarde clients - Sommaire</title><style>${CSS}</style></head><body>
<div class="flag"><i></i><i></i><i></i></div>
<div class="wrap">
<div class="head"><div class="logo">RG</div><div class="brand"><small>Retour Gagnant Bénin</small><b>Sauvegarde des clients</b></div></div>
<h1>Sommaire</h1>
<p class="sub">${recs.length} client(s) · généré le ${fdate(new Date().toISOString())}</p>
<p>Cliquez sur un nom pour ouvrir sa fiche complète. Le <a href="./RAPPORT DE COLLECTE.html">rapport de collecte</a> détaille, table par table, ce qui a été lu et rattaché.</p>
<table><thead><tr><th>Client</th><th>E-mail</th><th>Téléphone</th><th>Dossiers</th><th>Achats</th><th>Factures</th><th>Devis</th><th>Paiements</th><th>Total</th>${parties ? '<th>Partie</th>' : ''}</tr></thead><tbody>${rows}</tbody></table>
<div class="foot">Document confidentiel · Retour Gagnant Bénin</div>
</div></body></html>`
}

export function csvIndex(recs: ClientRecord[]): string {
    const head = ['Nom', 'Prenom', 'Email', 'Telephone', 'Ville', 'Pays', 'Compte', 'Services', 'Dossiers', 'Nationalite', 'Achats', 'Factures', 'Devis', 'Paiements', 'Messages', 'Elements_total', 'Inscrit_le']
    const q = (v: string) => `"${(v || '').replace(/"/g, '""')}"`
    const lines = [head.join(';')]
    for (const rec of recs) {
        const sm = toSummary(rec), c = sm.counts
        lines.push([
            rec.nom, rec.prenom, rec.email, rec.phone, rec.ville, rec.pays,
            rec.hasAccount ? 'oui' : 'non', sm.services.join(' / '),
            c.dossiers, c.nationalite, c.commandes, c.factures, c.devis, c.paiements, c.messages, c.total,
            rec.created_at ? fdate(rec.created_at) : '',
        ].map(v => q(s(v))).join(';'))
    }
    return '﻿' + lines.join('\r\n')
}

/** Le rapport qui prouve que rien n'a été perdu en route. */
export function rapportHtml(
    c: Pick<Collecte, 'rapport' | 'exclusions' | 'nonCouvertes' | 'genere_le' | 'duree_ms'>,
    manquants: { client: string; fichiers: string[] }[] = [],
    origine = '',
): string {
    const lignes = c.rapport.map(r => {
        const ok = r.lues === r.rattachees + r.non_rattachees
        return `<tr><td>${esc(r.libelle)}<br><span class="empty">${esc(r.table)}</span></td><td>${r.lues}</td><td>${r.rattachees}</td><td>${r.non_rattachees ? `<span class="badge warn">${r.non_rattachees}</span>` : 0}</td><td>${r.erreur ? `<span class="badge bad">${esc(r.erreur)}</span>` : ok ? '<span class="badge ok">complet</span>' : '<span class="badge bad">écart</span>'}</td></tr>`
    }).join('')
    const erreurs = c.rapport.filter(r => r.erreur)
    return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Rapport de collecte</title><style>${CSS}</style></head><body>
<div class="flag"><i></i><i></i><i></i></div><div class="wrap">
<h1>Rapport de collecte</h1>
<p class="sub">Collecte du ${esc(fdate(c.genere_le))} · ${Math.round(c.duree_ms / 100) / 10} s${origine ? ` · ${esc(origine)}` : ''}</p>
${erreurs.length ? `<div class="warnbox"><b>${erreurs.length} table(s) n’ont pas pu être lues</b> — leurs données manquent dans cette sauvegarde.</div>` : '<p><span class="badge ok">Toutes les tables ont été lues</span></p>'}
${c.nonCouvertes.length ? `<div class="warnbox"><b>Tables non couvertes</b> : elles contiennent des données de personnes mais ne sont pas encore prévues par la sauvegarde — ${c.nonCouvertes.map(t => `${esc(t.table)} (${esc(t.colonnes.join(', '))})`).join(' ; ')}</div>` : ''}
<h2>Table par table</h2>
<p>« Non rattachées » : lignes qu’aucun client n’a pu réclamer (sans e-mail, sans téléphone, sans lien). Elles ne sont pas perdues : elles figurent dans le dossier <b>_NON RATTACHÉES</b>.</p>
<table><thead><tr><th>Donnée</th><th>Lues</th><th>Rattachées</th><th>Non rattachées</th><th>État</th></tr></thead><tbody>${lignes}</tbody></table>
${manquants.length ? `<h2>Fichiers introuvables</h2><table><thead><tr><th>Client</th><th>Fichiers</th></tr></thead><tbody>${manquants.map(m => `<tr><td>${esc(m.client)}</td><td>${m.fichiers.map(esc).join('<br>')}</td></tr>`).join('')}</tbody></table>` : ''}
<h2>Écartées volontairement</h2>
<table><thead><tr><th>Table</th><th>Raison</th></tr></thead><tbody>${c.exclusions.map(x => `<tr><td>${esc(x.table)}</td><td>${esc(x.raison)}</td></tr>`).join('')}</tbody></table>
<div class="foot">Retour Gagnant Bénin · Sauvegarde confidentielle</div></div></body></html>`
}

/** Les lignes qu'aucun client ne réclame : une page lisible + le JSON, par table. */
export function ajouterNonRattachees(zip: JSZip, nonRattachees: Record<string, Row[]>) {
    const entrees = Object.entries(nonRattachees).filter(([, rows]) => rows.length)
    if (!entrees.length) return
    const dir = zip.folder('_NON RATTACHÉES')!
    const libelles: Record<string, string> = Object.fromEntries(SOURCES.map(x => [x.table, x.libelle]))
    for (const [table, rows] of entrees) {
        const propres = masquer(rows)
        const nom = readableName(libelles[table] || table)
        dir.file(`${nom}.json`, JSON.stringify(propres, null, 2))
        dir.file(`${nom}.html`, `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(nom)}</title><style>${CSS}</style></head><body><div class="wrap"><h1>${esc(nom)}</h1><p class="sub">${rows.length} ligne(s) sans client identifiable · table ${esc(table)}</p>${propres.map(r => `<div class="rec"><dl>${Object.entries(r).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${valeurAnnexe(v)}</dd>`).join('')}</dl></div>`).join('')}</div></body></html>`)
    }
}

export function lisezMoi(nbClients: number, genere: string): string {
    return [
        'SAUVEGARDE DES CLIENTS — RETOUR GAGNANT BÉNIN',
        '',
        `Générée le : ${fdate(genere)}`,
        `Nombre de clients : ${nbClients}`,
        '',
        'COMMENT LIRE CETTE SAUVEGARDE',
        '1. Ouvrez « _SOMMAIRE.html » (double-clic) pour voir la liste de tous',
        '   les clients et cliquer sur un nom.',
        '2. Chaque client a son dossier « Nom Prénom (email) » contenant :',
        '     • FICHE CLIENT.html       → toutes ses informations, bien présentées,',
        '                                 puis une annexe avec chaque donnée enregistrée',
        '     • Factures/ Devis/ Avoirs/ → ses documents financiers en PDF',
        '     • Documents/              → les vrais fichiers téléversés',
        '     • Contrats/ Récaps/       → contrats et fiches d’analyse',
        '     • donnees-completes.json  → toutes ses données brutes (restauration)',
        '3. « RAPPORT DE COLLECTE.html » prouve, table par table, que rien n’a été',
        '   perdu. « _NON RATTACHÉES » contient ce qu’aucun client n’a pu réclamer.',
        '4. « Liste_clients.csv » s’ouvre dans Excel pour une vue tableau.',
        '',
        'Les codes d’accès (jetons de signature, clés de lien de paiement) sont',
        'masqués : une sauvegarde égarée ne doit ouvrir aucune porte.',
    ].join('\n')
}
