/* ═══════════════════════════════════════════════════════════
   Le billet en IMAGE et en PDF, rendus côté serveur.

   POURQUOI CÔTÉ SERVEUR. Les boutons « Télécharger l'image » et « Imprimer »
   de la page HTML ne font rien dans l'application : une WebView React Native
   n'a pas de gestionnaire de téléchargement, et `window.print()` n'y existe
   pas. Le bouton natif, lui, ne partageait qu'une URL — donc un lien, pas un
   billet. Un fichier réel doit venir de quelque part : il vient d'ici.

   POURQUOI PAS DE NAVIGATEUR SANS TÊTE. Rendre le HTML existant en image
   demanderait Chromium (~50 Mo) sur une fonction serverless, avec des
   démarrages à froid de plusieurs secondes à chaque billet. `sharp` (déjà
   présent) rastérise un SVG, et `jspdf` (déjà présent) écrit le PDF avec ses
   propres polices : aucune dépendance nouvelle.

   ⚠️ POLICES. `sharp` rastérise le texte SVG avec les polices du SYSTÈME, et
   une fonction serverless n'en embarque presque aucune. On ne nomme donc que
   des familles génériques, et on vérifie le rendu réel après déploiement — un
   billet dont le texte manque serait pire que pas d'image du tout.
═══════════════════════════════════════════════════════════ */
import sharp from 'sharp'
import { jsPDF } from 'jspdf'

export interface DonneesBillet {
    ticket_code: string
    full_name: string
    email: string
    phone: string
    ticket_type: string
    event_title: string
    event_date: string
    event_location: string
    /** PNG du QR, en data URI. */
    qr_uri: string
}

const VERT = '#008751'
const JAUNE = '#FCD116'
const ROUGE = '#E8112D'
const ENCRE = '#17201C'
const GRIS = '#8A8A8A'
const NUIT = '#111A15'

const L = 720   // largeur
const H = 1120  // hauteur

/** Le texte d'un billet ne doit jamais devenir du markup. */
function esc(v: string): string {
    return String(v || '').replace(/[&<>"']/g, c => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
    ))
}

/** Coupe un texte trop long pour la largeur donnée (approximation par caractère). */
function couper(texte: string, maxCar: number): string[] {
    const mots = String(texte || '').split(/\s+/).filter(Boolean)
    const lignes: string[] = []
    let courante = ''
    for (const mot of mots) {
        const essai = courante ? `${courante} ${mot}` : mot
        if (essai.length > maxCar && courante) { lignes.push(courante); courante = mot }
        else courante = essai
    }
    if (courante) lignes.push(courante)
    return lignes.slice(0, 3)
}

