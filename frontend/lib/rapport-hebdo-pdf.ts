// ══════════════════════════════════════════════════════════════
//  Le PDF du rapport hebdomadaire.
//
//  La mise en page est reprise de `scripts/generate-rapport-kevin.mjs` :
//  liseré tricolore, bandeau vert, badge de direction, cartes à filet
//  d'accent, fiches de suivi, bloc de signature, pied de page confidentiel.
//  Ce qui change : le CONTENU ne vit plus dans le fichier, il arrive en
//  argument. Le script produisait UN rapport ; ceci produit celui de chacun.
//
//  Le nombre de pages n'est plus fixé à deux : une semaine chargée peut
//  demander plus de place. Chaque bloc mesure sa hauteur et demande une page
//  s'il ne tient pas — un rapport ne doit jamais être tronqué.
// ══════════════════════════════════════════════════════════════
import { jsPDF } from 'jspdf'
import { LOGO_BASE64 } from './logoBase64'
import type { Accent, ContenuRapport, FicheDossier, Realisation } from './rapport-hebdo'

const PW = 210
const PH = 297
const ML = 14
const MR = 14
const CW = PW - ML - MR

type RVB = [number, number, number]

const C = {
    greenDeep: [0, 95, 55] as RVB,
    greenPrimary: [0, 135, 81] as RVB,
    greenLight: [240, 249, 244] as RVB,
    yellowGold: [252, 209, 22] as RVB,
    redBenin: [232, 17, 45] as RVB,
    redLight: [254, 242, 242] as RVB,
    slateDark: [15, 23, 42] as RVB,
    slateBody: [51, 65, 85] as RVB,
    slateMuted: [100, 116, 139] as RVB,
    borderLight: [226, 232, 240] as RVB,
    cardBg: [248, 250, 252] as RVB,
}

const ACCENTS: Record<Accent, RVB> = {
    vert: C.greenPrimary,
    jaune: C.yellowGold,
    rouge: C.redBenin,
}

/** jsPDF encode en cp1252 : les guillemets typographiques y sortent en zéro. */
function net(s: unknown): string {
    return String(s ?? '')
        .replace(/[’‘]/g, "'")
        .replace(/[“”]/g, '"')
        .replace(/–/g, '-')
        .replace(/—/g, ' - ')
        .replace(/…/g, '...')
        .replace(/•/g, '-')
}

const dateFr = (iso?: string | null) => {
    if (!iso) return ''
    try {
        return new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', {
            day: '2-digit', month: 'long', year: 'numeric',
        })
    } catch { return String(iso) }
}

export interface EnTeteRapport {
    auteur_nom: string
    auteur_role?: string | null
    destinataire: string
    semaine_du: string
    semaine_au?: string | null
    titre?: string | null
}

