/**
 * SVG Card Generator : Vrai SVG vectoriel natif
 * 
 * ✅ Dimensions exactes: 85mm × 55mm (standard carte de visite)
 * ✅ Unités en mm → import parfait dans Illustrator
 * ✅ Compatible Illustrator, Inkscape, Affinity Designer
 * ✅ Chaque élément dans un <g> nommé → éditable et déplaçable
 * ✅ Logo et QR code embarqués en base64
 * ✅ xlink:href pour compatibilité maximale
 */

import { CardData } from '@/components/business-card/BusinessCard'

/* ═══ DIMENSIONS EXACTES EN MM ═══ */
const CARD_W = 85   // 8.5 cm
const CARD_H = 55   // 5.5 cm

/* ═══ COULEURS ═══ */
const GOLD   = '#C9A84C'
const GOLD_D = '#B08D3A'
const DARK   = '#1A1A2E'
const TEXT_L = '#6B6B6B'
const FONT_M = "'Montserrat', 'Inter', 'Helvetica Neue', sans-serif"

/* ═══ SVG des icônes (paths vectoriels, viewBox 20×20) ═══ */
const ICON_PHONE = 'M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z'
const ICON_MAIL_1 = 'M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z'
const ICON_MAIL_2 = 'M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z'
const ICON_GLOBE = 'M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z'
const ICON_PIN = 'M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z'

/* ═══ Facteur d'échelle: ancien px → mm ═══ */
// Ancien: 680px × 440px → Nouveau: 85mm × 55mm
// 1px = 85/680 = 0.125mm
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

/* ═══ Convertir une image en base64 data URL ═══ */
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
                console.log(`[SVG] ✅ Image chargée: ${src} (${(dataUrl.length / 1024).toFixed(0)} KB)`)
                resolve(dataUrl)
            } catch (e) {
                reject(e)
            }
        }
        img.onerror = () => reject(new Error(`Impossible de charger: ${src}`))
        img.src = src + '?t=' + Date.now()
    })
}

/* ═══ Icône SVG avec échelle mm ═══ */
function icon(paths: string | string[], x: number, y: number, sizeMm: number): string {
    const scale = sizeMm / 20  // paths dans un viewBox 20×20
    const p = Array.isArray(paths) ? paths : [paths]
    return `<g transform="translate(${x}, ${y}) scale(${scale.toFixed(4)})">
        ${p.map(d => `<path d="${d}" fill="${GOLD}" fill-rule="evenodd" clip-rule="evenodd"/>`).join('\n        ')}
      </g>`
}

/* ═══ RECTO SVG (85mm × 55mm) ═══ */
function buildRectoSVG(logoBase64: string): string {
    const cx = CARD_W / 2    // 42.5mm centre
    const logoW = 42.5        // 340px → 42.5mm (maximum)
    const logoH = 42.5
    const logoX = cx - logoW / 2  // centré
    const logoY = 1.5         // tout en haut
    const barH = 0.5          // 4px → 0.5mm

    return `  <g id="recto-card">
    <g id="recto-fond">
      <rect width="${CARD_W}" height="${CARD_H}" rx="1.25" fill="#FFFFFF"/>
    </g>
    <g id="recto-accent-haut">
      <rect width="${CARD_W}" height="${barH}" fill="${GOLD}"/>
    </g>
    <g id="recto-accent-bas">
      <rect y="${(CARD_H - barH).toFixed(2)}" width="${CARD_W}" height="${barH}" fill="${GOLD}"/>
    </g>
    <g id="recto-logo">
      <image xlink:href="${logoBase64}" href="${logoBase64}" x="${logoX.toFixed(2)}" y="${logoY.toFixed(2)}" width="${logoW}" height="${logoH}" preserveAspectRatio="xMidYMid meet"/>
    </g>
    <g id="recto-titre">
      <text x="${cx}" y="${mm(355)}" text-anchor="middle" font-family="${FONT_M}" font-size="${mm(27)}" font-weight="900" fill="${DARK}" letter-spacing="${mm(1.5)}">RETOUR GAGNANT B\u00c9NIN</text>
    </g>
    <g id="recto-tagline">
      <text x="${cx}" y="${mm(395)}" text-anchor="middle" font-family="${FONT_M}" font-size="3.3" font-weight="900" fill="${GOLD_D}" letter-spacing="0.04">L&apos;Agence du Retour des Afro-descendants</text>
    </g>
  </g>`
}

