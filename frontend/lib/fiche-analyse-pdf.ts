import { jsPDF } from 'jspdf'
import { LOGO_BASE64 } from './logoBase64'

/* ══════════════════════════════════════════════════════════════════
   FICHE D'ANALYSE DE DOSSIER — nationalité béninoise

   Document officiel envoyé au client pour lui indiquer les pièces à
   régulariser. Mise en page pro : bandeau vert profond (charte), liseré
   tricolore, encadrés, tableau des pièces avec pastilles de statut
   colorées, section « prochaines étapes ». Génère du PDF (base64).
══════════════════════════════════════════════════════════════════ */

export interface FichePiece {
    /** Nom de la pièce (« Casier judiciaire »). */
    document: string
    /** Statut (« Format Photo », « Non conforme », « Illisible », « Manquant », « Absent »…). */
    statut: string
    /** Motif / exigence de mise en conformité. */
    motif: string
    /** Colonne « lien de filiation » (fiches généalogiques). Optionnel. */
    filiation?: string
}

export interface FicheBox {
    title: string
    body: string
    tone?: 'blue' | 'yellow'
}

export interface FicheAnalyseData {
    clientName: string
    civilite?: string          // « M. » / « Mme »
    date: string               // « 3 août 2026 »
    objet: string
    gestionnaire?: string
    statutBadge: string        // badge rouge en tête (« NON CONFORME - ACTION REQUISE »)
    formatWarning?: string | null
    diagnostic: string
    piecesTitle?: string
    piecesColMode?: 'motif' | 'filiation'   // 3e colonne : motif (défaut) ou filiation
    pieces: FichePiece[]
    nextStepsTitle?: string
    nextStepsIntro?: string
    nextStepsBoxes?: FicheBox[]
    /** Encadré final épinglé (« Prochaine étape : … »). */
    finalNote?: string | null
}

// Palette (charte Bénin, ton professionnel)
const CO = {
    headerBg: [15, 42, 30] as [number, number, number],   // vert profond ~#0F2A1E
    green: [0, 135, 81] as [number, number, number],
    greenDeep: [0, 100, 60] as [number, number, number],
    yellow: [252, 209, 22] as [number, number, number],
    red: [232, 17, 45] as [number, number, number],
    orange: [200, 90, 20] as [number, number, number],
    ink: [45, 45, 45] as [number, number, number],
    inkMuted: [90, 90, 90] as [number, number, number],
    inkFaint: [140, 140, 140] as [number, number, number],
    line: [225, 228, 226] as [number, number, number],
    boxBg: [248, 249, 248] as [number, number, number],
    headerLight: [241, 248, 244] as [number, number, number],  // vert très clair (en-tête)
    grey: [120, 120, 120] as [number, number, number],
}

// Couleur du badge de statut selon le mot-clé.
function badgeColor(statut: string): [number, number, number] {
    const s = statut.toLowerCase()
    if (s.includes('complet')) return CO.green
    if (s.includes('non conforme')) return CO.red
    if (s.includes('incomplet')) return CO.orange
    if (s.includes('requise') || s.includes('action')) return CO.red
    return [90, 100, 96]
}

// Conserve les accents français (Latin-1) ; ne neutralise que les caractères
// hors cp1252 que les polices de base jsPDF ne savent pas rendre.
const safe = (t: string): string =>
    (t || '')
        .replace(/[—–]/g, '-')
        .replace(/['']/g, "'")
        .replace(/[""]/g, '"')
        .replace(/…/g, '...')
        .replace(/[✓✔]/g, 'OK')
        .replace(/[•·]/g, '-')
        .replace(/[→▶]/g, '>')

// Pastille de statut → couleur selon le mot-clé.
function statutColor(statut: string): [number, number, number] {
    const s = statut.toLowerCase()
    if (s.includes('conforme') && !s.includes('non')) return CO.green
    if (s.includes('non conforme')) return CO.red
    if (s.includes('photo')) return CO.orange
    if (s.includes('illisible')) return CO.orange
    if (s.includes('manquant') || s.includes('absent')) return CO.red
    return CO.inkMuted
}

