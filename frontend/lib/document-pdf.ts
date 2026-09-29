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
import { jsPDF } from 'jspdf'
import { LOGO_BASE64, STAMP_BASE64 } from './logoBase64'
import { descriptionPourPdf, elementsDescription } from '@/lib/description-lignes'

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
export function dessinerDocumentPdf(d: DocumentPdfDonnees): jsPDF {
    const pdf = new jsPDF('p', 'mm', 'a4')
    const PW = 210, PH = 297, ML = 14, MR = 14, CW = PW - ML - MR
    const PIED_H = 22
    const BAS = PH - PIED_H - 3          // limite utile avant le pied de page
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
    const bandeau = () => {
        couleur(C.vert, 'fill'); pdf.rect(0, 0, PW / 3, 2.6, 'F')
        couleur(C.or, 'fill'); pdf.rect(PW / 3, 0, PW / 3, 2.6, 'F')
        couleur(C.rouge, 'fill'); pdf.rect((PW * 2) / 3, 0, PW / 3 + 1, 2.6, 'F')
    }

    const tauxTva = Math.max(0, ...d.items.map(i => Number(i.tva) || 0))
    // Débours : lignes « TVA … » refacturées à l'identique (ex. TVA du notaire)
    // alors que RGB, exonérée, ne collecte aucune TVA.
    const debours = d.total_tva === 0 && d.items.some(i => /\bT\.?V\.?A\b/i.test(elementsDescription(i.description).join(' ')))

    // ── EN-TÊTE ──────────────────────────────────────────────────────────────
    bandeau()
    let y = 12
    try { pdf.addImage(LOGO_BASE64, 'PNG', ML, y, 19, 19) } catch { /* logo indisponible */ }
    const lignesEntete = modele.entete.split('\n').map(l => l.trim()).filter(Boolean)
    police('bold', 15, C.vert)
    pdf.text(lignesEntete[0] || 'RETOUR GAGNANT BÉNIN', ML + 23, y + 5)
    police('normal', 7.2, C.gris)
    pdf.text(lignesEntete.slice(1, 5), ML + 23, y + 9.5, { lineHeightFactor: 1.35 })

    police('bold', 24, C.nuit)
    pdf.text(titre, PW - MR, y + 7, { align: 'right' })
    police('normal', 8, C.gris)
    const meta: string[] = [`N° ${d.invoiceRef}`, `Date : ${dateLisible(d.date)}`]
    if (type === 'devis' && d.validite) meta.push(`Validité : ${d.validite}`)
    if (type === 'facture' && d.dueDate && !d.isPaid) meta.push(`Échéance : ${dateLisible(d.dueDate)}`)
    if (type === 'facture' && d.isPaid && d.paidAt) meta.push(`Réglée le ${dateLisible(d.paidAt)}`)
    pdf.text(meta, PW - MR, y + 12.5, { align: 'right', lineHeightFactor: 1.4 })
    const b = badge(d)
    police('bold', 7.4, [255, 255, 255])
    const bW = Math.max(26, pdf.getTextWidth(b.texte) + 10)
    const bY = y + 13 + meta.length * 3.95
    couleur(b.couleur, 'fill')
    pdf.roundedRect(PW - MR - bW, bY, bW, 6.2, 3.1, 3.1, 'F')
    pdf.text(b.texte, PW - MR - bW / 2, bY + 4.2, { align: 'center' })
    y = Math.max(y + 29, bY + 9)

    couleur(C.trait, 'draw'); pdf.setLineWidth(0.3)
    pdf.line(ML, y, PW - MR, y)
    y += 5

    // ── ÉMETTEUR / CLIENT ─────────────────────────────────────────────────────
    const boxW = CW / 2 - 3
    const client = nomPropre(d.clientName) || 'Client'
    const infosClient = [d.clientEmail, d.clientPhone, d.clientAddress].map(nomPropre).filter(Boolean)
    police('normal', 7.2)
    const adresseLignes = infosClient.flatMap(l => pdf.splitTextToSize(l, boxW - 10) as string[]).slice(0, 4)
    const boxH = Math.max(27, 15 + adresseLignes.length * 3.8 + 4)
    // Émetteur
    couleur(C.fond, 'fill'); pdf.roundedRect(ML, y, boxW, boxH, 2, 2, 'F')
    couleur(C.vert, 'fill'); pdf.rect(ML, y + 2, 1.1, boxH - 4, 'F')
    police('bold', 6.6, C.vertFonce); pdf.setCharSpace(0.6)
    pdf.text('ÉMETTEUR', ML + 5, y + 5.5); pdf.setCharSpace(0)
    police('bold', 9, C.texte); pdf.text(lignesEntete[0] || 'RETOUR GAGNANT BÉNIN', ML + 5, y + 11)
    police('normal', 7.2, C.gris)
    pdf.text(['Haie-Vive Cocotiers, Cotonou — Bénin', 'IFU : 3202644573981', 'contact@retourgagnantbenin.bj'], ML + 5, y + 15.5, { lineHeightFactor: 1.4 })
    // Client
    const cX = ML + boxW + 6
    couleur(C.fond, 'fill'); pdf.roundedRect(cX, y, boxW, boxH, 2, 2, 'F')
    couleur(C.or, 'fill'); pdf.rect(cX, y + 2, 1.1, boxH - 4, 'F')
    police('bold', 6.6, C.vertFonce); pdf.setCharSpace(0.6)
    pdf.text(type === 'devis' ? 'DEVIS ÉTABLI POUR' : type === 'avoir' ? 'AVOIR EN FAVEUR DE' : 'FACTURÉ À', cX + 5, y + 5.5); pdf.setCharSpace(0)
    police('bold', 9, C.texte)
    ajuster(client, boxW - 10, 9)
    pdf.text(client, cX + 5, y + 11)
    police('normal', 7.2, C.gris)
    if (adresseLignes.length) pdf.text(adresseLignes, cX + 5, y + 15.5, { lineHeightFactor: 1.4 })
    y += boxH + 6

    // ── TABLEAU ──────────────────────────────────────────────────────────────
    const cols = [
        { label: 'DÉSIGNATION', w: 84, align: 'left' as const },
        { label: 'QTÉ', w: 13, align: 'center' as const },
        { label: 'P.U. HT', w: 30, align: 'right' as const },
        { label: 'TVA', w: 15, align: 'center' as const },
        { label: 'TOTAL HT', w: CW - 84 - 13 - 30 - 15, align: 'right' as const },
    ]
    const xCol = (i: number) => ML + cols.slice(0, i).reduce((a, c) => a + c.w, 0)
    const enteteTableau = () => {
        couleur(C.nuit, 'fill'); pdf.roundedRect(ML, y, CW, 9, 1.5, 1.5, 'F')
        police('bold', 6.9, [255, 255, 255])
        cols.forEach((c, i) => {
            const x = c.align === 'right' ? xCol(i) + c.w - 3 : c.align === 'center' ? xCol(i) + c.w / 2 : xCol(i) + 4
            pdf.text(c.label, x, y + 5.9, { align: c.align })
        })
        y += 9
    }
    const nouvellePage = () => { pdf.addPage(); bandeau(); y = 14 }
    enteteTableau()
    d.items.forEach((it, i) => {
        police('normal', 7.8)
        const lignes = pdf.splitTextToSize(descriptionPourPdf(it.description), cols[0].w - 7) as string[]
        const h = Math.max(8, lignes.length * 3.9 + 4.2)
        if (y + h > BAS) { nouvellePage(); enteteTableau() }
        couleur(i % 2 ? [255, 255, 255] : C.fond, 'fill'); pdf.rect(ML, y, CW, h, 'F')
        couleur(C.trait, 'draw'); pdf.setLineWidth(0.15); pdf.line(ML, y + h, ML + CW, y + h)
        police('normal', 7.8, C.texte)
        lignes.forEach((l, li) => pdf.text(l, ML + 4, y + 5.2 + li * 3.9))
        const yMil = y + 5.2
        police('normal', 7.6, C.gris)
        pdf.text(String(Number(it.quantity) || 0), xCol(1) + cols[1].w / 2, yMil, { align: 'center' })
        pdf.text(montant(it.unit_price, cur), xCol(2) + cols[2].w - 3, yMil, { align: 'right' })
        pdf.text(`${Number(it.tva) || 0} %`, xCol(3) + cols[3].w / 2, yMil, { align: 'center' })
        police('bold', 7.8, C.texte)
        pdf.text(montant((Number(it.quantity) || 0) * (Number(it.unit_price) || 0), cur), ML + CW - 3, yMil, { align: 'right' })
        y += h
    })
    y += 4

    // ── TOTAUX ────────────────────────────────────────────────────────────────
    const totW = 86, totX = PW - MR - totW
    const lignesTot: [string, string][] = [['Sous-total HT', montant(d.sous_total, cur)]]
    if (d.remise > 0) lignesTot.push(['Remise', '- ' + montant(d.remise, cur)])
    lignesTot.push([tauxTva > 0 ? `TVA ${tauxTva} %` : 'TVA RGB (exonérée)', montant(d.total_tva, cur)])
    const hTot = lignesTot.length * 6 + 16
    if (y + hTot > BAS) nouvellePage()
    lignesTot.forEach(([l, v]) => {
        police('normal', 8, C.gris); pdf.text(l, totX + 4, y + 4.5)
        police('bold', 8, C.texte); pdf.text(v, PW - MR - 4, y + 4.5, { align: 'right' })
        couleur(C.trait, 'draw'); pdf.setLineWidth(0.15); pdf.line(totX + 4, y + 6.5, PW - MR - 4, y + 6.5)
        y += 6.4
    })
    y += 1.5
    couleur(C.vert, 'fill'); pdf.roundedRect(totX, y, totW, 11.5, 2, 2, 'F')
    police('bold', 8.6, [255, 255, 255]); pdf.setCharSpace(0.5)
    pdf.text(type === 'avoir' ? 'TOTAL AVOIR' : 'TOTAL TTC', totX + 5, y + 7.3); pdf.setCharSpace(0)
    const totalTxt = montant(d.total, cur)
    police('bold', 11.5, C.or)
    ajuster(totalTxt, totW - 40, 11.5)
    pdf.text(totalTxt, PW - MR - 5, y + 7.5, { align: 'right' })
    y += 15

    // ── SOMME EN LETTRES + MENTIONS ──────────────────────────────────────────
    const phrases = [
        `${type === 'devis' ? 'Arrêté le présent devis' : type === 'avoir' ? 'Arrêté le présent avoir' : 'Arrêtée la présente facture'} à la somme de ${montantEnLettres(d.total, cur)} (${totalTxt}) TTC.`,
    ]
    if (debours) phrases.push('Retour Gagnant Bénin est exonérée de TVA. Les montants de TVA figurant dans les lignes sont des frais réels refacturés à l’identique (débours), notamment la TVA facturée par le notaire.')
    police('italic', 7.6)
    const lignesMention = phrases.flatMap(p => pdf.splitTextToSize(p, CW - 10) as string[])
    const hMention = lignesMention.length * 3.8 + 6
    if (y + hMention > BAS) nouvellePage()
    couleur(C.fondVert, 'fill'); pdf.roundedRect(ML, y, CW, hMention, 2, 2, 'F')
    couleur(C.vert, 'fill'); pdf.rect(ML, y + 1.5, 1.1, hMention - 3, 'F')
    police('italic', 7.6, C.texte)
    pdf.text(lignesMention, ML + 5, y + 5, { lineHeightFactor: 1.3 })
    y += hMention + 4

    // Notes / conditions (saisies sur le document)
    // Notes : les lignes techniques internes (« Facture auto-générée… ») ne sont pas pour le client.
    const notesClient = (d.notes || '').split('\n').map(l => l.trim())
        .filter(l => l && !/auto-?g[ée]n[ée]r|^\[|^paiement en ligne via/i.test(l)).join('\n')
    const blocs = [
        ...(d.conditions ? [['CONDITIONS', d.conditions]] : []),
        ...(notesClient ? [['RÉFÉRENCES', notesClient]] : []),
    ] as [string, string][]
    for (const [etiquette, texte] of blocs) {
        police('normal', 7.2)
        const l = (pdf.splitTextToSize(texte.trim(), CW - 10) as string[]).slice(0, 10)
        const h = l.length * 3.5 + 10
        if (y + h > BAS) nouvellePage()
        couleur(C.trait, 'draw'); pdf.setLineWidth(0.25); pdf.roundedRect(ML, y, CW, h, 2, 2, 'S')
        police('bold', 6.6, C.vertFonce); pdf.setCharSpace(0.6); pdf.text(etiquette, ML + 5, y + 5); pdf.setCharSpace(0)
        police('normal', 7.2, C.gris); pdf.text(l, ML + 5, y + 9.5, { lineHeightFactor: 1.3 })
        y += h + 3
    }

    // Certification fiscale e-MCF / MECeF
    if (d.mecef && (d.mecef.code || d.mecef.nim)) {
        const h = 28
        if (y + h > BAS) nouvellePage()
        couleur(C.fondVert, 'fill'); couleur(C.vert, 'draw'); pdf.setLineWidth(0.3)
        pdf.roundedRect(ML, y, CW, h, 2, 2, 'FD')
        let tX = ML + 5
        if (d.mecef.qrDataUrl) {
            try { pdf.addImage(d.mecef.qrDataUrl, 'PNG', ML + 3, y + 3, 22, 22); tX = ML + 29 } catch { /* QR illisible */ }
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
    const sigW = CW / 2 - 3, sigH = 44
    if (y + sigH > BAS) nouvellePage()
    const cadre = (x: number, fond: RGB, bord: RGB, etiquette: string) => {
        couleur(fond, 'fill'); couleur(bord, 'draw'); pdf.setLineWidth(0.35)
        pdf.roundedRect(x, y, sigW, sigH, 2.5, 2.5, 'FD')
        police('bold', 6.6, C.vertFonce); pdf.setCharSpace(0.6); pdf.text(etiquette, x + 5, y + 6.5); pdf.setCharSpace(0)
        couleur(C.trait, 'draw'); pdf.setLineWidth(0.15); pdf.line(x + 5, y + 8.5, x + sigW - 5, y + 8.5)
    }

    // Client — l'état affiché suit la réalité du document.
    const paraphe = d.clientSignatureDataUrl
    const confirmationPaiement = type === 'facture' && (d.isManual || (d.isPaid && !paraphe))
    cadre(ML, [252, 254, 253], C.vert, confirmationPaiement ? 'CONFIRMATION DE PAIEMENT' : type === 'avoir' ? 'ACCUSÉ DE RÉCEPTION' : 'BON POUR ACCORD — CLIENT')
    if (confirmationPaiement) {
        police('bold', 10, C.vert); pdf.text('PAIEMENT REÇU', ML + 5, y + 17)
        police('normal', 7.4, C.gris)
        const moyen = d.paymentMethod || (/zeyow/i.test(d.notes || '') ? 'Zeyow' : /stripe/i.test(d.notes || '') ? 'Stripe' : /paypal/i.test(d.notes || '') ? 'PayPal' : /kkiapay|mobile money/i.test(d.notes || '') ? 'Mobile Money' : '')
        pdf.text([
            `Date de règlement : ${dateLisible(d.paidAt || d.date)}`,
            ...(moyen ? [`Moyen de paiement : ${moyen}`] : []),
            'Le règlement vaut acceptation de la prestation.',
        ], ML + 5, y + 24, { lineHeightFactor: 1.5 })
    } else {
        let pose = false
        if (paraphe) {
            try {
                const zX = ML + 6, zY = y + 11, zW = sigW - 12, zH = sigH - 22
                const p = pdf.getImageProperties(paraphe)
                const r = p.width > 0 && p.height > 0 ? p.width / p.height : zW / zH
                let w = zW, h = w / r
                if (h > zH) { h = zH; w = h * r }
                pdf.addImage(paraphe, paraphe.startsWith('data:image/jp') ? 'JPEG' : 'PNG', zX + (zW - w) / 2, zY + (zH - h) / 2, w, h, undefined, 'FAST')
                pose = true
            } catch { /* paraphe illisible : mention textuelle */ }
        }
        police('bold', 8.2, C.texte)
        pdf.text(client, ML + 5, y + sigH - 9)
        police('italic', 6.8, C.gris)
        if (pose || d.signedAt || (d.statut || '').toLowerCase() === 'accepte') {
            pdf.text(`Signé électroniquement le ${dateLisible(d.signedAt || d.paidAt || d.date)}`, ML + 5, y + sigH - 4.5)
        } else {
            // Pas encore signé : espace de signature réel, sans mention trompeuse.
            couleur(C.griseClair, 'draw'); pdf.setLineWidth(0.2)
            pdf.setLineDashPattern([0.8, 0.8], 0)
            pdf.line(ML + 5, y + 26, ML + sigW - 5, y + 26)
            pdf.setLineDashPattern([], 0)
            pdf.text('Date, signature et mention « Bon pour accord »', ML + 5, y + sigH - 4.5)
        }
    }

    // Direction générale — nom à gauche, cachet à droite : jamais superposés.
    const dX = ML + sigW + 6
    cadre(dX, C.fondVert, C.vert, modele.titreSignataire.toUpperCase())
    const cachet = 36
    try {
        pdf.addImage(STAMP_BASE64, 'PNG', dX + sigW - cachet - 2, y + (sigH - cachet) / 2 + 2.5, cachet, cachet, undefined, 'FAST')
    } catch { /* cachet indisponible */ }
    const texteW = sigW - cachet - 12
    police('normal', 6.8, C.gris); pdf.text('La Directrice Générale', dX + 5, y + 14)
    pdf.setFont('times', 'bolditalic'); couleur(C.vertFonce)
    const tSig = ajuster(modele.signataire, texteW, 12)
    pdf.setFontSize(tSig); pdf.text(modele.signataire, dX + 5, y + 22)
    couleur(C.or, 'draw'); pdf.setLineWidth(0.5); pdf.line(dX + 5, y + 24, dX + 5 + Math.min(texteW, pdf.getTextWidth(modele.signataire)), y + 24)
    police('normal', 6.6, C.gris)
    pdf.text(['Signature et cachet officiels', `Fait à Cotonou, le ${dateLisible(d.date)}`], dX + 5, y + 30, { lineHeightFactor: 1.5 })
    y += sigH + 4

    // ── PIED DE PAGE (toutes les pages) ──────────────────────────────────────
    const pied = modele.pied.split('\n').map(l => l.trim()).filter(Boolean)
        // Toute mention de TVA figée dans le modèle est remplacée par la mention calculée.
        .map(l => l.replace(/\s*[—:-]?\s*TVA[^—:]*applicable\s*[—:-]?\s*/i, ' ').trim())
        .filter(l => !/^En cas de litige/i.test(l) && l)
        .slice(0, 2)
    const mentionTva = tauxTva > 0 ? `TVA ${tauxTva} % applicable` : 'Retour Gagnant Bénin : exonérée de TVA'
    pied.push(`${mentionTva} — En cas de litige, seules les juridictions béninoises sont compétentes.`)
    const nb = pdf.getNumberOfPages()
    for (let p = 1; p <= nb; p++) {
        pdf.setPage(p)
        couleur(C.nuit, 'fill'); pdf.rect(0, PH - PIED_H, PW, PIED_H, 'F')
        couleur(C.vert, 'fill'); pdf.rect(0, PH - PIED_H, PW, 0.8, 'F')
        police('normal', 6.9, [182, 196, 214])
        pied.forEach((l, i) => pdf.text(l, PW / 2, PH - PIED_H + 6 + i * 4, { align: 'center' }))
        police('normal', 6.2, [120, 138, 160])
        pdf.text(`${titre} N° ${d.invoiceRef}  ·  Page ${p}/${nb}`, PW / 2, PH - 3.5, { align: 'center' })
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
