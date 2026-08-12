/**
 * SVG Plexiglas Mockup Generator : v3
 * 80cm x 120cm (800mm x 1200mm) : Forme arche
 * Compatible Illustrator / Navigateur / Decoupe CNC
 * Pas d'emoji ni de caracteres unicode exotiques (compatibilite XML)
 */

const PW = 800
const PH = 1200
const GOLD   = '#C9A84C'
const GOLD_D = '#B08D3A'
const BLACK  = '#000000'
const WHITE  = '#FFFFFF'
const FONT   = "'Montserrat', 'Inter', sans-serif"
const ARCH_R = PW / 2

function esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
        .replace(/[^\x20-\x7E]/g, ch => `&#x${ch.charCodeAt(0).toString(16).toUpperCase()};`)
}

function archPath(): string {
    return `M 0,${PH} L 0,${ARCH_R} A ${ARCH_R},${ARCH_R} 0 0,1 ${PW},${ARCH_R} L ${PW},${PH} Z`
}

function innerArch(m: number): string {
    const r = ARCH_R - m
    return `M ${m},${PH - m} L ${m},${ARCH_R + m * 0.5} A ${r},${r} 0 0,1 ${PW - m},${ARCH_R + m * 0.5} L ${PW - m},${PH - m} Z`
}

async function fetchBase64(src: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        const img = new window.Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
            try {
                const c = document.createElement('canvas')
                c.width = img.naturalWidth || 500
                c.height = img.naturalHeight || 500
                const ctx = c.getContext('2d')
                if (!ctx) { reject(new Error('Canvas')); return }
                ctx.drawImage(img, 0, 0, c.width, c.height)
                resolve(c.toDataURL('image/png'))
            } catch (e) { reject(e) }
        }
        img.onerror = () => reject(new Error(`Load: ${src}`))
        img.src = src + '?t=' + Date.now()
    })
}

function txt(x: number, y: number, text: string, size: number, weight: string, color: string, anchor = 'middle', ls = '0'): string {
    return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${color}" letter-spacing="${ls}">${esc(text)}</text>`
}

