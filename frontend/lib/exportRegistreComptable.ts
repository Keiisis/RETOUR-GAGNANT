/**
 * Export Registre Comptable Mensuel Agent : Format identique à Gestion_Factures_RGB_2026.xlsx
 *
 * Structure par feuille mensuelle :
 *   - En-tête RGB + IFU/RCCM
 *   - Paramètre TVA configurable
 *   - SECTION 1 : RECETTES (fond vert) avec sous-total + ventilation catégorie
 *   - SECTION 2 : DÉPENSES (fond rouge) avec sous-total + ventilation catégorie
 *   - SECTION 3 : BILAN FINANCIER avec TVA nette, résultat, marge
 *   - Rappels légaux
 */
import * as ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import { COMPANY } from '@/lib/company'

// ═══════════════════════════════════════════════════════════════
// Palette (extraite du fichier de référence)
// ═══════════════════════════════════════════════════════════════
const C = {
    navy:      'FF0D2B4E',
    gold:      'FFD4A017',
    green:     'FF0A6B3B',
    red:       'FFA32200',
    blue:      'FF1A4A6B',
    ivory:     'FFFBF7EC',
    white:     'FFFFFFFF',
    lightGray: 'FFF0F0F0',
    lightGreen:'FFDFF6E8',
    lightRed:  'FFFCE4E4',
    lightBlue: 'FFE1ECFF',
    lightGold: 'FFFFF8E1',
    gray:      'FF888888',
    darkText:  'FF1A1A1A',
}

const font = (opts: Partial<ExcelJS.Font>): Partial<ExcelJS.Font> => ({
    name: 'Calibri', ...opts,
})
const fill = (argb: string): ExcelJS.Fill => ({
    type: 'pattern', pattern: 'solid', fgColor: { argb },
})
const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
    bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
    left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
    right: { style: 'thin', color: { argb: 'FFD0D0D0' } },
}

// ═══════════════════════════════════════════════════════════════
// Catégories de référence (registre RGB officiel)
// ═══════════════════════════════════════════════════════════════
const REVENUE_CATEGORIES = [
    'Accompagnement diaspora',
    'Ceremonie du Nom',
    'Commission partenaire',
    'Partenariat institutionnel',
    'Formation / Atelier',
    'Location / Prestation',
    'Subvention / Aide',
    'Autre recette',
]

const EXPENSE_CATEGORIES = [
    'Salaires et charges',
    'Loyer et charges',
    'Fournitures bureau',
    'Deplacement et carburant',
    'Telephone et Internet',
    'Communication et Pub',
    'Sous-traitants',
    'Frais bancaires',
    'Impots et taxes',
    'Frais evenement',
    'Formation',
    'Materiel et equipement',
    'Autre depense',
]

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════
export interface RegistreRecette {
    date: Date
    numero: string
    client: string
    categorie: string
    refDossier: string
    montantHT: number
    statut: string
}

export interface RegistreDepense {
    date: Date
    numero: string
    fournisseur: string
    categorie: string
    ref: string
    montantHT: number
    statut: string
}

export interface RegistreOptions {
    filename: string
    moisLabel: string          // e.g. "Avril 2026"
    periodeISO: string         // e.g. "2026-04"
    tauxTVA: number            // 0.18
    recettes: RegistreRecette[]
    depenses: RegistreDepense[]
}

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════
const mergeAndStyle = (
    ws: ExcelJS.Worksheet,
    row: number,
    colStart: number,
    colEnd: number,
    text: string,
    fillColor: string,
    fontOpts: Partial<ExcelJS.Font>,
    align: Partial<ExcelJS.Alignment> = { vertical: 'middle', horizontal: 'center' },
) => {
    ws.mergeCells(row, colStart, row, colEnd)
    const cell = ws.getCell(row, colStart)
    cell.value = text
    cell.fill = fill(fillColor)
    cell.font = font(fontOpts)
    cell.alignment = { ...align, wrapText: true }
    cell.border = thinBorder
}

const setRowHeight = (ws: ExcelJS.Worksheet, row: number, h: number) => {
    ws.getRow(row).height = h
}