export function generateFicheAnalysePdf(data: FicheAnalyseData): string {
    const pdf = new jsPDF('p', 'mm', 'a4')
    const PW = 210, PH = 297, ML = 15, MR = 15, CW = PW - ML - MR
    let page = 1

    const footer = () => {
        pdf.setDrawColor(...CO.line); pdf.setLineWidth(0.3)
        pdf.line(ML, PH - 14, PW - MR, PH - 14)
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5); pdf.setTextColor(...CO.inkFaint)
        pdf.text('RGB - Cabinet & Agence specialisee', ML, PH - 9)
        pdf.text(`Page ${page}`, PW - MR, PH - 9, { align: 'right' })
    }

    const ensure = (need: number, y: number): number => {
        if (y + need > PH - 20) { footer(); pdf.addPage(); page++; return 20 }
        return y
    }

    // ── EN-TÊTE CLAIR (vert très pâle, plus de fond sombre) ─────────
    const headH = 28
    pdf.setFillColor(...CO.headerLight)
    pdf.rect(0, 0, PW, headH, 'F')
    try { pdf.addImage(LOGO_BASE64, 'PNG', ML, 5, 18, 18) } catch { /* logo absent */ }
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(20)
    pdf.setTextColor(...CO.greenDeep)
    pdf.text('AGENCE ', ML + 22, 13)
    const aw = pdf.getTextWidth('AGENCE ')
    pdf.setTextColor(...CO.red)
    pdf.text('RGB', ML + 22 + aw, 13)
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(...CO.grey)
    pdf.text(safe("FICHE D'ANALYSE DE DOSSIER CLIENT"), ML + 22, 19.5)
    // Badge statut (coloré selon le statut) à droite
    if (data.statutBadge) {
        const bc = badgeColor(data.statutBadge)
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8.5)
        const bw = pdf.getTextWidth(safe(data.statutBadge)) + 12
        pdf.setFillColor(...bc)
        pdf.roundedRect(PW - MR - bw, 8.5, bw, 9, 2, 2, 'F')
        pdf.setTextColor(255, 255, 255)
        pdf.text(safe(data.statutBadge), PW - MR - bw / 2, 14.3, { align: 'center' })
    }
    // Filet gris + liseré tricolore
    pdf.setDrawColor(...CO.line); pdf.setLineWidth(0.3); pdf.line(0, headH, PW, headH)
    pdf.setFillColor(...CO.green); pdf.rect(0, headH, PW / 3, 1.8, 'F')
    pdf.setFillColor(...CO.yellow); pdf.rect(PW / 3, headH, PW / 3, 1.8, 'F')
    pdf.setFillColor(...CO.red); pdf.rect((PW * 2) / 3, headH, PW / 3, 1.8, 'F')

    let y = headH + 11

    // ── BLOC INFOS CLIENT ───────────────────────────────────────────
    const infoH = 24
    pdf.setFillColor(...CO.boxBg); pdf.setDrawColor(...CO.line); pdf.setLineWidth(0.3)
    pdf.roundedRect(ML, y, CW, infoH, 2, 2, 'FD')
    const colL = ML + 5, colR = ML + CW / 2 + 3
    const nom = `${data.civilite ? data.civilite + ' ' : ''}${data.clientName}`
    const kv = (x: number, ky: number, k: string, v: string) => {
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8); pdf.setTextColor(...CO.inkMuted)
        pdf.text(safe(k), x, ky)
        pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...CO.ink)
        const lines = pdf.splitTextToSize(safe(v), CW / 2 - 32)
        pdf.text(lines, x + 30, ky)
    }
    kv(colL, y + 7, 'Nom du Client :', nom)
    kv(colL, y + 16, 'Objet du dossier :', data.objet)
    kv(colR, y + 7, 'Date du diagnostic :', data.date)
    kv(colR, y + 16, 'Gestionnaire :', data.gestionnaire || 'Pole Instruction RGB')
    y += infoH + 7

    // ── ENCADRÉ EXIGENCE DE FORMAT (optionnel) ──────────────────────
    if (data.formatWarning) {
        const lines = pdf.splitTextToSize(safe(data.formatWarning), CW - 12)
        const h = lines.length * 4.3 + 8
        y = ensure(h, y)
        pdf.setFillColor(255, 249, 235); pdf.setDrawColor(...CO.yellow); pdf.setLineWidth(0.4)
        pdf.roundedRect(ML, y, CW, h, 2, 2, 'FD')
        pdf.setFillColor(...CO.yellow); pdf.rect(ML, y, 1.6, h, 'F')
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.5); pdf.setTextColor(120, 90, 10)
        pdf.text(lines, ML + 6, y + 6)
        y += h + 7
    }

    // ── SECTION 1 — DIAGNOSTIC ──────────────────────────────────────
    const heading = (num: string, title: string) => {
        y = ensure(14, y)
        pdf.setFillColor(...CO.green); pdf.rect(ML, y - 3.5, 1.8, 6, 'F')
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(12); pdf.setTextColor(...CO.headerBg)
        pdf.text(safe(`${num}. ${title}`), ML + 5, y + 1)
        y += 8
    }
    heading('1', 'DIAGNOSTIC GENERAL')
    {
        const lines = pdf.splitTextToSize(safe(data.diagnostic), CW - 12)
        const h = lines.length * 4.6 + 8
        y = ensure(h, y)
        pdf.setFillColor(...CO.boxBg); pdf.setDrawColor(...CO.line); pdf.setLineWidth(0.3)
        pdf.roundedRect(ML, y, CW, h, 2, 2, 'FD')
        pdf.setFillColor(...CO.red); pdf.rect(ML, y, 1.6, h, 'F')
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(...CO.ink)
        pdf.text(lines, ML + 6, y + 6)
        y += h + 8
    }

    // ── SECTION 2 — TABLEAU DES PIÈCES ──────────────────────────────
    heading('2', data.piecesTitle || 'DETAIL DES PIECES A REGULARISER')
    const useFiliation = data.piecesColMode === 'filiation'
    const cols = useFiliation
        ? [{ w: 58, label: "PIÈCE D'ÉTAT CIVIL REQUISE" }, { w: 84, label: 'LIEN DE FILIATION' }, { w: CW - 142, label: 'STATUT' }]
        : [{ w: 50, label: 'DOCUMENT' }, { w: 34, label: 'STATUT ACTUEL' }, { w: CW - 84, label: 'MOTIF & EXIGENCE' }]
    // En-tête tableau (multiligne, vert foncé, coins arrondis en haut)
    const headerLines = cols.map(c => pdf.splitTextToSize(safe(c.label), c.w - 5))
    const hh = Math.max(9, Math.max(...headerLines.map(l => l.length)) * 3.6 + 3.5)
    y = ensure(hh + 12, y)
    pdf.setFillColor(...CO.greenDeep); pdf.rect(ML, y, CW, hh, 'F')
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7.5); pdf.setTextColor(255, 255, 255)
    let cx = ML
    cols.forEach((c, ci) => {
        const startY = y + (hh - headerLines[ci].length * 3.6) / 2 + 3
        headerLines[ci].forEach((ln: string, li: number) => pdf.text(ln, cx + 2.5, startY + li * 3.6))
        cx += c.w
    })
    y += hh
    // Lignes
    data.pieces.forEach((p, i) => {
        const c0 = pdf.splitTextToSize(safe(p.document), cols[0].w - 4)
        const c2 = useFiliation ? [] : pdf.splitTextToSize(safe(p.motif), cols[2].w - 4)
        const c1fil = useFiliation ? pdf.splitTextToSize(safe(p.filiation || ''), cols[1].w - 4) : []
        const rowH = Math.max(11, c0.length * 4, c2.length * 4, c1fil.length * 4) + 4
        y = ensure(rowH, y)
        if (i % 2 === 1) { pdf.setFillColor(247, 250, 248); pdf.rect(ML, y, CW, rowH, 'F') }
        pdf.setDrawColor(...CO.line); pdf.setLineWidth(0.2); pdf.line(ML, y + rowH, ML + CW, y + rowH)
        // Col 1 : nom pièce (gras)
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8.5); pdf.setTextColor(...CO.ink)
        pdf.text(c0, ML + 3, y + 5.5)
        if (useFiliation) {
            pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.5); pdf.setTextColor(...CO.inkMuted)
            pdf.text(c1fil, ML + cols[0].w + 3, y + 5.5)
            drawBadge(pdf, p.statut, ML + cols[0].w + cols[1].w + 3, y + rowH / 2 - 2.2)
        } else {
            drawBadge(pdf, p.statut, ML + cols[0].w + 3, y + rowH / 2 - 2.2)
            pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.5); pdf.setTextColor(...CO.inkMuted)
            pdf.text(c2, ML + cols[0].w + cols[1].w + 3, y + 5.5)
        }
        y += rowH
    })
    // Filet de clôture vert
    pdf.setDrawColor(...CO.green); pdf.setLineWidth(0.6); pdf.line(ML, y, ML + CW, y)
    y += 9

    // ── SECTION 3 — PROCHAINES ÉTAPES ───────────────────────────────
    if (data.nextStepsBoxes?.length || data.nextStepsIntro) {
        heading('3', data.nextStepsTitle || 'PROCHAINES ETAPES')
        if (data.nextStepsIntro) {
            const lines = pdf.splitTextToSize(safe(data.nextStepsIntro), CW - 2)
            y = ensure(lines.length * 4.6 + 3, y)
            pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(...CO.inkMuted)
            pdf.text(lines, ML, y + 3); y += lines.length * 4.6 + 6
        }
        const boxes = data.nextStepsBoxes || []
        if (boxes.length === 2) {
            const bw = (CW - 6) / 2
            const heights = boxes.map(b => {
                const l = pdf.splitTextToSize(safe(b.body), bw - 8)
                return l.length * 4.3 + 16
            })
            const h = Math.max(...heights)
            y = ensure(h, y)
            boxes.forEach((b, i) => {
                const bx = ML + i * (bw + 6)
                drawInfoBox(pdf, b, bx, y, bw, h)
            })
            y += h + 6
        } else {
            for (const b of boxes) {
                const l = pdf.splitTextToSize(safe(b.body), CW - 12)
                const h = l.length * 4.3 + 14
                y = ensure(h, y)
                drawInfoBox(pdf, b, ML, y, CW, h)
                y += h + 6
            }
        }
    }

    // ── ENCADRÉ FINAL ÉPINGLÉ ───────────────────────────────────────
    if (data.finalNote) {
        const label = 'Prochaine étape : '
        const body = safe(data.finalNote)
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9)
        const labelW = pdf.getTextWidth(label)
        // Première ligne : le reste du texte tient après le label (largeur réduite) ;
        // la suite passe en pleine largeur. Aucune troncature.
        const firstWrap = pdf.splitTextToSize(body, CW - 12 - labelW)
        const firstLine = firstWrap[0] || ''
        const remaining = body.substring(firstLine.length).trim()
        const restLines = remaining ? pdf.splitTextToSize(remaining, CW - 12) : []
        const totalLines = 1 + restLines.length
        const h = totalLines * 4.6 + 7
        y = ensure(h, y + 2)
        pdf.setFillColor(239, 246, 252); pdf.setDrawColor(70, 130, 190); pdf.setLineWidth(0.35)
        pdf.roundedRect(ML, y, CW, h, 2, 2, 'FD')
        pdf.setFillColor(...CO.red); pdf.rect(ML, y, 1.8, h, 'F')
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.setTextColor(30, 80, 130)
        pdf.text(label, ML + 6, y + 6)
        pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...CO.inkMuted)
        pdf.text(firstLine, ML + 6 + labelW, y + 6)
        if (restLines.length) pdf.text(restLines, ML + 6, y + 11)
        y += h + 6
    }

    footer()
    return Buffer.from(pdf.output('arraybuffer')).toString('base64')
}

