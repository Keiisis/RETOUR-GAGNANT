import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'
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
   GET /api/admin/backup/export            → ZIP de TOUS les clients
   GET /api/admin/backup/export?client=KEY → ZIP d'un seul client

   Structure du ZIP :
     README.txt
     index.csv
     <Nom_Prenom_email>/
        INFOS.txt              (fiche lisible : identité, services, totaux)
        profil.json
        dossiers.json  + notes.txt
        nationalite.json
        commandes.json
        paiements.json
        rendez-vous.json
        documents/DOCUMENTS.txt (manifeste des pièces téléversées + liens)
        factures/<numero>.pdf  + factures.json
        devis/<numero>.pdf     + devis.json
        discussions/<sujet>.txt
        logements.json / evenements.json / contrats.json / signatures.json …
═══════════════════════════════════════════════════════════ */

type Row = Record<string, unknown>

const s = (v: unknown): string => (v === null || v === undefined ? '' : String(v))
const money = (v: unknown, cur: unknown): string => {
    const n = Number(v)
    if (!isFinite(n)) return s(v)
    return new Intl.NumberFormat('fr-FR').format(n) + ' ' + (s(cur) || 'XOF')
}
const date = (v: unknown): string => {
    const d = new Date(s(v))
    return isNaN(d.getTime()) ? s(v) : d.toLocaleString('fr-FR')
}
const sanitize = (v: string): string =>
    (v || '').normalize('NFD')
        .replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 80) || 'client'

function folderName(rec: ClientRecord): string {
    const base = [rec.nom, rec.prenom].filter(Boolean).join('_') || rec.email.split('@')[0] || 'client'
    const suffix = rec.email ? '_' + rec.email : (rec.id ? '_' + rec.id.slice(0, 8) : '')
    return sanitize(base + suffix)
}

/** Fiche identité lisible. */
function ficheInfos(rec: ClientRecord): string {
    const sm = toSummary(rec)
    const L: string[] = []
    L.push('═══════════════════════════════════════════════════════')
    L.push('  RETOUR GAGNANT BÉNIN — FICHE CLIENT (SAUVEGARDE)')
    L.push('═══════════════════════════════════════════════════════')
    L.push('')
    L.push(`Nom complet   : ${[rec.prenom, rec.nom].filter(Boolean).join(' ') || '(non renseigné)'}`)
    L.push(`E-mail        : ${rec.email || '(aucun)'}`)
    L.push(`Téléphone     : ${rec.phone || '(non renseigné)'}`)
    L.push(`Ville / Pays  : ${[rec.ville, rec.pays].filter(Boolean).join(', ') || '(non renseigné)'}`)
    L.push(`Compte        : ${rec.hasAccount ? 'Oui (id ' + rec.id + ')' : 'Non (client hors-compte)'}`)
    L.push(`Inscrit le    : ${rec.created_at ? date(rec.created_at) : '(inconnu)'}`)
    L.push('')
    L.push(`Services       : ${sm.services.join(' · ') || '(aucun détecté)'}`)
    L.push('')
    L.push('─── TOTAUX ─────────────────────────────────────────────')
    const c = sm.counts
    L.push(`Dossiers          : ${c.dossiers}`)
    L.push(`Demandes national.: ${c.nationalite}`)
    L.push(`Commandes         : ${c.commandes}`)
    L.push(`Factures          : ${c.factures}`)
    L.push(`Devis             : ${c.devis}`)
    L.push(`Paiements         : ${c.paiements}`)
    L.push(`Messages          : ${c.messages}`)
    L.push(`Rendez-vous       : ${c.rendez_vous}`)
    L.push(`Documents         : ${c.documents}`)
    L.push(`Logements (leads) : ${c.logements}`)
    L.push(`Événements        : ${c.evenements}`)
    L.push(`Contrats          : ${c.contrats}`)
    L.push('')
    L.push(`Sauvegarde générée le ${new Date().toLocaleString('fr-FR')}`)
    return L.join('\n')
}

/** Fil de discussion lisible. */
function discussionText(thread: Row, messages: Row[]): string {
    const L: string[] = []
    L.push(`SUJET : ${s(thread.sujet) || '(sans sujet)'}`)
    L.push(`Type  : ${s(thread.type) || 'general'}`)
    L.push(`Ouvert le : ${date(thread.created_at)}`)
    L.push('─────────────────────────────────────────')
    const first = s(thread.message)
    if (first) {
        L.push(`[${date(thread.created_at)}] CLIENT :`)
        L.push(first)
        L.push('')
    }
    for (const m of messages) {
        const who = s(m.role).toLowerCase() === 'client' ? 'CLIENT' : 'ÉQUIPE RGB'
        L.push(`[${date(m.created_at)}] ${who} :`)
        L.push(s(m.content))
        L.push('')
    }
    return L.join('\n')
}

