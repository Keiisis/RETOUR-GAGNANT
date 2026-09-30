// ══════════════════════════════════════════════════════════════
//  MODÈLE UNIQUE des devis, factures et avoirs (PDF A4).
//
//  Audit du 29/09/2026 : quatre générateurs coexistaient (portail client,
//  panel admin, panel agent, serveur pour emails/mobile) — quatre mises en
//  page pour un même document, total rogné, dates ISO brutes, statut interne
//  affiché au client, accents retirés, cachet posé sur le nom de la
//  Directrice générale, « TVA 18 % applicable » face à des lignes à 0 %.
//
//  Ce module est désormais la SEULE source du rendu. Il est isomorphe
//  (navigateur et serveur) : aucune dépendance Node. Les images (paraphe du
//  client, QR MECeF) arrivent déjà en data URL ; les chargements asynchrones
//  sont faits par les appelants (lib/document-pdf-navigateur.ts côté site,
//  lib/invoice-pdf-generator.ts côté serveur).
// ══════════════════════════════════════════════════════════════
import { jsPDF, GState } from 'jspdf'
import { LOGO_BASE64, STAMP_BASE64 } from './logoBase64'
import { descriptionPourPdf, elementsDescription } from '@/lib/description-lignes'
import { libelleMoyenPaiement } from '@/lib/moyen-paiement-libelle'

export interface DocumentPdfLigne {
    description: string
    quantity: number
    unit_price: number
    tva: number
}

/** Textes administrables (table `document_templates`, id official_devis_facture). */
export interface ModeleDocument {
    entete?: string
    pied?: string
    signataire?: string
    titreSignataire?: string
}

export interface DocumentPdfDonnees {
    invoiceRef: string
    /** ISO ou déjà formatée : normalisée en JJ/MM/AAAA. */
    date: string
    paidAt?: string
    isPaid: boolean
    clientName: string
    clientEmail?: string
    clientPhone?: string
    clientAddress?: string
    items: DocumentPdfLigne[]
    currency: string
    sous_total: number
    total_tva: number
    remise: number
    total: number
    notes?: string
    conditions?: string
    validite?: string
    /** Facture « payée sur parole » (saisie manuelle) : bloc confirmation de paiement. */
    isManual?: boolean
    docType?: 'devis' | 'facture' | 'avoir'
    /** Paraphe du client en data URL (PNG/JPEG). */
    clientSignatureDataUrl?: string
    /** Statut brut du document (documents_financiers.status). */
    statut?: string
    signedAt?: string
    dueDate?: string
    paymentMethod?: string
    mecef?: { code?: string; nim?: string; compteurs?: string; dateHeure?: string; qrDataUrl?: string }
    modele?: ModeleDocument
}

// ── Valeurs par défaut (identiques au modèle en base au 29/09/2026) ─────────
export const MODELE_PAR_DEFAUT: Required<ModeleDocument> = {
    entete: 'RETOUR GAGNANT BÉNIN\nRCCM : RB/COT/26 B 42001 | IFU : 3202644573981\nHaie-Vive Cocotiers, Cotonou, Bénin\nWhatsApp : +229 01 94 35 50 50 / +229 01 60 32 21 21\nAppel direct : +229 01 66 73 89 71 | contact@retourgagnantbenin.bj',
    pied: 'RETOUR GAGNANT BÉNIN — RCCM : RB/COT/26 B 42001 — IFU : 3202644573981\nSiège : Haie-Vive Cocotiers, Cotonou. Email : contact@retourgagnantbenin.bj',
    signataire: 'Nathalie RIFFERT GERMANY',
    titreSignataire: 'LA DIRECTION GÉNÉRALE',
}

// ── Mise en forme ────────────────────────────────────────────────────────────
type RGB = [number, number, number]
const C = {
    vert: [0, 135, 81] as RGB,
    vertFonce: [0, 96, 58] as RGB,
    or: [252, 209, 22] as RGB,
    /** Jaune du logotype : or soutenu, même intensité que le vert et le rouge du drapeau */
    jaune: [240, 176, 0] as RGB,
    rouge: [232, 17, 45] as RGB,
    nuit: [16, 26, 44] as RGB,
    texte: [34, 40, 52] as RGB,
    gris: [102, 110, 125] as RGB,
    griseClair: [150, 158, 170] as RGB,
    fond: [246, 248, 251] as RGB,
    fondVert: [240, 250, 245] as RGB,
    trait: [222, 228, 236] as RGB,
    ambre: [217, 119, 6] as RGB,
}

/* Espaces fines insécables (U+202F, U+00A0, U+2009) absentes de l'encodage
   WinAnsi des polices standard : « 10/000 » au lieu de « 10 000 ». */
