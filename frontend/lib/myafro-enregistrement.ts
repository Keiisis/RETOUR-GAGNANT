// ══════════════════════════════════════════════════════════════
//  Enregistrement d'un dossier sur la plateforme MyAfroOrigins.
//
//  Quand l'équipe dépose le dossier d'un client sur MyAfroOrigins, la
//  plateforme attribue un NUMÉRO DE DOSSIER et l'équipe crée l'accès du
//  client au portail de suivi (e-mail + mot de passe). Ces informations
//  sont consignées ici, une fois, et produisent :
//    - le marqueur « Transmis sur MyAfroOrigins » dans les panels ;
//    - la « fiche de synthèse d'enregistrement » remise au client
//      (lib/fiche-suivi-pdf.ts).
//  Module pur (navigateur + serveur) : types, statuts, validation.
//  Le stockage est serveur seulement (lib/myafro-enregistrement-serveur.ts).
// ══════════════════════════════════════════════════════════════

/** Origine : demande de nationalité, demande MyAfroOrigins (récap), ou fiche libre (client hors fichier). */
export type NatureDossier = 'nationalite' | 'recap' | 'libre'
export const NATURES: NatureDossier[] = ['nationalite', 'recap', 'libre']
export const estNature = (v: unknown): v is NatureDossier => NATURES.includes(v as NatureDossier)

/** Avancement du dossier CHEZ MyAfroOrigins (suivi par l'équipe). */
export const STATUTS_MYAFRO = [
    { value: 'transmis', label: 'Transmis sur MyAfroOrigins', badge: 'bg-cyan-600 text-white' },
    { value: 'en_instruction', label: 'En instruction', badge: 'bg-blue-600 text-white' },
    { value: 'complement', label: 'Complément demandé', badge: 'bg-amber-500 text-white' },
    { value: 'valide', label: 'Validé par MyAfroOrigins', badge: 'bg-emerald-600 text-white' },
    { value: 'rejete', label: 'Rejeté par MyAfroOrigins', badge: 'bg-red-600 text-white' },
] as const
export type StatutMyafro = typeof STATUTS_MYAFRO[number]['value']
export const statutMyafro = (v?: string | null) => STATUTS_MYAFRO.find(s => s.value === v) || STATUTS_MYAFRO[0]

export type Civilite = 'M.' | 'Mme' | ''

export interface EtapeHistorique { le: string; statut: StatutMyafro; par: string; note?: string }

/** Enregistrement complet (mot de passe compris) : jamais renvoyé par une liste. */
export interface EnregistrementMyafro {
    nature: NatureDossier
    dossierId: string
    /** Référence interne RGB (application_ref ou référence du récap). */
    referenceRgb: string
    numeroDossier: string
    /** AAAA-MM-JJ */
    dateDepot: string
    emailSuivi: string
    motDePasse: string
    statut: StatutMyafro
    demandeur: { civilite: Civilite; nom: string; prenom: string }
    creeLe: string
    creePar: string
    majLe: string
    majPar: string
    ficheEnvoyeeLe?: string
    ficheEnvoyeeA?: string
    historique: EtapeHistorique[]
}
export type ResumeEnregistrement = Omit<EnregistrementMyafro, 'motDePasse'>

/** Ce que l'équipe saisit, À LA MAIN, tel que le client l'a fourni et utilisé sur MyAfroOrigins. */
export interface SaisieEnregistrement {
    nom: string
    prenom: string
    numeroDossier: string
    dateDepot: string
    emailSuivi: string
    motDePasse: string
    statut: StatutMyafro
    civilite: Civilite
    note?: string
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Contrôle de la saisie. Renvoie les erreurs en clair (une par champ). */
export function validerSaisie(s: Partial<SaisieEnregistrement>): { ok: true; valeur: SaisieEnregistrement } | { ok: false; erreurs: Record<string, string> } {
    const e: Record<string, string> = {}
    const nom = String(s.nom ?? '').replace(/\s+/g, ' ').trim()
    const prenom = String(s.prenom ?? '').replace(/\s+/g, ' ').trim()
    if (!nom) e.nom = 'Nom requis.'
    else if (nom.length > 80) e.nom = 'Nom trop long.'
    if (!prenom) e.prenom = 'Prénom requis.'
    else if (prenom.length > 80) e.prenom = 'Prénom trop long.'
    const numero = String(s.numeroDossier ?? '').trim().replace(/^N[°o]\s*/i, '')
    if (!numero) e.numeroDossier = 'Numéro de dossier MyAfroOrigins requis.'
    else if (!/^[A-Za-z0-9][A-Za-z0-9 ./-]{2,39}$/.test(numero)) e.numeroDossier = 'Numéro invalide : chiffres, lettres, tirets (3 à 40 caractères).'
    const date = String(s.dateDepot ?? '').trim()
    const d = new Date(`${date}T12:00:00Z`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(d.getTime())) e.dateDepot = 'Date de dépôt invalide.'
    else if (d.getTime() > Date.now() + 36 * 3600_000) e.dateDepot = 'La date de dépôt ne peut pas être dans le futur.'
    else if (d.getUTCFullYear() < 2024) e.dateDepot = 'Date de dépôt antérieure à la loi 2024-31 : vérifiez.'
    const email = String(s.emailSuivi ?? '').trim().toLowerCase()
    if (!EMAIL.test(email)) e.emailSuivi = 'E-mail de suivi invalide.'
    const mdp = String(s.motDePasse ?? '')
    if (mdp.trim() !== mdp) e.motDePasse = 'Le mot de passe ne doit pas commencer ni finir par un espace.'
    else if (mdp.length < 6 || mdp.length > 64) e.motDePasse = 'Mot de passe : 6 à 64 caractères.'
    const statut = STATUTS_MYAFRO.some(x => x.value === s.statut) ? s.statut as StatutMyafro : 'transmis'
    const civilite: Civilite = s.civilite === 'M.' || s.civilite === 'Mme' ? s.civilite : ''
    if (Object.keys(e).length) return { ok: false, erreurs: e }
    return { ok: true, valeur: { nom, prenom, numeroDossier: numero, dateDepot: date, emailSuivi: email, motDePasse: mdp, statut, civilite, note: String(s.note ?? '').trim().slice(0, 500) || undefined } }
}

/** Civilité déduite du genre déclaré (« Masculin », « Féminin »…). */
export function civiliteDepuisGenre(g?: string | null): Civilite {
    const v = String(g || '').toLowerCase()
    if (/^(m|masc|homme|male|man)/.test(v) && !/^(mme|madame)/.test(v)) return 'M.'
    if (/^(f|fém|fem|femme|female|woman|mme|madame)/.test(v)) return 'Mme'
    return ''
}

/** Mot de passe proposé : 12 caractères, majuscule, minuscule, chiffre et symbole, sans caractère ambigu (0/O, 1/l/I). */
export function proposerMotDePasse(): string {
    const maj = 'ABCDEFGHJKMNPQRSTUVWXYZ', min = 'abcdefghjkmnpqrstuvwxyz', chi = '23456789', sym = '@#$%&*+?'
    const tirer = (s: string) => {
        const a = new Uint32Array(1)
        globalThis.crypto.getRandomValues(a)
        return s[a[0] % s.length]
    }
    const base = [tirer(maj), tirer(min), tirer(chi), tirer(sym), ...Array.from({ length: 8 }, () => tirer(maj + min + chi))]
    for (let i = base.length - 1; i > 0; i--) { const a = new Uint32Array(1); globalThis.crypto.getRandomValues(a); const j = a[0] % (i + 1); [base[i], base[j]] = [base[j], base[i]] }
    return base.join('')
}
