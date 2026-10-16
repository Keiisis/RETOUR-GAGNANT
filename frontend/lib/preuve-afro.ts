/* ══════════════════════════════════════════════════════════════════
   PREUVE D'AFRO-DESCENDANCE & COMPOSITION FAMILIALE

   Document A4 établi par Retour Gagnant Bénin à partir des pièces d'état
   civil communiquées par le demandeur. Rempli depuis l'onglet « Demandes
   de Nationalité » : pré-rempli avec un dossier de la plateforme, ou vierge
   pour un client qui n'y est pas inscrit.

   Rendu : HTML + SVG imprimé par le navigateur (« Enregistrer en PDF »).
   Texte vectoriel et sélectionnable, polices du site (public/fonts/preuve).
   Aucune donnée n'est inventée : un champ vide n'est pas affiché.
   ══════════════════════════════════════════════════════════════════ */

export type Branche = 'Paternelle' | 'Maternelle'

export interface Ascendant {
    branche: Branche
    nom: string
    prenoms: string
    surnom: string
    naissance: string
    deces: string
    profession: string
    filiation: string
}

export interface Parent {
    nom: string
    prenoms: string
    nomOrigine: string
    naissance: string
    profession: string
    filiation: string
}

export interface MaillonLignee {
    generation: string
    branche: string
    identite: string
    mentions: string
}

export interface PreuveAfro {
    ref: string
    date: string
    statut: string
    civilite: 'M.' | 'Mme'
    demandeur: {
        nom: string; prenoms: string; naissance: string; nationalite: string
        piece: string; profession: string; residence: string
    }
    foyer: { situation: string; filiation: string; conjoint: string; enfants: string }
    pere: Parent
    mere: Parent
    grandsParents: Ascendant[]
    brancheLignee: 'Maternelle' | 'Paternelle' | 'Les deux'
    lignee: MaillonLignee[]
    noteAscendance: string
    noteInstruction: string
    cadreLegal: string
    signataire: string
    cachet: boolean
}

const CADRE_LEGAL = "Conformément aux dispositions de la loi n° 2024-31 du 02 septembre 2024 relative à la reconnaissance de la nationalité béninoise aux Afro-descendants, toute personne disposant d'éléments d'état civil probants attestant de sa filiation avec des ancêtres déportés dans le cadre de la traite transatlantique peut solliciter la nationalité béninoise. Le présent document présente la filiation et la composition familiale du demandeur telles qu'elles résultent des pièces communiquées."

const parentVide = (): Parent => ({ nom: '', prenoms: '', nomOrigine: '', naissance: '', profession: '', filiation: '' })
export const ascendantVide = (branche: Branche = 'Maternelle'): Ascendant =>
    ({ branche, nom: '', prenoms: '', surnom: '', naissance: '', deces: '', profession: '', filiation: '' })
export const maillonVide = (): MaillonLignee => ({ generation: '4e génération', branche: '', identite: '', mentions: '' })

const dateLongue = (v?: string | null): string => {
    const s = String(v || '').trim()
    if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return s
    const d = new Date(`${s.slice(0, 10)}T12:00:00Z`)
    return isNaN(d.getTime()) ? s : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}
const aujourdHui = () => dateLongue(new Date().toISOString())

export function preuveVierge(): PreuveAfro {
    return {
        ref: `RGB-NAT-${new Date().getFullYear()}-`,
        date: aujourdHui(),
        statut: 'Demandeur principal',
        civilite: 'M.',
        demandeur: { nom: '', prenoms: '', naissance: '', nationalite: '', piece: '', profession: '', residence: '' },
        foyer: { situation: '', filiation: '', conjoint: '', enfants: '' },
        pere: parentVide(),
        mere: parentVide(),
        grandsParents: [],
        brancheLignee: 'Maternelle',
        lignee: [],
        noteAscendance: '',
        noteInstruction: '',
        cadreLegal: CADRE_LEGAL,
        signataire: 'Le Pôle Dossiers & Instruction',
        cachet: true,
    }
}

