// ═══════════════════════════════════════════════════════════════
// EXPORT FEC / SYSCOHADA — Fichier des Écritures Comptables
// ═══════════════════════════════════════════════════════════════
// Génère un FEC en PARTIE DOUBLE à partir des données « cash » du projet
// (factures, paiements, dépenses), conforme au plan de comptes SYSCOHADA
// (OHADA / Bénin) et au format d'écritures comptables importable par un
// logiciel comptable / transmissible à l'expert-comptable.
//
// Modèle d'écritures :
//   • Journal VT (Ventes)     : facture → D 411 Clients (TTC)
//                                          C 706 Prestations (HT)
//                                          C 443 TVA facturée
//   • Journal BQ/CA (Trésor.) : paiement → D 521 Banque / 571 Caisse
//                                          C 411 Clients
//   • Journal AC (Achats)     : dépense → D 6xx Charge (par catégorie)
//                                          C 521 Banque
// Chaque écriture est équilibrée (Σ débit = Σ crédit). Montants en XOF
// (devise de tenue) ; la devise d'origine est conservée (Montantdevise/Idevise).

export interface FecDoc {
    id: string
    numero?: string | null
    created_at: string
    total: number
    total_tva?: number | null
    sous_total?: number | null
    remise?: number | null
    currency?: string | null
    type: string
    status: string
    client_nom?: string | null
    client_prenom?: string | null
}
export interface FecPaiement {
    id: string
    document_id?: string | null
    montant: number
    date_paiement: string
    type?: string | null
    reference?: string | null
}
export interface FecDepense {
    id: string
    titre?: string | null
    categorie?: string | null
    montant: number
    date_depense: string
}

export interface FecRow {
    JournalCode: string
    JournalLib: string
    EcritureNum: string
    EcritureDate: string
    CompteNum: string
    CompteLib: string
    CompAuxNum: string
    CompAuxLib: string
    PieceRef: string
    PieceDate: string
    EcritureLib: string
    Debit: string
    Credit: string
    EcritureLet: string
    DateLet: string
    ValidDate: string
    Montantdevise: string
    Idevise: string
}

// ── Plan de comptes SYSCOHADA (sous-ensemble agence de services) ──
const ACC = {
    clients: { num: '411000', lib: 'Clients' },
    ventes: { num: '706000', lib: 'Services vendus' },
    tvaFacturee: { num: '443100', lib: 'État, TVA facturée' },
    banque: { num: '521000', lib: 'Banques locales' },
    caisse: { num: '571000', lib: 'Caisse' },
}

// Charges par catégorie de dépense (classe 6 SYSCOHADA)
const CHARGE_ACCOUNT: Record<string, { num: string; lib: string }> = {
    loyer: { num: '622000', lib: 'Locations et charges locatives' },
    location: { num: '622000', lib: 'Locations et charges locatives' },
    transport: { num: '616000', lib: 'Transports' },
    deplacement: { num: '616000', lib: 'Transports et déplacements' },
    fournitures: { num: '605000', lib: 'Autres achats' },
    achat: { num: '601000', lib: 'Achats de marchandises' },
    salaire: { num: '661000', lib: 'Rémunérations directes versées au personnel' },
    salaires: { num: '661000', lib: 'Rémunérations directes versées au personnel' },
    personnel: { num: '661000', lib: 'Charges de personnel' },
    communication: { num: '628000', lib: 'Frais de télécommunications' },
    telephone: { num: '628000', lib: 'Frais de télécommunications' },
    internet: { num: '628000', lib: 'Frais de télécommunications' },
    marketing: { num: '627000', lib: 'Publicité, publications, relations publiques' },
    publicite: { num: '627000', lib: 'Publicité, publications, relations publiques' },
    maintenance: { num: '624000', lib: 'Entretien, réparations et maintenance' },
    entretien: { num: '624000', lib: 'Entretien, réparations et maintenance' },
    honoraires: { num: '632000', lib: "Rémunérations d'intermédiaires et honoraires" },
    prestation: { num: '632000', lib: "Rémunérations d'intermédiaires et honoraires" },
    impot: { num: '646000', lib: 'Droits d\'enregistrement, impôts et taxes' },
    impots: { num: '646000', lib: 'Droits d\'enregistrement, impôts et taxes' },
    taxe: { num: '646000', lib: 'Droits d\'enregistrement, impôts et taxes' },
    banque: { num: '631000', lib: 'Frais bancaires' },
    frais_bancaires: { num: '631000', lib: 'Frais bancaires' },
    eau: { num: '618000', lib: 'Autres charges externes' },
    electricite: { num: '618000', lib: 'Autres charges externes' },
    energie: { num: '618000', lib: 'Autres charges externes' },
}
const DEFAULT_CHARGE = { num: '628000', lib: 'Autres charges externes' }