const ESPACES_FINES = /[   ]/g
const LIBELLE_DEVISE: Record<string, string> = { XOF: 'FCFA', FCFA: 'FCFA', XAF: 'FCFA', EUR: '€', USD: '$', GBP: '£' }
const devise = (c: string) => LIBELLE_DEVISE[(c || 'XOF').toUpperCase()] || (c || '').toUpperCase()
const sansDecimales = (c: string) => ['XOF', 'FCFA', 'XAF'].includes((c || 'XOF').toUpperCase())

export function montant(val: number, cur: string): string {
    const v = Number(val) || 0
    const n = sansDecimales(cur) ? Math.round(v) : Math.round(v * 100) / 100
    const txt = new Intl.NumberFormat('fr-FR', sansDecimales(cur) ? {} : { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })
        .format(n).replace(ESPACES_FINES, ' ')
    return `${txt} ${devise(cur)}`
}

/** Date lisible : ISO → JJ/MM/AAAA (fuseau Bénin) ; déjà formatée → inchangée. */
export function dateLisible(v?: string | null): string {
    if (!v) return ''
    const s = String(v).trim()
    if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return s
    const d = new Date(s.length === 10 ? s + 'T12:00:00Z' : s)
    if (isNaN(d.getTime())) return s
    return d.toLocaleDateString('fr-FR', { timeZone: 'Africa/Porto-Novo', day: '2-digit', month: '2-digit', year: 'numeric' })
}

const nomPropre = (s?: string | null) => String(s || '').replace(/\s+/g, ' ').trim()

function enLettres(n: number): string {
    if (n === 0) return 'ZÉRO'
    if (n < 0) return 'MOINS ' + enLettres(-n)
    const u = ['', 'UN', 'DEUX', 'TROIS', 'QUATRE', 'CINQ', 'SIX', 'SEPT', 'HUIT', 'NEUF', 'DIX', 'ONZE', 'DOUZE', 'TREIZE', 'QUATORZE', 'QUINZE', 'SEIZE', 'DIX-SEPT', 'DIX-HUIT', 'DIX-NEUF']
    const d = ['', 'DIX', 'VINGT', 'TRENTE', 'QUARANTE', 'CINQUANTE', 'SOIXANTE', 'SOIXANTE', 'QUATRE-VINGT', 'QUATRE-VINGT']
    const m100 = (x: number): string => {
        if (x < 20) return u[x]
        const t = Math.floor(x / 10), r = x % 10
        if (t === 7) return r === 1 ? 'SOIXANTE ET ONZE' : 'SOIXANTE-' + u[10 + r]
        if (t === 9) return r === 0 ? 'QUATRE-VINGT-DIX' : 'QUATRE-VINGT-' + u[10 + r]
        if (r === 0) return t === 8 ? 'QUATRE-VINGTS' : d[t]
        if (r === 1 && t !== 8) return d[t] + ' ET UN'
        return d[t] + '-' + u[r]
    }
    const m1000 = (x: number): string => {
        if (x < 100) return m100(x)
        const h = Math.floor(x / 100), r = x % 100
        if (r === 0) return h === 1 ? 'CENT' : u[h] + ' CENTS'
        return (h === 1 ? 'CENT' : u[h] + ' CENT') + ' ' + m100(r)
    }
    let res = '', reste = Math.floor(n)
    for (const [val, s, p] of [[1e9, 'MILLIARD', 'MILLIARDS'], [1e6, 'MILLION', 'MILLIONS'], [1e3, 'MILLE', 'MILLE']] as const) {
        const q = Math.floor(reste / val)
        if (q > 0) {
            res += (res ? ' ' : '') + (q === 1 ? (val === 1e3 ? s : 'UN ' + s) : m1000(q) + ' ' + p)
            reste %= val
        }
    }
    if (reste > 0) res += (res ? ' ' : '') + m1000(reste)
    return res
}

const NOMS_DEVISE_LETTRES: Record<string, string> = { XOF: 'FRANCS CFA', FCFA: 'FRANCS CFA', XAF: 'FRANCS CFA', EUR: 'EUROS', USD: 'DOLLARS', GBP: 'LIVRES STERLING' }
function montantEnLettres(v: number, cur: string): string {
    const entier = Math.floor(Math.abs(v))
    const cents = sansDecimales(cur) ? 0 : Math.round((Math.abs(v) - entier) * 100)
    const nomDev = NOMS_DEVISE_LETTRES[(cur || 'XOF').toUpperCase()] || (cur || '').toUpperCase()
    return enLettres(entier) + ' ' + nomDev + (cents ? ' ET ' + enLettres(cents) + ' CENTIMES' : '')
}