/** Champs d'une demande `nationality_applications` utiles au document. */
export interface DossierSource {
    application_ref?: string | null
    nom?: string | null; prenom?: string | null; genre?: string | null
    date_naissance?: string | null; ville_naissance?: string | null; pays_naissance?: string | null
    nationalite?: string | null; profession?: string | null
    adresse_residence?: string | null; pays_residence?: string | null
    type_document_identite?: string | null; numero_document?: string | null
    pere_nom?: string | null; pere_prenom?: string | null; pere_date_naissance?: string | null
    mere_nom?: string | null; mere_prenom?: string | null; mere_date_naissance?: string | null
    afro_descendant_description?: string | null
    ancestor1_nom?: string | null; ancestor1_prenom?: string | null; ancestor1_lien_parente?: string | null
    ancestor1_nationalite?: string | null; ancestor1_pays_residence?: string | null
    ancestor2_nom?: string | null; ancestor2_prenom?: string | null; ancestor2_lien_parente?: string | null
    ancestor2_nationalite?: string | null
}

const t = (v?: string | null) => String(v ?? '').trim()
const lieu = (ville?: string | null, pays?: string | null) =>
    t(ville) && t(pays) ? `${t(ville)} (${t(pays)})` : t(ville) || t(pays)

/** Pré-remplit le document avec une demande de la plateforme. */
export function preuveDepuisDossier(a: DossierSource): PreuveAfro {
    const p = preuveVierge()
    const femme = /^f/i.test(t(a.genre))
    p.ref = t(a.application_ref) || p.ref
    p.civilite = femme ? 'Mme' : 'M.'
    const naissance = [dateLongue(a.date_naissance), lieu(a.ville_naissance, a.pays_naissance)].filter(Boolean)
    const piece = t(a.numero_document)
        ? `${/cni|carte/i.test(t(a.type_document_identite)) ? "Carte nationale d'identité" : 'Passeport'} n° ${t(a.numero_document)}`
        : ''
    p.demandeur = {
        nom: t(a.nom).toUpperCase(),
        prenoms: t(a.prenom),
        naissance: naissance.join(' à '),
        nationalite: t(a.nationalite),
        piece,
        profession: t(a.profession),
        residence: [t(a.adresse_residence), t(a.pays_residence)].filter(Boolean).join(', '),
    }
    p.pere = { ...parentVide(), nom: t(a.pere_nom).toUpperCase(), prenoms: t(a.pere_prenom), naissance: dateLongue(a.pere_date_naissance) }
    p.mere = { ...parentVide(), nom: t(a.mere_nom).toUpperCase(), prenoms: t(a.mere_prenom), naissance: dateLongue(a.mere_date_naissance) }
    p.noteAscendance = t(a.afro_descendant_description)

    // Ascendants déclarés : grands-parents → section 4, au-delà → lignée.
    const ascendants = [
        { nom: a.ancestor1_nom, prenom: a.ancestor1_prenom, lien: a.ancestor1_lien_parente, nat: a.ancestor1_nationalite, pays: a.ancestor1_pays_residence },
        { nom: a.ancestor2_nom, prenom: a.ancestor2_prenom, lien: a.ancestor2_lien_parente, nat: a.ancestor2_nationalite, pays: null },
    ]
    for (const x of ascendants) {
        if (!t(x.nom) && !t(x.prenom)) continue
        const lien = t(x.lien)
        if (/^(p[èe]re|m[èe]re)$/i.test(lien)) continue // déjà en section 3
        const branche: Branche = /patern/i.test(lien) ? 'Paternelle' : 'Maternelle'
        const mentions = [lien, t(x.nat) && `Nationalité : ${t(x.nat)}`, t(x.pays) && `Résidence : ${t(x.pays)}`].filter(Boolean).join(' · ')
        if (/^grand/i.test(lien)) {
            p.grandsParents.push({ ...ascendantVide(branche), nom: t(x.nom).toUpperCase(), prenoms: t(x.prenom), filiation: mentions })
        } else {
            p.lignee.push({ generation: /arri[èe]re/i.test(lien) ? '4e génération' : 'Ascendant', branche: /patern|matern/i.test(lien) ? branche : '', identite: [t(x.prenom), t(x.nom).toUpperCase()].filter(Boolean).join(' '), mentions })
        }
    }
    if (p.grandsParents.some(g => g.branche === 'Paternelle') && !p.grandsParents.some(g => g.branche === 'Maternelle')) p.brancheLignee = 'Paternelle'
    return p
}

