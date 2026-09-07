// ══════════════════════════════════════════════════════════════
//  LE MODÈLE DU RAPPORT HEBDOMADAIRE.
//
//  Repris fidèlement de `scripts/generate-rapport-kevin.mjs`, où il n'existait
//  que sous forme de valeurs écrites en dur : produire un rapport supposait de
//  modifier le fichier. Les formes sont ici nommées une fois, et servent
//  ensemble au formulaire, à l'API et au générateur de PDF — un champ ajouté
//  ici se propage aux trois, au lieu de diverger.
// ══════════════════════════════════════════════════════════════

/** Couleur d'accent d'une carte ou d'une fiche. Les trois du drapeau. */
export type Accent = 'vert' | 'jaune' | 'rouge'

/** Une réalisation de la semaine — les cartes de la section 1. */
export interface Realisation {
    titre: string
    description: string
    /** Étiquette courte : COMPTABILITÉ, SÉCURITÉ, ERGONOMIE… */
    tag: string
    accent: Accent
}

/** L'encadré libre qui suit les cartes (complément, contexte, annexe). */
export interface Encadre {
    titre: string
    /** Une ligne = une puce. */
    lignes: string[]
}

/** Une fiche de suivi — les cartes clients de la section 2. */
export interface FicheDossier {
    client: string
    /** Badge d'état : « ATTENTE PAIEMENT », « EN COURS »… */
    etat: string
    accent: Accent
    /** Paires libellé → valeur, dans l'ordre d'affichage. */
    champs: Array<{ label: string; valeur: string; alerte?: boolean }>
}

/** Le contenu complet d'un rapport. */
export interface ContenuRapport {
    /** Paragraphe d'ouverture adressé à la direction. */
    note_cadrage: string
    /** Ligne d'état affichée dans le bloc méta. */
    statut_operations: string

    /** Section 1 — titre + cartes. */
    section1_titre: string
    realisations: Realisation[]
    encadre: Encadre | null

    /** Section 2 — titre + règle mise en avant + fiches. */
    section2_titre: string
    regle_titre: string
    regle_texte: string
    dossiers: FicheDossier[]

    /** Section 3 — synthèse et signature. */
    section3_titre: string
    synthese_titre: string
    synthese_texte: string
    mention_finale: string
}

/**
 * Un rapport vierge, déjà rempli des LIBELLÉS du modèle.
 *
 * On ne part pas d'une page blanche : les titres de sections, la règle mise en
 * avant et la mention finale sont ceux du rapport de référence. L'auteur
 * remplace ce qui le concerne au lieu de tout réinventer — et deux rapports de
 * deux personnes gardent la même structure.
 */
export function rapportVierge(): ContenuRapport {
    return {
        note_cadrage: '',
        statut_operations: 'Opérations validées & conformité garantie',

        section1_titre: 'AMÉLIORATIONS CLÉS SUR LA PLATEFORME',
        realisations: [],
        encadre: null,

        section2_titre: 'SUIVI OPÉRATIONNEL DES DOSSIERS',
        regle_titre: 'RÈGLE DE TRAITEMENT STRICTE & FORMELLE (APPLICATION IMMÉDIATE) :',
        regle_texte: '',
        dossiers: [],

        section3_titre: 'SYNTHÈSE & ENGAGEMENT',
        synthese_titre: 'POINTS MAJEURS POUR LA DIRECTION :',
        synthese_texte: '',
        mention_finale: '[RAPPORT TRANSMIS]',
    }
}

/** Une réalisation vide, prête à remplir. */
export const realisationVierge = (): Realisation =>
    ({ titre: '', description: '', tag: '', accent: 'vert' })

/** Une fiche de suivi vide, avec les champs du modèle déjà nommés. */
export const ficheVierge = (): FicheDossier => ({
    client: '',
    etat: 'EN COURS',
    accent: 'vert',
    champs: [
        { label: 'DEMANDE / OBJET :', valeur: '' },
        { label: 'POINT DE BLOCAGE :', valeur: '' },
        { label: 'SOLUTION CONVENUE :', valeur: '' },
        { label: 'ACTION ENGAGÉE :', valeur: '', alerte: true },
    ],
})

/**
 * Complète un contenu venu de la base.
 *
 * Une ligne enregistrée avant l'ajout d'un champ n'en a pas la clé : sans ce
 * filet, le formulaire recevrait `undefined` et planterait à la frappe. On
 * fusionne donc toujours sur un rapport vierge.
 */
export function normaliserContenu(brut: unknown): ContenuRapport {
    const base = rapportVierge()
    if (!brut || typeof brut !== 'object') return base
    const c = brut as Partial<ContenuRapport>
    return {
        ...base,
        ...c,
        realisations: Array.isArray(c.realisations) ? c.realisations : [],
        dossiers: Array.isArray(c.dossiers) ? c.dossiers : [],
        encadre: c.encadre && typeof c.encadre === 'object'
            ? { titre: String(c.encadre.titre || ''), lignes: Array.isArray(c.encadre.lignes) ? c.encadre.lignes : [] }
            : null,
    }
}

/** Le lundi de la semaine d'une date — clé de période du rapport. */
export function lundiDe(d: Date = new Date()): string {
    const j = new Date(d)
    const jour = (j.getDay() + 6) % 7 // 0 = lundi
    j.setDate(j.getDate() - jour)
    return j.toISOString().slice(0, 10)
}

/** Le dimanche correspondant, pour afficher la période complète. */
export function dimancheDe(lundi: string): string {
    const d = new Date(lundi + 'T00:00:00')
    d.setDate(d.getDate() + 6)
    return d.toISOString().slice(0, 10)
}