const numFmt = '#,##0'
const numFmtPct = '0.0%'

// ═══════════════════════════════════════════════════════════════
// Build one month sheet
// ═══════════════════════════════════════════════════════════════
function buildMonthSheet(wb: ExcelJS.Workbook, opts: RegistreOptions) {
    const { moisLabel, tauxTVA, recettes, depenses } = opts
    const ws = wb.addWorksheet(moisLabel, {
        properties: { tabColor: { argb: C.green.slice(2) } },
        pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    })

    const COLS = 10
    // Column widths matching reference
    ws.getColumn(1).width = 4    // N
    ws.getColumn(2).width = 13   // DATE
    ws.getColumn(3).width = 20   // N° FACTURE
    ws.getColumn(4).width = 28   // CLIENT/FOURNISSEUR
    ws.getColumn(5).width = 22   // CATEGORIE
    ws.getColumn(6).width = 14   // REF
    ws.getColumn(7).width = 17   // MONTANT HT
    ws.getColumn(8).width = 14   // TVA (auto)
    ws.getColumn(9).width = 17   // TTC (auto)
    ws.getColumn(10).width = 14  // STATUT

    let r = 1

    // ── ROW 1 : Titre ────────────────────────────────────────
    mergeAndStyle(ws, r, 1, COLS,
        `RETOUR GAGNANT BENIN : REGISTRE COMPTABLE MENSUEL : ${moisLabel.toUpperCase()}`,
        C.navy, { bold: true, color: { argb: C.gold }, size: 12 })
    setRowHeight(ws, r, 30)
    r++

    // ── ROW 2 : IFU / RCCM ──────────────────────────────────
    mergeAndStyle(ws, r, 1, COLS,
        `IFU : ${COMPANY.ifu}   |   RCCM : ${COMPANY.rccm}   |   ${COMPANY.address}   |   ${COMPANY.phone}`,
        C.gold, { bold: true, color: { argb: C.navy }, size: 8 })
    setRowHeight(ws, r, 18)
    r++

    // ── ROW 3 : vide ─────────────────────────────────────────
    r++

    // ── ROW 4 : Légende ──────────────────────────────────────
    mergeAndStyle(ws, r, 1, COLS,
        'LEGENDE :   Fond JAUNE = a SAISIR par l\'agent  |  Fond BLEU = valeur calculee automatiquement  |  Fond VERT = en-tete recettes  |  Fond ROUGE = en-tete depenses',
        C.ivory, { color: { argb: C.blue }, size: 8 })
    setRowHeight(ws, r, 16)
    r++

    // ── ROW 5 : vide
    r++

    // ── ROW 6 : Paramètre TVA ────────────────────────────────
    const tvaRow = r
    ws.mergeCells(r, 1, r, 4)
    ws.getCell(r, 1).value = 'PARAMETRE TVA (taux) :'
    ws.getCell(r, 1).fill = fill(C.lightGray)
    ws.getCell(r, 1).font = font({ bold: true, color: { argb: C.navy }, size: 9 })
    ws.getCell(r, 1).alignment = { vertical: 'middle', horizontal: 'right' }
    ws.getCell(r, 5).value = tauxTVA
    ws.getCell(r, 5).numFmt = '0%'
    ws.getCell(r, 5).fill = fill(C.lightGold)
    ws.getCell(r, 5).font = font({ bold: true, color: { argb: C.red.slice(2) }, size: 11 })
    ws.getCell(r, 5).alignment = { vertical: 'middle', horizontal: 'center' }
    ws.getCell(r, 5).border = thinBorder
    ws.mergeCells(r, 6, r, COLS)
    ws.getCell(r, 6).value = 'Modifier si exoneration TVA (mettre 0) : ce parametre affecte tous les calculs automatiques du mois'
    ws.getCell(r, 6).fill = fill(C.lightGray)
    ws.getCell(r, 6).font = font({ italic: true, color: { argb: C.gray }, size: 8 })
    r++
    r++ // blank

    // ═══════════════════════════════════════════════════════════
    // SECTION 1 : RECETTES
    // ═══════════════════════════════════════════════════════════
    const SEC1_HEADER = r
    mergeAndStyle(ws, r, 1, COLS,
        'SECTION 1 : RECETTES  (ENTREES DE TRESORERIE)',
        C.green, { bold: true, color: { argb: C.white }, size: 11 })
    setRowHeight(ws, r, 26)
    r++

    // Column headers
    const recHeaders = ['N', 'DATE', 'N° FACTURE / RECU', 'CLIENT / BENEFICIAIRE', 'CATEGORIE', 'REF. DOSSIER', 'MONTANT HT (FCFA)', 'TVA (auto)', 'TTC (auto)', 'STATUT']
    const headerRow = ws.getRow(r)
    recHeaders.forEach((h, i) => {
        const cell = headerRow.getCell(i + 1)
        cell.value = h
        cell.fill = fill(C.green)
        cell.font = font({ bold: true, color: { argb: C.white }, size: 9 })
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
        cell.border = thinBorder
    })
    setRowHeight(ws, r, 20)
    r++

    // Data rows (18 slots minimum, filled with actual data)
    const DATA_ROWS = 18
    const recDataStart = r
    for (let i = 0; i < DATA_ROWS; i++) {
        const row = ws.getRow(r)
        const rec = recettes[i]
        // Col A: N°
        row.getCell(1).value = i + 1
        row.getCell(1).fill = fill(C.white)
        row.getCell(1).font = font({ color: { argb: C.gray }, size: 8 })
        row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
        row.getCell(1).border = thinBorder

        if (rec) {
            // DATE
            row.getCell(2).value = rec.date
            row.getCell(2).numFmt = 'DD/MM/YYYY'
            row.getCell(2).fill = fill(C.lightGold)
            // N° FACTURE
            row.getCell(3).value = rec.numero || ''
            row.getCell(3).fill = fill(C.lightGold)
            // CLIENT
            row.getCell(4).value = rec.client || ''
            row.getCell(4).fill = fill(C.lightGold)
            // CATEGORIE
            row.getCell(5).value = rec.categorie || ''
            row.getCell(5).fill = fill(C.lightGold)
            // REF DOSSIER
            row.getCell(6).value = rec.refDossier || ''
            row.getCell(6).fill = fill(C.lightGold)
            // MONTANT HT
            row.getCell(7).value = rec.montantHT || 0
            row.getCell(7).numFmt = numFmt
            row.getCell(7).fill = fill(C.lightGold)
            // TVA (auto) = HT * taux
            row.getCell(8).value = { formula: `G${r}*$E$${tvaRow}` }
            row.getCell(8).numFmt = numFmt
            row.getCell(8).fill = fill(C.lightBlue)
            // TTC (auto) = HT + TVA
            row.getCell(9).value = { formula: `G${r}+H${r}` }
            row.getCell(9).numFmt = numFmt
            row.getCell(9).fill = fill(C.lightBlue)
            // STATUT
            row.getCell(10).value = rec.statut || ''
            row.getCell(10).fill = fill(C.lightGold)
        } else {
            // Empty row : formulas still present
            for (let c = 2; c <= 6; c++) {
                row.getCell(c).fill = fill(C.lightGold)
                row.getCell(c).border = thinBorder
            }
            row.getCell(7).fill = fill(C.lightGold)
            row.getCell(7).border = thinBorder
            // TVA
            row.getCell(8).value = { formula: `IF(G${r}="","-",G${r}*$E$${tvaRow})` }
            row.getCell(8).numFmt = numFmt
            row.getCell(8).fill = fill(C.lightBlue)
            // TTC
            row.getCell(9).value = { formula: `IF(G${r}="","-",G${r}+H${r})` }
            row.getCell(9).numFmt = numFmt
            row.getCell(9).fill = fill(C.lightBlue)
            row.getCell(10).fill = fill(C.lightGold)
            row.getCell(10).border = thinBorder
        }

        // Style all cells
        for (let c = 2; c <= 10; c++) {
            const cell = row.getCell(c)
            cell.font = font({ size: 9, color: { argb: C.darkText } })
            cell.alignment = { vertical: 'middle', horizontal: c >= 7 ? 'right' : 'left' }
            cell.border = thinBorder
        }
        setRowHeight(ws, r, 16)
        r++
    }
    const recDataEnd = r - 1

    // SOUS-TOTAL RECETTES
    const recTotalRow = r
    ws.mergeCells(r, 1, r, 6)
    ws.getCell(r, 1).value = 'SOUS-TOTAL RECETTES DU MOIS'
    ws.getCell(r, 1).fill = fill(C.green)
    ws.getCell(r, 1).font = font({ bold: true, color: { argb: C.white }, size: 9 })
    ws.getCell(r, 1).alignment = { vertical: 'middle', horizontal: 'right' }
    ws.getCell(r, 1).border = thinBorder
    // SUM formulas for HT, TVA, TTC
    ;[7, 8, 9].forEach(c => {
        const col = String.fromCharCode(64 + c) // G, H, I
        ws.getCell(r, c).value = { formula: `SUM(${col}${recDataStart}:${col}${recDataEnd})` }
        ws.getCell(r, c).numFmt = numFmt
        ws.getCell(r, c).fill = fill(C.green)
        ws.getCell(r, c).font = font({ bold: true, color: { argb: C.white }, size: 10 })
        ws.getCell(r, c).alignment = { horizontal: 'right', vertical: 'middle' }
        ws.getCell(r, c).border = thinBorder
    })
    ws.getCell(r, 10).fill = fill(C.green)
    ws.getCell(r, 10).border = thinBorder
    setRowHeight(ws, r, 22)
    r++
    r++ // blank

    // ── VENTILATION RECETTES PAR CATÉGORIE ───────────────────
    mergeAndStyle(ws, r, 1, COLS,
        'VENTILATION RECETTES PAR CATEGORIE',
        C.blue, { bold: true, color: { argb: C.gold }, size: 9 })
    setRowHeight(ws, r, 20)
    r++

    // Headers ventilation
    const ventRecHeaderRow = ws.getRow(r)
    ws.mergeCells(r, 1, r, 4)
    ventRecHeaderRow.getCell(1).value = 'CATEGORIE'
    ventRecHeaderRow.getCell(5).value = 'NB FAC.'
    ws.mergeCells(r, 6, r, 7)
    ventRecHeaderRow.getCell(6).value = 'TOTAL HT'
    ws.mergeCells(r, 8, r, 9)
    ventRecHeaderRow.getCell(8).value = 'TOTAL TTC'
    ventRecHeaderRow.getCell(10).value = '% TOTAL'
    for (let c = 1; c <= 10; c++) {
        const cell = ventRecHeaderRow.getCell(c)
        cell.fill = fill(C.blue)
        cell.font = font({ bold: true, color: { argb: C.white }, size: 9 })
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        cell.border = thinBorder
    }
    setRowHeight(ws, r, 18)
    r++

    // Category rows with COUNTIF/SUMIF formulas
    const catColLetter = 'E' // CATEGORIE column
    REVENUE_CATEGORIES.forEach(cat => {
        const row = ws.getRow(r)
        ws.mergeCells(r, 1, r, 4)
        row.getCell(1).value = cat
        row.getCell(1).font = font({ size: 9, color: { argb: C.darkText } })
        row.getCell(1).alignment = { vertical: 'middle' }
        row.getCell(1).border = thinBorder
        // NB FAC = COUNTIF
        row.getCell(5).value = { formula: `COUNTIF(${catColLetter}${recDataStart}:${catColLetter}${recDataEnd},A${r})` }
        row.getCell(5).numFmt = '0'
        row.getCell(5).fill = fill(C.lightBlue)
        row.getCell(5).border = thinBorder
        row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' }
        row.getCell(5).font = font({ size: 9 })
        // TOTAL HT = SUMIF
        ws.mergeCells(r, 6, r, 7)
        row.getCell(6).value = { formula: `SUMIF(${catColLetter}${recDataStart}:${catColLetter}${recDataEnd},A${r},G${recDataStart}:G${recDataEnd})` }
        row.getCell(6).numFmt = numFmt
        row.getCell(6).fill = fill(C.lightBlue)
        row.getCell(6).border = thinBorder
        row.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' }
        row.getCell(6).font = font({ size: 9 })
        // TOTAL TTC = SUMIF
        ws.mergeCells(r, 8, r, 9)
        row.getCell(8).value = { formula: `SUMIF(${catColLetter}${recDataStart}:${catColLetter}${recDataEnd},A${r},I${recDataStart}:I${recDataEnd})` }
        row.getCell(8).numFmt = numFmt
        row.getCell(8).fill = fill(C.lightBlue)
        row.getCell(8).border = thinBorder
        row.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' }
        row.getCell(8).font = font({ size: 9 })
        // % TOTAL = IFERROR
        row.getCell(10).value = { formula: `IFERROR(F${r}/G${recTotalRow},0)` }
        row.getCell(10).numFmt = numFmtPct
        row.getCell(10).fill = fill(C.lightBlue)
        row.getCell(10).border = thinBorder
        row.getCell(10).alignment = { horizontal: 'center', vertical: 'middle' }
        row.getCell(10).font = font({ size: 9 })
        setRowHeight(ws, r, 16)
        r++
    })
    r += 2 // blanks

    // ═══════════════════════════════════════════════════════════
    // SECTION 2 : DÉPENSES
    // ═══════════════════════════════════════════════════════════
    mergeAndStyle(ws, r, 1, COLS,
        'SECTION 2 : DEPENSES  (SORTIES DE TRESORERIE)',
        C.red, { bold: true, color: { argb: C.white }, size: 11 })
    setRowHeight(ws, r, 26)
    r++

    // Column headers dépenses
    const depHeaders = ['N', 'DATE', 'N° FACTURE / RECU', 'FOURNISSEUR', 'CATEGORIE', 'REF.', 'MONTANT HT (FCFA)', 'TVA (auto)', 'TTC (auto)', 'STATUT']
    const depHeaderRow = ws.getRow(r)
    depHeaders.forEach((h, i) => {
        const cell = depHeaderRow.getCell(i + 1)
        cell.value = h
        cell.fill = fill(C.red)
        cell.font = font({ bold: true, color: { argb: C.white }, size: 9 })
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
        cell.border = thinBorder
    })
    setRowHeight(ws, r, 20)
    r++

    // Data rows dépenses
    const depDataStart = r
    for (let i = 0; i < DATA_ROWS; i++) {
        const row = ws.getRow(r)
        const dep = depenses[i]

        row.getCell(1).value = i + 1
        row.getCell(1).fill = fill(C.white)
        row.getCell(1).font = font({ color: { argb: C.gray }, size: 8 })
        row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
        row.getCell(1).border = thinBorder

        if (dep) {
            row.getCell(2).value = dep.date
            row.getCell(2).numFmt = 'DD/MM/YYYY'
            row.getCell(2).fill = fill(C.lightGold)
            row.getCell(3).value = dep.numero || ''
            row.getCell(3).fill = fill(C.lightGold)
            row.getCell(4).value = dep.fournisseur || ''
            row.getCell(4).fill = fill(C.lightGold)
            row.getCell(5).value = dep.categorie || ''
            row.getCell(5).fill = fill(C.lightGold)
            row.getCell(6).value = dep.ref || ''
            row.getCell(6).fill = fill(C.lightGold)
            row.getCell(7).value = dep.montantHT || 0
            row.getCell(7).numFmt = numFmt
            row.getCell(7).fill = fill(C.lightGold)
            row.getCell(8).value = { formula: `G${r}*$E$${tvaRow}` }
            row.getCell(8).numFmt = numFmt
            row.getCell(8).fill = fill(C.lightBlue)
            row.getCell(9).value = { formula: `G${r}+H${r}` }
            row.getCell(9).numFmt = numFmt
            row.getCell(9).fill = fill(C.lightBlue)
            row.getCell(10).value = dep.statut || ''
            row.getCell(10).fill = fill(C.lightGold)
        } else {
            for (let c = 2; c <= 6; c++) {
                row.getCell(c).fill = fill(C.lightGold)
                row.getCell(c).border = thinBorder
            }
            row.getCell(7).fill = fill(C.lightGold)
            row.getCell(7).border = thinBorder
            row.getCell(8).value = { formula: `IF(G${r}="","-",G${r}*$E$${tvaRow})` }
            row.getCell(8).numFmt = numFmt
            row.getCell(8).fill = fill(C.lightBlue)
            row.getCell(9).value = { formula: `IF(G${r}="","-",G${r}+H${r})` }
            row.getCell(9).numFmt = numFmt
            row.getCell(9).fill = fill(C.lightBlue)
            row.getCell(10).fill = fill(C.lightGold)
            row.getCell(10).border = thinBorder
        }
        for (let c = 2; c <= 10; c++) {
            const cell = row.getCell(c)
            cell.font = font({ size: 9, color: { argb: C.darkText } })
            cell.alignment = { vertical: 'middle', horizontal: c >= 7 ? 'right' : 'left' }
            cell.border = thinBorder
        }
        setRowHeight(ws, r, 16)
        r++
    }
    const depDataEnd = r - 1

    // SOUS-TOTAL DÉPENSES
    const depTotalRow = r
    ws.mergeCells(r, 1, r, 6)
    ws.getCell(r, 1).value = 'SOUS-TOTAL DEPENSES DU MOIS'
    ws.getCell(r, 1).fill = fill(C.red)
    ws.getCell(r, 1).font = font({ bold: true, color: { argb: C.white }, size: 9 })
    ws.getCell(r, 1).alignment = { vertical: 'middle', horizontal: 'right' }
    ws.getCell(r, 1).border = thinBorder
    ;[7, 8, 9].forEach(c => {
        const col = String.fromCharCode(64 + c)
        ws.getCell(r, c).value = { formula: `SUM(${col}${depDataStart}:${col}${depDataEnd})` }
        ws.getCell(r, c).numFmt = numFmt
        ws.getCell(r, c).fill = fill(C.red)
        ws.getCell(r, c).font = font({ bold: true, color: { argb: C.white }, size: 10 })
        ws.getCell(r, c).alignment = { horizontal: 'right', vertical: 'middle' }
        ws.getCell(r, c).border = thinBorder
    })
    ws.getCell(r, 10).fill = fill(C.red)
    ws.getCell(r, 10).border = thinBorder
    setRowHeight(ws, r, 22)
    r++
    r++ // blank

    // ── VENTILATION DÉPENSES PAR CATÉGORIE ───────────────────
    mergeAndStyle(ws, r, 1, COLS,
        'VENTILATION DEPENSES PAR CATEGORIE',
        C.blue, { bold: true, color: { argb: C.gold }, size: 9 })
    setRowHeight(ws, r, 20)
    r++

    const ventDepHeaderRow = ws.getRow(r)
    ws.mergeCells(r, 1, r, 4)
    ventDepHeaderRow.getCell(1).value = 'CATEGORIE'
    ventDepHeaderRow.getCell(5).value = 'NB FAC.'
    ws.mergeCells(r, 6, r, 7)
    ventDepHeaderRow.getCell(6).value = 'TOTAL HT'
    ws.mergeCells(r, 8, r, 9)
    ventDepHeaderRow.getCell(8).value = 'TOTAL TTC'
    ventDepHeaderRow.getCell(10).value = '% TOTAL'
    for (let c = 1; c <= 10; c++) {
        const cell = ventDepHeaderRow.getCell(c)
        cell.fill = fill(C.blue)
        cell.font = font({ bold: true, color: { argb: C.white }, size: 9 })
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        cell.border = thinBorder
    }
    setRowHeight(ws, r, 18)
    r++

    EXPENSE_CATEGORIES.forEach(cat => {
        const row = ws.getRow(r)
        ws.mergeCells(r, 1, r, 4)
        row.getCell(1).value = cat
        row.getCell(1).font = font({ size: 9, color: { argb: C.darkText } })
        row.getCell(1).alignment = { vertical: 'middle' }
        row.getCell(1).border = thinBorder
        row.getCell(5).value = { formula: `COUNTIF(E${depDataStart}:E${depDataEnd},A${r})` }
        row.getCell(5).numFmt = '0'
        row.getCell(5).fill = fill(C.lightBlue)
        row.getCell(5).border = thinBorder
        row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' }
        row.getCell(5).font = font({ size: 9 })
        ws.mergeCells(r, 6, r, 7)
        row.getCell(6).value = { formula: `SUMIF(E${depDataStart}:E${depDataEnd},A${r},G${depDataStart}:G${depDataEnd})` }
        row.getCell(6).numFmt = numFmt
        row.getCell(6).fill = fill(C.lightBlue)
        row.getCell(6).border = thinBorder
        row.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' }
        row.getCell(6).font = font({ size: 9 })
        ws.mergeCells(r, 8, r, 9)
        row.getCell(8).value = { formula: `SUMIF(E${depDataStart}:E${depDataEnd},A${r},I${depDataStart}:I${depDataEnd})` }
        row.getCell(8).numFmt = numFmt
        row.getCell(8).fill = fill(C.lightBlue)
        row.getCell(8).border = thinBorder
        row.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' }
        row.getCell(8).font = font({ size: 9 })
        row.getCell(10).value = { formula: `IFERROR(F${r}/G${depTotalRow},0)` }
        row.getCell(10).numFmt = numFmtPct
        row.getCell(10).fill = fill(C.lightBlue)
        row.getCell(10).border = thinBorder
        row.getCell(10).alignment = { horizontal: 'center', vertical: 'middle' }
        row.getCell(10).font = font({ size: 9 })
        setRowHeight(ws, r, 16)
        r++
    })
    r += 2 // blanks

    // ═══════════════════════════════════════════════════════════
    // SECTION 3 : BILAN FINANCIER DU MOIS
    // ═══════════════════════════════════════════════════════════
    mergeAndStyle(ws, r, 1, COLS,
        'SECTION 3 : BILAN FINANCIER DU MOIS',
        C.navy, { bold: true, color: { argb: C.gold }, size: 11 })
    setRowHeight(ws, r, 26)
    r++

    const bilanItems: Array<{ label: string; formula: string; bold?: boolean; highlight?: string }> = [
        { label: 'TOTAL RECETTES HT', formula: `G${recTotalRow}`, bold: true },
        { label: 'TOTAL RECETTES TTC', formula: `I${recTotalRow}` },
        { label: 'TOTAL DEPENSES HT', formula: `G${depTotalRow}`, bold: true },
        { label: 'TOTAL DEPENSES TTC', formula: `I${depTotalRow}` },
        { label: 'TVA COLLECTEE  (recettes x taux)', formula: `G${recTotalRow}*$E$${tvaRow}` },
        { label: 'TVA DEDUCTIBLE (depenses x taux)', formula: `G${depTotalRow}*$E$${tvaRow}` },
        { label: 'TVA NETTE A REVERSER A LA DGI', formula: `G${recTotalRow}*$E$${tvaRow}-G${depTotalRow}*$E$${tvaRow}`, bold: true, highlight: C.lightGold },
        { label: 'RESULTAT NET HT  (Recettes - Depenses)', formula: `G${recTotalRow}-G${depTotalRow}`, bold: true, highlight: C.lightGreen },
        { label: 'RESULTAT NET TTC', formula: `I${recTotalRow}-I${depTotalRow}` },
        { label: 'TAUX DE MARGE NETTE', formula: `IFERROR((G${recTotalRow}-G${depTotalRow})/G${recTotalRow},0)` },
    ]

    bilanItems.forEach(item => {
        ws.mergeCells(r, 1, r, 6)
        ws.getCell(r, 1).value = item.label
        ws.getCell(r, 1).fill = fill(item.highlight || C.lightGray)
        ws.getCell(r, 1).font = font({ bold: item.bold || false, color: { argb: C.navy }, size: 9 })
        ws.getCell(r, 1).alignment = { vertical: 'middle', horizontal: 'right' }
        ws.getCell(r, 1).border = thinBorder

        ws.mergeCells(r, 7, r, 10)
        ws.getCell(r, 7).value = { formula: item.formula }
        ws.getCell(r, 7).numFmt = item.label.includes('MARGE') ? numFmtPct : numFmt
        ws.getCell(r, 7).fill = fill(item.highlight || C.lightBlue)
        ws.getCell(r, 7).font = font({
            bold: item.bold || false,
            color: { argb: item.bold ? C.navy : C.darkText },
            size: item.bold ? 11 : 9,
        })
        ws.getCell(r, 7).alignment = { horizontal: 'right', vertical: 'middle' }
        ws.getCell(r, 7).border = thinBorder
        setRowHeight(ws, r, item.bold ? 22 : 18)
        r++
    })

    // Verdict automatique
    r++
    ws.mergeCells(r, 1, r, COLS)
    ws.getCell(r, 1).value = { formula: `IF(G${recTotalRow}-G${depTotalRow}>0,"EXCEDENT : Finances saines, resultat positif sur le mois","DEFICIT : Attention, les depenses depassent les recettes ce mois-ci")` }
    ws.getCell(r, 1).font = font({ bold: true, size: 10, color: { argb: C.navy } })
    ws.getCell(r, 1).fill = fill(C.lightGold)
    ws.getCell(r, 1).alignment = { horizontal: 'center', vertical: 'middle' }
    ws.getCell(r, 1).border = thinBorder
    setRowHeight(ws, r, 24)
    r += 2

    // ── RAPPELS LÉGAUX ───────────────────────────────────────
    mergeAndStyle(ws, r, 1, COLS,
        'RAPPELS LEGAUX & COMPTABLES',
        C.navy, { bold: true, color: { argb: C.white }, size: 9 })
    setRowHeight(ws, r, 20)
    r++

    const rappels = [
        `TVA Benin 18% : Declaration mensuelle avant le 10 du mois suivant (DGI)`,
        `Numerotation sequentielle sans rupture ni doublon (Code General des Impots Art. 256)`,
        `Mentions obligatoires : IFU emetteur, IFU client (si assujetti), date, description, montant HT, TVA, TTC`,
        `Conservation des originaux : 10 ans minimum (Art. 36 Livre de Procedures Fiscales)`,
        `Facture obligatoire des 10 000 FCFA (Art. 256 CGI) : En dessous, ticket de caisse possible`,
    ]
    rappels.forEach(txt => {
        ws.mergeCells(r, 1, r, COLS)
        ws.getCell(r, 1).value = `  • ${txt}`
        ws.getCell(r, 1).font = font({ size: 8, color: { argb: C.gray } })
        ws.getCell(r, 1).alignment = { vertical: 'middle', wrapText: true }
        setRowHeight(ws, r, 14)
        r++
    })

    // Print setup
    ws.pageSetup.printTitlesRow = `1:${SEC1_HEADER}`
    ws.headerFooter.oddHeader = `&C&B&10&K0D2B4E${COMPANY.name} : Registre ${moisLabel}`
    ws.headerFooter.oddFooter = `&L&8&KBBBBBBCONFIDENTIEL&C&8Genere le ${new Date().toLocaleDateString('fr-FR')}&R&8Page &P / &N`

    return { recTotalRow, depTotalRow }
}

// ═══════════════════════════════════════════════════════════════
// Main export function
// ═══════════════════════════════════════════════════════════════
export async function exportRegistreComptable(opts: RegistreOptions) {
    const wb = new ExcelJS.Workbook()
    wb.creator = COMPANY.name
    wb.created = new Date()

    // Logo on cover (lazy import)
    try {
        const { LOGO_BASE64 } = await import('@/lib/logoBase64')
        if (LOGO_BASE64) {
            wb.addImage({ base64: LOGO_BASE64, extension: 'png' })
        }
    } catch { /* logo indisponible */ }

    buildMonthSheet(wb, opts)

    const buffer = await wb.xlsx.writeBuffer()
    saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${opts.filename}.xlsx`)
}
