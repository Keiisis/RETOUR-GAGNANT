/* ══════════════════════════════════════════════════════════════════
   PREUVE D'AFRO-DESCENDANCE & COMPOSITION FAMILIALE

   Document A4 établi par Retour Gagnant Bénin à partir des pièces d'état
   civil communiquées par le demandeur. Rempli depuis l'onglet « Demandes
   de Nationalité » : pré-rempli avec un dossier de la plateforme, ou vierge
   pour un client qui n'y est pas inscrit.

   Rendu : HTML imprimé par le navigateur (« Enregistrer en PDF »).
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
    // Trait porté par les attributs (et pas seulement le CSS) : l'export PDF les conserve.
    const lien = `<svg class="racine" viewBox="0 0 120 34" aria-hidden="true"><g fill="none" stroke="#9C3A1C" stroke-width="2.2" stroke-linecap="round"><path d="M60 0 C60 12 58 18 60 34" /><path d="M60 14 C52 20 44 22 36 30" /><path d="M60 16 C69 21 78 24 86 31" /><path d="M59 24 C55 27 52 29 50 33" /></g></svg>`
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
    const titre = (texte: string) => `<h3><span class="num">${++n}</span>${e(texte)}</h3>`
    const f = (fichier: string) => `${origine}/fonts/preuve/${fichier}`
    const img = (fichier: string) => `${origine}/images/${fichier}`

    return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<title>${e(`PREUVE_AFRO_DESCENDANCE_${[d.demandeur.nom, d.demandeur.prenoms.split(/\s+/)[0]].map(t).filter(Boolean).join('_').toUpperCase().replace(/\s+/g, '_') || 'CLIENT'}`)}</title>
<style>
/* Hallmark · document: preuve d'afro-descendance · tone: institutionnel sobre
 * theme: custom (Bénin : vert · jaune · rouge sur blanc) · display: Fraunces · marque: Montserrat · body: Geist */
