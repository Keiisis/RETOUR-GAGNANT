// ══════════════════════════════════════════════════════════════
//  Langues des devis / factures / avoirs (PDF).
//
//  Les libellés FIXES du document (titres, colonnes, totaux, mentions) ne
//  passent jamais par une IA : ils sont écrits ici, une fois, pour chaque
//  langue. Seuls les textes saisis (lignes, notes, conditions) sont traduits
//  à la volée (lib/translation/documents.ts), avec contrôle des chiffres.
//
//  Garde-fous :
//   - le montant en lettres est rédigé par code (jamais par l'IA) et suivi
//     du montant en chiffres dans toute langue autre que le français ;
//   - en créole, pas de montant en lettres (aucune norme écrite fiable) :
//     le montant est donné en chiffres ;
//   - toute version traduite porte la mention « seul l'original français
//     fait foi » : le document légal reste le document français.
// ══════════════════════════════════════════════════════════════

export type LangueDoc = 'fr' | 'en' | 'es' | 'pt' | 'cr' | 'ht'
export type TypeDoc = 'devis' | 'facture' | 'avoir'

export const LANGUES_DOC: { code: LangueDoc; libelle: string; drapeau: string }[] = [
    { code: 'fr', libelle: 'Français', drapeau: '🇫🇷' },
    { code: 'en', libelle: 'English', drapeau: '🇬🇧' },
    { code: 'es', libelle: 'Español', drapeau: '🇪🇸' },
    { code: 'pt', libelle: 'Português', drapeau: '🇧🇷' },
    { code: 'cr', libelle: 'Kréyòl', drapeau: '🇬🇵' },
    { code: 'ht', libelle: 'Kreyòl Ayisyen', drapeau: '🇭🇹' },
]

/** Code de langue accepté, sinon français (jamais d'erreur sur une valeur inattendue). */
export function langueDoc(v: unknown): LangueDoc {
    const s = String(v ?? '').toLowerCase().slice(0, 2)
    return (LANGUES_DOC.some(l => l.code === s) ? s : 'fr') as LangueDoc
}

export interface LibellesDoc {
    /** Locale des nombres (séparateurs de milliers / décimales). */
    locale: string
    /** Dates : 'mois' = « 6 oct. 2026 » (sans ambiguïté jour/mois), 'num' = JJ/MM/AAAA. */
    dates: 'mois' | 'num'
    /** Séparateur libellé : valeur (« : » en typographie française). */
    dp: string
    titre: Record<TypeDoc, string>
    badge: { avoir: string; accepte: string; refuse: string; annule: string; regle: string; valable: string; proposition: string; acquittee: string; annulee: string; enRetard: string; aRegler: string }
    numero: string; date: string; validite: string; echeance: string; regleeLe: string
    pour: Record<TypeDoc, string>
    client: string
    cols: { designation: string; qte: string; pu: string; tva: string; totalHt: string }
    sousTotal: string; remise: string; tva: string; totalAvoir: string; totalTtc: string
    /** Phrase « arrêté à la somme de » ; `somme` est déjà rédigée. */
    arrete: (type: TypeDoc, somme: string) => string
    debours: string
    conditions: string; references: string
    mecef: { titre: string; code: string; nim: string; compteurs: string; certifieeLe: string }
    bonPourAccord: string; signeLe: string; mentionSignature: string; directrice: string; cachet: string
    merci: string; bienvenue: string
    tvaApplicable: (taux: number) => string
    exonere: string
    litige: string
    /** Mention des versions traduites (absente en français). */
    avertissement?: string
}

