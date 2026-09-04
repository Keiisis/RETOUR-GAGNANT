/* ═══════════════════════════════════════════════════════════════
   FABRICATION DU MOT-SYMBOLE DE L ECRAN DE DEMARRAGE

   Sept corrections successives ont echoue a afficher « RETOUR GAGNANT
   BÉNIN » en entier sur Android. A chaque fois le moteur de texte mesurait
   la vue plus etroite que ce qu il y dessinait et coupait la fin :
   « RETOU », « GAGNAN », « BÉNI », et l accroche amputee de son dernier mot.

   Un logotype n a pas a etre du texte vivant. Ce script le transforme en
   image : les contours des glyphes sont lus dans le fichier de police et
   ecrits comme des chemins vectoriels. Le resultat ne depend plus d aucune
   police au moment de l execution — il ne peut etre ni remesure, ni
   recompose, ni rogne.

   Relancer apres toute modification du libelle ou des couleurs :
       node scripts/generer-mot-symbole.js

   NOTE TECHNIQUE : on passe par `charToGlyph`, jamais par les fonctions de
   chaine d opentype.js. Ces dernieres traversent les tables de substitution
   de la police et echouent dessus (« substFormat: 2 is not yet supported »).
   Au niveau du glyphe, aucune substitution n est tentee.
   ═══════════════════════════════════════════════════════════════ */

const fs = require('fs')
const opentype = require('opentype.js')
const sharp = require('sharp')

const POLICE_MARQUE = 'node_modules/@expo-google-fonts/plus-jakarta-sans/800ExtraBold/PlusJakartaSans_800ExtraBold.ttf'
const POLICE_ACCROCHE = 'node_modules/@expo-google-fonts/plus-jakarta-sans/500Medium/PlusJakartaSans_500Medium.ttf'
const SORTIE = 'assets/mot-symbole.png'

/* Dessin a 3x la taille d affichage : net sur les ecrans a forte densite
   sans peser lourd. */
const ECHELLE = 3
const TAILLE_MARQUE = 30 * ECHELLE
const TAILLE_ACCROCHE = 12 * ECHELLE
const INTERLIGNE = 36 * ECHELLE
const ESPACE_MOTS = 11 * ECHELLE
const ECART_ACCROCHE = 18 * ECHELLE
const TRACKING_ACCROCHE = 2.6 * ECHELLE
/* Marge de securite tout autour : absorbe les debordements de contour des
   glyphes (le « R » deborde legerement de sa chasse). */
const MARGE = 8 * ECHELLE

const VERT = '#008751'
const JAUNE = '#FCD116'
const ROUGE = '#E8112D'
const GRIS = '#505050'

const charger = (p) => opentype.parse(fs.readFileSync(p).buffer)
const marque = charger(POLICE_MARQUE)
const medium = charger(POLICE_ACCROCHE)

/** Largeur d un texte dessine lettre par lettre.
    Le dernier ecartement n est PAS compte : il ne suit aucune lettre. */
function largeur(font, texte, taille, ecart = 0) {
    const echelle = taille / font.unitsPerEm
    let l = 0
    for (const c of texte) l += font.charToGlyph(c).advanceWidth * echelle
    return l + ecart * Math.max(0, [...texte].length - 1)
}

/** Chemin SVG d un texte, lettre par lettre. */
function chemin(font, texte, x, y, taille, ecart = 0) {
    const echelle = taille / font.unitsPerEm
    let curseur = x
    const morceaux = []
    for (const c of texte) {
        const g = font.charToGlyph(c)
        if (c !== ' ') morceaux.push(g.getPath(curseur, y, taille).toPathData(2))
        curseur += g.advanceWidth * echelle + ecart
    }
    return morceaux.join(' ')
}

// ── Composition
const MOT1 = 'RETOUR', MOT2 = 'GAGNANT', MOT3 = 'BÉNIN'
const ACCROCHE = "L'ACCOMPAGNEMENT PREMIUM"

const l1a = largeur(marque, MOT1, TAILLE_MARQUE)
const l1b = largeur(marque, MOT2, TAILLE_MARQUE)
const l1 = l1a + ESPACE_MOTS + l1b
const l2 = largeur(marque, MOT3, TAILLE_MARQUE)
const l3 = largeur(medium, ACCROCHE, TAILLE_ACCROCHE, TRACKING_ACCROCHE)

const LARGEUR = Math.ceil(Math.max(l1, l2, l3) + MARGE * 2)

const hauteurCap = (marque.tables.os2.sCapHeight / marque.unitsPerEm) * TAILLE_MARQUE
const baseLigne1 = MARGE + hauteurCap
const baseLigne2 = baseLigne1 + INTERLIGNE
const baseAccroche = baseLigne2 + ECART_ACCROCHE + TAILLE_ACCROCHE * 0.72
const HAUTEUR = Math.ceil(baseAccroche + MARGE)

const chemins = [
    `<path fill="${VERT}" d="${chemin(marque, MOT1, (LARGEUR - l1) / 2, baseLigne1, TAILLE_MARQUE)}"/>`,
    `<path fill="${JAUNE}" d="${chemin(marque, MOT2, (LARGEUR - l1) / 2 + l1a + ESPACE_MOTS, baseLigne1, TAILLE_MARQUE)}"/>`,
    `<path fill="${ROUGE}" d="${chemin(marque, MOT3, (LARGEUR - l2) / 2, baseLigne2, TAILLE_MARQUE)}"/>`,
    `<path fill="${GRIS}" d="${chemin(medium, ACCROCHE, (LARGEUR - l3) / 2, baseAccroche, TAILLE_ACCROCHE, TRACKING_ACCROCHE)}"/>`,
]

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${LARGEUR}" height="${HAUTEUR}" viewBox="0 0 ${LARGEUR} ${HAUTEUR}">${chemins.join('')}</svg>`

sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(SORTIE).then((info) => {
    const poids = (fs.statSync(SORTIE).size / 1024).toFixed(1)
    console.log('image     : ' + SORTIE)
    console.log('pixels    : ' + info.width + ' x ' + info.height)
    console.log('affichage : ' + Math.round(info.width / ECHELLE) + ' x ' + Math.round(info.height / ECHELLE) + ' dp')
    console.log('poids     : ' + poids + ' Ko')
    console.log('')
    console.log('Style React Native correspondant :')
    console.log('    width: ' + Math.round(info.width / ECHELLE) + ', height: ' + Math.round(info.height / ECHELLE))
})
