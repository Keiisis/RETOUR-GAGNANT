// ══════════════════════════════════════════════════════════════
// RGPD : Génération DOCX (Word) avec l'en-tête institutionnel RGB.
// Permet de compléter facilement les champs [entre crochets].
// ══════════════════════════════════════════════════════════════

import {
    Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
    Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
} from 'docx'
import type { RgpdDoc, Block } from './content'

const EMERALD = '047857'
const GOLD = 'A68B3C'
const NAVY = '1A2332'
const MUTED = '718096'
const SOFT = 'F8FAF9'

const COMPANY = 'Retour Gagnant Bénin'
const CONTACT_LINE = 'contact@retourgagnantbenin.bj  ·  www.retourgagnantbenin.bj  ·  +229 01 60 32 21 21'

function cell(text: string, opts: { header?: boolean } = {}): TableCell {
    return new TableCell({
        shading: opts.header
            ? { type: ShadingType.CLEAR, color: 'auto', fill: EMERALD }
            : { type: ShadingType.CLEAR, color: 'auto', fill: 'FFFFFF' },
        margins: { top: 60, bottom: 60, left: 90, right: 90 },
        children: [new Paragraph({
            children: [new TextRun({
                text: text || '-',
                bold: opts.header,
                color: opts.header ? 'FFFFFF' : NAVY,
                size: 17,
            })],
        })],
    })
}

function renderBlock(block: Block): (Paragraph | Table)[] {
    if (block.type === 'h2') {
        return [new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 240, after: 100 },
            children: [new TextRun({ text: block.text, bold: true, color: NAVY, size: 24 })],
        })]
    }
    if (block.type === 'p') {
        return [new Paragraph({
            spacing: { after: 120 },
            children: [new TextRun({ text: block.text, color: NAVY, size: 20 })],
        })]
    }
    if (block.type === 'list') {
        return block.items.map(item => new Paragraph({
            bullet: { level: 0 },
            spacing: { after: 60 },
            children: [new TextRun({ text: item, color: NAVY, size: 20 })],
        }))
    }
    if (block.type === 'note') {
        return [new Paragraph({
            spacing: { before: 120, after: 120 },
            shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'FFF8E7' },
            border: { left: { style: BorderStyle.SINGLE, size: 18, color: GOLD, space: 8 } },
            children: [new TextRun({ text: block.text, italics: true, color: '7A5C12', size: 19 })],
        })]
    }
    // table
    const rows: TableRow[] = []
    rows.push(new TableRow({ tableHeader: true, children: block.head.map(h => cell(h, { header: true })) }))
    for (const r of block.rows) rows.push(new TableRow({ children: r.map(c => cell(c)) }))
    return [new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows,
        borders: {
            top: { style: BorderStyle.SINGLE, size: 2, color: 'E2E8F0' },
            bottom: { style: BorderStyle.SINGLE, size: 2, color: 'E2E8F0' },
            left: { style: BorderStyle.SINGLE, size: 2, color: 'E2E8F0' },
            right: { style: BorderStyle.SINGLE, size: 2, color: 'E2E8F0' },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: 'E2E8F0' },
            insideVertical: { style: BorderStyle.SINGLE, size: 2, color: 'E2E8F0' },
        },
    })]
}

export async function generateRgpdDocx(doc: RgpdDoc): Promise<Buffer> {
    const body: (Paragraph | Table)[] = []

    // En-tête institutionnel
    body.push(new Paragraph({
        children: [new TextRun({ text: COMPANY, bold: true, color: EMERALD, size: 28 })],
    }))
    body.push(new Paragraph({
        children: [new TextRun({ text: 'Accompagnement de la diaspora · Cotonou, Bénin', color: MUTED, size: 16 })],
        border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: GOLD, space: 4 } },
        spacing: { after: 240 },
    }))

    // Titre
    body.push(new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 60 },
        shading: { type: ShadingType.CLEAR, color: 'auto', fill: SOFT },
        children: [new TextRun({ text: doc.title, bold: true, color: EMERALD, size: 34 })],
    }))
    body.push(new Paragraph({
        spacing: { after: 80 },
        children: [new TextRun({ text: doc.subtitle, color: MUTED, size: 18, italics: true })],
    }))
    if (doc.confidential) {
        body.push(new Paragraph({
            spacing: { after: 200 },
            children: [new TextRun({ text: 'CONFIDENTIEL : Usage interne', bold: true, color: 'E8112D', size: 18 })],
        }))
    }

    for (const block of doc.blocks as Block[]) body.push(...renderBlock(block))

    // Pied
    body.push(new Paragraph({
        spacing: { before: 320 },
        alignment: AlignmentType.CENTER,
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0', space: 6 } },
        children: [new TextRun({ text: CONTACT_LINE, color: MUTED, size: 14 })],
    }))
    body.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({
            text: `Document généré le ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}`,
            color: MUTED, size: 13, italics: true,
        })],
    }))

    const document = new Document({
        creator: COMPANY,
        title: doc.title,
        sections: [{ properties: {}, children: body }],
    })

    return Packer.toBuffer(document)
}