/** Manifeste des pièces téléversées (liens de téléchargement). */
function documentsManifest(rec: ClientRecord): string {
    const docs = rec.data['documents'] || []
    const L: string[] = []
    L.push('PIÈCES TÉLÉVERSÉES PAR / POUR LE CLIENT')
    L.push('(fichiers stockés sur Supabase Storage — liens directs ci-dessous)')
    L.push('')
    if (!docs.length) { L.push('(aucune pièce)'); return L.join('\n') }
    docs.forEach((d, i) => {
        L.push(`${i + 1}. ${s(d.nom_fichier) || s(d.name) || 'document'}`)
        L.push(`   Type   : ${s(d.type_fichier) || '?'}`)
        L.push(`   Taille : ${s(d.taille) || '?'}`)
        L.push(`   Ajouté : ${date(d.created_at)}`)
        if (d.url) L.push(`   Lien   : ${s(d.url)}`)
        if (d.storage_path) L.push(`   Chemin : ${s(d.storage_path)}`)
        L.push('')
    })
    return L.join('\n')
}

/** Construit la donnée PDF depuis une ligne documents_financiers. */
function toInvoiceData(row: Row): InvoicePdfData {
    const rawItems = Array.isArray(row.items) ? (row.items as Row[]) : []
    const items: InvoicePdfItem[] = rawItems.map(it => ({
        description: s(it.description) || s(it.designation) || 'Prestation',
        quantity: Number(it.quantity ?? it.quantite ?? 1) || 1,
        unit_price: Number(it.unit_price ?? it.prix_unitaire ?? 0) || 0,
        tva: Number(it.tva ?? 0) || 0,
    }))
    const status = s(row.status).toLowerCase()
    return {
        invoiceRef: s(row.numero) || s(row.id),
        date: s(row.created_at),
        paidAt: s(row.paid_at) || undefined,
        isPaid: status === 'paye' || status === 'payee' || status === 'payé' || status === 'paid',
        clientName: [s(row.client_prenom), s(row.client_nom)].filter(Boolean).join(' ') || 'Client',
        clientEmail: s(row.client_email) || undefined,
        clientPhone: s(row.client_phone) || undefined,
        clientAddress: s(row.client_adresse) || undefined,
        items,
        currency: s(row.currency) || 'XOF',
        sous_total: Number(row.sous_total) || 0,
        total_tva: Number(row.total_tva) || 0,
        remise: Number(row.remise) || 0,
        total: Number(row.total) || 0,
        notes: s(row.notes) || undefined,
        docType: s(row.type).toLowerCase() === 'devis' ? 'devis' : 'facture',
    }
}

