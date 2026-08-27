/* Mesure REELLE de la largeur du mot-symbole dans Plus Jakarta Sans ExtraBold.
   Cinq tentatives ont echoue faute de mesure : la taille etait choisie a vue.
   Ici on lit les tables du fichier .ttf — head (unitsPerEm), cmap (caractere
   -> glyphe), hhea + hmtx (chasse de chaque glyphe). Meme calcul que le
   moteur de texte d Android. */
const fs = require('fs')

const CHEMIN = 'node_modules/@expo-google-fonts/plus-jakarta-sans/800ExtraBold/PlusJakartaSans_800ExtraBold.ttf'
const b = fs.readFileSync(CHEMIN)

// ── Repertoire des tables
const nbTables = b.readUInt16BE(4)
const tables = {}
for (let i = 0; i < nbTables; i++) {
    const o = 12 + i * 16
    tables[b.toString('ascii', o, o + 4)] = { debut: b.readUInt32BE(o + 8) }
}

const unitsPerEm = b.readUInt16BE(tables.head.debut + 18)
const numberOfHMetrics = b.readUInt16BE(tables.hhea.debut + 34)

// ── cmap, sous-table Windows Unicode BMP (3,1), format 4
const cm = tables.cmap.debut
let sous = 0
const nbEnc = b.readUInt16BE(cm + 2)
for (let i = 0; i < nbEnc; i++) {
    const o = cm + 4 + i * 8
    const plat = b.readUInt16BE(o), enc = b.readUInt16BE(o + 2)
    if (plat === 3 && (enc === 1 || enc === 10)) sous = cm + b.readUInt32BE(o + 4)
}
if (!sous) throw new Error('sous-table cmap (3,1) absente')
if (b.readUInt16BE(sous) !== 4) throw new Error('format cmap ' + b.readUInt16BE(sous) + ' non gere')

const segX2 = b.readUInt16BE(sous + 6)
const finS = sous + 14
const debutS = finS + segX2 + 2
const deltaS = debutS + segX2
const rangeS = deltaS + segX2

function glyphe(code) {
    for (let s = 0; s < segX2 / 2; s++) {
        const fin = b.readUInt16BE(finS + s * 2)
        if (code > fin) continue
        const deb = b.readUInt16BE(debutS + s * 2)
        if (code < deb) return 0
        const delta = b.readInt16BE(deltaS + s * 2)
        const range = b.readUInt16BE(rangeS + s * 2)
        if (range === 0) return (code + delta) & 0xffff
        const adr = rangeS + s * 2 + range + (code - deb) * 2
        const g = b.readUInt16BE(adr)
        return g === 0 ? 0 : (g + delta) & 0xffff
    }
    return 0
}

function chasse(code) {
    const g = glyphe(code)
    const i = Math.min(g, numberOfHMetrics - 1)
    return b.readUInt16BE(tables.hmtx.debut + i * 4)
}

/** Largeur en points de mise en page, interlettrage compris.
    Android ajoute l interlettrage APRES chaque caractere, dernier inclus. */
function largeur(texte, taille, interlettrage) {
    let u = 0
    for (const c of texte) u += chasse(c.codePointAt(0))
    return (u / unitsPerEm) * taille + interlettrage * [...texte].length
}

console.log('police        : Plus Jakarta Sans ExtraBold (unitsPerEm ' + unitsPerEm + ')')
console.log('')

const LARGEURS_APPAREIL = [320, 360, 390, 411, 428]
const INTER = 2

for (const mot of ['RETOUR GAGNANT', 'RETOUR', 'GAGNANT', 'BÉNIN']) {
    const l = []
    for (const t of [18, 20, 22, 24, 26, 30]) l.push(t + 'px=' + largeur(mot, t, INTER).toFixed(0) + 'dp')
    console.log(mot.padEnd(15) + ' ' + l.join('  '))
}

console.log('')
console.log('Place disponible (largeur ecran - 48 de marge) :')
for (const e of LARGEURS_APPAREIL) console.log('  ecran ' + e + 'dp -> ' + (e - 48) + 'dp utiles')

console.log('')
console.log('Verdict par taille, sur le mot le plus long de chaque disposition :')
for (const t of [18, 20, 22, 24, 26, 30]) {
    const uneLigne = largeur('RETOUR GAGNANT', t, INTER)
    const troisLignes = largeur('GAGNANT', t, INTER)
    const ok1 = LARGEURS_APPAREIL.filter(e => uneLigne <= e - 48).length
    const ok3 = LARGEURS_APPAREIL.filter(e => troisLignes <= e - 48).length
    console.log('  ' + String(t).padStart(2) + 'px : « RETOUR GAGNANT » ' + uneLigne.toFixed(0) + 'dp tient sur ' + ok1 + '/5 appareils'
        + '   |   « GAGNANT » seul ' + troisLignes.toFixed(0) + 'dp tient sur ' + ok3 + '/5')
}