const FR: LibellesDoc = {
    locale: 'fr-FR', dates: 'num', dp: ' : ',
    titre: { devis: 'DEVIS', facture: 'FACTURE', avoir: 'AVOIR' },
    badge: { avoir: 'AVOIR', accepte: 'ACCEPTÉ', refuse: 'REFUSÉ', annule: 'ANNULÉ', regle: 'RÉGLÉ', valable: 'VALABLE', proposition: 'PROPOSITION', acquittee: 'ACQUITTÉE', annulee: 'ANNULÉE', enRetard: 'EN RETARD', aRegler: 'À RÉGLER' },
    numero: 'N°', date: 'Date', validite: 'Validité', echeance: 'Échéance', regleeLe: 'Réglée le',
    pour: { devis: 'DEVIS ÉTABLI POUR', facture: 'FACTURÉ À', avoir: 'AVOIR EN FAVEUR DE' },
    client: 'Client',
    cols: { designation: 'DÉSIGNATION', qte: 'QTÉ', pu: 'P.U. HT', tva: 'TVA', totalHt: 'TOTAL HT' },
    sousTotal: 'Sous-total HT', remise: 'Remise', tva: 'TVA', totalAvoir: 'TOTAL AVOIR', totalTtc: 'TOTAL TTC',
    arrete: (t, s) => `${t === 'devis' ? 'Arrêté le présent devis' : t === 'avoir' ? 'Arrêté le présent avoir' : 'Arrêtée la présente facture'} à la somme de ${s} TTC.`,
    debours: 'Les montants de TVA figurant dans les lignes sont des frais réels refacturés à l’identique (débours), notamment la TVA facturée par le notaire.',
    conditions: 'CONDITIONS', references: 'RÉFÉRENCES',
    mecef: { titre: 'FACTURE CERTIFIÉE — e-MCF / MECeF (DGI BÉNIN)', code: 'Code de contrôle', nim: 'NIM', compteurs: 'Compteurs', certifieeLe: 'Certifiée le' },
    bonPourAccord: 'BON POUR ACCORD — CLIENT', signeLe: 'Signé électroniquement le', mentionSignature: 'Date, signature et mention « Bon pour accord »',
    directrice: 'La Directrice Générale', cachet: 'Signature et cachet de l’entreprise',
    merci: 'Merci !', bienvenue: 'BIENVENUE AU BÉNIN',
    tvaApplicable: t => `TVA ${t} % applicable`, exonere: 'Exonérée de TVA',
    litige: 'En cas de litige, seules les juridictions béninoises sont compétentes.',
}

const EN: LibellesDoc = {
    locale: 'en-GB', dates: 'mois', dp: ': ',
    titre: { devis: 'QUOTE', facture: 'INVOICE', avoir: 'CREDIT NOTE' },
    badge: { avoir: 'CREDIT NOTE', accepte: 'ACCEPTED', refuse: 'DECLINED', annule: 'CANCELLED', regle: 'SETTLED', valable: 'VALID FOR', proposition: 'PROPOSAL', acquittee: 'PAID', annulee: 'CANCELLED', enRetard: 'OVERDUE', aRegler: 'PAYMENT DUE' },
    numero: 'No.', date: 'Date', validite: 'Valid for', echeance: 'Due date', regleeLe: 'Paid on',
    pour: { devis: 'QUOTE PREPARED FOR', facture: 'BILLED TO', avoir: 'CREDIT NOTE ISSUED TO' },
    client: 'Client',
    cols: { designation: 'DESCRIPTION', qte: 'QTY', pu: 'UNIT PRICE', tva: 'VAT', totalHt: 'TOTAL EXCL. VAT' },
    sousTotal: 'Subtotal (excl. VAT)', remise: 'Discount', tva: 'VAT', totalAvoir: 'TOTAL CREDIT', totalTtc: 'TOTAL (INCL. VAT)',
    arrete: (t, s) => `${t === 'devis' ? 'This quote' : t === 'avoir' ? 'This credit note' : 'This invoice'} amounts to a total of ${s}, all taxes included.`,
    debours: 'The VAT amounts shown in the lines are actual costs re-invoiced at cost (disbursements), in particular the VAT charged by the notary.',
    conditions: 'TERMS', references: 'REFERENCES',
    mecef: { titre: 'CERTIFIED INVOICE — e-MCF / MECeF (DGI BENIN)', code: 'Control code', nim: 'NIM', compteurs: 'Counters', certifieeLe: 'Certified on' },
    bonPourAccord: 'APPROVED — CLIENT', signeLe: 'Electronically signed on', mentionSignature: 'Date, signature and the words "Approved"',
    directrice: 'Managing Director', cachet: 'Company signature and stamp',
    merci: 'Thank you!', bienvenue: 'WELCOME TO BENIN',
    tvaApplicable: t => `VAT ${t} % applicable`, exonere: 'VAT exempt',
    litige: 'In the event of a dispute, only the courts of Benin have jurisdiction.',
    avertissement: 'Translation provided for convenience only: the original French version prevails.',
}

