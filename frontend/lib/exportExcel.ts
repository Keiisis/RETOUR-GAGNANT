import * as ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import { companyHeaderLines } from '@/lib/company'

type CellType = 'text' | 'currency' | 'number' | 'date' | 'percent' | 'status'

interface ColumnConfig {
  header: string
  key: string
  width?: number
  type?: CellType
  totalFormula?: 'sum' | 'count' | 'avg'
  group?: string
}

interface SheetConfig {
  sheetName: string
  columns: ColumnConfig[]
  data: Record<string, unknown>[]
  title?: string
  subtitle?: string
  summary?: { label: string; value: string | number; type?: CellType }[]
  legalHeader?: boolean
  totalRow?: boolean
}

interface ExportOptions {
  filename: string
  sheetName: string
  columns: ColumnConfig[]
  data: Record<string, unknown>[]
  title?: string
  subtitle?: string
  legalHeader?: boolean
  totalRow?: boolean
}

interface DashboardKpi {
  label: string
  value: number
  type?: CellType
  detail?: string
  tone?: 'good' | 'warn' | 'bad' | 'neutral' | 'accent'
}

interface MultiSheetOptions {
  filename: string
  sheets: SheetConfig[]
  coverTitle?: string
  coverSubtitle?: string
  coverPeriod?: string
  dashboard?: {
    title?: string
    subtitle?: string
    kpis: DashboardKpi[]
  }
}

const COLOR_GOLD = 'FFC9A84C'
const COLOR_NAVY = 'FF1B2A4A'
const COLOR_GREEN_BJ = 'FF008751'
const COLOR_YELLOW_BJ = 'FFFCD116'
const COLOR_RED_BJ = 'FFE8112D'
const COLOR_IVORY = 'FFFAF8F4'
const COLOR_ROW_ALT = 'FFF5F0E8'
const COLOR_BORDER = 'FFD4C89C'
const COLOR_TEXT = 'FF1B2A4A'

function columnLetter(n: number): string {
  let s = ''
  while (n > 0) {
    const m = (n - 1) % 26
    s = String.fromCharCode(65 + m) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

function applyNumFmt(cell: ExcelJS.Cell, type?: CellType) {
  if (type === 'currency') {
    cell.numFmt = '#,##0" FCFA"'
    cell.alignment = { horizontal: 'right', vertical: 'middle', indent: 1 }
  } else if (type === 'number') {
    cell.numFmt = '#,##0'
    cell.alignment = { horizontal: 'right', vertical: 'middle', indent: 1 }
  } else if (type === 'date') {
    cell.numFmt = 'dd/mm/yyyy'
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
  } else if (type === 'percent') {
    cell.numFmt = '0.0%'
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
  }
}

function addTricoloreBand(worksheet: ExcelJS.Worksheet, row: number, lastCol: string) {
  const cols = lastCol.charCodeAt(0) - 64
  const third = Math.max(1, Math.floor(cols / 3))
  const bandRow = worksheet.getRow(row)
  bandRow.height = 4
  for (let i = 1; i <= cols; i++) {
    const cell = bandRow.getCell(i)
    let color = COLOR_GREEN_BJ
    if (i > third && i <= third * 2) color = COLOR_YELLOW_BJ
    else if (i > third * 2) color = COLOR_RED_BJ
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } }
  }
}

