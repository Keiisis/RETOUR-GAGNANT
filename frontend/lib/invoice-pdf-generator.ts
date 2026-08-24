import { jsPDF } from 'jspdf'
import { LOGO_BASE64, STAMP_BASE64 } from './logoBase64'

export interface InvoicePdfItem {
    description: string
    quantity: number
    unit_price: number
    tva: number
}

export interface InvoicePdfData {
    invoiceRef: string
    date: string
    paidAt?: string
    isPaid: boolean
    clientName: string
    clientEmail?: string
    clientPhone?: string
    clientAddress?: string
    items: InvoicePdfItem[]
    currency: string
    sous_total: number
    total_tva: number
    remise: number
    total: number
    notes?: string
    conditions?: string
    validite?: string
    isManual?: boolean
    /** 'facture' (défaut) ou 'devis' : change le titre, le badge et le texte légal. */
    docType?: 'devis' | 'facture'
    /**
     * Paraphe du client (`client_signatures.signature_data`), en data URL —
     * exactement celui que la facture du site appose dans « Bon pour accord ».
     * Absent : le cadre garde sa mention textuelle.
     */
    clientSignatureDataUrl?: string
}

/* Montant formaté pour le PDF.
   ⚠️ `Intl.NumberFormat('fr-FR')` sépare les milliers par une ESPACE FINE
   INSÉCABLE (U+202F, parfois U+00A0). Ce caractère n'existe pas dans
   l'encodage WinAnsi des polices standard de jsPDF : le lecteur affichait
   donc « 10/000 XOF » au lieu de « 10 000 XOF » — sur la facture ET sur le
   devis, montant en toutes lettres compris. On repasse en espace ordinaire.
   La classe ci-dessous contient U+202F, U+00A0 et U+2009 ecrits
   litteralement : ne pas les remplacer par des espaces normales. */
const ESPACES_FINES = /[   ]/g

const fmt = (val: number, cur: string) => {
    const rounded = (cur === 'XOF' || cur === 'FCFA') ? Math.round(val) : Math.round(val * 100) / 100
    return new Intl.NumberFormat('fr-FR').format(rounded).replace(ESPACES_FINES, ' ') + ' ' + cur
}

// Convert amount in numbers to French words
function toWordsFr(n: number): string {
    if (n === 0) return 'ZÉRO'
    if (n < 0) return 'MOINS ' + toWordsFr(-n)

    const ones = ['', 'UN', 'DEUX', 'TROIS', 'QUATRE', 'CINQ', 'SIX', 'SEPT', 'HUIT', 'NEUF',
        'DIX', 'ONZE', 'DOUZE', 'TREIZE', 'QUATORZE', 'QUINZE', 'SEIZE',
        'DIX-SEPT', 'DIX-HUIT', 'DIX-NEUF']
    const tens = ['', 'DIX', 'VINGT', 'TRENTE', 'QUARANTE', 'CINQUANTE', 'SOIXANTE', 'SOIXANTE', 'QUATRE-VINGT', 'QUATRE-VINGT']

    function below100(n: number): string {
        if (n < 20) return ones[n]
        const t = Math.floor(n / 10), u = n % 10
        if (t === 7) return u === 1 ? 'SOIXANTE ET ONZE' : 'SOIXANTE-' + ones[10 + u]
        if (t === 9) return u === 0 ? 'QUATRE-VINGT-DIX' : 'QUATRE-VINGT-' + ones[10 + u]
        if (u === 0) return t === 8 ? 'QUATRE-VINGTS' : tens[t]
        if (u === 1 && t !== 8) return tens[t] + ' ET UN'
        return tens[t] + '-' + ones[u]
    }

    function below1000(n: number): string {
        if (n < 100) return below100(n)
        const h = Math.floor(n / 100), r = n % 100
        const hStr = h === 1 ? 'CENT' : ones[h] + ' CENT'
        if (r === 0) return h === 1 ? 'CENT' : ones[h] + ' CENTS'
        return hStr + ' ' + below100(r)
    }

    if (n < 1000) return below1000(n)

    const units = [
        { val: 1e9, sing: 'MILLIARD', plur: 'MILLIARDS' },
        { val: 1e6, sing: 'MILLION', plur: 'MILLIONS' },
        { val: 1e3, sing: 'MILLE', plur: 'MILLE' }
    ]

    let res = ''
    let remaining = n
    for (const unit of units) {
        const quotient = Math.floor(remaining / unit.val)
        if (quotient > 0) {
            /* « MILLE » se dit seul, mais « UN MILLION » et « UN MILLIARD »
               gardent leur unité : la somme en toutes lettres annonçait
               « MILLION TROIS CENT HUIT MILLE… » sur les devis à sept
               chiffres — un montant légal amputé de son premier mot. */
            const word = quotient === 1
                ? (unit.val === 1e3 ? unit.sing : 'UN ' + unit.sing)
                : below1000(quotient) + ' ' + unit.plur
            res += (res ? ' ' : '') + word
            remaining %= unit.val
        }
    }
    if (remaining > 0) {
        res += (res ? ' ' : '') + below1000(remaining)
    }
    return res
}