function svgBillet(d: DonneesBillet): string {
    const POLICE = "'DejaVu Sans','Liberation Sans',Arial,Helvetica,sans-serif"
    const MONO = "'DejaVu Sans Mono','Liberation Mono','Courier New',monospace"

    const titre = couper(d.event_title, 30)
    const titreSvg = titre.map((l, i) =>
        `<text x="86" y="${470 + i * 44}" font-family="${POLICE}" font-size="34" font-weight="bold" fill="${ENCRE}">${esc(l)}</text>`,
    ).join('')
    const apresTitre = 470 + (titre.length - 1) * 44

    const qrBase64 = d.qr_uri.includes(',') ? d.qr_uri.split(',')[1] : d.qr_uri

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${L}" height="${H}" viewBox="0 0 ${L} ${H}">
  <rect width="${L}" height="${H}" fill="#FFFFFF"/>

  <!-- Arête tricolore : la signature de l'agence, en structure et non en ornement -->
  <rect x="0" y="0" width="18" height="${Math.round(H * 0.42)}" fill="${VERT}"/>
  <rect x="0" y="${Math.round(H * 0.42)}" width="18" height="${Math.round(H * 0.16)}" fill="${JAUNE}"/>
  <rect x="0" y="${Math.round(H * 0.58)}" width="18" height="${Math.round(H * 0.14)}" fill="${ROUGE}"/>

  <text x="86" y="96" font-family="${POLICE}" font-size="19" font-weight="bold" letter-spacing="4" fill="${VERT}">RETOUR GAGNANT BÉNIN</text>

  <rect x="${L - 240}" y="68" width="176" height="42" fill="none" stroke="${ENCRE}" stroke-width="2"/>
  <text x="${L - 152}" y="96" font-family="${POLICE}" font-size="18" font-weight="bold" letter-spacing="3" fill="${ENCRE}" text-anchor="middle">${esc(d.ticket_type.toUpperCase())}</text>

  <text x="86" y="190" font-family="${POLICE}" font-size="17" font-weight="bold" letter-spacing="3" fill="${GRIS}">AU NOM DE</text>
  <text x="86" y="248" font-family="${POLICE}" font-size="42" font-weight="bold" fill="${ENCRE}">${esc(couper(d.full_name, 24)[0] || 'Invité')}</text>
  <text x="86" y="292" font-family="${POLICE}" font-size="24" fill="${GRIS}">${esc(d.email)}</text>
  ${d.phone ? `<text x="86" y="330" font-family="${POLICE}" font-size="24" fill="${GRIS}">${esc(d.phone)}</text>` : ''}

  <line x1="86" y1="376" x2="${L - 64}" y2="376" stroke="#E4E4E4" stroke-width="2"/>

  <text x="86" y="428" font-family="${POLICE}" font-size="17" font-weight="bold" letter-spacing="3" fill="${GRIS}">ÉVÉNEMENT</text>
  ${titreSvg}

  <text x="86" y="${apresTitre + 66}" font-family="${POLICE}" font-size="17" font-weight="bold" letter-spacing="3" fill="${GRIS}">DATE</text>
  <text x="86" y="${apresTitre + 108}" font-family="${POLICE}" font-size="27" font-weight="bold" fill="${ENCRE}">${esc(d.event_date)}</text>

  <text x="86" y="${apresTitre + 166}" font-family="${POLICE}" font-size="17" font-weight="bold" letter-spacing="3" fill="${GRIS}">LIEU</text>
  <text x="86" y="${apresTitre + 208}" font-family="${POLICE}" font-size="27" font-weight="bold" fill="${ENCRE}">${esc(couper(d.event_location, 34)[0] || '')}</text>

  <!-- Perforation : la souche se détache ici -->
  <line x1="0" y1="${H - 366}" x2="${L}" y2="${H - 366}" stroke="#C9D2CC" stroke-width="3" stroke-dasharray="12 10"/>
  <circle cx="0" cy="${H - 366}" r="22" fill="#FFFFFF"/>
  <circle cx="${L}" cy="${H - 366}" r="22" fill="#FFFFFF"/>

  <rect x="0" y="${H - 364}" width="${L}" height="364" fill="${NUIT}"/>
  <rect x="${L / 2 - 130}" y="${H - 330}" width="260" height="260" fill="#FFFFFF"/>
  <image x="${L / 2 - 118}" y="${H - 318}" width="236" height="236"
         href="data:image/png;base64,${qrBase64}" />
  <text x="${L / 2}" y="${H - 34}" font-family="${MONO}" font-size="30" font-weight="bold" letter-spacing="2" fill="#FFFFFF" text-anchor="middle">${esc(d.ticket_code)}</text>
</svg>`
}

/** Le billet en PNG. */
export async function billetEnPng(d: DonneesBillet): Promise<Buffer> {
    return sharp(Buffer.from(svgBillet(d)))
        .png({ compressionLevel: 9 })
        .toBuffer()
}

/**
 * Le billet en PDF, format A4 portrait.
 *
 * L'image PNG est posée dans la page plutôt que redessinée en vecteur : le PDF
 * reste ainsi RIGOUREUSEMENT identique à l'image, et un seul dessin est à
 * maintenir. Le PDF est le format qu'on garde et qu'on imprime — c'est aussi
 * lui qu'on joint à l'email, comme le fait toute billetterie.
 */
export async function billetEnPdf(d: DonneesBillet): Promise<Buffer> {
    const png = await billetEnPng(d)
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })

    // A4 = 210 × 297 mm. On centre en gardant les proportions du billet.
    const margeX = 20
    const largeur = 210 - margeX * 2
    const hauteur = largeur * (H / L)
    const y = (297 - hauteur) / 2

    pdf.addImage(
        `data:image/png;base64,${png.toString('base64')}`,
        'PNG', margeX, y, largeur, hauteur, undefined, 'FAST',
    )
    return Buffer.from(pdf.output('arraybuffer'))
}