const ES: LibellesDoc = {
    locale: 'es-ES', dates: 'mois', dp: ': ',
    titre: { devis: 'PRESUPUESTO', facture: 'FACTURA', avoir: 'NOTA DE CRÉDITO' },
    badge: { avoir: 'NOTA DE CRÉDITO', accepte: 'ACEPTADO', refuse: 'RECHAZADO', annule: 'ANULADO', regle: 'PAGADO', valable: 'VÁLIDO POR', proposition: 'PROPUESTA', acquittee: 'PAGADA', annulee: 'ANULADA', enRetard: 'VENCIDA', aRegler: 'PENDIENTE DE PAGO' },
    numero: 'N.º', date: 'Fecha', validite: 'Validez', echeance: 'Vencimiento', regleeLe: 'Pagada el',
    pour: { devis: 'PRESUPUESTO PARA', facture: 'FACTURADO A', avoir: 'NOTA DE CRÉDITO A FAVOR DE' },
    client: 'Cliente',
    cols: { designation: 'DESCRIPCIÓN', qte: 'CANT.', pu: 'PRECIO UNIT.', tva: 'IVA', totalHt: 'TOTAL SIN IVA' },
    sousTotal: 'Subtotal sin IVA', remise: 'Descuento', tva: 'IVA', totalAvoir: 'TOTAL CRÉDITO', totalTtc: 'TOTAL CON IVA',
    arrete: (t, s) => `${t === 'devis' ? 'El presente presupuesto' : t === 'avoir' ? 'La presente nota de crédito' : 'La presente factura'} asciende a la suma de ${s}, impuestos incluidos.`,
    debours: 'Los importes de IVA que figuran en las líneas son gastos reales refacturados al costo (suplidos), en particular el IVA facturado por el notario.',
    conditions: 'CONDICIONES', references: 'REFERENCIAS',
    mecef: { titre: 'FACTURA CERTIFICADA — e-MCF / MECeF (DGI BENÍN)', code: 'Código de control', nim: 'NIM', compteurs: 'Contadores', certifieeLe: 'Certificada el' },
    bonPourAccord: 'CONFORME — CLIENTE', signeLe: 'Firmado electrónicamente el', mentionSignature: 'Fecha, firma y la mención «Conforme»',
    directrice: 'La Directora General', cachet: 'Firma y sello de la empresa',
    merci: '¡Gracias!', bienvenue: 'BIENVENIDO A BENÍN',
    tvaApplicable: t => `IVA ${t} % aplicable`, exonere: 'Exenta de IVA',
    litige: 'En caso de litigio, solo los tribunales de Benín son competentes.',
    avertissement: 'Traducción facilitada a título informativo: solo la versión original en francés da fe.',
}