function buildSheet(worksheet: ExcelJS.Worksheet, cfg: SheetConfig) {
  const { columns, data, title, subtitle, summary, legalHeader, totalRow } = cfg
  const lastCol = columnLetter(columns.length)
  let currentRow = 1

  worksheet.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.4, right: 0.4, top: 0.7, bottom: 0.5, header: 0.3, footer: 0.3 },
    horizontalCentered: true,
    paperSize: 9, // A4
  }
  worksheet.headerFooter = {
    oddHeader: `&L&9&"Arial,Bold"&K${COLOR_NAVY.slice(2)}Retour Gagnant Bénin&R&9&KFF4B5563${cfg.sheetName || ''}`,
    oddFooter: '&L&8&I&KFF888888CONFIDENTIEL — Retour Gagnant Bénin&C&8&KFF4B5563Généré le &D à &T&R&8&KFF4B5563Page &P / &N',
  }

  if (legalHeader) {
    const lines = companyHeaderLines()
    lines.forEach((line, idx) => {
      worksheet.mergeCells(`A${currentRow}:${lastCol}${currentRow}`)
      const c = worksheet.getCell(`A${currentRow}`)
      c.value = line
      if (idx === 0) {
        c.font = { name: 'Arial', size: 14, bold: true, color: { argb: COLOR_NAVY } }
        worksheet.getRow(currentRow).height = 22
      } else {
        c.font = { name: 'Arial', size: 9, color: { argb: 'FF4B5563' } }
        worksheet.getRow(currentRow).height = 14
      }
      c.alignment = { vertical: 'middle', horizontal: 'center' }
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_IVORY } }
      currentRow++
    })
    addTricoloreBand(worksheet, currentRow, lastCol)
    currentRow++
  }

  if (title) {
    worksheet.mergeCells(`A${currentRow}:${lastCol}${currentRow}`)
    const c = worksheet.getCell(`A${currentRow}`)
    c.value = title.toUpperCase()
    c.font = { name: 'Arial', size: 15, bold: true, color: { argb: 'FFFFFFFF' } }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_NAVY } }
    c.alignment = { vertical: 'middle', horizontal: 'center' }
    c.border = { bottom: { style: 'medium', color: { argb: COLOR_GOLD } } }
    worksheet.getRow(currentRow).height = 32
    currentRow++
  }

  if (subtitle) {
    worksheet.mergeCells(`A${currentRow}:${lastCol}${currentRow}`)
    const c = worksheet.getCell(`A${currentRow}`)
    c.value = subtitle
    c.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF4B5563' } }
    c.alignment = { vertical: 'middle', horizontal: 'center' }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_IVORY } }
    worksheet.getRow(currentRow).height = 20
    currentRow += 2
  }

  // Largeurs de colonnes (sans forcer les headers — on les écrit nous-mêmes)
  columns.forEach((col, i) => {
    worksheet.getColumn(i + 1).width = col.width || 20
  })

  // Super-headers groupés (ex: HT / TVA / TTC)
  const hasGroups = columns.some(c => c.group)
  if (hasGroups) {
    const groupRow = worksheet.getRow(currentRow)
    groupRow.height = 22
    let i = 0
    while (i < columns.length) {
      const grp = columns[i].group
      if (!grp) {
        groupRow.getCell(i + 1).value = ''
        groupRow.getCell(i + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_IVORY } }
        i++
        continue
      }
      let j = i
      while (j < columns.length && columns[j].group === grp) j++
      const span = j - i
      const cell = groupRow.getCell(i + 1)
      if (span > 1) {
        worksheet.mergeCells(currentRow, i + 1, currentRow, j)
      }
      cell.value = grp
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_GOLD } }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = {
        top: { style: 'thin', color: { argb: COLOR_BORDER } },
        left: { style: 'thin', color: { argb: COLOR_BORDER } },
        right: { style: 'thin', color: { argb: COLOR_BORDER } },
        bottom: { style: 'thin', color: { argb: COLOR_BORDER } },
      }
      i = j
    }
    currentRow++
  }

  // Header row (noms de colonnes)
  const headerRowNum = currentRow
  const headerRow = worksheet.getRow(headerRowNum)
  headerRow.height = 28
  columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1)
    cell.value = col.header
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_NAVY } }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = {
      top: { style: 'medium', color: { argb: COLOR_GOLD } },
      bottom: { style: 'medium', color: { argb: COLOR_GOLD } },
      left: { style: 'thin', color: { argb: COLOR_BORDER } },
      right: { style: 'thin', color: { argb: COLOR_BORDER } },
    }
  })
  worksheet.autoFilter = `A${headerRowNum}:${lastCol}${headerRowNum}`
  worksheet.views = [{ state: 'frozen', ySplit: headerRowNum, xSplit: 1 }]
  // Répéter toutes les lignes d'en-tête (légale + titre + super-headers + headers) sur chaque page imprimée
  worksheet.pageSetup.printTitlesRow = `1:${headerRowNum}`
  currentRow++

  const dataStartRow = currentRow
  data.forEach((row, index) => {
    const dataRow = worksheet.getRow(currentRow)
    dataRow.height = 20
    const rowColor = index % 2 === 0 ? 'FFFFFFFF' : COLOR_ROW_ALT
    columns.forEach((col, i) => {
      const cell = dataRow.getCell(i + 1)
      cell.value = row[col.key] as ExcelJS.CellValue
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowColor } }
      cell.font = { name: 'Arial', size: 10, color: { argb: COLOR_TEXT } }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      }
      cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1, wrapText: true }
      applyNumFmt(cell, col.type)
      if (col.type === 'currency' || col.type === 'number') {
        const num = Number(cell.value)
        if (!isNaN(num) && num < 0) {
          cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: COLOR_RED_BJ } }
        }
      }
      if (col.type === 'status') {
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        const val = String(cell.value ?? '').toLowerCase()
        let bg = 'FFF3F4F6'; let fg = COLOR_TEXT
        if (val.includes('termin') || val.includes('payé') || val.includes('paye') || val.includes('succès') || val.includes('accept') || val.includes('soldé') || val.includes('complet') || val === 'livré' || val === 'livre' || val.includes('entrée') || val.includes('entree')) {
          bg = 'FFDCFCE7'; fg = 'FF15803D'
        } else if (val.includes('cours') || val.includes('attente') || val.includes('envoy') || val.includes('traitement') || val.includes('brouillon')) {
          bg = 'FFFEF3C7'; fg = 'FFB45309'
        } else if (val.includes('annul') || val.includes('retard') || val.includes('refus') || val.includes('impay') || val.includes('échou') || val.includes('echou') || val.includes('sortie')) {
          bg = 'FFFEE2E2'; fg = COLOR_RED_BJ
        } else if (val.includes('virement') || val.includes('espèces') || val.includes('especes') || val.includes('mobile') || val.includes('carte') || val.includes('chèque') || val.includes('cheque')) {
          bg = 'FFDBEAFE'; fg = 'FF1E3A8A'
        }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
        cell.font = { bold: true, name: 'Arial', size: 10, color: { argb: fg } }
      }
    })
    currentRow++
  })
  const dataEndRow = currentRow - 1

  // Data bars visuels sur les colonnes currency avec total (facilite lecture par le comptable)
  if (data.length > 0) {
    columns.forEach((col, i) => {
      if (col.totalFormula === 'sum' && col.type === 'currency') {
        const colL = columnLetter(i + 1)
        worksheet.addConditionalFormatting({
          ref: `${colL}${dataStartRow}:${colL}${dataEndRow}`,
          rules: [{
            type: 'dataBar',
            priority: 1,
            minLength: 0,
            maxLength: 100,
            gradient: true,
            cfvo: [{ type: 'min' }, { type: 'max' }],
            // ExcelJS accepte `color` pour DataBar au runtime, typage manquant dans @types
            ...({ color: { argb: COLOR_GOLD } } as Record<string, unknown>),
          }],
        })
      }
    })
  }

  // Ligne TOTAL avec formules Excel
  if (totalRow && data.length > 0) {
    const totalRowObj = worksheet.getRow(currentRow)
    totalRowObj.height = 28
    let labelled = false
    columns.forEach((col, i) => {
      const cell = totalRowObj.getCell(i + 1)
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_GOLD } }
      cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: COLOR_NAVY } }
      cell.border = {
        top: { style: 'medium', color: { argb: COLOR_NAVY } },
        bottom: { style: 'medium', color: { argb: COLOR_NAVY } },
        left: { style: 'thin', color: { argb: COLOR_BORDER } },
        right: { style: 'thin', color: { argb: COLOR_BORDER } },
      }
      if (!labelled && !col.totalFormula) {
        cell.value = 'TOTAL'
        cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
        labelled = true
      } else if (col.totalFormula) {
        const colL = columnLetter(i + 1)
        const fnMap = { sum: 9, count: 3, avg: 1 }
        const fn = fnMap[col.totalFormula]
        cell.value = { formula: `SUBTOTAL(${fn},${colL}${dataStartRow}:${colL}${dataEndRow})` } as ExcelJS.CellFormulaValue
        applyNumFmt(cell, col.type)
        cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: COLOR_NAVY } }
      } else {
        cell.value = ''
      }
    })
    currentRow++
  }

  // Summary (en-dessous, séparé)
  if (summary && summary.length) {
    currentRow++
    summary.forEach(s => {
      const r = worksheet.getRow(currentRow)
      r.height = 22
      const labelCell = r.getCell(1)
      const valueCell = r.getCell(2)
      if (columns.length > 1) worksheet.mergeCells(currentRow, 1, currentRow, Math.max(1, columns.length - 1))
      labelCell.value = s.label
      labelCell.font = { name: 'Arial', size: 11, bold: true, color: { argb: COLOR_NAVY } }
      labelCell.alignment = { horizontal: 'right', vertical: 'middle', indent: 1 }
      labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_IVORY } }
      const valCol = columns.length > 1 ? columns.length : 2
      const finalValueCell = r.getCell(valCol)
      finalValueCell.value = s.value
      finalValueCell.font = { name: 'Arial', size: 11, bold: true, color: { argb: COLOR_GREEN_BJ } }
      finalValueCell.alignment = { horizontal: 'right', vertical: 'middle', indent: 1 }
      finalValueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_IVORY } }
      applyNumFmt(finalValueCell, s.type)
      currentRow++
    })
  }
}