// ─── Rendu ──────────────────────────────────────────────────────────

const e = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
const nomComplet = (prenoms: string, nom: string) => [prenoms, nom].map(t).filter(Boolean).join(' ')

/** Ligne « libellé : valeur », omise si la valeur est vide. */
const ligne = (libelle: string, valeur: string) => t(valeur) ? `<div class="ligne"><dt>${e(libelle)}</dt><dd>${e(valeur)}</dd></div>` : ''

/** Graines déterministes : le crépi de peinture est identique d'un rendu à l'autre. */
function pulverisation(n: number, graine: number, l: number, h: number, couleur: string): string {
    let s = graine
    const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647 }
    let out = ''
    for (let i = 0; i < n; i++) {
        // Concentration autour d'un foyer, retombées clairsemées.
        const ang = r() * Math.PI * 2, dist = Math.pow(r(), 1.8)
        const x = l / 2 + Math.cos(ang) * dist * l / 2, y = h / 2 + Math.sin(ang) * dist * h / 2
        out += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(0.3 + r() * (dist < 0.3 ? 2.2 : 1.1)).toFixed(2)}" fill="${couleur}" opacity="${(0.25 + r() * 0.6).toFixed(2)}"/>`
    }
    return out
}

function carteParent(lien: string, p: Parent): string {
    const nom = nomComplet(p.prenoms, p.nom)
    if (!nom && !p.naissance) return ''
    return `<article class="carte">
        <span class="lien">${e(lien)}</span>
        <h4>${e(nom || '—')}</h4>
        ${t(p.nomOrigine) ? `<p class="origine">initialement ${e(p.nomOrigine)}</p>` : ''}
        <dl>${ligne('Naissance', p.naissance)}${ligne('Profession', p.profession)}${ligne('Filiation', p.filiation)}</dl>
    </article>`
}

function carteAscendant(g: Ascendant): string {
    const nom = nomComplet(g.prenoms, g.nom)
    return `<article class="carte ${g.branche === 'Paternelle' ? 'paternelle' : 'maternelle'}">
        <span class="lien">Branche ${e(g.branche.toLowerCase())}</span>
        <h4>${e(nom || '—')}${t(g.surnom) ? ` <span class="surnom">« ${e(g.surnom)} »</span>` : ''}</h4>
        <dl>${ligne('Naissance', g.naissance)}${ligne('Décès', g.deces)}${ligne('Profession', g.profession)}${ligne('Filiation', g.filiation)}</dl>
    </article>`
}