function chargeAccount(categorie?: string | null) {
    const key = (categorie || '').toLowerCase().trim().replace(/\s+/g, '_')
    return CHARGE_ACCOUNT[key] || DEFAULT_CHARGE
}

// Trésorerie selon le moyen de paiement
function tresorerie(method?: string | null): { acc: { num: string; lib: string }; journal: { code: string; lib: string } } {
    const m = (method || '').toLowerCase()
    if (m === 'especes' || m === 'cash' || m === 'caisse') {
        return { acc: ACC.caisse, journal: { code: 'CA', lib: 'Journal de caisse' } }
    }
    return { acc: ACC.banque, journal: { code: 'BQ', lib: 'Journal de banque' } }
}

const ymd = (d: string) => {
    const dt = new Date(d)
    if (isNaN(dt.getTime())) return ''
    const y = dt.getUTCFullYear()
    const m = String(dt.getUTCMonth() + 1).padStart(2, '0')
    const day = String(dt.getUTCDate()).padStart(2, '0')
    return `${y}${m}${day}`
}
// FEC : séparateur décimal = virgule (convention francophone), 2 décimales
const amt = (n: number) => (Math.round((Number(n) || 0) * 100) / 100).toFixed(2).replace('.', ',')
const clean = (s?: string | null) => (s || '').replace(/[\t\r\n]+/g, ' ').trim()

export interface BuildFecOptions {
    docs: FecDoc[]
    paiements: FecPaiement[]
    depenses: FecDepense[]
    /** Conversion d'un montant vers XOF selon la devise. */
    toXof: (amount: number, currency?: string | null) => number
    /** Date de validation (ex. date de clôture/génération). YYYYMMDD. */
    validDate?: string
}

