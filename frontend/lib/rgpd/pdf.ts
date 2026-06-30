// ══════════════════════════════════════════════════════════════
// RGPD — Génération PDF avec l'en-tête institutionnel Retour Gagnant Bénin
// (logo, bande tricolore béninoise, palette Nexus Emerald, pied de page).
// ══════════════════════════════════════════════════════════════

import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { RgpdDoc, Block } from './content'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.retourgagnantbenin.bj'

// Palette
const EMERALD = '#10B981'
const EMERALD_DARK = '#047857'
const GOLD = '#C9A84C'
const NAVY = '#1a2332'
const MUTED = '#718096'
const SOFT = '#F8FAF9'
const FLAG_GREEN = '#008751'
const FLAG_YELLOW = '#FCD116'
const FLAG_RED = '#E8112D'

const COMPANY = 'Retour Gagnant Bénin'
const CONTACT_LINE = 'contact@retourgagnantbenin.bj   ·   www.retourgagnantbenin.bj   ·   +229 01 60 32 21 21'

async function loadLogoDataUrl(): Promise<string | null> {
    try {
        const res = await fetch(`${SITE_URL}/logo.jpg`)
        if (!res.ok) return null
        const buf = Buffer.from(await res.arrayBuffer())
        return `data:image/jpeg;base64,${buf.toString('base64')}`
    } catch {
        return null
    }
}

export async function generateRgpdPdf(doc: RgpdDoc): Promise<ArrayBuffer> {
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
    const pageW = pdf.internal.pageSize.getWidth()
    const pageH = pdf.internal.pageSize.getHeight()
    const margin = 16
    const contentW = pageW - margin * 2
    const logo = await loadLogoDataUrl()

    // ── En-tête de page ──
    const drawHeader = () => {
        // bande tricolore en haut
        pdf.setFillColor(FLAG_GREEN); pdf.rect(0, 0, pageW / 3, 4, 'F')
        pdf.setFillColor(FLAG_YELLOW); pdf.rect(pageW / 3, 0, pageW / 3, 4, 'F')
        pdf.setFillColor(FLAG_RED); pdf.rect((pageW / 3) * 2, 0, pageW / 3, 4, 'F')
        // logo
        if (logo) { try { pdf.addImage(logo, 'JPEG', margin, 9, 14, 14) } catch { /* ignore */ } }
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11); pdf.setTextColor(NAVY)
        pdf.text(COMPANY, logo ? margin + 18 : margin, 15)
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5); pdf.setTextColor(MUTED)
        pdf.text('Accompagnement de la diaspora · Cotonou, Bénin', logo ? margin + 18 : margin, 20)
        pdf.setDrawColor(GOLD); pdf.setLineWidth(0.4); pdf.line(margin, 26, pageW - margin, 26)
    }

    // ── Pied de page ──
    const drawFooter = (pageNum: number) => {
        pdf.setDrawColor(230); pdf.setLineWidth(0.2); pdf.line(margin, pageH - 14, pageW - margin, pageH - 14)
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6.5); pdf.setTextColor(MUTED)
        pdf.text(CONTACT_LINE, pageW / 2, pageH - 10, { align: 'center' })
        if (doc.confidential) {
            pdf.setTextColor(FLAG_RED); pdf.text('CONFIDENTIEL — Usage interne', margin, pageH - 6)
        }
        pdf.setTextColor(MUTED); pdf.text(`Page ${pageNum}`, pageW - margin, pageH - 6, { align: 'right' })
    }

    let page = 1
    drawHeader()
    let y = 36

    // ── Titre du document ──
    pdf.setFillColor(SOFT); pdf.roundedRect(margin, y, contentW, 22, 2, 2, 'F')
    pdf.setFillColor(EMERALD); pdf.rect(margin, y, 1.5, 22, 'F')
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(15); pdf.setTextColor(EMERALD_DARK)
    pdf.text(doc.title, margin + 6, y + 9)
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.5); pdf.setTextColor(MUTED)
    pdf.text(pdf.splitTextToSize(doc.subtitle, contentW - 12), margin + 6, y + 15)
    y += 28

    const ensureSpace = (needed: number) => {
        if (y + needed > pageH - 18) {
            drawFooter(page); pdf.addPage(); page++; drawHeader(); y = 36
        }
    }

    // ── Rendu des blocs ──
    for (const block of doc.blocks as Block[]) {
        if (block.type === 'h2') {
            ensureSpace(12)
            y += 2
            pdf.setFillColor(EMERALD); pdf.circle(margin + 1.2, y - 1.4, 1.2, 'F')
            pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11); pdf.setTextColor(NAVY)
            pdf.text(block.text, margin + 5, y)
            y += 6
        } else if (block.type === 'p') {
            const lines = pdf.splitTextToSize(block.text, contentW)
            ensureSpace(lines.length * 4.6 + 2)
            pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9.5); pdf.setTextColor(NAVY)
            pdf.text(lines, margin, y)
            y += lines.length * 4.6 + 3
        } else if (block.type === 'list') {
            pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9.5); pdf.setTextColor(NAVY)
            for (const item of block.items) {
                const lines = pdf.splitTextToSize(item, contentW - 6)
                ensureSpace(lines.length * 4.6 + 1)
                pdf.setFillColor(GOLD); pdf.circle(margin + 1.4, y - 1.3, 0.7, 'F')
                pdf.text(lines, margin + 5, y)
                y += lines.length * 4.6 + 1.5
            }
            y += 2
        } else if (block.type === 'note') {
            const lines = pdf.splitTextToSize(block.text, contentW - 10)
            const h = lines.length * 4.4 + 6
            ensureSpace(h + 2)
            pdf.setFillColor('#FFF8E7'); pdf.roundedRect(margin, y - 4, contentW, h, 1.5, 1.5, 'F')
            pdf.setFillColor(GOLD); pdf.rect(margin, y - 4, 1.5, h, 'F')
            pdf.setFont('helvetica', 'italic'); pdf.setFontSize(8.5); pdf.setTextColor('#7A5C12')
            pdf.text(lines, margin + 5, y + 1)
            y += h
        } else if (block.type === 'table') {
            ensureSpace(20)
            autoTable(pdf, {
                startY: y,
                head: [block.head],
                body: block.rows,
                margin: { left: margin, right: margin },
                styles: { fontSize: 8, cellPadding: 2, textColor: NAVY, lineColor: '#E2E8F0', lineWidth: 0.1 },
                headStyles: { fillColor: EMERALD_DARK, textColor: '#FFFFFF', fontStyle: 'bold', fontSize: 8 },
                alternateRowStyles: { fillColor: SOFT },
                didDrawPage: () => { /* autoTable gère la pagination interne */ },
            })
            // @ts-expect-error lastAutoTable est injecté par le plugin
            y = (pdf.lastAutoTable?.finalY || y) + 5
            page = pdf.getNumberOfPages()
        }
    }

    // pied de page sur toutes les pages
    const total = pdf.getNumberOfPages()
    for (let i = 1; i <= total; i++) { pdf.setPage(i); drawFooter(i) }

    // date de génération
    pdf.setPage(total)
    pdf.setFont('helvetica', 'italic'); pdf.setFontSize(7); pdf.setTextColor(MUTED)
    pdf.text(`Document généré le ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}`, margin, pageH - 6 + 0)

    return pdf.output('arraybuffer') as ArrayBuffer
}