// Pastille de statut : fond teinté clair + bordure + texte de la couleur.
function drawBadge(pdf: jsPDF, statut: string, x: number, y: number) {
    const col = statutColor(statut)
    // Teinte claire du même ton (mélange avec du blanc à ~88 %).
    const tint: [number, number, number] = [
        Math.round(col[0] + (255 - col[0]) * 0.88),
        Math.round(col[1] + (255 - col[1]) * 0.88),
        Math.round(col[2] + (255 - col[2]) * 0.88),
    ]
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7)
    const w = pdf.getTextWidth(safe(statut)) + 6
    pdf.setFillColor(...tint); pdf.setDrawColor(...col); pdf.setLineWidth(0.35)
    pdf.roundedRect(x, y, w, 5.4, 1.4, 1.4, 'FD')
    pdf.setTextColor(...col)
    pdf.text(safe(statut), x + w / 2, y + 3.6, { align: 'center' })
}

function drawInfoBox(pdf: jsPDF, b: FicheBox, x: number, y: number, w: number, h: number) {
    const tone = b.tone === 'yellow'
        ? { bg: [255, 250, 235] as [number, number, number], line: CO.yellow, title: [150, 110, 10] as [number, number, number] }
        : { bg: [239, 246, 252] as [number, number, number], line: [70, 130, 190] as [number, number, number], title: [30, 80, 130] as [number, number, number] }
    pdf.setFillColor(...tone.bg); pdf.setDrawColor(...tone.line); pdf.setLineWidth(0.35)
    pdf.roundedRect(x, y, w, h, 2, 2, 'FD')
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9.5); pdf.setTextColor(...tone.title)
    pdf.text(safe(b.title), x + 5, y + 7)
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.5); pdf.setTextColor(...CO.inkMuted)
    pdf.text(pdf.splitTextToSize(safe(b.body), w - 10), x + 5, y + 13)
}