export function rapportHebdoPdf(entete: EnTeteRapport, contenu: ContenuRapport): Buffer {
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true })

    const liseré = (y: number, h = 2) => {
        const s = PW / 3
        doc.setFillColor(...C.greenPrimary); doc.rect(0, y, s, h, 'F')
        doc.setFillColor(...C.yellowGold); doc.rect(s, y, s, h, 'F')
        doc.setFillColor(...C.redBenin); doc.rect(s * 2, y, s, h, 'F')
    }

    /* ── En-tête de la première page ── */
    function enTetePrincipale(): number {
        liseré(0, 2.5)
        doc.setFillColor(...C.greenLight); doc.rect(0, 2.5, PW, 32, 'F')
        doc.setDrawColor(...C.borderLight); doc.setLineWidth(0.3); doc.line(0, 34.5, PW, 34.5)

        try { doc.addImage('data:image/png;base64,' + LOGO_BASE64, 'PNG', ML, 6, 22, 22) } catch { /* le rapport vaut sans le logo */ }

        doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...C.greenDeep)
        doc.text('RETOUR GAGNANT BENIN', ML + 26, 13)
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7.4); doc.setTextColor(...C.slateMuted)
        doc.text('Cabinet Specialise - Nationalite Beninoise, Diaspora & Services', ML + 26, 18)
        doc.text('Cotonou, Republique du Benin - Assistance & Accompagnement Officiel', ML + 26, 22)

        const bw = 46, bx = PW - MR - bw
        doc.setFillColor(...C.greenPrimary); doc.roundedRect(bx, 8, bw, 8, 1.5, 1.5, 'F')
        doc.setFont('helvetica', 'bold'); doc.setFontSize(7.6); doc.setTextColor(255, 255, 255)
        doc.text('RAPPORT HEBDOMADAIRE', bx + bw / 2, 12.8, { align: 'center' })
        doc.setFillColor(...C.slateDark); doc.roundedRect(bx, 17, bw, 7, 1.5, 1.5, 'F')
        doc.setFontSize(6.8)
        doc.text('DIRECTION GENERALE', bx + bw / 2, 21.2, { align: 'center' })

        return 40
    }

    /** En-tête compact des pages suivantes. */
    function enTeteSuite(): number {
        liseré(0, 1.6)
        doc.setFillColor(...C.greenLight); doc.rect(0, 1.6, PW, 11, 'F')
        try { doc.addImage('data:image/png;base64,' + LOGO_BASE64, 'PNG', ML, 3, 9, 9) } catch { /* idem */ }
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...C.greenDeep)
        doc.text('RETOUR GAGNANT BENIN', ML + 12, 8)
        doc.setFont('helvetica', 'normal'); doc.setFontSize(6.8); doc.setTextColor(...C.slateMuted)
        doc.text(net(`Rapport hebdomadaire - ${entete.auteur_nom}`), PW - MR, 8, { align: 'right' })
        return 18
    }

    /* La réserve du pied de page : rien ne doit descendre en dessous. */
    const BAS = PH - 20

    /** Demande une page si `besoin` millimètres ne tiennent plus. */
    function place(y: number, besoin: number): number {
        if (y + besoin <= BAS) return y
        doc.addPage()
        return enTeteSuite()
    }

    function titreSection(num: string, titre: string, y: number): number {
        y = place(y, 14)
        doc.setFillColor(...C.greenPrimary); doc.roundedRect(ML, y, 7, 7, 1, 1, 'F')
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(255, 255, 255)
        doc.text(num, ML + 3.5, y + 4.9, { align: 'center' })
        doc.setFontSize(10.5); doc.setTextColor(...C.slateDark)
        doc.text(net(titre), ML + 10, y + 5)
        const tw = doc.getTextWidth(net(titre))
        doc.setDrawColor(...C.borderLight); doc.setLineWidth(0.4)
        doc.line(ML + 12 + tw, y + 3.5, PW - MR, y + 3.5)
        return y + 12
    }

    /** Une carte de réalisation. Hauteur mesurée, jamais devinée. */
    function carte(x: number, y: number, w: number, r: Realisation): number {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7.2)
        const lignes = doc.splitTextToSize(net(r.description), w - 8)
        const h = Math.max(24, 14 + lignes.length * 3.4)

        doc.setFillColor(...C.cardBg); doc.setDrawColor(...C.borderLight); doc.setLineWidth(0.3)
        doc.roundedRect(x, y, w, h, 2, 2, 'FD')
        doc.setFillColor(...ACCENTS[r.accent] || C.greenPrimary); doc.rect(x, y, 1.8, h, 'F')

        doc.setFont('helvetica', 'bold'); doc.setFontSize(8.2); doc.setTextColor(...C.slateDark)
        doc.text(net(r.titre), x + 4.5, y + 6)

        if (r.tag) {
            doc.setFont('helvetica', 'bold'); doc.setFontSize(5.8)
            const tw = doc.getTextWidth(net(r.tag)) + 4
            doc.setFillColor(...ACCENTS[r.accent] || C.greenPrimary)
            doc.roundedRect(x + w - tw - 3.5, y + 2.5, tw, 4.2, 1, 1, 'F')
            doc.setTextColor(r.accent === 'jaune' ? 60 : 255, r.accent === 'jaune' ? 45 : 255, r.accent === 'jaune' ? 0 : 255)
            doc.text(net(r.tag), x + w - tw / 2 - 3.5, y + 5.4, { align: 'center' })
        }

        doc.setFont('helvetica', 'normal'); doc.setFontSize(7.2); doc.setTextColor(...C.slateBody)
        doc.text(lignes, x + 4.5, y + 11)
        return h
    }

    /** Une fiche de suivi. */
    function fiche(x: number, y: number, w: number, f: FicheDossier): number {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7.3)
        let h = 14
        for (const c of f.champs) h += 5 + doc.splitTextToSize(net(c.valeur), w - 9).length * 3.5
        h = Math.max(30, h)

        doc.setFillColor(...C.cardBg); doc.setDrawColor(...C.borderLight); doc.setLineWidth(0.3)
        doc.roundedRect(x, y, w, h, 2, 2, 'FD')
        doc.setFillColor(...ACCENTS[f.accent] || C.greenPrimary); doc.rect(x, y, 1.8, h, 'F')

        doc.setFont('helvetica', 'bold'); doc.setFontSize(8.4); doc.setTextColor(...C.slateDark)
        doc.text(net(f.client), x + 4.5, y + 6.5)

        if (f.etat) {
            doc.setFont('helvetica', 'bold'); doc.setFontSize(5.8)
            const tw = doc.getTextWidth(net(f.etat)) + 4
            doc.setFillColor(255, 247, 214)
            doc.roundedRect(x + w - tw - 3.5, y + 3, tw, 4.4, 1, 1, 'F')
            doc.setTextColor(140, 90, 0)
            doc.text(net(f.etat), x + w - tw / 2 - 3.5, y + 6.1, { align: 'center' })
        }

        let cy = y + 13
        for (const c of f.champs) {
            doc.setFont('helvetica', 'bold'); doc.setFontSize(7.2); doc.setTextColor(...C.slateMuted)
            doc.text(net(c.label), x + 4.5, cy)
            doc.setFont('helvetica', c.alerte ? 'bold' : 'normal'); doc.setFontSize(7.3)
            doc.setTextColor(...(c.alerte ? C.redBenin : C.slateDark))
            const v = doc.splitTextToSize(net(c.valeur), w - 9)
            doc.text(v, x + 4.5, cy + 4)
            cy += 5 + v.length * 3.5
        }
        return h
    }

    // ─── PAGE 1 ───────────────────────────────────────────────
    let y = enTetePrincipale()

    // Bloc méta : émetteur, destinataire, période, statut.
    const periode = entete.semaine_au
        ? `Du ${dateFr(entete.semaine_du)} au ${dateFr(entete.semaine_au)}`
        : `Semaine du ${dateFr(entete.semaine_du)}`

    doc.setFillColor(...C.cardBg); doc.setDrawColor(...C.borderLight); doc.setLineWidth(0.3)
    doc.roundedRect(ML, y, CW, 17, 2, 2, 'FD')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.6); doc.setTextColor(...C.slateMuted)
    doc.text('EMETTEUR DU RAPPORT :', ML + 4, y + 5.5)
    doc.text('DESTINATAIRE :', ML + CW / 2 + 2, y + 5.5)
    doc.setFontSize(8.4); doc.setTextColor(...C.slateDark)
    doc.text(net(entete.auteur_nom + (entete.auteur_role ? ` - ${entete.auteur_role}` : '')), ML + 4, y + 10)
    doc.text(net(entete.destinataire), ML + CW / 2 + 2, y + 10)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...C.slateMuted)
    doc.text(net(periode), ML + 4, y + 14.2)
    doc.text(net('Statut : ' + contenu.statut_operations), ML + CW / 2 + 2, y + 14.2)
    y += 21

    // Note de cadrage.
    if (contenu.note_cadrage.trim()) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7.4)
        const l = doc.splitTextToSize(net(contenu.note_cadrage), CW - 8)
        const h = 8 + l.length * 3.6
        y = place(y, h)
        doc.setFillColor(...C.greenLight); doc.setDrawColor(...C.greenPrimary); doc.setLineWidth(0.3)
        doc.roundedRect(ML, y, CW, h, 2, 2, 'FD')
        doc.setFont('helvetica', 'bold'); doc.setFontSize(6.8); doc.setTextColor(...C.greenDeep)
        doc.text('NOTE DE CADRAGE POUR LA DIRECTION :', ML + 3.5, y + 4.2)
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7.4); doc.setTextColor(...C.slateBody)
        doc.text(l, ML + 3.5, y + 8)
        y += h + 5
    }

    // ─── Section 1 : réalisations ────────────────────────────
    if (contenu.realisations.length) {
        y = titreSection('1', contenu.section1_titre, y)
        const colW = (CW - 5) / 2
        for (let i = 0; i < contenu.realisations.length; i += 2) {
            const paire = contenu.realisations.slice(i, i + 2)
            // Mesure des deux cartes AVANT de dessiner : elles partagent la
            // même hauteur de ligne, et la page doit pouvoir les accueillir.
            doc.setFont('helvetica', 'normal'); doc.setFontSize(7.2)
            const hauteurs = paire.map(r => Math.max(24, 14 + doc.splitTextToSize(net(r.description), colW - 8).length * 3.4))
            const hLigne = Math.max(...hauteurs)
            y = place(y, hLigne + 5)
            paire.forEach((r, j) => { carte(ML + j * (colW + 5), y, colW, r) })
            y += hLigne + 5
        }
    }

    // Encadré libre.
    if (contenu.encadre && contenu.encadre.lignes.filter(Boolean).length) {
        const texte = contenu.encadre.lignes.filter(Boolean).map(l => '- ' + net(l)).join('\n')
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7.2)
        const l = doc.splitTextToSize(texte, CW - 8)
        const h = 9 + l.length * 3.6
        y = place(y, h + 4)
        doc.setFillColor(...C.cardBg); doc.setDrawColor(...C.borderLight); doc.setLineWidth(0.3)
        doc.roundedRect(ML, y, CW, h, 2, 2, 'FD')
        doc.setFillColor(...C.greenPrimary); doc.rect(ML, y, 1.5, h, 'F')
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8.2); doc.setTextColor(...C.slateDark)
        doc.text(net(contenu.encadre.titre), ML + 4, y + 5)
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7.2); doc.setTextColor(...C.slateBody)
        doc.text(l, ML + 4, y + 9.5)
        y += h + 5
    }

    // ─── Section 2 : suivi ───────────────────────────────────
    if (contenu.regle_texte.trim() || contenu.dossiers.length) {
        y = titreSection('2', contenu.section2_titre, y)

        if (contenu.regle_texte.trim()) {
            doc.setFont('helvetica', 'normal'); doc.setFontSize(7.3)
            const l = doc.splitTextToSize(net(contenu.regle_texte), CW - 10)
            const h = 9 + l.length * 3.6
            y = place(y, h + 4)
            doc.setFillColor(...C.redLight); doc.setDrawColor(...C.redBenin); doc.setLineWidth(0.4)
            doc.roundedRect(ML, y, CW, h, 2, 2, 'FD')
            doc.setFillColor(...C.redBenin); doc.rect(ML, y, 2.2, h, 'F')
            doc.setFont('helvetica', 'bold'); doc.setFontSize(7.4); doc.setTextColor(...C.redBenin)
            doc.text(net(contenu.regle_titre), ML + 5, y + 5.5)
            doc.setFont('helvetica', 'normal'); doc.setFontSize(7.3); doc.setTextColor(...C.slateBody)
            doc.text(l, ML + 5, y + 9.5)
            y += h + 5
        }

        const colW = (CW - 5) / 2
        for (let i = 0; i < contenu.dossiers.length; i += 2) {
            const paire = contenu.dossiers.slice(i, i + 2)
            doc.setFont('helvetica', 'normal'); doc.setFontSize(7.3)
            const hauteurs = paire.map(f => {
                let h = 14
                for (const c of f.champs) h += 5 + doc.splitTextToSize(net(c.valeur), colW - 9).length * 3.5
                return Math.max(30, h)
            })
            const hLigne = Math.max(...hauteurs)
            y = place(y, hLigne + 5)
            paire.forEach((f, j) => { fiche(ML + j * (colW + 5), y, colW, f) })
            y += hLigne + 5
        }
    }

    // ─── Section 3 : synthèse et signature ───────────────────
    if (contenu.synthese_texte.trim()) {
        y = titreSection('3', contenu.section3_titre, y)
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7.4)
        const l = doc.splitTextToSize(net(contenu.synthese_texte), CW - 66)
        const h = Math.max(30, 10 + l.length * 3.7)
        y = place(y, h + 4)

        doc.setFillColor(...C.cardBg); doc.setDrawColor(...C.borderLight); doc.setLineWidth(0.3)
        doc.roundedRect(ML, y, CW - 60, h, 2, 2, 'FD')
        doc.setFillColor(...C.greenPrimary); doc.rect(ML, y, 1.5, h, 'F')
        doc.setFont('helvetica', 'bold'); doc.setFontSize(7.4); doc.setTextColor(...C.slateDark)
        doc.text(net(contenu.synthese_titre), ML + 4.5, y + 5.5)
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7.4); doc.setTextColor(...C.slateBody)
        doc.text(l, ML + 4.5, y + 10)

        // Bloc de signature, à droite.
        const sx = PW - MR - 55
        doc.setDrawColor(...C.borderLight); doc.setLineWidth(0.3)
        doc.roundedRect(sx - 3, y, 58, h, 2, 2, 'D')
        doc.setFont('helvetica', 'bold'); doc.setFontSize(6.6); doc.setTextColor(...C.slateMuted)
        doc.text('POUR LA DIRECTION :', sx, y + 5.5)
        doc.setFontSize(10); doc.setTextColor(...C.greenDeep)
        doc.text(net(entete.auteur_nom.toUpperCase()), sx, y + 11)
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...C.slateBody)
        if (entete.auteur_role) doc.text(net(entete.auteur_role), sx, y + 15)
        doc.text('Retour Gagnant Benin (RGB)', sx, y + 19)
        doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...C.greenPrimary)
        doc.text(net(contenu.mention_finale), sx, y + 25)
    }

    // ─── Pieds de page, une fois le nombre de pages connu ────
    const total = doc.getNumberOfPages()
    for (let p = 1; p <= total; p++) {
        doc.setPage(p)
        const yf = PH - 13
        doc.setDrawColor(...C.borderLight); doc.setLineWidth(0.3); doc.line(ML, yf, PW - MR, yf)
        doc.setFont('helvetica', 'normal'); doc.setFontSize(6.8); doc.setTextColor(...C.slateMuted)
        doc.text('RETOUR GAGNANT BENIN - Haie-Vive Cocotiers, Cotonou', ML, yf + 4.5)
        doc.text('RCCM : RB/COT/26 B 42001 - IFU : 3202644573981 - contact@retourgagnantbenin.bj', ML, yf + 8)
        doc.setFont('helvetica', 'bold'); doc.setTextColor(...C.redBenin)
        doc.text('CONFIDENTIEL - DIRECTION', PW / 2, yf + 4.5, { align: 'center' })
        doc.setFont('helvetica', 'normal'); doc.setTextColor(...C.slateMuted)
        doc.text(`Page ${p} sur ${total}`, PW - MR, yf + 4.5, { align: 'right' })
    }

    return Buffer.from(doc.output('arraybuffer'))
}