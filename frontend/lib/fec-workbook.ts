// ═══════════════════════════════════════════════════════════════
// Classeur Excel FEC (présentation lisible + partie double)
// Extrait de la route /api/admin/comptabilite/fec pour être testable hors
// serveur (une route Next ne peut exporter que ses handlers).
// ═══════════════════════════════════════════════════════════════
import ExcelJS from 'exceljs'
import type { FecRow, FecDoc, FecPaiement, FecDepense } from '@/lib/fec-syscohada'
import { expenseCategoryLabel } from '@/lib/constants/compta'
import { nomClient, nomPropre } from '@/lib/compta-export'

/* ══════════════════════════════════════════════════════════════
   Classeur Excel FEC : présentation professionnelle :
   feuille Synthèse (période, volumes, équilibre débit/crédit) +
   feuille Écritures (18 colonnes FEC stylées, filtres, totaux).
   ══════════════════════════════════════════════════════════════ */
const EMERALD = 'FF008751'
const EMERALD_DARK = 'FF045032'
const GOLD = 'FFFCD116'
const LIGHT = 'FFF4FAF6'

export async function buildFecWorkbook(
    rows: FecRow[],
    balance: { debit: number; credit: number; balanced: boolean },
    label: string,
    raw: {
        docs: FecDoc[]; paiements: FecPaiement[]; depenses: FecDepense[]
        toXof: (a: number, c?: string | null) => number
        /** Factures payées en ligne dans la période (sans paiement manuel) : datées de paid_at. */
        facturesEncaissees?: FecDoc[]
        /** Factures liées aux paiements de la période, émises un autre mois. */
        docsRef?: FecDoc[]
    },
): Promise<ArrayBuffer> {
    const wb = new ExcelJS.Workbook()
    wb.creator = 'Retour Gagnant Bénin'
    wb.created = new Date()

    const { docs, paiements, depenses, toXof } = raw
    const facturesEncaissees = raw.facturesEncaissees || []
    // VRAIE date Excel (numFmt dd/mm/yyyy), jour calendaire UTC : avant, texte
    // « 03/09/2026 » (ni tri ni filtre chronologique possibles).
    const dateXl = (d?: string | null): Date | null => {
        if (!d) return null
        const t = new Date(d)
        return isNaN(t.getTime()) ? null : new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()))
    }
    const DATE_FMT = 'dd/mm/yyyy'

    // ── Totaux LISIBLES (une valeur = un sens, pas de partie double) ──
    const factures = docs.filter(d => d.type === 'facture')
    const totalVentesTTC = factures.reduce((a, d) => a + toXof(Number(d.total) || 0, d.currency), 0)
    const totalTVA = factures.reduce((a, d) => a + toXof(Number(d.total_tva) || 0, d.currency), 0)
    // Total encaissé = somme des encaissements réellement enregistrés
    // (= total de la feuille « Encaissements », donc cohérent avec elle)
    const totalEncaisse = paiements.reduce((a, p) => a + toXof(Number(p.montant) || 0, 'XOF'), 0)
        + facturesEncaissees.reduce((a, d) => a + toXof(Number(d.total) || 0, d.currency), 0)
    const totalDepenses = depenses.reduce((a, d) => a + toXof(Number(d.montant) || 0, d.devise), 0) // dépenses multi-devises
    const resultat = totalEncaisse - totalDepenses

    /* ── Feuille 1 : Synthèse ── */
    const syn = wb.addWorksheet('Synthèse', { properties: { defaultRowHeight: 18 } })
    syn.columns = [{ width: 4 }, { width: 36 }, { width: 26 }, { width: 4 }]

    syn.mergeCells('B2:C2')
    const title = syn.getCell('B2')
    title.value = 'RETOUR GAGNANT BÉNIN'
    title.font = { name: 'Calibri', size: 20, bold: true, color: { argb: 'FFFFFFFF' } }
    title.alignment = { vertical: 'middle', horizontal: 'center' }
    title.fill = { type: 'gradient', gradient: 'angle', degree: 90, stops: [{ position: 0, color: { argb: EMERALD_DARK } }, { position: 1, color: { argb: EMERALD } }] }
    syn.getRow(2).height = 40

    syn.mergeCells('B3:C3')
    const sub = syn.getCell('B3')
    sub.value = `Rapport comptable mensuel : Période : ${label}`
    sub.font = { size: 11, bold: true, color: { argb: EMERALD_DARK } }
    sub.alignment = { horizontal: 'center' }
    syn.getRow(3).height = 22

    const synRows: Array<[string, string | number, string?]> = [
        ['Période couverte', label],
        ['Généré le', new Date().toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Africa/Porto-Novo' })],
        ['', ''],
        ['Chiffre d’affaires facturé (TTC)', totalVentesTTC, 'num'],
        ['dont TVA collectée', totalTVA, 'num'],
        ['Total encaissé (entrées)', totalEncaisse, 'pos'],
        ['Total dépenses (sorties)', totalDepenses, 'neg'],
        ['Résultat (encaissé − dépenses)', resultat, resultat >= 0 ? 'pos' : 'neg'],
        ['', ''],
        ['Nombre de factures', factures.length],
        ['Nombre d’encaissements', paiements.length + facturesEncaissees.length],
        ['Nombre de dépenses', depenses.length],
    ]
    let r = 5
    for (const [k, v, kind] of synRows) {
        if (!k) { r++; continue }
        const kc = syn.getCell(`B${r}`); const vc = syn.getCell(`C${r}`)
        kc.value = k
        kc.font = { size: 11, bold: true, color: { argb: 'FF1B2A4A' } }
        kc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT } }
        kc.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } }
        vc.value = v
        const col = kind === 'pos' ? 'FF047857' : kind === 'neg' ? 'FFDC2626' : 'FF1B2A4A'
        vc.font = { size: 11, bold: typeof v === 'number', color: { argb: col } }
        if (typeof v === 'number') vc.numFmt = '#,##0 "FCFA"'
        vc.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } }
        r++
    }

    syn.mergeCells(`B${r + 1}:C${r + 3}`)
    const note = syn.getCell(`B${r + 1}`)
    note.value = "Ce classeur présente des feuilles LISIBLES (une ligne = une opération) : Factures, Encaissements et Dépenses. La feuille « Écritures (partie double) » reprend la comptabilité normée SYSCOHADA pour votre expert-comptable. Un export .txt réglementaire reste disponible depuis le panel."
    note.font = { size: 9.5, italic: true, color: { argb: 'FF5B6478' } }
    note.alignment = { wrapText: true, vertical: 'top' }

    // ── Générateur de feuille lisible (colonnes simples + total) ──
    type Cell = string | number | Date | null
    const simpleSheet = (name: string, cols: Array<{ h: string; w: number; num?: boolean; date?: boolean }>, data: Cell[][], totalColIdx?: number) => {
        const sh = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] })
        sh.columns = cols.map(c => ({ width: c.w }))
        const h = sh.getRow(1)
        h.values = cols.map(c => c.h); h.height = 24
        h.eachCell(cell => {
            cell.font = { bold: true, size: 10.5, color: { argb: 'FFFFFFFF' } }
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EMERALD } }
            cell.alignment = { vertical: 'middle', horizontal: 'center' }
            cell.border = { bottom: { style: 'medium', color: { argb: GOLD } } }
        })
        data.forEach((row, i) => {
            const er = sh.addRow(row.map(v => typeof v === 'string' ? nomPropre(v) : v)); er.height = 17
            er.eachCell((cell, cn) => {
                cell.font = { size: 10, color: { argb: 'FF1B2A4A' } }
                if (i % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAF9' } }
                cell.border = { bottom: { style: 'hair', color: { argb: 'FFE8ECEA' } } }
                if (cols[cn - 1]?.num) { cell.numFmt = '#,##0 "FCFA"'; cell.alignment = { horizontal: 'right' } }
                if (cols[cn - 1]?.date) { cell.numFmt = DATE_FMT; cell.alignment = { horizontal: 'center' } }
            })
        })
        if (!data.length) {
            // Feuille vide : ligne explicite (sinon export « cassé » en apparence)
            const er = sh.addRow(['Aucune opération sur la période'])
            if (cols.length > 1) sh.mergeCells(er.number, 1, er.number, cols.length)
            const c = er.getCell(1)
            c.font = { size: 10, italic: true, color: { argb: 'FF8A8F98' } }
            c.alignment = { horizontal: 'center', vertical: 'middle' }
            er.height = 20
        }
        if (totalColIdx != null && data.length) {
            // totalColIdx = index 0-based de la colonne numérique à sommer
            const tot = data.reduce((a, row) => a + (Number(row[totalColIdx]) || 0), 0)
            const valCol = totalColIdx + 1           // colonne 1-based du montant
            const labelCol = Math.max(1, valCol - 1) // cellule à gauche pour « TOTAL »
            const tr = sh.addRow([]); tr.height = 22
            tr.getCell(labelCol).value = 'TOTAL'
            tr.getCell(valCol).value = tot
            for (const c of [labelCol, valCol]) {
                const cell = tr.getCell(c)
                cell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } }
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EMERALD_DARK } }
                if (c === valCol) { cell.numFmt = '#,##0 "FCFA"'; cell.alignment = { horizontal: 'right' } }
            }
        }
        sh.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } }
    }

    /* ── Feuille 2 : Factures (ventes) ── */
    simpleSheet('Factures',
        [{ h: 'Date', w: 12, date: true }, { h: 'N° Facture', w: 18 }, { h: 'Client', w: 26 }, { h: 'Statut', w: 12 }, { h: 'HT', w: 14, num: true }, { h: 'TVA', w: 14, num: true }, { h: 'TTC (FCFA)', w: 16, num: true }],
        factures.map(d => {
            const ht = toXof(Number(d.sous_total) || ((Number(d.total) || 0) - (Number(d.total_tva) || 0)), d.currency)
            return [dateXl(d.created_at), d.numero || d.id.slice(0, 8), nomClient(d.client_nom, d.client_prenom) || 'Client', d.status === 'paye' ? 'Payé' : d.status, ht, toXof(Number(d.total_tva) || 0, d.currency), toXof(Number(d.total) || 0, d.currency)]
        }), 6)

    /* ── Feuille 3 : Encaissements (entrées) ── */
    const docNum: Record<string, string> = {}
    for (const d of [...(raw.docsRef || []), ...factures]) docNum[d.id] = d.numero || d.id.slice(0, 8)
    // Encaissements datés du PAIEMENT : paiements manuels (date_paiement) +
    // factures payées en ligne sans paiement manuel (paid_at).
    const encRows: Cell[][] = [
        ...paiements.map(p => {
            const ref = (p.document_id && docNum[p.document_id]) ? docNum[p.document_id]
                : (p.reference || '').replace(/^\[EXTERNE\]\s*/i, '').split('|')[0].trim() || 'Encaissement'
            return [dateXl(p.date_paiement), ref, p.type || 'virement', toXof(Number(p.montant) || 0, 'XOF')] as Cell[]
        }),
        ...facturesEncaissees.map(d => [dateXl(d.paid_at || d.created_at), d.numero || d.id.slice(0, 8), d.payment_method || 'Paiement en ligne', toXof(Number(d.total) || 0, d.currency)] as Cell[]),
    ].sort((a, b) => ((a[0] as Date | null)?.getTime() || 0) - ((b[0] as Date | null)?.getTime() || 0))
    simpleSheet('Encaissements',
        [{ h: 'Date', w: 12, date: true }, { h: 'Facture / Réf.', w: 22 }, { h: 'Mode', w: 16 }, { h: 'Montant (FCFA)', w: 16, num: true }],
        encRows, 3)

    /* ── Feuille 4 : Dépenses (sorties) ── */
    simpleSheet('Dépenses',
        [{ h: 'Date', w: 12, date: true }, { h: 'Fournisseur / Libellé', w: 34 }, { h: 'Catégorie', w: 22 }, { h: 'Montant (FCFA)', w: 16, num: true }],
        depenses.map(e => [dateXl(e.date_depense), e.titre || '-', expenseCategoryLabel(e.categorie || 'autre'), toXof(Number(e.montant) || 0, e.devise)]), 3)

    /* ── Feuille 5 : Écritures (partie double : expert-comptable) ── */
    const ws = wb.addWorksheet('Écritures (partie double)', { views: [{ state: 'frozen', ySplit: 1 }] })
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

    // AAAAMMJJ (format FEC .txt) → vraie date Excel
    const fecDate = (d: string): Date | null => /^\d{8}$/.test(d || '') ? new Date(Date.UTC(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8))) : null
    rows.forEach((row, i) => {
        const excelRow = ws.addRow(COLS.map(c => {
            if (c.key === 'Debit' || c.key === 'Credit' || c.key === 'Montantdevise') {
                const n = parseFloat(String(row[c.key]).replace(',', '.'))
                return isFinite(n) && n !== 0 ? n : null
            }
            if (c.key === 'EcritureDate' || c.key === 'PieceDate' || c.key === 'ValidDate') return fecDate(String(row[c.key] || ''))
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
            if (key === 'EcritureDate' || key === 'PieceDate' || key === 'ValidDate') {
                cell.numFmt = DATE_FMT
                cell.alignment = { horizontal: 'center' }
            }
        })
    })
    if (!rows.length) {
        const er = ws.addRow(['Aucune opération sur la période'])
        ws.mergeCells(er.number, 1, er.number, COLS.length)
        er.getCell(1).font = { size: 10, italic: true, color: { argb: 'FF8A8F98' } }
        er.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
    }

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