export function generateInvoicePdf(data: InvoicePdfData): string {
    const pdf = new jsPDF('p', 'mm', 'a4')

    const PW = 210
    const PH = 297
    const ML = 15
    const MR = 15
    const CW = PW - ML - MR

    // Color Palette
    const C = {
        primary: [0, 135, 81] as [number, number, number],
        secondary: [252, 209, 22] as [number, number, number],
        dark: [15, 25, 45] as [number, number, number],
        textDark: [30, 30, 30] as [number, number, number],
        textMuted: [100, 100, 100] as [number, number, number],
        bgLight: [245, 247, 250] as [number, number, number]
    }

    let y = 12

    // ── DRAPEAU BÉNIN BANDEAU ──────────────────────────────────────────
    pdf.setFillColor(0, 135, 81)
    pdf.rect(0, 0, PW / 3, 3, 'F')
    pdf.setFillColor(252, 209, 22)
    pdf.rect(PW / 3, 0, PW / 3, 3, 'F')
    pdf.setFillColor(232, 17, 45)
    pdf.rect((PW * 2) / 3, 0, PW / 3 + 1, 3, 'F')

    y += 4

    // ── HEADER ─────────────────────────────────────────────────────────
    // Company Logo
    try {
        pdf.addImage(LOGO_BASE64, 'PNG', ML, y, 16, 16)
    } catch (e) {
        console.warn('Failed to add logo to invoice PDF:', e)
    }

    // Company Name & Info
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(14)
    pdf.setTextColor(C.primary[0], C.primary[1], C.primary[2])
    pdf.text('RETOUR GAGNANT BÉNIN', ML + 20, y + 4)

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7.5)
    pdf.setTextColor(80, 80, 80)
    pdf.text([
        'RCCM : RB/COT/26 B 42001 | IFU : 3202644573981',
        'Haie-Vive Cocotiers, Cotonou, Bénin',
        'WhatsApp : +229 01 94 35 50 50 / +229 01 60 32 21 21',
        'Appel direct : +229 01 66 73 89 71 | contact@retourgagnantbenin.bj'
    ], ML + 20, y + 8)

    // Document Meta
    const isDevis = data.docType === 'devis'
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(22)
    pdf.setTextColor(C.dark[0], C.dark[1], C.dark[2])
    pdf.text(isDevis ? 'DEVIS' : 'FACTURE', PW - MR, y + 5, { align: 'right' })

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(80, 80, 80)
    pdf.text(`${isDevis ? 'Réf.' : 'N°'} : ${data.invoiceRef}`, PW - MR, y + 11, { align: 'right' })
    pdf.text(`Date : ${data.date}`, PW - MR, y + 15, { align: 'right' })

    // Status Badge : devis : "DEVIS" (vert) ; facture : ACQUITTÉE / EN ATTENTE
    const statusText = isDevis ? (data.validite ? `VALABLE ${data.validite}` : 'DEVIS') : (data.isPaid ? 'ACQUITTEE' : 'EN ATTENTE')
    const statusW = isDevis ? 34 : 28
    const statusH = 6
    const badgeGreen = isDevis || data.isPaid
    pdf.setFillColor(badgeGreen ? 0 : 220, badgeGreen ? 135 : 120, badgeGreen ? 81 : 30)
    pdf.roundedRect(PW - MR - statusW, y + 18, statusW, statusH, 1, 1, 'F')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(7.5)
    pdf.setTextColor(255, 255, 255)
    pdf.text(statusText, PW - MR - statusW / 2, y + 22.2, { align: 'center' })

    y += 28

    // ── CLIENT / FACTURÉ À ─────────────────────────────────────────────
    const boxW = CW / 2 - 4
    const boxH = 26

    // Left block - Emetteur
    pdf.setFillColor(242, 245, 249)
    pdf.roundedRect(ML, y, boxW, boxH, 1.5, 1.5, 'F')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(7)
    pdf.setTextColor(70, 90, 120)
    pdf.text('ÉMETTEUR', ML + 4, y + 4.5)
    pdf.setDrawColor(210, 220, 235)
    pdf.setLineWidth(0.2)
    pdf.line(ML + 4, y + 6, ML + boxW - 4, y + 6)

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(8.5)
    pdf.setTextColor(30, 40, 60)
    pdf.text('RETOUR GAGNANT BÉNIN', ML + 4, y + 10)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    pdf.setTextColor(80, 80, 80)
    pdf.text([
        'Haie-Vive Cocotiers, Cotonou',
        'IFU : 3202644573981',
        'contact@retourgagnantbenin.bj'
    ], ML + 4, y + 14)

    // Right block - Client
    pdf.setFillColor(245, 246, 248)
    pdf.roundedRect(ML + boxW + 8, y, boxW, boxH, 1.5, 1.5, 'F')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(7)
    pdf.setTextColor(100, 100, 100)
    // Un devis n'est adressé à personne « en facture » : le libellé suit la nature.
    pdf.text(isDevis ? 'DEVIS POUR / CLIENT' : 'FACTURE À / CLIENT', ML + boxW + 12, y + 4.5)
    pdf.line(ML + boxW + 12, y + 6, ML + CW - 4, y + 6)

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(8.5)
    pdf.setTextColor(30, 30, 30)
    pdf.text(data.clientName.toUpperCase(), ML + boxW + 12, y + 10)

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    pdf.setTextColor(80, 80, 80)
    const clientLines = [
        data.clientEmail || '',
        data.clientPhone || '',
        data.clientAddress || ''
    ].filter(Boolean).slice(0, 3)
    pdf.text(clientLines, ML + boxW + 12, y + 14)

    y += boxH + 8

    // ── TABLE OF ITEMS ──────────────────────────────────────────────────
    const cols = [
        { label: 'DESCRIPTION DU SERVICE', w: 90, align: 'left' as const },
        { label: 'QTÉ', w: 14, align: 'center' as const },
        { label: 'PU HT', w: 25, align: 'right' as const },
        { label: 'TVA', w: 16, align: 'center' as const },
        { label: 'TOTAL HT', w: 35, align: 'right' as const }
    ]

    // Table Header
    pdf.setFillColor(C.dark[0], C.dark[1], C.dark[2])
    pdf.rect(ML, y, CW, 10, 'F')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(7)
    pdf.setTextColor(255, 255, 255)

    let cx = ML
    cols.forEach(c => {
        const tx = c.align === 'right' ? cx + c.w - 2 : c.align === 'center' ? cx + c.w / 2 : cx + 3
        pdf.text(c.label, tx, y + 6.5, { align: c.align })
        cx += c.w
    })
    y += 10

    // Table Rows
    data.items.forEach((item, i) => {
        const itemLines = pdf.splitTextToSize(item.description, cols[0].w - 4)
        const rowH = Math.max(9, itemLines.length * 4.5 + 3)
        const even = i % 2 === 0

        pdf.setFillColor(even ? 250 : 244, even ? 250 : 246, even ? 250 : 244)
        pdf.rect(ML, y, CW, rowH, 'F')
        pdf.setDrawColor(220, 225, 230)
        pdf.setLineWidth(0.15)
        pdf.line(ML, y + rowH, ML + CW, y + rowH)

        // Draw description text
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(7.5)
        pdf.setTextColor(40, 40, 40)
        itemLines.forEach((line: string, li: number) => {
            pdf.text(line, ML + 3, y + 5 + li * 4.5)
        })

        // Draw other columns
        const midY = y + rowH / 2 + 1.5
        const rowTotalHT = item.quantity * item.unit_price

        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(7.5)
        pdf.setTextColor(60, 60, 60)

        // Qty
        pdf.text(item.quantity.toString(), ML + cols[0].w + cols[1].w / 2, midY, { align: 'center' })
        // PU HT
        pdf.text(fmt(item.unit_price, data.currency), ML + cols[0].w + cols[1].w + cols[2].w - 2, midY, { align: 'right' })
        // TVA
        pdf.text(`${item.tva}%`, ML + cols[0].w + cols[1].w + cols[2].w + cols[3].w / 2, midY, { align: 'center' })
        // TOTAL HT
        pdf.text(fmt(rowTotalHT, data.currency), ML + CW - 2, midY, { align: 'right' })

        y += rowH
    })

    y += 6

    // ── TOTALS ─────────────────────────────────────────────────────────
    const totW = 75
    const totX = PW - MR - totW

    const drawTotRow = (lbl: string, valStr: string, bold = false) => {
        pdf.setFont('helvetica', bold ? 'bold' : 'normal')
        pdf.setFontSize(bold ? 8.5 : 8)
        pdf.setTextColor(bold ? 0 : 70, bold ? 0 : 80, bold ? 0 : 90)
        pdf.text(lbl, totX, y + 5)
        pdf.text(valStr, PW - MR, y + 5, { align: 'right' })
        y += 6.5
    }

    /* Le taux affiché est celui des LIGNES, plus un « 18% » écrit en dur :
       le document annonçait « TVA 18% » face à « 0 XOF », ce qui donne un
       document qui se contredit lui-même sous les yeux du client. */
    const tauxTva = Math.max(0, ...data.items.map(i => Number(i.tva) || 0))
    drawTotRow('Sous-total HT :', fmt(data.sous_total, data.currency))
    drawTotRow(
        tauxTva > 0 ? `TVA ${tauxTva} % :` : 'TVA (exonéré) :',
        fmt(data.total_tva, data.currency),
    )
    if (data.remise > 0) {
        drawTotRow('Remise :', '-' + fmt(data.remise, data.currency))
    }

    // Grand Total Box
    pdf.setFillColor(C.primary[0], C.primary[1], C.primary[2])
    pdf.roundedRect(totX - 2, y, totW + 2, 10, 1.2, 1.2, 'F')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9)
    pdf.setTextColor(255, 255, 255)
    pdf.text('TOTAL TTC :', totX, y + 6.5)
    pdf.setTextColor(C.secondary[0], C.secondary[1], C.secondary[2])
    pdf.text(fmt(data.total, data.currency), PW - MR, y + 6.5, { align: 'right' })

    y += 15

    // ── LEGAL CLAUSES & SUMMARY IN WORDS ──────────────────────────────
    const amtWords = toWordsFr(data.total)
    const summaryText = isDevis
        ? `Arrêté le présent devis à la somme de ${amtWords} (${fmt(data.total, data.currency)}) TTC.`
        : `Arrêtée la présente facture à la somme de ${amtWords} (${fmt(data.total, data.currency)}) TTC.`
    const summaryLines = pdf.splitTextToSize(summaryText, CW - 6)

    pdf.setFillColor(248, 249, 251)
    pdf.setDrawColor(210, 215, 225)
    pdf.setLineWidth(0.2)
    const boxLegalH = summaryLines.length * 4.5 + 6
    pdf.roundedRect(ML, y, CW, boxLegalH, 1.5, 1.5, 'FD')

    pdf.setFont('helvetica', 'italic')
    pdf.setFontSize(7.5)
    pdf.setTextColor(60, 60, 60)
    pdf.text(summaryLines, ML + 3, y + 5)

    y += boxLegalH + 8

    // ── SIGNATURES ─────────────────────────────────────────────────────
    const sigW = CW / 2 - 4
    const sigH = 46

    /* Le bloc de signatures ne doit jamais passer sous le pied de page :
       une facture à beaucoup de lignes le poussait hors de la feuille, et
       le cachet finissait coupé. */
    if (y + sigH + 12 > PH - 30) {
        pdf.addPage()
        y = 20
    }

    /** Réduit la taille jusqu'à ce que le texte tienne dans la largeur donnée. */
    const tailleQuiTient = (txt: string, largeurMax: number, depart: number) => {
        let t = depart
        pdf.setFontSize(t)
        while (pdf.getTextWidth(txt) > largeurMax && t > 5) {
            t -= 0.25
            pdf.setFontSize(t)
        }
        return t
    }

    /* Bloc « Bon pour accord » du client.
       Il était masqué sur toute facture acquittée (`isManual`) : le client qui
       avait pris la peine d'enregistrer sa signature ne la voyait donc JAMAIS
       sur ses factures de service. Le paraphe l'emporte désormais sur ce
       masquage — quand il existe, le bon pour accord s'affiche, et c'est la
       vraie signature qui y figure, comme sur la facture du site. */
    const paraphe = data.clientSignatureDataUrl
    const formatParaphe = paraphe?.startsWith('data:image/jpeg') || paraphe?.startsWith('data:image/jpg')
        ? 'JPEG' : 'PNG'
    if (!data.isManual || paraphe) {
        pdf.setFillColor(250, 253, 251)
        pdf.setDrawColor(C.primary[0], C.primary[1], C.primary[2])
        pdf.setLineWidth(0.4)
        pdf.roundedRect(ML, y, sigW, sigH, 2, 2, 'FD')
        pdf.setLineWidth(0.2)
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(7)
        pdf.setTextColor(0, 107, 64)
        pdf.setCharSpace(0.5)
        pdf.text('BON POUR ACCORD : CLIENT', ML + 5, y + 7)
        pdf.setCharSpace(0)
        pdf.setDrawColor(200, 230, 215)
        pdf.line(ML + 5, y + 9, ML + sigW - 5, y + 9)

        let paraphePose = false
        if (paraphe) {
            /* Le tracé est déposé dans le cadre SANS déformation : un paraphe
               étiré ne ressemble plus à la signature de personne. On mesure
               l'image, on la met à l'échelle du plus contraignant des deux
               côtés, et on la centre au-dessus de la mention de date.
               Un fichier illisible ne doit pas emporter la facture entière :
               on retombe alors sur la mention textuelle. */
            try {
                const zoneX = ML + 5
                const zoneY = y + 11
                const zoneW = sigW - 10
                const zoneH = sigH - 22
                const props = pdf.getImageProperties(paraphe)
                const ratio = props.width > 0 && props.height > 0 ? props.width / props.height : zoneW / zoneH
                let w = zoneW
                let h = w / ratio
                if (h > zoneH) { h = zoneH; w = h * ratio }
                pdf.addImage(
                    paraphe, formatParaphe,
                    zoneX + (zoneW - w) / 2, zoneY + (zoneH - h) / 2,
                    w, h, undefined, 'FAST',
                )
                paraphePose = true
            } catch (e) {
                console.error('[invoice-pdf] signature client illisible:', e instanceof Error ? e.message : e)
            }
        }

        pdf.setFont('helvetica', 'italic')
        pdf.setFontSize(6.5)
        pdf.setTextColor(120, 120, 120)
        if (paraphePose) {
            pdf.text('Signé électroniquement le ' + (data.paidAt || data.date), ML + 5, y + sigH - 4)
        } else {
            pdf.setFontSize(7)
            pdf.text('Signature apposée électroniquement', ML + 5, y + 20)
            pdf.text('le ' + data.date, ML + 5, y + 25)
        }
    } else {
        // Manual invoice status indicator instead of signature
        pdf.setFillColor(242, 248, 244)
        pdf.setDrawColor(C.primary[0], C.primary[1], C.primary[2])
        pdf.setLineWidth(0.4)
        pdf.roundedRect(ML, y, sigW, sigH, 2, 2, 'FD')
        pdf.setLineWidth(0.2)
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(7)
        pdf.setTextColor(0, 107, 64)
        pdf.setCharSpace(0.5)
        pdf.text('CONFIRMATION DE PAIEMENT', ML + 5, y + 7)
        pdf.setCharSpace(0)
        pdf.setDrawColor(200, 230, 215)
        pdf.line(ML + 5, y + 9, ML + sigW - 5, y + 9)
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(8.5)
        pdf.setTextColor(C.primary[0], C.primary[1], C.primary[2])
        pdf.text('PAIEMENT ENREGISTRÉ', ML + 5, y + 18)
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(7)
        pdf.setTextColor(80, 80, 80)
        pdf.text([
            `Moyen : ${data.notes?.includes(' Zeyow') ? 'Zeyow' : data.notes?.includes('Stripe') ? 'Stripe' : data.notes?.includes('PayPal') ? 'PayPal' : 'Mobile Money'}`,
            `Date de règlement : ${data.paidAt || data.date}`
        ], ML + 5, y + 25)
    }

    /* ── CADRE « DIRECTION GÉNÉRALE » ──────────────────────────────────
       Repris trait pour trait de la GRILLE TARIFAIRE officielle
       (`/api/grille-tarifaire/print`) : mêmes lignes, même ordre, mêmes
       couleurs, cachet à droite. Le cadre bleu à deux lignes qui figurait
       ici ne ressemblait à aucun autre document de l'agence — deux
       identités visuelles pour un même émetteur, c'est une signature
       qu'on ne reconnaît pas. */
    const dgX = ML + sigW + 8
    const dgTexteX = dgX + 5
    const cachetTaille = 30
    // Le cachet occupe la droite du cadre : le texte s'arrête avant lui.
    const dgTexteW = sigW - cachetTaille - 12

    pdf.setFillColor(240, 255, 246)
    pdf.setDrawColor(C.primary[0], C.primary[1], C.primary[2])
    pdf.setLineWidth(0.4)
    pdf.roundedRect(dgX, y, sigW, sigH, 2, 2, 'FD')

    // Le cachet d'abord : le texte se pose par-dessus, jamais l'inverse.
    try {
        pdf.addImage(
            STAMP_BASE64, 'PNG',
            dgX + sigW - cachetTaille - 3, y + (sigH - cachetTaille) / 2,
            cachetTaille, cachetTaille,
            undefined, 'FAST',
        )
    } catch (e) {
        console.warn('Failed to add stamp to invoice PDF:', e)
    }

    // DIRECTION GÉNÉRALE (interlettrage, comme la grille)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(7)
    pdf.setTextColor(0, 107, 64)
    pdf.setCharSpace(0.5)
    pdf.text('DIRECTION GÉNÉRALE', dgTexteX, y + 7)
    pdf.setCharSpace(0)

    pdf.setFontSize(6.5)
    pdf.setTextColor(C.primary[0], C.primary[1], C.primary[2])
    pdf.text('RETOUR GAGNANT BÉNIN', dgTexteX, y + 12)

    pdf.setTextColor(0, 0, 0)
    pdf.text('La Présidente Directrice Générale :', dgTexteX, y + 18)

    // Le nom : réduit s'il le faut, jamais tronqué ni posé sur le cachet.
    pdf.setTextColor(C.primary[0], C.primary[1], C.primary[2])
    const taillleNom = tailleQuiTient('Nathalie RIFFERT GERMANY', dgTexteW, 9.5)
    pdf.setFontSize(taillleNom)
    pdf.text('Nathalie RIFFERT GERMANY', dgTexteX, y + 24.5)

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(6.5)
    pdf.setTextColor(102, 102, 119)
    pdf.text('Signature et Cachet officiel', dgTexteX, y + 30)

    pdf.setTextColor(136, 136, 136)
    pdf.text(`Fait à Cotonou, le ${data.date}`, dgTexteX, y + 35)

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(6)
    pdf.setTextColor(C.primary[0], C.primary[1], C.primary[2])
    pdf.setCharSpace(0.3)
    pdf.text('VALIDITÉ OFFICIELLE GARANTIE', dgTexteX, y + 40.5)
    pdf.setCharSpace(0)
    pdf.setLineWidth(0.2)

    y += sigH + 10

    // ── FOOTER DARK ────────────────────────────────────────────────────
    // Drawn at the absolute bottom of the page
    const footerY = PH - 24
    pdf.setFillColor(C.dark[0], C.dark[1], C.dark[2])
    pdf.rect(0, footerY, PW, 24, 'F')

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7.5)
    pdf.setTextColor(120, 150, 180)
    pdf.text('RETOUR GAGNANT BÉNIN : RCCM : RB/COT/26 B 42001 : IFU : 3202644573981', PW / 2, footerY + 6, { align: 'center' })
    pdf.text('Siège : Haie-Vive Cocotiers, Cotonou. Email : contact@retourgagnantbenin.bj', PW / 2, footerY + 11, { align: 'center' })
    pdf.text(
        tauxTva > 0
            ? `TVA ${tauxTva} % applicable : En cas de litige, seules les juridictions béninoises sont compétentes.`
            : 'En cas de litige, seules les juridictions béninoises sont compétentes.',
        PW / 2, footerY + 16, { align: 'center' },
    )

    const pdfData = pdf.output('arraybuffer')
    return Buffer.from(pdfData).toString('base64')
}