@font-face{font-family:"Fraunces";src:url("${f('fraunces-normal-400-900.woff2')}") format("woff2");font-weight:400 900;font-style:normal}
@font-face{font-family:"Geist";src:url("${f('geist-normal-300-700.woff2')}") format("woff2");font-weight:300 700}
@font-face{font-family:"Montserrat";src:url("${f('montserrat-normal-400-900.woff2')}") format("woff2");font-weight:400 900}
:root{
  --vert:#008751; --vert-fonce:#0B5E3A; --vert-pale:#E8F3EC; --jaune:#EFB300; --jaune-pale:#FDF4D6;
  --rouge:#D21034; --rouge-pale:#FBE9EC; --racine:#9C3A1C;
  --papier:#FFFFFF; --carte:#FBFBF8; --encre:#16191F; --encre-2:#5B616B; --encre-3:#8A9099; --filet:#E4E6E2;
  --font-titre:"Fraunces",Georgia,serif; --font-texte:"Geist",system-ui,sans-serif; --font-marque:"Montserrat","Geist",sans-serif;
}
@page{size:A4;margin:12mm 0 14mm;
  @bottom-left{content:"Retour Gagnant Bénin · Réf. ${d.ref.replace(/[^\w\- ]/g, '')}";font:500 7.5pt "Geist",sans-serif;color:#8a9099;padding-left:16mm}
  @bottom-right{content:"Page " counter(page) " / " counter(pages);font:500 7.5pt "Geist",sans-serif;color:#8a9099;padding-right:16mm}}
@page :first{margin-top:0}
*{box-sizing:border-box;margin:0;padding:0}
html,body{overflow-x:clip}
body{font-family:var(--font-texte);color:var(--encre);background:var(--papier);font-size:9.2pt;line-height:1.45;-webkit-print-color-adjust:exact;print-color-adjust:exact}
@media screen{body{background:transparent;padding:24px 12px}.feuille{width:210mm;min-height:297mm;margin:0 auto;box-shadow:0 1px 2px rgba(0,0,0,.08),0 14px 40px rgba(20,30,25,.18)}}
.feuille{background:var(--papier);position:relative;overflow:hidden;font-family:var(--font-texte);color:var(--encre);font-size:9.2pt;line-height:1.45}
.filigrane{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:0}
.filigrane img{width:115mm;opacity:.04;filter:grayscale(1)}
main{position:relative;z-index:1;padding:0 16mm 10mm}

/* En-tête */
.entete{position:relative;z-index:1;display:flex;justify-content:space-between;align-items:center;gap:8mm;padding:9mm 16mm 7mm}
.marque{display:flex;align-items:center;gap:4.5mm;min-width:0}
.marque img{width:19mm;height:19mm;object-fit:contain;flex:none}
.nom-agence{font-family:var(--font-marque);font-weight:900;font-size:18pt;line-height:1;letter-spacing:.01em;white-space:nowrap}
.nom-agence .r{color:var(--vert)} .nom-agence .g{color:var(--jaune)}
.nom-agence + .pays{display:block;margin-top:1.8mm;font-family:var(--font-marque);font-weight:800;font-size:9.5pt;letter-spacing:.62em;color:var(--rouge)}
.meta{flex:none;border-left:.8mm solid var(--vert);padding:1mm 0 1mm 4mm;font-size:8pt;line-height:1.75;width:68mm}
.meta .type span{white-space:nowrap}
.meta .type{font-weight:600;color:var(--encre);font-size:8.3pt;line-height:1.35;margin-bottom:1.2mm}
.meta div:not(.type){display:flex;gap:2mm}
.meta b{display:inline-block;min-width:20mm;color:var(--encre-3);font-weight:600;letter-spacing:.08em;text-transform:uppercase;font-size:6.8pt}
.drapeau{height:1.8mm;display:grid;grid-template-columns:1fr 1fr 1fr;position:relative;z-index:1}
.drapeau i{display:block}.drapeau i:nth-child(1){background:var(--vert)}.drapeau i:nth-child(2){background:var(--jaune)}.drapeau i:nth-child(3){background:var(--rouge)}

/* Titre */
.titre{padding:7mm 0 4mm}
.titre h1{font-family:var(--font-titre);font-weight:700;font-size:23pt;line-height:1.08;color:var(--encre);letter-spacing:-.01em}
.titre h1 span{display:block;font-weight:500;font-size:14pt;color:var(--vert-fonce);margin-top:1.2mm;letter-spacing:0}
.titre .filet3{display:flex;gap:1mm;margin-top:3mm}
.titre .filet3 i{display:block;width:9mm;height:1mm;border-radius:.5mm}
.titre .filet3 i:nth-child(1){background:var(--vert)}.titre .filet3 i:nth-child(2){background:var(--jaune)}.titre .filet3 i:nth-child(3){background:var(--rouge)}
.titre .qui{margin-top:3mm;font-size:10pt;color:var(--encre-2)}
.titre .qui strong{color:var(--encre);font-weight:600}
.cadre{border:.3mm solid var(--filet);border-left:1.1mm solid var(--jaune);background:var(--carte);padding:3mm 4.5mm;font-size:8.2pt;color:#3d434d;line-height:1.6;border-radius:0 1.5mm 1.5mm 0}
.cadre b{color:var(--encre)}

/* Sections */
section{margin-top:6mm;break-inside:auto}
h3{font-family:var(--font-titre);font-weight:600;font-size:12.5pt;color:var(--encre);display:flex;align-items:center;gap:3mm;padding-bottom:2mm;border-bottom:.3mm solid var(--filet);margin-bottom:3mm;break-after:avoid}
h3 .num{flex:none;display:block;width:6.4mm;height:6.4mm;line-height:6.4mm;text-align:center;border-radius:50%;background:var(--vert);color:#fff;font-family:var(--font-marque);font-weight:800;font-size:8.5pt}
.demandeur{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.55fr);gap:7mm;align-items:start}
.demandeur .nomfort{font-family:var(--font-titre);font-weight:700;font-size:16pt;line-height:1.12;color:var(--encre);overflow-wrap:anywhere}
.demandeur .nomfort small{display:inline-block;font-family:var(--font-texte);font-weight:600;font-size:7pt;letter-spacing:.16em;text-transform:uppercase;color:var(--vert-fonce);background:var(--vert-pale);padding:.8mm 2.4mm;border-radius:1mm;margin-top:2.4mm}
dl .ligne{display:grid;grid-template-columns:31mm minmax(0,1fr);gap:3mm;padding:1.1mm 0;border-bottom:.2mm solid var(--filet)}
dl .ligne:last-child{border-bottom:0}
dt{font-size:7.2pt;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--encre-3);padding-top:.5mm}
dd{overflow-wrap:anywhere}
.grille{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:4mm}
.carte{background:var(--carte);border:.3mm solid var(--filet);border-top:.9mm solid var(--vert);border-radius:1.5mm;padding:3mm 4mm;break-inside:avoid}
.carte.maternelle{border-top-color:var(--rouge)}
.carte .lien{display:inline-block;font-size:6.6pt;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--vert-fonce);background:var(--vert-pale);padding:.6mm 2.2mm;border-radius:1mm}
.carte.maternelle .lien{color:#A00C27;background:var(--rouge-pale)}
.carte h4{font-family:var(--font-titre);font-weight:600;font-size:11.5pt;margin:1.8mm 0 1mm;color:var(--encre);overflow-wrap:anywhere}
.carte .surnom{font-family:var(--font-texte);font-weight:400;font-size:9pt;color:var(--encre-2)}
.carte .origine{font-size:8pt;color:var(--encre-2);margin:-.6mm 0 1.4mm}
.carte dl .ligne{grid-template-columns:20mm minmax(0,1fr)}
.note{margin-top:4mm;font-size:8.8pt;color:#3d434d;padding:3mm 4mm;border-radius:1.5mm;background:var(--jaune-pale);break-inside:avoid}
.note b{color:var(--encre)}

/* Générations (racines du logo) */
.arbre{display:flex;flex-direction:column;align-items:center;padding:1.5mm 0;break-inside:avoid}
.niveau{display:flex;flex-direction:column;align-items:center;gap:1.4mm}
.gen{font-size:6.6pt;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--encre-3)}
.noms{display:flex;flex-wrap:wrap;justify-content:center;gap:2mm}
.nom{display:inline-block;white-space:nowrap;font-family:var(--font-titre);font-weight:600;font-size:9.5pt;line-height:1.2;color:#fff;background:var(--vert-fonce);padding:1.1mm 3.6mm;border-radius:10mm;border:.45mm solid var(--jaune)}
.niveau:first-child .nom{background:var(--encre)}
.racine{width:30mm;height:7mm;margin:.3mm 0}
.racine path{fill:none;stroke:var(--racine);stroke-width:2.2;stroke-linecap:round}
table{width:100%;border-collapse:collapse;margin-top:3mm;font-size:8.8pt;break-inside:auto}
th{background:var(--vert-fonce);color:#fff;text-align:left;font-size:6.9pt;letter-spacing:.14em;text-transform:uppercase;font-weight:600;padding:2.2mm 3mm}
td{padding:2mm 3mm;border-bottom:.25mm solid var(--filet);vertical-align:top;overflow-wrap:anywhere}
tr{break-inside:avoid}
td.id{font-family:var(--font-titre);font-weight:600;font-size:10pt}
td.gen-c{color:var(--vert-fonce);font-weight:600;white-space:nowrap}
td.gen-c small{color:var(--encre-3);font-weight:500}

/* Clôture */
.cloture{margin-top:8mm;display:grid;grid-template-columns:minmax(0,1fr) 62mm;gap:8mm;align-items:end;break-inside:avoid}
.instruction{font-size:8.8pt;color:#3d434d;border-top:.3mm solid var(--filet);padding-top:3mm}
.instruction b{color:var(--encre)}
.signature{position:relative;padding-top:3mm;border-top:.8mm solid var(--vert)}
.signature .org{font-family:var(--font-marque);font-weight:900;font-size:10pt;letter-spacing:.02em}
.signature .org .r{color:var(--vert)} .signature .org .g{color:var(--jaune)} .signature .org .b{color:var(--rouge)}
.signature .pole{font-size:8.4pt;color:var(--encre-2);margin-top:.6mm}
.signature .fait{font-size:8pt;color:var(--encre-2);margin-top:1.2mm}
.signature img{position:absolute;right:2mm;top:-31mm;width:32mm;transform:rotate(-12deg);opacity:.92;mix-blend-mode:multiply}
.avert{margin-top:6mm;font-size:7pt;color:var(--encre-3);line-height:1.5}
</style></head><body><div class="feuille">
<div class="filigrane"><img src="${img('logo-preuve.png')}" alt=""></div>

<header class="entete">
  <div class="marque">
    <img src="${img('logo-preuve.png')}" alt="Logo Retour Gagnant Bénin">
    <div><span class="nom-agence"><span class="r">RETOUR</span> <span class="g">GAGNANT</span></span><span class="pays">BÉNIN</span></div>
  </div>
  <div class="meta">
    <div class="type">Dossier de demande de nationalité par <span>afro-descendance</span></div>
    <div><b>Réf. dossier</b>${e(d.ref)}</div>
    <div><b>Date</b>${e(d.date)}</div>
    <div><b>Statut</b>${e(d.statut)}</div>
  </div>
</header>
<div class="drapeau"><i></i><i></i><i></i></div>

<main>
  <div class="titre">
    <h1>Preuve d'afro-descendance<span>&amp; composition familiale</span></h1>
    <div class="filet3"><i></i><i></i><i></i></div>
    ${nom ? `<p class="qui"><strong>${e(d.civilite)} ${e(nom)}</strong> · demandeur${d.civilite === 'Mme' ? 'esse' : ''} de la nationalité béninoise</p>` : ''}
  </div>
  ${t(d.cadreLegal) ? `<div class="cadre"><b>Cadre légal et réglementaire.</b> ${e(d.cadreLegal)}</div>` : ''}

  <section>
    ${titre(d.civilite === 'Mme' ? 'La demandeuse principale' : 'Le demandeur principal')}
    <div class="demandeur">
      <div class="nomfort">${e(d.demandeur.nom || '—')}<br>${e(d.demandeur.prenoms)}<br><small>${e(d.statut)}</small></div>
      <dl>${ligne('Naissance', d.demandeur.naissance)}${ligne('Nationalité actuelle', d.demandeur.nationalite)}${ligne("Pièce d'identité", d.demandeur.piece)}${ligne('Profession', d.demandeur.profession)}${ligne('Résidence', d.demandeur.residence)}</dl>
    </div>
  </section>

  ${(t(d.foyer.situation) || filiation || t(d.foyer.conjoint) || enfants.length) ? `<section>
    ${titre('Foyer & composition familiale directe')}
    <dl>${ligne('Situation', d.foyer.situation)}${ligne('Filiation reconnue', filiation)}${ligne('Conjoint(e)', d.foyer.conjoint)}${enfants.length ? `<div class="ligne"><dt>Enfants</dt><dd>${enfants.map(e).join('<br>')}</dd></div>` : ''}</dl>
  </section>` : ''}

  ${parents ? `<section>${titre('Deuxième génération : les parents')}<div class="grille">${parents}</div></section>` : ''}

  ${gp ? `<section>${titre('Troisième génération : les grands-parents')}<div class="grille">${gp}</div></section>` : ''}

  ${(arbre || lignee.length || t(d.noteAscendance)) ? `<section>
    ${titre(`Ligne directe d'afro-descendance (${brancheTitre})`)}
    ${arbre}
    ${lignee.length ? `<table><thead><tr><th>Génération</th><th>Identité</th><th>Origines &amp; mentions</th></tr></thead><tbody>${lignee.map(m => `<tr><td class="gen-c">${e(m.generation)}${t(m.branche) ? `<br><small>${e(m.branche)}</small>` : ''}</td><td class="id">${e(m.identite)}</td><td>${e(m.mentions)}</td></tr>`).join('')}</tbody></table>` : ''}
    ${t(d.noteAscendance) ? `<p class="note"><b>Ascendance.</b> ${e(d.noteAscendance)}</p>` : ''}
  </section>` : ''}

  <div class="cloture">
    <p class="instruction">${t(d.noteInstruction) ? `<b>Note d'instruction.</b> ${e(d.noteInstruction)}` : `<b>Note d'instruction.</b> Le présent document récapitule la filiation de ${e(d.civilite)} ${e(nom || 'le demandeur')} telle qu'elle résulte des pièces d'état civil communiquées, en vue de sa demande de nationalité béninoise.`}</p>
    <div class="signature">
      ${d.cachet ? `<img src="${img('cachet-preuve.png')}" alt="Cachet Retour Gagnant Bénin">` : ''}
      <div class="org"><span class="r">RETOUR</span> <span class="g">GAGNANT</span> <span class="b">BÉNIN</span></div>
      <div class="pole">${e(d.signataire)}</div>
      <div class="fait">Établi le ${e(d.date)}</div>
    </div>
  </div>
  <p class="avert">Document établi par Retour Gagnant Bénin sur la base des pièces d'état civil communiquées par ${d.civilite === 'Mme' ? 'la demandeuse' : 'le demandeur'}. Il ne se substitue pas aux actes d'état civil originaux.</p>
</main>
</div></body></html>`
}