const PT: LibellesDoc = {
    locale: 'pt-BR', dates: 'mois', dp: ': ',
    titre: { devis: 'ORÇAMENTO', facture: 'FATURA', avoir: 'NOTA DE CRÉDITO' },
    badge: { avoir: 'NOTA DE CRÉDITO', accepte: 'ACEITO', refuse: 'RECUSADO', annule: 'CANCELADO', regle: 'PAGO', valable: 'VÁLIDO POR', proposition: 'PROPOSTA', acquittee: 'PAGA', annulee: 'CANCELADA', enRetard: 'EM ATRASO', aRegler: 'A PAGAR' },
    numero: 'N.º', date: 'Data', validite: 'Validade', echeance: 'Vencimento', regleeLe: 'Paga em',
    pour: { devis: 'ORÇAMENTO PARA', facture: 'FATURADO PARA', avoir: 'NOTA DE CRÉDITO EM FAVOR DE' },
    client: 'Cliente',
    cols: { designation: 'DESCRIÇÃO', qte: 'QTD.', pu: 'PREÇO UNIT.', tva: 'IVA', totalHt: 'TOTAL S/ IVA' },
    sousTotal: 'Subtotal s/ IVA', remise: 'Desconto', tva: 'IVA', totalAvoir: 'TOTAL CRÉDITO', totalTtc: 'TOTAL C/ IVA',
    arrete: (t, s) => `${t === 'devis' ? 'O presente orçamento' : t === 'avoir' ? 'A presente nota de crédito' : 'A presente fatura'} totaliza a quantia de ${s}, impostos incluídos.`,
    debours: 'Os valores de IVA indicados nas linhas são despesas reais refaturadas ao custo (reembolsos), em especial o IVA cobrado pelo cartório.',
    conditions: 'CONDIÇÕES', references: 'REFERÊNCIAS',
    mecef: { titre: 'FATURA CERTIFICADA — e-MCF / MECeF (DGI BENIM)', code: 'Código de controle', nim: 'NIM', compteurs: 'Contadores', certifieeLe: 'Certificada em' },
    bonPourAccord: 'DE ACORDO — CLIENTE', signeLe: 'Assinado eletronicamente em', mentionSignature: 'Data, assinatura e a menção «De acordo»',
    directrice: 'A Diretora-Geral', cachet: 'Assinatura e carimbo da empresa',
    merci: 'Obrigado!', bienvenue: 'BEM-VINDO AO BENIM',
    tvaApplicable: t => `IVA de ${t} % aplicável`, exonere: 'Isenta de IVA',
    litige: 'Em caso de litígio, apenas os tribunais do Benim são competentes.',
    avertissement: 'Tradução fornecida a título informativo: somente a versão original em francês faz fé.',
}

const CR: LibellesDoc = {
    locale: 'fr-FR', dates: 'num', dp: ' : ',
    titre: { devis: 'DÉVI', facture: 'FAKTI', avoir: 'AVWA' },
    badge: { avoir: 'AVWA', accepte: 'AKSÈPTÉ', refuse: 'REFIZÉ', annule: 'ANILÉ', regle: 'PÉYÉ', valable: 'VALAB', proposition: 'PWOPOZISYON', acquittee: 'PÉYÉ', annulee: 'ANILÉ', enRetard: 'AN RÉTA', aRegler: 'POU PÉYÉ' },
    numero: 'N°', date: 'Dat', validite: 'Validité', echeance: 'Dènyé dat', regleeLe: 'Péyé lè',
    pour: { devis: 'DÉVI FÈT POU', facture: 'FAKTIRÉ POU', avoir: 'AVWA POU' },
    client: 'Kliyan',
    cols: { designation: 'DESKRIPSYON', qte: 'KTÉ', pu: 'PRI INITÉ', tva: 'TVA', totalHt: 'TOTAL SAN TVA' },
    sousTotal: 'Sou-total san TVA', remise: 'Rimiz', tva: 'TVA', totalAvoir: 'TOTAL AVWA', totalTtc: 'TOTAL ÉPI TVA',
    arrete: (t, s) => `${t === 'devis' ? 'Dévi-lasa' : t === 'avoir' ? 'Avwa-lasa' : 'Fakti-lasa'} ka monté a ${s}, tout taks konpri.`,
    debours: 'Montan TVA ki an liy-yo sé fré rèl ki rifaktiré menm jan (débou), sitou TVA notè-a.',
    conditions: 'KONDISYON', references: 'RÉFÉRANS',
    mecef: { titre: 'FAKTI SÈTIFYÉ — e-MCF / MECeF (DGI BÉNIN)', code: 'Kòd kontwòl', nim: 'NIM', compteurs: 'Kontè', certifieeLe: 'Sètifyé lè' },
    bonPourAccord: 'BON POU DAKÒ — KLIYAN', signeLe: 'Siyé élèktwonikman lè', mentionSignature: 'Dat, siyati épi mansyon « Bon pou dakò »',
    directrice: 'Dirèktris jénéral-la', cachet: 'Siyati épi tanpon antrepriz-la',
    merci: 'Mèsi !', bienvenue: 'BYENVINI AN BÉNIN',
    tvaApplicable: t => `TVA ${t} % ka aplitjé`, exonere: 'Pa ni TVA',
    litige: 'Si ni on lityij, sé tribinal Bénin yonn ki konpétan.',
    avertissement: 'Tradiksyon-lasa la pou fasilité lèkti a-zòt : sé vèwsyon fransé-a yonn ki ka fè lalwa.',
}

