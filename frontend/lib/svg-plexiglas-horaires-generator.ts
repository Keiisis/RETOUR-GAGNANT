/**
 * SVG Plexiglas HORAIRES Generator — v3
 * 80cm x 120cm (800mm x 1200mm) — Forme arche
 * Plaque Horaires & Jours d'ouverture
 * 3 entités : R.G.B / O.H.T / A.C.S.T
 * Bordure découpe : Bleu marine (pas doré)
 */

const PW = 800
const PH = 1200
const GOLD   = '#C9A84C'
const GOLD_D = '#B08D3A'
const BLACK  = '#000000'
const WHITE  = '#FFFFFF'
const NAVY   = '#1B2A4A'
const NAVY_DEEP = '#0F1C33'
const TERRACOTTA = '#A8341A'
const CUT_COLOR = '#1B2A4A'
const FONT   = "'Montserrat', 'Inter', sans-serif"
const ARCH_R = PW / 2
const INNER_M = 16  // marge du filet intérieur

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

function txt(x: number, y: number, text: string, size: number, weight: string, color: string, anchor = 'middle', ls = '0'): string {
    return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${color}" letter-spacing="${ls}">${esc(text)}</text>`
}

/* ═══ Ligne décorative ◆───◆ ═══ */
function ornamentLine(cx: number, y: number, halfW: number, color: string, thick = 1.5): string {
    const d = 4
    return `<g>
      <line x1="${cx - halfW}" y1="${y}" x2="${cx - d - 3}" y2="${y}" stroke="${color}" stroke-width="${thick}" stroke-linecap="round"/>
      <rect x="${cx - d / 2}" y="${y - d / 2}" width="${d}" height="${d}" fill="${color}" transform="rotate(45 ${cx} ${y})"/>
      <line x1="${cx + d + 3}" y1="${y}" x2="${cx + halfW}" y2="${y}" stroke="${color}" stroke-width="${thick}" stroke-linecap="round"/>
    </g>`
}

/* ═══ Double filet élégant ═══ */
function doubleLine(cx: number, y: number, halfW: number, color: string): string {
    return `<g>
      <line x1="${cx - halfW}" y1="${y - 2}" x2="${cx + halfW}" y2="${y - 2}" stroke="${color}" stroke-width="1.2" stroke-linecap="round"/>
      <line x1="${cx - halfW + 20}" y1="${y + 2}" x2="${cx + halfW - 20}" y2="${y + 2}" stroke="${color}" stroke-width="0.7" stroke-linecap="round"/>
    </g>`
}