/** Racines : le demandeur en haut, les générations descendent comme les racines du logo. */
function racines(d: PreuveAfro): string {
    const maternelle = d.brancheLignee !== 'Paternelle'
    const paternelle = d.brancheLignee !== 'Maternelle'
    const parents = [paternelle ? nomComplet(d.pere.prenoms, d.pere.nom) : '', maternelle ? nomComplet(d.mere.prenoms, d.mere.nom) : ''].filter(Boolean)
    const gp = d.grandsParents
        .filter(g => (g.branche === 'Maternelle' ? maternelle : paternelle))
        .map(g => nomComplet(g.prenoms, g.nom)).filter(Boolean)
    const niveaux: { gen: string; noms: string[] }[] = [
        { gen: 'Demandeur', noms: [nomComplet(d.demandeur.prenoms, d.demandeur.nom)].filter(Boolean) },
        { gen: '2e génération', noms: parents },
        { gen: '3e génération', noms: gp },
    ]
    const autres = new Map<string, string[]>()
    for (const m of d.lignee) {
        if (!t(m.identite)) continue
        const g = t(m.generation) || 'Ascendant'
        autres.set(g, [...(autres.get(g) || []), m.identite])
    }
    for (const [gen, noms] of autres) niveaux.push({ gen, noms })
    const pleins = niveaux.filter(n => n.noms.length)
    if (pleins.length < 2) return ''
    const lien = `<svg class="racine" viewBox="0 0 120 34" aria-hidden="true"><path d="M60 0 C60 12 58 18 60 34" /><path d="M60 14 C52 20 44 22 36 30" /><path d="M60 16 C69 21 78 24 86 31" /><path d="M59 24 C55 27 52 29 50 33" /></svg>`
    return `<div class="arbre">${pleins.map((n, i) => `${i ? lien : ''}<div class="niveau"><span class="gen">${e(n.gen)}</span><div class="noms">${n.noms.map(x => `<span class="nom">${e(x)}</span>`).join('')}</div></div>`).join('')}</div>`
}