const HT: LibellesDoc = {
    locale: 'fr-FR', dates: 'num', dp: ' : ',
    titre: { devis: 'DEVI', facture: 'FAKTI', avoir: 'NÒT KREDI' },
    badge: { avoir: 'NÒT KREDI', accepte: 'AKSEPTE', refuse: 'REFIZE', annule: 'ANILE', regle: 'PEYE', valable: 'VALAB POU', proposition: 'PWOPOZISYON', acquittee: 'PEYE', annulee: 'ANILE', enRetard: 'AN RETA', aRegler: 'POU PEYE' },
    numero: 'N°', date: 'Dat', validite: 'Validite', echeance: 'Dat limit', regleeLe: 'Peye le',
    pour: { devis: 'DEVI POU', facture: 'FAKTI POU', avoir: 'NÒT KREDI POU' },
    client: 'Kliyan',
    cols: { designation: 'DESKRIPSYON', qte: 'KTE', pu: 'PRI INITE', tva: 'TVA', totalHt: 'TOTAL SAN TVA' },
    sousTotal: 'Sou-total san TVA', remise: 'Rabè', tva: 'TVA', totalAvoir: 'TOTAL KREDI', totalTtc: 'TOTAL AK TVA',
    arrete: (t, s) => `${t === 'devis' ? 'Devi sa a' : t === 'avoir' ? 'Nòt kredi sa a' : 'Fakti sa a'} rive nan yon total ${s}, tout taks enkli.`,
    debours: 'Montan TVA ki nan liy yo se vrè frè ki refaktire menm jan (debou), sitou TVA notè a.',
    conditions: 'KONDISYON', references: 'REFERANS',
    mecef: { titre: 'FAKTI SÈTIFYE — e-MCF / MECeF (DGI BENEN)', code: 'Kòd kontwòl', nim: 'NIM', compteurs: 'Kontè', certifieeLe: 'Sètifye le' },
    bonPourAccord: 'BON POU AKÒ — KLIYAN', signeLe: 'Siyen elektwonikman le', mentionSignature: 'Dat, siyati ak mansyon « Bon pou akò »',
    directrice: 'Direktris Jeneral la', cachet: 'Siyati ak so antrepriz la',
    merci: 'Mèsi !', bienvenue: 'BYENVENI NAN BENEN',
    tvaApplicable: t => `TVA ${t} % aplikab`, exonere: 'Egzante TVA',
    litige: 'Si gen yon lityij, se sèlman tribinal Benen yo ki gen konpetans.',
    avertissement: 'Tradiksyon sa a la sèlman pou fasilite lekti : se vèsyon orijinal an franse a sèl ki gen valè legal.',
}

const LIBELLES: Record<LangueDoc, LibellesDoc> = { fr: FR, en: EN, es: ES, pt: PT, cr: CR, ht: HT }
export const libellesDoc = (l?: LangueDoc | null): LibellesDoc => LIBELLES[l || 'fr'] || FR