/** Remplit le dossier ZIP d'un client. */
function fillClientFolder(zip: JSZip, rec: ClientRecord) {
    const dir = zip.folder(folderName(rec))!
    const d = rec.data

    dir.file('INFOS.txt', ficheInfos(rec))
    dir.file('profil.json', JSON.stringify(rec.profile ?? { note: 'Client sans compte' }, null, 2))

    // Notes regroupées (dossiers + documents financiers).
    const notes: string[] = []
    for (const doss of d.dossiers || []) {
        const n = s(doss.notes) || s(doss.note) || s(doss.commentaire)
        if (n) notes.push(`[Dossier ${s(doss.num_dossier) || s(doss.id)}] ${n}`)
    }
    for (const df of d.documents_financiers || []) {
        const n = s(df.notes)
        if (n) notes.push(`[${s(df.type)} ${s(df.numero)}] ${n}`)
    }
    if (notes.length) dir.file('notes.txt', notes.join('\n\n'))

    // Sections JSON génériques.
    const dump: [string, string][] = [
        ['dossiers.json', 'dossiers'],
        ['nationalite.json', 'nationalite'],
        ['nationalite-documents.json', 'nationalite_documents'],
        ['commandes.json', 'commandes'],
        ['commandes-suivi.json', 'commandes_suivi'],
        ['paiements.json', 'paiements'],
        ['paiements-manuels.json', 'paiements_manuels'],
        ['rendez-vous.json', 'rendez_vous'],
        ['logements.json', 'logements'],
        ['evenements.json', 'evenements'],
        ['evenements-billets.json', 'evenements_billets'],
        ['contrats.json', 'contrats'],
        ['signatures.json', 'signatures'],
        ['classement.json', 'classement'],
        ['eligibilite.json', 'eligibilite'],
        ['recherche-ancestrale.json', 'recherche_ancestrale'],
        ['invoices.json', 'invoices'],
    ]
    for (const [file, key] of dump) {
        const rows = d[key]
        if (rows && rows.length) dir.file(file, JSON.stringify(rows, null, 2))
    }

    // Documents téléversés (manifeste).
    if ((d.documents || []).length) {
        const docDir = dir.folder('documents')!
        docDir.file('DOCUMENTS.txt', documentsManifest(rec))
        docDir.file('documents.json', JSON.stringify(d.documents, null, 2))
    }

    // Factures & devis : JSON + PDF (documents_financiers) + Smart Slides (devis).
    const dfRows = d.documents_financiers || []
    const factures = dfRows.filter(r => s(r.type).toLowerCase() === 'facture')
    const devis = dfRows.filter(r => s(r.type).toLowerCase() === 'devis')
    const avoirs = dfRows.filter(r => s(r.type).toLowerCase() === 'avoir')

    const addPdfFolder = (name: string, rows: Row[]) => {
        if (!rows.length) return
        const f = dir.folder(name)!
        f.file(`${name}.json`, JSON.stringify(rows, null, 2))
        for (const row of rows) {
            try {
                const b64 = generateInvoicePdf(toInvoiceData(row))
                const ref = sanitize(s(row.numero) || s(row.id))
                f.file(`${ref}.pdf`, Buffer.from(b64, 'base64'))
            } catch {
                /* PDF non généré (données incomplètes) : le JSON reste présent. */
            }
        }
    }
    addPdfFolder('factures', factures)
    addPdfFolder('devis', devis)
    if (avoirs.length) dir.file('avoirs.json', JSON.stringify(avoirs, null, 2))
    if ((d.devis_smart || []).length) dir.file('devis-smart.json', JSON.stringify(d.devis_smart, null, 2))

    // Discussions : un fichier lisible par thread.
    if (rec.discussions.length) {
        const chatDir = dir.folder('discussions')!
        rec.discussions.forEach((t, i) => {
            const subj = sanitize(s(t.thread.sujet) || `thread_${i + 1}`)
            chatDir.file(`${String(i + 1).padStart(2, '0')}_${subj}.txt`, discussionText(t.thread, t.messages))
        })
        chatDir.file('discussions.json', JSON.stringify(rec.discussions, null, 2))
    }
}

function csvIndex(recs: ClientRecord[]): string {
    const head = ['Nom', 'Prenom', 'Email', 'Telephone', 'Ville', 'Pays', 'Compte', 'Dossiers', 'Nationalite', 'Commandes', 'Factures', 'Devis', 'Paiements', 'Messages', 'Inscrit_le']
    const esc = (v: string) => `"${(v || '').replace(/"/g, '""')}"`
    const lines = [head.join(',')]
    for (const rec of recs) {
        const c = toSummary(rec).counts
        lines.push([
            rec.nom, rec.prenom, rec.email, rec.phone, rec.ville, rec.pays,
            rec.hasAccount ? 'oui' : 'non',
            c.dossiers, c.nationalite, c.commandes, c.factures, c.devis, c.paiements, c.messages,
            rec.created_at ? date(rec.created_at) : '',
        ].map(v => esc(s(v))).join(','))
    }
    return '﻿' + lines.join('\r\n') // BOM pour Excel
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

        zip.file('README.txt', [
            'SAUVEGARDE CLIENTS — RETOUR GAGNANT BÉNIN',
            '',
            `Générée le : ${new Date().toLocaleString('fr-FR')}`,
            `Nombre de clients : ${targets.length}`,
            '',
            'Chaque dossier correspond à un client (Nom_Prenom_email).',
            'Il contient : fiche INFOS.txt, profil, dossiers, demandes de',
            'nationalité, commandes, paiements, rendez-vous, factures (PDF),',
            'devis (PDF), discussions, documents téléversés (liens), notes,',
            'et toutes les données des services (logement, événements, Fa,',
            'permis, recherche ancestrale, contrats, signatures…).',
            '',
            'index.csv récapitule tous les clients (ouvrable dans Excel).',
        ].join('\n'))

        zip.file('index.csv', csvIndex(targets))

        for (const rec of targets) {
            try { fillClientFolder(zip, rec) } catch { /* un client en échec ne bloque pas le reste */ }
        }

        const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } })
        const filename = key
            ? `sauvegarde-${sanitize(targets[0].nom || targets[0].email)}-${stamp}.zip`
            : `sauvegarde-clients-RGB-${stamp}.zip`

        const body = new Uint8Array(buffer)
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