async function addCoverSheet(wb: ExcelJS.Workbook, opts: { title: string; subtitle?: string; period?: string }) {
  const ws = wb.addWorksheet('Couverture', {
    pageSetup: { orientation: 'portrait', fitToPage: true, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 } },
  })
  for (let i = 1; i <= 10; i++) ws.getColumn(i).width = 12

  let r = 1
  // Bandeau tricolore haut
  addTricoloreBand(ws, r, 'J')
  r++

  // Logo RGB (lazy import — évite de bundler 1.4MB dans les routes qui n'exportent pas)
  try {
    const { LOGO_BASE64 } = await import('@/lib/logoBase64')
    const imgId = wb.addImage({ base64: LOGO_BASE64, extension: 'png' })
    ws.getRow(r).height = 12
    r++
    ws.addImage(imgId, {
      tl: { col: 3.5, row: r - 1 },
      ext: { width: 180, height: 180 },
      editAs: 'oneCell',
    })
    // réserve la hauteur visuelle du logo (6 lignes de ~30px)
    for (let k = 0; k < 6; k++) ws.getRow(r + k).height = 30
    r += 6
  } catch {
    // logo indisponible — on continue sans bloquer l'export
  }

  r++
  ws.mergeCells(`A${r}:J${r}`)
  const legalTop = ws.getCell(`A${r}`)
  legalTop.value = 'RETOUR GAGNANT BÉNIN'
  legalTop.font = { name: 'Arial', size: 26, bold: true, color: { argb: COLOR_NAVY } }
  legalTop.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(r).height = 44
  r++

  const legals = companyHeaderLines().slice(1)
  legals.forEach(l => {
    ws.mergeCells(`A${r}:J${r}`)
    const c = ws.getCell(`A${r}`)
    c.value = l
    c.font = { name: 'Arial', size: 10, color: { argb: 'FF4B5563' } }
    c.alignment = { horizontal: 'center', vertical: 'middle' }
    ws.getRow(r).height = 18
    r++
  })

  r += 2
  ws.mergeCells(`A${r}:J${r}`)
  const title = ws.getCell(`A${r}`)
  title.value = opts.title.toUpperCase()
  title.font = { name: 'Arial', size: 22, bold: true, color: { argb: 'FFFFFFFF' } }
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_NAVY } }
  title.alignment = { horizontal: 'center', vertical: 'middle' }
  title.border = { bottom: { style: 'medium', color: { argb: COLOR_GOLD } } }
  ws.getRow(r).height = 50
  r++

  if (opts.period) {
    ws.mergeCells(`A${r}:J${r}`)
    const p = ws.getCell(`A${r}`)
    p.value = opts.period
    p.font = { name: 'Arial', size: 14, bold: true, color: { argb: COLOR_GOLD } }
    p.alignment = { horizontal: 'center', vertical: 'middle' }
    p.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_IVORY } }
    ws.getRow(r).height = 28
    r++
  }

  if (opts.subtitle) {
    ws.mergeCells(`A${r}:J${r}`)
    const s = ws.getCell(`A${r}`)
    s.value = opts.subtitle
    s.font = { name: 'Arial', size: 11, italic: true, color: { argb: 'FF4B5563' } }
    s.alignment = { horizontal: 'center', vertical: 'middle' }
    s.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_IVORY } }
    ws.getRow(r).height = 22
    r++
  }

  r += 3
  ws.mergeCells(`A${r}:J${r}`)
  const meta = ws.getCell(`A${r}`)
  meta.value = `Document généré le ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
  meta.font = { name: 'Arial', size: 10, color: { argb: 'FF4B5563' } }
  meta.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(r).height = 18
  r += 4

  // Zones signature
  const sigStart = r
  ws.mergeCells(`B${r}:D${r}`)
  ws.mergeCells(`G${r}:I${r}`)
  ws.getCell(`B${r}`).value = 'Préparé par'
  ws.getCell(`G${r}`).value = 'Validé par le comptable'
  ;[ws.getCell(`B${r}`), ws.getCell(`G${r}`)].forEach(c => {
    c.font = { name: 'Arial', size: 10, bold: true, color: { argb: COLOR_NAVY } }
    c.alignment = { horizontal: 'center', vertical: 'middle' }
  })
  r++
  // Cadre signature
  ;['B', 'G'].forEach(startCol => {
    const endCol = startCol === 'B' ? 'D' : 'I'
    for (let i = 0; i < 4; i++) {
      ws.mergeCells(`${startCol}${r + i}:${endCol}${r + i}`)
      const c = ws.getCell(`${startCol}${r + i}`)
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }
      c.border = {
        top: i === 0 ? { style: 'medium', color: { argb: COLOR_NAVY } } : undefined,
        bottom: i === 3 ? { style: 'medium', color: { argb: COLOR_NAVY } } : undefined,
        left: { style: 'medium', color: { argb: COLOR_NAVY } },
        right: { style: 'medium', color: { argb: COLOR_NAVY } },
      }
      ws.getRow(r + i).height = 22
    }
  })
  void sigStart
  r += 6

  // Bandeau bas tricolore
  addTricoloreBand(ws, r, 'J')
}

function addDashboardSheet(wb: ExcelJS.Workbook, dash: NonNullable<MultiSheetOptions['dashboard']>) {
  const ws = wb.addWorksheet('Dashboard', {
    pageSetup: { orientation: 'landscape', fitToPage: true, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 }, paperSize: 9 },
  })
  ws.headerFooter = {
    oddFooter: '&L&8&I&KFF888888CONFIDENTIEL — Retour Gagnant Bénin&C&8&KFF4B5563Dashboard synthétique&R&8&KFF4B5563Page &P / &N',
  }
  const cols = 10
  for (let i = 1; i <= cols; i++) ws.getColumn(i).width = 14

  let r = 1
  addTricoloreBand(ws, r, 'J'); r++

  // Titre
  ws.mergeCells(`A${r}:J${r}`)
  const t = ws.getCell(`A${r}`)
  t.value = (dash.title || 'DASHBOARD COMPTABLE').toUpperCase()
  t.font = { name: 'Arial', size: 18, bold: true, color: { argb: 'FFFFFFFF' } }
  t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_NAVY } }
  t.alignment = { horizontal: 'center', vertical: 'middle' }
  t.border = { bottom: { style: 'medium', color: { argb: COLOR_GOLD } } }
  ws.getRow(r).height = 40; r++

  if (dash.subtitle) {
    ws.mergeCells(`A${r}:J${r}`)
    const s = ws.getCell(`A${r}`)
    s.value = dash.subtitle
    s.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF4B5563' } }
    s.alignment = { horizontal: 'center', vertical: 'middle' }
    s.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_IVORY } }
    ws.getRow(r).height = 20; r++
  }
  r++

  // Grille 2 colonnes × 5 KPI par ligne (on étale sur 2 colonnes Excel par carte)
  const COLS_PER_ROW = 2
  const CELLS_PER_CARD = 5 // carte = 5 colonnes Excel
  const toneStyles: Record<string, { bg: string; fg: string }> = {
    good:    { bg: 'FFDCFCE7', fg: 'FF15803D' },
    warn:    { bg: 'FFFEF3C7', fg: 'FFB45309' },
    bad:     { bg: 'FFFEE2E2', fg: COLOR_RED_BJ },
    accent:  { bg: 'FFFFF4D4', fg: COLOR_NAVY },
    neutral: { bg: 'FFFFFFFF', fg: COLOR_NAVY },
  }
  const formatValue = (v: number, type?: CellType) => {
    if (type === 'currency') return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(v) + ' FCFA'
    if (type === 'percent') return (v * 100).toFixed(1) + ' %'
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(v)
  }

  dash.kpis.forEach((k, idx) => {
    const col = (idx % COLS_PER_ROW) * CELLS_PER_CARD + 1
    if (idx % COLS_PER_ROW === 0 && idx !== 0) r += 5 // nouvelle rangée

    const toneKey = k.tone || 'neutral'
    const { bg, fg } = toneStyles[toneKey]
    const endCol = col + CELLS_PER_CARD - 2 // laisse 1 colonne d'espace entre cartes

    // Bande label
    ws.mergeCells(r, col, r, endCol)
    const labelCell = ws.getCell(r, col)
    labelCell.value = k.label.toUpperCase()
    labelCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: fg } }
    labelCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
    labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
    labelCell.border = { top: { style: 'medium', color: { argb: fg } }, left: { style: 'medium', color: { argb: fg } }, right: { style: 'medium', color: { argb: fg } } }
    ws.getRow(r).height = 22

    // Bande valeur
    ws.mergeCells(r + 1, col, r + 2, endCol)
    const valCell = ws.getCell(r + 1, col)
    valCell.value = formatValue(k.value, k.type)
    valCell.font = { name: 'Arial', size: 22, bold: true, color: { argb: fg } }
    valCell.alignment = { horizontal: 'center', vertical: 'middle' }
    valCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
    valCell.border = { left: { style: 'medium', color: { argb: fg } }, right: { style: 'medium', color: { argb: fg } } }
    ws.getRow(r + 1).height = 26
    ws.getRow(r + 2).height = 20

    // Détail
    ws.mergeCells(r + 3, col, r + 3, endCol)
    const dCell = ws.getCell(r + 3, col)
    dCell.value = k.detail || ''
    dCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF6B7280' } }
    dCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1, wrapText: true }
    dCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
    dCell.border = { bottom: { style: 'medium', color: { argb: fg } }, left: { style: 'medium', color: { argb: fg } }, right: { style: 'medium', color: { argb: fg } } }
    ws.getRow(r + 3).height = 24
  })

  r += 6
  addTricoloreBand(ws, r, 'J')
}

export async function exportToExcelMultiSheet({ filename, sheets, coverTitle, coverSubtitle, coverPeriod, dashboard }: MultiSheetOptions) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Retour Gagnant Bénin — Comptabilité'
  workbook.lastModifiedBy = 'Retour Gagnant Bénin'
  workbook.created = new Date()
  workbook.company = 'Retour Gagnant Bénin'

  if (coverTitle) {
    await addCoverSheet(workbook, { title: coverTitle, subtitle: coverSubtitle, period: coverPeriod })
  }
  if (dashboard) {
    addDashboardSheet(workbook, dashboard)
  }

  sheets.forEach(sheet => {
    const ws = workbook.addWorksheet(sheet.sheetName)
    buildSheet(ws, sheet)
  })

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  saveAs(blob, `${filename}.xlsx`)
}

export async function exportToExcel({ filename, sheetName, columns, data, title, subtitle, legalHeader, totalRow }: ExportOptions) {
  await exportToExcelMultiSheet({
    filename,
    sheets: [{ sheetName, columns, data, title, subtitle, legalHeader, totalRow }],
  })
}