export function buildFec(opts: BuildFecOptions): FecRow[] {
    const { docs, paiements, depenses, toXof } = opts
    const validDate = opts.validDate || ''
    const rows: FecRow[] = []
    const counters: Record<string, number> = {}
    const nextNum = (jc: string) => {
        counters[jc] = (counters[jc] || 0) + 1
        return `${jc}${String(counters[jc]).padStart(6, '0')}`
    }
    const base = (): Omit<FecRow, 'JournalCode' | 'JournalLib' | 'EcritureNum' | 'EcritureDate' | 'CompteNum' | 'CompteLib' | 'PieceRef' | 'PieceDate' | 'EcritureLib' | 'Debit' | 'Credit'> => ({
        CompAuxNum: '', CompAuxLib: '', EcritureLet: '', DateLet: '', ValidDate: validDate,
        Montantdevise: '', Idevise: '',
    })

    const factures = docs.filter(d => d.type === 'facture')
    const numById: Record<string, string> = {}
    const cliById: Record<string, string> = {}
    for (const d of factures) {
        numById[d.id] = clean(d.numero) || d.id.slice(0, 8)
        cliById[d.id] = clean(`${d.client_nom || ''} ${d.client_prenom || ''}`) || 'Client'
    }

    // ── Journal des ventes (VT) ──
    for (const d of factures) {
        const cur = d.currency || 'XOF'
        const ttc = toXof(Number(d.total) || 0, cur)
        const tva = toXof(Number(d.total_tva) || 0, cur)
        const ht = toXof(
            d.sous_total != null ? Number(d.sous_total) : (Number(d.total) || 0) - (Number(d.total_tva) || 0),
            cur,
        )
        if (ttc <= 0) continue
        const num = nextNum('VT')
        const date = ymd(d.created_at)
        const piece = clean(d.numero) || d.id.slice(0, 8)
        const cli = clean(`${d.client_nom || ''} ${d.client_prenom || ''}`) || 'Client'
        const lib = `Facture ${piece} - ${cli}`
        const devCols = cur !== 'XOF' ? { Montantdevise: amt(Number(d.total) || 0), Idevise: cur } : { Montantdevise: '', Idevise: '' }
        // D 411 Clients (TTC)
        rows.push({ ...base(), JournalCode: 'VT', JournalLib: 'Journal des ventes', EcritureNum: num, EcritureDate: date, CompteNum: ACC.clients.num, CompteLib: ACC.clients.lib, CompAuxNum: d.id.slice(0, 12), CompAuxLib: cli, PieceRef: piece, PieceDate: date, EcritureLib: lib, Debit: amt(ttc), Credit: amt(0), ...devCols })
        // C 706 Ventes (HT)
        rows.push({ ...base(), JournalCode: 'VT', JournalLib: 'Journal des ventes', EcritureNum: num, EcritureDate: date, CompteNum: ACC.ventes.num, CompteLib: ACC.ventes.lib, PieceRef: piece, PieceDate: date, EcritureLib: lib, Debit: amt(0), Credit: amt(ht) })
        // C 443 TVA facturée
        if (tva > 0) {
            rows.push({ ...base(), JournalCode: 'VT', JournalLib: 'Journal des ventes', EcritureNum: num, EcritureDate: date, CompteNum: ACC.tvaFacturee.num, CompteLib: ACC.tvaFacturee.lib, PieceRef: piece, PieceDate: date, EcritureLib: lib, Debit: amt(0), Credit: amt(tva) })
        } else {
            // Si pas de TVA, le crédit 706 doit couvrir tout le TTC
            if (Math.abs(ht - ttc) > 0.01) {
                rows[rows.length - 1].Credit = amt(ttc)
            }
        }
    }

    // ── Journal des avoirs (AV) : contre-passation des ventes ──
    // Un avoir crédite le client → écriture inverse de la facture :
    //   D 706 Ventes (HT)  D 443 TVA facturée  C 411 Clients (TTC)
    const avoirs = docs.filter(d => d.type === 'avoir')
    for (const d of avoirs) {
        const cur = d.currency || 'XOF'
        const ttc = toXof(Number(d.total) || 0, cur)
        const tva = toXof(Number(d.total_tva) || 0, cur)
        const ht = toXof(
            d.sous_total != null ? Number(d.sous_total) : (Number(d.total) || 0) - (Number(d.total_tva) || 0),
            cur,
        )
        if (ttc <= 0) continue
        const num = nextNum('AV')
        const date = ymd(d.created_at)
        const piece = clean(d.numero) || d.id.slice(0, 8)
        const cli = clean(`${d.client_nom || ''} ${d.client_prenom || ''}`) || 'Client'
        const lib = `Avoir ${piece} - ${cli}`
        const devCols = cur !== 'XOF' ? { Montantdevise: amt(Number(d.total) || 0), Idevise: cur } : { Montantdevise: '', Idevise: '' }
        // D 706 Ventes (HT) — annule le produit
        rows.push({ ...base(), JournalCode: 'AV', JournalLib: 'Journal des avoirs', EcritureNum: num, EcritureDate: date, CompteNum: ACC.ventes.num, CompteLib: ACC.ventes.lib, PieceRef: piece, PieceDate: date, EcritureLib: lib, Debit: amt(tva > 0 ? ht : ttc), Credit: amt(0) })
        // D 443 TVA facturée — annule la TVA collectée
        if (tva > 0) {
            rows.push({ ...base(), JournalCode: 'AV', JournalLib: 'Journal des avoirs', EcritureNum: num, EcritureDate: date, CompteNum: ACC.tvaFacturee.num, CompteLib: ACC.tvaFacturee.lib, PieceRef: piece, PieceDate: date, EcritureLib: lib, Debit: amt(tva), Credit: amt(0) })
        }
        // C 411 Clients (TTC)
        rows.push({ ...base(), JournalCode: 'AV', JournalLib: 'Journal des avoirs', EcritureNum: num, EcritureDate: date, CompteNum: ACC.clients.num, CompteLib: ACC.clients.lib, CompAuxNum: d.id.slice(0, 12), CompAuxLib: cli, PieceRef: piece, PieceDate: date, EcritureLib: lib, Debit: amt(0), Credit: amt(ttc), ...devCols })
    }

    // ── Journal de trésorerie (BQ / CA) : encaissements ──
    for (const p of paiements) {
        const montant = toXof(Number(p.montant) || 0, 'XOF') // paiements en XOF
        if (montant <= 0) continue
        const { acc, journal } = tresorerie(p.type)
        const num = nextNum(journal.code)
        const date = ymd(p.date_paiement)
        const piece = clean(p.reference) || (p.document_id ? numById[p.document_id] : '') || p.id.slice(0, 8)
        const cli = p.document_id ? cliById[p.document_id] || 'Client' : 'Client'
        const lib = `Encaissement ${piece}${cli !== 'Client' ? ' - ' + cli : ''}`
        // D 521/571 Trésorerie
        rows.push({ ...base(), JournalCode: journal.code, JournalLib: journal.lib, EcritureNum: num, EcritureDate: date, CompteNum: acc.num, CompteLib: acc.lib, PieceRef: piece, PieceDate: date, EcritureLib: lib, Debit: amt(montant), Credit: amt(0) })
        // C 411 Clients
        rows.push({ ...base(), JournalCode: journal.code, JournalLib: journal.lib, EcritureNum: num, EcritureDate: date, CompteNum: ACC.clients.num, CompteLib: ACC.clients.lib, CompAuxNum: p.document_id ? p.document_id.slice(0, 12) : '', CompAuxLib: cli, PieceRef: piece, PieceDate: date, EcritureLib: lib, Debit: amt(0), Credit: amt(montant) })
    }

    // ── Journal des achats (AC) : dépenses ──
    for (const e of depenses) {
        const montant = toXof(Number(e.montant) || 0, 'XOF') // dépenses en XOF
        if (montant <= 0) continue
        const charge = chargeAccount(e.categorie)
        const num = nextNum('AC')
        const date = ymd(e.date_depense)
        const piece = clean(e.titre) || e.id.slice(0, 8)
        const lib = `Dépense ${clean(e.categorie) || ''} - ${piece}`.trim()
        // D 6xx Charge
        rows.push({ ...base(), JournalCode: 'AC', JournalLib: 'Journal des achats', EcritureNum: num, EcritureDate: date, CompteNum: charge.num, CompteLib: charge.lib, PieceRef: piece, PieceDate: date, EcritureLib: lib, Debit: amt(montant), Credit: amt(0) })
        // C 521 Banque (réglée)
        rows.push({ ...base(), JournalCode: 'AC', JournalLib: 'Journal des achats', EcritureNum: num, EcritureDate: date, CompteNum: ACC.banque.num, CompteLib: ACC.banque.lib, PieceRef: piece, PieceDate: date, EcritureLib: lib, Debit: amt(0), Credit: amt(montant) })
    }

    return rows
}