function buildSVG(logoB64: string, qrB64: string): string {
    const pad = 25
    const pageW = PW + pad * 2
    const pageH = PH + pad * 2
    const cx = PW / 2

    // --- LAYOUT Y ---
    const logoY = 60, logoSz = 160
    const titleY = 280
    const subY = 325
    const sep1Y = 355

    // Body text
    const bodyY = 385
    const bodyLH = 26
    const bodyLines = [
        'Retour Gagnant B\u00e9nin (R.G.B) est l\'agence',
        'de r\u00e9f\u00e9rence d\u00e9di\u00e9e \u00e0 l\'accompagnement',
        'strat\u00e9gique de la diaspora historique.',
        '',
        'Nous transformons votre d\u00e9sir de retour',
        'en r\u00e9alit\u00e9 sereine et s\u00e9curis\u00e9e.',
        '',
        'De l\'obtention de la nationalit\u00e9 b\u00e9ninoise',
        '\u00e0 votre installation immobili\u00e8re et',
        'entrepreneuriale, nous garantissons un',
        'ancrage digne sur la terre de vos anc\u00eatres.',
    ]

    // Services (8 services, 4 par colonne)
    const svcTitleY = bodyY + bodyLines.length * bodyLH + 15
    const sep2Y = svcTitleY + 12
    const svcStartY = sep2Y + 25
    const svcLH = 30

    const servicesLeft = [
        '1.  Nationalit\u00e9 B\u00e9ninoise',
        '2.  Citoyennet\u00e9 & D\u00e9marches',
        '3.  Investissement Immobilier',
        '4.  Accompagnement Cr\u00e9ation',
        '     d\'Entreprise',
    ]
    const servicesRight = [
        '5.  Conseil Juridique',
        '6.  Logistique du Retour',
        '7.  C\u00e9r\u00e9monies & \u00c9v\u00e9nements',
        '',
        '',
    ]

    // Contacts
    const contactY = svcStartY + 5 * svcLH + 25
    const sep3Y = contactY - 15

    // QR
    const qrSz = 60
    const qrLabelY = contactY + 110
    const qrY = qrLabelY + 8

    // Body SVG
    let lineIdx = 0
    const bodySvg = bodyLines.map(line => {
        const idx = lineIdx++
        if (!line) return ''
        return txt(cx, bodyY + idx * bodyLH, line, 18, '700', BLACK)
    }).filter(Boolean).join('\n      ')

    // Services SVG
    const colL = 80
    const colR = PW / 2 + 30
    const svcLeftSvg = servicesLeft.map((s, i) =>
        txt(colL, svcStartY + i * svcLH, s, 16, '800', BLACK, 'start')
    ).join('\n      ')
    const svcRightSvg = servicesRight.map((s, i) =>
        txt(colR, svcStartY + i * svcLH, s, 16, '800', BLACK, 'start')
    ).join('\n      ')

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${pageW}mm" height="${pageH}mm" viewBox="0 0 ${pageW} ${pageH}">
  <defs>
    <style>@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800;900&amp;display=swap');</style>
    <clipPath id="archClip"><path d="${archPath()}"/></clipPath>
    <linearGradient id="glassGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.97"/>
      <stop offset="50%" stop-color="#ffffff" stop-opacity="0.93"/>
      <stop offset="100%" stop-color="#eef0f4" stop-opacity="0.96"/>
    </linearGradient>
    <linearGradient id="glossHL" x1="0.3" y1="0" x2="0.7" y2="0.35">
      <stop offset="0%" stop-color="#fff" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <filter id="shadow" x="-8%" y="-4%" width="116%" height="112%">
      <feDropShadow dx="4" dy="8" stdDeviation="12" flood-color="rgba(0,0,0,0.22)"/>
    </filter>
  </defs>

  <rect width="100%" height="100%" fill="#e2e2e2"/>

  <g transform="translate(${pad}, ${pad})">

    <!-- OMBRE -->
    <g filter="url(#shadow)"><path d="${archPath()}" fill="rgba(0,0,0,0.06)"/></g>

    <!-- FOND VERRE -->
    <g id="plexiglas-fond" clip-path="url(#archClip)">
      <path d="${archPath()}" fill="url(#glassGrad)"/>
      <path d="${archPath()}" fill="${WHITE}" opacity="0.25"/>
      <path d="M 0,${ARCH_R} A ${ARCH_R},${ARCH_R} 0 0,1 ${PW},${ARCH_R} L ${PW},${ARCH_R + 140} Q ${cx},${ARCH_R + 40} 0,${ARCH_R + 140} Z" fill="url(#glossHL)"/>
    </g>

    <!-- CONTOUR DECOUPE -->
    <g id="trait-decoupe">
      <path d="${archPath()}" fill="none" stroke="${GOLD}" stroke-width="3.5"/>
    </g>
    <g id="filet-interieur">
      <path d="${innerArch(16)}" fill="none" stroke="${GOLD}" stroke-width="0.7" opacity="0.45"/>
    </g>

    <!-- ====== CONTENU ====== -->
    <g id="contenu">

      <!-- LOGO -->
      <g id="logo">
        <image xlink:href="${logoB64}" href="${logoB64}" x="${cx - logoSz / 2}" y="${logoY}" width="${logoSz}" height="${logoSz}" preserveAspectRatio="xMidYMid meet"/>
      </g>

      <!-- TITRE -->
      <g id="titre">
        ${txt(cx, titleY, 'RETOUR GAGNANT B\u00c9NIN', 42, '900', BLACK, 'middle', '3')}
        ${txt(cx, subY, '( R.G.B )', 26, '900', GOLD_D, 'middle', '6')}
      </g>

      <!-- Separateur 1 -->
      <line x1="${cx - 100}" y1="${sep1Y}" x2="${cx + 100}" y2="${sep1Y}" stroke="${GOLD}" stroke-width="2.5" stroke-linecap="round"/>

      <!-- TEXTE PRINCIPAL -->
      <g id="texte-principal">
      ${bodySvg}
      </g>

      <!-- NOS SERVICES -->
      <g id="services">
        ${txt(cx, svcTitleY, 'NOS SERVICES', 22, '900', GOLD_D, 'middle', '5')}
        <line x1="${cx - 80}" y1="${sep2Y}" x2="${cx + 80}" y2="${sep2Y}" stroke="${GOLD}" stroke-width="1.5" stroke-linecap="round"/>
        <!-- Colonne gauche -->
        ${svcLeftSvg}
        <!-- Colonne droite -->
        ${svcRightSvg}
      </g>

      <!-- Separateur contacts -->
      <line x1="${cx - 70}" y1="${sep3Y}" x2="${cx + 70}" y2="${sep3Y}" stroke="${GOLD}" stroke-width="1" stroke-linecap="round" opacity="0.5"/>

      <!-- CONTACTS -->
      <g id="contacts">
        ${txt(cx, contactY, 'T\u00e9l : +229 01 60 32 21 21  /  +229 01 94 35 50 50', 17, '900', BLACK)}
        ${txt(cx, contactY + 28, 'Email : contact@retourgagnantbenin.bj', 16, '800', BLACK)}
        ${txt(cx, contactY + 54, 'Web : www.retourgagnantbenin.bj', 16, '800', GOLD_D)}
        ${txt(cx, contactY + 80, 'Adresse : Haie-Vive Cocotiers, Carr\u00e9 N\u00b01158, Cotonou \u2014 B\u00c9NIN', 14, '700', BLACK)}
      </g>

      <!-- QR CODE -->
      <g id="qr-code">
        ${txt(cx, qrLabelY, 'SCANNEZ MOI', 11, '900', GOLD_D, 'middle', '3')}
        <rect x="${cx - qrSz / 2 - 4}" y="${qrY - 4}" width="${qrSz + 8}" height="${qrSz + 8}" rx="3" fill="${WHITE}" stroke="${GOLD}" stroke-width="1.2"/>
        <image xlink:href="${qrB64}" href="${qrB64}" x="${cx - qrSz / 2}" y="${qrY}" width="${qrSz}" height="${qrSz}" preserveAspectRatio="xMidYMid meet"/>
      </g>

    </g>

    <!-- REFLET SURFACE -->
    <g id="reflet" clip-path="url(#archClip)" opacity="0.1">
      <ellipse cx="${PW * 0.35}" cy="${ARCH_R * 0.6}" rx="${PW * 0.5}" ry="${ARCH_R * 0.65}" fill="${WHITE}"/>
    </g>

  </g>

  <g id="info-production">
    ${txt(pageW / 2, pageH - 5, 'PLEXIGLAS 80cm x 120cm - Trait de d\u00e9coupe = contour dor\u00e9 - RETOUR GAGNANT B\u00c9NIN - SVG vectoriel', 5, '400', '#999')}
  </g>
</svg>`
}

/* === PREVIEW === */
export async function generatePlexiglasSVG(): Promise<string> {
    let logo = '', qr = ''
    try { logo = await fetchBase64('/images/logo-transparent.png') } catch (e) { console.error('[Plexiglas] Logo:', e) }
    try { qr = await fetchBase64('/images/qr-code.png') } catch (e) { console.error('[Plexiglas] QR:', e) }
    return buildSVG(logo, qr)
}

/* === TELECHARGEMENT === */
export async function downloadPlexiglasSVG(): Promise<void> {
    const svg = await generatePlexiglasSVG()
    console.log(`[Plexiglas] ${(svg.length / 1024).toFixed(0)} KB | 80cm x 120cm`)
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.download = 'RGB-Plexiglas-80x120cm.svg'
    a.href = url
    a.click()
    URL.revokeObjectURL(url)
}
