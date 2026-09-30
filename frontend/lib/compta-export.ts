/* ═══════════════════════════════════════════════════════════
   COMPTABILITÉ — règles partagées par les écrans et les exports
   (admin, agent, FEC). Module PUR : aucune dépendance.

   1. RATTACHEMENT DES ENCAISSEMENTS
      Le CA FACTURÉ se rattache à la date d'ÉMISSION (created_at).
      Un ENCAISSEMENT se rattache à la date du PAIEMENT :
        paid_at  →  sinon date du dernier paiement manuel lié
                 →  sinon created_at (dernier recours).
      Avant : tout était daté par created_at — une facture émise en août
      et payée en septembre tombait en août dans les encaissements.

   2. NORMALISATION DES CHAMPS EXPORTÉS
      Noms (espaces multiples), téléphones (« + » perdu), formats
      monétaires Excel par devise.
═══════════════════════════════════════════════════════════ */

export interface DocEncaissable {
    id: string
    type: string
    status: string
    created_at: string
    paid_at?: string | null
}

export interface PaiementDate {
    document_id?: string | null
    date_paiement: string
}

const dateValide = (s?: string | null): s is string => !!s && !isNaN(new Date(s).getTime())

/** Index des paiements manuels par facture (ignore les paiements externes). */
export function indexPaiementsParDoc<P extends PaiementDate>(paiements: P[]): Map<string, P[]> {
    const m = new Map<string, P[]>()
    for (const p of paiements) {
        const id = p.document_id
        if (!id || id === 'null' || id === 'undefined') continue
        const l = m.get(id)
        if (l) l.push(p)
        else m.set(id, [p])
    }
    return m
}

/**
 * Date d'encaissement d'une facture payée :
 * paid_at, sinon date du DERNIER paiement manuel lié, sinon created_at.
 */
export function dateEncaissementFacture(doc: DocEncaissable, paiementsDuDoc?: PaiementDate[] | null): string {
    if (dateValide(doc.paid_at)) return doc.paid_at
    const dates = (paiementsDuDoc || []).map(p => p.date_paiement).filter(dateValide)
    if (dates.length) return dates.reduce((a, b) => (new Date(b) > new Date(a) ? b : a))
    return doc.created_at
}

/** Toutes les factures payées, chacune avec sa date d'encaissement. */
export function facturesPayeesDatees<D extends DocEncaissable>(
    docs: D[],
    parDoc: Map<string, PaiementDate[]>,
): Array<{ doc: D; date: string }> {
    return docs
        .filter(d => d.type === 'facture' && d.status === 'paye')
        .map(d => ({ doc: d, date: dateEncaissementFacture(d, parDoc.get(d.id)) }))
}

/** Filtre une liste datée sur [start, end] (bornes incluses, comme les écrans). */
export function dansPeriode<T extends { date: string }>(list: T[], start: Date, end: Date): T[] {
    return list.filter(x => {
        const d = new Date(x.date)
        return !isNaN(d.getTime()) && d >= start && d <= end
    })
}

// ─── Normalisation des champs exportés ─────────────────────────

/** Réduit les espaces multiples (« ORLAY  Gilles » → « ORLAY Gilles »), garde les sauts de ligne. */
export function nomPropre(s: unknown): string {
    if (s == null) return ''
    return String(s).replace(/[ \t  ]+/g, ' ').replace(/ *\n */g, '\n').trim()
}

/** Nom complet client : nom + prénom, espaces normalisés. */
export function nomClient(nom?: string | null, prenom?: string | null): string {
    return nomPropre(`${nom || ''} ${prenom || ''}`)
}

/**
 * Téléphone en TEXTE, « + » international restauré.
 * La base contient « +33 6 04… », « 33604114115 » ou « 0033… » : un numéro
 * international sans « + » (≥ 10 chiffres, ne commençant pas par 0) le
 * récupère ; « 00 » devient « + » ; un numéro national (0…) reste tel quel.
 * Jamais converti en nombre.
 */
export function telephoneTexte(v: unknown): string {
    const s = nomPropre(v)
    if (!s || s.startsWith('+')) return s
    const chiffres = s.replace(/[\s.\-()/]/g, '')
    if (!/^\d+$/.test(chiffres)) return s          // « Non renseigné », « - »…
    if (chiffres.startsWith('00') && chiffres.length > 4) return '+' + chiffres.slice(2)
    if (chiffres.startsWith('0')) return s
    if (chiffres.length >= 10) return '+' + s
    return s
}

/** Format monétaire Excel selon la devise (XOF sans décimales). */
export function numFmtDevise(code?: string | null): string {
    const c = String(code || 'XOF').trim().toUpperCase()
    if (!c || c === 'XOF' || c === 'FCFA' || c === 'CFA') return '#,##0 "FCFA"'
    if (c === 'XAF') return '#,##0 "FCFA"'
    const sym: Record<string, string> = { EUR: '€', USD: '$', GBP: '£' }
    return `#,##0.00 "${sym[c] || c}"`
}

/** Hash FNV-1a 32 bits → 8 caractères hex (code stable, sans dépendance). */
function fnv1a(s: string): string {
    let h = 0x811c9dc5
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i)
        h = Math.imul(h, 0x01000193) >>> 0
    }
    return h.toString(16).padStart(8, '0')
}

/**
 * Code auxiliaire client LISIBLE et STABLE (compte 411 du FEC) :
 * « C » + 6 premiers hex de client_id ; à défaut, 6 hex d'un hash de
 * l'email (ou du nom). Même client → même code, d'une facture à l'autre.
 */
export function codeClient(d: {
    id: string
    client_id?: string | null
    client_email?: string | null
    client_nom?: string | null
    client_prenom?: string | null
}): string {
    const hex = String(d.client_id || '').replace(/[^0-9a-f]/gi, '')
    if (hex.length >= 6) return 'C' + hex.slice(0, 6).toUpperCase()
    const cle = String(d.client_email || '').trim().toLowerCase()
        || nomClient(d.client_nom, d.client_prenom).toLowerCase()
        || d.id
    return 'C' + fnv1a(cle).slice(0, 6).toUpperCase()
}