/** Objet et corps de l'email qui accompagne un document envoyé au client (texte fixe, jamais généré). */
export function messageEnvoi(l: LangueDoc, o: { type: TypeDoc; numero: string; client: string; total: string }): { sujet: string; corps: string } {
    const nom = (LIBELLES[l] || FR).titre[o.type]
    const n = o.numero, c = o.client.trim()
    const m: Record<LangueDoc, { sujet: string; corps: string }> = {
        fr: { sujet: `${nom.charAt(0)}${nom.slice(1).toLowerCase()} N° ${n} : Retour Gagnant Bénin`, corps: `Bonjour ${c},\n\nVeuillez trouver ci-joint votre ${nom.toLowerCase()} N° ${n} d'un montant de ${o.total}.\n\nNous restons à votre disposition pour toute question.\n\nCordialement,\nL'équipe Retour Gagnant Bénin` },
        en: { sujet: `${o.type === 'devis' ? 'Quote' : o.type === 'avoir' ? 'Credit note' : 'Invoice'} No. ${n}: Retour Gagnant Bénin`, corps: `Hello ${c},\n\nPlease find attached your ${nom.toLowerCase()} No. ${n} for a total of ${o.total}.\n\nWe remain at your disposal for any question.\n\nKind regards,\nThe Retour Gagnant Bénin team` },
        es: { sujet: `${o.type === 'devis' ? 'Presupuesto' : o.type === 'avoir' ? 'Nota de crédito' : 'Factura'} N.º ${n}: Retour Gagnant Bénin`, corps: `Hola ${c}:\n\nAdjuntamos su ${nom.toLowerCase()} N.º ${n} por un importe de ${o.total}.\n\nQuedamos a su disposición para cualquier consulta.\n\nAtentamente,\nEl equipo de Retour Gagnant Bénin` },
        pt: { sujet: `${o.type === 'devis' ? 'Orçamento' : o.type === 'avoir' ? 'Nota de crédito' : 'Fatura'} N.º ${n}: Retour Gagnant Bénin`, corps: `Olá, ${c},\n\nSegue em anexo seu(sua) ${nom.toLowerCase()} N.º ${n} no valor de ${o.total}.\n\nEstamos à sua disposição para qualquer dúvida.\n\nAtenciosamente,\nA equipe Retour Gagnant Bénin` },
        cr: { sujet: `${o.type === 'devis' ? 'Dévi' : o.type === 'avoir' ? 'Avwa' : 'Fakti'} N° ${n} : Retour Gagnant Bénin`, corps: `Bonjou ${c},\n\nNou ka voyé-w ${nom.toLowerCase()} N° ${n} a-w la, pou on montan ${o.total}.\n\nNou la pou réponn tout kèsyon a-w.\n\nMèsi,\nÉkip Retour Gagnant Bénin` },
        ht: { sujet: `${o.type === 'devis' ? 'Devi' : o.type === 'avoir' ? 'Nòt kredi' : 'Fakti'} N° ${n} : Retour Gagnant Bénin`, corps: `Bonjou ${c},\n\nNou voye ${nom.toLowerCase()} ou N° ${n} an atache, pou yon montan ${o.total}.\n\nNou la pou reponn tout kesyon ou genyen.\n\nMèsi,\nEkip Retour Gagnant Bénin` },
    }
    return m[l] || m.fr
}

// ── Montant en lettres (anglais, espagnol, portugais du Brésil) ─────────────
const groupes = (n: number) => {
    const g: [number, number][] = []
    let r = Math.floor(n)
    for (const v of [1e9, 1e6, 1e3]) { g.push([v, Math.floor(r / v)]); r %= v }
    g.push([1, r])
    return g.filter(([, q]) => q > 0)
}

function anglais(n: number): string {
    if (n === 0) return 'zero'
    const U = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
    const T = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']
    const c = (x: number): string => {
        const h = Math.floor(x / 100), r = x % 100
        const d = r < 20 ? U[r] : T[Math.floor(r / 10)] + (r % 10 ? '-' + U[r % 10] : '')
        return [h ? U[h] + ' hundred' : '', d].filter(Boolean).join(' ')
    }
    const nom: Record<number, string> = { 1e9: ' billion', 1e6: ' million', 1e3: ' thousand', 1: '' }
    return groupes(n).map(([v, q]) => c(q) + nom[v]).join(' ')
}

function espagnol(n: number): string {
    if (n === 0) return 'cero'
    const U = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve',
        'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve']
    const T = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa']
    const H = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos']
    const c = (x: number): string => {
        if (x === 100) return 'cien'
        const h = Math.floor(x / 100), r = x % 100
        const d = r < 30 ? U[r] : T[Math.floor(r / 10)] + (r % 10 ? ' y ' + U[r % 10] : '')
        return [H[h], d].filter(Boolean).join(' ')
    }
    // « uno » s'apocope devant un nom (mil, millones, francos) : veintiún mil, un millón
    const apo = (s: string) => s.replace(/veintiuno$/, 'veintiún').replace(/uno$/, 'un')
    const parts: string[] = []
    let millones = 0
    for (const [v, q] of groupes(n)) {
        if (v === 1e9) millones += q * 1000
        else if (v === 1e6) millones += q
        else {
            if (millones) { parts.push(millones === 1 ? 'un millón' : apo(espagnol(millones)) + ' millones'); millones = 0 }
            parts.push(v === 1e3 ? (q === 1 ? 'mil' : apo(c(q)) + ' mil') : c(q))
        }
    }
    if (millones) parts.push(millones === 1 ? 'un millón' : apo(espagnol(millones)) + ' millones')
    return apo(parts.join(' '))
}