/* ═══ VERSO SVG (85mm × 55mm) ═══ */
function buildVersoSVG(data: CardData, qrBase64: string): string {
    const lx = 5.25          // 42px → 5.25mm
    const barH = 0.5
    const iconSz = 2.5       // 20px → 2.5mm
    const iconSzSm = 2.25    // footer icons slightly smaller

    // Positions Y en mm
    const prenomY = 7.25      // 58px
    const nomY = 12.50        // 100px
    const lineY = 14.75       // 118px
    const posteY = 17.88      // 143px
    const contactStartY = 23.13 // 185px

    let contactsSvg = ''
    let cy = contactStartY

    const contactFontSz = '2.3'  // même taille que le footer
    const contactIconSz = 3      // même taille que le footer

    if (data.phone) {
        contactsSvg += `
    <g id="verso-telephone">
      ${icon(ICON_PHONE, lx, cy - 1.8, contactIconSz)}
      <text x="${(lx + 4).toFixed(2)}" y="${cy.toFixed(2)}" font-family="${FONT_M}" font-size="${contactFontSz}" font-weight="900" fill="${DARK}">${escXml(data.phone)}</text>
    </g>`
        cy += 4.25
    }

    if (data.email) {
        contactsSvg += `
    <g id="verso-email">
      ${icon([ICON_MAIL_1, ICON_MAIL_2], lx, cy - 1.8, contactIconSz)}
      <text x="${(lx + 4).toFixed(2)}" y="${cy.toFixed(2)}" font-family="${FONT_M}" font-size="${contactFontSz}" font-weight="900" fill="${DARK}">${escXml(data.email)}</text>
    </g>`
        cy += 4.25
    }

    // Footer en bas : 3 lignes, tailles directes en mm
    const fLine1 = CARD_H - 12.5  // email
    const fLine2 = fLine1 + 3.8   // website
    const fLine3 = fLine2 + 3.8   // adresse
    const fIconSz = 3             // icônes footer
    const fFontSz = '2.3'         // ~6.5pt : gros et lisible

    // QR Code
    const qrImgSize = 14       // 14mm
    const qrPad = 1            // 1mm
    const qrBoxW = qrImgSize + qrPad * 2  // 16mm
    const qrBoxX = CARD_W - 21.25  // ~63.75mm
    const qrBoxY = (CARD_H - qrBoxW - 2) / 2  // centré verticalement

    return `  <g id="verso-card">
    <g id="verso-fond">
      <rect width="${CARD_W}" height="${CARD_H}" rx="1.25" fill="#FFFFFF"/>
    </g>
    <g id="verso-accent-haut">
      <rect width="${CARD_W}" height="${barH}" fill="${GOLD}"/>
    </g>
    <g id="verso-accent-bas">
      <rect y="${(CARD_H - barH).toFixed(2)}" width="${CARD_W}" height="${barH}" fill="${GOLD}"/>
    </g>
    <g id="verso-prenom">
      <text x="${lx}" y="${prenomY}" font-family="${FONT_M}" font-size="${mm(22)}" font-weight="900" fill="${TEXT_L}" letter-spacing="${mm(1.32)}">${escXml(data.prenom.toUpperCase())}</text>
    </g>
    <g id="verso-nom">
      <text x="${lx}" y="${nomY}" font-family="${FONT_M}" font-size="${mm(36)}" font-weight="900" fill="${GOLD_D}" letter-spacing="${mm(1.08)}">${escXml(data.nom.toUpperCase())}</text>
    </g>
    <g id="verso-separateur">
      <rect x="${lx}" y="${lineY}" width="6.25" height="0.38" rx="0.19" fill="${GOLD}"/>
    </g>
    <g id="verso-poste">
      <text x="${lx}" y="${posteY}" font-family="${FONT_M}" font-size="${mm(15)}" font-weight="900" fill="${DARK}" letter-spacing="${mm(2.25)}">${escXml((data.position || 'CONSULTANT(E)').toUpperCase())}</text>
    </g>${contactsSvg}
    <g id="verso-email-footer">
      ${icon([ICON_MAIL_1, ICON_MAIL_2], lx, fLine1 - 1.8, fIconSz)}
      <text x="${(lx + 4).toFixed(2)}" y="${fLine1.toFixed(2)}" font-family="${FONT_M}" font-size="${fFontSz}" font-weight="900" fill="${DARK}">contact@retourgagnantbenin.bj</text>
    </g>
    <g id="verso-site-web">
      ${icon(ICON_GLOBE, lx, fLine2 - 1.8, fIconSz)}
      <text x="${(lx + 4).toFixed(2)}" y="${fLine2.toFixed(2)}" font-family="${FONT_M}" font-size="${fFontSz}" font-weight="900" fill="${DARK}">www.retourgagnantbenin.bj</text>
    </g>
    <g id="verso-adresse">
      ${icon(ICON_PIN, lx, fLine3 - 1.8, fIconSz)}
      <text x="${(lx + 4).toFixed(2)}" y="${fLine3.toFixed(2)}" font-family="${FONT_M}" font-size="${fFontSz}" font-weight="900" fill="${DARK}">Haie-Vive Cocotiers, Carré N°1158, Cotonou : BÉNIN</text>
    </g>
    <g id="verso-qr-code">
      <rect x="${qrBoxX.toFixed(2)}" y="${qrBoxY.toFixed(2)}" width="${qrBoxW}" height="${qrBoxW}" rx="0.75" fill="#FFFFFF" stroke="${GOLD}" stroke-width="0.25"/>
      <image xlink:href="${qrBase64}" href="${qrBase64}" x="${(qrBoxX + qrPad).toFixed(2)}" y="${(qrBoxY + qrPad).toFixed(2)}" width="${qrImgSize}" height="${qrImgSize}" preserveAspectRatio="xMidYMid meet"/>
      <text x="${(qrBoxX + qrBoxW / 2).toFixed(2)}" y="${(qrBoxY + qrBoxW + 2.5).toFixed(2)}" text-anchor="middle" font-family="${FONT_M}" font-size="1.5" font-weight="900" fill="${GOLD_D}" letter-spacing="0.3">SCANNEZ</text>
    </g>
  </g>`
}

