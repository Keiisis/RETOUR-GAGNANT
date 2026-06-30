/**
 * SVG Ouidah Card Generator — Vrai SVG vectoriel natif
 */

import { CardData } from '@/components/business-card/BusinessCard'

/* ═══ DIMENSIONS EXACTES EN MM ═══ */
const CARD_W = 85   // 8.5 cm
const CARD_H = 55   // 5.5 cm

/* ═══ COULEURS OUIDAH ═══ */
const NAVY      = '#1B2A4A'
const NAVY_DEEP = '#0F1C33'
const TERRACOTTA= '#A8341A'
const AMBER     = '#C88B2A'
const CHARCOAL  = '#1E1A17'
const WHITE     = '#FFFFFF'

const FONT_M = "'Montserrat', 'Inter', 'Helvetica Neue', sans-serif"

/* ═══ SVG des icônes (paths vectoriels, viewBox 20×20) ═══ */
const ICON_PHONE = 'M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z'
const ICON_MAIL_1 = 'M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z'
const ICON_MAIL_2 = 'M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z'
const ICON_PIN = 'M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z'

const S = 85 / 680  // 0.125

function escXml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
}

function mm(px: number): string {
    return (px * S).toFixed(2)
}

async function fetchImageAsBase64(src: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        const img = new window.Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas')
                canvas.width = img.naturalWidth || img.width || 500
                canvas.height = img.naturalHeight || img.height || 500
                const ctx = canvas.getContext('2d')
                if (!ctx) { reject(new Error('Canvas non supporté')); return }
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
                const dataUrl = canvas.toDataURL('image/png')
                resolve(dataUrl)
            } catch (e) {
                reject(e)
            }
        }
        img.onerror = () => reject(new Error(`Impossible de charger: ${src}`))
        img.src = src + '?t=' + Date.now()
    })
}

function icon(paths: string | string[], x: number, y: number, sizeMm: number): string {
    const scale = sizeMm / 20
    const p = Array.isArray(paths) ? paths : [paths]
    return `<g transform="translate(${x}, ${y}) scale(${scale.toFixed(4)})">
        ${p.map(d => `<path d="${d}" fill="${AMBER}" fill-rule="evenodd" clip-rule="evenodd"/>`).join('\n        ')}
      </g>`
}

function buildTricolorBand(yPos: number, reverse: boolean): string {
    const w = CARD_W / 3
    const h = 5 * S
    const c1 = reverse ? AMBER : NAVY
    const c2 = TERRACOTTA
    const c3 = reverse ? NAVY : AMBER
    return `    <g transform="translate(0, ${yPos})">
      <rect x="0" y="0" width="${w.toFixed(2)}" height="${h.toFixed(2)}" fill="${c1}"/>
      <rect x="${w.toFixed(2)}" y="0" width="${w.toFixed(2)}" height="${h.toFixed(2)}" fill="${c2}"/>
      <rect x="${(w * 2).toFixed(2)}" y="0" width="${(CARD_W - w * 2).toFixed(2)}" height="${h.toFixed(2)}" fill="${c3}"/>
    </g>`
}

function buildRectoSVG(logoBase64: string): string {
    const cx = CARD_W / 2
    const logoW = 340 * S
    const logoH = 340 * S
    const logoX = cx - logoW / 2
    const logoY = 1.5

    return `  <g id="recto-card">
    <g id="recto-fond">
      <rect width="${CARD_W}" height="${CARD_H}" rx="1.25" fill="${WHITE}"/>
    </g>
${buildTricolorBand(0, false)}
${buildTricolorBand(CARD_H - 5 * S, true)}
    <g id="recto-logo">
      <image xlink:href="${logoBase64}" href="${logoBase64}" x="${logoX.toFixed(2)}" y="${logoY.toFixed(2)}" width="${logoW.toFixed(2)}" height="${logoH.toFixed(2)}" preserveAspectRatio="xMidYMid meet"/>
    </g>
    <g id="recto-titre">
      <text x="${cx}" y="${mm(350)}" text-anchor="middle" font-family="${FONT_M}" font-size="${mm(24)}" font-weight="900" fill="${NAVY_DEEP}" letter-spacing="${mm(1.44)}">OUIDAH HERITAGE TOUR</text>
    </g>
    <g id="recto-tagline">
      <text x="${cx}" y="${mm(390)}" text-anchor="middle" font-family="${FONT_M}" font-size="${mm(21)}" font-weight="900" fill="${TERRACOTTA}" letter-spacing="${mm(0.42)}">Retour aux sources — Voyage dans la mémoire</text>
    </g>
  </g>`
}