/** Libellé et couleur du badge : ce que le CLIENT doit comprendre (jamais le statut interne brut). */
function badge(d: DocumentPdfDonnees): { texte: string; couleur: RGB } {
    const s = (d.statut || '').toLowerCase()
    if (d.docType === 'avoir') return { texte: 'AVOIR', couleur: C.nuit }
    if (d.docType === 'devis') {
        if (s === 'accepte' || d.signedAt || d.clientSignatureDataUrl) return { texte: 'ACCEPTÉ', couleur: C.vert }
        if (s === 'refuse') return { texte: 'REFUSÉ', couleur: C.griseClair }
        if (s === 'annule') return { texte: 'ANNULÉ', couleur: C.griseClair }
        if (s === 'paye') return { texte: 'RÉGLÉ', couleur: C.vert }
        return { texte: d.validite ? `VALABLE ${String(d.validite).toUpperCase()}` : 'PROPOSITION', couleur: C.vert }
    }
    if (d.isPaid || s === 'paye') return { texte: 'ACQUITTÉE', couleur: C.vert }
    if (s === 'annule') return { texte: 'ANNULÉE', couleur: C.griseClair }
    if (s === 'en_retard') return { texte: 'EN RETARD', couleur: C.rouge }
    return { texte: 'À RÉGLER', couleur: C.ambre }
}

// ── Dessin ───────────────────────────────────────────────────────────────────
/* Mise en page ÉPURÉE (30/09/2026, demande de Kevin) : chaque information
   n'apparaît qu'UNE fois. Coordonnées en en-tête, mentions légales (RCCM,
   IFU, TVA, juridiction) au pied ; plus de bloc « Émetteur » en double, plus
   de cadre client sur une facture non signée, plus de « Paiement reçu » qui
   répétait le badge. Logotype : RETOUR (vert) GAGNANT (jaune), BÉNIN (rouge). */