/** Document complet, prêt à être imprimé (srcdoc d'un iframe). */
export function htmlPreuve(d: PreuveAfro, origine = ''): string {
    const nom = nomComplet(d.demandeur.prenoms, d.demandeur.nom)
    const filiation = t(d.foyer.filiation) || (nomComplet(d.pere.prenoms, d.pere.nom) || nomComplet(d.mere.prenoms, d.mere.nom)
        ? `${d.civilite === 'Mme' ? 'Fille reconnue' : 'Fils reconnu'} de ${[nomComplet(d.pere.prenoms, d.pere.nom) && `M. ${nomComplet(d.pere.prenoms, d.pere.nom)}`, nomComplet(d.mere.prenoms, d.mere.nom) && `Mme ${nomComplet(d.mere.prenoms, d.mere.nom)}`].filter(Boolean).join(' et de ')}.`
        : '')
    const enfants = t(d.foyer.enfants).split(/\r?\n/).map(t).filter(Boolean)
    const parents = carteParent('Père', d.pere) + carteParent('Mère', d.mere)
    const gp = d.grandsParents.filter(g => t(g.nom) || t(g.prenoms)).map(carteAscendant).join('')
    const lignee = d.lignee.filter(m => t(m.identite))
    const arbre = racines(d)
    const brancheTitre = d.brancheLignee === 'Les deux' ? 'branches paternelle et maternelle' : `branche ${d.brancheLignee.toLowerCase()}`
    let n = 0
    const titre = (texte: string) => `<h3><span class="num">${String(++n).padStart(2, '0')}</span>${e(texte)}</h3>`
    const f = (fichier: string) => `${origine}/fonts/preuve/${fichier}`
    const img = (fichier: string) => `${origine}/images/${fichier}`

    return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<title>${e(`PREUVE_AFRO_DESCENDANCE_${[d.demandeur.nom, d.demandeur.prenoms.split(/\s+/)[0]].map(t).filter(Boolean).join('_').toUpperCase().replace(/\s+/g, '_') || 'CLIENT'}`)}</title>
<style>
/* Hallmark · document: preuve d'afro-descendance · tone: luxe institutionnel + tag graffiti
 * theme: custom (logo RGB : nuit · or · racine) · display: Fraunces · body: Geist · tag: Sedgwick Ave Display */
@font-face{font-family:"Fraunces";src:url("${f('fraunces-normal-400-900.woff2')}") format("woff2");font-weight:400 900;font-style:normal}
@font-face{font-family:"Geist";src:url("${f('geist-normal-300-700.woff2')}") format("woff2");font-weight:300 700}
@font-face{font-family:"Sedgwick";src:url("${f('sedgwick-ave-display.woff2')}") format("woff2")}
:root{
  --nuit:#0F2350; --nuit-2:#0A1838; --or:#E2AE22; --or-clair:#F3DE9C; --racine:#9C3A1C;
  --vert:#1E7A3C; --benin-vert:#008751; --benin-jaune:#FCD116; --benin-rouge:#E8112D;
  --papier:#FBF8F1; --carte:#FFFFFF; --encre:#1A1D26; --encre-2:#5A606C; --filet:#E6DDC8;
  --font-titre:"Fraunces",Georgia,serif; --font-texte:"Geist",system-ui,sans-serif; --font-tag:"Sedgwick","Fraunces",cursive;
}
@page{size:A4;margin:12mm 0 14mm;background:#FBF8F1;
  @bottom-left{content:"Retour Gagnant Bénin · Réf. ${d.ref.replace(/[^\w\- ]/g, '')}";font:500 7.5pt "Geist",sans-serif;color:#8a8f99;padding-left:16mm}
  @bottom-right{content:"Page " counter(page) " / " counter(pages);font:500 7.5pt "Geist",sans-serif;color:#8a8f99;padding-right:16mm}}
@page :first{margin-top:0}
*{box-sizing:border-box;margin:0;padding:0}
html,body{overflow-x:clip}
body{font-family:var(--font-texte);color:var(--encre);background:var(--papier);font-size:9.2pt;line-height:1.45;-webkit-print-color-adjust:exact;print-color-adjust:exact}
@media screen{body{background:#cfc8b8;padding:24px 12px}.feuille{width:210mm;min-height:297mm;margin:0 auto;box-shadow:0 18px 50px rgba(10,24,56,.25)}}
.feuille{background:var(--papier);position:relative;overflow:hidden}
.filigrane{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:0}
.filigrane img{width:120mm;opacity:.045;filter:grayscale(1)}
main{position:relative;z-index:1;padding:0 16mm 10mm}

/* Bandeau */
.bandeau{position:relative;background:var(--nuit);color:#fff;padding:9mm 16mm 9mm;overflow:hidden;z-index:1}
.bandeau .crepi{position:absolute;inset:0;width:100%;height:100%}
.bandeau .haut{position:relative;display:flex;justify-content:space-between;align-items:flex-start;gap:8mm}
.marque{display:flex;align-items:center;gap:5mm}
.marque img{width:22mm;height:22mm;object-fit:contain}
.tag{font-family:var(--font-tag);font-size:29pt;line-height:.95;white-space:nowrap;color:var(--or);transform:rotate(-5deg);display:block;text-shadow:0 0 1px rgba(226,174,34,.4)}
.tagbox .sous{display:block;margin-top:3.5mm;font-size:7.5pt;letter-spacing:.42em;text-transform:uppercase;color:var(--or-clair)}
.tagbox{position:relative}
.coulures{position:absolute;left:0;top:9.5mm;width:76mm;height:12mm;transform:rotate(-5deg);transform-origin:left top}
.meta{text-align:right;font-size:8pt;line-height:1.7;color:#dfe5f2;max-width:82mm}
.meta .type span{white-space:nowrap}
.meta b{color:var(--or);font-weight:600;letter-spacing:.06em;text-transform:uppercase;font-size:7pt;margin-right:1.5mm}
.meta .type{color:#fff;font-weight:600;font-size:8.4pt;margin-bottom:1.5mm;line-height:1.35}
.drapeau{height:2.2mm;display:grid;grid-template-columns:2fr 3fr;position:relative;z-index:1}
.drapeau i{display:block;background:var(--benin-vert)}
.drapeau span{display:grid;grid-template-rows:1fr 1fr}
.drapeau span i:first-child{background:var(--benin-jaune)}.drapeau span i:last-child{background:var(--benin-rouge)}

/* Titre */
.titre{padding:6mm 0 3.5mm;position:relative}
.titre h1{font-family:var(--font-titre);font-weight:700;font-size:24pt;line-height:1.05;color:var(--nuit);letter-spacing:-.01em}
.titre h1 span{display:block;font-weight:400;font-size:15pt;color:var(--racine);margin-top:1.5mm;letter-spacing:0}
.titre .trait{display:block;width:74mm;height:5mm;margin-top:1mm}
.titre .qui{margin-top:3mm;font-size:10pt;color:var(--encre-2)}
.titre .qui strong{color:var(--encre);font-weight:600}
.cadre{border-left:1.2mm solid var(--or);background:rgba(226,174,34,.07);padding:3mm 4.5mm;font-size:8.2pt;color:#3e434e;line-height:1.6}
.cadre b{color:var(--nuit)}

/* Sections */
section{margin-top:5.5mm;break-inside:auto}
h3{font-family:var(--font-titre);font-weight:600;font-size:13pt;color:var(--nuit);display:flex;align-items:baseline;gap:3mm;padding-bottom:2mm;border-bottom:.3mm solid var(--filet);margin-bottom:3mm;break-after:avoid}
h3 .num{font-family:var(--font-tag);color:var(--or);font-size:15pt;font-weight:400;transform:rotate(-6deg);display:inline-block;min-width:9mm}
.demandeur{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.5fr);gap:6mm;align-items:start}
.demandeur .nomfort{font-family:var(--font-titre);font-weight:700;font-size:17pt;line-height:1.1;color:var(--encre);overflow-wrap:anywhere}
.demandeur .nomfort small{display:block;font-family:var(--font-texte);font-weight:500;font-size:8pt;letter-spacing:.2em;text-transform:uppercase;color:var(--vert);margin-top:2mm}
dl .ligne{display:grid;grid-template-columns:30mm minmax(0,1fr);gap:3mm;padding:1mm 0;border-bottom:.2mm dashed var(--filet)}
dl .ligne:last-child{border-bottom:0}
dt{font-size:7.4pt;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--encre-2);padding-top:.4mm}
dd{overflow-wrap:anywhere}
.grille{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:4mm}
.carte{background:var(--carte);border:.3mm solid var(--filet);border-radius:2.2mm;padding:3mm 4mm;break-inside:avoid;position:relative}
.carte .lien{display:inline-block;font-size:6.8pt;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--nuit);background:var(--or-clair);padding:.6mm 2.2mm;border-radius:1mm}
.carte.paternelle .lien{background:#dceadf;color:var(--vert)}
.carte h4{font-family:var(--font-titre);font-weight:600;font-size:11.5pt;margin:1.8mm 0 1mm;color:var(--encre);overflow-wrap:anywhere}
.carte .surnom{font-family:var(--font-texte);font-weight:400;font-size:9pt;color:var(--encre-2)}
.carte .origine{font-size:8pt;color:var(--encre-2);margin:-1mm 0 1.5mm}
.carte dl .ligne{grid-template-columns:20mm minmax(0,1fr)}
.note{margin-top:4mm;font-size:8.8pt;color:#3e434e;padding:3mm 4mm;border-radius:2mm;background:rgba(15,35,80,.05);break-inside:avoid}
.note b{color:var(--nuit)}

/* Racines */
.arbre{display:flex;flex-direction:column;align-items:center;padding:1mm 0 1mm;break-inside:avoid;position:relative}
.niveau{display:flex;flex-direction:column;align-items:center;gap:1.5mm}
.gen{font-size:6.8pt;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--racine)}
.noms{display:flex;flex-wrap:wrap;justify-content:center;gap:2mm}
.nom{font-family:var(--font-titre);font-weight:600;font-size:9.5pt;color:#fff;background:var(--nuit);padding:1.3mm 3.6mm;border-radius:10mm;box-shadow:inset 0 0 0 .5mm rgba(226,174,34,.6)}
.racine{width:30mm;height:7mm;margin:.3mm 0}
.racine path{fill:none;stroke:var(--racine);stroke-width:2.2;stroke-linecap:round}
.crepi-racines{position:absolute;right:0;top:0;width:40mm;height:30mm;pointer-events:none}
table{width:100%;border-collapse:collapse;margin-top:3mm;font-size:8.8pt;break-inside:auto}
th{background:var(--nuit);color:#fff;text-align:left;font-size:7pt;letter-spacing:.14em;text-transform:uppercase;font-weight:600;padding:2.2mm 3mm}
td{padding:2mm 3mm;border-bottom:.25mm solid var(--filet);vertical-align:top;overflow-wrap:anywhere}
tr{break-inside:avoid}
td.id{font-family:var(--font-titre);font-weight:600;font-size:10pt}
td.gen-c{color:var(--racine);font-weight:600;white-space:nowrap}

/* Clôture */
.cloture{margin-top:7mm;display:grid;grid-template-columns:minmax(0,1fr) 62mm;gap:8mm;align-items:end;break-inside:avoid}
.instruction{font-size:8.8pt;color:#3e434e;border-top:.3mm solid var(--filet);padding-top:3mm}
.instruction b{color:var(--nuit)}
.signature{position:relative;text-align:left;padding-top:3mm;border-top:.8mm solid var(--vert)}
.signature .org{font-family:var(--font-titre);font-weight:700;font-size:11pt;color:var(--vert)}
.signature .pole{font-size:8.4pt;color:var(--encre-2)}
.signature .fait{font-size:8pt;color:var(--encre-2);margin-top:1.5mm}
.signature img{position:absolute;right:2mm;top:-31mm;width:32mm;transform:rotate(-12deg);opacity:.92;mix-blend-mode:multiply}
.avert{margin-top:6mm;font-size:7pt;color:#8a8f99;line-height:1.5}
</style></head><body><div class="feuille">
<div class="filigrane"><img src="${img('logo-preuve.png')}" alt=""></div>

<header class="bandeau">
  <svg class="crepi" viewBox="0 0 800 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <g transform="translate(470 -40)">${pulverisation(260, 7, 360, 220, '#E2AE22')}</g>
    <g transform="translate(-60 170)">${pulverisation(160, 31, 300, 170, '#1E7A3C')}</g>
    <path d="M520 268 C600 240 690 262 812 226" stroke="#E2AE22" stroke-width="3" fill="none" opacity=".35" stroke-linecap="round"/>
  </svg>
  <div class="haut">
    <div class="marque">
      <img src="${img('logo-preuve.png')}" alt="Logo Retour Gagnant Bénin">
      <div class="tagbox"><span class="tag">Retour Gagnant</span>
        <svg class="coulures" viewBox="0 0 250 40" aria-hidden="true"><g fill="#E2AE22" opacity=".85">
          <path d="M5 0 h4 v22 a2 2 0 0 1 -4 0z"/><circle cx="7" cy="30" r="2"/>
          <path d="M84 0 h3 v12 a1.5 1.5 0 0 1 -3 0z"/>
          <path d="M113 0 h4 v27 a2 2 0 0 1 -4 0z"/><circle cx="115" cy="35" r="2.3"/>
          <path d="M203 0 h3 v9 a1.5 1.5 0 0 1 -3 0z"/></g></svg>
        <span class="sous">Bénin</span></div>
    </div>
    <div class="meta">
      <div class="type">Dossier de demande de nationalité par <span>afro-descendance</span></div>
      <div><b>Réf. dossier</b>${e(d.ref)}</div>
      <div><b>Date</b>${e(d.date)}</div>
      <div><b>Statut</b>${e(d.statut)}</div>
    </div>
  </div>
</header>
<div class="drapeau"><i></i><span><i></i><i></i></span></div>

<main>
  <div class="titre">
    <h1>Preuve d'afro-descendance<span>&amp; composition familiale</span></h1>
    <svg class="trait" viewBox="0 0 300 20" preserveAspectRatio="none" aria-hidden="true"><path d="M2 13 C60 5 130 16 200 9 S280 6 298 10" stroke="#E2AE22" stroke-width="5" fill="none" stroke-linecap="round" opacity=".9"/><path d="M40 15 C110 11 170 17 260 12" stroke="#9C3A1C" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".6"/></svg>
    ${nom ? `<p class="qui"><strong>${e(d.civilite)} ${e(nom)}</strong> · demandeur${d.civilite === 'Mme' ? 'esse' : ''} de la nationalité béninoise</p>` : ''}
  </div>
  ${t(d.cadreLegal) ? `<div class="cadre"><b>Cadre légal et réglementaire.</b> ${e(d.cadreLegal)}</div>` : ''}

  <section>
    ${titre(d.civilite === 'Mme' ? 'La demandeuse principale' : 'Le demandeur principal')}
    <div class="demandeur">
      <div class="nomfort">${e(d.demandeur.nom || '—')}<br>${e(d.demandeur.prenoms)}<small>${e(d.statut)}</small></div>
      <dl>${ligne('Naissance', d.demandeur.naissance)}${ligne('Nationalité actuelle', d.demandeur.nationalite)}${ligne("Pièce d'identité", d.demandeur.piece)}${ligne('Profession', d.demandeur.profession)}${ligne('Résidence', d.demandeur.residence)}</dl>
    </div>
  </section>

  ${(t(d.foyer.situation) || filiation || t(d.foyer.conjoint) || enfants.length) ? `<section>
    ${titre('Foyer & composition familiale directe')}
    <dl>${ligne('Situation', d.foyer.situation)}${ligne('Filiation reconnue', filiation)}${ligne('Conjoint(e)', d.foyer.conjoint)}${enfants.length ? `<div class="ligne"><dt>Enfants</dt><dd>${enfants.map(e).join('<br>')}</dd></div>` : ''}</dl>
  </section>` : ''}

  ${parents ? `<section>${titre('Deuxième génération : les parents')}<div class="grille">${parents}</div></section>` : ''}

  ${gp ? `<section>${titre('Troisième génération : les grands-parents')}<div class="grille">${gp}</div></section>` : ''}

  ${(arbre || lignee.length || t(d.noteAscendance)) ? `<section style="position:relative">
    ${titre(`Ligne directe d'afro-descendance (${brancheTitre})`)}
    <svg class="crepi-racines" viewBox="0 0 160 120" aria-hidden="true">${pulverisation(120, 97, 160, 120, '#9C3A1C')}</svg>
    ${arbre}
    ${lignee.length ? `<table><thead><tr><th>Génération</th><th>Identité</th><th>Origines &amp; mentions</th></tr></thead><tbody>${lignee.map(m => `<tr><td class="gen-c">${e(m.generation)}${t(m.branche) ? `<br><small>${e(m.branche)}</small>` : ''}</td><td class="id">${e(m.identite)}</td><td>${e(m.mentions)}</td></tr>`).join('')}</tbody></table>` : ''}
    ${t(d.noteAscendance) ? `<p class="note"><b>Ascendance.</b> ${e(d.noteAscendance)}</p>` : ''}
  </section>` : ''}

  <div class="cloture">
    <p class="instruction">${t(d.noteInstruction) ? `<b>Note d'instruction.</b> ${e(d.noteInstruction)}` : `<b>Note d'instruction.</b> Le présent document récapitule la filiation de ${e(d.civilite)} ${e(nom || 'le demandeur')} telle qu'elle résulte des pièces d'état civil communiquées, en vue de sa demande de nationalité béninoise.`}</p>
    <div class="signature">
      ${d.cachet ? `<img src="${img('cachet-preuve.png')}" alt="Cachet Retour Gagnant Bénin">` : ''}
      <div class="org">Retour Gagnant Bénin</div>
      <div class="pole">${e(d.signataire)}</div>
      <div class="fait">Établi le ${e(d.date)}</div>
    </div>
  </div>
  <p class="avert">Document établi par Retour Gagnant Bénin sur la base des pièces d'état civil communiquées par ${d.civilite === 'Mme' ? 'la demandeuse' : 'le demandeur'}. Il ne se substitue pas aux actes d'état civil originaux.</p>
</main>
</div></body></html>`
}