function buildVersoSVG(data: CardData): string {
    const lx = 5.25           // 42px → 5.25mm (left padding)

    const prenomY = 7.25      // 58px → 7.25mm
    const nomY = 12.50        // 100px → 12.5mm
    const lineY = 14.75       // 118px
    const posteY = 17.88      // 143px
    const contactStartY = 23.13 // 185px

    let contactsSvg = ''
    let cy = contactStartY

    const contactFontSz = '2.25'  // 18px → 2.25mm
    const contactIconSz = 3       // icônes contacts 3mm (viewBox 20)
    const textOffsetX = 4         // 4mm gap icône → texte

    if (data.phone) {
        contactsSvg += `
    <g id="verso-telephone">
      ${icon(ICON_PHONE, lx, cy - 1.8, contactIconSz)}
      <text x="${(lx + textOffsetX).toFixed(2)}" y="${cy.toFixed(2)}" font-family="${FONT_M}" font-size="${contactFontSz}" font-weight="800" fill="${NAVY_DEEP}" letter-spacing="0.09">${escXml(data.phone)}</text>
    </g>`
        cy += 4.25
    }

    if (data.email) {
        contactsSvg += `
    <g id="verso-email">
      ${icon([ICON_MAIL_1, ICON_MAIL_2], lx, cy - 1.8, contactIconSz)}
      <text x="${(lx + textOffsetX).toFixed(2)}" y="${cy.toFixed(2)}" font-family="${FONT_M}" font-size="${contactFontSz}" font-weight="800" fill="${NAVY_DEEP}" letter-spacing="0.045">${escXml(data.email)}</text>
    </g>`
        cy += 4.25
    }

    const fLine1 = CARD_H - 12.5
    const fIconSz = 2.7       // 18px → 2.7mm
    const fFontSz = '1.69'    // 13.5px → 1.69mm
    const fTextOffsetX = 3.5  // 3.5mm gap icône → texte

    return `  <g id="verso-card">
    <g id="verso-fond">
      <rect width="${CARD_W}" height="${CARD_H}" rx="1.25" fill="${WHITE}"/>
    </g>
${buildTricolorBand(0, false)}
${buildTricolorBand(CARD_H - 5 * S, true)}
    <g id="verso-prenom">
      <text x="${lx.toFixed(2)}" y="${prenomY.toFixed(2)}" font-family="${FONT_M}" font-size="${mm(22)}" font-weight="900" fill="${CHARCOAL}" letter-spacing="${mm(1.32)}">${escXml(data.prenom.toUpperCase())}</text>
    </g>
    <g id="verso-nom">
      <text x="${lx.toFixed(2)}" y="${nomY.toFixed(2)}" font-family="${FONT_M}" font-size="${mm(36)}" font-weight="900" fill="${NAVY}" letter-spacing="${mm(1.08)}">${escXml(data.nom.toUpperCase())}</text>
    </g>
    <g id="verso-separateur">
      <rect x="${lx.toFixed(2)}" y="${lineY.toFixed(2)}" width="6.25" height="0.38" rx="0.19" fill="${TERRACOTTA}"/>
    </g>
    <g id="verso-poste">
      <text x="${lx.toFixed(2)}" y="${posteY.toFixed(2)}" font-family="${FONT_M}" font-size="${mm(15)}" font-weight="900" fill="${NAVY_DEEP}" letter-spacing="${mm(2.25)}">${escXml((data.position || 'GUIDE & EXPERT PATRIMOINE').toUpperCase())}</text>
    </g>${contactsSvg}
    <g id="verso-adresse">
      ${icon(ICON_PIN, lx, fLine1 - 1.8, fIconSz)}
      <text x="${(lx + fTextOffsetX).toFixed(2)}" y="${fLine1.toFixed(2)}" font-family="${FONT_M}" font-size="${fFontSz}" font-weight="800" fill="${NAVY_DEEP}">Ouidah, R\u00e9publique du B\u00e9nin</text>
    </g>
  </g>`
}