function portugais(n: number): string {
    if (n === 0) return 'zero'
    const U = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
    const T = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
    const H = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos']
    const c = (x: number): string => {
        if (x === 100) return 'cem'
        const h = Math.floor(x / 100), r = x % 100
        const d = r < 20 ? U[r] : T[Math.floor(r / 10)] + (r % 10 ? ' e ' + U[r % 10] : '')
        return [H[h], d].filter(Boolean).join(' e ')
    }
    const g = groupes(n)
    const parts = g.map(([v, q]) =>
        v === 1e9 ? (q === 1 ? 'um bilhão' : c(q) + ' bilhões')
            : v === 1e6 ? (q === 1 ? 'um milhão' : c(q) + ' milhões')
                : v === 1e3 ? (q === 1 ? 'mil' : c(q) + ' mil')
                    : c(q))
    // « e » avant le dernier groupe s'il est < 100 ou une centaine ronde : dois mil e quinhentos
    const dernier = g[g.length - 1]
    if (parts.length > 1 && (dernier[1] < 100 || dernier[1] % 100 === 0)) {
        const fin = parts.pop()!
        return parts.join(' ') + ' e ' + fin
    }
    return parts.join(' ')
}

/** [singulier, pluriel] par devise, centimes, et la conjonction « et » des centimes. */
const DEVISES: Record<'en' | 'es' | 'pt', { noms: Record<string, [string, string]>; c: [string, string]; et: string }> = {
    en: { noms: { XOF: ['CFA franc', 'CFA francs'], EUR: ['euro', 'euros'], USD: ['US dollar', 'US dollars'], GBP: ['pound sterling', 'pounds sterling'] }, c: ['cent', 'cents'], et: 'and' },
    es: { noms: { XOF: ['franco CFA', 'francos CFA'], EUR: ['euro', 'euros'], USD: ['dólar estadounidense', 'dólares estadounidenses'], GBP: ['libra esterlina', 'libras esterlinas'] }, c: ['céntimo', 'céntimos'], et: 'con' },
    pt: { noms: { XOF: ['franco CFA', 'francos CFA'], EUR: ['euro', 'euros'], USD: ['dólar americano', 'dólares americanos'], GBP: ['libra esterlina', 'libras esterlinas'] }, c: ['centavo', 'centavos'], et: 'e' },
}

/**
 * Montant rédigé en toutes lettres, ou null quand la langue n'en a pas
 * (français : rédigé par document-pdf.ts ; créoles : chiffres seulement).
 */
export function montantEnLettresLangue(v: number, cur: string, l: LangueDoc): string | null {
    if (l !== 'en' && l !== 'es' && l !== 'pt') return null
    const code = ['XOF', 'FCFA', 'XAF'].includes((cur || 'XOF').toUpperCase()) ? 'XOF' : (cur || '').toUpperCase()
    const dev = DEVISES[l].noms[code]
    if (!dev) return null
    const ecrire = l === 'en' ? anglais : l === 'es' ? espagnol : portugais
    const entier = Math.floor(Math.abs(v))
    const cents = code === 'XOF' ? 0 : Math.round((Math.abs(v) - entier) * 100)
    // million rond : « un millón DE francos », « dois milhões DE francos »
    const de = l !== 'en' && entier >= 1e6 && entier % 1e6 === 0 ? ' de' : ''
    const txt = `${ecrire(entier)}${de} ${dev[entier === 1 ? 0 : 1]}`
    return cents ? `${txt} ${DEVISES[l].et} ${ecrire(cents)} ${DEVISES[l].c[cents === 1 ? 0 : 1]}` : txt
}
