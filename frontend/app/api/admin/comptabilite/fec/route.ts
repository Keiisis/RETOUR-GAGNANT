import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import ExcelJS from 'exceljs'
import { verifyApiAuth } from '@/lib/api-auth'
import { buildFec, serializeFec, fecBalance, type FecRow } from '@/lib/fec-syscohada'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const isValidPeriode = (p: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(p)
const isValidAnnee = (a: string) => /^\d{4}$/.test(a)

// ══════════════════════════════════════════════════════════════
// GET /api/admin/comptabilite/fec?periode=YYYY-MM  (ou ?annee=YYYY)
// Export FEC / SYSCOHADA (écritures en partie double) — fichier .txt tabulé,
// importable par un logiciel comptable / transmissible à l'expert-comptable.
// ══════════════════════════════════════════════════════════════
export async function GET(request: NextRequest) {
    const auth = await verifyApiAuth(request, 'admin')
    if (!auth.authenticated) return auth.error!
    if (!serviceKey) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY manquante' }, { status: 500 })

    const { searchParams } = new URL(request.url)
    const periode = searchParams.get('periode')
    const annee = searchParams.get('annee')

    let start: Date, end: Date, label: string
    if (annee && isValidAnnee(annee)) {
        const y = Number(annee)
        start = new Date(Date.UTC(y, 0, 1)); end = new Date(Date.UTC(y + 1, 0, 1)); label = annee
    } else if (periode && isValidPeriode(periode)) {
        const [y, m] = periode.split('-').map(Number)
        start = new Date(Date.UTC(y, m - 1, 1)); end = new Date(Date.UTC(y, m, 1)); label = periode
    } else {
        const now = new Date()
        start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
        end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
        label = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
    }
    const startIso = start.toISOString()
    const endIso = end.toISOString()
    const startDay = startIso.slice(0, 10)
    const endDay = endIso.slice(0, 10)

    const supabase = createClient(supabaseUrl, serviceKey)

    const [docsRes, paiemRes, depRes, curRes] = await Promise.all([
        supabase.from('documents_financiers')
            .select('id, numero, type, status, total, total_tva, sous_total, remise, currency, created_at, client_nom, client_prenom')
            .eq('type', 'facture')
            .gte('created_at', startIso).lt('created_at', endIso),
        supabase.from('paiements_manuels')
            .select('id, document_id, montant, date_paiement, type, reference')
            .gte('date_paiement', startDay).lt('date_paiement', endDay),
        supabase.from('depenses')
            .select('id, titre, categorie, montant, date_depense')
            .gte('date_depense', startDay).lt('date_depense', endDay),
        supabase.from('currencies').select('code, exchange_rate_to_base, is_base'),
    ])

    // Carte de taux XOF par unité (table currencies = source de vérité)
    const rates: Record<string, number> = { XOF: 1 }
    for (const c of curRes.data || []) {
        const r = c.is_base ? 1 : Number(c.exchange_rate_to_base)
        if (c.code && isFinite(r) && r > 0) rates[String(c.code).toUpperCase()] = r
    }
    const toXof = (amount: number, currency?: string | null) => {
        const rate = rates[(currency || 'XOF').toUpperCase()] ?? 1
        return Math.round((Number(amount) || 0) * rate)
    }

    const rows = buildFec({
        docs: docsRes.data || [],
        paiements: paiemRes.data || [],
        depenses: depRes.data || [],
        toXof,
        validDate: new Date().toISOString().slice(0, 10).replace(/-/g, ''),
    })

    const balance = fecBalance(rows)

    // ── Format .txt réglementaire (import logiciels comptables) : ?format=txt ──
    const format = searchParams.get('format') || 'xlsx'
    if (format === 'txt') {
        const content = serializeFec(rows)
        // BOM UTF-8 pour compat tableurs/logiciels comptables
        const buffer = Buffer.from('﻿' + content, 'utf-8')
        return new NextResponse(buffer as unknown as BodyInit, {
            status: 200,
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Content-Disposition': `attachment; filename="RGB_FEC_${label}.txt"`,
                'Content-Length': String(buffer.length),
                'X-FEC-Lines': String(rows.length),
                'X-FEC-Balanced': String(balance.balanced),
            },
        })
    }

    // ── Format Excel professionnel (défaut) : mise en page soignée, totaux,
    //    contrôle d'équilibre, feuille de synthèse ────────────────────────────
    const xlsxBuffer = await buildFecWorkbook(rows, balance, label)
    return new NextResponse(xlsxBuffer as unknown as BodyInit, {
        status: 200,
        headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="RGB_FEC_${label}.xlsx"`,
            'Content-Length': String((xlsxBuffer as ArrayBuffer).byteLength),
            'X-FEC-Lines': String(rows.length),
            'X-FEC-Balanced': String(balance.balanced),
        },
    })
}

/* ══════════════════════════════════════════════════════════════
   Classeur Excel FEC — présentation professionnelle :
   feuille Synthèse (période, volumes, équilibre débit/crédit) +
   feuille Écritures (18 colonnes FEC stylées, filtres, totaux).
   ══════════════════════════════════════════════════════════════ */
const EMERALD = 'FF008751'
const EMERALD_DARK = 'FF045032'
const GOLD = 'FFFCD116'
const LIGHT = 'FFF4FAF6'

async function buildFecWorkbook(
    rows: FecRow[],
    balance: { debit: number; credit: number; balanced: boolean },
    label: string,
): Promise<ArrayBuffer> {
    const wb = new ExcelJS.Workbook()
    wb.creator = 'Retour Gagnant Bénin'
    wb.created = new Date()

    /* ── Feuille 1 : Synthèse ── */
    const syn = wb.addWorksheet('Synthèse', { properties: { defaultRowHeight: 18 } })
    syn.columns = [{ width: 4 }, { width: 34 }, { width: 30 }, { width: 4 }]

    syn.mergeCells('B2:C2')
    const title = syn.getCell('B2')
    title.value = 'RETOUR GAGNANT BÉNIN'
    title.font = { name: 'Calibri', size: 20, bold: true, color: { argb: 'FFFFFFFF' } }
    title.alignment = { vertical: 'middle', horizontal: 'center' }
    title.fill = { type: 'gradient', gradient: 'angle', degree: 90, stops: [{ position: 0, color: { argb: EMERALD_DARK } }, { position: 1, color: { argb: EMERALD } }] }
    syn.getRow(2).height = 40

    syn.mergeCells('B3:C3')
    const sub = syn.getCell('B3')
    sub.value = `Export FEC / SYSCOHADA — Écritures en partie double — Période : ${label}`
    sub.font = { size: 11, bold: true, color: { argb: EMERALD_DARK } }
    sub.alignment = { horizontal: 'center' }
    syn.getRow(3).height = 22

    const synRows: Array<[string, string | number]> = [
        ['Période couverte', label],
        ['Généré le', new Date().toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Africa/Porto-Novo' })],
        ["Nombre d'écritures (lignes)", rows.length],
        ['Total Débit (XOF)', balance.debit],
        ['Total Crédit (XOF)', balance.credit],
        ['Équilibre débit / crédit', balance.balanced ? 'ÉQUILIBRÉ ' : 'DÉSÉQUILIBRÉ — à vérifier'],
    ]
    let r = 5
    for (const [k, v] of synRows) {
        const kc = syn.getCell(`B${r}`); const vc = syn.getCell(`C${r}`)
        kc.value = k
        kc.font = { size: 11, bold: true, color: { argb: 'FF1B2A4A' } }
        kc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT } }
        kc.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } }
        vc.value = v
        vc.font = { size: 11, bold: typeof v === 'number' || String(v).includes('ÉQUILIBR'), color: { argb: String(v).includes('DÉSÉQUILIBR') ? 'FFDC2626' : 'FF1B2A4A' } }
        if (typeof v === 'number') vc.numFmt = '#,##0'
        vc.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } }
        r++
    }

    syn.mergeCells(`B${r + 1}:C${r + 3}`)
    const note = syn.getCell(`B${r + 1}`)
    note.value = "Ce classeur reprend les écritures comptables en partie double (norme FEC, plan SYSCOHADA) : chaque opération apparaît au débit d'un compte et au crédit d'un autre. L'onglet « Écritures » contient le détail complet, filtrable par journal, compte et pièce. Un export .txt réglementaire (import direct dans un logiciel comptable) reste disponible depuis le panel."
    note.font = { size: 9.5, italic: true, color: { argb: 'FF5B6478' } }
    note.alignment = { wrapText: true, vertical: 'top' }

    /* ── Feuille 2 : Écritures ── */
    const ws = wb.addWorksheet('Écritures', { views: [{ state: 'frozen', ySplit: 1 }] })
    const COLS: Array<{ key: keyof FecRow; header: string; width: number }> = [
        { key: 'JournalCode', header: 'Journal', width: 9 },
        { key: 'JournalLib', header: 'Libellé journal', width: 18 },
        { key: 'EcritureNum', header: 'N° écriture', width: 14 },
        { key: 'EcritureDate', header: 'Date', width: 11 },
        { key: 'CompteNum', header: 'Compte', width: 10 },
        { key: 'CompteLib', header: 'Libellé compte', width: 26 },
        { key: 'CompAuxNum', header: 'Aux. n°', width: 10 },
        { key: 'CompAuxLib', header: 'Aux. libellé', width: 18 },
        { key: 'PieceRef', header: 'Pièce', width: 14 },
        { key: 'PieceDate', header: 'Date pièce', width: 11 },
        { key: 'EcritureLib', header: "Libellé de l'écriture", width: 34 },
        { key: 'Debit', header: 'Débit (XOF)', width: 14 },
        { key: 'Credit', header: 'Crédit (XOF)', width: 14 },
        { key: 'Montantdevise', header: 'Montant devise', width: 14 },
        { key: 'Idevise', header: 'Devise', width: 8 },
        { key: 'ValidDate', header: 'Validé le', width: 11 },
    ]
    ws.columns = COLS.map(c => ({ key: c.key, width: c.width }))

    const head = ws.getRow(1)
    head.values = COLS.map(c => c.header)
    head.height = 26
    head.eachCell(cell => {
        cell.font = { bold: true, size: 10.5, color: { argb: 'FFFFFFFF' } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EMERALD } }
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
        cell.border = { bottom: { style: 'medium', color: { argb: GOLD } } }
    })

    const fmtDate = (d: string) => d && d.length === 8 ? `${d.slice(6, 8)}/${d.slice(4, 6)}/${d.slice(0, 4)}` : d
    rows.forEach((row, i) => {
        const excelRow = ws.addRow(COLS.map(c => {
            if (c.key === 'Debit' || c.key === 'Credit' || c.key === 'Montantdevise') {
                const n = parseFloat(String(row[c.key]).replace(',', '.'))
                return isFinite(n) && n !== 0 ? n : null
            }
            if (c.key === 'EcritureDate' || c.key === 'PieceDate' || c.key === 'ValidDate') return fmtDate(String(row[c.key] || ''))
            return row[c.key] || ''
        }))
        excelRow.height = 17
        excelRow.eachCell((cell, colNumber) => {
            const key = COLS[colNumber - 1].key
            cell.font = { size: 10, color: { argb: 'FF1B2A4A' } }
            if (i % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAF9' } }
            cell.border = { bottom: { style: 'hair', color: { argb: 'FFE8ECEA' } } }
            if (key === 'Debit' || key === 'Credit' || key === 'Montantdevise') {
                cell.numFmt = '#,##0'
                cell.alignment = { horizontal: 'right' }
                if (key === 'Debit' && cell.value) cell.font = { size: 10, bold: true, color: { argb: 'FF045032' } }
                if (key === 'Credit' && cell.value) cell.font = { size: 10, bold: true, color: { argb: 'FF9A3412' } }
            }
        })
    })

    // Totaux + contrôle d'équilibre
    const totalRow = ws.addRow([])
    const debitCol = COLS.findIndex(c => c.key === 'Debit') + 1
    totalRow.getCell(debitCol - 1).value = 'TOTAUX'
    totalRow.getCell(debitCol).value = balance.debit
    totalRow.getCell(debitCol + 1).value = balance.credit
    totalRow.height = 24
    for (const c of [debitCol - 1, debitCol, debitCol + 1]) {
        const cell = totalRow.getCell(c)
        cell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EMERALD_DARK } }
        cell.numFmt = '#,##0'
        cell.alignment = { horizontal: c === debitCol - 1 ? 'left' : 'right' }
    }

    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLS.length } }

    return await wb.xlsx.writeBuffer() as unknown as ArrayBuffer
}