function cropMarks(x: number, y: number, w: number, h: number): string {
    const cl = 3, co = 1
    const corners = [
        [x - co - cl, y, x - co, y],
        [x, y - co - cl, x, y - co],
        [x + w + co, y, x + w + co + cl, y],
        [x + w, y - co - cl, x + w, y - co],
        [x - co - cl, y + h, x - co, y + h],
        [x, y + h + co, x, y + h + co + cl],
        [x + w + co, y + h, x + w + co + cl, y + h],
        [x + w, y + h + co, x + w, y + h + co + cl],
    ]
    return `<g id="crop-marks">
    ${corners.map(([x1, y1, x2, y2]) =>
        `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="#000" stroke-width="0.1"/>`
    ).join('\n    ')}
  </g>`
}

function svgHeader(pageW: number, pageH: number): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${pageW}mm" height="${pageH}mm" viewBox="0 0 ${pageW} ${pageH}">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700;800;900&amp;display=swap');
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;800&amp;display=swap');
    </style>
  </defs>
  <rect width="100%" height="100%" fill="#ffffff"/>`
}

function generateRectoSVG(logoBase64: string, fullName: string): string {
    const pad = 8
    const labelH = 5
    const pageW = CARD_W + pad * 2
    const pageH = CARD_H + pad * 2 + labelH
    const cardX = pad
    const cardY = pad + labelH

    return `${svgHeader(pageW, pageH)}

  <!-- ═══ RECTO — ${CARD_W}mm × ${CARD_H}mm ═══ -->
  <g id="page-recto">
    <text x="${(pageW / 2).toFixed(2)}" y="${(pad + 3.5).toFixed(2)}" text-anchor="middle" font-family="${FONT_M}" font-size="1.75" font-weight="900" fill="${CHARCOAL}" letter-spacing="0.35">RECTO</text>
    ${cropMarks(cardX, cardY, CARD_W, CARD_H)}
    <g transform="translate(${cardX}, ${cardY})">
${buildRectoSVG(logoBase64)}
    </g>
  </g>

  <g id="footer-info">
    <text x="${(pageW / 2).toFixed(2)}" y="${(pageH - 1.5).toFixed(2)}" text-anchor="middle" font-family="'Inter', sans-serif" font-size="1" fill="#999" letter-spacing="0.04">RECTO — ${CARD_W}mm × ${CARD_H}mm — ${escXml(fullName)} — Ouidah Heritage Tour</text>
  </g>
</svg>`
}

function generateVersoSVG(data: CardData, fullName: string): string {
    const pad = 8
    const labelH = 5
    const pageW = CARD_W + pad * 2
    const pageH = CARD_H + pad * 2 + labelH
    const cardX = pad
    const cardY = pad + labelH

    return `${svgHeader(pageW, pageH)}

  <!-- ═══ VERSO — ${CARD_W}mm × ${CARD_H}mm ═══ -->
  <g id="page-verso">
    <text x="${(pageW / 2).toFixed(2)}" y="${(pad + 3.5).toFixed(2)}" text-anchor="middle" font-family="${FONT_M}" font-size="1.75" font-weight="900" fill="${CHARCOAL}" letter-spacing="0.35">VERSO</text>
    ${cropMarks(cardX, cardY, CARD_W, CARD_H)}
    <g transform="translate(${cardX}, ${cardY})">
${buildVersoSVG(data)}
    </g>
  </g>

  <g id="footer-info">
    <text x="${(pageW / 2).toFixed(2)}" y="${(pageH - 1.5).toFixed(2)}" text-anchor="middle" font-family="'Inter', sans-serif" font-size="1" fill="#999" letter-spacing="0.04">VERSO — ${CARD_W}mm × ${CARD_H}mm — ${escXml(fullName)} — Ouidah Heritage Tour</text>
  </g>
</svg>`
}

function downloadFile(content: string, filename: string): void {
    const blob = new Blob([content], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.download = filename
    link.href = url
    link.click()
    URL.revokeObjectURL(url)
}

export async function downloadOuidahSVGCard(data: CardData, filenamePrefix: string): Promise<void> {
    console.log('[SVG] Chargement du logo Ouidah...')
    let logo = ''
    try {
        logo = await fetchImageAsBase64('/images/ouidah-logo.png')
    } catch (e) {
        console.error('[SVG] ❌ Logo Ouidah:', e)
    }

    const fullName = `${data.prenom} ${data.nom}`

    const rectoSvg = generateRectoSVG(logo, fullName)
    const versoSvg = generateVersoSVG(data, fullName)

    downloadFile(rectoSvg, `${filenamePrefix}-RECTO.svg`)
    await new Promise(resolve => setTimeout(resolve, 500))
    downloadFile(versoSvg, `${filenamePrefix}-VERSO.svg`)
}