function buildSVG(): string {
    const pad = 25
    const pageW = PW + pad * 2
    const pageH = PH + pad * 2
    const cx = PW / 2

    /* ══════════════════════════════════════════════════════════
       LAYOUT — calculé du bas vers le haut pour que la dernière
       ligne (adresse) soit juste au-dessus du filet intérieur
       Filet intérieur bas = PH - INNER_M = 1184
       → adresseY = 1168 (16px au-dessus du trait)
       ══════════════════════════════════════════════════════════ */

    // ── ZONE BAS : contacts ──
    const adresseY  = 1168
    const contactY  = adresseY - 24    // 1144
    const noteDimY  = contactY - 30    // 1114
    const noteSamY  = noteDimY - 18    // 1096

    // ── TABLEAU HORAIRES ──
    const rowH = 35
    const tblEndY = noteSamY - 16      // 1080
    const tblY = tblEndY - 7 * rowH    // 1080 - 245 = 835

    // ── TITRE HORAIRES ──
    const sepHorY   = tblY - 15        // 820
    const horTitleY = sepHorY - 26     // 794

    // ── SÉPARATEUR PRINCIPAL ──
    const sepMainY  = horTitleY - 26   // 768

    // ── ENTITÉ 3 : A.C.S.T ──
    const e3L3 = sepMainY - 28        // 740
    const e3L2 = e3L3 - 30            // 710
    const e3L1 = e3L2 - 28            // 682

    // ── SÉPARATEUR 2 ──
    const sep2Y = e3L1 - 26           // 656

    // ── ENTITÉ 2 : O.H.T ──
    const e2L2 = sep2Y - 26           // 630
    const e2L1 = e2L2 - 32            // 598

    // ── SÉPARATEUR 1 ──
    const sep1Y = e2L1 - 26           // 572

    // ── ENTITÉ 1 : R.G.B ──
    const e1L2 = sep1Y - 26           // 546
    const e1L1 = e1L2 - 32            // 514

    /* ── JOURS & HORAIRES ── */
    const jours: { jour: string; h: string; ouvert: boolean }[] = [
        { jour: 'Lundi',    h: '08h00 \u2014 17h30', ouvert: true },
        { jour: 'Mardi',    h: '08h00 \u2014 17h30', ouvert: true },
        { jour: 'Mercredi', h: '08h00 \u2014 17h30', ouvert: true },
        { jour: 'Jeudi',    h: '08h00 \u2014 17h30', ouvert: true },
        { jour: 'Vendredi', h: '08h00 \u2014 17h30', ouvert: true },
        { jour: 'Samedi',   h: '08h00 \u2014 13h00', ouvert: true },
        { jour: 'Dimanche', h: 'Ferm\u00e9',         ouvert: false },
    ]

    const tblX = 80
    const tblW = PW - 160
    const colJour = tblX + 40
    const colH = PW - tblX - 40

    let tableSvg = ''
    jours.forEach((j, i) => {
        const y = tblY + i * rowH
        const isClosed = !j.ouvert
        const isSat = j.jour === 'Samedi'
        const bgColor = isClosed ? '#fbeaea' : (i % 2 === 0 ? '#f9f7f2' : '#f3efe6')
        const bgOpacity = isClosed ? '0.7' : '0.5'

        tableSvg += `      <rect x="${tblX}" y="${y}" width="${tblW}" height="${rowH - 3}" rx="5" fill="${bgColor}" opacity="${bgOpacity}"/>\n`

        const dotY = y + (rowH - 3) / 2
        const dotColor = isClosed ? TERRACOTTA : (isSat ? GOLD : '#2D8F4E')
        tableSvg += `      <circle cx="${tblX + 18}" cy="${dotY}" r="4.5" fill="${dotColor}"/>\n`

        const textY = y + (rowH - 3) / 2 + 6
        tableSvg += `      ${txt(colJour, textY, j.jour, 18, '800', isClosed ? TERRACOTTA : BLACK, 'start')}\n`

        if (j.ouvert) {
            tableSvg += `      ${txt(colH, textY, j.h, 18, '700', NAVY, 'end')}\n`
            if (isSat) {
                tableSvg += `      ${txt(colH, textY + 16, '(sur Rendez-vous)', 11, '600', GOLD_D, 'end')}\n`
            }
        } else {
            tableSvg += `      ${txt(colH, textY, 'Ferm\u00e9', 18, '900', TERRACOTTA, 'end')}\n`
        }
    })

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${pageW}mm" height="${pageH}mm" viewBox="0 0 ${pageW} ${pageH}">
  <defs>
    <style>@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800;900&amp;display=swap');</style>
    <clipPath id="archClip"><path d="${archPath()}"/></clipPath>
    <linearGradient id="glassGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.97"/>
      <stop offset="50%" stop-color="#ffffff" stop-opacity="0.94"/>
      <stop offset="100%" stop-color="#eef0f4" stop-opacity="0.96"/>
    </linearGradient>
    <linearGradient id="glossHL" x1="0.3" y1="0" x2="0.7" y2="0.35">
      <stop offset="0%" stop-color="#fff" stop-opacity="0.45"/>
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
      <path d="${archPath()}" fill="${WHITE}" opacity="0.2"/>
      <path d="M 0,${ARCH_R} A ${ARCH_R},${ARCH_R} 0 0,1 ${PW},${ARCH_R} L ${PW},${ARCH_R + 140} Q ${cx},${ARCH_R + 40} 0,${ARCH_R + 140} Z" fill="url(#glossHL)"/>
    </g>

    <!-- CONTOUR DECOUPE (bleu marine) -->
    <g id="trait-decoupe">
      <path d="${archPath()}" fill="none" stroke="${CUT_COLOR}" stroke-width="3.5"/>
    </g>
    <!-- FILET INTÉRIEUR (gris) -->
    <g id="filet-interieur">
      <path d="${innerArch(INNER_M)}" fill="none" stroke="${CUT_COLOR}" stroke-width="0.7" opacity="0.35"/>
    </g>

    <!-- ══════════════════════════════════════
         CONTENU
         ══════════════════════════════════════ -->
    <g id="contenu">

      <!-- ═══ ENTITÉ 1 : RETOUR GAGNANT BÉNIN ═══ -->
      <g id="entite-rgb">
        ${txt(cx, e1L1, 'RETOUR GAGNANT B\u00c9NIN', 34, '900', BLACK, 'middle', '2.5')}
        ${txt(cx, e1L2, '( R.G.B )', 24, '900', GOLD_D, 'middle', '6')}
      </g>

      ${ornamentLine(cx, sep1Y, 100, GOLD, 1.5)}

      <!-- ═══ ENTITÉ 2 : OUIDAH HERITAGE TOUR ═══ -->
      <g id="entite-oht">
        ${txt(cx, e2L1, 'OUIDAH HERITAGE TOUR', 34, '900', NAVY, 'middle', '2.5')}
        ${txt(cx, e2L2, '( O.H.T )', 24, '900', TERRACOTTA, 'middle', '6')}
      </g>

      ${ornamentLine(cx, sep2Y, 100, GOLD, 1.5)}

      <!-- ═══ ENTITÉ 3 : ASSOCIATION COLLECTIF SANKOFA TOUR ═══ -->
      <g id="entite-acst">
        ${txt(cx, e3L1, 'ASSOCIATION COLLECTIF', 28, '900', BLACK, 'middle', '2')}
        ${txt(cx, e3L2, 'SANKOFA TOUR', 34, '900', BLACK, 'middle', '3')}
        ${txt(cx, e3L3, '( A.C.S.T )', 24, '900', GOLD_D, 'middle', '6')}
      </g>

      <!-- ═══ GRAND SÉPARATEUR ═══ -->
      ${doubleLine(cx, sepMainY, 200, GOLD)}

      <!-- ═══ TITRE HORAIRES ═══ -->
      <g id="titre-horaires">
        ${txt(cx, horTitleY, 'HORAIRES & JOURS D\u2019OUVERTURE', 26, '900', NAVY_DEEP, 'middle', '3')}
      </g>

      ${ornamentLine(cx, sepHorY, 140, GOLD, 2)}

      <!-- ═══ TABLEAU HORAIRES ═══ -->
      <g id="tableau-horaires">
${tableSvg}
      </g>

      <!-- ═══ NOTES ═══ -->
      <g id="notes">
        ${txt(cx, noteSamY, 'Samedi : sur Rendez-vous uniquement', 14, '700', GOLD_D)}
        ${txt(cx, noteDimY, 'Dimanche & Jours f\u00e9ri\u00e9s : Ferm\u00e9', 14, '700', TERRACOTTA)}
      </g>

      <!-- ═══ CONTACTS ═══ -->
      <g id="contacts">
        ${txt(cx, contactY, 'T\u00e9l : +229 01 60 32 21 21  /  +229 01 94 35 50 50', 14, '800', BLACK)}
        ${txt(cx, adresseY, 'Haie-Vive Cocotiers, Carr\u00e9 N\u00b01158, Cotonou \u2014 B\u00c9NIN', 12, '700', BLACK)}
      </g>

    </g>

    <!-- REFLET SURFACE -->
    <g id="reflet" clip-path="url(#archClip)" opacity="0.1">
      <ellipse cx="${PW * 0.35}" cy="${ARCH_R * 0.6}" rx="${PW * 0.5}" ry="${ARCH_R * 0.65}" fill="${WHITE}"/>
    </g>

  </g>

  <g id="info-production">
    ${txt(pageW / 2, pageH - 5, 'PLEXIGLAS HORAIRES 80cm x 120cm - Trait de d\u00e9coupe = contour bleu marine - R.G.B / O.H.T / A.C.S.T - SVG vectoriel', 5, '400', '#999')}
  </g>
</svg>`
}

/* === PREVIEW === */
export async function generatePlexiglasHorairesSVG(): Promise<string> {
    return buildSVG()
}

/* === TELECHARGEMENT === */
export async function downloadPlexiglasHorairesSVG(): Promise<void> {
    const svg = await generatePlexiglasHorairesSVG()
    console.log(`[Plexiglas-Horaires] ${(svg.length / 1024).toFixed(0)} KB | 80cm x 120cm`)
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.download = 'Plexiglas-Horaires-80x120cm.svg'
    a.href = url
    a.click()
    URL.revokeObjectURL(url)
}