const FEC_HEADER = [
    'JournalCode', 'JournalLib', 'EcritureNum', 'EcritureDate', 'CompteNum', 'CompteLib',
    'CompAuxNum', 'CompAuxLib', 'PieceRef', 'PieceDate', 'EcritureLib', 'Debit', 'Credit',
    'EcritureLet', 'DateLet', 'ValidDate', 'Montantdevise', 'Idevise',
]

/** Sérialise le FEC en texte tabulé (format standard importable). */
export function serializeFec(rows: FecRow[]): string {
    const lines = [FEC_HEADER.join('\t')]
    for (const r of rows) {
        lines.push([
            r.JournalCode, r.JournalLib, r.EcritureNum, r.EcritureDate, r.CompteNum, r.CompteLib,
            r.CompAuxNum, r.CompAuxLib, r.PieceRef, r.PieceDate, r.EcritureLib, r.Debit, r.Credit,
            r.EcritureLet, r.DateLet, r.ValidDate, r.Montantdevise, r.Idevise,
        ].join('\t'))
    }
    return lines.join('\r\n')
}

/** Contrôle d'équilibre : total débit doit égaler total crédit. */
export function fecBalance(rows: FecRow[]): { debit: number; credit: number; balanced: boolean } {
    const parse = (s: string) => parseFloat(s.replace(',', '.')) || 0
    const debit = rows.reduce((a, r) => a + parse(r.Debit), 0)
    const credit = rows.reduce((a, r) => a + parse(r.Credit), 0)
    return { debit: Math.round(debit * 100) / 100, credit: Math.round(credit * 100) / 100, balanced: Math.abs(debit - credit) < 0.5 }
}