export function dessinerDocumentPdf(d: DocumentPdfDonnees): jsPDF {
    const pdf = new jsPDF('p', 'mm', 'a4')
    const PW = 210, PH = 297, ML = 16, MR = 16, CW = PW - ML - MR
    const PIED_H = 16
    const BAS = PH - PIED_H - 4          // limite utile avant le pied de page
    const modele = { ...MODELE_PAR_DEFAUT, ...Object.fromEntries(Object.entries(d.modele || {}).filter(([, v]) => v)) }
    const type = d.docType || 'facture'
    const titre = type === 'devis' ? 'DEVIS' : type === 'avoir' ? 'AVOIR' : 'FACTURE'
    const cur = d.currency || 'XOF'
    const couleur = (c: RGB, mode: 'text' | 'fill' | 'draw' = 'text') =>
        mode === 'text' ? pdf.setTextColor(c[0], c[1], c[2]) : mode === 'fill' ? pdf.setFillColor(c[0], c[1], c[2]) : pdf.setDrawColor(c[0], c[1], c[2])
    const police = (style: 'normal' | 'bold' | 'italic' | 'bolditalic', taille: number, c: RGB = C.texte) => {
        pdf.setFont('helvetica', style); pdf.setFontSize(taille); couleur(c)
    }
    /** Réduit la taille jusqu'à ce que le texte tienne dans la largeur. */
    const ajuster = (txt: string, largeur: number, depart: number) => {
        let t = depart; pdf.setFontSize(t)
        while (pdf.getTextWidth(txt) > largeur && t > 5) { t -= 0.25; pdf.setFontSize(t) }
        return t
    }
    const filet = (yy: number, x1 = ML, x2 = PW - MR, c: RGB = C.trait, e = 0.2) => {
        couleur(c, 'draw'); pdf.setLineWidth(e); pdf.line(x1, yy, x2, yy)
    }
    const etiquette = (txt: string, x: number, yy: number) => {
        police('bold', 6.4, C.griseClair); pdf.setCharSpace(0.7); pdf.text(txt, x, yy); pdf.setCharSpace(0)
    }
    const bandeau = () => {
        couleur(C.vert, 'fill'); pdf.rect(0, 0, PW / 3, 1.8, 'F')
        couleur(C.jaune, 'fill'); pdf.rect(PW / 3, 0, PW / 3, 1.8, 'F')
        couleur(C.rouge, 'fill'); pdf.rect((PW * 2) / 3, 0, PW / 3 + 1, 1.8, 'F')
    }

    const tauxTva = Math.max(0, ...d.items.map(i => Number(i.tva) || 0))
    const colonneTva = d.items.some(i => (Number(i.tva) || 0) > 0)
    // Débours : lignes « TVA … » refacturées à l'identique (ex. TVA du notaire)
    // alors que RGB, exonérée, ne collecte aucune TVA.
    const debours = d.total_tva === 0 && d.items.some(i => /\bT\.?V\.?A\b/i.test(elementsDescription(i.description).join(' ')))

    // Modèle administrable : les lignes légales (RCCM/IFU) vont au pied, le
    // reste (adresse, téléphones, email) sous le logotype — une seule fois.
    const lignesEntete = modele.entete.split('\n').map(l => l.trim()).filter(Boolean)
    const raison = lignesEntete[0] || 'RETOUR GAGNANT BÉNIN'
    const legales = lignesEntete.slice(1).filter(l => /RCCM|IFU/i.test(l))
    const contacts = lignesEntete.slice(1).filter(l => !/RCCM|IFU/i.test(l))

    // ── EN-TÊTE ──────────────────────────────────────────────────────────────
    bandeau()
    let y = 12
    try { pdf.addImage(LOGO_BASE64, 'PNG', ML, y, 17, 17) } catch { /* logo indisponible */ }
    const lx = ML + 21
    // Logotype tricolore : RETOUR vert, GAGNANT jaune or (saturation alignée
    // sur le vert et le rouge, lisible sur blanc sans contour), BÉNIN rouge.
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(15)
    couleur(C.vert); pdf.text('RETOUR', lx, y + 6)
    const wRetour = pdf.getTextWidth('RETOUR ')
    couleur(C.jaune); pdf.text('GAGNANT', lx + wRetour, y + 6)
    police('bold', 8.2, C.rouge); pdf.setCharSpace(3.2)
    pdf.text('BÉNIN', lx, y + 11)
    pdf.setCharSpace(0)
    if (!/RETOUR\s+GAGNANT/i.test(raison)) { police('bold', 8, C.texte); pdf.text(raison, lx, y + 15) }
    police('normal', 6.9, C.gris)
    pdf.text(contacts.slice(0, 3), lx, y + 16, { lineHeightFactor: 1.35 })

    // Titre + références (droite)
    police('bold', 22, C.nuit)
    pdf.text(titre, PW - MR, y + 7, { align: 'right' })
    // Moyen ENREGISTRÉ (payment_method, détaillé au paiement), sinon le
    // prestataire noté « Méthode : … ». Jamais deviné (« kkiapay » ≠ Mobile
    // Money : Kkiapay encaisse aussi les cartes bancaires).
    const moyen = libelleMoyenPaiement(d.paymentMethod) || libelleMoyenPaiement(/M[ée]thode\s*:\s*([^\n]+)/i.exec(d.notes || '')?.[1])
    const meta: string[] = [`N° ${d.invoiceRef}`, `Date : ${dateLisible(d.date)}`]
    if (type === 'devis' && d.validite) meta.push(`Validité : ${d.validite}`)
    if (type === 'facture' && d.dueDate && !d.isPaid) meta.push(`Échéance : ${dateLisible(d.dueDate)}`)
    if (type === 'facture' && d.isPaid) meta.push(`Réglée le ${dateLisible(d.paidAt || d.date)}${moyen ? ` · ${moyen}` : ''}`)
    police('normal', 7.8, C.gris)
    pdf.text(meta, PW - MR, y + 12.5, { align: 'right', lineHeightFactor: 1.4 })
    const b = badge(d)
    police('bold', 7, [255, 255, 255])
    const bW = Math.max(22, pdf.getTextWidth(b.texte) + 9)
    const bY = y + 13 + meta.length * 3.85
    couleur(b.couleur, 'fill')
    pdf.roundedRect(PW - MR - bW, bY, bW, 5.6, 2.8, 2.8, 'F')
    pdf.text(b.texte, PW - MR - bW / 2, bY + 3.85, { align: 'center' })
    y = Math.max(y + 16 + Math.min(3, contacts.length) * 3.3, bY + 8)

    filet(y, ML, PW - MR, C.trait, 0.25)
    y += 7

    // ── CLIENT ────────────────────────────────────────────────────────────────
    const client = nomPropre(d.clientName) || 'Client'
    etiquette(type === 'devis' ? 'DEVIS ÉTABLI POUR' : type === 'avoir' ? 'AVOIR EN FAVEUR DE' : 'FACTURÉ À', ML, y)
    police('bold', 10.5, C.texte)
    ajuster(client, CW, 10.5)
    pdf.text(client, ML, y + 5.5)
    const infosClient = [d.clientEmail, d.clientPhone, d.clientAddress].map(nomPropre).filter(Boolean)
    police('normal', 7.4, C.gris)
    const ligneInfos = pdf.splitTextToSize(infosClient.join('   ·   '), CW) as string[]
    if (ligneInfos.length) pdf.text(ligneInfos.slice(0, 2), ML, y + 10, { lineHeightFactor: 1.35 })
    y += 10 + Math.min(2, ligneInfos.length) * 3.6 + 4

    // ── TABLEAU ──────────────────────────────────────────────────────────────
    const wQte = 14, wPu = 32, wTva = colonneTva ? 15 : 0, wTot = 34
    const cols = [
        { label: 'DÉSIGNATION', w: CW - wQte - wPu - wTva - wTot, align: 'left' as const },
        { label: 'QTÉ', w: wQte, align: 'center' as const },
        { label: 'P.U. HT', w: wPu, align: 'right' as const },
        ...(colonneTva ? [{ label: 'TVA', w: wTva, align: 'center' as const }] : []),
        { label: 'TOTAL HT', w: wTot, align: 'right' as const },
    ]
    const xCol = (i: number) => ML + cols.slice(0, i).reduce((a, c) => a + c.w, 0)
    const iTot = cols.length - 1
    const enteteTableau = () => {
        couleur(C.fond, 'fill'); pdf.rect(ML, y, CW, 7.5, 'F')
        // Pas d'espacement de lettres : jsPDF l'ignore au calcul de largeur,
        // les libellés alignés à droite débordaient.
        police('bold', 6.6, C.gris)
        cols.forEach((c, i) => {
            const x = c.align === 'right' ? xCol(i) + c.w - 3 : c.align === 'center' ? xCol(i) + c.w / 2 : xCol(i) + 3
            pdf.text(c.label, x, y + 4.9, { align: c.align })
        })
        y += 7.5
    }
    const nouvellePage = () => { pdf.addPage(); bandeau(); y = 14 }
    enteteTableau()
    d.items.forEach(it => {
        police('normal', 8)
        const lignes = pdf.splitTextToSize(descriptionPourPdf(it.description), cols[0].w - 6) as string[]
        const h = Math.max(8.5, lignes.length * 3.9 + 4.6)
        if (y + h > BAS) { nouvellePage(); enteteTableau() }
        police('normal', 8, C.texte)
        lignes.forEach((l, li) => pdf.text(l, ML + 3, y + 5.4 + li * 3.9))
        const yMil = y + 5.4
        police('normal', 7.8, C.gris)
        pdf.text(String(Number(it.quantity) || 0), xCol(1) + cols[1].w / 2, yMil, { align: 'center' })
        pdf.text(montant(it.unit_price, cur), xCol(2) + cols[2].w - 3, yMil, { align: 'right' })
        if (colonneTva) pdf.text(`${Number(it.tva) || 0} %`, xCol(3) + cols[3].w / 2, yMil, { align: 'center' })
        police('bold', 8, C.texte)
        pdf.text(montant((Number(it.quantity) || 0) * (Number(it.unit_price) || 0), cur), xCol(iTot) + cols[iTot].w - 3, yMil, { align: 'right' })
        filet(y + h, ML, PW - MR, C.trait, 0.15)
        y += h
    })
    y += 5

    // ── TOTAUX ────────────────────────────────────────────────────────────────
    const totW = 80, totX = PW - MR - totW
    const lignesTot: [string, string][] = []
    // Sous-total affiché seulement s'il diffère du total (remise ou TVA)
    if (d.remise > 0 || d.total_tva > 0) lignesTot.push(['Sous-total HT', montant(d.sous_total, cur)])
    if (d.remise > 0) lignesTot.push(['Remise', '- ' + montant(d.remise, cur)])
    if (d.total_tva > 0) lignesTot.push([`TVA ${tauxTva} %`, montant(d.total_tva, cur)])
    const hTot = lignesTot.length * 6 + 14
    if (y + hTot > BAS) nouvellePage()
    lignesTot.forEach(([l, v]) => {
        police('normal', 8, C.gris); pdf.text(l, totX + 3, y + 4.2)
        police('normal', 8, C.texte); pdf.text(v, PW - MR - 3, y + 4.2, { align: 'right' })
        y += 6
    })
    couleur(C.vert, 'fill'); pdf.roundedRect(totX, y, totW, 10.5, 1.8, 1.8, 'F')
    police('bold', 8, [255, 255, 255]); pdf.setCharSpace(0.4)
    pdf.text(type === 'avoir' ? 'TOTAL AVOIR' : 'TOTAL TTC', totX + 4, y + 6.7); pdf.setCharSpace(0)
    const totalTxt = montant(d.total, cur)
    police('bold', 11, [255, 255, 255])
    ajuster(totalTxt, totW - 34, 11)
    pdf.text(totalTxt, PW - MR - 4, y + 7, { align: 'right' })
    y += 15

    // ── SOMME EN LETTRES (+ débours) ─────────────────────────────────────────
    const phrases = [
        `${type === 'devis' ? 'Arrêté le présent devis' : type === 'avoir' ? 'Arrêté le présent avoir' : 'Arrêtée la présente facture'} à la somme de ${montantEnLettres(d.total, cur).toLowerCase().replace(/\bcfa\b/g, 'CFA')} TTC.`,
    ]
    if (debours) phrases.push('Les montants de TVA figurant dans les lignes sont des frais réels refacturés à l’identique (débours), notamment la TVA facturée par le notaire.')
    police('italic', 7.4)
    const lignesMention = phrases.flatMap(p => pdf.splitTextToSize(p, CW) as string[])
    const hMention = lignesMention.length * 3.6 + 3
    if (y + hMention > BAS) nouvellePage()
    police('italic', 7.4, C.gris)
    pdf.text(lignesMention, ML, y, { lineHeightFactor: 1.3 })
    y += hMention + 3

    // Conditions / références : les lignes techniques internes ne sont pas pour le client.
    // « Méthode : » répétait le moyen déjà affiché en en-tête (et en code brut).
    const notesClient = (d.notes || '').split('\n').map(l => l.trim())
        .filter(l => l && !/auto-?g[ée]n[ée]r|^\[|^paiement en ligne via|^m[ée]thode\s*:/i.test(l)).join('\n')
    // Conditions techniques des documents automatiques : rien d'utile au client.
    const conditions = (d.conditions || '').trim()
    const conditionsClient = /g[ée]n[ée]r[ée] automatiquement|paiement effectu[ée] en ligne/i.test(conditions) ? '' : conditions
    const blocs = [
        ...(conditionsClient ? [['CONDITIONS', conditionsClient]] : []),
        ...(notesClient ? [['RÉFÉRENCES', notesClient]] : []),
    ] as [string, string][]
    for (const [etq, texte] of blocs) {
        police('normal', 7.2)
        const l = (pdf.splitTextToSize(texte.trim(), CW) as string[]).slice(0, 10)
        const h = l.length * 3.5 + 7
        if (y + h > BAS) nouvellePage()
        etiquette(etq, ML, y + 2)
        police('normal', 7.2, C.gris); pdf.text(l, ML, y + 6.5, { lineHeightFactor: 1.3 })
        y += h + 2
    }

    // Certification fiscale e-MCF / MECeF
    if (d.mecef && (d.mecef.code || d.mecef.nim)) {
        const h = 26
        if (y + h > BAS) nouvellePage()
        couleur(C.fondVert, 'fill'); pdf.roundedRect(ML, y, CW, h, 2, 2, 'F')
        let tX = ML + 5
        if (d.mecef.qrDataUrl) {
            try { pdf.addImage(d.mecef.qrDataUrl, 'PNG', ML + 3, y + 2, 22, 22); tX = ML + 29 } catch { /* QR illisible */ }
        }
        police('bold', 7.2, C.vertFonce); pdf.text('FACTURE CERTIFIÉE — e-MCF / MECeF (DGI BÉNIN)', tX, y + 7)
        police('normal', 6.8, C.gris)
        const lm = [
            d.mecef.code && `Code de contrôle : ${d.mecef.code}`,
            d.mecef.nim && `NIM : ${d.mecef.nim}`,
            d.mecef.compteurs && `Compteurs : ${d.mecef.compteurs}`,
            d.mecef.dateHeure && `Certifiée le ${dateLisible(d.mecef.dateHeure)}`,
        ].filter(Boolean) as string[]
        pdf.text(lm, tX, y + 12, { lineHeightFactor: 1.45 })
        y += h + 5
    }

    // ── SIGNATURES ───────────────────────────────────────────────────────────
    // Deux cartes jumelles (même hauteur, même grammaire) : « Bon pour accord »
    // du client à gauche, Direction générale à droite. La carte client n'existe
    // que si elle a un sens : devis, ou document réellement signé.
    const paraphe = d.clientSignatureDataUrl
    const signe = !!paraphe || !!d.signedAt || (d.statut || '').toLowerCase() === 'accepte'
    const cadreClient = type === 'devis' || (type === 'facture' && signe)
    const sigW = CW / 2 - 3, sigH = 44, hautH = 8.5
    if (y + sigH + 2 > BAS) nouvellePage()
    y += 2
    const carte = (x: number, fondHaut: RGB, etq: string, tricolore = false) => {
        // ombre portée très douce + carte blanche
        couleur([236, 240, 245], 'fill'); pdf.roundedRect(x + 0.5, y + 0.7, sigW, sigH, 2.6, 2.6, 'F')
        couleur([255, 255, 255], 'fill'); couleur(C.trait, 'draw'); pdf.setLineWidth(0.3)
        pdf.roundedRect(x, y, sigW, sigH, 2.6, 2.6, 'FD')
        // bandeau d'en-tête de la carte
        couleur(fondHaut, 'fill'); pdf.roundedRect(x + 0.15, y + 0.15, sigW - 0.3, hautH, 2.5, 2.5, 'F')
        pdf.rect(x + 0.15, y + hautH - 2.5, sigW - 0.3, 2.5, 'F')
        if (tricolore) {
            const t = (sigW - 0.3) / 3
            couleur(C.vert, 'fill'); pdf.rect(x + 0.15, y + hautH, t, 0.7, 'F')
            couleur(C.jaune, 'fill'); pdf.rect(x + 0.15 + t, y + hautH, t, 0.7, 'F')
            couleur(C.rouge, 'fill'); pdf.rect(x + 0.15 + 2 * t, y + hautH, t, 0.7, 'F')
        } else {
            filet(y + hautH + 0.2, x + 0.15, x + sigW - 0.15, C.trait, 0.25)
        }
        police('bold', 6.6, C.vertFonce); pdf.setCharSpace(0.7)
        pdf.text(etq, x + 5, y + 5.6); pdf.setCharSpace(0)
    }

    if (cadreClient) {
        carte(ML, C.fond, 'BON POUR ACCORD — CLIENT')
        const zX = ML + 5, zY = y + hautH + 3, zW = sigW - 10, zH = sigH - hautH - 14
        let pose = false
        if (paraphe) {
            try {
                const p = pdf.getImageProperties(paraphe)
                const r = p.width > 0 && p.height > 0 ? p.width / p.height : zW / zH
                let w = zW, h = w / r
                if (h > zH) { h = zH; w = h * r }
                pdf.addImage(paraphe, paraphe.startsWith('data:image/jp') ? 'JPEG' : 'PNG', zX + (zW - w) / 2, zY + (zH - h) / 2, w, h, undefined, 'FAST')
                pose = true
            } catch { /* paraphe illisible : mention textuelle */ }
        }
        const yLigne = y + sigH - 9
        if (pose || signe) {
            filet(yLigne, zX, zX + zW, C.trait, 0.25)
            // pastille « signé »
            const cx = zX + 1.5, cy = y + sigH - 5.1
            couleur(C.vert, 'fill'); pdf.circle(cx, cy, 1.5, 'F')
            couleur([255, 255, 255], 'draw'); pdf.setLineWidth(0.35)
            pdf.line(cx - 0.7, cy, cx - 0.2, cy + 0.55); pdf.line(cx - 0.2, cy + 0.55, cx + 0.75, cy - 0.5)
            police('normal', 6.8, C.vertFonce)
            pdf.text(`Signé électroniquement le ${dateLisible(d.signedAt || d.paidAt || d.date)}`, zX + 4.2, y + sigH - 4.2)
        } else {
            // Pas encore signé : espace de signature réel, sans mention trompeuse.
            couleur(C.griseClair, 'draw'); pdf.setLineWidth(0.25)
            pdf.setLineDashPattern([0.9, 0.9], 0)
            pdf.line(zX, yLigne, zX + zW, yLigne)
            pdf.setLineDashPattern([], 0)
            police('italic', 6.6, C.gris)
            pdf.text('Date, signature et mention « Bon pour accord »', zX, y + sigH - 4.2)
        }
    }

    // Direction générale (droite) — nom à gauche du cachet, jamais superposés.
    const dX = PW - MR - sigW
    carte(dX, C.fondVert, modele.titreSignataire.toUpperCase(), true)
    const cachet = 29
    try {
        pdf.addImage(STAMP_BASE64, 'PNG', dX + sigW - cachet - 3, y + hautH + (sigH - hautH - cachet) / 2 + 0.3, cachet, cachet, undefined, 'FAST')
    } catch { /* cachet indisponible */ }
    const texteW = sigW - cachet - 11
    police('normal', 6.6, C.gris); pdf.text('La Directrice Générale', dX + 5, y + hautH + 7.5)
    pdf.setFont('times', 'bolditalic'); couleur(C.vertFonce)
    const tSig = ajuster(modele.signataire, texteW, 13)
    pdf.setFontSize(tSig); pdf.text(modele.signataire, dX + 5, y + hautH + 16)
    couleur(C.jaune, 'draw'); pdf.setLineWidth(0.6)
    pdf.line(dX + 5, y + hautH + 18.2, dX + 5 + Math.min(texteW, pdf.getTextWidth(modele.signataire)), y + hautH + 18.2)
    police('normal', 6.3, C.griseClair)
    pdf.text('Signature et cachet de l’entreprise', dX + 5, y + sigH - 4.2)
    y += sigH + 4

    // ── SIGNATURE GRAPHIQUE « GRAFFITI » (choix de Kevin, 30/09/2026) ──────
    // Trois coups de pinceau tricolores, éclaboussures et « Merci ! » manuscrit,
    // dans l'espace libre de la DERNIÈRE page. Tracés vectoriels (aucune image :
    // poids du PDF inchangé). Réduit si la place manque ; absent s'il n'y en a
    // pas assez (jamais sur le contenu, jamais de page ajoutée pour lui).
    // Pas sur les avoirs (un remerciement n'a pas de sens sur une note de crédit).
    if (type !== 'avoir') {
        const ZH = 57                            // hauteur de la zone de référence (mm)
        const libre = BAS - 2 - y
        const k = Math.min(1, libre / ZH)
        if (k >= 0.55) {
            const oy = BAS - 2 - ZH * k, ox = ML  // ancré en bas de page, à gauche
            const X = (x: number) => ox + x * k, Y = (v: number) => oy + v * k
            const opacite = (o: number) => pdf.setGState(new GState({ opacity: o, 'stroke-opacity': o }))
            // Coups de pinceau (courbes de Bézier, extrémités arrondies)
            const coup = (c: RGB, y0: number, ep: number, dx: number) => {
                couleur(c, 'draw'); pdf.setLineWidth(ep * k); pdf.setLineCap('round')
                pdf.lines([[40 * k, -14 * k, 90 * k, 6 * k, (150 + dx) * k, -20 * k]], X(6), Y(y0), [1, 1], 'S')
            }
            opacite(0.9)
            coup(C.vert, 35, 7, 0); coup(C.jaune, 44, 5.5, -8); coup(C.rouge, 51, 4, -18)
            // Éclaboussures (positions fixes : rendu identique d'un document à l'autre)
            opacite(0.25)
            const tons = [C.vert, C.jaune, C.rouge]
            for (let i = 0; i < 26; i++) {
                couleur(tons[i % 3], 'fill')
                pdf.circle(X(134 + (i * 37) % 44), Y(7 + (i * 53) % 22), (0.4 + (i % 4) * 0.35) * k, 'F')
            }
            opacite(1)
            pdf.setLineCap('butt')
            pdf.setFont('times', 'bolditalic'); pdf.setFontSize(30 * k); couleur(C.nuit)
            pdf.text('Merci !', X(8), Y(17), { angle: 6 })
            pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7 * k); couleur(C.vert)
            pdf.text('BIENVENUE AU BÉNIN', X(10), Y(24), { angle: 6, charSpace: 1.4 * k })
        }
    }

    // ── PIED DE PAGE (toutes les pages) ──────────────────────────────────────
    // Mentions légales seulement (les coordonnées sont dans l'en-tête).
    const piedModele = modele.pied.split('\n').map(l => l.trim()).filter(Boolean)
        .map(l => l.replace(/\s*[—:-]?\s*TVA[^—:]*applicable\s*[—:-]?\s*/i, ' ').trim())
        .filter(l => l && !/^En cas de litige/i.test(l) && !/si[èe]ge|@/i.test(l))
    const legal = piedModele[0] || [raison, ...legales].join(' — ')
    const mentionTva = tauxTva > 0 && d.total_tva > 0 ? `TVA ${tauxTva} % applicable` : 'Exonérée de TVA'
    const pied = [legal, `${mentionTva} — En cas de litige, seules les juridictions béninoises sont compétentes.`]
    const nb = pdf.getNumberOfPages()
    for (let p = 1; p <= nb; p++) {
        pdf.setPage(p)
        filet(PH - PIED_H, ML, PW - MR, C.trait, 0.25)
        police('normal', 6.6, C.griseClair)
        pied.forEach((l, i) => pdf.text(l, PW / 2, PH - PIED_H + 5 + i * 3.6, { align: 'center' }))
        if (nb > 1) {
            police('normal', 6.4, C.griseClair)
            pdf.text(`${d.invoiceRef} · ${p}/${nb}`, PW - MR, PH - 4, { align: 'right' })
        }
    }
    return pdf
}

/** Nom de fichier cohérent partout : devis_DEV-…pdf / facture_FAC-…pdf. */
export const nomFichierDocument = (type: string | undefined, numero: string) =>
    `${type === 'devis' ? 'devis' : type === 'avoir' ? 'avoir' : 'facture'}_${String(numero).replace(/[^\w.-]+/g, '_')}.pdf`

/** Lignes du modèle administrable (`document_templates.content`). */
export function modeleDepuisContenu(c: Record<string, unknown> | null | undefined): ModeleDocument {
    const s = (v: unknown) => (typeof v === 'string' && v.trim() ? v : undefined)
    return { entete: s(c?.header), pied: s(c?.footer), signataire: s(c?.signature_name), titreSignataire: s(c?.signature_title) }
}