/* ═══ TRAITS DE COUPE ═══ */
function cropMarks(x: number, y: number, w: number, h: number): string {
    const cl = 3, co = 1  // 3mm de trait, 1mm d'offset
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

/* ═══ EN-TÊTE SVG COMMUN ═══ */
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

/* ═══ GÉNÉRER LE RECTO (page individuelle 85mm × 55mm) ═══ */
function generateRectoSVG(logoBase64: string, fullName: string): string {
    const pad = 8  // marge identique sur les 2 pages
    const labelH = 5
    const pageW = CARD_W + pad * 2   // 101mm
    const pageH = CARD_H + pad * 2 + labelH  // 76mm
    const cardX = pad
    const cardY = pad + labelH

    return `${svgHeader(pageW, pageH)}

  <!-- ═══ RECTO : ${CARD_W}mm × ${CARD_H}mm ═══ -->
  <g id="page-recto">
    <text x="${(pageW / 2).toFixed(2)}" y="${(pad + 3.5).toFixed(2)}" text-anchor="middle" font-family="${FONT_M}" font-size="1.75" font-weight="900" fill="${DARK}" letter-spacing="0.35">RECTO</text>
    ${cropMarks(cardX, cardY, CARD_W, CARD_H)}
    <g transform="translate(${cardX}, ${cardY})">
${buildRectoSVG(logoBase64)}
    </g>
  </g>

  <g id="footer-info">
    <text x="${(pageW / 2).toFixed(2)}" y="${(pageH - 1.5).toFixed(2)}" text-anchor="middle" font-family="'Inter', sans-serif" font-size="1" fill="#999" letter-spacing="0.04">RECTO : ${CARD_W}mm × ${CARD_H}mm : ${escXml(fullName)} : SVG vectoriel</text>
  </g>
</svg>`
}

/* ═══ GÉNÉRER LE VERSO (page individuelle 85mm × 55mm) ═══ */
function generateVersoSVG(data: CardData, qrBase64: string, fullName: string): string {
    const pad = 8
    const labelH = 5
    const pageW = CARD_W + pad * 2   // 101mm : identique au recto
    const pageH = CARD_H + pad * 2 + labelH  // 76mm : identique au recto
    const cardX = pad
    const cardY = pad + labelH

    return `${svgHeader(pageW, pageH)}

  <!-- ═══ VERSO : ${CARD_W}mm × ${CARD_H}mm ═══ -->
  <g id="page-verso">
    <text x="${(pageW / 2).toFixed(2)}" y="${(pad + 3.5).toFixed(2)}" text-anchor="middle" font-family="${FONT_M}" font-size="1.75" font-weight="900" fill="${DARK}" letter-spacing="0.35">VERSO</text>
    ${cropMarks(cardX, cardY, CARD_W, CARD_H)}
    <g transform="translate(${cardX}, ${cardY})">
${buildVersoSVG(data, qrBase64)}
    </g>
  </g>

  <g id="footer-info">
    <text x="${(pageW / 2).toFixed(2)}" y="${(pageH - 1.5).toFixed(2)}" text-anchor="middle" font-family="'Inter', sans-serif" font-size="1" fill="#999" letter-spacing="0.04">VERSO : ${CARD_W}mm × ${CARD_H}mm : ${escXml(fullName)} : SVG vectoriel</text>
  </g>
</svg>`
}

/* ═══ Charger les images ═══ */
async function loadImages(): Promise<{ logo: string; qr: string }> {
    console.log('[SVG] Chargement des images...')
    let logo = '', qr = ''

    try {
        logo = await fetchImageAsBase64('/images/logo-transparent.png')
        console.log('[SVG] ✅ Logo chargé')
    } catch (e) {
        console.error('[SVG] ❌ Logo:', e)
    }

    try {
        qr = await fetchImageAsBase64('/images/qr-code.png')
        console.log('[SVG] ✅ QR chargé')
    } catch (e) {
        console.error('[SVG] ❌ QR:', e)
    }

    return { logo, qr }
}

/* ═══ Télécharger un fichier SVG ═══ */
function downloadFile(content: string, filename: string): void {
    const blob = new Blob([content], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.download = filename
    link.href = url
    link.click()
    URL.revokeObjectURL(url)
}

/* ═══ Fonction de téléchargement : 2 fichiers séparés ═══ */
export async function downloadSVGCard(data: CardData, filenamePrefix: string): Promise<void> {
    const { logo, qr } = await loadImages()
    const fullName = `${data.prenom} ${data.nom}`

    // Générer les 2 pages séparées
    const rectoSvg = generateRectoSVG(logo, fullName)
    const versoSvg = generateVersoSVG(data, qr, fullName)

    const hasImages = rectoSvg.includes('data:image/png;base64,')
    console.log(`[SVG] Images: ${hasImages ? '✅' : '❌'} | Recto: ${(rectoSvg.length / 1024).toFixed(0)} KB | Verso: ${(versoSvg.length / 1024).toFixed(0)} KB | ${CARD_W}mm × ${CARD_H}mm`)

    // Télécharger le RECTO
    downloadFile(rectoSvg, `${filenamePrefix}-RECTO.svg`)

    // Petit délai pour que le navigateur gère les 2 téléchargements
    await new Promise(resolve => setTimeout(resolve, 500))

    // Télécharger le VERSO
    downloadFile(versoSvg, `${filenamePrefix}-VERSO.svg`)
}
